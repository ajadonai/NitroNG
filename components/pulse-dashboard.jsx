'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

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

// ─── Hero user counter ──────────────────────────────────────────
function HeroCounter({ total, today }) {
  const animated = useAnimatedValue(total || 0, 1200);
  const digits = animated.toLocaleString().split('');

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(165,180,252,.06), rgba(196,125,142,.06))',
      border: '1px solid rgba(165,180,252,.12)',
      borderRadius: 20,
      padding: '24px 32px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '-50%', left: '50%', transform: 'translateX(-50%)',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(165,180,252,.08) 0%, transparent 70%)',
        animation: 'pulse-glow 4s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{ fontSize: 11, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600, marginBottom: 12, position: 'relative' }}>
        Total Users
      </div>
      <div className="m" style={{ display: 'flex', justifyContent: 'center', gap: 2, position: 'relative' }}>
        {digits.map((d, i) => (
          <span key={i} style={{
            display: 'inline-block',
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 1,
            color: d === ',' ? 'rgba(165,180,252,.3)' : '#f5f3f0',
            minWidth: d === ',' ? 12 : 34,
            textAlign: 'center',
            textShadow: d !== ',' ? '0 0 30px rgba(165,180,252,.2)' : 'none',
          }}>
            {d}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 13, color: '#a5b4fc', marginTop: 10, position: 'relative', fontWeight: 500 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          +{today} today
        </span>
      </div>
    </div>
  );
}

// ─── Metric card ────────────────────────────────────────────────
function MetricCard({ label, value, formatter, sub, color, icon }) {
  const animated = useAnimatedValue(value || 0);
  const prevRef = useRef(value);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevRef.current !== value && prevRef.current !== undefined) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 800);
      prevRef.current = value;
      return () => clearTimeout(t);
    }
    prevRef.current = value;
  }, [value]);

  return (
    <div style={{
      background: flash ? `linear-gradient(135deg, ${color}0a, ${color}05)` : 'rgba(255,255,255,.03)',
      border: `1px solid ${flash ? color + '22' : 'rgba(255,255,255,.07)'}`,
      borderRadius: 16,
      padding: '18px 20px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'background .6s ease, border-color .6s ease, box-shadow .6s ease',
      boxShadow: flash ? `0 0 30px ${color}15, inset 0 0 30px ${color}08` : 'none',
    }}>
      <div style={{ fontSize: 10, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}
        {label}
      </div>
      <div className="m" style={{
        fontSize: 28,
        fontWeight: 700,
        color: flash ? color : '#f5f3f0',
        transition: 'color .6s ease',
        lineHeight: 1.1,
      }}>
        {formatter ? formatter(animated) : animated.toLocaleString()}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#8a8580', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ─── Sparkline SVG ──────────────────────────────────────────────
function Sparkline({ data, color, area, height = 56, label }) {
  if (!data || data.length === 0) return null;
  const w = 200;
  const pad = 4;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    height - pad - (v / max) * (height - pad * 2),
  ]);
  const pts = points.map(p => p.join(',')).join(' ');
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const areaD = `${pathD} L${w},${height} L0,${height} Z`;
  const total = data.reduce((s, v) => s + v, 0);

  return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 16,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>{label}</span>
        <span className="m" style={{ fontSize: 12, color, fontWeight: 600 }}>{data[data.length - 1]?.toLocaleString()}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
        <defs>
          <linearGradient id={`sg-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={area ? 0.25 : 0.1} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#sg-${label})`} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="3" fill={color} style={{ animation: 'pulse-dot-sm 2s ease-in-out infinite' }}>
          <animate attributeName="opacity" values="1;.4;1" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>30d total: {total.toLocaleString()}</div>
    </div>
  );
}

// ─── Horizontal bar chart ───────────────────────────────────────
function HBarChart({ items, label }) {
  if (!items || items.length === 0) return null;
  const maxVal = Math.max(...items.map(i => i.orders), 1);
  const colors = ['#c47d8e', '#a5b4fc', '#e0a458', '#6ee7b7', '#fca5a5'];
  const totalOrders = items.reduce((s, i) => s + i.orders, 0);

  return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 16,
      padding: '16px 20px',
      height: '100%',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ fontSize: 10, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>{label}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
        {items.map((item, i) => {
          const pct = totalOrders > 0 ? Math.round((item.orders / totalOrders) * 100) : 0;
          return (
            <div key={item.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                <span style={{ color: '#f5f3f0', fontWeight: 500 }}>{item.name}</span>
                <span className="m" style={{ color: colors[i % colors.length], fontSize: 11 }}>{pct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,.05)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  borderRadius: 4,
                  background: `linear-gradient(90deg, ${colors[i % colors.length]}, ${colors[i % colors.length]}88)`,
                  width: `${(item.orders / maxVal) * 100}%`,
                  transition: 'width 1s ease',
                  boxShadow: `0 0 12px ${colors[i % colors.length]}33`,
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Donut chart ────────────────────────────────────────────────
function DonutChart({ items, label }) {
  if (!items || items.length === 0) return null;
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  const r = 40;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const statusColors = {
    Completed: '#10b981', Processing: '#e0a458', Pending: '#a5b4fc',
    Failed: '#fca5a5', Cancelled: '#555', Partial: '#c47d8e', Rejected: '#ef4444',
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 16,
      padding: '16px 20px',
      height: '100%',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ fontSize: 10, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 16 }}>{label}</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 24, justifyContent: 'center' }}>
        <div style={{ position: 'relative' }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            {items.map((item) => {
              const pct = item.count / total;
              const dash = circ * pct;
              const gap = items.length > 1 ? 2 : 0;
              const seg = (
                <circle key={item.status} cx="50" cy="50" r={r} fill="none"
                  stroke={statusColors[item.status] || '#555'}
                  strokeWidth="8"
                  strokeDasharray={`${Math.max(dash - gap, 0)} ${circ - dash + gap}`}
                  strokeDashoffset={-offset}
                  style={{ transition: 'stroke-dasharray .8s ease, stroke-dashoffset .8s ease', filter: `drop-shadow(0 0 4px ${statusColors[item.status] || '#555'}44)` }}
                  transform="rotate(-90 50 50)"
                />
              );
              offset += dash;
              return seg;
            })}
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span className="m" style={{ fontSize: 18, fontWeight: 700, color: '#f5f3f0' }}>{total.toLocaleString()}</span>
            <span style={{ fontSize: 9, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1 }}>orders</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.slice(0, 6).map(item => (
            <div key={item.status} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors[item.status] || '#555', flexShrink: 0, boxShadow: `0 0 6px ${statusColors[item.status] || '#555'}44` }} />
              <span style={{ color: '#ccc', minWidth: 72 }}>{item.status}</span>
              <span className="m" style={{ color: '#8a8580', fontSize: 11 }}>{Math.round((item.count / total) * 100)}%</span>
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
    Failed: '#fca5a5', Cancelled: '#555', Partial: '#c47d8e',
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 16,
      padding: '16px 20px',
      height: '100%',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ fontSize: 10, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse-dot 2s ease-in-out infinite' }} />
        Live Feed
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {orders.map((o, i) => (
          <div key={o.id + o.created} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px',
            borderRadius: 8,
            background: i === 0 ? 'rgba(255,255,255,.03)' : 'transparent',
            borderTop: i > 0 ? '1px solid rgba(255,255,255,.04)' : 'none',
            animation: `pulse-feed-in .5s ease ${i * 40}ms both`,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: statusColors[o.status] || '#555',
              boxShadow: `0 0 6px ${statusColors[o.status] || '#555'}66`,
            }} />
            <div style={{ flex: 1, fontSize: 12, color: '#f5f3f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
              {o.service}
            </div>
            <div style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>{o.user?.split('@')[0]}</div>
            <div className="m" style={{ fontSize: 11, color: '#c47d8e', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtNaira(o.charge)}</div>
            <div style={{ fontSize: 10, color: '#444', whiteSpace: 'nowrap', minWidth: 44, textAlign: 'right' }}>{timeAgo(o.created)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Progress bar (30s cycle) ───────────────────────────────────
function RefreshBar({ secondsAgo }) {
  const pct = Math.min((secondsAgo / 30) * 100, 100);
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 50 }}>
      <div style={{
        height: '100%',
        background: 'linear-gradient(90deg, #c47d8e, #a5b4fc)',
        width: `${pct}%`,
        transition: secondsAgo === 0 ? 'none' : 'width 1s linear',
        boxShadow: '0 0 10px rgba(196,125,142,.5)',
      }} />
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
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid rgba(196,125,142,.2)', borderTopColor: '#c47d8e', borderRadius: '50%', animation: 'pulse-spin .8s linear infinite', margin: '0 auto 16px' }} />
          <div style={{ color: '#8a8580', fontSize: 13, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>Loading Pulse...</div>
        </div>
      </div>
    );
  }

  const changeBadge = (val) => {
    if (val === undefined || val === null) return null;
    const color = val > 0 ? '#10b981' : val < 0 ? '#fca5a5' : '#8a8580';
    const arrow = val > 0 ? '↑' : val < 0 ? '↓' : '';
    return <span style={{ color, fontSize: 11, fontWeight: 600 }}>{arrow}{val > 0 ? '+' : ''}{val}%</span>;
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#080b14',
      color: '#f5f3f0',
      fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      animation: 'pulse-bg 20s ease infinite',
    }}>
      <RefreshBar secondsAgo={secondsAgo} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#c47d8e,#8b5e6b)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="11" height="12" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>
          </div>
          <div>
            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, margin: 0, lineHeight: 1 }}>Pulse</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
          {error && <span style={{ color: '#fca5a5', animation: 'pulse-blink 1s infinite' }}>Connection lost</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: error ? '#fca5a5' : '#10b981',
              animation: error ? 'none' : 'pulse-dot 2s ease-in-out infinite',
            }} />
            <span style={{ color: error ? '#fca5a5' : '#10b981', fontWeight: 600, letterSpacing: 1, fontSize: 11 }}>LIVE</span>
          </div>
          <span className="m" style={{ color: '#555', fontSize: 11 }}>{secondsAgo}s</span>
        </div>
      </div>

      {/* Row 1: Hero counter + metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(4, 1fr)', gap: 12, flexShrink: 0 }}>
        <HeroCounter total={data.totalUsers} today={data.newUsersToday} />
        <MetricCard label="Revenue" value={Math.round(data.revenueToday)} formatter={fmtNaira} color="#10b981"
          sub={<>{changeBadge(data.revenueChange)} vs yesterday</>}
          icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
        />
        <MetricCard label="Orders" value={data.ordersToday} color="#c47d8e"
          sub={<>{changeBadge(data.ordersChange)} vs yesterday</>}
          icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c47d8e" strokeWidth="2.5" strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>}
        />
        <MetricCard label="Deposits" value={Math.round(data.depositsToday)} formatter={fmtNaira} color="#e0a458"
          sub={<>{changeBadge(data.depositsChange)} vs yesterday</>}
          icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e0a458" strokeWidth="2.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
        />
        <MetricCard label="Processing" value={data.processing} color="#e0a458"
          sub="active orders"
          icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e0a458" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>}
        />
      </div>

      {/* Row 2: Sparklines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, flexShrink: 0 }}>
        <Sparkline label="New Users" data={data.chartData.map(d => d.newUsers)} color="#a5b4fc" area />
        <Sparkline label="Revenue" data={data.chartData.map(d => d.revenue)} color="#10b981" area />
        <Sparkline label="Orders" data={data.chartData.map(d => d.orders)} color="#c47d8e" area />
        <Sparkline label="Deposits" data={data.chartData.map(d => d.deposits)} color="#e0a458" area />
      </div>

      {/* Row 3: Breakdowns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 12, flex: 1, minHeight: 0 }}>
        <HBarChart items={data.topPlatforms} label="Top Platforms" />
        <DonutChart items={data.byStatus} label="Order Status" />
        <LiveFeed orders={data.recentOrders} />
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'rgba(255,255,255,.02)',
        border: '1px solid rgba(255,255,255,.05)',
        borderRadius: 10,
        fontSize: 11,
        flexShrink: 0,
      }}>
        <span style={{ color: '#444' }}>
          {new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}
        </span>
        <div className="m" style={{ color: '#666', display: 'flex', gap: 20 }}>
          <span><span style={{ color: '#10b981' }}>{fmtNaira(Math.round(data.monthRevenue))}</span> rev</span>
          <span><span style={{ color: '#c47d8e' }}>{fmtNum(data.monthOrders)}</span> orders</span>
          <span><span style={{ color: '#a5b4fc' }}>{data.monthNewUsers}</span> users</span>
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
          50% { background: #090d17; }
        }
        @keyframes pulse-feed-in {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { opacity: .4; transform: translateX(-50%) scale(1); }
          50% { opacity: .8; transform: translateX(-50%) scale(1.1); }
        }
        @keyframes pulse-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: .4; }
        }
        @keyframes pulse-dot-sm {
          0%, 100% { r: 3; }
          50% { r: 4; }
        }
      `}</style>
    </div>
  );
}
