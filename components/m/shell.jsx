"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ThemeProvider, useTheme } from "../shared-nav";
import { NitroWordmark } from "../nitro-logo";

const LOGO_SVG = <svg width="11" height="12" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4l.08-4.17c0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v320.862l-.077 12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84h10.97c84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>;

const ICONS = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
  links: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  team: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  commissions: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  payouts: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  more: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>,
};

const SIDEBAR_ITEMS = [
  { key: "dashboard", label: "Dashboard", href: "/m", icon: ICONS.dashboard },
  { key: "links", label: "Tracking Links", href: "/m/links", icon: ICONS.links, chiefOnly: true },
  { key: "team", label: "Team", href: "/m/team", icon: ICONS.team, chiefOnly: true },
  { key: "commissions", label: "Commissions", href: "/m/commissions", icon: ICONS.commissions },
  { key: "payouts", label: "Payouts", href: "/m/payouts", icon: ICONS.payouts },
  { key: "settings", label: "Settings", href: "/m/settings", icon: ICONS.settings },
];

const PAGE_TITLES = { "/m": "Dashboard", "/m/links": "Tracking Links", "/m/team": "Team", "/m/commissions": "Commissions", "/m/payouts": "Payouts", "/m/settings": "Settings" };

function ShellInner({ children, member }) {
  const { dark, toggleTheme, t } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const role = member?.role || "crew";
  const isChief = role === "chief";
  const sidebarItems = SIDEBAR_ITEMS.filter(i => !i.chiefOnly || isChief);
  const title = PAGE_TITLES[pathname] || "Pit Crew";
  const initials = (member?.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => { setMoreOpen(false); }, [pathname]);

  const isActive = (href) => href === "/m" ? pathname === "/m" : pathname.startsWith(href);

  const handleLogout = async () => {
    await fetch("/api/m/auth/logout", { method: "POST" });
    router.push("/m/login");
  };

  const nav = (href) => { router.push(href); setMoreOpen(false); };

  // Bottom nav: core tabs visible, chief-only items go under "More"
  const bottomTabs = [
    { key: "dashboard", label: "Home", href: "/m", icon: ICONS.dashboard },
    { key: "commissions", label: "Earnings", href: "/m/commissions", icon: ICONS.commissions },
    { key: "payouts", label: "Payouts", href: "/m/payouts", icon: ICONS.payouts },
  ];
  const moreItems = [
    ...(isChief ? [
      { key: "links", label: "Tracking Links", href: "/m/links", icon: ICONS.links },
      { key: "team", label: "Team", href: "/m/team", icon: ICONS.team },
    ] : []),
  ];
  const hasMore = moreItems.length > 0;

  return (
    <div className="crew-app" style={{ background: t.bg, color: t.text, minHeight: "100vh" }}>
      {/* ── Desktop/tablet sidebar ── */}
      <aside className="crew-sidebar" style={{ background: t.sidebarBg, borderRight: `1px solid ${t.surfaceBrd}`, backdropFilter: "blur(16px)" }}>
        <div className="px-2 pb-[18px] pt-1">
          <div className="sidebar-text">
            <span className="h-7 px-3 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}><NitroWordmark height={12} color="#fff" /></span>
            <span className="inline-block text-[9.5px] font-semibold tracking-[1.5px] uppercase py-[2px] px-[7px] rounded-md mt-[5px]" style={{ color: t.accent, background: t.accentLight }}>Pit Crew</span>
          </div>
        </div>
        <nav className="flex flex-col gap-[2px] mt-[6px]">
          {sidebarItems.map(item => {
            const active = isActive(item.href);
            return (
              <a key={item.key} href={item.href} onClick={(e) => { e.preventDefault(); nav(item.href); }} className="flex items-center gap-[11px] py-[9px] px-[11px] rounded-[10px] text-[13.5px] font-medium transition-colors duration-150 crew-nav-link" style={{ color: active ? t.text : t.muted, background: active ? t.accentLight : "transparent", borderLeft: `3px solid ${active ? t.accent : "transparent"}` }}>
                <span className="w-[17px] h-[17px] shrink-0 [&>svg]:w-full [&>svg]:h-full">{item.icon}</span>
                <span className="sidebar-text">{item.label}</span>
                {item.chiefOnly && <span className="sidebar-text ml-auto text-[8.5px] font-semibold tracking-[.5px] py-[2px] px-[5px] rounded-[5px]" style={{ color: t.accent, background: t.accentLight }}>CHIEF</span>}
              </a>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-[10px] p-[10px] rounded-xl" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center text-xs font-bold text-white" style={{ background: t.grad }}>{initials}</div>
          <div className="sidebar-text min-w-0">
            <div className="text-[12.5px] font-semibold truncate" style={{ color: t.text }}>{member?.name || "—"}</div>
            <div className="text-[10.5px]" style={{ color: t.muted }}>{isChief ? "Crew Chief" : "Crew"}</div>
          </div>
          <button onClick={handleLogout} className="ml-auto bg-transparent border-none flex cursor-pointer sidebar-text" style={{ color: t.muted }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-col min-w-0">
        {/* Topbar */}
        <div className="h-14 flex items-center justify-between px-6 max-md:px-4 sticky top-0 z-30" style={{ background: dark ? "rgba(9,12,21,.85)" : "rgba(240,237,232,.85)", backdropFilter: "blur(16px)", borderBottom: `1px solid ${t.surfaceBrd}` }}>
          <div className="flex items-center gap-3">
            {/* Mobile: logo instead of hamburger */}
            <div className="crew-mobile-logo">
              <div className="w-[26px] h-[26px] rounded-[7px] flex items-center justify-center" style={{ background: t.grad }}>{LOGO_SVG}</div>
            </div>
            <span className="serif text-[21px] max-md:text-[18px] font-semibold">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Settings icon — mobile only (topbar) */}
            <a href="/m/settings" onClick={(e) => { e.preventDefault(); nav("/m/settings"); }} className="crew-topbar-settings" style={{ color: isActive("/m/settings") ? t.accent : t.muted }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </a>
            <button onClick={toggleTheme} className="w-[44px] h-6 rounded-xl border-none relative cursor-pointer transition-colors duration-300 shrink-0" style={{ background: dark ? t.accent : "rgba(0,0,0,.08)" }}>
              <span className="absolute w-[18px] h-[18px] rounded-full bg-white top-[3px] shadow-[0_1px_4px_rgba(0,0,0,.2)] transition-[left] duration-300" style={{ left: dark ? 23 : 3 }} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 max-md:px-4 py-6 max-w-[1120px] w-full mx-auto flex flex-col gap-[26px] max-md:gap-5 crew-content">
          {children}
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="crew-bottom-nav" style={{ background: dark ? "#0a0e1a" : "#f8f5f1", borderTop: `1.5px solid ${dark ? "rgba(255,255,255,.24)" : "rgba(0,0,0,.24)"}` }}>
        {bottomTabs.map(tab => (
          <button key={tab.key} onClick={() => nav(tab.href)} className="crew-bottom-tab" style={{ color: isActive(tab.href) && !moreOpen ? "#c47d8e" : undefined }}>
            <span className="crew-bottom-icon">{tab.icon}</span>
            <span className="crew-bottom-label" style={{ fontWeight: isActive(tab.href) && !moreOpen ? 600 : 400 }}>{tab.label}</span>
          </button>
        ))}
        {hasMore && (
          <button onClick={() => setMoreOpen(!moreOpen)} className="crew-bottom-tab" style={{ color: moreOpen ? "#c47d8e" : undefined }}>
            <span className="crew-bottom-icon">{ICONS.more}</span>
            <span className="crew-bottom-label" style={{ fontWeight: moreOpen ? 600 : 400 }}>More</span>
          </button>
        )}
      </nav>

      {/* More popup */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-80" onClick={() => setMoreOpen(false)} />
          <div className="fixed bottom-[60px] left-3 right-3 z-90 rounded-xl p-2" style={{ background: dark ? "#131728" : "#fff", border: `1px solid ${t.surfaceBrd}`, boxShadow: "0 -8px 32px rgba(0,0,0,.25)" }}>
            {moreItems.map(item => (
              <button key={item.key} onClick={() => nav(item.href)} className="w-full flex items-center gap-3 py-3 px-3 rounded-lg bg-transparent border-none text-left cursor-pointer" style={{ color: isActive(item.href) ? "#c47d8e" : t.text, background: isActive(item.href) ? t.accentLight : "transparent", fontFamily: "inherit", fontSize: 14, fontWeight: 500 }}>
                <span className="w-[18px] h-[18px] shrink-0 [&>svg]:w-full [&>svg]:h-full">{item.icon}</span>
                {item.label}
              </button>
            ))}
            <div className="mt-1 pt-2" style={{ borderTop: `1px solid ${t.surfaceBrd}` }}>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 py-3 px-3 rounded-lg bg-transparent border-none text-left cursor-pointer" style={{ color: t.red, fontFamily: "inherit", fontSize: 14, fontWeight: 500 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Log Out
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        .crew-app { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
        .crew-sidebar { display: flex; flex-direction: column; padding: 18px 14px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
        .crew-mobile-logo { display: none; }
        .crew-topbar-settings { display: none; }
        .crew-bottom-nav { display: none; }
        .crew-nav-link:hover { color: ${t.soft}; }
        @media (max-width: 1199px) {
          .crew-app { grid-template-columns: 1fr; }
          .crew-sidebar { display: none; }
          .crew-mobile-logo { display: flex; }
          .crew-topbar-settings { display: flex; }
          .crew-bottom-nav {
            display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 90;
            height: 56px; padding: 0 2px; align-items: center;
            -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);
          }
          .crew-content { padding-bottom: 72px !important; }
        }
        .crew-bottom-tab {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
          background: none; border: none; cursor: pointer; padding: 2px 0;
          font-family: inherit; color: ${dark ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.4)"};
        }
        .crew-bottom-icon { height: 22px; display: flex; align-items: center; }
        .crew-bottom-icon svg { width: 20px; height: 20px; stroke: currentColor; }
        .crew-bottom-label { font-size: 10px; letter-spacing: 0.2px; }
      `}</style>
    </div>
  );
}

export default function PortalShell({ children, member }) {
  return (
    <ThemeProvider storageKey="nitro-theme">
      <ShellInner member={member}>{children}</ShellInner>
    </ThemeProvider>
  );
}
