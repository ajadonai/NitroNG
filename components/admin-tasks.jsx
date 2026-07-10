'use client';
import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from './confirm-dialog';
import { useToast } from './toast';
import InlineAlert from './inline-alert';
import { PlatformIcon } from './platform-icon';
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

const FREQ_LABEL = { one_time: 'One-time', per_campaign: 'Per campaign', weekly: 'Weekly', monthly: 'Monthly' };
const CAT_LABEL = { follow: 'Follow & Join', engage: 'Engage & Share', content: 'Original Content', review: 'Reviews' };

function fAgo(d) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'Yesterday';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const EMPTY_FORM = {
  platform: 'x', title: '', instructions: '', category: 'engage', proofType: 'link',
  reward: 250, frequency: 'weekly', maxPerMonth: 4, minViews: 0, minFollowers: 0,
  keepDays: 0, monthlyCap: 0, viralBonus: false, viralThreshold: 10000, viralAmount: 1000,
  allowNonDepositors: true, active: true,
};

export default function AdminTasksPage({ dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState('tasks');
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
  const [fSt, setFSt] = useState('all');
  const [fPlat, setFPlat] = useState('all');
  const [fUser, setFUser] = useState('');
  const [subPage, setSubPage] = useState(1);
  const [subPer, setSubPer] = useState(10);
  const [subSort, setSubSort] = useState('date');
  const [subDir, setSubDir] = useState('desc');
  const [subLoading, setSubLoading] = useState(false);

  // Modal
  const [modal, setModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', task: {...} }
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const cardBg = dark ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.85)';
  const cardBorder = `0.5px solid ${t.cardBorder}`;
  const inputStyle = { borderColor: t.cardBorder, background: dark ? '#131728' : '#fff', color: t.text };

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tasks');
      const d = await res.json();
      if (d.tasks) setTasks(d.tasks);
      if (d.stats) setStats(d.stats);
    } catch { /* ignore */ }
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
      }
      if (d.stats) setStats(d.stats);
    } catch { /* ignore */ }
    setSubLoading(false);
  }, [fSt, fPlat, fUser, subPage, subPer, subSort, subDir]);

  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { if (tab === 'subs') loadSubs(); }, [tab, loadSubs]);

  // ── Task CRUD ──
  const openCreate = () => { setForm({ ...EMPTY_FORM }); setModal({ mode: 'create' }); };
  const openEdit = (task) => {
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
    if (!form.title.trim()) return;
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
    const yes = await confirm?.({ title: 'Delete task?', message: 'This cannot be undone. Tasks with submissions will be deactivated instead.', confirmText: 'Delete', variant: 'danger' });
    if (!yes) return;
    try {
      const res = await fetch('/api/admin/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_task', id: modal.task.id }) });
      const d = await res.json();
      if (d.ok) { toast?.success?.(d.deactivated ? 'Task deactivated (has submissions)' : 'Task deleted'); setModal(null); loadTasks(); }
    } catch { toast?.error?.('Failed'); }
  };

  const toggleTask = async (id, active) => {
    try {
      await fetch('/api/admin/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'toggle_task', id, active }) });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, active } : t));
      setStats(prev => ({ ...prev, activeTasks: prev.activeTasks + (active ? 1 : -1) }));
    } catch { /* ignore */ }
  };

  // ── Submission review ──
  const reviewSub = async (id, action, reason) => {
    try {
      const res = await fetch('/api/admin/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id, reason }) });
      const d = await res.json();
      if (d.ok) { toast?.success?.(action === 'approve' ? 'Approved & credited' : 'Rejected'); loadSubs(); loadTasks(); }
      else toast?.error?.(d.error || 'Failed');
    } catch { toast?.error?.('Failed'); }
  };

  const sortSubs = (col) => {
    if (subSort === col) setSubDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSubSort(col); setSubDir('desc'); }
    setSubPage(1);
  };

  // ── Filtered tasks ──
  const filteredTasks = tasks.filter(t =>
    (tPlat === 'all' || t.platform === tPlat) &&
    (tSt === 'all' || (tSt === '1' ? t.active : !t.active)) &&
    (!tq || t.title.toLowerCase().includes(tq.toLowerCase()))
  );

  const groupedTasks = CATEGORIES.map(cat => ({
    ...cat,
    tasks: filteredTasks.filter(t => t.category === cat.id),
  })).filter(g => g.tasks.length > 0);

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(subTotal / subPer));
  const pageStart = subTotal ? (subPage - 1) * subPer + 1 : 0;
  const pageEnd = Math.min(subPage * subPer, subTotal);

  const taskMeta = (t) => {
    const parts = [FREQ_LABEL[t.frequency] || t.frequency];
    if (t.maxPerMonth) parts.push(`max ${t.maxPerMonth}/mo`);
    if (t.minViews) parts.push(`${t.minViews.toLocaleString()}+ views`);
    if (t.keepDays) parts.push(`live ${t.keepDays}d`);
    if (t.monthlyCap) parts.push(`cap ${t.monthlyCap}/mo`);
    parts.push(`proof: ${t.proofType}`);
    return parts.join(' · ');
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: `${t.accent} transparent transparent transparent` }} />
    </div>
  );

  return (
    <>
      {/* ── Header ── */}
      <div className="adm-header">
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="adm-title" style={{ color: t.text }}>Tasks</div>
          <button onClick={openCreate} className="inline-flex items-center justify-center gap-1.5 h-[34px] px-4 rounded-[9px] text-[13px] font-semibold" style={{ background: t.accent, color: dark ? '#14060a' : '#14060a' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            New Task
          </button>
        </div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Platform tasks and submission review</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 max-md:grid-cols-2 rounded-[14px] overflow-hidden mb-7" style={{ background: cardBg, border: cardBorder }}>
        {[
          { label: 'Pending review', value: stats.pending ?? '—', mono: true },
          { label: `Approved · ${new Date().toLocaleDateString('en-US', { month: 'long' })}`, value: stats.approvedMonth ?? '—', mono: true },
          { label: `Credit issued · ${new Date().toLocaleDateString('en-US', { month: 'long' })}`, value: `₦${fmt(Math.round((stats.creditMonth || 0) / 100))}`, sub: `/ ₦${fmt(Math.round((stats.budget || 0) / 100))}`, bar: stats.budget ? Math.min(100, Math.round((stats.creditMonth || 0) / stats.budget * 100)) : 0, mono: true },
          { label: 'Active tasks', value: stats.activeTasks ?? '—', mono: true },
        ].map((s, i) => (
          <div key={i} className={`py-4 px-5 max-md:py-3.5 max-md:px-4 ${i > 0 ? 'border-l max-md:border-l-0' : ''} ${i >= 2 ? 'max-md:border-t' : ''}`} style={{ borderColor: t.cardBorder }}>
            <div className="text-[10px] uppercase tracking-[1.1px] mb-1.5 whitespace-nowrap" style={{ color: dark ? '#706c68' : '#8a8580' }}>{s.label}</div>
            <div className="text-[17px] max-md:text-[15px] font-semibold font-mono">{s.value}{s.sub && <small className="text-[11px] font-medium ml-1" style={{ color: dark ? '#706c68' : '#8a8580' }}>{s.sub}</small>}</div>
            {s.bar !== undefined && <div className="max-w-[130px] h-[3px] rounded-full mt-2.5" style={{ background: 'rgba(255,255,255,.08)' }}><div className="h-full rounded-full" style={{ width: `${s.bar}%`, background: '#a3586b' }} /></div>}
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-5 mb-[18px]" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
        {[
          { id: 'tasks', label: 'Tasks', count: tasks.length },
          { id: 'subs', label: 'Submissions', count: subCounts.all || stats.pending || 0 },
        ].map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} className="pb-2.5 text-[13.5px] font-semibold -mb-px" style={{ color: tab === tb.id ? t.text : (dark ? '#706c68' : '#8a8580'), borderBottom: `2px solid ${tab === tb.id ? t.accent : 'transparent'}` }}>
            {tb.label} <span className="text-[11px] font-medium ml-1" style={{ color: dark ? '#706c68' : '#8a8580' }}>{tb.count}</span>
          </button>
        ))}
      </div>

      {/* ══ TASKS TAB ══ */}
      {tab === 'tasks' && (
        <>
          <div className="flex gap-2 flex-wrap items-center mb-3.5">
            <div className="relative max-md:flex-[1_1_100%] max-md:order-[-1]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={dark ? '#706c68' : '#8a8580'} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input type="text" placeholder="Search tasks" value={tq} onChange={e => setTq(e.target.value)} className="h-[34px] pl-8 pr-3 rounded-lg text-[13px] outline-none max-md:w-full" style={{ ...inputStyle, width: 210 }} />
            </div>
            <select value={tPlat} onChange={e => setTPlat(e.target.value)} className="h-[34px] pl-3 pr-7 rounded-lg text-[13px] outline-none appearance-none max-md:flex-1" style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23706c68' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}>
              <option value="all">All platforms</option>
              {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={tSt} onChange={e => setTSt(e.target.value)} className="h-[34px] pl-3 pr-7 rounded-lg text-[13px] outline-none appearance-none max-md:flex-1" style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23706c68' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}>
              <option value="all">Active & paused</option>
              <option value="1">Active</option>
              <option value="0">Paused</option>
            </select>
          </div>

          <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBorder }}>
            {/* List header (desktop) */}
            <div className="hidden md:grid grid-cols-[46px_minmax(0,1fr)_88px_104px_96px] items-center px-5 py-2.5" style={{ borderBottom: `1px solid ${t.cardBorder}`, background: 'rgba(255,255,255,.015)' }}>
              <span className="col-span-2 text-[9.5px] uppercase tracking-[1.1px] font-semibold" style={{ color: dark ? '#706c68' : '#8a8580' }}>Task</span>
              <span className="text-[9.5px] uppercase tracking-[1.1px] font-semibold text-right" style={{ color: dark ? '#706c68' : '#8a8580' }}>Done</span>
              <span className="text-[9.5px] uppercase tracking-[1.1px] font-semibold text-right" style={{ color: dark ? '#706c68' : '#8a8580' }}>Reward</span>
              <span className="text-[9.5px] uppercase tracking-[1.1px] font-semibold text-right" style={{ color: dark ? '#706c68' : '#8a8580' }}>Active</span>
            </div>

            {groupedTasks.length === 0 && (
              <div className="text-[10px] uppercase tracking-[1.2px] py-4 px-5 font-semibold" style={{ color: dark ? '#706c68' : '#8a8580' }}>No tasks match.</div>
            )}

            {groupedTasks.map(group => (
              <div key={group.id}>
                <div className="text-[10px] uppercase tracking-[1.2px] font-semibold pt-4 pb-2 px-5" style={{ color: dark ? '#706c68' : '#8a8580', borderBottom: `1px solid ${t.cardBorder}`, background: 'rgba(255,255,255,.008)' }}>
                  {group.label}<span className="opacity-60 ml-1.5 tracking-normal">· {group.tasks.length}</span>
                </div>
                {group.tasks.map(task => (
                  <div key={task.id} className={`grid grid-cols-[46px_minmax(0,1fr)_88px_104px_96px] max-md:grid-cols-[42px_minmax(0,1fr)_auto_auto] items-center px-5 max-md:px-3.5 py-3 group hover:bg-white/[.015] ${!task.active ? 'opacity-40' : ''}`} style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
                    <PlatformIcon platform={task.platform} size={30} />
                    <div className="min-w-0 pr-3.5 max-md:pr-2.5">
                      <div className="text-[13.5px] font-semibold truncate max-md:whitespace-normal" style={{ color: t.text }}>{task.title}</div>
                      <div className="text-[11.5px] mt-0.5 truncate max-md:whitespace-normal" style={{ color: dark ? '#706c68' : '#8a8580' }}>{taskMeta(task)}</div>
                    </div>
                    <div className="text-[12px] text-right font-mono max-md:hidden" style={{ color: dark ? '#a09b95' : '#706c68' }}>{task.doneCount || '—'}</div>
                    <div className="text-right">
                      <div className="text-[13.5px] font-semibold font-mono">₦{fmt(task.reward / 100)}</div>
                      {task.viralBonus && <div className="text-[10px] mt-0.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>+₦{fmt(task.viralAmount / 100)} at {fmt(task.viralThreshold)}</div>}
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(task)} className="w-7 h-7 rounded-lg inline-flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: dark ? '#706c68' : '#8a8580' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                      </button>
                      <button onClick={() => toggleTask(task.id, !task.active)} className="relative w-8 h-[18px] rounded-full shrink-0 ml-1.5 transition-colors" style={{ background: task.active ? '#a3586b' : 'rgba(255,255,255,.1)' }}>
                        <span className="absolute top-[2.5px] left-[2.5px] w-[13px] h-[13px] rounded-full bg-white shadow-sm transition-transform" style={{ transform: task.active ? 'translateX(14px)' : 'translateX(0)', background: task.active ? '#fff' : '#7a756f' }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ══ SUBMISSIONS TAB ══ */}
      {tab === 'subs' && (
        <>
          <div className="flex gap-2 flex-wrap items-center mb-3.5">
            {/* Status segment */}
            <div className="inline-flex gap-0.5 rounded-[9px] p-[3px] h-[34px] overflow-x-auto" style={{ background: cardBg, border: cardBorder, scrollbarWidth: 'none' }}>
              {['all', 'pending', 'approved', 'rejected'].map(s => (
                <button key={s} onClick={() => { setFSt(s); setSubPage(1); }} className="px-3 rounded-md text-[12px] font-semibold whitespace-nowrap" style={{ background: fSt === s ? 'rgba(255,255,255,.06)' : 'transparent', color: fSt === s ? t.text : (dark ? '#706c68' : '#8a8580') }}>
                  {s[0].toUpperCase() + s.slice(1)}<span className="text-[10.5px] opacity-70 ml-1">{subCounts[s] || 0}</span>
                </button>
              ))}
            </div>
            <select value={fPlat} onChange={e => { setFPlat(e.target.value); setSubPage(1); }} className="h-[34px] pl-3 pr-7 rounded-lg text-[13px] outline-none appearance-none" style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23706c68' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}>
              <option value="all">All platforms</option>
              {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex-1" />
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={dark ? '#706c68' : '#8a8580'} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input type="text" placeholder="Search user" value={fUser} onChange={e => { setFUser(e.target.value); setSubPage(1); }} className="h-[34px] pl-8 pr-3 rounded-lg text-[13px] outline-none" style={{ ...inputStyle, width: 210 }} />
            </div>
          </div>

          <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBorder }}>
            {/* Desktop table */}
            <div className="max-md:hidden overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3 text-[9.5px] uppercase tracking-[1.1px] font-semibold whitespace-nowrap" style={{ color: dark ? '#706c68' : '#8a8580', borderBottom: `1px solid ${t.cardBorder}`, background: 'rgba(255,255,255,.015)' }}>User</th>
                    <th className="text-left px-4 py-3 text-[9.5px] uppercase tracking-[1.1px] font-semibold whitespace-nowrap" style={{ color: dark ? '#706c68' : '#8a8580', borderBottom: `1px solid ${t.cardBorder}`, background: 'rgba(255,255,255,.015)' }}>Task</th>
                    <th className="text-left px-4 py-3 text-[9.5px] uppercase tracking-[1.1px] font-semibold whitespace-nowrap" style={{ color: dark ? '#706c68' : '#8a8580', borderBottom: `1px solid ${t.cardBorder}`, background: 'rgba(255,255,255,.015)' }}>Proof</th>
                    <th onClick={() => sortSubs('views')} className="text-left px-4 py-3 text-[9.5px] uppercase tracking-[1.1px] font-semibold whitespace-nowrap cursor-pointer select-none" style={{ color: dark ? '#706c68' : '#8a8580', borderBottom: `1px solid ${t.cardBorder}`, background: 'rgba(255,255,255,.015)' }}>Views {subSort === 'views' ? (subDir === 'desc' ? '↓' : '↑') : ''}</th>
                    <th onClick={() => sortSubs('reward')} className="text-left px-4 py-3 text-[9.5px] uppercase tracking-[1.1px] font-semibold whitespace-nowrap cursor-pointer select-none" style={{ color: dark ? '#706c68' : '#8a8580', borderBottom: `1px solid ${t.cardBorder}`, background: 'rgba(255,255,255,.015)' }}>Reward {subSort === 'reward' ? (subDir === 'desc' ? '↓' : '↑') : ''}</th>
                    <th onClick={() => sortSubs('date')} className="text-left px-4 py-3 text-[9.5px] uppercase tracking-[1.1px] font-semibold whitespace-nowrap cursor-pointer select-none" style={{ color: dark ? '#706c68' : '#8a8580', borderBottom: `1px solid ${t.cardBorder}`, background: 'rgba(255,255,255,.015)' }}>Submitted {subSort === 'date' ? (subDir === 'desc' ? '↓' : '↑') : ''}</th>
                    <th className="text-left px-4 py-3 text-[9.5px] uppercase tracking-[1.1px] font-semibold whitespace-nowrap" style={{ color: dark ? '#706c68' : '#8a8580', borderBottom: `1px solid ${t.cardBorder}`, background: 'rgba(255,255,255,.015)' }}>Status</th>
                    <th className="px-4 py-3" style={{ borderBottom: `1px solid ${t.cardBorder}`, background: 'rgba(255,255,255,.015)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {subs.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-[13px]" style={{ color: dark ? '#706c68' : '#8a8580' }}>{subLoading ? 'Loading...' : 'No submissions'}</td></tr>
                  )}
                  {subs.map(s => (
                    <tr key={s.id} className="hover:bg-white/[.015]">
                      <td className="px-4 py-3 whitespace-nowrap" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
                        <div className="flex items-center gap-2 font-semibold">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10.5px] font-semibold" style={{ background: 'rgba(255,255,255,.06)', color: dark ? '#a09b95' : '#706c68' }}>{(s.user?.name || '?')[0].toUpperCase()}</span>
                          {s.user?.name || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
                        <div className="flex items-center gap-2" style={{ color: dark ? '#a09b95' : '#706c68' }}>
                          <PlatformIcon platform={s.task?.platform} size={20} />
                          <span className="truncate max-w-[160px]">{s.task?.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] max-w-[190px] truncate" style={{ color: dark ? '#a09b95' : '#706c68' }}>
                          {s.proof?.startsWith('http') && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 14L21 3M15 3h6v6M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /></svg>}
                          {s.proof}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap" style={{ borderBottom: `1px solid ${t.cardBorder}`, color: dark ? '#a09b95' : '#706c68' }}>{s.views != null ? fmt(s.views) : '—'}</td>
                      <td className="px-4 py-3 font-mono whitespace-nowrap" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>₦{fmt((s.task?.reward || 0) / 100)}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ borderBottom: `1px solid ${t.cardBorder}`, color: dark ? '#a09b95' : '#706c68' }}>{fAgo(s.createdAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: dark ? '#a09b95' : '#706c68' }}>
                          <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: s.status === 'pending' ? '#fbbf24' : s.status === 'approved' ? '#6ee7b7' : '#fca5a5' }} />
                          {s.status[0].toUpperCase() + s.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
                        {s.status === 'pending' && (
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => reviewSub(s.id, 'approve')} className="h-[26px] px-2.5 rounded-[7px] text-[11px] font-semibold" style={{ border: `1px solid ${t.cardBorder}`, color: '#6ee7b7' }}>Approve</button>
                            <button onClick={() => reviewSub(s.id, 'reject')} className="h-[26px] px-2.5 rounded-[7px] text-[11px] font-semibold" style={{ border: `1px solid ${t.cardBorder}`, color: dark ? '#706c68' : '#8a8580' }}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden">
              {subs.length === 0 && <div className="px-4 py-8 text-center text-[13px]" style={{ color: dark ? '#706c68' : '#8a8580' }}>{subLoading ? 'Loading...' : 'No submissions'}</div>}
              {subs.map(s => (
                <div key={s.id} className="px-4 py-3.5" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 font-semibold text-[13px]">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10.5px] font-semibold" style={{ background: 'rgba(255,255,255,.06)', color: dark ? '#a09b95' : '#706c68' }}>{(s.user?.name || '?')[0].toUpperCase()}</span>
                      {s.user?.name}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: dark ? '#a09b95' : '#706c68' }}>
                      <span className="w-[5px] h-[5px] rounded-full" style={{ background: s.status === 'pending' ? '#fbbf24' : s.status === 'approved' ? '#6ee7b7' : '#fca5a5' }} />
                      {s.status[0].toUpperCase() + s.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2.5 mt-2">
                    <div className="flex items-center gap-2 text-[12.5px]" style={{ color: dark ? '#a09b95' : '#706c68' }}>
                      <PlatformIcon platform={s.task?.platform} size={20} />
                      {s.task?.title}
                    </div>
                    <span className="font-mono text-[13px] font-semibold shrink-0">₦{fmt((s.task?.reward || 0) / 100)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-[11px]" style={{ color: dark ? '#706c68' : '#8a8580' }}>
                    <span className="inline-flex items-center gap-1.5 truncate max-w-[60%]">
                      {s.proof?.startsWith('http') && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 14L21 3M15 3h6v6M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /></svg>}
                      {s.proof}
                    </span>
                    <span>{s.views != null ? `${fmt(s.views)} views · ` : ''}{fAgo(s.createdAt)}</span>
                  </div>
                  {s.status === 'pending' && (
                    <div className="flex gap-1.5 mt-3">
                      <button onClick={() => reviewSub(s.id, 'reject')} className="flex-1 h-[30px] rounded-lg text-[12px] font-semibold" style={{ border: `1px solid ${t.cardBorder}`, color: dark ? '#a09b95' : '#706c68' }}>Reject</button>
                      <button onClick={() => reviewSub(s.id, 'approve')} className="flex-1 h-[30px] rounded-lg text-[12px] font-semibold" style={{ border: `1px solid ${t.cardBorder}`, color: '#6ee7b7' }}>Approve</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center gap-2.5 px-4 max-md:px-3 py-2.5 flex-wrap" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
              <span className="text-[11.5px] mr-auto max-md:flex-[1_1_100%] max-md:order-3 max-md:mt-0.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>{pageStart}–{pageEnd} of {subTotal}</span>
              <div className="flex gap-[3px] items-center max-md:mr-auto">
                <button disabled={subPage <= 1} onClick={() => setSubPage(p => p - 1)} className="min-w-[27px] h-[27px] px-1.5 rounded-[7px] text-[12px] font-semibold disabled:opacity-30" style={{ color: dark ? '#706c68' : '#8a8580' }}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => totalPages <= 7 || p <= 2 || p >= totalPages - 1 || Math.abs(p - subPage) <= 1).map((p, i, arr) => {
                  const prev = arr[i - 1];
                  const gap = prev && p - prev > 1;
                  return [
                    gap && <span key={`d${p}`} className="text-[11px] px-0.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>…</span>,
                    <button key={p} onClick={() => setSubPage(p)} className="min-w-[27px] h-[27px] px-1.5 rounded-[7px] text-[12px] font-semibold" style={{ background: p === subPage ? 'rgba(196,125,142,.14)' : 'transparent', color: p === subPage ? t.accent : (dark ? '#706c68' : '#8a8580') }}>{p}</button>,
                  ];
                })}
                <button disabled={subPage >= totalPages} onClick={() => setSubPage(p => p + 1)} className="min-w-[27px] h-[27px] px-1.5 rounded-[7px] text-[12px] font-semibold disabled:opacity-30" style={{ color: dark ? '#706c68' : '#8a8580' }}>›</button>
              </div>
              <select value={subPer} onChange={e => { setSubPer(+e.target.value); setSubPage(1); }} className="h-7 text-[11.5px] pl-2.5 pr-6 rounded-lg outline-none appearance-none" style={{ ...inputStyle, background: 'transparent', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23706c68' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
              </select>
            </div>
          </div>
        </>
      )}

      {/* ══ MODAL ══ */}
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto py-10 px-4 max-md:py-3.5 max-md:px-2.5" style={{ background: 'rgba(4,6,12,.78)', backdropFilter: 'blur(3px)' }} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="w-full max-w-[560px] rounded-2xl p-6 max-md:p-4 animate-[slideUp_.18s_ease]" style={{ background: dark ? '#0f1322' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,.13)' : 'rgba(0,0,0,.12)'}` }}>
            <h2 className="text-[15.5px] font-bold" style={{ color: t.text }}>{modal.mode === 'create' ? 'New Task' : 'Edit Task'}</h2>
            <p className="text-[12px] mt-0.5 mb-5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Platform, reward, proof, gates and limits — everything lives here.</p>

            {/* Platform grid */}
            <div className="mb-[18px]">
              <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Platform</label>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
                {PLATFORMS.map(p => (
                  <button key={p.id} onClick={() => setForm(f => ({ ...f, platform: p.id }))} className="flex flex-col items-center gap-1.5 py-2 px-1 rounded-[10px] text-[9.5px] font-semibold transition-all" style={{ border: `1px solid ${form.platform === p.id ? t.accent : 'transparent'}`, color: form.platform === p.id ? t.text : (dark ? '#706c68' : '#8a8580'), background: form.platform === p.id ? 'rgba(196,125,142,.07)' : 'transparent' }}>
                    <PlatformIcon platform={p.id} size={26} />
                    <span>{p.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
              {(form.platform === 'google' || form.platform === 'trustpilot') && (
                <div className="text-[11px] mt-2 leading-snug" style={{ color: '#fbbf24', opacity: .85 }}>⚠ Paid reviews breach Google / Trustpilot policy — see the proposal doc before enabling.</div>
              )}
            </div>

            {/* Title */}
            <div className="mb-[18px]">
              <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Task title</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none" style={inputStyle} />
            </div>

            {/* Instructions */}
            <div className="mb-[18px]">
              <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Instructions shown to the user</label>
              <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} rows={3} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none resize-y leading-relaxed" style={inputStyle} />
            </div>

            {/* Category + Proof */}
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3.5 mb-[18px]">
              <div>
                <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full h-9 pl-3 pr-7 rounded-lg text-[13px] outline-none appearance-none" style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23706c68' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Proof required</label>
                <select value={form.proofType} onChange={e => setForm(f => ({ ...f, proofType: e.target.value }))} className="w-full h-9 pl-3 pr-7 rounded-lg text-[13px] outline-none appearance-none" style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23706c68' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}>
                  {PROOF_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {/* Reward + Frequency */}
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3.5 mb-[18px]">
              <div>
                <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Reward (credit)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px]" style={{ color: dark ? '#706c68' : '#8a8580' }}>₦</span>
                  <input type="number" value={form.reward} onChange={e => setForm(f => ({ ...f, reward: e.target.value }))} className="w-full py-2 pl-6 pr-3 rounded-lg text-[13px] outline-none" style={inputStyle} />
                </div>
                <div className="text-[10.5px] mt-1 leading-snug" style={{ color: dark ? '#706c68' : '#8a8580' }}>Spend-only credit · real cost ≈ <span className="font-mono">₦{fmt(Math.round((parseFloat(form.reward) || 0) * 0.375))}</span></div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Frequency</label>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} className="w-full h-9 pl-3 pr-7 rounded-lg text-[13px] outline-none appearance-none" style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23706c68' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}>
                  {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <div className="text-[10.5px] mt-1 leading-snug" style={{ color: dark ? '#706c68' : '#8a8580' }}>Max per user / month: <input type="number" value={form.maxPerMonth} onChange={e => setForm(f => ({ ...f, maxPerMonth: e.target.value }))} className="w-[52px] py-0.5 px-1.5 rounded text-[11px] ml-1 outline-none" style={inputStyle} /></div>
              </div>
            </div>

            <div className="h-px mb-[18px]" style={{ background: t.cardBorder }} />

            {/* Requirements */}
            <div className="mb-[18px]">
              <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Requirements <span className="normal-case tracking-normal font-medium">— leave 0 for none</span></label>
              <div className="grid grid-cols-3 max-md:grid-cols-1 gap-3.5">
                <div><input type="number" value={form.minViews} onChange={e => setForm(f => ({ ...f, minViews: e.target.value }))} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none" style={inputStyle} /><div className="text-[10.5px] mt-1" style={{ color: dark ? '#706c68' : '#8a8580' }}>Min views</div></div>
                <div><input type="number" value={form.minFollowers} onChange={e => setForm(f => ({ ...f, minFollowers: e.target.value }))} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none" style={inputStyle} /><div className="text-[10.5px] mt-1" style={{ color: dark ? '#706c68' : '#8a8580' }}>Min followers</div></div>
                <div><input type="number" value={form.keepDays} onChange={e => setForm(f => ({ ...f, keepDays: e.target.value }))} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none" style={inputStyle} /><div className="text-[10.5px] mt-1" style={{ color: dark ? '#706c68' : '#8a8580' }}>Keep live (days)</div></div>
              </div>
            </div>

            {/* Monthly cap */}
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3.5 mb-[18px]">
              <div>
                <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Monthly approval cap</label>
                <input type="number" value={form.monthlyCap} onChange={e => setForm(f => ({ ...f, monthlyCap: e.target.value }))} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none" style={inputStyle} />
                <div className="text-[10.5px] mt-1" style={{ color: dark ? '#706c68' : '#8a8580' }}>0 = unlimited · global budget still applies</div>
              </div>
            </div>

            <div className="h-px mb-1" style={{ background: t.cardBorder }} />

            {/* Toggles */}
            <div className="flex items-center justify-between gap-2.5 py-2.5">
              <div><div className="text-[12.5px] font-semibold" style={{ color: t.text }}>Viral bonus</div><div className="text-[10.5px] mt-0.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Extra credit if the post crosses a bigger view mark</div></div>
              <button onClick={() => setForm(f => ({ ...f, viralBonus: !f.viralBonus }))} className="relative w-8 h-[18px] rounded-full shrink-0 ml-1.5 transition-colors" style={{ background: form.viralBonus ? '#a3586b' : 'rgba(255,255,255,.1)' }}>
                <span className="absolute top-[2.5px] left-[2.5px] w-[13px] h-[13px] rounded-full shadow-sm transition-transform" style={{ transform: form.viralBonus ? 'translateX(14px)' : 'translateX(0)', background: form.viralBonus ? '#fff' : '#7a756f' }} />
              </button>
            </div>
            {form.viralBonus && (
              <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3.5 mb-1.5">
                <div><label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Bonus threshold (views)</label><input type="number" value={form.viralThreshold} onChange={e => setForm(f => ({ ...f, viralThreshold: e.target.value }))} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Bonus amount</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px]" style={{ color: dark ? '#706c68' : '#8a8580' }}>₦</span><input type="number" value={form.viralAmount} onChange={e => setForm(f => ({ ...f, viralAmount: e.target.value }))} className="w-full py-2 pl-6 pr-3 rounded-lg text-[13px] outline-none" style={inputStyle} /></div></div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2.5 py-2.5">
              <div><div className="text-[12.5px] font-semibold" style={{ color: t.text }}>Allow non-depositors</div><div className="text-[10.5px] mt-0.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Users with no deposit yet can still earn (₦500 redeem cap)</div></div>
              <button onClick={() => setForm(f => ({ ...f, allowNonDepositors: !f.allowNonDepositors }))} className="relative w-8 h-[18px] rounded-full shrink-0 ml-1.5 transition-colors" style={{ background: form.allowNonDepositors ? '#a3586b' : 'rgba(255,255,255,.1)' }}>
                <span className="absolute top-[2.5px] left-[2.5px] w-[13px] h-[13px] rounded-full shadow-sm transition-transform" style={{ transform: form.allowNonDepositors ? 'translateX(14px)' : 'translateX(0)', background: form.allowNonDepositors ? '#fff' : '#7a756f' }} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2.5 py-2.5">
              <div><div className="text-[12.5px] font-semibold" style={{ color: t.text }}>Active</div><div className="text-[10.5px] mt-0.5" style={{ color: dark ? '#706c68' : '#8a8580' }}>Visible on the task page right away</div></div>
              <button onClick={() => setForm(f => ({ ...f, active: !f.active }))} className="relative w-8 h-[18px] rounded-full shrink-0 ml-1.5 transition-colors" style={{ background: form.active ? '#a3586b' : 'rgba(255,255,255,.1)' }}>
                <span className="absolute top-[2.5px] left-[2.5px] w-[13px] h-[13px] rounded-full shadow-sm transition-transform" style={{ transform: form.active ? 'translateX(14px)' : 'translateX(0)', background: form.active ? '#fff' : '#7a756f' }} />
              </button>
            </div>

            {/* Footer */}
            <div className="flex gap-1.5 items-center justify-end pt-4 mt-1" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
              {modal.mode === 'edit' && <button onClick={deleteTask} className="mr-auto text-[13px] font-semibold" style={{ color: '#fca5a5', opacity: .85 }}>Delete</button>}
              <button onClick={() => setModal(null)} className="h-[34px] px-4 rounded-[9px] text-[13px] font-semibold" style={{ color: dark ? '#a09b95' : '#706c68' }}>Cancel</button>
              <button onClick={saveTask} disabled={saving || !form.title.trim()} className="h-[34px] px-4 rounded-[9px] text-[13px] font-semibold" style={{ background: t.accent, color: '#14060a', opacity: saving || !form.title.trim() ? .5 : 1 }}>{saving ? 'Saving...' : 'Save task'}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </>
  );
}
