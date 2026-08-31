'use client';
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "./toast";
import { useConfirm } from "./confirm-dialog";

const naira = (n) => `₦${Number(n || 0).toLocaleString()}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—";
const initials = (name) => (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
const SEARCH = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></svg>;

export default function AdminResellersPage({ dark, t }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [noteDraft, setNoteDraft] = useState({});
  const [rateDraft, setRateDraft] = useState({});
  const [grantOpen, setGrantOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  const load = useCallback((q = "") => {
    const url = q ? `/api/admin/resellers?q=${encodeURIComponent(q)}` : "/api/admin/resellers";
    return fetch(url)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); setLoading(false); })
      .catch(() => { toast.error("Failed to load resellers"); setLoading(false); });
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  // Search as you type inside the Grant access modal, 350ms like the users page.
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!grantOpen || query.trim().length < 2) return undefined;
    searchTimer.current = setTimeout(async () => { setSearching(true); await load(query.trim()); setSearching(false); }, 350);
    return () => clearTimeout(searchTimer.current);
  }, [query, grantOpen, load]);

  // The modal owns the screen while it is up.
  useEffect(() => {
    if (!grantOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [grantOpen]);

  const act = async (userId, action, extra = {}, key = action) => {
    if (busy) return;
    setBusy(userId + key);
    try {
      const res = await fetch("/api/admin/resellers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, userId, ...extra }) });
      const d = await res.json();
      if (!res.ok) { toast.error("Action failed", d.error || "Something went wrong"); return; }
      toast.success("Done", "");
      load(grantOpen ? query.trim() : "");
    } catch { toast.error("Request failed", "Check your connection"); }
    finally { setBusy(null); }
  };

  const confirmBody = (lead, orders, spend) => (
    <div className="mb-5">
      <div className="text-sm leading-[1.65] mb-3" style={{ color: dark ? "#a09b95" : "#555250" }}>{lead}</div>
      <div className="flex gap-2">
        {[["Orders", orders.toLocaleString()], ["Spend", naira(spend)], ["Window", `${data.windowDays}d`]].map(([label, value]) => (
          <div key={label} className="flex-1 rounded-[10px] py-2 px-3" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.07)" }}>
            <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: dark ? "#a09b95" : "#8a8580" }}>{label}</div>
            <div className="text-[15px] font-semibold" style={{ color: dark ? "#efece8" : "#25211e", fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
  const grant = async (u) => {
    const ok = await confirm({ title: `Make ${u.name || u.email} a reseller?`, body: confirmBody("They pay wholesale on every order from now on.", u.orders, u.spend), confirmLabel: "Grant access" });
    if (ok) act(u.userId, "approve", { catalog: "curated" });
  };
  const restore = async (r) => {
    const ok = await confirm({ title: `Restore ${r.name || r.email}?`, body: confirmBody("Wholesale pricing resumes on their next order.", r.recentOrders, r.recentSpend), confirmLabel: "Restore" });
    if (ok) act(r.userId, "approve");
  };
  const revoke = async (r) => {
    const ok = await confirm({ title: `Revoke ${r.name || r.email}?`, message: "They go back to retail on their next order. Their record and API key are kept, so this can be undone.", confirmLabel: "Revoke", danger: true });
    if (ok) act(r.userId, "revoke");
  };
  const closeGrant = () => { setGrantOpen(false); setQuery(""); if (data?.query) load(); };

  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93",
    "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--acbg": dark ? "rgba(196,125,142,.16)" : "rgba(196,125,142,.09)", "--acln": dark ? "rgba(196,125,142,.7)" : "rgba(196,125,142,.55)",
    "--ok": dark ? "#6ee7b7" : "#0a7d54", "--bad": dark ? "#fca5a5" : "#c62828", "--blue": dark ? "#a5b4fc" : "#4c62c4", "--bluebg": dark ? "rgba(122,162,247,.18)" : "rgba(122,162,247,.14)",
  };
  const bone = (w, h = 12, cls = "") => <i className={`re-bone skel-bone ${dark ? "skel-dark" : "skel-light"} ${cls}`} style={{ width: w, height: h }} />;
  const rows = data ? [...data.resellers.filter(r => r.enabled), ...data.resellers.filter(r => !r.enabled)] : [];
  const sum = data?.summary;
  const header = <div className="re-rh"><span>Reseller</span><span>Status</span><span>Catalogue</span><span>Rate</span><span className="r">Orders · spend, {data?.windowDays || 90}d</span><span>Why</span><span>Approved</span><span /></div>;

  return (
    <div className="re" style={vars}>
      <style>{CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Resellers</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Who buys at wholesale, what they do with it, and why they have it.</div>
          </div>
          <button type="button" className="re-pri" onClick={() => setGrantOpen(true)}>Grant access</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className="re-stats">
        {loading || !sum ? Array.from({ length: 4 }, (_, i) => <div key={i} className="re-stt">{bone(64, 20)}{bone(80, 10)}{bone(100, 10)}</div>) : <>
          <div className="re-stt"><b className="m">{sum.active}</b><span>Active</span><i>{sum.revoked ? `${sum.revoked} revoked` : "none revoked"}{sum.onFullCatalogue ? ` · ${sum.onFullCatalogue} on the full catalogue` : ""}</i></div>
          <div className="re-stt"><b className="m">{sum.orders.toLocaleString()}</b><span>Orders</span><i>last {data.windowDays} days</i></div>
          <div className="re-stt"><b className="m">{naira(sum.revenue)}</b><span>Revenue</span><i>{sum.revenueShare}% of all sales</i></div>
          <div className="re-stt"><b className="m">{naira(sum.avgOrder)}</b><span>Average order</span><i>everyone: {naira(sum.avgOrderEveryone)}</i></div>
        </>}
      </div>

      <div className="re-list">
        {header}
        {loading ? Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="re-rr sk">
            <span className="re-un">{bone(34, 34, "av")}<span className="re-unt">{bone(160, 13)}{bone(200, 10)}</span></span>
            <span>{bone(52)}</span><span>{bone(72, 28)}</span><span>{bone(50, 28)}</span><span className="r">{bone(110)}</span><span>{bone("90%", 28)}</span><span>{bone(60)}</span><span className="re-ra">{bone(58, 26)}</span>
          </div>
        )) : rows.length === 0 ? (
          <div className="re-empty">No resellers yet. Grant access to an account to start.</div>
        ) : rows.map(r => {
          const on = r.enabled;
          return (
            <div key={r.id} className={"re-rr" + (on ? "" : " off")}>
              <span className="re-un">
                <span className="re-av">{initials(r.name || r.email)}</span>
                <span className="re-unt">
                  <b><span>{r.name || "(no name)"}</span><span className={`re-ch ${r.catalog === "full" ? "full" : "cur"}`}>{r.catalog === "full" ? "Full catalogue" : "Curated"}</span>{r.apiOrders > 0 && <span className="re-ch api">API · {r.apiOrders}</span>}</b>
                  <i>{r.email}</i>
                </span>
              </span>
              <span className="re-st"><i className={`re-dot ${on ? "ok" : "bad"}`} />{on ? "Active" : "Revoked"}</span>
              <span className="re-selw">
                <select className="re-sel" value={r.catalog} disabled={!on || !!busy} onChange={e => act(r.userId, "catalog", { catalog: e.target.value }, "catalog")}>
                  <option value="curated">Curated</option><option value="full">Full</option>
                </select>
              </span>
              <input className="re-in m re-rate" value={rateDraft[r.userId] ?? (r.discountPct ?? "")} placeholder={`${data.globalDiscount}%`} disabled={!on || !!busy} inputMode="numeric" aria-label="Discount rate"
                onChange={e => setRateDraft(p => ({ ...p, [r.userId]: e.target.value.replace(/[^0-9]/g, "") }))}
                onBlur={() => { const v = rateDraft[r.userId]; if (v === undefined || v === String(r.discountPct ?? "")) return; act(r.userId, "rate", { discountPct: v }, "rate"); }} />
              <span className="r m re-act"><b>{r.recentOrders}</b> · {naira(r.recentSpend)}</span>
              <input className="re-in re-why" value={noteDraft[r.userId] ?? r.notes ?? ""} placeholder="Why they have it…" disabled={!!busy} aria-label="Reason"
                onChange={e => setNoteDraft(p => ({ ...p, [r.userId]: e.target.value }))}
                onBlur={() => { const v = noteDraft[r.userId]; if (v === undefined || v === (r.notes ?? "")) return; act(r.userId, "notes", { notes: v }, "notes"); }} />
              <span className="re-ap" title={r.approvedBy ? `by ${r.approvedBy}` : ""}>{fmtDate(r.approvedAt)}{r.approvedBy && <i>by {r.approvedBy}</i>}</span>
              <span className="re-ra">
                {on ? <button type="button" className="re-b sm danger" disabled={!!busy} onClick={() => revoke(r)}>{busy === r.userId + "revoke" ? "…" : "Revoke"}</button>
                  : <button type="button" className="re-b sm" disabled={!!busy} onClick={() => restore(r)}>{busy === r.userId + "approve" ? "…" : "Restore"}</button>}
              </span>
            </div>
          );
        })}
      </div>

      {grantOpen && (
        <div className="re-ov" onClick={closeGrant}>
          <div className="re-md" onClick={e => e.stopPropagation()} role="dialog" aria-label="Grant access">
            <div className="re-mh"><b>Grant access</b><button type="button" className="re-x" onClick={closeGrant} aria-label="Close">✕</button></div>
            <div className="re-mb">
              <p className="re-hint">Resellers ask on WhatsApp. Find the account; they pay wholesale from their next order.</p>
              <div className="re-srch"><span className="re-si">{SEARCH}</span><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or email" />{searching && <span className="re-cnt">Searching…</span>}</div>
              {data?.query && (
                <div className="re-grs">
                  {data.results.length === 0 ? <div className="re-empty" style={{ padding: 20 }}>No active account matches “{data.query}”.</div> : data.results.map(u => (
                    <div key={u.userId} className="re-gr">
                      <span className="re-un"><span className="re-av">{initials(u.name || u.email)}</span><span className="re-unt"><b><span>{u.name || "(no name)"}</span></b><i>{u.email}</i></span></span>
                      <span className="m re-cnt re-gact">{u.orders} · {naira(u.spend)}</span>
                      {u.alreadyReseller ? <span className="re-cnt">already a reseller</span> : <button type="button" className="re-b sm" disabled={!!busy} onClick={() => grant(u)}>{busy === u.userId + "approve" ? "…" : "Grant"}</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.re{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.re *{box-sizing:border-box}
.re .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.re .r{text-align:right}
.re-b{font:inherit;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;transition:transform .15s}
.re-b:hover{transform:translateY(-1px)}.re-b.sm{padding:5px 9px;font-size:11.5px}.re-b.danger{color:var(--bad)}.re-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
.re-pri{font:inherit;font-size:12.5px;font-weight:800;padding:8px 16px;border-radius:9px;border:0;background:var(--ac);color:#fff;cursor:pointer;box-shadow:0 8px 22px rgba(196,125,142,.28);white-space:nowrap;flex-shrink:0;transition:transform .15s}.re-pri:hover{transform:translateY(-1px)}
.re-cnt{font-size:11.5px;color:var(--dim);white-space:nowrap}
.re-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.re-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;gap:3px;min-width:0}.re-stt:first-child{border-left:0}
.re-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.re-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}.re-stt i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.re-list{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.re-rh,.re-rr{display:grid;grid-template-columns:minmax(150px,1.3fr) 76px 86px 56px minmax(120px,1.1fr) minmax(0,1fr) 74px auto;align-items:center;gap:10px;padding:0 14px}
.re-rh{height:34px;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);background:var(--soft);border-bottom:1px solid var(--line);white-space:nowrap}
.re-rr{padding-top:9px;padding-bottom:9px;border-top:1px solid var(--rail);font-size:13px;min-width:0}.re-rr:hover{background:var(--soft)}.re-rr.sk:hover{background:none}
.re-rr.off .re-un,.re-rr.off .re-act,.re-rr.off .re-ap,.re-rr.off .re-selw,.re-rr.off .re-rate,.re-rr.off .re-why{opacity:.5;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.re-av{width:34px;height:34px;border-radius:50%;background:var(--ac);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.re-un{display:flex;align-items:center;gap:10px;min-width:0}.re-unt{display:flex;flex-direction:column;gap:2px;min-width:0}
.re-unt b{display:flex;align-items:center;gap:6px;font-weight:600;min-width:0}.re-unt b>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.re-unt i{font-style:normal;font-size:11.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.re-ch{font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:2px 6px;border-radius:6px;flex-shrink:0;white-space:nowrap}.re-ch.full{background:var(--acbg);color:var(--ac)}.re-ch.cur{background:var(--soft);color:var(--mut);border:1px solid var(--line)}.re-ch.api{background:var(--bluebg);color:var(--blue)}
.re-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--mut);white-space:nowrap}.re-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}.re-dot.ok{background:var(--ok)}.re-dot.bad{background:var(--bad)}
.re-selw{position:relative;display:block}.re-sel{width:100%;height:28px;padding:0 22px 0 9px;border-radius:8px;background:var(--card);border:1px solid var(--line);font:inherit;font-size:12px;font-weight:600;color:var(--ink);appearance:none;-webkit-appearance:none;cursor:pointer;background-image:linear-gradient(45deg,transparent 50%,var(--dim) 50%),linear-gradient(135deg,var(--dim) 50%,transparent 50%);background-position:calc(100% - 13px) 11px,calc(100% - 9px) 11px;background-size:4px 4px;background-repeat:no-repeat}.re-sel:disabled{cursor:not-allowed}
.re-in{height:28px;padding:0 9px;border-radius:8px;border:1px solid var(--line);background:var(--card);font:inherit;font-size:12px;color:var(--ink);outline:none;min-width:0;width:100%}.re-in:focus{border-color:var(--acln)}.re-in::placeholder{color:var(--dim)}.re-in:disabled{cursor:not-allowed}
.re-rate{text-align:center}.re-why{font-size:12px}
.re-act{white-space:nowrap;font-size:12.5px}.re-act b{font-weight:700}
.re-ap{font-size:12px;color:var(--mut);display:flex;flex-direction:column;white-space:nowrap}.re-ap i{font-style:normal;font-size:11px;color:var(--dim);overflow:hidden;text-overflow:ellipsis}
.re-ra{display:flex;justify-content:flex-end}
.re-empty{padding:40px 14px;text-align:center;font-size:13px;color:var(--mut)}
.re-bone{display:block;margin:3px 0}.re-bone.av{border-radius:50%;margin:0}
.re-ov{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px}
.re-md{width:100%;max-width:520px;max-height:100%;border-radius:16px;background:var(--card);border:1px solid var(--line);box-shadow:0 24px 48px rgba(0,0,0,.3);display:flex;flex-direction:column;color:var(--ink)}
.re-mh{display:flex;justify-content:space-between;align-items:center;padding:14px 20px;border-bottom:1px solid var(--line)}.re-mh b{font-size:16px;font-weight:700}
.re-x{background:none;border:0;color:var(--mut);cursor:pointer;font-size:14px;padding:4px}
.re-mb{padding:14px 20px 18px;display:flex;flex-direction:column;gap:12px;overflow:auto}.re-hint{margin:0;font-size:12.5px;color:var(--mut);line-height:1.5}
.re-srch{display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);font-size:13.5px}.re-srch:focus-within{border-color:var(--acln)}
.re-si{display:inline-flex;width:14px;height:14px;color:var(--dim);flex-shrink:0}.re-si svg{width:14px;height:14px}.re-srch input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13.5px;color:var(--ink);outline:none}
.re-grs{border:1px solid var(--line);border-radius:12px;overflow:hidden}.re-gr{display:flex;align-items:center;gap:12px;padding:10px 12px;border-top:1px solid var(--rail);font-size:13px}.re-gr:first-child{border-top:0}.re-gr .re-un{flex:1}.re-gact{font-size:12px}
@media (max-width:900px){
  .re-stats{grid-template-columns:1fr 1fr}.re-stt:nth-child(3){border-left:0}.re-stt:nth-child(n+3){border-top:1px solid var(--line)}.re-stt b{font-size:17px}
  .re-rh{display:none}
  .re-list{background:none;border:0;border-radius:0;overflow:visible;display:flex;flex-direction:column;gap:10px}
  .re-rr{display:grid;grid-template-columns:1fr auto;grid-template-areas:"un st" "act act" "why why" "ctl ctl";gap:8px 10px;padding:12px;background:var(--card);border:1px solid var(--line);border-radius:14px}.re-rr:hover{background:var(--card)}
  .re-empty{background:var(--card);border:1px solid var(--line);border-radius:14px}
  .re-un{grid-area:un}.re-st{grid-area:st;justify-self:end;align-self:start}.re-ap{display:none}
  .re-act{grid-area:act;text-align:left;font-size:12.5px}.re-act::after{content:" · last 90 days";color:var(--dim)}
  .re-why{grid-area:why;height:32px}
  .re-selw,.re-rate,.re-ra{grid-area:ctl}.re-rr{position:relative}
  .re-rr>.re-selw{width:104px;justify-self:start}.re-rr>.re-rate{width:64px;justify-self:start;margin-left:112px}.re-ra{justify-self:end}
  .re-rr.sk{grid-template-areas:"un st" "act act" "why why" "ctl ctl"}
  .re-ov{padding:0;align-items:flex-end}.re-md{border-radius:20px 20px 0 0;max-height:92%}
  .re-gr{flex-wrap:wrap}.re-gr .re-un{flex-basis:100%}
}
`;
