'use client';
import { useState, useEffect, useCallback } from 'react';

const TOUCH_LABELS = { day1: 'Day 1', day3: 'Day 3', day7: 'Day 7', winback: 'Winback', firstDeposit: 'First Deposit', firstOrder: 'First Order' };

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

export default function AdminOutreachPage({ dark }) {
  const [period, setPeriod] = useState('week');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/outreach-stats?period=${period}`);
      if (res.ok) setData(await res.json());
    } catch {} finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const s = data?.stats || {};
  const p = data?.prev || {};
  const convRate = s.users > 0 ? Math.round((s.converted / s.users) * 100) : 0;
  const prevConvRate = p.users > 0 ? Math.round((p.converted / p.users) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Outreach Performance</h2>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {['week', 'month'].map(v => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: period === v ? '#c47d8e' : dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)',
              color: period === v ? '#fff' : 'inherit',
            }}>
              {v === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ padding: 20, borderRadius: 12, background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)', flex: '1 1 200px', minWidth: 160 }}>
              <div className={`skel-bone ${dark ? 'skel-dark' : 'skel-light'}`} style={{ width: 80, height: 12, borderRadius: 4, marginBottom: 10 }} />
              <div className={`skel-bone ${dark ? 'skel-dark' : 'skel-light'}`} style={{ width: 100, height: 28, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <StatCard dark={dark} label="Contacted" value={s.users || 0} prev={p.users} />
            <StatCard dark={dark} label="Converted" value={`${s.converted || 0} (${convRate}%)`} prev={prevConvRate > 0 ? 1 : 0} />
            <StatCard dark={dark} label="Revenue" value={s.revenue || 0} prev={p.revenue} prefix="₦" />
            <StatCard dark={dark} label="Deposits" value={s.deposits || 0} prev={p.deposits} prefix="₦" />
          </div>

          {s.byTouch && Object.keys(s.byTouch).length > 0 && (
            <div style={{ marginBottom: 24, padding: 16, borderRadius: 12, background: dark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)' }}>
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

          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, opacity: .6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Recent Contacts</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'}` }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, opacity: .5, fontSize: 12 }}>User</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, opacity: .5, fontSize: 12 }}>Touch</th>
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
                    <td style={{ padding: '10px 12px', opacity: .7, fontSize: 13 }}>{new Date(r.contactedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>{r.orders}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: r.revenue > 0 ? 600 : 400, color: r.revenue > 0 ? '#4ade80' : 'inherit' }}>
                      {r.revenue > 0 ? `₦${r.revenue.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
                {(!data?.rows?.length) && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', opacity: .4 }}>No contacts recorded yet. Contacts are tracked when you tap the checkmark in Telegram.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
