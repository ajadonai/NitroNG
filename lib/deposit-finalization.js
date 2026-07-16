import prisma from './prisma.js';
import { log } from './logger.js';
import { applyWelcomeBonusDetailed } from './welcome-bonus.js';

const DEFAULT_CLAIMABLE_STATUSES = ['Pending', 'Processing', 'Expired'];
const REFERRAL_SETTING_KEYS = ['ref_referrer_bonus', 'ref_invitee_bonus', 'ref_enabled', 'ref_min_deposit'];
const MAX_FINALIZATION_ATTEMPTS = 3;
const EFFECT_KEY_PREFIX = 'payment:';

function cleanMarkerValue(value) {
  return String(value ?? '').replace(/[\[\]\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
}

function appendMarker(note, marker) {
  if (!marker || note.includes(marker)) return note;
  return `${note} ${marker}`.trim();
}

export function depositEffectKey(kind, identifier) {
  const safeKind = cleanMarkerValue(kind).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const safeIdentifier = cleanMarkerValue(identifier);
  if (!safeKind || !safeIdentifier) throw new TypeError('Deposit effect kind and identifier are required');
  return `${EFFECT_KEY_PREFIX}${safeKind}:${safeIdentifier}`;
}

export function isReservedDepositEffectKey(value) {
  return typeof value === 'string' && value.startsWith(EFFECT_KEY_PREFIX);
}

export function buildDepositCompletionNote(note, {
  approvedBy,
  recoveredBy,
  providerPaidAmount,
} = {}) {
  let completed = String(note || '').trim();

  if (approvedBy) {
    const marker = `[approved_by:${cleanMarkerValue(approvedBy)}]`;
    // Keep the user's confirmation/sender reference as audit evidence. The
    // pre-confirmation placeholder is the only marker that is safe to remove.
    completed = completed.replace(/\[awaiting_confirmation\]/g, '').trim();
    completed = appendMarker(completed, marker);
  }

  if (providerPaidAmount !== undefined && providerPaidAmount !== null && providerPaidAmount !== '') {
    completed = appendMarker(completed, `[paid:${cleanMarkerValue(providerPaidAmount)}]`);
  }
  if (recoveredBy) {
    completed = appendMarker(completed, `[recovered-by:${cleanMarkerValue(recoveredBy)}]`);
  }

  return completed.replace(/\s+/g, ' ').trim() || null;
}

export function calculateCouponBonus(coupon, depositAmountKobo, now = new Date()) {
  const amount = Number(depositAmountKobo);
  if (!coupon || coupon.enabled === false || !Number.isSafeInteger(amount) || amount <= 0) return 0;

  if (coupon.expires) {
    const expiresAt = new Date(coupon.expires);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt < now) return 0;
  }

  const maxUses = Number(coupon.maxUses) || 0;
  const used = Number(coupon.used) || 0;
  if (maxUses > 0 && used >= maxUses) return 0;

  const minDepositKobo = (Number(coupon.minOrder) || 0) * 100;
  if (minDepositKobo > 0 && amount < minDepositKobo) return 0;

  const maxDepositKobo = (Number(coupon.maxDeposit) || 0) * 100;
  const bonusBase = maxDepositKobo > 0 ? Math.min(amount, maxDepositKobo) : amount;
  const value = Number(coupon.value);
  if (!Number.isFinite(value) || value <= 0) return 0;

  const rawBonus = coupon.type === 'percent'
    ? Math.round(bonusBase * (value / 100))
    : Math.round(value * 100);
  return Number.isSafeInteger(rawBonus) && rawBonus > 0 ? rawBonus : 0;
}

function parseCouponId(note) {
  return String(note || '').match(/\[coupon:([^\]]+)\]/)?.[1] || null;
}

function parseNonNegativeKobo(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallback;
}

function isRetryableFinalizationError(error) {
  return error?.code === 'P2002'
    || error?.code === 'P2034'
    || error?.meta?.code === '40001'
    || error?.meta?.code === '40P01';
}

async function applyCoupon(db, deposit, paidAmountKobo, now) {
  const couponId = parseCouponId(deposit.note);
  if (!couponId) return { amount: 0, couponId: null, code: null };

  // Lock the shared coupon document before checking durable usage evidence. This
  // makes two deposits using the same coupon observe one another after the lock.
  const [couponRow] = await db.$queryRaw`SELECT value FROM settings WHERE key = 'coupons' FOR UPDATE`;
  if (!couponRow) return { amount: 0, couponId, code: null };

  const idempotencyKey = depositEffectKey('coupon', couponId);
  const alreadyUsed = await db.transaction.findFirst({
    where: {
      userId: deposit.userId,
      type: 'bonus',
      OR: [
        { idempotencyKey },
        { note: { contains: `[cid:${couponId}]` } },
      ],
    },
  });
  if (alreadyUsed) return { amount: 0, couponId, code: null };

  let coupons;
  try {
    coupons = JSON.parse(couponRow.value);
  } catch {
    throw new Error('Invalid coupons setting');
  }
  if (!Array.isArray(coupons)) throw new Error('Invalid coupons setting');

  const coupon = coupons.find(item => item.id === couponId);
  if (!coupon) return { amount: 0, couponId, code: null };

  if (coupon.newUsersOnly) {
    const priorDeposit = await db.transaction.findFirst({
      where: {
        userId: deposit.userId,
        type: 'deposit',
        status: 'Completed',
        id: { not: deposit.id },
      },
    });
    if (priorDeposit) return { amount: 0, couponId, code: coupon.code || null };
  }

  const amount = calculateCouponBonus(coupon, paidAmountKobo, now);
  if (amount <= 0) return { amount: 0, couponId, code: coupon.code || null };

  const updatedCoupons = coupons.map(item => item.id === couponId
    ? { ...item, used: (Number(item.used) || 0) + 1 }
    : item);
  await db.setting.update({
    where: { key: 'coupons' },
    data: { value: JSON.stringify(updatedCoupons) },
  });
  await db.transaction.create({
    data: {
      userId: deposit.userId,
      type: 'bonus',
      amount,
      status: 'Completed',
      idempotencyKey,
      note: `Coupon ${coupon.code || couponId}: bonus [cid:${couponId}]`,
    },
  });

  return { amount, couponId, code: coupon.code || null };
}

async function applyReferral(db, depositUser, paidAmountKobo) {
  const empty = {
    paid: false,
    referrerBonus: 0,
    inviteeBonus: 0,
    referrer: null,
    withheldReason: null,
  };
  if (!depositUser?.referredBy) return empty;

  const rows = await db.setting.findMany({ where: { key: { in: REFERRAL_SETTING_KEYS } } });
  const settings = Object.fromEntries(rows.map(row => [row.key, row.value]));
  const enabled = settings.ref_enabled === undefined || settings.ref_enabled === 'true';
  const minimum = parseNonNegativeKobo(settings.ref_min_deposit, 0);
  if (!enabled || minimum <= 0 || paidAmountKobo < minimum) return empty;

  const inviteeKey = depositEffectKey('referral-invitee', depositUser.id);
  const marker = `[ref-marker:${depositUser.id}]`;
  const alreadyPaid = await db.transaction.findFirst({
    where: {
      userId: depositUser.id,
      type: 'referral',
      OR: [
        { idempotencyKey: inviteeKey },
        { note: { contains: marker } },
      ],
    },
  });
  if (alreadyPaid) return empty;

  const referrer = await db.user.findUnique({
    where: { referralCode: depositUser.referredBy },
    select: { id: true, email: true, name: true, signupIp: true },
  });
  if (!referrer || referrer.id === depositUser.id) return empty;

  const sameIp = referrer.signupIp
    && depositUser.signupIp
    && referrer.signupIp !== 'unknown'
    && referrer.signupIp === depositUser.signupIp;
  if (sameIp) {
    log.warn('Referral', `Self-referral suspected: ${depositUser.id} → ${referrer.id} (same IP ${depositUser.signupIp})`);
    return { ...empty, referrer, withheldReason: 'same_ip' };
  }

  const referrerBonus = parseNonNegativeKobo(settings.ref_referrer_bonus, 50_000);
  const inviteeBonus = parseNonNegativeKobo(settings.ref_invitee_bonus, 50_000);
  const referrerKey = depositEffectKey('referral-referrer', depositUser.id);

  if (referrerBonus > 0) {
    await db.user.update({ where: { id: referrer.id }, data: { balance: { increment: referrerBonus } } });
  }
  await db.transaction.create({
    data: {
      userId: referrer.id,
      type: 'referral',
      amount: referrerBonus,
      status: 'Completed',
      idempotencyKey: referrerKey,
      note: `Referral bonus: ${depositUser.name || depositUser.email || depositUser.id} deposited`,
    },
  });

  if (inviteeBonus > 0) {
    await db.user.update({ where: { id: depositUser.id }, data: { balance: { increment: inviteeBonus } } });
  }
  await db.transaction.create({
    data: {
      userId: depositUser.id,
      type: 'referral',
      amount: inviteeBonus,
      status: 'Completed',
      idempotencyKey: inviteeKey,
      note: `Referral welcome bonus ${marker}`,
    },
  });

  return { paid: true, referrerBonus, inviteeBonus, referrer, withheldReason: null };
}

async function finalizeOnce({
  prismaClient,
  transactionId,
  reference,
  userId,
  paidAmountKobo,
  claimableStatuses,
  approvedBy,
  recoveredBy,
  providerPaidAmount,
  now,
}) {
  return prismaClient.$transaction(async db => {
    const lookup = transactionId ? { id: transactionId } : { reference };
    const deposit = await db.transaction.findUnique({ where: lookup });
    if (!deposit || deposit.type !== 'deposit' || (userId && deposit.userId !== userId)) {
      return { finalized: false, reason: 'not_found', transaction: null };
    }
    if (deposit.status === 'Completed') {
      return { finalized: false, reason: 'already_completed', transaction: deposit };
    }
    if (!Number.isSafeInteger(paidAmountKobo) || paidAmountKobo <= 0 || paidAmountKobo !== deposit.amount) {
      return {
        finalized: false,
        reason: 'amount_mismatch',
        expectedAmount: deposit.amount,
        paidAmount: paidAmountKobo,
        transaction: deposit,
      };
    }

    const completedNote = buildDepositCompletionNote(deposit.note, { approvedBy, recoveredBy, providerPaidAmount });
    const claimed = await db.transaction.updateMany({
      where: {
        id: deposit.id,
        type: 'deposit',
        status: { in: claimableStatuses },
      },
      data: {
        status: 'Completed',
        amount: paidAmountKobo,
        note: completedNote,
      },
    });
    if (claimed.count === 0) {
      const current = await db.transaction.findUnique({ where: { id: deposit.id } });
      return {
        finalized: false,
        reason: current?.status === 'Completed' ? 'already_completed' : 'not_claimable',
        transaction: current,
      };
    }

    const coupon = await applyCoupon(db, deposit, paidAmountKobo, now);

    // This row lock serialises all deposit effects for the same wallet. Referral
    // and welcome checks run only after it, so competing deposits see committed
    // durable effect rows from the winner.
    await db.user.update({
      where: { id: deposit.userId },
      data: { balance: { increment: paidAmountKobo + coupon.amount } },
    });

    const welcome = await applyWelcomeBonusDetailed(db, deposit.userId, paidAmountKobo, {
      now,
      idempotencyKey: depositEffectKey('welcome', 'first'),
    });

    const depositUser = await db.user.findUnique({
      where: { id: deposit.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        balance: true,
        referredBy: true,
        signupIp: true,
        lastIp: true,
        lastUa: true,
        lastFbp: true,
        lastFbc: true,
      },
    });
    const referral = await applyReferral(db, depositUser, paidAmountKobo);
    const finalUser = await db.user.findUnique({
      where: { id: deposit.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        balance: true,
        lastIp: true,
        lastUa: true,
        lastFbp: true,
        lastFbc: true,
      },
    });

    return {
      finalized: true,
      reason: 'completed',
      transaction: {
        ...deposit,
        status: 'Completed',
        amount: paidAmountKobo,
        note: completedNote,
      },
      user: finalUser,
      depositAmount: paidAmountKobo,
      couponBonus: coupon.amount,
      couponId: coupon.couponId,
      couponCode: coupon.code,
      welcomeBonus: welcome.amount,
      welcomeWithheld: welcome.withheld,
      referrerBonus: referral.referrerBonus,
      inviteeBonus: referral.inviteeBonus,
      referralPaid: referral.paid,
      referrer: referral.referrer,
      referralWithheldReason: referral.withheldReason,
      totalUserCredit: paidAmountKobo + coupon.amount + welcome.amount + referral.inviteeBonus,
    };
  }, { isolationLevel: 'Serializable' });
}

export async function finalizeDeposit({
  prismaClient = prisma,
  transactionId,
  reference,
  userId,
  paidAmountKobo,
  claimableStatuses = DEFAULT_CLAIMABLE_STATUSES,
  approvedBy,
  recoveredBy,
  providerPaidAmount,
  now = new Date(),
} = {}) {
  if (!transactionId && !reference) throw new TypeError('transactionId or reference is required');
  if (!Array.isArray(claimableStatuses) || claimableStatuses.length === 0) {
    throw new TypeError('At least one claimable status is required');
  }

  const options = {
    prismaClient,
    transactionId,
    reference,
    userId,
    paidAmountKobo,
    claimableStatuses,
    approvedBy,
    recoveredBy,
    providerPaidAmount,
    now,
  };

  for (let attempt = 1; attempt <= MAX_FINALIZATION_ATTEMPTS; attempt++) {
    try {
      return await finalizeOnce(options);
    } catch (error) {
      if (!isRetryableFinalizationError(error) || attempt === MAX_FINALIZATION_ATTEMPTS) throw error;
      log.warn('Deposit Finalization', `Retrying transaction after ${error.code || error.meta?.code || 'serialization conflict'} (${attempt}/${MAX_FINALIZATION_ATTEMPTS})`);
    }
  }
}
