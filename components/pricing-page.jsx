'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { trackViewContent } from './capi-tracker';
import { PlatformCard, PlatformIcon, TierCards, AskCard, PinkButton, priceRange, fromPrice, eyebrowStyle, cardStyle } from './platform-card';

export default function PricingView({ platforms }) {
  return <ThemeProvider><PricingInner platforms={platforms} /></ThemeProvider>;
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const tierNote = s => {
  const n = `${s.tiers} ${s.tiers === 1 ? 'tier' : 'tiers'}`;
  if (!s.refill) return n;
  return s.tiers >= 3 ? `${n} · refill on Standard and Premium` : `${n} · refill`;
};

function PricingInner({ platforms }) {
  const { t } = useTheme();
  const sorted = useMemo(() => [...platforms].sort((a, b) => b.services.length - a.services.length), [platforms]);
  const [active, setActive] = useState(sorted[0]?.platform || null);
  const listRef = useRef(null);

  const selected = sorted.find(p => p.platform === active) || sorted[0];
  const serviceCount = sorted.reduce((n, p) => n + p.services.length, 0);

  useEffect(() => { trackViewContent({ content_name: 'pricing', content_type: 'pricing' }); }, []);

  // A link like /pricing#tiktok opens on that platform.
  useEffect(() => {
    const h = window.location.hash.replace(/^#/, '');
    const match = h && sorted.find(p => slug(p.platform) === h);
    if (match) setActive(match.platform);
  }, [sorted]);

  const pick = (name) => {
    setActive(name);
    window.history.replaceState(null, '', `#${slug(name)}`);
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const eyebrow = eyebrowStyle(t);
  const card = cardStyle(t);

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif] transition-[background] duration-500" style={{ background: t.bg, color: t.text }}>
        <SharedNav />
        <div className="flex-1 w-full max-w-[920px] mx-auto px-7 pt-11 pb-14 max-md:px-4 max-md:pt-7 max-md:pb-10 flex flex-col gap-[26px] max-md:gap-5">

          <header className="flex flex-col gap-2.5">
            <span style={eyebrow}>Pricing</span>
            <h1 className="serif m-0 text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.01em]" style={{ color: t.text, textWrap: 'balance' }}>Every price in naira, before you sign up</h1>
            <p className="m-0 text-[18px] leading-[1.55] max-w-[62ch]" style={{ color: t.soft }}>
              {sorted.length > 0 ? `${serviceCount} services across ${sorted.length} platforms. ` : ''}Three tiers on most of them: Budget, Standard with a 30-day refill, Premium with refill for life. Pick a platform to see the list.
            </p>
          </header>

          <TierCards />

          {sorted.length === 0 ? (
            <div className="text-center py-16" style={{ color: t.muted }}>Loading pricing...</div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <span style={eyebrow}>Pick a platform</span>
                <div className="grid grid-cols-4 gap-2.5 max-md:grid-cols-2">
                  {sorted.map(p => {
                    const on = selected?.platform === p.platform;
                    const min = Math.min(...p.services.map(s => s.minPrice));
                    return (
                      <PlatformCard
                        key={p.platform}
                        name={p.platform}
                        icon={<PlatformIcon name={p.platform} color={on ? t.accent : t.muted} />}
                        count={p.services.length}
                        fromPrice={fromPrice(min)}
                        active={on}
                        onClick={() => pick(p.platform)}
                      />
                    );
                  })}
                </div>
              </div>

              {selected && (
                <div ref={listRef} className="scroll-mt-20">
                  <div className="rounded-[14px] overflow-hidden" style={card}>
                    <div className="flex items-baseline justify-between gap-2.5 px-[18px] py-3" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
                      <b className="text-[15px] font-semibold" style={{ color: t.text }}>{selected.platform}</b>
                      <span className="text-[12px] text-right" style={{ color: t.muted }}>{selected.services.length} {selected.services.length === 1 ? 'service' : 'services'} · prices per 1,000</span>
                    </div>
                    {selected.services.map((s, i) => (
                      <div key={s.type} className="flex items-center justify-between gap-2.5 px-[18px] py-3.5" style={{ borderTop: i === 0 ? 'none' : `1px solid ${t.cardBorder}` }}>
                        <span className="flex flex-col min-w-0">
                          <b className="text-[15px] font-semibold" style={{ color: t.text }}>{s.type}</b>
                          <span className="text-[12px]" style={{ color: t.muted }}>{tierNote(s)}</span>
                        </span>
                        <b className="m shrink-0 text-[14px] font-semibold whitespace-nowrap" style={{ color: t.text, fontVariantNumeric: 'tabular-nums' }}>{priceRange(s.minPrice, s.maxPrice)}</b>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2.5">
                    <PinkButton href="/signup" full>Start growing on {selected.platform}</PinkButton>
                  </div>
                </div>
              )}
            </>
          )}

          <AskCard title="Not sure which tier?" body="Start with Budget on a small order, move up if you like it. Or ask us on WhatsApp." />
        </div>
        <SharedFooter />
      </div>
    </>
  );
}
