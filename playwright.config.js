import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
import { assertSafeE2EDatabase } from './e2e/fixtures/database.js';

// This runs while Playwright reads its config, before it can start or probe a
// web server. The fixture guard therefore protects server-side reads as well as
// the later state-changing global setup.
assertSafeE2EDatabase(process.env);

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100';
const parsedBaseURL = new URL(baseURL);
const serverPort = parsedBaseURL.port;
if (
  parsedBaseURL.protocol !== 'http:'
  || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedBaseURL.hostname)
  || !/^\d+$/.test(serverPort)
  || parsedBaseURL.username
  || parsedBaseURL.password
  || parsedBaseURL.pathname !== '/'
  || parsedBaseURL.search
  || parsedBaseURL.hash
) {
  throw new Error('PLAYWRIGHT_BASE_URL must be an HTTP loopback origin with an explicit port');
}
const serverHost = parsedBaseURL.hostname === 'localhost'
  ? '127.0.0.1'
  : parsedBaseURL.hostname.replace(/^\[|\]$/g, '');
const serverEnv = {
  ...process.env,
  NITRO_E2E: '1',
  NEXT_TELEMETRY_DISABLED: '1',
  NEXT_PUBLIC_APP_URL: baseURL,
  JWT_SECRET: 'nitro-e2e-user-secret-32-characters-minimum',
  JWT_ADMIN_SECRET: 'nitro-e2e-admin-secret-32-characters-minimum',
  CRON_SECRET: 'nitro-e2e-cron-secret-32-characters-minimum',
  IP_HASH_SALT: 'nitro-e2e-ip-hash-salt-32-characters-minimum',
  BREVO_API_KEY: '',
  ANALYTICS_READ_TOKEN: '',
  TG_BOT_TOKEN: '',
  TG_CHAT_ID: '',
  CREW_BOT_TOKEN: '',
  CREW_GROUP_ID: '',
  CREW_TOPIC_ACTIVITY: '',
  CREW_TOPIC_ANNOUNCEMENTS: '',
  CREW_TOPIC_LEADERBOARD: '',
  CREW_TOPIC_WINS: '',
  META_CAPI_TOKEN: '',
  UPSTASH_REDIS_REST_URL: '',
  UPSTASH_REDIS_REST_TOKEN: '',
  FLUTTERWAVE_SECRET_KEY: '',
  FLUTTERWAVE_PUBLIC_KEY: '',
  FLUTTERWAVE_WEBHOOK_HASH: '',
  NOWPAYMENTS_API_KEY: '',
  NOWPAYMENTS_IPN_SECRET: '',
  MTP_API_KEY: '',
  MTP_API_URL: 'http://127.0.0.1:9',
  JAP_API_KEY: '',
  JAP_API_URL: 'http://127.0.0.1:9',
  DAOSMM_API_KEY: '',
  DAOSMM_API_URL: 'http://127.0.0.1:9',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  NEXT_PUBLIC_SENTRY_DSN: '',
  SENTRY_AUTH_TOKEN: '',
  SENTRY_ORG: '',
  SENTRY_PROJECT: '',
};

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never' }]]
    : 'list',
  globalSetup: './e2e/global-setup.js',
  globalTeardown: './e2e/global-teardown.js',
  use: {
    baseURL,
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `node_modules/.bin/next dev --hostname ${serverHost} --port ${serverPort}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: serverEnv,
  },
});
