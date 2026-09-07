'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect, useState } from 'react';

/**
 * The crash screen. It commits to the plum world rather than following the
 * theme, because it is a momentary screen and it must render even when the
 * app's providers are the thing that broke — so nothing here reads context,
 * fetches, or depends on state that could itself throw.
 *
 * The copy answers the question a money app actually gets asked when something
 * breaks: not "what happened" but "did that take my money". Hence the plain
 * statement of fault and the reassurance line, which carries more weight than
 * the apology it replaces.
 */
export default function Error({ error, reset }) {
  const [ref, setRef] = useState('');

  useEffect(() => {
    if (!error) return;
    const id = Sentry.captureException(error, { tags: { boundary: 'error.jsx' } });
    // A short handle the customer can quote on WhatsApp, which turns "it broke"
    // into a Sentry lookup.
    if (id) setRef(String(id).slice(0, 8).toUpperCase());
  }, [error]);

  const ring = 'inset 0 0 0 1.5px rgba(255,255,255,.4), 0 0 0 1.5px rgba(255,255,255,.5), 0 0 0 3px rgba(232,180,196,.3)';

  return (
    <div
      className="min-h-dvh flex items-center justify-center relative overflow-hidden px-6 py-10 text-center"
      style={{ background: '#2a1a22', color: '#f6ecee', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-[.05]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
      <div aria-hidden="true" className="absolute rounded-full pointer-events-none" style={{ width: 420, height: 340, top: '-20%', left: '12%', background: 'rgba(196,125,142,.18)', filter: 'blur(100px)' }} />
      <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 font-extrabold leading-none whitespace-nowrap select-none pointer-events-none text-[130px] md:text-[200px]" style={{ bottom: '-.34em', letterSpacing: '-.04em', color: 'transparent', WebkitTextStroke: '1px rgba(246,217,222,.07)' }}>NITRO</div>

      <div className="relative z-[2] flex flex-col items-center max-w-[400px]">
        <span className="w-11 h-11 rounded-full flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg,#c97f92,#8b5266)', boxShadow: ring }}>
          <svg width="19" height="21" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>
        </span>

        <h1 className="text-[27px] font-bold leading-tight -tracking-[.02em] mb-2.5">
          This one is <em className="not-italic" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic', fontWeight: 600, color: '#e8a0b2' }}>on us.</em>
        </h1>
        <p className="text-sm leading-[1.65] mb-3" style={{ color: 'rgba(246,236,238,.62)' }}>
          Something broke on our side, not yours. Nothing you did caused it and nothing has been charged twice.
        </p>

        <span className="inline-flex items-center gap-2 mb-6 py-2 px-3.5 rounded-full text-[12.5px] font-semibold" style={{ background: 'rgba(75,226,132,.09)', border: '1px solid rgba(75,226,132,.24)', color: '#4be284' }}>
          <i className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: '#4be284' }} />
          Your wallet and your orders are untouched
        </span>

        <div className="flex gap-2.5 flex-wrap justify-center w-full">
          <button
            onClick={() => reset()}
            className="text-sm font-bold py-[11px] px-[22px] rounded-full border-none cursor-pointer font-[inherit] transition-transform duration-200 hover:-translate-y-px"
            style={{ background: '#fff', color: '#1c1b19', boxShadow: '0 4px 14px rgba(0,0,0,.28), inset 0 0 0 1.5px rgba(255,255,255,.9), 0 0 0 1.5px rgba(255,255,255,.6), 0 0 0 3px rgba(0,0,0,.2)' }}
          >
            Try again
          </button>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="text-sm font-bold py-[11px] px-[22px] rounded-full border-none cursor-pointer font-[inherit] transition-transform duration-200 hover:-translate-y-px"
            style={{ background: 'rgba(255,255,255,.13)', color: '#f6ecee', boxShadow: `0 4px 12px rgba(0,0,0,.2), ${ring}` }}
          >
            Go home
          </button>
        </div>

        {ref && <div className="mt-4 text-[10.5px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(246,236,238,.3)' }}>REF {ref}</div>}
      </div>
    </div>
  );
}
