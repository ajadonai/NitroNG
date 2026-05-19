'use client';
import { useState, useEffect } from 'react';
import { SegPill } from './seg-pill';

const BANNER_COLORS = [
  { hex: '#10b981', label: 'Green' },
  { hex: '#0F6E56', label: 'Teal' },
  { hex: '#3b82f6', label: 'Blue' },
  { hex: '#6366f1', label: 'Indigo' },
  { hex: '#a855f7', label: 'Purple' },
  { hex: '#c47d8e', label: 'Nitro' },
  { hex: '#e0a458', label: 'Amber' },
  { hex: '#ef4444', label: 'Red' },
  { hex: '#ec4899', label: 'Pink' },
];

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function StatusBadge({ status, active, recurring }) {
  if (recurring) {
    const s = active ? { bg: 'rgba(16,185,129,.15)', text: '#10b981', label: 'Active' } : { bg: 'rgba(138,133,128,.15)', text: '#8a8580', label: 'Inactive' };
    return <span className="text-[11px] py-0.5 px-1.5 rounded" style={{ background: s.bg, color: s.text }}>{s.label}</span>;
  }
  const colors = {
    DRAFT: { bg: 'rgba(138,133,128,.15)', text: '#8a8580' },
    SCHEDULED: { bg: 'rgba(165,180,252,.15)', text: '#a5b4fc' },
    ACTIVE: { bg: 'rgba(16,185,129,.15)', text: '#10b981' },
    PAUSED: { bg: 'rgba(224,164,88,.15)', text: '#e0a458' },
    ENDED: { bg: 'rgba(138,133,128,.15)', text: '#8a8580' },
  };
  const s = colors[status] || colors.DRAFT;
  return <span className="text-[11px] py-0.5 px-1.5 rounded" style={{ background: s.bg, color: s.text }}>{status}</span>;
}

function PromotionForm({ dark, t, type, initial, onSave, onCancel }) {
  const isRecurring = type === 'recurring';
  const [form, setForm] = useState(() => {
    if (initial) return { ...initial, maxDiscountPerOrder: initial.maxDiscountPerOrder ? String(initial.maxDiscountPerOrder / 100) : '' };
    return {
      name: '', description: '', discountPercent: '', maxDiscountPerOrder: '',
      bannerCopy: '', bannerColor: '',
      ...(isRecurring ? { dayOfWeek: 'TUESDAY', startTimeLocal: '00:00', endTimeLocal: '23:59', effectiveFrom: '', effectiveUntil: '' } : { startDate: '', startTime: '00:00', endDate: '', endTime: '23:59', priority: '10', emailTheme: '' }),
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inputCls = "w-full py-2.5 px-3.5 rounded-lg border border-solid text-[15px] outline-none box-border font-[inherit]";
  const inputStyle = { borderColor: t.cardBorder, background: dark ? "#131728" : "#fff", color: t.text };
  const selectSt = { backgroundColor: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)"}`, color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)", backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")` };
  const labelCls = "text-[13px] block mb-1";

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    setError('');
    setSaving(true);
    try {
      const built = {
        action: initial ? 'update' : 'create',
        promotionType: type,
        ...(initial ? { id: initial.id } : {}),
        name: form.name,
        description: form.description || null,
        discountPercent: Number(form.discountPercent) || 0,
        maxDiscountPerOrder: form.maxDiscountPerOrder ? Math.round(Number(form.maxDiscountPerOrder) * 100) : null,
        bannerCopy: form.bannerCopy,
        bannerColor: form.bannerColor || null,
      };
      if (isRecurring) {
        built.dayOfWeek = form.dayOfWeek;
        built.startTimeLocal = form.startTimeLocal;
        built.endTimeLocal = form.endTimeLocal;
        built.effectiveFrom = form.effectiveFrom || null;
        built.effectiveUntil = form.effectiveUntil || null;
      } else {
        const startAt = form.startDate ? `${form.startDate}T${form.startTime || '00:00'}` : (form.startAt || '');
        const endAt = form.endDate ? `${form.endDate}T${form.endTime || '23:59'}` : (form.endAt || '');
        built.startAt = startAt;
        built.endAt = endAt;
        built.priority = form.priority ? Number(form.priority) : 10;
        built.emailTheme = form.emailTheme || null;
      }
      const res = await fetch('/api/admin/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(built) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setSaving(false); return; }
      onSave();
    } catch { setError('Something went wrong'); setSaving(false); }
  };

  const startDate = form.startDate || (form.startAt ? form.startAt.slice(0, 10) : '');
  const startTime = form.startTime || (form.startAt ? form.startAt.slice(11, 16) : '00:00');
  const endDate = form.endDate || (form.endAt ? form.endAt.slice(0, 10) : '');
  const endTime = form.endTime || (form.endAt ? form.endAt.slice(11, 16) : '23:59');

  return (
    <>
      {error && <div className="py-2.5 px-4 rounded-lg text-sm mb-3.5 flex justify-between items-center" style={{ background: dark ? "rgba(220,38,38,.18)" : "#fef2f2", border: `1px solid ${dark ? "rgba(220,38,38,.28)" : "#fecaca"}`, color: dark ? "#fca5a5" : "#dc2626" }}><span>{error}</span><button onClick={() => setError("")} className="bg-transparent border-none cursor-pointer" style={{ color: "inherit" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><label className={labelCls} style={{ color: t.textMuted }}>Name</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder={isRecurring ? 'NITRO TUESDAY' : 'SUMMER SALE'} className={inputCls} style={inputStyle} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls} style={{ color: t.textMuted }}>Discount %</label><input type="number" min="1" max="100" value={form.discountPercent} onChange={e => set('discountPercent', e.target.value)} placeholder="10" className={inputCls} style={inputStyle} /></div>
          <div><label className={labelCls} style={{ color: t.textMuted }}>Max (₦)</label><input type="number" value={form.maxDiscountPerOrder} onChange={e => set('maxDiscountPerOrder', e.target.value)} placeholder="No limit" className={inputCls} style={inputStyle} /></div>
        </div>
      </div>

      {isRecurring ? (
        <>
          <div className="grid grid-cols-3 max-md:grid-cols-1 gap-3 mb-3">
            <div><label className={labelCls} style={{ color: t.textMuted }}>Day</label>
              <select value={form.dayOfWeek} onChange={e => set('dayOfWeek', e.target.value)} className={`${inputCls} appearance-none cursor-pointer bg-no-repeat bg-[position:right_10px_center]`} style={selectSt}>
                {DAYS.map(d => <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div><label className={labelCls} style={{ color: t.textMuted }}>Start Time</label><input type="time" value={form.startTimeLocal} onChange={e => set('startTimeLocal', e.target.value)} className={inputCls} style={inputStyle} /></div>
            <div><label className={labelCls} style={{ color: t.textMuted }}>End Time</label><input type="time" value={form.endTimeLocal} onChange={e => set('endTimeLocal', e.target.value)} className={inputCls} style={inputStyle} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className={labelCls} style={{ color: t.textMuted }}>Effective From</label><input type="date" value={form.effectiveFrom?.split('T')[0] || ''} onChange={e => set('effectiveFrom', e.target.value)} className={inputCls} style={inputStyle} /></div>
            <div><label className={labelCls} style={{ color: t.textMuted }}>Effective Until</label><input type="date" value={form.effectiveUntil?.split('T')[0] || ''} onChange={e => set('effectiveUntil', e.target.value)} className={inputCls} style={inputStyle} /></div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls} style={{ color: t.textMuted }}>Start Date</label><input type="date" value={startDate} onChange={e => set('startDate', e.target.value)} className={inputCls} style={inputStyle} /></div>
              <div><label className={labelCls} style={{ color: t.textMuted }}>Start Time</label><input type="time" value={startTime} onChange={e => set('startTime', e.target.value)} className={inputCls} style={inputStyle} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls} style={{ color: t.textMuted }}>End Date</label><input type="date" value={endDate} onChange={e => set('endDate', e.target.value)} className={inputCls} style={inputStyle} /></div>
              <div><label className={labelCls} style={{ color: t.textMuted }}>End Time</label><input type="time" value={endTime} onChange={e => set('endTime', e.target.value)} className={inputCls} style={inputStyle} /></div>
            </div>
          </div>
          <div className="mb-3"><label className={labelCls} style={{ color: t.textMuted }}>Priority</label><input type="number" value={form.priority} onChange={e => set('priority', e.target.value)} placeholder="Higher number wins when overlapping" className={inputCls} style={{ ...inputStyle, maxWidth: 200 }} /></div>
          <div className="mb-3">
            <label className={labelCls} style={{ color: t.textMuted }}>Email Theme</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                ['', 'Default'],
                ['christmas', '🎄 Christmas'],
                ['newyear', '🎆 New Year'],
                ['valentine', '💕 Valentine'],
                ['independence', '🇳🇬 Independence'],
                ['eid', '🌙 Eid'],
                ['easter', '🐣 Easter'],
                ['sallah', '🐏 Sallah'],
                ['blackfriday', '🔥 Black Friday'],
              ].map(([id, label]) => (
                <button key={id} onClick={() => set('emailTheme', id)} className="py-1.5 px-3 rounded-lg text-xs font-medium cursor-pointer border transition-transform hover:-translate-y-px" style={{ borderColor: form.emailTheme === id ? t.accent : t.cardBorder, background: form.emailTheme === id ? (dark ? 'rgba(196,125,142,.14)' : 'rgba(196,125,142,.08)') : 'transparent', color: form.emailTheme === id ? t.accent : t.textSoft }}>{label}</button>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mb-3"><label className={labelCls} style={{ color: t.textMuted }}>Banner Copy</label><input value={form.bannerCopy} onChange={e => set('bannerCopy', e.target.value)} placeholder={isRecurring ? 'Save 10% every Tuesday on all services' : 'Summer sale! 15% off everything this week'} className={inputCls} style={inputStyle} /></div>

      <div className="mb-3">
        <label className={labelCls} style={{ color: t.textMuted }}>Banner Color</label>
        <div className="flex items-center gap-2 flex-wrap">
          {BANNER_COLORS.map(c => (
            <button key={c.hex} onClick={() => set('bannerColor', form.bannerColor === c.hex ? '' : c.hex)} className="w-8 h-8 rounded-lg cursor-pointer border-2 transition-transform hover:scale-110" style={{ background: c.hex, borderColor: form.bannerColor === c.hex ? '#fff' : 'transparent', boxShadow: form.bannerColor === c.hex ? `0 0 0 2px ${c.hex}` : 'none' }} title={c.label} />
          ))}
          {form.bannerColor && !BANNER_COLORS.some(c => c.hex === form.bannerColor) && (
            <span className="w-8 h-8 rounded-lg border-2" style={{ background: form.bannerColor, borderColor: '#fff', boxShadow: `0 0 0 2px ${form.bannerColor}` }} />
          )}
          {form.bannerColor && <span className="text-xs ml-1 m" style={{ color: t.textMuted }}>{form.bannerColor}</span>}
        </div>
      </div>

      {form.bannerCopy && (
        <div className="mb-3">
          <label className={labelCls} style={{ color: t.textMuted }}>Preview</label>
          <div className="rounded-xl px-4 py-2.5 flex items-center gap-2.5" style={{ background: form.bannerColor ? `${form.bannerColor}22` : (dark ? 'rgba(16,185,129,.12)' : 'rgba(16,185,129,.08)'), border: `1px solid ${form.bannerColor || '#10b981'}44` }}>
            <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ background: form.bannerColor || '#10b981' }} />
            <span className="text-sm font-medium flex-1" style={{ color: t.text }}>{form.bannerCopy}</span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 m" style={{ background: form.bannerColor || '#10b981', color: '#fff' }}>{form.discountPercent || '?'}% OFF</span>
          </div>
        </div>
      )}

      <div className="mb-3"><label className={labelCls} style={{ color: t.textMuted }}>Internal Notes</label><input value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Optional — only visible to admins" className={inputCls} style={inputStyle} /></div>

      <button onClick={submit} className="adm-btn-primary" style={{ opacity: saving ? .5 : 1 }}>{saving ? 'Saving...' : initial ? 'Save Changes' : 'Create Promotion'}</button>
    </>
  );
}

function DeleteModal({ dark, t, onDelete, onCancel }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: dark ? '#111628' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)'}` }}>
        <div className="px-6 pt-5 pb-4">
          <h3 className="text-lg font-semibold mb-1" style={{ color: t.text }}>Delete Promotion</h3>
          <p className="text-sm mb-4" style={{ color: t.textMuted }}>If this promotion has linked orders it will be ended instead. Otherwise it will be permanently deleted.</p>
        </div>
        <div className="flex gap-2 px-6 py-4" style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'}` }}>
          <button onClick={onDelete} className="px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer border-none" style={{ background: '#dc2626' }}>Delete</button>
          <button onClick={onCancel} className="adm-btn-sm" style={{ borderColor: dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)', color: t.textMuted }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPromotionsPage({ dark, t }) {
  const [loading, setLoading] = useState(true);
  const [seasonalList, setSeasonalList] = useState([]);
  const [recurringList, setRecurringList] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [tab, setTab] = useState('seasonal');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const cardBg = dark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.85)";
  const cardBd = `0.5px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)"}`;
  const headerBg = dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)";
  const headerBorder = `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`;

  const load = () => {
    setLoading(true);
    fetch('/api/admin/promotions').then(r => r.json()).then(d => {
      setSeasonalList(d.seasonal || []);
      setRecurringList(d.recurring || []);
      setCanManage(d.canManage);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const doAction = async (action, id, promotionType, extra = {}) => {
    await fetch('/api/admin/promotions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id, promotionType, ...extra }),
    });
    load();
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const formatMoney = (kobo) => `₦${(kobo / 100).toLocaleString()}`;

  const promotions = tab === 'seasonal' ? seasonalList : recurringList;
  const type = tab === 'seasonal' ? 'platform' : 'recurring';

  return (
    <>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Promotions</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage seasonal and recurring discounts</div>
          </div>
          <SegPill value={tab} options={[{ value: 'seasonal', label: 'Seasonal' }, { value: 'recurring', label: 'Recurring' }]} onChange={v => { setTab(v); setShowAdd(false); setEditing(null); }} dark={dark} t={t} />
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="adm-card mb-5" style={{ background: cardBg, border: cardBd }}>
        {/* Card header — matches coupons */}
        <div className="set-card-header flex justify-between items-center" style={{ background: headerBg, borderBottom: headerBorder }}>
          <div>
            <div className="set-card-title" style={{ color: t.textMuted, marginBottom: 0 }}>{tab === 'seasonal' ? 'Seasonal campaigns' : 'Recurring campaigns'}</div>
            <div className="set-card-desc" style={{ color: t.textSoft, marginBottom: 0 }}>{tab === 'seasonal' ? 'Time-bound promotions with a start and end date' : 'Promotions that repeat on a specific day each week'}</div>
          </div>
          {canManage && <button onClick={() => { setShowAdd(!showAdd); setEditing(null); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>{showAdd ? 'Cancel' : '+ New'}</button>}
        </div>

        {/* Create form — inline in card like coupons */}
        {showAdd && (
          <div className="p-4" style={{ borderBottom: headerBorder }}>
            <PromotionForm dark={dark} t={t} type={tab === 'seasonal' ? 'seasonal' : 'recurring'} onSave={() => { setShowAdd(false); load(); }} onCancel={() => setShowAdd(false)} />
          </div>
        )}

        {/* Promotion list */}
        {loading ? (
          <div className="p-3">{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[56px] rounded-lg mb-1.5`} />)}</div>
        ) : promotions.length > 0 ? promotions.map((c, i) => (
          <div key={c.id} style={{ borderBottom: i < promotions.length - 1 ? `1px solid ${t.cardBorder}` : 'none' }}>
            {editing?.id === c.id ? (
              <div className="p-4">
                <PromotionForm dark={dark} t={t} type={tab === 'seasonal' ? 'seasonal' : 'recurring'} initial={editing} onSave={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />
              </div>
            ) : (
              <div className="adm-list-row flex-wrap gap-2.5">
                <div className="flex-1 min-w-[160px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="m text-base font-semibold" style={{ color: t.accent }}>{c.name}</span>
                    <span className="text-sm font-semibold" style={{ color: dark ? '#6ee7b7' : '#059669' }}>{c.discountPercent}% off</span>
                    <StatusBadge status={c.status} active={c.active} recurring={tab === 'recurring'} />
                  </div>
                  <div className="text-[13px] mt-0.5" style={{ color: t.textMuted }}>
                    {tab === 'seasonal'
                      ? `${formatDate(c.startAt)} | ${formatDate(c.endAt)}`
                      : `Every ${c.dayOfWeek.charAt(0) + c.dayOfWeek.slice(1).toLowerCase()} · ${c.startTimeLocal}–${c.endTimeLocal}`
                    }
                    {c.maxDiscountPerOrder > 0 ? ` · Max: ${formatMoney(c.maxDiscountPerOrder)}` : ''}
                  </div>
                </div>
                {canManage && <>
                  <button onClick={() => { setEditing(c); setShowAdd(false); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textMuted }}>Edit</button>
                  {tab === 'seasonal' ? (
                    <>
                      {['DRAFT', 'SCHEDULED', 'PAUSED', 'ENDED'].includes(c.status) && <button onClick={() => doAction('activate', c.id, 'platform')} className="adm-btn-sm" style={{ borderColor: 'rgba(16,185,129,.28)', color: '#10b981' }}>Activate</button>}
                      {c.status === 'ACTIVE' && <button onClick={() => doAction('pause', c.id, 'platform')} className="adm-btn-sm" style={{ borderColor: 'rgba(224,164,88,.28)', color: '#e0a458' }}>Pause</button>}
                      <button onClick={() => setDeleting({ id: c.id, type: 'platform' })} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626" }}>Delete</button>
                    </>
                  ) : (
                    <>
                      {!c.active && <button onClick={() => doAction('activate', c.id, 'recurring')} className="adm-btn-sm" style={{ borderColor: 'rgba(16,185,129,.28)', color: '#10b981' }}>Activate</button>}
                      {c.active && <button onClick={() => doAction('pause', c.id, 'recurring')} className="adm-btn-sm" style={{ borderColor: 'rgba(224,164,88,.28)', color: '#e0a458' }}>Pause</button>}
                      <button onClick={() => setDeleting({ id: c.id, type: 'recurring' })} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626" }}>Delete</button>
                    </>
                  )}
                </>}
              </div>
            )}
          </div>
        )) : !showAdd ? (
          <div className="py-[60px] px-5 text-center">
            <p className="text-sm mb-1" style={{ color: t.textMuted }}>No {tab} promotions yet</p>
            {canManage && <p className="text-xs" style={{ color: t.textMuted }}>Click "+ New" to create one</p>}
          </div>
        ) : null}
      </div>

      {deleting && <DeleteModal dark={dark} t={t} onDelete={() => { doAction('delete', deleting.id, deleting.type); setDeleting(null); }} onCancel={() => setDeleting(null)} />}
    </>
  );
}
