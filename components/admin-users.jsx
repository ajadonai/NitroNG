'use client';
import { useState, useEffect, useCallback, useRef } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN, fD } from "../lib/format";
import { FilterDropdown } from "./date-range-picker";

const PER_PAGE = 15;
const TX_PER_PAGE = 15;
const initials = (name) => (name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

const STATUS_MAP = {
  Active: { key: 'active', label: 'Active' },
  Suspended: { key: 'suspended', label: 'Banned' },
  PendingDeletion: { key: 'pending', label: 'Pending' },
  Deleted: { key: 'deleted', label: 'Deleted' },
};

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'suspended', label: 'Banned' },
  { id: 'pending', label: 'Pending' },
  { id: 'deleted', label: 'Deleted' },
];

const statusDot = (status, t) => {
  const m = STATUS_MAP[status];
  if (!m) return { color: t.textMuted, label: status || 'Unknown' };
  const c = m.key === 'active' ? t.green : m.key === 'suspended' ? t.red : m.key === 'pending' ? t.amber : t.textMuted;
  return { color: c, label: m.label };
};

function waLink(user) {
  if (!user.phone) return null;
  return `https://wa.me/${user.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${(user.name || '').split(' ')[0] || 'there'}, this is Nitro Support.\n\n`)}`;
}

function cleanNote(note) {
  return (note || '')
    .replace(/\[rejected_by:([^\]]+)\]/g, 'Rejected by $1')
    .replace(/\[approved_by:([^\]]+)\]/g, 'Approved by $1')
    .replace(/\[user_confirmed[^\]]*\]/g, '')
    .replace(/\[awaiting_confirmation\]/g, '')
    .trim();
}

function downloadBlob(content, filename, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildUserCSV(users) {
  const header = 'Name,Email,Phone,Status,Balance,Orders,Referral Code,Joined';
  const rows = users.map(u => [
    `"${((u.deletedName || u.name || '')).replace(/"/g, '""')}"`,
    u.deletedEmail || u.email,
    u.phone || '',
    u.status,
    u.balance || 0,
    u.orders || 0,
    u.refCode || '',
    u.joined ? new Date(u.joined).toISOString().split('T')[0] : '',
  ].join(','));
  return [header, ...rows].join('\n');
}

function buildTxCSV(txList) {
  const header = 'Date,Type,Amount,Status,Method,Reference,Note';
  const rows = txList.map(tx => [
    new Date(tx.createdAt).toISOString().split('T')[0],
    tx.type,
    (tx.amount / 100).toFixed(2),
    tx.status,
    tx.method || '',
    tx.reference || '',
    `"${cleanNote(tx.note).replace(/"/g, '""')}"`,
  ].join(','));
  return [header, ...rows].join('\n');
}

/* ── Icons ────────────────────────────────────────── */

const SearchIcon = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);
const XIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const ChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
);
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
);
const WAIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
);
const MoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
);
const CreditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
);
const ExportIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);

/* ── Main component ───────────────────────────────── */

export default function AdminUsersPage({ dark, t, admin: currentAdmin }) {
  const confirm = useConfirm();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [tabCounts, setTabCounts] = useState({});

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filteredCount, setFilteredCount] = useState(0);

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [quick, setQuick] = useState(null);
  const [sort, setSort] = useState({ key: 'joined', dir: 'desc' });

  const [selected, setSelected] = useState(new Set());
  const [menuUser, setMenuUser] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const [drawerUser, setDrawerUser] = useState(null);
  const [drawerCreditOpen, setDrawerCreditOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });
  const canEdit = (() => {
    const role = currentAdmin?.role;
    if (['owner', 'superadmin'].includes(role)) return true;
    try { const ca = JSON.parse(currentAdmin?.customActions || '[]'); return ca.includes('users.edit'); } catch { return false; }
  })();

  const [creditAmt, setCreditAmt] = useState('');
  const [creditType, setCreditType] = useState('credit');
  const [actionLoading, setActionLoading] = useState(false);

  const [txList, setTxList] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);

  const menuRef = useRef(null);
  const searchTimer = useRef(null);

  /* ── Debounced search ─────────────────────────── */

  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), search ? 350 : 0);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  /* ── Reset page on filter change ──────────────── */

  useEffect(() => { setPage(1); }, [tab, debouncedSearch, quick]);
  useEffect(() => { setSelected(new Set()); }, [users]);

  /* ── Fetch users ──────────────────────────────── */

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE), sort: sort.key, sortDir: sort.dir });
    if (tab !== 'all') params.set('status', tab);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (quick) params.set('quick', quick);
    try {
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users || []);
      setFilteredCount(data.filteredCount || 0);
      setTotalPages(data.totalPages || 1);
      setTabCounts(data.tabCounts || {});
      if (data.stats) setStats(data.stats);
    } catch { /* network error — keep stale data */ }
    setLoading(false);
  }, [page, tab, debouncedSearch, quick, sort]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  /* ── Close menu on outside click / escape ─────── */

  useEffect(() => {
    if (!menuUser) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuUser(null); };
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuUser(null); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [menuUser]);

  /* ── Close drawer on escape ───────────────────── */

  useEffect(() => {
    if (!drawerUser) return;
    const onKey = (e) => { if (e.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerUser]);

  /* ── Actions ──────────────────────────────────── */

  const doAction = async (userId, action, amount, subtype) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId, amount: Number(amount) || 0, subtype }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Request failed'); }
      if (action === 'credit') {
        const amt = Number(amount) || 0;
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: (u.balance || 0) + amt } : u));
        if (drawerUser?.id === userId) setDrawerUser(prev => ({ ...prev, balance: (prev.balance || 0) + amt }));
        setCreditAmt(''); setCreditType('credit');
        toast.success(`Credited ${fN(amt)} to wallet`);
      }
      if (action === 'suspend') {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'Suspended' } : u));
        if (drawerUser?.id === userId) setDrawerUser(prev => ({ ...prev, status: 'Suspended' }));
        toast.success('User banned');
      }
      if (action === 'activate') {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'Active' } : u));
        if (drawerUser?.id === userId) setDrawerUser(prev => ({ ...prev, status: 'Active' }));
        toast.success('User activated');
      }
      if (action === 'reinstate') {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'Active', name: u.deletedName || u.name, email: u.deletedEmail || u.email } : u));
        if (drawerUser?.id === userId) setDrawerUser(prev => ({ ...prev, status: 'Active', name: prev.deletedName || prev.name, email: prev.deletedEmail || prev.email }));
        toast.success('Account restored');
      }
    } catch (err) {
      toast.error(err.message || 'Action failed');
    }
    setActionLoading(false);
  };

  const handleCredit = async (user) => {
    const amt = Number(creditAmt);
    if (amt <= 0) return;
    const label = creditType === 'gift' ? 'Gift' : 'Credit';
    const ok = await confirm({
      title: `${label} Wallet`,
      message: `${label} ${fN(amt)} to ${user.name}'s wallet?${creditType === 'gift' ? '\n\nThis will be recorded as a gift.' : ''}`,
      confirmLabel: `${label} ${fN(amt)}`,
    });
    if (ok) doAction(user.id, 'credit', creditAmt, creditType);
  };

  const handleStatusAction = async (user) => {
    const isDeleted = user.status === 'Deleted' || user.status === 'PendingDeletion';
    if (isDeleted) {
      const ok = await confirm({ title: 'Restore Account', message: `Restore ${user.deletedName || user.name}'s account? They will be able to log in again.`, confirmLabel: 'Restore' });
      if (ok) doAction(user.id, 'reinstate');
    } else if (user.status === 'Active') {
      const ok = await confirm({ title: 'Ban User', message: `Ban ${user.name} (${user.email})? They will lose access.`, confirmLabel: 'Ban User', danger: true });
      if (ok) doAction(user.id, 'suspend');
    } else {
      const ok = await confirm({ title: 'Activate User', message: `Reactivate ${user.name}'s account?`, confirmLabel: 'Activate' });
      if (ok) doAction(user.id, 'activate');
    }
  };

  /* ── Transactions ─────────────────────────────── */

  const loadTransactions = async (user) => {
    setTxLoading(true); setTxList([]); setTxPage(1);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transactions', userId: user.id }),
      });
      const data = await res.json();
      setTxList(data.transactions || []);
    } catch { /* keep empty */ }
    setTxLoading(false);
  };

  /* ── Drawer ───────────────────────────────────── */

  const openDrawer = (user, creditOpen = false) => {
    setDrawerUser(user);
    setDrawerCreditOpen(creditOpen);
    setCreditAmt(''); setCreditType('credit');
    setMenuUser(null);
    loadTransactions(user);
  };

  const closeDrawer = () => {
    setDrawerUser(null);
    setDrawerCreditOpen(false);
    setEditing(false);
    setTxList([]);
  };

  const startEditing = () => {
    setEditForm({ name: displayName(drawerUser) || '', email: displayEmail(drawerUser) || '', phone: drawerUser.phone || '' });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!drawerUser) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'edit', userId: drawerUser.internalId || drawerUser.id, name: editForm.name, email: editForm.email, phone: editForm.phone }) });
      const data = await res.json();
      if (data.error) { toast.error('Error', data.error); return; }
      toast.success('Updated', data.message);
      setEditing(false);
      if (data.updates) setDrawerUser(prev => ({ ...prev, ...data.updates }));
      fetchUsers();
    } catch { toast.error('Error', 'Failed to save'); }
    finally { setActionLoading(false); }
  };

  /* ── Export ────────────────────────────────────── */

  const exportAll = async () => {
    toast.info('Exporting', 'Preparing CSV...');
    const params = new URLSearchParams({ page: '1', perPage: '99999', sort: sort.key, sortDir: sort.dir, export: 'true' });
    if (tab !== 'all') params.set('status', tab);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (quick) params.set('quick', quick);
    try {
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      downloadBlob(buildUserCSV(data.users || []), 'nitro-users.csv');
      toast.success('CSV downloaded');
    } catch { toast.error('Export failed'); }
  };

  const exportSelected = () => {
    const sel = users.filter(u => selected.has(u.id));
    if (!sel.length) return;
    downloadBlob(buildUserCSV(sel), 'nitro-users-selected.csv');
    toast.success(`Exported ${sel.length} users`);
  };

  /* ── Bulk actions ─────────────────────────────── */

  const bulkBan = async () => {
    const ids = [...selected];
    const ok = await confirm({ title: 'Bulk Ban', message: `Ban ${ids.length} users? They will all lose access.`, confirmLabel: `Ban ${ids.length} users`, danger: true });
    if (!ok) return;
    for (const id of ids) {
      await doAction(id, 'suspend');
    }
    toast.success(`Banned ${ids.length} users`);
  };

  /* ── Selection helpers ────────────────────────── */

  const allSelected = users.length > 0 && users.every(u => selected.has(u.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(users.map(u => u.id)));
  };
  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  /* ── Menu open helper ─────────────────────────── */

  const openMenu = (e, user) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const menuH = 200;
    const flipped = rect.bottom + menuH > window.innerHeight;
    setMenuPos({ ...(flipped ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }), right: window.innerWidth - rect.right });
    setMenuUser(user);
  };

  /* ── Sort toggle ──────────────────────────────── */

  const toggleSort = (key) => {
    setSort(prev => prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  };

  /* ── Derived ──────────────────────────────────── */

  const displayName = (u) => (u.status === 'Deleted' || u.status === 'PendingDeletion') ? (u.deletedName || u.name) : u.name;
  const displayEmail = (u) => (u.status === 'Deleted' || u.status === 'PendingDeletion') ? (u.deletedEmail || u.email) : u.email;
  const isDeleted = (u) => u.status === 'Deleted' || u.status === 'PendingDeletion';

  const rangeStart = (page - 1) * PER_PAGE + 1;
  const rangeEnd = Math.min(page * PER_PAGE, filteredCount);

  /* ── Styles ───────────────────────────────────── */

  const cardStyle = { background: dark ? 'rgba(255,255,255,.06)' : '#fff', border: `1px solid ${t.cardBorder}` };
  const inputBg = dark ? '#131728' : '#fff';
  const hoverBg = dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)';
  const selectedBg = dark ? 'rgba(196,125,142,.08)' : 'rgba(196,125,142,.04)';
  const accentGrad = 'linear-gradient(135deg,#c47d8e,#8b5e6b)';

  const Checkbox = ({ checked, onChange, size = 17 }) => (
    <button onClick={onChange} className="shrink-0 rounded cursor-pointer border-none p-0 flex items-center justify-center" style={{ width: size, height: size, background: checked ? accentGrad : 'transparent', border: checked ? 'none' : `1.5px solid ${t.textMuted}`, borderRadius: 5 }}>
      {checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
    </button>
  );

  /* ── Skeleton row ─────────────────────────────── */

  const Skeleton = () => (
    <div className="p-4 space-y-1.5">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className={`skel-bone ${dark ? 'skel-dark' : 'skel-light'}`} style={{ height: 48, borderRadius: 8 }} />
      ))}
    </div>
  );

  /* ── Transaction row helpers ──────────────────── */

  const txColor = (tx) => {
    const inbound = ['deposit', 'refund', 'admin_credit', 'admin_gift', 'referral', 'bonus'].includes(tx.type);
    const failed = tx.status !== 'Completed';
    if (failed) return t.textMuted;
    return inbound ? t.green : tx.type === 'order' ? t.red : t.textMuted;
  };

  const txBadgeBg = (tx) => {
    const inbound = ['deposit', 'refund', 'admin_credit', 'admin_gift', 'referral', 'bonus'].includes(tx.type);
    const failed = tx.status !== 'Completed';
    if (failed) return dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)';
    if (tx.type === 'order') return dark ? 'rgba(252,165,165,.08)' : 'rgba(220,38,38,.04)';
    if (inbound) return dark ? 'rgba(110,231,183,.08)' : 'rgba(5,150,105,.04)';
    return dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)';
  };

  const txSign = (tx) => {
    if (tx.status !== 'Completed') return '';
    return tx.type === 'order' ? '-' : '+';
  };

  const txLabel = (type) => {
    if (type === 'admin_credit') return 'credit';
    if (type === 'admin_gift') return 'gift';
    return type;
  };

  const txTotalPages = Math.ceil(txList.length / TX_PER_PAGE);
  const txPaged = txList.slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE);

  /* ── Render ───────────────────────────────────── */

  return (
    <>
      {/* ── Header ──────────────────────────────── */}
      <div className="adm-header">
        <div className="adm-title" style={{ color: t.text }}>Users</div>
        <div className="adm-subtitle" style={{ color: t.textMuted }}>
          {stats ? `${stats.totalUsers.toLocaleString()} registered · ${stats.activeUsers.toLocaleString()} active` : 'Loading...'}
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* ── Stat cards ──────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-4 max-md:grid-cols-2 gap-3 mb-5">
          {[
            { label: 'Total Users', value: stats.totalUsers.toLocaleString(), sub: `↑ ${stats.newThisWeek} new this week` },
            { label: 'Active', value: stats.activeUsers.toLocaleString(), sub: `${stats.totalUsers ? Math.round(stats.activeUsers / stats.totalUsers * 100) : 0}% of all users` },
            { label: 'Total Balance', value: fN(stats.totalBalance), sub: `${stats.fundedWallets} funded wallets` },
            { label: 'Total Orders', value: stats.totalOrders.toLocaleString(), sub: `↑ ${stats.ordersThisMonth} this month` },
          ].map((s, i) => (
            <div key={i} className="rounded-xl py-3 px-4" style={cardStyle}>
              <div className="text-[11px] font-semibold uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>{s.label}</div>
              <div className="text-[20px] font-bold" style={{ color: t.text }}>{s.value}</div>
              <div className="text-[11px] mt-0.5 font-medium" style={{ color: t.accent }}>{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-full desktop:min-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><SearchIcon color={t.textMuted} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…" className="w-full py-[9px] pl-9 pr-8 rounded-lg text-[13px] outline-none font-[inherit]" style={{ border: `1px solid ${t.cardBorder}`, background: inputBg, color: t.text }} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full cursor-pointer border-none p-0" style={{ background: dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.1)', color: t.textMuted }}>
              <XIcon size={10} />
            </button>
          )}
        </div>

        {/* Status filter */}
        <FilterDropdown dark={dark} t={t} value={tab} onChange={(v) => { setTab(v); setPage(1); }} options={
          TABS.map(tb => ({ value: tb.id, label: `${tb.label}${tabCounts[tb.id] != null ? ` (${tabCounts[tb.id]})` : ''}` }))
        } />

        {/* Quick filters */}
        <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border: `1px solid ${t.cardBorder}` }}>
          {[{ id: 'funded', label: 'Funded' }, { id: 'buyers', label: 'Buyers' }].map(q => (
            <button key={q.id} onClick={() => setQuick(quick === q.id ? null : q.id)} className="py-[7px] px-3 text-[12px] font-semibold cursor-pointer font-[inherit] border-none transition-colors duration-200" style={{ background: quick === q.id ? (dark ? 'rgba(196,125,142,.18)' : 'rgba(196,125,142,.1)') : 'transparent', color: quick === q.id ? t.accent : t.textMuted }}>
              {q.label}
            </button>
          ))}
        </div>

        {/* Export */}
        <button onClick={exportAll} className="py-[7px] px-3 rounded-lg text-[12px] font-semibold cursor-pointer font-[inherit] flex items-center gap-1.5" style={{ border: `1px solid ${t.cardBorder}`, background: 'transparent', color: t.textSoft }}>
          <ExportIcon /> Export
        </button>
      </div>

      {/* ── Table card ──────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={cardStyle}>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 py-2.5 px-4 text-[13px] font-semibold flex-wrap" style={{ background: accentGrad, color: '#fff' }}>
            <span>{selected.size} selected</span>
            <div className="flex gap-1.5 ml-auto">
              <button onClick={() => { if (selected.size === 1) { const u = users.find(u => u.id === [...selected][0]); if (u) openDrawer(u, true); } else toast.info('Coming soon', 'Bulk credit coming soon'); }} className="py-1 px-2.5 rounded text-[11px] font-semibold cursor-pointer font-[inherit] border-none" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>Credit</button>
              <button onClick={() => toast.info('Coming soon', 'Bulk message coming soon')} className="py-1 px-2.5 rounded text-[11px] font-semibold cursor-pointer font-[inherit] border-none" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>Message</button>
              <button onClick={exportSelected} className="py-1 px-2.5 rounded text-[11px] font-semibold cursor-pointer font-[inherit] border-none" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>Export</button>
              <button onClick={bulkBan} className="py-1 px-2.5 rounded text-[11px] font-semibold cursor-pointer font-[inherit] border-none" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>Ban</button>
              <button onClick={() => setSelected(new Set())} className="py-1 px-2 rounded text-[11px] font-semibold cursor-pointer font-[inherit] border-none" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}>Clear</button>
            </div>
          </div>
        )}

        {/* Table header */}
        <div className="flex items-center gap-3 py-2.5 px-4 text-[11px] font-semibold uppercase tracking-[1px] sticky top-0 z-[2] select-none" style={{ background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)', color: t.textMuted, borderBottom: `1px solid ${t.cardBorder}` }}>
          <span className="w-[17px] shrink-0"><Checkbox checked={allSelected} onChange={toggleAll} /></span>
          <span className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleSort('name')}>User {sort.key === 'name' ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
          <span className="w-[80px] text-center max-sm:hidden">Status</span>
          <span className="w-[100px] text-right max-sm:hidden cursor-pointer" onClick={() => toggleSort('balance')}>Balance {sort.key === 'balance' ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
          <span className="w-[60px] text-right max-md:hidden cursor-pointer" onClick={() => toggleSort('orders')}>Orders {sort.key === 'orders' ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
          <span className="w-[90px] text-right max-lg:hidden cursor-pointer" onClick={() => toggleSort('joined')}>Joined {sort.key === 'joined' ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
          <span className="w-[80px] max-sm:w-[28px]" />
        </div>

        {/* Rows */}
        {loading ? <Skeleton /> : users.length > 0 ? users.map((u) => {
          const name = displayName(u);
          const email = displayEmail(u);
          const sd = statusDot(u.status, t);
          const del = isDeleted(u);
          const sel = selected.has(u.id);
          const tag = u.status === 'Deleted' ? 'Deleted' : u.verified === false ? 'Unverified' : null;

          return (
            <div key={u.id} className="group flex items-center gap-3 py-2.5 px-4 transition-colors duration-150" style={{ background: sel ? selectedBg : 'transparent', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'}` }} onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = hoverBg; }} onMouseLeave={(e) => { e.currentTarget.style.background = sel ? selectedBg : 'transparent'; }}>
              <span className="w-[17px] shrink-0"><Checkbox checked={sel} onChange={() => toggleOne(u.id)} /></span>

              {/* Avatar + name */}
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0" style={{ background: '#c47d8e', color: '#fff' }}>
                  {initials(name)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold truncate" style={{ color: sd.color }}>{name}</span>
                    {tag && <span className="text-[10px] py-[1px] px-1.5 rounded font-semibold shrink-0" style={{ background: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)', color: t.textMuted }}>{tag}</span>}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: u.status === 'Suspended' ? t.red : u.status === 'PendingDeletion' ? t.amber : t.textMuted }}>{email}</div>
                </div>
              </div>

              {/* Status */}
              <div className="w-[80px] flex items-center justify-center gap-1.5 max-sm:hidden">
                <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: sd.color }} />
                <span className="text-[12px] font-medium" style={{ color: sd.color }}>{sd.label}</span>
              </div>

              {/* Balance */}
              <div className="w-[100px] text-right text-[13px] font-bold max-sm:hidden" style={{ color: (u.balance || 0) > 0 ? t.green : t.textMuted, fontFamily: 'JetBrains Mono, monospace' }}>
                {fN(u.balance || 0)}
              </div>

              {/* Orders */}
              <div className="w-[60px] text-right text-[13px] font-medium max-md:hidden" style={{ color: t.text, fontFamily: 'JetBrains Mono, monospace' }}>
                {u.orders || 0}
              </div>

              {/* Joined */}
              <div className="w-[90px] text-right text-[12px] max-lg:hidden" style={{ color: t.textMuted }}>
                {u.joined ? fD(u.joined, true) : '—'}
              </div>

              {/* Row actions — visible on hover */}
              <div className="w-[80px] max-sm:w-[28px] flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 max-sm:opacity-100 transition-opacity duration-150">
                <button onClick={() => openDrawer(u, true)} title="Credit" className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer border-none p-0 transition-colors duration-150 max-sm:hidden" style={{ background: 'transparent', color: t.accent }} onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <CreditIcon />
                </button>
                <button onClick={() => { const link = waLink(u); if (link) window.open(link, '_blank'); else toast.info('No WhatsApp', `${name} hasn't added a phone number`); }} title="WhatsApp" className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer border-none p-0 transition-colors duration-150 max-sm:hidden" style={{ background: 'transparent', color: '#25d366' }} onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <WAIcon />
                </button>
                <button onClick={(e) => openMenu(e, u)} title="More" className="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer border-none p-0 transition-colors duration-150" style={{ background: 'transparent', color: t.textMuted }} onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <MoreIcon />
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="py-16 text-center">
            <div className="text-[15px] font-semibold mb-1" style={{ color: t.textSoft }}>No users found</div>
            <div className="text-[13px]" style={{ color: t.textMuted }}>{search ? 'Try a different search term' : 'Users will appear here once they sign up'}</div>
          </div>
        )}

        {/* Pagination footer */}
        {!loading && filteredCount > 0 && (
          <div className="flex items-center justify-between py-3 px-4" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
            <span className="text-[12px]" style={{ color: t.textMuted }}>{rangeStart}–{rangeEnd} of {filteredCount.toLocaleString()} users</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer font-[inherit] border-none p-0 transition-colors duration-150" style={{ background: 'transparent', color: t.textSoft, opacity: page === 1 ? .35 : 1 }}><ChevronLeft /></button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let p;
                if (totalPages <= 5) p = i + 1;
                else if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
                return (
                  <button key={p} onClick={() => setPage(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-semibold cursor-pointer font-[inherit] border-none p-0 transition-colors duration-150" style={{ background: page === p ? (dark ? 'rgba(196,125,142,.2)' : 'rgba(196,125,142,.12)') : 'transparent', color: page === p ? t.accent : t.textMuted }}>{p}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer font-[inherit] border-none p-0 transition-colors duration-150" style={{ background: 'transparent', color: t.textSoft, opacity: page >= totalPages ? .35 : 1 }}><ChevronRight /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── Overflow menu ───────────────────────── */}
      {menuUser && menuPos && (
        <div ref={menuRef} className="fixed z-[1000] rounded-xl py-1.5 shadow-lg" style={{ ...(menuPos.top != null ? { top: menuPos.top } : { bottom: menuPos.bottom }), right: menuPos.right, width: 150, background: dark ? '#1a1e2e' : '#fff', border: `1px solid ${t.cardBorder}` }}>
          {[
            { label: 'View profile', action: () => openDrawer(menuUser) },
            { label: 'Credit wallet', action: () => openDrawer(menuUser, true) },
            { label: 'Transactions', action: () => openDrawer(menuUser) },
            { label: 'WhatsApp', action: () => { const link = waLink(menuUser); if (link) window.open(link, '_blank'); else toast.info('No WhatsApp', `${displayName(menuUser)} hasn't added a phone number`); setMenuUser(null); } },
            { sep: true },
            {
              label: isDeleted(menuUser) ? 'Restore account' : menuUser.status === 'Active' ? 'Ban user' : 'Activate user',
              danger: menuUser.status === 'Active' && !isDeleted(menuUser),
              action: () => { handleStatusAction(menuUser); setMenuUser(null); },
            },
          ].map((item, i) => item.sep ? (
            <div key={i} className="my-1.5 mx-3" style={{ height: 1, background: t.cardBorder }} />
          ) : (
            <button key={i} onClick={item.action} className="w-full text-left py-2 px-3 text-[13px] font-medium cursor-pointer font-[inherit] border-none transition-colors duration-150 whitespace-nowrap" style={{ background: 'transparent', color: item.danger ? t.red : t.text }} onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Drawer backdrop + panel ─────────────── */}
      {drawerUser && (
        <>
          <div className="fixed inset-0 z-[999] transition-opacity duration-300" style={{ background: 'rgba(0,0,0,.45)' }} onClick={closeDrawer} />
          <div className="fixed top-0 right-0 bottom-0 z-[1000] w-[440px] max-sm:w-full overflow-y-auto transition-transform duration-300" style={{ background: dark ? '#121520' : '#f9fafb', borderLeft: `1px solid ${t.cardBorder}` }}>

            {/* Close */}
            <button onClick={closeDrawer} className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border-none p-0 z-10" style={{ background: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)', color: t.textMuted }}>
              <XIcon size={14} />
            </button>

            {/* Header */}
            <div className="p-6 pb-4">
              {editing ? (
                <div className="mb-4 space-y-2.5">
                  <div className="mb-1">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.5px]" style={{ color: t.accent }}>Edit Profile</span>
                  </div>
                  {[['name', 'Name'], ['email', 'Email'], ['phone', 'Phone']].map(([key, label]) => (
                    <div key={key}>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.3px] mb-1 block" style={{ color: t.textMuted }}>{label}</label>
                      <input type={key === 'email' ? 'email' : 'text'} value={editForm[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} className="w-full py-2 px-3 rounded-lg text-[13px] outline-none font-[inherit]" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? 'rgba(255,255,255,.06)' : '#fff', color: t.text }} />
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={actionLoading} className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer font-[inherit] border-none" style={{ background: accentGrad, color: '#fff', opacity: actionLoading ? .5 : 1 }}>{actionLoading ? 'Saving...' : 'Save Changes'}</button>
                    <button onClick={() => setEditing(false)} className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer font-[inherit]" style={{ border: `1px solid ${t.cardBorder}`, background: 'transparent', color: t.textMuted }}>Cancel</button>
                  </div>
                </div>
              ) : (
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-[20px] font-bold shrink-0" style={{ background: '#c47d8e', color: '#fff' }}>
                  {initials(displayName(drawerUser))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-[17px] font-bold truncate" style={{ color: t.text }}>{displayName(drawerUser)}</div>
                    {canEdit && <button onClick={startEditing} className="shrink-0 w-6 h-6 rounded flex items-center justify-center cursor-pointer border-none p-0" style={{ background: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)', color: t.textMuted }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>}
                  </div>
                  <div className="text-[13px] truncate" style={{ color: t.textMuted }}>{displayEmail(drawerUser)}</div>
                  {drawerUser.phone && <div className="text-[12px] truncate" style={{ color: t.textMuted }}>{drawerUser.phone}</div>}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-[7px] h-[7px] rounded-full" style={{ background: statusDot(drawerUser.status, t).color }} />
                    <span className="text-[12px] font-medium" style={{ color: statusDot(drawerUser.status, t).color }}>{statusDot(drawerUser.status, t).label}</span>
                  </div>
                </div>
              </div>
              )}

              {/* Stat boxes */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { label: 'Balance', value: fN(drawerUser.balance || 0) },
                  { label: 'Orders', value: String(drawerUser.orders || 0) },
                  { label: 'Joined', value: drawerUser.joined ? fD(drawerUser.joined, true) : '—' },
                  { label: 'Ref code', value: drawerUser.refCode || '—' },
                ].map((s, i) => (
                  <div key={i} className="rounded-lg py-2.5 px-3" style={cardStyle}>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.5px]" style={{ color: t.textMuted }}>{s.label}</div>
                    <div className="text-[14px] font-bold mt-0.5" style={{ color: t.text }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button onClick={() => setDrawerCreditOpen(!drawerCreditOpen)} className="flex-1 py-2 rounded-lg text-[12px] font-semibold cursor-pointer font-[inherit] border-none flex items-center justify-center gap-1.5" style={{ background: accentGrad, color: '#fff' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>Credit</button>
                <button onClick={() => { const link = waLink(drawerUser); if (link) window.open(link, '_blank'); else toast.info('No WhatsApp', `${displayName(drawerUser)} hasn't added a phone number`); }} className="flex-1 py-2 rounded-lg text-[12px] font-semibold cursor-pointer font-[inherit] border-none flex items-center justify-center gap-1.5" style={{ background: dark ? 'rgba(37,211,102,.15)' : 'rgba(37,211,102,.1)', color: '#25d366' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>WhatsApp</button>
                <button onClick={() => handleStatusAction(drawerUser)} className="flex-1 py-2 rounded-lg text-[12px] font-semibold cursor-pointer font-[inherit] border-none flex items-center justify-center gap-1.5" style={{ background: dark ? 'rgba(252,165,165,.1)' : 'rgba(220,38,38,.06)', color: t.red }}>
                  {isDeleted(drawerUser) ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>Restore</> : drawerUser.status === 'Active' ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>Ban</> : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Activate</>}
                </button>
              </div>
            </div>

            {/* Credit form */}
            {drawerCreditOpen && (
              <div className="mx-6 mb-4 p-4 rounded-xl" style={cardStyle}>
                <div className="flex rounded-lg overflow-hidden mb-3" style={{ border: `1px solid ${t.cardBorder}` }}>
                  {[['credit', 'Payment'], ['gift', 'Gift']].map(([val, label]) => (
                    <button key={val} onClick={() => setCreditType(val)} className="flex-1 py-2 text-[12px] font-semibold border-none cursor-pointer font-[inherit] transition-colors duration-200" style={{ background: creditType === val ? (val === 'gift' ? (dark ? 'rgba(251,191,36,.15)' : 'rgba(217,119,6,.08)') : (dark ? 'rgba(110,231,183,.15)' : 'rgba(5,150,105,.08)')) : 'transparent', color: creditType === val ? (val === 'gift' ? t.amber : t.green) : t.textMuted }}>{label}</button>
                  ))}
                </div>
                <input type="number" placeholder="Amount (₦)" value={creditAmt} onChange={e => setCreditAmt(e.target.value)} className="w-full py-2.5 px-3 rounded-lg text-[13px] outline-none font-[inherit] mb-2" style={{ border: `1px solid ${t.cardBorder}`, background: inputBg, color: t.text }} />
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {[1000, 5000, 10000, 50000].map(p => (
                    <button key={p} onClick={() => setCreditAmt(String(p))} className="py-1.5 px-2.5 rounded-lg text-[11px] font-medium cursor-pointer font-[inherit]" style={{ border: `1px solid ${Number(creditAmt) === p ? t.accent : t.cardBorder}`, background: Number(creditAmt) === p ? (dark ? 'rgba(196,125,142,.14)' : 'rgba(196,125,142,.06)') : 'transparent', color: Number(creditAmt) === p ? t.accent : t.textMuted }}>{fN(p)}</button>
                  ))}
                </div>
                <button onClick={() => handleCredit(drawerUser)} disabled={actionLoading || Number(creditAmt) <= 0} className="w-full py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer font-[inherit] border-none transition-opacity duration-200" style={{ background: accentGrad, color: '#fff', opacity: Number(creditAmt) > 0 && !actionLoading ? 1 : .4 }}>
                  {creditType === 'gift' ? 'Gift' : 'Credit'} {creditAmt ? fN(Number(creditAmt)) : ''}
                </button>
              </div>
            )}

            {/* Transactions */}
            <div className="mx-6 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-semibold uppercase tracking-[0.5px]" style={{ color: t.accent }}>Transactions ({txList.length})</span>
                {txList.length > 0 && (
                  <button onClick={() => { const name = (displayName(drawerUser) || 'user').replace(/\s+/g, '-'); downloadBlob(buildTxCSV(txList), `${name}-transactions.csv`); }} className="text-[11px] font-semibold cursor-pointer font-[inherit] px-2 py-1 rounded-lg" style={{ border: `1px solid ${t.cardBorder}`, background: 'transparent', color: t.accent }}>
                    CSV
                  </button>
                )}
              </div>
              <div className="rounded-xl overflow-hidden" style={cardStyle}>
                {txLoading ? (
                  <div className="p-3 space-y-1.5">
                    {[1,2,3,4].map(i => <div key={i} className={`skel-bone ${dark ? 'skel-dark' : 'skel-light'}`} style={{ height: 36, borderRadius: 6 }} />)}
                  </div>
                ) : txPaged.length > 0 ? (
                  <>
                    {txPaged.map((tx, j) => (
                      <div key={tx.id} className="flex items-center gap-2 py-2.5 px-3 text-[12px]" style={{ borderBottom: j < txPaged.length - 1 ? `1px solid ${dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)'}` : 'none' }}>
                        <span className="w-[60px] shrink-0 text-[11px]" style={{ color: t.textSoft }}>{fD(tx.createdAt, true)}</span>
                        <span className="w-[52px] text-center text-[10px] py-[2px] px-1 rounded uppercase font-semibold tracking-[0.3px] shrink-0" style={{ background: txBadgeBg(tx), color: txColor(tx) }}>{txLabel(tx.type)}</span>
                        <span className="flex-1 min-w-0 text-[11px] truncate" style={{ color: t.textSoft }}>{cleanNote(tx.note) || tx.reference || ''}</span>
                        <span className="text-[12px] font-bold shrink-0 text-right" style={{ color: txColor(tx), fontFamily: 'JetBrains Mono, monospace' }}>{txSign(tx)}{fN(tx.amount / 100)}</span>
                      </div>
                    ))}
                    {txTotalPages > 1 && (
                      <div className="flex items-center justify-between py-2 px-3" style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.05)'}` }}>
                        <span className="text-[11px]" style={{ color: t.textMuted }}>Page {txPage}/{txTotalPages}</span>
                        <div className="flex gap-1">
                          <button onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={txPage === 1} className="py-1 px-2 rounded text-[11px] cursor-pointer font-[inherit] border-none" style={{ background: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', color: t.textSoft, opacity: txPage === 1 ? .35 : 1 }}>Prev</button>
                          <button onClick={() => setTxPage(p => Math.min(txTotalPages, p + 1))} disabled={txPage >= txTotalPages} className="py-1 px-2 rounded text-[11px] cursor-pointer font-[inherit] border-none" style={{ background: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', color: t.textSoft, opacity: txPage >= txTotalPages ? .35 : 1 }}>Next</button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-6 text-center text-[13px]" style={{ color: t.textMuted }}>No transactions</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
