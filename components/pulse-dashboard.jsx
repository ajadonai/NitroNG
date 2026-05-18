'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Animated value hook ────────────────────────────────────────
function useAnimatedValue(target, duration = 800) {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef(null);
  const currentRef = useRef(target);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = currentRef.current;
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = t * (2 - t);
      const val = Math.round(start + (target - start) * eased);
      currentRef.current = val;
      setDisplay(val);
      if (t < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return display;
}

// ─── Format helpers ─────────────────────────────────────────────
function fmtNaira(n) {
  if (n >= 1000000) return '₦' + (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return '₦' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return '₦' + n.toLocaleString();
}

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString();
}

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ─── Metric card ────────────────────────────────────────────────
function MetricCard({ label, value, formatter, sub, color, icon }) {
  const animated = useAnimatedValue(value || 0);
  const prevRef = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value && prevRef.current !== undefined) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
    prevRef.current = value;
  }, [value]);

  return (
    <div style={{
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 16,
      padding: '20px 24px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'box-shadow .6s ease',
      boxShadow: flash ? `0 0 24px ${color}22` : 'none',
    }}>
      <div style={{ fontSize: 11, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        {label}
      </div>
      <div className="m" style={{
        fontSize: 32,
        fontWeight: 700,
        color: flash ? color : '#f5f3f0',
        transition: 'color .6s ease',
        lineHeight: 1.1,
      }}>
        {formatter ? formatter(animated) : animated.toLocaleString()}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#8a8580', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ─── Sparkline SVG ──────────────────────────────────────────────
function Sparkline({ data, color, area, height = 60, label }) {
  if (!data || data.length === 0) return null;
  const w = 100;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - (v / max) * (height - 8)}`).join(' ');
  const areaPath = area ? `M0,${height} L${pts.split(' ').map(p => p).join(' L')} L${w},${height} Z` : null;

  return (
    <div style={{
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 16,
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 11, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
        {area && (
          <defs>
            <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
        )}
        {area && <path d={areaPath} fill={`url(#grad-${label})`} />}
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="m" style={{ fontSize: 13, color, marginTop: 6, fontWeight: 600 }}>
        {data[data.length - 1]?.toLocaleString()} today
      </div>
    </div>
  );
}

// ─── Horizontal bar chart ───────────────────────────────────────
function HBarChart({ items, label }) {
  if (!items || items.length === 0) return null;
  const maxVal = Math.max(...items.map(i => i.orders), 1);
  const colors = ['#c47d8e', '#a5b4fc', '#e0a458', '#6ee7b7', '#fca5a5'];

  return (
    <div style={{
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 16,
      padding: '16px 20px',
      height: '100%',
    }}>
      <div style={{ fontSize: 11, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 14 }}>{label}</div>
      {items.map((item, i) => (
        <div key={item.name} style={{ marginBottom: i < items.length - 1 ? 10 : 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span style={{ color: '#f5f3f0' }}>{item.name}</span>
            <span className="m" style={{ color: '#8a8580' }}>{item.orders.toLocaleString()}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.06)' }}>
            <div style={{
              height: '100%',
              borderRadius: 3,
              background: colors[i % colors.length],
              width: `${(item.orders / maxVal) * 100}%`,
              transition: 'width .8s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Donut chart ────────────────────────────────────────────────
function DonutChart({ items, label }) {
  if (!items || items.length === 0) return null;
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  const r = 36;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const statusColors = {
    Completed: '#10b981', Processing: '#e0a458', Pending: '#a5b4fc',
    Failed: '#fca5a5', Cancelled: '#666', Partial: '#c47d8e', Rejected: '#ef4444',
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 16,
      padding: '16px 20px',
      height: '100%',
    }}>
      <div style={{ fontSize: 11, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 14 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <svg width="90" height="90" viewBox="0 0 90 90">
          {items.map((item) => {
            const pct = item.count / total;
            const dash = circ * pct;
            const seg = (
              <circle key={item.status} cx="45" cy="45" r={r} fill="none"
                stroke={statusColors[item.status] || '#666'}
                strokeWidth="10"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray .8s ease, stroke-dashoffset .8s ease' }}
                transform="rotate(-90 45 45)"
              />
            );
            offset += dash;
            return seg;
          })}
          <text x="45" y="45" textAnchor="middle" dominantBaseline="central" fill="#f5f3f0" fontSize="14" fontFamily="'JetBrains Mono',monospace" fontWeight="700">
            {total.toLocaleString()}
          </text>
        </svg>
        <div style={{ flex: 1 }}>
          {items.slice(0, 5).map(item => (
            <div key={item.status} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors[item.status] || '#666', flexShrink: 0 }} />
              <span style={{ color: '#f5f3f0', flex: 1 }}>{item.status}</span>
              <span className="m" style={{ color: '#8a8580' }}>{Math.round((item.count / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Live feed ──────────────────────────────────────────────────
function LiveFeed({ orders }) {
  if (!orders || orders.length === 0) return null;
  const statusColors = {
    Completed: '#10b981', Processing: '#e0a458', Pending: '#a5b4fc',
    Failed: '#fca5a5', Cancelled: '#666', Partial: '#c47d8e',
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 16,
      padding: '16px 20px',
      height: '100%',
      overflow: 'hidden',
    }}>
      <div style={{ fontSize: 11, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 14 }}>Live Feed</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {orders.map((o, i) => (
          <div key={o.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
            borderTop: i > 0 ? '1px solid rgba(255,255,255,.05)' : 'none',
            animation: `pulse-feed-in .4s ease ${i * 50}ms both`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColors[o.status] || '#666', flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 12, color: '#f5f3f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {o.service}
            </div>
            <div style={{ fontSize: 11, color: '#8a8580', whiteSpace: 'nowrap' }}>{o.user?.split('@')[0]}</div>
            <div className="m" style={{ fontSize: 12, color: '#c47d8e', whiteSpace: 'nowrap' }}>{fmtNaira(o.charge)}</div>
            <div style={{ fontSize: 10, color: '#666', whiteSpace: 'nowrap' }}>{timeAgo(o.created)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main dashboard ─────────────────────────────────────────────
export default function PulseDashboard({ secretKey }) {
  const [data, setData] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/pulse?key=${encodeURIComponent(secretKey)}`);
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();
      setData(json);
      setSecondsAgo(0);
      setError(false);
    } catch {
      setError(true);
    }
  }, [secretKey]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  useEffect(() => {
    const iv = setInterval(() => setSecondsAgo(s => s + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  if (!data) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080b14' }}>
        <div style={{ color: '#8a8580', fontSize: 14, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>Loading Pulse...</div>
      </div>
    );
  }

  const changeBadge = (val) => {
    if (val === undefined || val === null) return null;
    const color = val > 0 ? '#10b981' : val < 0 ? '#fca5a5' : '#8a8580';
    return <span style={{ color, fontSize: 12 }}>{val > 0 ? '+' : ''}{val}%</span>;
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#080b14',
      color: '#f5f3f0',
      fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      animation: 'pulse-bg 15s ease infinite',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Pulse</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
          {error && <span style={{ color: '#fca5a5' }}>Connection error</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: error ? '#fca5a5' : '#10b981',
              animation: error ? 'none' : 'pulse-dot 2s ease-in-out infinite',
            }} />
            <span style={{ color: error ? '#fca5a5' : '#10b981', fontWeight: 600 }}>LIVE</span>
          </div>
          <span style={{ color: '#8a8580' }}>Updated {secondsAgo}s ago</span>
        </div>
      </div>

      {/* Top row — metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, flexShrink: 0 }}>
        <MetricCard label="Users" value={data.totalUsers} color="#a5b4fc"
          sub={<><span style={{ color: '#a5b4fc' }}>+{data.newUsersToday}</span> today</>}
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
        />
        <MetricCard label="Revenue" value={Math.round(data.revenueToday)} formatter={fmtNaira} color="#10b981"
          sub={<>{changeBadge(data.revenueChange)} vs yesterday</>}
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
        />
        <MetricCard label="Orders" value={data.ordersToday} color="#c47d8e"
          sub={<>{changeBadge(data.ordersChange)} vs yesterday</>}
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#c47d8e" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>}
        />
        <MetricCard label="Deposits" value={Math.round(data.depositsToday)} formatter={fmtNaira} color="#e0a458"
          sub={<>{changeBadge(data.depositsChange)} vs yesterday</>}
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e0a458" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
        />
        <MetricCard label="Processing" value={data.processing} color="#e0a458"
          sub="active orders"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e0a458" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>}
        />
      </div>

      {/* Chart row — sparklines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, flexShrink: 0 }}>
        <Sparkline label="New Users" data={data.chartData.map(d => d.newUsers)} color="#a5b4fc" area />
        <Sparkline label="Revenue" data={data.chartData.map(d => d.revenue)} color="#10b981" area />
        <Sparkline label="Orders" data={data.chartData.map(d => d.orders)} color="#c47d8e" />
        <Sparkline label="Deposits" data={data.chartData.map(d => d.deposits)} color="#e0a458" area />
      </div>

      {/* Bottom row — breakdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 12, flex: 1, minHeight: 0 }}>
        <HBarChart items={data.topPlatforms} label="Top Platforms" />
        <DonutChart items={data.byStatus} label="Order Status" />
        <LiveFeed orders={data.recentOrders} />
      </div>

      {/* Footer bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(255,255,255,.03)',
        border: '1px solid rgba(255,255,255,.06)',
        borderRadius: 12,
        fontSize: 12,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8a8580' }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#c47d8e,#8b5e6b)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>
          </div>
          <span style={{ fontWeight: 600, color: '#f5f3f0' }}>NITRO</span>
        </div>
        <div className="m" style={{ color: '#8a8580', display: 'flex', gap: 24 }}>
          <span>Month: <span style={{ color: '#10b981' }}>{fmtNaira(Math.round(data.monthRevenue))}</span> rev</span>
          <span><span style={{ color: '#c47d8e' }}>{fmtNum(data.monthOrders)}</span> orders</span>
          <span><span style={{ color: '#a5b4fc' }}>{data.monthNewUsers}</span> new users</span>
          <span><span style={{ color: '#e0a458' }}>{fmtNaira(Math.round(data.monthDeposits))}</span> deposits</span>
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,.4); }
          50% { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
        }
        @keyframes pulse-bg {
          0%, 100% { background: #080b14; }
          50% { background: #0a0e18; }
        }
        @keyframes pulse-feed-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
