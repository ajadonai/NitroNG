'use client';
import { useMoney, useLocale, useT } from "./locale";
import { Modal } from './ui-primitives';
import { Bone } from './skeleton';
import { OffsetIcon } from "./offset-icons";
import { TaskIcon } from "./task-icon";
import { msg } from "../lib/i18n";
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
// Compaction is a naira habit: "₦2.43m" fits where the full figure will not.
// A converted total is already short, so outside naira it prints whole.
export function fmtCompactNaira(n, money, currency = "NGN") {
  if (money && currency !== "NGN") return money(n);
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

const CoinGlyph = ({ s = 13 }) => (
  <OffsetIcon name="star" size={s} color="#fff" />
);
const Chevron = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M9 6l6 6-6 6"/></svg>
);

function CellLink({ onClick, children }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-[11px] font-semibold bg-transparent border-none cursor-pointer p-0 font-[inherit] hover:underline" style={{ color: "var(--t-accent-ink)" }}>
      {children}<Chevron />
    </button>
  );
}

/* ── HOME: rewards strip ── */

/* The strip sits inside the home page's money card now (approved 17 Oct 2026):
   three cells under the balance, each opening its own window, one accent for
   all three and the tier's own colour kept as a dot beside its name. Logical
   properties: this sheet does not go through the RTL build plugin. */
const STRIP_CSS = `
.rw-cells{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--t-card-border)}
.rw-cells.two{grid-template-columns:repeat(2,minmax(0,1fr))}
.rw-cell{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0;padding:12px 16px 14px;border:0;border-inline-start:1px solid var(--t-card-border);background:none;font:inherit;color:inherit;text-align:start;cursor:pointer;transition:background-color .15s}
.rw-cell:first-child{border-inline-start:0}
.rw-cell:hover{background:color-mix(in srgb,var(--t-accent) 5%,transparent)}
.rw-ch{display:flex;align-items:center;gap:7px;width:100%;margin-bottom:5px;font-size:11.5px;font-weight:600;color:var(--t-text-muted)}
.rw-ch .ic-tile{width:22px;height:22px;border-radius:7px}
.rw-chev{margin-inline-start:auto;display:inline-flex;opacity:.7}
.rw-v{display:flex;align-items:center;gap:6px;max-width:100%;overflow:hidden;font-size:16px;font-weight:700;color:var(--t-text);white-space:nowrap}
.rw-v small{font-size:11px;font-weight:600;color:var(--t-text-muted)}
.rw-h{max-width:100%;font-size:11.5px;color:var(--t-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rw-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;background:var(--td);box-shadow:0 0 0 3px color-mix(in srgb,var(--td) 18%,transparent)}
.rw-pb{position:absolute;inset-inline:16px;bottom:0;height:3px;border-radius:2px 2px 0 0;background:var(--t-card-border);overflow:hidden}
.rw-pb i{display:block;height:100%;background:var(--t-accent)}
@media (max-width:767px){.rw-cell{padding:10px 10px 12px}.rw-ch{gap:5px;font-size:11px}.rw-chev{display:none}.rw-v{font-size:14.5px}.rw-h{font-size:10.5px}.rw-pb{inset-inline:10px}}
`;

export function RewardsStrip({ rewards, onStatus, onPoints, onTasks }) {
  const tr = useT();
  const money = useMoney();
  const currency = useLocale()?.currency ?? "NGN";
  if (!rewards) return null;
  const { status, points, tasks } = rewards;
  const curTier = STATUS_TIERS.find(ti => ti.key === status.key) || STATUS_TIERS[0];
  const curIdx = STATUS_TIERS.indexOf(curTier);
  const nextTier = curIdx < STATUS_TIERS.length - 1 ? STATUS_TIERS[curIdx + 1] : null;
  const tierClr = curTier.key === 'spark' ? '#c47d8e' : curTier.color;
  const withTasks = TASKS_ENABLED && tasks;
  const Cell = ({ icon, label, onClick, children, hint, pct }) => (
    <button type="button" onClick={onClick} className="rw-cell">
      <span className="rw-ch"><span className="ic-tile"><OffsetIcon name={icon} size={12} /></span><span>{label}</span><span className="rw-chev"><Chevron /></span></span>
      <span className="rw-v">{children}</span>
      <span className="rw-h">{hint}</span>
      {pct != null && <span className="rw-pb"><i style={{ width: `${Math.max(3, Math.min(100, pct))}%` }} /></span>}
    </button>
  );
  return (
    <>
      <style>{STRIP_CSS}</style>
      <div className={`rw-cells${withTasks ? '' : ' two'}`}>
        <Cell icon="crown" label={tr("Status")} onClick={onStatus} hint={nextTier ? `${fmtCompactNaira(status.remainingToNext, money, currency)} ${tr("to")} ${nextTier.name}` : `${fmtCompactNaira(status.eligibleSpend, money, currency)} ${tr("spent")}`} pct={nextTier ? status.progressPct : 100}>
          {status.name}<span className="rw-dot" style={{ "--td": tierClr }} />
        </Cell>
        <Cell icon="star" label={tr("Points")} onClick={onPoints} hint={points.redeemable ? `≈ ${money(points.valueNaira, { round: "down" })} ${tr("ready")}` : `${points.neededToRedeem.toLocaleString()} ${tr("more to spend")}`} pct={points.redeemable ? null : Math.round(points.balance / points.minRedeem * 100)}>
          <span className="m">{points.balance.toLocaleString()}</span> <small className="m">pts</small>
        </Cell>
        {withTasks && <Cell icon="tasks" label={tr("Tasks")} onClick={onTasks} hint={`${tr("up to")} ${money(tasks.topReward, { round: "down" })}`}>
          <span className="m">{tasks.available}</span> {tr("open")}
        </Cell>}
      </div>
    </>
  );
}

/* ── REWARDS: the page ── */

/* The page in the offset print (approved 17 Oct 2026, mockup "Nitro Rewards
   and Tasks"). The status card is the status pop-up's tier-coloured card at
   page size, with crowns drifting behind it and a ring breathing round the
   crown; points are a printed gold card; the tasks card lists what is open;
   the ladder ticks the tiers you have passed. Logical properties: this sheet
   does not go through the RTL build plugin. */
const PAT_CROWN = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 30l4-14 7 7 6-10 6 10 7-7 4 14z"/><path d="M62 18l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/><circle cx="76" cy="62" r="5"/><path d="M24 70l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/><path d="M52 58l3-10 5 5 4-7 4 7 5-5 3 10z"/></svg>')}")`;
const RWP_CSS = `
/* A grid for the same reason as .rp-body: rows fit their content, so a card
   that hides its overflow can never be squashed by a shorter container. */
.rwp{display:grid;grid-template-columns:minmax(0,1fr);grid-auto-rows:max-content;align-content:start;gap:14px}
.rwp-hero{--vs:color-mix(in srgb,var(--tc) 50%,#000);position:relative;overflow:hidden;isolation:isolate;border-radius:20px;color:#fff;padding:22px 24px 20px;box-shadow:3px 3px 0 var(--vs);background:radial-gradient(90% 120% at 100% 0%,rgba(255,255,255,.3),transparent 60%),linear-gradient(150deg,color-mix(in srgb,var(--tc) 55%,#000) 0%,color-mix(in srgb,var(--tc) 82%,#000) 55%,var(--tc) 100%)}
.rwp-hero::before{content:"";position:absolute;inset:-96px 0 0 -96px;z-index:-1;background-image:${PAT_CROWN};background-size:96px 96px;opacity:.12;animation:rwpDrift 40s linear infinite}
@keyframes rwpDrift{to{transform:translate(96px,96px)}}
.rwp-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.rwp-glass{background:rgba(255,255,255,.16);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3),2px 2px 0 rgba(0,0,0,.18)}
.rwp-crown{position:relative;width:40px;height:40px;border-radius:13px;display:grid;place-items:center;flex-shrink:0}
.rwp-crown .ic-off{opacity:.3}
.rwp-crown::after{content:"";position:absolute;inset:-5px;border-radius:16px;border:2px solid rgba(255,255,255,.55);animation:rwpRing 2.8s ease-out infinite}
@keyframes rwpRing{0%{opacity:.9;transform:scale(.86)}100%{opacity:0;transform:scale(1.28)}}
.rwp-next{display:inline-flex;align-items:center;gap:7px;height:30px;padding-inline:9px 12px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;background:rgba(20,8,30,.24);box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)}
.rwp-next i{width:9px;height:9px;border-radius:50%;background:var(--nc);box-shadow:0 0 0 2px rgba(255,255,255,.55)}
.rwp-eb{display:block;margin-top:14px;font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:rgba(255,255,255,.75)}
.rwp-name{margin-top:4px;font-size:64px;font-weight:700;line-height:.9;letter-spacing:-.02em;text-shadow:0 2px 12px rgba(0,0,0,.18)}
.rwp-perks{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.rwp-perk{display:inline-flex;align-items:center;gap:6px;height:32px;padding-inline:12px;border-radius:999px;font-size:13px;font-weight:600}
.rwp-perk b{font-size:14px;font-weight:800}
.rwp-track{position:relative;height:10px;margin-top:22px;border-radius:6px;background:rgba(255,255,255,.2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
.rwp-track i{position:absolute;inset-block:0;inset-inline-start:0;border-radius:6px;background:#fff;box-shadow:2px 2px 0 rgba(0,0,0,.18)}
.rwp-cl{display:flex;justify-content:space-between;gap:10px;margin-top:10px;font-size:12.5px;color:rgba(255,255,255,.84)}
.rwp-cl b{font-size:13.5px;font-weight:800;color:#fff}
.rwp-card{border-radius:18px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #efc4cf}
.dark .rwp-card{box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #5e3242}
.rwp-ch{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--t-card-border)}
.rwp-ch b{font-size:13.5px;font-weight:700;color:var(--t-text)}
.rwp-ch small{margin-inline-start:auto;font-size:12px;color:var(--t-text-muted)}
.rwp-ch .ic-tile,.rwp-hd .ic-tile{width:30px;height:30px}
.rwp-lnk{margin-inline-start:auto;display:inline-flex;align-items:center;gap:4px;border:0;background:none;padding:0;font:inherit;font-size:12.5px;font-weight:650;color:var(--t-accent-ink);cursor:pointer}
.rwp-lnk:hover{text-decoration:underline}
/* minmax(0, …) so a column can be narrower than its longest line: a plain
   1fr cannot go below its content, and the task titles do not wrap. */
.rwp-row2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:14px;align-items:stretch}
.rwp-row2.one{grid-template-columns:minmax(0,1fr)}
.rwp-pts{padding:18px 20px;display:flex;flex-direction:column}
.rwp-hd{display:flex;align-items:center;gap:10px}
.rwp-k{font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--t-text-muted)}
.rwp-big{display:flex;align-items:baseline;gap:8px;margin-top:14px}
.rwp-big b{font-size:46px;font-weight:800;line-height:1;letter-spacing:-.04em;color:var(--t-text)}
.rwp-big small{font-size:13px;font-weight:700;color:var(--t-text-muted)}
.rwp-worth{margin-top:4px;font-size:13px;color:var(--t-text-soft)}
.rwp-gold{margin-top:16px;padding:12px 13px;border-radius:13px;background:rgba(245,207,89,.16);box-shadow:inset 0 0 0 1px rgba(184,134,42,.3)}
.rwp-gold .tx{font-size:12.5px;color:var(--t-text-soft)}
.rwp-gold .tx b{color:var(--t-text)}
.rwp-gbar{position:relative;height:8px;margin-top:9px;border-radius:5px;background:rgba(184,134,42,.18)}
.rwp-gbar i{position:absolute;inset-block:0;inset-inline-start:0;border-radius:5px;background:#f5cf59;box-shadow:1.5px 1.5px 0 #b8862a}
.rwp-gl{display:flex;justify-content:space-between;margin-top:6px;font-size:10.5px;font-weight:700;color:var(--t-text-muted)}
.rwp-use{margin-top:16px;height:42px;border:0;border-radius:999px;font:inherit;font-size:13.5px;font-weight:700;color:#4a2236;background:#f5cf59;box-shadow:2px 2px 0 #b8862a;cursor:pointer;transition:transform .15s}
.rwp-use:hover{transform:translateY(-1px)}
.rwp-use:focus-visible{outline:2px solid #c47d8e;outline-offset:3px}
.rwp-fine{margin:12px 0 0;font-size:11.5px;line-height:1.5;color:var(--t-text-muted)}
.rwp-tasks{display:flex;flex-direction:column}
.rwp-tr{width:100%;display:flex;align-items:center;gap:11px;padding:11px 16px;border:0;border-top:1px solid var(--t-card-border);background:none;font:inherit;color:inherit;text-align:start;cursor:pointer;transition:background-color .15s}
.rwp-ch + .rwp-tr{border-top:0}
.rwp-tr:hover{background:rgba(196,125,142,.05)}
.rwp-tr .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.rwp-tr .tx b{font-size:13.5px;font-weight:600;color:var(--t-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rwp-tr .tx small{font-size:11.5px;color:var(--t-text-muted)}
.rwp-none{padding:16px 18px;display:flex;flex-direction:column;gap:2px}
.rwp-none b{font-size:13.5px;font-weight:600;color:var(--t-text)}
.rwp-none small{font-size:12px;color:var(--t-text-muted)}
.rwp-foot{display:flex;justify-content:space-between;gap:10px;margin-top:auto;padding:11px 16px;border-top:1px solid var(--t-card-border);font-size:12px;color:var(--t-text-muted)}
.rwp-foot b{color:var(--t-text);font-weight:650}
.rwp-lad{padding:4px 0}
.rwp-lr{position:relative;display:grid;grid-template-columns:30px minmax(0,1fr) minmax(0,1fr) 92px 92px;align-items:center;gap:12px;padding:11px 18px}
.rwp-lr.hd{padding-block:9px;border-bottom:1px solid var(--t-card-border);font-size:10px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:var(--t-text-muted)}
.rwp-lr .n{text-align:end;font-size:14px;font-weight:800;color:var(--t-text)}
.rwp-lr .n.none{font-size:12.5px;font-weight:600;color:var(--t-text-muted)}
.rwp-lr.now{background:color-mix(in srgb,var(--rc) 12%,transparent)}
.rwp-lr.now::before{content:"";position:absolute;inset-block:8px;inset-inline-start:0;width:3px;border-start-end-radius:3px;border-end-end-radius:3px;background:var(--rc)}
.rwp-ld{justify-self:center;width:16px;height:16px;border-radius:50%;background:var(--rc);box-shadow:1.5px 1.5px 0 color-mix(in srgb,var(--rc) 45%,transparent)}
.rwp-ld.past{display:grid;place-items:center;width:20px;height:20px;color:var(--rc);background:color-mix(in srgb,var(--rc) 16%,transparent);box-shadow:inset 0 0 0 1.5px var(--rc)}
.rwp-who{display:contents}
.rwp-lnm{display:flex;align-items:center;gap:9px;min-width:0}
.rwp-lnm b{font-size:21px;font-weight:700;line-height:1;color:var(--rc)}
.rwp-here{font-size:9.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;padding:4px 8px;border-radius:6px;white-space:nowrap;color:#fff;background:var(--rc);box-shadow:1.5px 1.5px 0 color-mix(in srgb,var(--rc) 50%,#000)}
.rwp-reach{font-size:13px;color:var(--t-text-soft)}
.rwp-nums{display:contents}
.rwp-nl{display:none;margin-inline-end:5px;font-family:Outfit,system-ui,sans-serif;font-size:11px;font-weight:600;color:var(--t-text-muted)}
.rwp-hr{display:flex;align-items:center;gap:12px;padding:11px 18px;border-top:1px solid var(--t-card-border)}
.rwp-ch + .rwp-hr{border-top:0}
.rwp-hr .ic-tile{width:32px;height:32px}
.rwp-hr .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.rwp-hr .tx b{font-size:13.5px;font-weight:600;color:var(--t-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rwp-hr .tx small{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--t-text-muted)}
.rwp-hr .tx em{font-style:normal;font-size:9.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--kc)}
.rwp-hr .amt{display:flex;flex-direction:column;align-items:flex-end;gap:3px;white-space:nowrap}
.rwp-hr .amt b{font-size:14px;font-weight:800;color:var(--kc)}
.rwp-hr .amt small{font-size:11px;color:var(--t-text-muted)}
.rwp-empty{padding:28px 18px;text-align:center;font-size:12px;color:var(--t-text-muted)}
/* The loading state draws the same cards with bones where the content goes;
   the status card is one shimmering block with lighter shapes inside it. */
.rwp-skhero{border-radius:20px;padding:22px 24px 20px;display:flex;flex-direction:column;align-items:flex-start}
.rwp-gh{display:block;background:rgba(255,255,255,.6)}
.dark .rwp-gh{background:rgba(255,255,255,.07)}
.rwp-tr.sk{cursor:default}
.rwp-tr.sk:hover{background:none}
@media (max-width:767px){
  .rwp-hero{padding:18px 16px 16px}
  .rwp-name{font-size:50px}
  .rwp-cl{flex-direction:column;gap:3px}
  .rwp-row2{grid-template-columns:minmax(0,1fr)}
  .rwp-ch{padding:13px 14px}
  .rwp-tr,.rwp-hr,.rwp-foot{padding-inline:14px}
  .rwp-foot{flex-direction:column;gap:2px}
  .rwp-lr{grid-template-columns:26px minmax(0,1fr) auto;gap:10px;padding:11px 14px}
  .rwp-lr.hd{display:none}
  .rwp-who{display:block;min-width:0}
  .rwp-reach{display:block;margin-top:3px;font-size:11.5px;color:var(--t-text-muted)}
  .rwp-nums{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
  .rwp-lr .n{font-size:13px}
  .rwp-nl{display:inline}
  .rwp-skhero{padding:18px 16px 16px}
  .rwp-who .skel-bone + .skel-bone{margin-top:6px}
}
@media (prefers-reduced-motion:reduce){.rwp-hero::before,.rwp-crown::after{animation:none}}
`;

// The server sends a task's proof as one of these phrases; listed here so the
// dictionaries carry them.
const PROOF_HINT = { 'Paste the link': msg('Paste the link'), 'Paste your handle': msg('Paste your handle'), 'Send it on WhatsApp': msg('Send it on WhatsApp'), 'Paste what you wrote': msg('Paste what you wrote'), 'Send proof': msg('Send proof') };
const TICK = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;

// Shaped like the page it stands in for, card for card, so nothing moves when
// the data lands. It reuses the page's own layout classes, so it reflows the
// same way on a phone.
function RewardsPageSkeleton({ dark }) {
  const gh = (w, h, r, style) => <span className="rwp-gh" style={{ width: w, height: h, borderRadius: r, ...style }} />;
  return (
    <div className="rwp" aria-busy="true">
      <style>{RWP_CSS}</style>
      <div><Bone dark={dark} w={130} h={30} r={8} /><Bone dark={dark} w={210} h={12} style={{ marginTop: 10 }} /><div className="page-divider bg-t-card-border" /></div>
      <div className={`rwp-skhero skel-bone ${dark ? 'skel-dark' : 'skel-light'}`}>
        {gh(40, 40, 13)}
        {gh(90, 10, 5, { marginTop: 16 })}
        {gh(170, 50, 10, { marginTop: 8 })}
        <span className="flex flex-wrap gap-2 mt-3.5">{gh(150, 32, 999)}{gh(128, 32, 999)}</span>
        {gh('100%', 10, 6, { marginTop: 22 })}
        <span className="flex justify-between gap-3 w-full mt-2.5">{gh(150, 12, 5)}{gh(110, 12, 5)}</span>
      </div>
      <div className="rwp-row2">
        <div className="rwp-card rwp-pts">
          <div className="rwp-hd"><Bone dark={dark} w={30} h={30} r={10} /><Bone dark={dark} w={96} h={10} /></div>
          <Bone dark={dark} w={150} h={42} r={8} style={{ marginTop: 16 }} />
          <Bone dark={dark} w={200} h={12} style={{ marginTop: 10 }} />
          <Bone dark={dark} w="100%" h={66} r={13} style={{ marginTop: 16 }} />
          <Bone dark={dark} w="80%" h={10} style={{ marginTop: 14 }} />
        </div>
        <div className="rwp-card rwp-tasks">
          <div className="rwp-ch"><Bone dark={dark} w={30} h={30} r={10} /><Bone dark={dark} w={150} h={12} /><span className="ms-auto"><Bone dark={dark} w={64} h={12} /></span></div>
          {[62, 74, 86].map(w => (
            <div key={w} className="rwp-tr sk"><Bone dark={dark} w={34} h={34} r={10} /><span className="tx"><Bone dark={dark} w={`${w}%`} h={12} /><Bone dark={dark} w={96} h={10} /></span><Bone dark={dark} w={52} h={20} r={7} /></div>
          ))}
          <div className="rwp-foot"><Bone dark={dark} w={120} h={10} /><Bone dark={dark} w={150} h={10} /></div>
        </div>
      </div>
      <div className="rwp-card">
        <div className="rwp-ch"><Bone dark={dark} w={110} h={12} /><span className="ms-auto"><Bone dark={dark} w={170} h={10} /></span></div>
        <div className="rwp-lad">
          {STATUS_TIERS.map((tier, i) => (
            <div key={tier.key} className="rwp-lr">
              <Bone dark={dark} w={16} h={16} r={999} style={{ justifySelf: 'center' }} />
              <div className="rwp-who"><Bone dark={dark} w={70 + (i % 3) * 14} h={18} /><Bone dark={dark} w={120} h={11} /></div>
              <div className="rwp-nums"><Bone dark={dark} w={44} h={13} style={{ justifySelf: 'end' }} /><Bone dark={dark} w={44} h={13} style={{ justifySelf: 'end' }} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="rwp-card">
        <div className="rwp-ch"><Bone dark={dark} w={110} h={12} /><span className="ms-auto"><Bone dark={dark} w={60} h={10} /></span></div>
        {[58, 71, 49, 64, 77].map(w => (
          <div key={w} className="rwp-hr"><Bone dark={dark} w={32} h={32} r={10} /><span className="tx"><Bone dark={dark} w={`${w}%`} h={12} /><Bone dark={dark} w={120} h={10} /></span><span className="amt"><Bone dark={dark} w={44} h={13} /><Bone dark={dark} w={36} h={10} /></span></div>
        ))}
      </div>
    </div>
  );
}

export function RewardsPage({ rewards, dark, setActive, onUsePoints }) {
  const tr = useT();
  const money = useMoney();
  const currency = useLocale()?.currency ?? "NGN";
  if (!rewards) return <RewardsPageSkeleton dark={dark} />;
  const { status, points, tasks, history } = rewards;
  const curIdx = Math.max(0, STATUS_TIERS.findIndex(ti => ti.key === status.key));
  const curTier = STATUS_TIERS[curIdx];
  const nextTier = curIdx < STATUS_TIERS.length - 1 ? STATUS_TIERS[curIdx + 1] : null;
  // The same tier colour the status pop-up paints, so the two read as one card.
  const tone = (ti) => (ti.key === 'spark' ? '#c47d8e' : ti.color);
  const kinds = {
    earned: { icon: 'plusCircle', c: dark ? '#6ee7b7' : '#059669' },
    spent: { icon: 'minusCircle', c: dark ? '#fbbf24' : '#b45309' },
    reversed: { icon: 'refresh', c: dark ? '#fca5a5' : '#c62828' },
  };
  const showTasks = TASKS_ENABLED && !!tasks;
  const openList = tasks?.list || [];
  const rows = history || [];
  const pct = nextTier ? Math.max(3, Math.min(100, status.progressPct)) : 100;
  const ptsPct = Math.min(100, Math.round(points.balance / points.minRedeem * 100));
  const goTasks = () => setActive?.('tasks');

  return (
    <div className="rwp">
      <style>{RWP_CSS}</style>
      <div>
        <div className="serif text-[32px] max-md:text-[26px] font-semibold leading-none tracking-[-.015em] text-t-text">{tr("Rewards")}</div>
        <div className="text-[13px] mt-1.5 text-t-text-muted">{tr("What using Nitro gives you back.")}</div>
        <div className="page-divider bg-t-card-border" />
      </div>

      {/* Status, in the tier's own colour */}
      <div className="rwp-hero" style={{ "--tc": tone(curTier) }}>
        <div className="rwp-top">
          <span className="rwp-crown rwp-glass"><OffsetIcon name="crown" size={19} /></span>
          {nextTier && <span className="rwp-next" style={{ "--nc": tone(nextTier) }}><i aria-hidden="true" />{tr("Next:")} {nextTier.name}</span>}
        </div>
        <span className="rwp-eb">{tr("Nitro Status")}</span>
        <div className="rwp-name serif">{status.name}</div>
        <div className="rwp-perks">
          {status.discountPct > 0 && <span className="rwp-perk rwp-glass"><b className="m">{status.discountPct}%</b>{tr("off every order")}</span>}
          <span className="rwp-perk rwp-glass"><b className="m">{status.pointEarnPct}%</b>{tr("back in points")}</span>
        </div>
        <div className="rwp-track" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
        <div className="rwp-cl">
          <span><b className="m">{fmtCompactNaira(status.eligibleSpend, money, currency)}</b> {tr("counted so far")}</span>
          {nextTier
            ? <span><b className="m">{fmtCompactNaira(status.remainingToNext, money, currency)}</b> {tr("to")} {nextTier.name}</span>
            : <span>{tr("The top of the ladder")}</span>}
        </div>
      </div>

      {/* Points, in gold, and the tasks that pay */}
      <div className={`rwp-row2${showTasks ? '' : ' one'}`}>
        <div className="rwp-card rwp-pts">
          <div className="rwp-hd"><span className="ic-tile tc" style={{ "--tc": "#d97706" }}><OffsetIcon name="star" size={15} /></span><span className="rwp-k">{tr("Nitro Points")}</span></div>
          <div className="rwp-big"><b className="m">{points.balance.toLocaleString()}</b><small className="m">pts</small></div>
          <div className="rwp-worth">{tr("Worth")} {money(points.valueNaira, { round: "down" })} {tr("off your next order")}</div>
          {points.redeemable
            ? <button type="button" onClick={onUsePoints} className="rwp-use">{tr("Use them on an order")}</button>
            : <div className="rwp-gold">
              <div className="tx"><b className="m">{points.neededToRedeem.toLocaleString()}</b> {tr("more to start spending")}</div>
              <div className="rwp-gbar" aria-hidden="true"><i style={{ width: `${ptsPct}%` }} /></div>
              <div className="rwp-gl m"><span>0</span><span>{points.minRedeem.toLocaleString()}</span></div>
            </div>}
          <p className="rwp-fine">{tr("Earned on every completed order. Spend from")} {points.minRedeem.toLocaleString()} {tr("points.")}</p>
        </div>

        {showTasks && (
          <div className="rwp-card rwp-tasks">
            <div className="rwp-ch">
              <span className="ic-tile tc" style={{ "--tc": dark ? "#60a5fa" : "#2563eb" }}><OffsetIcon name="tasks" size={15} /></span>
              <b>{tr("Earn without spending")}</b>
              <button type="button" className="rwp-lnk" onClick={goTasks}>{tr("All tasks")}<Chevron /></button>
            </div>
            {tasks.available > 0 ? (
              <>
                {/* The rewards payload carries the first three open tasks. */}
                {openList.map(tk => (
                  <button key={tk.id} type="button" className="rwp-tr" onClick={goTasks}>
                    <TaskIcon platform={tk.platform} dark={dark} size={34} />
                    <span className="tx"><b>{tk.title}</b><small>{tr(PROOF_HINT[tk.hint] || tk.hint)}</small></span>
                    {tk.waiting
                      ? <span className="pbadge rev">{tr("In review")}</span>
                      : <span className="pbadge gold">{money(tk.reward, { round: "down" })}</span>}
                  </button>
                ))}
                <div className="rwp-foot">
                  <span><b>{tasks.available} {tr("open")}</b>, {tr("up to")} {money(tasks.topReward, { round: "down" })}</span>
                  <span>{tr("Credit lands once we check it")}</span>
                </div>
              </>
            ) : (
              <div className="rwp-none"><b>{tr("No tasks open right now")}</b><small>{tr("New ones land every few weeks.")}</small></div>
            )}
          </div>
        )}
      </div>

      {/* The ladder: passed tiers ticked, yours marked */}
      <div className="rwp-card">
        <div className="rwp-ch"><b>{tr("Status ladder")}</b><small>{tr("spend more, pay less, earn faster")}</small></div>
        <div className="rwp-lad">
          <div className="rwp-lr hd" aria-hidden="true"><span /><span>{tr("Tier")}</span><span>{tr("Reach it at")}</span><span className="text-end">{tr("Discount")}</span><span className="text-end">{tr("Points back")}</span></div>
          {STATUS_TIERS.map((tier, idx) => {
            const now = idx === curIdx;
            return (
              <div key={tier.key} className={`rwp-lr${now ? ' now' : ''}`} style={{ "--rc": tier.color }}>
                {idx < curIdx ? <span className="rwp-ld past">{TICK}</span> : <span className="rwp-ld" />}
                <div className="rwp-who">
                  <div className="rwp-lnm"><b className="serif">{tier.name}</b>{now && <span className="rwp-here">{tr("You are here")}</span>}</div>
                  <span className="rwp-reach">{tier.min === 0 ? tr("Your first order") : `${money(tier.min)} ${tr("spent")}`}</span>
                </div>
                <div className="rwp-nums">
                  <span className={`n m${tier.discountPct > 0 ? '' : ' none'}`}><span className="rwp-nl">{tr("Discount")}</span>{tier.discountPct > 0 ? `${tier.discountPct}%` : tr("None")}</span>
                  <span className="n m"><span className="rwp-nl">{tr("Points back")}</span>{tier.pointEarnPct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* History: the latest entries the API returns, unpaged */}
      <div className="rwp-card">
        <div className="rwp-ch"><b>{tr("Points history")}</b>{rows.length > 0 && <small>{rows.length} {rows.length === 1 ? tr("entry") : tr("entries")}</small>}</div>
        {rows.length ? rows.map((h, i) => {
          const kind = h.kind === 'spent' ? 'spent' : h.kind === 'reversed' ? 'reversed' : 'earned';
          const k = kinds[kind];
          return (
            <div key={i} className="rwp-hr" style={{ "--kc": k.c }}>
              <span className="ic-tile tc" style={{ "--tc": k.c }}><OffsetIcon name={k.icon} size={15} /></span>
              <span className="tx"><b>{h.detail ? tr(h.detail) : tr(h.label || KIND_LABEL[kind])}</b><small><em>{tr(KIND_LABEL[kind])}</em>{h.ref && <span className="m">{h.ref}</span>}</small></span>
              <span className="amt"><b className="m">{h.pts > 0 ? '+' : ''}{fmtPoints(h.pts)}</b>{h.at && <small>{fmtHistDate(h.at)}</small>}</span>
            </div>
          );
        }) : <div className="rwp-empty">{tr("Points activity will appear here after your first order.")}</div>}
      </div>
    </div>
  );
}

/* ── HOME: channel lane ── */

/* Stay updated, alive (approved 17 Oct 2026): each card in its own colour with
   something moving in it. A doodle pattern drifts behind WhatsApp, a ring
   pulses round its logo and a "typing" bubble waits; a paper plane flies a
   dashed trail across Telegram. All of it slow, and all of it stops for
   reduced motion. The patterns are fixed drawings, encoded once here. */
const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
export const PAT_WA = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12h22a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H19l-6 5v-5h-3a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z"/><path d="M56 24l4 4 8-9M63 24l4 4 8-9"/><circle cx="74" cy="68" r="6"/><path d="M22 60v10M17 65h10"/><path d="M48 44l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/><path d="M80 86h-14a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3z"/></svg>');
export const PAT_TG = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="white"><circle cx="12" cy="14" r="1.6"/><circle cx="60" cy="8" r="1.1"/><circle cx="84" cy="34" r="1.6"/><circle cx="34" cy="46" r="1.1"/><circle cx="70" cy="70" r="1.6"/><circle cx="18" cy="80" r="1.1"/><path d="M46 78l1.3 2.7 2.7 1.3-2.7 1.3-1.3 2.7-1.3-2.7-2.7-1.3 2.7-1.3z"/><path d="M88 84l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg>');
const LANE_CSS = `
.cl-lane{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.cl-lane.one{grid-template-columns:1fr}
.cl-card{position:relative;overflow:hidden;isolation:isolate;min-height:152px;padding:14px 16px 15px;display:flex;flex-direction:column;justify-content:space-between;border-radius:16px;color:#fff;text-decoration:none;box-shadow:3px 3px 0 var(--vs);transition:transform .2s}
.cl-card:hover{transform:translateY(-2px)}
.cl-card::before{content:"";position:absolute;inset:-96px 0 0 -96px;z-index:-1;background-image:var(--pat);background-size:96px 96px;opacity:.13;animation:clDrift 36s linear infinite}
@keyframes clDrift{to{transform:translate(96px,96px)}}
.cl-card.wa{--vs:#0c5440;--pat:${PAT_WA};background:radial-gradient(85% 120% at 100% 0%,rgba(90,255,170,.5),transparent 62%),linear-gradient(155deg,#0b5641 0%,#128c7e 50%,#1db75d 100%)}
.cl-card.tg{--vs:#16497d;--pat:${PAT_TG};background:radial-gradient(85% 120% at 100% 0%,rgba(150,225,255,.5),transparent 62%),linear-gradient(155deg,#164c86 0%,#1e84cc 52%,#39b5ef 100%)}
.dark .cl-card.wa{--vs:#1d6b53}
.dark .cl-card.tg{--vs:#225c95}
.cl-h{display:flex;align-items:flex-start;justify-content:space-between}
.cl-g{position:relative;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;flex-shrink:0;background:rgba(255,255,255,.18);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3),2px 2px 0 rgba(0,0,0,.16)}
.cl-g.live::after{content:"";position:absolute;inset:-5px;border-radius:15px;border:2px solid rgba(255,255,255,.6);animation:clRing 2.6s ease-out infinite}
@keyframes clRing{0%{opacity:.9;transform:scale(.86)}100%{opacity:0;transform:scale(1.28)}}
.cl-o{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.22)}
.cl-t b{display:block;font-size:15.5px;font-weight:750;letter-spacing:-.01em;text-shadow:0 1px 2px rgba(0,0,0,.14)}
.cl-t small{display:block;margin-top:2px;font-size:12px;opacity:.92}
.cl-bub{position:absolute;right:16px;top:58px;display:flex;gap:4px;padding:9px 11px;background:#fff;border-radius:13px 13px 13px 4px;box-shadow:2px 2px 0 rgba(0,0,0,.16)}
.cl-bub i{width:6px;height:6px;border-radius:50%;background:#128c7e;animation:clType 1.3s ease-in-out infinite}
.cl-bub i:nth-child(2){animation-delay:.18s}
.cl-bub i:nth-child(3){animation-delay:.36s}
@keyframes clType{0%,60%,100%{transform:none;opacity:.45}30%{transform:translateY(-3px);opacity:1}}
.cl-trail{position:absolute;right:6px;top:22px;width:190px;height:104px;z-index:-1}
.cl-dash{animation:clMarch 1.5s linear infinite}
@keyframes clMarch{to{stroke-dashoffset:-18}}
.cl-bob{animation:clBob 3.4s ease-in-out infinite}
@keyframes clBob{50%{transform:translate(3px,-4px)}}
@media (max-width:767px){.cl-lane{gap:8px}.cl-card{min-height:150px;padding:12px 12px 13px}.cl-g{width:34px;height:34px;border-radius:11px}.cl-t b{font-size:13.5px;line-height:1.25}.cl-t small{font-size:11px;line-height:1.35}.cl-bub{display:none}.cl-trail{width:120px;height:66px;right:-4px;top:40px}}
@media (prefers-reduced-motion:reduce){.cl-card::before,.cl-g.live::after,.cl-bub i,.cl-dash,.cl-bob{animation:none}}
`;
const OUT_ARROW = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>;
const PLANE_TRAIL = (
  <svg className="cl-trail" viewBox="0 0 190 104" fill="none" aria-hidden="true">
    <path className="cl-dash" d="M6 98C58 96 82 40 140 30" stroke="rgba(255,255,255,.6)" strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
    <g transform="translate(146 10) rotate(-12)"><g className="cl-bob"><path d="M2 13 26 2 18 27 13 17z" fill="#fff" /><path d="M13 17 26 2" stroke="#1e84cc" strokeWidth="1.5" strokeLinecap="round" /><path d="M13 17v7l3.2-3.6" fill="#d6ecfa" /></g></g>
  </svg>
);

export function ChannelLane({ socialLinks }) {
  const tr = useT();
  const telegram = socialLinks?.social_telegram_support;
  const waChannel = socialLinks?.social_whatsapp_channel || WHATSAPP_CHANNEL_URL;
  const cards = [
    {
      key: 'wa',
      href: waChannel,
      title: tr("Follow us on WhatsApp"),
      sub: tr("Deal days and delivery news, first."),
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 2A10 10 0 002 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3A10 10 0 1012 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-3-.2-.3A8.2 8.2 0 1112 20.2zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 01-2-1.2 7.5 7.5 0 01-1.4-1.7c-.1-.3 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5v-.5c0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.4z"/></svg>
      ),
    },
    telegram && {
      key: 'tg',
      href: telegram.startsWith('http') ? telegram : `https://t.me/${telegram.replace(/^@/, '')}`,
      title: tr("Join the Telegram"),
      sub: tr("Service updates and community."),
      icon: (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M21.9 4.6c.3-1.2-.9-2-1.9-1.6L2.7 9.6c-1.2.5-1.1 2.2.1 2.6l4.4 1.4 1.7 5.3c.3 1 1.6 1.3 2.3.5l2.4-2.5 4.5 3.3c.9.7 2.2.2 2.4-.9l2.4-14.7zM9.4 13.1l8.3-5.2c.4-.2.7.3.4.6l-6.8 6.2-.3 3-1.6-4.6z"/></svg>
      ),
    },
  ].filter(Boolean);

  if (!cards.length) return null;

  return (
    <>
      <style>{LANE_CSS}</style>
      <div className={`cl-lane${cards.length > 1 ? '' : ' one'}`}>
        {cards.map(c => (
          <a key={c.key} href={c.href} onClick={e => { e.preventDefault(); window.open(c.href, '_blank', 'noopener,noreferrer'); }} className={`cl-card ${c.key}`}>
            {c.key === 'tg' && PLANE_TRAIL}
            <span className="cl-h"><span className={`cl-g${c.key === 'wa' ? ' live' : ''}`}>{c.icon}</span><span className="cl-o">{OUT_ARROW}</span></span>
            {c.key === 'wa' && <span className="cl-bub" aria-hidden="true"><i /><i /><i /></span>}
            <span className="cl-t"><b>{c.title}</b><small>{c.sub}</small></span>
          </a>
        ))}
      </div>
    </>
  );
}

/* ── modal shell (matches the How-it-works popup exactly) ── */

/* The two pop-ups from the home page's money card (approved 17 Oct 2026, mockup
   "Status and Points"): each leads with a printed card in its own colour, the
   tier's for Status and gold for Points, and the detail underneath reads the
   way History and the receipt do. Logical properties: this sheet does not go
   through the RTL build plugin. */
const COINS = svgUrl('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="white" stroke-width="1.6"><circle cx="18" cy="20" r="8"/><circle cx="18" cy="20" r="4.5"/><circle cx="70" cy="30" r="6"/><circle cx="44" cy="62" r="9"/><circle cx="44" cy="62" r="5"/><circle cx="84" cy="78" r="5"/><path d="M76 8l1.3 2.7 2.7 1.3-2.7 1.3-1.3 2.7-1.3-2.7-2.7-1.3 2.7-1.3z" fill="white" stroke="none"/></svg>');
const POP_CSS = `
.rp-h{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px 13px 20px;border-bottom:1px solid var(--t-card-border)}
.rp-h b{font-size:22px;font-weight:700;line-height:1;color:var(--t-text)}
/* A grid, not a flex column. In a flex column a child that hides its overflow
   (the coloured card, the status table) may shrink below its own content, so
   on a phone, where the sheet is shorter than what it holds, the column
   squashed them and cut their chips and rows off instead of scrolling. Grid
   has the same rule for auto rows, so the rows are sized to their content
   outright (max-content): they cannot shrink, and the body scrolls instead. */
.rp-body{display:grid;grid-template-columns:minmax(0,1fr);grid-auto-rows:max-content;align-content:start;gap:14px;padding:16px 18px 18px}
.rp-more{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;padding:12px;border:0;border-top:1px solid var(--t-card-border);background:none;font:inherit;font-size:12.5px;font-weight:650;color:var(--t-accent-ink);cursor:pointer}
.rp-hero{position:relative;overflow:hidden;isolation:isolate;border-radius:16px;color:#fff;padding:14px 16px 16px;box-shadow:3px 3px 0 var(--vs)}
.rp-hero::before{content:"";position:absolute;inset:-96px 0 0 -96px;z-index:-1;background-image:var(--pat,none);background-size:96px 96px;opacity:.13;animation:rpDrift 40s linear infinite}
@keyframes rpDrift{to{transform:translate(96px,96px)}}
.rp-hl{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;opacity:.92}
.rp-hg{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;flex-shrink:0;background:rgba(255,255,255,.2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.32),2px 2px 0 rgba(0,0,0,.16)}
.rp-hg .ic-off{opacity:.3}
.rp-hn{margin-top:12px;font-size:42px;font-weight:700;line-height:1;letter-spacing:-.01em;text-shadow:0 2px 6px rgba(0,0,0,.14)}
.rp-num{margin-top:12px;font-size:38px;font-weight:700;line-height:1;letter-spacing:-.04em;text-shadow:0 2px 6px rgba(0,0,0,.14)}
.rp-num small{margin-inline-start:6px;font-family:inherit;font-size:14px;font-weight:600;letter-spacing:0;opacity:.9}
.rp-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.rp-chip{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.18);box-shadow:inset 0 0 0 1px rgba(255,255,255,.28);font-size:11.5px;font-weight:650}
.rp-st{--vs:color-mix(in srgb,var(--tc) 50%,#000);background:radial-gradient(90% 120% at 100% 0%,rgba(255,255,255,.32),transparent 60%),linear-gradient(150deg,color-mix(in srgb,var(--tc) 55%,#000) 0%,color-mix(in srgb,var(--tc) 82%,#000) 55%,var(--tc) 100%)}
.rp-rings{position:absolute;inset-inline-end:-40px;top:-40px;width:200px;height:200px;z-index:-1;pointer-events:none}
.rp-rings i{position:absolute;inset:0;border-radius:50%;border:1.5px solid rgba(255,255,255,.35);opacity:0;animation:rpRing 4.5s ease-out infinite}
.rp-rings i:nth-child(2){animation-delay:1.5s}
.rp-rings i:nth-child(3){animation-delay:3s}
@keyframes rpRing{0%{transform:scale(.25);opacity:.9}100%{transform:scale(1.1);opacity:0}}
.rp-pt{--vs:#8a4a07;--pat:${COINS};background:radial-gradient(90% 120% at 100% 0%,rgba(255,236,170,.6),transparent 60%),linear-gradient(150deg,#b45309 0%,#d97706 50%,#f59e0b 100%)}
.dark .rp-pt{--vs:#a5600f}
.rp-spark{position:absolute;inset-inline-end:20px;top:14px;width:16px;height:16px;z-index:-1;color:#fff;animation:rpTwinkle 2.8s ease-in-out infinite}
.rp-spark.s2{inset-inline-end:60px;top:50px;width:10px;height:10px;animation-delay:1.2s}
@keyframes rpTwinkle{0%,100%{opacity:.3;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}
.rp-prog{display:flex;flex-direction:column;gap:7px}
.rp-pr1{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--t-text-muted)}
.rp-pr1 b{color:var(--t-text);font-weight:700}
.rp-nx{display:inline-flex;align-items:center;gap:6px}
.rp-dot{width:9px;height:9px;border-radius:3px;background:var(--c);box-shadow:1.5px 1.5px 0 color-mix(in srgb,var(--c) 35%,transparent)}
.rp-track{position:relative;height:10px;border-radius:999px;background:var(--t-card-border)}
.rp-fill{position:absolute;inset-block:0;inset-inline-start:0;border-radius:999px;background:var(--fill)}
.rp-mark{position:absolute;top:50%;width:16px;height:16px;margin-top:-8px;margin-inline-start:-8px;border-radius:50%;background:var(--t-card-bg);box-shadow:0 0 0 3px var(--ring),0 2px 4px rgba(0,0,0,.18)}
.rp-pr2{display:flex;justify-content:space-between;gap:10px;font-size:11.5px;color:var(--t-text-muted)}
.rp-pr2 b{color:var(--t-text);font-weight:700}
.rp-para{margin:0;font-size:12.5px;line-height:1.55;color:var(--t-text-soft)}
.rp-lad{border:1px solid var(--t-card-border);border-radius:14px;overflow:hidden}
.rp-lh,.rp-lr{display:grid;grid-template-columns:1fr 64px 44px 52px;align-items:center;gap:8px;padding:0 12px}
.rp-lh{height:30px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--t-text-muted);background:rgba(0,0,0,.025)}
.dark .rp-lh{background:rgba(255,255,255,.04)}
.rp-r{text-align:end}
.rp-lr{height:40px;border-top:1px solid var(--t-card-border);font-size:12.5px}
.rp-nm{display:flex;align-items:center;gap:9px;min-width:0;font-weight:700;color:var(--t-text)}
.rp-tt{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;flex-shrink:0;color:var(--c);background:color-mix(in srgb,var(--c) 14%,var(--t-card-bg));box-shadow:1.5px 1.5px 0 color-mix(in srgb,var(--c) 35%,transparent)}
.rp-v{font-size:11.5px;font-weight:700;color:var(--t-text)}
.rp-v.sp{font-weight:600;color:var(--t-text-muted)}
.rp-lr.past{opacity:.5}
.rp-lr.past .rp-tt{background:transparent;box-shadow:none}
.rp-lr.cur{background:color-mix(in srgb,var(--c) 10%,var(--t-card-bg));box-shadow:inset 3px 0 0 var(--c)}
.rp-you{font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:2px 6px;border-radius:6px;color:var(--c);background:var(--t-card-bg);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 40%,transparent),1.5px 1.5px 0 color-mix(in srgb,var(--c) 30%,transparent)}
.rp-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rp-f{min-width:0;padding:10px 12px;border:1px solid var(--t-card-border);border-radius:12px}
.rp-fl{display:flex;align-items:center;gap:5px;font-size:10.5px;font-weight:600;color:var(--t-text-muted)}
.rp-fl svg{color:var(--t-accent-ink)}
.rp-fv{display:block;margin-top:3px;font-size:19px;font-weight:700;letter-spacing:-.02em;color:var(--t-text)}
.rp-fs{display:block;font-size:11px;color:var(--t-text-muted)}
.rp-use{height:44px;width:100%;font-size:14px}
.rp-eb{display:flex;align-items:center;gap:8px}
.rp-eb span{font-size:10.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:var(--t-text-muted);white-space:nowrap}
.rp-eb::after{content:"";flex:1;height:1px;background:var(--t-sidebar-border);opacity:.7}
.rp-ar{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--t-card-border)}
.rp-ar:first-child{border-top:0}
.rp-at{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:var(--c);background:color-mix(in srgb,var(--c) 13%,var(--t-card-bg));box-shadow:2px 2px 0 color-mix(in srgb,var(--c) 30%,transparent)}
.rp-ax{min-width:0}
.rp-ax b{display:block;font-size:13px;font-weight:650;color:var(--t-text)}
.rp-ax small{display:flex;gap:8px;font-size:11px;color:var(--t-text-muted);white-space:nowrap;overflow:hidden}
.rp-ap{font-size:13px;font-weight:700;color:var(--c)}
.rp-empty{padding:12px;border-radius:10px;text-align:center;font-size:12px;color:var(--t-text-muted);background:rgba(0,0,0,.02)}
.dark .rp-empty{background:rgba(255,255,255,.04)}
@media (prefers-reduced-motion:reduce){.rp-hero::before,.rp-rings i,.rp-spark{animation:none}}
`;
// The row names a points entry falls back on, registered so the scanner asks for them.
const KIND_LABEL = { earned: msg("Earned"), spent: msg("Spent"), reversed: msg("Reversed") };
const POP_ARROW = <svg className="dir-flip" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
const STAR = (cls) => <svg className={cls} viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6-2.6 7.9-2.6-7.9-7.9-2.6 7.9-2.6z" /></svg>;

function ModalShell({ open, onClose, dark, title, onMore, children }) {
  const tr = useT();
  return (
    <Modal open={open} onClose={onClose} dark={dark} maxWidth={420} title={title} bare>
      <style>{POP_CSS}</style>
      <div className="rp-h shrink-0">
        <b className="serif">{title}</b>
        <button onClick={onClose} aria-label={tr("Close")} className="nitro-x">
          <OffsetIcon name="close" size={12} />
        </button>
      </div>
      <div className="rp-body overflow-y-auto min-h-0">{children}</div>
      {onMore && <button type="button" onClick={onMore} className="rp-more shrink-0">{tr("See everything in Rewards")}{POP_ARROW}</button>}
    </Modal>
  );
}

/* ── Nitro Status modal ── */

export function StatusModal({ open, onClose, rewards, dark, setActive }) {
  const tr = useT();
  const money = useMoney();
  const currency = useLocale()?.currency ?? "NGN";
  if (!open || !rewards) return null;
  const { status } = rewards;
  const curIdx = Math.max(0, STATUS_TIERS.findIndex(ti => ti.key === status.key));
  const tone = (ti) => (ti.key === 'spark' ? '#c47d8e' : ti.color);
  const curTier = STATUS_TIERS[curIdx];
  const nextTier = curIdx < STATUS_TIERS.length - 1 ? STATUS_TIERS[curIdx + 1] : null;
  const pct = Math.max(3, Math.min(100, status.progressPct));
  return (
    <ModalShell open={open} onClose={onClose} dark={dark} title={tr("Nitro Status")} onMore={setActive ? () => { onClose?.(); setActive('rewards'); } : null}>
      <div className="rp-hero rp-st" style={{ "--tc": tone(curTier) }}>
        <span className="rp-rings" aria-hidden="true"><i /><i /><i /></span>
        <span className="rp-hl"><span className="rp-hg"><OffsetIcon name="crown" size={18} /></span>{tr("Your status")}</span>
        <div className="rp-hn serif">{status.name}</div>
        <div className="rp-chips">
          {status.discountPct > 0 && <span className="rp-chip"><b className="m">{status.discountPct}%</b>{tr("off every order")}</span>}
          <span className="rp-chip"><b className="m">{status.pointEarnPct}%</b>{tr("back in points")}</span>
        </div>
      </div>

      {nextTier && (
        <div className="rp-prog">
          <div className="rp-pr1">
            <span className="rp-nx">{tr("Next tier")} <span className="rp-dot" style={{ "--c": tone(nextTier) }} /><b>{nextTier.name}</b></span>
            <span><b className="m">{fmtCompactNaira(status.remainingToNext, money, currency)}</b> {tr("to go")}</span>
          </div>
          <div className="rp-track" style={{ "--fill": `linear-gradient(90deg, ${tone(curTier)}, ${tone(nextTier)})`, "--ring": tone(curTier) }}>
            <span className="rp-fill" style={{ width: `${pct}%` }} /><span className="rp-mark" style={{ insetInlineStart: `${pct}%` }} />
          </div>
          <div className="rp-pr2"><span><b className="m">{money(status.eligibleSpend, { round: "down" })}</b> {tr("spent")}</span><span className="m">{money(status.nextMin)}</span></div>
        </div>
      )}

      <p className="rp-para">{tr("Spend more to unlock higher tiers: bigger discounts, more points back.")}</p>

      <div className="rp-lad">
        <div className="rp-lh"><span>{tr("Status")}</span><span className="rp-r">{tr("Spend")}</span><span className="rp-r">{tr("Off")}</span><span className="rp-r">{tr("Points")}</span></div>
        {STATUS_TIERS.map((tier, idx) => (
          <div key={tier.key} className={"rp-lr" + (idx < curIdx ? " past" : idx === curIdx ? " cur" : "")} style={{ "--c": tone(tier) }}>
            <span className="rp-nm"><span className="rp-tt"><OffsetIcon name={idx < curIdx ? "checkCircle" : "crown"} size={idx < curIdx ? 13 : 12} /></span>{tier.name}{idx === curIdx && <span className="rp-you m">{tr("You")}</span>}</span>
            <span className="rp-v sp m rp-r">{tier.min === 0 ? `${money(0)}+` : `${fmtCompactNaira(tier.min, money, currency)}+`}</span>
            <span className="rp-v m rp-r">{tier.discountPct}%</span>
            <span className="rp-v m rp-r">{tier.pointEarnPct}%</span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

/* ── Nitro Points modal ── */

export function PointsModal({ open, onClose, rewards, dark, onUse, setActive }) {
  const tr = useT();
  const money = useMoney();
  if (!open || !rewards) return null;
  const { points, history, status } = rewards;
  const tones = { earned: dark ? '#6ee7b7' : '#059669', spent: dark ? '#fbbf24' : '#b45309', reversed: dark ? '#fca5a5' : '#c62828' };
  const recent = (history || []).slice(0, 3);
  const pct = Math.max(3, Math.min(100, Math.round(points.balance / points.minRedeem * 100)));
  return (
    <ModalShell open={open} onClose={onClose} dark={dark} title={tr("Nitro Points")} onMore={setActive ? () => { onClose?.(); setActive('rewards'); } : null}>
      <div className="rp-hero rp-pt">
        {STAR("rp-spark")}{STAR("rp-spark s2")}
        <span className="rp-hl"><span className="rp-hg"><OffsetIcon name="star" size={18} /></span>{tr("Your points")}</span>
        <div className="rp-num m">{fmtPoints(points.balance)}<small>{tr("points")}</small></div>
        <div className="rp-chips">
          <span className="rp-chip">{tr("Worth")} <b className="m">{money(points.valueNaira, { round: "down" })}</b></span>
          <span className="rp-chip">{tr("1 point = ₦1")}</span>
        </div>
      </div>

      {points.redeemable ? (
        <button type="button" onClick={onUse} className="nb nitro-money-btn rp-use"><OffsetIcon name="wallet" size={16} />{tr("Use on next order")}</button>
      ) : (
        <div className="rp-prog">
          <div className="rp-pr1">
            <span>{tr("Spend from")} <b className="m">{points.minRedeem.toLocaleString()}</b></span>
            <span><b className="m">{points.neededToRedeem.toLocaleString()}</b> {tr("more to start spending")}</span>
          </div>
          <div className="rp-track" style={{ "--fill": "linear-gradient(90deg,#f59e0b,#d97706)", "--ring": "#d97706" }}>
            <span className="rp-fill" style={{ width: `${pct}%` }} /><span className="rp-mark" style={{ insetInlineStart: `${pct}%` }} />
          </div>
          <div className="rp-pr2"><span><b className="m">{fmtPoints(points.balance)}</b> {tr("now")}</span><span className="m">{points.minRedeem.toLocaleString()}</span></div>
        </div>
      )}

      <div className="rp-facts">
        <div className="rp-f"><span className="rp-fl"><OffsetIcon name="trend" size={12} />{tr("Earn rate")}</span><b className="rp-fv m">{status?.pointEarnPct ?? 0.5}%</b><span className="rp-fs">{tr("of every order")}</span></div>
        <div className="rp-f"><span className="rp-fl"><OffsetIcon name="wallet" size={12} />{tr("Minimum to spend")}</span><b className="rp-fv m">{points.minRedeem.toLocaleString()}</b><span className="rp-fs">{tr("points")}</span></div>
      </div>

      <div className="rp-eb"><span>{tr("Recent")}</span></div>
      {recent.length ? (
        <div>
          {recent.map((h, i) => {
            const kind = h.kind === 'spent' ? 'spent' : h.kind === 'reversed' ? 'reversed' : 'earned';
            const ref = h.ref && h.ref !== '—' ? h.ref : null;
            return (
              <div key={i} className="rp-ar" style={{ "--c": tones[kind] }}>
                <span className="rp-at"><OffsetIcon name={kind === 'earned' ? 'plusCircle' : kind === 'spent' ? 'minusCircle' : 'refresh'} size={15} /></span>
                <span className="rp-ax"><b>{tr(h.label || KIND_LABEL[kind])}</b>{(h.detail || ref) && <small>{h.detail && <span className="truncate">{tr(h.detail)}</span>}{ref && <span className="m">{ref}</span>}</small>}</span>
                <span className="rp-ap m">{h.pts > 0 ? '+' : ''}{fmtPoints(h.pts)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rp-empty">{tr("Points activity will appear here after your first order.")}</div>
      )}
    </ModalShell>
  );
}

/* ── WALLET: compact points card ── */

export function WalletPointsCard({ rewards, dark, t, onView }) {
  const tr = useT();
  const money = useMoney();
  if (!rewards) return null;
  const { points } = rewards;
  return (
    <div className="flex items-center gap-[11px] rounded-[14px] max-md:rounded-xl py-3.5 px-4 mb-4" style={cardStyle(dark)}>
      <ChipIcon gradient="linear-gradient(135deg,#fbbf24,#d97706)"><CoinGlyph /></ChipIcon>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[.7px]" style={{ color: t.textMuted }}>{tr("Nitro Points")}</div>
        <div className="m text-[15px] font-bold mt-[3px] truncate" style={{ color: t.text }}>
          {points.balance.toLocaleString()} pts{' '}
          <span className="font-semibold" style={{ color: points.redeemable ? t.green : t.textMuted }}>≈ {money(points.valueNaira, { round: "down" })}</span>
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>{tr("Minimum to spend:")} <span className="m">{points.minRedeem.toLocaleString()}</span> pts</div>
      </div>
      <CellLink t={t} onClick={onView}>{tr("View points")}</CellLink>
    </div>
  );
}
