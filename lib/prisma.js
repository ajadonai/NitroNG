import { PrismaClient } from '@prisma/client';

BigInt.prototype.toJSON = function () { return Number(this); };

const globalForPrisma = globalThis;

// Neon's pooler closes idle connections now and then and the first query on a
// warm runtime meets a dead socket. Reads are idempotent, so they get one quiet
// retry; writes are left alone so nothing runs twice.
const TRANSIENT_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);
const READ_OPS = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']);
const isTransient = (e) => TRANSIENT_CODES.has(e?.code) || /closed the connection|Can't reach database server|Connection terminated|ECONNRESET/i.test(e?.message || '');

function withReadRetry(client) {
  return client.$extends({
    query: {
      $allOperations({ operation, args, query }) {
        if (!READ_OPS.has(operation)) return query(args);
        return query(args).catch(async (error) => {
          if (!isTransient(error)) throw error;
          await new Promise(resolve => setTimeout(resolve, 150));
          return query(args);
        });
      },
    },
  });
}

const prisma = globalForPrisma.prisma ?? withReadRetry(new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['warn'] : [],
}));

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
