'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import NitroLoader from './nitro-loader';

// Pulse: the office screen. People first, today's figures on their own day
// lines, three lists for what is happening, one row of facts for the month.
// Colour means something: green is money in and done, amber is waiting, red is
// out or cancelled, the accent is orders. Built 1:1 from the approved mock.

const naira = (n) => `${n < 0 ? '−' : ''}₦${Math.round(Math.abs(n)).toLocaleString('en-NG')}`;
const num = (n) => Math.round(n || 0).toLocaleString('en-NG');
function ago(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
const METHODS = { flutterwave: 'Flutterwave', manual: 'Bank transfer', alatpay: 'ALATPay', monnify: 'Monnify', wallet: 'Wallet', admin_credit: 'Admin credit' };
const method = (m) => METHODS[m] || (m ? m.charAt(0).toUpperCase() + m.slice(1) : 'Wallet');
const DOT = { Completed: 'ok', Processing: 'run', Dispatching: 'run', Pending: 'wait', Partial: 'warn', Cancelled: 'bad', Failed: 'bad', Rejected: 'bad', Refunded: 'bad' };

function Delta({ value }) {
  if (value === null || value === undefined) return <span className="pl-d pl-flat">new</span>;
  return <span className={`pl-d ${value >= 0 ? 'pl-up' : 'pl-down'}`}>{value >= 0 ? '+' : ''}{value}%</span>;
}

/** Today's line: midnight to now, a mark every six hours, the last point emphasised. */
function DayLine({ values }) {
  const w = 240, h = 56;
  const vals = values.length ? values : [0];
  const mx = Math.max(...vals.map(v => Math.max(v, 0)), 0) || 1;
  const n = vals.length, step = n > 1 ? w / (n - 1) : w;
  const pts = vals.map((v, i) => [i * step, h - 3 - (Math.max(v, 0) / mx) * (h - 10)]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  const grid = [1, 2, 3].filter(i => i * 6 < n).map(i => <line key={i} x1={(i * 6 * step).toFixed(1)} y1="0" x2={(i * 6 * step).toFixed(1)} y2={h} className="pl-sp-g" />);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="pl-sp" aria-hidden="true">
      {grid}
      <polygon points={`0,${h} ${line} ${lx.toFixed(1)},${h}`} className="pl-sp-a" />
      <polyline points={line} className="pl-sp-l" />
      <circle cx={lx.toFixed(1)} cy={ly.toFixed(1)} r="3" className="pl-sp-d" />
    </svg>
  );
}
function Axis({ nowHour }) {
  return <div className="pl-ax"><span>00:00</span><span>06:00</span><span>12:00</span><span>now · {String(nowHour).padStart(2, '0')}:00</span></div>;
}

function Figure({ kind, label, value, delta, series, nowHour }) {
  return (
    <div className={`pl-tc pl-${kind}`}>
      <div className="pl-tl">{label}<span className="pl-vs"><Delta value={delta} /> vs yesterday</span></div>
      <div className="pl-val m">{value}</div>
      <DayLine values={series} />
      <Axis nowHour={nowHour} />
    </div>
  );
}

function People({ data }) {
  const y = data.newUsersYesterday || 0;
  const change = y === 0 ? (data.newUsersToday > 0 ? null : 0) : Math.round(((data.newUsersToday - y) / y) * 100);
  return (
    <div className="pl-tc pl-ppl">
      <div className="pl-tl">People<span className="pl-vs"><Delta value={change} /> vs yesterday&apos;s {y}</span></div>
      <div className="pl-pv"><span className="pl-val m">{num(data.totalUsers)}</span><span className="pl-pn m">+{num(data.newUsersToday)}<small>today</small></span></div>
      <DayLine values={(data.todayHours || []).map(h => h.newUsers)} />
      <Axis nowHour={data.nowHour || 0} />
    </div>
  );
}

function ListHead({ title, sub }) {
  return <header><h3>{title}</h3><span className="pl-cnt m">{sub}</span></header>;
}

function LiveList({ data }) {
  return (
    <section className="pl-list">
      <ListHead title="Live" sub={`${num(data.ordersToday)} today · ${num(data.processing)} running`} />
      <div className="pl-rows">
        {(data.recentOrders || []).map(o => (
          <div className="pl-row" key={o.id}>
            <span className="pl-t m">{ago(o.created)}</span>
            <span className="pl-who">{o.user}</span>
            <span className="pl-what">{o.service}{o.tier ? ` · ${o.tier}` : ''}</span>
            <span className="pl-amt m">{naira(o.charge)}</span>
            <i className={`pl-dot pl-${DOT[o.status] || 'wait'}`} title={o.status} />
          </div>
        ))}
        {!(data.recentOrders || []).length && <div className="pl-empty">No orders yet today</div>}
      </div>
    </section>
  );
}
function MoneyIn({ data }) {
  const todayCount = (data.recentDeposits || []).filter(d => new Date(d.created).toDateString() === new Date().toDateString()).length;
  return (
    <section className="pl-list">
      <ListHead title="Money in" sub={`${naira(data.depositsToday)} today${todayCount ? ` · ${todayCount}+` : ''}`} />
      <div className="pl-rows">
        {(data.recentDeposits || []).map(d => (
          <div className="pl-row" key={d.id}>
            <span className="pl-t m">{ago(d.created)}</span>
            <span className="pl-who">{d.user}</span>
            <span className={`pl-what pl-via pl-via-${String(d.method || 'wallet').toLowerCase().replace(/[^a-z_]/g, '')}`}>{method(d.method)}</span>
            <span className="pl-amt m pl-in">+{naira(d.amount)}</span>
          </div>
        ))}
        {!(data.recentDeposits || []).length && <div className="pl-empty">No deposits yet today</div>}
      </div>
    </section>
  );
}
function Refunds({ data }) {
  const list = data.recentRefunds || [];
  const total = list.reduce((s, r) => s + (r.refunded || 0), 0);
  return (
    <section className="pl-list">
      <ListHead title="Refunds" sub={`${list.length} recent · ${naira(total)}`} />
      <div className="pl-rows">
        {list.map(r => (
          <div className="pl-row pl-two" key={r.id}>
            <span className="pl-t m">{ago(r.refundedAt)}</span>
            <span className="pl-who">{r.user}</span>
            <span className="pl-what">{r.service}{r.tier ? ` · ${r.tier}` : ''}<em>{r.reason || (r.remains > 0 ? `Partial — ${num(r.remains)} of ${num(r.quantity)} left` : 'Refunded')}</em></span>
            <span className="pl-amt m pl-out">−{naira(r.refunded)}</span>
          </div>
        ))}
        {!list.length && <div className="pl-empty">Nothing refunded recently</div>}
      </div>
    </section>
  );
}

function Month({ data }) {
  const markup = data.monthCost > 0 ? Math.round((data.monthProfit / data.monthCost) * 100) : 0;
  const avg = data.monthOrders > 0 ? data.monthRevenue / data.monthOrders : 0;
  const repeat = data.monthActiveUsers > 0 ? Math.round(((data.monthRepeatUsers || 0) / data.monthActiveUsers) * 100) : 0;
  const d = new Date(); const monthName = d.toLocaleDateString('en-NG', { month: 'long', timeZone: 'Africa/Lagos' }); const day = Number(d.toLocaleDateString('en-NG', { day: 'numeric', timeZone: 'Africa/Lagos' }));
  const facts = [
    ['Revenue', naira(data.monthRevenue)], ['Cost', naira(data.monthCost)], ['Profit', naira(data.monthProfit)], ['Markup', `${markup}%`], ['Orders', num(data.monthOrders)],
    ['Avg order', naira(avg)], ['Deposits', naira(data.monthDeposits)], ['Depositors', num(data.monthDepositors)], ['New people', num(data.monthNewUsers)], ['Repeat buyers', `${repeat}%`],
  ];
  return (
    <section className="pl-month">
      <header><h3>This month</h3><span className="pl-cnt">1–{day} {monthName}</span></header>
      <div className="pl-mfs">{facts.map(([l, v]) => <div className="pl-mf" key={l}><div className="pl-mv m">{v}</div><div className="pl-ml">{l}</div></div>)}</div>
    </section>
  );
}

const STATUS_ORDER = ['Completed', 'Cancelled', 'Processing', 'Partial', 'Pending', 'Refunded'];
const STATUS_CLS = { Completed: 'ok', Cancelled: 'bad', Processing: 'run', Partial: 'warn', Pending: 'wait', Refunded: 'bad' };
function Bars({ data }) {
  const plats = data.topPlatforms || []; const ptot = plats.reduce((s, p) => s + p.orders, 0) || 1;
  const merged = {};
  (data.byStatus || []).forEach(s => { const k = ['Failed', 'Rejected'].includes(s.status) ? 'Cancelled' : s.status; merged[k] = (merged[k] || 0) + s.count; });
  const stats = STATUS_ORDER.filter(k => merged[k]).map(k => [k, merged[k], STATUS_CLS[k] || 'wait']);
  const stot = stats.reduce((s, [, c]) => s + c, 0) || 1;
  return (
    <section className="pl-bars">
      <div className="pl-bar">
        <header><h3>Platforms</h3><span className="pl-cnt">this month</span></header>
        <div className="pl-stack">{plats.map((p, i) => <i key={p.name} style={{ width: `${(p.orders / ptot) * 100}%` }} className={`pl-p${i}`} />)}</div>
        <div className="pl-leg">{plats.map((p, i) => <span key={p.name}><i className={`pl-sw pl-p${i}`} />{p.name} <b className="m">{Math.round((p.orders / ptot) * 100)}%</b></span>)}</div>
      </div>
      <div className="pl-bar">
        <header><h3>Order status</h3><span className="pl-cnt">30 days</span></header>
        <div className="pl-stack">{stats.map(([k, c, cls]) => <i key={k} style={{ width: `${(c / stot) * 100}%` }} className={`pl-${cls}`} />)}</div>
        <div className="pl-leg">{stats.map(([k, c, cls]) => <span key={k}><i className={`pl-sw pl-${cls}`} />{k} <b className="m">{Math.round((c / stot) * 100)}%</b></span>)}</div>
      </div>
    </section>
  );
}

export default function PulseDashboard() {
  const [data, setData] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/pulse', { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) { setData(null); window.location.replace('/api/internal-dashboard/access?next=/pulse'); return; }
      if (!res.ok) throw new Error('fetch failed');
      setData(await res.json()); setSecondsAgo(0); setError(false);
    } catch { setError(true); }
  }, []);
  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 30000); return () => clearInterval(iv); }, [fetchData]);
  useEffect(() => { const iv = setInterval(() => setSecondsAgo(s => s + 1), 1000); return () => clearInterval(iv); }, []);

  if (!data) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0e17', fontFamily: 'Outfit, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <NitroLoader size={72} />
          <div style={{ color: '#5c6170', fontSize: 11 }}>Connecting to live data…</div>
        </div>
      </div>
    );
  }
  const H = data.todayHours || [];
  const nowHour = data.nowHour || 0;
  return (
    <div ref={containerRef} className="pl">
      <style>{CSS}</style>
      <header className="pl-top">
        <div className="pl-brand"><span className="pl-mark">N</span><h1>Pulse</h1></div>
        <div className="pl-state">
          {data.processing > 0 && <span className="pl-chip"><i className="pl-dot pl-run" />{num(data.processing)} running</span>}
          {error
            ? <span className="pl-live pl-lost"><i className="pl-dot pl-bad" />CONNECTION LOST</span>
            : <span className="pl-live"><i className="pl-dot pl-ok pl-beat" />LIVE</span>}
          <span className="pl-ago m">{secondsAgo}s</span>
          <button type="button" onClick={toggleFullscreen} className="pl-fs" aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /></svg>}
          </button>
        </div>
      </header>

      <section className="pl-today">
        <People data={data} />
        <Figure kind="rev" label="Revenue" value={naira(data.revenueToday)} delta={data.revenueChange} series={H.map(h => h.revenue)} nowHour={nowHour} />
        <Figure kind="pro" label="Profit" value={naira(data.profitToday)} delta={data.profitChange} series={H.map(h => h.profit)} nowHour={nowHour} />
        <Figure kind="ord" label="Orders" value={num(data.ordersToday)} delta={data.ordersChange} series={H.map(h => h.orders)} nowHour={nowHour} />
        <Figure kind="dep" label="Deposits" value={naira(data.depositsToday)} delta={data.depositsChange} series={H.map(h => h.deposits)} nowHour={nowHour} />
      </section>

      <div className="pl-mid">
        <LiveList data={data} />
        <MoneyIn data={data} />
        <Refunds data={data} />
      </div>

      <div className="pl-bot">
        <Month data={data} />
        <Bars data={data} />
      </div>
    </div>
  );
}

const CSS = `
.pl{--bg:#0b0e17;--sf:#121724;--hair:rgba(255,255,255,.08);--tx:#f2efe9;--mu:#8b90a0;--dim:#5c6170;--ac:#c47d8e;--ok:#34d399;--wait:#e0a458;--bad:#f87171;--run:#7aa2f7;--warn:#fdba74;
  height:100dvh;background:var(--bg);color:var(--tx);font-family:Outfit,system-ui,sans-serif;padding:14px 18px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box;overflow:hidden}
.pl h1,.pl h3{margin:0}
.pl .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.pl-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0}
.pl-brand{display:flex;align-items:center;gap:10px}.pl-mark{width:26px;height:26px;border-radius:7px;background:var(--ac);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-family:'Cormorant Garamond',serif;font-weight:700;font-size:16px}
.pl-top h1{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;line-height:1}
.pl-state{display:flex;align-items:center;gap:12px;font-size:11px}
.pl-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;border:1px solid var(--hair);color:var(--mu)}
.pl-live{display:inline-flex;align-items:center;gap:6px;color:var(--ok);font-weight:700;letter-spacing:1.2px}.pl-live.pl-lost{color:var(--bad)}
.pl-ago{color:var(--dim)}.pl-fs{color:var(--dim);display:inline-flex;background:transparent;border:0;padding:4px;cursor:pointer;border-radius:6px}.pl-fs:hover{color:var(--tx)}.pl-fs:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.pl-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}.pl-ok{background:var(--ok)}.pl-run{background:var(--run)}.pl-wait{background:var(--wait)}.pl-bad{background:var(--bad)}.pl-warn{background:var(--warn)}
.pl-beat{animation:pl-beat 2s ease-out infinite}
@keyframes pl-beat{0%{box-shadow:0 0 0 0 rgba(52,211,153,.45)}70%{box-shadow:0 0 0 7px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}
@media (prefers-reduced-motion:reduce){.pl-beat{animation:none}}
.pl-today{display:grid;grid-template-columns:1.55fr repeat(4,1fr);background:var(--sf);border:1px solid var(--hair);border-radius:14px;flex-shrink:0}
.pl-tc{padding:14px 18px 8px;display:flex;flex-direction:column;gap:4px;min-width:0;overflow:hidden}.pl-tc+.pl-tc{border-left:1px solid var(--hair)}
.pl-tl{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mu);font-weight:600;display:flex;justify-content:space-between;align-items:center;gap:6px}
.pl-vs{letter-spacing:0;text-transform:none;font-weight:500;color:var(--dim);font-size:11px;white-space:nowrap}
.pl-d{font-weight:700;margin-right:2px}.pl-up{color:var(--ok)}.pl-down{color:var(--bad)}.pl-flat{color:var(--dim)}
.pl-val{font-size:34px;font-weight:700;letter-spacing:-.02em;line-height:1.1;color:var(--tx)}
.pl-pv{display:flex;align-items:baseline;gap:14px}.pl-ppl .pl-val{font-size:46px}
.pl-pn{font-size:30px;font-weight:700;color:var(--ok);letter-spacing:-.02em;line-height:1}.pl-pn small{font-family:Outfit,system-ui,sans-serif;font-size:12px;font-weight:500;color:var(--mu);margin-left:6px;letter-spacing:0}
.pl-sp{width:100%;height:56px;display:block;margin-top:6px}.pl-sp-g{stroke:rgba(255,255,255,.07);stroke-width:1}.pl-sp-a{fill:var(--c);opacity:.16}.pl-sp-l{fill:none;stroke:var(--c);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}.pl-sp-d{fill:var(--c);stroke:var(--sf);stroke-width:2}
.pl-ax{display:flex;justify-content:space-between;font-size:9.5px;color:var(--dim);font-family:'JetBrains Mono',monospace;margin-top:2px}
.pl-ppl{--c:#e4e2dd}.pl-rev{--c:var(--ok)}.pl-pro{--c:#a7f3d0}.pl-ord{--c:var(--ac)}.pl-dep{--c:var(--wait)}
.pl-mid{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:10px;flex:1;min-height:0}
.pl-list{background:var(--sf);border:1px solid var(--hair);border-radius:14px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.pl-rows{overflow:auto;min-height:0;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.12) transparent}
.pl-list header,.pl-month header,.pl-bar header{display:flex;justify-content:space-between;align-items:baseline;padding:10px 14px 8px;border-bottom:1px solid var(--hair)}
.pl-list h3,.pl-month h3,.pl-bar h3{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mu);font-weight:600}.pl-cnt{font-size:11px;color:var(--dim)}
.pl-row{display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--hair);font-size:12.5px;min-width:0}.pl-row:first-child{border-top:0}
.pl-t{color:var(--dim);font-size:11px;width:28px;flex-shrink:0}.pl-who{font-weight:600;flex:0 0 auto;white-space:nowrap}
.pl-what{flex:1;min-width:0;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pl-what em{display:block;font-style:normal;font-size:11px;color:var(--dim)}
.pl-amt{flex-shrink:0;font-weight:600;font-size:12px}.pl-in{color:var(--ok)}.pl-out{color:var(--bad)}
.pl-via{font-weight:600}.pl-via-flutterwave{color:var(--wait)}.pl-via-manual{color:var(--run)}.pl-via-alatpay{color:#a78bfa}.pl-via-monnify{color:#f472b6}.pl-via-admin_credit{color:var(--ac)}.pl-via-wallet{color:var(--mu)}
.pl-two{align-items:flex-start}.pl-two .pl-t,.pl-two .pl-who{padding-top:2px}
.pl-empty{padding:18px 14px;font-size:12px;color:var(--dim)}
.pl-bot{display:grid;grid-template-columns:1.6fr 1fr;gap:10px;flex-shrink:0}
.pl-month,.pl-bar{background:var(--sf);border:1px solid var(--hair);border-radius:14px;min-width:0}
.pl-mfs{display:grid;grid-template-columns:repeat(5,1fr)}.pl-mf{padding:9px 14px;border-left:1px solid var(--hair)}.pl-mf:first-child,.pl-mf:nth-child(6){border-left:0}.pl-mf:nth-child(n+6){border-top:1px solid var(--hair)}
.pl-mv{font-size:15px;font-weight:700;letter-spacing:-.01em}.pl-ml{font-size:11px;color:var(--mu);margin-top:2px}
.pl-bars{display:grid;grid-template-rows:1fr 1fr;gap:10px}
.pl-stack{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:12px 14px 8px;background:rgba(255,255,255,.05);gap:2px}.pl-stack i{display:block;height:100%}
.pl-leg{display:flex;flex-wrap:wrap;gap:4px 12px;padding:0 14px 10px;font-size:11px;color:var(--mu)}.pl-leg b{color:var(--tx);font-weight:600;margin-left:2px}.pl-sw{width:7px;height:7px;border-radius:2px;display:inline-block;margin-right:5px}
.pl-p0{background:var(--ac)}.pl-p1{background:#e4e2dd}.pl-p2{background:var(--run)}.pl-p3{background:#8ea3ff}.pl-p4{background:var(--bad)}.pl-p5{background:#c9ccd6}
.pl-stack .pl-ok,.pl-sw.pl-ok{background:var(--ok)}.pl-stack .pl-bad,.pl-sw.pl-bad{background:var(--bad)}.pl-stack .pl-run,.pl-sw.pl-run{background:var(--run)}.pl-stack .pl-warn,.pl-sw.pl-warn{background:var(--warn)}.pl-stack .pl-wait,.pl-sw.pl-wait{background:var(--wait)}
@media (max-width:768px){
  .pl{height:auto;min-height:100dvh;overflow:auto;padding:14px 14px 24px}
  .pl-fs{display:none}
  .pl-today{grid-template-columns:1fr 1fr}.pl-ppl{grid-column:1/-1}.pl-tc+.pl-tc{border-left:0}.pl-tc:nth-child(3),.pl-tc:nth-child(5){border-left:1px solid var(--hair)}.pl-tc:nth-child(n+2){border-top:1px solid var(--hair)}
  .pl-val{font-size:24px}.pl-ppl .pl-val{font-size:40px}.pl-pn{font-size:26px}.pl-sp{height:44px}
  .pl-mid{grid-template-columns:1fr;flex:none}.pl-list{flex:none}.pl-rows{overflow:visible}
  .pl-bot{grid-template-columns:1fr}
  .pl-mfs{grid-template-columns:1fr 1fr}.pl-mf{border-left:0}.pl-mf:nth-child(even){border-left:1px solid var(--hair)}.pl-mf:nth-child(n+3){border-top:1px solid var(--hair)}
  .pl-bars{grid-template-rows:none}
}
`;
