import prisma from '@/lib/prisma';
import { verifyUnsubToken } from '@/lib/email';

export async function GET(req) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return new Response('Missing token', { status: 400 });

  const userId = verifyUnsubToken(token);
  if (!userId) return new Response('Invalid or expired link', { status: 400 });

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { notifPromo: false },
    });
  } catch {
    return new Response('Account not found', { status: 404 });
  }

  return new Response(page('You have been unsubscribed from Nitro promotional emails. You can re-enable them anytime from your dashboard settings.'), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function POST(req) {
  const token = new URL(req.url).searchParams.get('token');
  if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });

  const userId = verifyUnsubToken(token);
  if (!userId) return Response.json({ error: 'Invalid token' }, { status: 400 });

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { notifPromo: false },
    });
  } catch {
    return Response.json({ error: 'Account not found' }, { status: 404 });
  }

  return Response.json({ success: true });
}

function page(message) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed | Nitro</title>
<style>
body{margin:0;padding:40px 20px;background:#e9e4dd;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;box-sizing:border-box}
.card{max-width:440px;width:100%;background:#fff;border-radius:22px;border:1px solid #e7e0d8;padding:40px 34px;text-align:center}
.logo{width:46px;height:46px;border-radius:14px;margin:0 auto 12px}
.brand{font-size:12px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#c47d8e;margin:0 0 28px}
h1{font-size:22px;font-weight:800;color:#1a1a1a;margin:0 0 16px;line-height:1.3}
p{font-size:15px;line-height:1.7;color:#555;margin:0 0 24px}
a{display:inline-block;background:#c47d8e;color:#fff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:14px}
</style></head>
<body><div class="card">
<img src="https://nitro.ng/icon-192.png" class="logo" alt="Nitro"/>
<p class="brand">NITRO</p>
<h1>All done</h1>
<p>${message}</p>
<a href="https://nitro.ng/dashboard?page=settings#set-notifications">Manage preferences</a>
</div></body></html>`;
}
