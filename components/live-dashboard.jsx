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
  if (path === '/dashboard') return 'Dashboard Home';
  if (path === '/dashboard/orders') return 'My Orders';
  if (path === '/dashboard/addfunds') return 'Adding Funds';
  if (path === '/dashboard/settings') return 'Settings';
  if (path === '/dashboard/support') return 'Support';
  if (path === '/dashboard/referrals') return 'Referrals';
  if (path === '/dashboard/guide') return 'Guide';
  if (path === '/dashboard/leaderboard') return 'Leaderboard';
  if (path === '/dashboard/earn') return 'Earn';
  if (path === '/dashboard/notifications') return 'Notifications';
  if (path.startsWith('/dashboard/')) return 'Dashboard: ' + path.split('/').pop();
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
  if (path === '/deposit' || path === '/dashboard/addfunds') return { label: 'Depositing', color: '#22c55e' };
  if (path === '/signup') return { label: 'Signing Up', color: '#c47d8e' };
  if (path === '/login') return { label: 'Logging In', color: '#a5b4fc' };
  if (path.startsWith('/services/')) return { label: 'Shopping', color: '#f59e0b' };
  if (path === '/services' || path === '/pricing') return { label: 'Browsing', color: '#f59e0b' };
  if (path === '/dashboard/orders') return { label: 'Checking Orders', color: '#a5b4fc' };
  if (path === '/dashboard/support') return { label: 'Needs Help', color: '#ef4444' };
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
  if (session.user.isAdmin) return { label: 'Admin', color: '#c47d8e', bg: 'rgba(196,125,142,.12)' };
  const u = session.user;
  if (u.balance > 0 && u.orderCount > 0) return { label: 'Hot', color: '#f59e0b', bg: 'rgba(245,158,11,.12)' };
  if (u.balance > 0) return { label: 'Has Funds', color: '#6ee7b7', bg: 'rgba(110,231,183,.12)' };
  if (u.orderCount > 0) return { label: 'Returning', color: '#a5b4fc', bg: 'rgba(165,180,252,.12)' };
  return { label: 'New User', color: '#c47d8e', bg: 'rgba(196,125,142,.12)' };
}


const SIG_CLS = { 'Hot': 'ok', 'Has Funds': 'run', 'Returning': 'run', 'New User': 'ac', 'Guest': 'dim', 'Admin': 'ac' };
const SIG_LABEL = { 'Has Funds': 'Has funds', 'New User': 'New' };
const naira = (n) => `₦${Math.round(n || 0).toLocaleString('en-NG')}`;

function DeviceGlyph({ ua }) {
  const mobile = /iPhone|iPad|Android|Mobile/i.test(ua || '');
  return mobile
    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12" y2="18" /></svg>
    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>;
}

function Row({ s, expanded, onToggle, isNew }) {
  const signal = conversionSignal(s);
  const device = deviceInfo(s.ua);
  const intent = pageIntent(s.page);
  const u = s.user;
  const customer = u && !u.isAdmin;
  const cls = SIG_CLS[signal.label] || 'dim';
  return (
    <div className={`lv-item${expanded ? ' open' : ''}${isNew ? ' new' : ''}`}>
      <button type="button" className="lv-row" onClick={onToggle} aria-expanded={expanded}>
        <span className="lv-dev"><DeviceGlyph ua={s.ua} /></span>
        <span className="lv-main">
          <span><span className="lv-who">{u?.name || 'Guest'}</span><span className={`lv-sig lv-${cls}`}><i className="lv-dot" />{SIG_LABEL[signal.label] || signal.label}</span></span>
          <span className="lv-meta"><span className="lv-page">{pageName(s.page)}</span>{intent && <span className="lv-int">{intent.label}</span>}</span>
        </span>
        <span className="lv-time m">{timeOnSite(s.firstSeen)} on site<small>seen {timeAgo(s.lastSeen)}</small></span>
        <span className="lv-bal m">{customer ? naira(u.balance) : ''}</span>
        <span className="lv-ord m">{customer ? `${u.orderCount} order${u.orderCount === 1 ? '' : 's'}` : ''}</span>
        <span className="lv-chev" />
      </button>
      {expanded && (
        <div className="lv-detail">
          <div className="lv-facts">
            {customer ? (<>
              Joined {timeAgo(u.joined)} · {naira(u.totalDeposited)} deposited · {device.label}{u.source ? ` · via ${u.source}` : ''}<br />{u.email}
            </>) : u ? (<>Admin · {device.label}<br />{u.email}</>) : (<>{device.label} · on site {timeOnSite(s.firstSeen)}</>)}
          </div>
          {customer && u.recentOrders?.length > 0 && (
            <div className="lv-recs">
              <h4>Recent orders</h4>
              {u.recentOrders.map(o => (
                <div className="lv-rec" key={o.id}><span>{o.service}{o.tier ? ` · ${o.tier}` : ''}</span><span className="m">{naira(o.charge)}</span><span className="lv-ago m">{timeAgo(o.date)}</span></div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PAGE_CLS = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'];

export default function LiveDashboard() {
  const [sessions, setSessions] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [peak, setPeak] = useState(0);
  const [newIds, setNewIds] = useState(new Set());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const prevIds = useRef(new Set());
  const containerRef = useRef(null);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    else document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
  }, []);
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch('/api/live', { cache: 'no-store' });
        if (res.status === 401 || res.status === 403) { setSessions([]); setCount(0); window.location.replace('/api/internal-dashboard/access?next=/live'); return; }
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        if (!alive) return;
        const currentIds = new Set((data.sessions || []).map(s => s.sessionId));
        if (prevIds.current.size > 0) {
          const arrivals = new Set();
          for (const id of currentIds) if (!prevIds.current.has(id)) arrivals.add(id);
          if (arrivals.size > 0) setNewIds(arrivals);
        }
        prevIds.current = currentIds;
        setSessions(data.sessions || []);
        setCount(data.count || 0);
        setPeak(p => Math.max(p, data.count || 0));
        setLoading(false);
        setSecondsAgo(0);
        setError(false);
      } catch { if (alive) setError(true); }
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  useEffect(() => {
    if (newIds.size === 0) return;
    const t = setTimeout(() => setNewIds(new Set()), 5000);
    return () => clearTimeout(t);
  }, [newIds]);
  useEffect(() => { const iv = setInterval(() => setSecondsAgo(s => s + 1), 1000); return () => clearInterval(iv); }, []);
  const toggle = useCallback((id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] })), []);

  const guests = sessions.filter(s => !s.user).length;
  const loggedIn = sessions.filter(s => s.user).length;
  const hot = sessions.filter(s => s.user?.balance > 0 && s.user?.orderCount > 0).length;
  const pageGroups = {};
  sessions.forEach(s => { const name = pageName(s.page); pageGroups[name] = (pageGroups[name] || 0) + 1; });
  const pages = Object.entries(pageGroups).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const shown = pages.reduce((n, [, c]) => n + c, 0) || 1;

  return (
    <div ref={containerRef} className="lv">
      <style>{CSS}</style>
      <header className="lv-top">
        <div className="lv-brand"><span className="lv-mark">N</span><h1>Live</h1></div>
        <div className="lv-state">
          {error
            ? <span className="lv-live lv-lost"><i className="lv-dot bad" />CONNECTION LOST</span>
            : <span className="lv-live"><i className="lv-dot ok beat" />LIVE</span>}
          <span className="lv-ago m">{loading ? '…' : `${secondsAgo}s`}</span>
          <button type="button" onClick={toggleFullscreen} className="lv-fs" aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /></svg>}
          </button>
        </div>
      </header>

      <section className="lv-now">
        <div className="lv-tc lv-hero"><div className="lv-tl">Online now</div><div className="lv-pv"><span className="lv-val m">{count}</span><span className="lv-pn m">{peak}<small>peak this session</small></span></div></div>
        <div className="lv-tc"><div className="lv-tl">Logged in</div><div className="lv-val m">{loggedIn}</div></div>
        <div className="lv-tc"><div className="lv-tl">Guests</div><div className="lv-val m">{guests}</div></div>
        <div className="lv-tc"><div className="lv-tl">Hot</div><div className="lv-val m hot">{hot}</div></div>
      </section>

      <section className="lv-where">
        <header><h3>Where they are</h3><span className="lv-cnt">{count} {count === 1 ? 'person' : 'people'}</span></header>
        {pages.length > 0 ? (<>
          <div className="lv-stack">{pages.map(([name, c], i) => <i key={name} style={{ width: `${(c / shown) * 100}%` }} className={`lv-${PAGE_CLS[i]}`} />)}</div>
          <div className="lv-leg">{pages.map(([name, c], i) => <span key={name}><i className={`lv-sw lv-${PAGE_CLS[i]}`} />{name} <b className="m">{c}</b></span>)}</div>
        </>) : <div className="lv-empty">{loading ? 'Connecting…' : 'No one on the site right now.'}</div>}
      </section>

      <section className="lv-people">
        <header>
          <h3>People</h3>
          <span className="lv-legend"><i className="lv-dot ok" />Hot: has funds and has ordered <i className="lv-dot run" />Has funds / returning <i className="lv-dot ac" />New or admin <i className="lv-dot dim" />Guest</span>
        </header>
        <div className="lv-rows">
          {loading ? <div className="lv-empty">Connecting…</div>
            : sessions.length === 0 ? <div className="lv-empty">No one online right now.</div>
            : sessions.map(s => <Row key={s.sessionId} s={s} expanded={!!expanded[s.sessionId]} onToggle={() => toggle(s.sessionId)} isNew={newIds.has(s.sessionId)} />)}
        </div>
      </section>
    </div>
  );
}

const CSS = `
.lv{--bg:#0b0e17;--sf:#121724;--hair:rgba(255,255,255,.08);--tx:#f2efe9;--mu:#8b90a0;--dim:#5c6170;--ac:#c47d8e;--ok:#34d399;--wait:#e0a458;--bad:#f87171;--run:#7aa2f7;
  height:100dvh;background:var(--bg);color:var(--tx);font-family:Outfit,system-ui,sans-serif;padding:14px 18px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box;overflow:hidden}
.lv h1,.lv h3,.lv h4{margin:0}
.lv .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.lv-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0}
.lv-brand{display:flex;align-items:center;gap:10px}.lv-mark{width:26px;height:26px;border-radius:7px;background:var(--ac);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-weight:700;font-size:16px}
.lv-top h1{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;line-height:1}
.lv-state{display:flex;align-items:center;gap:12px;font-size:11px}
.lv-live{display:inline-flex;align-items:center;gap:6px;color:var(--ok);font-weight:700;letter-spacing:1.2px}.lv-live.lv-lost{color:var(--bad)}
.lv-ago{color:var(--dim)}.lv-fs{color:var(--dim);display:inline-flex;background:transparent;border:0;padding:4px;cursor:pointer;border-radius:6px}.lv-fs:hover{color:var(--tx)}.lv-fs:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.lv-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0;background:currentColor}.lv-dot.ok{color:var(--ok)}.lv-dot.run{color:var(--run)}.lv-dot.ac{color:var(--ac)}.lv-dot.dim{color:var(--dim)}.lv-dot.bad{color:var(--bad)}
.lv-dot.beat{animation:lv-beat 2s ease-out infinite}
@keyframes lv-beat{0%{box-shadow:0 0 0 0 rgba(52,211,153,.45)}70%{box-shadow:0 0 0 7px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}
@keyframes lv-arrive{from{background:rgba(52,211,153,.12)}to{background:transparent}}
@media (prefers-reduced-motion:reduce){.lv-dot.beat{animation:none}.lv-item.new{animation:none}}
.lv-now{display:grid;grid-template-columns:1.55fr repeat(3,1fr);background:var(--sf);border:1px solid var(--hair);border-radius:14px;flex-shrink:0}
.lv-tc{padding:14px 18px;display:flex;flex-direction:column;gap:4px;min-width:0}.lv-tc+.lv-tc{border-left:1px solid var(--hair)}
.lv-tl{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mu);font-weight:600}
.lv-val{font-size:34px;font-weight:700;letter-spacing:-.02em;line-height:1.1}.lv-val.hot{color:var(--ok)}
.lv-pv{display:flex;align-items:baseline;gap:14px}.lv-hero .lv-val{font-size:46px}
.lv-pn{font-size:30px;font-weight:700;color:var(--ok);letter-spacing:-.02em;line-height:1}.lv-pn small{font-family:Outfit,system-ui,sans-serif;font-size:12px;font-weight:500;color:var(--mu);margin-left:6px;letter-spacing:0}
.lv-where,.lv-people{background:var(--sf);border:1px solid var(--hair);border-radius:14px;min-width:0}
.lv-where{flex-shrink:0}
.lv-where header,.lv-people header{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px 8px;border-bottom:1px solid var(--hair)}
.lv-where h3,.lv-people h3{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mu);font-weight:600}.lv-cnt{font-size:11px;color:var(--dim)}
.lv-stack{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:12px 14px 8px;background:rgba(255,255,255,.05);gap:2px}.lv-stack i{display:block;height:100%}
.lv-leg{display:flex;flex-wrap:wrap;gap:4px 12px;padding:0 14px 10px;font-size:11px;color:var(--mu)}.lv-leg b{color:var(--tx);font-weight:600;margin-left:2px}.lv-sw{width:7px;height:7px;border-radius:2px;display:inline-block;margin-right:5px}
.lv-p0{background:var(--ac)}.lv-p1{background:#e4e2dd}.lv-p2{background:var(--run)}.lv-p3{background:#8ea3ff}.lv-p4{background:var(--bad)}.lv-p5{background:#c9ccd6}
.lv-people{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.lv-legend{font-size:11px;color:var(--dim);display:flex;gap:6px 10px;flex-wrap:wrap;align-items:center}.lv-legend .lv-dot{margin-right:2px}
.lv-rows{overflow:auto;min-height:0;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.12) transparent}
.lv-item{border-top:1px solid var(--hair)}.lv-item:first-child{border-top:0}.lv-item.open{background:rgba(255,255,255,.025)}.lv-item.new{animation:lv-arrive 5s ease-out}
.lv-row{display:grid;grid-template-columns:20px 1fr 118px 84px 74px 14px;align-items:center;gap:12px;padding:10px 14px;width:100%;background:transparent;border:0;color:inherit;font:inherit;font-size:12.5px;text-align:left;cursor:pointer;min-width:0}
.lv-row:focus-visible{outline:2px solid var(--ac);outline-offset:-2px;border-radius:8px}
.lv-dev{color:var(--dim);display:inline-flex}
.lv-main{display:flex;flex-direction:column;gap:3px;min-width:0}.lv-who{font-weight:600;margin-right:8px}
.lv-sig{font-size:10.5px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;display:inline-flex;align-items:center;gap:5px}.lv-sig.lv-ok{color:var(--ok)}.lv-sig.lv-run{color:var(--run)}.lv-sig.lv-ac{color:var(--ac)}.lv-sig.lv-dim{color:var(--dim)}
.lv-meta{display:flex;gap:10px;font-size:11.5px;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lv-int{color:var(--wait)}
.lv-time{font-size:11px;color:var(--mu);display:flex;flex-direction:column;gap:2px}.lv-time small{font-size:10px;color:var(--dim)}
.lv-bal{font-weight:600;text-align:right;font-size:12px}.lv-ord{font-size:11px;color:var(--mu);text-align:right}
.lv-chev{width:8px;height:8px;border-right:1.5px solid var(--dim);border-bottom:1.5px solid var(--dim);transform:rotate(45deg);justify-self:end;margin-right:4px;transition:transform .2s}.lv-item.open .lv-chev{transform:rotate(-135deg)}
.lv-detail{padding:4px 14px 12px 46px;border-top:1px dashed var(--hair);display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;font-size:12px}
.lv-facts{color:var(--mu);line-height:1.6}
.lv-recs h4{margin:0 0 4px;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:var(--dim);font-weight:600}.lv-rec{display:flex;gap:12px;padding:3px 0;color:var(--mu)}.lv-rec span:first-child{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lv-rec .m{color:var(--tx)}.lv-ago.m{color:var(--dim);width:30px;text-align:right}
.lv-empty{padding:18px 14px;font-size:12px;color:var(--dim)}
@media (max-width:768px){
  .lv{height:auto;min-height:100dvh;overflow:auto;padding:14px 14px 24px}
  .lv-fs{display:none}
  .lv-now{grid-template-columns:1fr 1fr}.lv-hero{grid-column:1/-1}.lv-tc+.lv-tc{border-left:0}.lv-tc:nth-child(3){border-left:1px solid var(--hair)}.lv-tc:nth-child(n+2){border-top:1px solid var(--hair)}
  .lv-val{font-size:26px}.lv-hero .lv-val{font-size:40px}.lv-pn{font-size:26px}
  .lv-people{flex:none;overflow:visible}.lv-rows{overflow:visible}.lv-legend{display:none}
  .lv-row{grid-template-columns:20px 1fr auto 14px;grid-template-areas:"dev main bal chev" "dev time ord chev";row-gap:2px}
  .lv-dev{grid-area:dev}.lv-main{grid-area:main}.lv-time{grid-area:time;flex-direction:row;gap:8px}.lv-bal{grid-area:bal}.lv-ord{grid-area:ord}.lv-chev{grid-area:chev}
  .lv-detail{grid-template-columns:1fr;padding-left:14px}
}
`;
