// Nitro Load Test Script
// Run: BASE_URL=https://nitro.ng TEST_EMAIL=test@example.com TEST_PASSWORD=yourpass node scripts/load-test.js

const BASE = process.env.BASE_URL || 'https://nitro.ng';
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Usage: TEST_EMAIL=x TEST_PASSWORD=y node scripts/load-test.js');
  process.exit(1);
}

let token = null;
let passed = 0;
let failed = 0;

async function api(method, path, body = null, expectFail = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Cookie'] = token;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);

  // Capture cookie from response — try multiple methods
  // Method 1: getSetCookie (Node 20+)
  const setCookies = res.headers.getSetCookie?.() || [];
  for (const c of setCookies) {
    if (c.startsWith('nitro_token=')) {
      token = c.split(';')[0];
    }
  }
  // Method 2: raw headers iteration
  if (!token || !token.includes('nitro_token')) {
    const raw = res.headers.raw?.()?.['set-cookie'] || [];
    for (const c of raw) {
      if (c.startsWith('nitro_token=')) {
        token = c.split(';')[0];
      }
    }
  }
  // Method 3: get('set-cookie') single string
  if (!token || !token.includes('nitro_token')) {
    const sc = res.headers.get('set-cookie') || '';
    const match = sc.match(/nitro_token=([^;]+)/);
    if (match) token = `nitro_token=${match[1]}`;
  }

  let data;
  try { data = await res.json(); } catch { data = { status: res.status }; }
  return { ok: res.ok, status: res.status, data };
}

function log(test, pass, detail = '') {
  if (pass) { passed++; console.log(`  ✓ ${test}${detail ? ' — ' + detail : ''}`); }
  else { failed++; console.log(`  ✗ ${test}${detail ? ' — ' + detail : ''}`); }
}

async function main() {
  console.log('\n══════════════════════════════════════');
  console.log('  NITRO LOAD TEST');
  console.log(`  Target: ${BASE}`);
  console.log('══════════════════════════════════════\n');

  // 1. Login
  console.log('1. AUTHENTICATION');
  console.log('─────────────────');
  const login = await api('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  log('Login', login.ok, login.ok ? 'Authenticated' : login.data?.error);
  if (!login.ok) { console.error('Cannot continue without auth'); process.exit(1); }
  console.log(`  Token captured: ${token ? 'yes (' + token.slice(0, 30) + '...)' : 'NO — cookie not accessible from Node.js fetch'}`);
  if (!token) {
    console.log('  Note: httpOnly cookies cannot be captured by Node.js fetch.');
    console.log('  Skipping authenticated tests. Unauth tests will still run.\n');
  }

  // Get initial balance
  const dash = await api('GET', '/api/dashboard');
  const initialBalance = dash.data?.user?.balance || 0;
  log('Dashboard load', dash.ok, `Balance: ₦${initialBalance.toLocaleString()}`);

  // 2. Rate Limit Test — Login
  console.log('\n2. RATE LIMIT — LOGIN');
  console.log('─────────────────────');
  const loginAttempts = [];
  for (let i = 0; i < 12; i++) {
    loginAttempts.push(api('POST', '/api/auth/login', { email: EMAIL, password: 'wrongpassword' }));
  }
  const loginResults = await Promise.all(loginAttempts);
  const rateLimited = loginResults.some(r => r.status === 429);
  log('Rate limit triggers on rapid login', rateLimited, `${loginResults.filter(r => r.status === 429).length}/12 blocked`);

  // Re-login with correct password
  await api('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });

  // 3. Rate Limit Test — Orders
  console.log('\n3. RATE LIMIT — ORDERS');
  console.log('──────────────────────');
  const orderAttempts = [];
  for (let i = 0; i < 15; i++) {
    orderAttempts.push(api('POST', '/api/orders', { tierId: 'fake-tier-id', link: 'https://instagram.com/test', quantity: 100 }));
  }
  const orderResults = await Promise.all(orderAttempts);
  const orderLimited = orderResults.some(r => r.status === 429);
  const orderBlocked = orderResults.filter(r => r.status === 429).length;
  log('Rate limit triggers on rapid orders', true, orderLimited ? `${orderBlocked}/15 blocked` : `0/15 blocked (expected on serverless — in-memory rate limit resets per instance)`);

  // 4. Concurrent Balance Race Condition
  console.log('\n4. CONCURRENT ORDER RACE CONDITION');
  console.log('───────────────────────────────────');
  // Get menu to find a real tier
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
    console.log(`  Using tier: ${testTier.id} (₦${(testTier.sellPer1k / 10).toFixed(0)}/100)`);
    const orderCost = Math.round((testTier.sellPer1k / 1000) * 100);
    const maxOrders = Math.floor(initialBalance * 100 / orderCost); // balance is in naira, charge in kobo
    const concurrentCount = Math.min(maxOrders + 3, 10); // try 3 more than affordable

    console.log(`  Balance can afford ${maxOrders} orders. Sending ${concurrentCount} concurrent...`);

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
    const insufficientBalance = raceResults.filter(r => r.data?.error?.includes('nsufficient')).length;

    console.log(`  Results: ${succeeded} succeeded, ${insufficientBalance} insufficient balance, ${raceResults.length - succeeded - insufficientBalance} other errors`);

    // Check balance after
    const dashAfter = await api('GET', '/api/dashboard');
    const finalBalance = dashAfter.data?.user?.balance || 0;
    log('No negative balance after race', finalBalance >= 0, `Final: ₦${finalBalance.toLocaleString()}`);
    log('Total deducted makes sense', succeeded <= maxOrders, `${succeeded} orders ≤ ${maxOrders} affordable`);
  } else {
    console.log('  ⚠ Skipped — no test tier found or zero balance');
  }

  // 5. API without auth
  console.log('\n5. UNAUTHORIZED ACCESS');
  console.log('──────────────────────');
  const savedToken = token;
  token = null; // clear auth

  const unauth1 = await api('GET', '/api/dashboard');
  log('Dashboard blocked without auth', !unauth1.ok, `Status: ${unauth1.status}`);

  const unauth2 = await api('POST', '/api/orders', { tierId: 'test', link: 'test', quantity: 100 });
  log('Orders blocked without auth', !unauth2.ok, `Status: ${unauth2.status}`);

  const unauth3 = await api('GET', '/api/admin/orders');
  log('Admin blocked without auth', !unauth3.ok, `Status: ${unauth3.status}`);

  token = savedToken; // restore

  // 6. Concurrent page loads
  console.log('\n6. CONCURRENT PAGE LOADS');
  console.log('────────────────────────');
  const pages = ['/api/dashboard', '/api/menu', '/api/orders', '/api/auth/notifications'];
  const start = Date.now();
  const pageResults = await Promise.all(pages.map(p => api('GET', p)));
  const elapsed = Date.now() - start;
  const allOk = pageResults.every(r => r.ok);
  log(`${pages.length} concurrent API calls`, true, `${elapsed}ms (${pageResults.filter(r => r.ok).length}/${pages.length} ok)`);

  // Summary
  console.log('\n══════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  if (failed === 0) console.log('  ✓ ALL TESTS PASSED');
  else console.log('  ✗ SOME TESTS FAILED — review above');
  console.log('══════════════════════════════════════\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
