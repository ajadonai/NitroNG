'use client';
import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from './confirm-dialog';
import { useToast } from './toast';
import { SegPill } from './seg-pill';
import { FilterDropdown } from './date-range-picker';
import { SkelFacts, SkelBar, SkelList } from './skeleton';
import { proofToLink } from '@/lib/proof-link';
const fmt = (n) => Math.abs(n).toLocaleString('en-NG');

const PLATFORMS = [
  { id: 'x', name: 'X (Twitter)' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'whatsapp', name: 'WhatsApp' },
  { id: 'telegram', name: 'Telegram' },
  { id: 'nairaland', name: 'Nairaland' },
  { id: 'reddit', name: 'Reddit / Quora' },
  { id: 'google', name: 'Google' },
  { id: 'trustpilot', name: 'Trustpilot' },
  { id: 'blog', name: 'Blog / Web' },
];
const PF_SHORT = { x: 'X', instagram: 'IG', tiktok: 'TT', facebook: 'FB', youtube: 'YT', whatsapp: 'WA', telegram: 'TG', nairaland: 'NL', reddit: 'RD', google: 'G', trustpilot: 'TP', blog: 'BL' };

const CATEGORIES = [
  { id: 'follow', label: 'Follow & Join' },
  { id: 'engage', label: 'Engage & Share' },
  { id: 'content', label: 'Original Content' },
  { id: 'review', label: 'Reviews' },
];

const PROOF_TYPES = [
  { id: 'link', label: 'Post / video link' },
  { id: 'handle', label: 'Profile handle' },
  { id: 'phone', label: 'Phone number' },
  { id: 'text', label: 'Text answer' },
];

const FREQUENCIES = [
  { id: 'one_time', label: 'One-time' },
  { id: 'per_campaign', label: 'Per campaign' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

// Plain words for the line under a task title: "Follow · handle · once".
const CAT_WORD = { follow: 'Follow', engage: 'Engage', content: 'Content', review: 'Review' };
const PROOF_WORD = { link: 'link', handle: 'handle', phone: 'phone', text: 'text' };
const FREQ_WORD = { one_time: 'once', per_campaign: 'per campaign', weekly: 'weekly', monthly: 'monthly' };

const SEARCH = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></svg>;

const isToday = (d) => new Date(d).toDateString() === new Date().toDateString();
const hm = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const dayOf = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
// HH:MM when it happened today, "26 Aug" otherwise.
const whenWord = (d) => d ? (isToday(d) ? hm(d) : dayOf(d)) : '—';
const initials = (n) => (n || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const shortLink = (s) => String(s || '').replace(/^https?:\/\/(www\.)?/, '');

const EMPTY_FORM = {
  platform: 'x', title: '', instructions: '', category: 'engage', proofType: 'link',
  reward: 250, frequency: 'weekly', maxPerMonth: 4, minViews: 0, minFollowers: 0,
  keepDays: 0, monthlyCap: 0, viralBonus: false, viralThreshold: 10000, viralAmount: 1000,
  allowNonDepositors: true, active: true,
};

const Toggle = ({ on, onClick, label }) => <button type="button" role="switch" aria-checked={on} aria-label={label} className={'tk-sw' + (on ? ' on' : '')} onClick={onClick}><i /></button>;

// The words the customer's own task card uses — see components/tasks-page.jsx.
const bandOf = (rewardKobo) => rewardKobo <= 10000 ? 'Follow and join' : rewardKobo <= 25000 ? 'Share' : 'Write and recommend';
const PROOF_PH = {
  x: '@yourhandle', instagram: '@yourhandle', tiktok: '@yourhandle',
  telegram: '@yourusername', facebook: 'Your profile name',
  youtube: 'Your channel name', whatsapp: '2348012345678',
  nairaland: 'yourusername', reddit: 'u/yourusername',
  google: 'Your Google name', trustpilot: 'Your Trustpilot name', blog: 'yourname',
};
const proofPlaceholder = (proofType, platform) =>
  (proofType === 'link' || proofType === 'screenshot') ? 'https://...' : (PROOF_PH[platform] || '@yourhandle');

// Anything in here means the task is gated, so the section opens on edit.
const hasLimits = (f) => [f.minViews, f.minFollowers, f.keepDays, f.monthlyCap, f.maxPerMonth].some(v => (parseInt(v) || 0) > 0) || !!f.viralBonus || !f.allowNonDepositors;

const CHEV = <svg className="tk-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
const CLOSE = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>;

const CARD_TITLE = { pending: 'Waiting for review', approved: 'Approved', rejected: 'Rejected', all: 'All submissions' };
const SORT_OPTIONS = [
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'date_desc', label: 'Newest first' },
  { value: 'views_desc', label: 'Most views' },
  { value: 'reward_desc', label: 'Highest reward' },
];
const SORT_WORD = { date_asc: 'oldest first', date_desc: 'newest first', views_desc: 'most views first', reward_desc: 'highest reward first' };

export default function AdminTasksPage({ dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState(null); // decided on first load: subs when anything is waiting
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  // Task filters
  const [tq, setTq] = useState('');
  const [tPlat, setTPlat] = useState('all');
  const [tSt, setTSt] = useState('all');

  // Submission state
  const [subs, setSubs] = useState([]);
  const [subTotal, setSubTotal] = useState(0);
  const [subCounts, setSubCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [fSt, setFSt] = useState('pending');
  const [fPlat, setFPlat] = useState('all');
  const [fUser, setFUser] = useState('');
  const [subPage, setSubPage] = useState(1);
  const [subPer, setSubPer] = useState(10);
  const [subSort, setSubSort] = useState('date');
  const [subDir, setSubDir] = useState('asc');
  const [subLoading, setSubLoading] = useState(false);
  const [subsLoaded, setSubsLoaded] = useState(false);
  const [busy, setBusy] = useState(null); // submission id with an approve/reject in flight
  const [reject, setReject] = useState(null); // { sub, reason }

  // Editor
  const [modal, setModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', task: {...} }
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tasks');
      const d = await res.json();
      // An empty page with no explanation is how a refused request used to
      // look — say why instead.
      if (!res.ok) { toast?.error?.('Could not load tasks', d.error || `The server refused (${res.status}).`); setLoading(false); return; }
      if (d.tasks) setTasks(d.tasks);
      if (d.stats) { setStats(d.stats); setTab(prev => prev || (d.stats.pending > 0 ? 'subs' : 'tasks')); }
    } catch { toast?.error?.('Could not load tasks', 'Check your connection and try again.'); }
    setLoading(false);
  }, []);

  const loadSubs = useCallback(async () => {
    setSubLoading(true);
    try {
      const p = new URLSearchParams({ tab: 'subs', status: fSt, platform: fPlat, q: fUser, page: subPage, per: subPer, sort: subSort, dir: subDir });
      const res = await fetch(`/api/admin/tasks?${p}`);
      const d = await res.json();
      if (d.submissions) {
        setSubs(d.submissions.rows);
        setSubTotal(d.submissions.total);
        setSubCounts(d.submissions.counts);
        setSubsLoaded(true);
      }
      if (d.stats) setStats(d.stats);
    } catch { /* ignore */ }
    setSubLoading(false);
  }, [fSt, fPlat, fUser, subPage, subPer, subSort, subDir]);

  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { if (tab === 'subs') loadSubs(); }, [tab, loadSubs]);

  // Anything over the page owns it: no scrolling behind, Escape closes.
  const overlay = !!(modal || reject);
  useEffect(() => {
    if (!overlay) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') { setModal(null); setReject(null); } };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [overlay]);

  // ── Task CRUD ──
  const openCreate = () => { setForm({ ...EMPTY_FORM }); setLimitsOpen(false); setModal({ mode: 'create' }); };
  const openEdit = (task) => {
    setLimitsOpen(hasLimits(task));
    setForm({
      platform: task.platform, title: task.title, instructions: task.instructions,
      category: task.category, proofType: task.proofType, reward: task.reward / 100,
      frequency: task.frequency, maxPerMonth: task.maxPerMonth, minViews: task.minViews,
      minFollowers: task.minFollowers, keepDays: task.keepDays, monthlyCap: task.monthlyCap,
      viralBonus: task.viralBonus, viralThreshold: task.viralThreshold,
      viralAmount: task.viralAmount / 100, allowNonDepositors: task.allowNonDepositors,
      active: task.active,
    });
    setModal({ mode: 'edit', task });
  };

  const saveTask = async () => {
    if (!form.title.trim()) { toast?.warning?.('Give it a title', 'A task needs a name before it can be saved.'); return; }
    setSaving(true);
    try {
      const body = {
        action: modal.mode === 'create' ? 'create_task' : 'update_task',
        ...(modal.mode === 'edit' && { id: modal.task.id }),
        ...form,
        reward: Math.round((parseFloat(form.reward) || 0) * 100),
        viralAmount: Math.round((parseFloat(form.viralAmount) || 0) * 100),
        maxPerMonth: parseInt(form.maxPerMonth) || 0,
        minViews: parseInt(form.minViews) || 0,
        minFollowers: parseInt(form.minFollowers) || 0,
        keepDays: parseInt(form.keepDays) || 0,
        monthlyCap: parseInt(form.monthlyCap) || 0,
        viralThreshold: parseInt(form.viralThreshold) || 0,
      };
      const res = await fetch('/api/admin/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (d.ok) { toast?.success?.(modal.mode === 'create' ? 'Task created' : 'Task updated'); setModal(null); loadTasks(); }
      else toast?.error?.(d.error || 'Failed');
    } catch { toast?.error?.('Request failed'); }
    setSaving(false);
  };

  const deleteTask = async () => {
    if (!modal?.task?.id) return;
    const yes = await confirm?.({ title: 'Delete this task?', message: 'This cannot be undone. A task that already has submissions is turned off instead.', confirmLabel: 'Delete', danger: true });
    if (!yes) return;
    try {
      const res = await fetch('/api/admin/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_task', id: modal.task.id }) });
      const d = await res.json();
      if (d.ok) { toast?.success?.(d.deactivated ? 'Task turned off (it has submissions)' : 'Task deleted'); setModal(null); loadTasks(); }
    } catch { toast?.error?.('Failed'); }
  };

  // This used to flip the row and swallow every error, so a write the server
  // refused (a view-only account, a dropped request) still looked like it had
  // worked until the page was reloaded. It now only moves once the server says
  // it moved, and says so out loud when it did not.
  const toggleTask = async (id, active) => {
    try {
      const res = await fetch('/api/admin/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle_task', id, active }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        toast?.error?.(active ? 'Could not turn it on' : 'Could not turn it off', d.error || `The server refused (${res.status}).`);
        return;
      }
      setTasks(prev => prev.map(x => x.id === id ? { ...x, active } : x));
      setStats(prev => ({ ...prev, activeTasks: (prev.activeTasks || 0) + (active ? 1 : -1) }));
      toast?.success?.(active ? 'Task is live' : 'Task turned off');
    } catch {
      toast?.error?.('Request failed', 'Check your connection and try again.');
    }
  };

  // ── Submission review ──
  const reviewSub = async (id, action, reason) => {
    setBusy(id);
    try {
      const res = await fetch('/api/admin/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id, reason }) });
      const d = await res.json();
      if (d.ok) {
        toast?.success?.(action === 'approve' ? 'Approved and credited' : 'Rejected');
        setSubs(prev => prev.map(s => s.id === id ? { ...s, status: action === 'approve' ? 'approved' : 'rejected' } : s));
        loadSubs(); loadTasks();
      }
      else toast?.error?.(d.error || 'Failed');
    } catch { toast?.error?.('Failed'); }
    setBusy(null);
  };

  const sendReject = async () => {
    const r = reject; if (!r) return;
    setReject(null);
    await reviewSub(r.sub.id, 'reject', r.reason.trim() || undefined);
  };

  // ── Filtered tasks ──
  const filteredTasks = tasks.filter(x =>
    (tPlat === 'all' || x.platform === tPlat) &&
    (tSt === 'all' || (tSt === '1' ? x.active : !x.active)) &&
    (!tq || x.title.toLowerCase().includes(tq.toLowerCase()))
  );
  const liveTasks = tasks.filter(x => x.active);

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(subTotal / subPer));
  const pageStart = subTotal ? (subPage - 1) * subPer + 1 : 0;
  const pageEnd = Math.min(subPage * subPer, subTotal);

  const waiting = stats.pending || 0;
  const reviewed30 = (stats.approved30 || 0) + (stats.rejected30 || 0);
  const taskMeta = (x) => `${CAT_WORD[x.category] || x.category} · ${PROOF_WORD[x.proofType] || x.proofType} · ${FREQ_WORD[x.frequency] || x.frequency}`;
  const platformOptions = [{ value: 'all', label: 'All platforms' }, ...PLATFORMS.map(p => ({ value: p.id, label: p.name }))];

  // ── What the editor works out from the form as it is typed ──
  const rewardNaira = parseFloat(form.reward) || 0;
  const realCost = Math.round(rewardNaira * 0.375);
  const cost200 = Math.round(rewardNaira * 200 * 0.375);
  const doneCount = modal?.mode === 'edit' ? (modal.task?._count?.submissions ?? modal.task?.doneCount ?? 0) : 0;
  const previewBlank = !form.title.trim() && !form.instructions.trim();
  const num = (v) => parseInt(v) || 0;
  const limitBits = [
    num(form.minViews) && `${fmt(num(form.minViews))}+ views`,
    num(form.minFollowers) && `${fmt(num(form.minFollowers))}+ followers`,
    num(form.keepDays) && `kept up ${fmt(num(form.keepDays))} days`,
    num(form.monthlyCap) && `${fmt(num(form.monthlyCap))} approvals a month`,
    num(form.maxPerMonth) && `${fmt(num(form.maxPerMonth))} a customer a month`,
    form.viralBonus && 'viral bonus',
    !form.allowNonDepositors && 'depositors only',
  ].filter(Boolean);
  const limitSummary = limitBits.length ? limitBits.join(' · ') : 'nothing set — anyone can do it, once';

  const vars = {
    '--card': dark ? '#141930' : '#ffffff', '--ink': t.text, '--mut': t.textMuted, '--dim': dark ? '#5c6170' : '#a19b93', '--line': t.cardBorder, '--rail': dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)', '--soft': dark ? '#111634' : '#faf9f7',
    '--ac': t.accent, '--ok': dark ? '#6ee7b7' : '#0a7d54', '--warn': dark ? '#fcd34d' : '#b45309', '--bad': dark ? '#fca5a5' : '#c62828', '--in': dark ? '#131728' : '#fff', '--blue': dark ? '#a5b4fc' : '#4c62c4',
  };

  return (
    <div className="tk" style={vars}>
      <style>{TK_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Tasks</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Small jobs customers do for a wallet credit.</div>
          </div>
          {!loading && (
            <div className="tk-hr">
              <SegPill value={tab} options={[{ value: 'subs', label: `Submissions · ${waiting}` }, { value: 'tasks', label: `Tasks · ${tasks.length}` }]} onChange={v => setTab(v)} dark={dark} t={t} />
            </div>
          )}
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {loading ? <><SkelFacts dark={dark} /><SkelBar dark={dark} pills={2} /><SkelList dark={dark} rows={6} title rowH={62} /></> : <>
        <div className="tk-stats">
          <div className={'tk-stt' + (waiting > 0 ? ' warn' : '')}><b className="m">{waiting}</b><span>Waiting for review</span><i>{waiting > 0 && stats.oldestPending ? `oldest since ${isToday(stats.oldestPending) ? `${hm(stats.oldestPending)} today` : dayOf(stats.oldestPending)}` : 'nothing waiting'}</i></div>
          <div className="tk-stt"><b className="m">{stats.approved30 || 0}</b><span>Approved, 30 days</span><i>{`₦${fmt(Math.round((stats.credited30 || 0) / 100))} credited`}</i></div>
          <div className="tk-stt"><b className="m">{stats.rejected30 || 0}</b><span>Rejected, 30 days</span><i>{reviewed30 ? `${Math.round((stats.rejected30 || 0) / reviewed30 * 100)}% of what was reviewed` : 'nothing reviewed yet'}</i></div>
          <div className="tk-stt"><b className="m">{liveTasks.length} of {tasks.length}</b><span>Live tasks</span><i>{liveTasks.length ? liveTasks.map(x => x.title).join(', ') : 'none live'}</i></div>
        </div>

        {tab === 'subs' ? <>
          <div className="tk-bar">
            {['pending', 'approved', 'rejected', 'all'].map(s => (
              <button key={s} type="button" className={'tk-tg' + (fSt === s ? ' on' : '')} onClick={() => { setFSt(s); setSubPage(1); }}>
                {s === 'pending' ? 'Waiting' : s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)} {subCounts[s] || 0}
              </button>
            ))}
            <FilterDropdown dark={dark} t={t} value={fPlat} onChange={v => { setFPlat(v); setSubPage(1); }} options={platformOptions} />
            <FilterDropdown dark={dark} t={t} value={`${subSort}_${subDir}`} onChange={v => { const [s, d] = v.split('_'); setSubSort(s); setSubDir(d); setSubPage(1); }} options={SORT_OPTIONS} />
            <div className="tk-srch"><span className="tk-si">{SEARCH}</span><input value={fUser} onChange={e => { setFUser(e.target.value); setSubPage(1); }} placeholder="Search by name" /></div>
          </div>

          {!subsLoaded ? <SkelList dark={dark} rows={6} title rowH={62} /> : (
            <section className="tk-card" style={{ opacity: subLoading ? .55 : 1 }}>
              <header><h3>{CARD_TITLE[fSt]}</h3><span className="tk-cnt">{SORT_WORD[`${subSort}_${subDir}`] || 'newest first'} · open the proof before you approve</span></header>
              <div className="tk-list">
                {subs.length === 0 ? <div className="tk-empty">{fSt === 'pending' ? 'Nothing is waiting for review.' : 'No submissions match.'}</div> : subs.map(s => {
                  const link = proofToLink(s.proof, s.task?.platform);
                  return (
                    <div key={s.id} className="tk-r sb">
                      <span className="tk-oav">{initials(s.user?.name)}</span>
                      <span className="tk-tt"><b>{s.user?.name || 'Unknown'}</b><i>{s.user?.email || '—'}</i></span>
                      <span className="tk-tt"><b>{s.task?.title || '—'}</b><i className="tk-proof">{link ? <a href={link.url} target="_blank" rel="noopener noreferrer" title={link.url}>{shortLink(s.proof)}</a> : <span>{s.proof || 'no proof'}</span>}</i></span>
                      <span className="m tk-num">₦{fmt((s.task?.reward || 0) / 100)}</span>
                      <span className="tk-mid">{whenWord(s.createdAt)}</span>
                      {s.status === 'pending' ? (
                        <span className="tk-acts">
                          <button type="button" className="tk-b sm ok" disabled={busy === s.id} onClick={() => reviewSub(s.id, 'approve')}>{busy === s.id ? 'Working…' : 'Approve'}</button>
                          <button type="button" className="tk-b sm danger" disabled={busy === s.id} onClick={() => setReject({ sub: s, reason: '' })}>Reject</button>
                        </span>
                      ) : (
                        <span className="tk-acts tk-rev">
                          <span className="tk-st"><i className={'tk-dot ' + (s.status === 'approved' ? 'ok' : 'bad')} />{s.status === 'approved' ? 'Approved' : 'Rejected'}</span>
                          <i>{s.reviewedBy || 'system'}{s.reviewedAt ? ` · ${whenWord(s.reviewedAt)}` : ''}</i>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="tk-pg">
                <span className="tk-cnt">{pageStart}–{pageEnd} of {subTotal.toLocaleString()}</span>
                <span className="tk-pgn">
                  <button type="button" className="tk-ib" disabled={subPage <= 1} onClick={() => setSubPage(p => Math.max(1, p - 1))} aria-label="Previous page">‹</button>
                  <span className="tk-cnt">{subPage} of {totalPages}</span>
                  <button type="button" className="tk-ib" disabled={subPage >= totalPages} onClick={() => setSubPage(p => Math.min(totalPages, p + 1))} aria-label="Next page">›</button>
                  <select className="tk-per" value={subPer} onChange={e => { setSubPer(+e.target.value); setSubPage(1); }} aria-label="Rows per page">
                    <option value="10">10 a page</option>
                    <option value="25">25 a page</option>
                    <option value="50">50 a page</option>
                  </select>
                </span>
              </div>
            </section>
          )}
        </> : <>
          <div className="tk-bar">
            <div className="tk-srch"><span className="tk-si">{SEARCH}</span><input value={tq} onChange={e => setTq(e.target.value)} placeholder="Search tasks" /></div>
            <FilterDropdown dark={dark} t={t} value={tPlat} onChange={setTPlat} options={platformOptions} />
            <FilterDropdown dark={dark} t={t} value={tSt} onChange={setTSt} options={[{ value: 'all', label: 'Live and off' }, { value: '1', label: 'Live' }, { value: '0', label: 'Off' }]} />
            <span className="tk-sp" />
            <button type="button" className="tk-b pri" onClick={openCreate}>+ New task</button>
          </div>

          <section className="tk-card">
            <header><h3>Tasks</h3><span className="tk-cnt">what customers can do · reward · how many did it</span></header>
            <div className="tk-list">
              {filteredTasks.length === 0 ? <div className="tk-empty">{tasks.length ? 'No tasks match.' : 'No tasks yet. Add the first one.'}</div> : filteredTasks.map(x => (
                <div key={x.id} className="tk-r ts">
                  <span className="tk-pav">{PF_SHORT[x.platform] || '•'}</span>
                  <span className="tk-tt"><b>{x.title}</b><i>{taskMeta(x)}</i></span>
                  <span className="m tk-num">₦{fmt(x.reward / 100)}</span>
                  <span className="m tk-mid">{(x._count?.submissions ?? x.doneCount ?? 0).toLocaleString()} done</span>
                  <span className="tk-st"><i className={'tk-dot ' + (x.active ? 'ok' : 'dim')} />{x.active ? 'Live' : 'Off'}</span>
                  <span className="tk-acts">
                    <button type="button" className="tk-b sm" onClick={() => openEdit(x)}>Edit</button>
                    <button type="button" className={`tk-b sm ${x.active ? 'warn' : 'ok'}`} onClick={() => toggleTask(x.id, !x.active)}>{x.active ? 'Turn off' : 'Turn on'}</button>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>}
      </>}

      {reject && (
        <div className="tk-bd" onClick={() => setReject(null)}>
          <div className="tk-md sm" role="dialog" aria-modal="true" aria-label="Reject this proof" onClick={e => e.stopPropagation()}>
            <div className="tk-mdh"><b>Reject this proof?</b><button type="button" className="tk-b sm" onClick={() => setReject(null)}>Close</button></div>
            <p className="tk-mds">{reject.sub.user?.name || 'This customer'} gets nothing for “{reject.sub.task?.title}”. A short reason helps them do it right next time.</p>
            <label className="tk-lbl" htmlFor="tk-reason">Reason (optional)</label>
            <textarea id="tk-reason" className="tk-in ta" rows={3} value={reject.reason} onChange={e => setReject(r => ({ ...r, reason: e.target.value }))} placeholder="e.g. the link goes to a different account" autoFocus />
            <div className="tk-mdf"><button type="button" className="tk-b" onClick={() => setReject(null)}>Cancel</button><button type="button" className="tk-b danger" onClick={sendReject}>Reject</button></div>
          </div>
        </div>
      )}

      {modal && (
        <div className="tk-bd tk-sheet" onClick={() => setModal(null)}>
          <div className="tk-md tk-em" role="dialog" aria-modal="true" aria-label={modal.mode === 'create' ? 'New task' : 'Edit task'} onClick={e => e.stopPropagation()}>

            <div className="tk-emh">
              <div>
                <b>{modal.mode === 'create' ? 'New task' : 'Edit task'}</b>
                {modal.mode === 'create'
                  ? <i>It goes live only when you switch it on.</i>
                  : doneCount > 0 && <i>{doneCount.toLocaleString()} {doneCount === 1 ? 'person has' : 'people have'} done this one. Changes do not affect what they already earned.</i>}
              </div>
              <span className="tk-hsw">
                <Toggle on={form.active} label="Live" onClick={() => setForm(f => ({ ...f, active: !f.active }))} />
                <em>{form.active ? 'Live' : 'Off'}</em>
              </span>
              <button type="button" className="tk-x" onClick={() => setModal(null)} aria-label="Close">{CLOSE}</button>
            </div>

            <div className="tk-emb">
              {/* Left: the task itself */}
              <div className="tk-col">
                <span className="tk-kick">The task</span>

                <div className="tk-fl">
                  <label htmlFor="tk-platform">Platform</label>
                  <span className="tk-pf">
                    <span className="tk-tile">{PF_SHORT[form.platform] || '•'}</span>
                    <select id="tk-platform" className="tk-sel" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                      {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </span>
                </div>
                {(form.platform === 'google' || form.platform === 'trustpilot') && (
                  <div className="tk-note warn">Paid reviews breach Google and Trustpilot policy. Read the proposal doc before turning this on.</div>
                )}

                <div className="tk-fl">
                  <label htmlFor="tk-title">Title</label>
                  <input id="tk-title" className="tk-in" type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Follow us on TikTok" />
                  <span className="tk-hint">The line the customer reads first</span>
                </div>

                <div className="tk-fl">
                  <label htmlFor="tk-instr">What they must do</label>
                  <textarea id="tk-instr" className="tk-in ta" rows={3} value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} />
                </div>

                <div className="tk-r2">
                  <div className="tk-fl">
                    <label htmlFor="tk-proof">Proof they send</label>
                    <select id="tk-proof" className="tk-sel" value={form.proofType} onChange={e => setForm(f => ({ ...f, proofType: e.target.value }))}>
                      {PROOF_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </div>
                  <div className="tk-fl">
                    <label htmlFor="tk-cat">Category</label>
                    <select id="tk-cat" className="tk-sel" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                <span className="tk-kick mt">The money</span>
                <div className="tk-r2">
                  <div className="tk-fl">
                    <label htmlFor="tk-reward">Reward</label>
                    <div className="tk-money"><span>₦</span><input id="tk-reward" className="tk-in" type="number" value={form.reward} onChange={e => setForm(f => ({ ...f, reward: e.target.value }))} /></div>
                    <span className="tk-hint">Spend-only credit</span>
                  </div>
                  <div className="tk-fl">
                    <label htmlFor="tk-freq">How often</label>
                    <select id="tk-freq" className="tk-sel" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                      {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Right: the card as the customer will read it, and what it costs */}
              <div className="tk-pv">
                <span className="tk-kick">What the customer sees</span>
                {previewBlank ? (
                  <>
                    <div className="tk-pvc blank"><span className="tk-sk a" /><span className="tk-sk b" /><span className="tk-sk c" /></div>
                    <p className="tk-pvnote">Fill in the title and reward and this fills in with it.</p>
                  </>
                ) : (
                  <div className="tk-pvc">
                    <div className="tk-pvh">
                      <span className="tk-pvt">{PF_SHORT[form.platform] || '•'}</span>
                      <span className="tk-pvn"><b>{form.title || 'Untitled task'}</b><i>{bandOf(Math.round(rewardNaira * 100))}</i></span>
                      <span className="m tk-pvp">₦{fmt(rewardNaira)}</span>
                    </div>
                    {form.instructions.trim() && <p className="tk-pvi">{form.instructions}</p>}
                    <div className="tk-pvf">
                      <span className="tk-pvin">{proofPlaceholder(form.proofType, form.platform)}</span>
                      <span className="tk-pvb">Submit</span>
                    </div>
                  </div>
                )}
                <div className="tk-cost">
                  <span className="tk-cl"><i>Face value</i><b className="m">₦{fmt(rewardNaira)}</b></span>
                  <span className="tk-cl"><i>What it actually costs us</i><b className="m">₦{fmt(realCost)}</b></span>
                  <span className="tk-cl"><i>If 200 people do it</i><b className="m">₦{fmt(cost200)}</b></span>
                </div>
              </div>

              {/* Under both: everything that is usually left alone */}
              <div className={'tk-more' + (limitsOpen ? ' open' : '')}>
                <button type="button" className="tk-mh" aria-expanded={limitsOpen} onClick={() => setLimitsOpen(v => !v)}>
                  <b>Limits and gates</b><span className="tk-hint">{limitSummary}</span>{CHEV}
                </button>
                {limitsOpen && (
                  <div className="tk-mb">
                    <div className="tk-r3">
                      <div className="tk-fl"><label htmlFor="tk-mv">Min views</label><input id="tk-mv" className="tk-in" type="number" value={form.minViews} onChange={e => setForm(f => ({ ...f, minViews: e.target.value }))} /></div>
                      <div className="tk-fl"><label htmlFor="tk-mf">Min followers</label><input id="tk-mf" className="tk-in" type="number" value={form.minFollowers} onChange={e => setForm(f => ({ ...f, minFollowers: e.target.value }))} /></div>
                      <div className="tk-fl"><label htmlFor="tk-kd">Keep live (days)</label><input id="tk-kd" className="tk-in" type="number" value={form.keepDays} onChange={e => setForm(f => ({ ...f, keepDays: e.target.value }))} /></div>
                    </div>
                    <div className="tk-r2">
                      <div className="tk-fl">
                        <label htmlFor="tk-cap">Approvals a month</label>
                        <input id="tk-cap" className="tk-in" type="number" value={form.monthlyCap} onChange={e => setForm(f => ({ ...f, monthlyCap: e.target.value }))} />
                        <span className="tk-hint">0 means no cap of its own</span>
                      </div>
                      <div className="tk-fl">
                        <label htmlFor="tk-mpm">Max per customer a month</label>
                        <input id="tk-mpm" className="tk-in" type="number" value={form.maxPerMonth} onChange={e => setForm(f => ({ ...f, maxPerMonth: e.target.value }))} />
                      </div>
                    </div>

                    <div className="tk-tog">
                      <span className="tk-tt2"><b>Viral bonus</b><i>Extra credit if the post passes a bigger view mark</i></span>
                      <Toggle on={form.viralBonus} label="Viral bonus" onClick={() => setForm(f => ({ ...f, viralBonus: !f.viralBonus }))} />
                    </div>
                    {form.viralBonus && (
                      <div className="tk-r2">
                        <div className="tk-fl"><label htmlFor="tk-vth">Bonus threshold (views)</label><input id="tk-vth" className="tk-in" type="number" value={form.viralThreshold} onChange={e => setForm(f => ({ ...f, viralThreshold: e.target.value }))} /></div>
                        <div className="tk-fl"><label htmlFor="tk-vam">Bonus amount</label><div className="tk-money"><span>₦</span><input id="tk-vam" className="tk-in" type="number" value={form.viralAmount} onChange={e => setForm(f => ({ ...f, viralAmount: e.target.value }))} /></div></div>
                      </div>
                    )}

                    <div className="tk-tog">
                      <span className="tk-tt2"><b>Open to customers who never deposited</b><i>Off means only paying customers can do it</i></span>
                      <Toggle on={form.allowNonDepositors} label="Open to customers who never deposited" onClick={() => setForm(f => ({ ...f, allowNonDepositors: !f.allowNonDepositors }))} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="tk-emf">
              <button type="button" className="tk-b" onClick={() => setModal(null)}>Cancel</button>
              {modal.mode === 'edit' && <button type="button" className="tk-b danger tk-left" onClick={deleteTask}>Delete</button>}
              <button type="button" className="tk-b pri" disabled={saving || !form.title.trim()} onClick={saveTask}>{saving ? 'Saving…' : modal.mode === 'create' ? 'Create task' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TK_CSS = `
.tk{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.tk *{box-sizing:border-box}
.tk .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.tk-hr{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.tk-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;transition:transform .15s}.tk-b:hover{transform:translateY(-1px)}.tk-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
/* Actions say what they do: turning a task on is the good outcome, turning it
 * off withdraws something customers can see (consequential but reversible, so
 * amber rather than red), and red stays for Delete and Reject. Edit is neutral
 * because it decides nothing on its own. */
.tk-b.sm{height:30px;padding:0 10px;font-size:12px}.tk-b.pri{background:var(--ac);color:#fff;border-color:var(--ac)}.tk-b.danger{color:var(--bad)}.tk-b.ok{color:var(--ok)}.tk-b.warn{color:var(--warn)}
.tk-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.tk-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.tk-stt:first-child{border-left:0}
.tk-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tk-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap}.tk-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tk-stt.warn b{color:var(--warn)}
.tk-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.tk-sp{flex:1}
.tk-srch{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);font-size:13px;min-width:240px}.tk-srch:focus-within{border-color:var(--ac)}
.tk-si{display:inline-flex;width:14px;height:14px;color:var(--dim);flex-shrink:0}.tk-si svg{width:14px;height:14px}.tk-srch input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13px;color:var(--ink);outline:none}.tk-srch input::placeholder{color:var(--dim)}
.tk-tg{font:inherit;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);cursor:pointer;white-space:nowrap}.tk-tg.on{background:var(--ink);color:var(--card);border-color:var(--ink)}
.tk-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;transition:opacity .15s}
.tk-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.tk-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.tk-cnt{font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tk-list{display:flex;flex-direction:column}.tk-empty{padding:28px 16px;text-align:center;font-size:13px;color:var(--mut)}
.tk-r{display:grid;align-items:center;gap:12px;padding:11px 16px;border-top:1px solid var(--rail);font-size:13px}.tk-r:first-child{border-top:0}
.tk-r.sb{grid-template-columns:36px 1fr 1.2fr 70px 50px auto}.tk-r.ts{grid-template-columns:34px 1fr 80px 80px 80px auto}
.tk-oav{width:36px;height:36px;border-radius:50%;background:var(--soft);border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--mut);flex-shrink:0}
.tk-pav{width:34px;height:34px;border-radius:10px;background:var(--soft);border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--mut);flex-shrink:0}
.tk-tt{display:flex;flex-direction:column;min-width:0}.tk-tt b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tk-tt i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tk-proof,.tk-proof a{color:var(--blue)}.tk-proof a{text-decoration:none}.tk-proof a:hover{text-decoration:underline}
.tk-num{text-align:right;font-weight:700}.tk-mid{font-size:12px;color:var(--mut);white-space:nowrap}
.tk-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--mut);white-space:nowrap}.tk-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}.tk-dot.ok{background:var(--ok)}.tk-dot.bad{background:var(--bad)}.tk-dot.dim{background:var(--dim)}
.tk-acts{display:flex;gap:6px;justify-content:flex-end}.tk-rev{flex-direction:column;align-items:flex-end;gap:2px}.tk-rev i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap}
.tk-pg{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-top:1px solid var(--line);background:var(--soft)}.tk-pgn{display:inline-flex;align-items:center;gap:6px}
.tk-ib{font:inherit;width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);display:inline-flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer}.tk-ib:disabled{opacity:.4;cursor:default}
.tk-per{font:inherit;font-size:11.5px;height:28px;padding:0 8px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);margin-left:6px;outline:none}
.tk-bd{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.4);display:flex;align-items:flex-start;justify-content:center;padding:32px 16px;overflow-y:auto}
.tk-md{width:560px;max-width:100%;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px 18px;box-shadow:0 20px 50px rgba(0,0,0,.25);color:var(--ink)}.tk-md.sm{width:440px}
.tk-mdh{display:flex;justify-content:space-between;align-items:center}.tk-mdh b{font-size:16px;font-weight:700}.tk-mds{margin:4px 0 0;font-size:12.5px;color:var(--mut);line-height:1.5}.tk-mdf{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}.tk-left{margin-right:auto}
.tk-lbl{display:block;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);margin:14px 0 6px}
.tk-in,.tk-sel{width:100%;height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--in);color:var(--ink);font:inherit;font-size:14px;outline:none}.tk-in:focus,.tk-sel:focus{border-color:var(--ac)}
.tk-in.ta{height:auto;min-height:74px;padding:9px 12px;resize:vertical;line-height:1.5}
.tk-money{position:relative}.tk-money span{position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--mut)}.tk-money .tk-in{padding-left:26px}
.tk-note{font-size:11px;color:var(--mut);line-height:1.5}.tk-note.warn{color:var(--warn)}
.tk-sw{position:relative;width:34px;height:20px;border-radius:999px;border:0;padding:0;background:var(--rail);cursor:pointer;flex-shrink:0;transition:background .15s}.tk-sw i{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:var(--card);box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}.tk-sw.on{background:var(--ok)}.tk-sw.on i{transform:translateX(14px);background:#fff}
/* ── The task editor ── */
.tk-md.tk-em{width:860px;padding:0;border-radius:20px;max-height:calc(100vh - 64px);display:flex;flex-direction:column;overflow:hidden}
.tk-emh{display:flex;align-items:center;gap:14px;padding:16px 22px;border-bottom:1px solid var(--line)}
.tk-emh>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.tk-emh b{font-size:19px;font-weight:700;line-height:1.15}
.tk-emh i{font-style:normal;font-size:12.5px;color:var(--mut);line-height:1.4}
.tk-hsw{display:inline-flex;align-items:center;gap:8px;flex-shrink:0}
.tk-hsw em{font-style:normal;font-size:11px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;color:var(--mut)}
.tk-x{font:inherit;width:30px;height:30px;border-radius:9px;border:0;background:none;color:var(--dim);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}.tk-x:hover{background:var(--rail);color:var(--ink)}
.tk-emb{flex:1;min-height:0;overflow:auto;padding:20px 22px;display:grid;grid-template-columns:1fr 300px;grid-template-areas:"form pv" "more more";gap:16px 26px;align-items:start}
.tk-col{grid-area:form;display:flex;flex-direction:column;gap:12px;min-width:0}
.tk-kick{font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--ac)}
.tk-kick.mt{margin-top:6px}
.tk-fl{display:flex;flex-direction:column;gap:5px;min-width:0}
.tk-fl>label{font-size:11.5px;font-weight:650;color:var(--mut)}
.tk-hint{font-size:11.5px;color:var(--dim)}
.tk-r2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tk-r3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.tk-pf{position:relative;display:flex;align-items:center}
.tk-pf .tk-sel{padding-left:44px}
.tk-tile{position:absolute;left:9px;width:26px;height:26px;border-radius:8px;background:var(--rail);display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:var(--mut);pointer-events:none}
.tk-pv{grid-area:pv;position:sticky;top:0;display:flex;flex-direction:column;gap:9px;min-width:0}
.tk-pvc{background:var(--soft);border:1px solid var(--line);border-radius:15px;padding:14px}
.tk-pvc.blank{display:flex;flex-direction:column;gap:9px}
.tk-pvh{display:flex;align-items:center;gap:11px}
.tk-pvt{width:34px;height:34px;border-radius:10px;background:var(--card);border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--mut);flex-shrink:0}
.tk-pvn{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
.tk-pvn b{font-size:14px;font-weight:650;line-height:1.3;word-break:break-word}.tk-pvn i{font-style:normal;font-size:11.5px;color:var(--mut)}
.tk-pvp{font-size:14px;font-weight:700;color:var(--ok);flex-shrink:0}
.tk-pvi{font-size:12.5px;line-height:1.5;color:var(--mut);margin:11px 0 0;white-space:pre-wrap}
.tk-pvf{display:flex;gap:8px;margin-top:11px}
.tk-pvin{flex:1;min-width:0;display:flex;align-items:center;height:34px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);font-size:13px;color:var(--dim);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.tk-pvb{display:inline-flex;align-items:center;justify-content:center;height:34px;padding:0 14px;border-radius:10px;background:var(--ac);color:#fff;font-size:12.5px;font-weight:700;flex-shrink:0}
.tk-sk{display:block;height:11px;border-radius:5px;background:var(--rail)}.tk-sk.a{width:60%;height:15px}.tk-sk.b{width:100%}.tk-sk.c{width:75%}
.tk-pvnote{margin:0;font-size:11.5px;color:var(--dim)}
.tk-cost{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:13px;overflow:hidden}
.tk-cl{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 13px;border-top:1px solid var(--rail);font-size:12.5px}
.tk-cl:first-child{border-top:0}.tk-cl i{font-style:normal;color:var(--mut)}.tk-cl b{font-weight:700}
.tk-more{grid-area:more;border:1px solid var(--line);border-radius:14px;overflow:hidden}
.tk-mh{font:inherit;width:100%;display:flex;align-items:center;gap:10px;padding:13px 16px;background:var(--soft);border:0;color:var(--ink);cursor:pointer;text-align:left}
.tk-mh b{font-size:13px;font-weight:700;flex-shrink:0}
.tk-mh .tk-hint{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tk-chev{color:var(--dim);flex-shrink:0;transition:transform .2s}
.tk-more.open .tk-chev{transform:rotate(180deg)}
.tk-more.open .tk-mh{border-bottom:1px solid var(--line)}
.tk-mb{padding:16px;display:flex;flex-direction:column;gap:13px}
.tk-tog{display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:12px;border:1px solid var(--line)}
.tk-tt2{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
.tk-tt2 b{font-size:13.5px;font-weight:650}.tk-tt2 i{font-style:normal;font-size:12px;color:var(--mut);line-height:1.4}
.tk-emf{display:flex;justify-content:flex-end;gap:9px;padding:14px 22px;border-top:1px solid var(--line);background:var(--soft)}
@media (max-width:900px){
  .tk-hr{width:100%}.tk-hr>*{flex:1}
  .tk-stats{grid-template-columns:1fr 1fr}.tk-stt:nth-child(3){border-left:0}.tk-stt:nth-child(n+3){border-top:1px solid var(--line)}.tk-stt b{font-size:17px}
  .tk-bar .tk-tg{flex:1;text-align:center;padding:8px 6px}.tk-srch{width:100%;min-width:0}.tk-bar .tk-b.pri{width:100%}.tk-sp{display:none}
  .tk-r.sb{grid-template-columns:36px 1fr auto;grid-template-areas:"av u r" "av t t" "acts acts acts";gap:6px 10px;padding:12px 14px}
  .tk-r.sb .tk-oav{grid-area:av;align-self:start}.tk-r.sb .tk-tt:nth-of-type(1){grid-area:u}.tk-r.sb .tk-tt:nth-of-type(2){grid-area:t}.tk-r.sb .tk-tt b,.tk-r.sb .tk-tt i{white-space:normal;word-break:break-word}.tk-r.sb .tk-num{grid-area:r}.tk-r.sb .tk-mid{display:none}
  .tk-r.sb .tk-acts{grid-area:acts;justify-content:stretch;margin-top:2px}.tk-r.sb .tk-acts .tk-b{flex:1;height:36px}.tk-r.sb .tk-rev{flex-direction:row;align-items:center;justify-content:space-between}
  .tk-r.ts{grid-template-columns:34px 1fr auto;grid-template-areas:"pav tt r" "pav n st" "acts acts acts";gap:6px 10px;padding:12px 14px}
  .tk-r.ts .tk-pav{grid-area:pav;align-self:start}.tk-r.ts .tk-tt{grid-area:tt}.tk-r.ts .tk-tt b,.tk-r.ts .tk-tt i{white-space:normal}.tk-r.ts .tk-num{grid-area:r}.tk-r.ts .tk-mid{grid-area:n}.tk-r.ts .tk-st{grid-area:st;justify-self:end}
  .tk-r.ts .tk-acts{grid-area:acts;justify-content:stretch;margin-top:2px}.tk-r.ts .tk-acts .tk-b{flex:1;height:36px}
  .tk-pg{flex-wrap:wrap;gap:8px}
  .tk-bd{padding:12px 10px}.tk-md{padding:14px 14px 16px}
  .tk-bd.tk-sheet{padding:0;align-items:flex-end}
  .tk-md.tk-em{width:100%;max-height:92vh;border-radius:20px 20px 0 0}
  .tk-emh,.tk-emb,.tk-emf{padding-left:16px;padding-right:16px}
  .tk-emb{grid-template-columns:1fr;grid-template-areas:"form" "more" "pv"}
  .tk-pv{position:static}
  .tk-r2,.tk-r3{grid-template-columns:1fr}
  .tk-emf{flex-direction:column-reverse}.tk-emf .tk-b{width:100%;height:42px}.tk-emf .tk-left{margin-right:0}
}
`;
