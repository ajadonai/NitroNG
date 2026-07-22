import { cleanupBrowserFixtures, disconnectFixtureDatabase } from './fixtures/database.js';

export default async function globalTeardown() {
  try {
    await cleanupBrowserFixtures();
  } finally {
    await disconnectFixtureDatabase();
  }
}
