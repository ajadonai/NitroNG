'use client';
import { useState, useEffect } from 'react';
import { SegPill } from './seg-pill';
import { FilterDropdown } from './date-range-picker';
import { SkelFacts, SkelList, SkelBar } from './skeleton';
import { useToast } from './toast';
import { useConfirm } from './confirm-dialog';
import InlineAlert from "./inline-alert";

const TZ = 'Africa/Lagos';

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
const EMAIL_THEMES = [['', 'Default'], ['christmas', 'Christmas'], ['newyear', 'New Year'], ['valentine', 'Valentine'], ['independence', 'Independence'], ['eid', 'Eid'], ['easter', 'Easter'], ['sallah', 'Sallah'], ['blackfriday', 'Black Friday']];

const dayWord = (d) => d ? d.charAt(0) + d.slice(1).toLowerCase() : '';
const lagos = (d) => { const dt = new Date(d); return { day: dt.toLocaleDateString('en-US', { timeZone: TZ, day: 'numeric' }), mon: dt.toLocaleDateString('en-US', { timeZone: TZ, month: 'short' }), year: dt.toLocaleDateString('en-US', { timeZone: TZ, year: 'numeric' }) }; };
const thisYear = () => Number(new Date().toLocaleDateString('en-US', { timeZone: TZ, year: 'numeric' }));
// "14 – 17 Sep" · "30 Sep – 3 Oct" · "30 Apr – 2 May 2027" — Lagos time, year only when it is not this one.
const fmtRange = (s, e) => {
  if (!s || !e) return '—';
  const a = lagos(s), b = lagos(e);
  const yr = Number(b.year) !== thisYear() ? ` ${b.year}` : '';
  if (a.year === b.year && a.mon === b.mon) return a.day === b.day ? `${a.day} ${a.mon}${yr}` : `${a.day} – ${b.day} ${a.mon}${yr}`;
  return `${a.day} ${a.mon} – ${b.day} ${b.mon}${yr}`;
};
const fmtDay = (d) => { const p = lagos(d); return `${p.day} ${p.mon}${Number(p.year) !== thisYear() ? ` ${p.year}` : ''}`; };
const naira = (kobo) => `₦${(kobo / 100).toLocaleString()}`;

const SEASONAL_STATE = { DRAFT: ['Draft', 'dim'], SCHEDULED: ['Scheduled', 'warn'], ACTIVE: ['Live', 'ok'], PAUSED: ['Paused', 'dim'], ENDED: ['Ended', 'dim'] };
const stateOf = (c, recurring) => recurring ? (c.active ? ['Live', 'ok'] : ['Paused', 'dim']) : (SEASONAL_STATE[c.status] || SEASONAL_STATE.DRAFT);

// A recurring campaign is running right now if it is on and today, in Lagos, is its day inside its hours.
const recurringLiveNow = (c) => {
  if (!c.active) return false;
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long' }).toUpperCase();
  const hm = now.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  return day === c.dayOfWeek && hm >= (c.startTimeLocal || '00:00') && hm <= (c.endTimeLocal || '23:59');
};

function PromotionForm({ dark, type, initial, onSave, onCancel }) {
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
    <div className="pro-form">
      {error && <InlineAlert type="error" dark={dark} onDismiss={() => setError("")} className="mb-3.5">{error}</InlineAlert>}

      <div className="pro-grid c3">
        <label className="pro-fld"><span>Name</span><input className="pro-in" value={form.name} onChange={e => set('name', e.target.value)} placeholder={isRecurring ? 'Nitro Tuesday' : 'Summer sale'} /></label>
        <label className="pro-fld"><span>Discount %</span><input className="pro-in m" type="number" min="1" max="100" value={form.discountPercent} onChange={e => set('discountPercent', e.target.value)} placeholder="10" /></label>
        <label className="pro-fld"><span>Max per order (₦)</span><input className="pro-in m" type="number" value={form.maxDiscountPerOrder} onChange={e => set('maxDiscountPerOrder', e.target.value)} placeholder="No limit" /></label>
      </div>

      {isRecurring ? (
        <>
          <div className="pro-grid c3">
            <label className="pro-fld"><span>Day</span>
              <select className="pro-in" value={form.dayOfWeek} onChange={e => set('dayOfWeek', e.target.value)}>
                {DAYS.map(d => <option key={d} value={d}>{dayWord(d)}</option>)}
              </select>
            </label>
            <label className="pro-fld"><span>Starts</span><input className="pro-in m" type="time" value={form.startTimeLocal} onChange={e => set('startTimeLocal', e.target.value)} /></label>
            <label className="pro-fld"><span>Ends</span><input className="pro-in m" type="time" value={form.endTimeLocal} onChange={e => set('endTimeLocal', e.target.value)} /></label>
          </div>
          <div className="pro-grid c2">
            <label className="pro-fld"><span>Runs from</span><input className="pro-in m" type="date" value={form.effectiveFrom?.split('T')[0] || ''} onChange={e => set('effectiveFrom', e.target.value)} /></label>
            <label className="pro-fld"><span>Runs until</span><input className="pro-in m" type="date" value={form.effectiveUntil?.split('T')[0] || ''} onChange={e => set('effectiveUntil', e.target.value)} /></label>
          </div>
        </>
      ) : (
        <>
          <div className="pro-grid c4">
            <label className="pro-fld"><span>Start date</span><input className="pro-in m" type="date" value={startDate} onChange={e => set('startDate', e.target.value)} /></label>
            <label className="pro-fld"><span>Start time</span><input className="pro-in m" type="time" value={startTime} onChange={e => set('startTime', e.target.value)} /></label>
            <label className="pro-fld"><span>End date</span><input className="pro-in m" type="date" value={endDate} onChange={e => set('endDate', e.target.value)} /></label>
            <label className="pro-fld"><span>End time</span><input className="pro-in m" type="time" value={endTime} onChange={e => set('endTime', e.target.value)} /></label>
          </div>
          <div className="pro-grid c3">
            <label className="pro-fld"><span>Priority</span><input className="pro-in m" type="number" value={form.priority} onChange={e => set('priority', e.target.value)} placeholder="Higher wins when two overlap" /></label>
          </div>
          <div className="pro-fld">
            <span>Email theme</span>
            <div className="pro-chips">
              {EMAIL_THEMES.map(([id, label]) => (
                <button key={id} type="button" onClick={() => set('emailTheme', id)} className={'pro-tg' + (form.emailTheme === id ? ' on' : '')}>{label}</button>
              ))}
            </div>
          </div>
        </>
      )}

      <label className="pro-fld"><span>Banner copy</span><input className="pro-in" value={form.bannerCopy} onChange={e => set('bannerCopy', e.target.value)} placeholder={isRecurring ? 'Save 10% every Tuesday on all services' : 'Summer sale: 15% off everything this week'} /></label>

      <div className="pro-fld">
        <span>Banner colour</span>
        <div className="pro-chips">
          {BANNER_COLORS.map(c => (
            <button key={c.hex} type="button" onClick={() => set('bannerColor', form.bannerColor === c.hex ? '' : c.hex)} className="pro-sw" style={{ background: c.hex, boxShadow: form.bannerColor === c.hex ? `0 0 0 2px var(--card), 0 0 0 4px ${c.hex}` : 'none' }} title={c.label} />
          ))}
          {form.bannerColor && !BANNER_COLORS.some(c => c.hex === form.bannerColor) && (
            <span className="pro-sw" style={{ background: form.bannerColor, boxShadow: `0 0 0 2px var(--card), 0 0 0 4px ${form.bannerColor}` }} />
          )}
          {form.bannerColor && <span className="pro-hex m">{form.bannerColor}</span>}
        </div>
      </div>

      {form.bannerCopy && (
        <div className="pro-fld">
          <span>Preview</span>
          <div className="pro-prev" style={{ background: form.bannerColor ? `${form.bannerColor}22` : (dark ? 'rgba(16,185,129,.12)' : 'rgba(16,185,129,.08)'), border: `1px solid ${form.bannerColor || '#10b981'}44` }}>
            <span className="pro-pdot" style={{ background: form.bannerColor || '#10b981' }} />
            <span className="pro-ptxt">{form.bannerCopy}</span>
            <span className="pro-ppct m" style={{ background: form.bannerColor || '#10b981' }}>{form.discountPercent || '?'}% OFF</span>
          </div>
        </div>
      )}

      <label className="pro-fld"><span>Internal notes</span><input className="pro-in" value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Optional, only admins see this" /></label>

      <div className="pro-ff">
        <button type="button" className="pro-b" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="pro-b pri" onClick={submit} disabled={saving}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Create promotion'}</button>
      </div>
    </div>
  );
}

export default function AdminPromotionsPage({ dark, t }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [seasonalList, setSeasonalList] = useState([]);
  const [recurringList, setRecurringList] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [tab, setTab] = useState('seasonal');
  const [period, setPeriod] = useState('year');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/promotions').then(r => r.json()).then(d => {
      setSeasonalList(d.seasonal || []);
      setRecurringList(d.recurring || []);
      setCanManage(d.canManage);
      setLoading(false);
    }).catch(() => { toast.error('Could not load promotions'); setLoading(false); });
  };
  useEffect(load, []);

  const doAction = async (action, id, promotionType, extra = {}) => {
    if (busy) return;
    setBusy(id + action);
    try {
      const res = await fetch('/api/admin/promotions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id, promotionType, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) toast.error('Action failed', data.error || 'Something went wrong');
    } catch { toast.error('Request failed', 'Check your connection'); }
    finally { setBusy(null); }
    load();
  };

  const askDelete = async (c, promotionType) => {
    const ok = await confirm({ title: `Delete ${c.name}?`, message: 'If orders have used it, it is ended instead. Otherwise it is deleted for good.', confirmLabel: 'Delete', danger: true });
    if (ok) doAction('delete', c.id, promotionType);
  };

  const isRecurring = tab === 'recurring';
  const type = isRecurring ? 'recurring' : 'platform';

  // Facts
  const now = Date.now();
  const year = thisYear();
  const yearStart = new Date(`${year}-01-01T00:00:00+01:00`).getTime();
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00+01:00`).getTime();
  const inYear = (c) => new Date(c.startAt).getTime() < yearEnd && new Date(c.endAt).getTime() >= yearStart;
  const byStart = (a, b) => new Date(a.startAt) - new Date(b.startAt);
  const liveNames = [...seasonalList.filter(c => c.status === 'ACTIVE').map(c => c.name), ...recurringList.filter(recurringLiveNow).map(c => c.name)];
  const nextUp = seasonalList.filter(c => c.status !== 'ENDED' && new Date(c.startAt).getTime() > now).sort(byStart)[0] || null;
  const nextWord = nextUp ? (nextUp.status === 'DRAFT' ? 'still a draft' : nextUp.status === 'PAUSED' ? 'paused' : 'switches on by itself') : '';
  const planned = seasonalList.filter(c => c.status !== 'ENDED' && new Date(c.endAt).getTime() >= now && inYear(c));
  const plannedOn = planned.filter(c => c.status !== 'DRAFT').length;
  const rec = recurringList.find(c => c.active) || recurringList[0] || null;

  const seasonalShown = (period === 'year' ? seasonalList.filter(inYear) : [...seasonalList]).sort(byStart);
  const rows = isRecurring ? recurringList : seasonalShown;

  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--ok": dark ? "#6ee7b7" : "#0a7d54", "--warn": dark ? "#fcd34d" : "#b45309",
  };

  const formFor = (initial, onDone) => <PromotionForm key={initial ? initial.id : 'new'} dark={dark} type={isRecurring ? 'recurring' : 'seasonal'} initial={initial} onSave={() => { onDone(); load(); }} onCancel={onDone} />;

  return (
    <div className="pro" style={vars}>
      <style>{PRO_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Promotions</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Discounts that switch themselves on and off.</div>
          </div>
          <SegPill value={tab} options={[{ value: 'seasonal', label: 'Seasonal' }, { value: 'recurring', label: `Recurring · ${recurringList.length}` }]} onChange={v => { setTab(v); setShowAdd(false); setEditing(null); }} dark={dark} t={t} />
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {loading ? <><SkelFacts dark={dark} /><SkelBar dark={dark} search={false} pills={1} right /><SkelList dark={dark} rows={5} title avatar="square" rowH={62} /></> : <>
        <div className="pro-stats">
          <div className={'pro-stt' + (liveNames.length ? ' ok' : '')}><b className="m">{liveNames.length}</b><span>Live now</span><i>{liveNames.length ? liveNames.join(', ') : 'nothing running'}</i></div>
          <div className={'pro-stt' + (nextUp?.status === 'DRAFT' ? ' warn' : '')}><b>{nextUp ? nextUp.name : '—'}</b><span>Next up</span><i>{nextUp ? `${fmtDay(nextUp.startAt)} · ${nextUp.discountPercent}% off, ${nextWord}` : 'nothing planned'}</i></div>
          <div className="pro-stt"><b className="m">{planned.length}</b><span>Planned this year</span><i>{planned.length === 0 ? 'nothing on the calendar' : plannedOn === 0 ? 'all drafts, none activated' : `${plannedOn} of ${planned.length} activated`}</i></div>
          <div className="pro-stt"><b>{rec ? rec.name : '—'}</b><span>Recurring</span><i>{rec ? `${rec.discountPercent}% every ${dayWord(rec.dayOfWeek)} · ${rec.active ? 'live' : 'paused'}` : 'none set up'}</i></div>
        </div>

        {(!isRecurring || canManage) && <div className="pro-bar">
          {!isRecurring && <FilterDropdown dark={dark} t={t} value={period} onChange={setPeriod} options={[{ value: 'year', label: 'This year' }, { value: 'all', label: 'All' }]} />}
          {canManage && <button type="button" className="pro-b pri" style={{ marginLeft: 'auto' }} onClick={() => { setShowAdd(v => !v); setEditing(null); }}>{showAdd ? 'Cancel' : '+ New promotion'}</button>}
        </div>}

        {showAdd && <section className="pro-card">
          <header><h3>New {isRecurring ? 'recurring' : 'seasonal'} promotion</h3><span className="pro-cnt">{isRecurring ? 'runs every week on the day you pick' : 'saved as a draft until you activate it'}</span></header>
          {formFor(null, () => setShowAdd(false))}
        </section>}

        <section className="pro-card">
          <header><h3>{isRecurring ? 'Recurring' : 'Seasonal'}</h3><span className="pro-cnt">{isRecurring ? 'a paused campaign never runs until you activate it' : 'in date order · a draft never runs until you activate it'}</span></header>
          <div className="pro-list">
            {rows.length === 0 ? <div className="pro-empty">{isRecurring ? 'No recurring promotions yet.' : period === 'year' && seasonalList.length ? 'Nothing planned this year. Switch to All to see the rest.' : 'No seasonal promotions yet.'}</div> : rows.map(c => {
              if (editing?.id === c.id) return <div key={c.id} className="pro-edit">{formFor(editing, () => setEditing(null))}</div>;
              const [word, dot] = stateOf(c, isRecurring);
              const canActivate = isRecurring ? !c.active : ['DRAFT', 'SCHEDULED', 'PAUSED', 'ENDED'].includes(c.status);
              const canPause = isRecurring ? c.active : c.status === 'ACTIVE';
              return (
                <div key={c.id} className="pro-r">
                  <span className="pro-pct m">{c.discountPercent}% off</span>
                  <span className="pro-tt"><b>{c.name}</b><i>{isRecurring ? `Every ${dayWord(c.dayOfWeek)} · ${c.startTimeLocal}–${c.endTimeLocal}` : `${fmtRange(c.startAt, c.endAt)} · Lagos time`}{c.maxDiscountPerOrder > 0 ? ` · max ${naira(c.maxDiscountPerOrder)}` : ''}</i></span>
                  <span className="pro-st"><i className={'pro-dot ' + dot} />{word}</span>
                  {canManage && <span className="pro-a">
                    <button type="button" className="pro-b sm" disabled={!!busy} onClick={() => { setEditing(c); setShowAdd(false); }}>Edit</button>
                    {canActivate && <button type="button" className="pro-b sm pri" disabled={!!busy} onClick={() => doAction('activate', c.id, type)}>{busy === c.id + 'activate' ? '…' : 'Activate'}</button>}
                    {canPause && <button type="button" className="pro-b sm" disabled={!!busy} onClick={() => doAction('pause', c.id, type)}>{busy === c.id + 'pause' ? '…' : 'Pause'}</button>}
                    <button type="button" className="pro-b sm" disabled={!!busy} onClick={() => askDelete(c, type)}>Delete</button>
                  </span>}
                </div>
              );
            })}
          </div>
        </section>
      </>}
    </div>
  );
}

const PRO_CSS = `
.pro{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.pro *{box-sizing:border-box}
.pro .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.pro-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;transition:transform .15s}.pro-b:hover{transform:translateY(-1px)}.pro-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
.pro-b.sm{height:30px;padding:0 10px;font-size:12px}.pro-b.pri{background:var(--ac);color:#fff;border-color:var(--ac)}
.pro-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.pro-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.pro-stt:first-child{border-left:0}
.pro-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pro-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap}.pro-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pro-stt.ok b{color:var(--ok)}.pro-stt.warn b{color:var(--warn)}
.pro-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pro-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.pro-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.pro-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.pro-cnt{font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pro-list{display:flex;flex-direction:column}.pro-empty{padding:28px 16px;text-align:center;font-size:13px;color:var(--mut)}
.pro-r{display:grid;grid-template-columns:72px 1fr 100px auto;align-items:center;gap:12px;padding:11px 16px;border-top:1px solid var(--rail);font-size:13px}.pro-r:first-child,.pro-edit:first-child{border-top:0}
.pro-pct{font-weight:800;font-size:14px;color:var(--ac);white-space:nowrap}
.pro-tt{display:flex;flex-direction:column;min-width:0}.pro-tt b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pro-tt i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pro-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--mut);white-space:nowrap}.pro-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}.pro-dot.ok{background:var(--ok)}.pro-dot.warn{background:var(--warn)}.pro-dot.dim{background:var(--dim)}
.pro-a{display:flex;gap:6px;justify-content:flex-end}
.pro-edit{border-top:1px solid var(--rail);background:var(--soft)}
.pro-form{padding:14px 16px 16px;display:flex;flex-direction:column;gap:12px}
.pro-grid{display:grid;gap:12px}.pro-grid.c2{grid-template-columns:1fr 1fr}.pro-grid.c3{grid-template-columns:1fr 1fr 1fr}.pro-grid.c4{grid-template-columns:repeat(4,1fr)}
.pro-fld{display:flex;flex-direction:column;gap:5px;min-width:0}.pro-fld>span:first-child{font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}
.pro-in{width:100%;height:34px;padding:0 10px;border-radius:9px;border:1px solid var(--line);background:var(--card);font:inherit;font-size:13px;color:var(--ink);outline:none;min-width:0}.pro-in:focus{border-color:var(--ac)}.pro-in::placeholder{color:var(--dim)}
select.pro-in{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:26px;cursor:pointer}
.pro-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pro-tg{font:inherit;font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);cursor:pointer}.pro-tg.on{background:var(--ink);color:var(--card);border-color:var(--ink)}
.pro-sw{width:28px;height:28px;border-radius:8px;border:0;padding:0;cursor:pointer;display:inline-block}.pro-hex{font-size:12px;color:var(--mut);margin-left:4px}
.pro-prev{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px}.pro-pdot{width:8px;height:8px;border-radius:50%;flex-shrink:0}.pro-ptxt{flex:1;font-size:13.5px;font-weight:500;color:var(--ink)}.pro-ppct{padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700;color:#fff;flex-shrink:0}
.pro-ff{display:flex;justify-content:flex-end;gap:8px;margin-top:2px}
@media (max-width:900px){
  .pro-stats{grid-template-columns:1fr 1fr}.pro-stt:nth-child(3){border-left:0}.pro-stt:nth-child(n+3){border-top:1px solid var(--line)}.pro-stt b{font-size:17px}
  .pro-bar .pro-b.pri{width:100%;margin-left:0!important}
  .pro-r{grid-template-columns:72px 1fr;grid-template-areas:"pct tt" "pct st" "acts acts";gap:4px 10px;padding:12px 14px}.pro-pct{grid-area:pct;align-self:start}.pro-tt{grid-area:tt}.pro-tt b,.pro-tt i{white-space:normal}.pro-st{grid-area:st}.pro-a{grid-area:acts;justify-content:stretch;margin-top:4px}.pro-a .pro-b{flex:1;height:36px}
  .pro-grid.c2,.pro-grid.c3,.pro-grid.c4{grid-template-columns:1fr 1fr}
  .pro-ff{flex-direction:column-reverse}.pro-ff .pro-b{width:100%}
}
`;
