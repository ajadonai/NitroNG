'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useT } from "./locale";
import NitroLoader from './nitro-loader';
import { NitroWordmark } from './nitro-logo';
import { platformBrand } from '@/lib/platform-brand';
import { msg } from '../lib/i18n';

// Pulse, upgraded (17 Oct 2026, from the approved mock). One question leads
// the wall: are we ahead of yesterday? Today's revenue runs as a line against
// yesterday's at the same hour, dotted on to midnight. Around it: one stream of
// everything happening, what is still running, what needs a person, what is
// selling, and the month against last month. Colour means something: green is
// money in and done, amber is waiting, red is out or cancelled, the accent is
// orders, blue is running.
//
// The screen before this lives on as components/pulse-dashboard-classic.jsx,
// at /pulse?view=classic.

// One number for how often the data reloads, so the countdown strip and the
// fetch it is counting down to can never disagree about the interval.
const REFRESH_MS = 30_000;
const REFRESH_SECONDS = REFRESH_MS / 1000;

export const naira = (n) => `${n < 0 ? '−' : ''}₦${Math.round(Math.abs(n)).toLocaleString('en-NG')}`;
const num = (n) => Math.round(n || 0).toLocaleString('en-NG');
// ₦4.21m and ₦318k, for figures that sit beside a bar rather than in a ledger.
const short = (n) => {
  const a = Math.abs(n || 0), s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}₦${(a / 1e6).toFixed(2)}m`;
  if (a >= 1e4) return `${s}₦${Math.round(a / 1e3)}k`;
  return naira(n || 0);
};
function ago(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
const hm = (mins) => (mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`);
const pct = (now, then) => (then > 0 ? Math.round(((now - then) / then) * 100) : null);
// Never a code on the screen. The route sends reasons in words (lib/refund-reasons);
// this is the last guard for anything that slips through.
const words = (v) => { const t = String(v || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; };
const said = (v) => (v && /_/.test(v) ? words(v) : v);
const METHODS = { flutterwave: 'Flutterwave', manual: msg('Bank transfer'), alatpay: 'ALATPay', monnify: 'Monnify', wallet: msg('Wallet'), admin_credit: msg('Admin credit') };
const AGE_COLOURS = ['var(--ok)', 'var(--run)', 'var(--wait)', 'var(--bad)'];
const ALT = ['#7aa2f7', '#e0a458', '#a78bfa', '#34d399', '#f472b6'];
// Raw order statuses that count as cancelled in the month's cancel rate.
const CANCELLED = { Cancelled: true, Failed: true, Rejected: true };
const KIND = { order: [msg('Order'), 'pl-k-order'], in: [msg('In'), 'pl-k-in'], out: [msg('Out'), 'pl-k-out'], new: [msg('New'), 'pl-k-new'] };

/** Distinct colours for a row of platforms: TikTok and X are both ink, and two neighbours in one colour read as one. */
function coloursFor(names) {
  const used = new Set(); let alt = 0;
  return names.map((n, i) => { let c = platformBrand(n, { index: i }); if (used.has(c)) c = ALT[alt++ % ALT.length]; used.add(c); return c; });
}

// One key per stream row, shared by the stream and the fetch that spots new rows.
const streamKeys = (d) => [
  ...(d.recentOrders || []).map(o => `o${o.id}`),
  ...(d.recentDeposits || []).map(t => `d${t.id}`),
  ...(d.recentRefunds || []).map(r => `r${r.id}${r.refundedAt}`),
  ...(d.recentSignups || []).map(u => `u${u.id}`),
];

function Delta({ value, label }) {
  if (value === null || value === undefined) return null;
  return <span className={`pl-dl ${value >= 0 ? 'pl-up' : 'pl-down'}`}>{value >= 0 ? '+' : ''}{value}%<span>{label}</span></span>;
}

/** Today's revenue as a running total against yesterday's, with the pace on to midnight. */
function Pace({ data }) {
  const tr = useT();
  const H = data.todayHours || [];
  const nowHour = data.nowHour || 0, nowMin = data.nowMinute || 0;
  const yh = data.pace?.yesterdayHours || [];
  const ySoFar = data.pace?.soFar?.revenue ?? 0;
  const yTotal = data.pace?.yesterdayTotal ?? 0;
  const today = data.revenueToday || 0;
  const ahead = today - ySoFar;
  const projection = ySoFar > 0 && yTotal > 0 ? (today / ySoFar) * yTotal : null;
  const nowX = (nowHour + nowMin / 60) / 24;
  // Running totals: midnight to now for today, the whole of yesterday.
  const tPts = [[0, 0]]; let run = 0;
  H.forEach((h, i) => { run += h.revenue || 0; tPts.push([i === H.length - 1 ? nowX : (i + 1) / 24, run]); });
  tPts[tPts.length - 1][1] = today;
  const yPts = [[0, 0]]; let yr = 0;
  yh.forEach((v, i) => { yr += v; yPts.push([(i + 1) / 24, yr]); });
  const max = Math.max(yr, projection || 0, today, 1) * 1.08;
  const W = 1000, HH = 200;
  const X = (f) => f * W, Y = (v) => HH - (v / max) * (HH - 6);
  const P = (pts) => pts.map(([f, v]) => `${X(f).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const up = ahead >= 0;
  const at = `${String(nowHour).padStart(2, '0')}:${String(nowMin).padStart(2, '0')}`;
  return (
    <section className="pl-card pl-pace">
      <div className="pl-pace-head">
        <div>
          <h3>{tr("Revenue today")}</h3>
          <div className="pl-pace-big">
            <b className="m">{naira(today)}</b>
            {data.pace && (
              <span className={`pl-ahead ${up ? 'pl-up' : 'pl-down'}`}>
                <span className="m">{up ? '+' : ''}{naira(ahead)}</span> {up ? tr("ahead of this time yesterday") : tr("behind this time yesterday")}
                <small>{tr("Yesterday by")} {at}: <span className="m">{naira(ySoFar)}</span></small>
              </span>
            )}
          </div>
        </div>
        {projection !== null && (
          <div className="pl-proj"><small>{tr("On pace for")}</small><b className="m">{short(projection)}</b><span>{tr("Yesterday closed at")} {short(yTotal)}</span></div>
        )}
      </div>
      <div className="pl-chart">
        <svg viewBox={`0 0 ${W} ${HH}`} preserveAspectRatio="none" aria-hidden="true">
          {[6, 12, 18].map(h => <line key={h} x1={X(h / 24)} y1="0" x2={X(h / 24)} y2={HH} className="pl-grid" />)}
          {yPts.length > 1 && <polyline points={P(yPts)} className="pl-yline" />}
          <polygon points={`${P(tPts)} ${X(nowX).toFixed(1)},${HH} 0,${HH}`} className="pl-tarea" />
          <polyline points={P(tPts)} className="pl-tline" />
          {projection !== null && <line x1={X(nowX)} y1={Y(today)} x2={W} y2={Y(projection)} className="pl-pline" />}
          <line x1={X(nowX)} y1="0" x2={X(nowX)} y2={HH} className="pl-now" />
        </svg>
        {data.pace && <i className="pl-dot-y" style={{ left: `${nowX * 100}%`, top: `${(Y(ySoFar) / HH) * 100}%` }} />}
        <i className="pl-dot-now" style={{ left: `${nowX * 100}%`, top: `${(Y(today) / HH) * 100}%` }} />
        {/* Top left is always empty: both lines are running totals from zero. */}
        <div className="pl-legend"><span><i className="pl-lg-t" />{tr("Today")}</span><span><i className="pl-lg-y" />{tr("Yesterday")}</span>{projection !== null && <span><i className="pl-lg-p" />{tr("Pace to midnight")}</span>}</div>
      </div>
      <div className="pl-ax m"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
    </section>
  );
}

function Spark({ values, colour }) {
  const vals = values.length > 1 ? values : [0, ...values, 0].slice(0, 2);
  const w = 300, h = 46, mx = Math.max(...vals, 1), st = w / (vals.length - 1);
  const pts = vals.map((v, i) => `${(i * st).toFixed(1)},${(h - 3 - (Math.max(v, 0) / mx) * (h - 8)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="pl-spark" aria-hidden="true">
      <polygon points={`0,${h} ${pts} ${w},${h}`} style={{ fill: colour }} className="pl-spark-a" />
      <polyline points={pts} style={{ stroke: colour }} className="pl-spark-l" />
    </svg>
  );
}

function Tile({ label, value, note, delta, series, colour }) {
  const tr = useT();
  return (
    <div className="pl-card pl-tile">
      <div className="pl-tile-h"><h3>{label}</h3><Delta value={delta} label={tr("vs this time yesterday")} /></div>
      <div className="pl-tile-v m">{value}{note ? <small>{note}</small> : null}</div>
      <Spark values={series} colour={colour} />
    </div>
  );
}

/** Orders, money in, refunds and sign-ups in one feed, newest first. */
function Stream({ data, fresh }) {
  const tr = useT();
  const keys = streamKeys(data);
  let k = 0;
  const events = [
    ...(data.recentOrders || []).map(o => ({ key: keys[k++], at: o.created, kind: 'order', who: o.user, api: o.source === 'api', what: `${o.service}${o.tier ? ` · ${o.tier}` : ''}`, note: o.status === 'Cancelled' ? (said(o.cancelReason) || tr("Cancelled")) : null, amt: o.charge })),
    ...(data.recentDeposits || []).map(d => ({ key: keys[k++], at: d.created, kind: 'in', who: d.user, what: METHODS[d.method] ? tr(METHODS[d.method]) : (words(d.method) || tr("Wallet")), amt: d.amount })),
    ...(data.recentRefunds || []).map(r => ({ key: keys[k++], at: r.refundedAt, kind: 'out', who: r.user, what: `${r.service}${r.tier ? ` · ${r.tier}` : ''}`, note: (r.status === 'Partial' || (r.remains > 0 && r.remains < r.quantity)) ? `${tr("Partial")}, ${num(r.remains)} ${tr("of")} ${num(r.quantity)} ${tr("not delivered")}` : (said(r.reason) || tr("Cancelled")), amt: r.refunded })),
    ...(data.recentSignups || []).map(u => ({ key: keys[k++], at: u.created, kind: 'new', who: u.user, what: u.referredBy ? `${tr("Referred by")} ${u.referredBy}` : tr("Signed up") })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 30);
  return (
    <section className="pl-card pl-stream">
      <header><h3>{tr("Now")}</h3><span className="pl-cnt"><b className="m">{num(data.ordersToday)}</b> {tr("orders today")} <b className="m pl-in">+{short(data.depositsToday)}</b> <b className="m pl-out">−{short(data.refundsToday?.total || 0)}</b></span></header>
      <div className="pl-rows">
        {events.map(e => {
          const [label, cls] = KIND[e.kind];
          return (
            <div className={`pl-ev${fresh.has(e.key) ? ' pl-fresh' : ''}`} key={e.key}>
              <span className="pl-t m">{ago(e.at)}</span>
              <span className={`pl-kind ${cls}`}>{tr(label)}</span>
              <span className="pl-what"><b><span>{e.who}</span>{e.api && <i className="pl-api m">API</i>}</b><span>{e.what}{e.note ? ` · ${e.note}` : ''}</span></span>
              <span className={`pl-amt m${e.kind === 'in' ? ' pl-in' : e.kind === 'out' ? ' pl-out' : ''}`}>{e.amt ? `${e.kind === 'in' ? '+' : e.kind === 'out' ? '−' : ''}${naira(e.amt)}` : ''}</span>
            </div>
          );
        })}
        {!events.length && <div className="pl-empty">{tr("Nothing yet today")}</div>}
      </div>
    </section>
  );
}

/** What is still running, how long it has been, and what needs a person. */
function Running({ data }) {
  const tr = useT();
  const r = data.running || { pending: 0, processing: data.processing || 0, drip: 0, ages: [0, 0, 0, 0], oldest: null };
  const total = r.ages.reduce((a, b) => a + b, 0);
  const at = data.attention || {};
  const tf = at.transfers || { count: 0, total: 0 };
  const bal = at.balance;
  const low = bal && bal.usd < 10;
  const quiet = !tf.count && !at.refills && !low;
  return (
    <section className="pl-card pl-run">
      <header><h3>{tr("Still running")}</h3><span className="pl-cnt m">{num(r.pending + r.processing)}</span></header>
      <div className="pl-run-body">
        <div className="pl-sts">
          <div><b className="m pl-c-wait">{num(r.pending)}</b><span><i className="pl-dot pl-wait" />{tr("Pending")}</span></div>
          <div><b className="m pl-c-run">{num(r.processing)}</b><span><i className="pl-dot pl-run-d" />{tr("Processing")}</span></div>
          <div><b className="m pl-c-mu">{num(r.drip)}</b><span><i className="pl-dot pl-mu" />{tr("On drip-feed")}</span></div>
        </div>
        {total > 0 && (
          <div className="pl-age">
            <small>{tr("How long they have been running")}</small>
            <div className="pl-agebar">{r.ages.map((a, i) => (a ? <i key={i} style={{ width: `${(a / total) * 100}%`, background: AGE_COLOURS[i] }} /> : null))}</div>
            <div className="pl-agel m"><span>{tr("under 1h")} <b>{r.ages[0]}</b></span><span>1–3h <b>{r.ages[1]}</b></span><span>3–6h <b>{r.ages[2]}</b></span><span>6h+ <b>{r.ages[3]}</b></span></div>
          </div>
        )}
        {r.oldest && <div className="pl-oldest">{tr("Oldest still going")} <b className="m">{hm(r.oldest.minutes)}</b> <span className="m">{r.oldest.id}</span></div>}
      </div>
      <div className="pl-attn">
        <h3>{tr("Needs a person")}</h3>
        {tf.count > 0 && <div className="pl-at pl-at-w"><b className="m">{tf.count}</b><span>{tf.count === 1 ? tr("bank transfer to approve") : tr("bank transfers to approve")} <span className="m pl-at-v">{naira(tf.total)}</span></span></div>}
        {at.refills > 0 && <div className="pl-at pl-at-w"><b className="m">{at.refills}</b><span>{at.refills === 1 ? tr("refill to do by hand") : tr("refills to do by hand")}</span></div>}
        {bal && (low
          ? <div className="pl-at pl-at-r"><b className="m">${bal.usd.toFixed(0)}</b><span>{tr("left with a supplier, top up")}</span></div>
          : <div className="pl-at pl-at-mu"><b className="m">${bal.usd.toFixed(0)}</b><span>{tr("lowest supplier balance")}</span></div>)}
        {quiet && <div className="pl-at pl-at-ok"><b>✓</b><span>{tr("Nothing waiting")}</span></div>}
      </div>
    </section>
  );
}

function Selling({ data }) {
  const tr = useT();
  const list = data.sellingToday || [];
  const top = Math.max(...list.map(s => s.orders), 1);
  const colours = coloursFor(list.map(s => s.platform || ''));
  const plats = data.platformsToday || [];
  const ptot = plats.reduce((s, p) => s + p.orders, 0) || 1;
  const rest = plats.slice(5).reduce((s, p) => s + p.orders, 0);
  const mix = rest ? [...plats.slice(0, 5), { name: tr("Other"), orders: rest, other: true }] : plats;
  const mixColours = coloursFor(mix.map(p => (p.other ? '' : p.name)));
  return (
    <section className="pl-card pl-sell">
      <header><h3>{tr("Selling today")}</h3><span className="pl-cnt">{tr("by orders")}</span></header>
      <div className="pl-sell-body">
        {list.map((s, i) => (
          <div className="pl-sv" key={s.name}>
            <b>{s.name}</b><span className="m">{s.orders} <em>{short(s.revenue)}</em></span>
            <div className="pl-sv-bar"><i style={{ width: `${(s.orders / top) * 100}%`, background: colours[i] }} /></div>
          </div>
        ))}
        {!list.length && <div className="pl-empty">{tr("No orders yet today")}</div>}
      </div>
      {mix.length > 0 && (
        <div className="pl-mix">
          <h3>{tr("Platforms today")}</h3>
          <div className="pl-stack">{mix.map((p, i) => <i key={p.name} style={{ width: `${(p.orders / ptot) * 100}%`, background: p.other ? 'var(--dim)' : mixColours[i] }} />)}</div>
          <div className="pl-leg">{mix.map((p, i) => <span key={p.name}><i className="pl-sw" style={{ background: p.other ? 'var(--dim)' : mixColours[i] }} />{p.name}<b className="m">{Math.round((p.orders / ptot) * 100)}%</b></span>)}</div>
        </div>
      )}
    </section>
  );
}

function Month({ data }) {
  const tr = useT();
  const lm = data.lastMonth;
  const rev = data.monthNetRevenue ?? data.monthRevenue ?? 0;
  const lagos = new Date(Date.now() + 3600e3);
  const day = lagos.getUTCDate();
  const daysInMonth = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth() + 1, 0)).getUTCDate();
  const monthName = lagos.toLocaleDateString('en-NG', { month: 'long', timeZone: 'UTC' });
  const lmName = lm ? new Date(new Date(lm.start).getTime() + 3600e3).toLocaleDateString('en-NG', { month: 'long', timeZone: 'UTC' }) : '';
  const share = lm?.revenueFull > 0 ? rev / lm.revenueFull : null;
  const markup = data.monthCost > 0 ? Math.round((data.monthProfit / data.monthCost) * 100) : 0;
  const avg = data.monthOrders > 0 ? (data.monthRevenue || 0) / data.monthOrders : 0;
  const lmAvg = lm?.ordersToDate > 0 ? lm.revenueToDate / lm.ordersToDate : 0;
  const repeat = data.monthActiveUsers > 0 ? Math.round(((data.monthRepeatUsers || 0) / data.monthActiveUsers) * 100) : 0;
  const statusTotal = (data.byStatus || []).reduce((s, i) => s + i.count, 0);
  const cancelled = (data.byStatus || []).reduce((s, i) => (CANCELLED[i.status] ? s + i.count : s), 0);
  const cancelRate = statusTotal > 0 ? Math.round((cancelled / statusTotal) * 100) : 0;
  const facts = [
    { l: msg("Profit"), v: short(data.monthProfit || 0), d: lm ? pct(data.monthProfit, lm.profitToDate) : null },
    { l: msg("Markup"), v: `${markup}%` },
    { l: msg("Orders"), v: num(data.monthOrders), d: lm ? pct(data.monthOrders, lm.ordersToDate) : null },
    { l: msg("Avg order"), v: naira(avg), d: lm ? pct(avg, lmAvg) : null },
    { l: msg("Cancel rate"), v: `${cancelRate}%` },
    { l: msg("Repeat buyers"), v: `${repeat}%` },
    { l: msg("New people"), v: num(data.monthNewUsers), d: lm ? pct(data.monthNewUsers, lm.newUsersToDate) : null },
    { l: msg("Deposits"), v: short(data.monthDeposits || 0), d: lm ? pct(data.monthDeposits, lm.depositsToDate) : null },
  ];
  return (
    <div className="pl-month">
      <section className="pl-card pl-mpace">
        <div className="pl-mpace-t"><h3>{monthName} {tr("so far")}</h3><b className="m">{short(rev)}</b></div>
        {share !== null && <div className="pl-mbar"><i style={{ transform: `scaleX(${Math.min(share, 1)})` }} /><u style={{ left: `${(day / daysInMonth) * 100}%` }} /></div>}
        <div className="pl-mcap">
          {share !== null ? <span><b className="m">{Math.round(share * 100)}%</b> {tr("of")} {lmName} <span className="m">({short(lm.revenueFull)})</span></span> : <span />}
          <span>{tr("Day")} {day} {tr("of")} {daysInMonth}</span>
        </div>
      </section>
      <section className="pl-card pl-facts">
        {facts.map(f => (
          <div className="pl-fact" key={f.l}>
            <b className="m">{f.v}</b><span>{tr(f.l)}</span>
            {f.d !== null && f.d !== undefined && <em className={f.d >= 0 ? 'pl-up' : 'pl-down'}>{f.d >= 0 ? '+' : ''}{f.d}% {tr("vs last month")}</em>}
          </div>
        ))}
      </section>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' });
  const date = now.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' });
  return <div className="pl-clock"><b className="m">{time}</b><span>{date}</span></div>;
}

export default function PulseDashboard() {
  const tr = useT();
  const [data, setData] = useState(null);
  const [fresh, setFresh] = useState(() => new Set());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef(null);
  const known = useRef(null);

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
      const next = await res.json();
      // Rows that arrived since the last load slide in. Not on the first load,
      // or the whole stream would arrive at once.
      const keys = streamKeys(next);
      if (known.current) {
        const added = new Set(keys.filter(key => !known.current.has(key)));
        if (added.size) { setFresh(added); setTimeout(() => setFresh(new Set()), 1500); }
      }
      known.current = new Set(keys);
      setData(next); setSecondsAgo(0); setError(false);
    } catch { setError(true); }
  }, []);
  useEffect(() => { fetchData(); const iv = setInterval(fetchData, REFRESH_MS); return () => clearInterval(iv); }, [fetchData]);
  useEffect(() => { const iv = setInterval(() => setSecondsAgo(s => s + 1), 1000); return () => clearInterval(iv); }, []);
  // The strip is driven by how long it has actually been, not by an animation
  // of its own, so it cannot drift away from the data underneath it, and a
  // fetch that hangs parks the bar full instead of looping while the numbers
  // go stale. It scales rather than resizes, so it costs no layout.
  const tick = Math.min(1, secondsAgo / REFRESH_SECONDS);

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
  const so = data.pace?.soFar;
  return (
    <div ref={containerRef} className="pl">
      <style>{CSS}</style>
      <div className="pl-tick" aria-hidden="true"><i style={{ transform: `scaleX(${tick})` }} /></div>
      <header className="pl-top">
        <div className="pl-brand"><span className="pl-mark"><NitroWordmark height={11} color="#fff" /></span><h1>Pulse</h1></div>
        <Clock />
        <div className="pl-state">
          {error
            ? <span className="pl-live pl-lost"><i className="pl-dot pl-bad" />{tr("CONNECTION LOST")}</span>
            : <span className="pl-live"><i className="pl-dot pl-ok pl-beat" />LIVE</span>}
          <span className="pl-ago m">{secondsAgo}s</span>
          <a className="pl-classic" href="/pulse?view=classic">{tr("Classic view")}</a>
          <button type="button" onClick={toggleFullscreen} className="pl-fs" aria-label={isFullscreen ? tr("Exit fullscreen") : tr("Fullscreen")}>
            {isFullscreen
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /></svg>}
          </button>
        </div>
      </header>

      <div className="pl-rowA">
        <Pace data={data} />
        <div className="pl-tiles">
          <Tile label={tr("Profit")} value={naira(data.profitToday)} note={data.costToday > 0 ? `${Math.round((data.profitToday / data.costToday) * 100)}% ${tr("on cost")}` : null} delta={so ? pct(data.profitToday, so.profit) : data.profitChange} series={H.map(h => h.profit)} colour="#34d399" />
          <Tile label={tr("Orders")} value={num(data.ordersToday)} delta={so ? pct(data.ordersToday, so.orders) : data.ordersChange} series={H.map(h => h.orders)} colour="#c47d8e" />
          <Tile label={tr("Deposits")} value={naira(data.depositsToday)} delta={so ? pct(data.depositsToday, so.deposits) : data.depositsChange} series={H.map(h => h.deposits)} colour="#e0a458" />
          <Tile label={tr("People")} value={num(data.totalUsers)} note={`+${num(data.newUsersToday)} ${tr("today")}`} delta={so ? pct(data.newUsersToday, so.newUsers) : null} series={H.map(h => h.newUsers)} colour="#7aa2f7" />
        </div>
      </div>

      <div className="pl-rowB">
        <Stream data={data} fresh={fresh} />
        <Running data={data} />
        <Selling data={data} />
      </div>

      <Month data={data} />
    </div>
  );
}

const CSS = `
.pl{--bg:#0b0e17;--sf:#121724;--sf2:#171d2c;--hair:rgba(255,255,255,.08);--tx:#f2efe9;--mu:#8b90a0;--dim:#5c6170;--ac:#c47d8e;--ok:#34d399;--wait:#e0a458;--bad:#f87171;--run:#7aa2f7;--warn:#fdba74;
  height:100dvh;background:var(--bg);color:var(--tx);font-family:Outfit,system-ui,sans-serif;padding:16px 20px 14px;display:grid;grid-template-rows:auto minmax(0,1.1fr) minmax(0,1.5fr) auto;gap:10px;box-sizing:border-box;overflow:hidden;position:relative}
.pl *{box-sizing:border-box}
.pl h1,.pl h3{margin:0}
.pl h3{font-size:11px;letter-spacing:1.3px;text-transform:uppercase;color:var(--mu);font-weight:600}
.pl .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.pl-card{background:var(--sf);border:1px solid var(--hair);border-radius:16px;min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column}
.pl-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px 9px;border-bottom:1px solid var(--hair);flex-shrink:0}
.pl-cnt{font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;gap:8px;align-items:baseline}
.pl-cnt b{font-weight:700;color:var(--tx)}.pl-cnt b.pl-in{color:var(--ok)}.pl-cnt b.pl-out{color:var(--bad)}
/* Pulse's own refresh strip: the Nitro loading mark's four colours, pink on the
   leading edge. It scales from the left instead of growing its width. */
.pl-tick{position:absolute;top:0;left:0;right:0;height:3px;background:var(--hair);overflow:hidden;z-index:5}
.pl-tick i{display:block;width:100%;height:100%;background:linear-gradient(90deg,#ecc94b 0%,#34a97b 14%,#e05252 30%,#c47d8e 58%,#c47d8e 100%);transform-origin:0 50%;transition:transform 1s linear}
.pl-top{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.pl-brand{display:flex;align-items:center;gap:10px}
.pl-mark{height:22px;padding:0 9px;border-radius:999px;background:linear-gradient(135deg,#c47d8e,#8b5e6b);display:inline-flex;align-items:center;justify-content:center}
.pl-top h1{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:700;line-height:1}
.pl-clock{margin-left:auto;display:flex;align-items:baseline;gap:12px}
.pl-clock b{font-size:clamp(20px,1.6vw,30px);font-weight:700;letter-spacing:-.02em}
.pl-clock span{font-size:13px;color:var(--mu)}
.pl-state{display:flex;align-items:center;gap:12px;font-size:11.5px}
.pl-live{display:inline-flex;align-items:center;gap:6px;color:var(--ok);font-weight:700;letter-spacing:1.2px}.pl-live.pl-lost{color:var(--bad)}
.pl-ago{color:var(--dim);min-width:3ch}
.pl-classic{color:var(--dim);text-decoration:none;font-size:11px;padding:3px 9px;border-radius:999px;border:1px solid var(--hair)}.pl-classic:hover{color:var(--tx)}
.pl-fs{color:var(--dim);display:inline-flex;background:transparent;border:0;padding:4px;cursor:pointer;border-radius:6px}.pl-fs:hover{color:var(--tx)}
.pl-fs:focus-visible,.pl-classic:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
.pl-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}.pl-ok{background:var(--ok)}.pl-run-d{background:var(--run)}.pl-wait{background:var(--wait)}.pl-bad{background:var(--bad)}.pl-mu{background:var(--mu)}
.pl-beat{animation:pl-beat 2s ease-out infinite}
@keyframes pl-beat{0%{box-shadow:0 0 0 0 rgba(52,211,153,.45)}70%{box-shadow:0 0 0 7px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}
.pl-up{color:var(--ok)}.pl-down{color:var(--bad)}
.pl-rowA{display:grid;grid-template-columns:minmax(0,1.42fr) minmax(0,1fr);gap:10px;min-height:0}
.pl-pace{padding:14px 20px 10px}
.pl-pace-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
.pl-pace-big{display:flex;align-items:baseline;gap:18px;flex-wrap:wrap;margin-top:6px}
.pl-pace-big>b{font-size:clamp(36px,3.3vw,64px);font-weight:800;line-height:1;letter-spacing:-.03em}
.pl-ahead{font-size:clamp(13px,.9vw,17px);font-weight:600}
.pl-ahead small{display:block;font-size:12px;font-weight:500;color:var(--mu);margin-top:3px}
.pl-proj{text-align:right;flex-shrink:0}
.pl-proj small{display:block;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mu);font-weight:600}
.pl-proj b{display:block;font-size:clamp(18px,1.35vw,26px);font-weight:700;margin-top:2px}
.pl-proj span{display:block;font-size:11.5px;color:var(--dim)}
.pl-chart{flex:1;min-height:60px;position:relative;margin-top:10px}
.pl-chart svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.pl-grid{stroke:rgba(255,255,255,.06);stroke-width:1;vector-effect:non-scaling-stroke}
.pl-yline{fill:none;stroke:var(--mu);stroke-width:2;stroke-dasharray:5 5;opacity:.7;vector-effect:non-scaling-stroke}
.pl-tarea{fill:var(--ok);opacity:.14}
.pl-tline{fill:none;stroke:var(--ok);stroke-width:3;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}
.pl-pline{stroke:var(--ok);stroke-width:2;stroke-dasharray:2 6;stroke-linecap:round;opacity:.8;vector-effect:non-scaling-stroke}
.pl-now{stroke:rgba(255,255,255,.22);stroke-width:1;vector-effect:non-scaling-stroke}
.pl-dot-now,.pl-dot-y{position:absolute;border-radius:50%;transform:translate(-50%,-50%)}
.pl-dot-now{width:12px;height:12px;background:var(--ok);box-shadow:0 0 0 3px var(--sf)}
.pl-dot-y{width:8px;height:8px;background:var(--mu);box-shadow:0 0 0 2px var(--sf)}
.pl-ax{display:flex;justify-content:space-between;font-size:10px;color:var(--dim);margin-top:6px}
.pl-legend{position:absolute;top:2px;left:0;display:flex;gap:16px;font-size:11.5px;color:var(--mu);flex-wrap:wrap}
.pl-legend i{display:inline-block;width:18px;height:3px;border-radius:2px;vertical-align:middle;margin-right:6px}
.pl-lg-t{background:var(--ok)}.pl-lg-y{background:repeating-linear-gradient(90deg,var(--mu) 0 5px,transparent 5px 10px)}.pl-lg-p{background:repeating-linear-gradient(90deg,var(--ok) 0 2px,transparent 2px 8px)}
.pl-tiles{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:10px;min-height:0}
.pl-tile{padding:12px 16px 8px}
.pl-tile-h{display:flex;justify-content:space-between;align-items:center;gap:8px}
.pl-dl{font-size:11.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pl-dl span{color:var(--dim);font-weight:500;margin-left:5px}
.pl-tile-v{font-size:clamp(22px,1.8vw,34px);font-weight:700;letter-spacing:-.02em;line-height:1.1;margin-top:4px;white-space:nowrap}
.pl-tile-v small{font-family:Outfit,system-ui,sans-serif;font-size:12.5px;font-weight:600;color:var(--mu);margin-left:8px;letter-spacing:0}
.pl-spark{flex:1;min-height:24px;width:100%;margin-top:6px}
.pl-spark-a{opacity:.14}.pl-spark-l{fill:none;stroke-width:2;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.pl-rowB{display:grid;grid-template-columns:minmax(0,1.42fr) minmax(0,.8fr) minmax(0,.8fr);gap:10px;min-height:0}
.pl-rows{overflow:hidden;min-height:0}
.pl-ev{display:grid;grid-template-columns:34px 58px minmax(0,1fr) auto;align-items:center;gap:12px;padding:8px 16px;border-top:1px solid var(--hair);font-size:13.5px}
.pl-ev:first-child{border-top:0}
.pl-fresh{animation:pl-in .7s ease-out}
@keyframes pl-in{from{opacity:0;transform:translateY(-8px);background:rgba(196,125,142,.14)}to{opacity:1;transform:none;background:transparent}}
.pl-t{font-size:11.5px;color:var(--dim)}
.pl-kind{display:inline-flex;align-items:center;justify-content:center;height:21px;border-radius:6px;font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;white-space:nowrap;overflow:hidden}
.pl-k-order{color:var(--ac);box-shadow:inset 0 0 0 1px rgba(196,125,142,.5)}
.pl-k-in{color:var(--ok);box-shadow:inset 0 0 0 1px rgba(52,211,153,.45)}
.pl-k-out{color:var(--bad);box-shadow:inset 0 0 0 1px rgba(248,113,113,.45)}
.pl-k-new{color:var(--run);box-shadow:inset 0 0 0 1px rgba(122,162,247,.45)}
.pl-what{min-width:0;display:flex;flex-direction:column;gap:1px}
.pl-what b{font-weight:600;display:flex;align-items:center;gap:7px;min-width:0}
.pl-what b>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-what>span{font-size:12px;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-api{font-style:normal;font-size:9.5px;font-weight:700;letter-spacing:.6px;padding:1px 5px;border-radius:4px;color:var(--run);box-shadow:inset 0 0 0 1px rgba(122,162,247,.45);line-height:1.3;flex-shrink:0}
.pl-amt{font-size:13px;font-weight:700;white-space:nowrap}.pl-in{color:var(--ok)}.pl-out{color:var(--bad)}
.pl-empty{padding:18px 16px;font-size:12px;color:var(--dim)}
.pl-run-body{padding:12px 16px;display:grid;gap:12px}
.pl-sts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.pl-sts>div{padding:10px 12px;border-radius:12px;background:var(--sf2);min-width:0}
.pl-sts b{display:block;font-size:clamp(20px,1.6vw,30px);font-weight:800;line-height:1}
.pl-sts span{display:flex;align-items:baseline;gap:6px;margin-top:6px;font-size:11.5px;line-height:1.2;color:var(--mu)}
.pl-sts span .pl-dot{transform:translateY(-1px)}
.pl-c-wait{color:var(--wait)}.pl-c-run{color:var(--run)}.pl-c-mu{color:var(--mu)}
.pl-age small{display:block;font-size:11px;color:var(--dim);margin-bottom:6px}
.pl-agebar{display:flex;height:10px;border-radius:5px;overflow:hidden;gap:2px;background:rgba(255,255,255,.05)}
.pl-agebar i{display:block;height:100%}
.pl-agel{display:flex;justify-content:space-between;gap:6px;font-size:10.5px;color:var(--dim);margin-top:6px;white-space:nowrap}
.pl-agel b{color:var(--tx);font-weight:600}
.pl-oldest{font-size:12.5px;color:var(--mu);display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.pl-oldest b{color:var(--warn)}.pl-oldest span{color:var(--dim);font-size:11.5px}
.pl-attn{border-top:1px solid var(--hair);padding:10px 16px 12px;display:grid;gap:7px;margin-top:auto}
.pl-at{display:flex;align-items:center;gap:10px;font-size:13px;min-width:0}
.pl-at b{font-size:17px;font-weight:800;min-width:30px}
.pl-at>span{color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-at-v{color:var(--tx);margin-left:4px}
.pl-at-w b{color:var(--wait)}.pl-at-r b{color:var(--bad)}.pl-at-ok b{color:var(--ok)}.pl-at-mu b{color:var(--mu)}
.pl-sell-body{padding:10px 16px;display:grid;gap:9px;align-content:start;min-height:0;overflow:hidden}
.pl-sv{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;font-size:12.5px}
.pl-sv b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-sv>span{font-size:11.5px;color:var(--tx);font-weight:600}.pl-sv em{font-style:normal;color:var(--mu);font-weight:500;margin-left:6px}
.pl-sv-bar{grid-column:1/-1;height:6px;border-radius:3px;background:rgba(255,255,255,.05);overflow:hidden}
.pl-sv-bar i{display:block;height:100%;border-radius:3px}
.pl-mix{border-top:1px solid var(--hair);padding:10px 16px 12px;margin-top:auto}
.pl-stack{display:flex;height:9px;border-radius:5px;overflow:hidden;gap:2px;margin-top:8px;background:rgba(255,255,255,.05)}
.pl-stack i{display:block;height:100%}
.pl-leg{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:8px;font-size:11.5px;color:var(--mu)}
.pl-leg b{color:var(--tx);font-weight:600;margin-left:4px}
.pl-sw{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px}
.pl-month{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,2fr);gap:10px}
.pl-mpace{padding:12px 18px;justify-content:center;gap:8px}
.pl-mpace-t{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.pl-mpace-t b{font-size:clamp(18px,1.35vw,26px);font-weight:800}
.pl-mbar{position:relative;height:12px;border-radius:6px;background:rgba(255,255,255,.06)}
.pl-mbar i{position:absolute;inset:0;border-radius:6px;background:linear-gradient(90deg,#34a97b,#34d399);transform-origin:0 50%}
.pl-mbar u{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:#e4e2dd;border-radius:1px}
.pl-mcap{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--mu);flex-wrap:wrap}
.pl-mcap b{color:var(--tx)}
.pl-facts{display:grid;grid-template-columns:repeat(8,minmax(0,1fr))}
.pl-fact{padding:12px 14px;border-left:1px solid var(--hair);display:flex;flex-direction:column;justify-content:center;min-width:0}
.pl-fact:first-child{border-left:0}
.pl-fact b{font-size:clamp(14px,1vw,19px);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-fact span{font-size:11.5px;color:var(--mu);margin-top:3px}
.pl-fact em{font-style:normal;font-size:11px;font-weight:700;margin-top:2px;line-height:1.25}
@media (prefers-reduced-motion:reduce){.pl-tick i{transition:none}.pl-beat,.pl-fresh{animation:none}}
/* A laptop-height screen: the top row gives up height so the three lists keep theirs. */
@media (max-height:900px) and (min-width:1101px){
  .pl{grid-template-rows:auto minmax(0,.85fr) minmax(0,1.6fr) auto;padding-block:12px 10px;gap:8px}
  .pl-pace-big>b{font-size:clamp(30px,3vw,52px)}
  .pl-age small{display:none}
  .pl-run-body{padding:10px 16px;gap:9px}
  .pl-sts>div{padding:8px 10px}
  .pl-attn{padding:8px 16px 10px;gap:5px}
  .pl-at b{font-size:15px}
  .pl-ev{padding-block:6px}
}
@media (max-width:1100px){
  .pl{height:auto;min-height:100dvh;overflow:visible;grid-template-rows:none}
  .pl-rowA,.pl-rowB,.pl-month{grid-template-columns:minmax(0,1fr)}
  .pl-pace{min-height:320px}
  .pl-ev:nth-child(n+13){display:none}
  .pl-facts{grid-template-columns:repeat(4,minmax(0,1fr))}
  .pl-fact:nth-child(5){border-left:0}.pl-fact:nth-child(n+5){border-top:1px solid var(--hair)}
}
@media (max-width:640px){
  .pl{padding:14px 12px 22px}
  .pl-fs,.pl-clock span{display:none}
  .pl-pace{padding:14px 14px 10px}
  .pl-pace-head{flex-direction:column;gap:10px}
  .pl-proj{text-align:start}
  .pl-pace-big{flex-direction:column;gap:6px}
  .pl-dl span{display:none}
  .pl-tile{padding:11px 12px 6px}
  .pl-tile-v small{display:block;margin-left:0;margin-top:2px}
  .pl-ev{grid-template-columns:30px minmax(0,1fr) auto;padding:8px 12px;gap:10px}
  .pl-kind{display:none}
  .pl-facts{grid-template-columns:repeat(2,minmax(0,1fr))}
  .pl-fact{border-left:0;border-top:1px solid var(--hair)}.pl-fact:nth-child(even){border-left:1px solid var(--hair)}.pl-fact:nth-child(-n+2){border-top:0}
}
`;
