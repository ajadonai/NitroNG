import prisma from "@/lib/prisma";
import crypto from "crypto";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit, rateLimitUnavailable, tooManyRequests } from "@/lib/rate-limit";

const SECRET = process.env.CRON_SECRET;

export async function POST(req) {
  try {
    const limit = await rateLimit(req, { maxAttempts: 5, windowMs: 10 * 60 * 1000 });
    if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
    if (limit.limited) return tooManyRequests("Too many attempts. Try again in 10 minutes.", limit.retryAfter);

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

    sendVerificationEmail(clean, "there", code, { pit: true }).catch(() => {});

    return Response.json({ exists: true, token });
  } catch (e) {
    console.error("Pit verify-email error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
