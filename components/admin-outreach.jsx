'use client';
import { useState, useEffect, useCallback } from 'react';

const TOUCH_LABELS = { day1: 'Day 1', day3: 'Day 3', day7: 'Day 7', winback: 'Winback', firstDeposit: 'First Deposit', firstOrder: 'First Order' };
const METHOD_LABELS = { call: 'Called', pending: 'Pending WA', whatsapp: 'WhatsApp', legacy: 'Legacy' };
const METHOD_COLORS = { call: '#4ade80', pending: '#facc15', whatsapp: '#60a5fa', legacy: '#a3a3a3' };

function StatCard({ label, value, prev, prefix, dark }) {
  const delta = prev > 0 ? Math.round(((value - prev) / prev) * 100) : null;
  return (
    <div style={{ padding: '20px', borderRadius: 12, background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)', flex: '1 1 200px', minWidth: 160 }}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', opacity: .5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
        {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {delta !== null && (
        <div style={{ fontSize: 12, marginTop: 6, color: delta >= 0 ? '#4ade80' : '#f87171' }}>
          {delta >= 0 ? '+' : ''}{delta}% vs prev period
        </div>
      )}
    </div>
  );
}

function MethodBadge({ method }) {
  const label = METHOD_LABELS[method] || method || '—';
  const color = METHOD_COLORS[method] || '#a3a3a3';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: `${color}20`, color }}>
      {label}
    </span>
  );
}

export default function AdminOutreachPage({ dark }) {
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState('week');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tabParam = tab === 'dnc' ? '&tab=dnc' : '';
      const res = await fetch(`/api/admin/outreach-stats?period=${period}${tabParam}`);
      if (res.ok) setData(await res.json());
    } catch {} finally { setLoading(false); }
  }, [period, tab]);

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
  const prevConvRate = p.users > 0 ? Math.round((p.converted / p.users) * 100) : 0;

  const tabBtn = (id, label, count) => (
    <button onClick={() => setTab(id)} style={{
      padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
      background: tab === id ? '#c47d8e' : dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)',
      color: tab === id ? '#fff' : 'inherit', display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {label}
      {count != null && count > 0 && (
        <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: tab === id ? 'rgba(255,255,255,.2)' : 'rgba(196,125,142,.15)', color: tab === id ? '#fff' : '#c47d8e' }}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Outreach</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabBtn('overview', 'Overview')}
          {tabBtn('dnc', 'DNC', data?.dncCount)}
        </div>
        {tab === 'overview' && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            {['week', 'month'].map(v => (
              <button key={v} onClick={() => setPeriod(v)} style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: period === v ? (dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)') : dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
                color: 'inherit',
              }}>
                {v === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'dnc' ? (
        <DncTab dark={dark} data={data} loading={loading} undnc={undnc} />
      ) : (
        <OverviewTab dark={dark} data={data} loading={loading} s={s} p={p} convRate={convRate} prevConvRate={prevConvRate} />
      )}
    </div>
  );
}

function DncTab({ dark, data, loading, undnc }) {
  if (loading && !data?.dnc) {
    return <div style={{ padding: 40, textAlign: 'center', opacity: .5 }}>Loading...</div>;
  }
  const dnc = data?.dnc || [];
  if (!dnc.length) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, opacity: .6 }}>No one on the DNC list</div>
        <div style={{ fontSize: 14, opacity: .4 }}>Users marked as "do not contact" in Telegram will appear here</div>
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'}` }}>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, opacity: .5, fontSize: 12 }}>Name</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, opacity: .5, fontSize: 12 }}>Phone</th>
            <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, opacity: .5, fontSize: 12 }}>Since</th>
            <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, opacity: .5, fontSize: 12 }}></th>
          </tr>
        </thead>
        <tbody>
          {dnc.map(u => (
            <tr key={u.id} style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)'}` }}>
              <td style={{ padding: '10px 12px', fontWeight: 500 }}>{u.name}</td>
              <td style={{ padding: '10px 12px', opacity: .7, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>{u.phone || '—'}</td>
              <td style={{ padding: '10px 12px', opacity: .7, fontSize: 13 }}>{new Date(u.since).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                <button onClick={() => undnc(u.id)} style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)', color: 'inherit',
                }}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverviewTab({ dark, data, loading, s, p, convRate, prevConvRate }) {
  if (loading && !data) {
    return (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ padding: 20, borderRadius: 12, background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)', flex: '1 1 200px', minWidth: 160 }}>
            <div className={`skel-bone ${dark ? 'skel-dark' : 'skel-light'}`} style={{ width: 80, height: 12, borderRadius: 4, marginBottom: 10 }} />
            <div className={`skel-bone ${dark ? 'skel-dark' : 'skel-light'}`} style={{ width: 100, height: 28, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <StatCard dark={dark} label="Contacted" value={s.users || 0} prev={p.users} />
        <StatCard dark={dark} label="Converted" value={`${s.converted || 0} (${convRate}%)`} prev={prevConvRate > 0 ? 1 : 0} />
        <StatCard dark={dark} label="Revenue" value={s.revenue || 0} prev={p.revenue} prefix="₦" />
        <StatCard dark={dark} label="Deposits" value={s.deposits || 0} prev={p.deposits} prefix="₦" />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {s.byMethod && Object.keys(s.byMethod).length > 0 && (
          <div style={{ flex: '1 1 280px', padding: 16, borderRadius: 12, background: dark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, opacity: .6, textTransform: 'uppercase', letterSpacing: '.5px' }}>By Method</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {Object.entries(s.byMethod).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{v}</span>
                  <MethodBadge method={k} />
                </div>
              ))}
            </div>
          </div>
        )}
        {s.byTouch && Object.keys(s.byTouch).length > 0 && (
          <div style={{ flex: '1 1 280px', padding: 16, borderRadius: 12, background: dark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, opacity: .6, textTransform: 'uppercase', letterSpacing: '.5px' }}>By Touch Type</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {Object.entries(s.byTouch).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{v}</span>
                  <span style={{ opacity: .6, fontSize: 13 }}>{TOUCH_LABELS[k] || k}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {s.byStaff && Object.keys(s.byStaff).length > 0 && (
          <div style={{ flex: '1 1 280px', padding: 16, borderRadius: 12, background: dark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, opacity: .6, textTransform: 'uppercase', letterSpacing: '.5px' }}>By Staff</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {Object.entries(s.byStaff).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{v}</span>
                  <span style={{ opacity: .6, fontSize: 13 }}>{k}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, opacity: .6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Recent Contacts</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'}` }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, opacity: .5, fontSize: 12 }}>User</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, opacity: .5, fontSize: 12 }}>Touch</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, opacity: .5, fontSize: 12 }}>Method</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, opacity: .5, fontSize: 12 }}>By</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, opacity: .5, fontSize: 12 }}>Contacted</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, opacity: .5, fontSize: 12 }}>Orders</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, opacity: .5, fontSize: 12 }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {(data?.rows || []).map(r => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)'}` }}>
                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{r.userName}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'rgba(196,125,142,.12)', color: '#c47d8e' }}>
                    {TOUCH_LABELS[r.touchType] || r.touchType}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <MethodBadge method={r.method} />
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500 }}>{r.contactedBy || '—'}</td>
                <td style={{ padding: '10px 12px', opacity: .7, fontSize: 13 }}>{new Date(r.contactedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{r.orders}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: r.revenue > 0 ? 600 : 400, color: r.revenue > 0 ? '#4ade80' : 'inherit' }}>
                  {r.revenue > 0 ? `₦${r.revenue.toLocaleString()}` : '—'}
                </td>
              </tr>
            ))}
            {(!data?.rows?.length) && (
              <tr><td colSpan={7} style={{ padding: '60px 20px', textAlign: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ display: 'block', margin: '0 auto 14px', opacity: .7 }}>
                  <path d="M12 16h40v32a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V16z" stroke="#c47d8e" strokeWidth="1.5" opacity=".2" />
                  <path d="M12 16l20 16 20-16" stroke="#c47d8e" strokeWidth="1.5" opacity=".3" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="32" cy="36" r="6" stroke="#c47d8e" strokeWidth="1.5" opacity=".2" />
                  <path d="M30 36l1.5 1.5 3-3" stroke="#c47d8e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".4" />
                </svg>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: dark ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.5)' }}>No contacts recorded yet</div>
                <div style={{ fontSize: 14, color: dark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.35)' }}>Contacts are tracked when staff tap buttons in Telegram</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
