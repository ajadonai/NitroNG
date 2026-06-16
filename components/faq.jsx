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
    ["What is Nitro?", "Nitro is a content promotion platform built for Nigerian creators, businesses, and marketers. We help you grow your audience with real followers, likes, views, streams, and engagement across 35+ platforms — all priced in Naira."],
    ["Is Nitro safe to use?", "Yes. We never ask for your password or log into your account. All we need is your public profile or post link. Payments are processed through secure gateways."],
    ["Are the followers real people?", "We deliver engagement from real, active accounts — not empty bots. The quality depends on the tier you choose: Premium uses higher-quality accounts with profile pictures, posts, and activity. Standard offers a solid middle ground with refill guarantees. Budget is the cheapest option but may have lower retention."],
    ["Will my account get banned?", "No. We never access your account — all we need is a public link. Engagement is delivered gradually from real accounts, not in sudden spikes that would look suspicious."],
    ["How fast is delivery?", "Most orders start processing within seconds of payment. Full delivery typically completes within minutes to a few hours, depending on the service and quantity."],
    ["What's the minimum deposit?", "₦500. Once your wallet is funded, you can place orders of any size based on the service's minimum quantity."],
    ["How much do services cost?", "Prices vary by platform and tier. Most services offer up to three tiers — Budget, Standard, and Premium — so you can choose the quality and price point that fits. Check the pricing page or dashboard for current rates."],
    ["What payment methods do you accept?", "Bank transfer, debit/credit card, and cryptocurrency (USDT). Card and bank transfer payments are processed instantly. Crypto deposits typically confirm within 5–30 minutes."],
    ["What happens if my order doesn't deliver?", "If an order fails or is cancelled by the provider, your wallet is refunded automatically. If it partially delivers, you're refunded for the undelivered portion. No action needed from you."],
    ["Do you offer refills?", "Yes. Many services include a refill guarantee. If you lose followers or engagement after delivery, you can request a refill from your dashboard at no extra cost — as long as it's within the refill window shown on your order."],
    ["Which platforms do you support?", "Instagram, TikTok, YouTube, Twitter/X, Facebook, Telegram, Threads, Bluesky, Spotify, Audiomack, Boomplay, Apple Music, SoundCloud, Snapchat, LinkedIn, Pinterest, Reddit, Discord, Twitch, Kick, WhatsApp, OnlyFans, Google Reviews, Trustpilot, and more — 35+ platforms in total."],
    ["Can I use Nitro for my clients?", "Absolutely. Many agencies and marketers use Nitro to manage campaigns for multiple clients. Bulk ordering is available from the dashboard."],
    ["How does the referral program work?", "Share your referral code with friends. When they sign up and make their first deposit, both of you earn a bonus credited to your wallets."],
    ["Can I get a cash refund to my bank account?", "No. All refunds are credited to your Nitro wallet balance only — we do not process refunds to bank accounts, cards, or any external payment method. Your wallet balance can be used for any future order."],
    ["Can I cancel an order?", "You can cancel a pending order from your dashboard if it hasn't been sent to our provider yet. Once processing begins, cancellation isn't possible — contact us on WhatsApp if you need help."],
    ["How do I contact support?", "Message us on WhatsApp — we're available 24/7 and typically respond within minutes."],
  ];

  const accent = "#c47d8e";
  const border = dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)";

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav />
        <main className="flex-1 py-12 px-6 pb-20 max-w-[720px] mx-auto w-full">

          {/* Header */}
          <div className="mb-10">
            <span className="text-xs font-semibold tracking-[2px] uppercase block mb-3" style={{ color: accent }}>Support</span>
            <h1 className="text-[clamp(28px,5vw,40px)] font-semibold mb-2 leading-tight" style={{ color: t.text }}>Frequently Asked <span className="serif italic font-medium text-[clamp(32px,5.5vw,44px)]" style={{ color: accent }}>Questions</span></h1>
            <p className="text-[15px] leading-relaxed max-w-[480px]" style={{ color: t.textSoft }}>Everything you need to know about Nitro. Can't find your answer? Hit us up on WhatsApp — we respond in minutes.</p>
          </div>

          {/* FAQ list */}
          <div className="rounded-2xl overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.7)", border: `1px solid ${border}` }}>
            {faqs.map(([q, a], i) => (
              <div key={i} style={{ borderBottom: i < faqs.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}` : undefined }}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center gap-3.5 py-[18px] px-5 bg-none border-none cursor-pointer text-left"
                >
                  <span className="text-[13px] font-semibold min-w-7" style={{ color: open === i ? accent : t.textMuted }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 text-[15px] font-semibold transition-colors duration-200" style={{ color: open === i ? accent : t.text }}>{q}</span>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{
                    background: open === i ? (dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)") : (dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)")
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
            <a href="https://wa.me/2347071656156?text=Hi%20*Nitro*%2C%20I%20need%20help" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 py-3 px-7 rounded-[10px] bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white text-sm font-semibold no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(37,211,102,.31)]"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>Chat on WhatsApp</a>
          </div>

        </main>
        <SharedFooter />
      </div>
    </>
  );
}
