import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { validateEmail, validatePassword, validateName, validatePhone, sanitizeEmail, isDisposableEmail } from "@/lib/validate";
import { getAffiliateSettings } from "@/lib/affiliate-settings";

export async function POST(req) {
  try {
    const { limited } = await rateLimit(req, { maxAttempts: 5, windowMs: 10 * 60 * 1000 });
    if (limited) return tooManyRequests("Too many applications. Try again in 10 minutes.");

    const { affiliate_enabled } = await getAffiliateSettings(['affiliate_enabled']);
    if (affiliate_enabled === 'false') {
      return Response.json({ error: "The affiliate program is not accepting applications right now" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, email, password, phone, xHandle, whyApply } = body;

    if (!name?.trim() || !email?.trim() || !password) {
      return Response.json({ error: "Name, email, and password are required" }, { status: 400 });
    }
    if (!validateName(name)) return Response.json({ error: "Name must be 2-100 characters, letters only" }, { status: 400 });
    if (!validateEmail(email)) return Response.json({ error: "Please enter a valid email address" }, { status: 400 });
    if (!validatePassword(password)) return Response.json({ error: "Password must be 6-128 characters" }, { status: 400 });
    if (phone && !validatePhone(phone)) return Response.json({ error: "Please enter a valid phone number" }, { status: 400 });

    const clean = sanitizeEmail(email);
    if (isDisposableEmail(clean)) return Response.json({ error: "Disposable email addresses are not allowed" }, { status: 400 });

    const exists = await prisma.crewMember.findUnique({ where: { email: clean } });
    if (exists) return Response.json({ error: "An application with this email already exists" }, { status: 409 });

    const hashed = await bcrypt.hash(password, 12);

    const existingUser = await prisma.user.findUnique({
      where: { email: clean },
      select: { id: true, name: true, phone: true },
    });

    const crewData = {
      role: "crew",
      status: "pending",
      name: existingUser?.name || name.trim(),
      email: clean,
      password: hashed,
      phone: existingUser?.phone || phone?.trim() || null,
      xHandle: xHandle?.trim()?.replace(/^@/, "") || null,
      whyApply: whyApply?.trim() || null,
      ...(existingUser ? { userId: existingUser.id } : {}),
    };

    const crewMember = await prisma.crewMember.create({ data: crewData });

    if (!existingUser) {
      let newUser = await prisma.user.create({
        data: { name: name.trim(), email: clean, password: hashed, phone: phone?.trim() || null },
      }).catch(() => null);
      if (!newUser && phone?.trim()) {
        newUser = await prisma.user.create({
          data: { name: name.trim(), email: clean, password: hashed },
        }).catch(() => null);
      }
      if (newUser) {
        await prisma.crewMember.update({
          where: { id: crewMember.id },
          data: { userId: newUser.id },
        }).catch(() => {});
      }
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("Crew apply error:", e);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}
