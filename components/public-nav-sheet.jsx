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

const SHEET_CSS = `
.pns-l{animation:pnsIn .45s cubic-bezier(.2,.7,.2,1) both}
@keyframes pnsIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.pns-dot{animation:pnsPulse 2.2s ease-out infinite}
@keyframes pnsPulse{0%{box-shadow:0 0 0 0 rgba(75,226,132,.35)}80%,100%{box-shadow:0 0 0 6px rgba(75,226,132,0)}}
@media (prefers-reduced-motion:reduce){.pns-l{animation:none}.pns-dot{animation:none}}
`;

/**
 * Full-screen mobile menu — the dark room. The sheet joins the site's dark
 * family (the trailer band, the footer): plum when the site is light, near
 * black navy when it is dark. Built on Modal so Escape closes it, focus
 * returns to the button that opened it, and the backdrop is a real control.
 *
 * Links may carry { sub: true } to step down to the smaller tier (page links
 * vs section links) and { em: "word" } to set that word in the italic rose serif.
 */
export function PublicNavSheet({ open, onClose, dark, toggleTheme, onLogin, onSignup, links = PUBLIC_LINKS, liveCount = null }) {
  return (
    <Modal open={open} onClose={onClose} title="Menu" dark={dark} variant="sheet">
      <style>{SHEET_CSS}</style>
      <div className="relative flex flex-col flex-1 overflow-hidden" style={{ background: dark ? "#050710" : "#2a1a22", color: "#f6ecee" }}>
        {/* grain + glow + ghost wordmark — decoration, not content */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
        <div aria-hidden="true" className="absolute rounded-full pointer-events-none" style={{ top: "-18%", right: "-24%", width: 420, height: 380, background: "rgba(196,125,142,.16)", filter: "blur(100px)" }} />
        <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 font-extrabold leading-none whitespace-nowrap pointer-events-none select-none text-[150px] md:text-[230px]" style={{ bottom: "-.32em", letterSpacing: "-.04em", color: "transparent", WebkitTextStroke: "1px rgba(246,217,222,.08)" }}>NITRO</div>

        <div className="relative z-[2] flex flex-col flex-1 px-6 pt-[18px] pb-[26px] md:px-11 md:pt-[22px] md:pb-8">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center h-7 px-3 rounded-[9px] text-[13px] font-extrabold tracking-[.04em] text-white" style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(246,217,222,.18)" }}>NITRO</span>
            <button type="button" onClick={onClose} aria-label="Close menu"
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center cursor-pointer border-none transition-opacity duration-150 hover:opacity-80"
              style={{ background: "rgba(255,255,255,.1)", color: "#f6ecee" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <nav aria-label="Primary" className="mt-3.5 flex flex-col">
            {links.map((l, i) => (
              <a key={l.href} href={l.href} onClick={onClose}
                className="pns-l flex items-baseline justify-between gap-3 no-underline"
                style={{ animationDelay: `${i * 40}ms`, color: "#f6ecee", padding: l.sub ? "10px 0" : "13px 0", borderBottom: i < links.length - 1 ? "1px solid rgba(246,217,222,.1)" : "none" }}>
                <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500, letterSpacing: "-.5px", lineHeight: 1.05, fontSize: l.sub ? 22 : 36, color: l.sub ? "rgba(246,236,238,.78)" : "#f6ecee" }}>
                  {l.em && l.label.includes(l.em)
                    ? <>{l.label.slice(0, l.label.indexOf(l.em))}<em className="italic" style={{ color: "#e8a0b2" }}>{l.em}</em>{l.label.slice(l.label.indexOf(l.em) + l.em.length)}</>
                    : l.label}
                </span>
                {l.hint && <span className="text-[11.5px] font-semibold whitespace-nowrap" style={{ color: "rgba(246,236,238,.42)", letterSpacing: ".4px", fontFamily: "Outfit, system-ui, sans-serif" }}>{l.hint}</span>}
              </a>
            ))}
          </nav>

          {liveCount != null && (
            <div className="flex items-center gap-2 mt-[18px] text-xs font-bold" style={{ color: "#4be284" }}>
              <i aria-hidden="true" className="pns-dot w-[7px] h-[7px] rounded-full" style={{ background: "#4be284" }} />
              <b className="m">{liveCount}</b>
              <span className="font-medium" style={{ color: "rgba(246,236,238,.5)" }}>orders delivering right now</span>
            </div>
          )}

          <div className="flex-1" />

          <div className="md:max-w-[420px] md:w-full md:mx-auto">
            <div className="flex items-center justify-between mb-3.5 text-[13px]" style={{ color: "rgba(246,236,238,.65)" }}>
              <span>{dark ? "Dark mode" : "Light mode"}</span>
              <ThemeToggle dark={dark} onToggle={toggleTheme} />
            </div>
            {onSignup
              ? <button type="button" onClick={onSignup} className="w-full py-[15px] rounded-full text-[15px] font-extrabold border-none cursor-pointer flex items-center justify-center gap-2" style={{ background: "#fff", color: "#1a1a1a", boxShadow: "0 10px 26px rgba(0,0,0,.25)" }}>🎁 Create free account</button>
              : <a href="/?signup=1" className="w-full py-[15px] rounded-full text-[15px] font-extrabold text-center no-underline flex items-center justify-center gap-2" style={{ background: "#fff", color: "#1a1a1a", boxShadow: "0 10px 26px rgba(0,0,0,.25)" }}>🎁 Create free account</a>}
            {onLogin
              ? <button type="button" onClick={onLogin} className="w-full py-[13px] rounded-full text-sm font-semibold bg-transparent cursor-pointer mt-2.5" style={{ border: "1px solid rgba(246,217,222,.22)", color: "#f6ecee" }}>Log in</button>
              : <a href="/?login=1" className="block w-full py-[13px] rounded-full text-sm font-semibold text-center no-underline mt-2.5" style={{ border: "1px solid rgba(246,217,222,.22)", color: "#f6ecee" }}>Log in</a>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
