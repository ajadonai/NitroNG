'use client';
import { useState } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function FAQ() {
  return <ThemeProvider><FAQInner /></ThemeProvider>;
}

function FAQInner() {
  const { dark, t } = useTheme();
  const [open, setOpen] = useState(null);

  const faqs = [
    ["What is Nitro?", "Nitro is Nigeria's fastest SMM panel. We help creators, businesses, and marketers grow their social media presence with real followers, likes, views, and engagement across all major platforms."],
    ["Is Nitro safe to use?", "Yes. We use secure payment gateways and deliver engagement from real accounts. Your social media accounts are never at risk — we only need your public profile link, never your password."],
    ["How fast is delivery?", "Most orders start processing within seconds of payment. Depending on the service, full delivery typically completes within minutes to a few hours."],
    ["What's the minimum deposit?", "You can start with as little as ₦500. There's no minimum per order — once your wallet is funded, you can place orders of any size."],
    ["What payment methods do you accept?", "We accept bank transfers, debit/credit cards, and cryptocurrency. All payments are processed instantly so you can start ordering right away."],
    ["What happens if my order doesn't deliver?", "If an order fails or partially delivers, we'll either refund your wallet or automatically refill the difference at no extra cost. Our support team is available 24/7."],
    ["Do you offer refills?", "Yes. Many of our services include automatic refills. If you lose followers or engagement within the refill period, we'll top them back up for free."],
    ["Which platforms do you support?", "We support Instagram, TikTok, YouTube, Twitter/X, Facebook, Telegram, Spotify, Snapchat, LinkedIn, Pinterest, Twitch, Discord, and more."],
    ["Can I use Nitro for my clients?", "Absolutely. Many digital marketers and agencies use Nitro to manage growth for multiple clients. Our API and bulk pricing make it easy to scale."],
    ["How does the referral program work?", "Share your unique referral code with friends. When they sign up and make their first deposit, both of you earn a bonus credited to your wallets."],
    ["Is there an API?", "Yes. Once you create an account, you can generate an API key from your settings page and integrate Nitro into your own tools or workflows."],
    ["How do I contact support?", "You can reach us 24/7 via the in-app support chat or WhatsApp. We typically respond within minutes."],
  ];

  const accent = "#c47d8e";
  const border = dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.14)";

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Outfit,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav />
        <main className="flex-1 py-12 px-6 pb-20 max-w-[720px] mx-auto w-full">

          {/* Header */}
          <div className="mb-10">
            <span className="text-xs font-semibold tracking-[2px] uppercase block mb-3" style={{ color: accent }}>Support</span>
            <h1 className="text-[clamp(28px,5vw,40px)] font-semibold mb-2 leading-tight" style={{ color: t.text }}>Frequently Asked <span className="serif italic font-medium text-[clamp(32px,5.5vw,44px)]" style={{ color: accent }}>Questions</span></h1>
            <p className="text-[15px] leading-relaxed max-w-[480px]" style={{ color: t.textSoft }}>Everything you need to know about Nitro. Can't find your answer? Hit us up on WhatsApp — we respond in minutes.</p>
          </div>

          {/* FAQ list */}
          <div className="rounded-2xl overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.7)", border: `1px solid ${border}` }}>
            {faqs.map(([q, a], i) => (
              <div key={i} style={{ borderBottom: i < faqs.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}` : undefined }}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center gap-3.5 py-[18px] px-5 bg-none border-none cursor-pointer text-left"
                >
                  <span className="text-[13px] font-semibold min-w-7" style={{ color: open === i ? accent : t.textMuted }}>0{i + 1}</span>
                  <span className="flex-1 text-[15px] font-semibold transition-colors duration-200" style={{ color: open === i ? accent : t.text }}>{q}</span>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{
                    background: open === i ? (dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)") : (dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)")
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={open === i ? accent : t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transition: "transform .3s ease", transform: open === i ? "rotate(180deg)" : "rotate(0)" }}><polyline points="6 9 12 15 18 9" /></svg>
                  </div>
                </button>
                <div className="overflow-hidden" style={{ maxHeight: open === i ? 300 : 0, opacity: open === i ? 1 : 0, transition: "max-height .3s ease, opacity .3s ease", ...(open === i ? { borderLeft: `3px solid ${accent}`, borderTop: `2px solid ${dark ? "rgba(196,125,142,.28)" : "rgba(196,125,142,.24)"}` } : {}) }}>
                  <p className="pr-5 pb-[18px] pl-[62px] text-sm leading-[1.7]" style={{ color: dark ? "#b0aca8" : "#555250" }}>{a}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 p-6 rounded-[14px] text-center" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)", border: `1px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.14)"}` }}>
            <p className="text-[15px] mb-3" style={{ color: t.textSoft }}>Still have questions?</p>
            <a href="/dashboard" className="inline-flex items-center gap-2 py-3 px-7 rounded-[10px] bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-sm font-semibold no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]">Contact support</a>
          </div>

        </main>
        <SharedFooter />
      </div>
    </>
  );
}
