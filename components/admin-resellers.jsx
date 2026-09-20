'use client';
import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "./toast";
import { useConfirm } from "./confirm-dialog";
import { formatNaira } from '../lib/money';

const naira = (n) => formatNaira(n, { round: false });
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
  const [modeDraft, setModeDraft] = useState({});
  const [grantOpen, setGrantOpen] = useState(false);
  // "auto", or "seed:T2" / "pin:T2". One control rather than a mode and a
  // rung, because the two are never chosen independently.
  const [start, setStart] = useState("auto");
  const [startMode, startTier] = start === "auto" ? ["auto", null] : start.split(":");
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
    const ok = await confirm({ title: `Make ${u.name || u.email} a reseller?`, body: confirmBody(startLead, u.orders, u.spend), confirmLabel: "Grant access" });
    if (ok) act(u.userId, "approve", { start: startMode, startTier });
  };
  const restore = async (r) => {
    const ok = await confirm({ title: `Restore ${r.name || r.email}?`, body: confirmBody("Wholesale pricing resumes on their next order.", r.recentOrders, r.recentSpend), confirmLabel: "Restore" });
    if (ok) act(r.userId, "approve");
  };
  const revoke = async (r) => {
    const ok = await confirm({ title: `Revoke ${r.name || r.email}?`, message: "They go back to retail on their next order. Their record and API key are kept, so this can be undone.", confirmLabel: "Revoke", danger: true });
    if (ok) act(r.userId, "revoke");
  };
  // The other half of revoke. Named for what it destroys rather than left to
  // "this cannot be undone", which tells you nothing about what you are losing.
  const remove = async (r) => {
    const ok = await confirm({
      title: `Remove ${r.name || r.email}?`,
      body: (
        <div className="mb-5 text-sm leading-[1.65]" style={{ color: dark ? "#a09b95" : "#555250" }}>
          <p className="mt-0 mb-2">This deletes the reseller profile and cannot be undone.</p>
          <ul className="m-0 pl-4">
            <li className="mb-1.5"><b style={{ color: dark ? "#fca5a5" : "#c62828" }}>Their API key is destroyed.</b> Anything built on it stops working, and coming back later means a new key and a rebuild — not the rewire that revoking and restoring gives them.</li>
            <li><b style={{ color: dark ? "#fca5a5" : "#c62828" }}>Their ladder history goes with it.</b> {r.tierEvents === 1 ? "The one move" : `All ${r.tierEvents || 0} moves`} on the rungs, with the spend behind {r.tierEvents === 1 ? "it" : "them"}, deleted.</li>
          </ul>
          <p className="mb-0 mt-2.5">Their orders, and what they paid, are untouched.</p>
        </div>
      ),
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    setOpenId(null);
    act(r.userId, "remove");
  };
  const closeGrant = () => { setGrantOpen(false); setQuery(""); setStart("auto"); if (data?.query) load(); };

  const vars = {
    "--card": "var(--t-card-bg)", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93",
    "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#120c1e" : "#faf9f7",
    "--ac": t.accent, "--acbg": dark ? "rgba(196,125,142,.16)" : "rgba(196,125,142,.09)", "--acln": dark ? "rgba(196,125,142,.7)" : "rgba(196,125,142,.55)",
    "--ok": dark ? "#6ee7b7" : "#0a7d54", "--bad": dark ? "#fca5a5" : "#c62828", "--blue": dark ? "#a5b4fc" : "#4c62c4", "--bluebg": dark ? "rgba(122,162,247,.18)" : "rgba(122,162,247,.14)",
  };
  const bone = (w, h = 12, cls = "") => <i className={`re-bone skel-bone ${dark ? "skel-dark" : "skel-light"} ${cls}`} style={{ width: w, height: h }} />;
  const rows = data ? [...data.resellers.filter(r => r.enabled), ...data.resellers.filter(r => !r.enabled)] : [];
  const sum = data?.summary;
  const openR = openId ? rows.find(r => r.userId === openId) : null;
  const ladder = data?.ladder || { live: false, tiers: [], bandCaps: {}, seatLifetime: 0 };
  const mode = (r) => r?.tierMode || "auto";
  const tierOf = (r) => ladder.tiers.find(t => t.id === (mode(r) === "pinned" ? r.pinnedTier : r.tier)) || null;
  // The rung above whatever they are on, which is the only one worth naming.
  const nextRung = (r) => {
    const cur = tierOf(r);
    return ladder.tiers.find(t => t.threshold > (cur?.threshold ?? -1)) || null;
  };
  // Who is actually paying each rate today — revoked accounts keep their
  // stored tier so it is not lost if they come back, but they pay retail in
  // the meantime, so they never count toward a rung's headcount.
  const rungCount = (tierId) => rows.filter(r => r.enabled && r.rate?.tier === tierId).length;
  // Built once and drawn twice — as a strip on a wide screen and a list on a
  // narrow one. The two layouts are genuinely different shapes, but neither
  // should be able to disagree with the other about the numbers.
  const rungs = ladder.tiers.map(tier => ({
    ...tier,
    n: rungCount(tier.id),
    cap: ladder.bandCaps?.Ultra != null && ladder.bandCaps.Ultra < tier.pct ? ladder.bandCaps.Ultra : null,
  }));
  // The chosen start, explained under the control rather than all three
  // explained at once. Seeding is not pinning: it sets the opening rung and
  // steps back, and it holds for a while on its own because demotion only
  // fires at a month end and is skipped inside the first full month.
  const startT = ladder.tiers.find(t => t.id === startTier);
  const startHint = startMode === "auto"
    ? `Normal pricing until their 30-day spend clears ${naira((ladder.tiers[0]?.threshold || 0) / 100)}.`
    : startMode === "pin"
      ? `Held at ${startT?.name}, ${startT?.pct}%, whatever they spend — until you unpin them.`
      : `Opens on ${startT?.name} at ${startT?.pct}%. The ladder can promote them any night, but only demotes at a month end, and never inside their first full calendar month.`;
  const startLead = startMode === "auto"
    ? "They pay wholesale from their next order, at whatever rung their spend earns."
    : startMode === "pin"
      ? `They pay wholesale from their next order, pinned to ${startT?.name} at ${startT?.pct}%.`
      : `They pay wholesale from their next order, opening on ${startT?.name} at ${startT?.pct}%.`;
  // Pinned and custom are a fixed rate, not a climb - there is no bar to draw
  // for a rung that spend does not move you off. Auto gets the track, since
  // that is the one mode where "how close" is the number that matters.
  const rungTrack = (r) => {
    if (mode(r) !== "auto") return <span className={`re-ch ${mode(r)}`}>{mode(r) === "pinned" ? `Pinned · ${r.rate.tierName}` : `Custom · ${r.rate.pct}%`}</span>;
    const cur = tierOf(r);
    const next = nextRung(r);
    const floor = cur ? cur.threshold : 0;
    const span = next ? next.threshold - floor : 1;
    const pct = next ? Math.max(0, Math.min(100, Math.round(((r.rollingSpend - floor) / span) * 100))) : 100;
    return (
      <span className="re-track">
        <span className="re-tl">
          <b>{cur ? `${cur.name} · ${cur.pct}%` : "Normal pricing"}</b>
          {/* The figures behind the bar, on the phone only. A bar with no
              scale is decoration, and the card there is the full width of the
              screen; the desktop column is 160px and the drawer carries the
              same two numbers in full. */}
          <span>{next ? <>→ {next.name}<i className="re-scale"> · {naira(r.rollingSpend / 100)} of {naira(next.threshold / 100)}</i></> : cur ? "top rung" : ""}</span>
        </span>
        <span className="re-bar"><i style={{ width: `${pct}%` }} /></span>
      </span>
    );
  };
  const header = (
    <div className="re-rh">
      <span>Reseller</span>
      {ladder.live && <span>Toward next rung</span>}
      <span className="r">Orders · spend, {data?.windowDays || 90}d</span>
      <span>Status</span><span />
    </div>
  );

  return (
    <div className="re" style={vars}>
      <style>{CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Resellers</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Who buys at wholesale, what they do with it, and why they have it.</div>
          </div>
          <button type="button" className="nb pri" onClick={() => setGrantOpen(true)}>Grant access</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* The ladder itself, drawn — five rungs and a headcount on each,
          rather than something you have to already know about and go read
          off the Reseller Pricing page. The Ultra cap sits on Wholesale's
          own segment, since that is the one rung where the number here can
          differ from what a Wholesale reseller actually gets charged. */}
      {ladder.live && !loading && <>
        {/* Wide: five across, each rung a card. The count sits in the same
            flex row as the threshold rather than floating over it — absolutely
            positioned, it landed on top of the threshold at every width narrow
            enough for the two to meet, which on a phone was all of them. */}
        <div className="re-rungs">
          {rungs.map(r => (
            <div key={r.id} className="re-rung">
              <div className="re-rtop">
                <span className="re-rn">{r.id} · {naira(r.threshold / 100)}</span>
                <span className={"re-rc" + (r.n ? "" : " zero")}>{r.n}</span>
              </div>
              <div className="re-rt">{r.name}</div>
              <div className="re-rp">{r.pct}%{r.cap != null && <span className="re-rcap">Ultra caps this at {r.cap}%</span>}</div>
            </div>
          ))}
        </div>
        {/* Narrow: the same ladder as a list. Five rungs in a 132px scroller
            showed two and a half of them, and the half read as breakage rather
            than an invitation to swipe. */}
        <div className="re-lad">
          {rungs.map(r => (
            <div key={r.id} className="re-lr">
              <span className="re-lid">{r.id}</span>
              <span className="re-lnm">{r.name}<i>{naira(r.threshold / 100)} / 30 days</i></span>
              <span className="re-lp">{r.pct}%</span>
              <span className={"re-rc" + (r.n ? "" : " zero")}>{r.n}</span>
              {r.cap != null && <span className="re-lcap">Ultra caps this at {r.cap}%</span>}
            </div>
          ))}
        </div>
      </>}

      <div className="re-stats">
        {loading || !sum ? Array.from({ length: 4 }, (_, i) => <div key={i} className="re-stt">{bone(64, 20)}{bone(80, 10)}{bone(100, 10)}</div>) : <>
          <div className="re-stt"><b className="m">{sum.active}</b><span>Active</span><i>{sum.revoked ? `${sum.revoked} revoked` : "none revoked"}</i></div>
          <div className="re-stt"><b className="m">{sum.orders.toLocaleString()}</b><span>Orders</span><i>last {data.windowDays} days</i></div>
          <div className="re-stt"><b className="m">{naira(sum.revenue)}</b><span>Revenue</span><i>{sum.revenueShare}% of all sales</i></div>
          <div className="re-stt"><b className="m">{naira(sum.avgOrder)}</b><span>Average order</span><i>everyone: {naira(sum.avgOrderEveryone)}</i></div>
        </>}
      </div>

      <div className={"re-list" + (ladder.live ? " ladder" : "")}>
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
                  <b><span>{r.name || r.email}</span>{r.apiOrders > 0 && <span className="re-ch api">API · {r.apiOrders}</span>}</b>
                </span>
              </span>
              {ladder.live && <span className="re-tier">{rungTrack(r)}</span>}
              {/* A row of zeroes is the one thing the eye cannot read at a
                  glance, and it is the state every new reseller starts in. */}
              <span className="r re-act">{r.recentOrders
                ? <><b className="m">{r.recentOrders}</b> orders · <b className="m">{naira(r.recentSpend)}</b></>
                : "No orders"}</span>
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
              {/* Granting used to always land on `auto` with no rung, which
                  reads as "Normal pricing" the moment you approve somebody —
                  right by the ladder's rules, and a surprise if you meant to
                  hand them a rate. Set once, applies to whoever you grant. */}
              {ladder.live && (
                <div className="re-fld">
                  <label htmlFor="re-start">Where they start</label>
                  <select id="re-start" className="re-in" value={start} onChange={e => setStart(e.target.value)}>
                    <option value="auto">Earn it — normal pricing until they qualify</option>
                    <optgroup label="Start on a rung — the ladder takes over">
                      {ladder.tiers.map(t => <option key={`seed:${t.id}`} value={`seed:${t.id}`}>{t.name} · {t.pct}%</option>)}
                    </optgroup>
                    <optgroup label="Pin to a rung — held whatever they spend">
                      {ladder.tiers.map(t => <option key={`pin:${t.id}`} value={`pin:${t.id}`}>{t.name} · {t.pct}%</option>)}
                    </optgroup>
                  </select>
                  <p className="re-hint">{startHint}</p>
                </div>
              )}
              {data?.query && (
                <div className="re-grs">
                  {data.results.length === 0 ? <div className="re-empty" style={{ padding: 20 }}>No active account matches “{data.query}”.</div> : data.results.map(u => (
                    <div key={u.userId} className="re-gr">
                      <span className="re-un"><span className="re-av">{initials(u.name || u.email)}</span><span className="re-unt"><b><span>{u.name || "(no name)"}</span></b><i>{u.email}</i></span></span>
                      <span className="m re-cnt re-gact">{u.orders} · {naira(u.spend)}</span>
                      {u.alreadyReseller ? <span className="re-cnt">already a reseller</span> : <button type="button" className="nb sm" disabled={!!busy} onClick={() => grant(u)}>{busy === u.userId + "approve" ? "…" : "Grant"}</button>}
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
            {ladder.live ? (
              <div className="re-fld">
                <label>Rate</label>
                {/* Where they actually sit among the five rungs, since "Auto —
                    Trade, 15%" three lines down means little without the
                    structure it is a position on. Pinned and custom still
                    mark a step — a pin holds a real rung, and a custom rate is
                    drawn at whichever rung its percentage happens to land on,
                    or before Starter if it undercuts even that. */}
                <div className="re-stepper">
                  {ladder.tiers.map((t, i) => {
                    const at = mode(openR) === "custom"
                      ? [...ladder.tiers].reverse().find(x => (openR.rate?.pct ?? 0) >= x.pct)?.id
                      : tierOf(openR)?.id;
                    const atIdx = ladder.tiers.findIndex(x => x.id === at);
                    return (
                      <span key={t.id} className={"re-step" + (i < atIdx ? " done" : i === atIdx ? " now" : "")}>
                        <i className="re-sd">{i < atIdx ? "✓" : `${t.pct}%`}</i>
                        <b>{t.name}</b>
                      </span>
                    );
                  })}
                </div>
                {/* Auto, pinned or custom. The free-text box this replaced took
                    any number under 100 and had no idea what a tier was, so
                    "why is this account on 35%" had no answer but memory. */}
                <div className="re-modes">
                  {[
                    { id: "auto", title: `Auto${tierOf(openR) ? ` — ${tierOf(openR).name}, ${tierOf(openR).pct}%` : " — normal pricing"}`,
                      sub: nextRung(openR) ? `Follows 30-day spend. Next: ${naira(nextRung(openR).threshold / 100)} for ${nextRung(openR).name}, ${nextRung(openR).pct}%.` : "Follows 30-day spend, re-checked nightly." },
                    { id: "pinned", title: "Pin a tier", sub: "Holds a tier whatever they spend. For a reseller you have made a deal with." },
                    { id: "custom", title: "Custom rate", sub: "An explicit percentage. Band caps and the margin floor still apply." },
                  ].map(m => (
                    <button type="button" key={m.id} className={"re-mode" + (mode(openR) === m.id ? " on" : "")} disabled={!openR.enabled || !!busy}
                      onClick={() => { if (m.id === "auto") act(openR.userId, "mode", { mode: "auto" }, "mode"); else setModeDraft(d => ({ ...d, [openR.userId]: m.id })); }}>
                      <i className="re-rd" />
                      <span><b>{m.title}</b><i>{m.sub}</i>
                        {m.id === "pinned" && (mode(openR) === "pinned" || modeDraft[openR.userId] === "pinned") && (
                          <span className="re-sub">
                            <select className="re-in" defaultValue={openR.pinnedTier || ""} disabled={!!busy} aria-label="Tier"
                              onClick={e => e.stopPropagation()}
                              onChange={e => e.target.value && act(openR.userId, "mode", { mode: "pinned", pinnedTier: e.target.value }, "mode")}>
                              <option value="">Choose a tier…</option>
                              {ladder.tiers.map(t => <option key={t.id} value={t.id}>{t.name} · {t.pct}%</option>)}
                            </select>
                          </span>
                        )}
                        {m.id === "custom" && (mode(openR) === "custom" || modeDraft[openR.userId] === "custom") && (
                          <span className="re-sub">
                            <input className="re-in m" style={{ width: 70 }} inputMode="numeric" aria-label="Custom rate"
                              defaultValue={openR.discountPct ?? ""} placeholder="%" disabled={!!busy}
                              onClick={e => e.stopPropagation()}
                              onBlur={e => { const v = e.target.value.replace(/[^0-9]/g, ""); if (v !== "") act(openR.userId, "mode", { mode: "custom", discountPct: v }, "mode"); }} />
                            <span className="re-cnt">% below retail</span>
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="re-fld">
                <label>Personal rate</label>
                <div className="re-inl">
                  <input className="re-in m re-rate" value={rateDraft[openR.userId] ?? (openR.discountPct ?? "")} placeholder={`${data.globalDiscount}%`} disabled={!openR.enabled || !!busy} inputMode="numeric" aria-label="Discount rate"
                    onChange={e => setRateDraft(p => ({ ...p, [openR.userId]: e.target.value.replace(/[^0-9]/g, "") }))}
                    onBlur={() => { const v = rateDraft[openR.userId]; if (v === undefined || v === String(openR.discountPct ?? "")) return; act(openR.userId, "rate", { discountPct: v }, "rate"); }} />
                  <span className="re-cnt">below retail · default is {data.globalDiscount}%</span>
                </div>
              </div>
            )}
            <div className="re-fld">
              <label>Why they have it</label>
              <input className="re-in re-why" value={noteDraft[openR.userId] ?? openR.notes ?? ""} placeholder="Why they have it…" disabled={!!busy} aria-label="Reason"
                onChange={e => setNoteDraft(p => ({ ...p, [openR.userId]: e.target.value }))}
                onBlur={() => { const v = noteDraft[openR.userId]; if (v === undefined || v === (openR.notes ?? "")) return; act(openR.userId, "notes", { notes: v }, "notes"); }} />
            </div>
            {ladder.live && (
              <div className="re-facts">
                <div className="re-fact"><span>Toward {ladder.tiers[0]?.name}</span><b className="m">{naira(openR.rollingSpend / 100)} of {naira((ladder.tiers[0]?.threshold || 0) / 100)}</b></div>
                <div className="re-fact"><span>Toward a seat for life</span><b className="m">{openR.seatForLife ? "Earned" : `${naira(openR.lifetimeSpend / 100)} of ${naira(ladder.seatLifetime / 100)}`}</b></div>
                {openR.firstMonthEndsAt && new Date(openR.firstMonthEndsAt) > new Date() &&
                  <div className="re-fact"><span>First judged</span><b>{fmtDate(openR.firstMonthEndsAt)}</b></div>}
              </div>
            )}
            <div className="re-facts">
              <div className="re-fact"><span>Orders · {data?.windowDays || 90} days</span><b className="m">{openR.recentOrders} · {naira(openR.recentSpend)}</b></div>
              <div className="re-fact"><span>Through the API</span><b className="m">{openR.apiOrders || 0} of {openR.recentOrders}</b></div>
              <div className="re-fact"><span>Granted</span><b>{fmtDate(openR.approvedAt)}{openR.approvedBy ? ` by ${openR.approvedBy}` : ""}</b></div>
            </div>
            {/* Revoke is amber and Remove is red because they are not the same
                weight of decision: one is a restriction you can lift, the
                other deletes the key and the history. Two red buttons side by
                side would have said they were. */}
            <div className="re-dra">
              {openR.enabled
                ? <button type="button" className="nb warn" disabled={!!busy} onClick={() => revoke(openR)}>{busy === openR.userId + "revoke" ? "…" : "Revoke access"}</button>
                : <button type="button" className="nb ok" disabled={!!busy} onClick={() => restore(openR)}>{busy === openR.userId + "approve" ? "…" : "Restore access"}</button>}
              <button type="button" className="nb bad re-right" disabled={!!busy} onClick={() => remove(openR)}>{busy === openR.userId + "remove" ? "…" : "Remove"}</button>
            </div>
            <p className="re-cnt" style={{ whiteSpace: "normal", lineHeight: 1.5 }}>
              Revoking is reversible — they go back to retail and keep their key and history. Removing deletes the profile.
            </p>
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
.re-cnt{font-size:11.5px;color:var(--dim);white-space:nowrap}
.re-rungs{display:grid;grid-template-columns:repeat(5,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:14px}
.re-rung{padding:11px 13px;border-left:1px solid var(--line);min-width:0}.re-rung:first-child{border-left:0}
.re-rtop{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.re-rn{font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.re-rc{font-size:10px;font-weight:800;padding:1px 7px;border-radius:99px;background:var(--acbg);color:var(--ac);white-space:nowrap;flex-shrink:0;min-width:22px;text-align:center}
.re-rc.zero{background:var(--soft);color:var(--dim);border:1px solid var(--line)}
.re-rt{font-size:13.5px;font-weight:800;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.re-rp{font-size:15px;font-weight:800;margin-top:1px;color:var(--ac)}
.re-rcap{display:block;font-size:10px;font-weight:700;color:var(--dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* The same ladder as a list, for a phone. Hidden until the media query. */
.re-lad{display:none}
.re-lr{display:grid;grid-template-columns:24px 1fr auto auto;align-items:center;gap:10px;padding:9px 12px;border-top:1px solid var(--rail)}
.re-lr:first-child{border-top:0}
.re-lid{font-size:9.5px;font-weight:800;color:var(--dim);font-family:'JetBrains Mono',ui-monospace,monospace}
.re-lnm{font-size:13px;font-weight:700;min-width:0}
.re-lnm i{display:block;font-style:normal;font-size:10.5px;font-weight:600;color:var(--mut);font-family:'JetBrains Mono',ui-monospace,monospace}
.re-lp{font-size:13.5px;font-weight:800;color:var(--ac);font-variant-numeric:tabular-nums}
.re-lcap{grid-column:2/-1;font-size:10.5px;font-weight:700;color:var(--dim)}
.re-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.re-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;gap:3px;min-width:0}.re-stt:first-child{border-left:0}
.re-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.re-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}.re-stt i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.re-list{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow-x:auto}
.re-rh,.re-rr{display:grid;grid-template-columns:minmax(160px,1fr) minmax(120px,auto) 84px 18px;align-items:center;gap:10px;padding:0 14px}
/* The ladder adds a tier column. Scoped to .ladder so the pre-ladder page
   keeps the four-column grid it has always had. */
.re-list.ladder .re-rh,.re-list.ladder .re-rr{grid-template-columns:minmax(150px,1fr) minmax(160px,auto) minmax(110px,auto) 84px 18px}
.re-rh{height:34px;font-size:10.5px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut);background:var(--soft);border-bottom:1px solid var(--line);white-space:nowrap}
.re-rr{width:100%;padding-top:10px;padding-bottom:10px;border:0;border-top:1px solid var(--rail);background:transparent;color:var(--ink);font:inherit;font-size:13px;text-align:left;cursor:pointer;min-width:0}.re-rr:hover{background:var(--soft)}.re-rr.sk:hover{background:none}.re-rr.sk{cursor:default}
.re-rr.off .re-un,.re-rr.off .re-act{opacity:.5;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.re-chev{color:var(--dim);flex-shrink:0}
.re-av{width:34px;height:34px;border-radius:50%;background:var(--ac);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.re-un{display:flex;align-items:center;gap:10px;min-width:0}.re-unt{display:flex;flex-direction:column;gap:2px;min-width:0}
.re-unt b{display:flex;align-items:center;gap:6px;font-weight:600;min-width:0}.re-unt b>span:first-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.re-unt i{font-style:normal;font-size:11.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.re-ch{font-size:9.5px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:2px 6px;border-radius:6px;flex-shrink:0;white-space:nowrap}.re-ch.full{background:var(--acbg);color:var(--ac)}.re-ch.cur{background:var(--soft);color:var(--mut);border:1px solid var(--line)}.re-ch.api{background:var(--bluebg);color:var(--blue)}
.re-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--mut);white-space:nowrap}.re-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
.re-tier{display:flex;gap:5px;flex-wrap:wrap;min-width:0}
.re-track{display:flex;flex-direction:column;gap:4px;min-width:0;width:100%}
.re-tl{display:flex;justify-content:space-between;gap:6px;font-size:10.5px;color:var(--mut);white-space:nowrap;overflow:hidden}
.re-tl b{color:var(--ink);font-weight:700;font-size:11.5px;overflow:hidden;text-overflow:ellipsis}
.re-bar{height:5px;border-radius:3px;background:var(--rail);overflow:hidden}
.re-bar i{display:block;height:100%;border-radius:3px;background:var(--ac)}
.re-ch.pinned{background:var(--bluebg);color:var(--blue)}
.re-ch.custom{background:rgba(133,79,11,.1);color:#854F0B}
.re-stepper{display:flex;align-items:flex-start;margin-bottom:10px}
.re-step{flex:1;text-align:center;position:relative;min-width:0}
.re-step::before{content:"";position:absolute;top:12px;left:-50%;width:100%;height:2px;background:var(--rail);z-index:0}
.re-step:first-child::before{display:none}
.re-step.done::before,.re-step.now::before{background:var(--ac)}
.re-sd{position:relative;z-index:1;display:block;width:25px;height:25px;line-height:21px;border-radius:50%;margin:0 auto 4px;font-size:9px;font-weight:800;border:2px solid var(--line);background:var(--card);color:var(--mut)}
.re-step.done .re-sd{border-color:var(--ac);background:var(--ac);color:#fff}
.re-step.now .re-sd{border-color:var(--ac);color:var(--ac);box-shadow:0 0 0 3px var(--acbg)}
.re-step b{display:block;font-size:9px;font-weight:700;letter-spacing:.2px;text-transform:uppercase;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.re-step.now b,.re-step.done b{color:var(--ink)}
.re-modes{display:flex;flex-direction:column;gap:6px}
.re-mode{display:grid;grid-template-columns:14px 1fr;gap:10px;align-items:start;width:100%;text-align:left;
  padding:10px 12px;border-radius:10px;border:1.5px solid var(--rail);background:var(--card);color:var(--ink);font:inherit;cursor:pointer}
.re-mode.on{border-color:var(--ac);background:var(--acbg,rgba(196,125,142,.08))}
.re-mode:disabled{opacity:.55;cursor:default}
.re-rd{width:13px;height:13px;border-radius:50%;border:2px solid var(--muted);margin-top:3px}
.re-mode.on .re-rd{border-color:var(--ac);background:var(--ac);box-shadow:inset 0 0 0 2.5px var(--card)}
.re-mode b{display:block;font-size:13px;font-weight:600}
.re-mode i{display:block;font-size:11.5px;color:var(--muted);font-style:normal;margin-top:1px}
.re-sub{display:flex;gap:8px;align-items:center;margin-top:8px}.re-dot.ok{background:var(--ok)}.re-dot.bad{background:var(--bad)}
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
.re-facts{border-top:1px solid var(--line)}
.re-fact{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid var(--rail);font-size:13px}
.re-fact span{color:var(--mut)}.re-fact b{font-weight:700;text-align:right}
.re-dra{margin-top:auto;display:flex;gap:8px;padding-top:6px;flex-wrap:wrap}
.re-right{margin-left:auto}
@media (max-width:900px){
  .re-rungs{display:none}
  .re-lad{display:block;background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:14px;overflow:hidden}
  .re-scale{display:inline;font-style:normal}
  .re-stats{grid-template-columns:1fr 1fr}.re-stt:nth-child(3){border-left:0}.re-stt:nth-child(n+3){border-top:1px solid var(--line)}.re-stt b{font-size:17px}
  .re-rh{display:none}
  .re-list{background:none;border:0;border-radius:0;display:flex;flex-direction:column;gap:10px}
  .re-rr{display:grid;grid-template-columns:1fr auto 18px;grid-template-areas:"un st chev" "act act act";gap:6px 10px;padding:12px;background:var(--card);border:1px solid var(--line);border-radius:14px;min-width:0}
  .re-list.ladder .re-rr{grid-template-columns:1fr auto 18px;grid-template-areas:"un st chev" "tier tier tier" "act act act"}
  .re-tier{grid-area:tier}.re-rr:hover{background:var(--card)}
  .re-un{grid-area:un}.re-st{grid-area:st;justify-self:end;align-self:center}.re-chev{grid-area:chev;align-self:center}
  /* The .re .r rule is (0,2,0) and this element carries .r too, so a bare
     .re-act at (0,1,0) never won: the line has been sitting right-aligned
     with a dead 44px indent under it. Same shape as the [dir] trap in
     CLAUDE.md, in our own stylesheet this time. */
  .re-list .re-rr .re-act{grid-area:act;text-align:left;font-size:12px;padding-left:0}
  .re-act::after{content:" · last 90 days";color:var(--dim)}
  .re-rr.sk{grid-template-areas:"un st chev" "act act act"}
  .re-empty{background:var(--card);border:1px solid var(--line);border-radius:14px}
  .re-ov{padding:0;align-items:flex-end}.re-md{border-radius:20px 20px 0 0;max-height:92%}
  .re-ov.dr{align-items:flex-end;justify-content:center}
  .re-dr{width:100%;max-height:92%;border-left:0;border-top:1px solid var(--line);border-radius:20px 20px 0 0;box-shadow:0 -18px 50px rgba(0,0,0,.3)}
  .re-dra{margin-top:4px}
  .re-gr{flex-wrap:wrap}.re-gr .re-un{flex-basis:100%}
}
`;
