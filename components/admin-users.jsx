'use client';
import { useState, useEffect, useCallback, useRef } from "react";
import { SkelList } from "./skeleton";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fN, fD } from "../lib/format";
import { FilterDropdown } from "./date-range-picker";
import { AccountTag } from "./account-tag";

const PER_PAGE = 15;
const TX_PER_PAGE = 15;
const initials = (name) => (name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const fPts = (points) => (Number(points) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

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
    .replace(/\[(initiated_by|admin_initiated):([^\]]+)\]/g, 'Initiated by $2')
    .replace(/\[user_confirmed[^\]]*\]/g, '')
    .replace(/\[awaiting_confirmation\]/g, '')
    .replace(/\[[^\]]+\]/g, '')
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
  const [creditReason, setCreditReason] = useState('');
  const [cashRefund, setCashRefund] = useState(false);
  const [rewards, setRewards] = useState(null);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [ptsAdjOpen, setPtsAdjOpen] = useState(false);
  const [ptsAdjType, setPtsAdjType] = useState('manual_credit');
  const [ptsAdjAmt, setPtsAdjAmt] = useState('');
  const [ptsAdjReason, setPtsAdjReason] = useState('');
  const [ptsAdjLoading, setPtsAdjLoading] = useState(false);
  const canAdjustPoints = ['owner', 'superadmin'].includes(currentAdmin?.role);
  const [actionLoading, setActionLoading] = useState(false);

  const [txList, setTxList] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txPage, setTxPage] = useState(1);

  const menuRef = useRef(null);
  const searchTimer = useRef(null);
  const fetchAbortRef = useRef(null);
  const statsLoadedRef = useRef(false);
  const rewardsReqRef = useRef(0);
  const txReqRef = useRef(0);

  /* ── Debounced search ─────────────────────────── */

  useEffect(() => {
    clearTimeout(searchTimer.current);
    const nextSearch = search.trim().length >= 2 ? search.trim() : "";
    searchTimer.current = setTimeout(() => setDebouncedSearch(nextSearch), search ? 350 : 0);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  /* ── Reset page on filter change ──────────────── */

  useEffect(() => { setPage(1); }, [tab, debouncedSearch, quick]);
  useEffect(() => { setSelected(new Set()); }, [users]);

  /* ── Fetch users ──────────────────────────────── */

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;
    const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE), sort: sort.key, sortDir: sort.dir });
    if (tab !== 'all') params.set('status', tab);
    if (debouncedSearch.length >= 2) params.set('search', debouncedSearch);
    if (quick) params.set('quick', quick);
    if (!statsLoadedRef.current) params.set('includeStats', 'true');
    try {
      const res = await fetch(`/api/admin/users?${params}`, { signal: controller.signal });
      const data = await res.json();
      setUsers(data.users || []);
      setFilteredCount(data.filteredCount || 0);
      setTotalPages(data.totalPages || 1);
      setTabCounts(data.tabCounts || {});
      if (data.stats) {
        statsLoadedRef.current = true;
        setStats(data.stats);
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      // Network error — keep stale data.
    } finally {
      if (fetchAbortRef.current === controller) setLoading(false);
    }
  }, [page, tab, debouncedSearch, quick, sort]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    const iv = setInterval(fetchUsers, 30000);
    const onVis = () => { if (document.visibilityState === 'visible') fetchUsers(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); };
  }, [fetchUsers]);

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

  const doAction = async (userId, action, amount, subtype, reason) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId, amount: Number(amount) || 0, subtype, reason: reason || undefined, ...(action === 'debit' && cashRefund ? { cashRefund: true } : {}) }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Request failed'); }
      if (action === 'credit') {
        const amt = Number(amount) || 0;
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: (u.balance || 0) + amt } : u));
        if (drawerUser?.id === userId) setDrawerUser(prev => ({ ...prev, balance: (prev.balance || 0) + amt }));
        setCreditAmt(''); setCreditType('credit'); setCreditReason('');
        toast.success(`Credited ${fN(amt)} to wallet`);
      }
      if (action === 'debit') {
        const amt = Number(amount) || 0;
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, balance: (u.balance || 0) - amt } : u));
        if (drawerUser?.id === userId) setDrawerUser(prev => ({ ...prev, balance: (prev.balance || 0) - amt }));
        setCreditAmt(''); setCreditType('credit'); setCreditReason(''); setCashRefund(false);
        toast.success(cashRefund ? `${fN(amt)} refunded to bank` : `Debited ${fN(amt)} from wallet`);
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
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'Active', name: u.deletedName || u.name, email: u.deletedEmail || u.email, deletedAt: null, deletedName: null, deletedEmail: null, canReinstate: false } : u));
        if (drawerUser?.id === userId) setDrawerUser(prev => ({ ...prev, status: 'Active', name: prev.deletedName || prev.name, email: prev.deletedEmail || prev.email, deletedAt: null, deletedName: null, deletedEmail: null, canReinstate: false }));
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
    const isDebit = creditType === 'debit';
    const label = isDebit ? 'Debit' : creditType === 'gift' ? 'Gift' : 'Credit';
    const reasonPreview = creditReason.trim() ? `\n\nCustomer sees: "${creditReason.trim()}"` : '';
    const ok = await confirm({
      title: `${label} Wallet`,
      message: `${label} ${fN(amt)} ${isDebit ? 'from' : 'to'} ${user.name}'s wallet?${creditType === 'gift' ? '\n\nThis will be recorded as a gift.' : ''}${reasonPreview}`,
      confirmLabel: `${label} ${fN(amt)}`,
    });
    if (ok) doAction(user.id, isDebit ? 'debit' : 'credit', creditAmt, isDebit ? undefined : creditType, creditReason.trim());
  };

  const handleStatusAction = async (user) => {
    if (user.canReinstate) {
      const ok = await confirm({ title: 'Restore Account', message: `Restore ${user.deletedName || user.name}'s account? They will be able to log in again.`, confirmLabel: 'Restore' });
      if (ok) doAction(user.id, 'reinstate');
    } else if (user.status === 'Active') {
      const ok = await confirm({ title: 'Ban User', message: `Ban ${user.name} (${user.email})? They will lose access.`, confirmLabel: 'Ban User', danger: true });
      if (ok) doAction(user.id, 'suspend');
    } else if (user.status === 'Suspended') {
      const ok = await confirm({ title: 'Activate User', message: `Reactivate ${user.name}'s account?`, confirmLabel: 'Activate' });
      if (ok) doAction(user.id, 'activate');
    }
  };

  /* ── Transactions ─────────────────────────────── */

  const loadTransactions = async (user) => {
    const reqId = ++txReqRef.current;
    setTxLoading(true); setTxList([]); setTxPage(1);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'transactions', userId: user.id }),
      });
      const data = await res.json();
      if (reqId === txReqRef.current) setTxList(data.transactions || []);
    } catch {
      if (reqId === txReqRef.current) setTxList([]);
    } finally {
      if (reqId === txReqRef.current) setTxLoading(false);
    }
  };

  const loadRewards = async (user) => {
    const reqId = ++rewardsReqRef.current;
    setRewardsLoading(true); setRewards(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rewards', userId: user.id }),
      });
      const data = await res.json();
      if (reqId === rewardsReqRef.current) setRewards(data.rewards || null);
    } catch {
      if (reqId === rewardsReqRef.current) setRewards(null);
    } finally {
      if (reqId === rewardsReqRef.current) setRewardsLoading(false);
    }
  };

  const submitPointsAdj = async () => {
    if (!drawerUser || !ptsAdjReason.trim() || !Number(ptsAdjAmt)) return;
    setPtsAdjLoading(true);
    try {
      const res = await fetch('/api/admin/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: drawerUser.id, type: ptsAdjType, points: Number(ptsAdjAmt), reason: ptsAdjReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error('Failed', data.error || 'Could not adjust points'); return; }
      toast.success('Done', `${ptsAdjType === 'manual_credit' ? 'Credited' : 'Debited'} ${ptsAdjAmt} pts`);
      setPtsAdjAmt(''); setPtsAdjReason(''); setPtsAdjOpen(false);
      loadRewards(drawerUser);
    } catch { toast.error('Error', 'Network error'); }
    finally { setPtsAdjLoading(false); }
  };

  /* ── Drawer ───────────────────────────────────── */

  const openDrawer = (user, creditOpen = false) => {
    setDrawerUser(user);
    setDrawerCreditOpen(creditOpen);
    setCreditAmt(''); setCreditType('credit'); setCreditReason('');
    setMenuUser(null);
    loadTransactions(user);
    loadRewards(user);
  };

  const closeDrawer = () => {
    rewardsReqRef.current++;
    txReqRef.current++;
    setDrawerUser(null);
    setDrawerCreditOpen(false);
    setEditing(false);
    setTxList([]);
    setRewards(null);
    setPtsAdjOpen(false); setPtsAdjAmt(''); setPtsAdjReason('');
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
    const ids = users.filter(u => selected.has(u.id) && u.status === 'Active').map(u => u.id);
    if (!ids.length) return;
    const ok = await confirm({ title: 'Bulk Ban', message: `Ban ${ids.length} users? They will all lose access.`, confirmLabel: `Ban ${ids.length} users`, danger: true });
    if (!ok) return;
    for (const id of ids) {
      await doAction(id, 'suspend');
    }
    toast.success(`Banned ${ids.length} users`);
  };

  /* ── Selection helpers ────────────────────────── */

  const selectableUsers = users.filter(u => !['PendingDeletion', 'Deleted'].includes(u.status));
  const allSelected = selectableUsers.length > 0 && selectableUsers.every(u => selected.has(u.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableUsers.map(u => u.id)));
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
  const isMutationLocked = (u) => ['PendingDeletion', 'Deleted'].includes(u.status);

  const rangeStart = (page - 1) * PER_PAGE + 1;
  const rangeEnd = Math.min(page * PER_PAGE, filteredCount);

  /* ── Styles ───────────────────────────────────── */



  /* ── Skeleton row ─────────────────────────────── */

  const Skeleton = () => (
    <div className="px-4">
      <SkelList dark={dark} rows={8} bare rowH={56} />
    </div>
  );

  /* ── Transaction row helpers ──────────────────── */



  const txSign = (tx) => {
    if (tx.status !== 'Completed') return '';
    return (tx.type === 'order' || tx.type === 'admin_debit') ? '-' : '+';
  };

  const txLabel = (type) => {
    if (type === 'admin_credit') return 'credit';
    if (type === 'admin_gift') return 'gift';
    if (type === 'admin_debit') return 'debit';
    return type;
  };

  const txTotalPages = Math.ceil(txList.length / TX_PER_PAGE);
  const txPaged = txList.slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE);

  /* ── Render ───────────────────────────────────── */

  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93",
    "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--acbg": dark ? "rgba(196,125,142,.16)" : "rgba(196,125,142,.09)", "--acln": dark ? "rgba(196,125,142,.7)" : "rgba(196,125,142,.55)",
    "--ok": dark ? "#6ee7b7" : "#0a7d54", "--okbg": dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.09)", "--warn": dark ? "#fcd34d" : "#b45309", "--bad": dark ? "#fca5a5" : "#c62828",
    "--bg": dark ? "#0b0e1a" : "#e8e2d9", "--bluetxt": "#60a5fa",
  };
  const dotCls = (status) => status === 'Active' ? 'ok' : status === 'Suspended' ? 'bad' : status === 'PendingDeletion' ? 'warn' : 'dim';
  const joinedShort = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso); const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const s = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return d.getFullYear() === now.getFullYear() ? s : `${s} ${String(d.getFullYear()).slice(2)}`;
  };
  const txText = (tx) => cleanNote(tx.note) || tx.reference || txLabel(tx.type);
  const sortArrow = (key) => sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : '';
  const openWa = (u) => { const link = waLink(u); if (link) window.open(link, '_blank'); else toast.info('No WhatsApp', `${displayName(u)} hasn't added a phone number`); };
  const [txAll, setTxAll] = useState(false);
  useEffect(() => { setTxAll(false); }, [drawerUser?.id]);
  // Below 900px the profile is a sheet over the list rather than a column beside it.
  const [drawerOpenMobile, setDrawerOpenMobile] = useState(false);
  // A sheet over the list: nothing behind it scrolls or takes taps while it is up.
  useEffect(() => {
    if (!drawerUser) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') closeDrawer(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [drawerUser]);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const sync = () => setDrawerOpenMobile(mq.matches);
    sync(); mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const txShown = txAll ? txPaged : txList.slice(0, 5);
  const sd = drawerUser ? statusDot(drawerUser.status, t) : null;

  const drawer = drawerUser && (
    <aside className={"us-dr" + (drawerOpenMobile ? " sheet" : "")}>
      <div className="us-grab" />
      <div className="us-dh">
        <span className="us-av lg">{initials(displayName(drawerUser))}</span>
        <span className="us-dn">
          <b>{displayName(drawerUser)}</b>
          <i>{displayEmail(drawerUser)}{drawerUser.phone ? ` · ${drawerUser.phone}` : ''}</i>
        </span>
        <span className="us-st"><i className={`us-dot ${dotCls(drawerUser.status)}`} />{sd.label}</span>
        <button type="button" className="us-ib" onClick={closeDrawer} aria-label="Close">✕</button>
      </div>

      {editing ? (
        <section className="us-dsec">
          <header><h4>Edit account</h4></header>
          <div className="us-edit">
            {[['name', 'Name'], ['email', 'Email'], ['phone', 'Phone']].map(([key, label]) => (
              <label key={key} className="us-fld"><span>{label}</span><input type={key === 'email' ? 'email' : 'text'} value={editForm[key]} onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} className="us-in" /></label>
            ))}
            <div className="us-row">
              <button type="button" className="us-pri" disabled={actionLoading} onClick={saveEdit}>{actionLoading ? 'Saving...' : 'Save changes'}</button>
              <button type="button" className="us-b" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="us-facts">
            <div className="us-f"><span>Balance</span><b className={"m" + ((drawerUser.balance || 0) > 0 ? " good" : "")}>{fN(drawerUser.balance || 0)}</b></div>
            <div className="us-f"><span>Orders</span><b className="m">{drawerUser.orders || 0}</b></div>
            <div className="us-f"><span>Spent, 90 days</span><b className="m">{fN(drawerUser.spend90 || 0)}</b></div>
            <div className="us-f"><span>Joined</span><b>{drawerUser.joined ? fD(drawerUser.joined, true) : '—'}</b></div>
            <div className="us-f"><span>Ref code</span><b className="m">{drawerUser.refCode || '—'}</b></div>
            <div className="us-f"><span>Nitro status</span><b>{rewardsLoading ? '…' : rewards ? <><span className="us-tier">{rewards.status.name}</span> · {(rewards.points.balance || 0).toLocaleString()} pts</> : '—'}</b></div>
          </div>

          <div className="us-acts">
            {!isMutationLocked(drawerUser) && <button type="button" className="us-pri" onClick={() => setDrawerCreditOpen(!drawerCreditOpen)}>Credit wallet</button>}
            {!isMutationLocked(drawerUser) && <button type="button" className="us-b" onClick={() => openWa(drawerUser)}><WAIcon /> WhatsApp</button>}
            {canEdit && !isMutationLocked(drawerUser) && <button type="button" className="us-b" onClick={startEditing}>Edit</button>}
            {(drawerUser.canReinstate || ['Active', 'Suspended'].includes(drawerUser.status)) && (
              <button type="button" className={"us-b" + (drawerUser.status === 'Active' ? " danger" : "")} disabled={actionLoading} onClick={() => handleStatusAction(drawerUser)}>
                {drawerUser.canReinstate ? 'Restore' : drawerUser.status === 'Active' ? 'Ban' : 'Activate'}
              </button>
            )}
          </div>

          {drawerCreditOpen && !isMutationLocked(drawerUser) && (
            <section className="us-dsec">
              <header><h4>Credit or debit</h4><span className="us-cnt">The reason is shown to the customer</span></header>
              <div className="us-cred">
                <div className="us-segs">
                  {[['credit', 'Credit'], ['gift', 'Gift'], ['debit', 'Debit']].map(([v, l]) => <button key={v} type="button" className={"us-seg" + (creditType === v ? " on" : "")} onClick={() => setCreditType(v)}>{l}</button>)}
                </div>
                <input type="number" placeholder="₦ 0" value={creditAmt} onChange={e => setCreditAmt(e.target.value)} className="us-in m" />
                <input type="text" placeholder={creditType === 'debit' ? 'Reason' : 'Reason (optional)'} value={creditReason} onChange={e => setCreditReason(e.target.value)} className="us-in" />
                <button type="button" className="us-b" disabled={actionLoading || Number(creditAmt) <= 0 || (creditType === 'debit' && !creditReason.trim())} onClick={() => handleCredit(drawerUser)}>Apply</button>
              </div>
              <div className="us-quick">{[1000, 2000, 5000, 10000].map(p => <button key={p} type="button" className="us-b sm" onClick={() => setCreditAmt(String(p))}>{fN(p)}</button>)}</div>
              {creditType === 'debit' && (
                <label className="us-cashref">
                  <input type="checkbox" checked={cashRefund} onChange={e => setCashRefund(e.target.checked)} />
                  <span><b>Sent back to their bank</b><i>Books as money out on Finance, not just a wallet adjustment</i></span>
                </label>
              )}
            </section>
          )}

          {canAdjustPoints && rewards && !isMutationLocked(drawerUser) && (
            <section className="us-dsec">
              <header><h4>Points</h4><span className="us-cnt">{fPts(rewards.points.balance || 0)} pts · ₦{(rewards.points.valueNaira || 0).toLocaleString()} value{ptsAdjOpen ? '' : <> · <button type="button" className="us-link" onClick={() => setPtsAdjOpen(true)}>adjust</button></>}</span></header>
              {ptsAdjOpen && (
                <div className="us-cred">
                  <div className="us-segs">
                    {[['manual_credit', 'Credit'], ['manual_debit', 'Debit']].map(([v, l]) => <button key={v} type="button" className={"us-seg" + (ptsAdjType === v ? " on" : "")} onClick={() => setPtsAdjType(v)}>{l}</button>)}
                  </div>
                  <input type="number" placeholder="Points" value={ptsAdjAmt} onChange={e => setPtsAdjAmt(e.target.value)} className="us-in m" />
                  <input type="text" placeholder="Reason" value={ptsAdjReason} onChange={e => setPtsAdjReason(e.target.value)} className="us-in" />
                  <div className="us-row">
                    <button type="button" className="us-b" disabled={ptsAdjLoading || !Number(ptsAdjAmt) || !ptsAdjReason.trim()} onClick={submitPointsAdj}>{ptsAdjLoading ? '…' : 'Apply'}</button>
                    <button type="button" className="us-b ghost" onClick={() => { setPtsAdjOpen(false); setPtsAdjAmt(''); setPtsAdjReason(''); }}>Cancel</button>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="us-dsec">
            <header>
              <h4>Transactions</h4>
              <span className="us-cnt">
                {txLoading ? 'Loading…' : txList.length === 0 ? 'None yet' : txAll
                  ? <>{txList.length} total · <button type="button" className="us-link" onClick={() => { setTxAll(false); setTxPage(1); }}>latest 5</button> · <button type="button" className="us-link" onClick={() => { const name = (displayName(drawerUser) || 'user').replace(/\s+/g, '-'); downloadBlob(buildTxCSV(txList), `${name}-transactions.csv`); }}>CSV</button></>
                  : <>Latest {Math.min(5, txList.length)}{txList.length > 5 && <> · <button type="button" className="us-link" onClick={() => setTxAll(true)}>all {txList.length}</button></>}</>}
              </span>
            </header>
            <div className="us-txs">
              {txShown.map(tx => (
                <div key={tx.id} className="us-tr">
                  <span className="us-td">{joinedShort(tx.createdAt)}</span>
                  <span className="us-tn" title={txText(tx)}>{txText(tx)}</span>
                  <b className={"m " + (tx.status !== 'Completed' ? 'dim' : txSign(tx) === '+' ? 'in' : 'out')}>{txSign(tx) === '-' ? '−' : txSign(tx)}{fN(Math.abs(tx.amount) / 100)}</b>
                </div>
              ))}
              {txAll && txTotalPages > 1 && (
                <div className="us-tr us-txpg">
                  <button type="button" className="us-b sm" disabled={txPage === 1} onClick={() => setTxPage(p => Math.max(1, p - 1))}>Prev</button>
                  <span className="us-cnt">{txPage} of {txTotalPages}</span>
                  <button type="button" className="us-b sm" disabled={txPage >= txTotalPages} onClick={() => setTxPage(p => Math.min(txTotalPages, p + 1))}>Next</button>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </aside>
  );

  return (
    <div className="us" style={vars}>
      <style>{US_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Users</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Every account, what they hold, what they have done.</div>
          </div>
          <button type="button" className="us-b" onClick={exportAll}><ExportIcon /> Export CSV</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="us-stats">
        <div className="us-stt"><b className="m">{stats ? stats.totalUsers.toLocaleString() : '—'}</b><span>Total users</span><i>{stats ? `↑ ${stats.newThisWeek.toLocaleString()} this week` : ' '}</i></div>
        <div className="us-stt"><b className="m">{stats ? stats.activeUsers.toLocaleString() : '—'}</b><span>Active</span><i>{stats ? `${stats.totalUsers ? Math.round(stats.activeUsers / stats.totalUsers * 100) : 0}% of users` : ' '}</i></div>
        <div className="us-stt"><b className="m">{stats ? fN(stats.totalBalance) : '—'}</b><span>Total balance</span><i>{stats ? `${stats.fundedWallets.toLocaleString()} funded wallets` : ' '}</i></div>
        <div className="us-stt"><b className="m">{stats ? stats.totalOrders.toLocaleString() : '—'}</b><span>Total orders</span><i>{stats ? `↑ ${stats.ordersThisMonth.toLocaleString()} this month` : ' '}</i></div>
      </div>

      <div className="us-bar">
        <div className="us-srch">
          <SearchIcon color="currentColor" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email or phone" />
          {search && <button type="button" className="us-x" onClick={() => setSearch('')} aria-label="Clear search"><XIcon /></button>}
        </div>
        <FilterDropdown dark={dark} t={t} value={tab} onChange={(v) => { setTab(v); setPage(1); }} options={TABS.map(tb => ({ value: tb.id, label: `${tb.id === 'all' ? 'All users' : tb.label}${tabCounts[tb.id] != null ? ` (${tabCounts[tb.id].toLocaleString()})` : ''}` }))} />
        {[['funded', 'Funded'], ['buyers', 'Buyers']].map(([id, label]) => (
          <button key={id} type="button" className={"us-tg" + (quick === id ? " on" : "")} onClick={() => setQuick(quick === id ? null : id)}>{label}</button>
        ))}
        <span className="us-cnt us-count">{filteredCount.toLocaleString()} {filteredCount === 1 ? 'person' : 'people'}{totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}</span>
      </div>

      {selected.size > 0 && (
        <div className="us-bb">
          <b>{selected.size} selected</b>
          <button type="button" className="us-b sm" onClick={() => { if (selected.size === 1) { const u = users.find(x => x.id === [...selected][0]); if (u) openDrawer(u, true); } else toast.info('Coming soon', 'Bulk credit coming soon'); }}>Credit</button>
          <button type="button" className="us-b sm" onClick={() => toast.info('Coming soon', 'Bulk message coming soon')}>Email</button>
          <button type="button" className="us-b sm" onClick={exportSelected}>Export</button>
          <button type="button" className="us-b sm danger" onClick={bulkBan}>Ban</button>
          <button type="button" className="us-b sm ghost" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="us-cols">
        <div className="us-list">
          <div className="us-uh">
            <span><button type="button" className={"us-cb" + (allSelected ? " on" : "")} onClick={toggleAll} aria-label="Select all" /></span>
            <span className="us-sort" onClick={() => toggleSort('name')}>Person{sortArrow('name')}</span>
            <span>Status</span>
            <span className="r us-sort" onClick={() => toggleSort('balance')}>Balance{sortArrow('balance')}</span>
            <span className="r us-sort" onClick={() => toggleSort('orders')}>Orders{sortArrow('orders')}</span>
            <span className="r us-sort" onClick={() => toggleSort('joined')}>Joined{sortArrow('joined')}</span>
            <span />
          </div>
          {loading && users.length === 0 ? <Skeleton /> : users.length === 0 ? (
            <div className="us-empty">{search ? `Nobody matches "${search}".` : 'No accounts here yet.'}</div>
          ) : users.map(u => {
            const name = displayName(u);
            const sel = selected.has(u.id);
            const lockedRow = isMutationLocked(u);
            return (
              <div key={u.id} className={"us-ur" + (sel || drawerUser?.id === u.id ? " sel" : "") + (u.status === 'Suspended' ? " banned" : "")} onClick={() => openDrawer(u)}>
                <span onClick={e => e.stopPropagation()}>{!lockedRow && <button type="button" className={"us-cb" + (sel ? " on" : "")} onClick={() => toggleOne(u.id)} aria-label={`Select ${name}`} />}</span>
                <span className="us-un">
                  <span className="us-av">{initials(name)}</span>
                  <span className="us-unt">
                    <b><span>{name}</span><AccountTag reseller={u.isReseller} api={u.usesApi} dark={dark} />{!u.verified && u.status === 'Active' && <span className="us-ch unv">Unverified</span>}</b>
                    <i>{displayEmail(u)}</i>
                  </span>
                </span>
                <span className="us-st"><i className={`us-dot ${dotCls(u.status)}`} />{statusDot(u.status, t).label}</span>
                <span className={"us-bal m" + ((u.balance || 0) > 0 ? "" : " z")}>{fN(u.balance || 0)}</span>
                <span className="us-ord m">{u.orders || 0}</span>
                <span className="us-jn">{joinedShort(u.joined)}</span>
                <span className="us-ra" onClick={e => e.stopPropagation()}>
                  {!lockedRow && <button type="button" className="us-ib" title="Credit" onClick={() => openDrawer(u, true)}>₦</button>}
                  {!lockedRow && <button type="button" className="us-ib wa" title="WhatsApp" onClick={() => openWa(u)}><WAIcon /></button>}
                  <button type="button" className="us-ib" title="More" onClick={(e) => openMenu(e, u)}><MoreIcon /></button>
                </span>
              </div>
            );
          })}
          {!loading && totalPages > 1 && (
            <div className="us-pg">
              <span className="us-cnt">{rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {filteredCount.toLocaleString()}</span>
              <span className="us-pgn">
                <button type="button" className="us-ib" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} aria-label="Previous page"><ChevronLeft /></button>
                <span className="us-cnt" style={{ alignSelf: 'center', padding: '0 4px' }}>{page} of {totalPages}</span>
                <button type="button" className="us-ib" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} aria-label="Next page"><ChevronRight /></button>
              </span>
            </div>
          )}
        </div>
      </div>

      {drawerUser && (
        <>
          <div className="us-back" onClick={closeDrawer} />
          {drawer}
        </>
      )}

      {menuUser && menuPos && (
        <div ref={menuRef} className="us-menu" style={{ ...(menuPos.top != null ? { top: menuPos.top } : { bottom: menuPos.bottom }), right: menuPos.right }}>
          {[
            { label: 'View profile', action: () => openDrawer(menuUser) },
            { label: 'Credit wallet', hidden: isMutationLocked(menuUser), action: () => openDrawer(menuUser, true) },
            { label: 'WhatsApp', hidden: isMutationLocked(menuUser), action: () => { openWa(menuUser); setMenuUser(null); } },
            { sep: true, hidden: !menuUser.canReinstate && !['Active', 'Suspended'].includes(menuUser.status) },
            {
              label: menuUser.canReinstate ? 'Restore account' : menuUser.status === 'Active' ? 'Ban user' : 'Activate user',
              hidden: !menuUser.canReinstate && !['Active', 'Suspended'].includes(menuUser.status),
              danger: menuUser.status === 'Active',
              action: () => { handleStatusAction(menuUser); setMenuUser(null); },
            },
          ].filter(item => !item.hidden).map((item, i) => item.sep ? <div key={i} className="us-msep" /> : (
            <button key={i} type="button" className={"us-mi" + (item.danger ? " danger" : "")} onClick={item.action}>{item.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const US_CSS = `
.us{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.us *{box-sizing:border-box}
.us .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.us-b{font:inherit;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;transition:transform .15s}
.us-b:hover{transform:translateY(-1px)}.us-b.sm{padding:5px 9px;font-size:11.5px}.us-b.danger{color:var(--bad)}.us-b.ghost{background:transparent;color:var(--mut)}
.us-b:disabled{opacity:.5;cursor:not-allowed;transform:none}.us-b svg{width:13px;height:13px}
.us-pri{font:inherit;font-size:13px;font-weight:800;padding:9px 14px;border-radius:10px;border:0;background:var(--ac);color:#fff;cursor:pointer;box-shadow:0 8px 22px rgba(196,125,142,.28);white-space:nowrap;transition:transform .15s}
.us-pri:hover{transform:translateY(-1px)}.us-pri:disabled{opacity:.45;cursor:not-allowed;box-shadow:none;transform:none}
.us-link{font:inherit;font-size:inherit;font-weight:600;color:var(--ac);background:none;border:0;cursor:pointer;padding:0}
.us-cnt{font-size:11.5px;color:var(--dim)}
.us-row{display:flex;gap:8px}.us-row>*{flex:1}
.us-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.us-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.us-stt:first-child{border-left:0}
.us-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.us-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px}
.us-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;min-height:15px}
.us-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.us-srch{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);color:var(--dim);font-size:13px;min-width:260px;position:relative}
.us-srch:focus-within{border-color:var(--acln)}.us-srch svg{width:14px;height:14px;flex-shrink:0}
.us-srch input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13px;color:var(--ink);outline:none}
.us-x{width:18px;height:18px;border-radius:50%;border:0;background:var(--rail);color:var(--mut);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.us-tg{font:inherit;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);cursor:pointer}
.us-tg.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.us-count{margin-left:auto;font-size:12px}
.us-bb{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;background:var(--acbg);border:1px solid var(--line);font-size:13px;flex-wrap:wrap}.us-bb b{margin-right:4px}
.us-cols{display:grid;grid-template-columns:1fr;gap:14px;align-items:start}
.us-list{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow-x:auto;min-width:0}
.us-uh,.us-ur{display:grid;grid-template-columns:22px minmax(0,1fr) 90px 94px 58px 76px 96px;min-width:568px;align-items:center;gap:12px;padding:0 14px}
.us-uh{height:34px;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);background:var(--soft);border-bottom:1px solid var(--line)}
.us-uh .r{text-align:right}.us-sort{cursor:pointer;user-select:none}
.us-ur{padding-top:9px;padding-bottom:9px;border-top:1px solid var(--rail);font-size:13px;min-width:0;cursor:pointer}.us-ur:hover{background:var(--soft)}.us-ur.sel{background:var(--acbg)}
.us-cb{width:16px;height:16px;border-radius:4px;border:1.5px solid var(--line);background:transparent;display:inline-block;cursor:pointer;padding:0;vertical-align:middle}.us-cb.on{background:var(--ac);border-color:var(--ac)}
.us-av{width:34px;height:34px;border-radius:50%;background:var(--ac);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}.us-av.lg{width:44px;height:44px;font-size:15px}
.us-un{display:flex;align-items:center;gap:10px;min-width:0}
.us-unt{display:flex;flex-direction:column;gap:1px;min-width:0}
.us-unt b{display:flex;align-items:center;gap:6px;font-weight:600;min-width:0}.us-unt b>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.us-unt i{font-style:normal;font-size:11.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.us-ch{font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:2px 6px;border-radius:6px;flex-shrink:0}.us-ch.unv{background:var(--soft);color:var(--mut);border:1px solid var(--line)}
.us-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--mut);white-space:nowrap}
.us-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}.us-dot.ok{background:var(--ok)}.us-dot.bad{background:var(--bad)}.us-dot.warn{background:var(--warn)}.us-dot.dim{background:var(--dim)}
.us-bal{text-align:right;font-weight:700;color:var(--ok)}.us-bal.z{color:var(--dim);font-weight:500}.us-ord{text-align:right;font-weight:600}.us-jn{text-align:right;font-size:12px;color:var(--mut)}
.us-ra{display:flex;justify-content:flex-end;gap:4px;opacity:.55}.us-ur:hover .us-ra,.us-ur.sel .us-ra{opacity:1}
.us-ib{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);font:inherit;font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;flex-shrink:0}
.us-ib svg{width:13px;height:13px}.us-ib.wa{color:#25d366}.us-ib:disabled{opacity:.4;cursor:not-allowed}
.us-pg{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid var(--line);background:var(--soft)}
.us-pgn{display:inline-flex;align-items:center;gap:6px;flex-shrink:0;white-space:nowrap}
.us-empty{padding:28px 14px;text-align:center;font-size:13px;color:var(--mut)}
.us-dr{background:var(--card);border-left:1px solid var(--line);padding:16px;display:flex;flex-direction:column;gap:14px;position:fixed;top:0;right:0;bottom:0;height:100dvh;width:min(440px,100%);z-index:999;overflow:auto;box-shadow:-12px 0 40px rgba(0,0,0,.2);min-width:0}
/* The drawer is a fixed-height flex column: without this, the browser shrinks
   the sections (which clip, being overflow:hidden) instead of letting the
   column overflow — the facts card and the transactions pagination were being
   crushed and cropped rather than scrolled to. */
.us-dr>*{flex-shrink:0}
/* A scroll container swallows its own bottom padding once content overflows —
   this spacer keeps the last row reachable at the end of the scroll. */
.us-dr::after{content:"";display:block;flex-shrink:0;height:28px}
.us-grab{display:none}
.us-dh{display:flex;align-items:center;gap:12px;min-width:0}
.us-dn{display:flex;flex-direction:column;min-width:0;flex:1}.us-dn b{font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.us-dn i{font-style:normal;font-size:12px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.us-facts{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.us-f{display:flex;flex-direction:column;gap:2px;padding:9px 12px;border-top:1px solid var(--rail);border-left:1px solid var(--rail);min-width:0}
.us-f:nth-child(-n+2){border-top:0}.us-f:nth-child(odd){border-left:0}
.us-f span{font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}
.us-f b{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.us-f b.good{color:var(--ok)}.us-tier{color:var(--bluetxt);font-weight:800}
.us-acts{display:flex;gap:6px;flex-wrap:wrap}.us-acts .us-pri{flex:1;text-align:center}
.us-dsec{border:1px solid var(--line);border-radius:12px;overflow:hidden}
.us-dsec>header{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:9px 12px;border-bottom:1px solid var(--line);background:var(--soft)}
.us-dsec h4{font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:var(--mut);font-weight:700;margin:0;white-space:nowrap}
.us-cred{display:grid;grid-template-columns:130px 1fr 1fr auto;gap:8px;padding:10px 12px;align-items:center}
.us-quick{display:flex;gap:6px;padding:0 12px 10px;flex-wrap:wrap}
.us-cashref{display:flex;align-items:flex-start;gap:10px;margin:0 12px 12px;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--soft);cursor:pointer;font-size:12.5px}.us-cashref input{margin-top:2px;accent-color:var(--ac)}.us-cashref span{display:flex;flex-direction:column;gap:2px}.us-cashref b{font-weight:600;color:var(--ink)}.us-cashref i{font-style:normal;font-size:11.5px;color:var(--mut)}
.us-segs{display:flex;gap:3px;padding:3px;border-radius:9px;background:var(--soft);border:1px solid var(--line)}
.us-seg{flex:1;text-align:center;font:inherit;font-size:12px;font-weight:600;padding:6px;border-radius:6px;color:var(--mut);background:none;border:0;cursor:pointer}.us-seg.on{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.us-in{width:100%;height:34px;padding:0 10px;border-radius:9px;border:1px solid var(--line);background:var(--card);font:inherit;font-size:13px;color:var(--ink);outline:none;min-width:0}.us-in:focus{border-color:var(--acln)}
.us-edit{display:flex;flex-direction:column;gap:10px;padding:12px}
.us-fld{display:flex;flex-direction:column;gap:5px}.us-fld span{font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}
.us-txs{display:flex;flex-direction:column}
.us-tr{display:flex;align-items:center;gap:10px;padding:8px 12px;border-top:1px solid var(--rail);font-size:12.5px}.us-tr:first-child{border-top:0}
.us-td{color:var(--dim);width:46px;flex-shrink:0;font-size:11.5px}.us-tn{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--mut)}
.us-tr b{font-weight:600;flex-shrink:0}.us-tr b.in{color:var(--ok)}.us-tr b.out{color:var(--ink)}.us-tr b.dim{color:var(--dim)}
.us-txpg{justify-content:space-between}
.us-menu{position:fixed;z-index:1000;width:170px;padding:6px 0;border-radius:12px;background:var(--card);border:1px solid var(--line);box-shadow:0 12px 30px rgba(0,0,0,.18)}
.us-mi{display:block;width:100%;text-align:left;padding:8px 12px;font:inherit;font-size:13px;font-weight:500;color:var(--ink);background:none;border:0;cursor:pointer}.us-mi:hover{background:var(--soft)}.us-mi.danger{color:var(--bad)}
.us-msep{height:1px;background:var(--line);margin:6px 12px}
.us-back{position:fixed;inset:0;z-index:998;background:rgba(0,0,0,.45)}
.us-dr.sheet{left:0;right:0;bottom:0;top:auto;width:auto;border-left:0;border-top:1px solid var(--line);border-radius:20px 20px 0 0;box-shadow:0 -12px 40px rgba(0,0,0,.25);max-height:92vh}
.us-dr.sheet .us-grab{display:block;width:36px;height:4px;border-radius:2px;background:var(--line);margin:-4px auto 2px}
@media (max-width:900px){
  .us-stats{grid-template-columns:1fr 1fr}.us-stt:nth-child(3){border-left:0}.us-stt:nth-child(n+3){border-top:1px solid var(--line)}.us-stt b{font-size:17px}
  .us-srch{width:100%;min-width:0}.us-count{display:none}
  .us-uh{display:none}
  .us-list{overflow-x:visible}.us-ur{display:flex;align-items:center;gap:10px;padding:10px 12px;min-width:0}
  .us-ur>span:first-child,.us-ord,.us-jn,.us-ra,.us-st{display:none}.us-un{flex:1}.us-bal{flex-shrink:0;font-size:13px}
  .us-unt i{display:flex;align-items:center;gap:6px}
  .us-unt i::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ok);flex-shrink:0}.us-ur.banned .us-unt i::before{background:var(--bad)}
  .us-cred{grid-template-columns:1fr 1fr}.us-cred .us-segs{grid-column:1/-1}.us-cred .us-b{grid-column:1/-1}
}
`;
