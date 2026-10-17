'use client';
import { useState, useEffect, useRef } from 'react';
import NitroLoader from './nitro-loader';
import { useT } from './locale';
import { NitroWordmark } from './nitro-logo';
import { DEFAULT_COUNTRY, validatePhone } from '../lib/phone-countries';
import { PhoneField } from './phone-field';
import { useMoney, useLocale } from './locale';
import { MAX_BONUS_NAIRA } from '../lib/welcome-bonus';
import { placeAuthError } from '../lib/auth-errors';
import { suggestEmail } from '../lib/email-typos';
import { useSignupChecks } from './use-signup-checks';
import { Slot, LineMsg, emailState, phoneState, GuestButton } from './auth-messages';
import { OffsetIcon } from "./offset-icons";

function PwStrength({ pw, t }) {
  const tr = useT();
  const checks = [
    pw.length >= 8,
    /[A-Z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ];
  const score = checks.filter(Boolean).length;
  const labels = ['', tr("Weak"), tr("Fair"), tr("Good"), tr("Strong")];
  const colors = ['', '#dc2626', '#d97706', '#2563eb', '#059669'];
  const tooShort = pw.length < 6;
  const label = tooShort ? tr("Too short") : labels[score] || '';
  const color = tooShort ? '#dc2626' : colors[score] || '';
  const fill = tooShort ? 1 : score;

  return (
    <div
      className="min-h-[20px] mb-1"
      style={{ visibility: pw ? 'visible' : 'hidden' }}
    >
      <div className="flex gap-[3px] mb-[3px]">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex-1 h-[3px] rounded-sm transition-[background] duration-300"
            style={{
              background:
                i <= fill ? color : t.inputBorder || '#ddd',
            }}
          />
        ))}
      </div>
      <div
        className="text-[11px] font-medium"
        style={{ color: color || 'transparent' }}
      >
        {label || '\u00A0'}
      </div>
    </div>
  );
}

// Opt-in two-panel shell (landing v3). Desktop: brand panel + the usual card. Mobile: the usual card with a slim brand strip.
function ElevatedShell({ elevated, dark, mode, guest, children }) {
  // The count was typed in as "2,300+" and left there: the real figure is 7.8K,
  // so the modal was understating the site by more than three times to every
  // person deciding whether to sign up. Same endpoint the landing page uses;
  // nothing is shown until it answers, because a wrong number is worse than
  // no number.
  const [creatorCount, setCreatorCount] = useState(null);
  useEffect(() => {
    let dead = false;
    fetch("/api/site-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!dead && d?.stats?.users) setCreatorCount(d.stats.users); })
      .catch(() => {});
    return () => { dead = true; };
  }, []);
  const tr = useT();
  const money = useMoney();
  // Outside the provider (a bare render in a test) this falls back to naira,
  // which is also the right default.
  const { currency } = useLocale() || { currency: 'NGN' };
  if (!elevated) return children;
  return (
    <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[860px] max-md:max-w-[440px] max-h-[90dvh] grid md:grid-cols-[.9fr_1.1fr] rounded-[22px] overflow-hidden animate-[modalRiseIn_.24s_cubic-bezier(.2,.8,.2,1)_both] motion-reduce:animate-none" style={{ border: `1px solid ${dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.14)'}`, boxShadow: '0 30px 80px rgba(0,0,0,.35)' }}>
      <div className="max-md:hidden relative overflow-hidden text-white flex flex-col p-[30px] pb-[26px]" style={{ background: 'linear-gradient(160deg,#c47d8e 0%,#a3586b 55%,#7a3d52 100%)' }}>
        <div className="absolute rounded-full pointer-events-none" style={{ width: 260, height: 260, right: -90, top: -80, background: 'rgba(255,220,200,.35)', filter: 'blur(70px)' }}/>
        <span className="nitro-mark self-start h-7 px-3 inline-flex items-center relative" style={{ background: 'rgba(255,255,255,.16)' }}><NitroWordmark height={12} color="#fff" /></span>
        <h3 className="serif italic font-medium text-[34px] leading-[1.1] mt-auto mb-3 relative">{mode === 'login' ? tr("Welcome back. Let's run it up.") : mode === 'signup' ? tr("Your first push is on us.") : tr("No stress. Let's get you back in.")}</h3>
        <p className="text-[13px] leading-[1.6] relative" style={{ opacity: .86 }}>{mode === 'login' ? tr("Your wallet, your orders and your tiers are exactly where you left them.") : mode === 'signup' ? tr("Tested services, naira prices, delivery in minutes. Account in 30 seconds.") : tr("Tell us the email on the account and we will send a reset link.")}</p>
        <ul className="list-none p-0 m-0 mt-5 flex flex-col gap-2.5 relative">
          {[currency === 'NGN' ? tr("Naira pricing, no FX markup") : tr("Prices shown in your currency"), tr("Starts in under 60 seconds"), tr("Real humans on WhatsApp")].map(x => <li key={x} className="flex gap-2.5 text-[13.5px] items-center"><i className="not-italic w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,.2)' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg></i>{x}</li>)}
        </ul>
        {guest && <GuestButton tr={tr} onClick={guest} className="on-panel relative" />}
        {mode === 'signup' && <div className="mt-5 py-3 px-3.5 rounded-[14px] text-[12.5px] leading-[1.45] relative" style={{ background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.24)' }}><b className="block text-[14px] mb-px">{tr("🎁 Up to")} {money(MAX_BONUS_NAIRA, { round: "down" })} {tr("free promo credit")}</b>{tr("on your first deposit, straight into your wallet.")}</div>}
        <div className="flex items-center gap-2.5 mt-5 pt-4 text-[12.5px] relative" style={{ borderTop: '1px solid rgba(255,255,255,.18)' }}>
          <div className="flex">{[['TM','#e0a458'],['AO','#6ee7b7'],['EN','#a5b4fc'],['BI','#f472b6']].map(([a, c], i) => <i key={a} className="not-italic w-[26px] h-[26px] rounded-full text-[9px] font-extrabold flex items-center justify-center" style={{ background: c, color: '#3b1d27', border: '2px solid #9b5368', marginLeft: i ? -4 : 0 }}>{a}</i>)}</div>
          <span>{creatorCount ? `${creatorCount}+ ` : ""}{tr("creators already here")}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function AuthModal({ dark, t, mode, setMode, onClose, prefill, via, referralCode, resetToken: resetTokenProp, elevated = false, returnTo = "", supportWhatsApp = "", onGuestOrder = null }) {
  const tr = useT();
  const money = useMoney();
  const [method] = useState('email');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [step, setStep] = useState(1);
  const [remember, setRemember] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  // What the line under the button says instead of its usual text:
  // { kind: 'error' | 'success', text, action?: { label, onClick }, net? }.
  const [line, setLine] = useState(null);
  const setError = (text) => setLine(text ? { kind: 'error', text } : null);
  // Which fields are wrong, and why: { first, last, email, phone, password, password2, terms }.
  const [fieldErr, setFieldErr] = useState({});
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  // Set just before switching between log in and sign up from a message, so
  // "Log in instead" arrives with the email already filled in.
  const carryEmail = useRef(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [refCode, setRefCode] = useState(referralCode || '');
  const [agree, setAgree] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [resetToken] = useState(resetTokenProp || '');
  const [resetDone, setResetDone] = useState(false);
  const { emailTaken, emailChecking, phoneTaken, phoneChecking } = useSignupChecks({ active: mode === 'signup', email, phone, country });

  const switchMode = (next) => { carryEmail.current = true; setMode(next); };
  // A message goes the moment the field it is about changes.
  const clearErr = (key) => {
    setFieldErr((f) => (f[key] ? { ...f, [key]: null } : f));
    setLine((l) => (l?.kind === 'error' ? null : l));
  };
  const focusField = (id) => requestAnimationFrame(() => document.getElementById(id)?.focus());
  const guestHere = !!onGuestOrder && (mode === 'login' || mode === 'signup' || (mode === 'forgot' && !forgotSent));
  const startGuest = () => { onClose(); onGuestOrder(); };

  useEffect(() => {
    setAuthLoading(false);
    setError('');
    setFieldErr({});
    setEmailTouched(false);
    setPhoneTouched(false);
    setPw('');
    setPw2('');
    setForgotSent(false);
    setResetDone(false);
    if (mode === 'signup' && prefill) {
      const parts = (prefill.name || '').split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
      setName(prefill.name || '');
      setEmail(prefill.email || '');
      setStep(2);
    } else {
      setStep(1);
      setFirstName('');
      setLastName('');
      setName('');
      if (!carryEmail.current) setEmail('');
      setPhone('');
    }
    carryEmail.current = false;
  }, [mode]);

  const netError = () => setLine({ kind: 'error', net: true, text: tr("Network error. Check your connection and try again.") });

  const handleLogin = async () => {
    setLine(null);
    const errs = {};
    if (!email) errs.email = { code: 'required' };
    if (!pw) errs.password = { code: 'required' };
    if (errs.email || errs.password) {
      setFieldErr(errs);
      focusField(errs.email ? 'login-identity' : 'login-password');
      return;
    }
    setFieldErr({});
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: method === 'email' ? email : (validatePhone(country, phone).e164 || phone),
          password: pw,
          remember,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.banned) {
          window.location.href = '/banned';
          return;
        }
        const place = placeAuthError(data.error);
        if (place.code === 'no-account') {
          setFieldErr({ email: place });
          setLine({ kind: 'error', text: tr("No account uses this email."), action: { label: tr("Sign up free"), onClick: () => switchMode('signup') } });
          focusField('login-identity');
        } else if (place.code === 'wrong-password') {
          setFieldErr({ password: place });
          setLine({ kind: 'error', text: tr("That password doesn't match this account") });
          focusField('login-password');
        } else {
          setError(data.error || tr("Login failed"));
        }
        setAuthLoading(false);
        return;
      }
      // Back to whatever page the session ended on, when the landing page
      // passed one through. Already checked same-origin before it got here.
      window.location.replace(returnTo || '/dashboard');
    } catch (err) {
      console.error('[Login Error]', err);
      netError();
      setAuthLoading(false);
    }
  };

  const handleSignup = async () => {
    setLine(null);
    const errs = {};
    if (!pw) errs.password = { code: 'required' };
    else if (pw.length < 6) errs.password = { code: 'short' };
    if (!pw2) errs.password2 = { code: 'required' };
    else if (pw !== pw2) errs.password2 = { code: 'mismatch' };
    if (!agree) errs.terms = { code: 'required' };
    const firstBad = [['password', 'signup-password'], ['password2', 'signup-confirm'], ['terms', 'signup-terms']].find(([k]) => errs[k]);
    if (firstBad) {
      setFieldErr(errs);
      if (errs.password?.code === 'short') setError(tr("Password must be at least 6 characters"));
      else if (errs.terms && !errs.password && !errs.password2) setError(tr("Tick the box to accept the terms"));
      focusField(firstBad[1]);
      return;
    }
    setFieldErr({});
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          firstName,
          lastName,
          email: method === 'email' ? email : (phoneCheck.e164 || phone),
          password: pw,
          phone: phone || undefined,
          country,
          referralCode: refCode || undefined,
          via: via || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // A problem with something typed on step 1 goes back to step 1, on
        // that field, instead of being announced beside the password.
        const place = placeAuthError(data.error);
        if (place.field === 'email' || place.field === 'phone') {
          setStep(1);
          setFieldErr({ [place.field]: { ...place, text: data.error } });
          focusField(place.field === 'email' ? 'signup-email' : 'signup-phone');
        } else if (place.field === 'name') {
          setStep(1);
          setFieldErr({ first: place, last: place });
          setError(data.error);
          focusField('signup-first');
        } else if (place.field === 'password') {
          setFieldErr({ password: place });
          setError(data.error);
          focusField('signup-password');
        } else {
          setError(data.error || tr("Signup failed"));
        }
        setAuthLoading(false);
        return;
      }
      window.fbq && window.fbq("track", "CompleteRegistration", { content_name: "signup", status: true }, { eventID: data.eventId });
      setTimeout(() => window.location.replace('/dashboard'), 300);
    } catch (err) {
      console.error('[Signup Error]', err);
      netError();
      setAuthLoading(false);
    }
  };

  const handleForgot = async () => {
    setLine(null);
    if (!email) {
      setFieldErr({ email: { code: 'required' } });
      focusField('forgot-email');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || tr("Failed to send reset link"));
        setAuthLoading(false);
        return;
      }
      setForgotSent(true);
      setAuthLoading(false);
    } catch {
      netError();
      setAuthLoading(false);
    }
  };

  const handleReset = async () => {
    setError('');
    if (!pw || pw.length < 6) { setError(tr("Password must be at least 6 characters")); return; }
    if (pw !== pw2) { setError('Passwords do not match'); return; }
    if (!resetToken) { setError(tr("Invalid reset link. Please request a new one.")); return; }
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: pw }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || tr("Reset failed")); setAuthLoading(false); return; }
      setResetDone(true);
      setAuthLoading(false);
      window.history.replaceState({}, '', '/');
    } catch {
      setError(tr("Something went wrong."));
      setAuthLoading(false);
    }
  };

  const validEmail =
    email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const phoneCheck = validatePhone(country, phone);
  const validPhone = phoneCheck.ok;
  const pwMatch = pw2.length > 0 && pw === pw2;
  const pwMismatch = pw2.length > 0 && pw !== pw2;

  const handleSignupDetails = () => {
    setLine(null);
    const errs = {};
    if (!firstName) errs.first = { code: 'required' };
    if (!lastName) errs.last = { code: 'required' };
    if (!email) errs.email = { code: 'required' };
    else if (!validEmail) errs.email = { code: 'invalid' };
    else if (emailTaken) errs.email = { code: 'taken' };
    else if (suggestEmail(email)) errs.email = { code: 'typo', suggestion: suggestEmail(email) };
    if (!validPhone) errs.phone = { code: 'invalid', text: phoneCheck.error };
    else if (phoneTaken) errs.phone = { code: 'taken' };
    const firstBad = [['first', 'signup-first'], ['last', 'signup-last'], ['email', 'signup-email'], ['phone', 'signup-phone']].find(([k]) => errs[k]);
    if (firstBad) {
      setFieldErr(errs);
      setEmailTouched(true);
      setPhoneTouched(true);
      focusField(firstBad[1]);
      return;
    }
    setFieldErr({});
    setName(`${firstName} ${lastName}`);
    setStep(2);
  };

  const { bad: emailBad, slot: emailSlot } = emailState({
    tr, fe: fieldErr.email, email, valid: !!validEmail, touched: emailTouched, taken: emailTaken, checking: emailChecking, suggestion: suggestEmail(email),
    onUseSuggestion: (v) => { setEmail(v); clearErr('email'); },
    onLogin: () => switchMode('login'),
  });
  const { bad: phoneBad, slot: phoneSlot } = phoneState({
    tr, fe: fieldErr.phone, phone, check: phoneCheck, touched: phoneTouched, taken: phoneTaken, checking: phoneChecking, supportWhatsApp,
  });

  const handleAuthSubmit = (event) => {
    event.preventDefault();
    if (authLoading) return;
    if (mode === 'login') return handleLogin();
    if (mode === 'signup' && step === 1) return handleSignupDetails();
    if (mode === 'signup') return handleSignup();
    if (mode === 'forgot' && !forgotSent) return handleForgot();
    if (mode === 'reset' && !resetDone) return handleReset();
  };

  const EyeBtn = ({ show, toggle }) => (
    <button
      onClick={toggle}
      type="button"
      aria-label={show ? tr("Hide password") : tr("Show password")}
      className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent p-0.5"
      style={{ color: t.textMuted }}
    >
      {show ? (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );


  return (
    <div
      onClick={onClose}
      onKeyDown={e=>{if(e.key==='Escape')onClose()}}
      className="fixed inset-0 z-100 backdrop-blur-[4px] flex items-center justify-center p-4 animate-[modalFadeIn_.2s_ease]"
      style={{ background: "rgba(0,0,0,.45)" }}
    >
      <ElevatedShell elevated={elevated} dark={dark} mode={mode} guest={guestHere ? startGuest : null}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'signup' ? tr("Create account") : tr("Log in")}
        onClick={(e) => e.stopPropagation()}
        className={elevated
          ? "auth-card w-full max-h-[90dvh] overflow-y-auto overflow-x-hidden px-8 py-7 max-md:py-6 relative"
          : "auth-card w-full max-w-[440px] max-h-[90dvh] overflow-y-auto overflow-x-hidden rounded-2xl px-8 py-7 max-md:py-6 relative backdrop-blur-[20px] animate-[modalRiseIn_.24s_cubic-bezier(.2,.8,.2,1)_both] motion-reduce:animate-none"}
        style={elevated ? { background: dark ? '#140d1e' : '#fff' } : {
          background: dark ? '#140d1e' : '#fff',
          border: `1px solid ${dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.14)'}`,
          boxShadow: dark
            ? '0 20px 60px rgba(0,0,0,.4)'
            : '0 20px 60px rgba(0,0,0,.1)',
        }}
      >
        {elevated && <div className="md:hidden relative flex items-center justify-center -mt-6 -mx-8 mb-[18px] py-3.5 px-[52px] text-white text-center" style={{ background: 'linear-gradient(135deg,#c47d8e,#a3586b)' }}>
          <span className="text-[12.5px] font-semibold" style={{ opacity: .92 }}>{mode === 'signup' ? `🎁 ${money(MAX_BONUS_NAIRA, { round: "down" })} free credit on your first deposit` : tr("Welcome back")}</span>
          <button
            type="button"
            aria-label={tr("Close authentication dialog")}
            onClick={onClose}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center leading-none text-white transition-opacity duration-150 hover:opacity-80"
            style={{ background: 'rgba(255,255,255,.18)' }}
          >
            <OffsetIcon name="close" size={11} />
          </button>
        </div>}
        {/* Close button — quiet ghost circle; on the elevated phone layout the bar above carries its own close */}
        <button
          type="button"
          aria-label={tr("Close authentication dialog")}
          onClick={onClose}
          className={`auth-close absolute top-3.5 right-3.5 w-8 h-8 rounded-full flex items-center justify-center leading-none transition-opacity duration-150 hover:opacity-70 ${elevated ? 'max-md:hidden' : ''}`}
          style={{
            background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)',
            color: dark ? '#b7b3ad' : '#6d6a66',
          }}
        >
          <OffsetIcon name="close" size={12} />
        </button>

        {/* Heading — on the same left edge as the fields under it, clear of the close button */}
        <div className="mb-[18px]">
        {/* Only the title needs to clear the close button; the line under it runs to the fields' edge */}
        <h2
          className="serif text-[31px] max-md:text-[28px] leading-[1.08] font-semibold mb-1 italic pe-10 max-md:pe-0"
          style={{ color: t.text }}
        >
          {mode === 'login'
            ? tr("Let's run it up")
            : mode === 'forgot'
              ? 'Forgot password?'
              : mode === 'reset'
                ? tr("Reset password")
                : step === 1
                  ? tr("Create account")
                  : tr("Secure your account")}
        </h2>

        {/* Subheading */}
        <p
          className="text-[14.5px] flex items-baseline justify-between gap-3"
          style={{ color: t.textSoft }}
        >
          <span>{mode === 'login'
            ? tr("Log in and start boosting")
            : mode === 'forgot'
              ? forgotSent
                ? tr("Check your email")
                : tr("Enter your email for reset link")
              : mode === 'reset'
                ? resetDone
                  ? tr("You are all set")
                  : tr("Choose a new password")
                : step === 1
                  ? tr("Your details")
                  : tr("Set your password")}</span>
          {/* Which step, on the subtitle's own line so it costs no extra row */}
          {mode === 'signup' && <span className="text-[11.5px] font-semibold whitespace-nowrap" style={{ color: t.textMuted }}>{step === 1 ? tr("Step 1 of 2") : tr("Step 2 of 2")}</span>}
        </p>

        {/* Which sign up step — a bar under the heading, where it is seen, rather than dots under the last button */}
        {mode === 'signup' && (
          <div className="grid grid-cols-2 gap-1 mt-2.5">
            <i className="block h-[3px] rounded-sm" style={{ background: t.accent }} />
            <i className="block h-[3px] rounded-sm transition-[background] duration-300" style={{ background: step === 2 ? t.accent : 'var(--auth-field-line)' }} />
          </div>
        )}
        </div>

        {/* No error box here any more. Messages sit on their field or on the
            line under the button, so a problem never makes the card taller. */}
        <form onSubmit={handleAuthSubmit} noValidate>

        {/* ====== LOGIN MODE ====== */}
        {mode === 'login' && (
          <>
            {/* Google button */}
            <button
              type="button"
              onClick={() => {
                setError('');
                setAuthLoading(true);
                { const gp = new URLSearchParams(); if (refCode) gp.set('ref', refCode); if (via) gp.set('via', via); window.location.href = `/api/auth/google${gp.size ? `?${gp}` : ''}`; }
              }}
              className="google-btn w-full h-11 rounded-xl flex items-center justify-center gap-2.5 text-[15px] font-semibold mb-0 transition-[color,transform] duration-200 hover:-translate-y-px"
              style={{
                background: dark ? 'rgba(255,255,255,.09)' : '#fff',
                border: `1px solid ${dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.19)'}`,
                color: dark ? '#eae7e2' : '#333',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {tr("Continue with Google")}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3.5 my-3">
              <div
                className="flex-1 h-px"
                style={{
                  background: dark
                    ? 'rgba(255,255,255,.12)'
                    : 'rgba(0,0,0,.08)',
                }}
              />
              <span
                className="text-[12px] font-medium"
                style={{ color: t.textMuted }}
              >
                {tr("or")}
              </span>
              <div
                className="flex-1 h-px"
                style={{
                  background: dark
                    ? 'rgba(255,255,255,.12)'
                    : 'rgba(0,0,0,.08)',
                }}
              />
            </div>

            {/* Email / Phone input */}
            <div className={`auth-box mb-4${method === 'email' ? '' : ' auth-tel'}`}>
            <label htmlFor="login-identity">
              {method === 'email' ? tr("Email address") : tr("Phone Number")}
            </label>
            {method === 'email' ? (
              <input
                id="login-identity"
                name="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value.trim().toLowerCase().slice(0, 254));
                  clearErr('email');
                }}
                placeholder={fieldErr.email?.code === 'required' ? tr("Required") : "you@example.com"}
                type="email"
                autoComplete="email"
                aria-invalid={!!fieldErr.email}
                className={`auth-in${fieldErr.email ? ' is-bad' : ''}`}
              />
            ) : (
              <PhoneField id="login-identity" country={country} onCountry={setCountry} value={phone} onValue={setPhone} t={t} dark={dark} boxed />
            )}
            </div>

            {/* Password */}
            <div className="auth-box mb-4">
              <label htmlFor="login-password">{tr("Password")}</label>
              <input
                id="login-password"
                name="password"
                value={pw}
                onChange={(e) => { setPw(e.target.value.slice(0, 128)); clearErr('password'); }}
                placeholder={fieldErr.password?.code === 'required' ? tr("Required") : tr("Enter password")}
                aria-invalid={!!fieldErr.password}
                maxLength={128}
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                className={`auth-in has-eye${fieldErr.password ? ' is-bad' : ''}`}
              />
              <EyeBtn show={showPw} toggle={() => setShowPw(!showPw)} />
            </div>

            {/* Remember me + Forgot */}
            <div className="flex justify-between items-center mb-5">
              <label htmlFor="login-remember" className="flex items-center gap-2 cursor-pointer">
                <input
                  id="login-remember"
                  name="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-[15px] h-[15px]"
                  style={{ accentColor: t.accent }}
                />
                <span
                  className="text-[13px]"
                  style={{ color: t.textSoft }}
                >
                  {tr("Remember me")}
                </span>
              </label>
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="bg-transparent text-[13px] font-medium"
                style={{ color: "var(--t-accent-ink)" }}
              >
                {tr("Forgot password?")}
              </button>
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full h-[50px] rounded-[14px] text-white text-[15.5px] font-bold mb-5 flex items-center justify-center gap-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]"
              style={{
                background: authLoading ? '#999' : t.btnPrimary,
                opacity: authLoading ? 0.7 : 1,
              }}
            >
              {authLoading && (
                <NitroLoader size={16} mono ariaHidden />
              )}
              {authLoading ? tr("Logging in...") : tr("Log in")}
            </button>

            {/* Switch to signup — or, when something went wrong, what it was */}
            <div
              className="text-center text-sm"
              style={{ color: t.textSoft }}
            >
              {line ? <LineMsg line={line} /> : <>
              {tr("Don't have an account?")}{' '}
              <button
                type="button"
                onClick={() => setMode('signup')}
                className="bg-transparent font-semibold text-sm"
                style={{ color: "var(--t-accent-ink)" }}
              >
                {tr("Sign up free")}
              </button>
              </>}
            </div>
          </>
        )}

        {/* Both sign up steps are drawn in one grid cell and only the current one is
            shown, so the card is always as tall as the taller step and does not
            change size between them. The hidden step is inert, and its main button
            is not a submit, so Enter always submits the step on screen. */}
        {mode === 'signup' && (
        <div className="grid">

        {/* ====== SIGNUP STEP 1 ====== */}
          <div className="[grid-area:1/1] flex flex-col min-w-0" inert={step !== 1} style={step !== 1 ? { visibility: 'hidden' } : undefined}>
            {/* Google button */}
            <button
              type="button"
              onClick={() => {
                setError('');
                { const gp = new URLSearchParams(); if (refCode) gp.set('ref', refCode); if (via) gp.set('via', via); window.location.href = `/api/auth/google${gp.size ? `?${gp}` : ''}`; }
              }}
              className="google-btn w-full h-11 rounded-xl flex items-center justify-center gap-2.5 text-[15px] font-semibold mb-0 transition-[color,transform] duration-200 hover:-translate-y-px"
              style={{
                background: dark ? 'rgba(255,255,255,.09)' : '#fff',
                border: `1px solid ${dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.19)'}`,
                color: dark ? '#eae7e2' : '#333',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {tr("Sign up with Google")}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3.5 my-3">
              <div
                className="flex-1 h-px"
                style={{
                  background: dark
                    ? 'rgba(255,255,255,.12)'
                    : 'rgba(0,0,0,.08)',
                }}
              />
              <span
                className="text-[12px] font-medium"
                style={{ color: t.textMuted }}
              >
                {tr("or")}
              </span>
              <div
                className="flex-1 h-px"
                style={{
                  background: dark
                    ? 'rgba(255,255,255,.12)'
                    : 'rgba(0,0,0,.08)',
                }}
              />
            </div>

            {/* First / Last name */}
            <div className="flex gap-2.5 mb-3">
              <div className="flex-1 min-w-0 auth-box">
                <label htmlFor="signup-first">{tr("First name")}</label>
                <input
                  id="signup-first"
                  name="firstName"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(
                      e.target.value
                        .replace(/[^a-zA-Z\u00C0-\u017F]/g, '')
                        .slice(0, 50)
                    );
                    clearErr('first');
                  }}
                  placeholder={fieldErr.first?.code === 'required' ? tr("Required") : tr("First")}
                  aria-invalid={!!fieldErr.first}
                  maxLength={50}
                  type="text"
                  autoComplete="given-name"
                  className={`auth-in${fieldErr.first ? ' is-bad' : ''}`}
                />
              </div>
              <div className="flex-1 min-w-0 auth-box">
                <label htmlFor="signup-last">{tr("Last name")}</label>
                <input
                  id="signup-last"
                  name="lastName"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(
                      e.target.value
                        .replace(/[^a-zA-Z\u00C0-\u017F]/g, '')
                        .slice(0, 50)
                    );
                    clearErr('last');
                  }}
                  placeholder={fieldErr.last?.code === 'required' ? tr("Required") : tr("Last")}
                  aria-invalid={!!fieldErr.last}
                  maxLength={50}
                  type="text"
                  autoComplete="family-name"
                  className={`auth-in${fieldErr.last ? ' is-bad' : ''}`}
                />
              </div>
            </div>

            {/* Email */}
            <div className="auth-box">
            <label htmlFor="signup-email">{tr("Email address")}</label>
            <input
              id="signup-email"
              name="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value.trim().toLowerCase().slice(0, 254));
                clearErr('email');
              }}
              onBlur={() => setEmailTouched(true)}
              placeholder={fieldErr.email?.code === 'required' ? tr("Required") : "you@example.com"}
              type="email"
              autoComplete="email"
              aria-invalid={emailBad}
              className={`auth-in${emailBad ? ' is-bad' : ''}`}
            />
            </div>
            <div className="mb-0.5">{emailSlot}</div>

            {/* WhatsApp number */}
            <div className={`auth-box auth-tel${phoneBad ? ' is-bad' : ''}`} onBlur={() => setPhoneTouched(true)}>
              <label htmlFor="signup-phone">
                {tr("WhatsApp number")} <span style={{ color: dark ? '#fca5a5' : '#dc2626' }}>*</span>
              </label>
              <PhoneField id="signup-phone" country={country} onCountry={(c) => { setCountry(c); clearErr('phone'); }} value={phone} onValue={(v) => { setPhone(v); clearErr('phone'); }} t={{ ...t, inputBg: 'var(--auth-field)', inputBorder: 'var(--auth-field-line)' }} dark={dark} boxed />
            </div>
            <div className="mb-0.5">{phoneSlot}</div>

            {/* Continue + switch — pinned to the bottom, the same height as step 2's pair, so the button never moves */}
            <div className="mt-auto pt-2">
            <button
              type={step === 1 ? 'submit' : 'button'}
              className="w-full h-[50px] rounded-[14px] text-white text-[15.5px] font-bold transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]"
              style={{ background: t.btnPrimary }}
            >
              {tr("Continue →")}
            </button>

            {/* Switch to login — or, when something went wrong, what it was */}
            <div
              className="text-center text-sm mt-1.5 leading-8"
              style={{ color: t.textSoft }}
            >
              {step === 1 && line ? <LineMsg line={line} /> : <>
              {tr("Already have an account?")}{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="bg-transparent font-semibold text-sm"
                style={{ color: "var(--t-accent-ink)" }}
              >
                {tr("Log in")}
              </button>
              </>}
            </div>
            </div>
          </div>

        {/* ====== SIGNUP STEP 2 ====== */}
          <div className="[grid-area:1/1] flex flex-col min-w-0" inert={step !== 2} style={step !== 2 ? { visibility: 'hidden' } : undefined}>
            {/* Password */}
            <div className="auth-box mb-1">
              <label htmlFor="signup-password">{tr("Password")}</label>
              <input
                id="signup-password"
                name="password"
                placeholder={fieldErr.password?.code === 'required' ? tr("Required") : tr("Min. 6 characters")}
                value={pw}
                onChange={(e) => { setPw(e.target.value.slice(0, 128)); clearErr('password'); }}
                type={showPw ? 'text' : 'password'}
                maxLength={128}
                autoComplete="new-password"
                aria-invalid={!!fieldErr.password}
                className={`auth-in has-eye${fieldErr.password ? ' is-bad' : ''}`}
              />
              <EyeBtn show={showPw} toggle={() => setShowPw(!showPw)} />
            </div>
            <PwStrength pw={pw} t={t} />
            {pw && pw.length < 6 && (
              <div className="text-[11px] mb-1 leading-[1.5]" style={{ color: t.textMuted }}>
                {tr("Use 6+ characters with a mix of uppercase, numbers, and symbols for a strong password.")}
              </div>
            )}

            {/* Confirm password */}
            <div className="auth-box mb-1">
              <label htmlFor="signup-confirm">{tr("Confirm password")}</label>
              <input
                id="signup-confirm"
                name="passwordConfirmation"
                value={pw2}
                onChange={(e) => { setPw2(e.target.value.slice(0, 128)); clearErr('password2'); }}
                placeholder={fieldErr.password2?.code === 'required' ? tr("Required") : tr("Re-enter password")}
                maxLength={128}
                type={showPw2 ? 'text' : 'password'}
                autoComplete="new-password"
                aria-invalid={pwMismatch || !!fieldErr.password2}
                className={`auth-in has-eye${pwMismatch || fieldErr.password2 ? ' is-bad' : pwMatch ? ' is-good' : ''}`}
              />
              <EyeBtn
                show={showPw2}
                toggle={() => setShowPw2(!showPw2)}
              />
            </div>
            <div className="mb-1">
              {pwMatch ? <Slot kind="ok">{tr("Passwords match")}</Slot>
                : pwMismatch ? <Slot kind="err">{tr("Passwords don’t match")}</Slot>
                : <Slot />}
            </div>

            {/* Referral code */}
            <div className="auth-box mb-4">
            <label htmlFor="signup-referral">
              Referral code{' '}
              <span
                className="font-normal"
                style={{ color: t.textMuted }}
              >
                (optional)
              </span>
            </label>
            <input
              id="signup-referral"
              name="referralCode"
              value={refCode}
              onChange={(e) =>
                setRefCode(
                  e.target.value
                    .replace(/[^a-zA-Z0-9\-]/g, '')
                    .toUpperCase()
                    .slice(0, 20)
                )
              }
              placeholder="e.g. NTR-K3BN7A"
              maxLength={20}
              type="text"
              className="auth-in"
            />
            </div>

            {/* Terms checkbox */}
            <label className={`auth-terms flex items-start gap-2.5 mb-1 cursor-pointer${fieldErr.terms ? ' is-bad' : ''}`}>
              <input
                id="signup-terms"
                name="termsAccepted"
                type="checkbox"
                checked={agree}
                onChange={(e) => { setAgree(e.target.checked); clearErr('terms'); }}
                aria-invalid={!!fieldErr.terms}
                className="mt-[3px] w-4 h-4 shrink-0"
                style={{ accentColor: t.accent }}
              />
              <span
                className="text-[13px] leading-normal"
                style={{ color: t.textSoft }}
              >
                I agree to the{' '}
                <a
                  href="/terms"
                  className="no-underline"
                  style={{ color: "var(--t-accent-ink)" }}
                >
                  {tr("Terms")}
                </a>{' '}
                and{' '}
                <a
                  href="/privacy"
                  className="no-underline"
                  style={{ color: "var(--t-accent-ink)" }}
                >
                  {tr("Privacy Policy")}
                </a>
              </span>
            </label>

            {/* Create account + back — pinned to the bottom, level with step 1's Continue.
                A message sits just above the button, in room step 2 already has. */}
            <div className="mt-auto pt-2">
            {step === 2 && line && <p className="text-center text-[13px] mb-2.5"><LineMsg line={line} /></p>}
            <button
              type={step === 2 ? 'submit' : 'button'}
              disabled={authLoading}
              className="w-full h-[50px] rounded-[14px] text-white text-[15.5px] font-bold flex items-center justify-center gap-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]"
              style={{
                background: authLoading ? '#999' : t.btnPrimary,
                opacity: authLoading ? 0.7 : 1,
              }}
            >
              {authLoading && (
                <NitroLoader size={16} mono ariaHidden />
              )}
              {authLoading ? tr("Creating...") : tr("Create account")}
            </button>

            {/* Back button */}
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full mt-1.5 h-8 rounded-[10px] bg-transparent text-sm font-semibold flex items-center justify-center gap-1.5"
              style={{ color: t.textSoft }}
            >
              <span className="dir-flip" aria-hidden="true">←</span>{tr("Back to step 1")}
            </button>
            </div>
          </div>
        </div>
        )}

        {/* ====== RESET MODE — FORM ====== */}
        {mode === 'reset' && !resetDone && (
          <>
            <div className="auth-box mb-1">
              <label htmlFor="reset-pw">{tr("New password")}</label>
              <input id="reset-pw" name="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value.slice(0, 128))} placeholder={tr("Enter new password")} type={showPw ? 'text' : 'password'} className="auth-in has-eye" />
              <EyeBtn show={showPw} toggle={() => setShowPw(!showPw)} />
            </div>
            <PwStrength pw={pw} t={t} />

            <div className="auth-box mb-5">
              <label htmlFor="reset-pw2">{tr("Confirm password")}</label>
              <input id="reset-pw2" name="passwordConfirmation" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value.slice(0, 128))} placeholder={tr("Confirm new password")} type={showPw2 ? 'text' : 'password'} className={`auth-in has-eye${pwMismatch ? ' is-bad' : ''}`} />
              <EyeBtn show={showPw2} toggle={() => setShowPw2(!showPw2)} />
            </div>
            {pwMismatch && <p className="text-[11px] -mt-4 mb-4 font-medium" style={{ color: '#dc2626' }}>{tr("Passwords do not match")}</p>}

            <button type="submit" disabled={authLoading || !pw || !pwMatch} className="w-full h-[50px] rounded-[14px] text-white text-[15.5px] font-bold mb-5 flex items-center justify-center gap-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ background: authLoading ? '#999' : t.btnPrimary, opacity: authLoading || !pw || !pwMatch ? 0.7 : 1 }}>
              {authLoading && <NitroLoader size={16} mono ariaHidden />}
              {authLoading ? tr("Resetting...") : tr("Reset password")}
            </button>
            {line && <p className="text-center text-sm -mt-2.5 mb-4"><LineMsg line={line} /></p>}
          </>
        )}

        {/* ====== RESET MODE — DONE ====== */}
        {mode === 'reset' && resetDone && (
          <div role="status" aria-live="polite" aria-atomic="true">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: dark ? 'rgba(110,231,183,0.1)' : 'rgba(5,150,105,0.06)', border: `2px solid ${t.green}` }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p className="text-[15px] text-center mb-6" style={{ color: t.textSoft }}>{tr("Your password has been reset. You can now log in.")}</p>
            <button type="button" onClick={() => { setMode('login'); window.history.replaceState({}, '', '/'); }} className="w-full h-[50px] rounded-[14px] text-white text-[15.5px] font-bold" style={{ background: t.btnPrimary }}>{tr("Log in")}</button>
          </div>
        )}

        {/* ====== FORGOT MODE — FORM ====== */}
        {mode === 'forgot' && !forgotSent && (
          <>
            <div className="auth-box mb-5">
            <label htmlFor="forgot-email">{tr("Email address")}</label>
            <input
              id="forgot-email"
              name="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value.trim().toLowerCase().slice(0, 254));
                clearErr('email');
              }}
              placeholder={fieldErr.email?.code === 'required' ? tr("Required") : "you@example.com"}
              aria-invalid={!!fieldErr.email}
              type="email"
              autoComplete="email"
              className={`auth-in${fieldErr.email ? ' is-bad' : ''}`}
            />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full h-[50px] rounded-[14px] text-white text-[15.5px] font-bold mb-5 flex items-center justify-center gap-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]"
              style={{
                background: authLoading ? '#999' : t.btnPrimary,
                opacity: authLoading ? 0.7 : 1,
              }}
            >
              {authLoading && (
                <NitroLoader size={16} mono ariaHidden />
              )}
              {authLoading ? tr("Sending...") : tr("Send reset link")}
            </button>

            <div
              className="text-center text-sm"
              style={{ color: t.textSoft }}
            >
              {line ? <LineMsg line={line} /> : <>
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="bg-transparent font-semibold text-sm"
                style={{ color: "var(--t-accent-ink)" }}
              >
                {tr("Log in")}
              </button>
              </>}
            </div>
          </>
        )}

        {/* ====== FORGOT MODE — SENT ====== */}
        {mode === 'forgot' && forgotSent && (
          <div role="status" aria-live="polite" aria-atomic="true">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{
                background: dark
                  ? 'rgba(110,231,183,0.1)'
                  : 'rgba(5,150,105,0.06)',
                border: `2px solid ${t.green}`,
              }}
            >
              <OffsetIcon name="mail" size={28} color={t.green} />
            </div>

            <p
              className="text-[15px] text-center mb-1"
              style={{ color: t.textSoft }}
            >
              {tr("Reset link sent to")}
            </p>
            <p
              className="text-[15px] font-semibold text-center mb-6"
              style={{ color: t.text }}
            >
              {email}
            </p>
            <p
              className="text-sm text-center mb-6"
              style={{ color: t.textMuted }}
            >
              {tr("Check your inbox and spam folder.")}
            </p>

            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full h-[50px] rounded-[14px] text-white text-[15.5px] font-bold"
              style={{ background: t.btnPrimary }}
            >
              {tr("Back to login")}
            </button>
          </div>
        )}
        </form>

        {/* For someone who would rather not make an account at all. On a desktop
            modal it sits in the pink panel instead; this bar is for phones and
            the plain card. Only passed in while guest_checkout_enabled is on. */}
        {guestHere && (
          // The wrapper carries md:hidden: .auth-guest's own display in
          // globals.css is unlayered, so it would beat a utility on the button.
          <div className={elevated ? 'md:hidden' : ''}>
            <GuestButton tr={tr} onClick={startGuest} className="-mx-8 -mb-7 max-md:-mb-6 mt-4 px-8 py-3 w-[calc(100%+4rem)]" />
          </div>
        )}
      </div>
      </ElevatedShell>
    </div>
  );
}

export default AuthModal;
