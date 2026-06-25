import prisma from "@/lib/prisma";
import { getCrewSession } from "@/lib/crew";
import bcrypt from "bcryptjs";

export async function PATCH(req) {
  try {
    const member = await getCrewSession();
    if (!member) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { section } = body;

    if (section === "profile") {
      const { name, phone, xHandle } = body;
      if (!name?.trim()) return Response.json({ error: "Name is required" }, { status: 400 });
      await prisma.crewMember.update({
        where: { id: member.id },
        data: { name: name.trim(), phone: phone?.trim() || null, xHandle: xHandle?.trim() || null },
      });
      return Response.json({ ok: true });
    }

    if (section === "bank") {
      const { bankName, bankAccountNo, bankAccountName } = body;
      if (!bankName?.trim() || !bankAccountNo?.trim() || !bankAccountName?.trim()) {
        return Response.json({ error: "All bank fields are required" }, { status: 400 });
      }
      await prisma.crewMember.update({
        where: { id: member.id },
        data: { bankName: bankName.trim(), bankAccountNo: bankAccountNo.trim(), bankAccountName: bankAccountName.trim() },
      });
      return Response.json({ ok: true });
    }

    if (section === "password") {
      const { current, newPassword } = body;
      if (!current || !newPassword) return Response.json({ error: "Both fields are required" }, { status: 400 });
      if (newPassword.length < 6) return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });

      const valid = await bcrypt.compare(current, member.password);
      if (!valid) return Response.json({ error: "Current password is incorrect" }, { status: 400 });

      const hashed = await bcrypt.hash(newPassword, 10);
      await prisma.crewMember.update({ where: { id: member.id }, data: { password: hashed } });
      return Response.json({ ok: true });
    }

    if (section === "telegram") {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      await prisma.crewMember.update({
        where: { id: member.id },
        data: { telegramLinkCode: code },
      });
      return Response.json({ ok: true, code });
    }

    return Response.json({ error: "Invalid section" }, { status: 400 });
  } catch (e) {
    console.error("Settings PATCH error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
