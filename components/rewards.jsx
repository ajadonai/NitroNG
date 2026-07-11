'use client';
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
  { key: 'spark',  name: 'Spark',  min: 0,        minLabel: '₦0+',     discountPct: 0,   pointEarnPct: 0.5 },
  { key: 'pulse',  name: 'Pulse',  min: 400000,   minLabel: '₦400k+',  discountPct: 0.5, pointEarnPct: 1 },
  { key: 'boost',  name: 'Boost',  min: 1500000,  minLabel: '₦1.5m+',  discountPct: 1,   pointEarnPct: 1.25 },
  { key: 'surge',  name: 'Surge',  min: 7500000,  minLabel: '₦7.5m+',  discountPct: 2,   pointEarnPct: 1.5 },
  { key: 'apex',   name: 'Apex',   min: 37500000, minLabel: '₦37.5m+', discountPct: 3,   pointEarnPct: 1.75 },
  { key: 'legend', name: 'Legend', min: 75000000, minLabel: '₦75m+',   discountPct: 4,   pointEarnPct: 2 },
];

// MOCK — replace with API data. progressPct = share of the NEXT tier's
// minimum already spent (absolute). Switch to tier-span if Trip prefers:
// (eligibleSpend - currentMin) / (nextMin - currentMin) * 100
export function getRewards() {
  const eligibleSpend = 2430000;
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

// Compact naira for tight strip lines: ₦2.43m, ₦400k. Full figures live in modals.
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

const CrownGlyph = ({ s = 13 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.5 10h-15L3 8z"/></svg>
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
  const brd = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)';
  const cols = TASKS_ENABLED ? 'desktop:grid-cols-3' : 'desktop:grid-cols-2';

  const head = (chip, label) => (
    <div className="flex items-center gap-2 mb-2.5">
      {chip}
      <div className="text-[10.5px] font-bold uppercase tracking-[.7px] whitespace-nowrap" style={{ color: t.textMuted }}>{label}</div>
    </div>
  );

  return (
    <div className={`grid grid-cols-2 ${cols} rounded-[14px] max-md:rounded-xl overflow-hidden mb-5 max-md:mb-4`} style={cardStyle(dark)}>

      {/* Nitro Status */}
      <div className="flex flex-col py-[15px] px-4 pb-3 min-w-0" style={{ borderRight: `1px solid ${brd}` }}>
        {head(<ChipIcon gradient="linear-gradient(135deg,#c47d8e,#8b5e6b)"><CrownGlyph /></ChipIcon>, 'Nitro Status')}
        <div className="text-[17px] max-md:text-[15.5px] font-bold leading-tight truncate" style={{ color: t.text }}>{status.name}</div>
        <div className="text-[11.5px] mt-[5px] truncate" style={{ color: t.textSoft }}>
          <span className="m">{fmtCompactNaira(status.eligibleSpend)}</span> spent
        </div>
        <div className="h-[5px] rounded-full overflow-hidden mt-[9px]" style={{ background: dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.08)' }}>
          <div className="h-full rounded-full" style={{ width: `${status.progressPct}%`, background: t.accent }} />
        </div>
        <div className="flex-1" />
        <div className="mt-3 pt-2.5" style={{ borderTop: `1px solid ${brd}` }}>
          <CellLink t={t} onClick={onStatus}>View details</CellLink>
        </div>
      </div>

      {/* Nitro Points */}
      <div className="flex flex-col py-[15px] px-4 pb-3 min-w-0" style={{ borderRight: TASKS_ENABLED ? `1px solid ${brd}` : 'none' }}>
        {head(<ChipIcon gradient="linear-gradient(135deg,#fbbf24,#d97706)"><CoinGlyph /></ChipIcon>, 'Nitro Points')}
        <div className="m text-[17px] max-md:text-[15.5px] font-bold leading-tight truncate" style={{ color: t.text }}>{points.balance.toLocaleString()} pts</div>
        <div className="text-[11.5px] mt-[5px] truncate">
          {points.redeemable
            ? <span className="font-semibold" style={{ color: t.green }}>Ready to spend</span>
            : <span style={{ color: t.textMuted }}><span className="m">{points.neededToRedeem.toLocaleString()}</span> more to redeem</span>}
        </div>
        <div className="flex-1" />
        <div className="mt-3 pt-2.5" style={{ borderTop: `1px solid ${brd}` }}>
          <CellLink t={t} onClick={onPoints}>View points</CellLink>
        </div>
      </div>

      {/* Tasks (gated until the Tasks page ships) */}
      {TASKS_ENABLED && tasks && (
        <div className="col-span-2 desktop:col-span-1 flex desktop:flex-col items-center desktop:items-stretch gap-2.5 desktop:gap-0 py-3 desktop:py-[15px] px-4 desktop:pb-3 min-w-0" style={{ borderTop: `1px solid ${brd}` }}>
          <ChipIcon gradient="linear-gradient(135deg,#60a5fa,#2563eb)"><TaskGlyph /></ChipIcon>
          <div className="flex-1 min-w-0 desktop:mt-2.5">
            <div className="hidden desktop:block text-[10.5px] font-bold uppercase tracking-[.7px]" style={{ color: t.textMuted }}>Tasks</div>
            <div className="text-[13px] desktop:text-[17px] font-semibold desktop:font-bold desktop:mt-[3px]" style={{ color: t.text }}>
              <span className="m">{tasks.available}</span> available
            </div>
            <div className="hidden desktop:block text-[11.5px] mt-[5px]" style={{ color: t.textSoft }}>
              Up to <span className="m">₦{tasks.topReward.toLocaleString()}</span> credit
            </div>
          </div>
          <div className="desktop:flex-1" />
          <div className="desktop:mt-3 desktop:pt-2.5" style={{ borderTop: 'none' }}>
            <CellLink t={t} onClick={onTasks}>View tasks</CellLink>
          </div>
        </div>
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
    <div className={`grid gap-2.5 mb-5 max-md:mb-4 ${cards.length > 1 ? 'grid-cols-2 max-md:grid-cols-1' : 'grid-cols-1'}`}>
      {cards.map(c => (
        <a key={c.key} href={c.href} target="_blank" rel="noopener noreferrer"
          className="relative rounded-2xl p-4 min-h-[132px] max-md:min-h-[108px] text-white overflow-hidden flex flex-col justify-end no-underline transition-transform duration-200 hover:-translate-y-0.5"
          style={{ background: c.gradient }}>
          <div className="absolute rounded-full" style={{ width: 180, height: 180, background: 'rgba(255,255,255,.13)', top: -85, right: -55 }} />
          <div className="absolute rounded-full" style={{ width: 104, height: 104, background: 'rgba(255,255,255,.09)', bottom: -52, left: -32 }} />
          <div className="absolute top-3.5 left-4">{c.icon}</div>
          <div className="absolute top-3 right-3 w-[30px] h-[30px] rounded-full flex items-center justify-center z-[2]" style={{ background: 'rgba(255,255,255,.28)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
          </div>
          <div className="relative text-[14.5px] font-extrabold leading-snug">{c.title}</div>
          <div className="relative text-[11.5px] font-medium mt-[3px] opacity-[.88]">{c.sub}</div>
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
  if (!open || !rewards) return null;
  const { status } = rewards;
  const brd = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)';
  return (
    <ModalShell open={open} onClose={onClose} dark={dark} t={t} title="Nitro Status">
      <div className="flex items-center gap-[13px]">
        <ChipIcon gradient="linear-gradient(135deg,#c47d8e,#8b5e6b)" shadow="0 5px 12px rgba(196,125,142,.32)" size={44} radius={13}><CrownGlyph s={21} /></ChipIcon>
        <div>
          <div className="text-[22px] font-extrabold leading-none" style={{ color: t.text }}>{status.name}</div>
          <div className="text-[12px] mt-1.5" style={{ color: t.textMuted }}>
            <b className="font-semibold" style={{ color: t.text }}>{status.discountPct}% off</b> services · <b className="font-semibold" style={{ color: t.text }}>{status.pointEarnPct}% back</b> in points
          </div>
        </div>
      </div>

      <div className="mt-[22px]">
        <div className="text-[10.5px] font-bold uppercase tracking-[.7px]" style={{ color: t.textMuted }}>Progress to {status.nextName}</div>
        <div className="h-1.5 rounded-full overflow-hidden mt-2.5" style={{ background: dark ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.08)' }}>
          <div className="h-full rounded-full" style={{ width: `${status.progressPct}%`, background: t.accent }} />
        </div>
        <div className="flex justify-between gap-2.5 flex-wrap mt-2 text-[11.5px]" style={{ color: t.textMuted }}>
          <span><b className="m font-semibold" style={{ color: t.text }}>{fmtCompactNaira(status.eligibleSpend)}</b> of <span className="m">{fmtCompactNaira(status.nextMin)}</span></span>
          <span><span className="m">{fmtCompactNaira(status.remainingToNext)}</span> to go</span>
        </div>
      </div>

      <div className="mt-[22px] pt-4" style={{ borderTop: `1px solid ${brd}` }}>
        <div className="grid items-center gap-1.5 py-1 px-2.5" style={{ gridTemplateColumns: '1.3fr 1fr .7fr .85fr' }}>
          {['Tier', 'Spend', 'Off', 'Points'].map((h, i) => (
            <span key={h} className="text-[9.5px] font-bold uppercase tracking-[.6px] opacity-75" style={{ color: t.textMuted, textAlign: i ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        {STATUS_TIERS.map(tier => {
          const cur = tier.key === status.key;
          return (
            <div key={tier.key} className="grid items-center gap-1.5 py-[9px] px-2.5 rounded-[9px] text-[12px]" style={{ gridTemplateColumns: '1.3fr 1fr .7fr .85fr', background: cur ? 'rgba(196,125,142,.09)' : 'transparent' }}>
              <div className="flex items-center gap-[7px] min-w-0 font-semibold" style={{ color: cur ? t.text : t.textSoft, fontWeight: cur ? 700 : 600 }}>
                {tier.name}
                {cur && <span className="text-[8.5px] font-extrabold uppercase tracking-[.5px] text-white rounded-full px-[7px] py-[2px] shrink-0" style={{ background: t.accent }}>Current</span>}
              </div>
              <div className="m text-right whitespace-nowrap" style={{ color: cur ? t.text : t.textMuted }}>{tier.minLabel}</div>
              <div className="m text-right whitespace-nowrap" style={{ color: cur ? t.text : t.textMuted }}>{tier.discountPct}%</div>
              <div className="m text-right whitespace-nowrap" style={{ color: cur ? t.text : t.textMuted }}>{tier.pointEarnPct}%</div>
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
}

/* ── Nitro Points modal ── */

export function PointsModal({ open, onClose, rewards, dark, t, onUse }) {
  if (!open || !rewards) return null;
  const { points, history } = rewards;
  const brd = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)';
  return (
    <ModalShell open={open} onClose={onClose} dark={dark} t={t} title="Nitro Points">
      <div className="flex items-center gap-[13px]">
        <ChipIcon gradient="linear-gradient(135deg,#fbbf24,#d97706)" shadow="0 5px 12px rgba(217,119,6,.3)" size={44} radius={13}><CoinGlyph s={21} /></ChipIcon>
        <div>
          <div className="m text-[22px] font-extrabold leading-none" style={{ color: t.text }}>{points.balance.toLocaleString()} pts</div>
          <div className="text-[12px] mt-1.5" style={{ color: t.textMuted }}>
            {points.redeemable
              ? <><b className="font-semibold" style={{ color: t.green }}>≈ ₦{points.valueNaira.toLocaleString()}</b> · Ready to spend</>
              : <>≈ <span className="m">₦{points.valueNaira.toLocaleString()}</span></>}
          </div>
        </div>
      </div>

      <div className="mt-5">
        {points.redeemable ? (
          <>
            <button onClick={onUse} className="block w-full border-none rounded-xl text-white text-[13.5px] font-bold font-[inherit] py-[13px] px-4 cursor-pointer transition-transform duration-150 hover:-translate-y-px" style={{ background: t.accent }}>
              Use on next order
            </button>
            <div className="text-[11px] text-center mt-[9px]" style={{ color: t.textMuted }}>
              Minimum: <span className="m">{points.minRedeem.toLocaleString()}</span> points · <span className="m">1 pt = ₦1</span>
            </div>
          </>
        ) : (
          <div className="text-[12.5px] leading-relaxed" style={{ color: t.textSoft }}>
            Minimum to spend is <b className="font-semibold" style={{ color: t.text }}><span className="m">{points.minRedeem.toLocaleString()}</span> points</b>.<br />
            Earn <b className="font-semibold" style={{ color: t.text }}><span className="m">{points.neededToRedeem.toLocaleString()}</span> more</b> and they unlock.
          </div>
        )}
      </div>

      <div className="mt-[22px] pt-4" style={{ borderTop: `1px solid ${brd}` }}>
        <div className="text-[10.5px] font-bold uppercase tracking-[.7px] mb-1" style={{ color: t.textMuted }}>Recent activity</div>
        {history && history.length > 0 ? history.map((h, i) => (
          <div key={i} className="flex items-center justify-between gap-2.5 py-2.5 px-0.5" style={{ borderTop: i > 0 ? `1px solid ${brd}` : 'none' }}>
            <div className="text-[12px] truncate min-w-0" style={{ color: t.textSoft }}>
              {h.label} · {h.refType} <span className="m text-[11px]" style={{ color: t.textMuted }}>{h.ref}</span>
            </div>
            <div className="m text-[12.5px] font-bold whitespace-nowrap" style={{ color: h.pts > 0 ? t.green : t.text }}>
              {h.pts > 0 ? '+' : ''}{h.pts.toLocaleString()} pts
            </div>
          </div>
        )) : (
          <div className="text-[12px] py-2" style={{ color: t.textMuted }}>Your points activity will appear here after your next order.</div>
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
