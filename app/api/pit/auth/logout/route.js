import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { hashToken } from "@/lib/crew";

export async function POST() {
  const jar = await cookies();
  const token = jar.get("crew_session")?.value;

  if (token) {
    await prisma.crewSession.deleteMany({ where: { token: hashToken(token) } }).catch(() => {});
    jar.delete("crew_session");
  }

  return Response.json({ ok: true });
}
