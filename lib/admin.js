import prisma from '@/lib/prisma';
import { getCurrentAdmin } from '@/lib/auth';

// Role permissions — which pages each role can access
const ROLE_PAGES = {
  owner: '*', // all pages — platform owner
  superadmin: '*', // all pages
  admin: ['overview','orders','users','services','api','payments','tickets','activity','alerts','analytics','coupons','notifications','maintenance','team','blog','settings'],
  support: ['overview','orders','users','tickets'],
  finance: ['overview','orders','payments','analytics'],
};

// Check if admin can write (not view-only)
const WRITE_ROLES = ['owner', 'superadmin', 'admin'];

/**
 * Verify admin is authenticated and optionally check role permissions
 * @param {string} requiredPage - page slug to check access for
 * @param {boolean} requireWrite - require write access (not view-only)
 * @returns {{ admin, error }} 
 */
export async function requireAdmin(requiredPage = null, requireWrite = false) {
  const payload = await getCurrentAdmin();
  if (!payload) {
    return { admin: null, error: Response.json({ error: 'Not authenticated' }, { status: 401 }) };
  }

  const admin = await prisma.admin.findUnique({ where: { id: payload.id } });
  if (!admin || admin.status !== 'Active') {
    return { admin: null, error: Response.json({ error: 'Admin not found or inactive' }, { status: 403 }) };
  }

  // Check page access
  if (requiredPage) {
    const defaultPages = ROLE_PAGES[admin.role];
    // Use customPages if set, otherwise fall back to role defaults
    let pages = defaultPages;
    if (admin.customPages) {
      try { pages = JSON.parse(admin.customPages); } catch { pages = defaultPages; }
    }
    if (pages !== '*' && (!Array.isArray(pages) || !pages.includes(requiredPage))) {
      return { admin: null, error: Response.json({ error: 'Access denied' }, { status: 403 }) };
    }
  }

  // Check write access
  if (requireWrite && !WRITE_ROLES.includes(admin.role)) {
    return { admin: null, error: Response.json({ error: 'View-only access' }, { status: 403 }) };
  }

  return { admin, error: null };
}

/**
 * Log an admin action
 */
export async function logActivity(adminName, action, type = 'action') {
  try {
    await prisma.activityLog.create({
      data: { adminName, action, type },
    });
  } catch (e) {
    console.error('[ActivityLog] Failed to log:', e.message);
  }
}
