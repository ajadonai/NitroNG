import prisma from "@/lib/prisma";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit, rateLimitUnavailable, tooManyRequests } from "@/lib/rate-limit";

const GENERIC = "If an account exists, a reset link has been sent.";

export async function POST(req) {
  try {
    const limit = await rateLimit(req, { maxAttempts: 5, windowMs: 15 * 60 * 1000 });
    if (limit.unavailable) return rateLimitUnavailable(undefined, limit.retryAfter);
    if (limit.limited) return tooManyRequests("Too many requests. Try again in 15 minutes.", limit.retryAfter);

    const { email } = await req.json().catch(() => ({}));
    if (!email) return Response.json({ error: "Email is required" }, { status: 400 });

    const member = await prisma.crewMember.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true, status: true, deletedAt: true },
    });

    if (!member || member.deletedAt || member.status === "rejected") {
      return Response.json({ message: GENERIC });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    await prisma.crewMember.update({
      where: { id: member.id },
      data: { resetToken: resetTokenHash, resetExpires: new Date(Date.now() + 30 * 60 * 1000) },
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${origin}/pit/reset-password?token=${resetToken}`;

    sendPasswordResetEmail(member.email, member.name, resetUrl).catch(() => {});

    return Response.json({ message: GENERIC });
  } catch (e) {
    console.error("Pit forgot-password error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
