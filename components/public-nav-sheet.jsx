"use client";
import { Modal } from "./ui-primitives";
import { ThemeToggle } from "./shared-nav";

// The public site's primary links, in one place so the landing bar, SharedNav
// and the mobile sheet cannot drift apart.
export const PUBLIC_LINKS = [
  { label: "Services", href: "/services", hint: "30+ platforms" },
  { label: "Pricing", href: "/pricing", hint: "per 1,000" },
  { label: "Resellers", href: "/resellers", hint: "wholesale" },
  { label: "Blog", href: "/blog" },
];

/**
 * Full-screen mobile menu. Before this, a phone visitor's nav was Log in and
 * nothing else. Built on Modal so Escape closes it, focus returns to the button
 * that opened it, and the backdrop is a real control.
 */
export function PublicNavSheet({ open, onClose, dark, toggleTheme, onLogin, onSignup, links = PUBLIC_LINKS }) {
  const ink = dark ? "#f4f1ed" : "#1c1b19";
  const muted = "#8a8580";
  const line = dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)";
  return (
    <Modal open={open} onClose={onClose} title="Menu" dark={dark} variant="sheet">
      <div className="flex flex-col flex-1 px-5 pt-4 pb-6" style={{ color: ink }}>
        <div className="flex items-center justify-between h-12">
          <span className="text-[11px] font-semibold uppercase tracking-[.12em]" style={{ color: muted }}>Menu</span>
          <button type="button" onClick={onClose} aria-label="Close menu"
            className="w-10 h-10 rounded-[10px] bg-transparent cursor-pointer text-[20px] leading-none"
            style={{ border: `1px solid ${line}`, color: ink }}>×</button>
        </div>
        <nav aria-label="Primary" className="mt-3 flex flex-col">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={onClose}
              className="flex items-baseline justify-between py-3 no-underline serif"
              style={{ color: ink, borderBottom: `1px solid ${line}`, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 34, fontWeight: 500 }}>
              {l.label}
              {l.hint && <span className="text-[13px]" style={{ color: muted, fontFamily: "Outfit, system-ui, sans-serif" }}>{l.hint}</span>}
            </a>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-3 mb-2"><ThemeToggle dark={dark} onToggle={toggleTheme} /><span className="text-[14px] font-medium">{dark ? "Dark mode" : "Light mode"}</span></div>
        {onSignup
          ? <button type="button" onClick={onSignup} className="w-full py-[14px] rounded-xl text-[15px] font-bold border-none cursor-pointer text-white" style={{ background: "#c47d8e", boxShadow: "0 10px 26px rgba(196,125,142,.35)" }}>Create free account</button>
          : <a href="/?signup=1" className="block w-full py-[14px] rounded-xl text-[15px] font-bold text-center text-white no-underline" style={{ background: "#c47d8e", boxShadow: "0 10px 26px rgba(196,125,142,.35)" }}>Create free account</a>}
        {onLogin
          ? <button type="button" onClick={onLogin} className="w-full py-3 rounded-xl text-[15px] font-semibold bg-transparent cursor-pointer mt-2" style={{ border: `1px solid ${line}`, color: ink }}>Log in</button>
          : <a href="/?login=1" className="block w-full py-3 rounded-xl text-[15px] font-semibold text-center no-underline mt-2" style={{ border: `1px solid ${line}`, color: ink }}>Log in</a>}
      </div>
    </Modal>
  );
}
