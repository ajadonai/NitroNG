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
  const [menuData, setMenuData] = useState(null);
  const [menuLoading, setMenuLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/services/menu");
        if (res.ok) { const data = await res.json(); setMenuData(data); }
      } catch {}
      setMenuLoading(false);
    }
    load();
  }, []);

  // Map API data to per-platform service list
  const allGroups = menuData?.groups || [];

  // Normalize platform name to sidebar ID
  const normalizePlatform = (name) => {
    const map = { "Twitter/X": "twitter", "Apple Music": "applemusic", "SoundCloud": "soundcloud", "OnlyFans": "onlyfans", "TrustPilot": "trustpilot", "Kick": "kick" };
    return map[name] || name.toLowerCase().replace(/[^a-z]/g, "");
  };

  // Count per platform (using normalized key)
  const platformCounts = {};
  allGroups.forEach(g => {
    const key = normalizePlatform(g.platform);
    platformCounts[key] = (platformCounts[key] || 0) + 1;
  });

  const services = allGroups
    .filter(g => normalizePlatform(g.platform) === svcPlatform)
    .filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase()))
    .map(g => ({
      name: g.name,
      ng: g.nigerian,
      tiers: g.tiers.map(tier => ({ t: tier.tier, p: tier.price })),
    }));

  const platInfo = PLATFORMS.find(p => p.id === svcPlatform);
  const totalServices = allGroups.length;

  useEffect(() => { setSearch(""); }, [svcPlatform]);

  return (
    <>
      {/* Header */}
      <div className="svc-header">
        <div className="svc-title" style={{ color: t.text }}>Services</div>
        <div className="svc-subtitle" style={{ color: t.textMuted }}>{menuLoading ? "Loading services..." : `${totalServices} services across ${Object.keys(platformCounts).length} platforms — prices per 1,000`}</div>
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
                const count = platformCounts[p.id] || 0;
                return (
                  <button key={p.id} onClick={() => setSvcPlatform(p.id)} className="no-plat-item" style={{ background: active ? t.navActive : "transparent", color: active ? t.accent : t.textSoft, fontWeight: active ? 600 : 430 }}>
                    <span className="no-plat-item-icon" style={{ opacity: active ? 1 : .5 }}>{p.icon}</span>
                    {p.label}
                    {count > 0 && <span className="m" style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, color: active ? t.accent : t.textMuted, background: active ? (dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)") : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"), padding: "1px 6px", borderRadius: 8, minWidth: 18, textAlign: "center" }}>{count}</span>}
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
                      const count = platformCounts[p.id] || 0;
                      return (
                        <button key={p.id} onClick={() => { setSvcPlatform(p.id); setCatModal(false); }} className="no-cat-item" style={{ borderWidth: act ? 2 : 1, borderStyle: "solid", borderColor: act ? t.accent : t.cardBorder, background: act ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: act ? t.accent : t.text, position: "relative" }}>
                          <span className="no-cat-icon">{p.icon}</span>
                          <span className="no-cat-label">{p.label}</span>
                          {count > 0 && <span className="m" style={{ fontSize: 9, fontWeight: 600, color: act ? t.accent : t.textMuted, position: "absolute", top: 4, right: 6 }}>{count}</span>}
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
            <div style={{ fontSize: 14, fontWeight: 700, color: s.text, marginBottom: 3 }}>{icon} {tier}</div>
            <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.4 }}>{desc}</div>
          </div>
        );
      })}

      <div className="svc-rs-divider" style={{ background: t.sidebarBorder }} />

      {/* CTA */}
      <div className="svc-rs-cta" style={{ background: t.cardBg, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>Ready to order?</div>
        <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>Place your order in seconds.</div>
        <button onClick={() => onOrderNav()} className="svc-rs-cta-btn">Go to New Order →</button>
      </div>
    </>
  );
}
