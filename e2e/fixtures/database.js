import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

export const USER_EMAIL = 'nitro-e2e-user@example.com';
export const RESET_EMAIL = 'nitro-e2e-reset@example.com';
export const SIGNUP_EMAIL = 'nitro-e2e-signup@example.com';
export const ADMIN_EMAIL = 'nitro-e2e-admin@example.com';
export const PASSWORD = 'NitroE2E!2026';
export const RESET_PASSWORD = 'NitroE2E!Reset2026';
export const RESET_TOKEN = 'nitro-e2e-reset-token-2026';
export const USER_STARTING_BALANCE_KOBO = 5_000_000;
export const E2E_SERVICE_ID = 'nitro-e2e-service';
export const E2E_GROUP_ID = 'nitro-e2e-service-group';
export const E2E_TIER_ID = 'nitro-e2e-budget-tier';
export const E2E_ORDER_LINK = 'https://instagram.com/nitroe2e';

const E2E_SERVICE_API_ID = 2_147_000_001;
const MANUAL_SETTING_KEY = 'gateway_manual';
const MANUAL_SETTING_BACKUP_KEY = 'nitro_e2e_backup_gateway_manual';

const FIXTURE_EMAILS = [USER_EMAIL, RESET_EMAIL, SIGNUP_EMAIL];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

let prisma;

function inspectDatabaseUrl(value, name) {
  if (!value) throw new Error(`${name} is required for browser tests`);

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL`);
  }

  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error(`${name} must use PostgreSQL`);
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`${name} must point to localhost; received ${url.hostname}`);
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/(?:_ci|_test)$/.test(database)) {
    throw new Error(`${name} database must end in _ci or _test`);
  }

  return { database, hostname: url.hostname };
}

/**
 * Browser tests mutate fixtures. Requiring an explicit flag, localhost, and a
 * test-only database name keeps them physically separated from production.
 */
export function assertSafeE2EDatabase(env = process.env) {
  if (env.NITRO_E2E !== '1') {
    throw new Error('NITRO_E2E=1 is required before browser fixtures may run');
  }

  const primary = inspectDatabaseUrl(env.DATABASE_URL, 'DATABASE_URL');
  if (env.DIRECT_URL) {
    const direct = inspectDatabaseUrl(env.DIRECT_URL, 'DIRECT_URL');
    if (direct.database !== primary.database) {
      throw new Error('DATABASE_URL and DIRECT_URL must use the same browser-test database');
    }
  }
  return primary;
}

function db() {
  assertSafeE2EDatabase();
  prisma ||= new PrismaClient();
  return prisma;
}

function resetTokenHash() {
  return crypto.createHash('sha256').update(RESET_TOKEN).digest('hex');
}

async function fixturePasswordHash(password = PASSWORD) {
  return bcrypt.hash(password, 6);
}

async function deleteOrders(client, where) {
  const orders = await client.order.findMany({ where, select: { id: true } });
  const orderIds = orders.map(order => order.id);
  if (!orderIds.length) return;

  await client.affiliateCommission.deleteMany({ where: { orderId: { in: orderIds } } });
  await client.orderCreditUsage.deleteMany({ where: { orderId: { in: orderIds } } });
  await client.nitroPointLedger.deleteMany({ where: { orderId: { in: orderIds } } });
  await client.dripDispatch.deleteMany({ where: { orderId: { in: orderIds } } });
  await client.order.deleteMany({ where: { id: { in: orderIds } } });
}

async function deleteFixtureUserData(client, emails = FIXTURE_EMAILS) {
  const users = await client.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const userIds = users.map(user => user.id);
  if (!userIds.length) return;

  await deleteOrders(client, { userId: { in: userIds } });
  await client.nitroPointLedger.deleteMany({ where: { userId: { in: userIds } } });
  await client.transaction.deleteMany({ where: { userId: { in: userIds } } });
  await client.session.deleteMany({ where: { userId: { in: userIds } } });
  await client.user.deleteMany({ where: { id: { in: userIds } } });
}

async function cleanupCustomerJourneyCatalogue(client) {
  await deleteOrders(client, {
    OR: [
      { serviceId: E2E_SERVICE_ID },
      { tierId: E2E_TIER_ID },
    ],
  });
  await client.serviceTier.deleteMany({
    where: {
      OR: [
        { id: E2E_TIER_ID },
        { groupId: E2E_GROUP_ID },
        { serviceId: E2E_SERVICE_ID },
      ],
    },
  });
  await client.serviceGroup.deleteMany({ where: { id: E2E_GROUP_ID } });
  await client.service.deleteMany({
    where: {
      OR: [
        { id: E2E_SERVICE_ID },
        { apiId: E2E_SERVICE_API_ID, provider: 'mtp' },
      ],
    },
  });
}

async function seedCustomerJourneyCatalogue(client) {
  await cleanupCustomerJourneyCatalogue(client);
  await client.service.create({
    data: {
      id: E2E_SERVICE_ID,
      apiId: E2E_SERVICE_API_ID,
      name: 'Provider Browser Fixture Followers',
      category: 'Instagram',
      provider: 'mtp',
      costPer1k: 50n,
      sellPer1k: 100_000n,
      min: 100,
      max: 10_000,
      refill: false,
      dripfeed: false,
      tags: [],
      apiType: 'Default',
      avgTime: '0-2 hrs',
      enabled: true,
    },
  });
  await client.serviceGroup.create({
    data: {
      id: E2E_GROUP_ID,
      name: 'Instagram Browser Followers',
      platform: 'Instagram',
      type: 'Followers',
      nigerian: false,
      enabled: true,
      sortOrder: -10_000,
      description: 'Isolated browser-test service',
      tags: [],
    },
  });
  await client.serviceTier.create({
    data: {
      id: E2E_TIER_ID,
      groupId: E2E_GROUP_ID,
      serviceId: E2E_SERVICE_ID,
      tier: 'Budget',
      sellPer1k: 100_000n,
      refill: false,
      refillDays: 0,
      speed: '0-2 hrs',
      enabled: true,
      pricePinned: true,
      sortOrder: 0,
    },
  });
}

async function restoreManualPaymentSetting(client) {
  const backup = await client.setting.findUnique({ where: { key: MANUAL_SETTING_BACKUP_KEY } });
  if (!backup) return;

  const previous = JSON.parse(backup.value);
  if (previous.existed) {
    await client.setting.upsert({
      where: { key: MANUAL_SETTING_KEY },
      create: { key: MANUAL_SETTING_KEY, value: previous.value },
      update: { value: previous.value },
    });
  } else {
    await client.setting.deleteMany({ where: { key: MANUAL_SETTING_KEY } });
  }
  await client.setting.delete({ where: { key: MANUAL_SETTING_BACKUP_KEY } });
}

async function seedManualPaymentSetting(client) {
  const existing = await client.setting.findUnique({ where: { key: MANUAL_SETTING_KEY } });
  await client.setting.create({
    data: {
      key: MANUAL_SETTING_BACKUP_KEY,
      value: JSON.stringify({ existed: Boolean(existing), value: existing?.value ?? null }),
    },
  });
  await client.setting.upsert({
    where: { key: MANUAL_SETTING_KEY },
    create: {
      key: MANUAL_SETTING_KEY,
      value: JSON.stringify({
        enabled: true,
        name: 'Manual Transfer',
        desc: 'Isolated browser-test bank transfer',
        priority: -10_000,
        fields: {
          bankName: 'E2E Bank',
          accountNumber: '0000000000',
          accountName: 'Nitro E2E',
        },
      }),
    },
    update: {
      value: JSON.stringify({
        enabled: true,
        name: 'Manual Transfer',
        desc: 'Isolated browser-test bank transfer',
        priority: -10_000,
        fields: {
          bankName: 'E2E Bank',
          accountNumber: '0000000000',
          accountName: 'Nitro E2E',
        },
      }),
    },
  });
}

export async function prepareUserFixture() {
  const client = db();
  const password = await fixturePasswordHash();
  const existing = await client.user.findUnique({ where: { email: USER_EMAIL } });

  if (existing) {
    await deleteOrders(client, { userId: existing.id });
    await client.nitroPointLedger.deleteMany({ where: { userId: existing.id } });
    await client.transaction.deleteMany({ where: { userId: existing.id } });
    await client.session.deleteMany({ where: { userId: existing.id } });
  }

  return client.user.upsert({
    where: { email: USER_EMAIL },
    create: {
      email: USER_EMAIL,
      password,
      name: 'Nitro E2E User',
      firstName: 'Nitro',
      lastName: 'Tester',
      phone: '+2348012345001',
      balance: USER_STARTING_BALANCE_KOBO,
      referralCode: 'NTR-E2E01',
      emailVerified: true,
      status: 'Active',
      tourCompleted: true,
      orderTourCompleted: true,
      firstDepositBonusPaid: true,
      notifEmail: false,
      tosAcceptedAt: new Date(),
      tosVersion: 'e2e',
    },
    update: {
      password,
      name: 'Nitro E2E User',
      firstName: 'Nitro',
      lastName: 'Tester',
      phone: '+2348012345001',
      balance: USER_STARTING_BALANCE_KOBO,
      referralCode: 'NTR-E2E01',
      emailVerified: true,
      status: 'Active',
      deletedAt: null,
      deletedName: null,
      deletedEmail: null,
      anonymizedAt: null,
      tourCompleted: true,
      orderTourCompleted: true,
      firstDepositBonusPaid: true,
      notifEmail: false,
      resetToken: null,
      resetExpires: null,
      tosAcceptedAt: new Date(),
      tosVersion: 'e2e',
    },
  });
}

export async function prepareResetFixture() {
  const client = db();
  const password = await fixturePasswordHash();
  const existing = await client.user.findUnique({ where: { email: RESET_EMAIL } });
  if (existing) await client.session.deleteMany({ where: { userId: existing.id } });

  return client.user.upsert({
    where: { email: RESET_EMAIL },
    create: {
      email: RESET_EMAIL,
      password,
      name: 'Nitro Reset User',
      firstName: 'Nitro',
      lastName: 'Reset',
      phone: '+2348012345002',
      referralCode: 'NTR-E2E02',
      emailVerified: true,
      status: 'Active',
      resetToken: resetTokenHash(),
      resetExpires: new Date(Date.now() + 30 * 60 * 1000),
      notifEmail: false,
    },
    update: {
      password,
      name: 'Nitro Reset User',
      firstName: 'Nitro',
      lastName: 'Reset',
      phone: '+2348012345002',
      referralCode: 'NTR-E2E02',
      emailVerified: true,
      status: 'Active',
      deletedAt: null,
      deletedName: null,
      deletedEmail: null,
      anonymizedAt: null,
      resetToken: resetTokenHash(),
      resetExpires: new Date(Date.now() + 30 * 60 * 1000),
      notifEmail: false,
    },
  });
}

export async function cleanupSignupFixture() {
  await deleteFixtureUserData(db(), [SIGNUP_EMAIL]);
}

export async function prepareAdminFixture() {
  const client = db();
  const password = await fixturePasswordHash();
  const existing = await client.admin.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) await client.adminSession.deleteMany({ where: { adminId: existing.id } });

  return client.admin.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      password,
      name: 'Nitro E2E Admin',
      role: 'superadmin',
      status: 'Active',
    },
    update: {
      password,
      name: 'Nitro E2E Admin',
      role: 'superadmin',
      status: 'Active',
      customPages: null,
      customActions: null,
    },
  });
}

export async function getFixtureUserBalance() {
  const user = await db().user.findUnique({
    where: { email: USER_EMAIL },
    select: { balance: true },
  });
  return user?.balance ?? null;
}

export async function getPersistedFixtureOrder(link = E2E_ORDER_LINK) {
  const client = db();
  const user = await client.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true, balance: true },
  });
  if (!user) return { order: null, walletTransaction: null, userBalance: null };

  const order = await client.order.findFirst({
    where: { userId: user.id, tierId: E2E_TIER_ID, link },
    orderBy: { createdAt: 'desc' },
  });
  const walletTransaction = order
    ? await client.transaction.findFirst({
      where: { userId: user.id, type: 'order', reference: order.orderId },
    })
    : null;
  return { order, walletTransaction, userBalance: user.balance };
}

export async function getPersistedManualDeposit() {
  const client = db();
  const user = await client.user.findUnique({
    where: { email: USER_EMAIL },
    select: { id: true, balance: true },
  });
  if (!user) return { transaction: null, userBalance: null };

  const transaction = await client.transaction.findFirst({
    where: { userId: user.id, type: 'deposit', method: 'manual' },
    orderBy: { createdAt: 'desc' },
  });
  return { transaction, userBalance: user.balance };
}

export async function seedBrowserFixtures() {
  assertSafeE2EDatabase();
  await cleanupBrowserFixtures();
  const client = db();
  await seedCustomerJourneyCatalogue(client);
  await seedManualPaymentSetting(client);
  await prepareUserFixture();
  await prepareResetFixture();
  await prepareAdminFixture();
}

export async function cleanupBrowserFixtures() {
  const client = db();
  await deleteFixtureUserData(client);
  await cleanupCustomerJourneyCatalogue(client);
  const admin = await client.admin.findUnique({ where: { email: ADMIN_EMAIL } });
  if (admin) {
    await client.adminSession.deleteMany({ where: { adminId: admin.id } });
    await client.admin.delete({ where: { id: admin.id } });
  }
  await client.activityLog.deleteMany({ where: { adminName: 'Nitro E2E Admin' } });
  await restoreManualPaymentSetting(client);
}

export async function disconnectFixtureDatabase() {
  if (!prisma) return;
  await prisma.$disconnect();
  prisma = undefined;
}
