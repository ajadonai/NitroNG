'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

function timeOnSite(firstSeen) {
  const s = Math.floor((Date.now() - new Date(firstSeen).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function timeAgo(iso) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return `${Math.floor(s / 3600)}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function pageName(path) {
  if (path === '/') return 'Landing Page';
  if (path === '/dashboard') return 'Dashboard';
  if (path === '/login') return 'Login';
  if (path === '/signup') return 'Signup';
  if (path === '/deposit') return 'Deposit';
  if (path === '/orders') return 'My Orders';
  if (path === '/settings') return 'Settings';
  if (path === '/services') return 'Services';
  if (path === '/pricing') return 'Pricing';
  if (path === '/about') return 'About';
  if (path === '/faq') return 'FAQ';
  if (path === '/blog') return 'Blog';
  if (path === '/tickets') return 'Support';
  if (path === '/referrals') return 'Referrals';
  if (path === '/notifications') return 'Notifications';
  if (path.startsWith('/services/')) return 'Browsing: ' + path.split('/').pop().replace(/-/g, ' ');
  if (path.startsWith('/order/')) return 'Viewing Order';
  if (path.startsWith('/blog/')) return 'Reading Blog';
  if (path.startsWith('/admin')) return 'Admin';
  if (path.startsWith('/ticket/')) return 'Ticket';
  return path;
}

function pageIntent(path) {
  if (path === '/deposit') return { label: 'Depositing', color: '#22c55e' };
  if (path === '/signup') return { label: 'Signing Up', color: '#c47d8e' };
  if (path === '/login') return { label: 'Logging In', color: '#a5b4fc' };
  if (path.startsWith('/services/')) return { label: 'Shopping', color: '#f59e0b' };
  if (path === '/services' || path === '/pricing') return { label: 'Browsing', color: '#f59e0b' };
  return null;
}

function deviceInfo(ua) {
  if (!ua) return { icon: '🖥️', label: 'Unknown' };
  const lower = ua.toLowerCase();
  const isMobile = lower.includes('iphone') || lower.includes('android') || lower.includes('mobile');
  const isTablet = lower.includes('ipad') || lower.includes('tablet');
  let browser = 'Browser';
  if (lower.includes('chrome') && !lower.includes('edg')) browser = 'Chrome';
  else if (lower.includes('safari') && !lower.includes('chrome')) browser = 'Safari';
  else if (lower.includes('firefox')) browser = 'Firefox';
  else if (lower.includes('edg')) browser = 'Edge';
  let os = '';
  if (lower.includes('iphone')) os = 'iPhone';
  else if (lower.includes('ipad')) os = 'iPad';
  else if (lower.includes('android')) os = 'Android';
  else if (lower.includes('mac')) os = 'Mac';
  else if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('linux')) os = 'Linux';
  return { icon: isMobile || isTablet ? '📱' : '🖥️', label: [os, browser].filter(Boolean).join(' · ') };
}

function conversionSignal(session) {
  if (!session.user) return { label: 'Guest', color: '#8a8580', bg: 'rgba(138,133,128,.12)' };
  const u = session.user;
  if (u.balance > 0 && u.orderCount > 0) return { label: 'Hot', color: '#f59e0b', bg: 'rgba(245,158,11,.12)' };
  if (u.balance > 0) return { label: 'Has Funds', color: '#6ee7b7', bg: 'rgba(110,231,183,.12)' };
  if (u.orderCount > 0) return { label: 'Returning', color: '#a5b4fc', bg: 'rgba(165,180,252,.12)' };
  return { label: 'New User', color: '#c47d8e', bg: 'rgba(196,125,142,.12)' };
}

const STATUS_COLORS = {
  Completed: '#22c55e', Processing: '#f59e0b', Pending: '#a5b4fc',
  Partial: '#f97316', Cancelled: '#ef4444',
};

function SessionCard({ s, expanded, onToggle, isNew }) {
  const signal = conversionSignal(s);
  const device = deviceInfo(s.ua);
  const intent = pageIntent(s.page);

  return (
    <div style={{
      background: isNew ? 'rgba(34,197,94,.06)' : 'rgba(255,255,255,.03)',
      border: `1px solid ${isNew ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.06)'}`,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'background .5s, border-color .5s',
      animation: isNew ? 'fade-in .4s ease' : undefined,
    }}>
      {/* Main row */}
      <div
        onClick={onToggle}
        style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ fontSize: 20, width: 36, textAlign: 'center', flexShrink: 0 }}>
          {device.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.user?.name || 'Guest'}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
              color: signal.color, background: signal.bg, textTransform: 'uppercase', letterSpacing: .5, flexShrink: 0,
            }}>
              {signal.label}
            </span>
            {intent && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                color: intent.color, background: `${intent.color}18`, textTransform: 'uppercase', letterSpacing: .5, flexShrink: 0,
              }}>
                {intent.label}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#8a8580', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
            <span>{pageName(s.page)}</span>
            <span>·</span>
            <span>{timeOnSite(s.firstSeen)} on site</span>
          </div>
        </div>

        {s.user && (
          <div className="live-stats" style={{ display: 'flex', gap: 16, flexShrink: 0, fontSize: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: s.user.balance > 0 ? '#6ee7b7' : '#8a8580', fontWeight: 700 }}>
                ₦{s.user.balance.toLocaleString()}
              </div>
              <div style={{ color: '#5a5550', fontSize: 10 }}>Balance</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700 }}>{s.user.orderCount}</div>
              <div style={{ color: '#5a5550', fontSize: 10 }}>Orders</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700 }}>{timeAgo(s.user.lastOrder)}</div>
              <div style={{ color: '#5a5550', fontSize: 10 }}>Last Order</div>
            </div>
          </div>
        )}

        <div style={{ flexShrink: 0, color: '#5a5550', fontSize: 14, transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
          ▾
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,.06)',
          padding: '12px 16px 14px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px',
          fontSize: 12, animation: 'expand-in .2s ease',
        }}>
          {s.user ? (
            <>
              <Detail label="Email" value={s.user.email} />
              <Detail label="Joined" value={timeAgo(s.user.joined)} />
              <Detail label="Total Deposited" value={`₦${s.user.totalDeposited?.toLocaleString() || 0}`} />
              <Detail label="Device" value={device.label} />
              {s.user.source && <Detail label="Source" value={s.user.source} />}

              {s.user.recentOrders?.length > 0 && (
                <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                  <div style={{ color: '#5a5550', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 6 }}>Recent Orders</div>
                  {s.user.recentOrders.map(o => (
                    <div key={o.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                      borderBottom: '1px solid rgba(255,255,255,.04)',
                    }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.service}</span>
                      <span style={{ color: '#8a8580', flexShrink: 0 }}>₦{o.charge.toLocaleString()}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                        color: STATUS_COLORS[o.status] || '#8a8580',
                        background: `${STATUS_COLORS[o.status] || '#8a8580'}18`,
                      }}>{o.status}</span>
                      <span style={{ color: '#5a5550', flexShrink: 0 }}>{timeAgo(o.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <Detail label="Device" value={device.label} />
              <Detail label="On site" value={timeOnSite(s.firstSeen)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div style={{ color: '#5a5550', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ color: '#f5f3f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

export default function LiveDashboard({ secretKey }) {
  const [sessions, setSessions] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [peak, setPeak] = useState(0);
  const [newIds, setNewIds] = useState(new Set());
  const [tick, setTick] = useState(0);
  const prevIds = useRef(new Set());

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/live?key=${secretKey}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        const currentIds = new Set((data.sessions || []).map(s => s.sessionId));
        if (prevIds.current.size > 0) {
          const arrivals = new Set();
          for (const id of currentIds) {
            if (!prevIds.current.has(id)) arrivals.add(id);
          }
          if (arrivals.size > 0) setNewIds(arrivals);
        }
        prevIds.current = currentIds;
        setSessions(data.sessions || []);
        setCount(data.count || 0);
        setPeak(p => Math.max(p, data.count || 0));
        setLoading(false);
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, [secretKey]);

  useEffect(() => {
    if (newIds.size === 0) return;
    const t = setTimeout(() => setNewIds(new Set()), 5000);
    return () => clearTimeout(t);
  }, [newIds]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const toggle = useCallback((id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const guests = sessions.filter(s => !s.user).length;
  const loggedIn = sessions.filter(s => s.user).length;
  const hot = sessions.filter(s => s.user?.balance > 0 && s.user?.orderCount > 0).length;

  // Active pages breakdown
  const pageGroups = {};
  sessions.forEach(s => {
    const name = pageName(s.page);
    pageGroups[name] = (pageGroups[name] || 0) + 1;
  });
  const topPages = Object.entries(pageGroups).sort((a, b) => b[1] - a[1]).slice(0, 6);

  return (
    <div style={{ minHeight: '100dvh', background: '#080b14', color: '#f5f3f0', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", padding: '24px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,.5)', animation: 'live-pulse 2s ease-in-out infinite' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Live</h1>
          <span style={{ fontSize: 13, color: '#8a8580', marginLeft: 'auto' }}>
            {loading ? 'Connecting...' : `${count} online · peak ${peak}`}
          </span>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Online', value: count, color: '#22c55e' },
            { label: 'Logged In', value: loggedIn, color: '#a5b4fc' },
            { label: 'Guests', value: guests, color: '#8a8580' },
            { label: 'Hot', value: hot, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#8a8580', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Active pages breakdown */}
        {topPages.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '12px 16px', marginBottom: 24 }}>
            <div style={{ fontSize: 10, color: '#5a5550', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>Active Pages</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {topPages.map(([name, n]) => (
                <span key={name} style={{
                  fontSize: 12, padding: '4px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,.05)', color: '#c4c0bc', fontWeight: 500,
                }}>
                  {name} <span style={{ color: '#8a8580', fontWeight: 700 }}>{n}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: '12px 16px', marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: '#5a5550', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>Badge Guide</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: 12 }}>
            {[
              { label: 'Hot', color: '#f59e0b', bg: 'rgba(245,158,11,.12)', desc: 'Has funds + ordered before — ready to buy' },
              { label: 'Has Funds', color: '#6ee7b7', bg: 'rgba(110,231,183,.12)', desc: 'Deposited but hasn\'t ordered yet' },
              { label: 'Returning', color: '#a5b4fc', bg: 'rgba(165,180,252,.12)', desc: 'Has ordered before, back on site' },
              { label: 'New User', color: '#c47d8e', bg: 'rgba(196,125,142,.12)', desc: 'Signed up, no orders yet' },
              { label: 'Guest', color: '#8a8580', bg: 'rgba(138,133,128,.12)', desc: 'Not logged in' },
              { label: 'Shopping', color: '#f59e0b', bg: 'rgba(245,158,11,.18)', desc: 'Viewing a service page' },
              { label: 'Depositing', color: '#22c55e', bg: 'rgba(34,197,94,.18)', desc: 'On the deposit page' },
              { label: 'Signing Up', color: '#c47d8e', bg: 'rgba(196,125,142,.18)', desc: 'On the signup page' },
            ].map(b => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, color: b.color, background: b.bg, textTransform: 'uppercase', letterSpacing: .5 }}>{b.label}</span>
                <span style={{ color: '#8a8580' }}>{b.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sessions list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#8a8580' }}>Loading...</div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#8a8580' }}>No one online right now.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.map(s => (
              <SessionCard
                key={s.sessionId}
                s={s}
                expanded={!!expanded[s.sessionId]}
                onToggle={() => toggle(s.sessionId)}
                isNew={newIds.has(s.sessionId)}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes live-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(.85); } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes expand-in { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 400px; } }
        @media (max-width: 640px) {
          .live-stats { display: none !important; }
        }
      `}</style>
    </div>
  );
}
