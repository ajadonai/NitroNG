import { expect, test } from '@playwright/test';
import { blockExternalBrowserRequests } from './fixtures/browser.js';
import {
  ADMIN_EMAIL,
  PASSWORD,
  USER_EMAIL,
  USER_STARTING_BALANCE_KOBO,
  getFixtureUserBalance,
  prepareAdminFixture,
  prepareUserFixture,
} from './fixtures/database.js';

test('an authorized admin can find a user and credit their wallet', async ({ page }) => {
  await prepareUserFixture();
  await prepareAdminFixture();
  await blockExternalBrowserRequests(page);

  await page.goto('/admin/login');
  await page.getByLabel('Email Address').fill(ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Access Dashboard' }).click();

  await page.waitForURL('**/admin');
  await expect(page.getByText('Dashboard Overview')).toBeVisible();
  await page.locator('button.dash-nav-item').filter({ hasText: /^Users$/ }).click();
  await expect(page.getByText('Users', { exact: true }).first()).toBeVisible();

  await page.getByPlaceholder('Search name or email…').fill(USER_EMAIL);
  const row = page.locator('.group').filter({ hasText: USER_EMAIL }).first();
  await expect(row).toBeVisible();
  await row.hover();
  await row.getByTitle('Credit').click();

  await page.getByPlaceholder('Amount (₦)').fill('2500');
  await page.getByRole('button', { name: 'Credit ₦2,500' }).click();
  const confirmation = page.getByRole('dialog', { name: 'Credit Wallet' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: 'Credit ₦2,500' }).click();

  await expect(page.getByText('Credited ₦2,500 to wallet')).toBeVisible();
  await expect.poll(() => getFixtureUserBalance()).toBe(USER_STARTING_BALANCE_KOBO + 250_000);
});
