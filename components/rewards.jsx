'use client';
import { Modal } from './ui-primitives';
import { SkelFacts, SkelList } from './skeleton';
// ─────────────────────────────────────────────────────────────────
// Nitro Rewards UI — Nitro Status + Nitro Points + Tasks strip,
// detail modals, and the Wallet compact card.
// Design reference: Marketing mockup "Nitro Rewards Phase 1 Home Cards"
// (approved by Trip, 11 Jul 2026).
//
// Data comes from /api/rewards. Shape is locked:
//   rewards.status { key,name,eligibleSpend,currentMin,nextName,nextMin,
//                    remainingToNext,progressPct,discountPct,pointEarnPct }
//   rewards.points { balance,valueNaira,minRedeem,redeemable,neededToRedeem }
//   rewards.tasks  { available, topReward }   (strip cell gated by TASKS_ENABLED)
//
// Wording rules (locked): "Nitro Status", "Nitro Points",
// "Nitro Status discount" (never "loyalty"), 1 point = ₦1, min redeem 2,000.
// ─────────────────────────────────────────────────────────────────

export const TASKS_ENABLED = true;

export const STATUS_TIERS = [
  { key: 'spark',  name: 'Spark',  min: 0,        minLabel: '₦0+',     discountPct: 0,   pointEarnPct: 0.5,  color: '#9ca3af' },
  { key: 'pulse',  name: 'Pulse',  min: 100000,   minLabel: '₦100k+',  discountPct: 0.5, pointEarnPct: 1,    color: '#60a5fa' },
  { key: 'boost',  name: 'Boost',  min: 500000,   minLabel: '₦500k+',  discountPct: 1,   pointEarnPct: 1.25, color: '#a78bfa' },
  { key: 'surge',  name: 'Surge',  min: 2000000,  minLabel: '₦2m+',    discountPct: 2,   pointEarnPct: 1.5,  color: '#f472b6' },
  { key: 'apex',   name: 'Apex',   min: 7500000,  minLabel: '₦7.5m+',  discountPct: 3,   pointEarnPct: 1.75, color: '#fb923c' },
  { key: 'legend', name: 'Legend', min: 15000000, minLabel: '₦15m+',   discountPct: 4,   pointEarnPct: 2,    color: '#fbbf24' },
];

export const WHATSAPP_CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb8hC6rJ3jv7Ig2m3D3Q';

// Compact naira for tight strip lines: ₦2.43m, ₦100k. Full figures live in modals.
export function fmtCompactNaira(n) {
  if (n >= 1000000) return `₦${parseFloat((n / 1000000).toFixed(2))}m`;
  if (n >= 1000) return `₦${parseFloat((n / 1000).toFixed(1))}k`;
  return `₦${n.toLocaleString()}`;
}

function fmtHistDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtPoints(n) {
  return (Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
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
    <button onClick={onClick} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-transparent border-none cursor-pointer p-0 font-[inherit] hover:underline" style={{ color: t.accent }}>
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
  const blue = dark ? '#60a5fa' : '#2563eb';
  // Three cards in the colours the strip always had: the tier's own for Status, gold for Points, blue for Tasks.
  const Card = ({ clr, grad, onClick, label, glyph, value, hint, pct, barTo }) => (
    <button onClick={onClick} className="relative overflow-hidden flex flex-col items-start gap-[2px] rounded-xl py-2.5 px-2.5 min-w-0 text-left border border-solid cursor-pointer font-[inherit] transition-transform duration-150 hover:-translate-y-px" style={{ background: dark ? `${clr}1f` : `${clr}14`, borderColor: `${clr}${dark ? '4d' : '40'}` }}>
      <span className="inline-flex items-center gap-2 mb-1"><ChipIcon gradient={grad} shadow={`0 3px 10px ${clr}30`} size={28} radius={9}>{glyph}</ChipIcon><span className="text-[11px] font-bold uppercase tracking-[.8px]" style={{ color: clr, opacity: .7 }}>{label}</span></span>
      <span className="text-[16px] font-extrabold truncate max-w-full" style={{ color: clr }}>{value}</span>
      <span className="text-[10.5px] truncate max-w-full" style={{ color: t.textMuted }}>{hint}</span>
      {pct != null && <span className="absolute left-0 right-0 bottom-0 h-[3px]" style={{ background: `${clr}20` }}><span className="block h-full" style={{ width: `${Math.max(3, Math.min(100, pct))}%`, background: `linear-gradient(90deg, ${clr}, ${barTo || clr})` }} /></span>}
    </button>
  );
  return (
    <div className={`grid gap-1.5 mb-[18px] ${TASKS_ENABLED && tasks ? 'grid-cols-3' : 'grid-cols-2'}`}>
      <Card clr={heroClr} grad={`linear-gradient(135deg,${heroClr},${heroClr}cc)`} barTo={barClr} onClick={onStatus} label="Status" glyph={<CrownGlyph s={14} />} value={status.name} hint={nextTier ? `${fmtCompactNaira(status.remainingToNext)} to ${nextTier.name}` : `${fmtCompactNaira(status.eligibleSpend)} spent`} pct={nextTier ? status.progressPct : 100} />
      <Card clr={gold} grad="linear-gradient(135deg,#fbbf24,#d97706)" onClick={onPoints} label="Points" glyph={<CoinGlyph s={14} />} value={<span className="m">{points.balance.toLocaleString()} <span className="text-[11px] font-semibold">pts</span></span>} hint={points.redeemable ? `≈ ₦${points.valueNaira.toLocaleString()} ready` : `${points.neededToRedeem.toLocaleString()} more to spend`} pct={points.redeemable ? null : Math.round(points.balance / points.minRedeem * 100)} />
      {TASKS_ENABLED && tasks && <Card clr={blue} grad="linear-gradient(135deg,#60a5fa,#2563eb)" onClick={onTasks} label="Tasks" glyph={<TaskGlyph s={14} />} value={<span><span className="m">{tasks.available}</span> open</span>} hint={`up to ₦${tasks.topReward.toLocaleString()} credit`} />}
    </div>
  );
}

/* ── REWARDS: the page ── */

const KICKER = 'text-[10px] font-bold uppercase tracking-[1.6px]';

const railLine = (dark) => (dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.055)');
const trackBg = (dark) => (dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.055)');

function CardHead({ t, title, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-2.5 py-[15px] px-5 max-md:px-4" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
      <div className="text-[13px] font-bold" style={{ color: t.text }}>{title}</div>
      {hint && <div className="text-[11.5px]" style={{ color: t.textMuted }}>{hint}</div>}
    </div>
  );
}

function RewardsPageSkeleton({ dark }) {
  return (
    <div className="flex flex-col gap-3.5">
      <SkelFacts dark={dark} n={2} />
      <div className="grid grid-cols-[1fr_1.3fr] max-md:grid-cols-1 gap-3.5">
        <SkelList dark={dark} rows={2} header={false} avatar="square" rowH={64} />
        <SkelList dark={dark} rows={3} header={false} avatar="square" rowH={64} />
      </div>
      <SkelList dark={dark} rows={6} title header={false} avatar={false} rowH={52} />
      <SkelList dark={dark} rows={5} title header={false} avatar={false} rowH={58} />
    </div>
  );
}

// The whole page in the tier's colour: the rule at the top runs from where you
// are into where you are going, and the ladder repeats that in miniature.
export function RewardsPage({ rewards, dark, t, setActive, onUsePoints }) {
  if (!rewards) return <RewardsPageSkeleton dark={dark} />;
  const { status, points, tasks, history } = rewards;
  const curIdx = Math.max(0, STATUS_TIERS.findIndex(ti => ti.key === status.key));
  const curTier = STATUS_TIERS[curIdx];
  const nextTier = curIdx < STATUS_TIERS.length - 1 ? STATUS_TIERS[curIdx + 1] : null;
  const heroClr = curTier.key === 'spark' ? '#c47d8e' : curTier.color;
  const nextClr = nextTier ? nextTier.color : heroClr;
  const gold = dark ? '#fbbf24' : '#d97706';
  const green = dark ? '#6ee7b7' : '#059669';
  const amber = dark ? '#fbbf24' : '#b45309';
  const red = dark ? '#fca5a5' : '#c62828';
  const rail = railLine(dark);
  const card = { background: t.cardBg, border: `1px solid ${t.cardBorder}` };
  const showTasks = TASKS_ENABLED && !!tasks;
  const rows = history || [];

  return (
    <>
      <div className="pb-3.5 max-md:pb-3">
        <div className="serif text-[32px] max-md:text-[26px] font-semibold leading-none tracking-[-.015em]" style={{ color: t.text }}>Rewards</div>
        <div className="text-[13px] mt-1.5" style={{ color: t.textMuted }}>What using Nitro gives you back.</div>
      </div>

      {/* ── Status hero ── */}
      <div className="relative rounded-[20px] overflow-hidden mb-3.5" style={card}>
        <div className="absolute left-0 right-0 top-0 h-[5px]" style={{ background: `linear-gradient(90deg, ${heroClr}, ${nextClr})` }} />
        <div className="flex items-start justify-between gap-5 pt-[26px] px-[26px] pb-5 max-md:flex-col max-md:gap-3 max-md:pt-[22px] max-md:px-5 max-md:pb-[18px]" style={{ background: `linear-gradient(135deg, ${heroClr}${dark ? '2b' : '24'}, transparent 66%)` }}>
          <div className="flex flex-col items-start min-w-0">
            <ChipIcon gradient={`linear-gradient(135deg,${heroClr},${heroClr}cc)`} shadow={`0 3px 10px ${heroClr}55`} size={34} radius={10}><CrownGlyph s={17} /></ChipIcon>
            <div className={`${KICKER} mt-3`} style={{ color: t.textMuted }}>Nitro Status</div>
            <div className="serif text-[58px] max-md:text-[46px] font-semibold leading-[.92] tracking-[-.025em] mt-1.5" style={{ color: heroClr }}>{status.name}</div>
            <p className="text-[14px] leading-[1.55] mt-3 mb-0 max-w-[52ch]" style={{ color: t.textMuted }}>
              {status.discountPct > 0 && <><b className="m text-[15px] font-bold" style={{ color: t.text }}>{status.discountPct}%</b> off every order · </>}
              <b className="m text-[15px] font-bold" style={{ color: t.text }}>{status.pointEarnPct}%</b> of what you spend comes back as points
            </p>
          </div>
          {nextTier && (
            <span className="text-[11.5px] font-bold rounded-full py-1.5 px-3 shrink-0 whitespace-nowrap" style={{ color: nextClr, background: `${nextClr}${dark ? '2b' : '26'}` }}>Next: {nextTier.name}</span>
          )}
        </div>
        <div className="px-[26px] pb-[22px] max-md:px-5 max-md:pb-5">
          {nextTier && (
            <div className="h-[9px] rounded-[5px] overflow-hidden" style={{ background: trackBg(dark) }}>
              <div className="h-full rounded-[5px]" style={{ width: `${Math.max(3, Math.min(100, status.progressPct))}%`, background: `linear-gradient(90deg, ${heroClr}, ${nextClr})` }} />
            </div>
          )}
          <div className="flex justify-between gap-3 mt-[11px] text-[12.5px] max-md:flex-col max-md:gap-[3px]" style={{ color: t.textMuted }}>
            <span><b className="m text-[14.5px] font-bold" style={{ color: t.text }}>{fmtCompactNaira(status.eligibleSpend)}</b> counted so far</span>
            {nextTier && <span><b className="m text-[14.5px] font-bold" style={{ color: t.text }}>{fmtCompactNaira(status.remainingToNext)}</b> to {nextTier.name}</span>}
          </div>
        </div>
      </div>

      {/* ── Points (gold) and Tasks (blue) ── */}
      <div className={`grid gap-3.5 mb-3.5 items-stretch ${showTasks ? 'grid-cols-[1fr_1.3fr] max-md:grid-cols-1' : 'grid-cols-1'}`}>
        <div className="relative rounded-[18px] overflow-hidden flex flex-col p-[22px] max-md:p-5" style={card}>
          <div className="absolute left-0 right-0 top-0 h-1" style={{ background: 'linear-gradient(90deg,#fbbf24,#d97706)' }} />
          <div className="flex items-center gap-[11px]">
            <ChipIcon gradient="linear-gradient(135deg,#fbbf24,#d97706)" shadow="0 3px 10px rgba(217,119,6,.35)" size={30} radius={9}><CoinGlyph s={15} /></ChipIcon>
            <span className={KICKER} style={{ color: t.textMuted }}>Nitro Points</span>
          </div>
          <b className="m text-[52px] max-md:text-[44px] font-extrabold leading-none tracking-[-.045em] mt-4 mb-1" style={{ background: 'linear-gradient(135deg,#fbbf24,#d97706)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{points.balance.toLocaleString()}</b>
          <span className="text-[12.5px]" style={{ color: t.textMuted }}>worth ₦{points.valueNaira.toLocaleString()} off your next order</span>
          {points.redeemable ? (
            <button onClick={onUsePoints} className="w-full h-10 mt-[18px] border-none rounded-xl text-white text-[13px] font-bold font-[inherit] cursor-pointer transition-transform duration-150 hover:-translate-y-px" style={{ background: 'linear-gradient(135deg,#fbbf24,#d97706)', boxShadow: '0 4px 14px rgba(217,119,6,.32)' }}>
              Use them on an order
            </button>
          ) : (
            <div className="rounded-xl py-3 px-3.5 mt-[18px]" style={{ background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)', border: `1px solid ${t.cardBorder}` }}>
              <div className="text-[11.5px]" style={{ color: t.textSoft }}>Earn <b style={{ color: gold }}>{points.neededToRedeem.toLocaleString()} more</b> points to start spending</div>
              <div className="h-1 rounded-full overflow-hidden mt-2" style={{ background: trackBg(dark) }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(points.balance / points.minRedeem * 100))}%`, background: gold }} />
              </div>
            </div>
          )}
          <p className="text-[11.5px] leading-[1.5] mt-3 mb-0" style={{ color: t.textMuted }}>Earned on every completed order. Spend from {points.minRedeem.toLocaleString()} points.</p>
        </div>

        {showTasks && (
          <div className="relative rounded-[18px] overflow-hidden flex flex-col" style={card}>
            <div className="absolute left-0 right-0 top-0 h-1" style={{ background: 'linear-gradient(90deg,#60a5fa,#2563eb)' }} />
            <div className="flex items-center gap-[11px] py-4 px-[18px]" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
              <ChipIcon gradient="linear-gradient(135deg,#60a5fa,#2563eb)" shadow="0 3px 10px rgba(37,99,235,.32)" size={30} radius={9}><TaskGlyph s={15} /></ChipIcon>
              <span className={KICKER} style={{ color: t.textMuted }}>Earn without spending</span>
              <span className="ml-auto"><CellLink t={t} onClick={() => setActive?.('tasks')}>All tasks</CellLink></span>
            </div>
            {/* The payload carries the first few open tasks; the count is the fallback. */}
            <div className="flex items-center gap-3 py-[13px] px-[18px]">
              {tasks.available > 0 ? (
                <>
                  <span className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <b className="text-[13.5px] font-semibold" style={{ color: t.text }}>{tasks.available} task{tasks.available === 1 ? '' : 's'} open</b>
                    <i className="not-italic text-[12px]" style={{ color: t.textMuted }}>Follow, share or review — the credit lands once we check it.</i>
                  </span>
                  <b className="m text-[13.5px] font-bold whitespace-nowrap" style={{ color: green }}>up to ₦{tasks.topReward.toLocaleString()}</b>
                  <button onClick={() => setActive?.('tasks')} className="h-[31px] px-3 rounded-[10px] text-[12px] font-semibold font-[inherit] cursor-pointer" style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.text }}>Do it</button>
                </>
              ) : (
                <span className="flex flex-col gap-0.5">
                  <b className="text-[13.5px] font-semibold" style={{ color: t.text }}>No tasks open right now</b>
                  <i className="not-italic text-[12px]" style={{ color: t.textMuted }}>New ones land every few weeks.</i>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Status ladder ── */}
      <div className="rounded-[18px] overflow-hidden mb-3.5" style={card}>
        <CardHead t={t} title="Status ladder" hint="spend more, pay less, earn faster" />
        <div className="flex items-center gap-3.5 py-2.5 px-5 max-md:hidden text-[10px] font-bold uppercase tracking-[1.1px]" style={{ borderBottom: `1px solid ${t.cardBorder}`, color: t.textMuted }}>
          <span className="w-[26px] shrink-0" />
          <span className="flex-1 min-w-0">Tier</span>
          <span className="flex-1 min-w-0">Reach it at</span>
          <span className="w-[100px] text-right shrink-0">Discount</span>
          <span className="w-[100px] text-right shrink-0">Points back</span>
        </div>
        <div className="flex flex-col py-0.5">
          {STATUS_TIERS.map((tier, idx) => {
            const isNow = idx === curIdx;
            return (
              <div key={tier.key} className="flex items-center gap-3.5 py-3 px-5 max-md:px-4" style={{ opacity: idx < curIdx ? 0.42 : 1, background: isNow ? `${tier.color}${dark ? '1a' : '17'}` : 'transparent' }}>
                <span className="relative w-[26px] shrink-0 self-stretch flex items-center justify-center">
                  <span className="w-[13px] h-[13px] rounded-full" style={{ background: tier.color, boxShadow: `0 0 0 4px ${tier.color}2e` }} />
                  {idx < STATUS_TIERS.length - 1 && <span className="absolute left-1/2 w-[2px] -translate-x-1/2" style={{ top: 'calc(50% + 9px)', bottom: -13, background: rail }} />}
                </span>
                <div className="flex-1 min-w-0 flex items-center gap-3.5 max-md:flex-col max-md:items-start max-md:gap-[3px]">
                  <span className="flex-1 min-w-0 flex items-center gap-2.5 max-md:w-full">
                    <b className="text-[15px]" style={{ color: tier.color, fontWeight: isNow ? 750 : 600 }}>{tier.name}</b>
                    {isNow && <span className="text-[9.5px] font-bold uppercase tracking-[.9px] rounded-full py-[3px] px-[9px] whitespace-nowrap text-white" style={{ background: tier.color }}>You are here</span>}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-[13px] max-md:text-[12px]" style={{ color: t.textMuted }}>{tier.min === 0 ? 'Your first order' : `₦${tier.min.toLocaleString()} spent`}</span>
                </div>
                <div className="flex items-center gap-3.5 shrink-0 max-md:flex-col max-md:items-end max-md:gap-[3px]">
                  <span className="m w-[100px] max-md:w-auto text-right text-[14.5px] font-bold" style={{ color: t.text }}>{tier.discountPct > 0 ? `${tier.discountPct}%` : '—'}</span>
                  <span className="m w-[100px] max-md:w-auto text-right text-[14.5px] max-md:text-[12.5px] font-bold" style={{ color: t.text }}>{tier.pointEarnPct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Points history — the latest entries the API returns, unpaged ── */}
      <div className="rounded-[18px] overflow-hidden" style={card}>
        <CardHead t={t} title="Points history" hint={rows.length ? `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}` : null} />
        {rows.length ? rows.map((h, i) => {
          const kind = h.kind === 'spent' ? 'spent' : h.kind === 'reversed' ? 'reversed' : 'earned';
          const clr = kind === 'earned' ? green : kind === 'spent' ? amber : red;
          return (
            <div key={i} className="flex items-center gap-3 py-3 px-5 max-md:px-4" style={{ borderTop: i ? `1px solid ${rail}` : 'none' }}>
              <span className="text-[9.5px] font-bold uppercase tracking-[.9px] rounded-full py-1 w-[82px] max-md:w-[70px] text-center shrink-0" style={{ background: `${clr}${dark ? '26' : '1f'}`, color: clr }}>{kind}</span>
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <b className="text-[13.5px] font-semibold truncate" style={{ color: t.text }}>{h.detail || h.label}</b>
                <i className="m not-italic text-[11px] truncate" style={{ color: t.textMuted }}>{h.ref}{h.at ? ` · ${fmtHistDate(h.at)}` : ''}</i>
              </span>
              <b className="m text-[14px] font-bold text-right whitespace-nowrap" style={{ color: clr }}>{h.pts > 0 ? '+' : ''}{fmtPoints(h.pts)}</b>
            </div>
          );
        }) : (
          <div className="text-[12px] py-7 text-center" style={{ color: t.textMuted }}>Points activity will appear here after your first order.</div>
        )}
      </div>
    </>
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
            <div className="text-[13px] max-md:text-[13px] font-extrabold leading-snug">{c.title}</div>
            <div className="text-[11px] max-md:text-[11px] font-medium mt-[2px] opacity-[.88]">{c.sub}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

/* ── modal shell (matches the How-it-works popup exactly) ── */

function ModalShell({ open, onClose, dark, t, title, children }) {
  return (
    <Modal open={open} onClose={onClose} dark={dark} maxWidth={420} title={title} bare>
      <div className="py-4 px-5 flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
        <div className="serif text-[21px] font-semibold leading-none" style={{ color: t.text }}>{title}</div>
        <button onClick={onClose} aria-label="Close" className="w-7 h-7 rounded-lg flex items-center justify-center border border-solid cursor-pointer bg-transparent" style={{ borderColor: dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.14)', color: t.textSoft }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div className="py-5 px-5 overflow-y-auto min-h-0">{children}</div>
    </Modal>
  );
}

/* ── the link both pop-ups end with ── */

function SeeAllLink({ t, onClick }) {
  return (
    <button onClick={onClick} className="block w-full bg-transparent border-none cursor-pointer font-[inherit] text-[12.5px] font-semibold text-center pt-4 hover:underline" style={{ color: t.accent }}>
      See everything in Rewards ›
    </button>
  );
}

/* ── Nitro Status modal ── */

export function StatusModal({ open, onClose, rewards, dark, t, setActive }) {
  if (!open || !rewards) return null;
  const { status } = rewards;
  const curIdx = Math.max(0, STATUS_TIERS.findIndex(ti => ti.key === status.key));
  const curTier = STATUS_TIERS[curIdx];
  const nextTier = curIdx < STATUS_TIERS.length - 1 ? STATUS_TIERS[curIdx + 1] : null;
  const heroClr = curTier.key === 'spark' ? '#c47d8e' : curTier.color;
  const nextClr = nextTier ? nextTier.color : heroClr;
  const rail = railLine(dark);
  return (
    <ModalShell open={open} onClose={onClose} dark={dark} t={t} title="Nitro Status">
      <div className="flex items-center gap-3.5 rounded-[15px] p-4" style={{ background: `${heroClr}${dark ? '1a' : '12'}`, border: `1px solid ${heroClr}${dark ? '40' : '33'}` }}>
        <ChipIcon gradient={`linear-gradient(135deg,${heroClr},${heroClr}cc)`} shadow={`0 4px 12px ${heroClr}45`} size={40} radius={11}><CrownGlyph s={19} /></ChipIcon>
        <div className="flex flex-col gap-[3px] min-w-0">
          <div className="serif text-[30px] font-semibold leading-none" style={{ color: heroClr }}>{status.name}</div>
          <div className="text-[12.5px]" style={{ color: t.textMuted }}>
            {status.discountPct > 0 && <><b className="m font-bold" style={{ color: t.text }}>{status.discountPct}%</b> off · </>}
            <b className="m font-bold" style={{ color: t.text }}>{status.pointEarnPct}%</b> points on every order
          </div>
        </div>
      </div>

      {nextTier && (
        <div className="flex flex-col gap-2 mt-3.5">
          <div className="flex items-baseline justify-between gap-3 text-[12.5px]" style={{ color: t.textMuted }}>
            <span>Progress to <b style={{ color: nextClr }}>{nextTier.name}</b></span>
            <span className="m font-bold whitespace-nowrap" style={{ color: t.text }}>{fmtCompactNaira(status.remainingToNext)} to go</span>
          </div>
          <div className="h-[9px] rounded-[5px] overflow-hidden" style={{ background: trackBg(dark) }}>
            <div className="h-full rounded-[5px] transition-[width] duration-500" style={{ width: `${Math.max(3, Math.min(100, status.progressPct))}%`, background: `linear-gradient(90deg, ${heroClr}, ${nextClr})` }} />
          </div>
          <div className="text-[12px]" style={{ color: t.textMuted }}>
            <b className="m font-bold" style={{ color: t.text }}>₦{status.eligibleSpend.toLocaleString()}</b> of <span className="m">₦{status.nextMin.toLocaleString()}</span>
          </div>
        </div>
      )}

      <p className="text-[12.5px] leading-[1.55] mt-3.5 mb-0" style={{ color: t.textSoft }}>
        Spend more to unlock higher tiers — bigger discounts, more points back.
      </p>

      <div className="flex flex-col rounded-[14px] overflow-hidden mt-3.5" style={{ border: `1px solid ${t.cardBorder}` }}>
        {STATUS_TIERS.map((tier, idx) => (
          <div key={tier.key} className="flex items-center gap-2.5 py-[9px] px-[13px] text-[12.5px]" style={{ borderTop: idx ? `1px solid ${rail}` : 'none', opacity: idx < curIdx ? 0.42 : 1, background: idx === curIdx ? `${tier.color}${dark ? '1a' : '17'}` : 'transparent' }}>
            <span className="w-[9px] h-[9px] rounded-full shrink-0" style={{ background: tier.color }} />
            <b className="font-bold" style={{ color: tier.color }}>{tier.name}</b>
            <span className="ml-auto text-[11.5px] shrink-0" style={{ color: t.textMuted }}>{tier.minLabel}</span>
            <span className="m text-[11.5px] font-bold whitespace-nowrap shrink-0" style={{ color: t.text }}>{tier.discountPct > 0 ? `${tier.discountPct}%` : '—'} off</span>
            <span className="m text-[11.5px] font-bold whitespace-nowrap shrink-0" style={{ color: t.text }}>{tier.pointEarnPct}% back</span>
          </div>
        ))}
      </div>

      {setActive && <SeeAllLink t={t} onClick={() => { onClose?.(); setActive('rewards'); }} />}
    </ModalShell>
  );
}

/* ── Nitro Points modal ── */

export function PointsModal({ open, onClose, rewards, dark, t, onUse, setActive }) {
  if (!open || !rewards) return null;
  const { points, history, status } = rewards;
  const gold = dark ? '#fbbf24' : '#d97706';
  const green = dark ? '#6ee7b7' : '#059669';
  const amber = dark ? '#fbbf24' : '#b45309';
  const red = dark ? '#fca5a5' : '#c62828';
  const recent = (history || []).slice(0, 3);
  return (
    <ModalShell open={open} onClose={onClose} dark={dark} t={t} title="Nitro Points">
      <div className="flex items-center gap-3.5 rounded-[15px] p-4" style={{ background: dark ? 'rgba(251,191,36,.09)' : 'rgba(251,191,36,.1)', border: `1px solid ${dark ? 'rgba(251,191,36,.28)' : 'rgba(217,119,6,.22)'}` }}>
        <ChipIcon gradient="linear-gradient(135deg,#fbbf24,#d97706)" shadow="0 5px 12px rgba(217,119,6,.3)" size={40} radius={11}><CoinGlyph s={19} /></ChipIcon>
        <div className="flex flex-col gap-[3px] min-w-0">
          <div className="m text-[29px] font-extrabold leading-none tracking-[-.03em]" style={{ color: gold }}>
            {points.balance.toLocaleString()} <span className="text-[14px] font-bold">pts</span>
          </div>
          <div className="text-[12.5px]" style={{ color: t.textMuted }}>≈ ₦{points.valueNaira.toLocaleString()} · 1 point = ₦1</div>
        </div>
      </div>

      <p className="text-[12.5px] leading-[1.55] mt-3.5 mb-0" style={{ color: t.textSoft }}>
        Every order earns points. Once you reach {points.minRedeem.toLocaleString()} you can spend them like cash on your next order.
      </p>

      <div className="grid grid-cols-2 gap-2.5 mt-3.5">
        <div className="flex flex-col rounded-[13px] py-3 px-3.5" style={{ background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)', border: `1px solid ${t.cardBorder}` }}>
          <span className={KICKER} style={{ color: t.textMuted }}>Earn rate</span>
          <b className="m text-[21px] font-extrabold tracking-[-.02em] mt-[3px]" style={{ color: gold }}>{status?.pointEarnPct ?? 0.5}%</b>
          <span className="text-[11.5px]" style={{ color: t.textMuted }}>of every order</span>
        </div>
        <div className="flex flex-col rounded-[13px] py-3 px-3.5" style={{ background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)', border: `1px solid ${t.cardBorder}` }}>
          <span className={KICKER} style={{ color: t.textMuted }}>Minimum to spend</span>
          <b className="m text-[21px] font-extrabold tracking-[-.02em] mt-[3px]" style={{ color: t.text }}>{points.minRedeem.toLocaleString()}</b>
          <span className="text-[11.5px]" style={{ color: t.textMuted }}>points</span>
        </div>
      </div>

      <div className="mt-3.5">
        {points.redeemable ? (
          <button onClick={onUse} className="block w-full h-11 border-none rounded-xl text-white text-[13px] font-bold font-[inherit] cursor-pointer transition-transform duration-150 hover:-translate-y-px" style={{ background: 'linear-gradient(135deg,#fbbf24,#d97706)', boxShadow: '0 4px 14px rgba(217,119,6,.32)' }}>
            Use on next order
          </button>
        ) : (
          <div className="rounded-xl py-3 px-3.5 text-center" style={{ background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)', border: `1px solid ${t.cardBorder}` }}>
            <div className="text-[11.5px]" style={{ color: t.textSoft }}>
              Earn <b style={{ color: gold }}>{points.neededToRedeem.toLocaleString()} more</b> points to start spending
            </div>
            <div className="h-1 rounded-full overflow-hidden mt-2" style={{ background: trackBg(dark) }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(points.balance / points.minRedeem * 100))}%`, background: gold }} />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-[7px] mt-4">
        <span className={KICKER} style={{ color: t.textMuted }}>Recent</span>
        {recent.length ? recent.map((h, i) => {
          const kind = h.kind === 'spent' ? 'spent' : h.kind === 'reversed' ? 'reversed' : 'earned';
          const clr = kind === 'earned' ? green : kind === 'spent' ? amber : red;
          return (
            <div key={i} className="flex items-center gap-2.5 text-[12.5px]">
              <span className="text-[9.5px] font-bold uppercase tracking-[.9px] rounded-full py-1 w-[78px] text-center shrink-0" style={{ background: `${clr}${dark ? '26' : '1f'}`, color: clr }}>{kind}</span>
              <span className="flex-1 min-w-0 truncate" style={{ color: t.textMuted }}>{h.label} <span className="m">{h.ref}</span></span>
              <b className="m font-bold whitespace-nowrap" style={{ color: clr }}>{h.pts > 0 ? '+' : ''}{fmtPoints(h.pts)}</b>
            </div>
          );
        }) : (
          <div className="text-[12px] py-3 text-center rounded-lg" style={{ color: t.textMuted, background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)' }}>
            Points activity will appear here after your first order.
          </div>
        )}
      </div>

      {setActive && <SeeAllLink t={t} onClick={() => { onClose?.(); setActive('rewards'); }} />}
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
        <div className="text-[11px] font-bold uppercase tracking-[.7px]" style={{ color: t.textMuted }}>Nitro Points</div>
        <div className="m text-[15px] font-bold mt-[3px] truncate" style={{ color: t.text }}>
          {points.balance.toLocaleString()} pts{' '}
          <span className="font-semibold" style={{ color: points.redeemable ? t.green : t.textMuted }}>≈ ₦{points.valueNaira.toLocaleString()}</span>
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>Minimum to spend: <span className="m">{points.minRedeem.toLocaleString()}</span> pts</div>
      </div>
      <CellLink t={t} onClick={onView}>View points</CellLink>
    </div>
  );
}
