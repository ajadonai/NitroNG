'use client';
import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { useToast } from './toast';
import { openCardFrame, openCardHeader } from '@/lib/expandable-card';

const PLATFORM_ICONS = {
  x: { bg: 'rgba(245,243,240,.12)', lbg: 'rgba(28,27,25,.08)', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
  instagram: { bg: 'rgba(240,119,161,.15)', lbg: 'rgba(214,51,108,.1)', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.4"/><circle cx="12" cy="12" r="4.4"/><circle cx="17.4" cy="6.6" r="1.3" fill="currentColor" stroke="none"/></svg> },
  tiktok: { bg: 'rgba(95,208,220,.12)', lbg: 'rgba(14,116,144,.08)', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg> },
  facebook: { bg: 'rgba(109,167,247,.12)', lbg: 'rgba(24,119,242,.08)', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg> },
  youtube: { bg: 'rgba(255,123,114,.12)', lbg: 'rgba(220,38,38,.08)', svg: <svg width="16" height="16" viewBox="0 0 24 24"><rect x="1.5" y="4.8" width="21" height="14.4" rx="4" fill="currentColor"/><polygon points="10,9 15.6,12 10,15" fill="#fff"/></svg> },
  telegram: { bg: 'rgba(109,195,238,.12)', lbg: 'rgba(2,132,199,.08)', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg> },
  whatsapp: { bg: 'rgba(95,224,140,.12)', lbg: 'rgba(22,163,74,.08)', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2A10 10 0 002 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3A10 10 0 1012 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-3-.2-.3A8.2 8.2 0 1112 20.2zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 01-2-1.2 7.5 7.5 0 01-1.4-1.7c-.1-.3 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5v-.5c0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.9 2.9 4.6 4 .6.3 1.1.4 1.5.6.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.4z"/></svg> },
  nairaland: { bg: 'rgba(46,139,87,.12)', lbg: 'rgba(46,139,87,.08)', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h3l5 8.5V4h3v16h-3l-5-8.5V20H4V4z"/></svg> },
  reddit: { bg: 'rgba(255,87,34,.12)', lbg: 'rgba(255,87,34,.08)', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><circle cx="8.5" cy="12.5" r="1.5" fill="#fff"/><circle cx="15.5" cy="12.5" r="1.5" fill="#fff"/><path d="M8.5 16c1 1.5 5.5 1.5 7 0" stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round"/><circle cx="18" cy="5" r="1.5"/><path d="M15 3l3 2" stroke="currentColor" strokeWidth="1.3"/></svg> },
  google: { bg: 'rgba(66,133,244,.12)', lbg: 'rgba(66,133,244,.08)', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.389-7.439-7.574s3.345-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.849l3.254-3.138C18.189 1.186 15.479 0 12.24 0c-6.635 0-12 5.365-12 12s5.365 12 12 12c6.926 0 11.52-4.869 11.52-11.726 0-.788-.085-1.39-.189-1.989H12.24z"/></svg> },
  trustpilot: { bg: 'rgba(0,182,122,.12)', lbg: 'rgba(0,182,122,.08)', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l3.09 6.26L22 8.27l-5 4.87 1.18 6.88L12 16.77l-6.18 3.25L7 13.14 2 8.27l6.91-1.01z"/></svg> },
  blog: { bg: 'rgba(139,92,246,.12)', lbg: 'rgba(139,92,246,.08)', svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'New' },
  { key: 'pending', label: 'In review' },
  { key: 'done', label: 'Done' },
  { key: 'rejected', label: 'Rejected' },
];

function fmtNaira(kobo) {
  return '₦' + Math.floor(kobo / 100).toLocaleString();
}

const PLATFORM_NAMES = { x: 'X', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube', telegram: 'Telegram', whatsapp: 'WhatsApp', nairaland: 'Nairaland', reddit: 'Reddit', google: 'Google', trustpilot: 'Trustpilot', blog: 'Blog' };



function proofLabel(proofType, platform) {
  const name = PLATFORM_NAMES[platform] || platform;
  if (proofType === 'handle') return `${name} handle`;
  if (proofType === 'link') return 'Link to your post';
  if (proofType === 'phone') return 'WhatsApp number';
  if (proofType === 'text') return 'Name on the review';
  return 'Screenshot link';
}
function bandOf(rewardKobo) {
  return rewardKobo <= 10000 ? 'Follow and join' : rewardKobo <= 25000 ? 'Share' : 'Write and recommend';
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

export default function TasksPage({ dark, t }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [proofs, setProofs] = useState({});
  const [submitting, setSubmitting] = useState(null);
  const [filter, setFilter] = useState('open');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sumOpen, setSumOpen] = useState(false);
  const sumRef = useRef(null);
  useEffect(() => {
    if (!sumOpen) return;
    const onDown = (e) => { if (sumRef.current && !sumRef.current.contains(e.target)) setSumOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setSumOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [sumOpen]);

  const toast = useToast();
  const accent = '#c47d8e';
  const border = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)';
  const cardBg = dark ? 'rgba(255,255,255,.04)' : '#fff';
  const innerBg = dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.035)';
  const amber = dark ? '#fbbf24' : '#b45309';
  const green = dark ? '#6ee7b7' : '#059669';
  const red = dark ? '#fca5a5' : '#dc2626';

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

  const filtered = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter(t => t.userStatus === filter);
  }, [tasks, filter]);

  const activeFilter = FILTERS.find(f => f.key === filter) || FILTERS[0];

  if (loading) {
    const sk = `skel-bone ${dark ? 'skel-dark' : 'skel-light'}`;
    return (
      <>
        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-2 mb-2.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-3 rounded-xl" style={{ background: cardBg, border: `0.5px solid ${border}` }}>
              <div className={`${sk} w-[50px] h-[8px] rounded mb-2`} />
              <div className={`${sk} w-[60px] h-[14px] rounded`} />
            </div>
          ))}
        </div>
        {/* How it works skeleton */}
        <div className="rounded-xl py-2.5 px-3.5 mb-3.5 flex items-center gap-3" style={{ background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)', border: `0.5px solid ${border}` }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`${sk} w-4 h-4 rounded-full shrink-0`} />
              <div className={`${sk} h-[9px] rounded`} style={{ width: 55 + i * 10 }} />
            </div>
          ))}
        </div>
        {/* Filter bar skeleton */}
        <div className="flex items-center justify-between mb-3 min-h-[34px]">
          <div className={`${sk} w-[60px] h-[12px] rounded`} />
          <div className={`${sk} w-[80px] h-[34px] rounded-lg`} />
        </div>
        {/* Task cards skeleton */}
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl py-[13px] px-[14px] flex items-center gap-3" style={{ background: cardBg, border: `0.5px solid ${border}` }}>
              <div className={`${sk} w-9 h-9 rounded-[11px] shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className={`${sk} h-[12px] rounded mb-1.5`} style={{ width: `${45 + i * 10}%` }} />
                <div className={`${sk} w-[50px] h-[9px] rounded`} />
              </div>
              <div className={`${sk} w-[60px] h-[24px] rounded-full shrink-0`} />
            </div>
          ))}
        </div>
      </>
    );
  }

  const openCount = tasks.filter(x => x.userStatus === 'open').length;
  const card = { background: dark ? 'rgba(255,255,255,.07)' : '#fff', border: `1px solid ${border}` };
  return (
    <>
      {/* Header, with the summary closed until asked for */}
      <div className="flex justify-between items-start gap-3 pb-2 desktop:pb-3">
        <div>
          <div className="text-lg desktop:text-[22px] font-semibold mb-0.5 text-t-text">Tasks</div>
          <div className="text-sm desktop:text-[15px] text-t-text-muted">Small tasks, free credit</div>
        </div>
        <div ref={sumRef} className="relative shrink-0">
          <button onClick={() => setSumOpen(v => !v)} aria-expanded={sumOpen} className="flex items-center gap-1.5 h-9 px-3 rounded-xl cursor-pointer text-[12.5px] font-medium text-t-text-soft" style={card}>
            Summary
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: sumOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="m6 9 6 6 6-6"/></svg>
          </button>
          {sumOpen && (
            <div className="absolute right-0 top-11 z-20 w-[240px] rounded-2xl px-3.5 py-1" style={{ background: dark ? '#161b2e' : '#fff', border: `1px solid ${border}`, boxShadow: '0 18px 44px rgba(0,0,0,.18)' }}>
              {[['Earned', fmtNaira(stats.earned || 0), green], ['In review', String(stats.pending || 0), dark ? '#a5b4fc' : '#4f46e5'], ['Open tasks', String(openCount), t.text], ['Credit expires', `${stats.expiryDays || 30} days`, t.text]].map(([label, val, color], i) => (
                <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-[13px] text-t-text-soft" style={{ borderTop: i > 0 ? `1px solid ${border}` : 'none' }}><span>{label}</span><b className="m text-[15px] font-semibold" style={{ color }}>{val}</b></div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* How it works: three steps, then the fine print on one line */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {[['1', 'Do a task'], ['2', 'Submit proof'], ['3', 'Credit lands']].map(([n, label]) => (
          <div key={n} className="flex items-center gap-2 py-2 px-2.5 rounded-xl text-[12px] font-medium whitespace-nowrap text-t-text-soft" style={card}>
            <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 text-[10.5px] font-bold text-white" style={{ background: accent }}>{n}</span>{label}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mb-3 px-0.5 text-[12px] text-t-text-muted">
        <span>Spend-only credit</span><span className="opacity-50">·</span><span>{stats.expiryDays || 30} day expiry</span><span className="opacity-50">·</span><span>Fake accounts rejected</span>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2.5 mb-2 min-h-[34px]">
        <span className="text-[12px] text-t-text-muted">
          {filtered.length} task{filtered.length !== 1 ? 's' : ''}
          {filter !== 'all' && <button onClick={() => setFilter('all')} className="bg-transparent border-none cursor-pointer font-[inherit] text-[12px] font-medium ml-1.5 underline p-0" style={{ color: accent }}>Show all</button>}
        </span>
        <div className="relative ml-auto" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFilterOpen(false); }}>
          <button onClick={() => setFilterOpen(!filterOpen)} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12.5px] font-medium cursor-pointer font-[inherit] text-t-text-soft" style={card}>
            {activeFilter.label}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          {filterOpen && (
            <>
              {/* Invisible backdrop: a tap outside closes the menu without also
                  activating whatever sits underneath. */}
              <span className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 rounded-[10px] overflow-hidden min-w-[150px] py-1" style={{ background: dark ? '#1a1d2e' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.14)'}`, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => { setFilter(f.key); setFilterOpen(false); }} className="block w-full text-left py-[7px] px-3 text-[13px] bg-transparent border-none cursor-pointer font-[inherit] whitespace-nowrap" style={{ color: f.key === filter ? accent : t.text, fontWeight: f.key === filter ? 600 : 400 }}>{f.label}</button>
              ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Task list: one surface, grouped by the effort the reward tracks */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 px-5 rounded-2xl text-[13px] leading-relaxed text-t-text-muted" style={card}>
          {filter === 'all' ? 'No tasks available right now. Check back soon.' : `No ${activeFilter.label.toLowerCase()} tasks.`}
        </div>
      ) : (
        <div className="rounded-[14px] overflow-hidden" style={card}>
          {[...filtered].sort((a, b) => a.reward - b.reward).map((task, i, arr) => {
            const band = bandOf(task.reward);
            const showBand = i === 0 || bandOf(arr[i - 1].reward) !== band;
            return (
              <Fragment key={task.id}>
                {showBand && <div className="text-[10.5px] font-semibold uppercase tracking-[1px] px-3.5 pt-3 pb-1 text-t-text-muted" style={{ background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.025)', borderTop: i > 0 ? `1px solid ${border}` : 'none' }}>{band}</div>}
                <TaskCard
                  task={task}
                  first={showBand}
                  expanded={expanded === task.id}
                  onToggle={() => setExpanded(expanded === task.id ? null : task.id)}
                  proof={proofs[task.id] || ''}
                  onProofChange={v => setProofs(p => ({ ...p, [task.id]: v }))}
                  onSubmit={() => handleSubmit(task.id)}
                  submitting={submitting === task.id}
                  dark={dark} t={t} accent={accent} border={border} innerBg={innerBg} amber={amber} green={green} red={red}
                />
              </Fragment>
            );
          })}
        </div>
      )}
    </>
  );
}

function TaskCard({ task, first, expanded, onToggle, proof, onProofChange, onSubmit, submitting, dark, t, accent, border, innerBg, amber, green, red }) {
  const icon = PLATFORM_ICONS[task.platform] || { bg: 'rgba(196,125,142,.12)', lbg: 'rgba(196,125,142,.08)', svg: null };
  const isDone = task.userStatus === 'done';
  const isPending = task.userStatus === 'pending';
  const isRejected = task.userStatus === 'rejected';
  const isExhausted = task.userStatus === 'exhausted';
  // The task is real but this account has not funded a wallet yet.
  const isDepositorsOnly = task.userStatus === 'depositors_only';
  const dimmed = isDone || isExhausted || isDepositorsOnly;
  const chipStyle = isDone
    ? { background: dark ? 'rgba(110,231,183,.12)' : '#ecfdf5', color: green }
    : isPending
    ? { background: dark ? 'rgba(165,180,252,.14)' : '#eef2ff', color: dark ? '#a5b4fc' : '#4f46e5' }
    : isRejected
    ? { background: dark ? 'rgba(253,186,116,.14)' : '#fff7ed', color: dark ? '#fdba74' : '#c2410c' }
    : isExhausted || isDepositorsOnly
    ? { background: innerBg, color: t.textMuted }
    : { background: dark ? 'rgba(196,125,142,.13)' : 'rgba(196,125,142,.12)', color: accent, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 };
  const chipLabel = isDone ? 'Done' : isPending ? 'In review' : isRejected ? 'Rejected' : isExhausted ? 'Pool full' : isDepositorsOnly ? 'Customers only' : fmtNaira(task.reward);
  const freq = task.frequency === 'daily' ? 'daily' : task.frequency === 'weekly' ? 'weekly' : task.frequency === 'monthly' ? 'monthly' : 'once';
  const SectionHead = ({ children, first: f }) => <div className={`text-[10.5px] font-semibold uppercase tracking-[1px] pb-1.5 ${f ? '' : 'mt-3 pt-3 border-t border-solid'}`} style={{ color: t.textMuted, borderColor: border }}>{children}</div>;
  return (
    <div style={expanded ? openCardFrame(t, dark) : { borderTop: first ? 'none' : `1px solid ${border}` }}>
      <button onClick={onToggle} aria-expanded={expanded} className="w-full flex items-center gap-3 py-3 px-3.5 text-left bg-transparent border-none font-[inherit] cursor-pointer" style={expanded ? openCardHeader(dark) : undefined}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: dark ? icon.bg : icon.lbg, opacity: dimmed ? .5 : 1 }}>{icon.svg}</div>
        <div className="flex-1 min-w-0" style={{ opacity: dimmed ? .55 : 1 }}>
          <div className="text-[13.5px] font-semibold leading-[1.35] text-t-text">{task.title}</div>
          <div className="text-[11px] mt-[2px] text-t-text-muted">{proofLabel(task.proofType, task.platform)} · {freq}</div>
        </div>
        <span className="shrink-0 text-[11px] font-semibold py-[4px] px-[9px] rounded-full whitespace-nowrap" style={chipStyle}>{chipLabel}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>

      {expanded && (
        <div className="px-3.5 pb-4" style={{ background: dark ? 'rgba(196,125,142,.06)' : 'rgba(196,125,142,.04)', borderTop: `1px solid ${border}` }}>
          {isDone && <div className="pt-3 text-[12.5px] leading-[1.5]" style={{ color: green }}>You earned {fmtNaira(task.reward)} credit from this task. It is in your wallet, spend-only, valid for 30 days.</div>}
          {isPending && <div className="pt-3 text-[12.5px] leading-[1.5] text-t-text-soft">We are checking your proof. The credit lands as soon as it clears.</div>}
          {isExhausted && <div className="pt-3 text-[12.5px] leading-[1.5] text-t-text-muted">The reward pool for this month is full. Check back next month.</div>}
          {isDepositorsOnly && <div className="pt-3 text-[12.5px] leading-[1.5] text-t-text-muted">This one is for customers who have funded their wallet. Add funds and it opens up.</div>}
          {isRejected && <div className="pt-3 text-[12.5px] leading-[1.5]" style={{ color: dark ? '#fdba74' : '#c2410c' }}>{task.rejectionReason || 'Your proof did not match. Do the task again and resend it.'}</div>}

          {(task.userStatus === 'open' || isRejected) && (
            <>
              <div className="pt-3"><SectionHead first>Do it</SectionHead></div>
              <div className="text-[13px] leading-[1.6] text-t-text-soft">{task.instructions}</div>
              <SectionHead>Proof</SectionHead>
              <div className="flex gap-2">
                <input
                  type="text"
                  aria-label={proofLabel(task.proofType, task.platform)}
                  placeholder={proofPlaceholder(task.proofType, task.platform)}
                  value={proof}
                  onChange={e => onProofChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && proof.trim() && !submitting) onSubmit(); }}
                  className="flex-1 min-w-0 h-10 rounded-[10px] text-[13px] px-[13px] outline-none"
                  style={{ background: dark ? '#0d1020' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.12)'}`, color: t.text }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(196,125,142,.55)'; }}
                  onBlur={e => { e.target.style.borderColor = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.12)'; }}
                />
                <button onClick={onSubmit} disabled={submitting || !proof.trim()} className="h-10 px-[18px] rounded-[10px] text-[13px] font-bold shrink-0 border-none cursor-pointer text-white disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: accent }}>
                  {submitting ? 'Sending...' : 'Submit'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
