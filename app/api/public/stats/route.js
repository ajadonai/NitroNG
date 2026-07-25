import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [users, orders] = await Promise.all([
      prisma.user.count({ where: { emailVerified: true } }),
      prisma.order.count({ where: { deletedAt: null } }),
    ]);
    return NextResponse.json({ users, orders }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json({ users: 0, orders: 0 }, { status: 500 });
  }
}
