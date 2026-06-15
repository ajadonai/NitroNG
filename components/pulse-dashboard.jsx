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
      borderRadius: 16,
      padding: '14px 20px',
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
      <div style={{ fontSize: 10, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600, marginBottom: 6, position: 'relative' }}>
        Total Users
      </div>
      <div className="m" style={{ display: 'flex', justifyContent: 'center', gap: 2, position: 'relative' }}>
        {digits.map((d, i) => (
          <span key={i} style={{
            display: 'inline-block',
            fontSize: 36,
            fontWeight: 800,
            lineHeight: 1,
            color: d === ',' ? 'rgba(165,180,252,.3)' : '#f5f3f0',
            minWidth: d === ',' ? 10 : 22,
            textAlign: 'center',
            textShadow: d !== ',' ? '0 0 30px rgba(165,180,252,.2)' : 'none',
          }}>
            {d}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#a5b4fc', marginTop: 6, position: 'relative', fontWeight: 500 }}>
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
      borderRadius: 12,
      padding: '12px 14px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'background .6s ease, border-color .6s ease, box-shadow .6s ease',
      boxShadow: flash ? `0 0 30px ${color}15, inset 0 0 30px ${color}08` : 'none',
    }}>
      <div style={{ fontSize: 9, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon}
        {label}
      </div>
      <div className="m" style={{
        fontSize: 22,
        fontWeight: 700,
        color: flash ? color : '#f5f3f0',
        transition: 'color .6s ease',
        lineHeight: 1.1,
      }}>
        {formatter ? formatter(animated) : animated.toLocaleString()}
      </div>
      {sub && <div style={{ fontSize: 10, color: '#8a8580', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Sparkline SVG ──────────────────────────────────────────────
function Sparkline({ data, color, area, height = 40, label }) {
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
      borderRadius: 12,
      padding: '8px 12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 9, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>{label}</span>
        <span className="m" style={{ fontSize: 11, color, fontWeight: 600 }}>{data[data.length - 1]?.toLocaleString()}</span>
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
      <div style={{ fontSize: 9, color: '#555', marginTop: 2 }}>30d: {total.toLocaleString()}</div>
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
function DonutChart({ items, label, inline, compact }) {
  if (!items || items.length === 0) return null;
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  const r = compact ? 24 : inline ? 30 : 40;
  const svgSize = compact ? 56 : inline ? 72 : 100;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const statusColors = {
    Completed: '#6ee7b7', Processing: '#a5b4fc', Pending: '#fcd34d',
    Partial: '#fdba74', Failed: '#fca5a5', Cancelled: '#a1a1aa', Rejected: '#fca5a5',
  };

  const content = (
    <>
      <div style={{ fontSize: 10, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: compact ? 8 : inline ? 10 : 16 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 12 : inline ? 16 : 24, justifyContent: 'center' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
            {items.map((item) => {
              const pct = item.count / total;
              const dash = circ * pct;
              const gap = items.length > 1 ? 2 : 0;
              const seg = (
                <circle key={item.status} cx={svgSize/2} cy={svgSize/2} r={r} fill="none"
                  stroke={statusColors[item.status] || '#555'}
                  strokeWidth={compact ? 5 : inline ? 6 : 8}
                  strokeDasharray={`${Math.max(dash - gap, 0)} ${circ - dash + gap}`}
                  strokeDashoffset={-offset}
                  style={{ transition: 'stroke-dasharray .8s ease, stroke-dashoffset .8s ease', filter: `drop-shadow(0 0 4px ${statusColors[item.status] || '#555'}44)` }}
                  transform={`rotate(-90 ${svgSize/2} ${svgSize/2})`}
                />
              );
              offset += dash;
              return seg;
            })}
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span className="m" style={{ fontSize: compact ? 11 : inline ? 14 : 18, fontWeight: 700, color: '#f5f3f0' }}>{total.toLocaleString()}</span>
            {!compact && <span style={{ fontSize: inline ? 8 : 9, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1 }}>orders</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 3 : inline ? 5 : 8 }}>
          {items.slice(0, 6).map(item => (
            <div key={item.status} style={{ display: 'flex', alignItems: 'center', gap: compact ? 6 : 8, fontSize: compact ? 10 : inline ? 11 : 12 }}>
              <div style={{ width: compact ? 5 : inline ? 6 : 8, height: compact ? 5 : inline ? 6 : 8, borderRadius: '50%', background: statusColors[item.status] || '#555', flexShrink: 0, boxShadow: `0 0 6px ${statusColors[item.status] || '#555'}44` }} />
              <span style={{ color: '#ccc', minWidth: compact ? 52 : inline ? 60 : 72 }}>{item.status}</span>
              <span className="m" style={{ color: '#8a8580', fontSize: compact ? 9 : inline ? 10 : 11 }}>{Math.round((item.count / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (inline) return content;

  return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 16,
      padding: '16px 20px',
      height: '100%',
      display: 'flex', flexDirection: 'column',
    }}>
      {content}
    </div>
  );
}

function DepositFeed({ deposits }) {
  if (!deposits || deposits.length === 0) return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 12,
      padding: '10px 14px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ fontSize: 9, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>Recent Deposits</div>
      <div style={{ fontSize: 11, color: '#444', marginTop: 6 }}>No deposits yet</div>
    </div>
  );

  return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 12,
      padding: '10px 14px',
      height: '100%',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ fontSize: 9, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 6, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#e0a458', animation: 'pulse-dot 2s ease-in-out infinite' }} />
        Recent Deposits
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {deposits.map((tx, i) => (
          <div key={tx.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px',
            borderTop: i > 0 ? '1px solid rgba(255,255,255,.04)' : 'none',
            animation: `pulse-feed-in .5s ease ${i * 40}ms both`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: '#e0a458', boxShadow: '0 0 6px rgba(224,164,88,.4)' }} />
            <div style={{ flex: 1, fontSize: 12, color: '#f5f3f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
              {tx.user?.split('@')[0]}
            </div>
            <div className="m" style={{ fontSize: 11, color: '#e0a458', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtNaira(tx.amount)}</div>
            <div style={{ fontSize: 10, color: '#555', whiteSpace: 'nowrap', minWidth: 40, textAlign: 'right' }}>{timeAgo(tx.created)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Live feed ──────────────────────────────────────────────────
function LiveFeed({ orders }) {
  if (!orders || orders.length === 0) return null;
  const statusColors = {
    Completed: '#6ee7b7', Processing: '#a5b4fc', Pending: '#fcd34d',
    Partial: '#fdba74', Failed: '#fca5a5', Cancelled: '#a1a1aa',
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 12,
      padding: '10px 14px',
      height: '100%',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ fontSize: 9, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 6, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse-dot 2s ease-in-out infinite' }} />
        Live Feed
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {orders.map((o, i) => (
          <div key={o.id + o.created} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px',
            animation: `pulse-feed-in .5s ease ${i * 40}ms both`,
            borderTop: i > 0 ? '1px solid rgba(255,255,255,.04)' : 'none',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: statusColors[o.status] || '#555',
              boxShadow: `0 0 6px ${statusColors[o.status] || '#555'}66`,
            }} />
            <div style={{ flex: 1, fontSize: 12, color: '#f5f3f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
              {o.service}
            </div>
            <div className="m" style={{ fontSize: 11, color: '#c47d8e', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtNaira(o.charge)}</div>
            <div style={{ fontSize: 10, color: '#555', whiteSpace: 'nowrap', minWidth: 40, textAlign: 'right' }}>{timeAgo(o.created)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Payout feed ───────────────────────────────────────────────
const PAYOUT_META = {
  admin_gift:   { label: 'Gift',         color: '#f0abfc' },
  referral:     { label: 'Referral',     color: '#c47d8e' },
  coupon:       { label: 'Coupon',       color: '#fcd34d' },
  leaderboard:  { label: 'Leaderboard',  color: '#fb923c' },
  game_reward:  { label: 'Game Reward',  color: '#6ee7b7' },
  video_reward: { label: 'Video Reward', color: '#60a5fa' },
};

function PayoutFeed({ payouts, monthPayouts }) {
  const total = monthPayouts ? Object.values(monthPayouts).reduce((s, v) => s + v, 0) : 0;

  if (!payouts || payouts.length === 0) return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 12,
      padding: '10px 14px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ fontSize: 9, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>Payouts</div>
      <div style={{ fontSize: 11, color: '#444', marginTop: 6 }}>No payouts yet</div>
    </div>
  );

  return (
    <div style={{
      background: 'rgba(255,255,255,.03)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 12,
      padding: '10px 14px',
    }}>
      <div style={{ fontSize: 9, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 6 }}>Payouts</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {payouts.map((tx, i) => {
          const meta = PAYOUT_META[tx.type] || { label: tx.type, color: '#888' };
          return (
            <div key={tx.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '3px 4px',
              borderTop: i > 0 ? '1px solid rgba(255,255,255,.04)' : 'none',
              animation: `pulse-feed-in .5s ease ${i * 40}ms both`,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: meta.color, boxShadow: `0 0 6px ${meta.color}66` }} />
              <div style={{ flex: 1, fontSize: 12, color: '#f5f3f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                {meta.label}
              </div>
              <div className="m" style={{ fontSize: 11, color: meta.color, whiteSpace: 'nowrap', fontWeight: 600 }}>{fmtNaira(tx.amount)}</div>
              <div style={{ fontSize: 10, color: '#555', whiteSpace: 'nowrap', minWidth: 40, textAlign: 'right' }}>{timeAgo(tx.created)}</div>
            </div>
          );
        })}
      </div>
      {total > 0 && (
        <div style={{ marginTop: 6, padding: '5px 8px', borderRadius: 6, background: 'rgba(252,165,165,.06)', border: '1px solid rgba(252,165,165,.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: '#8a8580', fontWeight: 500 }}>This month</span>
          <span className="m" style={{ fontSize: 12, color: '#fca5a5', fontWeight: 700 }}>{fmtNaira(Math.round(total))}</span>
        </div>
      )}
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

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
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080b14', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto 20px' }}>
            <svg width="64" height="64" viewBox="0 0 1601 1785" style={{ animation: 'pulse-logo-in 1.2s ease both', opacity: 0 }}>
              <path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"
                fill="url(#pulse-load-grad)" />
              <defs>
                <linearGradient id="pulse-load-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#c47d8e" />
                  <stop offset="100%" stopColor="#a5b4fc" />
                </linearGradient>
              </defs>
            </svg>
            <div style={{
              position: 'absolute', inset: -8,
              border: '2px solid transparent',
              borderTopColor: '#c47d8e',
              borderRightColor: '#a5b4fc',
              borderRadius: '50%',
              animation: 'pulse-spin 1.2s linear infinite',
            }} />
          </div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: '#f5f3f0', marginBottom: 6, animation: 'pulse-logo-in 1.2s ease .2s both', opacity: 0 }}>Pulse</div>
          <div style={{ color: '#555', fontSize: 12, animation: 'pulse-logo-in 1.2s ease .4s both', opacity: 0 }}>Connecting to live data...</div>
        </div>
        <style>{`
          @keyframes pulse-spin { to { transform: rotate(360deg); } }
          @keyframes pulse-logo-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </div>
    );
  }

  const changeBadge = (val) => {
    if (val === undefined || val === null) return <span style={{ color: '#10b981', fontSize: 11, fontWeight: 600 }}>NEW</span>;
    const color = val > 0 ? '#10b981' : val < 0 ? '#fca5a5' : '#8a8580';
    const arrow = val > 0 ? '↑' : val < 0 ? '↓' : '';
    return <span style={{ color, fontSize: 11, fontWeight: 600 }}>{arrow}{val > 0 ? '+' : ''}{val}%</span>;
  };

  return (
    <div ref={containerRef} className="pulse-container" style={{
      minHeight: '100dvh',
      background: '#080b14',
      color: '#f5f3f0',
      fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      overflow: 'auto',
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
          <button onClick={toggleFullscreen} className="pulse-fs-btn" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8580" strokeWidth="2" strokeLinecap="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a8580" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            )}
          </button>
        </div>
      </div>

      {/* Row 1: Hero counter + metrics */}
      <div className="pulse-row1" style={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(5, 1fr)', gap: 12, flexShrink: 0 }}>
        <HeroCounter total={data.totalUsers} today={data.newUsersToday} />
        <MetricCard label="Revenue" value={Math.round(data.revenueToday)} formatter={fmtNaira} color="#10b981"
          sub={<>{changeBadge(data.revenueChange)} vs yesterday</>}
          icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
        />
        <MetricCard label="Profit" value={Math.round(data.profitToday)} formatter={v => (v < 0 ? '-' : '') + fmtNaira(Math.abs(v))} color={data.profitToday < 0 ? '#fca5a5' : '#34d399'}
          sub={<>{changeBadge(data.profitChange)} vs yesterday</>}
          icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={data.profitToday < 0 ? '#fca5a5' : '#34d399'} strokeWidth="2.5" strokeLinecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>}
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
      <div className="pulse-row2" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, flexShrink: 0 }}>
        <Sparkline label="New Users" data={data.chartData.map(d => d.newUsers)} color="#a5b4fc" area />
        <Sparkline label="Revenue" data={data.chartData.map(d => d.revenue)} color="#10b981" area />
        <Sparkline label="Profit" data={data.chartData.map(d => d.profit)} color="#34d399" area />
        <Sparkline label="Orders" data={data.chartData.map(d => d.orders)} color="#c47d8e" area />
        <Sparkline label="Deposits" data={data.chartData.map(d => d.deposits)} color="#e0a458" area />
      </div>

      {/* Row 2.5: Month-to-date + User Activity */}
      <div className="pulse-row25" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flexShrink: 0 }}>
        <div style={{
          background: 'rgba(255,255,255,.03)',
          border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 12,
          padding: '10px 16px',
        }}>
          <div style={{ fontSize: 9, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>Month to Date</div>
          <div className="pulse-mtd-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {[
              { label: 'Revenue', value: fmtNaira(Math.round(data.monthRevenue)), color: '#10b981' },
              { label: 'Cost', value: fmtNaira(Math.round(data.monthCost)), color: '#fca5a5' },
              { label: 'Profit', value: (data.monthProfit < 0 ? '-' : '') + fmtNaira(Math.abs(Math.round(data.monthProfit))), color: data.monthProfit < 0 ? '#fca5a5' : '#34d399' },
              { label: 'Orders', value: fmtNum(data.monthOrders), color: '#c47d8e' },
              { label: 'Deposits', value: fmtNaira(Math.round(data.monthDeposits)), color: '#e0a458' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div className="m" style={{ fontSize: 15, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#8a8580', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {data.monthRevenue > 0 && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.05)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: data.monthProfit < 0 ? 'linear-gradient(90deg, #fca5a5, #f87171)' : 'linear-gradient(90deg, #34d399, #10b981)',
                  width: `${Math.max(0, Math.min(100, Math.abs((data.monthProfit / data.monthRevenue) * 100)))}%`,
                  transition: 'width 1s ease',
                }} />
              </div>
              <span className="m" style={{ fontSize: 10, color: data.monthProfit < 0 ? '#fca5a5' : '#34d399', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {Math.round((data.monthProfit / data.monthRevenue) * 100)}% margin
              </span>
            </div>
          )}
        </div>
        <div style={{
          background: 'rgba(255,255,255,.03)',
          border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 12,
          padding: '10px 16px',
        }}>
          <div style={{ fontSize: 9, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>User Activity</div>
          <div className="pulse-ua-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { label: 'Total Users', value: fmtNum(data.totalUsers), color: '#a5b4fc' },
              { label: 'New This Month', value: fmtNum(data.monthNewUsers), color: '#6ee7b7' },
              { label: 'Active Orderers', value: fmtNum(data.monthActiveUsers), color: '#c47d8e' },
              { label: 'Idle w/ Balance', value: fmtNum(data.idleUsersWithBalance), color: '#fcd34d' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div className="m" style={{ fontSize: 15, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#8a8580', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {data.totalUsers > 0 && (() => {
            const repeatUsers = Math.max(0, data.monthActiveUsers - data.monthNewUsers);
            const repeatPct = data.monthActiveUsers > 0 ? Math.round((repeatUsers / data.monthActiveUsers) * 100) : 0;
            return (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.05)', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ height: '100%', background: '#c47d8e', width: `${repeatPct}%`, transition: 'width 1s ease' }} />
                  <div style={{ height: '100%', background: '#6ee7b7', width: `${100 - repeatPct}%`, transition: 'width 1s ease' }} />
                </div>
                <span className="m" style={{ fontSize: 10, color: '#c47d8e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {repeatPct}% repeat
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Row 3: Breakdowns */}
      <div className="pulse-row3" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: 8, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.07)',
            borderRadius: 12,
            padding: '12px 16px',
            flex: 7,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ fontSize: 9, color: '#8a8580', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 10 }}>Top Platforms</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
              {(data.topPlatforms || []).map((item, i) => {
                const maxVal = Math.max(...data.topPlatforms.map(p => p.orders), 1);
                const totalOrders = data.topPlatforms.reduce((s, p) => s + p.orders, 0);
                const pct = totalOrders > 0 ? Math.round((item.orders / totalOrders) * 100) : 0;
                const colors = ['#c47d8e', '#a5b4fc', '#e0a458', '#6ee7b7', '#fca5a5'];
                return (
                  <div key={item.name}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: '#f5f3f0', fontWeight: 500 }}>{item.name}</span>
                      <span className="m" style={{ color: colors[i % colors.length], fontSize: 10 }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.05)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${colors[i % colors.length]}, ${colors[i % colors.length]}88)`, width: `${(item.orders / maxVal) * 100}%`, transition: 'width 1s ease', boxShadow: `0 0 12px ${colors[i % colors.length]}33` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {(() => {
            return (
              <div style={{
                background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(255,255,255,.07)',
                borderRadius: 12,
                padding: '10px 14px',
                flex: 3,
              }}>
                <DonutChart items={(data.byStatus || []).reduce((acc, s) => {
                  if (s.status === 'Failed' || s.status === 'Rejected') {
                    const existing = acc.find(a => a.status === 'Cancelled');
                    if (existing) existing.count += s.count;
                    else acc.push({ status: 'Cancelled', count: s.count });
                  } else acc.push({ ...s });
                  return acc;
                }, [])} label="Order Status" inline />
              </div>
            );
          })()}
          <PayoutFeed payouts={data.recentPayouts} monthPayouts={data.monthPayouts} />
        </div>
        <LiveFeed orders={data.recentOrders} />
        <DepositFeed deposits={data.recentDeposits} />
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
        @media (max-width: 768px) {
          .pulse-container { overflow: auto !important; padding: 12px 10px !important; gap: 10px !important; }
          .pulse-fs-btn { display: none !important; }
          .pulse-row1 { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .pulse-row1 > :first-child { grid-column: 1 / -1; }
          .pulse-row2 { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .pulse-row2 > :last-child { grid-column: 1 / -1; }
          .pulse-row25 { grid-template-columns: 1fr !important; }
          .pulse-mtd-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .pulse-ua-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .pulse-row3 { grid-template-columns: 1fr !important; flex: none !important; }
          .pulse-row3 > * { min-height: 200px; }
        }
      `}</style>
    </div>
  );
}
