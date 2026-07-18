import prisma from "@/lib/prisma";
import { getCrewSession, hashToken } from "@/lib/crew";
import { sendDM } from "@/lib/crew-bot";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { validatePassword } from "@/lib/validate";

const ACTIVE_MEMBER_WHERE = { status: 'approved', deletedAt: null };

async function updateActiveMember(memberId, data) {
  const { count } = await prisma.crewMember.updateMany({
    where: { id: memberId, ...ACTIVE_MEMBER_WHERE },
    data,
  });
  return count === 1;
}

function inactiveMemberResponse() {
  return Response.json({ error: 'Member is no longer active' }, { status: 409 });
}

export async function GET(req) {
  try {
    const member = await getCrewSession();
    if (!member) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    if (searchParams.get("check") === "telegram") {
      const fresh = await prisma.crewMember.findFirst({
        where: { id: member.id, ...ACTIVE_MEMBER_WHERE },
        select: { telegramUserId: true, telegramHandle: true },
      });
      if (!fresh) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      return Response.json({ linked: !!fresh?.telegramUserId, handle: fresh?.telegramHandle || null });
    }
    return Response.json({ error: "Invalid check" }, { status: 400 });
  } catch {
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const member = await getCrewSession();
    if (!member) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { section } = body;

    if (section === "profile") {
      const { name, phone, xHandle } = body;
      if (!name?.trim()) return Response.json({ error: "Name is required" }, { status: 400 });
      const updated = await updateActiveMember(member.id, {
        name: name.trim(), phone: phone?.trim() || null, xHandle: xHandle?.trim() || null,
      });
      if (!updated) return inactiveMemberResponse();
      return Response.json({ ok: true });
    }

    if (section === "bank") {
      const { bankName, bankAccountNo, bankAccountName, currentPassword } = body;
      if (!currentPassword) return Response.json({ error: "Current password is required to change bank details" }, { status: 400 });
      if (!bankName?.trim() || !bankAccountNo?.trim() || !bankAccountName?.trim()) {
        return Response.json({ error: "All bank fields are required" }, { status: 400 });
      }
      const valid = await bcrypt.compare(currentPassword, member.password);
      if (!valid) return Response.json({ error: "Incorrect password" }, { status: 400 });
      const updated = await updateActiveMember(member.id, {
        bankName: bankName.trim(), bankAccountNo: bankAccountNo.trim(), bankAccountName: bankAccountName.trim(),
      });
      if (!updated) return inactiveMemberResponse();
      if (member.telegramUserId) {
        sendDM(member.telegramUserId, '🏦 Your bank details were just updated. If this wasn\'t you, change your password immediately at nitro.ng/pit/settings.').catch(() => {});
      }
      prisma.activityLog.create({ data: { adminName: `Pit member ${member.id}`, action: `Pit member updated bank details`, type: 'pit-self' } }).catch(() => {});
      return Response.json({ ok: true });
    }

    if (section === "password") {
      const { current, newPassword } = body;
      if (!current || !newPassword) return Response.json({ error: "Both fields are required" }, { status: 400 });
      if (!validatePassword(newPassword)) return Response.json({ error: "Password must be 6-128 characters" }, { status: 400 });

      const valid = await bcrypt.compare(current, member.password);
      if (!valid) return Response.json({ error: "Current password is incorrect" }, { status: 400 });

      const hashed = await bcrypt.hash(newPassword, 12);
      const updated = await updateActiveMember(member.id, { password: hashed });
      if (!updated) return inactiveMemberResponse();

      const jar = await cookies();
      const currentToken = jar.get("crew_session")?.value;
      const currentHash = currentToken ? hashToken(currentToken) : null;
      await prisma.crewSession.deleteMany({
        where: { memberId: member.id, ...(currentHash ? { token: { not: currentHash } } : {}) },
      });

      if (member.telegramUserId) {
        sendDM(member.telegramUserId, '🔑 Your Pit password was just changed. If this wasn\'t you, contact support immediately.').catch(() => {});
      }
      prisma.activityLog.create({ data: { adminName: `Pit member ${member.id}`, action: `Pit member changed password`, type: 'pit-self' } }).catch(() => {});
      return Response.json({ ok: true });
    }

    if (section === "telegram") {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code;
      for (let attempt = 0; attempt < 5; attempt++) {
        const bytes = crypto.randomBytes(6);
        code = '';
        for (let i = 0; i < 6; i++) code += chars[bytes[i] % chars.length];
        const collision = await prisma.crewMember.findFirst({
          where: { telegramLinkCode: code, ...ACTIVE_MEMBER_WHERE },
        });
        if (!collision) break;
        if (attempt === 4) return Response.json({ error: "Please try again" }, { status: 500 });
      }
      const updated = await updateActiveMember(member.id, {
        telegramLinkCode: code,
        telegramLinkCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      if (!updated) return inactiveMemberResponse();
      return Response.json({ ok: true, code });
    }

    if (section === "telegram_disconnect") {
      const updated = await updateActiveMember(member.id, {
        telegramUserId: null, telegramHandle: null, telegramLinkCode: null, telegramLinkCodeExpiresAt: null,
      });
      if (!updated) return inactiveMemberResponse();
      if (member.telegramUserId) {
        sendDM(member.telegramUserId, '🔓 Your Telegram has been disconnected from Nitro. Re-link anytime at nitro.ng/pit/settings.').catch(() => {});
      }
      prisma.activityLog.create({ data: { adminName: `Pit member ${member.id}`, action: `Pit member disconnected Telegram`, type: 'pit-self' } }).catch(() => {});
      return Response.json({ ok: true });
    }

    if (section === "twitter") {
      const { handle } = body;
      if (!handle?.trim()) return Response.json({ error: "Handle is required" }, { status: 400 });
      const updated = await updateActiveMember(member.id, { xHandle: handle.trim().replace(/^@/, "") });
      if (!updated) return inactiveMemberResponse();
      return Response.json({ ok: true });
    }

    if (section === "twitter_disconnect") {
      const updated = await updateActiveMember(member.id, { xHandle: null });
      if (!updated) return inactiveMemberResponse();
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Invalid section" }, { status: 400 });
  } catch (e) {
    console.error("Settings PATCH error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
