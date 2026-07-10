'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    if (error) Sentry.captureException(error, { tags: { boundary: 'error.jsx' } });
  }, [error]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080b14]" style={{ fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' }}>
      <div className="text-center py-10 px-5 max-w-[400px]">
        <div className="w-12 h-12 rounded-[13px] bg-[linear-gradient(135deg,#c47d8e,#8b5e6b)] flex items-center justify-center mx-auto mb-5"><svg width="22" height="24" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg></div>
        <h1 className="text-[22px] font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-sm text-white/45 leading-[1.6] mb-6">
          An unexpected error occurred. Please try again or contact support if the issue persists.
        </p>
        <button
          onClick={() => reset()}
          className="py-2.5 px-7 rounded-[10px] bg-[#c47d8e] text-white border-none text-sm font-semibold cursor-pointer font-[inherit] mr-2"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="py-2.5 px-7 rounded-[10px] bg-transparent text-white/50 border border-white/10 text-sm font-medium cursor-pointer font-[inherit]"
        >
          Go home
        </button>
      </div>
    </div>
  );
}
