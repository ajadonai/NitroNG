'use client';
import { useState } from 'react';
// ─────────────────────────────────────────────────────────────────
// Nitro Rewards UI — Nitro Status + Nitro Points + Tasks strip,
// detail modals, and the Wallet compact card.
// Design reference: Marketing mockup "Nitro Rewards Phase 1 Home Cards"
// (approved by Trip, 11 Jul 2026).
//
// DATA IS MOCKED for now: replace getRewards() with the real
// /api/rewards payload when the backend ships. Shape is locked:
//   rewards.status { key,name,eligibleSpend,currentMin,nextName,nextMin,
//                    remainingToNext,progressPct,discountPct,pointEarnPct }
//   rewards.points { balance,valueNaira,minRedeem,redeemable,neededToRedeem }
//   rewards.tasks  { available, topReward }   (strip cell gated by TASKS_ENABLED)
//
// Wording rules (locked): "Nitro Status", "Nitro Points",
// "Nitro Status discount" (never "loyalty"), 1 point = ₦1, min redeem 5,000.
// ─────────────────────────────────────────────────────────────────

// Flip when the Tasks page ships; the strip grows its third cell.
export const TASKS_ENABLED = false;

export const STATUS_TIERS = [
  { key: 'spark',  name: 'Spark',  min: 0,        minLabel: '₦0+',     discountPct: 0,   pointEarnPct: 0.5,  color: '#9ca3af' },
  { key: 'pulse',  name: 'Pulse',  min: 100000,   minLabel: '₦100k+',  discountPct: 0.5, pointEarnPct: 1,    color: '#60a5fa' },
  { key: 'boost',  name: 'Boost',  min: 500000,   minLabel: '₦500k+',  discountPct: 1,   pointEarnPct: 1.25, color: '#a78bfa' },
  { key: 'surge',  name: 'Surge',  min: 2000000,  minLabel: '₦2m+',    discountPct: 2,   pointEarnPct: 1.5,  color: '#f472b6' },
  { key: 'apex',   name: 'Apex',   min: 7500000,  minLabel: '₦7.5m+',  discountPct: 3,   pointEarnPct: 1.75, color: '#fb923c' },
  { key: 'legend', name: 'Legend', min: 15000000, minLabel: '₦15m+',   discountPct: 4,   pointEarnPct: 2,    color: '#fbbf24' },
];

// MOCK — replace with API data. progressPct = share of the NEXT tier's
// minimum already spent (absolute). Switch to tier-span if Trip prefers:
// (eligibleSpend - currentMin) / (nextMin - currentMin) * 100
export function getRewards() {
  const eligibleSpend = 750000;
  const current = STATUS_TIERS[2];
  const next = STATUS_TIERS[3];
  return {
    status: {
      key: current.key,
      name: current.name,
      eligibleSpend,
      currentMin: current.min,
      nextName: next.name,
      nextMin: next.min,
      remainingToNext: next.min - eligibleSpend,
      progressPct: Math.min(100, Math.round((eligibleSpend / next.min) * 1000) / 10),
      discountPct: current.discountPct,
      pointEarnPct: current.pointEarnPct,
    },
    points: {
      balance: 8450,
      valueNaira: 8450,
      minRedeem: 5000,
      redeemable: true,
      neededToRedeem: 0,
    },
    tasks: { available: 2, topReward: 500 },
    history: [
      { kind: 'earned',   label: 'Earned',   ref: '#NTR-2475', refType: 'order',  pts: 125 },
      { kind: 'spent',    label: 'Spent',    ref: '#NTR-2480', refType: 'order',  pts: -5000 },
      { kind: 'reversed', label: 'Reversed', ref: '#NTR-2440', refType: 'refund', pts: -50 },
    ],
  };
}

export const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb8hC6rJ3jv7Ig2m3D3Q';

// Compact naira for tight strip lines: ₦2.43m, ₦100k. Full figures live in modals.
export function fmtCompactNaira(n) {
  if (n >= 1000000) return `₦${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 2).replace(/\.?0+$/, '')}m`;
  if (n >= 1000) return `₦${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.?0+$/, '')}k`;
  return `₦${n.toLocaleString()}`;
}

/* ── shared bits ── */

const cardStyle = (dark) => ({
  background: dark ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.85)',
  border: `1px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)'}`,
});

function ChipIcon({ gradient, shadow, children, size = 26, radius = 8 }) {
  return (
    <div className="flex items-center justify-center shrink-0" style={{ width: size, height: size, borderRadius: radius, background: gradient, boxShadow: shadow || '0 3px 8px rgba(0,0,0,.14)' }}>
      {children}
    </div>
  );
}

const CrownGlyph = ({ s = 13, color = '#fff' }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.5 10h-15L3 8z"/></svg>
);
const CoinGlyph = ({ s = 13 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8.5v7M9.5 10.5c0-1 1-1.7 2.5-1.7s2.5.6 2.5 1.6c0 2.4-5 1.6-5 4 0 1 1 1.6 2.5 1.6s2.5-.7 2.5-1.7"/></svg>
);
const TaskGlyph = ({ s = 13 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/></svg>
);
const Chevron = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
);

function CellLink({ t, onClick, children }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-[11.5px] font-semibold bg-transparent border-none cursor-pointer p-0 font-[inherit] hover:underline" style={{ color: t.accent }}>
      {children}<Chevron />
    </button>
  );
}

/* ── HOME: rewards strip ── */

export function RewardsStrip({ rewards, dark, t, onStatus, onPoints, onTasks }) {
  if (!rewards) return null;
  const { status, points, tasks } = rewards;
  const curTier = STATUS_TIERS.find(ti => ti.key === status.key) || STATUS_TIERS[0];
  const curIdx = STATUS_TIERS.indexOf(curTier);
  const nextTier = curIdx < STATUS_TIERS.length - 1 ? STATUS_TIERS[curIdx + 1] : null;
  const heroClr = curTier.key === 'spark' ? '#c47d8e' : curTier.color;
  const barClr = nextTier ? nextTier.color : heroClr;
  const gold = dark ? '#fbbf24' : '#d97706';

  return (
    <div className="grid grid-cols-2 gap-2.5 mb-5 max-md:mb-4">

      {/* Nitro Status */}
      <button onClick={onStatus} className="flex flex-col rounded-2xl max-md:rounded-xl p-3.5 max-md:p-3 min-w-0 text-left border border-solid cursor-pointer bg-transparent font-[inherit] transition-transform duration-150 hover:-translate-y-px" style={{ background: dark ? `${heroClr}20` : `${heroClr}18`, borderColor: `${heroClr}${dark ? '40' : '35'}` }}>
        <div className="flex items-center gap-2 mb-3">
          <ChipIcon gradient={`linear-gradient(135deg,${heroClr},${heroClr}cc)`} shadow={`0 3px 10px ${heroClr}30`} size={28} radius={9}><CrownGlyph s={14} /></ChipIcon>
          <div className="text-[9.5px] font-bold uppercase tracking-[.8px]" style={{ color: heroClr, opacity: .7 }}>Status</div>
        </div>
        <div className="text-[19px] max-md:text-[17px] font-extrabold leading-none truncate" style={{ color: heroClr }}>{status.name}</div>
        <div className="text-[11px] mt-1.5 truncate" style={{ color: t.textMuted }}>
          {fmtCompactNaira(status.eligibleSpend)} spent
        </div>
        <div className="h-[5px] rounded-full overflow-hidden mt-2.5" style={{ background: `${heroClr}20` }}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(3, status.progressPct)}%`, background: `linear-gradient(90deg, ${heroClr}, ${barClr})` }} />
        </div>
        {nextTier && <div className="text-[9.5px] mt-1.5" style={{ color: barClr, opacity: .8 }}>{fmtCompactNaira(status.remainingToNext)} to {nextTier.name}</div>}
        <div className="flex-1" />
        <div className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold" style={{ color: heroClr }}>
          Details <Chevron />
        </div>
      </button>

      {/* Nitro Points */}
      <button onClick={onPoints} className="flex flex-col rounded-2xl max-md:rounded-xl p-3.5 max-md:p-3 min-w-0 text-left border border-solid cursor-pointer bg-transparent font-[inherit] transition-transform duration-150 hover:-translate-y-px" style={{ background: dark ? 'rgba(251,191,36,.14)' : 'rgba(251,191,36,.12)', borderColor: dark ? 'rgba(251,191,36,.35)' : 'rgba(217,119,6,.3)' }}>
        <div className="flex items-center gap-2 mb-3">
          <ChipIcon gradient="linear-gradient(135deg,#fbbf24,#d97706)" shadow="0 3px 10px rgba(217,119,6,.25)" size={28} radius={9}><CoinGlyph s={14} /></ChipIcon>
          <div className="text-[9.5px] font-bold uppercase tracking-[.8px]" style={{ color: gold, opacity: .7 }}>Points</div>
        </div>
        <div className="m text-[19px] max-md:text-[17px] font-extrabold leading-none truncate" style={{ color: gold }}>{points.balance.toLocaleString()} <span className="text-[13px]">pts</span></div>
        <div className="text-[11px] mt-1.5 truncate">
          {points.redeemable
            ? <span className="font-semibold" style={{ color: dark ? '#6ee7b7' : '#059669' }}>≈ ₦{points.valueNaira.toLocaleString()} ready</span>
            : <span style={{ color: t.textMuted }}>{points.neededToRedeem.toLocaleString()} more to spend</span>}
        </div>
        {!points.redeemable && (
          <div className="h-[5px] rounded-full overflow-hidden mt-2.5" style={{ background: dark ? 'rgba(251,191,36,.2)' : 'rgba(217,119,6,.15)' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(points.balance / points.minRedeem * 100))}%`, background: gold }} />
          </div>
        )}
        <div className="flex-1" />
        <div className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold" style={{ color: gold }}>
          View <Chevron />
        </div>
      </button>

      {TASKS_ENABLED && tasks && (
        <button onClick={onTasks} className="col-span-2 flex items-center gap-3 rounded-2xl max-md:rounded-xl p-3.5 max-md:p-3 min-w-0 text-left border border-solid cursor-pointer bg-transparent font-[inherit] transition-transform duration-150 hover:-translate-y-px" style={{ background: dark ? 'rgba(96,165,250,.08)' : 'rgba(96,165,250,.05)', borderColor: dark ? 'rgba(96,165,250,.2)' : 'rgba(96,165,250,.12)' }}>
          <ChipIcon gradient="linear-gradient(135deg,#60a5fa,#2563eb)" shadow="0 3px 10px rgba(37,99,235,.25)" size={28} radius={9}><TaskGlyph s={14} /></ChipIcon>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold" style={{ color: t.text }}><span className="m">{tasks.available}</span> tasks available</div>
            <div className="text-[11px]" style={{ color: t.textMuted }}>Up to ₦{tasks.topReward.toLocaleString()} credit</div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#60a5fa' }}>Go <Chevron /></div>
        </button>
      )}
    </div>
  );
}

/* ── HOME: channel lane ── */

export function ChannelLane({ dark, t, socialLinks }) {
  const telegram = socialLinks?.social_telegram_support;
  const waChannel = socialLinks?.social_whatsapp_channel || WHATSAPP_CHANNEL_URL;
  const cards = [
    {
      key: 'wa',
      href: waChannel,
      gradient: 'linear-gradient(135deg,#25d366,#128c7e)',
      title: 'Follow us on WhatsApp',
      sub: 'Deal days and delivery news, first.',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" opacity=".95"><path d="M12 2A10 10 0 002 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3A10 10 0 1012 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-3-.2-.3A8.2 8.2 0 1112 20.2zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 01-2-1.2 7.5 7.5 0 01-1.4-1.7c-.1-.3 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5v-.5c0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.4z"/></svg>
      ),
    },
    telegram && {
      key: 'tg',
      href: telegram.startsWith('http') ? telegram : `https://t.me/${telegram.replace(/^@/, '')}`,
      gradient: 'linear-gradient(135deg,#2aabee,#1e7fc4)',
      title: 'Join the Telegram',
      sub: 'Service updates and community.',
      icon: (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" opacity=".95"><path d="M21.9 4.6c.3-1.2-.9-2-1.9-1.6L2.7 9.6c-1.2.5-1.1 2.2.1 2.6l4.4 1.4 1.7 5.3c.3 1 1.6 1.3 2.3.5l2.4-2.5 4.5 3.3c.9.7 2.2.2 2.4-.9l2.4-14.7zM9.4 13.1l8.3-5.2c.4-.2.7.3.4.6l-6.8 6.2-.3 3-1.6-4.6z"/></svg>
      ),
    },
  ].filter(Boolean);

  if (!cards.length) return null;

  return (
    <div className={`grid gap-2.5 mb-5 max-md:mb-4 ${cards.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {cards.map(c => (
        <a key={c.key} href={c.href} onClick={e => { e.preventDefault(); window.open(c.href, '_blank', 'noopener,noreferrer'); }}
          className="relative rounded-2xl p-4 min-h-[132px] max-md:min-h-[100px] text-white overflow-hidden flex flex-col justify-between no-underline transition-transform duration-200 hover:-translate-y-0.5"
          style={{ background: c.gradient }}>
          <div className="absolute rounded-full" style={{ width: 180, height: 180, background: 'rgba(255,255,255,.13)', top: -85, right: -55 }} />
          <div className="absolute rounded-full" style={{ width: 104, height: 104, background: 'rgba(255,255,255,.09)', bottom: -52, left: -32 }} />
          <div className="relative flex items-start justify-between">
            <div>{c.icon}</div>
            <div className="w-[28px] h-[28px] rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,.28)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
            </div>
          </div>
          <div className="relative mt-auto pt-2">
            <div className="text-[13.5px] max-md:text-[12.5px] font-extrabold leading-snug">{c.title}</div>
            <div className="text-[11px] max-md:text-[10.5px] font-medium mt-[2px] opacity-[.88]">{c.sub}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

/* ── modal shell (matches the How-it-works popup exactly) ── */

function ModalShell({ open, onClose, dark, t, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-[4px] animate-[modalFadeIn_.2s_ease]" onClick={onClose} style={{ background: 'rgba(0,0,0,.45)' }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-[420px] rounded-2xl overflow-hidden animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]" onClick={e => e.stopPropagation()} style={{ background: dark ? '#0e1120' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.14)'}`, boxShadow: dark ? '0 20px 60px rgba(0,0,0,.4)' : '0 20px 60px rgba(0,0,0,.1)' }}>
        <div className="py-4 px-5 flex items-center justify-between" style={{ background: dark ? 'rgba(196,125,142,.1)' : 'rgba(196,125,142,.06)', borderBottom: `1px solid ${dark ? 'rgba(196,125,142,.15)' : 'rgba(196,125,142,.1)'}` }}>
          <div className="text-[15px] font-semibold" style={{ color: t.text }}>{title}</div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center border border-solid cursor-pointer bg-transparent" style={{ borderColor: dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.14)', color: t.textSoft }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="py-5 px-5 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

/* ── Nitro Status modal ── */

export function StatusModal({ open, onClose, rewards, dark, t }) {
  const [expanded, setExpanded] = useState(null);
  if (!open || !rewards) return null;
  const { status } = rewards;
  const curIdx = STATUS_TIERS.findIndex(ti => ti.key === status.key);
  const curTier = STATUS_TIERS[curIdx] || STATUS_TIERS[0];
  const nextTier = curIdx < STATUS_TIERS.length - 1 ? STATUS_TIERS[curIdx + 1] : null;
  const heroColor = curTier.key === 'spark' ? '#c47d8e' : curTier.color;
  const barColor = nextTier ? nextTier.color : curTier.color;
  return (
    <ModalShell open={open} onClose={onClose} dark={dark} t={t} title="Nitro Status">
      <div className="rounded-xl p-3.5" style={{ background: `${heroColor}${dark ? '14' : '0a'}`, border: `1px solid ${heroColor}${dark ? '33' : '20'}` }}>
        <div className="flex items-center gap-3">
          <div className="w-[42px] h-[42px] rounded-xl flex items-center justify-center shrink-0" style={{ background: `${heroColor}30`, boxShadow: `0 4px 12px ${heroColor}25` }}>
            <CrownGlyph s={20} color={heroColor} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[20px] font-extrabold leading-none" style={{ color: heroColor }}>{status.name}</div>
            <div className="text-[11.5px] mt-1" style={{ color: t.textMuted }}>
              {status.discountPct > 0 ? <><span style={{ color: heroColor, fontWeight: 600 }}>{status.discountPct}% off</span> · </> : ''}{status.pointEarnPct}% points on every order
            </div>
          </div>
        </div>
      </div>

      {status.nextName && (
        <div className="mt-4">
          <div className="flex justify-between items-baseline text-[10.5px] font-bold uppercase tracking-[.6px] mb-1.5" style={{ color: t.textMuted }}>
            <span>Progress to <span style={{ color: barColor, fontWeight: 700 }}>{status.nextName}</span></span>
            <span className="normal-case font-semibold tracking-normal" style={{ color: barColor }}>{fmtCompactNaira(status.remainingToNext)} to go</span>
          </div>
          <div className="h-[7px] rounded-full overflow-hidden" style={{ background: dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.06)' }}>
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(3, status.progressPct)}%`, background: `linear-gradient(90deg, ${heroColor}, ${barColor})` }} />
          </div>
          <div className="text-[11px] mt-1.5" style={{ color: t.textMuted }}>
            <span className="font-semibold" style={{ color: t.text }}>{fmtCompactNaira(status.eligibleSpend)}</span> of {fmtCompactNaira(status.nextMin)}
          </div>
        </div>
      )}

      <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.06)'}` }}>
        <div className="text-[11px] mb-3 leading-relaxed" style={{ color: t.textSoft }}>
          Spend more to unlock higher tiers with bigger discounts and more points back.
        </div>
        {STATUS_TIERS.map((tier, idx) => {
          const cur = tier.key === status.key;
          const passed = STATUS_TIERS.indexOf(curTier) > idx;
          const isOpen = expanded === tier.key;
          return (
            <button key={tier.key} onClick={() => setExpanded(isOpen ? null : tier.key)} className="w-full text-left bg-transparent border border-solid rounded-[10px] mb-[5px] cursor-pointer font-[inherit] transition-all duration-150 overflow-hidden" style={{ borderColor: cur ? `${tier.color}55` : (dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.06)'), background: cur ? `${tier.color}${dark ? '14' : '0a'}` : (dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)') }}>
              <div className="flex items-center gap-2.5 py-[7px] px-3">
                <div className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: tier.color }} />
                <span className="text-[12.5px] flex-1" style={{ color: tier.color, fontWeight: cur ? 700 : 600 }}>{tier.name}</span>
                {cur && <span className="text-[8px] font-extrabold uppercase tracking-[.5px] rounded-full px-[6px] py-[1.5px] shrink-0" style={{ background: heroColor, color: '#fff' }}>You</span>}
                {passed && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={tier.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12"/></svg>}
                <span className="text-[10.5px] font-medium" style={{ color: t.textMuted }}>{tier.minLabel}</span>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={tier.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ opacity: .6, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {isOpen && (
                <div className="px-3 pb-2.5 pt-1 flex gap-2 text-[10.5px]" style={{ borderTop: `1px solid ${tier.color}20` }}>
                  <div className="flex-1 rounded-lg py-2 px-2.5" style={{ background: `${tier.color}${dark ? '12' : '08'}` }}>
                    <div style={{ color: t.textMuted }}>Discount</div>
                    <div className="text-[13px] font-bold mt-0.5" style={{ color: tier.discountPct > 0 ? tier.color : t.textMuted }}>{tier.discountPct > 0 ? `${tier.discountPct}% off` : '—'}</div>
                  </div>
                  <div className="flex-1 rounded-lg py-2 px-2.5" style={{ background: `${tier.color}${dark ? '12' : '08'}` }}>
                    <div style={{ color: t.textMuted }}>Points back</div>
                    <div className="text-[13px] font-bold mt-0.5" style={{ color: tier.color }}>{tier.pointEarnPct}%</div>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </ModalShell>
  );
}

/* ── Nitro Points modal ── */

export function PointsModal({ open, onClose, rewards, dark, t, onUse }) {
  if (!open || !rewards) return null;
  const { points, history, status } = rewards;
  const brd = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.06)';
  const gold = dark ? '#fbbf24' : '#d97706';
  const greenClr = dark ? '#6ee7b7' : '#059669';
  const redClr = dark ? '#fca5a5' : '#dc2626';
  return (
    <ModalShell open={open} onClose={onClose} dark={dark} t={t} title="Nitro Points">
      <div className="rounded-xl p-4" style={{ background: dark ? 'rgba(251,191,36,.08)' : 'rgba(251,191,36,.06)', border: `1px solid ${dark ? 'rgba(251,191,36,.18)' : 'rgba(217,119,6,.12)'}` }}>
        <div className="flex items-center gap-3">
          <ChipIcon gradient="linear-gradient(135deg,#fbbf24,#d97706)" shadow="0 5px 12px rgba(217,119,6,.3)" size={40} radius={11}><CoinGlyph s={19} /></ChipIcon>
          <div className="flex-1 min-w-0">
            <div className="m text-[22px] font-extrabold leading-none" style={{ color: gold }}>{points.balance.toLocaleString()} <span className="text-[14px]">pts</span></div>
            <div className="text-[12px] mt-1" style={{ color: t.textMuted }}>
              ≈ ₦{points.valueNaira.toLocaleString()} · 1 pt = ₦1
            </div>
          </div>
        </div>
      </div>

      <div className="text-[11px] mt-3.5 leading-relaxed" style={{ color: t.textSoft }}>
        Every order earns you points. Once you hit {points.minRedeem.toLocaleString()}, use them like cash on your next purchase — 1 point = ₦1.
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <div className="rounded-lg py-2.5 px-3" style={{ background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)', border: `1px solid ${brd}` }}>
          <div className="text-[10px] font-bold uppercase tracking-[.5px]" style={{ color: t.textMuted }}>Earn rate</div>
          <div className="text-[14px] font-bold mt-1" style={{ color: gold }}>{status?.pointEarnPct || 0.5}%</div>
          <div className="text-[10px] mt-0.5" style={{ color: t.textMuted }}>of every order</div>
        </div>
        <div className="rounded-lg py-2.5 px-3" style={{ background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)', border: `1px solid ${brd}` }}>
          <div className="text-[10px] font-bold uppercase tracking-[.5px]" style={{ color: t.textMuted }}>Min. redeem</div>
          <div className="text-[14px] font-bold mt-1" style={{ color: t.text }}>{points.minRedeem.toLocaleString()}</div>
          <div className="text-[10px] mt-0.5" style={{ color: t.textMuted }}>points to spend</div>
        </div>
      </div>

      <div className="mt-4">
        {points.redeemable ? (
          <button onClick={onUse} className="block w-full border-none rounded-xl text-white text-[13.5px] font-bold font-[inherit] py-[12px] px-4 cursor-pointer transition-transform duration-150 hover:-translate-y-px" style={{ background: 'linear-gradient(135deg,#fbbf24,#d97706)', boxShadow: '0 4px 12px rgba(217,119,6,.25)' }}>
            Use on next order
          </button>
        ) : (
          <div className="rounded-lg py-3 px-3.5 text-center" style={{ background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)', border: `1px solid ${brd}` }}>
            <div className="text-[12px]" style={{ color: t.textSoft }}>
              Earn <b style={{ color: gold }}>{points.neededToRedeem.toLocaleString()} more</b> points to start spending
            </div>
            <div className="h-1 rounded-full overflow-hidden mt-2" style={{ background: dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.06)' }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(points.balance / points.minRedeem * 100))}%`, background: gold }} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${brd}` }}>
        <div className="text-[10.5px] font-bold uppercase tracking-[.7px] mb-2" style={{ color: t.textMuted }}>Recent activity</div>
        {history && history.length > 0 ? history.map((h, i) => {
          const isPositive = h.pts > 0;
          return (
            <div key={i} className="flex items-center gap-2.5 py-2 px-1" style={{ borderTop: i > 0 ? `1px solid ${brd}` : 'none' }}>
              <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0" style={{ background: isPositive ? `${greenClr}18` : `${redClr}18` }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isPositive ? greenClr : redClr} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {isPositive ? <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 5 19 12"/></> : <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>}
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11.5px] font-medium truncate" style={{ color: t.text }}>{h.label}</div>
                <div className="text-[10px]" style={{ color: t.textMuted }}>{h.ref}</div>
              </div>
              <div className="m text-[12px] font-bold whitespace-nowrap" style={{ color: isPositive ? greenClr : redClr }}>
                {isPositive ? '+' : ''}{h.pts.toLocaleString()}
              </div>
            </div>
          );
        }) : (
          <div className="text-[12px] py-3 text-center rounded-lg" style={{ color: t.textMuted, background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)' }}>
            Points activity will appear here after your first order.
          </div>
        )}
      </div>
    </ModalShell>
  );
}

/* ── WALLET: compact points card ── */

export function WalletPointsCard({ rewards, dark, t, onView }) {
  if (!rewards) return null;
  const { points } = rewards;
  return (
    <div className="flex items-center gap-[11px] rounded-[14px] max-md:rounded-xl py-3.5 px-4 mb-4" style={cardStyle(dark)}>
      <ChipIcon gradient="linear-gradient(135deg,#fbbf24,#d97706)"><CoinGlyph /></ChipIcon>
      <div className="flex-1 min-w-0">
        <div className="text-[10.5px] font-bold uppercase tracking-[.7px]" style={{ color: t.textMuted }}>Nitro Points</div>
        <div className="m text-[14.5px] font-bold mt-[3px] truncate" style={{ color: t.text }}>
          {points.balance.toLocaleString()} pts{' '}
          <span className="font-semibold" style={{ color: points.redeemable ? t.green : t.textMuted }}>≈ ₦{points.valueNaira.toLocaleString()}</span>
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>Minimum to spend: <span className="m">{points.minRedeem.toLocaleString()}</span> pts</div>
      </div>
      <CellLink t={t} onClick={onView}>View points</CellLink>
    </div>
  );
}
