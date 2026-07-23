import { expect, test } from '@playwright/test';
import { blockExternalBrowserRequests } from './fixtures/browser.js';
import {
  PASSWORD,
  RESET_EMAIL,
  RESET_PASSWORD,
  RESET_TOKEN,
  SIGNUP_EMAIL,
  USER_EMAIL,
  cleanupSignupFixture,
  prepareResetFixture,
  prepareUserFixture,
} from './fixtures/database.js';

test.beforeEach(async ({ page }) => {
  await blockExternalBrowserRequests(page);
});

test('a customer can create an account and reach the dashboard', async ({ page }) => {
  await cleanupSignupFixture();
  await page.goto('/signup');

  const dialog = page.getByRole('dialog', { name: 'Create account' });
  await expect(dialog.getByRole('heading', { name: 'Create Account' })).toBeVisible();
  await dialog.getByLabel('First Name').fill('Browser');
  await dialog.getByLabel('Last Name').fill('Tester');
  await dialog.getByLabel('Email Address').fill(SIGNUP_EMAIL);
  const phoneCheck = page.waitForResponse(resp => resp.url().includes('/api/auth/check-phone'));
  await dialog.getByLabel(/WhatsApp Number/).fill('8012345003');
  await phoneCheck;
  await dialog.getByRole('button', { name: 'Continue →' }).click();

  await expect(dialog.getByRole('heading', { name: 'Secure Your Account' })).toBeVisible({ timeout: 10000 });
  await dialog.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await dialog.getByLabel('Confirm Password').fill(PASSWORD);
  await dialog.locator('#signup-terms').check();
  await dialog.getByRole('button', { name: 'Create Account' }).click();

  await page.waitForURL('**/dashboard');
  await expect(page.getByText('New Order', { exact: true }).first()).toBeVisible();
});

test('a customer can log in with a persistent session', async ({ page }) => {
  await prepareUserFixture();
  await page.goto('/?login=1');

  const dialog = page.getByRole('dialog', { name: 'Log in' });
  await expect(dialog.getByText('Log in and start boosting')).toBeVisible();

  const emailInput = dialog.locator('#login-identity');
  const passwordInput = dialog.locator('#login-password');

  await emailInput.fill(USER_EMAIL);
  await expect(emailInput).toHaveValue(USER_EMAIL);
  await passwordInput.fill(PASSWORD);
  await expect(passwordInput).toHaveValue(PASSWORD);
  await dialog.locator('#login-remember').check();

  const loginResponse = page.waitForResponse(resp => resp.url().includes('/api/auth/login'));
  await dialog.getByRole('button', { name: 'Log In', exact: true }).click();
  await loginResponse;

  await page.waitForURL('**/dashboard');
  await expect(page.getByText('New Order', { exact: true }).first()).toBeVisible();
  const cookie = (await page.context().cookies()).find(item => item.name === 'nitro_token');
  expect(cookie?.expires).toBeGreaterThan(Math.floor(Date.now() / 1000));
});

test('forgot-password and reset-password screens complete the recovery journey', async ({ page }) => {
  await prepareResetFixture();
  await page.goto('/?login=1');

  const loginDialog = page.getByRole('dialog', { name: 'Log in' });
  await expect(loginDialog.getByText('Log in and start boosting')).toBeVisible();
  await loginDialog.getByRole('button', { name: 'Forgot password?' }).click();
  await loginDialog.getByLabel('Email Address').fill(RESET_EMAIL);
  await loginDialog.getByRole('button', { name: 'Send Reset Link' }).click();
  await expect(loginDialog.getByRole('status')).toContainText('Reset link sent to');
  await expect(loginDialog.getByRole('status')).toContainText(RESET_EMAIL);

  // The forgot route correctly replaces the token. Restore the deterministic
  // test token so the next browser step can exercise the reset screen without
  // reading an email or calling a mail provider.
  await prepareResetFixture();
  await page.goto(`/?reset=${encodeURIComponent(RESET_TOKEN)}`);

  await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
  await page.getByLabel('New Password').fill(RESET_PASSWORD);
  await page.getByLabel('Confirm Password').fill(RESET_PASSWORD);
  await page.getByRole('button', { name: 'Reset Password' }).click();
  await expect(page.getByRole('status')).toContainText('Your password has been reset');

  const login = await page.request.post('/api/auth/login', {
    data: { email: RESET_EMAIL, password: RESET_PASSWORD, remember: false },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
});
