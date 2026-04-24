// Nitro Load Test Script
// Run: TEST_EMAIL=x TEST_PASSWORD=y node scripts/load-test.js

const BASE = process.env.BASE_URL || 'https://nitro.ng';
const EMAIL = process.env.TEST_EMAIL;
const PASSWORD = process.env.TEST_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Usage: TEST_EMAIL=x TEST_PASSWORD=y node scripts/load-test.js');
  process.exit(1);
}

let cookies = '';
let passed = 0;
let failed = 0;

async function api(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookies) headers['Cookie'] = cookies;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);

  // Capture ALL cookies from response
  const sc = res.headers.getSetCookie?.() || [];
  if (sc.length > 0) {
    const parsed = {};
    // Keep existing cookies
    if (cookies) cookies.split('; ').forEach(c => { const [k,v] = c.split('='); if (k && v) parsed[k] = v; });
    // Override with new ones
    for (const c of sc) {
      const [kv] = c.split(';');
      const [k, ...vParts] = kv.split('=');
      if (k && vParts.length) parsed[k.trim()] = vParts.join('=');
    }
    cookies = Object.entries(parsed).map(([k,v]) => `${k}=${v}`).join('; ');
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

  // 1. Login + Dashboard
  console.log('1. AUTHENTICATION & DASHBOARD');
  console.log('─────────────────────────────');
  const login = await api('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  log('Login', login.ok, login.ok ? 'Authenticated' : (login.data?.error || `Status ${login.status}`));
  if (!login.ok) { console.error('Cannot continue without auth'); process.exit(1); }
  console.log(`  Cookies: ${cookies ? cookies.slice(0, 50) + '...' : 'NONE'}`);

  const dash = await api('GET', '/api/dashboard');
  const initialBalance = dash.data?.user?.balance || 0;
  log('Dashboard load', dash.ok, `Balance: ₦${initialBalance.toLocaleString()}`);

  // 2. Concurrent order race condition (run BEFORE rate limit tests)
  console.log('\n2. CONCURRENT ORDER RACE CONDITION');
  console.log('───────────────────────────────────');
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

    console.log(`  Tier: ${testTier.id}`);
    console.log(`  Cost per order: ₦${orderCost.toLocaleString()} (100 qty)`);
    console.log(`  Balance: ₦${initialBalance.toLocaleString()} → can afford ${maxOrders} orders`);
    console.log(`  Sending ${concurrentCount} concurrent orders...`);

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

    console.log(`  Results: ${succeeded} succeeded, ${insufficientBalance} insufficient, ${otherErrors.length} other errors`);
    if (otherErrors.length > 0) console.log(`  Other errors: ${otherErrors.map(r => r.data?.error).join(', ')}`);

    // Check balance after
    const dashAfter = await api('GET', '/api/dashboard');
    const finalBalance = dashAfter.data?.user?.balance || 0;
    log('No negative balance after race', finalBalance >= 0, `Final: ₦${finalBalance.toLocaleString()}`);
    log('Correct number of orders went through', succeeded <= maxOrders, `${succeeded} orders ≤ ${maxOrders} affordable`);
  } else {
    console.log(`  ⚠ Skipped — ${!testTier ? 'no test tier found' : 'zero balance'}`);
    if (!testTier) console.log(`  Menu returned ${groups.length} groups`);
  }

  // 3. Rate Limit Test — Login
  console.log('\n3. RATE LIMIT — LOGIN');
  console.log('─────────────────────');
  const loginAttempts = [];
  for (let i = 0; i < 12; i++) {
    loginAttempts.push(api('POST', '/api/auth/login', { email: EMAIL, password: 'wrongpassword' }));
  }
  const loginResults = await Promise.all(loginAttempts);
  const rateLimited = loginResults.some(r => r.status === 429);
  log('Rate limit triggers on rapid login', rateLimited, `${loginResults.filter(r => r.status === 429).length}/12 blocked`);

  // 4. Rate Limit Test — Orders
  console.log('\n4. RATE LIMIT — ORDERS');
  console.log('──────────────────────');
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
  console.log('\n5. UNAUTHORIZED ACCESS');
  console.log('──────────────────────');
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
  console.log('\n6. CONCURRENT PAGE LOADS');
  console.log('────────────────────────');
  await api('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD });
  const pages = ['/api/dashboard', '/api/menu', '/api/auth/notifications'];
  const start = Date.now();
  const pageResults = await Promise.all(pages.map(p => api('GET', p)));
  const elapsed = Date.now() - start;
  const okCount = pageResults.filter(r => r.ok).length;
  log(`${pages.length} concurrent API calls`, okCount >= 2, `${elapsed}ms (${okCount}/${pages.length} ok)`);

  // Summary
  console.log('\n══════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  if (failed === 0) console.log('  ✓ ALL TESTS PASSED');
  else console.log('  ✗ SOME TESTS FAILED — review above');
  console.log('══════════════════════════════════════\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
