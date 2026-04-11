'use client';
import { useState, useEffect } from "react";
import { fN } from "../lib/format";

/* ═══════════════════════════════════════════ */
/* ═══ PLATFORM DATA — 35 platforms        ═══ */
/* ═══ Grouped: Social (21) Music (9) Utility (5) */
/* ═══════════════════════════════════════════ */

const svg = (d, w = 15, h = 15, fill = false) => fill
  ? <svg width={w} height={h} viewBox="0 0 24 24" fill="currentColor">{d}</svg>
  : <svg width={w} height={h} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;

export const PLATFORM_GROUPS = [
  { label: "Social Platforms", platforms: [
    { id: "instagram", label: "Instagram", icon: svg(<><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></>) },
    { id: "tiktok", label: "TikTok", icon: <svg width="13" height="15" viewBox="0 0 448 512" fill="currentColor"><path d="M448 209.91a210.06 210.06 0 01-122.77-39.25v178.72A162.55 162.55 0 11185 188.31v89.89a74.62 74.62 0 1052.23 71.18V0h88a121 121 0 00122.77 121.33z"/></svg> },
    { id: "youtube", label: "YouTube", icon: <svg width="16" height="12" viewBox="0 0 576 512" fill="currentColor"><path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305z"/></svg> },
    { id: "facebook", label: "Facebook", icon: <svg width="9" height="15" viewBox="0 0 320 512" fill="currentColor"><path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z"/></svg> },
    { id: "twitter", label: "Twitter / X", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
    { id: "telegram", label: "Telegram", icon: <svg width="15" height="13" viewBox="0 0 496 512" fill="currentColor"><path d="M248 8C111.033 8 0 119.033 0 256s111.033 248 248 248 248-111.033 248-248S384.967 8 248 8zm114.952 168.66c-3.732 39.215-19.881 134.378-28.1 178.3-3.476 18.584-10.322 24.816-16.948 25.425-14.4 1.326-25.338-9.517-39.287-18.661-21.827-14.308-34.158-23.215-55.346-37.177-24.485-16.135-8.612-25 5.342-39.5 3.652-3.793 67.107-61.51 68.335-66.746.154-.655.3-3.1-1.154-4.384s-3.59-.849-5.135-.5q-3.283.746-104.608 69.142-14.845 10.194-26.894 9.934c-8.855-.191-25.888-5.006-38.551-9.123-15.531-5.048-27.875-7.717-26.8-16.291q.84-6.7 18.45-13.7 108.446-47.248 144.628-62.3c68.872-28.647 83.183-33.623 92.511-33.789 2.052-.034 6.639.474 9.61 2.885a10.452 10.452 0 013.53 6.716 43.765 43.765 0 01.417 9.769z"/></svg> },
    { id: "threads", label: "Threads", icon: svg(<><path d="M12 2C8 2 5 5 5 9v6c0 4 3 7 7 7s7-3 7-7V9c0-4-3-7-7-7z"/><path d="M12 8c-1.5 0-3 1-3 3s1.5 3 3 3 3-1 3-3"/></>) },
    { id: "snapchat", label: "Snapchat", icon: svg(<path d="M12 2C9 2 7 4.5 7 7v2c-1 .5-2 1-2 2 0 .8.5 1.3 1 1.5-.3 1.5-1.5 3-3 3.5 0 0 1 2 5 2 0 1 0 2-1 3h10c-1-1-1-2-1-3 4 0 5-2 5-2-1.5-.5-2.7-2-3-3.5.5-.2 1-.7 1-1.5 0-1-1-1.5-2-2V7c0-2.5-2-5-5-5z"/>) },
    { id: "linkedin", label: "LinkedIn", icon: svg(<><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></>, 14, 14) },
    { id: "pinterest", label: "Pinterest", icon: svg(<><circle cx="12" cy="12" r="10"/><path d="M8 12a4 4 0 118 0c0 3-2 5-4 7"/><line x1="12" y1="12" x2="10" y2="20"/></>, 14, 14) },
    { id: "reddit", label: "Reddit", icon: svg(<><circle cx="12" cy="14" r="8"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M9 16c1 1 2.5 1.5 3 1.5s2-.5 3-1.5"/></>, 14, 14) },
    { id: "discord", label: "Discord", icon: svg(<><path d="M9 12a1 1 0 100-2 1 1 0 000 2zM15 12a1 1 0 100-2 1 1 0 000 2z"/><path d="M5 3l3 19h2l1-2h2l1 2h2l3-19"/></>) },
    { id: "whatsapp", label: "WhatsApp", icon: svg(<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>) },
    { id: "twitch", label: "Twitch", icon: svg(<path d="M21 2H3v16h5v4l4-4h5l4-4V2zM11 11V7M16 11V7"/>, 14, 14) },
    { id: "kick", label: "Kick", icon: svg(<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 7v10M12 12l4-5M12 12l4 5"/></>, 14, 14) },
    { id: "tumblr", label: "Tumblr", icon: svg(<path d="M14.5 2h-5v5.5H7V11h2.5v5c0 3 2 4.5 5.5 4.5V17c-1.5 0-2.5-.5-2.5-2v-4H15V7.5h-2.5V2z"/>, 12, 15) },
    { id: "quora", label: "Quora", icon: svg(<><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></>, 14, 14) },
    { id: "onlyfans", label: "OnlyFans", icon: svg(<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></>, 14, 14) },
    { id: "clubhouse", label: "Clubhouse", icon: svg(<><circle cx="12" cy="10" r="4"/><path d="M6 20v-1a6 6 0 0112 0v1"/></>, 14, 14) },
    { id: "kwai", label: "Kwai", icon: svg(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>, 14, 14) },
    { id: "vimeo", label: "Vimeo", icon: svg(<polygon points="5 3 19 12 5 21 5 3"/>, 14, 14) },
  ]},
  { label: "Music", platforms: [
    { id: "spotify", label: "Spotify", icon: <svg width="15" height="15" viewBox="0 0 496 512" fill="currentColor"><path d="M248 8C111.1 8 0 119.1 0 256s111.1 248 248 248 248-111.1 248-248S384.9 8 248 8zm100.7 364.9c-4.2 0-6.8-1.3-10.7-3.6-62.4-37.6-135-39.2-206.7-24.5-3.9 1-9 2.6-11.9 2.6-9.7 0-15.8-7.7-15.8-15.8 0-10.3 6.1-15.2 13.6-16.8 81.9-18.1 165.6-16.5 237 26.2 6.1 3.9 9.7 7.4 9.7 16.5s-7.1 15.4-15.2 15.4z"/></svg> },
    { id: "audiomack", label: "Audiomack", icon: svg(<><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>, 14, 14) },
    { id: "boomplay", label: "Boomplay", icon: svg(<><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></>, 14, 14) },
    { id: "applemusic", label: "Apple Music", icon: svg(<><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>, 14, 14) },
    { id: "soundcloud", label: "SoundCloud", icon: svg(<><path d="M1 14v-3M4 14V8M7 14V6M10 14V4M13 14V7M16 14V9"/></>, 15, 10) },
    { id: "deezer", label: "Deezer", icon: svg(<><path d="M3 18v-4M7 18v-6M11 18V8M15 18v-6M19 18v-4M21 18v-8"/></>, 14, 14) },
    { id: "tidal", label: "Tidal", icon: svg(<><polygon points="12 2 15 8 12 14 9 8 12 2"/><polygon points="5 10 8 16 5 22 2 16 5 10"/><polygon points="19 10 22 16 19 22 16 16 19 10"/></>, 14, 14) },
    { id: "shazam", label: "Shazam", icon: svg(<><circle cx="12" cy="12" r="10"/><path d="M9 8c0 3 6 4 6 8"/><path d="M15 16c0-3-6-4-6-8"/></>, 14, 14) },
    { id: "mixcloud", label: "Mixcloud", icon: svg(<><circle cx="8" cy="16" r="3"/><circle cx="16" cy="16" r="3"/><path d="M8 13V4l8-2v11"/></>, 14, 14) },
  ]},
  { label: "SEO & Reviews", platforms: [
    { id: "google", label: "Google", icon: svg(<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>, 14, 14) },
    { id: "trustpilot", label: "Trustpilot", icon: svg(<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>, 14, 14) },
    { id: "webtraffic", label: "Web Traffic", icon: svg(<><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></>, 14, 14) },
    { id: "appstore", label: "App Store", icon: svg(<><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></>, 14, 14) },
    { id: "playstore", label: "Play Store", icon: svg(<polygon points="5 3 19 12 5 21 5 3"/>, 14, 14) },
  ]},
];

export const PLATFORMS = PLATFORM_GROUPS.flatMap(g => g.platforms);

const TS = {
  Budget: { bg: "#fef7ed", border: "#e8d5b8", text: "#854F0B", bgD: "#1f1a10", borderD: "#3d3020", label: "💰" },
  Standard: { bg: "#eef4fb", border: "#b8d0e8", text: "#185FA5", bgD: "#101828", borderD: "#1e3050", label: "⚡" },
  Premium: { bg: "#f5eef5", border: "#d4b8d4", text: "#534AB7", bgD: "#1a1028", borderD: "#302050", label: "👑" },
};


/* ═══════════════════════════════════════════ */
/* ═══ ORDER FORM                          ═══ */
/* ═══════════════════════════════════════════ */
export function OrderForm({ selSvc, selTier, platform, qty, setQty, link, setLink, dark, t, onClose, compact, onSubmit, orderLoading, comments, setComments }) {
  const price = selTier ? Math.round((qty / 1000) * selTier.price) : 0;
  const s = selTier ? TS[selTier.tier] : null;
  const minQty = selTier?.min || 100;
  const maxQty = selTier?.max || 50000;

  /* Detect service type from name + type field */
  const svcName = (selSvc?.name || "").toLowerCase();
  const svcType = (selSvc?.type || "").toLowerCase();
  // "Custom Comments" or "Comments" but NOT "Comment Likes"
  const isComment = (svcType.includes("comment") || svcName.includes("comment")) && !svcName.includes("comment like");
  const isMention = svcName.includes("mention");
  // "Poll Votes" but NOT "Upvotes"
  const isPoll = svcName.includes("poll vote") || svcName.includes("poll") && !svcName.includes("upvote");
  // "Reviews (5 Stars)" but NOT "Review Likes"
  const isReview = svcName.includes("review") && !svcName.includes("review like");
  const needsComments = isComment || isReview;
  const needsUsernames = isMention;
  const needsAnswer = isPoll;

  /* Smart link placeholder per platform */
  const placeholders = {
    instagram: "https://instagram.com/username or post URL",
    tiktok: "https://tiktok.com/@username or video URL",
    youtube: "https://youtube.com/watch?v=... or channel URL",
    facebook: "https://facebook.com/page or post URL",
    twitter: "https://x.com/username or tweet URL",
    telegram: "https://t.me/channel or post URL",
    threads: "https://threads.net/@username or post URL",
    snapchat: "https://snapchat.com/add/username",
    linkedin: "https://linkedin.com/in/username or post URL",
    pinterest: "https://pinterest.com/pin/...",
    reddit: "https://reddit.com/r/... or post URL",
    discord: "https://discord.gg/invite-code",
    whatsapp: "https://chat.whatsapp.com/group-link",
    twitch: "https://twitch.tv/username",
    kick: "https://kick.com/username",
    spotify: "https://open.spotify.com/track/... or playlist URL",
    audiomack: "https://audiomack.com/artist/song",
    boomplay: "https://boomplay.com/songs/...",
    applemusic: "https://music.apple.com/album/...",
    soundcloud: "https://soundcloud.com/artist/track",
    deezer: "https://deezer.com/track/...",
    tidal: "https://tidal.com/browse/track/...",
    google: "https://maps.google.com/... or business URL",
    trustpilot: "https://trustpilot.com/review/...",
    webtraffic: "https://yourwebsite.com",
    appstore: "https://apps.apple.com/app/...",
    playstore: "https://play.google.com/store/apps/details?id=...",
  };
  const linkPlaceholder = placeholders[platform] || `https://${platform}.com/...`;
  const linkLabel = platform === "webtraffic" ? "Website URL" : isPoll ? "Post / Poll URL" : "Link";

  return (
    <div className="no-form-inner">
      <div className="no-form-header">
        <span className="m no-form-title" style={{ color: t.textMuted }}>Place order</span>
        {onClose && <button onClick={onClose} className="no-form-close" style={{ borderColor: t.cardBorder, color: t.textSoft }}>✕</button>}
      </div>
      <div className="no-form-service">
        <div className="no-form-svc-name" style={{ color: t.text }}>{selSvc?.name}</div>
        {s && <div className="no-form-tier-info">
          <span style={{ color: s.text, fontWeight: 600 }}>{s.label} {selTier.tier}</span>
          <span style={{ color: t.textMuted }}> · ₦{selTier.price.toLocaleString()}/{selTier.per}</span>
        </div>}
      </div>
      {selTier && <>
        <div className="no-form-field">
          <label className="no-form-label" style={{ color: t.textMuted }}>{linkLabel}</label>
          <input type="text" placeholder={linkPlaceholder} value={link} onChange={e => setLink(e.target.value)} className="m no-form-input" style={{ borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)", background: dark ? "#0d1020" : "#fff", color: t.text }} />
        </div>
        {needsComments && (
          <div className="no-form-field">
            <label className="no-form-label" style={{ color: t.textMuted }}>{isReview ? "Reviews" : "Comments"} <span style={{ fontWeight: 400, fontSize: 11 }}>(one per line)</span></label>
            <textarea placeholder={isReview ? "Great service, highly recommend!\nFast delivery and excellent quality\nBest experience I've had, 5 stars" : "Great content! 🔥\nLove this post!\nAmazing work, keep it up 💯\nThis is fire 🙌"} value={comments || ""} onChange={e => setComments(e.target.value)} rows={4} className="m no-form-input" style={{ borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)", background: dark ? "#0d1020" : "#fff", color: t.text, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: 1.5 }} />
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{(comments || "").split("\n").filter(l => l.trim()).length} {isReview ? "reviews" : "comments"} entered · we'll cycle through them</div>
          </div>
        )}
        {needsUsernames && (
          <div className="no-form-field">
            <label className="no-form-label" style={{ color: t.textMuted }}>Usernames to mention <span style={{ fontWeight: 400, fontSize: 11 }}>(one per line, without @)</span></label>
            <textarea placeholder={"username1\nusername2\nusername3"} value={comments || ""} onChange={e => setComments(e.target.value)} rows={4} className="m no-form-input" style={{ borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)", background: dark ? "#0d1020" : "#fff", color: t.text, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: 1.5 }} />
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>{(comments || "").split("\n").filter(l => l.trim()).length} usernames entered</div>
          </div>
        )}
        {needsAnswer && (
          <div className="no-form-field">
            <label className="no-form-label" style={{ color: t.textMuted }}>Answer option number</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4].map(n => (
                <button key={n} type="button" onClick={() => setComments(String(n))} style={{ flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 14, fontWeight: 600, border: `1px solid ${(comments || "") === String(n) ? t.accent : (dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)")}`, background: (comments || "") === String(n) ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: (comments || "") === String(n) ? t.accent : t.textMuted, cursor: "pointer" }}>Option {n}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>Select which poll answer to vote for</div>
          </div>
        )}
        <div className="no-form-field">
          <label className="no-form-label" style={{ color: t.textMuted }}>Quantity</label>
          <input type="number" value={qty} onChange={e => setQty(Math.max(minQty, Math.min(maxQty, Number(e.target.value))))} className="m no-form-input" style={{ borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.12)", background: dark ? "#0d1020" : "#fff", color: t.text }} />
          <div className="no-form-presets">
            {[500, 1000, 2500, 5000, 10000].map(q => (
              <button key={q} onClick={() => setQty(q)} className="m no-form-preset" style={{ borderColor: qty === q ? t.accent : t.cardBorder, background: qty === q ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: qty === q ? t.accent : t.textMuted }}>{q >= 1000 ? `${q / 1000}K` : q}</button>
            ))}
          </div>
        </div>
        <div className="no-form-summary" style={{ background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.02)", borderColor: t.cardBorder }}>
          <div className="no-form-sum-row" style={{ color: t.textMuted }}><span>Rate</span><span>₦{selTier.price.toLocaleString()} / {selTier.per}</span></div>
          <div className="no-form-sum-row" style={{ color: t.textMuted }}><span>Quantity</span><span>{qty.toLocaleString()}</span></div>
          <div className="no-form-sum-total" style={{ borderColor: t.cardBorder }}>
            <span style={{ color: t.textMuted, fontWeight: 600 }}>Total</span>
            <span className="m no-form-sum-price" style={{ color: t.accent }}>₦{price.toLocaleString()}</span>
          </div>
        </div>
        <div className="no-form-tags">
          <span className="m no-form-tag" style={{ borderColor: t.cardBorder, color: t.textMuted }}>refill: {selTier.refill}</span>
          <span className="m no-form-tag" style={{ borderColor: t.cardBorder, color: t.textMuted }}>speed: {selTier.speed || "Instant"}</span>
        </div>
        <button onClick={onSubmit} disabled={!link || ((needsComments || needsUsernames) && !(comments || "").trim()) || (needsAnswer && !(comments || "").trim()) || orderLoading} className="no-form-submit" style={{ opacity: link && (!(needsComments || needsUsernames || needsAnswer) || (comments || "").trim()) && !orderLoading ? 1 : .5 }}>{orderLoading ? "Placing..." : "Place Order"}</button>
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ NEW ORDER PAGE                      ═══ */
/* ═══════════════════════════════════════════ */
export default function NewOrderPage({ dark, t, user, onOrderSuccess, platform, setPlatform, selSvc, setSelSvc, selTier, setSelTier, qty, setQty, link, setLink, comments, setComments, catModal, setCatModal }) {
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [orderModal, setOrderModal] = useState(false);
  const [menuData, setMenuData] = useState(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  /* Fetch real services from API */
  useEffect(() => {
    async function loadMenu() {
      try {
        const res = await fetch("/api/services/menu");
        if (!res.ok) throw new Error("Failed to load services");
        const data = await res.json();
        setMenuData(data);
      } catch (e) { setMenuError(e.message); }
      setMenuLoading(false);
    }
    loadMenu();
  }, []);

  /* Normalize platform name to sidebar ID */
  const normPlatform = (name) => {
    const map = { "Twitter/X": "twitter", "Apple Music": "applemusic", "SoundCloud": "soundcloud", "OnlyFans": "onlyfans", "TrustPilot": "trustpilot", "Kick": "kick" };
    return map[name] || name.toLowerCase().replace(/[^a-z]/g, "");
  };

  /* Platform counts for sidebar badges */
  const allGroups = menuData?.groups || [];
  const platformCounts = {};
  allGroups.forEach(g => { const k = normPlatform(g.platform); platformCounts[k] = (platformCounts[k] || 0) + 1; });

  /* Map API groups to per-platform service list matching existing shape */
  const services = (() => {
    if (!menuData?.groups) return [];
    return menuData.groups
      .filter(g => normPlatform(g.platform) === platform)
      .filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))
      .map(g => ({
        id: g.id,
        name: g.name,
        type: g.type?.toLowerCase() || "standard",
        ng: g.nigerian,
        tiers: g.tiers.map(tier => ({
          id: tier.id,
          tier: tier.tier,
          price: tier.price,
          per: "1K",
          refill: tier.refill ? "Yes" : "No",
          speed: tier.speed || "0-2 hrs",
          min: tier.min,
          max: tier.max,
        })),
      }));
  })();

  const types = [...new Set(services.map(s => s.type))];
  const filtered = filterType === "all" ? services : services.filter(s => s.type === filterType);
  const hasOrder = selSvc && selTier;
  const price = selTier ? Math.round((qty / 1000) * selTier.price) : 0;
  const activePlat = PLATFORMS.find(p => p.id === platform);

  useEffect(() => { setSelSvc(null); setSelTier(null); setFilterType("all"); setOrderModal(false); setOrderResult(null); setSearch(""); }, [platform]);

  const pickService = (svc) => {
    if (selSvc?.id === svc.id) { setSelSvc(null); setSelTier(null); }
    else { setSelSvc(svc); setSelTier(svc.tiers.length === 1 ? svc.tiers[0] : null); if (svc.tiers.length === 1) setQty(svc.tiers[0].min || 100); }
  };
  const pickTier = (tier, e) => { e.stopPropagation(); setSelTier(tier); setQty(tier.min || 100); };

  /* Place order */
  const submitOrder = async () => {
    if (!selTier?.id || !link || orderLoading) return;
    setOrderLoading(true); setOrderResult(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: selTier.id, link: link.trim(), quantity: qty, ...(comments?.trim() ? { comments: comments.trim() } : {}), serviceType: selSvc?.type || "" }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();
      if (!res.ok) { setOrderResult({ type: "error", message: data.error || "Order failed" }); setOrderLoading(false); return; }
      setOrderResult({ type: "success", message: `Order placed! ${data.order?.id || ""}`, order: data.order });
      setLink(""); setSelSvc(null); setSelTier(null); setOrderModal(false);
      if (onOrderSuccess) onOrderSuccess();
    } catch (err) {
      const msg = err?.name === "TimeoutError" ? "Request timed out. Check your connection." : "Network error. Check your internet and try again.";
      setOrderResult({ type: "error", message: msg });
    }
    setOrderLoading(false);
  };

  const TierCards = ({ svc }) => (
    <div className="no-tier-grid">
      {svc.tiers.map(tier => {
        const s = TS[tier.tier]; const isSel = selTier?.tier === tier.tier && selSvc?.id === svc.id;
        return (
          <div key={tier.tier} onClick={e => pickTier(tier, e)} className="no-tier-card" style={{ borderWidth: 1, borderStyle: "solid", borderColor: isSel ? s.text : (dark ? s.borderD : s.border), background: isSel ? (dark ? s.bgD : s.bg) : (dark ? "#0e1120" : "#ffffff") }}>
            <div className="no-tier-header">
              <span style={{ fontSize: 14, fontWeight: 600, color: s.text }}>{s.label} {tier.tier}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: s.text }}>₦{tier.price.toLocaleString()}<span style={{ fontSize: 12, fontWeight: 400 }}>/{tier.per}</span></span>
            </div>
            <div className="no-tier-meta" style={{ color: t.textMuted }}>Refill: <strong style={{ color: t.textSoft }}>{tier.refill}</strong> · {tier.speed}</div>
          </div>
        );
      })}
    </div>
  );

  const ServiceRow = ({ svc }) => {
    const isSel = selSvc?.id === svc.id;
    return (
      <div onClick={() => pickService(svc)} className={`no-svc-row${isSel ? " no-svc-expanded" : ""}`} style={{ borderWidth: 1, borderStyle: "solid", borderColor: isSel ? t.accent : t.cardBorder, background: isSel ? (dark ? "#1e1420" : "#fefbfc") : svc.ng ? (dark ? "rgba(30,80,60,.15)" : "#e8f5ee") : t.cardBg, ...(isSel ? { boxShadow: dark ? "0 4px 20px rgba(196,125,142,.15)" : "0 4px 20px rgba(196,125,142,.1)", marginTop: 4, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: t.accent } : {}), opacity: selSvc && !isSel ? (dark ? .45 : .5) : 1 }}>
        <div className="no-svc-header">
          <span className="no-svc-name" style={{ color: svc.ng ? (dark ? "#5dcaa5" : "#0F6E56") : t.text }}>{svc.name}</span>
          <div className="no-svc-badges">
            {svc.tiers.map(tier => (
              <span key={tier.tier} className="m no-tier-badge" style={{ background: dark ? TS[tier.tier].bgD : TS[tier.tier].bg, color: TS[tier.tier].text, borderWidth: 1, borderStyle: "solid", borderColor: dark ? TS[tier.tier].borderD : TS[tier.tier].border }}>{tier.tier}</span>
            ))}
          </div>
        </div>
        {isSel && svc.tiers.length > 1 && <TierCards svc={svc} />}
        {isSel && svc.tiers.length === 1 && (
          <div className="no-svc-single" style={{ color: t.textMuted }}>
            <span style={{ fontWeight: 600, color: TS[svc.tiers[0].tier].text }}>₦{svc.tiers[0].price.toLocaleString()}/{svc.tiers[0].per}</span> · Refill: {svc.tiers[0].refill} · {svc.tiers[0].speed}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="no-header">
        <div className="no-title" style={{ color: t.text }}>Services</div>
        <div className="no-subtitle" style={{ color: t.textMuted }}>{menuData ? `${allGroups.length} services across ${Object.keys(platformCounts).length} platforms — prices per 1,000` : "Loading services..."}</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Order result toast */}
      {orderResult && (
        <div style={{ padding: "10px 16px", borderRadius: 10, marginBottom: 12, background: orderResult.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), border: `1px solid ${orderResult.type === "success" ? (dark ? "rgba(110,231,183,.2)" : "#a7f3d0") : (dark ? "rgba(220,38,38,.2)" : "#fecaca")}`, color: orderResult.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{orderResult.type === "success" ? "✓" : "⚠️"} {orderResult.message}</span>
          <button onClick={() => setOrderResult(null)} style={{ background: "none", color: "inherit", fontSize: 16, border: "none", cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Mobile/tablet guide — hidden on desktop where right sidebar shows it */}
      <div className="no-mobile-guide">
        <MobileGuide dark={dark} t={t} />
      </div>

      {menuLoading && <div style={{ padding: 40, textAlign: "center", color: t.textMuted }}>Loading services...</div>}
      {menuError && <div style={{ padding: 40, textAlign: "center", color: dark ? "#fca5a5" : "#dc2626" }}>{menuError}</div>}

      {!menuLoading && !menuError && <>
      {/* ═══ CONTENT WITH INLINE PLATFORM PICKER ═══ */}
      <div className="no-content-split">

        {/* ── Inline platform sidebar (desktop only) ── */}
        <div className="no-plat-sidebar" style={{ borderRight: `1px solid ${t.cardBorder}` }}>
          {PLATFORM_GROUPS.map(group => (
            <div key={group.label} className="no-plat-group">
              <div className="no-plat-group-label" style={{ color: t.accent }}>{group.label}</div>
              {group.platforms.map(p => {
                const active = platform === p.id;
                const count = platformCounts[p.id] || 0;
                return (
                  <button key={p.id} onClick={() => setPlatform(p.id)} className="no-plat-item" style={{ background: active ? t.navActive : "transparent", color: active ? t.accent : t.textSoft, fontWeight: active ? 600 : 430 }}>
                    <span className="no-plat-item-icon" style={{ opacity: active ? 1 : .5 }}>{p.icon}</span>
                    {p.label}
                    {count > 0 && <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: active ? t.accent : t.textMuted, background: active ? (dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)") : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"), padding: "1px 6px", borderRadius: 8, minWidth: 18, textAlign: "center" }}>{count}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── Service list ── */}
        <div className="no-svc-area">

          {/* Platform selector — tablet/mobile only */}
          <div className="no-plat-btn-wrap">
            <button onClick={() => setCatModal(true)} className="no-plat-btn" style={{ borderWidth: 1, borderStyle: "solid", borderColor: t.accent, background: dark ? "#2a1a22" : "#fdf2f4", color: t.accent }}>
              <span style={{ display: "flex", alignItems: "center" }}>{activePlat?.icon}</span>
              {activePlat?.label}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto" }}><polyline points="6 9 12 15 18 9" /></svg>
            </button>
          </div>

          {types.length > 1 && (
            <div className="no-filters">
              {["all", ...types].map(ty => (
                <button key={ty} onClick={() => setFilterType(ty)} className="no-filter-pill" style={{ borderWidth: 1, borderStyle: "solid", borderColor: filterType === ty ? t.accent : t.cardBorder, background: filterType === ty ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: filterType === ty ? t.accent : t.textMuted }}>{ty}</button>
              ))}
            </div>
          )}

          {/* Search */}
          <input placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 13, outline: "none", marginBottom: 10, fontFamily: "'JetBrains Mono', monospace" }} />

          {/* Platform name + count */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{activePlat?.label}</span>
            <span style={{ fontSize: 13, color: t.textMuted }}>({filtered.length} services)</span>
          </div>

          <div className="no-svc-list">
            {filtered.map(svc => <ServiceRow key={svc.id} svc={svc} />)}
            {filtered.length === 0 && <div className="no-empty" style={{ color: t.textMuted }}>Coming soon.</div>}
          </div>
        </div>
      </div>

      {/* Fixed bottom bar — mobile/tablet */}
      {hasOrder && (
        <div className="no-bottom-bar" style={{ background: dark ? "rgba(8,11,20,.97)" : "rgba(244,241,237,.97)", borderTop: `1px solid ${t.cardBorder}` }}>
          <div className="no-bar-info">
            <div className="no-bar-name" style={{ color: t.text }}>{selSvc?.name}</div>
            <div className="no-bar-tier">
              <span style={{ color: TS[selTier.tier].text, fontWeight: 600 }}>{TS[selTier.tier].label} {selTier.tier}</span>
              <span style={{ color: t.textMuted }}> · ₦{selTier.price.toLocaleString()}/{selTier.per}</span>
            </div>
          </div>
          <div className="no-bar-right">
            <span className="m no-bar-price" style={{ color: t.accent }}>₦{price.toLocaleString()}</span>
            <button onClick={() => setOrderModal(true)} className="no-bar-btn">Order</button>
          </div>
        </div>
      )}

      {/* Order modal — mobile/tablet (fixed, no scroll, no zoom) */}
      {orderModal && hasOrder && (
        <div className="no-modal-overlay" onClick={() => setOrderModal(false)}>
          <div className="no-modal" onClick={e => e.stopPropagation()} style={{ background: dark ? "#0e1120" : "#ffffff", borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
            <OrderForm selSvc={selSvc} selTier={selTier} platform={platform} qty={qty} setQty={setQty} link={link} setLink={setLink} comments={comments} setComments={setComments} dark={dark} t={t} onClose={() => setOrderModal(false)} onSubmit={submitOrder} orderLoading={orderLoading} />
          </div>
        </div>
      )}

      {/* Category modal — mobile/tablet */}
      {catModal && (
        <div className="no-cat-overlay" onClick={() => setCatModal(false)}>
          <div className="no-cat-modal" onClick={e => e.stopPropagation()} style={{ background: dark ? "#0e1120" : "#ffffff" }}>
            <div className="no-cat-header">
              <div className="no-cat-title" style={{ color: t.text }}>Select Platform</div>
              <button onClick={() => setCatModal(false)} className="no-cat-close" style={{ borderColor: t.cardBorder, color: t.textSoft }}>✕</button>
            </div>
            <div className="no-cat-scroll">
              {PLATFORM_GROUPS.map(group => (
                <div key={group.label} className="no-cat-group">
                  <div className="no-cat-group-label" style={{ color: t.textMuted }}>{group.label}</div>
                  <div className="no-cat-grid">
                    {group.platforms.map(p => {
                      const act = platform === p.id;
                      const count = platformCounts[p.id] || 0;
                      return (
                        <button key={p.id} onClick={() => { setPlatform(p.id); setCatModal(false); }} className="no-cat-item" style={{ borderWidth: 1, borderStyle: "solid", borderColor: act ? t.accent : t.cardBorder, background: act ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: act ? t.accent : t.text, position: "relative" }}>
                          <span className="no-cat-icon">{p.icon}</span>
                          <span className="no-cat-label">{p.label}</span>
                          {count > 0 && <span style={{ fontSize: 10, fontWeight: 600, color: act ? t.accent : t.textMuted, position: "absolute", top: 4, right: 6 }}>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </>}
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ MOBILE/TABLET GUIDE                 ═══ */
/* ═══════════════════════════════════════════ */
function MobileGuide({ dark, t }) {
  const [open, setOpen] = useState(false);
  const TS_MINI = { Budget: { icon: "💰", color: "#e0a458" }, Standard: { icon: "⚡", color: "#60a5fa" }, Premium: { icon: "👑", color: "#a78bfa" } };
  return (
    <div style={{ borderRadius: 12, background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)", border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, overflow: "hidden", marginBottom: 12 }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "none", border: "none", cursor: "pointer", color: t.text }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>📖 How Our Services Work</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px", fontSize: 13, lineHeight: 1.7, color: t.textMuted }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {Object.entries(TS_MINI).map(([tier, { icon, color }]) => (
              <span key={tier} style={{ padding: "4px 10px", borderRadius: 6, background: dark ? `${color}15` : `${color}10`, color, fontSize: 13, fontWeight: 600 }}>{icon} {tier}</span>
            ))}
          </div>
          <div style={{ marginBottom: 6 }}><b style={{ color: "#e0a458" }}>Budget</b> — Cheapest. Good for testing.</div>
          <div style={{ marginBottom: 6 }}><b style={{ color: "#60a5fa" }}>Standard</b> — Best value. Refill guarantee.</div>
          <div style={{ marginBottom: 10 }}><b style={{ color: "#a78bfa" }}>Premium</b> — Top quality. Non-drop.</div>
          <div style={{ padding: "8px 10px", borderRadius: 8, background: dark ? "rgba(74,222,128,.05)" : "rgba(22,163,74,.03)", border: `1px solid ${dark ? "rgba(74,222,128,.1)" : "rgba(22,163,74,.06)"}`, marginBottom: 10 }}>
            <span style={{ fontWeight: 600, color: dark ? "#4ade80" : "#16a34a" }}>🇳🇬 Nigerian Services</span>
            <span style={{ marginLeft: 4 }}>— Look for the flag! Local engagement for Naija creators.</span>
          </div>
          <div style={{ fontSize: 12, color: t.textMuted }}>
            <div style={{ marginBottom: 3 }}>• <b style={{ color: t.text }}>Refill</b> = free top-up if count drops</div>
            <div style={{ marginBottom: 3 }}>• <b style={{ color: t.text }}>Start small</b> — test Budget first</div>
            <div>• Set profile to <b style={{ color: t.text }}>public</b> before ordering</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SERVICES RIGHT SIDEBAR              ═══ */
/* ═══════════════════════════════════════════ */
export function ServicesSidebar({ dark, t }) {
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Pricing Guide</div>
      {[
        ["Budget", "💰", "Cheapest. May drop. Good for testing."],
        ["Standard", "⚡", "Best value. Stable with refill guarantee."],
        ["Premium", "👑", "Top quality. Non-drop. Lifetime refill."],
      ].map(([tier, icon, desc]) => {
        const s = TS[tier];
        return (
          <div key={tier} style={{ padding: "10px 12px", borderRadius: 10, background: dark ? s.bgD : s.bg, borderWidth: 1, borderStyle: "solid", borderColor: dark ? s.borderD : s.border, marginBottom: 6 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: s.text, marginBottom: 3 }}>{icon} {tier}</div>
            <div style={{ fontSize: 14, color: t.textMuted, lineHeight: 1.4 }}>{desc}</div>
          </div>
        );
      })}

      {/* Nigerian services callout */}
      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: dark ? "rgba(74,222,128,.05)" : "rgba(22,163,74,.03)", border: `1px solid ${dark ? "rgba(74,222,128,.12)" : "rgba(22,163,74,.08)"}`, marginBottom: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: dark ? "#4ade80" : "#16a34a", marginBottom: 4 }}>🇳🇬 Nigerian Services</div>
        <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5 }}>Look for the 🇳🇬 flag! These target Nigerian audiences — real local engagement for Naija creators and businesses.</div>
      </div>

      {/* Pro tips */}
      <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginTop: 16, marginBottom: 8 }}>Pro Tips</div>
      <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.6 }}>
        <div style={{ marginBottom: 4 }}>• <b style={{ color: t.text }}>Refill</b> = free top-up if count drops</div>
        <div style={{ marginBottom: 4 }}>• <b style={{ color: t.text }}>Start small</b> — test a Budget tier first</div>
        <div style={{ marginBottom: 4 }}>• <b style={{ color: t.text }}>Set profile to public</b> before ordering</div>
        <div>• Don't order same link from multiple providers</div>
      </div>
    </>
  );
}
