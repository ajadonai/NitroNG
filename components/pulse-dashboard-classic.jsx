'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useT } from "./locale";
import NitroLoader from './nitro-loader';
import { NitroWordmark } from './nitro-logo';
import { platformBrand } from '@/lib/platform-brand';
import { naira } from './pulse-dashboard';

// Pulse classic: the office screen as it was until 17 Oct 2026, kept so the
// upgraded screen can be rolled back without a deploy. Open it at
// /pulse?view=classic. It reads the same /api/pulse payload, which only grew.
//
// People first, today's figures on their own day lines, three lists for what
// is happening, one row of facts for the month.
// Colour means something: green is money in and done, amber is waiting, red is
// out or cancelled, the accent is orders. Built 1:1 from the approved mock.

// One number for how often the data reloads, so the countdown strip and the
// fetch it is counting down to can never disagree about the interval.
const REFRESH_MS = 30_000;
const REFRESH_SECONDS = REFRESH_MS / 1000;

const num = (n) => Math.round(n || 0).toLocaleString('en-NG');
function ago(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
const METHODS = { flutterwave: 'Flutterwave', manual: 'Bank transfer', alatpay: 'ALATPay', monnify: 'Monnify', wallet: 'Wallet', admin_credit: 'Admin credit' };
// Never a code on the screen. The route sends reasons already in words (lib/refund-reasons);
// this is the last guard for anything that slips through.
const words = (v) => { const t = String(v || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; };
const said = (v) => (v && /_/.test(v) ? words(v) : v);
const method = (m) => METHODS[m] || (m ? words(m) : 'Wallet');
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
  const tr = useT();
  return <div className="pl-ax"><span>00:00</span><span>06:00</span><span>12:00</span><span>{String(nowHour).padStart(2, '0')}:00 {tr("now")}</span></div>;
}

function Figure({ kind, label, value, delta, series, nowHour, note }) {
  const tr = useT();
  return (
    <div className={`pl-tc pl-${kind}`}>
      <div className="pl-tl">{label}<span className="pl-vs"><Delta value={delta} /> {tr("vs yesterday")}</span></div>
      <div className="pl-val m">{value}{note ? <span className="pl-note">{note}</span> : null}</div>
      <DayLine values={series} />
      <Axis nowHour={nowHour} />
    </div>
  );
}

function People({ data }) {
  const tr = useT();
  const y = data.newUsersYesterday || 0;
  const change = y === 0 ? (data.newUsersToday > 0 ? null : 0) : Math.round(((data.newUsersToday - y) / y) * 100);
  return (
    <div className="pl-tc pl-ppl">
      <div className="pl-tl">{tr("People")}<span className="pl-vs"><Delta value={change} /> {tr("vs yesterday’s")} {y}</span></div>
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
  const tr = useT();
  return (
    <section className="pl-list">
      <ListHead title={tr("Live")} sub={`${num(data.ordersToday)} today · ${num(data.processing)} running`} />
      <div className="pl-rows">
        {(data.recentOrders || []).map(o => (
          <div className={`pl-row${o.status === 'Cancelled' ? ' pl-two' : ''}`} key={o.id}>
            <span className="pl-t m">{ago(o.created)}</span>
            <span className="pl-who">{o.user}{o.source === 'api' && <b className="pl-api m">API</b>}</span>
            <span className="pl-what">{o.service}{o.tier ? ` · ${o.tier}` : ''}{o.status === 'Cancelled' && <em>{said(o.cancelReason) || 'Cancelled'}</em>}</span>
            <span className="pl-amt m">{naira(o.charge)}</span>
            <i className={`pl-dot pl-${DOT[o.status] || 'wait'}`} title={o.status} />
          </div>
        ))}
        {!(data.recentOrders || []).length && <div className="pl-empty">{tr("No orders yet today")}</div>}
      </div>
    </section>
  );
}
function MoneyIn({ data }) {
  const tr = useT();
  return (
    <section className="pl-list">
      <ListHead title={tr("Money in")} sub={`${naira(data.depositsToday)} today`} />
      <div className="pl-rows">
        {(data.recentDeposits || []).map(d => (
          <div className="pl-row" key={d.id}>
            <span className="pl-t m">{ago(d.created)}</span>
            <span className="pl-who">{d.user}</span>
            <span className={`pl-what pl-via pl-via-${String(d.method || 'wallet').toLowerCase().replace(/[^a-z_]/g, '')}`}>{method(d.method)}</span>
            <span className="pl-amt m pl-in">+{naira(d.amount)}</span>
          </div>
        ))}
        {!(data.recentDeposits || []).length && <div className="pl-empty">{tr("No deposits yet today")}</div>}
      </div>
    </section>
  );
}
function Refunds({ data }) {
  const tr = useT();
  const list = data.recentRefunds || [];
  const today = data.refundsToday || { count: 0, total: 0 };
  return (
    <section className="pl-list">
      <ListHead title={tr("Refunds")} sub={today.count ? `${naira(today.total)} today · ${num(today.count)}` : tr("None today")} />
      <div className="pl-rows">
        {list.map(r => (
          <div className="pl-row pl-two" key={r.id}>
            <span className="pl-t m">{ago(r.refundedAt)}</span>
            <span className="pl-who">{r.user}</span>
            <span className="pl-what">{r.service}{r.tier ? ` · ${r.tier}` : ''}<em>{(r.status === 'Partial' || (r.remains > 0 && r.remains < r.quantity)) ? `Partial, ${num(r.remains)} of ${num(r.quantity)} not delivered` : (said(r.reason) || 'Cancelled')}</em></span>
            <span className="pl-amt m pl-out">−{naira(r.refunded)}</span>
          </div>
        ))}
        {!list.length && <div className="pl-empty">{tr("Nothing refunded recently")}</div>}
      </div>
    </section>
  );
}

function Month({ data }) {
  const tr = useT();
  const markup = data.monthCost > 0 ? Math.round((data.monthProfit / data.monthCost) * 100) : 0;
  const avg = data.monthOrders > 0 ? data.monthRevenue / data.monthOrders : 0;
  const repeat = data.monthActiveUsers > 0 ? Math.round(((data.monthRepeatUsers || 0) / data.monthActiveUsers) * 100) : 0;
  const payouts = Object.values(data.monthPayouts || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const statusTotal = (data.byStatus || []).reduce((s, i) => s + i.count, 0);
  const cancelled = (data.byStatus || []).reduce((s, i) => (['Cancelled', 'Failed', 'Rejected'].includes(i.status) ? s + i.count : s), 0);
  const cancelRate = statusTotal > 0 ? Math.round((cancelled / statusTotal) * 100) : 0;
  const d = new Date(); const monthName = d.toLocaleDateString('en-NG', { month: 'long', timeZone: 'Africa/Lagos' }); const day = Number(d.toLocaleDateString('en-NG', { day: 'numeric', timeZone: 'Africa/Lagos' }));
  // Same grid as always, in an order that keeps relatives side by side: money, then orders, then people and wallets.
  const facts = [
    ['Revenue', naira(data.monthNetRevenue ?? data.monthRevenue)], ['Cost', naira(data.monthCost)], ['Profit', naira(data.monthProfit)], ['Markup', `${markup}%`], ['Refunds', naira(data.monthRefunds || 0)],
    ['Orders', num(data.monthOrders)], ['Avg order', naira(avg)], ['Cancel rate', `${cancelRate}%`], ['Repeat buyers', `${repeat}%`], ['New people', num(data.monthNewUsers)],
    ['Deposits', naira(data.monthDeposits)], ['Depositors', num(data.monthDepositors)], ['Idle wallets', num(data.idleUsersWithBalance)], ['Bonuses', naira(data.welcomeBonus?.total || 0)], ['Payouts', naira(payouts)],
  ];
  return (
    <section className="pl-month">
      <header><h3>{tr("This month")}</h3><span className="pl-cnt">1{tr(" to ")}{day} {monthName}</span></header>
      <div className="pl-mfs">{facts.map(([l, v]) => <div className="pl-mf" key={l}><div className="pl-mv m">{v}</div><div className="pl-ml">{l}</div></div>)}</div>
    </section>
  );
}

const STATUS_ORDER = ['Completed', 'Cancelled', 'Processing', 'Partial', 'Pending', 'Refunded'];
const STATUS_CLS = { Completed: 'ok', Cancelled: 'bad', Processing: 'run', Partial: 'warn', Pending: 'wait', Refunded: 'bad' };
function Bars({ data }) {
  const tr = useT();
  const plats = data.topPlatforms || []; const ptot = plats.reduce((s, p) => s + p.orders, 0) || 1;
  // TikTok and X are both ink; two neighbours in one colour read as one platform.
  const ALT = ['#7aa2f7', '#e0a458', '#a78bfa', '#34d399', '#f472b6'];
  const used = new Set(); let alt = 0;
  const colour = plats.map((p, i) => { let c = platformBrand(p.name, { index: i }); if (used.has(c)) c = ALT[alt++ % ALT.length]; used.add(c); return c; });
  const merged = {};
  // Failed and Rejected count as cancelled. Compared as raw statuses through the
  // tables above: the translated words this used never matched off English.
  (data.byStatus || []).forEach(s => { const k = !STATUS_ORDER.includes(s.status) && DOT[s.status] === 'bad' ? STATUS_ORDER[1] : s.status; merged[k] = (merged[k] || 0) + s.count; });
  const stats = STATUS_ORDER.filter(k => merged[k]).map(k => [k, merged[k], STATUS_CLS[k] || 'wait']);
  const stot = stats.reduce((s, [, c]) => s + c, 0) || 1;
  return (
    <section className="pl-bars">
      <div className="pl-bar">
        <header><h3>{tr("Platforms")}</h3><span className="pl-cnt">{tr("this month")}</span></header>
        <div className="pl-stack">{plats.map((p, i) => <i key={p.name} style={{ width: `${(p.orders / ptot) * 100}%`, background: colour[i] }} />)}</div>
        <div className="pl-leg">{plats.map((p, i) => <span key={p.name}><i className="pl-sw" style={{ background: colour[i] }} />{p.name} <b className="m">{Math.round((p.orders / ptot) * 100)}%</b></span>)}</div>
      </div>
      <div className="pl-bar">
        <header><h3>{tr("Order status")}</h3><span className="pl-cnt">{tr("30 days")}</span></header>
        <div className="pl-stack">{stats.map(([k, c, cls]) => <i key={k} style={{ width: `${(c / stot) * 100}%` }} className={`pl-${cls}`} />)}</div>
        <div className="pl-leg">{stats.map(([k, c, cls]) => <span key={k}><i className={`pl-sw pl-${cls}`} />{k} <b className="m">{Math.round((c / stot) * 100)}%</b></span>)}</div>
      </div>
    </section>
  );
}

export default function PulseClassic() {
  const tr = useT();
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
  useEffect(() => { fetchData(); const iv = setInterval(fetchData, REFRESH_MS); return () => clearInterval(iv); }, [fetchData]);
  useEffect(() => { const iv = setInterval(() => setSecondsAgo(s => s + 1), 1000); return () => clearInterval(iv); }, []);
  // The strip is driven by how long it has actually been, not by an animation
  // of its own, so it cannot drift away from the data underneath it. It also
  // means a fetch that hangs parks the bar full instead of looping cheerfully
  // while the numbers go stale.
  const tickPercent = Math.min(100, (secondsAgo / REFRESH_SECONDS) * 100);

  if (!data) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0e17', fontFamily: 'Outfit, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <NitroLoader size={72} />
          <div style={{ color: '#5c6170', fontSize: 11 }}>{tr("Connecting to live data…")}</div>
        </div>
      </div>
    );
  }
  const H = data.todayHours || [];
  const nowHour = data.nowHour || 0;
  return (
    <div ref={containerRef} className="pl">
      <style>{CSS}</style>
      {/* Counts down to the next refresh, pinned to the very top edge of the
          screen — where a browser puts its own progress, and where the
          navigation strip this borrows its colours from sits.

          Unlike that strip, this one is allowed to actually arrive: the nav bar
          creeps and never reaches the end because nobody knows how long a chunk
          takes, which would be a lie to tell about a fixed interval. */}
      <div className="pl-tick" aria-hidden="true"><i style={{ width: `${tickPercent}%` }} /></div>
      <header className="pl-top">
        <div className="pl-brand"><span className="pl-mark"><NitroWordmark height={11} color="#fff" /></span><h1>Pulse</h1></div>
        <div className="pl-state">
          {data.processing > 0 && <span className="pl-chip"><i className="pl-dot pl-run" />{num(data.processing)} running</span>}
          {error
            ? <span className="pl-live pl-lost"><i className="pl-dot pl-bad" />{tr("CONNECTION LOST")}</span>
            : <span className="pl-live"><i className="pl-dot pl-ok pl-beat" />LIVE</span>}
          <span className="pl-ago m">{secondsAgo}s</span>
          <button type="button" onClick={toggleFullscreen} className="pl-fs" aria-label={isFullscreen ? tr("Exit fullscreen") : tr("Fullscreen")}>
            {isFullscreen
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /></svg>}
          </button>
        </div>
      </header>

      <section className="pl-today">
        <People data={data} />
        <Figure kind="rev" label={tr("Revenue")} value={naira(data.revenueToday)} delta={data.revenueChange} series={H.map(h => h.revenue)} nowHour={nowHour} />
        <Figure kind="pro" label={tr("Profit")} value={naira(data.profitToday)} note={data.costToday > 0 ? `${Math.round((data.profitToday / data.costToday) * 100)}% on cost` : null} delta={data.profitChange} series={H.map(h => h.profit)} nowHour={nowHour} />
        <Figure kind="ord" label={tr("Orders")} value={num(data.ordersToday)} delta={data.ordersChange} series={H.map(h => h.orders)} nowHour={nowHour} />
        <Figure kind="dep" label={tr("Deposits")} value={naira(data.depositsToday)} delta={data.depositsChange} series={H.map(h => h.deposits)} nowHour={nowHour} />
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
  height:100dvh;background:var(--bg);color:var(--tx);font-family:Outfit,system-ui,sans-serif;padding:14px 18px;display:flex;flex-direction:column;gap:10px;box-sizing:border-box;overflow:hidden;position:relative}
.pl h1,.pl h3{margin:0}
.pl .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.pl-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0}
/* The real wordmark on the brand gradient, the same pill the nav and the
   dashboard use. This was a Cormorant capital N in a rounded square — a letter
   set in a text face, not the mark. */
.pl-brand{display:flex;align-items:center;gap:10px}
.pl-mark{height:22px;padding:0 9px;border-radius:999px;background:linear-gradient(135deg,#c47d8e,#8b5e6b);display:inline-flex;align-items:center;justify-content:center}
/* Four colours, taken from the Nitro loading mark rather than picked here, in
   the mark's own draw order: pink leads and the echoes trail behind it. The
   gradient is sized to the strip, not the track, so compressing as the bar
   grows keeps pink on the leading edge. Matches app/globals.css .nitro-navbar.

   Absolute against .pl rather than inside the header, so it spans the screen
   edge to edge across the page's own padding and sits at the very top where a
   browser draws progress. */
.pl-tick{position:absolute;top:0;left:0;right:0;height:3px;background:var(--hair);overflow:hidden;z-index:5}
.pl-tick i{display:block;height:100%;background:linear-gradient(90deg,#ecc94b 0%,#34a97b 14%,#e05252 30%,#c47d8e 58%,#c47d8e 100%);background-size:100% 100%;background-repeat:no-repeat;transition:width 1s linear}
@media (prefers-reduced-motion:reduce){.pl-tick i{transition:none}}
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
.pl-val{font-size:34px;font-weight:700;letter-spacing:-.02em;line-height:1.1;color:var(--tx)}.pl-note{font-family:Outfit,system-ui,sans-serif;font-size:12px;font-weight:600;letter-spacing:0;opacity:.55;margin-left:8px;white-space:nowrap}
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
.pl-t{color:var(--dim);font-size:11px;width:28px;flex-shrink:0}.pl-who{font-weight:600;flex:0 0 auto;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}
.pl-api{font-size:9.5px;font-weight:700;letter-spacing:.6px;padding:1px 5px;border-radius:4px;color:var(--run);box-shadow:inset 0 0 0 1px rgba(122,162,247,.45);line-height:1.3}
.pl-what{flex:1;min-width:0;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pl-what em{display:block;font-style:normal;font-size:11px;color:var(--dim)}
.pl-amt{flex-shrink:0;font-weight:600;font-size:12px}.pl-in{color:var(--ok)}.pl-out{color:var(--bad)}
.pl-via{font-weight:600}.pl-via-flutterwave{color:var(--wait)}.pl-via-manual{color:var(--run)}.pl-via-alatpay{color:#a78bfa}.pl-via-monnify{color:#f472b6}.pl-via-admin_credit{color:var(--ac)}.pl-via-wallet{color:var(--mu)}
.pl-two{align-items:flex-start}.pl-two .pl-t,.pl-two .pl-who{padding-top:2px}
.pl-empty{padding:18px 14px;font-size:12px;color:var(--dim)}
.pl-bot{display:grid;grid-template-columns:1.6fr 1fr;gap:10px;flex-shrink:0}
.pl-month,.pl-bar{background:var(--sf);border:1px solid var(--hair);border-radius:14px;min-width:0}
.pl-mfs{display:grid;grid-template-columns:repeat(5,1fr)}.pl-mf{padding:9px 14px;border-left:1px solid var(--hair)}.pl-mf:nth-child(5n+1){border-left:0}.pl-mf:nth-child(n+6){border-top:1px solid var(--hair)}
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
