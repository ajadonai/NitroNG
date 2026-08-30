'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { PlatformCard, PlatformIcon, TierCards, AskCard, fromPrice, eyebrowStyle } from './platform-card';

export default function ServicesHubView({ platforms }) {
  return <ThemeProvider><ServicesHubInner platforms={platforms} /></ThemeProvider>;
}

function Grid({ items }) {
  const { t } = useTheme();
  return (
    <div className="grid grid-cols-4 gap-2.5 max-md:grid-cols-2">
      {items.map(p => (
        <PlatformCard
          key={p.slug}
          name={p.name}
          icon={<PlatformIcon name={p.name} color={t.muted} />}
          count={p.serviceCount}
          fromPrice={fromPrice(p.fromPrice)}
          href={`/services/${p.slug}`}
        />
      ))}
    </div>
  );
}

function ServicesHubInner({ platforms }) {
  const { t } = useTheme();
  const social = platforms.filter(p => p.group === 'social');
  const music = platforms.filter(p => p.group === 'music');
  const eyebrow = eyebrowStyle(t);

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif] transition-[background] duration-500" style={{ background: t.bg, color: t.text }}>
        <SharedNav />
        <div className="flex-1 w-full max-w-[920px] mx-auto px-7 pt-11 pb-14 max-md:px-4 max-md:pt-7 max-md:pb-10 flex flex-col gap-[26px] max-md:gap-5">

          <header className="flex flex-col gap-2.5">
            <span style={eyebrow}>Services · {platforms.length} {platforms.length === 1 ? 'platform' : 'platforms'}</span>
            <h1 className="serif m-0 text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.01em]" style={{ color: t.text, textWrap: 'balance' }}>Everything you can grow on Nitro</h1>
            <p className="m-0 text-[18px] leading-[1.55] max-w-[62ch]" style={{ color: t.soft }}>
              Followers, likes, views, subscribers, streams and more for every major platform. Everything is priced in Naira, paid through any Nigerian bank or card, and delivered to your account without needing a password.
            </p>
          </header>

          {social.length > 0 && (
            <div className="flex flex-col gap-3">
              <span style={eyebrow}>Social</span>
              <Grid items={social} />
            </div>
          )}

          {music.length > 0 && (
            <div className="flex flex-col gap-3">
              <span style={eyebrow}>Music and audio</span>
              <Grid items={music} />
            </div>
          )}

          <div className="flex flex-col gap-3">
            <span style={eyebrow}>Three tiers, one catalogue</span>
            <TierCards />
          </div>

          <AskCard title="Want it done for you?" body="Tell us the link and what you want on WhatsApp and we place the order." />
        </div>
        <SharedFooter />
      </div>
    </>
  );
}
