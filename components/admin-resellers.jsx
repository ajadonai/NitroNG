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
  const [openId, setOpenId] = useState(null); // userId whose drawer is open
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

  // The modal or drawer owns the screen while it is up.
  useEffect(() => {
    if (!grantOpen && !openId) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [grantOpen, openId]);

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
  const openR = openId ? rows.find(r => r.userId === openId) : null;
  const header = <div className="re-rh"><span>Reseller</span><span className="r">Orders · spend, {data?.windowDays || 90}d</span><span>Status</span><span /></div>;

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
            <span className="re-un">{bone(34, 34, "av")}<span className="re-unt">{bone(160, 13)}</span></span>
            <span className="r">{bone(110)}</span><span>{bone(52)}</span><span />
          </div>
        )) : rows.length === 0 ? (
          <div className="re-empty">No resellers yet. Grant access to an account to start.</div>
        ) : rows.map(r => {
          const on = r.enabled;
          return (
            <button type="button" key={r.id} className={"re-rr" + (on ? "" : " off")} onClick={() => setOpenId(r.userId)}>
              <span className="re-un">
                <span className="re-av">{initials(r.name || r.email)}</span>
                <span className="re-unt">
                  <b><span>{r.name || r.email}</span><span className={`re-ch ${r.catalog === "full" ? "full" : "cur"}`}>{r.catalog === "full" ? "Full catalogue" : "Curated"}</span>{r.apiOrders > 0 && <span className="re-ch api">API · {r.apiOrders}</span>}</b>
                </span>
              </span>
              <span className="r m re-act"><b>{r.recentOrders}</b> · {naira(r.recentSpend)}</span>
              <span className="re-st"><i className={`re-dot ${on ? "ok" : "bad"}`} />{on ? "Active" : "Revoked"}</span>
              <svg className="re-chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
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

      {openR && (
        <div className="re-ov dr" onClick={() => setOpenId(null)}>
          <div className="re-dr" onClick={e => e.stopPropagation()} role="dialog" aria-label={`${openR.name || openR.email} — reseller details`}>
            <div className="re-drh">
              <span className="re-av lg">{initials(openR.name || openR.email)}</span>
              <span className="re-unt"><b><span>{openR.name || "(no name)"}</span></b><i>{openR.email}</i></span>
              <button type="button" className="re-x" onClick={() => setOpenId(null)} aria-label="Close">✕</button>
            </div>
            <div className="re-st"><i className={`re-dot ${openR.enabled ? "ok" : "bad"}`} />{openR.enabled ? "Active" : "Revoked"}<span className="re-cnt" style={{ marginLeft: "auto" }}>granted {fmtDate(openR.approvedAt)}{openR.approvedBy ? ` by ${openR.approvedBy}` : ""}</span></div>
            <div className="re-fld">
              <label>Catalogue</label>
              <div className="re-segs">
                {[["curated", "Curated"], ["full", "Full — API only"]].map(([v, l]) => (
                  <button type="button" key={v} className={`re-seg${openR.catalog === v ? " on" : ""}`} disabled={!openR.enabled || !!busy} onClick={() => { if (openR.catalog !== v) act(openR.userId, "catalog", { catalog: v }, "catalog"); }}>{l}</button>
                ))}
              </div>
            </div>
            <div className="re-fld">
              <label>Personal rate</label>
              <div className="re-inl">
                <input className="re-in m re-rate" value={rateDraft[openR.userId] ?? (openR.discountPct ?? "")} placeholder={`${data.globalDiscount}%`} disabled={!openR.enabled || !!busy} inputMode="numeric" aria-label="Discount rate"
                  onChange={e => setRateDraft(p => ({ ...p, [openR.userId]: e.target.value.replace(/[^0-9]/g, "") }))}
                  onBlur={() => { const v = rateDraft[openR.userId]; if (v === undefined || v === String(openR.discountPct ?? "")) return; act(openR.userId, "rate", { discountPct: v }, "rate"); }} />
                <span className="re-cnt">below retail · default is {data.globalDiscount}%</span>
              </div>
            </div>
            <div className="re-fld">
              <label>Why they have it</label>
              <input className="re-in re-why" value={noteDraft[openR.userId] ?? openR.notes ?? ""} placeholder="Why they have it…" disabled={!!busy} aria-label="Reason"
                onChange={e => setNoteDraft(p => ({ ...p, [openR.userId]: e.target.value }))}
                onBlur={() => { const v = noteDraft[openR.userId]; if (v === undefined || v === (openR.notes ?? "")) return; act(openR.userId, "notes", { notes: v }, "notes"); }} />
            </div>
            <div className="re-facts">
              <div className="re-fact"><span>Orders · {data?.windowDays || 90} days</span><b className="m">{openR.recentOrders} · {naira(openR.recentSpend)}</b></div>
              <div className="re-fact"><span>Through the API</span><b className="m">{openR.apiOrders || 0} of {openR.recentOrders}</b></div>
              <div className="re-fact"><span>Granted</span><b>{fmtDate(openR.approvedAt)}{openR.approvedBy ? ` by ${openR.approvedBy}` : ""}</b></div>
            </div>
            <div className="re-dra">
              {openR.enabled
                ? <button type="button" className="re-b danger" disabled={!!busy} onClick={() => revoke(openR)}>{busy === openR.userId + "revoke" ? "…" : "Revoke access"}</button>
                : <button type="button" className="re-b ok" disabled={!!busy} onClick={() => restore(openR)}>{busy === openR.userId + "approve" ? "…" : "Restore access"}</button>}
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
.re-b:hover{transform:translateY(-1px)}.re-b.sm{padding:5px 9px;font-size:11.5px}.re-b.danger{color:var(--bad)}.re-b.ok{color:var(--ok)}.re-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
.re-pri{font:inherit;font-size:12.5px;font-weight:800;padding:8px 16px;border-radius:9px;border:0;background:var(--ac);color:#fff;cursor:pointer;box-shadow:0 8px 22px rgba(196,125,142,.28);white-space:nowrap;flex-shrink:0;transition:transform .15s}.re-pri:hover{transform:translateY(-1px)}
.re-cnt{font-size:11.5px;color:var(--dim);white-space:nowrap}
.re-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.re-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;gap:3px;min-width:0}.re-stt:first-child{border-left:0}
.re-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.re-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}.re-stt i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.re-list{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow-x:auto}
.re-rh,.re-rr{display:grid;grid-template-columns:minmax(160px,1fr) minmax(120px,auto) 84px 18px;align-items:center;gap:10px;padding:0 14px}
.re-rh{height:34px;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);background:var(--soft);border-bottom:1px solid var(--line);white-space:nowrap}
.re-rr{width:100%;padding-top:10px;padding-bottom:10px;border:0;border-top:1px solid var(--rail);background:transparent;color:var(--ink);font:inherit;font-size:13px;text-align:left;cursor:pointer;min-width:0}.re-rr:hover{background:var(--soft)}.re-rr.sk:hover{background:none}.re-rr.sk{cursor:default}
.re-rr.off .re-un,.re-rr.off .re-act{opacity:.5;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.re-chev{color:var(--dim);flex-shrink:0}
.re-av{width:34px;height:34px;border-radius:50%;background:var(--ac);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.re-un{display:flex;align-items:center;gap:10px;min-width:0}.re-unt{display:flex;flex-direction:column;gap:2px;min-width:0}
.re-unt b{display:flex;align-items:center;gap:6px;font-weight:600;min-width:0}.re-unt b>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.re-unt i{font-style:normal;font-size:11.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.re-ch{font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:2px 6px;border-radius:6px;flex-shrink:0;white-space:nowrap}.re-ch.full{background:var(--acbg);color:var(--ac)}.re-ch.cur{background:var(--soft);color:var(--mut);border:1px solid var(--line)}.re-ch.api{background:var(--bluebg);color:var(--blue)}
.re-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--mut);white-space:nowrap}.re-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}.re-dot.ok{background:var(--ok)}.re-dot.bad{background:var(--bad)}
.re-in{height:34px;padding:0 11px;border-radius:9px;border:1px solid var(--line);background:var(--soft);font:inherit;font-size:12.5px;color:var(--ink);outline:none;min-width:0;width:100%}.re-in:focus{border-color:var(--acln)}.re-in::placeholder{color:var(--dim)}.re-in:disabled{cursor:not-allowed;opacity:.6}
.re-rate{text-align:center;width:76px;flex-shrink:0}.re-why{font-size:12.5px}
.re-act{white-space:nowrap;font-size:12.5px}.re-act b{font-weight:700}
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
.re-ov.dr{align-items:stretch;justify-content:flex-end;padding:0}
.re-dr{width:400px;max-width:100%;background:var(--card);border-left:1px solid var(--line);box-shadow:-24px 0 60px rgba(0,0,0,.25);padding:18px 20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;color:var(--ink)}
.re-drh{display:flex;align-items:center;gap:11px}.re-drh .re-unt b{font-size:15px}.re-drh .re-x{margin-left:auto}
.re-av.lg{width:40px;height:40px;font-size:14px}
.re-fld{display:flex;flex-direction:column;gap:6px}.re-fld>label{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}
.re-inl{display:flex;align-items:center;gap:10px}
.re-segs{display:flex;background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:3px;gap:2px}
.re-seg{flex:1;font:inherit;font-size:12px;font-weight:600;padding:7px 10px;border-radius:7px;border:0;background:transparent;color:var(--mut);cursor:pointer;white-space:nowrap}
.re-seg.on{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.re-seg:disabled{cursor:not-allowed;opacity:.6}.re-seg.on:disabled{opacity:1}
.re-facts{border-top:1px solid var(--line)}
.re-fact{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid var(--rail);font-size:13px}
.re-fact span{color:var(--mut)}.re-fact b{font-weight:700;text-align:right}
.re-dra{margin-top:auto;display:flex;gap:8px;padding-top:6px}.re-dra .re-b{flex:1}
@media (max-width:900px){
  .re-stats{grid-template-columns:1fr 1fr}.re-stt:nth-child(3){border-left:0}.re-stt:nth-child(n+3){border-top:1px solid var(--line)}.re-stt b{font-size:17px}
  .re-rh{display:none}
  .re-list{background:none;border:0;border-radius:0;display:flex;flex-direction:column;gap:10px}
  .re-rr{display:grid;grid-template-columns:1fr auto 18px;grid-template-areas:"un st chev" "act act act";gap:6px 10px;padding:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;min-width:0}.re-rr:hover{background:var(--card)}
  .re-un{grid-area:un}.re-st{grid-area:st;justify-self:end;align-self:center}.re-chev{grid-area:chev;align-self:center}
  .re-act{grid-area:act;text-align:left;font-size:12.5px;padding-left:44px}.re-act::after{content:" · last 90 days";color:var(--dim)}
  .re-rr.sk{grid-template-areas:"un st chev" "act act act"}
  .re-empty{background:var(--card);border:1px solid var(--line);border-radius:14px}
  .re-ov{padding:0;align-items:flex-end}.re-md{border-radius:20px 20px 0 0;max-height:92%}
  .re-ov.dr{align-items:flex-end;justify-content:center}
  .re-dr{width:100%;max-height:92%;border-left:0;border-top:1px solid var(--line);border-radius:20px 20px 0 0;box-shadow:0 -18px 50px rgba(0,0,0,.3)}
  .re-dra{margin-top:4px}
  .re-gr{flex-wrap:wrap}.re-gr .re-un{flex-basis:100%}
}
`;
