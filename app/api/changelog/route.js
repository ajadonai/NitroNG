import prisma from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

export async function GET() {
  const entries = await prisma.changelogEntry.findMany({ orderBy: { date: 'desc' } });
  return Response.json(entries.map(e => ({
    id: e.id,
    date: e.date.toISOString().slice(0, 10),
    tag: e.tag,
    title: e.title,
    description: e.description,
  })));
}

export async function POST(req) {
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { date, tag, title, description } = await req.json();
  if (!date || !tag || !title || !description) return Response.json({ error: 'All fields required' }, { status: 400 });
  if (!['new', 'improved', 'fixed'].includes(tag)) return Response.json({ error: 'Invalid tag' }, { status: 400 });

  const entry = await prisma.changelogEntry.create({
    data: { date: new Date(date), tag, title, description },
  });

  return Response.json({ id: entry.id, date: entry.date.toISOString().slice(0, 10), tag: entry.tag, title: entry.title, description: entry.description });
}

export async function DELETE(req) {
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  if (!id) return Response.json({ error: 'ID required' }, { status: 400 });

  await prisma.changelogEntry.delete({ where: { id } });
  return Response.json({ ok: true });
}
