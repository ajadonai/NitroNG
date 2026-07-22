import { disconnectFixtureDatabase, seedBrowserFixtures } from './fixtures/database.js';

export default async function globalSetup() {
  await seedBrowserFixtures();
  await disconnectFixtureDatabase();
}
