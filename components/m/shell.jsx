"use client";
import { useEffect, useState, createContext, useContext, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ThemeProvider, useTheme } from "../shared-nav";
import { ToastProvider } from "../toast";
import { PIT_CSS, pitVars, initialsOf } from "./kit";

const HeaderActionCtx = createContext(() => {});
export function useHeaderAction(node) {
  const set = useContext(HeaderActionCtx);
  useEffect(() => { set(node); return () => set(null); }, [node, set]);
}

const ICONS = {
  dashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>,
  links: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  team: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  commissions: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  payouts: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
};

const LOGOUT_ICON = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;

// One row per place you can go. Links and Team are the chief's only.
const NAV = [
  { key: "dashboard", label: "Home", dock: "Home", href: "/pit/dashboard", icon: ICONS.dashboard },
  { key: "links", label: "Tracking links", dock: "Links", href: "/pit/links", icon: ICONS.links, chiefOnly: true },
  { key: "team", label: "Team", dock: "Team", href: "/pit/team", icon: ICONS.team, chiefOnly: true },
  { key: "commissions", label: "Commissions", dock: "Commissions", href: "/pit/commissions", icon: ICONS.commissions },
  { key: "payouts", label: "Payouts", dock: "Payouts", href: "/pit/payouts", icon: ICONS.payouts },
  { key: "settings", label: "Settings", dock: "Settings", href: "/pit/settings", icon: ICONS.settings },
];

const TITLES = {
  "/pit/dashboard": "Home",
  "/pit/links": "Tracking links",
  "/pit/team": "Team",
  "/pit/commissions": "Commissions",
  "/pit/payouts": "Payouts",
  "/pit/settings": "Settings",
};

const SUBS = {
  "/pit/dashboard": "What you have earned, and what is coming.",
  "/pit/links": "One link per place you promote. Clicks, sign-ups, money.",
  "/pit/team": "The people under you and what they bring in.",
  "/pit/commissions": "Every naira, where it came from and when it clears.",
  "/pit/payouts": "Move your available balance to your bank.",
  "/pit/settings": "Your account, your bank, your socials.",
};

function ShellInner({ children, member }) {
  const { dark, toggleTheme, t } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const isChief = (member?.role || "crew") === "chief";
  const items = NAV.filter(i => !i.chiefOnly || isChief);
  const title = TITLES[pathname] || "The Pit";
  const subtitle = SUBS[pathname] || "";
  const [headerAction, setHeaderAction] = useState(null);
  const setAction = useCallback((v) => setHeaderAction(v), []);
  useEffect(() => setHeaderAction(null), [pathname]);
  const initials = initialsOf(member?.name);
  const tier = member?.tier ? member.tier.charAt(0).toUpperCase() + member.tier.slice(1) : "";
  const standing = `${isChief ? "Chief" : "Crew"}${tier ? ` · ${tier}` : ""}${member?.commissionRate ? ` ${member.commissionRate}%` : ""}`;

  const isActive = (href) => href === "/pit/dashboard" ? pathname === "/pit/dashboard" : pathname.startsWith(href);

  const handleLogout = async () => {
    await fetch("/api/pit/auth/logout", { method: "POST" });
    router.push("/pit/login");
  };

  const nav = (href) => { router.push(href); };

  // Five tabs on the dock: the chief keeps Settings behind the avatar, the crew
  // has room for it.
  const dock = (isChief ? ["dashboard", "links", "commissions", "payouts", "team"] : ["dashboard", "commissions", "payouts", "settings"])
    .map(k => NAV.find(i => i.key === k));

  const brand = <span className="pt-brand">NITRO<em>The Pit</em></span>;
  const themeBtn = (
    <button type="button" className="pt-icb" onClick={toggleTheme} aria-label="Switch theme">
      {dark
        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>}
    </button>
  );

  return (
    <ToastProvider dark={dark}>
      <div className="pt" style={{ ...pitVars(dark, t), background: t.bg }}>
        <style>{PIT_CSS}</style>
        <div className="pt-top">
          {brand}
          <span className="pt-tops">
            {themeBtn}
            <button type="button" className="pt-icb" onClick={handleLogout} aria-label="Log out">{LOGOUT_ICON}</button>
            <a href="/pit/settings" onClick={(e) => { e.preventDefault(); nav("/pit/settings"); }} className="pt-av">{initials}</a>
          </span>
        </div>
        <div className="pt-wrap">
          <aside className="pt-rail">
            <span className="pt-bhead">{brand}{themeBtn}</span>
            <div className="pt-sec"><span>Earning</span></div>
            {items.map(item => (
              <a
                key={item.key}
                href={item.href}
                onClick={(e) => { e.preventDefault(); nav(item.href); }}
                className={"pt-it" + (isActive(item.href) ? " on" : "")}
              >
                <i>{item.icon}</i>{item.label}
              </a>
            ))}
            <span className="pt-foot">
              <span className="pt-av">{initials}</span>
              <span className="pt-tt"><b>{member?.name}</b><i>{standing}</i></span>
              <button type="button" className="pt-icb" onClick={handleLogout} aria-label="Log out">{LOGOUT_ICON}</button>
            </span>
          </aside>

          <div className="pt-main">
            <div className="pt-head">
              <div>
                <div className="pt-at">{title}</div>
                {subtitle && <div className="pt-as">{subtitle}</div>}
              </div>
              {headerAction}
            </div>

            <HeaderActionCtx.Provider value={setAction}>{children}</HeaderActionCtx.Provider>
          </div>
        </div>

        <nav className="pt-dock">
          {dock.map(tab => (
            <button key={tab.key} type="button" className={"pt-dk" + (isActive(tab.href) ? " on" : "")} onClick={() => nav(tab.href)}>
              <i>{tab.icon}</i>{tab.dock}
            </button>
          ))}
        </nav>
      </div>
    </ToastProvider>
  );
}

export default function PortalShell({ children, member }) {
  return (
    <ThemeProvider storageKey="nitro-theme">
      <ShellInner member={member}>{children}</ShellInner>
    </ThemeProvider>
  );
}
