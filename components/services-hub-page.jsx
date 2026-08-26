'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

const PLATFORM_ICONS = {
  Instagram: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
  TikTok: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>,
  YouTube: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
  'X (Twitter)': <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  Facebook: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  Telegram: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>,
  Snapchat: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z"/></svg>,
  LinkedIn: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  Twitch: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>,
  Discord: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>,
  Spotify: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>,
};

export default function ServicesHubView({ platforms }) {
  return <ThemeProvider><ServicesHubInner platforms={platforms} /></ThemeProvider>;
}

function ServicesHubInner({ platforms }) {
  const { dark, t } = useTheme();
  const accent = '#c47d8e';
  const border = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.07)';
  const cardBg = dark ? 'rgba(255,255,255,.04)' : '#fff';
  const cardHover = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.02)';

  const social = platforms.filter(p => p.group === 'social');
  const music = platforms.filter(p => p.group === 'music');

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus_Jakarta_Sans,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav />

        <div className="text-center pt-14 pb-10 max-md:pt-10 max-md:pb-8 px-6 max-w-[660px] mx-auto">
          <span className="text-xs font-semibold tracking-[2px] uppercase block mb-3" style={{ color: accent }}>29 platforms</span>
          <h1 className="text-[clamp(26px,5vw,40px)] font-semibold mb-4 leading-tight" style={{ color: t.text }}>
            Social Media Growth Services in Nigeria
          </h1>
          <p className="text-[15px] leading-relaxed max-w-[520px] mx-auto" style={{ color: t.textSoft }}>
            Followers, likes, views, subscribers, streams and more for every major platform. Everything is priced in Naira, paid through any Nigerian bank or card, and delivered to your account without needing a password.
          </p>
        </div>

        <main className="flex-1 px-6 pb-20 max-w-[900px] mx-auto w-full">

          {social.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>Social platforms</h2>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {social.map(p => (
                  <PlatformCard key={p.slug} platform={p} dark={dark} t={t} accent={accent} border={border} cardBg={cardBg} cardHover={cardHover} />
                ))}
              </div>
            </section>
          )}

          {music.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>Music and audio</h2>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {music.map(p => (
                  <PlatformCard key={p.slug} platform={p} dark={dark} t={t} accent={accent} border={border} cardBg={cardBg} cardHover={cardHover} />
                ))}
              </div>
            </section>
          )}

          <section className="mb-10 rounded-2xl p-8 max-md:p-6" style={{ background: dark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)', border: `1px solid ${border}` }}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>Three tiers, one catalogue</h2>
            <div className="flex flex-col gap-4">
              <TierRow name="Budget" desc="Cheapest option. No refill cover, so if some of what you bought drops, it stays dropped. Good for testing, for services where drops are rare, and for anything where the number only needs to look right once." dark={dark} t={t} accent={accent} />
              <TierRow name="Standard" desc="Refill included for 30 days. If the count drops within that window, it gets topped back up automatically. The default for most buyers." dark={dark} t={t} accent={accent} />
              <TierRow name="Premium" desc="Refill for the life of the order, on services that support it. Higher quality sources, slower delivery by design, and the lowest drop rate in the catalogue." dark={dark} t={t} accent={accent} />
            </div>
            <p className="text-[13px] mt-5" style={{ color: t.textMuted }}>
              Every platform page shows live prices for all three tiers side by side, so you can see exactly what the difference costs before you order.
            </p>
          </section>

          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <a href="/pricing" className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl no-underline text-[13px] font-semibold transition-colors duration-150" style={{ background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.04)', border: `1px solid ${border}`, color: t.text }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
              Full pricing across all platforms
            </a>
            <a href="/signup" className="flex-1 flex items-center justify-center gap-2 py-4 px-6 rounded-xl no-underline text-[13px] font-semibold text-white transition-[transform,box-shadow] duration-200 hover:-translate-y-px" style={{ background: 'linear-gradient(135deg, #c47d8e, #8b5e6b)' }}>
              Create free account
            </a>
          </div>

          <div className="text-center text-[11px] leading-[1.6]" style={{ color: t.textMuted }}>
            We accept bank transfer, debit/credit card, and crypto. Works with Opay, PalmPay, Kuda, Moniepoint, and all Nigerian banks.
          </div>
        </main>

        <SharedFooter />
      </div>
    </>
  );
}

function PlatformCard({ platform, dark, t, accent, border, cardBg }) {
  const icon = PLATFORM_ICONS[platform.name];
  return (
    <a
      href={`/services/${platform.slug}`}
      className="flex items-center gap-4 py-4 px-5 rounded-xl no-underline transition-colors duration-150"
      style={{ background: cardBg, border: `1px solid ${border}`, color: t.text }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = accent + '33'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = border; }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: dark ? 'rgba(196,125,142,.1)' : 'rgba(196,125,142,.06)', color: accent }}>
        {icon || <span className="text-sm font-bold">{platform.name[0]}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold">{platform.name}</div>
        <div className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>
          {platform.serviceCount} services · from ₦{platform.fromPrice.toLocaleString()}/1k
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.2)'} strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
    </a>
  );
}

function TierRow({ name, desc, dark, t, accent }) {
  return (
    <div className="flex gap-4 items-start">
      <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: accent }} />
      <div>
        <div className="text-[13px] font-semibold" style={{ color: t.text }}>{name}</div>
        <div className="text-[13px] leading-[1.6] mt-0.5" style={{ color: t.textMuted }}>{desc}</div>
      </div>
    </div>
  );
}
