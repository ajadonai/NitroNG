'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function ServicesOverview({ platforms }) {
  return <ThemeProvider><ServicesInner platforms={platforms} /></ThemeProvider>;
}

const SERVICE_DESCRIPTIONS = {
  Instagram: 'Grow your Instagram with real followers, likes, views, comments, story views, saves, and reels engagement.',
  TikTok: 'Boost your TikTok presence with followers, likes, views, shares, comments, and livestream viewers.',
  YouTube: 'Grow your YouTube channel with subscribers, views, watch hours, likes, and comments.',
  X: 'Build your X (Twitter) audience with followers, likes, retweets, views, and bookmarks.',
  Facebook: 'Increase your Facebook reach with page likes, post likes, followers, views, and group members.',
  Telegram: 'Grow your Telegram channels and groups with members, post views, and reactions.',
  Spotify: 'Boost your Spotify streams with plays, followers, monthly listeners, and playlist adds.',
  Snapchat: 'Grow your Snapchat presence with followers, story views, and engagement.',
  LinkedIn: 'Build professional credibility with followers, connections, post likes, and endorsements.',
  Pinterest: 'Increase your Pinterest reach with followers, repins, and board engagement.',
  Twitch: 'Grow your Twitch channel with followers, viewers, and chat engagement.',
  Discord: 'Build your Discord community with server members and online users.',
};

function ServicesInner({ platforms }) {
  const { dark, t } = useTheme();
  const accent = "#c47d8e";
  const border = dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)";

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav />
        <main className="flex-1 py-12 px-6 pb-20 max-w-[900px] mx-auto w-full">

          <div className="mb-10">
            <span className="text-xs font-semibold tracking-[2px] uppercase block mb-3" style={{ color: accent }}>Services</span>
            <h1 className="text-[clamp(28px,5vw,40px)] font-semibold mb-2 leading-tight" style={{ color: t.text }}>Grow on <span className="serif italic font-medium text-[clamp(32px,5.5vw,44px)]" style={{ color: accent }}>Every</span> Platform</h1>
            <p className="text-[15px] leading-relaxed max-w-[520px]" style={{ color: t.textSoft }}>Real engagement across {platforms.length}+ platforms. Multiple quality tiers, instant delivery, and refill guarantees on most services.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {platforms.map(p => (
              <a key={p.platform} href={`/services/${p.platform.toLowerCase()}`} className="no-underline group">
                <div className="rounded-2xl p-5 h-full transition-[box-shadow,transform] duration-200 group-hover:shadow-[0_8px_30px_rgba(0,0,0,.14)] group-hover:-translate-y-0.5" style={{ background: dark ? "rgba(255,255,255,.06)" : "#fff", border: `1px solid ${border}` }}>
                  <div className="text-lg font-semibold mb-1" style={{ color: t.text }}>{p.platform}</div>
                  <p className="text-[13px] leading-[1.6] mb-3" style={{ color: t.textMuted }}>{SERVICE_DESCRIPTIONS[p.platform] || `Grow your ${p.platform} presence.`}</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {p.serviceTypes.slice(0, 4).map(st => (
                      <span key={st} className="text-[11px] py-0.5 px-2 rounded-md font-medium" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.06)", color: accent }}>{st}</span>
                    ))}
                    {p.serviceTypes.length > 4 && <span className="text-[11px] py-0.5 px-2 rounded-md" style={{ color: t.textMuted }}>+{p.serviceTypes.length - 4} more</span>}
                  </div>
                  <div className="text-[13px] font-semibold" style={{ color: accent }}>From ₦{p.minPrice.toLocaleString()}/1K</div>
                </div>
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-12 p-6 rounded-[14px] text-center" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)", border: `1px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.14)"}` }}>
            <p className="text-[15px] mb-1 font-semibold" style={{ color: t.text }}>See full pricing for every service</p>
            <p className="text-sm mb-4" style={{ color: t.textSoft }}>Compare tiers, check refill guarantees, and find the best option for your budget.</p>
            <a href="/pricing" className="inline-flex items-center gap-2 py-3 px-7 rounded-[10px] bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-sm font-semibold no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]">View pricing</a>
          </div>

        </main>
        <SharedFooter />
      </div>
    </>
  );
}
