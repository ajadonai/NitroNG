'use client';
import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════ */
/* ═══ PLATFORM DATA                      ═══ */
/* ═══════════════════════════════════════════ */
export const PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg> },
  { id: "tiktok", label: "TikTok", icon: <svg width="13" height="15" viewBox="0 0 448 512" fill="currentColor"><path d="M448 209.91a210.06 210.06 0 01-122.77-39.25v178.72A162.55 162.55 0 11185 188.31v89.89a74.62 74.62 0 1052.23 71.18V0h88a121 121 0 00122.77 121.33z"/></svg> },
  { id: "youtube", label: "YouTube", icon: <svg width="16" height="12" viewBox="0 0 576 512" fill="currentColor"><path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305z"/></svg> },
  { id: "twitter", label: "Twitter / X", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
  { id: "facebook", label: "Facebook", icon: <svg width="9" height="15" viewBox="0 0 320 512" fill="currentColor"><path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z"/></svg> },
  { id: "telegram", label: "Telegram", icon: <svg width="15" height="13" viewBox="0 0 496 512" fill="currentColor"><path d="M248 8C111.033 8 0 119.033 0 256s111.033 248 248 248 248-111.033 248-248S384.967 8 248 8zm114.952 168.66c-3.732 39.215-19.881 134.378-28.1 178.3-3.476 18.584-10.322 24.816-16.948 25.425-14.4 1.326-25.338-9.517-39.287-18.661-21.827-14.308-34.158-23.215-55.346-37.177-24.485-16.135-8.612-25 5.342-39.5 3.652-3.793 67.107-61.51 68.335-66.746.154-.655.3-3.1-1.154-4.384s-3.59-.849-5.135-.5q-3.283.746-104.608 69.142-14.845 10.194-26.894 9.934c-8.855-.191-25.888-5.006-38.551-9.123-15.531-5.048-27.875-7.717-26.8-16.291q.84-6.7 18.45-13.7 108.446-47.248 144.628-62.3c68.872-28.647 83.183-33.623 92.511-33.789 2.052-.034 6.639.474 9.61 2.885a10.452 10.452 0 013.53 6.716 43.765 43.765 0 01.417 9.769z"/></svg> },
  { id: "spotify", label: "Spotify", icon: <svg width="15" height="15" viewBox="0 0 496 512" fill="currentColor"><path d="M248 8C111.1 8 0 119.1 0 256s111.1 248 248 248 248-111.1 248-248S384.9 8 248 8zm100.7 364.9c-4.2 0-6.8-1.3-10.7-3.6-62.4-37.6-135-39.2-206.7-24.5-3.9 1-9 2.6-11.9 2.6-9.7 0-15.8-7.7-15.8-15.8 0-10.3 6.1-15.2 13.6-16.8 81.9-18.1 165.6-16.5 237 26.2 6.1 3.9 9.7 7.4 9.7 16.5s-7.1 15.4-15.2 15.4z"/></svg> },
  { id: "threads", label: "Threads", icon: <svg width="13" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2C8 2 5 5 5 9v6c0 4 3 7 7 7s7-3 7-7V9c0-4-3-7-7-7z"/><path d="M12 8c-1.5 0-3 1-3 3s1.5 3 3 3 3-1 3-3"/></svg> },
  { id: "snapchat", label: "Snapchat", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C9 2 7 4.5 7 7v2c-1 .5-2 1-2 2 0 .8.5 1.3 1 1.5-.3 1.5-1.5 3-3 3.5 0 0 1 2 5 2 0 1 0 2-1 3h10c-1-1-1-2-1-3 4 0 5-2 5-2-1.5-.5-2.7-2-3-3.5.5-.2 1-.7 1-1.5 0-1-1-1.5-2-2V7c0-2.5-2-5-5-5z"/></svg> },
  { id: "linkedin", label: "LinkedIn", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg> },
  { id: "pinterest", label: "Pinterest", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12a4 4 0 118 0c0 3-2 5-4 7"/><line x1="12" y1="12" x2="10" y2="20"/></svg> },
  { id: "twitch", label: "Twitch", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2H3v16h5v4l4-4h5l4-4V2zM11 11V7M16 11V7"/></svg> },
  { id: "discord", label: "Discord", icon: <svg width="15" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a1 1 0 100-2 1 1 0 000 2zM15 12a1 1 0 100-2 1 1 0 000 2z"/><path d="M7.5 7.5c2-1 4.5-1.5 4.5-1.5s2.5.5 4.5 1.5"/><path d="M5 3l3 19h2l1-2h2l1 2h2l3-19"/></svg> },
  { id: "whatsapp", label: "WhatsApp", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg> },
  { id: "audiomack", label: "Audiomack", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
  { id: "boomplay", label: "Boomplay", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg> },
  { id: "soundcloud", label: "SoundCloud", icon: <svg width="15" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 14v-3M4 14V8M7 14V6M10 14V4M13 14V7M16 14V9"/></svg> },
  { id: "applemusic", label: "Apple Music", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
  { id: "clubhouse", label: "Clubhouse", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="4"/><path d="M6 20v-1a6 6 0 0112 0v1"/></svg> },
  { id: "likee", label: "Likee", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> },
  { id: "kwai", label: "Kwai", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
  { id: "rumble", label: "Rumble", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="3"/><polygon points="10 8 16 12 10 16 10 8"/></svg> },
  { id: "vimeo", label: "Vimeo", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> },
  { id: "dailymotion", label: "Dailymotion", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg> },
  { id: "kick", label: "Kick", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v10M12 12l4-5M12 12l4 5"/></svg> },
  { id: "shazam", label: "Shazam", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 8c0 3 6 4 6 8"/><path d="M15 16c0-3-6-4-6-8"/></svg> },
  { id: "google-reviews", label: "Google Reviews", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
  { id: "trustpilot", label: "Trustpilot", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
  { id: "website-traffic", label: "Website Traffic", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg> },
  { id: "seo", label: "SEO", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
  { id: "app-installs", label: "App Installs", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> },
  { id: "email-marketing", label: "Email Mktg", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg> },
  { id: "nft", label: "NFT / Web3", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
  { id: "reddit", label: "Reddit", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="14" r="8"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M9 16c1 1 2.5 1.5 3 1.5s2-.5 3-1.5"/></svg> },
  { id: "quora", label: "Quora", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg> },
  { id: "miscellaneous", label: "Misc", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg> },
];

/* ── Tier styling ── */
const TS = {
  Budget: { bg: "#fef7ed", border: "#e8d5b8", text: "#854F0B", bgD: "#1f1a10", borderD: "#3d3020", label: "💰" },
  Standard: { bg: "#eef4fb", border: "#b8d0e8", text: "#185FA5", bgD: "#101828", borderD: "#1e3050", label: "⚡" },
  Premium: { bg: "#f5eef5", border: "#d4b8d4", text: "#534AB7", bgD: "#1a1028", borderD: "#302050", label: "👑" },
};

const fN = (a) => `₦${Math.abs(a).toLocaleString("en-NG")}`;

/* ═══════════════════════════════════════════ */
/* ═══ ORDER FORM (used in right sidebar   ═══ */
/* ═══ + tablet slide + mobile sheet)      ═══ */
/* ═══════════════════════════════════════════ */
export function OrderForm({ selSvc, selTier, platform, qty, setQty, link, setLink, dark, t, onClose, compact }) {
  const price = selTier ? Math.round((qty / 1000) * selTier.price) : 0;

  return (
    <div style={{ padding: compact ? 16 : 20 }}>
      {onClose && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span className="m" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: t.textMuted }}>Place order</span>
        <button onClick={onClose} style={{ background: "none", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: t.textSoft, fontSize: 14 }}>✕</button>
      </div>}
      {!onClose && <div className="m" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.5, color: t.textMuted, marginBottom: 14 }}>Place order</div>}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 3 }}>Service</div>
        <div style={{ fontSize: compact ? 13 : 15, fontWeight: 600, color: t.text }}>{selSvc?.name}</div>
        {selTier && <div style={{ marginTop: 3, fontSize: 11 }}>
          <span style={{ color: TS[selTier.tier].text, fontWeight: 600 }}>{TS[selTier.tier].label} {selTier.tier}</span>
          <span className="m" style={{ color: t.textMuted }}> · ₦{selTier.price.toLocaleString()}/{selTier.per}</span>
        </div>}
      </div>

      {selTier && <>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: t.textMuted, display: "block", marginBottom: 5 }}>Link</label>
          <input type="text" placeholder={`https://${platform}.com/...`} value={link} onChange={e => setLink(e.target.value)} className="no-order-input" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)", background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 13, outline: "none", fontFamily: "'JetBrains Mono',monospace", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: t.textMuted, display: "block", marginBottom: 5 }}>Quantity</label>
          <input type="number" value={qty} onChange={e => setQty(Math.max(100, Number(e.target.value)))} className="no-order-input" style={{ width: "100%", padding: "10px 12px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)", background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 13, outline: "none", fontFamily: "'JetBrains Mono',monospace", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            {[500, 1000, 2500, 5000, 10000].map(q => (
              <button key={q} onClick={() => setQty(q)} className="m" style={{ flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 10, borderWidth: qty === q ? 1.5 : 1, borderStyle: "solid", borderColor: qty === q ? t.accent : t.cardBorder, background: qty === q ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: qty === q ? t.accent : t.textMuted }}>{q >= 1000 ? `${q / 1000}K` : q}</button>
            ))}
          </div>
        </div>
        <div style={{ background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.02)", borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: t.textMuted }}><span>Rate</span><span className="m">₦{selTier.price.toLocaleString()} / {selTier.per}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: t.textMuted }}><span>Quantity</span><span className="m">{qty.toLocaleString()}</span></div>
          <div style={{ borderTop: `1px solid ${t.cardBorder}`, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.textMuted }}>Total</span>
            <span className="m" style={{ fontSize: 20, fontWeight: 700, color: t.accent }}>₦{price.toLocaleString()}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
          <span className="m" style={{ fontSize: 9, padding: "3px 8px", borderRadius: 16, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, color: t.textMuted }}>refill: {selTier.refill}</span>
          <span className="m" style={{ fontSize: 9, padding: "3px 8px", borderRadius: 16, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, color: t.textMuted }}>speed: {selTier.speed}</span>
        </div>
        <button style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: `linear-gradient(135deg,#c47d8e,#8b5e6b)`, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: link ? 1 : .5 }}>Place Order</button>
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ NEW ORDER PAGE COMPONENT            ═══ */
/* ═══════════════════════════════════════════ */
export default function NewOrderPage({ dark, t, platform, setPlatform, selSvc, setSelSvc, selTier, setSelTier, qty, setQty, link, setLink, catModal, setCatModal }) {
  const [filterType, setFilterType] = useState("all");
  const [slideOpen, setSlideOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  /* TODO: Replace with real API data — fetch services for the active platform */
  const DEMO_SERVICES = {
    instagram: [
      { id: 1, name: "Followers", type: "followers", tiers: [{ tier: "Budget", price: 200, per: "1K", refill: "None", speed: "2-15K/day" }, { tier: "Standard", price: 650, per: "1K", refill: "30 days", speed: "1-5K/day" }, { tier: "Premium", price: 1400, per: "1K", refill: "Lifetime", speed: "500-2K/day" }] },
      { id: 2, name: "Followers — Nigerian 🇳🇬", type: "followers", ng: true, tiers: [{ tier: "Budget", price: 450, per: "1K", refill: "None", speed: "1-3K/day" }, { tier: "Standard", price: 1100, per: "1K", refill: "30 days", speed: "500-2K/day" }] },
      { id: 3, name: "Post Likes", type: "likes", tiers: [{ tier: "Budget", price: 80, per: "1K", refill: "None", speed: "5-20K/day" }, { tier: "Standard", price: 250, per: "1K", refill: "30 days", speed: "2-10K/day" }] },
      { id: 4, name: "Reel / Video Views", type: "views", tiers: [{ tier: "Budget", price: 15, per: "1K", refill: "None", speed: "50-100K/day" }] },
      { id: 5, name: "Story Views", type: "views", tiers: [{ tier: "Standard", price: 30, per: "1K", refill: "None", speed: "10K/day" }] },
      { id: 6, name: "Comments — Custom", type: "comments", tiers: [{ tier: "Standard", price: 8000, per: "1K", refill: "None", speed: "100-500/day" }] },
      { id: 7, name: "Saves", type: "engagement", tiers: [{ tier: "Standard", price: 120, per: "1K", refill: "None", speed: "5K/day" }] },
      { id: 8, name: "Shares", type: "engagement", tiers: [{ tier: "Standard", price: 100, per: "1K", refill: "None", speed: "5K/day" }] },
    ],
  };

  const services = DEMO_SERVICES[platform] || [];
  const types = [...new Set(services.map(s => s.type))];
  const filtered = filterType === "all" ? services : services.filter(s => s.type === filterType);
  const hasOrder = selSvc && selTier;
  const price = selTier ? Math.round((qty / 1000) * selTier.price) : 0;
  const activePlat = PLATFORMS.find(p => p.id === platform);

  useEffect(() => { setSelSvc(null); setSelTier(null); setFilterType("all"); setSlideOpen(false); setSheetOpen(false); }, [platform]);

  const pickService = (svc) => {
    if (selSvc?.id === svc.id) { setSelSvc(null); setSelTier(null); }
    else { setSelSvc(svc); const auto = svc.tiers.length === 1 ? svc.tiers[0] : null; setSelTier(auto); }
  };
  const pickTier = (tier, e) => { e.stopPropagation(); setSelTier(tier); };

  /* ── Tier Cards ── */
  const TierCards = ({ svc }) => (
    <div className="no-tier-grid" style={{ gridTemplateColumns: `repeat(${svc.tiers.length}, 1fr)` }}>
      {svc.tiers.map(tier => {
        const s = TS[tier.tier]; const isSel = selTier?.tier === tier.tier && selSvc?.id === svc.id;
        return (
          <div key={tier.tier} onClick={e => pickTier(tier, e)} className="no-tier-card" style={{ borderWidth: isSel ? 2 : 1, borderStyle: "solid", borderColor: isSel ? s.text : (dark ? s.borderD : s.border), background: isSel ? (dark ? s.bgD : s.bg) : (dark ? "#0e1120" : "#ffffff") }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: s.text }}>{s.label} {tier.tier}</span>
              <span className="m" style={{ fontSize: 12, fontWeight: 700, color: s.text }}>₦{tier.price.toLocaleString()}<span style={{ fontSize: 9, fontWeight: 400 }}>/{tier.per}</span></span>
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>Refill: <strong style={{ color: t.textSoft }}>{tier.refill}</strong> · {tier.speed}</div>
          </div>
        );
      })}
    </div>
  );

  /* ── Service Row ── */
  const ServiceRow = ({ svc }) => {
    const isSel = selSvc?.id === svc.id;
    return (
      <div onClick={() => pickService(svc)} className="no-svc-row" style={{ borderWidth: isSel ? 2 : 1, borderStyle: "solid", borderColor: isSel ? t.accent : t.cardBorder, background: isSel ? (dark ? "#1e1420" : "#fefbfc") : svc.ng ? (dark ? "rgba(30,80,60,.15)" : "#e8f5ee") : t.cardBg }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="no-svc-name" style={{ color: svc.ng ? (dark ? "#5dcaa5" : "#0F6E56") : t.text }}>{svc.name}</span>
          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
            {svc.tiers.map(tier => (
              <span key={tier.tier} className="m no-tier-badge" style={{ background: dark ? TS[tier.tier].bgD : TS[tier.tier].bg, color: TS[tier.tier].text, borderWidth: 1, borderStyle: "solid", borderColor: dark ? TS[tier.tier].borderD : TS[tier.tier].border }}>{tier.tier}</span>
            ))}
          </div>
        </div>
        {isSel && svc.tiers.length > 1 && <TierCards svc={svc} />}
        {isSel && svc.tiers.length === 1 && (
          <div style={{ marginTop: 8, fontSize: 11, color: t.textMuted }}>
            <span className="m" style={{ fontWeight: 600, color: TS[svc.tiers[0].tier].text }}>₦{svc.tiers[0].price.toLocaleString()}/{svc.tiers[0].per}</span> · Refill: {svc.tiers[0].refill} · {svc.tiers[0].speed}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Page header */}
      <div className="no-header">
        <div className="no-title" style={{ color: t.text }}>New Order</div>
        <div className="no-subtitle" style={{ color: t.textMuted }}>Browse services and place your order</div>
      </div>

      {/* Platform selector — tablet/mobile: button that opens grid modal */}
      <div className="no-plat-btn-wrap">
        <button onClick={() => setCatModal(true)} className="no-plat-btn" style={{ borderWidth: 1, borderStyle: "solid", borderColor: t.accent, background: dark ? "#2a1a22" : "#fdf2f4", color: t.accent }}>
          <span style={{ display: "flex", alignItems: "center" }}>{activePlat?.icon}</span>
          {activePlat?.label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto" }}><polyline points="6 9 12 15 18 9" /></svg>
        </button>
      </div>

      {/* Filter pills — hide if ≤1 type */}
      {types.length > 1 && (
        <div className="no-filters">
          {["all", ...types].map(ty => (
            <button key={ty} onClick={() => setFilterType(ty)} className="no-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: filterType === ty ? t.accent : t.cardBorder, background: filterType === ty ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: filterType === ty ? t.accent : t.textMuted }}>{ty}</button>
          ))}
        </div>
      )}

      {/* Service list */}
      <div className="no-svc-list">
        {filtered.map(svc => <ServiceRow key={svc.id} svc={svc} />)}
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: t.textMuted, fontSize: 13 }}>Coming soon.</div>}
      </div>

      {/* Tablet: full-height slide panel (30-40% width) */}
      {slideOpen && hasOrder && <>
        <div onClick={() => setSlideOpen(false)} className="no-slide-overlay" />
        <div className="no-slide-panel" style={{ background: dark ? "#0e1120" : "#ffffff", borderLeft: `1px solid ${t.cardBorder}` }}>
          <OrderForm selSvc={selSvc} selTier={selTier} platform={platform} qty={qty} setQty={setQty} link={link} setLink={setLink} dark={dark} t={t} onClose={() => setSlideOpen(false)} />
        </div>
      </>}

      {/* Mobile + tablet (when slide closed): sticky mini-bar */}
      {hasOrder && !sheetOpen && !slideOpen && (
        <div className="no-minibar" style={{ background: dark ? "rgba(8,11,20,.96)" : "rgba(244,241,237,.96)", borderTop: `1px solid ${t.cardBorder}` }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="no-minibar-name" style={{ color: t.text }}>{selSvc?.name}</div>
            <div style={{ fontSize: 11, marginTop: 1 }}>
              <span style={{ color: TS[selTier.tier].text, fontWeight: 600 }}>{TS[selTier.tier].label} {selTier.tier}</span>
              <span className="m" style={{ color: t.textMuted }}> · ₦{selTier.price.toLocaleString()}/{selTier.per}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span className="m" style={{ fontSize: 16, fontWeight: 700, color: t.accent }}>₦{price.toLocaleString()}</span>
            <button onClick={() => setSheetOpen(true)} className="no-minibar-btn">Order</button>
          </div>
        </div>
      )}

      {/* Mobile: bottom sheet */}
      {sheetOpen && <>
        <div onClick={() => setSheetOpen(false)} className="no-sheet-overlay" />
        <div className="no-sheet" style={{ background: dark ? "#0e1120" : "#ffffff" }}>
          <div className="no-sheet-handle" style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)" }} />
          <OrderForm selSvc={selSvc} selTier={selTier} platform={platform} qty={qty} setQty={setQty} link={link} setLink={setLink} dark={dark} t={t} onClose={() => setSheetOpen(false)} />
        </div>
      </>}

      {/* Category grid modal (tablet/mobile) */}
      {catModal && <>
        <div onClick={() => setCatModal(false)} className="no-cat-overlay" />
        <div className="no-cat-modal" style={{ background: dark ? "#0e1120" : "#ffffff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Select Platform</div>
            <button onClick={() => setCatModal(false)} style={{ width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, display: "flex", alignItems: "center", justifyContent: "center", color: t.textSoft, fontSize: 16, background: "none" }}>✕</button>
          </div>
          <div className="no-cat-grid">
            {PLATFORMS.map(p => {
              const act = platform === p.id;
              return (
                <button key={p.id} onClick={() => { setPlatform(p.id); setCatModal(false); }} className="no-cat-item" style={{ borderWidth: act ? 2 : 1, borderStyle: "solid", borderColor: act ? t.accent : t.cardBorder, background: act ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: act ? t.accent : t.text }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28 }}>{p.icon}</span>
                  <span className="no-cat-label">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </>}
    </>
  );
}
