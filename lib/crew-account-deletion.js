import { createHash } from 'node:crypto';

export const CREW_DELETION_REDACTION = 'Deleted Pit member';

const UNSETTLED_PAYOUT_STATUSES = ['pending', 'processing'];
const TERMINAL_PAYOUT_STATUSES = ['completed', 'rejected'];

export const CLEARED_PAYOUT_BANK_FIELDS = Object.freeze({
  bankName: null,
  bankAccountNo: null,
  bankAccountName: null,
});

export function crewMemberDeletionTombstones(memberId) {
  if (!memberId) throw new TypeError('Crew member ID is required');
  return {
    name: `${CREW_DELETION_REDACTION} ${memberId}`,
    email: `deleted-${memberId}@pit.invalid`,
    password: `!deleted:${memberId}`,
  };
}

export function crewLinkDeletionTombstones(linkId) {
  if (!linkId) throw new TypeError('Acquisition link ID is required');
  const digest = createHash('md5').update(`nitro-pit-link:v1:${linkId}`).digest('hex');
  return {
    name: `Deleted Pit link ${linkId}`,
    // User-created Pit slugs are capped at 30 characters. This reserved,
    // deterministic value is longer and includes both the row ID and digest.
    slug: `pit-deleted-${linkId}-${digest}`,
  };
}

function anonymizedCrewMemberData(memberId, deletedAt) {
  return {
    ...crewMemberDeletionTombstones(memberId),
    status: 'deleted',
    deletedAt,
    phone: null,
    xHandle: null,
    telegramHandle: null,
    telegramUserId: null,
    telegramLinkCode: null,
    telegramLinkCodeExpiresAt: null,
    whyApply: null,
    bankAccountName: null,
    bankName: null,
    bankAccountNo: null,
    userId: null,
    teamName: null,
    leadId: null,
    inviteToken: null,
    inviteExpiresAt: null,
    resetToken: null,
    resetExpires: null,
  };
}

function personalLogValues(member) {
  return [...new Set([
    member.name,
    member.email,
    member.phone,
    member.xHandle,
    member.telegramHandle,
    member.whyApply,
    member.bankAccountName,
    member.bankName,
    member.bankAccountNo,
    member.teamName,
  ].filter(value => typeof value === 'string' && value.trim().length >= 3))]
    .sort((left, right) => right.length - left.length);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactText(text, personalValues) {
  let redacted = text;
  for (const value of personalValues) {
    redacted = redacted.replace(new RegExp(escapeRegExp(value), 'gi'), CREW_DELETION_REDACTION);
  }
  return redacted;
}

async function redactCrewActivity(tx, member, linkIds) {
  const values = personalLogValues(member);
  if (values.length === 0) return;
  const tombstoneName = crewMemberDeletionTombstones(member.id).name;

  const activityRows = await tx.activityLog.findMany({
    where: {
      OR: [
        {
          type: 'crew',
          OR: values.map(value => ({ action: { contains: value, mode: 'insensitive' } })),
        },
        // Pit self-service events stored the member's display name in the
        // adminName column. Limit this rewrite to pit-self rows so a real admin
        // who happens to share the same name is never altered.
        { type: 'pit-self', adminName: member.name },
      ],
    },
    select: { id: true, action: true, adminName: true, type: true },
  });
  for (const row of activityRows) {
    const action = redactText(row.action, values);
    const adminName = row.type === 'pit-self' && row.adminName === member.name
      ? tombstoneName
      : row.adminName;
    if (action !== row.action || adminName !== row.adminName) {
      await tx.activityLog.update({
        where: { id: row.id },
        data: { action, adminName },
      });
    }
  }

  const linkLogRows = await tx.linkLog.findMany({
    where: {
      OR: [
        { actorId: member.id },
        ...(linkIds.length > 0 ? [{ linkId: { in: linkIds } }] : []),
      ],
      detail: { not: null },
    },
    select: { id: true, detail: true },
  });
  for (const row of linkLogRows) {
    const detail = redactText(row.detail, values);
    if (detail !== row.detail) {
      await tx.linkLog.update({ where: { id: row.id }, data: { detail } });
    }
  }
}

async function preserveUnsettledPayoutSnapshots(tx, member) {
  const payouts = await tx.affiliatePayout.findMany({
    where: { memberId: member.id, status: { in: UNSETTLED_PAYOUT_STATUSES } },
    select: {
      id: true,
      bankName: true,
      bankAccountNo: true,
      bankAccountName: true,
    },
  });

  for (const payout of payouts) {
    await tx.affiliatePayout.updateMany({
      where: { id: payout.id, status: { in: UNSETTLED_PAYOUT_STATUSES } },
      data: {
        bankName: payout.bankName ?? member.bankName,
        bankAccountNo: payout.bankAccountNo ?? member.bankAccountNo,
        bankAccountName: payout.bankAccountName ?? member.bankAccountName,
      },
    });
  }
}

export async function permanentlyDeleteCrewMember(tx, memberId, deletedAt = new Date()) {
  if (!memberId) throw Object.assign(new Error('Member not found'), { _status: 404 });
  if (!(deletedAt instanceof Date) || !Number.isFinite(deletedAt.getTime())) {
    throw new TypeError('A valid deletion time is required');
  }

  const member = await tx.crewMember.findUnique({ where: { id: memberId } });
  if (!member) throw Object.assign(new Error('Member not found'), { _status: 404 });

  const { count } = await tx.crewMember.updateMany({
    where: { id: memberId, deletedAt: null },
    data: anonymizedCrewMemberData(memberId, deletedAt),
  });
  if (count !== 1) throw Object.assign(new Error('Member is already deleted'), { _status: 409 });

  // The payout snapshot is the only bank copy retained after deletion, and
  // only while an existing obligation is still pending admin disposition.
  await preserveUnsettledPayoutSnapshots(tx, member);
  await tx.affiliatePayout.updateMany({
    where: { memberId, status: { in: TERMINAL_PAYOUT_STATUSES } },
    data: CLEARED_PAYOUT_BANK_FIELDS,
  });

  // A deleted member forfeits held direct earnings. If the deleted member was
  // only the chief on somebody else's held commission, preserve the active
  // marketer's amount and the historical lead ID/rate while zeroing the share
  // that can no longer be paid.
  await tx.affiliateCommission.updateMany({
    where: { memberId, status: 'held' },
    data: {
      status: 'voided',
      voidedAt: deletedAt,
      voidReason: 'member_deleted',
    },
  });
  await tx.affiliateCommission.updateMany({
    where: { leadId: memberId, memberId: { not: memberId }, status: 'held' },
    data: {
      leadAmount: 0,
      leadForfeitedAt: deletedAt,
      leadForfeitReason: 'lead_deleted',
    },
  });

  await tx.crewSession.deleteMany({ where: { memberId } });

  const links = await tx.acquisitionLink.findMany({
    where: { OR: [{ affiliateId: memberId }, { createdByChiefId: memberId }] },
    select: { id: true, name: true, affiliateId: true, archivedAt: true },
  });
  for (const link of links) {
    if (link.affiliateId !== memberId) {
      const name = redactText(link.name, personalLogValues(member));
      if (name !== link.name) {
        await tx.acquisitionLink.update({ where: { id: link.id }, data: { name } });
      }
      continue;
    }
    await tx.acquisitionLink.update({
      where: { id: link.id },
      data: {
        ...crewLinkDeletionTombstones(link.id),
        enabled: false,
        archivedAt: link.archivedAt ?? deletedAt,
      },
    });
  }

  await tx.crewMember.updateMany({
    where: { leadId: memberId, deletedAt: null },
    data: { leadId: null },
  });
  await redactCrewActivity(tx, member, links.map(link => link.id));

  return { telegramUserId: member.telegramUserId };
}
