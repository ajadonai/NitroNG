import prisma from '@/lib/prisma';
import ChangelogPage from '@/components/changelog-page';

export const revalidate = 300;

export const metadata = {
  title: "What's New on Nitro",
  description: 'Every update we have shipped to Nitro, newest first. New services, fixes and changes to how the platform works.',
  alternates: { canonical: 'https://nitro.ng/changelog' },
};

export default async function ChangelogServerPage() {
  let entries = [];
  try {
    const rows = await prisma.changelogEntry.findMany({ orderBy: { date: 'desc' } });
    entries = rows.map(e => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      tag: e.tag,
      title: e.title,
      description: e.description,
    }));
  } catch (err) {
    console.error('[Changelog] Failed to load entries:', err.message);
  }

  return <ChangelogPage initialEntries={entries} />;
}
