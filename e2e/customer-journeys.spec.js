import { expect, test } from '@playwright/test';
import { blockExternalBrowserRequests, loginUserViaApi } from './fixtures/browser.js';
import {
  E2E_ORDER_LINK,
  E2E_SERVICE_ID,
  E2E_TIER_ID,
  getPersistedFixtureOrder,
  getPersistedManualDeposit,
  prepareUserFixture,
  USER_STARTING_BALANCE_KOBO,
} from './fixtures/database.js';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await prepareUserFixture();
  await blockExternalBrowserRequests(page);
  await loginUserViaApi(page);
});

test('a customer can configure and submit an order through Nitro', async ({ page }) => {
  await page.goto('/dashboard');
  const service = page.locator('.no-svc-card').filter({ hasText: 'Instagram Browser Followers' });
  await expect(service).toBeVisible();
  await service.click();
  await service.locator('.no-tier-chip').filter({ hasText: 'Budget' }).click();

  const dialog = page.getByRole('dialog', { name: 'Order summary' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Link').fill(E2E_ORDER_LINK);
  await dialog.getByLabel('Quantity').fill('1000');
  await dialog.getByRole('button', { name: 'Place Order' }).click();

  await expect(dialog).toContainText('Order placed');
  await expect(dialog).toContainText(/NTR-\d+/);

  const persisted = await getPersistedFixtureOrder();
  expect(persisted.order).toMatchObject({
    serviceId: E2E_SERVICE_ID,
    tierId: E2E_TIER_ID,
    link: E2E_ORDER_LINK,
    quantity: 1_000,
    charge: 100_000,
    status: 'Processing',
  });
  expect(persisted.order.apiOrderId).toMatch(/^DEV-\d+$/);
  expect(persisted.walletTransaction).toMatchObject({
    type: 'order',
    amount: -100_000,
    method: 'wallet',
    status: 'Completed',
    reference: persisted.order.orderId,
  });
  expect(persisted.userBalance).toBe(USER_STARTING_BALANCE_KOBO - 100_000);
});

test('a customer can submit a manual bank-transfer deposit through Nitro', async ({ page }) => {
  await page.goto('/dashboard');
  await page.locator('button[data-nav="add-funds"]:visible').first().click();
  await expect(page.getByText('Top up your balance to place orders')).toBeVisible();
  await page.locator('input[type="number"][placeholder="0"]:visible').fill('5000');
  await page.getByRole('button', { name: /^Manual Transfer/ }).first().click();
  await page.getByRole('button', { name: 'Pay ₦5,000 Now' }).click();

  const dialog = page.getByRole('dialog', { name: 'Bank transfer' });
  await expect(dialog).toContainText('E2E Bank');
  await expect(dialog).toContainText('0000000000');

  const created = await getPersistedManualDeposit();
  expect(created.transaction).toMatchObject({
    type: 'deposit',
    amount: 500_000,
    method: 'manual',
    status: 'Pending',
  });
  expect(created.transaction.note).toContain('[awaiting_confirmation]');
  expect(created.userBalance).toBe(USER_STARTING_BALANCE_KOBO);

  await dialog.getByRole('button', { name: "I've sent the money" }).click();
  await dialog.getByLabel('Sender account name').fill('Browser Tester');
  await dialog.getByRole('button', { name: 'Confirm' }).click();
  await expect(dialog).toContainText('Transfer Submitted');

  const confirmed = await getPersistedManualDeposit();
  expect(confirmed.transaction.id).toBe(created.transaction.id);
  expect(confirmed.transaction).toMatchObject({
    amount: 500_000,
    method: 'manual',
    status: 'Pending',
  });
  expect(confirmed.transaction.note).toContain('[user_confirmed:Browser Tester]');
  expect(confirmed.userBalance).toBe(USER_STARTING_BALANCE_KOBO);
});
