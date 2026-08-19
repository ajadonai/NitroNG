'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { DateRangePicker, FilterDropdown } from './date-range-picker';
import { SegPill } from './seg-pill';

const TOUCH_LABELS = { day1: 'First Call', day3: 'Follow-up', day7: 'Final Nudge', winback: 'Winback', backlog: 'Backlog', firstDeposit: 'First Deposit', firstOrder: 'First Order' };
const METHOD_LABELS = { call: 'Called', pending: 'No answer', whatsapp: 'WhatsApp', callback: 'Call back', unreachable: 'Switched off', not_in_service: 'Not in service', wrong_number: 'Wrong #', dnc: 'Do not contact', expired: 'Never worked', legacy: 'Legacy' };
const METHOD_COLORS = { call: '#4ade80', pending: '#facc15', whatsapp: '#60a5fa', callback: '#fb923c', unreachable: '#a78bfa', not_in_service: '#f87171', wrong_number: '#f87171', dnc: '#94a3b8', expired: '#64748b', legacy: '#a3a3a3' };

const fN = (kobo) => `₦${Math.round(kobo / 100).toLocaleString()}`;

function MethodBadge({ method }) {
  const label = METHOD_LABELS[method] || method || '—';
  const color = METHOD_COLORS[method] || '#a3a3a3';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: `${color}20`, color }}>
      {label}
    </span>
  );
}

function TouchBadge({ touch }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(196,125,142,.12)', color: '#c47d8e' }}>
      {TOUCH_LABELS[touch] || touch}
    </span>
  );
}

const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const RESPONSIVE_CSS = `
@media(max-width:639px){
  .otr-hide-mob{display:none!important}
  .otr-drawer{width:100vw!important}
  .otr-mob-sub{display:flex!important}
  .otr-table td,.otr-table th{padding:8px 10px!important;font-size:13px!important}
}
@media(max-width:767px){
  .otr-hide-md{display:none!important}
}
@media(max-width:1023px){
  .otr-hide-lg{display:none!important}
}
.otr-mob-sub{display:none}
.otr-row:active{background:rgba(196,125,142,.06)}
`;

export default function AdminOutreachPage({ dark, t }) {
  const [tab, setTab] = useState('overview');
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
      if (res.ok) load();
    } catch {}
  };

  const s = data?.stats || {};
  const p = data?.prev || {};
  const convRate = s.users > 0 ? Math.round((s.converted / s.users) * 100) : 0;
  const cardStyle = { background: dark ? 'rgba(255,255,255,.06)' : '#fff', border: `1px solid ${t?.cardBorder || (dark ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.18)')}` };

  const dncLabel = (data?.dncCount > 0) ? `DNC (${data.dncCount})` : 'DNC';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: RESPONSIVE_CSS }} />
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t?.text }}>Outreach</div>
            <div className="adm-subtitle" style={{ color: t?.textMuted }}>Call-first workflow performance and contacts</div>
          </div>
          <SegPill value={tab} options={[{ value: 'overview', label: 'Overview' }, { value: 'dnc', label: dncLabel }]} onChange={v => { setTab(v); setPage(1); setDncPage(1); }} dark={dark} t={t} />
        </div>
        <div className="page-divider" style={{ background: t?.cardBorder }} />
      </div>

      {tab === 'dnc' ? (
        <DncTab dark={dark} data={data} loading={loading} undnc={undnc} cardStyle={cardStyle} page={dncPage} setPage={setDncPage} />
      ) : (
        <OverviewTab dark={dark} t={t} data={data} loading={loading} fetching={fetching} s={s} p={p} convRate={convRate} cardStyle={cardStyle} page={page} setPage={setPage} setDrawer={setDrawer} dateRange={dateRange} setDateRange={v => { setDateRange(v); setPage(1); }} staffFilter={staffFilter} setStaffFilter={v => { setStaffFilter(v); setPage(1); }} />
      )}

      {drawer && <ContactDrawer dark={dark} t={t} row={drawer} onClose={() => setDrawer(null)} />}
    </>
  );
}

/* ── DNC Tab ─────────────────────────────────────── */

function DncTab({ dark, data, loading, undnc, cardStyle, page, setPage }) {
  if (loading && !data?.dnc) return <SkeletonRows dark={dark} />;
  const dnc = data?.dnc || [];
  if (!dnc.length) {
    return (
      <div className="rounded-xl overflow-hidden" style={cardStyle}>
        <EmptyState dark={dark} title="No one on the DNC list" subtitle="Users marked as do not contact in Telegram will appear here" />
      </div>
    );
  }
  return (
    <div className="rounded-xl overflow-hidden" style={cardStyle}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'}` }}>
              <Th>Name</Th>
              <Th>Phone</Th>
              <Th>Since</Th>
              <Th align="right" />
            </tr>
          </thead>
          <tbody>
            {dnc.map(u => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)'}` }}>
                <Td bold>{u.name || '(no name)'}</Td>
                <Td mono>{u.phone || '—'}</Td>
                <Td muted>{fmtDate(u.since)}</Td>
                <Td align="right">
                  <button onClick={() => undnc(u.id)} style={{
                    padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)', color: 'inherit', fontFamily: 'inherit',
                  }}>
                    Remove
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination dark={dark} page={page} totalPages={data?.dncTotalPages || 1} total={data?.dncCount || 0} setPage={setPage} />
    </div>
  );
}

/* ── Overview Tab ─────────────────────────────────── */

function OverviewTab({ dark, t, data, loading, fetching, s, p, convRate, cardStyle, page, setPage, setDrawer, dateRange, setDateRange, staffFilter, setStaffFilter }) {
  if (loading && !data) {
    return (
      <>
        <div className="adm-stats">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl py-3 px-4" style={cardStyle}>
              <div className={`skel-bone ${dark ? 'skel-dark' : 'skel-light'}`} style={{ width: 80, height: 12, borderRadius: 4, marginBottom: 10 }} />
              <div className={`skel-bone ${dark ? 'skel-dark' : 'skel-light'}`} style={{ width: 100, height: 24, borderRadius: 6 }} />
            </div>
          ))}
        </div>
        <SkeletonRows dark={dark} />
      </>
    );
  }

  const hoverBg = dark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)';
  const borderColor = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)';

  return (
    <>
      <div className="adm-stats">
        <StatCard dark={dark} t={t} label="Contacted" value={s.users || 0} prev={p.users} color={t?.blue || '#60a5fa'} cardStyle={cardStyle} />
        <StatCard dark={dark} t={t} label="Conversion" value={`${convRate}%`} sub={`${s.converted || 0} of ${s.users || 0} placed orders`} color={t?.green || '#4ade80'} cardStyle={cardStyle} />
        <StatCard dark={dark} t={t} label="Revenue" value={`₦${Math.round((s.revenue || 0) / 100).toLocaleString()}`} prev={p.revenue} color={t?.green || '#4ade80'} cardStyle={cardStyle} />
        <StatCard dark={dark} t={t} label="Deposits" value={`₦${Math.round((s.deposits || 0) / 100).toLocaleString()}`} prev={p.deposits} color={t?.accent || '#c47d8e'} cardStyle={cardStyle} />
      </div>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {(data?.staffList || []).length > 0 && (
          <FilterDropdown dark={dark} t={t} value={staffFilter} onChange={setStaffFilter} options={[
            { value: '', label: 'All staff' },
            ...data.staffList.map(s => ({ value: s.id, label: s.name })),
          ]} />
        )}
        <DateRangePicker dark={dark} t={t} value={dateRange} onChange={setDateRange} defaultPreset="7 days" />
      </div>

      <div className="rounded-xl overflow-hidden" style={cardStyle}>
        <div style={{
          padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
          background: dark ? 'rgba(196,125,142,.18)' : 'rgba(196,125,142,.12)',
          borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'}`,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', opacity: .7 }}>Recent Contacts</span>
          {s.byMethod && Object.keys(s.byMethod).length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(s.byMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <MethodBadge method={k} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, fontSize: 12, opacity: .7 }}>{v}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Column headers */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
          borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'}`,
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', opacity: .4,
        }}>
          <span style={{ flex: '1 1 0', minWidth: 0 }}>User</span>
          <span className="otr-hide-mob" style={{ width: 90, textAlign: 'right' }}>Deposited</span>
          <span className="otr-hide-mob" style={{ width: 80, textAlign: 'right' }}>Balance</span>
          <span className="otr-hide-md" style={{ width: 50, textAlign: 'right' }}>Orders</span>
          <span className="otr-hide-md" style={{ width: 70 }}>Touch</span>
          <span className="otr-hide-lg" style={{ width: 80 }}>Method</span>
          <span style={{ width: 70, textAlign: 'right' }}>Date</span>
        </div>

        <div style={{ opacity: fetching ? .5 : 1, transition: 'opacity .15s', pointerEvents: fetching ? 'none' : 'auto' }}>
          {(data?.rows || []).map(r => {
            const hasDeposit = r.deposits > 0;
            return (
              <div key={r.id} onClick={() => setDrawer(r)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer',
                borderBottom: `1px solid ${borderColor}`,
              }}
                onMouseEnter={e => e.currentTarget.style.background = hoverBg}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                {/* Avatar + name + email */}
                <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: hasDeposit ? '#c47d8e' : dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: hasDeposit ? '#fff' : (dark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.4)'),
                    fontWeight: 700, fontSize: 13,
                  }}>
                    {initials(r.userName)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.userName || '(no name)'}
                      </span>
                      {hasDeposit && (
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                      )}
                    </div>
                    <div style={{ fontSize: 11, opacity: .45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.userEmail || r.userPhone || '—'}
                    </div>
                    {/* Mobile badges */}
                    <div className="otr-mob-sub" style={{ gap: 4, marginTop: 3 }}>
                      <MethodBadge method={r.method} />
                      <TouchBadge touch={r.touchType} />
                      {hasDeposit && <span style={{ fontSize: 11, fontWeight: 600, color: '#4ade80' }}>{fN(r.deposits)}</span>}
                    </div>
                  </div>
                </div>

                {/* Deposited */}
                <div className="otr-hide-mob" style={{
                  width: 90, textAlign: 'right', fontSize: 13, fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: hasDeposit ? '#4ade80' : (dark ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.15)'),
                }}>
                  {hasDeposit ? fN(r.deposits) : '—'}
                </div>

                {/* Balance */}
                <div className="otr-hide-mob" style={{
                  width: 80, textAlign: 'right', fontSize: 13, fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: r.balance > 0 ? (t?.green || '#4ade80') : (dark ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.15)'),
                }}>
                  {r.balance > 0 ? fN(r.balance) : '—'}
                </div>

                {/* Orders */}
                <div className="otr-hide-md" style={{
                  width: 50, textAlign: 'right', fontSize: 13, fontWeight: 500,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: r.orders > 0 ? 'inherit' : (dark ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.15)'),
                }}>
                  {r.orders || '—'}
                </div>

                {/* Touch */}
                <div className="otr-hide-md" style={{ width: 70 }}>
                  <TouchBadge touch={r.touchType} />
                </div>

                {/* Method */}
                <div className="otr-hide-lg" style={{ width: 80 }}>
                  <MethodBadge method={r.method} />
                </div>

                {/* Date */}
                <div style={{ width: 70, textAlign: 'right', fontSize: 12, opacity: .5, whiteSpace: 'nowrap' }}>
                  {fmtShort(r.contactedAt)}
                </div>
              </div>
            );
          })}
          {(!data?.rows?.length) && (
            <EmptyState dark={dark} title="No contacts recorded yet" subtitle="Contacts are tracked when staff tap buttons in Telegram" />
          )}
        </div>
        <Pagination dark={dark} page={page} totalPages={data?.totalPages || 1} total={data?.totalContacts || 0} setPage={setPage} />
      </div>
    </>
  );
}

/* ── Contact Drawer ──────────────────────────────── */

function ContactDrawer({ dark, t, row, onClose }) {
  const border = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';
  const softBg = dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)';
  const phone = row.userPhone?.replace('+', '') || '';
  const hasDeposit = row.deposits > 0;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 998 }} />
      <div className="otr-drawer" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '100vw', zIndex: 999,
        background: dark ? '#0e1122' : '#fff', borderLeft: `1px solid ${border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: hasDeposit ? 'linear-gradient(135deg,#4ade80,#22c55e)' : 'linear-gradient(135deg,#c47d8e,#8b5e6b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 16,
          }}>
            {initials(row.userName)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.userName}</span>
              {hasDeposit && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />}
            </div>
            {row.userEmail && <div style={{ fontSize: 13, opacity: .5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.userEmail}</div>}
            {row.userPhone && <div style={{ fontSize: 13, opacity: .5, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{row.userPhone}</div>}
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', flexShrink: 0,
            background: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)', color: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Detail grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <DetailCell label="Deposited" dark={dark} softBg={softBg}>
              <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: hasDeposit ? '#4ade80' : 'inherit' }}>
                {hasDeposit ? fN(row.deposits) : '—'}
              </span>
            </DetailCell>
            <DetailCell label="Balance" dark={dark} softBg={softBg}>
              <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: row.balance > 0 ? (t?.green || '#4ade80') : 'inherit' }}>
                {row.balance > 0 ? fN(row.balance) : '—'}
              </span>
            </DetailCell>
            <DetailCell label="Orders" dark={dark} softBg={softBg}><span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{row.orders || 0}</span></DetailCell>
            <DetailCell label="Revenue" dark={dark} softBg={softBg}>
              <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: row.revenue > 0 ? '#4ade80' : 'inherit' }}>
                {row.revenue > 0 ? fN(row.revenue) : '—'}
              </span>
            </DetailCell>
            <DetailCell label="Touch" dark={dark} softBg={softBg}><TouchBadge touch={row.touchType} /></DetailCell>
            <DetailCell label="Method" dark={dark} softBg={softBg}><MethodBadge method={row.method} /></DetailCell>
            {row.callbackAt && (
              <DetailCell label="Call back due" dark={dark} softBg={softBg}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fb923c', fontFamily: "'JetBrains Mono', monospace" }}>
                  {fmtDateTime(row.callbackAt)}{row.callbackAttempts > 0 ? ` · try ${row.callbackAttempts + 1}` : ''}
                </span>
              </DetailCell>
            )}
            <DetailCell label="Contacted by" dark={dark} softBg={softBg}><span style={{ fontSize: 14, fontWeight: 500 }}>{row.contactedBy || '—'}</span></DetailCell>
            <DetailCell label="Date" dark={dark} softBg={softBg}><span style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>{fmtDateTime(row.contactedAt)}</span></DetailCell>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {phone && (
              <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer" style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: '#25d366', color: '#fff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                WhatsApp
              </a>
            )}
            {row.userId && (
              <a href={`/admin?page=users&user=${row.userId}`} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)', color: 'inherit', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                View Profile
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function DetailCell({ label, dark, softBg, children }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 10, background: softBg }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', opacity: .4, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

/* ── Shared components ───────────────────────────── */

function StatCard({ dark, t, label, value, prev, sub, color, cardStyle }) {
  const delta = typeof prev === 'number' && prev > 0 ? Math.round(((numVal(value) - prev) / prev) * 100) : null;
  return (
    <div className="rounded-xl py-3 px-4" style={cardStyle}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', opacity: .5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color }}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {sub && <div style={{ fontSize: 11, marginTop: 4, color: t?.accent || '#c47d8e' }}>{sub}</div>}
      {delta !== null && !sub && (
        <div style={{ fontSize: 11, marginTop: 4, color: delta >= 0 ? (t?.green || '#4ade80') : (t?.red || '#f87171') }}>
          {delta >= 0 ? '+' : ''}{delta}% vs prev
        </div>
      )}
    </div>
  );
}

function Th({ children, align, className }) {
  return <th className={className} style={{ textAlign: align || 'left', padding: '10px 14px', fontWeight: 600, opacity: .4, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>{children}</th>;
}

function Td({ children, bold, mono, muted, align, highlight, className }) {
  return (
    <td className={className} style={{
      padding: '10px 14px', textAlign: align || 'left',
      fontWeight: bold ? 500 : 400,
      fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
      fontSize: mono ? 13 : 14,
      opacity: muted ? .6 : 1,
      color: highlight ? '#4ade80' : 'inherit',
    }}>
      {children}
    </td>
  );
}

function Pagination({ dark, page, totalPages, total, setPage }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * 15 + 1;
  const end = Math.min(page * 15, total);
  const btnStyle = (active) => ({
    width: 32, height: 32, borderRadius: 8, border: 'none', cursor: active ? 'default' : 'pointer', fontSize: 13, fontWeight: 600,
    background: active ? '#c47d8e' : dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)',
    color: active ? '#fff' : 'inherit', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  });
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i);
    else if (pages[pages.length - 1] !== '...') pages.push('...');
  }
  return (
    <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'}` }}>
      <span style={{ fontSize: 13, opacity: .5 }}>{start}–{end} of {total}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} style={{ ...btnStyle(false), opacity: page <= 1 ? .3 : 1, cursor: page <= 1 ? 'default' : 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        {pages.map((p, i) => p === '...'
          ? <span key={`e${i}`} style={{ width: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: .4 }}>...</span>
          : <button key={p} onClick={() => setPage(p)} style={btnStyle(p === page)}>{p}</button>
        )}
        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} style={{ ...btnStyle(false), opacity: page >= totalPages ? .3 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  );
}

function EmptyState({ dark, title, subtitle }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ display: 'block', margin: '0 auto 14px', opacity: .7 }}>
        <path d="M12 16h40v32a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V16z" stroke="#c47d8e" strokeWidth="1.5" opacity=".2" />
        <path d="M12 16l20 16 20-16" stroke="#c47d8e" strokeWidth="1.5" opacity=".3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="32" cy="36" r="6" stroke="#c47d8e" strokeWidth="1.5" opacity=".2" />
        <path d="M30 36l1.5 1.5 3-3" stroke="#c47d8e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".4" />
      </svg>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, opacity: .6 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: .35 }}>{subtitle}</div>
    </div>
  );
}

function SkeletonRows({ dark }) {
  const bone = `skel-bone ${dark ? 'skel-dark' : 'skel-light'}`;
  return (
    <div style={{ marginTop: 16 }}>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 14px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)'}` }}>
          <div className={bone} style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
          <div className={bone} style={{ width: 120, height: 14, borderRadius: 4, flex: '1 1 auto' }} />
          <div className={bone} style={{ width: 60, height: 14, borderRadius: 4 }} />
          <div className={bone} style={{ width: 50, height: 14, borderRadius: 4 }} />
          <div className={bone} style={{ width: 80, height: 14, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────── */

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function numVal(v) {
  if (typeof v === 'number') return v;
  const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtShort(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const now = new Date();
  const diffMs = now - dt;
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return `${Math.max(1, Math.floor(diffMs / 60000))}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  return dt.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}
