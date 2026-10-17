'use client';
import { useMoney, useT } from "./locale";
import { msg } from "../lib/i18n";
import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useToast } from './toast';
import { OffsetIcon } from "./offset-icons";
import { TaskIcon } from "./task-icon";
import { Bone } from "./skeleton";

// The tabs, in the order a task moves through them, with All last.
const FILTERS = [
  { key: 'open', label: msg('New') },
  { key: 'pending', label: msg('In review') },
  { key: 'done', label: msg('Done') },
  { key: 'rejected', label: msg('Rejected') },
  { key: 'all', label: msg('All') },
];

const FREQ = { daily: msg('Daily'), weekly: msg('Weekly'), monthly: msg('Monthly') };
const ONCE = msg('Once');

// Kobo in. A task reward is money you will be given, so it never rounds up.
function fmtNaira(kobo, money) {
  return money(Math.floor(kobo / 100), { round: "down" });
}

const PLATFORM_NAMES = { x: 'X', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube', telegram: 'Telegram', whatsapp: 'WhatsApp', nairaland: 'Nairaland', reddit: 'Reddit', google: 'Google', trustpilot: 'Trustpilot', blog: 'Blog' };



function proofLabel(proofType, platform, tr) {
  const name = PLATFORM_NAMES[platform] || platform;
  if (proofType === 'handle') return `${name} handle`;
  if (proofType === 'link') return tr('Link to your post');
  if (proofType === 'phone') return tr('WhatsApp number');
  if (proofType === 'text') return tr('Name on the review');
  return tr('Screenshot link');
}
function bandOf(rewardKobo, tr) {
  return rewardKobo <= 10000 ? tr('Follow and join') : rewardKobo <= 25000 ? tr('Share') : tr('Write and recommend');
}

function proofPlaceholder(proofType, platform) {
  if (proofType === 'link' || proofType === 'screenshot') return 'https://...';
  const map = {
    x: '@yourhandle', instagram: '@yourhandle', tiktok: '@yourhandle',
    telegram: '@yourusername', facebook: 'Your profile name',
    youtube: 'Your channel name', whatsapp: '2348012345678',
    nairaland: 'yourusername', reddit: 'u/yourusername',
    google: 'Your Google name', trustpilot: 'Your Trustpilot name',
    blog: 'yourname',
  };
  return map[platform] || '@yourhandle';
}

/* The page in the offset print (approved 17 Oct 2026, mockup "Nitro Rewards
   and Tasks"). What you have earned leads, in the Tasks blue with ticks
   drifting behind it, and the figures the Summary dropdown used to hide sit
   beside it. Tabs with counts replace the filter dropdown. Logical properties:
   this sheet does not go through the RTL build plugin. */
const PAT_TICK = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 20l5 5 10-11"/><circle cx="70" cy="18" r="7"/><path d="M66 18l3 3 5-6"/><path d="M40 52h18M40 58h12"/><rect x="34" y="46" width="30" height="18" rx="4"/><path d="M14 78l5 5 10-11"/><path d="M78 76l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/></svg>')}")`;
const TKP_CSS = `
/* A grid, not a flex column: rows fit their content, so a card that hides its
   overflow can never be squashed by a shorter container. */
.tkp{display:grid;grid-template-columns:minmax(0,1fr);grid-auto-rows:max-content;align-content:start;gap:14px}
.tkp-hero{position:relative;overflow:hidden;isolation:isolate;border-radius:20px;color:#fff;padding:20px 22px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;background:radial-gradient(70% 120% at 100% 0%,rgba(120,190,255,.55),transparent 62%),linear-gradient(150deg,#0d2a6b 0%,#1d4fc4 62%,#3b8cf0 120%);box-shadow:3px 3px 0 #13357f}
.dark .tkp-hero{box-shadow:3px 3px 0 #1d4590}
.tkp-hero::before{content:"";position:absolute;inset:-96px 0 0 -96px;z-index:-1;background-image:${PAT_TICK};background-size:96px 96px;opacity:.12;animation:tkpDrift 40s linear infinite}
@keyframes tkpDrift{to{transform:translate(96px,96px)}}
.tkp-eb{font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:rgba(255,255,255,.75)}
.tkp-amt{display:flex;align-items:baseline;gap:8px;margin-top:6px}
.tkp-amt b{font-size:40px;font-weight:800;line-height:1;letter-spacing:-.03em}
.tkp-amt span{font-size:14px;font-weight:600;opacity:.85}
.tkp-hero p{margin:8px 0 0;font-size:12.5px;color:rgba(255,255,255,.84);max-width:40ch}
.tkp-cells{display:grid;grid-template-columns:repeat(3,auto);gap:8px}
.tkp-cell{min-width:92px;padding:10px 13px;border-radius:13px;background:rgba(255,255,255,.16);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3),2px 2px 0 rgba(0,0,0,.18)}
.tkp-cell small{display:block;font-size:11px;font-weight:600;color:rgba(255,255,255,.8)}
.tkp-cell b{display:block;margin-top:3px;font-size:18px;font-weight:800}
.tkp-cell b span{font-family:Outfit,system-ui,sans-serif;font-size:12px;font-weight:600}
.tkp-card{border-radius:18px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #efc4cf}
.dark .tkp-card{box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #5e3242}
.tkp-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:14px 18px}
.tkp-step{position:relative;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:var(--t-text-soft)}
.tkp-no{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;font-size:12px;font-weight:800;color:#fff;background:#c47d8e;box-shadow:1.5px 1.5px 0 #8b4a5e}
.tkp-step:not(:last-child)::after{content:"";flex:1;border-top:2px dashed rgba(196,125,142,.4);margin-inline:6px 4px}
.tkp-rules{display:flex;flex-wrap:wrap;gap:8px}
.tkp-rule{display:inline-flex;align-items:center;gap:7px;height:30px;padding-inline:6px 11px;border-radius:999px;font-size:12px;font-weight:600;color:var(--t-text-soft);background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border)}
.tkp-rule .ic-tile{width:20px;height:20px;border-radius:7px;box-shadow:1.5px 1.5px 0 #efc4cf}
.dark .tkp-rule .ic-tile{box-shadow:1.5px 1.5px 0 #6b3a4a}
.tkp-tabs{display:flex;gap:6px;overflow-x:auto;padding:2px 3px 5px;margin:-2px -3px;scrollbar-width:none}
.tkp-tab{display:inline-flex;align-items:center;gap:7px;height:34px;padding-inline:13px;border:0;border-radius:999px;font:inherit;font-size:13px;font-weight:600;white-space:nowrap;flex-shrink:0;cursor:pointer;color:var(--t-text-soft);background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border)}
.tkp-tab .c{font-size:11px;font-weight:800;padding:2px 6px;border-radius:6px;color:var(--t-accent-ink);background:rgba(196,125,142,.12)}
.tkp-tab.on{color:var(--t-text);box-shadow:inset 0 0 0 1.5px #c47d8e,2px 2px 0 #efc4cf}
.dark .tkp-tab.on{box-shadow:inset 0 0 0 1.5px #c47d8e,2px 2px 0 #5e3242}
.tkp-tab.on .c{color:#fff;background:#c47d8e}
.tkp-tab:focus-visible{outline:2px solid #c47d8e;outline-offset:2px}
.tkp-band{padding:10px 18px 6px;font-size:10.5px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:var(--t-text-muted);background:rgba(0,0,0,.025);border-top:1px solid var(--t-card-border)}
.dark .tkp-band{background:rgba(255,255,255,.03)}
.tkp-band:first-child{border-top:0;border-start-start-radius:18px;border-start-end-radius:18px}
.tkp-task{border-top:1px solid var(--t-card-border)}
.tkp-band + .tkp-task{border-top:0}
.tkp-task.open{background:rgba(196,125,142,.05)}
.tkp-task:last-child{border-end-start-radius:18px;border-end-end-radius:18px}
.tkp-row{width:100%;display:flex;align-items:center;gap:12px;padding:12px 18px;border:0;background:none;font:inherit;color:inherit;text-align:start;cursor:pointer}
.tkp-row:focus-visible{outline:2px solid #c47d8e;outline-offset:-2px;border-radius:12px}
.tkp-row .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.tkp-row .tx b{font-size:14px;font-weight:600;line-height:1.35;color:var(--t-text)}
.tkp-row .tx small{display:flex;align-items:center;flex-wrap:wrap;gap:7px;font-size:11.5px;color:var(--t-text-muted)}
.tkp-cv{flex-shrink:0;color:var(--t-text-muted);transition:transform .2s}
.tkp-task.open .tkp-cv{transform:rotate(180deg);color:var(--t-accent-ink)}
.tkp-task.dim .ord-platform-icon,.tkp-task.dim .tx{opacity:.6}
.tkp-body{display:grid;gap:10px;padding:2px 18px 16px 70px}
.tkp-body h5{margin:0;font-size:10.5px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:var(--t-text-muted)}
.tkp-body p{margin:0;font-size:13px;line-height:1.6;color:var(--t-text-soft);white-space:pre-line}
.tkp-note{font-size:12.5px;line-height:1.5}
.tkp-proof{display:flex;gap:8px}
.tkp-proof input{flex:1;min-width:0;height:42px;border-radius:12px;padding-inline:13px;font:inherit;font-size:13.5px;color:var(--t-text);background:var(--t-input-bg);border:1px solid rgba(0,0,0,.14);outline:none}
.dark .tkp-proof input{border-color:rgba(255,255,255,.14)}
.tkp-proof input:focus{border-color:rgba(196,125,142,.6)}
.tkp-proof .nb{height:42px;flex-shrink:0}
.tkp-empty{padding:32px 20px;text-align:center;font-size:13px;line-height:1.6;color:var(--t-text-muted)}
/* The loading state: the same blocks with bones in them; the earned card is
   one shimmering block with lighter shapes inside it. */
.tkp-skhero{border-radius:20px;padding:20px 22px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center}
.tkp-gh{display:block;background:rgba(255,255,255,.6)}
.dark .tkp-gh{background:rgba(255,255,255,.07)}
.tkp-gh.cell{height:58px;border-radius:13px;min-width:92px}
.tkp-row.sk{cursor:default}
@media (max-width:767px){
  .tkp-hero{grid-template-columns:1fr;padding:18px 16px}
  .tkp-cells{grid-template-columns:repeat(3,minmax(0,1fr))}
  .tkp-cell{min-width:0;padding:9px 10px}
  .tkp-steps{padding:13px 10px}
  .tkp-step{flex-direction:column;gap:6px;font-size:11.5px;text-align:center}
  .tkp-step:not(:last-child)::after{position:absolute;top:13px;inset-inline-start:calc(50% + 20px);width:calc(100% - 40px);margin:0}
  .tkp-band{padding-inline:14px}
  .tkp-row{padding:12px 14px}
  .tkp-body{padding:2px 14px 14px}
  .tkp-skhero{grid-template-columns:1fr;padding:18px 16px}
  .tkp-gh.cell{min-width:0}
}
@media (prefers-reduced-motion:reduce){.tkp-hero::before{animation:none}}
`;

const CHEV = <svg className="tkp-cv" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
const TICK = <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;

export default function TasksPage({ dark }) {
  const tr = useT();
  // fmtNaira takes the formatter as an argument, and the Summary panel this
  // page used to have called it without one, which threw into the error
  // boundary (Sentry 7794355937). The page keeps a formatter of its own.
  const money = useMoney();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [proofs, setProofs] = useState({});
  const [submitting, setSubmitting] = useState(null);
  const [filter, setFilter] = useState('open');
  const toast = useToast();

  const fetchTasks = useCallback(() => {
    fetch('/api/tasks')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    const iv = setInterval(fetchTasks, 60000);
    return () => clearInterval(iv);
  }, [fetchTasks]);

  const handleSubmit = async (taskId) => {
    const proof = (proofs[taskId] || '').trim();
    if (!proof) return;
    setSubmitting(taskId);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, proof }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('Submitted for review');
        setProofs(p => ({ ...p, [taskId]: '' }));
        fetchTasks();
      } else {
        toast.error(json.error || 'Something went wrong');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(null);
    }
  };

  const tasks = data?.tasks || [];
  const stats = data?.stats || {};
  const expiryDays = stats.expiryDays || 30;

  const counts = useMemo(() => {
    const c = { all: tasks.length, open: 0, pending: 0, done: 0, rejected: 0 };
    for (const x of tasks) if (c[x.userStatus] !== undefined) c[x.userStatus] += 1;
    return c;
  }, [tasks]);

  const filtered = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter(x => x.userStatus === filter);
  }, [tasks, filter]);

  if (loading) return <TasksPageSkeleton dark={dark} />;

  return (
    <div className="tkp">
      <style>{TKP_CSS}</style>
      <div>
        <div className="serif text-[32px] max-md:text-[26px] font-semibold leading-none tracking-[-.015em] text-t-text">{tr("Tasks")}</div>
        <div className="text-[13px] mt-1.5 text-t-text-muted">{tr("Small tasks, free credit")}</div>
        <div className="page-divider bg-t-card-border" />
      </div>

      {/* What you have earned, with the figures the Summary dropdown hid */}
      <div className="tkp-hero">
        <div>
          <span className="tkp-eb">{tr("Earned from tasks")}</span>
          <div className="tkp-amt"><b className="m">{fmtNaira(stats.earned || 0, money)}</b><span>{tr("credit")}</span></div>
          <p>{stats.earned > 0 ? tr("Spend-only credit, in your wallet.") : tr("Do a task below to earn your first credit.")}</p>
        </div>
        <div className="tkp-cells">
          <div className="tkp-cell"><small>{tr("In review")}</small><b className="m">{counts.pending}</b></div>
          <div className="tkp-cell"><small>{tr("Open")}</small><b className="m">{counts.open}</b></div>
          <div className="tkp-cell"><small>{tr("Expiry")}</small><b className="m">{expiryDays} <span>{tr("days")}</span></b></div>
        </div>
      </div>

      {/* How it works: a real sequence, so it is numbered */}
      <div className="tkp-card tkp-steps">
        {[tr('Do a task'), tr('Submit proof'), tr('Credit lands')].map((label, i) => (
          <div key={label} className="tkp-step"><span className="tkp-no m">{i + 1}</span>{label}</div>
        ))}
      </div>
      <div className="tkp-rules">
        <span className="tkp-rule"><span className="ic-tile"><OffsetIcon name="wallet" size={11} /></span>{tr("Spend-only credit")}</span>
        <span className="tkp-rule"><span className="ic-tile"><OffsetIcon name="clock" size={11} /></span>{expiryDays} {tr("day expiry")}</span>
        <span className="tkp-rule"><span className="ic-tile"><OffsetIcon name="shield" size={11} /></span>{tr("Fake accounts rejected")}</span>
      </div>

      {/* Tabs, each saying how many before you tap */}
      <div className="tkp-tabs" role="group" aria-label={tr("Show tasks")}>
        {FILTERS.map(f => (
          <button key={f.key} type="button" aria-pressed={f.key === filter} onClick={() => setFilter(f.key)} className={`tkp-tab${f.key === filter ? ' on' : ''}`}>
            {tr(f.label)}<span className="c m">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {/* Task list: one surface, grouped by the effort the reward tracks */}
      {filtered.length === 0 ? (
        <div className="tkp-card tkp-empty">
          {filter === 'all' ? tr("No tasks available right now. Check back soon.") : tr("Nothing here right now.")}
        </div>
      ) : (
        <div className="tkp-card">
          {[...filtered].sort((a, b) => a.reward - b.reward).map((task, i, arr) => {
            const band = bandOf(task.reward, tr);
            const showBand = i === 0 || bandOf(arr[i - 1].reward, tr) !== band;
            return (
              <Fragment key={task.id}>
                {showBand && <div className="tkp-band">{band}</div>}
                <TaskCard
                  task={task}
                  expanded={expanded === task.id}
                  onToggle={() => setExpanded(expanded === task.id ? null : task.id)}
                  proof={proofs[task.id] || ''}
                  onProofChange={v => setProofs(p => ({ ...p, [task.id]: v }))}
                  onSubmit={() => handleSubmit(task.id)}
                  submitting={submitting === task.id}
                  dark={dark}
                />
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Shaped like the page it stands in for, block for block, so nothing moves when
// the tasks land. The page's own layout classes, so it reflows the same way.
function TasksPageSkeleton({ dark }) {
  const gh = (w, h, r, style) => <span className="tkp-gh" style={{ width: w, height: h, borderRadius: r, ...style }} />;
  const row = (w) => (
    <div key={w} className="tkp-task"><div className="tkp-row sk"><Bone dark={dark} w={40} h={40} r={12} /><span className="tx"><Bone dark={dark} w={`${w}%`} h={13} /><span className="flex gap-2"><Bone dark={dark} w={90} h={10} /><Bone dark={dark} w={42} h={16} r={7} /></span></span><Bone dark={dark} w={56} h={22} r={7} /></div></div>
  );
  return (
    <div className="tkp" aria-busy="true">
      <style>{TKP_CSS}</style>
      <div><Bone dark={dark} w={110} h={30} r={8} /><Bone dark={dark} w={170} h={12} style={{ marginTop: 10 }} /><div className="page-divider bg-t-card-border" /></div>
      <div className={`tkp-skhero skel-bone ${dark ? 'skel-dark' : 'skel-light'}`}>
        <div>{gh(110, 10, 5)}{gh(130, 38, 9, { marginTop: 10 })}{gh(220, 11, 5, { marginTop: 12 })}</div>
        <div className="tkp-cells">{[0, 1, 2].map(i => <span key={i} className="tkp-gh cell" />)}</div>
      </div>
      <div className="tkp-card tkp-steps">{[0, 1, 2].map(i => <div key={i} className="tkp-step"><Bone dark={dark} w={26} h={26} r={999} /><Bone dark={dark} w={80} h={12} /></div>)}</div>
      <div className="tkp-rules">{[130, 110, 160].map(w => <Bone key={w} dark={dark} w={w} h={30} r={999} />)}</div>
      <div className="tkp-tabs">{[70, 100, 74, 96, 56].map(w => <Bone key={w} dark={dark} w={w} h={34} r={999} style={{ flexShrink: 0 }} />)}</div>
      <div className="tkp-card">
        <div className="tkp-band"><Bone dark={dark} w={110} h={10} /></div>
        {[52, 64].map(row)}
        <div className="tkp-band"><Bone dark={dark} w={140} h={10} /></div>
        {[70, 58].map(row)}
      </div>
    </div>
  );
}

function TaskCard({ task, expanded, onToggle, proof, onProofChange, onSubmit, submitting, dark }) {
  const tr = useT();
  const money = useMoney();
  const isDone = task.userStatus === 'done';
  const isPending = task.userStatus === 'pending';
  const isRejected = task.userStatus === 'rejected';
  const isExhausted = task.userStatus === 'exhausted';
  // The task is real but this account has not funded a wallet yet.
  const isDepositorsOnly = task.userStatus === 'depositors_only';
  const dimmed = isDone || isExhausted || isDepositorsOnly;
  // Gold is money: the reward while it is still yours to earn, a word once
  // something else is true of the task.
  const badge = isDone ? <span className="pbadge ok">{TICK}{tr("Done")}</span>
    : isPending ? <span className="pbadge rev">{tr("In review")}</span>
    : isRejected ? <span className="pbadge no">{tr("Rejected")}</span>
    : isExhausted ? <span className="pbadge tag">{tr("Pool full")}</span>
    : isDepositorsOnly ? <span className="pbadge tag">{tr("Customers only")}</span>
    : <span className="pbadge gold">{fmtNaira(task.reward, money)}</span>;
  const label = proofLabel(task.proofType, task.platform, tr);
  return (
    <div className={`tkp-task${expanded ? ' open' : ''}${dimmed ? ' dim' : ''}`}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="tkp-row">
        <TaskIcon platform={task.platform} dark={dark} size={40} />
        <span className="tx"><b>{task.title}</b><small>{label}<span className="pbadge tag">{tr(FREQ[task.frequency] || ONCE)}</span></small></span>
        {badge}
        {CHEV}
      </button>

      {expanded && (
        <div className="tkp-body">
          {isDone && <div className="tkp-note" style={{ color: dark ? '#6ee7b7' : '#059669' }}>{tr("You earned")} {fmtNaira(task.reward, money)} {tr("credit from this task. It is in your wallet, spend-only, valid for 30 days.")}</div>}
          {isPending && <div className="tkp-note text-t-text-soft">{tr("We are checking your proof. The credit lands as soon as it clears.")}</div>}
          {isExhausted && <div className="tkp-note text-t-text-muted">{tr("The reward pool for this month is full. Check back next month.")}</div>}
          {isDepositorsOnly && <div className="tkp-note text-t-text-muted">{tr("This one is for customers who have funded their wallet. Add funds and it opens up.")}</div>}
          {isRejected && <div className="tkp-note" style={{ color: dark ? '#fdba74' : '#c2410c' }}>{task.rejectionReason || tr("Your proof did not match. Do the task again and resend it.")}</div>}

          {(task.userStatus === 'open' || isRejected) && (
            <>
              <h5>{tr("Do it")}</h5>
              <p>{task.instructions}</p>
              <h5>{tr("Proof")}</h5>
              <div className="tkp-proof">
                <input
                  type="text"
                  aria-label={label}
                  placeholder={proofPlaceholder(task.proofType, task.platform)}
                  value={proof}
                  onChange={e => onProofChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && proof.trim() && !submitting) onSubmit(); }}
                />
                <button type="button" onClick={onSubmit} disabled={submitting || !proof.trim()} className="nb pri">
                  {submitting ? tr("Sending...") : tr("Submit")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
