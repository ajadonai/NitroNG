'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function AboutView() {
  return <ThemeProvider><AboutInner /></ThemeProvider>;
}

function AboutInner() {
  const { dark, t } = useTheme();
  const accent = "#c47d8e";
  const border = dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)";
  const cardBg = dark ? "rgba(255,255,255,.06)" : "#fff";
  const softBg = dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)";

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav />
        <main className="flex-1 py-16 px-6 pb-20 max-w-[1100px] mx-auto w-full">

          {/* Hero header */}
          <div className="mb-14 text-center">
            <span className="text-xs font-semibold tracking-[2px] uppercase block mb-3" style={{ color: accent }}>About</span>
            <h1 className="text-[clamp(28px,5vw,44px)] font-semibold mb-4 leading-tight" style={{ color: t.text }}>Built in Lagos, <span className="serif italic font-medium text-[clamp(32px,5.5vw,48px)]" style={{ color: accent }}>for Nigeria</span></h1>
            <p className="text-[15px] leading-[1.7] max-w-[600px] mx-auto" style={{ color: t.textSoft }}>
              Nitro is a registered Nigerian company helping creators and businesses grow their social media presence — with Naira pricing, instant delivery, and real support.
            </p>
          </div>

          {/* Stats strip */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-14">
            {[
              ['50K+', 'Orders delivered'],
              ['2K+', 'Active creators'],
              ['35+', 'Platforms'],
              ['98%', 'Delivery rate'],
            ].map(([num, label]) => (
              <div key={label} className="rounded-2xl p-5 text-center" style={{ background: cardBg, border: `1px solid ${border}` }}>
                <div className="text-2xl font-bold mb-1" style={{ color: accent }}>{num}</div>
                <div className="text-[13px]" style={{ color: t.textMuted }}>{label}</div>
              </div>
            ))}
          </section>

          {/* Two-column content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-14">
            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: t.text }}>What we do</h2>
              <p className="text-[14px] leading-[1.75] mb-4" style={{ color: t.textSoft }}>
                We make social media growth simple. Whether you're a creator trying to hit your first 10,000 followers, a business building credibility online, or a marketer managing multiple brands — Nitro handles the numbers so you can focus on your content.
              </p>
              <p className="text-[14px] leading-[1.75]" style={{ color: t.textSoft }}>
                We support 35+ platforms including Instagram, TikTok, YouTube, X, Facebook, Telegram, and Spotify. Every service is priced in Naira with no dollar conversion, no hidden fees, and no password required — just your public profile link.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3" style={{ color: t.text }}>Why Nitro exists</h2>
              <p className="text-[14px] leading-[1.75] mb-4" style={{ color: t.textSoft }}>
                Most SMM panels are built for a global audience — dollar pricing, international payment gateways that reject Nigerian cards, and support teams in different time zones. We built Nitro because Nigerian creators and businesses deserve a growth tool that works for them.
              </p>
              <p className="text-[14px] leading-[1.75]" style={{ color: t.textSoft }}>
                That means Naira pricing from day one. Bank transfers, Flutterwave, and crypto for payments. Support that responds in minutes, not days. And a clean, modern dashboard that doesn't feel like it was built in 2015.
              </p>
            </section>
          </div>

          {/* How we're different */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-5 text-center" style={{ color: t.text }}>How we're different</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ['Naira-native', 'No dollar conversion. No exchange rate surprises. Every price you see is in Naira.'],
                ['Never need your password', 'We only use your public profile link. Your accounts stay under your control.'],
                ['Refund guarantee', 'If we can\'t deliver, your wallet gets credited instantly. No chasing support for days.'],
                ['Real support', '24/7 in-app chat and WhatsApp. We respond in minutes, not "2-3 business days."'],
                ['Multiple quality tiers', 'Budget, Standard, and Premium options. You choose the quality and price point that fits.'],
                ['Registered business', 'RC 9514845. We\'re a real company, not a WhatsApp-only operation.'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl p-5" style={{ background: softBg, border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}` }}>
                  <div className="text-[14px] font-semibold mb-1.5" style={{ color: t.text }}>{title}</div>
                  <div className="text-[13px] leading-[1.6]" style={{ color: t.textMuted }}>{desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Company details */}
          <section className="mb-14 max-w-[600px] mx-auto">
            <h2 className="text-lg font-semibold mb-4 text-center" style={{ color: t.text }}>Company details</h2>
            <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${border}` }}>
              {[
                ['Registered name', 'The Nitro NG'],
                ['RC number', '9514845'],
                ['Location', 'Lagos, Nigeria'],
                ['Founded', '2025'],
                ['Contact', 'support@nitro.ng'],
              ].map(([label, value], i, arr) => (
                <div key={label} className="flex items-center justify-between py-3.5 px-5" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)"}` : undefined }}>
                  <span className="text-[13px] font-medium" style={{ color: t.textMuted }}>{label}</span>
                  <span className="text-[14px] font-semibold" style={{ color: t.text }}>{value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div className="p-6 rounded-[14px] text-center" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)", border: `1px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.14)"}` }}>
            <p className="text-[15px] mb-1 font-semibold" style={{ color: t.text }}>Ready to grow your socials?</p>
            <p className="text-sm mb-4" style={{ color: t.textSoft }}>Join thousands of Nigerian creators already using Nitro.</p>
            <a href="/signup" className="inline-flex items-center gap-2 py-3 px-7 rounded-[10px] bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-sm font-semibold no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]">Create free account</a>
          </div>

        </main>
        <SharedFooter />
      </div>
    </>
  );
}
