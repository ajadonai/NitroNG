import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, password, phone, xHandle, whyApply } = body;

    if (!name?.trim() || !email?.trim() || !password) {
      return Response.json({ error: "Name, email, and password are required" }, { status: 400 });
    }
    if (password.length < 6) return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    const clean = email.toLowerCase().trim();
    const exists = await prisma.crewMember.findUnique({ where: { email: clean } });
    if (exists) return Response.json({ error: "An application with this email already exists" }, { status: 409 });

    const hashed = await bcrypt.hash(password, 12);

    await prisma.crewMember.create({
      data: {
        role: "crew",
        status: "pending",
        name: name.trim(),
        email: clean,
        password: hashed,
        phone: phone?.trim() || null,
        xHandle: xHandle?.trim()?.replace(/^@/, "") || null,
        whyApply: whyApply?.trim() || null,
      },
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error("Crew apply error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
