import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import { rateLimit, rateLimitUnavailable, tooManyRequests } from "@/lib/rate-limit";
import { hashToken } from "@/lib/crew";
import { validateEmail, validatePassword, sanitizeEmail } from "@/lib/validate";

export async function POST(req) {
  try {
    const ipLimit = await rateLimit(req, { maxAttempts: 5, windowMs: 5 * 60 * 1000 });
    if (ipLimit.unavailable) return rateLimitUnavailable(undefined, ipLimit.retryAfter);
    if (ipLimit.limited) return tooManyRequests("Too many login attempts. Try again in 5 minutes.", ipLimit.retryAfter);

    const { email, password } = await req.json().catch(() => ({}));
    if (!email || !password) return Response.json({ error: "Email and password required" }, { status: 400 });
    if (!validateEmail(email)) return Response.json({ error: "Invalid email address" }, { status: 400 });
    if (!validatePassword(password)) return Response.json({ error: "Invalid password" }, { status: 400 });

    const clean = sanitizeEmail(email);

    const accountLimit = await rateLimit(req, { maxAttempts: 8, windowMs: 15 * 60 * 1000, key: `rl:acct:${clean}:pit-login` });
    if (accountLimit.unavailable) return rateLimitUnavailable(undefined, accountLimit.retryAfter);
    if (accountLimit.limited) return tooManyRequests("Too many login attempts for this account. Try again in 15 minutes.", accountLimit.retryAfter);
    const member = await prisma.crewMember.findUnique({ where: { email: clean } });

    if (!member) {
      const isNitroUser = await prisma.user.findUnique({ where: { email: clean }, select: { id: true } });
      if (isNitroUser) {
        return Response.json({ error: "This email has a Nitro account but hasn't joined the Pit yet. Apply to get started." }, { status: 401 });
      }
      return Response.json({ error: "No account found with this email" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, member.password);
    if (!valid) return Response.json({ error: "Incorrect password or email" }, { status: 401 });

    if (member.status === "pending") return Response.json({ error: "pending", message: "Your application is under review" }, { status: 403 });
    if (member.status === "rejected") return Response.json({ error: "rejected", message: "Your application was not approved" }, { status: 403 });
    if (member.status === "suspended") return Response.json({ error: "suspended", message: "Your account has been suspended" }, { status: 403 });

    const token = crypto.randomBytes(32).toString("hex");
    await prisma.crewSession.create({
      data: { memberId: member.id, token: hashToken(token), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    const jar = await cookies();
    jar.set("crew_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return Response.json({ ok: true, role: member.role });
  } catch (e) {
    console.error("Crew login error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
