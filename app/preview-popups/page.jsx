'use client';
import { useState } from 'react';

const ACCENT = '#c47d8e';
const S = (d, w = 18) => <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{d}</svg>;

const ICO = {
  lock: S(<><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>),
  clock: S(<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>),
  trendDown: S(<><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>),
  refresh: S(<><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></>),
  shield: S(<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>),
  bolt: S(<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>),
  crown: S(<><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></>),
  lightbulb: S(<><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></>),
  link: S(<><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></>),
  alertTri: S(<><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>, 14),
  checkCircle: S(<><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>),
  pause: S(<><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></>),
  sprout: S(<><path d="M7 20h10"/><path d="M12 20v-8"/><path d="M12 12C12 8 8 4 4 4c0 4 4 8 8 8z"/><path d="M12 12c0-4 4-8 8-8 0 4-4 8-8 8z"/></>),
  target: S(<><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>),
  card: S(<><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></>),
  bitcoin: S(<><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></>),
  building: S(<><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h1"/><path d="M9 13h1"/><path d="M9 17h1"/></>),
  x: S(<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>),
  chevDown: S(<><polyline points="6 9 12 15 18 9"/></>, 12),
  info: S(<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>, 14),
};

function T(dark) {
  return {
    bg: dark ? '#0e1122' : '#f5f3ee',
    cardBg: dark ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.85)',
    cardBorder: dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.12)',
    text: dark ? '#e8e4df' : '#1a1a1a',
    textSoft: dark ? '#b0a9a2' : '#555250',
    textMuted: dark ? '#8a8580' : '#918b85',
    accent: ACCENT,
    green: dark ? '#6ee7b7' : '#059669',
    red: dark ? '#fca5a5' : '#dc2626',
    amber: dark ? '#fbbf24' : '#d97706',
    inputBg: dark ? '#131728' : '#fff',
    inputBorder: dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.19)',
  };
}

export default function PreviewPopups() {
  const [dark, setDark] = useState(true);
  const t = T(dark);

  return (
    <div style={{ minHeight: '100vh', background: dark ? '#080a14' : '#edeae4', fontFamily: 'Outfit, system-ui, sans-serif', padding: '40px 16px 80px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: t.text }}>Popup Preview</h1>
            <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>Each popup shown inside its actual component context. Delete this page before shipping.</p>
          </div>
          <button onClick={() => setDark(!dark)} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: t.cardBg, color: t.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {dark ? <>{S(<><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>, 16)} Light</> : <>{S(<><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></>, 16)} Dark</>}
          </button>
        </div>

        {/* ═══ #1 — First Order Modal ═══ */}
        <Section n={1} title="Before First Order Submit" priority="Must-have" t={t}>
          <MockOrderForm dark={dark} t={t}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 2 }}>
              <div style={{ background: dark ? '#1a1e32' : '#fff', borderRadius: 16, border: `1px solid ${t.cardBorder}`, padding: '22px 20px', maxWidth: 400, width: '100%' }}>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 14, color: t.text }}>Before you place your order</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Tip dark={dark} t={t} icon={ICO.lock} title="Your account is safe">We never ask for your password. All we need is your public link — your account won't be affected.</Tip>
                  <Tip dark={dark} t={t} icon={ICO.clock} title="Delivery is gradual">Orders are delivered gradually over minutes to hours, not all at once. This keeps things natural and safe for your account.</Tip>
                  <Tip dark={dark} t={t} icon={ICO.trendDown} title="Small drops are normal">Platforms regularly clean up inactive accounts. If your count drops slightly, that's normal — it's not a problem with your order.</Tip>
                  <Tip dark={dark} t={t} icon={ICO.refresh} title="Refill services have you covered">If you picked a Standard or Premium tier, we'll automatically top you back up if any drop happens. No action needed from you.</Tip>
                </div>
                <button style={{ marginTop: 16, width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${ACCENT}, #8b5e6b)`, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Got it, place my order</button>
              </div>
            </div>
          </MockOrderForm>
        </Section>

        {/* ═══ #2 — Tier Tooltip ═══ */}
        <Section n={2} title="Tier Selection — Info Tooltip" priority="Must-have" t={t}>
          <div style={{ background: t.cardBg, borderRadius: 14, border: `1px solid ${t.cardBorder}`, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: t.textMuted, marginBottom: 8 }}>Select quality tier</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { tier: 'Budget', bg: dark ? '#2d2210' : '#fef7ed', color: '#854F0B', border: dark ? '#5a4020' : '#e8d5b8', dot: '#ef4444' },
                { tier: 'Standard', bg: dark ? '#0f1e30' : '#eef4fb', color: '#185FA5', border: dark ? '#1e4070' : '#b8d0e8', dot: '#3b82f6', selected: true },
                { tier: 'Premium', bg: dark ? '#221535' : '#f5eef5', color: '#534AB7', border: dark ? '#3d2060' : '#d4b8d4', dot: '#22c55e' },
              ].map(tr => (
                <span key={tr.tier} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: tr.bg, color: tr.color, border: `1.5px solid ${tr.selected ? tr.color : tr.border}`, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: tr.dot }} />{tr.tier} · ₦1,200
                </span>
              ))}
              <span style={{ color: t.textMuted, cursor: 'pointer', marginLeft: 2 }}>{ICO.info}</span>
            </div>
            {/* Tooltip expanded */}
            <div style={{ marginTop: 12, background: dark ? '#141830' : '#fafaf8', borderRadius: 12, border: `1px solid ${t.cardBorder}`, padding: '14px 14px 10px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: t.text }}>What do the tiers mean?</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <TierRow dark={dark} t={t} color="#854F0B" bg={dark ? '#2d2210' : '#fef7ed'} tier="Budget" icon={ICO.shield} desc="Cheapest option. No refill — if the count drops, it stays dropped. Best for one-time boosts where you don't need long-term retention." />
                <TierRow dark={dark} t={t} color="#185FA5" bg={dark ? '#0f1e30' : '#eef4fb'} tier="Standard" icon={ICO.bolt} desc="Mid-range. Comes with a free top-up if the count drops during the refill window (usually 30 days). Great for most people." />
                <TierRow dark={dark} t={t} color="#534AB7" bg={dark ? '#221535' : '#f5eef5'} tier="Premium" icon={ICO.crown} desc="Highest quality accounts with lifetime guarantee. If the count ever drops, we refill it forever. Best for profiles you're building long-term." />
              </div>
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: dark ? 'rgba(196,125,142,.1)' : 'rgba(196,125,142,.06)', fontSize: 12, color: dark ? '#e0c0c8' : '#8a4a5a', lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, marginTop: 1, color: dark ? '#e0c0c8' : '#8a4a5a' }}>{ICO.lightbulb}</span>
                <span>With platforms actively removing inactive accounts, we recommend <strong>Standard or Premium</strong> for anything you want to keep long-term.</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ═══ #3 — Link Input Helper ═══ */}
        <Section n={3} title="Link Input — Contextual Help" priority="Should-have" t={t}>
          <div style={{ background: t.cardBg, borderRadius: 14, border: `1px solid ${t.cardBorder}`, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: t.textMuted, marginBottom: 6 }}>Link</div>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${ACCENT}`, background: dark ? 'rgba(196,125,142,.14)' : 'rgba(196,125,142,.08)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 12px', fontSize: 14, fontWeight: 600, color: t.textMuted, borderRight: `1px solid ${dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.1)'}` }}>https://</span>
              <div style={{ flex: 1, padding: '9px 12px', fontSize: 14, color: t.textMuted }}>instagram.com/yourname</div>
            </div>
            {/* Helper callout below input */}
            <div style={{ marginTop: 10, background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)', borderRadius: 10, border: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`, padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ color: t.textSoft }}>{ICO.link}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Paste the right link</span>
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.6, color: t.textSoft }}>
                <strong>For followers:</strong> paste your <em>profile</em> link<br />
                <span style={{ color: t.textMuted, fontSize: 11.5 }}>e.g. instagram.com/yourname</span>
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.6, color: t.textSoft, marginTop: 4 }}>
                <strong>For likes & views:</strong> paste the <em>post or video</em> link<br />
                <span style={{ color: t.textMuted, fontSize: 11.5 }}>e.g. instagram.com/p/ABC123 or tiktok.com/@user/video/123</span>
              </div>
              <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 7, background: dark ? 'rgba(234,179,8,.08)' : 'rgba(234,179,8,.06)', fontSize: 11.5, color: t.amber, display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ flexShrink: 0, color: t.amber }}>{ICO.alertTri}</span>
                Wrong link type is the #1 reason orders get cancelled. Double-check before submitting!
              </div>
            </div>
          </div>
        </Section>

        {/* ═══ #4 — Completed Order Banner ═══ */}
        <Section n={4} title="Order Completed — Info Banner" priority="Must-have" t={t}>
          <MockOrderDetails dark={dark} t={t} status="Completed" pct={100} delivered={5000} qty={5000} barColor={t.green}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: dark ? 'rgba(34,197,94,.08)' : 'rgba(34,197,94,.04)', border: `1px solid ${dark ? 'rgba(34,197,94,.18)' : 'rgba(34,197,94,.12)'}`, marginBottom: 10 }}>
              <span style={{ flexShrink: 0, marginTop: 1, color: t.green }}>{ICO.checkCircle}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.green, marginBottom: 2 }}>Your order is complete!</div>
                <div style={{ fontSize: 12, lineHeight: 1.55, color: t.textSoft }}>
                  If you notice a small dip in the next few days, don't worry — platforms routinely clean up inactive accounts and it's completely normal. <strong style={{ color: t.text }}>Services with refill will top you back up automatically.</strong>
                </div>
                <button style={{ marginTop: 6, fontSize: 11, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 }}>Dismiss</button>
              </div>
            </div>
          </MockOrderDetails>
        </Section>

        {/* ═══ #5 — Partial Order Banner ═══ */}
        <Section n={5} title="Order Partial — Info Banner" priority="Must-have" t={t}>
          <MockOrderDetails dark={dark} t={t} status="Partial" pct={62} delivered={3100} qty={5000} barColor={ACCENT}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: dark ? 'rgba(245,158,11,.08)' : 'rgba(245,158,11,.04)', border: `1px solid ${dark ? 'rgba(245,158,11,.18)' : 'rgba(245,158,11,.12)'}`, marginBottom: 10 }}>
              <span style={{ flexShrink: 0, marginTop: 1, color: t.amber }}>{ICO.pause}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.amber, marginBottom: 2 }}>Partial delivery</div>
                <div style={{ fontSize: 12, lineHeight: 1.55, color: t.textSoft }}>
                  Part of your order has been delivered and the rest has been refunded to your wallet. This usually happens when a provider runs out of capacity mid-delivery — it's not an error. You can use the refunded balance to place a new order anytime.
                </div>
              </div>
            </div>
          </MockOrderDetails>
        </Section>

        {/* ═══ #6 — Pricing Page Banner ═══ */}
        <Section n={6} title="Pricing Page — Top Banner" priority="Should-have" t={t}>
          <div style={{ background: t.bg, borderRadius: 14, border: `1px solid ${t.cardBorder}`, padding: '20px 16px', overflow: 'hidden' }}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: ACCENT }}>Pricing</span>
              <div style={{ fontSize: 22, fontWeight: 600, color: t.text, marginTop: 4 }}>Transparent <em style={{ color: ACCENT }}>Naira</em> Pricing</div>
            </div>
            {/* Banner sits here */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 10, background: dark ? 'rgba(196,125,142,.08)' : 'rgba(196,125,142,.05)', border: `1px solid ${dark ? 'rgba(196,125,142,.18)' : 'rgba(196,125,142,.12)'}`, marginBottom: 14 }}>
              <span style={{ flexShrink: 0, marginTop: 1, color: ACCENT }}>{ICO.lightbulb}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 2 }}>Choosing the right tier matters</div>
                <div style={{ fontSize: 12, lineHeight: 1.55, color: t.textSoft }}>
                  Social platforms are getting better at removing inactive accounts. <strong style={{ color: t.text }}>Budget</strong> is great for a quick boost, but if you want followers that stick, go with <strong style={{ color: t.text }}>Standard</strong> (30-day refill) or <strong style={{ color: t.text }}>Premium</strong> (lifetime guarantee).
                </div>
                <button style={{ marginTop: 4, fontSize: 11, color: t.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', textUnderlineOffset: 2 }}>Dismiss</button>
              </div>
            </div>
            {/* Fake platform grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {['Instagram', 'TikTok', 'YouTube'].map(p => (
                <div key={p} style={{ padding: '14px 12px', borderRadius: 10, textAlign: 'center', background: t.cardBg, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{p}</div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>from ₦87/1K</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ═══ #7 — Dashboard Education Card ═══ */}
        <Section n={7} title="Dashboard — Education Card" priority="Should-have" t={t}>
          <div style={{ background: t.bg, borderRadius: 14, border: `1px solid ${t.cardBorder}`, padding: 16, overflow: 'hidden' }}>
            {/* Fake stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              {[['Active', '3', t.amber], ['Delivered', '24', t.green], ['This Week', '5', dark ? '#a5b4fc' : '#4f46e5']].map(([label, val, color]) => (
                <div key={label} style={{ padding: '10px', borderRadius: 10, background: t.cardBg, border: `0.5px solid ${t.cardBorder}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 3, background: color }} />
                    <span style={{ fontSize: 11, color: t.textMuted }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{val}</div>
                </div>
              ))}
            </div>
            {/* Education card sits after stats */}
            <div style={{ background: dark ? '#141830' : '#fff', borderRadius: 12, border: `1px solid ${t.cardBorder}`, padding: '16px 14px' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 12 }}>How growth services work</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Tip dark={dark} t={t} icon={ICO.sprout} title="It's a gradual process">We deliver followers, likes, and views from real accounts over time — not all at once. This protects your account and looks natural.</Tip>
                <Tip dark={dark} t={t} icon={ICO.refresh} title="Platforms do routine cleanups">Instagram, TikTok, and others regularly remove inactive accounts from everyone's follower lists. This isn't unique to growth services — it happens to organic followers too.</Tip>
                <Tip dark={dark} t={t} icon={ICO.shield} title="Refill is your safety net">Standard and Premium tiers include automatic refills. If a cleanup hits your count, we top you back up at no extra cost.</Tip>
                <Tip dark={dark} t={t} icon={ICO.target} title="Pro tip">Combine growth services with your own content strategy. Accounts that post regularly retain followers much better than inactive ones.</Tip>
              </div>
              <button style={{ marginTop: 14, padding: '7px 14px', borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: 'none', color: t.textMuted, fontSize: 12, cursor: 'pointer' }}>Dismiss</button>
            </div>
          </div>
        </Section>

        {/* ═══ #8 — Add Funds Payment Helper ═══ */}
        <Section n={8} title="Add Funds — Payment Method Info" priority="Nice-to-have" t={t}>
          <div style={{ background: t.bg, borderRadius: 14, border: `1px solid ${t.cardBorder}`, padding: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 4 }}>Add Funds</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 12 }}>Current balance: <strong style={{ color: t.green }}>₦12,400</strong></div>
            {/* Amount input mock */}
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${t.inputBorder}`, background: t.inputBg, marginBottom: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0 12px', fontSize: 15, fontWeight: 600, color: t.textMuted, borderRight: `1px solid ${t.inputBorder}` }}>₦</span>
              <div style={{ flex: 1, padding: '10px 12px', fontSize: 15, color: t.text }}>5,000</div>
            </div>
            {/* Payment info card sits here */}
            <div style={{ background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)', borderRadius: 10, border: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}`, padding: '14px 14px 10px', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 10 }}>Payment methods</div>
              <PaymentRow dark={dark} t={t} icon={ICO.card} method="Card / Bank Transfer" detail="Instant · Powered by Flutterwave · No extra fees" />
              <PaymentRow dark={dark} t={t} icon={ICO.bitcoin} method="Crypto (USDT, BTC, etc.)" detail="Usually confirms in 5-30 mins depending on network" />
              <PaymentRow dark={dark} t={t} icon={ICO.building} method="Direct Bank Transfer" detail="Send to our account · Confirmed within minutes during business hours" last />
            </div>
            {/* Fake gateway buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, padding: '10px', borderRadius: 10, textAlign: 'center', border: `2px solid ${ACCENT}`, background: dark ? 'rgba(196,125,142,.08)' : 'rgba(196,125,142,.04)', fontSize: 13, fontWeight: 600, color: ACCENT }}>Flutterwave</div>
              <div style={{ flex: 1, padding: '10px', borderRadius: 10, textAlign: 'center', border: `1px solid ${t.cardBorder}`, background: t.cardBg, fontSize: 13, fontWeight: 600, color: t.textSoft }}>Crypto</div>
            </div>
          </div>
        </Section>

        {/* Implementation notes */}
        <div style={{ marginTop: 48, padding: '18px 16px', borderRadius: 12, border: `1px solid ${t.cardBorder}`, background: t.cardBg }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: t.text }}>Implementation notes</div>
          <ul style={{ fontSize: 12.5, lineHeight: 1.8, color: t.textMuted, paddingLeft: 18, margin: 0 }}>
            <li><strong style={{ color: t.text }}>#1</strong> shows only on first order (tracked in localStorage)</li>
            <li><strong style={{ color: t.text }}>#2</strong> shows when tapping info icon next to tier chips</li>
            <li><strong style={{ color: t.text }}>#3</strong> shows inline when user focuses the link input</li>
            <li><strong style={{ color: t.text }}>#4 & #5</strong> show inside expanded order details, dismissible per order</li>
            <li><strong style={{ color: t.text }}>#6</strong> shows once on pricing page (dismissible, localStorage)</li>
            <li><strong style={{ color: t.text }}>#7</strong> shows on first dashboard visit, then once every 30 days</li>
            <li><strong style={{ color: t.text }}>#8</strong> shows inline on the add funds page (always visible)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ═══ SHARED COMPONENTS ═══ */

function Section({ n, title, priority, t, children }) {
  const pc = { 'Must-have': { bg: '#dc262622', text: '#dc2626' }, 'Should-have': { bg: '#f59e0b22', text: '#f59e0b' }, 'Nice-to-have': { bg: '#22c55e22', text: '#22c55e' } }[priority];
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>#{n}</span>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: pc.bg, color: pc.text }}>{priority}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.textSoft }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Tip({ dark, t, icon, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ flexShrink: 0, marginTop: 1, color: t.textSoft }}>{icon}</span>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text, marginBottom: 1 }}>{title}</div>
        <div style={{ fontSize: 12, lineHeight: 1.5, color: t.textMuted }}>{children}</div>
      </div>
    </div>
  );
}

function TierRow({ dark, t, color, bg, tier, icon, desc }) {
  return (
    <div style={{ padding: '9px 12px', borderRadius: 8, background: bg }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color }}>{icon}</span> {tier}
      </div>
      <div style={{ fontSize: 11.5, lineHeight: 1.5, color: t.textSoft }}>{desc}</div>
    </div>
  );
}

function PaymentRow({ dark, t, icon, method, detail, last }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderBottom: last ? 'none' : `1px solid ${dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'}` }}>
      <span style={{ flexShrink: 0, color: t.textSoft, marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text }}>{method}</div>
        <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 1 }}>{detail}</div>
      </div>
    </div>
  );
}

/* ═══ MOCK CONTEXT COMPONENTS ═══ */

function MockOrderForm({ dark, t, children }) {
  return (
    <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', border: `1px solid ${t.cardBorder}` }}>
      {/* Fake order form behind the modal */}
      <div style={{ filter: children ? 'blur(2px)' : 'none', pointerEvents: 'none' }}>
        <div style={{ background: dark ? 'rgba(196,125,142,.1)' : 'rgba(196,125,142,.06)', padding: '16px 16px 12px', borderBottom: `1px solid ${dark ? 'rgba(196,125,142,.15)' : 'rgba(196,125,142,.12)'}` }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>Instagram Followers</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <span style={{ padding: '4px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600, background: dark ? '#0f1e30' : '#eef4fb', color: '#185FA5', border: '1.5px solid #185FA5' }}>Standard · ₦1,200</span>
          </div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>Free top-up if count drops · Instant delivery</div>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: t.textMuted, marginBottom: 6 }}>Link</div>
          <div style={{ borderRadius: 8, border: `1px solid ${t.inputBorder}`, background: t.inputBg, padding: '9px 12px', fontSize: 14, color: t.textMuted, marginBottom: 12 }}>https://instagram.com/yourname</div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: t.textMuted, marginBottom: 6 }}>Quantity</div>
          <div style={{ borderRadius: 8, border: `1px solid ${t.inputBorder}`, background: t.inputBg, padding: '9px 12px', fontSize: 14, color: t.text, marginBottom: 12 }}>5,000</div>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.04)', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: t.textMuted }}><span>Total</span><span style={{ fontWeight: 700, fontSize: 18, color: ACCENT }}>₦6,000</span></div>
          </div>
          <div style={{ padding: '11px 0', borderRadius: 10, background: `linear-gradient(135deg, ${ACCENT}, #8b5e6b)`, color: '#fff', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>Place Order</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function MockOrderDetails({ dark, t, status, pct, delivered, qty, barColor, children }) {
  const statusColors = {
    Completed: { bg: dark ? 'rgba(34,197,94,.12)' : 'rgba(34,197,94,.08)', text: dark ? '#6ee7b7' : '#059669' },
    Partial: { bg: dark ? 'rgba(245,158,11,.12)' : 'rgba(245,158,11,.08)', text: dark ? '#fbbf24' : '#d97706' },
  };
  const sc = statusColors[status];
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${t.cardBorder}` }}>
      {/* Order row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: t.cardBg }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Instagram Followers · 5,000</div>
          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>NTR-2847 · Standard</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 5, background: sc.bg, color: sc.text }}>{status}</span>
      </div>
      {/* Expanded details */}
      <div style={{ padding: '14px 16px', background: dark ? 'rgba(196,125,142,.05)' : 'rgba(196,125,142,.04)', borderTop: `1px solid ${dark ? 'rgba(196,125,142,.2)' : 'rgba(196,125,142,.15)'}`, borderLeft: `3px solid ${ACCENT}` }}>
        {/* Progress bar */}
        <div style={{ padding: '8px 12px', borderRadius: 8, background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.02)', border: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.04)'}`, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: t.textMuted }}>Delivered</span>
            <span style={{ fontWeight: 600, color: barColor }}>{delivered.toLocaleString()} / {qty.toLocaleString()}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', background: dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.08)' }}>
            <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: barColor, transition: 'width .5s' }} />
          </div>
        </div>
        {/* Banner sits here */}
        {children}
        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[['Charge', '-₦6,000', t.red], ['Status', status, sc.text], ['Start Count', '12,847', t.text], ['Ordered', 'Jun 3', t.text]].map(([label, val, color]) => (
            <div key={label} style={{ padding: '8px 6px', borderRadius: 8, textAlign: 'center', background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.03)', border: `1px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.06)'}` }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: t.textMuted, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
