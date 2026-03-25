import { validateEnv } from '@/lib/env';

export function register() {
  validateEnv();
}

// Separate Node.js-only hook — Next.js 16 calls this only in Node runtime
export async function onRequestError(err, request, context) {
  console.error('[Request Error]', err?.message, request?.url);
}
