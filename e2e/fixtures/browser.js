import { expect } from '@playwright/test';
import { PASSWORD, USER_EMAIL } from './database.js';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export async function blockExternalBrowserRequests(page) {
  await page.addInitScript(() => {
    localStorage.setItem('nitro-cookie-consent', 'declined');
  });
  await page.route(/^https?:\/\//, async route => {
    const hostname = new URL(route.request().url()).hostname;
    if (LOCAL_HOSTS.has(hostname)) return route.continue();
    return route.abort('blockedbyclient');
  });
}

export async function loginUserViaApi(page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: USER_EMAIL, password: PASSWORD, remember: false },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
}
