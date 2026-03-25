import { validateEnv } from '@/lib/env';

export function register() {
  validateEnv();

  // Graceful shutdown — finish in-flight requests before dying
  if (typeof process !== 'undefined') {
    const shutdown = (signal) => {
      console.log(`\n[Shutdown] ${signal} received. Closing gracefully...`);
      // Prisma disconnects automatically on process exit
      // Give 10s for in-flight requests to finish
      setTimeout(() => {
        console.log('[Shutdown] Force exit after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}
