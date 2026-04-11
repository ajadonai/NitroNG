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
  const border = dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)";

  return (
    <>
      <SharedStyles />
      <div style={{ minHeight: "100dvh", background: t.bg, fontFamily: "'Outfit',system-ui,sans-serif", display: "flex", flexDirection: "column" }}>
        <SharedNav />
        <main style={{ flex: 1, padding: "48px 24px 80px", maxWidth: 720, margin: "0 auto", width: "100%" }}>

          {/* Header */}
          <div style={{ marginBottom: 40 }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: accent, display: "block", marginBottom: 12 }}>Support</span>
            <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 600, color: t.text, marginBottom: 8, lineHeight: 1.15 }}>Frequently Asked <span style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", fontWeight: 500, fontSize: "clamp(32px, 5.5vw, 44px)", color: accent }}>Questions</span></h1>
            <p style={{ fontSize: 15, color: t.textSoft, lineHeight: 1.6, maxWidth: 480 }}>Everything you need to know about Nitro. Can't find your answer? Hit us up on WhatsApp — we respond in minutes.</p>
          </div>

          {/* FAQ list */}
          <div style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.7)", borderRadius: 16, border: `1px solid ${border}`, overflow: "hidden" }}>
            {faqs.map(([q, a], i) => (
              <div key={i} style={{ borderBottom: i < faqs.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` : undefined }}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "18px 20px",
                    background: "none", border: "none", cursor: "pointer", textAlign: "left"
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: open === i ? accent : t.textMuted, minWidth: 28 }}>0{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: open === i ? accent : t.text, transition: "color .2s" }}>{q}</span>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    background: open === i ? (dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)") : (dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)")
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={open === i ? accent : t.textMuted} strokeWidth="2" strokeLinecap="round" style={{ transition: "transform .3s ease", transform: open === i ? "rotate(180deg)" : "rotate(0)" }}><polyline points="6 9 12 15 18 9" /></svg>
                  </div>
                </button>
                <div style={{ maxHeight: open === i ? 300 : 0, opacity: open === i ? 1 : 0, overflow: "hidden", transition: "max-height .3s ease, opacity .3s ease" }}>
                  <p style={{ padding: "0 20px 18px 62px", fontSize: 14, lineHeight: 1.7, color: dark ? "#b0aca8" : "#555250" }}>{a}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ marginTop: 40, padding: "24px", borderRadius: 14, background: dark ? "rgba(196,125,142,.04)" : "rgba(196,125,142,.03)", border: `1px solid ${dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.08)"}`, textAlign: "center" }}>
            <p style={{ fontSize: 15, color: t.textSoft, marginBottom: 12 }}>Still have questions?</p>
            <a href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 10, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Contact support</a>
          </div>

        </main>
        <SharedFooter />
      </div>
    </>
  );
}
