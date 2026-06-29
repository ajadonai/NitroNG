import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return Response.json({ error: "Token required" }, { status: 400 });

  const member = await prisma.crewMember.findUnique({ where: { inviteToken: token } });
  if (!member) return Response.json({ error: "Invalid invite link" }, { status: 404 });
  if (member.inviteExpiresAt && member.inviteExpiresAt < new Date()) {
    return Response.json({ error: "This invite has expired" }, { status: 410 });
  }
  if (member.status === "approved") return Response.json({ error: "already_joined", message: "You've already joined" }, { status: 409 });

  return Response.json({ ok: true, name: member.name, email: member.email });
}

export async function POST(req) {
  try {
    const { token, password, phone, xHandle } = await req.json().catch(() => ({}));
    if (!token || !password) return Response.json({ error: "Token and password required" }, { status: 400 });
    if (password.length < 6) return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    const member = await prisma.crewMember.findUnique({ where: { inviteToken: token } });
    if (!member) return Response.json({ error: "Invalid invite link" }, { status: 404 });
    if (member.inviteExpiresAt && member.inviteExpiresAt < new Date()) {
      return Response.json({ error: "This invite has expired" }, { status: 410 });
    }

    const hashed = await bcrypt.hash(password, 12);

    const existingUser = await prisma.user.findUnique({
      where: { email: member.email },
      select: { id: true },
    });

    await prisma.crewMember.update({
      where: { id: member.id },
      data: {
        password: hashed,
        status: "approved",
        approvedAt: new Date(),
        inviteToken: null,
        inviteExpiresAt: null,
        ...(phone ? { phone } : {}),
        ...(xHandle ? { xHandle: xHandle.toLowerCase() } : {}),
        ...(existingUser && !member.userId ? { userId: existingUser.id } : {}),
      },
    });

    if (!existingUser) {
      const newUser = await prisma.user.create({
        data: {
          name: member.name,
          email: member.email,
          password: hashed,
          phone: member.phone || null,
        },
      }).catch(() => null);
      if (newUser) {
        await prisma.crewMember.update({
          where: { id: member.id },
          data: { userId: newUser.id },
        }).catch(() => {});
      }
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    await prisma.crewSession.create({
      data: { memberId: member.id, token: sessionToken, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

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
