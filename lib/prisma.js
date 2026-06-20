import { PrismaClient } from '@prisma/client';

BigInt.prototype.toJSON = function () { return Number(this); };

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
