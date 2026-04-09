import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';
import { ok, error } from '@/lib/utils';

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return error('Not authenticated', 401);

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { notifOrders: true, notifPromo: true, notifEmail: true, notifClearedAt: true, notifReadIds: true, themePreference: true, perPagePreference: true },
    });

    if (!user) return error('User not found', 404);

    let readIds = [];
    try { readIds = user.notifReadIds ? JSON.parse(user.notifReadIds) : []; } catch {}

    return ok({
      notifOrders: user.notifOrders,
      notifPromo: user.notifPromo,
      notifEmail: user.notifEmail,
      notifClearedAt: user.notifClearedAt,
      notifReadIds: readIds,
      themePreference: user.themePreference || 'auto',
      perPagePreference: user.perPagePreference || 10,
    });
  } catch (err) {
    log.error('Notifications GET', err);
    return error('Failed to load preferences', 500);
  }
}

export async function POST(req) {
  try {
    const session = await getCurrentUser();
    if (!session) return error('Not authenticated', 401);

    const body = await req.json();
    const data = {};

    // Notification preference toggles
    if (typeof body.notifOrders === 'boolean') data.notifOrders = body.notifOrders;
    if (typeof body.notifPromo === 'boolean') data.notifPromo = body.notifPromo;
    if (typeof body.notifEmail === 'boolean') data.notifEmail = body.notifEmail;

    // Theme preference
    if (body.themePreference && ['auto', 'night', 'day'].includes(body.themePreference)) {
      data.themePreference = body.themePreference;
    }

    // Per-page preference
    if (body.perPagePreference && [10, 25, 50].includes(Number(body.perPagePreference))) {
      data.perPagePreference = Number(body.perPagePreference);
    }

    // Mark all as read — store the IDs
    if (Array.isArray(body.readIds)) {
      // Merge with existing
      const user = await prisma.user.findUnique({ where: { id: session.id }, select: { notifReadIds: true } });
      let existing = [];
      try { existing = user?.notifReadIds ? JSON.parse(user.notifReadIds) : []; } catch {}
      const merged = [...new Set([...existing, ...body.readIds])];
      // Keep only last 200 to prevent unbounded growth
      data.notifReadIds = JSON.stringify(merged.slice(-200));
    }

    // Clear all — set timestamp
    if (body.clearAll === true) {
      data.notifClearedAt = new Date();
      data.notifReadIds = '[]'; // Reset read IDs since everything is cleared
    }

    if (Object.keys(data).length === 0) {
      return error('No valid data provided', 400);
    }

    await prisma.user.update({ where: { id: session.id }, data });

    return ok({ message: 'Updated', ...data });
  } catch (err) {
    log.error('Notifications POST', err);
    return error('Failed to update', 500);
  }
}
