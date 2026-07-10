import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";

const MAX_RETRIES = 3;

export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return Response.json({ error: "Token required" }, { status: 400 });

  const member = await prisma.crewMember.findUnique({ where: { inviteToken: token } });
  if (!member || member.deletedAt) return Response.json({ error: "Invalid invite link" }, { status: 404 });
  if (member.status === "rejected") return Response.json({ error: "This invitation has been revoked" }, { status: 403 });
  if (member.status === "suspended") return Response.json({ error: "This account is suspended" }, { status: 403 });
  if (member.status === "approved") return Response.json({ error: "already_joined", message: "You've already joined" }, { status: 409 });
  if (member.inviteExpiresAt && member.inviteExpiresAt < new Date()) {
    return Response.json({ error: "This invite has expired. Ask your chief to resend it." }, { status: 410 });
  }

  return Response.json({ ok: true, name: member.name, email: member.email });
}

export async function POST(req) {
  try {
    const { token, password, phone, xHandle } = await req.json().catch(() => ({}));
    if (!token || !password) return Response.json({ error: "Token and password required" }, { status: 400 });
    if (password.length < 6) return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    const hashed = await bcrypt.hash(password, 12);
    const sessionToken = crypto.randomBytes(32).toString("hex");

    try {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          await prisma.$transaction(async (tx) => {
            const member = await tx.crewMember.findUnique({ where: { inviteToken: token } });
            if (!member || member.deletedAt) throw Object.assign(new Error("Invalid invite link"), { _status: 404 });
            if (member.status === "rejected") throw Object.assign(new Error("This invitation has been revoked"), { _status: 403 });
            if (member.status === "suspended") throw Object.assign(new Error("This account is suspended"), { _status: 403 });
            if (member.status === "approved") throw Object.assign(new Error("You've already joined"), { _status: 409 });
            if (member.inviteExpiresAt && member.inviteExpiresAt < new Date()) {
              throw Object.assign(new Error("This invite has expired. Ask your chief to resend it."), { _status: 410 });
            }

            const existingUser = await tx.user.findUnique({ where: { email: member.email }, select: { id: true } });
            let userId = existingUser?.id || member.userId;
            if (!existingUser) {
              const newUser = await tx.user.create({
                data: { name: member.name, email: member.email, password: hashed, phone: phone?.trim() || member.phone || null },
              });
              userId = newUser.id;
            }

            await tx.crewMember.update({
              where: { id: member.id },
              data: {
                password: hashed, status: "approved", approvedAt: new Date(),
                inviteToken: null, inviteExpiresAt: null,
                ...(phone ? { phone: phone.trim() } : {}),
                ...(xHandle ? { xHandle: xHandle.toLowerCase().replace(/^@/, "") } : {}),
                ...(userId ? { userId } : {}),
              },
            });

            await tx.crewSession.create({
              data: { memberId: member.id, token: sessionToken, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
            });
          }, { isolationLevel: 'Serializable' });
          break;
        } catch (e) {
          if (e.code === 'P2034' && attempt < MAX_RETRIES - 1) continue;
          throw e;
        }
      }
    } catch (e) {
      if (e._status === 410) {
        await prisma.crewMember.updateMany({
          where: { inviteToken: token },
          data: { inviteToken: null, inviteExpiresAt: null },
        }).catch(() => {});
      }
      if (e._status) return Response.json({ error: e.message }, { status: e._status });
      throw e;
    }

    const jar = await cookies();
    jar.set("crew_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error("Crew join error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
