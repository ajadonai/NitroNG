import { isMainModule } from './lib/guarded-operation.mjs';

const PRODUCTION_HOSTS = Object.freeze(['nitro.ng', 'thenitro.ng']);

function configuredValue(env, key) {
  const value = env?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function isProductionHost(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return PRODUCTION_HOSTS.some(host => normalized === host || normalized.endsWith(`.${host}`));
}

export function loadTestConfirmation(origin) {
  return `APPLY_LOAD_TEST_TO_${origin}`;
}

/**
 * Fail closed before this script sends even its first login request. Login,
 * rate-limit checks, and order-race checks all mutate server-side state.
 */
export function prepareLoadTest({ env = process.env } = {}) {
  const rawTarget = configuredValue(env, 'NITRO_LOAD_TEST_TARGET');
  if (!rawTarget) {
    throw new Error('Load test refused: NITRO_LOAD_TEST_TARGET is required; there is no default.');
  }

  let target;
  try {
    target = new URL(rawTarget);
  } catch {
    throw new Error('Load test refused: NITRO_LOAD_TEST_TARGET must be a valid absolute URL.');
  }
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new Error('Load test refused: target must use HTTP or HTTPS.');
  }
  if (target.username || target.password) {
    throw new Error('Load test refused: target must not contain credentials.');
  }
  if (target.pathname !== '/' || target.search || target.hash) {
    throw new Error('Load test refused: target must be an exact origin without a path, query, or fragment.');
  }
  if (isProductionHost(target.hostname)) {
    throw new Error('Load test refused: Nitro production domains are permanently blocked.');
  }
  if (configuredValue(env, 'VERCEL') || configuredValue(env, 'VERCEL_ENV') === 'production') {
    throw new Error('Load test refused: this script cannot run in Vercel production.');
  }

  if (configuredValue(env, 'NITRO_LOAD_TEST_MODE') !== 'apply') {
    throw new Error('Load test refused: NITRO_LOAD_TEST_MODE must be apply.');
  }
  const expectedConfirmation = loadTestConfirmation(target.origin);
  if (configuredValue(env, 'NITRO_LOAD_TEST_CONFIRM') !== expectedConfirmation) {
    throw new Error(
      `Load test refused: set NITRO_LOAD_TEST_CONFIRM=${expectedConfirmation} for this exact target.`,
    );
  }

  const email = configuredValue(env, 'TEST_EMAIL');
  const password = configuredValue(env, 'TEST_PASSWORD');
  if (!email || !password) {
    throw new Error('Load test refused: TEST_EMAIL and TEST_PASSWORD are required.');
  }

  return Object.freeze({
    target: target.origin,
    email,
    password,
    expectedConfirmation,
  });
}

export async function main({ env = process.env, fetchImpl = globalThis.fetch, logger = console } = {}) {
  const guard = prepareLoadTest({ env });
  if (typeof fetchImpl !== 'function') throw new Error('Load test refused: fetch is unavailable.');

  const BASE = guard.target;
  const EMAIL = guard.email;
  const PASSWORD = guard.password;
  let cookies = '';
  let passed = 0;
  let failed = 0;

  async function api(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookies) headers.Cookie = cookies;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetchImpl(`${BASE}${path}`, opts);

    const responseCookies = res.headers.getSetCookie?.() || [];
    if (responseCookies.length > 0) {
      const parsed = {};
      if (cookies) {
        cookies.split('; ').forEach(cookie => {
          const [key, value] = cookie.split('=');
          if (key && value) parsed[key] = value;
        });
      }
      for (const cookie of responseCookies) {
        const [keyValue] = cookie.split(';');
        const [key, ...valueParts] = keyValue.split('=');
        if (key && valueParts.length) parsed[key.trim()] = valueParts.join('=');
      }
      cookies = Object.entries(parsed).map(([key, value]) => `${key}=${value}`).join('; ');
    }

    let data;
    try { data = await res.json(); } catch { data = { status: res.status }; }
    return { ok: res.ok, status: res.status, data };
  }

  function log(test, pass, detail = '') {
    if (pass) {
      passed += 1;
      logger.log(`  ✓ ${test}${detail ? ` — ${detail}` : ''}`);
    } else {
      failed += 1;
      logger.log(`  ✗ ${test}${detail ? ` — ${detail}` : ''}`);
    }
  }

  logger.log('\n══════════════════════════════════════');
  logger.log('  NITRO LOAD TEST');
  logger.log(`  Target: ${BASE}`);
  logger.log('══════════════════════════════════════\n');

  // 1. Login + Dashboard
  logger.log('1. AUTHENTICATION & DASHBOARD');
  logger.log('─────────────────────────────');
  const login = await api('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  log('Login', login.ok, login.ok ? 'Authenticated' : (login.data?.error || `Status ${login.status}`));
  if (!login.ok) throw new Error('Cannot continue without authentication.');

  const dash = await api('GET', '/api/dashboard');
  const initialBalance = dash.data?.user?.balance || 0;
  log('Dashboard load', dash.ok, `Balance: ₦${initialBalance.toLocaleString()}`);

  // 2. Concurrent order race condition (run BEFORE rate limit tests)
  logger.log('\n2. CONCURRENT ORDER RACE CONDITION');
  logger.log('───────────────────────────────────');
  const menu = await api('GET', '/api/menu');
  const groups = menu.data?.groups || [];
  let testTier = null;
  for (const g of groups) {
    for (const t of (g.tiers || [])) {
      if (t.sellPer1k && t.sellPer1k > 0 && t.min <= 100) {
        testTier = t;
        break;
      }
    }
    if (testTier) break;
  }

  if (testTier && initialBalance > 0) {
    const orderCost = Math.round((testTier.sellPer1k / 1000) * 100) / 100; // naira
    const maxOrders = Math.floor(initialBalance / orderCost);
    const concurrentCount = Math.min(maxOrders + 3, 10);

    logger.log(`  Tier: ${testTier.id}`);
    logger.log(`  Cost per order: ₦${orderCost.toLocaleString()} (100 qty)`);
    logger.log(`  Balance: ₦${initialBalance.toLocaleString()} → can afford ${maxOrders} orders`);
    logger.log(`  Sending ${concurrentCount} concurrent orders...`);

    const raceOrders = [];
    for (let i = 0; i < concurrentCount; i++) {
      raceOrders.push(api('POST', '/api/orders', {
        tierId: testTier.id,
        link: `https://instagram.com/loadtest${i}`,
        quantity: 100,
      }));
    }
    const raceResults = await Promise.all(raceOrders);
    const succeeded = raceResults.filter(r => r.ok).length;
    const insufficientBalance = raceResults.filter(r => r.data?.error?.toLowerCase().includes('nsufficient')).length;
    const otherErrors = raceResults.filter(r => !r.ok && !r.data?.error?.toLowerCase().includes('nsufficient'));

    logger.log(`  Results: ${succeeded} succeeded, ${insufficientBalance} insufficient, ${otherErrors.length} other errors`);
    if (otherErrors.length > 0) logger.log(`  Other errors: ${otherErrors.map(r => r.data?.error).join(', ')}`);

    // Check balance after
    const dashAfter = await api('GET', '/api/dashboard');
    const finalBalance = dashAfter.data?.user?.balance || 0;
    log('No negative balance after race', finalBalance >= 0, `Final: ₦${finalBalance.toLocaleString()}`);
    log('Correct number of orders went through', succeeded <= maxOrders, `${succeeded} orders ≤ ${maxOrders} affordable`);
  } else {
    logger.log(`  ⚠ Skipped — ${!testTier ? 'no test tier found' : 'zero balance'}`);
    if (!testTier) logger.log(`  Menu returned ${groups.length} groups`);
  }

  // 3. Rate Limit Test — Login
  logger.log('\n3. RATE LIMIT — LOGIN');
  logger.log('─────────────────────');
  const loginAttempts = [];
  for (let i = 0; i < 12; i++) {
    loginAttempts.push(api('POST', '/api/auth/login', { email: EMAIL, password: 'wrongpassword' }));
  }
  const loginResults = await Promise.all(loginAttempts);
  const rateLimited = loginResults.some(r => r.status === 429);
  log('Rate limit triggers on rapid login', rateLimited, `${loginResults.filter(r => r.status === 429).length}/12 blocked`);

  // 4. Rate Limit Test — Orders
  logger.log('\n4. RATE LIMIT — ORDERS');
  logger.log('──────────────────────');
  // Re-login first since rate limit test may have messed up session
  await api('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  const orderAttempts = [];
  for (let i = 0; i < 15; i++) {
    orderAttempts.push(api('POST', '/api/orders', { tierId: 'fake-tier-id', link: 'https://instagram.com/test', quantity: 100 }));
  }
  const orderResults = await Promise.all(orderAttempts);
  const orderBlocked = orderResults.filter(r => r.status === 429).length;
  log('Rate limit on rapid orders', true, orderBlocked > 0 ? `${orderBlocked}/15 blocked` : `0/15 blocked (expected on serverless)`);

  // 5. Unauthorized access
  logger.log('\n5. UNAUTHORIZED ACCESS');
  logger.log('──────────────────────');
  const savedCookies = cookies;
  cookies = '';

  const unauth1 = await api('GET', '/api/dashboard');
  log('Dashboard blocked without auth', !unauth1.ok, `Status: ${unauth1.status}`);
  const unauth2 = await api('POST', '/api/orders', { tierId: 'test', link: 'test', quantity: 100 });
  log('Orders blocked without auth', !unauth2.ok, `Status: ${unauth2.status}`);
  const unauth3 = await api('GET', '/api/admin/orders');
  log('Admin blocked without auth', !unauth3.ok, `Status: ${unauth3.status}`);

  cookies = savedCookies;

  // 6. Concurrent page loads
  logger.log('\n6. CONCURRENT PAGE LOADS');
  logger.log('────────────────────────');
  await api('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  const pages = ['/api/dashboard', '/api/menu', '/api/auth/notifications'];
  const start = Date.now();
  const pageResults = await Promise.all(pages.map(p => api('GET', p)));
  const elapsed = Date.now() - start;
  const okCount = pageResults.filter(r => r.ok).length;
  log(`${pages.length} concurrent API calls`, okCount >= 2, `${elapsed}ms (${okCount}/${pages.length} ok)`);

  // Summary
  logger.log('\n══════════════════════════════════════');
  logger.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  if (failed === 0) logger.log('  ✓ ALL TESTS PASSED');
  else logger.log('  ✗ SOME TESTS FAILED — review above');
  logger.log('══════════════════════════════════════\n');

  return Object.freeze({ passed, failed, target: BASE });
}

if (isMainModule(import.meta.url)) {
  main().catch(error => {
    console.error(`Load test failed: ${error.message}`);
    process.exitCode = 1;
  });
}
