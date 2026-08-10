'use client';
import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from './confirm-dialog';
import { useToast } from './toast';
import InlineAlert from './inline-alert';
import { PlatformIcon } from './platform-icon';
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
  const [expanded, setExpanded] = useState({});
  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // Modal
  const [modal, setModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', task: {...} }
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const cardBg = dark ? 'rgba(255,255,255,.09)' : 'rgba(255,255,255,.85)';
  const cardBorder = `0.5px solid ${t.cardBorder}`;
  const inputStyle = { border: `1px solid ${t.cardBorder}`, background: dark ? 'rgba(255,255,255,.07)' : '#fff', color: t.text };

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
      if (d.ok) {
        toast?.success?.(action === 'approve' ? 'Approved & credited' : 'Rejected');
        setSubs(prev => prev.map(s => s.id === id ? { ...s, status: action === 'approve' ? 'approved' : 'rejected' } : s));
        setExpanded(prev => ({ ...prev, [id]: false }));
        loadSubs(); loadTasks();
      }
      else toast?.error?.(d.error || 'Failed');
    } catch { toast?.error?.('Failed'); }
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

  if (loading) {
    const sk = `skel-bone ${dark ? 'skel-dark' : 'skel-light'}`;
    return (
      <>
        <div className="adm-header">
          <div className="flex items-center justify-between gap-4 mb-1">
            <div className={`${sk} w-[80px] h-[22px]`} />
            <div className={`${sk} w-[100px] h-[34px] rounded-[9px]`} />
          </div>
          <div className={`${sk} w-[200px] h-[12px] mt-2`} />
          <div className="page-divider" style={{ background: t.cardBorder }} />
        </div>
        <div className="adm-stats mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="dash-stat-card" style={{ background: dark ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.85)', border: `0.5px solid ${dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.12)'}` }}>
              <div className={`${sk} w-[90px] h-[8px] mb-3`} />
              <div className={`${sk} w-[50px] h-[17px]`} />
            </div>
          ))}
        </div>
        <div className="flex gap-5 mb-[18px]" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
          <div className={`${sk} w-[60px] h-[14px] mb-2.5`} />
          <div className={`${sk} w-[90px] h-[14px] mb-2.5`} />
        </div>
        <div className="flex gap-2 mb-3.5">
          <div className={`${sk} w-[210px] h-[34px] rounded-lg`} />
          <div className={`${sk} w-[120px] h-[34px] rounded-lg`} />
          <div className={`${sk} w-[120px] h-[34px] rounded-lg`} />
        </div>
        <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBorder }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
              <div className={`${sk} w-[30px] h-[30px] rounded-[10px] shrink-0`} />
              <div className="flex-1">
                <div className={`${sk} h-[13px] mb-1.5`} style={{ width: `${40 + i * 10}%` }} />
                <div className={`${sk} w-[130px] h-[10px]`} />
              </div>
              <div className={`${sk} w-[70px] h-[14px] shrink-0`} />
              <div className={`${sk} w-[32px] h-[18px] rounded-full shrink-0`} />
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {/* ── Header ── */}
      <div className="adm-header">
        <div className="flex items-center justify-between gap-4 mb-1">
          <div className="adm-title" style={{ color: t.text }}>Tasks</div>
          <button onClick={openCreate} className="inline-flex items-center justify-center gap-1.5 h-[34px] px-4 rounded-[9px] text-[13px] font-semibold border-none cursor-pointer font-[inherit] transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{ background: 'linear-gradient(135deg,#c47d8e,#8b5e6b)', color: '#fff' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            New Task
          </button>
        </div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>Platform tasks and submission review</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ── Stats ── */}
      <div className="adm-stats mb-6">
        {[
          ['Pending review', stats.pending ?? '—', '#fbbf24'],
          [`Approved · ${new Date().toLocaleDateString('en-US', { month: 'long' })}`, stats.approvedMonth ?? '—', t.green],
          [`Credit issued · ${new Date().toLocaleDateString('en-US', { month: 'long' })}`, `₦${fmt(Math.round((stats.creditMonth || 0) / 100))}`, t.accent, `/ ₦${fmt(Math.round((stats.budget || 0) / 100))}`],
          ['Active tasks', stats.activeTasks ?? '—', t.blue],
        ].map(([label, val, color, sub]) => (
          <div key={label} className="dash-stat-card" style={{ background: dark ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.85)', border: `0.5px solid ${dark ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.12)'}` }}>
            <div className="dash-stat-dot" style={{ background: color }} />
            <div className="dash-stat-label" style={{ color: t.textMuted }}>{label}</div>
            <div className="m dash-stat-value" style={{ color }}>{val}</div>
            {sub && <div className="dash-stat-sub" style={{ color: t.textMuted }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-5 mb-[18px]" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
        {[
          { id: 'tasks', label: 'Tasks', count: tasks.length },
          { id: 'subs', label: 'Submissions', count: subCounts.all || stats.pending || 0 },
        ].map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)} className="pb-2.5 text-[13.5px] font-semibold -mb-px bg-transparent border-none border-b-2 cursor-pointer font-[inherit]" style={{ color: tab === tb.id ? t.text : t.textMuted, borderBottom: `2px solid ${tab === tb.id ? t.accent : 'transparent'}` }}>
            {tb.label} <span className="text-[11px] font-medium ml-1" style={{ color: t.textMuted }}>{tb.count}</span>
          </button>
        ))}
      </div>

      {/* ══ TASKS TAB ══ */}
      {tab === 'tasks' && (
        <>
          <div className="flex gap-2 flex-wrap items-center mb-3.5">
            <div className="relative max-md:flex-[1_1_100%] max-md:order-[-1]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input type="text" placeholder="Search tasks" value={tq} onChange={e => setTq(e.target.value)} className="h-[34px] pl-8 pr-3 rounded-lg text-[13px] outline-none max-md:w-full" style={{ ...inputStyle, width: 210 }} />
            </div>
            <select value={tPlat} onChange={e => setTPlat(e.target.value)} className="h-[34px] pl-3 pr-7 rounded-lg text-[13px] outline-none appearance-none max-md:flex-1" style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23757170' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}>
              <option value="all">All platforms</option>
              {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={tSt} onChange={e => setTSt(e.target.value)} className="h-[34px] pl-3 pr-7 rounded-lg text-[13px] outline-none appearance-none max-md:flex-1" style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23757170' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}>
              <option value="all">Active & paused</option>
              <option value="1">Active</option>
              <option value="0">Paused</option>
            </select>
          </div>

          <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBorder }}>
            {/* List header (desktop) */}
            <div className="hidden md:grid grid-cols-[46px_minmax(0,1fr)_88px_104px_96px] items-center px-5 py-2.5" style={{ borderBottom: `1px solid ${t.cardBorder}`, background: dark ? 'rgba(255,255,255,.015)' : 'rgba(0,0,0,.015)' }}>
              <span className="col-span-2 text-[9.5px] uppercase tracking-[1.1px] font-semibold" style={{ color: t.textMuted }}>Task</span>
              <span className="text-[9.5px] uppercase tracking-[1.1px] font-semibold text-right" style={{ color: t.textMuted }}>Done</span>
              <span className="text-[9.5px] uppercase tracking-[1.1px] font-semibold text-right" style={{ color: t.textMuted }}>Reward</span>
              <span className="text-[9.5px] uppercase tracking-[1.1px] font-semibold text-right" style={{ color: t.textMuted }}>Active</span>
            </div>

            {groupedTasks.length === 0 && (
              <div className="text-[10px] uppercase tracking-[1.2px] py-4 px-5 font-semibold" style={{ color: t.textMuted }}>No tasks match.</div>
            )}

            {groupedTasks.map(group => (
              <div key={group.id}>
                <div className="text-[10px] uppercase tracking-[1.2px] font-semibold pt-4 pb-2 px-5" style={{ color: t.textMuted, borderBottom: `1px solid ${t.cardBorder}`, background: dark ? 'rgba(255,255,255,.008)' : 'rgba(0,0,0,.02)' }}>
                  {group.label}<span className="opacity-60 ml-1.5 tracking-normal">· {group.tasks.length}</span>
                </div>
                {group.tasks.map(task => (
                  <div key={task.id} className={`grid grid-cols-[46px_minmax(0,1fr)_88px_104px_96px] max-md:grid-cols-[42px_minmax(0,1fr)_auto_auto] items-center px-5 max-md:px-3.5 py-3 group hover:bg-black/[.015] dark:hover:bg-white/[.015] ${!task.active ? 'opacity-40' : ''}`} style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
                    <PlatformIcon platform={task.platform} size={30} />
                    <div className="min-w-0 pr-3.5 max-md:pr-2.5">
                      <div className="text-[13.5px] font-semibold truncate max-md:whitespace-normal" style={{ color: t.text }}>{task.title}</div>
                      <div className="text-[11.5px] mt-0.5 truncate max-md:whitespace-normal" style={{ color: t.textMuted }}>{taskMeta(task)}</div>
                    </div>
                    <div className="text-[12px] text-right font-mono max-md:hidden" style={{ color: t.textSoft }}>{task.doneCount || '—'}</div>
                    <div className="text-right">
                      <div className="text-[13.5px] font-semibold font-mono">₦{fmt(task.reward / 100)}</div>
                      {task.viralBonus && <div className="text-[10px] mt-0.5" style={{ color: t.textMuted }}>+₦{fmt(task.viralAmount / 100)} at {fmt(task.viralThreshold)}</div>}
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(task)} className="w-7 h-7 rounded-lg inline-flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: t.textMuted }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                      </button>
                      <button onClick={() => toggleTask(task.id, !task.active)} className="relative w-8 h-[18px] rounded-full shrink-0 ml-1.5 transition-colors" style={{ background: task.active ? '#a3586b' : (dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)') }}>
                        <span className="absolute top-[2.5px] left-[2.5px] w-[13px] h-[13px] rounded-full bg-white shadow-sm transition-transform" style={{ transform: task.active ? 'translateX(14px)' : 'translateX(0)', background: task.active ? '#fff' : (dark ? '#7a756f' : '#999') }} />
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
            <div className="relative max-md:flex-[1_1_100%] max-md:order-[-1]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              <input type="text" placeholder="Search user" value={fUser} onChange={e => { setFUser(e.target.value); setSubPage(1); }} className="h-[34px] pl-8 pr-3 rounded-lg text-[13px] outline-none max-md:w-full" style={{ ...inputStyle, width: 210 }} />
            </div>
            {/* Status segment */}
            <div className="inline-flex gap-0.5 rounded-[9px] p-[3px] h-[34px] overflow-x-auto" style={{ background: cardBg, border: cardBorder, scrollbarWidth: 'none' }}>
              {['all', 'pending', 'approved', 'rejected'].map(s => (
                <button key={s} onClick={() => { setFSt(s); setSubPage(1); }} className="px-3 rounded-md text-[12px] font-semibold whitespace-nowrap" style={{ background: fSt === s ? (dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)') : 'transparent', color: fSt === s ? t.text : t.textMuted }}>
                  {s[0].toUpperCase() + s.slice(1)}<span className="text-[10.5px] opacity-70 ml-1">{subCounts[s] || 0}</span>
                </button>
              ))}
            </div>
            <select value={fPlat} onChange={e => { setFPlat(e.target.value); setSubPage(1); }} className="h-[34px] pl-3 pr-7 rounded-lg text-[13px] outline-none appearance-none" style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23757170' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}>
              <option value="all">All platforms</option>
              {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={`${subSort}_${subDir}`} onChange={e => { const [s, d] = e.target.value.split('_'); setSubSort(s); setSubDir(d); setSubPage(1); }} className="h-[34px] pl-3 pr-7 rounded-lg text-[13px] outline-none appearance-none max-md:flex-1" style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23757170' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}>
              <option value="date_desc">Newest</option>
              <option value="date_asc">Oldest</option>
              <option value="views_desc">Most views</option>
              <option value="reward_desc">Highest reward</option>
            </select>
          </div>

          <div className="rounded-[14px] overflow-hidden" style={{ background: cardBg, border: cardBorder }}>
            {subs.length === 0 && <div className="px-4 py-8 text-center text-[13px]" style={{ color: t.textMuted }}>{subLoading ? 'Loading...' : 'No submissions'}</div>}
            {subs.map(s => {
              const isOpen = expanded[s.id];
              const link = proofToLink(s.proof, s.task?.platform);
              return (
                <div key={s.id} style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
                  <div onClick={() => toggleExpand(s.id)} className="flex items-center gap-3 px-5 max-md:px-3.5 py-3 cursor-pointer select-none hover:bg-black/[.015] dark:hover:bg-white/[.015]">
                    <PlatformIcon platform={s.task?.platform} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold truncate" style={{ color: t.text }}>{s.task?.title}</div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11.5px] flex-wrap" style={{ color: t.textMuted }}>
                        <span>{s.user?.name || 'Unknown'}</span>
                        <span>·</span>
                        <span className="font-mono">₦{fmt((s.task?.reward || 0) / 100)}</span>
                        <span>·</span>
                        <span>{fAgo(s.createdAt)}</span>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium shrink-0" style={{ color: t.textSoft }}>
                      <span className="w-[5px] h-[5px] rounded-full" style={{ background: s.status === 'pending' ? '#fbbf24' : s.status === 'approved' ? '#6ee7b7' : '#fca5a5' }} />
                      <span className="max-md:hidden">{s.status[0].toUpperCase() + s.status.slice(1)}</span>
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" className="shrink-0 transition-transform" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                  {isOpen && (
                    <div className="pb-4 pt-2 pr-5 max-md:pr-3.5 pl-[60px] max-md:pl-3.5" style={{ borderTop: `1px solid ${t.cardBorder}`, background: dark ? 'rgba(255,255,255,.015)' : 'rgba(0,0,0,.015)' }}>
                      <div className="flex flex-wrap items-start gap-x-6 gap-y-2 text-[12.5px]">
                        <div>
                          <div className="text-[9.5px] uppercase tracking-[1.1px] font-semibold mb-1" style={{ color: t.textMuted }}>Proof</div>
                          {link ? (
                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5" style={{ color: t.accent, textDecoration: 'none' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 14L21 3M15 3h6v6M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /></svg>
                              {link.label}
                            </a>
                          ) : (
                            <span style={{ color: t.textSoft }}>{s.proof}</span>
                          )}
                        </div>
                        {s.views != null && (
                          <div>
                            <div className="text-[9.5px] uppercase tracking-[1.1px] font-semibold mb-1" style={{ color: t.textMuted }}>Views</div>
                            <span className="font-mono" style={{ color: t.textSoft }}>{fmt(s.views)}</span>
                          </div>
                        )}
                      </div>
                      {s.status === 'pending' && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={(e) => { e.stopPropagation(); reviewSub(s.id, 'reject'); }} className="h-[30px] px-3.5 rounded-lg text-[12px] font-semibold" style={{ border: `1px solid ${t.cardBorder}`, color: t.textSoft }}>Reject</button>
                          <button onClick={(e) => { e.stopPropagation(); reviewSub(s.id, 'approve'); }} className="h-[30px] px-3.5 rounded-lg text-[12px] font-semibold border-none cursor-pointer font-[inherit]" style={{ background: 'linear-gradient(135deg,#c47d8e,#8b5e6b)', color: '#fff' }}>Approve</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination */}
            <div className="flex items-center gap-2.5 px-4 max-md:px-3 py-2.5 flex-wrap" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
              <span className="text-[11.5px] mr-auto max-md:flex-[1_1_100%] max-md:order-3 max-md:mt-0.5" style={{ color: t.textMuted }}>{pageStart}–{pageEnd} of {subTotal}</span>
              <div className="flex gap-[3px] items-center max-md:mr-auto">
                <button disabled={subPage <= 1} onClick={() => setSubPage(p => p - 1)} className="min-w-[27px] h-[27px] px-1.5 rounded-[7px] text-[12px] font-semibold disabled:opacity-30" style={{ color: t.textMuted }}>‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => totalPages <= 7 || p <= 2 || p >= totalPages - 1 || Math.abs(p - subPage) <= 1).map((p, i, arr) => {
                  const prev = arr[i - 1];
                  const gap = prev && p - prev > 1;
                  return [
                    gap && <span key={`d${p}`} className="text-[11px] px-0.5" style={{ color: t.textMuted }}>…</span>,
                    <button key={p} onClick={() => setSubPage(p)} className="min-w-[27px] h-[27px] px-1.5 rounded-[7px] text-[12px] font-semibold" style={{ background: p === subPage ? 'rgba(196,125,142,.14)' : 'transparent', color: p === subPage ? t.accent : t.textMuted }}>{p}</button>,
                  ];
                })}
                <button disabled={subPage >= totalPages} onClick={() => setSubPage(p => p + 1)} className="min-w-[27px] h-[27px] px-1.5 rounded-[7px] text-[12px] font-semibold disabled:opacity-30" style={{ color: t.textMuted }}>›</button>
              </div>
              <select value={subPer} onChange={e => { setSubPer(+e.target.value); setSubPage(1); }} className="h-7 text-[11.5px] pl-2.5 pr-6 rounded-lg outline-none appearance-none" style={{ ...inputStyle, background: 'transparent', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23757170' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
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
        <div className="fixed inset-0 z-[1100] backdrop-blur-[4px] flex items-start justify-center overflow-y-auto py-10 px-4 max-md:py-3.5 max-md:px-2.5 animate-[modalFadeIn_.2s_ease]" style={{ background: 'rgba(0,0,0,.45)' }} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="w-full max-w-[560px] rounded-2xl p-6 max-md:p-4 animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]" style={{ background: dark ? '#0e1120' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.14)'}`, boxShadow: dark ? '0 20px 60px rgba(0,0,0,.4)' : '0 20px 60px rgba(0,0,0,.1)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-[15.5px] font-bold" style={{ color: t.text }}>{modal.mode === 'create' ? 'New Task' : 'Edit Task'}</h2>
            <p className="text-[12px] mt-0.5 mb-5" style={{ color: t.textMuted }}>Platform, reward, proof, gates and limits — everything lives here.</p>

            {/* Platform */}
            <div className="mb-[18px]">
              <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: t.textMuted }}>Platform</label>
              <div className="flex items-center gap-2.5">
                <PlatformIcon platform={form.platform} size={28} />
                <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="flex-1 h-9 pl-3 pr-7 rounded-lg text-[13px] outline-none appearance-none font-[inherit]" style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23757170' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}>
                  {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {(form.platform === 'google' || form.platform === 'trustpilot') && (
                <div className="text-[11px] mt-2 leading-snug" style={{ color: '#fbbf24', opacity: .85 }}>⚠ Paid reviews breach Google / Trustpilot policy — see the proposal doc before enabling.</div>
              )}
            </div>

            {/* Title */}
            <div className="mb-[18px]">
              <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: t.textMuted }}>Task title</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none" style={inputStyle} />
            </div>

            {/* Instructions */}
            <div className="mb-[18px]">
              <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: t.textMuted }}>Instructions shown to the user</label>
              <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} rows={3} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none resize-y leading-relaxed" style={inputStyle} />
            </div>

            {/* Category + Proof */}
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3.5 mb-[18px]">
              <div>
                <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: t.textMuted }}>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full h-9 pl-3 pr-7 rounded-lg text-[13px] outline-none appearance-none" style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23757170' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: t.textMuted }}>Proof required</label>
                <select value={form.proofType} onChange={e => setForm(f => ({ ...f, proofType: e.target.value }))} className="w-full h-9 pl-3 pr-7 rounded-lg text-[13px] outline-none appearance-none" style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23757170' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}>
                  {PROOF_TYPES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {/* Reward + Frequency */}
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3.5 mb-[18px]">
              <div>
                <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: t.textMuted }}>Reward (credit)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px]" style={{ color: t.textMuted }}>₦</span>
                  <input type="number" value={form.reward} onChange={e => setForm(f => ({ ...f, reward: e.target.value }))} className="w-full py-2 pl-6 pr-3 rounded-lg text-[13px] outline-none" style={inputStyle} />
                </div>
                <div className="text-[10.5px] mt-1 leading-snug" style={{ color: t.textMuted }}>Spend-only credit · real cost ≈ <span className="font-mono">₦{fmt(Math.round((parseFloat(form.reward) || 0) * 0.375))}</span></div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: t.textMuted }}>Frequency</label>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} className="w-full h-9 pl-3 pr-7 rounded-lg text-[13px] outline-none appearance-none" style={{ ...inputStyle, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23757170' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 11px center' }}>
                  {FREQUENCIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <div className="text-[10.5px] mt-1 leading-snug" style={{ color: t.textMuted }}>Max per user / month: <input type="number" value={form.maxPerMonth} onChange={e => setForm(f => ({ ...f, maxPerMonth: e.target.value }))} className="w-[52px] py-0.5 px-1.5 rounded text-[11px] ml-1 outline-none" style={inputStyle} /></div>
              </div>
            </div>

            <div className="h-px mb-[18px]" style={{ background: t.cardBorder }} />

            {/* Requirements */}
            <div className="mb-[18px]">
              <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: t.textMuted }}>Requirements <span className="normal-case tracking-normal font-medium">— leave 0 for none</span></label>
              <div className="grid grid-cols-3 max-md:grid-cols-1 gap-3.5">
                <div><input type="number" value={form.minViews} onChange={e => setForm(f => ({ ...f, minViews: e.target.value }))} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none" style={inputStyle} /><div className="text-[10.5px] mt-1" style={{ color: t.textMuted }}>Min views</div></div>
                <div><input type="number" value={form.minFollowers} onChange={e => setForm(f => ({ ...f, minFollowers: e.target.value }))} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none" style={inputStyle} /><div className="text-[10.5px] mt-1" style={{ color: t.textMuted }}>Min followers</div></div>
                <div><input type="number" value={form.keepDays} onChange={e => setForm(f => ({ ...f, keepDays: e.target.value }))} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none" style={inputStyle} /><div className="text-[10.5px] mt-1" style={{ color: t.textMuted }}>Keep live (days)</div></div>
              </div>
            </div>

            {/* Monthly cap */}
            <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3.5 mb-[18px]">
              <div>
                <label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: t.textMuted }}>Monthly approval cap</label>
                <input type="number" value={form.monthlyCap} onChange={e => setForm(f => ({ ...f, monthlyCap: e.target.value }))} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none" style={inputStyle} />
                <div className="text-[10.5px] mt-1" style={{ color: t.textMuted }}>0 = unlimited · global budget still applies</div>
              </div>
            </div>

            <div className="h-px mb-1" style={{ background: t.cardBorder }} />

            {/* Toggles */}
            <div className="flex items-center justify-between gap-2.5 py-2.5">
              <div><div className="text-[12.5px] font-semibold" style={{ color: t.text }}>Viral bonus</div><div className="text-[10.5px] mt-0.5" style={{ color: t.textMuted }}>Extra credit if the post crosses a bigger view mark</div></div>
              <button onClick={() => setForm(f => ({ ...f, viralBonus: !f.viralBonus }))} className="relative w-8 h-[18px] rounded-full shrink-0 ml-1.5 transition-colors" style={{ background: form.viralBonus ? '#a3586b' : (dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)') }}>
                <span className="absolute top-[2.5px] left-[2.5px] w-[13px] h-[13px] rounded-full shadow-sm transition-transform" style={{ transform: form.viralBonus ? 'translateX(14px)' : 'translateX(0)', background: form.viralBonus ? '#fff' : (dark ? '#7a756f' : '#999') }} />
              </button>
            </div>
            {form.viralBonus && (
              <div className="grid grid-cols-2 max-md:grid-cols-1 gap-3.5 mb-1.5">
                <div><label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: t.textMuted }}>Bonus threshold (views)</label><input type="number" value={form.viralThreshold} onChange={e => setForm(f => ({ ...f, viralThreshold: e.target.value }))} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none" style={inputStyle} /></div>
                <div><label className="block text-[10px] uppercase tracking-[1.1px] font-semibold mb-1.5" style={{ color: t.textMuted }}>Bonus amount</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12.5px]" style={{ color: t.textMuted }}>₦</span><input type="number" value={form.viralAmount} onChange={e => setForm(f => ({ ...f, viralAmount: e.target.value }))} className="w-full py-2 pl-6 pr-3 rounded-lg text-[13px] outline-none" style={inputStyle} /></div></div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2.5 py-2.5">
              <div><div className="text-[12.5px] font-semibold" style={{ color: t.text }}>Allow non-depositors</div><div className="text-[10.5px] mt-0.5" style={{ color: t.textMuted }}>Users with no deposit yet can still earn (₦500 redeem cap)</div></div>
              <button onClick={() => setForm(f => ({ ...f, allowNonDepositors: !f.allowNonDepositors }))} className="relative w-8 h-[18px] rounded-full shrink-0 ml-1.5 transition-colors" style={{ background: form.allowNonDepositors ? '#a3586b' : (dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)') }}>
                <span className="absolute top-[2.5px] left-[2.5px] w-[13px] h-[13px] rounded-full shadow-sm transition-transform" style={{ transform: form.allowNonDepositors ? 'translateX(14px)' : 'translateX(0)', background: form.allowNonDepositors ? '#fff' : (dark ? '#7a756f' : '#999') }} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2.5 py-2.5">
              <div><div className="text-[12.5px] font-semibold" style={{ color: t.text }}>Active</div><div className="text-[10.5px] mt-0.5" style={{ color: t.textMuted }}>Visible on the task page right away</div></div>
              <button onClick={() => setForm(f => ({ ...f, active: !f.active }))} className="relative w-8 h-[18px] rounded-full shrink-0 ml-1.5 transition-colors" style={{ background: form.active ? '#a3586b' : (dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.12)') }}>
                <span className="absolute top-[2.5px] left-[2.5px] w-[13px] h-[13px] rounded-full shadow-sm transition-transform" style={{ transform: form.active ? 'translateX(14px)' : 'translateX(0)', background: form.active ? '#fff' : (dark ? '#7a756f' : '#999') }} />
              </button>
            </div>

            {/* Footer */}
            <div className="flex gap-1.5 items-center justify-end pt-4 mt-1" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
              {modal.mode === 'edit' && <button onClick={deleteTask} className="mr-auto text-[13px] font-semibold" style={{ color: '#fca5a5', opacity: .85 }}>Delete</button>}
              <button onClick={() => setModal(null)} className="h-[34px] px-4 rounded-[9px] text-[13px] font-semibold" style={{ color: t.textSoft }}>Cancel</button>
              <button onClick={saveTask} disabled={saving || !form.title.trim()} className="h-[34px] px-4 rounded-[9px] text-[13px] font-semibold border-none cursor-pointer font-[inherit]" style={{ background: 'linear-gradient(135deg,#c47d8e,#8b5e6b)', color: '#fff', opacity: saving || !form.title.trim() ? .5 : 1 }}>{saving ? 'Saving...' : 'Save task'}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalBounceIn { from { transform: translateY(12px) scale(.97); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
      `}</style>
    </>
  );
}
