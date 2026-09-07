import prisma from '@/lib/prisma';
import { log } from "@/lib/logger";
import { getCurrentUser } from '@/lib/auth';
import { ok, error } from '@/lib/utils';
import { validatePhone, isSupportedCountry, DEFAULT_COUNTRY } from '@/lib/phone-countries';

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) return error('Not authenticated', 401);

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { notifOrders: true, notifPromo: true, notifEmail: true, notifClearedAt: true, notifReadAllAt: true, notifReadIds: true, themePreference: true, perPagePreference: true },
    });

    if (!user) return error('User not found', 404);

    let readIds = [];
    try { readIds = user.notifReadIds ? JSON.parse(user.notifReadIds) : []; } catch {}

    return ok({
      notifOrders: user.notifOrders,
      notifPromo: user.notifPromo,
      notifEmail: user.notifEmail,
      notifClearedAt: user.notifClearedAt,
      notifReadAllAt: user.notifReadAllAt,
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

    // Mark all read timestamp
    if (body.readAllAt) {
      data.notifReadAllAt = new Date(body.readAllAt);
    }

    // Mark all as read — store the IDs
    if (Array.isArray(body.readIds)) {
      // Merge with existing
      const user = await prisma.user.findUnique({ where: { id: session.id }, select: { notifReadIds: true } });
      let existing = [];
      try { existing = user?.notifReadIds ? JSON.parse(user.notifReadIds) : []; } catch {}
      const merged = [...new Set([...existing, ...body.readIds])];
      data.notifReadIds = JSON.stringify(merged.slice(-500));
    }

    // Phone number update. Country comes with it, because the two are one
    // value: the country decides the dial code that gets stored, and storing a
    // number under the wrong one points WhatsApp at a different person.
    if (typeof body.phone === 'string') {
      let cc = body.country;
      if (!isSupportedCountry(cc)) {
        const owner = await prisma.user.findUnique({ where: { id: session.id }, select: { country: true } });
        cc = isSupportedCountry(owner?.country) ? owner.country : DEFAULT_COUNTRY;
      }
      const checked = validatePhone(cc, body.phone);
      if (!checked.ok) return error(checked.error, 400);
      data.phone = checked.e164;
      data.country = cc;
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
    if (err?.code === 'P2002') return error('This phone number is already registered', 400);
    return error('Failed to update', 500);
  }
}
