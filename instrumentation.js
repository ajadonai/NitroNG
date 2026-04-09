import { validateEnv } from '@/lib/env';
import { log } from '@/lib/logger';

export async function register() {
  validateEnv();

  // Initialize Sentry for server-side error tracking
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("./sentry.server.config.mjs");
    }
    if (process.env.NEXT_RUNTIME === "edge") {
      await import("./sentry.edge.config.mjs");
    }
  }

  // ── Graceful shutdown (for Railway, Docker, any long-running server) ──
  // Vercel serverless doesn't need this, but it doesn't hurt either.
  // On Railway/Docker: SIGTERM → stop accepting requests → finish in-flight → close DB → exit
  if (typeof process !== 'undefined' && process.on) {
    let shuttingDown = false;

    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      log.info('Shutdown', `Received ${signal} — starting graceful shutdown`);

      // Give in-flight requests time to finish (30s max)
      const forceExit = setTimeout(() => {
        log.warn('Shutdown', 'Forcing exit after 30s timeout');
        process.exit(1);
      }, 30000);
      forceExit.unref(); // Don't keep process alive just for this timer

      try {
        // Close Prisma connection pool
        const { PrismaClient } = await import('@prisma/client');
        const prisma = globalThis.prisma;
        if (prisma) {
          await prisma.$disconnect();
          log.info('Shutdown', 'Database connections closed');
        }
      } catch (err) {
        log.error('Shutdown', 'Error closing database', { error: err?.message });
      }

      log.info('Shutdown', 'Graceful shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Separate Node.js-only hook — Next.js 16 calls this only in Node runtime
export async function onRequestError(err, request, context) {
  log.error('Request', err?.message, { url: request?.url });
}
