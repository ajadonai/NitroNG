"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeProvider, useTheme, ThemeToggle } from "../shared-nav";

// ── Shared frame for the four signed-out Pit pages ──
// login-page owns it; apply, join and reset-password import from here.

const EARN_FACTS = [
  { n: "30–50%", d: "of what your referrals spend on their first deposit" },
  { n: "7 days", d: "from a deposit to money you can withdraw" },
  { n: "Fridays", d: "payouts, straight to your bank" },
];

const STEP_FACTS = [
  { n: "1", d: "Apply and tell us where you will promote" },
  { n: "2", d: "We approve, usually the same day" },
  { n: "3", d: "You get a link and start earning" },
];

const EARN_BLURB = "Nitro's referral crew. Share a link, earn on every deposit it brings, move up a tier as they add up.";
const STEP_BLURB = "Share a link, earn on every deposit it brings.";

function PitBrand({ big }) {
  const { t } = useTheme();
  return (
    <span className="flex flex-col">
      <span className={`font-extrabold leading-none ${big ? "text-[16px] tracking-[3px]" : "text-[13px] tracking-[2.5px]"}`} style={{ color: t.accent }}>NITRO</span>
      <span className={`font-semibold tracking-[.4px] mt-[3px] leading-none ${big ? "text-[11px]" : "text-[10px]"}`} style={{ color: t.textSoft }}>The Pit</span>
    </span>
  );
}

export function PitAuthFrame({ side = "earn", eyebrow, title, sub, children }) {
  const { dark, toggleTheme, t } = useTheme();
  const facts = side === "steps" ? STEP_FACTS : EARN_FACTS;
  const blurb = side === "steps" ? STEP_BLURB : EARN_BLURB;

  return (
    <div className="min-h-screen flex" style={{ background: t.bg }}>
      <aside
        className="max-[899px]:hidden w-[45%] max-w-[560px] shrink-0 flex flex-col justify-center gap-4 px-9 py-10"
        style={{ background: "linear-gradient(150deg, rgba(196,125,142,.14), transparent 60%)", borderRight: `1px solid ${t.surfaceBrd}` }}
      >
        <a href="/" className="no-underline w-fit mb-1"><PitBrand big /></a>
        <p className="text-[15px] leading-[1.6] max-w-[36ch] m-0" style={{ color: t.textSoft }}>{blurb}</p>
        <div className="flex flex-col gap-3 mt-3">
          {facts.map((f) => (
            <div key={f.n} className="flex flex-col pl-3.5" style={{ borderLeft: `2px solid ${t.accent}` }}>
              <b className="text-[17px] font-bold leading-tight" style={{ color: t.text }}>{f.n}</b>
              <span className="text-[13px] leading-snug" style={{ color: t.textSoft }}>{f.d}</span>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 px-6 py-5 max-[899px]:px-5">
          <a href="/" className="no-underline min-[900px]:hidden"><PitBrand /></a>
          <span className="ml-auto"><ThemeToggle dark={dark} onToggle={toggleTheme} /></span>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 pb-12 max-[899px]:px-5">
          <div className="w-full max-w-[400px] flex flex-col">
            {eyebrow ? <span className="text-[10.5px] font-bold uppercase tracking-[1.6px] mb-2" style={{ color: t.accent }}>{eyebrow}</span> : null}
            <h1 className="serif text-[34px] font-semibold m-0 tracking-[-.01em]" style={{ color: t.text }}>{title}</h1>
            {sub ? <p className="text-[13.5px] leading-[1.55] mt-1.5 mb-2" style={{ color: t.textSoft }}>{sub}</p> : null}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export function PitLabel({ children }) {
  const { t } = useTheme();
  return <label className="block text-[10.5px] font-bold uppercase tracking-[1px] mt-4 mb-1.5" style={{ color: t.textSoft }}>{children}</label>;
}

export function PitInput({ className = "", style, onFocus, onBlur, ...rest }) {
  const { t } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...rest}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      className={`w-full h-10 px-3 text-[14px] rounded-[10px] outline-none transition-[border-color] duration-200 ${className}`}
      style={{ background: t.inputBg, border: `1px solid ${focused ? t.accent : t.inputBorder}`, color: t.text, fontFamily: "inherit", ...style }}
    />
  );
}

export function PitTextarea({ className = "", style, onFocus, onBlur, ...rest }) {
  const { t } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      {...rest}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      className={`w-full px-3 py-2.5 text-[14px] rounded-[10px] outline-none resize-none transition-[border-color] duration-200 ${className}`}
      style={{ background: t.inputBg, border: `1px solid ${focused ? t.accent : t.inputBorder}`, color: t.text, fontFamily: "inherit", ...style }}
    />
  );
}

export function PitEye({ shown, onToggle }) {
  const { t } = useTheme();
  return (
    <button type="button" onClick={onToggle} aria-label={shown ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none p-0.5" style={{ color: t.textMuted }}>
      {shown ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      )}
    </button>
  );
}

export function PitButton({ loading, children, className = "", style, ...rest }) {
  const { t } = useTheme();
  return (
    <button
      {...rest}
      className={`w-full h-10 mt-4 rounded-[10px] border-none text-white text-[14px] font-semibold cursor-pointer flex items-center justify-center gap-2 transition-opacity duration-200 ${className}`}
      style={{ background: t.btnPrimary, opacity: loading ? 0.7 : 1, fontFamily: "inherit", ...style }}
    >
      {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-[spin_0.6s_linear_infinite]" /> : null}
      {children}
    </button>
  );
}

export function PitBack({ children, onClick }) {
  const { t } = useTheme();
  return (
    <button type="button" onClick={onClick} className="w-full mt-3 py-1.5 bg-transparent border-none text-[13px] font-medium cursor-pointer" style={{ color: t.textSoft, fontFamily: "inherit" }}>
      {children}
    </button>
  );
}

export function PitError({ children }) {
  const { dark, t } = useTheme();
  if (!children) return null;
  return (
    <div className="mt-4 px-3 py-2.5 rounded-[10px] text-[13px] leading-snug flex items-start gap-2" style={{ background: dark ? "rgba(220,38,38,.12)" : "rgba(220,38,38,.07)", border: "1px solid rgba(220,38,38,.28)", color: t.red }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-px"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      {children}
    </div>
  );
}

export function PitNotice({ children }) {
  const { t } = useTheme();
  if (!children) return null;
  return (
    <div className="mt-4 px-3 py-2.5 rounded-[10px] text-[13px] leading-snug" style={{ background: t.accentLight, border: `1px solid ${t.accent}`, color: t.accent }}>
      {children}
    </div>
  );
}

export function PitFoot({ children }) {
  const { t } = useTheme();
  return <p className="text-[13.5px] text-center mt-5 mb-0" style={{ color: t.textSoft }}>{children}</p>;
}

export function PitLink({ href, onNav, className = "", children }) {
  const { t } = useTheme();
  return (
    <a href={href} onClick={(e) => { e.preventDefault(); onNav(); }} className={`font-semibold no-underline ${className}`} style={{ color: t.accent }}>{children}</a>
  );
}

// ── Sign in ──

function Inner() {
  const { t } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setStatusMsg(""); setLoading(true);
    try {
      const res = await fetch("/api/pit/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/pit/dashboard");
      } else if (data.error === "pending") {
        setStatusMsg("Your application is under review. We'll notify you once approved.");
      } else if (data.error === "rejected") {
        setStatusMsg("Your application was not approved.");
      } else if (data.error === "suspended") {
        setStatusMsg("Your account has been suspended. Contact support.");
      } else {
        setError(data.error || "Login failed");
      }
    } catch { setError("Something went wrong"); }
    setLoading(false);
  };

  return (
    <PitAuthFrame side="earn" title="Welcome back" sub="Sign in to your crew account.">
      <PitError>{error}</PitError>
      <PitNotice>{statusMsg}</PitNotice>

      <form onSubmit={submit} className="flex flex-col">
        <PitLabel>Email</PitLabel>
        <PitInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" autoComplete="email" />

        <PitLabel>Password</PitLabel>
        <div className="relative">
          <PitInput type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter password" className="pr-11" />
          <PitEye shown={showPw} onToggle={() => setShowPw(!showPw)} />
        </div>

        <div className="text-right mt-2">
          <a href="/pit/reset-password" onClick={(e) => { e.preventDefault(); router.push("/pit/reset-password"); }} className="text-[12.5px] font-semibold no-underline" style={{ color: t.accent }}>Forgot password?</a>
        </div>

        <PitButton type="submit" disabled={loading} loading={loading}>{loading ? "Signing in..." : "Sign in"}</PitButton>
      </form>

      <PitFoot>
        Not in the crew yet? <PitLink href="/pit/apply" onNav={() => router.push("/pit/apply")}>Apply</PitLink>
      </PitFoot>
    </PitAuthFrame>
  );
}

export default function LoginPage() {
  return <ThemeProvider storageKey="nitro-theme"><Inner /></ThemeProvider>;
}
