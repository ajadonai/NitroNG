'use client';
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "./ui-primitives";
import { OffsetIcon } from "./offset-icons";
import { useToast } from "./toast";
import { useConfirm } from "./confirm-dialog";
import { CopyChip } from "./copy-chip";
import { formatNaira } from "@/lib/money";

/**
 * "Service 301" → everything about it, and the switches, in one sheet.
 *
 * A customer quotes one number for a service: the one on the full list, on
 * their order card and in the API. Admin pages showed the provider's number,
 * so finding what a customer meant took a database (17 Oct 2026). This sheet
 * opens from the top bar, from `/` anywhere in admin, or from a Service ID on
 * an order, and answers from /api/admin/services/lookup: what it is, prices,
 * whether customers can see and order it and why not, what uses it, how it has
 * been ordering. Blacklist, the on/off switch and markup act in place, through
 * the same endpoint Raw Services uses, and the answer refreshes after.
 *
 * Mounted once by the admin dashboard. Anything can open it with
 * openServiceLookup(301).
 */
const EVENT = "nitro:service-lookup";
export const RAW_SEARCH_KEY = "adm-raw-search";
export const RAW_SEARCH_EVENT = "nitro:raw-search";
export function openServiceLookup(q = "") {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { q: q == null ? "" : String(q) } }));
}

const FIND = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;

/** The top-bar trigger. Its look lives in the sheet's styles, mounted with it. */
export function ServiceLookupButton() {
  return (
    <button type="button" className="slk-trig" onClick={() => openServiceLookup()} aria-label="Find a service by its number" title="Find a service by its number (/)">
      {FIND}<span>Service #</span><kbd>/</kbd>
    </button>
  );
}

const SLK_CSS = `
.slk-trig{height:34px;display:inline-flex;align-items:center;gap:7px;padding-inline:11px 7px;border:0;border-radius:10px;font:inherit;font-size:12.5px;font-weight:650;cursor:pointer;color:var(--t-text-soft);background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border)}
.slk-trig:hover{color:var(--t-text);box-shadow:inset 0 0 0 1px var(--t-accent)}
.slk-trig:focus-visible{outline:2px solid var(--t-accent);outline-offset:2px}
.slk-trig kbd{font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:700;padding:2px 6px;border-radius:6px;color:var(--t-text-muted);background:rgba(0,0,0,.05)}
.dark .slk-trig kbd{background:rgba(255,255,255,.08)}
@media (max-width:767px){.slk-trig{width:34px;padding:0;justify-content:center}.slk-trig span,.slk-trig kbd{display:none}}
.slk{display:grid;gap:12px}
.slk-q{display:flex;gap:8px}
.slk-q input{flex:1;min-width:0;height:42px;padding-inline:13px;border:0;border-radius:11px;outline:none;font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--t-text);background:var(--t-card-bg);box-shadow:inset 0 0 0 1.5px var(--t-card-border)}
.slk-q input:focus{box-shadow:inset 0 0 0 2px var(--t-accent)}
.slk-hint{font-size:12.5px;line-height:1.55;color:var(--t-text-muted)}
.slk-msg{padding:14px;border-radius:13px;font-size:13.5px;line-height:1.55;color:var(--t-text-soft);background:rgba(196,125,142,.07);box-shadow:inset 0 0 0 1px rgba(196,125,142,.22)}
.slk-msg b{color:var(--t-text)}
.slk-card{display:grid;gap:12px;padding:14px;border-radius:16px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #efc4cf}
.dark .slk-card{box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #5e3242}
.slk-hd{display:flex;align-items:flex-start;gap:12px}
.slk-tt{flex:1;min-width:0}
.slk-tt b{display:block;font-size:15px;font-weight:750;line-height:1.3;color:var(--t-text)}
.slk-tt small{display:block;margin-top:3px;font-size:11.5px;line-height:1.4;color:var(--t-text-muted);overflow-wrap:anywhere}
.slk-chips{display:flex;flex-wrap:wrap;gap:6px}
.slk-vis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.slk-v{padding:10px 12px;border-radius:12px;font-size:12.5px;line-height:1.45}
.slk-v b{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:750}
.slk-v ul{margin:6px 0 0;padding-inline-start:16px;color:var(--t-text-soft)}
.slk-v.ok{color:var(--t-green);background:color-mix(in srgb,var(--t-green) 8%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--t-green) 25%,transparent)}
.slk-v.no{color:var(--act-amber);background:color-mix(in srgb,var(--act-amber) 8%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--act-amber) 28%,transparent)}
.slk-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));overflow:hidden;border-radius:12px;box-shadow:inset 0 0 0 1px var(--t-card-border)}
.slk-f{min-width:0;padding:9px 11px;box-shadow:0 0 0 .5px var(--t-card-border)}
.slk-f span{display:block;font-size:10px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--t-text-muted)}
.slk-f b{display:block;margin-top:2px;font-size:13px;font-weight:700;color:var(--t-text);overflow-wrap:anywhere}
.slk-f b.m{font-family:'JetBrains Mono',monospace}
.slk-mk{display:flex;align-items:center;gap:6px;margin-top:2px}
.slk-mk input{width:64px;height:28px;padding-inline:8px;border:0;border-radius:8px;outline:none;font-family:'JetBrains Mono',monospace;font-size:12.5px;font-weight:700;color:var(--t-text);background:var(--t-card-bg);box-shadow:inset 0 0 0 1.5px var(--t-accent)}
.slk-use{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:var(--t-text-soft)}
.slk-use b{color:var(--t-text);font-family:'JetBrains Mono',monospace}
.slk-tiers{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12px;color:var(--t-text-muted)}
.slk-acts{display:flex;flex-wrap:wrap;gap:8px;padding-top:12px;border-top:1px solid var(--t-card-border)}
.slk-acts .nb{flex:1 1 auto}
.slk-sk{height:180px;border-radius:16px}
@media (max-width:560px){.slk-vis{grid-template-columns:1fr}.slk-facts{grid-template-columns:repeat(2,minmax(0,1fr))}}
`;

const naira = (n) => (n == null ? "—" : formatNaira(n, { round: Math.abs(Number(n)) >= 100 }));
const day = (iso) => iso ? new Date(iso).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" }) : "never";

function ServiceCard({ s, busy, onAct, onRaw, dark }) {
  const [mk, setMk] = useState(null);
  const votes = s.votes.up + s.votes.down;
  const tc = (c) => ({ "--tc": dark ? c[1] : c[0] });
  return (
    <div className="slk-card">
      <div className="slk-hd">
        <CopyChip value={s.id != null ? String(s.id) : `p${s.providerId}`} display={s.id != null ? `#${s.id}` : `p${s.providerId}`} label="Copy the service number" />
        <div className="slk-tt"><b>{s.label}</b><small title="The provider's own name for it">{s.name}</small></div>
      </div>
      <div className="slk-chips">
        {s.platform && <span className="pbadge tag">{s.platform}</span>}
        <span className="pbadge tag">{s.type}</span>
        <span className={`pbadge ${s.refill ? "ok" : "tag"}`}>{s.refillLabel || (s.refill ? "Refill" : "No refill")}</span>
        {s.attrs.filter(a => a !== s.refillLabel).slice(0, 3).map(a => <span key={a} className="pbadge tag">{a}</span>)}
        {!s.enabled && <span className="pbadge no">Switched off</span>}
        {s.blacklisted && <span className="pbadge no">Blacklisted</span>}
      </div>
      <div className="slk-vis">
        <div className={`slk-v ${s.fullList.shown ? "ok" : "no"}`}>
          <b><OffsetIcon name={s.fullList.shown ? "checkCircle" : "alert"} size={14} />{s.fullList.shown ? "On the full list" : "Hidden from the full list"}</b>
          {s.fullList.why.length > 0 && <ul>{s.fullList.why.map(w => <li key={w}>{w}</li>)}</ul>}
        </div>
        <div className={`slk-v ${s.api.listed ? "ok" : "no"}`}>
          <b><OffsetIcon name={s.api.listed ? "checkCircle" : "alert"} size={14} />{s.api.listed ? "On the API, orderable" : "Not on the API"}</b>
          {s.api.why.length > 0 && <ul>{s.api.why.map(w => <li key={w}>{w}</li>)}</ul>}
        </div>
      </div>
      <div className="slk-facts">
        <div className="slk-f"><span>Retail per 1K</span>{s.tierPriced ? <b>The tier&apos;s price</b> : <b className="m">{naira(s.retail)}</b>}</div>
        {s.cost != null && <div className="slk-f"><span>Cost per 1K</span><b className="m">{naira(s.cost)}</b></div>}
        {s.margin != null && !s.tierPriced && <div className="slk-f"><span>Margin</span><b className="m">{s.margin}%</b></div>}
        {!s.tierPriced && <div className="slk-f"><span>Markup</span>
          {mk == null
            ? <b className="m" style={{ display: "flex", alignItems: "center", gap: 6 }}>{s.markup}%<button type="button" className="nb ghost sm" style={{ height: 22, padding: "0 7px" }} onClick={() => setMk(String(s.markup))}>Change</button></b>
            : <div className="slk-mk"><input aria-label="Markup percent" inputMode="numeric" value={mk} autoFocus onChange={e => setMk(e.target.value.replace(/\D/g, "").slice(0, 3))} onKeyDown={e => { if (e.key === "Enter") onAct(s, "markup", { markup: Number(mk) }).then(() => setMk(null)); if (e.key === "Escape") setMk(null); }} /><button type="button" className="nb pri sm" disabled={busy || mk === ""} onClick={() => onAct(s, "markup", { markup: Number(mk) }).then(() => setMk(null))}>Save</button></div>}
        </div>}
        <div className="slk-f"><span>Min to max</span><b className="m">{s.min.toLocaleString()} to {s.max.toLocaleString()}</b></div>
        <div className="slk-f"><span>Provider</span><b className="m">{s.provider ? `${s.provider.toUpperCase()} ` : ""}#{s.providerId}</b></div>
        <div className="slk-f"><span>Last confirmed</span><b>{day(s.lastConfirmed)}</b></div>
        <div className="slk-f"><span>Cancel, drip</span><b>{s.cancel ? "Cancel" : "No cancel"}, {s.dripfeed ? "drip" : "no drip"}</b></div>
      </div>
      <div className="slk-use">
        <span><b>{s.orders.live30}</b> live of <b>{s.orders.last30}</b> orders in 30 days</span>
        <span><b>{s.orders.allTime.toLocaleString()}</b> all time, last {day(s.orders.lastAt)}</span>
        <span>{votes ? <><b>{Math.round((s.votes.up / votes) * 100)}%</b> of {votes} votes up</> : "No votes yet"}</span>
        <span>Saved by <b>{s.saved}</b></span>
      </div>
      {s.tiers.length > 0 && (
        <div className="slk-tiers">Used by {s.tiers.map(ti => <span key={`${ti.group}-${ti.tier}`} className="ic-tile tc" style={{ ...tc(ti.enabled ? ["#047c57", "#6ee7b7"] : ["#8d828b", "#a09890"]), width: "auto", height: 24, padding: "0 8px", borderRadius: 7, fontSize: 11.5, fontWeight: 700 }}>{ti.group}, {ti.tier}{ti.enabled ? "" : " (off)"}</span>)}</div>
      )}
      <div className="slk-acts">
        <button type="button" className="nb warn sm" disabled={busy} onClick={() => onAct(s, "blacklist")}>{s.blacklisted ? "Restore to full list" : "Blacklist from full list"}</button>
        <button type="button" className="nb sec sm" disabled={busy} onClick={() => onAct(s, "toggle")}>{s.enabled ? "Switch off" : "Switch on"}</button>
        <button type="button" className="nb sec sm" onClick={() => onRaw(s)}><OffsetIcon name="db" size={13} />Open in Raw Services</button>
      </div>
    </div>
  );
}

export function ServiceLookup({ dark, onNavigate }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastQ = useRef("");
  const inputRef = useRef(null);
  // The modal moves focus to its panel as it opens; the box takes it back so
  // typing straight after `/` lands in it.
  useEffect(() => { if (!open) return undefined; const id = setTimeout(() => inputRef.current?.focus(), 60); return () => clearTimeout(id); }, [open]);

  const run = useCallback(async (query) => {
    const v = String(query ?? "").trim();
    if (!v) return;
    lastQ.current = v;
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/services/lookup?q=${encodeURIComponent(v)}`, { cache: "no-store" });
      const d = await r.json();
      setRes(r.ok ? d : { kind: "error", error: d.error || "Lookup failed" });
    } catch { setRes({ kind: "error", error: "Check your connection and try again." }); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const onOpen = (e) => { const v = e.detail?.q || ""; setOpen(true); setQ(v); setRes(null); if (v) run(v); };
    const onKey = (e) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault(); setOpen(true);
    };
    window.addEventListener(EVENT, onOpen);
    document.addEventListener("keydown", onKey);
    return () => { window.removeEventListener(EVENT, onOpen); document.removeEventListener("keydown", onKey); };
  }, [run]);

  const act = useCallback(async (s, action, extra = {}) => {
    if (action === "blacklist" && !s.blacklisted) {
      const ok = await confirm({ title: `Blacklist ${s.id != null ? `#${s.id}` : "this service"}?`, message: "It comes off the full list and the API, and orders for it are refused. You can undo this here or in Raw Services.", confirmLabel: "Blacklist", danger: true });
      if (!ok) return;
    }
    if (action === "toggle" && s.enabled && s.tiers.some(ti => ti.enabled)) {
      const ok = await confirm({ title: "Switch it off?", message: "Curated tiers using it are switched off with it in Menu Builder.", confirmLabel: "Switch off", danger: true });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/admin/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, serviceId: s.sid, ...extra }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) toast.error("Not saved", d.error || "Try again");
      else toast.success("Saved", d.message || (action === "blacklist" ? (d.blacklisted ? "Blacklisted" : "Restored to the full list") : action === "toggle" ? (d.enabled ? "Switched on" : "Switched off") : `Markup ${d.markup}%`));
    } catch { toast.error("Not saved", "Check your connection"); }
    setBusy(false);
    await run(lastQ.current);
  }, [confirm, run, toast]);

  const openRaw = (s) => {
    const v = s.id != null ? `#${s.id}` : `p${s.providerId}`;
    try { sessionStorage.setItem(RAW_SEARCH_KEY, v); } catch {}
    window.dispatchEvent(new CustomEvent(RAW_SEARCH_EVENT, { detail: { q: v } }));
    setOpen(false);
    onNavigate?.("services");
  };

  return (
    <>
      <style>{SLK_CSS}</style>
      <Modal open={open} onClose={() => setOpen(false)} dark={dark} maxWidth={640} title="Find a service" subtitle="By the number a customer quotes" icon={<OffsetIcon name="tag" size={17} />}>
        <div className="slk">
          <form className="slk-q" onSubmit={e => { e.preventDefault(); run(q); }}>
            <input ref={inputRef} aria-label="Service number" placeholder="301" value={q} autoComplete="off" onChange={e => setQ(e.target.value)} />
            <button type="submit" className="nb pri" disabled={!q.trim() || loading}>Look up</button>
          </form>
          {!res && !loading && <div className="slk-hint">The number customers see on the full list, on their order card and in the API. Type p5603 for a provider&apos;s own number instead.</div>}
          {loading && <div className={`skel-bone slk-sk ${dark ? "skel-dark" : "skel-light"}`} />}
          {!loading && res?.kind === "error" && <div className="slk-msg">{res.error}</div>}
          {!loading && res?.kind === "none" && <div className="slk-msg">No service answers to <b>{res.query.startsWith("p") ? res.query : `#${res.query}`}</b>. Check the number with the customer; it is on their order card under Service ID.</div>}
          {!loading && res?.kind === "retired" && <div className="slk-msg"><b>#{res.id}</b> is retired. It once pointed at a service that is gone, and the API now answers &quot;Service discontinued&quot;.</div>}
          {!loading && res?.kind === "tier" && <div className="slk-msg"><b>#{res.id}</b> is a curated tier: <b>{res.tier.group}, {res.tier.tier}</b> on {res.tier.platform}, {naira(res.tier.retail)} per 1K{res.tier.margin != null ? `, ${res.tier.margin}% over cost` : ""}, {res.tier.enabled ? "on sale" : "switched off"}{res.retired ? ", retired" : ""}. The service under it is below.</div>}
          {!loading && (res?.kind === "service" || res?.kind === "tier") && res.services.map(s => <ServiceCard key={s.sid} s={s} busy={busy} onAct={act} onRaw={openRaw} dark={dark} />)}
        </div>
      </Modal>
    </>
  );
}
