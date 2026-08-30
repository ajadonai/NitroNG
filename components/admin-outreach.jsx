'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { DateRangePicker, FilterDropdown } from './date-range-picker';
import { SegPill } from './seg-pill';
import { SkelFacts, SkelList, SkelBar } from './skeleton';
import { useToast } from './toast';
import { useConfirm } from './confirm-dialog';

const TOUCH_LABELS = { day1: 'Day 1', day3: 'Day 3', day7: 'Day 7', winback: 'Win-back', backlog: 'Backlog', firstDeposit: 'First deposit', firstOrder: 'First order' };
const TOUCH_ORDER = ['day1', 'day3', 'day7', 'winback', 'backlog', 'firstDeposit', 'firstOrder'];
const METHOD_LABELS = { call: 'Call', pending: 'No answer', whatsapp: 'WhatsApp', callback: 'Call back', unreachable: 'Unreachable', not_in_service: 'Not in service', wrong_number: 'Wrong number', dnc: 'DNC', expired: 'Expired', legacy: 'Legacy' };

const fN = (kobo) => `₦${Math.round(kobo / 100).toLocaleString()}`;
const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function AdminOutreachPage({ dark, t }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('overview');
  // The whole outreach machine hangs on one setting; flipping it here answers
  // every outreach cron with { paused: true } until it is flipped back.
  const [paused, setPaused] = useState(null);
  useEffect(() => { fetch('/api/admin/settings').then(r => r.ok ? r.json() : null).then(d => setPaused(d?.settings?.outreach_paused === 'true')).catch(() => setPaused(false)); }, []);
  const togglePause = async () => {
    const next = !paused;
    const ok = next || await confirm({ title: 'Resume outreach?', message: 'Lists start posting again on the next weekday run.', confirmText: 'Resume', danger: false });
    if (!ok) return;
    setPaused(next);
    const res = await fetch('/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { outreach_paused: String(next) } }) }).catch(() => null);
    if (!res?.ok) { setPaused(!next); toast.error(next ? 'Could not pause outreach' : 'Could not resume outreach'); }
  };
  const [dateRange, setDateRange] = useState(null);
  const [staffFilter, setStaffFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dncPage, setDncPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const prevFiltersRef = useRef(null);

  const load = useCallback(async () => {
    const filterKey = `${dateRange?.start || ''}-${dateRange?.end || ''}-${staffFilter}-${tab}`;
    const filtersChanged = prevFiltersRef.current !== filterKey;
    prevFiltersRef.current = filterKey;

    if (!data) setLoading(true);
    else setFetching(true);

    try {
      const params = new URLSearchParams();
      if (dateRange?.start) params.set('from', localDate(dateRange.start));
      if (dateRange?.end) params.set('to', localDate(dateRange.end));
      if (!dateRange) params.set('period', 'all');
      if (staffFilter) params.set('staff', staffFilter);
      params.set('page', String(page));
      if (!filtersChanged && data) params.set('skipStats', '1');
      if (tab === 'dnc') { params.set('tab', 'dnc'); params.set('dncPage', String(dncPage)); }
      const res = await fetch(`/api/admin/outreach-stats?${params}`);
      if (res.ok) {
        const d = await res.json();
        if (d.stats) setData(d);
        else setData(prev => prev ? { ...prev, rows: d.rows, page: d.page, totalPages: d.totalPages, totalContacts: d.totalContacts, dnc: d.dnc, dncCount: d.dncCount, dncTotalPages: d.dncTotalPages } : d);
      }
    } catch {} finally { setLoading(false); setFetching(false); }
  }, [dateRange, staffFilter, tab, page, dncPage]);

  useEffect(() => { load(); }, [load]);

  const undnc = async (userId) => {
    try {
      const res = await fetch('/api/admin/outreach-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'undnc', userId }),
      });
      if (res.ok) { toast.success('Allowed again', 'They can be contacted on the next run'); load(); }
      else toast.error('Could not allow again');
    } catch { toast.error('Could not allow again'); }
  };

  const s = data?.stats || {};
  const handed = s.contacts || 0;
  const expired = s.byMethod?.expired || 0;
  const worked = Math.max(0, handed - expired);
  const workedPct = handed > 0 ? Math.round((worked / handed) * 100) : 0;
  const callbacks = s.byMethod?.callback || 0;
  const touchLine = TOUCH_ORDER.filter(k => s.byTouch?.[k]).map(k => `${TOUCH_LABELS[k].toLowerCase()} · ${s.byTouch[k].toLocaleString()}`).join(', ');

  const dncLabel = (data?.dncCount > 0) ? `Do not call · ${data.dncCount}` : 'Do not call';

  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--ok": dark ? "#6ee7b7" : "#0a7d54", "--warn": dark ? "#fcd34d" : "#b45309", "--warnbg": dark ? "rgba(251,191,36,.1)" : "rgba(217,119,6,.08)", "--blue": dark ? "#a5b4fc" : "#4c62c4",
  };

  return (
    <div className="ou" style={vars}>
      <style>{OU_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Outreach</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Call-first follow-up for people who signed up and never paid.</div>
          </div>
          <div className="ou-hr">
            {paused === false && <button type="button" className="ou-b" onClick={togglePause}>Pause</button>}
            <SegPill value={tab} options={[{ value: 'overview', label: 'Overview' }, { value: 'dnc', label: dncLabel }]} onChange={v => { setTab(v); setPage(1); setDncPage(1); }} dark={dark} t={t} />
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {paused && (
        <div className="ou-paused">
          <span className="ou-dot warn" />
          <span><b>Paused.</b> No lists, callbacks or reminders go out until you resume.</span>
          <button type="button" className="ou-b sm pri" onClick={togglePause}>Resume</button>
        </div>
      )}

      {loading ? <><SkelFacts dark={dark} /><SkelBar dark={dark} search={false} pills={2} /><SkelList dark={dark} rows={6} title rowH={60} /></> : tab === 'dnc' ? (
        !data?.dnc ? <SkelList dark={dark} rows={6} title rowH={60} /> : (
          <section className="ou-card" style={{ opacity: fetching ? .55 : 1 }}>
            <header><h3>Do not call</h3><span className="ou-cnt">asked not to be contacted · Allow again puts them back on the lists</span></header>
            <div className="ou-list">
              {data.dnc.length === 0 ? <div className="ou-empty">No one has asked not to be called.</div> : data.dnc.map(u => (
                <div key={u.id} className="ou-r dn">
                  <span className="ou-av">{initials(u.name)}</span>
                  <span className="ou-tt"><b>{u.name || '(no name)'}</b><i className="m">{u.phone || '—'}</i></span>
                  <span className="ou-mid">opted out {fmtDate(u.since)}</span>
                  <span className="ou-acts"><button type="button" className="ou-b sm" onClick={() => undnc(u.id)}>Allow again</button></span>
                </div>
              ))}
            </div>
            <Pager page={dncPage} totalPages={data.dncTotalPages || 1} total={data.dncCount || 0} setPage={setDncPage} />
          </section>
        )
      ) : <>
        <div className="ou-stats">
          <div className="ou-stt"><b className="m">{handed.toLocaleString()}</b><span>Handed out</span><i>{touchLine || 'nothing in this period'}</i></div>
          <div className={"ou-stt" + (expired > 0 ? " warn" : "")}><b className="m">{worked.toLocaleString()}</b><span>Worked</span><i>{handed ? (expired > 0 ? `${workedPct}% · the rest expired untouched` : 'every contact was worked') : 'nothing to work'}</i></div>
          <div className="ou-stt"><b className="m">{(s.converted || 0).toLocaleString()}</b><span>Converted</span><i>{s.deposits > 0 ? `${fN(s.deposits)} deposited after a call` : 'nothing deposited after a call'}</i></div>
          <div className="ou-stt"><b className="m">{callbacks.toLocaleString()}</b><span>Callbacks due</span><i>{callbacks ? 'marked call back in this period' : 'nothing waiting'}</i></div>
        </div>

        <div className="ou-bar">
          <DateRangePicker dark={dark} t={t} value={dateRange} onChange={v => { setDateRange(v); setPage(1); }} defaultPreset="7 days" />
          {(data?.staffList || []).length > 0 && (
            <FilterDropdown dark={dark} t={t} value={staffFilter} onChange={v => { setStaffFilter(v); setPage(1); }} options={[
              { value: '', label: 'All staff' },
              ...data.staffList.map(st => ({ value: st.id, label: st.name })),
            ]} />
          )}
          <span className="ou-cnt ou-tot">{(data?.totalContacts || 0).toLocaleString()} contacts</span>
        </div>

        <section className="ou-card" style={{ opacity: fetching ? .55 : 1 }}>
          <header><h3>Recent contacts</h3><span className="ou-cnt">tap a row for the full card</span></header>
          <div className="ou-list">
            {(data?.rows || []).length === 0 ? <div className="ou-empty">No contacts in this period.</div> : data.rows.map(r => {
              const paid = r.deposits > 0;
              return (
                <div key={r.id} className="ou-r oc" role="button" tabIndex={0} onClick={() => setDrawer(r)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDrawer(r); } }}>
                  <span className={"ou-av" + (paid ? " paid" : "")}>{initials(r.userName)}</span>
                  <span className="ou-tt"><b>{r.userName || '(no name)'}</b><i>{r.userEmail || r.userPhone || '—'}</i></span>
                  <span className="ou-chips">
                    <span className="ou-ty">{TOUCH_LABELS[r.touchType] || r.touchType || '—'}</span>
                    <span className="ou-ty">{METHOD_LABELS[r.method] || r.method || '—'}</span>
                  </span>
                  <span className={"m ou-num" + (paid ? " ok" : "")}>{paid ? fN(r.deposits) : '—'}</span>
                  <span className="ou-mid">{fmtDateTime(r.contactedAt)}</span>
                </div>
              );
            })}
          </div>
          <Pager page={page} totalPages={data?.totalPages || 1} total={data?.totalContacts || 0} setPage={setPage} />
        </section>
      </>}

      {drawer && <ContactDrawer t={t} row={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

/* ── Contact drawer ──────────────────────────────── */

function ContactDrawer({ t, row, onClose }) {
  const phone = row.userPhone?.replace('+', '') || '';
  const paid = row.deposits > 0;
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div className="ou-bd" onClick={onClose}>
      <aside className="ou-dw" role="dialog" aria-modal="true" aria-label={`${row.userName}'s contact card`} onClick={e => e.stopPropagation()}>
        <div className="ou-dh">
          <span className={"ou-av lg" + (paid ? " paid" : "")}>{initials(row.userName)}</span>
          <div className="ou-dht">
            <b>{row.userName}</b>
            {row.userEmail && <i>{row.userEmail}</i>}
            {row.userPhone && <i className="m">{row.userPhone}</i>}
          </div>
          <button type="button" className="ou-b sm" onClick={onClose}>Close</button>
        </div>
        <div className="ou-body">
          <div className="ou-dg">
            <div className="ou-dc"><span>Deposited</span><b className={"m" + (paid ? " ok" : "")}>{paid ? fN(row.deposits) : '—'}</b></div>
            <div className="ou-dc"><span>Balance</span><b className={"m" + (row.balance > 0 ? " ok" : "")}>{row.balance > 0 ? fN(row.balance) : '—'}</b></div>
            <div className="ou-dc"><span>Orders</span><b className="m">{row.orders || 0}</b></div>
            <div className="ou-dc"><span>Revenue</span><b className={"m" + (row.revenue > 0 ? " ok" : "")}>{row.revenue > 0 ? fN(row.revenue) : '—'}</b></div>
            <div className="ou-dc"><span>Touch</span><em><span className="ou-ty">{TOUCH_LABELS[row.touchType] || row.touchType || '—'}</span></em></div>
            <div className="ou-dc"><span>Method</span><em><span className="ou-ty">{METHOD_LABELS[row.method] || row.method || '—'}</span></em></div>
            {row.callbackAt && (
              <div className="ou-dc"><span>Call back due</span><b className="m sm warn">{fmtDateTime(row.callbackAt)}{row.callbackAttempts > 0 ? ` · try ${row.callbackAttempts + 1}` : ''}</b></div>
            )}
            <div className="ou-dc"><span>Contacted by</span><b className="sm">{row.contactedBy || '—'}</b></div>
            <div className="ou-dc"><span>Date</span><b className="m sm">{fmtDateTime(row.contactedAt)}</b></div>
          </div>
          <div className="ou-da">
            {phone && <a className="ou-b wa" href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
            {row.userId && <a className="ou-b" href={`/admin?page=users&user=${row.userId}`} style={{ color: t.text }}>View profile</a>}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ── Paging ───────────────────────────────────────── */

function Pager({ page, totalPages, total, setPage }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * 15 + 1;
  const end = Math.min(page * 15, total);
  return (
    <div className="ou-pg">
      <span className="ou-cnt">{start}–{end} of {total.toLocaleString()}</span>
      <span className="ou-pgn">
        <button type="button" className="ou-ib" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))} aria-label="Previous page">‹</button>
        <span className="ou-cnt">{page} of {totalPages}</span>
        <button type="button" className="ou-ib" disabled={page >= totalPages} onClick={() => setPage(Math.min(totalPages, page + 1))} aria-label="Next page">›</button>
      </span>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────── */

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}

const OU_CSS = `
.ou{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.ou *{box-sizing:border-box}
.ou .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.ou-hr{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ou-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;transition:transform .15s}.ou-b:hover{transform:translateY(-1px)}.ou-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
.ou-b.sm{height:30px;padding:0 10px;font-size:12px}.ou-b.pri{background:var(--ac);color:#fff;border-color:var(--ac)}.ou-b.wa{background:#25d366;color:#fff;border-color:#25d366}
.ou-paused{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;background:var(--warnbg);border:1px solid var(--line);font-size:13px}.ou-paused b{font-weight:700}.ou-paused .ou-b{margin-left:auto}
.ou-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}.ou-dot.warn{background:var(--warn)}
.ou-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.ou-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.ou-stt:first-child{border-left:0}
.ou-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ou-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap}.ou-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ou-stt.warn b{color:var(--warn)}
.ou-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ou-tot{margin-left:auto}
.ou-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden;transition:opacity .15s}
.ou-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.ou-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.ou-cnt{font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ou-list{display:flex;flex-direction:column}.ou-empty{padding:28px 16px;text-align:center;font-size:13px;color:var(--mut)}
.ou-r{display:grid;align-items:center;gap:12px;padding:11px 16px;border-top:1px solid var(--rail);font-size:13px}.ou-r:first-child{border-top:0}
.ou-r.oc{grid-template-columns:36px 1fr 70px 90px 80px 110px;cursor:pointer}.ou-r.oc:hover{background:var(--soft)}.ou-r.oc:focus-visible{outline:2px solid var(--ac);outline-offset:-2px}
.ou-r.dn{grid-template-columns:36px 1fr 130px auto}
.ou-av{width:36px;height:36px;border-radius:50%;background:var(--soft);border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--mut);flex-shrink:0}.ou-av.paid{background:var(--ac);color:#fff;border:0}.ou-av.lg{width:44px;height:44px;font-size:14px}
.ou-tt{display:flex;flex-direction:column;min-width:0}.ou-tt b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ou-tt i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ou-ty{font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--mut);background:var(--soft);border:1px solid var(--line);padding:3px 8px;border-radius:999px;white-space:nowrap;justify-self:start}
.ou-chips{display:contents}
.ou-num{text-align:right;font-weight:700;color:var(--dim)}.ou-num.ok{color:var(--ok)}
.ou-mid{font-size:12px;color:var(--mut);white-space:nowrap}.ou-acts{display:flex;gap:6px;justify-content:flex-end}
.ou-pg{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-top:1px solid var(--line);background:var(--soft)}.ou-pgn{display:inline-flex;align-items:center;gap:6px}
.ou-ib{font:inherit;width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);display:inline-flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer}.ou-ib:disabled{opacity:.4;cursor:default}
.ou-bd{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.4)}
.ou-dw{position:absolute;top:0;right:0;bottom:0;width:420px;max-width:100%;background:var(--card);border-left:1px solid var(--line);display:flex;flex-direction:column;box-shadow:-12px 0 30px rgba(0,0,0,.2);color:var(--ink)}
.ou-dh{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)}.ou-dht{flex:1;display:flex;flex-direction:column;min-width:0}.ou-dht b{font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ou-dht i{font-style:normal;font-size:12px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ou-body{flex:1;overflow:auto;padding:16px 18px}
.ou-dg{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ou-dc{padding:10px 12px;border-radius:10px;background:var(--soft);border:1px solid var(--line);display:flex;flex-direction:column;gap:6px;min-width:0}
.ou-dc span{font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut)}.ou-dc b{font-size:18px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ou-dc b.sm{font-size:13px}.ou-dc b.ok{color:var(--ok)}.ou-dc b.warn{color:var(--warn)}.ou-dc em{font-style:normal;display:flex}.ou-dc em .ou-ty{font-size:10.5px;letter-spacing:.6px}
.ou-da{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
@media (max-width:900px){
  .ou-hr{width:100%}.ou-hr>*:last-child{flex:1}
  .ou-paused{flex-wrap:wrap}.ou-paused .ou-b{width:100%;margin:6px 0 0}
  .ou-stats{grid-template-columns:1fr 1fr}.ou-stt:nth-child(3){border-left:0}.ou-stt:nth-child(n+3){border-top:1px solid var(--line)}.ou-stt b{font-size:17px}
  .ou-tot{display:none}
  .ou-r.oc{grid-template-columns:36px 1fr auto;grid-template-areas:"av tt dep" "av chips at";gap:6px 10px;padding:12px 14px}
  .ou-r.oc .ou-av{grid-area:av;align-self:start}.ou-r.oc .ou-tt{grid-area:tt}.ou-r.oc .ou-num{grid-area:dep}.ou-r.oc .ou-mid{grid-area:at;justify-self:end;font-size:11px}
  .ou-r.oc .ou-chips{grid-area:chips;display:flex;gap:6px;flex-wrap:wrap}
  .ou-r.dn{grid-template-columns:36px 1fr;grid-template-areas:"av tt" "av mid" "acts acts";gap:4px 10px;padding:12px 14px}
  .ou-r.dn .ou-av{grid-area:av;align-self:start}.ou-r.dn .ou-tt{grid-area:tt}.ou-r.dn .ou-mid{grid-area:mid}.ou-r.dn .ou-acts{grid-area:acts;justify-content:stretch;margin-top:4px}.ou-r.dn .ou-acts .ou-b{flex:1;height:36px}
  .ou-dw{width:100%;top:8vh;border-left:0;border-top:1px solid var(--line);border-radius:16px 16px 0 0}
}
`;
