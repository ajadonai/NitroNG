'use client';
import { useEffect, useMemo, useState } from "react";
import { SkelList } from "./skeleton";
import { fN } from "../lib/format";
import { Modal } from "./ui-primitives";

// A daily feed of what moved the menu's prices: each day is one card, newest
// first, and inside it the runs that caused the moves — the daily sync, a
// manual reprice, a hand edit — each with its rows of old → new. Read-only:
// the row's modal shows the price math and nothing here edits anything.

const SRC_LABEL = { sync: "Daily sync", reprice: "Menu reprice", manual: "Manual edit" };
const RANGES = [[7, "7 days"], [30, "30 days"], [90, "90 days"]];
const TZ = "Africa/Lagos";

const pctOf = c => (c.oldSell > 0 ? ((c.newSell - c.oldSell) / c.oldSell) * 100 : 0);
const fPct = p => `${p >= 0 ? "▲ +" : "▼ −"}${Math.abs(p).toFixed(1)}%`;
const fUsd = cents => `$${(+(cents / 100).toFixed(3)).toString()}`;
const naira = kobo => fN(kobo / 100);
const dayKey = d => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
const dayLabel = d => new Date(d).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const timeOf = d => new Date(d).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

function DetailModal({ change, onClose, dark, t }) {
  useEffect(() => {
    if (change) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [change]);
  if (!change) return null;
  const p = pctOf(change);
  const costMoved = change.oldCost != null && change.newCost != null && change.oldCost !== change.newCost;
  const Fact = ({ label, children }) => (
    <div className="flex items-baseline justify-between gap-3 py-2.5" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}` }}>
      <span className="text-[13px]" style={{ color: t.textMuted }}>{label}</span>
      <span className="text-[13px] font-bold text-right" style={{ color: t.text }}>{children}</span>
    </div>
  );
  return (
    <Modal open onClose={onClose} dark={dark} maxWidth={440}
      title={`${change.groupName} — ${change.tier}`}
      subtitle={`${SRC_LABEL[change.source] || change.source}${change.actor && change.actor !== "System" ? ` by ${change.actor}` : ""} · ${dayLabel(change.createdAt)}, ${timeOf(change.createdAt)}`}
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>}>
      <div>
          <Fact label="Price on the site">
            <span className="m">{naira(change.oldSell)} → {naira(change.newSell)}</span>{" "}
            <em className="not-italic" style={{ color: p >= 0 ? (dark ? "#fcd34d" : "#b45309") : (dark ? "#6ee7b7" : "#0a7d54") }}>{fPct(p)}</em>
          </Fact>
          {change.oldCost != null && (
            <Fact label="Provider cost">
              <span className="m">{costMoved ? `${fUsd(change.oldCost)} → ${fUsd(change.newCost)}` : fUsd(change.newCost)}</span>
              {change.provider ? ` · ${change.provider.toUpperCase()}` : ""}
            </Fact>
          )}
          {change.usdRate ? <Fact label="Rate used"><span className="m">$1 = ₦{change.usdRate.toLocaleString()}</span></Fact> : null}
          <Fact label="Platform">{change.platform}</Fact>
          {change.source === "manual" && <Fact label="How it moved">Price set by hand in Menu Builder</Fact>}
      </div>
    </Modal>
  );
}

export function AdminPriceChangesPage({ dark, t }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dir, setDir] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [q, setQ] = useState("");
  const [openRuns, setOpenRuns] = useState({});
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/price-changes?days=${days}`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [days]);

  const changes = data?.changes || [];
  const platforms = useMemo(() => [...new Set(changes.map(c => c.platform))].sort(), [changes]);
  const upCount = useMemo(() => changes.filter(c => c.newSell > c.oldSell).length, [changes]);
  const downCount = changes.length - upCount;

  const filtered = useMemo(() => changes.filter(c => {
    if (dir === "up" && c.newSell <= c.oldSell) return false;
    if (dir === "down" && c.newSell >= c.oldSell) return false;
    if (platform !== "all" && c.platform !== platform) return false;
    if (q && !`${c.groupName} ${c.platform} ${c.tier}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [changes, dir, platform, q]);

  // day → runs → rows, newest day and newest run first (rows arrive sorted desc)
  const feed = useMemo(() => {
    const daysMap = new Map();
    for (const c of filtered) {
      const dk = dayKey(c.createdAt);
      if (!daysMap.has(dk)) daysMap.set(dk, { label: dayLabel(c.createdAt), up: 0, down: 0, runs: new Map() });
      const day = daysMap.get(dk);
      if (c.newSell > c.oldSell) day.up++; else day.down++;
      if (!day.runs.has(c.runId)) day.runs.set(c.runId, { time: timeOf(c.createdAt), source: c.source, actor: c.actor, usdRate: c.usdRate, rows: [] });
      day.runs.get(c.runId).rows.push(c);
    }
    return [...daysMap.entries()].map(([dk, d]) => ({ key: dk, ...d, runs: [...d.runs.entries()].map(([id, r]) => ({ id, ...r })) }));
  }, [filtered]);

  const vars = {
    "--card": dark ? "#171126" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93",
    "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--warn": dark ? "#fcd34d" : "#b45309", "--warn-bg": dark ? "rgba(251,191,36,.12)" : "rgba(217,119,6,.09)",
    "--ok": dark ? "#6ee7b7" : "#0a7d54", "--ok-bg": dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.09)",
  };

  const Row = ({ c }) => {
    const p = pctOf(c);
    const up = c.newSell > c.oldSell;
    const costMoved = c.oldCost != null && c.newCost != null && c.oldCost !== c.newCost;
    return (
      <button type="button" className="pc-row" onClick={() => setDetail(c)}>
        <span className="pc-tt">
          <b>{c.groupName}</b>
          <i>{c.platform}{costMoved ? ` · cost ${fUsd(c.oldCost)} → ${fUsd(c.newCost)}` : ""}{c.provider ? ` · ${c.provider.toUpperCase()}` : ""}</i>
        </span>
        <span className="pc-tier">{c.tier}</span>
        <span className="pc-pr"><s className="m">{naira(c.oldSell)}</s><b className="m">{naira(c.newSell)}</b></span>
        <span className={`pc-chg ${up ? "up" : "dn"}`}>{fPct(p)}</span>
      </button>
    );
  };

  return (
    <>
      <div className="adm-header">
        <div>
          <div className="adm-title" style={{ color: t.text }}>Price changes</div>
          <div className="adm-subtitle" style={{ color: t.textMuted }}>What the syncs and reprices did to the menu, day by day.</div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>
      <div className="pc" style={vars}>
        <style>{CSS}</style>

        <div className="pc-stats">
          <div className="pc-stt"><b className="m">{loading ? "—" : (data?.total ?? 0)}</b><span>Changed · {days} days</span></div>
          <div className="pc-stt"><b className="m up">{loading ? "—" : `${upCount} ▲`}</b><span>Went up</span></div>
          <div className="pc-stt"><b className="m dn">{loading ? "—" : `${downCount} ▼`}</b><span>Came down</span></div>
          <div className="pc-stt"><b className="m">{loading ? "—" : (data?.pinned ?? 0)}</b><span>Pinned · held</span></div>
        </div>

        <div className="pc-tools">
          <div className="pc-segs">{RANGES.map(([v, l]) => <button type="button" key={v} className={`pc-seg${days === v ? " on" : ""}`} onClick={() => setDays(v)}>{l}</button>)}</div>
          <div className="pc-segs">{[["all", "All"], ["up", "Up ▲"], ["down", "Down ▼"]].map(([v, l]) => <button type="button" key={v} className={`pc-seg${dir === v ? " on" : ""}`} onClick={() => setDir(v)}>{l}</button>)}</div>
          <select className="pc-sel" value={platform} onChange={e => setPlatform(e.target.value)}>
            <option value="all">All platforms</option>
            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input className="pc-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search services…" />
        </div>

        {loading && <div className="pc-card" style={{ padding: "4px 16px" }}><SkelList dark={dark} rows={5} bare avatar={false} rowH={48} /></div>}

        {!loading && feed.length === 0 && (
          <div className="pc-card"><div className="pc-empty">{changes.length === 0 ? `No price changes recorded in the last ${days} days. New syncs, reprices and Menu Builder edits land here as they happen.` : "Nothing matches these filters."}</div></div>
        )}

        {feed.map(day => (
          <section key={day.key} className="pc-card">
            <header>
              <h3>{day.label}</h3>
              <span className="pc-cnt">
                {day.up > 0 && <em className="up">{day.up} ▲</em>}{day.up > 0 && day.down > 0 && " · "}{day.down > 0 && <em className="dn">{day.down} ▼</em>}
                {" · "}{day.up + day.down} change{day.up + day.down === 1 ? "" : "s"}
              </span>
            </header>
            {day.runs.map(run => {
              const open = !!openRuns[run.id];
              const shown = open ? run.rows : run.rows.slice(0, 8);
              return (
                <div key={run.id}>
                  <div className="pc-run">
                    <b>{run.time}</b>
                    <span className="pc-src">{SRC_LABEL[run.source] || run.source}</span>
                    <span>{run.actor === "System" ? "System" : `by ${run.actor}`} · {run.rows.length} tier{run.rows.length === 1 ? "" : "s"}{run.usdRate ? <> · <span className="m">$1 = ₦{run.usdRate.toLocaleString()}</span></> : null}</span>
                  </div>
                  {shown.map(c => <Row key={c.id} c={c} />)}
                  {run.rows.length > 8 && (
                    <button type="button" className="pc-more" onClick={() => setOpenRuns(o => ({ ...o, [run.id]: !open }))}>
                      {open ? "Show fewer" : `Show all ${run.rows.length} changes from this run`}
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        ))}

        {!loading && data && data.total > changes.length && (
          <div className="pc-note">Showing the latest {changes.length.toLocaleString()} of {data.total.toLocaleString()} changes in this range. Narrow the range or filters to see the rest.</div>
        )}
      </div>
      <DetailModal change={detail} onClose={() => setDetail(null)} dark={dark} t={t} />
    </>
  );
}

const CSS = `
.pc{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.pc *{box-sizing:border-box}
.pc .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.pc-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.pc-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}
.pc-stt:first-child{border-left:0}
.pc-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap}
.pc-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px}
.pc .up{color:var(--warn)}.pc .dn{color:var(--ok)}
.pc-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pc-segs{display:flex;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:3px;gap:2px}
.pc-seg{font:inherit;font-size:12px;font-weight:600;padding:6px 12px;border-radius:7px;border:0;background:transparent;color:var(--mut);cursor:pointer;white-space:nowrap}
.pc-seg.on{background:var(--soft);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.pc-sel{font:inherit;font-size:12.5px;font-weight:600;height:34px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:0 10px;outline:none;max-width:170px}
.pc-search{font:inherit;font-size:12.5px;height:34px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:0 12px;outline:none;flex:1;min-width:140px}
.pc-search:focus,.pc-sel:focus{border-color:var(--ink)}
.pc-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.pc-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}
.pc-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}
.pc-cnt{font-size:11.5px;color:var(--dim);white-space:nowrap}.pc-cnt em{font-style:normal;font-weight:700}
.pc-empty{padding:18px 16px;font-size:13px;color:var(--dim);line-height:1.5}
.pc-run{display:flex;align-items:center;gap:8px;padding:9px 16px;background:var(--soft);border-top:1px solid var(--line);font-size:12px;color:var(--mut);flex-wrap:wrap}
.pc-card>div:first-of-type .pc-run{border-top:0}
.pc-run b{font-weight:700;color:var(--ink)}
.pc-src{font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:2.5px 8px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);white-space:nowrap}
.pc-row{display:flex;align-items:center;gap:12px;width:100%;padding:10px 16px;border:0;border-top:1px solid var(--rail);background:transparent;color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.pc-row:hover{background:var(--soft)}
.pc-tt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.pc-tt b{font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc-tt i{font-style:normal;font-size:11.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc-tier{font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;padding:2px 7px;border-radius:999px;background:var(--soft);border:1px solid var(--line);color:var(--mut);white-space:nowrap}
.pc-pr{display:flex;align-items:baseline;gap:7px;white-space:nowrap}
.pc-pr s{color:var(--dim);font-size:12px;text-decoration-thickness:1px}
.pc-pr b{font-size:13.5px;font-weight:700}
.pc-chg{font-size:11.5px;font-weight:700;padding:3px 8px;border-radius:999px;white-space:nowrap;min-width:64px;text-align:center}
.pc-chg.up{color:var(--warn);background:var(--warn-bg)}
.pc-chg.dn{color:var(--ok);background:var(--ok-bg)}
.pc-more{display:block;width:100%;padding:10px;border:0;border-top:1px solid var(--rail);background:transparent;color:var(--mut);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.pc-note{font-size:12px;color:var(--dim);text-align:center;padding:2px 0 8px}
@media (max-width:767px){
  .pc-stats{grid-template-columns:1fr 1fr}
  .pc-stt:nth-child(3){border-left:0}
  .pc-stt:nth-child(n+3){border-top:1px solid var(--line)}
  .pc-stt b{font-size:17px}
  .pc-tier{display:none}
  .pc-pr{flex-direction:column;align-items:flex-end;gap:0}
  .pc-tt i{white-space:normal}
}
`;
