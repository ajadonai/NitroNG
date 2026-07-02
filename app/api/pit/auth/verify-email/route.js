import prisma from "@/lib/prisma";
import crypto from "crypto";
import { sendEmail, emailWrap, emailCTA } from "@/lib/email";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const SECRET = process.env.CRON_SECRET || "pit-verify-fallback";

export async function POST(req) {
  try {
    const { limited } = await rateLimit(req, { maxAttempts: 5, windowMs: 10 * 60 * 1000 });
    if (limited) return tooManyRequests("Too many attempts. Try again in 10 minutes.");

    const { email } = await req.json().catch(() => ({}));
    if (!email) return Response.json({ error: "Email is required" }, { status: 400 });

    const clean = email.toLowerCase().trim();

    const existing = await prisma.crewMember.findUnique({ where: { email: clean }, select: { id: true } });
    if (existing) return Response.json({ error: "An application with this email already exists" }, { status: 409 });

    const user = await prisma.user.findUnique({
      where: { email: clean },
      select: { id: true },
    });

    if (!user) return Response.json({ exists: false });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 10 * 60 * 1000;
    const hmac = crypto.createHmac("sha256", SECRET).update(`${clean}:${code}:${expires}`).digest("hex");
    const token = `${expires}.${hmac}`;

    const html = emailWrap({
      body: `
        <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 16px;">Hi there,</p>
        <p class="em-t" style="font-size:15px;line-height:1.7;color:#555;margin:0 0 24px;">Someone is applying to join the Pit with your email. Enter this code to verify it's you:</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr><td align="center" style="padding:20px 24px;background:#faf7f4;border-radius:14px;border:1px solid #f0e9e1;">
          <div style="font-family:'Courier New',monospace;font-size:36px;font-weight:700;color:#c47d8e;letter-spacing:8px;">${code}</div>
          <div style="font-size:13px;color:#9a948d;margin-top:8px;">Expires in 10 minutes</div>
        </td></tr></table>
        <p class="em-m" style="font-size:13px;color:#9a948d;margin:0;text-align:center;">If you didn't request this, just ignore this email.</p>
      `,
    });

    sendEmail(clean, "Your Pit verification code", html).catch(() => {});

    return Response.json({ exists: true, token });
  } catch (e) {
    console.error("Pit verify-email error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
