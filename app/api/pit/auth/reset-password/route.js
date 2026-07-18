import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { rateLimit, rateLimitUnavailable, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req) {
  try {
    const limit = await rateLimit(req, { maxAttempts: 5, windowMs: 5 * 60 * 1000 });
    if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
    if (limit.limited) return tooManyRequests("Too many reset attempts. Try again in 5 minutes.", limit.retryAfter);

    const { token, password } = await req.json().catch(() => ({}));

    if (!token || typeof token !== "string" || token.length > 200) {
      return Response.json({ error: "Invalid token" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 6 || password.length > 128) {
      return Response.json({ error: "Password must be 6-128 characters" }, { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const member = await prisma.crewMember.findFirst({
      where: {
        resetToken: tokenHash,
        resetExpires: { gt: new Date() },
        status: 'approved',
        deletedAt: null,
      },
    });

    if (!member) {
      return Response.json({ error: "Invalid or expired reset link" }, { status: 401 });
    }

    const hashed = await bcrypt.hash(password, 12);

    const updated = await prisma.$transaction(async tx => {
      const { count } = await tx.crewMember.updateMany({
        where: {
          id: member.id,
          resetToken: tokenHash,
          resetExpires: { gt: new Date() },
          status: 'approved',
          deletedAt: null,
        },
        data: { password: hashed, resetToken: null, resetExpires: null },
      });
      if (count !== 1) return false;
      await tx.crewSession.deleteMany({ where: { memberId: member.id } });
      return true;
    });
    if (!updated) {
      return Response.json({ error: "Invalid or expired reset link" }, { status: 401 });
    }

    return Response.json({ message: "Password reset successfully. You can now log in." });
  } catch (e) {
    console.error("Pit reset-password error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
