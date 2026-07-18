import prisma from "@/lib/prisma";
import crypto from "crypto";
import { rateLimit, rateLimitUnavailable, tooManyRequests } from "@/lib/rate-limit";

const SECRET = process.env.CRON_SECRET;

export async function POST(req) {
  try {
    const limit = await rateLimit(req, { maxAttempts: 8, windowMs: 10 * 60 * 1000 });
    if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
    if (limit.limited) return tooManyRequests("Too many attempts. Try again in 10 minutes.", limit.retryAfter);

    const { email, code, token } = await req.json().catch(() => ({}));
    if (!email || !code || !token) return Response.json({ error: "Missing fields" }, { status: 400 });

    const clean = email.toLowerCase().trim();
    const codeClean = code.trim();
    const dotIdx = token.indexOf(".");
    if (dotIdx < 1) return Response.json({ error: "Invalid token" }, { status: 400 });

    const expires = parseInt(token.slice(0, dotIdx));
    const hmac = token.slice(dotIdx + 1);

    if (Date.now() > expires) return Response.json({ error: "Code expired. Go back and try again." }, { status: 401 });

    const expected = crypto.createHmac("sha256", SECRET).update(`${clean}:${codeClean}:${expires}`).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
      return Response.json({ error: "Incorrect code" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: clean },
      select: { name: true, phone: true },
    });

    return Response.json({ verified: true, name: user?.name || "", phone: user?.phone || "" });
  } catch (e) {
    console.error("Pit verify-code error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
