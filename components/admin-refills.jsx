'use client';
import { useState, useEffect } from "react";
import { useToast } from "./toast";
import { useConfirm } from "./confirm-dialog";

const PF_SHORT = { tiktok: "TT", instagram: "IG", youtube: "YT", facebook: "FB", twitter: "X", x: "X", telegram: "TG", discord: "DC", spotify: "SP", threads: "TH", snapchat: "SC", linkedin: "LI", website: "WEB", traffic: "WEB" };
const PF_NAME = { tiktok: "TikTok", instagram: "Instagram", youtube: "YouTube", facebook: "Facebook", twitter: "X", x: "X", telegram: "Telegram", discord: "Discord", spotify: "Spotify", threads: "Threads", snapchat: "Snapchat", linkedin: "LinkedIn" };

export default function AdminRefillsPage({ dark, t }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [refills, setRefills] = useState([]);
  const [handled, setHandled] = useState([]);
  const [facts, setFacts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const load = () => fetch("/api/admin/refills").then(r => r.json()).then(d => { setRefills(d.refills || []); setHandled(d.handled || []); setFacts(d.facts || null); setLoading(false); }).catch(() => { toast.error("Could not load refills"); setLoading(false); });
  useEffect(() => { load(); }, []); // eslint-disable-line
  const doAction = async (r, action) => {
    if (actionLoading) return;
    if (action === "reset_refill") { const ok = await confirm({ title: "Reset this request?", message: `${r.userName} will be able to ask for a refill on ${r.orderId} again. Nothing is sent to the provider.`, confirmText: "Reset", danger: false }); if (!ok) return; }
    setActionLoading(r.orderId + action);
    try {
      const res = await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: r.orderId, action }) });
      const data = await res.json();
      if (!res.ok) { toast.error("Action failed", data.error || "Something went wrong"); return; }
      if (action === "reset_refill") toast.success("Reset", data.message || `${r.userName} can ask again`);
      else toast.success("Refill sent", data.message || "Asked the provider to refill");
      load();
    } catch { toast.error("Request failed", "Check your connection"); }
    finally { setActionLoading(null); }
  };

  const ago = (iso) => { if (!iso) return "—"; const diff = Date.now() - new Date(iso).getTime(); const m = Math.floor(diff / 60000); if (m < 1) return "just now"; if (m < 60) return `${m} min ago`; const h = Math.floor(m / 60); if (h < 24) return `${h} h ago`; const d = Math.floor(h / 24); return d === 1 ? "yesterday" : `${d} days ago`; };
  const dateOf = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const waitWord = (mins) => mins == null ? "—" : mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  const shortLink = (l) => (l || "").replace(/^https?:\/\/(www\.)?/, "");
  const pfKey = (r) => String(r.serviceCategory || "").toLowerCase();
  // Oldest ask first: the queue is ordered by how long someone has waited.
  const queue = [...refills].sort((a, b) => new Date(a.refillRequestedAt || a.createdAt) - new Date(b.refillRequestedAt || b.createdAt));
  const vars = {
    "--card": t.cardBg, "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--ok": dark ? "#6ee7b7" : "#0a7d54", "--warn": dark ? "#fcd34d" : "#b45309", "--blue": dark ? "#a5b4fc" : "#4c62c4",
  };
  const bone = (h) => <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: h, borderRadius: 14 }} />;
  return (
    <div className="rf" style={vars}>
      <style>{RF_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Refills</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Customers asking for a top-up on an order that dropped. Send it to the provider, or reset so they can ask again.</div>
          </div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {loading ? <>{bone(84)}{bone(200)}</> : <>
        <div className="rf-stats">
          <div className={"rf-stt" + (facts?.waiting ? " warn" : "")}><b className="m">{facts?.waiting || 0}</b><span>Waiting</span><i>{facts?.waiting ? `oldest asked ${ago(facts.oldestAsk)}` : "nobody waiting"}</i></div>
          <div className="rf-stt"><b className="m">{facts?.asked30 || 0}</b><span>Asked this month</span><i>{facts ? `${facts.sent30} sent, ${facts.waiting} waiting` : ""}</i></div>
          <div className="rf-stt"><b className="m">{waitWord(facts?.typicalWaitMinutes)}</b><span>Typical wait</span><i>from ask to sent, 30 days</i></div>
          <div className="rf-stt"><b>{facts?.topPlatform ? (PF_NAME[facts.topPlatform.platform] || facts.topPlatform.platform) : "—"}</b><span>Asks the most</span><i>{facts?.topPlatform ? `${facts.topPlatform.count} of ${facts.asked30} this month` : "no asks this month"}</i></div>
        </div>

        <section className="rf-card">
          <header><h3>Waiting</h3><span className="rf-cnt">oldest first · Send refill asks the provider · Reset lets the customer ask again</span></header>
          <div className="rf-list">
            {queue.length === 0 ? <div className="rf-empty">No one is waiting for a refill.</div> : queue.map(r => (
              <div key={r.id} className="rf-r">
                <span className="rf-o"><span className="rf-av">{PF_SHORT[pfKey(r)] || "•"}</span><span className="rf-ot"><b className="m">{r.orderId}</b><i>{r.userName}</i></span></span>
                <span className="rf-s"><b>{r.serviceName}{r.tierLabel ? ` · ${r.tierLabel}` : ""}</b><i>{Number(r.quantity || 0).toLocaleString()} · placed {dateOf(r.createdAt)}{r.apiOrderId ? ` · provider #${r.apiOrderId}` : ""}</i></span>
                <span className="rf-l">{r.link ? <a href={r.link} target="_blank" rel="noopener noreferrer" title={r.link}>{shortLink(r.link)}</a> : <span className="rf-dimc">no link</span>}</span>
                <span className="rf-st"><i className={"rf-dot " + (r.status === "Completed" ? "ok" : "warn")} />{r.status}</span>
                <span className="rf-w">asked {ago(r.refillRequestedAt)}</span>
                <span className="rf-a">
                  <button type="button" className="rf-b sm pri" disabled={!!actionLoading} onClick={() => doAction(r, "refill")}>{actionLoading === r.orderId + "refill" ? "Sending…" : "Send refill"}</button>
                  <button type="button" className="rf-b sm" disabled={!!actionLoading} onClick={() => doAction(r, "reset_refill")}>{actionLoading === r.orderId + "reset_refill" ? "…" : "Reset"}</button>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rf-card">
          <header><h3>Handled</h3><span className="rf-cnt">sent to the provider, last 30 days</span></header>
          <div className="rf-hl">
            {handled.length === 0 ? <div className="rf-empty">Nothing sent in the last 30 days.</div> : handled.map(h => (
              <div key={h.id} className="rf-hr"><span className="m">{h.orderId}</span><b>{h.userName}</b><i>{h.serviceName}{h.tierLabel ? ` · ${h.tierLabel}` : ""}</i><span className="rf-cnt">sent {dateOf(h.handledAt)}</span></div>
            ))}
          </div>
        </section>
      </>}
    </div>
  );
}

const RF_CSS = `
.rf{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.rf *{box-sizing:border-box}
.rf .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.rf-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;transition:transform .15s}.rf-b:hover{transform:translateY(-1px)}.rf-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
.rf-b.sm{height:30px;padding:0 10px;font-size:12px}.rf-b.pri{background:var(--ac);color:#fff;border-color:var(--ac)}
.rf-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.rf-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.rf-stt:first-child{border-left:0}
.rf-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rf-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap}.rf-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rf-stt.warn b{color:var(--warn)}
.rf-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.rf-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.rf-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.rf-cnt{font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rf-list{display:flex;flex-direction:column}.rf-empty{padding:28px 16px;text-align:center;font-size:13px;color:var(--mut)}
.rf-r{display:grid;grid-template-columns:190px 1.2fr 1fr 110px 100px auto;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid var(--rail)}.rf-r:first-child{border-top:0}
.rf-o{display:flex;align-items:center;gap:10px;min-width:0}.rf-av{width:34px;height:34px;border-radius:10px;background:var(--soft);border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--mut);flex-shrink:0}.rf-ot{display:flex;flex-direction:column;min-width:0}.rf-ot b{font-size:13px;font-weight:700}.rf-ot i{font-style:normal;font-size:11.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rf-s{display:flex;flex-direction:column;min-width:0}.rf-s b{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rf-s i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rf-l{min-width:0}.rf-l a{font-size:12px;color:var(--blue);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;text-decoration:none}.rf-l a:hover{text-decoration:underline}.rf-dimc{font-size:12px;color:var(--dim)}
.rf-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--mut);white-space:nowrap}.rf-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}.rf-dot.ok{background:var(--ok)}.rf-dot.warn{background:var(--warn)}
.rf-w{font-size:12px;color:var(--dim);white-space:nowrap}.rf-a{display:flex;gap:6px;justify-content:flex-end}
.rf-hl{padding:4px 16px 8px}.rf-hr{display:grid;grid-template-columns:90px 150px 1fr auto;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--rail);font-size:13px}.rf-hr:first-child{border-top:0}.rf-hr .m{font-size:12px;color:var(--mut)}.rf-hr b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rf-hr i{font-style:normal;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (max-width:900px){
  .rf-stats{grid-template-columns:1fr 1fr}.rf-stt:nth-child(3){border-left:0}.rf-stt:nth-child(n+3){border-top:1px solid var(--line)}.rf-stt b{font-size:17px}
  .rf-list{background:none}.rf-r{grid-template-columns:1fr auto;grid-template-areas:"o st" "s s" "l l" "w w" "a a";gap:8px 10px;padding:12px 14px}
  .rf-o{grid-area:o}.rf-st{grid-area:st;align-self:start}.rf-s{grid-area:s;padding-top:10px;border-top:1px solid var(--rail)}.rf-s b,.rf-s i{white-space:normal}.rf-l{grid-area:l}.rf-l a{white-space:normal;word-break:break-all}
  .rf-w{grid-area:w;font-size:11.5px;letter-spacing:.6px;text-transform:uppercase;font-weight:700;color:var(--mut)}.rf-a{grid-area:a;justify-content:stretch;margin-top:2px}.rf-a .rf-b{flex:1;height:36px}
  .rf-hr{grid-template-columns:1fr auto;grid-template-areas:"o w" "b b" "i i";gap:2px 10px}.rf-hr .m{grid-area:o}.rf-hr .rf-cnt{grid-area:w}.rf-hr b{grid-area:b}.rf-hr i{grid-area:i;white-space:normal}
}
`;
