import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export async function POST() {
  const jar = await cookies();
  const token = jar.get("crew_session")?.value;

  if (token) {
    await prisma.crewSession.deleteMany({ where: { token } }).catch(() => {});
    jar.delete("crew_session");
  }

  return Response.json({ ok: true });
}
