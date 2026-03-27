'use client';
import { useState, useEffect } from "react";
import { PLATFORM_GROUPS, PLATFORMS } from "./new-order";

const fN = (a) => `₦${Math.abs(a).toLocaleString("en-NG")}`;

const TS = {
  Budget: { bg: "#fef7ed", border: "#e8d5b8", text: "#854F0B", bgD: "#1f1a10", borderD: "#3d3020", label: "💰" },
  Standard: { bg: "#eef4fb", border: "#b8d0e8", text: "#185FA5", bgD: "#101828", borderD: "#1e3050", label: "⚡" },
  Premium: { bg: "#f5eef5", border: "#d4b8d4", text: "#534AB7", bgD: "#1a1028", borderD: "#302050", label: "👑" },
};

/* ═══════════════════════════════════════════ */
/* ═══ SERVICES PAGE                       ═══ */
/* ═══════════════════════════════════════════ */
export default function ServicesPage({ dark, t, svcPlatform, setSvcPlatform, onOrderNav, catModal, setCatModal }) {
  const [search, setSearch] = useState("");

  /* TODO: Replace with real API — fetch services for active platform */
  const DEMO = {
    instagram: [
      { name: "Followers — Worldwide", tiers: [{ t: "Budget", p: 200 }, { t: "Standard", p: 650 }, { t: "Premium", p: 1400 }] },
      { name: "Followers — Nigerian 🇳🇬", ng: true, tiers: [{ t: "Budget", p: 450 }, { t: "Standard", p: 1100 }, { t: "Premium", p: 2200 }] },
      { name: "Post Likes", tiers: [{ t: "Budget", p: 80 }, { t: "Standard", p: 250 }, { t: "Premium", p: 600 }] },
      { name: "Post Likes — Nigerian 🇳🇬", ng: true, tiers: [{ t: "Standard", p: 400 }] },
      { name: "Auto Likes", tiers: [{ t: "Standard", p: 3500 }] },
      { name: "Reel/Video Views", tiers: [{ t: "Budget", p: 15 }, { t: "Standard", p: 50 }, { t: "Premium", p: 120 }] },
      { name: "Story Views", tiers: [{ t: "Standard", p: 30 }] },
      { name: "Comments — Random", tiers: [{ t: "Standard", p: 5000 }] },
      { name: "Comments — Custom", tiers: [{ t: "Standard", p: 8000 }] },
      { name: "Comments — Nigerian 🇳🇬", ng: true, tiers: [{ t: "Standard", p: 6000 }] },
      { name: "Comment Likes", tiers: [{ t: "Standard", p: 150 }] },
      { name: "Saves", tiers: [{ t: "Standard", p: 120 }] },
      { name: "Shares", tiers: [{ t: "Standard", p: 100 }] },
      { name: "Profile Visits", tiers: [{ t: "Standard", p: 80 }] },
      { name: "Impressions + Reach", tiers: [{ t: "Standard", p: 20 }] },
      { name: "Reposts", tiers: [{ t: "Standard", p: 90 }] },
    ],
    tiktok: [
      { name: "Followers — Worldwide", tiers: [{ t: "Budget", p: 180 }, { t: "Standard", p: 550 }, { t: "Premium", p: 1200 }] },
      { name: "Followers — Nigerian 🇳🇬", ng: true, tiers: [{ t: "Budget", p: 400 }, { t: "Standard", p: 900 }] },
      { name: "Likes", tiers: [{ t: "Budget", p: 50 }, { t: "Standard", p: 180 }, { t: "Premium", p: 450 }] },
      { name: "Likes — Nigerian 🇳🇬", ng: true, tiers: [{ t: "Standard", p: 200 }] },
      { name: "Views", tiers: [{ t: "Budget", p: 8 }, { t: "Standard", p: 25 }, { t: "Premium", p: 60 }] },
      { name: "Shares", tiers: [{ t: "Standard", p: 80 }] },
      { name: "Saves", tiers: [{ t: "Standard", p: 100 }] },
      { name: "Comments — Random", tiers: [{ t: "Standard", p: 5000 }] },
      { name: "Comments — Custom", tiers: [{ t: "Standard", p: 7500 }] },
      { name: "Comments — Nigerian 🇳🇬", ng: true, tiers: [{ t: "Standard", p: 5500 }] },
      { name: "Comment Likes", tiers: [{ t: "Standard", p: 120 }] },
      { name: "Livestream Viewers", tiers: [{ t: "Standard", p: 300 }] },
      { name: "Livestream Likes", tiers: [{ t: "Standard", p: 200 }] },
    ],
    youtube: [
      { name: "Subscribers", tiers: [{ t: "Budget", p: 800 }, { t: "Standard", p: 1800 }, { t: "Premium", p: 3500 }] },
      { name: "Subscribers — Nigerian 🇳🇬", ng: true, tiers: [{ t: "Standard", p: 2500 }] },
      { name: "Views", tiers: [{ t: "Budget", p: 40 }, { t: "Standard", p: 100 }, { t: "Premium", p: 250 }] },
      { name: "Shorts Views", tiers: [{ t: "Standard", p: 60 }] },
      { name: "AdSense-Safe Views", tiers: [{ t: "Premium", p: 500 }] },
      { name: "Likes", tiers: [{ t: "Budget", p: 60 }, { t: "Standard", p: 180 }, { t: "Premium", p: 400 }] },
      { name: "Comments — Random", tiers: [{ t: "Standard", p: 4000 }] },
      { name: "Comments — Custom", tiers: [{ t: "Standard", p: 7000 }] },
      { name: "Comment Likes", tiers: [{ t: "Standard", p: 100 }] },
      { name: "Watch Time (hours)", tiers: [{ t: "Standard", p: 3000 }] },
      { name: "Shares", tiers: [{ t: "Standard", p: 150 }] },
      { name: "Livestream Views", tiers: [{ t: "Standard", p: 200 }] },
    ],
  };

  const services = (DEMO[svcPlatform] || []).filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()));
  const platInfo = PLATFORMS.find(p => p.id === svcPlatform);
  const totalServices = Object.values(DEMO).reduce((s, arr) => s + arr.length, 0);

  useEffect(() => { setSearch(""); }, [svcPlatform]);

  return (
    <>
      {/* Header */}
      <div className="svc-header">
        <div className="svc-title" style={{ color: t.text }}>Services</div>
        <div className="svc-subtitle" style={{ color: t.textMuted }}>28 social platforms + SEO & reviews — prices per 1,000</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ═══ CONTENT WITH INLINE PLATFORM PICKER ═══ */}
      <div className="no-content-split">

        {/* ── Inline platform sidebar (desktop only) ── */}
        <div className="no-plat-sidebar" style={{ borderRight: `1px solid ${t.cardBorder}` }}>
          {PLATFORM_GROUPS.map(group => (
            <div key={group.label} className="no-plat-group">
              <div className="no-plat-group-label" style={{ color: t.accent }}>{group.label}</div>
              {group.platforms.map(p => {
                const active = svcPlatform === p.id;
                return (
                  <button key={p.id} onClick={() => setSvcPlatform(p.id)} className="no-plat-item" style={{ background: active ? t.navActive : "transparent", color: active ? t.accent : t.textSoft, fontWeight: active ? 600 : 430 }}>
                    <span className="no-plat-item-icon" style={{ opacity: active ? 1 : .5 }}>{p.icon}</span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* ── Service list area ── */}
        <div className="no-svc-area">

          {/* Platform selector — tablet/mobile: button opens grid modal */}
          <div className="svc-plat-btn-wrap">
            <button onClick={() => setCatModal(true)} className="no-plat-btn" style={{ borderWidth: 1, borderStyle: "solid", borderColor: t.accent, background: dark ? "#2a1a22" : "#fdf2f4", color: t.accent }}>
              <span style={{ display: "flex", alignItems: "center" }}>{platInfo?.icon}</span>
              {platInfo?.label}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ marginLeft: "auto" }}><polyline points="6 9 12 15 18 9" /></svg>
            </button>
          </div>

          {/* Search */}
          <input placeholder="Search services..." value={search} onChange={e => setSearch(e.target.value)} className="m svc-search" style={{ borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text }} />

          {/* Platform name + count */}
          <div className="svc-plat-name">
            <span style={{ color: t.text }}>{platInfo?.label || svcPlatform}</span>
            <span className="m" style={{ color: t.textMuted }}>({services.length} services)</span>
          </div>

          {/* Service list */}
          <div className="svc-list" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
            {services.length > 0 ? services.map((svc, i) => (
              <div key={svc.name} className="svc-row" style={{ borderBottom: i < services.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
                <div className="svc-row-name" style={{ color: svc.ng ? (dark ? "#5dcaa5" : "#0F6E56") : t.text }}>{svc.name}</div>
                <div className="svc-row-right">
                  {svc.tiers.map(tier => {
                    const s = TS[tier.t];
                    return (
                      <div key={tier.t} className="m svc-tier-badge" style={{ background: dark ? s.bgD : s.bg, borderWidth: 1, borderStyle: "solid", borderColor: dark ? s.borderD : s.border }}>
                        <span style={{ color: s.text, fontWeight: 600 }}>{s.label}</span>
                        <span className="svc-tier-price" style={{ color: s.text }}>₦{tier.p.toLocaleString()}</span>
                        <span className="svc-tier-per" style={{ color: s.text }}>/1K</span>
                      </div>
                    );
                  })}
                  <button onClick={() => onOrderNav(svcPlatform)} className="svc-order-btn">Order</button>
                </div>
              </div>
            )) : (
              <div className="svc-empty" style={{ color: t.textMuted }}>No services found</div>
            )}
          </div>
        </div>
      </div>

      {/* Category modal — tablet/mobile */}
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
                      const act = svcPlatform === p.id;
                      return (
                        <button key={p.id} onClick={() => { setSvcPlatform(p.id); setCatModal(false); }} className="no-cat-item" style={{ borderWidth: act ? 2 : 1, borderStyle: "solid", borderColor: act ? t.accent : t.cardBorder, background: act ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: act ? t.accent : t.text }}>
                          <span className="no-cat-icon">{p.icon}</span>
                          <span className="no-cat-label">{p.label}</span>
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
    </>
  );
}

/* ═══════════════════════════════════════════ */
/* ═══ SERVICES RIGHT SIDEBAR              ═══ */
/* ═══════════════════════════════════════════ */
export function ServicesSidebar({ dark, t, onOrderNav }) {
  return (
    <>
      {/* Pricing guide */}
      <div className="svc-rs-title" style={{ color: t.textMuted }}>Pricing Guide</div>
      {[
        ["Budget", "💰", "Cheapest. May drop. Good for testing."],
        ["Standard", "⚡", "Best value. Stable with refill guarantee."],
        ["Premium", "👑", "Top quality. Non-drop. Lifetime refill."],
      ].map(([tier, icon, desc]) => {
        const s = TS[tier];
        return (
          <div key={tier} className="svc-rs-tier-card" style={{ background: dark ? s.bgD : s.bg, borderWidth: 1, borderStyle: "solid", borderColor: dark ? s.borderD : s.border }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: s.text, marginBottom: 3 }}>{icon} {tier}</div>
            <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4 }}>{desc}</div>
          </div>
        );
      })}

      <div className="svc-rs-divider" style={{ background: t.sidebarBorder }} />

      {/* CTA */}
      <div className="svc-rs-cta" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 6 }}>Ready to order?</div>
        <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 12 }}>Place your order in seconds.</div>
        <button onClick={() => onOrderNav()} className="svc-rs-cta-btn">Go to New Order →</button>
      </div>
    </>
  );
}
