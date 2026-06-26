'use client';
import { useState, useEffect, useRef } from 'react';

function timeOnSite(firstSeen) {
  const s = Math.floor((Date.now() - new Date(firstSeen).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function timeAgo(iso) {
  if (!iso) return 'Never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'Today';
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
  if (path === '/orders') return 'Orders';
  if (path === '/settings') return 'Settings';
  if (path === '/services') return 'Services';
  if (path === '/pricing') return 'Pricing';
  if (path === '/about') return 'About';
  if (path === '/faq') return 'FAQ';
  if (path === '/blog') return 'Blog';
  if (path === '/tickets') return 'Support';
  if (path.startsWith('/services/')) return 'Browsing: ' + path.split('/').pop().replace(/-/g, ' ');
  if (path.startsWith('/order/')) return 'Viewing Order';
  if (path.startsWith('/blog/')) return 'Reading Blog';
  if (path.startsWith('/admin')) return 'Admin';
  return path;
}

function deviceIcon(ua) {
  if (!ua) return '🖥️';
  const lower = ua.toLowerCase();
  if (lower.includes('iphone') || lower.includes('android') || lower.includes('mobile')) return '📱';
  if (lower.includes('ipad') || lower.includes('tablet')) return '📱';
  return '🖥️';
}

function conversionSignal(session) {
  if (!session.user) return { label: 'Guest', color: '#8a8580', bg: 'rgba(138,133,128,.12)' };
  const u = session.user;
  if (u.balance > 0 && u.orderCount > 0) return { label: 'Hot', color: '#f59e0b', bg: 'rgba(245,158,11,.12)' };
  if (u.balance > 0) return { label: 'Has Funds', color: '#6ee7b7', bg: 'rgba(110,231,183,.12)' };
  if (u.orderCount > 0) return { label: 'Returning', color: '#a5b4fc', bg: 'rgba(165,180,252,.12)' };
  return { label: 'New User', color: '#c47d8e', bg: 'rgba(196,125,142,.12)' };
}

export default function LiveDashboard({ secretKey }) {
  const [sessions, setSessions] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
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
        setSessions(data.sessions || []);
        setCount(data.count || 0);
        setLoading(false);
        const newIds = new Set((data.sessions || []).map(s => s.sessionId));
        prevIds.current = newIds;
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, [secretKey]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const guests = sessions.filter(s => !s.user).length;
  const loggedIn = sessions.filter(s => s.user).length;
  const hot = sessions.filter(s => s.user?.balance > 0 && s.user?.orderCount > 0).length;

  return (
    <div style={{ minHeight: '100dvh', background: '#080b14', color: '#f5f3f0', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", padding: '24px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px rgba(34,197,94,.5)', animation: 'live-pulse 2s ease-in-out infinite' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Live</h1>
          <span style={{ fontSize: 13, color: '#8a8580', marginLeft: 'auto' }}>
            {loading ? 'Connecting...' : `${count} online`}
          </span>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
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

        {/* Sessions list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#8a8580' }}>Loading...</div>
        ) : sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#8a8580' }}>No one online right now.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.map(s => {
              const signal = conversionSignal(s);
              return (
                <div key={s.sessionId} style={{
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid rgba(255,255,255,.06)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  animation: 'fade-in .3s ease',
                }}>
                  {/* Device + signal */}
                  <div style={{ fontSize: 20, width: 36, textAlign: 'center', flexShrink: 0 }}>
                    {deviceIcon(s.ua)}
                  </div>

                  {/* Main info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.user?.name || 'Guest'}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                        color: signal.color, background: signal.bg, textTransform: 'uppercase', letterSpacing: .5, flexShrink: 0,
                      }}>
                        {signal.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#8a8580', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                      <span>{pageName(s.page)}</span>
                      <span>·</span>
                      <span>{timeOnSite(s.firstSeen)} on site</span>
                    </div>
                  </div>

                  {/* User stats */}
                  {s.user && (
                    <div style={{ display: 'flex', gap: 16, flexShrink: 0, fontSize: 12 }}>
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes live-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(.85); } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
