'use client';
import { TRAFFIC_COUNTRIES, TRAFFIC_CONTINENTS } from "../lib/traffic-targets";
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useToast } from "./toast";
import { fN } from "../lib/format";
import { getLinkPlaceholder } from "../lib/order-form-core";
import { distributeByCurve } from "../lib/drip-feed";
import { cleanLink } from "@/lib/clean-link";
import { copyText } from '@/lib/clipboard';
import { PlatformIcon } from "./platform-icon";

const TIER_CLR_ORDER = { Budget: "#f59e0b", Standard: "#3b82f6", Premium: "#a855f7" };
const DRIP_DAILY_CAP = { followers: 5000, likes: 10000, views: 75000, plays: 75000, comments: 1000, reviews: 100, engagement: 15000 };
const DRIP_DEFAULT_CAP = 15000;
const MULTIDAY_THRESHOLD_DEFAULT = 3000;
const DRIP_MIN_FLOOR = { followers: 3, views: 1, plays: 1, likes: 2, comments: 3, reviews: 3, engagement: 2 };
function dripDailyCap(type) { return DRIP_DAILY_CAP[(type || "").toLowerCase()] || DRIP_DEFAULT_CAP; }
function dripMaxDays(qty) { return qty <= 5000 ? 5 : qty <= 10000 ? 7 : qty <= 25000 ? 12 : qty <= 50000 ? 18 : qty <= 100000 ? 25 : 30; }
function dripMinDays(qty, type) { const floor = DRIP_MIN_FLOOR[(type || "").toLowerCase()] || 3; return Math.max(floor, Math.ceil(qty / dripDailyCap(type))); }
function dripZone(perDay, type) { const cap = dripDailyCap(type); return perDay <= cap * 0.5 ? "safe" : perDay <= cap ? "moderate" : "hot"; }


export function AdminCreateOrderPage({ dark, t }) {
  const toast = useToast();
  const [mode, setMode] = useState("single");
  const [user, setUser] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [userDDOpen, setUserDDOpen] = useState(false);
  const [searching, setSearching] = useState(false);

  const [catalog, setCatalog] = useState([]);
  const [platform, setPlatform] = useState("");
  const [groupId, setGroupId] = useState("");
  const [tierId, setTierId] = useState("");

  const [link, setLink] = useState("");
  const [qty, setQty] = useState("");
  const [dripOn, setDripOn] = useState(false);
  const [dripDays, setDripDays] = useState(3);
  const [dripStart, setDripStart] = useState("now");
  const [dripStartDate, setDripStartDate] = useState("");
  const [dripStartTime, setDripStartTime] = useState("09:00");
  const [dripWindowOn, setDripWindowOn] = useState(false);
  const [dripWindowStart, setDripWindowStart] = useState(9);
  const [dripWindowEnd, setDripWindowEnd] = useState(21);
  const [dripCurve, setDripCurve] = useState("even");
  const [dripPause, setDripPause] = useState(false);
  const [dripPauseDay, setDripPauseDay] = useState(1);
  const [comments, setComments] = useState("");
  // Website-traffic targeting, mirroring the user order form field-for-field.
  const [traffic, setTraffic] = useState({ country: "", device: "all", trafficType: "keyword", keyword: "", referrer: "" });
  const [charge, setCharge] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [batchItems, setBatchItems] = useState([]);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpChannel, setTopUpChannel] = useState(null);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpLink, setTopUpLink] = useState(null);
  const [topUpBank, setTopUpBank] = useState(null);
  const [topUpSender, setTopUpSender] = useState("");
  const [mobileReview, setMobileReview] = useState(false);
  const [sidebarEl, setSidebarEl] = useState(null);
  useEffect(() => { setSidebarEl(document.getElementById("create-order-sidebar")); }, []);
  const [topUpDone, setTopUpDone] = useState(null);

  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    fetch("/api/admin/service-groups").then(r => r.json()).then(d => setCatalog(d.groups || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setUserDDOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const searchUsers = useCallback((q) => {
    if (!q.trim()) { setUserResults([]); setUserDDOpen(false); return; }
    setSearching(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/admin/users?search=${encodeURIComponent(q)}&perPage=6`).then(r => r.json()).then(d => {
        setUserResults(d.users || []);
        setUserDDOpen(true);
        setSearching(false);
      }).catch(() => setSearching(false));
    }, 250);
  }, []);

  const platforms = [...new Set(catalog.filter(g => g.enabled).map(g => g.platform))].sort((a, b) => {
    const P = ["Instagram", "TikTok", "YouTube", "Twitter", "Facebook", "Telegram", "Spotify", "SoundCloud"];
    const ai = P.indexOf(a), bi = P.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
  const groups = catalog.filter(g => g.enabled && g.platform === platform);
  const selectedGroup = groups.find(g => g.id === groupId);
  const tiers = (selectedGroup?.tiers || []).filter(ti => ti.enabled);
  const selectedTier = tiers.find(ti => ti.id === tierId);

  const tierService = selectedTier?.service;
  const minQty = tierService?.min || 0;
  const maxQty = tierService?.max || 0;
  const sellPer1k = selectedTier ? Number(selectedTier.sellPer1k) / 100 : 0;
  const costPer1kNgn = tierService ? Number(tierService.costPer1k) * 1600 / 100 : 0;

  const isValidLink = (v) => {
    const s = v.trim();
    if (s.length < 3 || s.length > 500) return false;
    if (s.includes("://")) return /^https?:\/\/[^\s/]+\.[^\s/]+/.test(s);
    if (s.includes(".")) return /^[^\s/]+\.[^\s/]+/.test(s);
    return /^@?[a-zA-Z0-9._]{1,100}$/.test(s);
  };
  const fullLink = (v) => { const s = v.trim(); return s && !s.includes("://") ? `https://${s}` : s; };
  const linkValid = link.trim() ? isValidLink(link) : null;

  const qtyNum = Number(qty) || 0;
  const validQty = qtyNum >= minQty && qtyNum <= maxQty;
  const svcType = selectedGroup?.type || "";
  const isDripEligible = !!selectedGroup?.tags?.includes("drip");
  const dripThreshold = selectedGroup?.dripThreshold || MULTIDAY_THRESHOLD_DEFAULT;
  const showDripPanel = isDripEligible && qtyNum >= dripThreshold;
  const daysMax = dripMaxDays(qtyNum);
  const daysMin = Math.min(dripMinDays(qtyNum, svcType), daysMax);
  const clampedDays = Math.max(daysMin, Math.min(dripDays, daysMax));
  const perDay = clampedDays > 0 ? Math.ceil(qtyNum / clampedDays) : qtyNum;
  const zone = dripZone(perDay, svcType);
  const effectiveDripDays = dripOn && showDripPanel ? clampedDays : 0;
  useEffect(() => {
    if (effectiveDripDays >= 2 && dripPauseDay >= effectiveDripDays) setDripPauseDay(effectiveDripDays - 1);
  }, [effectiveDripDays, dripPauseDay]);
  const nLinks = link ? 1 : 0;
  const perOrder = sellPer1k * qtyNum / 1000;
  const totalCharge = perOrder * nLinks;
  const totalCost = costPer1kNgn * qtyNum / 1000 * nLinks;

  const showTraffic = !!selectedTier?.trafficTargeting;
  // Same rule as the customer form: the provider's API type says what the order needs typed in,
  // and reviews need their text. The customComments flag is a manual override on top.
  const apiType = (selectedTier?.apiType || tierService?.apiType || "").toLowerCase();
  const groupName = (selectedGroup?.name || "").toLowerCase();
  const typedInput = selectedTier?.customComments || apiType.includes("custom comment") || apiType.includes("comment replies") || (groupName.includes("review") && !groupName.includes("review like")) ? "comments"
    : apiType.includes("mention") ? "mentions" : apiType === "poll" ? "poll" : apiType === "seo" ? "keywords" : null;
  const typedOk = !typedInput || (typedInput === "comments" ? /[\p{L}\p{N}]/u.test(comments) : comments.trim().length > 0);
  const typedLabel = { comments: ["Comments", "one per line", "One comment per line"], mentions: ["Usernames to mention", "one per line, without @", "username1\nusername2"], poll: ["Poll answer", "the option number", "1"], keywords: ["Keywords", "one per line", "best smm panel nigeria"] }[typedInput] || null;
  const trafficValid = !showTraffic || (
    traffic.country.trim().length >= 2 && traffic.country.trim().length <= 3 && traffic.device &&
    (traffic.trafficType === "blank" ||
      (traffic.trafficType === "keyword" && traffic.keyword.trim()) ||
      (traffic.trafficType === "referrer" && traffic.referrer.trim()))
  );
  const canAddToBatch = mode === "bulk" && selectedTier && validQty && link.trim() && linkValid;
  const batchTotalCharge = batchItems.reduce((s, it) => s + it.sellPer1k * it.quantity / 1000, 0);
  const batchTotalCost = batchItems.reduce((s, it) => s + it.costNgn * it.quantity / 1000, 0);
  const batchTotalOrders = batchItems.length;
  const activeCharge = mode === "bulk" ? batchTotalCharge : totalCharge;
  const insufficientBal = charge && user && activeCharge > 0 && activeCharge > user.balance;

  const hasDripSchedule = mode !== "bulk" && effectiveDripDays >= 2;
  const scheduledDateMissing = hasDripSchedule && dripStart === "scheduled" && !dripStartDate;
  const scheduledDatePast = hasDripSchedule && dripStart === "scheduled" && dripStartDate &&
    new Date(`${dripStartDate}T${dripStartTime || "09:00"}`) < new Date();
  const ready = user && !submitting && !scheduledDateMissing && !scheduledDatePast && (
    mode === "single" ? (selectedTier && validQty && !!link && trafficValid) :
    batchItems.length > 0
  );

  const initials = (name) => (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const addToBatch = () => {
    if (!canAddToBatch) return;
    setBatchItems(prev => [...prev, {
      platform, groupId, groupName: selectedGroup?.name, tierId: selectedTier.id,
      tier: selectedTier.tier, sellPer1k, costNgn: costPer1kNgn, link: fullLink(link), quantity: qtyNum,
    }]);
    setLink(""); setQty("");
  };
  const removeBatchItem = (idx) => setBatchItems(prev => prev.filter((_, i) => i !== idx));
  const editBatchItem = (idx) => {
    const item = batchItems[idx];
    setPlatform(item.platform); setGroupId(item.groupId); setTierId(item.tierId);
    setLink(item.link.replace(/^https?:\/\//i, "")); setQty(String(item.quantity));
    removeBatchItem(idx);
  };

  const handleSubmit = async () => {
    if (!ready) return;
    setSubmitting(true);
    try {
      const body = mode === "bulk" ? {
        mode, userId: user.id, charge,
        items: batchItems.map(it => ({ tierId: it.tierId, quantity: it.quantity, links: [it.link] })),
      } : {
        mode: effectiveDripDays >= 2 ? "drip" : "single", userId: user.id, tierId: selectedTier.id, quantity: qtyNum, charge, link: fullLink(link),
        ...(comments.trim() ? { comments: comments.trim() } : {}),
        ...(showTraffic ? { trafficConfig: {
          country: traffic.country.trim().toUpperCase(), device: traffic.device, trafficType: traffic.trafficType,
          ...(traffic.trafficType === "keyword" ? { keyword: traffic.keyword.trim() } : {}),
          ...(traffic.trafficType === "referrer" ? { referrer: traffic.referrer.trim() } : {}),
        } } : {}),
        ...(effectiveDripDays >= 2 ? {
          dripDays: effectiveDripDays,
          ...(dripCurve !== "even" || dripPause || dripStart === "scheduled" || dripWindowOn ? {
            dripConfig: {
              ...(dripCurve !== "even" ? { curve: dripCurve } : {}),
              ...(dripStart === "scheduled" && dripStartDate ? { startAt: new Date(`${dripStartDate}T${dripStartTime || "09:00"}`).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } : {}),
              ...(dripWindowOn ? { windowStart: dripWindowStart, windowEnd: dripWindowEnd } : {}),
              ...(dripPause ? { pauseDay: dripPauseDay } : {}),
            },
          } : {}),
        } : {}),
      };
      const r = await fetch("/api/admin/orders/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      const label = mode === "bulk" ? `${d.count || batchTotalOrders} orders created` : effectiveDripDays >= 2 ? `Drip order created (${effectiveDripDays} days)` : "Order created";
      const ids = d.orderIds || [];
      toast.success(label, ids.slice(0, 3).join(" · ") + (ids.length > 3 ? ` · +${ids.length - 3} more` : ""));
      setLink(""); setQty(""); setComments(""); setDripOn(false); setDripDays(3); setDripStart("now"); setDripStartDate(""); setDripWindowOn(false); setDripCurve("even"); setDripPause(false); setDripPauseDay(1); setBatchItems([]);
    } catch (err) { toast.error("Failed", err.message); }
    setSubmitting(false);
  };

  const shortfall = insufficientBal ? Math.ceil(activeCharge - user.balance) : 0;

  const resetTopUp = () => { setTopUpOpen(false); setTopUpChannel(null); setTopUpAmount(""); setTopUpLink(null); setTopUpBank(null); setTopUpSender(""); setTopUpDone(null); };

  const handleSelectManual = async () => {
    setTopUpChannel("manual");
    setTopUpLoading(true);
    try {
      const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "manual_topup", userId: user.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setTopUpBank(d);
    } catch (err) { toast.error("Error", err.message); setTopUpChannel(null); }
    setTopUpLoading(false);
  };

  const handleTopUp = async () => {
    if (!user || !topUpAmount) return;
    const amt = Number(topUpAmount);
    if (!amt || amt < 1) return;
    setTopUpLoading(true);
    try {
      if (topUpChannel === "manual") {
        if (!topUpSender.trim() || topUpSender.trim().length < 3) { toast.error("Sender name", "Enter the name on the bank account (min 3 chars)"); setTopUpLoading(false); return; }
        const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "manual_topup", userId: user.id, amount: amt, confirm: true, senderName: topUpSender.trim() }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed");
        if (d.credited) {
          setUser(prev => ({ ...prev, balance: prev.balance + amt }));
          toast.success("Credited", `${fN(amt)} added to ${user.name}'s balance`);
          resetTopUp();
        } else {
          setTopUpDone("pending");
          toast.success("Submitted", "Deposit sent for approval");
        }
      } else {
        if (amt < 1000) { toast.error("Minimum", "Flutterwave minimum is ₦1,000"); setTopUpLoading(false); return; }
        const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate_payment_link", userId: user.id, amount: amt }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed");
        setTopUpLink(d.paymentUrl);
        toast.success("Link generated", "Copy and send to the user");
      }
    } catch (err) { toast.error("Top up failed", err.message); }
    setTopUpLoading(false);
  };

  const vars = {
    "--card": t.cardBg, "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93",
    "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--acbg": dark ? "rgba(196,125,142,.16)" : "rgba(196,125,142,.09)", "--acln": dark ? "rgba(196,125,142,.7)" : "rgba(196,125,142,.55)",
    "--ok": dark ? "#6ee7b7" : "#0a7d54", "--okbg": dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.09)", "--warn": dark ? "#fcd34d" : "#b45309", "--bad": dark ? "#fca5a5" : "#c62828",
    "--bud": dark ? "#e0a458" : "#854F0B", "--budbg": dark ? "#2d2210" : "#fef7ed", "--std": dark ? "#7aa2f7" : "#185FA5", "--stdbg": dark ? "#0f1e30" : "#eef4fb", "--prm": dark ? "#a78bfa" : "#534AB7", "--prmbg": dark ? "#221535" : "#f5eef5",
  };
  const TIER_CLS = { Budget: "bud", Standard: "std", Premium: "prm" };
  // Profit on cost, the figure the tier chip and the summary both show: (sell − cost) ÷ cost.
  const gm = (sell, cost) => cost > 0 ? Math.round((sell - cost) / cost * 100) : 0;
  const first = user?.name?.split(" ")[0] || "";
  const hourLabel = (h) => { const ap = h >= 12 ? "PM" : "AM"; return `${h === 0 ? 12 : h > 12 ? h - 12 : h}${ap}`; };
  const dayAmounts = hasDripSchedule ? distributeByCurve(qtyNum, effectiveDripDays, dripCurve, dripPause ? dripPauseDay : 0, selectedTier?.service?.min || 50) : [];
  const maxDay = Math.max(1, ...dayAmounts);
  const curveLabel = dripCurve === "even" ? "even" : dripCurve === "frontload" ? "front-load" : "ramp-up";
  const activeCost = mode === "bulk" ? batchTotalCost : totalCost;
  const gmVal = gm(activeCharge, activeCost);
  const hasSummary = mode === "bulk" ? batchItems.length > 0 : !!(selectedTier && nLinks && qtyNum);
  const openTopUp = () => {
    setTopUpOpen(true); setTopUpAmount(insufficientBal ? String(shortfall) : ""); setTopUpChannel(null); setTopUpLink(null); setTopUpBank(null); setTopUpSender(""); setTopUpDone(null);
    setMobileReview(false);
  };
  const tog = (on, onClick) => (
    <button type="button" className={"co-tog" + (on ? "" : " o")} onClick={onClick} aria-pressed={on}><i /></button>
  );
  const segs = (value, options, onChange, cls) => (
    <div className={"co-segs" + (cls ? ` ${cls}` : "")}>
      {options.map(([v, l]) => <button key={v} type="button" className={"co-seg" + (value === v ? " on" : "")} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
  const chevron = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>;

  const topUpPanel = topUpOpen && user && (
    <div className="co-tu">
      <div className="co-between"><span className="co-tu-h">Top up · {first}</span><button type="button" className="co-link" onClick={resetTopUp}>Close</button></div>
      {!topUpChannel ? (
        <div className="co-row">
          <button type="button" className="co-b" onClick={() => setTopUpChannel("flutterwave")}>Payment link</button>
          <button type="button" className="co-b" onClick={handleSelectManual}>Bank transfer</button>
        </div>
      ) : topUpDone === "pending" ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--warn)" }}>Submitted for approval</div>
          <div className="co-hint">A superadmin will review and approve this deposit.</div>
        </div>
      ) : topUpLink ? (
        <>
          <div className="co-hint">Payment link ready. Copy it and send it to {first}.</div>
          <div className="co-row">
            <input readOnly value={topUpLink} className="co-in m" style={{ fontSize: 12 }} />
            <button type="button" className="co-b" style={{ flex: "0 0 auto" }} onClick={() => { copyText(topUpLink); toast.success("Copied", "Payment link copied"); }}>Copy</button>
          </div>
        </>
      ) : topUpChannel === "manual" && !topUpBank ? (
        <div className="co-hint">
          {topUpLoading ? "Loading bank details..." : "Bank transfer is not available right now."}
          {!topUpLoading && <> <button type="button" className="co-link" onClick={() => setTopUpChannel(null)}>Back</button></>}
        </div>
      ) : topUpChannel === "manual" ? (
        <>
          <div className="co-tu-bank">
            <div className="co-between">
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--mut)" }}>{topUpBank.bankName}</span>
              <button type="button" className="co-link" onClick={() => { copyText(topUpBank.accountNumber); toast.success("Copied", "Account number copied"); }}>Copy</button>
            </div>
            <div className="m" style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1 }}>{topUpBank.accountNumber}</div>
            <div style={{ fontSize: 11.5, color: "var(--mut)" }}>{topUpBank.accountName}</div>
          </div>
          <div className="co-amt"><b>₦</b><input type="number" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} placeholder="Amount" className="co-in m" /></div>
          <input value={topUpSender} onChange={e => setTopUpSender(e.target.value)} placeholder="Sender or account name" className="co-in" />
          {!topUpBank.canCreditDirectly && <div className="co-note">This deposit will need superadmin approval</div>}
          <div className="co-row">
            <button type="button" className="co-b ghost" onClick={() => { setTopUpChannel(null); setTopUpBank(null); setTopUpSender(""); }}>Back</button>
            <button type="button" className="co-pri" disabled={topUpLoading || !Number(topUpAmount) || topUpSender.trim().length < 3} onClick={handleTopUp}>
              {topUpLoading ? "Processing..." : topUpBank.canCreditDirectly ? "Credit now" : "Submit for approval"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="co-amt"><b>₦</b><input type="number" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} placeholder="Amount" className="co-in m" /></div>
          {Number(topUpAmount) > 0 && Number(topUpAmount) < 1000 && <div className="co-note bad">Flutterwave minimum is ₦1,000</div>}
          <div className="co-row">
            <button type="button" className="co-b ghost" onClick={() => { setTopUpChannel(null); setTopUpLink(null); }}>Back</button>
            <button type="button" className="co-pri" disabled={topUpLoading || !Number(topUpAmount) || Number(topUpAmount) < 1000} onClick={handleTopUp}>
              {topUpLoading ? "Processing..." : "Generate link"}
            </button>
          </div>
        </>
      )}
    </div>
  );

  const submitLabel = submitting ? "Creating..." : mode === "bulk" ? `Create ${batchTotalOrders} order${batchTotalOrders !== 1 ? "s" : ""}` : hasDripSchedule ? `Create drip order · ${effectiveDripDays}d` : "Create order";
  const submitBlock = insufficientBal ? (
    <>
      <button type="button" className="co-pri wide" disabled>Insufficient balance · {fN(user.balance)}</button>
      <button type="button" className="co-b full" style={{ marginTop: 8 }} onClick={openTopUp}>Top up {first}</button>
    </>
  ) : (
    <button type="button" className="co-pri wide" disabled={!ready || !typedOk} onClick={handleSubmit}>{submitLabel}</button>
  );

  const summary = (
    <aside className="co-sum">
      <header><h3>Summary</h3>{mode === "bulk" && batchItems.length > 0 && <span className="co-cnt">{batchItems.length} item{batchItems.length !== 1 ? "s" : ""}</span>}</header>
      {!hasSummary ? (
        <div className="co-empty">Pick a service, {mode === "bulk" ? "links" : "a link"} and a quantity.<br />The breakdown builds here.</div>
      ) : mode === "bulk" ? (
        <>
          <div className="co-sr"><span>Customer</span><b>{user ? user.name : "—"}</b></div>
          {batchItems.map((item, i) => (
            <div key={i} className="co-sr"><span style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis" }}>{item.groupName} · {item.tier}</span><b className="m">{item.quantity.toLocaleString()}</b></div>
          ))}
          <div className="co-sr"><span>Orders</span><b className="m">{batchTotalOrders}</b></div>
          <div className="co-sr"><span>Provider cost</span><b className="m">{fN(batchTotalCost)}</b></div>
          <div className="co-sr"><span>Profit</span><b className={"m " + (gmVal < 33 ? "low" : "good")}>{gmVal}%</b></div>
        </>
      ) : (
        <>
          <div className="co-sr"><span>Customer</span><b>{user ? user.name : "—"}</b></div>
          <div className="co-sr"><span>Service</span><b>{selectedGroup?.name} · {selectedTier?.tier}</b></div>
          <div className="co-sr"><span>Price per 1k</span><b className="m">{fN(sellPer1k)}</b></div>
          <div className="co-sr"><span>Quantity</span><b className="m">{qtyNum.toLocaleString()}</b></div>
          <div className="co-sr"><span>Provider cost</span><b className="m">{fN(totalCost)}</b></div>
          <div className="co-sr"><span>Profit</span><b className={"m " + (gmVal < 33 ? "low" : "good")}>{gmVal}%</b></div>
          {hasDripSchedule && (
            <div className="co-sdrip">
              <span className="co-lbl">Drip · {effectiveDripDays} days · {curveLabel}</span>
              <div className="co-bars">{dayAmounts.map((q, i) => <i key={i} className={q ? "" : "off"} style={{ height: `${Math.max(6, q / maxDay * 100)}%` }} />)}</div>
              <span className="co-hint">
                {dayAmounts.slice(0, 7).map(q => q ? q.toLocaleString() : "pause").join(" · ")}{dayAmounts.length > 7 ? " · …" : ""} — {dripStart === "now" ? "starts now" : dripStartDate ? `starts ${dripStartDate} ${dripStartTime}` : "pick a start date"}
              </span>
            </div>
          )}
        </>
      )}
      {hasSummary && (
        <div className="co-stot">
          <span>{charge ? "Total charge" : "Service value"}</span>
          <b className="m">{fN(activeCharge)}</b>
          {!charge ? <i>Free order, nothing is deducted</i>
            : !user ? <i>Pick a customer</i>
            : insufficientBal ? <i className="low">Short by {fN(shortfall)}</i>
            : <i>Balance after {fN(user.balance - activeCharge)}</i>}
        </div>
      )}
      {submitBlock}
    </aside>
  );

  const canDrip = showDripPanel && mode !== "bulk" && qtyNum > 0;

  return (
    <div className="co" style={vars}>
      <style>{CO_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Create order</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Place an order on a customer's account, at retail or free.</div>
          </div>
          {segs(mode, [["single", "Single"], ["bulk", "Bulk"]], m => { setMode(m); setBatchItems([]); }, "co-modes")}
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      <div className={"co-form" + (mobileReview ? " co-hide" : "")}>
        {/* customer */}
        <section className="co-card">
          <header><h3>Customer</h3>{!user && <span className="co-cnt">Search by name or email</span>}</header>
          <div className="co-cb">
            {!user ? (
              <div ref={searchRef} style={{ position: "relative" }}>
                <input value={userSearch} onChange={e => { setUserSearch(e.target.value); searchUsers(e.target.value); }} placeholder="Name or email" className="co-in" autoComplete="off" />
                {userDDOpen && (
                  <div className="co-dd-list">
                    {userResults.length === 0 ? (
                      <div className="co-empty" style={{ padding: 14 }}>{searching ? "Searching..." : "No accounts match"}</div>
                    ) : userResults.map(u => (
                      <button key={u.id} type="button" className="co-dd-row" onClick={() => { setUser(u); setUserSearch(""); setUserDDOpen(false); resetTopUp(); }}>
                        <span className="co-av" style={{ width: 30, height: 30, fontSize: 11 }}>{initials(u.name)}</span>
                        <span className="co-cn"><b style={{ fontSize: 13.5 }}>{u.name}</b><i>{u.email}</i></span>
                        <span className="co-bal m">{fN(u.balance)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="co-cust">
                <span className="co-av">{initials(user.name)}</span>
                <span className="co-cn"><b>{user.name}</b><i>{user.email}</i></span>
                <span className="co-bal m">{fN(user.balance)}</span>
                <button type="button" className="co-b sm" onClick={topUpOpen ? resetTopUp : openTopUp}>Top up</button>
                <button type="button" className="co-b sm ghost" onClick={() => { setUser(null); resetTopUp(); }}>Change</button>
              </div>
            )}
            {topUpPanel}
          </div>
        </section>

        {/* service */}
        <section className="co-card">
          <header><h3>Service</h3>{selectedTier?.service && <span className="co-cnt">min {minQty.toLocaleString()} · max {maxQty.toLocaleString()}</span>}</header>
          <div className="co-cb">
            <div className="co-row2">
              <div className="co-fld">
                <label>Platform</label>
                <div className={"co-selw" + (platform ? " ic" : "")}>
                  {platform && <span className="co-pi"><PlatformIcon platform={platform} dark={dark} size={15} /></span>}
                  <select value={platform} onChange={e => { setPlatform(e.target.value); setGroupId(""); setTierId(""); }} className="co-sel">
                    <option value="">Pick a platform</option>
                    {platforms.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  {chevron}
                </div>
              </div>
              <div className="co-fld">
                <label>Service</label>
                <div className="co-selw">
                  <select value={groupId} onChange={e => { setGroupId(e.target.value); setTierId(""); }} disabled={!platform} className="co-sel">
                    <option value="">{platform ? "Pick a service" : "Platform first"}</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  {chevron}
                </div>
              </div>
            </div>
            <div className="co-fld">
              <label>Tier <em>price per 1k · profit</em></label>
              {selectedGroup ? (
                tiers.length === 0 ? <div className="co-hint">No tier is switched on for this service.</div> : (
                  <div className="co-tiers">
                    {tiers.map(ti => {
                      const sell = Number(ti.sellPer1k) / 100;
                      const cost = ti.service ? Number(ti.service.costPer1k) * 1600 / 100 : 0;
                      const g = gm(sell, cost);
                      return (
                        <button key={ti.id} type="button" className={`co-tc ${TIER_CLS[ti.tier] || "std"}${tierId === ti.id ? " on" : ""}`} onClick={() => setTierId(ti.id)}>
                          <b>{ti.tier}</b><span className="m">{fN(sell)}</span><em className={"m" + (g < 33 ? " low" : "")}>{g}%</em>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : <div className="co-hint">Pick a service to see its tiers.</div>}
            </div>
          </div>
        </section>

        {/* order */}
        <section className="co-card">
          <header><h3>Order</h3>{mode === "bulk" && <span className="co-cnt">Add each link to the batch</span>}</header>
          <div className="co-cb">
            <div className="co-fld">
              <label>Link</label>
              <div className={"co-pre" + (linkValid === false ? " bad" : "")}>
                <span>https://</span>
                <input value={link} onChange={e => setLink(e.target.value.replace(/^https?:\/\//i, "").trim())} onBlur={() => { if (link) setLink(cleanLink(fullLink(link)).replace(/^https?:\/\//i, "")); }} placeholder={platform ? getLinkPlaceholder(platform.toLowerCase(), selectedGroup?.name || "") : "paste link here"} />
              </div>
            </div>
            <div className="co-row2">
              <div className="co-fld">
                <label>Quantity {selectedTier?.service && <em>min {minQty.toLocaleString()} · max {maxQty.toLocaleString()}</em>}</label>
                <input value={qty} onChange={e => setQty(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="1000" className={"co-in m" + (qtyNum && selectedTier && !validQty ? " bad" : "")} />
              </div>
              <div className="co-fld">
                <label>Charge</label>
                <div className="co-chg">
                  {tog(charge, () => { setCharge(!charge); resetTopUp(); })}
                  <span>
                    <b>{charge ? "Charge the customer" : "Free order"}</b>
                    <i>{charge ? (activeCharge > 0 ? `${fN(activeCharge)} comes off their balance` : "Comes off their balance") : "Nothing is deducted"}</i>
                  </span>
                </div>
              </div>
            </div>
            {typedLabel && (
              <div className="co-fld">
                <label>{typedLabel[0]} <em>{typedLabel[1]}</em></label>
                <textarea value={comments} onChange={e => setComments(e.target.value)} placeholder={typedLabel[2]} rows={typedInput === "poll" ? 1 : 4} className="co-ta" />
              </div>
            )}
            {showTraffic && (
              <div className={"co-traffic" + (trafficValid ? "" : " need")}>
                <div className="co-lbl">Traffic targeting</div>
                <div className="co-row2">
                  <div className="co-fld">
                    <label>Target</label>
                    <div className="co-selw">
                      <select value={traffic.country} onChange={e => setTraffic(p => ({ ...p, country: e.target.value }))} className="co-sel">
                        <option value="">Choose…</option>
                        <option value="WW">Worldwide</option>
                        <optgroup label="Continent">
                          {Object.entries(TRAFFIC_CONTINENTS).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                        </optgroup>
                        <optgroup label="Country">
                          {Object.entries(TRAFFIC_COUNTRIES).filter(([code]) => code !== "WW").map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                        </optgroup>
                      </select>
                      {chevron}
                    </div>
                  </div>
                  <div className="co-fld">
                    <label>Device</label>
                    <div className="co-selw">
                      <select value={traffic.device} onChange={e => setTraffic(p => ({ ...p, device: e.target.value }))} className="co-sel">
                        <option value="all">All devices</option>
                        <option value="desktop">Desktop</option>
                        <option value="mobile">Mobile</option>
                        <option value="android">Android</option>
                        <option value="ios">iOS</option>
                      </select>
                      {chevron}
                    </div>
                  </div>
                </div>
                <div className="co-row2">
                  <div className="co-fld">
                    <label>Traffic type</label>
                    <div className="co-selw">
                      <select value={traffic.trafficType} onChange={e => setTraffic(p => ({ ...p, trafficType: e.target.value }))} className="co-sel">
                        <option value="keyword">From Google search (keyword)</option>
                        <option value="referrer">From a custom referrer</option>
                        <option value="blank">Direct (no referrer)</option>
                      </select>
                      {chevron}
                    </div>
                  </div>
                  {traffic.trafficType === "keyword" && (
                    <div className="co-fld">
                      <label>Google keyword</label>
                      <input value={traffic.keyword} onChange={e => setTraffic(p => ({ ...p, keyword: e.target.value }))} placeholder="best smm panel nigeria" className="co-in" />
                    </div>
                  )}
                  {traffic.trafficType === "referrer" && (
                    <div className="co-fld">
                      <label>Referrer URL</label>
                      <input value={traffic.referrer} onChange={e => setTraffic(p => ({ ...p, referrer: e.target.value }))} placeholder="https://twitter.com" className="co-in" />
                    </div>
                  )}
                </div>
              </div>
            )}
            {mode === "bulk" && (
              <>
                <button type="button" className="co-b full" disabled={!canAddToBatch || !!typedInput} onClick={addToBatch}>+ Add to batch</button>
                {typedInput && <div className="co-hint">{selectedGroup?.name} needs {typedLabel ? typedLabel[0].toLowerCase() : "typed input"} — switch to Single to place it.</div>}
                {batchItems.length > 0 && (
                  <div className="co-batch">
                    {batchItems.map((item, i) => (
                      <div key={i} className="co-bi">
                        <span className="dot" style={{ background: TIER_CLR_ORDER[item.tier] || "#3b82f6" }} />
                        <div>
                          <b>{item.groupName} · {item.tier}</b>
                          <i className="m">{item.link.replace(/^https?:\/\//, "").slice(0, 30)}{item.link.length > 38 ? "…" : ""} · {item.quantity.toLocaleString()} · {fN(item.sellPer1k * item.quantity / 1000)}</i>
                        </div>
                        <button type="button" className="co-ib" onClick={() => editBatchItem(i)} aria-label="Edit item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" /></svg></button>
                        <button type="button" className="co-ib" onClick={() => removeBatchItem(i)} aria-label="Remove item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* delivery */}
        <section className="co-card">
          <header><h3>Delivery</h3>{isDripEligible && mode !== "bulk" && <span className="co-cnt">Drip from {dripThreshold.toLocaleString()}</span>}</header>
          <div className="co-cb">
            {!canDrip ? (
              <div className="co-hint">
                {mode === "bulk" ? "Batch orders go out in one go."
                  : !selectedTier ? "Pick a service first."
                  : !isDripEligible ? "This service is delivered in one go."
                  : qtyNum > 0 ? `Drip starts at ${dripThreshold.toLocaleString()}; this order goes out in one go.` : "Enter a quantity."}
              </div>
            ) : (
              <div className={"co-drip" + (dripOn ? " on" : "")}>
                <div className="co-dh" onClick={() => setDripOn(!dripOn)}>
                  {tog(dripOn, e => { e.stopPropagation(); setDripOn(!dripOn); })}
                  <span><b>Drip delivery</b><i>Spread across days so it looks natural</i></span>
                  {dripOn && <span className={`co-dd m ${zone}`}>{clampedDays} days · {perDay.toLocaleString()}/day</span>}
                </div>
                {dripOn && (
                  <div className="co-db">
                    <div className="co-fld">
                      <label>Days <em>{daysMin} to {daysMax}</em></label>
                      <input type="range" min={daysMin} max={daysMax} value={clampedDays} onChange={e => setDripDays(Number(e.target.value))} className="co-range" />
                      <div className="co-days">
                        {dayAmounts.map((q, i) => <span key={i} className={"co-day" + (q ? "" : " off")}><b className="m">{q ? q.toLocaleString() : "—"}</b><i>D{i + 1}</i></span>)}
                      </div>
                    </div>
                    <div className="co-row2">
                      <div className="co-fld">
                        <label>Start</label>
                        {segs(dripStart, [["now", "Now"], ["scheduled", "Scheduled"]], setDripStart)}
                        {dripStart === "scheduled" && (
                          <div className="co-row">
                            <input type="date" value={dripStartDate} onChange={e => setDripStartDate(e.target.value)} className={"co-in m" + (scheduledDateMissing || scheduledDatePast ? " bad" : "")} />
                            <input type="time" value={dripStartTime} onChange={e => setDripStartTime(e.target.value)} className="co-in m" />
                          </div>
                        )}
                      </div>
                      <div className="co-fld">
                        <label>Curve</label>
                        {segs(dripCurve, [["even", "Even"], ["frontload", "Front-load"], ["rampup", "Ramp-up"]], setDripCurve)}
                        <span className="co-hint" style={{ fontSize: 11.5 }}>{dripCurve === "even" ? "Same amount each day" : dripCurve === "frontload" ? "More on day 1, tapering down" : "Starts small, builds up"}</span>
                      </div>
                    </div>
                    <div className="co-row2">
                      <div className="co-fld">
                        <label>Delivery window</label>
                        <div className="co-tglrow">
                          {tog(dripWindowOn, () => setDripWindowOn(!dripWindowOn))}
                          {dripWindowOn ? (
                            <div className="co-row" style={{ flex: 1, alignItems: "center" }}>
                              <div className="co-selw"><select value={dripWindowStart} onChange={e => setDripWindowStart(Number(e.target.value))} className="co-sel m">{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>{chevron}</div>
                              <span style={{ flex: "0 0 auto", fontSize: 11, color: "var(--mut)" }}>to</span>
                              <div className="co-selw"><select value={dripWindowEnd} onChange={e => setDripWindowEnd(Number(e.target.value))} className="co-sel m">{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>{chevron}</div>
                            </div>
                          ) : <span>Any time of day</span>}
                        </div>
                      </div>
                      <div className="co-fld">
                        <label>Pause point</label>
                        <div className="co-tglrow">
                          {tog(dripPause, () => setDripPause(!dripPause))}
                          {dripPause ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              After day
                              <input type="number" min={1} max={clampedDays - 1} value={dripPauseDay} onChange={e => setDripPauseDay(Math.max(1, Math.min(clampedDays - 1, Number(e.target.value) || 1)))} className="co-in m" style={{ width: 64 }} />
                              of {clampedDays}
                            </span>
                          ) : <span>No pause</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* phone: the summary as its own step */}
      {mobileReview && (
        <div className="co-sheet">
          <button type="button" className="co-link" style={{ alignSelf: "flex-start" }} onClick={() => setMobileReview(false)}>← Back to the form</button>
          {summary}
        </div>
      )}
      {!mobileReview && (
        <div className="co-sbar">
          <span><i>{charge ? "Total charge" : "Service value"}</i><b className="m">{fN(activeCharge)}</b></span>
          <button type="button" className="co-b" onClick={() => setMobileReview(true)}>Review</button>
          {insufficientBal
            ? <button type="button" className="co-pri" onClick={openTopUp}>Top up</button>
            : <button type="button" className="co-pri" disabled={!ready || !typedOk} onClick={handleSubmit}>{submitting ? "Creating..." : "Create"}</button>}
        </div>
      )}

      {/* desktop: the summary lives in the right sidebar */}
      {sidebarEl && createPortal(<div className="co" style={vars}>{summary}</div>, sidebarEl)}
    </div>
  );
}

const CO_CSS = `
.co{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.co *{box-sizing:border-box}
.co .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.co-form{display:flex;flex-direction:column;gap:14px;min-width:0}
.co-card{background:var(--card);border:1px solid var(--line);border-radius:14px}
.co-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}
.co-card h3,.co-sum h3{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700;margin:0}
.co-cnt{font-size:11.5px;color:var(--dim)}
.co-cb{padding:14px 16px;display:flex;flex-direction:column;gap:14px}
.co-row2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.co-row{display:flex;gap:8px}.co-row>*{flex:1;min-width:0}
.co-between{display:flex;justify-content:space-between;align-items:center;gap:8px}
.co-fld{display:flex;flex-direction:column;gap:6px;min-width:0}
.co-fld>label{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}
.co-fld>label em{font-style:normal;font-weight:500;letter-spacing:0;text-transform:none;color:var(--dim);margin-left:6px}
.co-in,.co-sel{width:100%;height:38px;padding:0 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);font:inherit;font-size:13.5px;color:var(--ink);outline:none}
.co-in.m,.co-sel.m{font-size:13px}
.co-in:focus,.co-sel:focus,.co-ta:focus,.co-pre:focus-within{border-color:var(--acln)}
.co-in.bad,.co-pre.bad{border-color:var(--bad)}
.co-sel:disabled{opacity:.55;cursor:not-allowed}
.co-ta{width:100%;padding:9px 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);font:inherit;font-size:13.5px;color:var(--ink);outline:none;resize:vertical;min-height:84px}
.co-selw{position:relative;min-width:0}.co-selw .co-sel{appearance:none;-webkit-appearance:none;padding-right:32px;cursor:pointer}
.co-selw>svg{position:absolute;right:11px;top:50%;transform:translateY(-50%);width:13px;height:13px;color:var(--dim);pointer-events:none}
.co-selw.ic .co-sel{padding-left:36px}.co-pi{position:absolute;left:11px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--mut);pointer-events:none;display:flex;align-items:center}
.co-pre{display:flex;align-items:center;height:38px;border-radius:10px;background:var(--card);border:1px solid var(--line);padding:0 12px;gap:8px}
.co-pre>span{color:var(--dim);font-size:13.5px;padding-right:8px;border-right:1px solid var(--line);flex-shrink:0}
.co-pre>input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13.5px;color:var(--ink);outline:none}
.co-segs{display:flex;gap:3px;padding:3px;border-radius:10px;background:var(--soft);border:1px solid var(--line)}
.co-seg{flex:1;text-align:center;font:inherit;font-size:12.5px;font-weight:600;padding:7px 8px;border-radius:7px;color:var(--mut);white-space:nowrap;background:none;border:0;cursor:pointer}
.co-seg.on{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.co-modes{width:180px}
.co-cust{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--soft);border:1px solid var(--line)}
.co-av{width:34px;height:34px;border-radius:50%;background:var(--ac);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
.co-cn{display:flex;flex-direction:column;min-width:0;flex:1;text-align:left}
.co-cn b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.co-cn i{font-style:normal;font-size:12px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.co-bal{font-size:13px;font-weight:700;color:var(--ok);background:var(--okbg);padding:4px 9px;border-radius:999px;white-space:nowrap;flex-shrink:0}
.co-b{font:inherit;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;transition:transform .15s}
.co-b:hover{transform:translateY(-1px)}.co-b.sm{padding:6px 10px;font-size:12px}.co-b.ghost{background:transparent;color:var(--mut)}.co-b.full{width:100%}
.co-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
.co-pri{font:inherit;font-size:13.5px;font-weight:800;padding:11px 16px;border-radius:11px;border:0;background:var(--ac);color:#fff;cursor:pointer;box-shadow:0 8px 22px rgba(196,125,142,.28);white-space:nowrap;transition:transform .15s}
.co-pri:hover{transform:translateY(-1px)}.co-pri:disabled{opacity:.45;cursor:not-allowed;box-shadow:none;transform:none}.co-pri.wide{width:100%;margin-top:4px}
.co-link{font:inherit;font-size:12px;font-weight:600;color:var(--ac);background:none;border:0;cursor:pointer;padding:0}
.co-dd-list{position:absolute;left:0;right:0;top:calc(100% + 5px);background:var(--card);border:1px solid var(--line);border-radius:11px;z-index:40;box-shadow:0 12px 30px rgba(0,0,0,.14);max-height:240px;overflow-y:auto}
.co-dd-row{display:flex;align-items:center;gap:10px;padding:9px 12px;width:100%;background:none;border:0;border-bottom:1px solid var(--rail);font:inherit;color:var(--ink);cursor:pointer}
.co-dd-row:last-child{border-bottom:0}.co-dd-row:hover{background:var(--soft)}
.co-tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.co-tc{display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:10px 12px;border-radius:11px;border:1px solid var(--line);background:var(--card);font:inherit;cursor:pointer;text-align:left;color:var(--ink);transition:transform .15s}
.co-tc:hover{transform:translateY(-1px)}
.co-tc b{font-size:12px;font-weight:800;letter-spacing:.3px}.co-tc span{font-size:14px;font-weight:700}.co-tc em{font-style:normal;font-size:11px;font-weight:700;color:var(--ok)}.co-tc em.low{color:var(--bad)}
.co-tc.bud b{color:var(--bud)}.co-tc.std b{color:var(--std)}.co-tc.prm b{color:var(--prm)}
.co-tc.on{box-shadow:0 0 0 1px currentColor;border-color:currentColor}
.co-tc.bud.on{color:var(--bud);background:var(--budbg)}.co-tc.std.on{color:var(--std);background:var(--stdbg)}.co-tc.prm.on{color:var(--prm);background:var(--prmbg)}
.co-tc.on span,.co-tc.on em{color:inherit}
.co-chg,.co-tglrow{display:flex;align-items:center;gap:10px;min-height:38px}
.co-chg>span:last-child,.co-dh>span:nth-child(2){display:flex;flex-direction:column;line-height:1.2;min-width:0}
.co-chg b,.co-dh b{font-size:13px;font-weight:700}.co-chg i,.co-dh i{font-style:normal;font-size:11.5px;color:var(--mut)}
.co-tglrow>span:last-child{font-size:13px;color:var(--mut)}
.co-tog{width:34px;height:20px;border-radius:10px;background:var(--ac);position:relative;flex-shrink:0;display:inline-block;border:0;padding:0;cursor:pointer}
.co-tog i{position:absolute;top:2px;left:16px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}
.co-tog.o{background:var(--line)}.co-tog.o i{left:2px}
.co-drip{border:1.5px solid var(--line);border-radius:13px;overflow:hidden}.co-drip.on{border-color:var(--ac)}
.co-dh{display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--acbg);cursor:pointer;user-select:none}
.co-dd{margin-left:auto;font-size:12.5px;font-weight:700;color:var(--ac);white-space:nowrap}.co-dd.moderate{color:var(--warn)}.co-dd.hot{color:var(--bad)}
.co-db{padding:14px;display:flex;flex-direction:column;gap:14px;border-top:1px solid var(--line)}
.co-range{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;background:var(--line);outline:none;cursor:pointer;margin:8px 0 4px}
.co-range::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#fff;border:2px solid var(--ac);box-shadow:0 1px 4px rgba(0,0,0,.2);cursor:pointer}
.co-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:2px solid var(--ac);cursor:pointer}
.co-days{display:grid;grid-template-columns:repeat(auto-fit,minmax(48px,1fr));gap:6px}
.co-day{display:flex;flex-direction:column;align-items:center;padding:7px 4px;border-radius:9px;background:var(--soft);border:1px solid var(--line)}
.co-day b{font-size:13px;font-weight:700}.co-day i{font-style:normal;font-size:10px;color:var(--dim)}.co-day.off{opacity:.45}
.co-hint{font-size:12.5px;color:var(--mut);line-height:1.5}
.co-traffic{display:flex;flex-direction:column;gap:12px;padding:12px 14px;border-radius:12px;border:1.5px solid var(--line)}.co-traffic.need{border-color:var(--ac)}
.co-batch{border:1px solid var(--line);border-radius:11px;overflow:hidden}
.co-bi{display:flex;align-items:center;gap:10px;padding:9px 12px;border-top:1px solid var(--rail);font-size:12.5px}.co-bi:first-child{border-top:0}
.co-bi .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}.co-bi>div{flex:1;min-width:0}
.co-bi b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}.co-bi i{font-style:normal;font-size:11px;color:var(--mut);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.co-ib{width:26px;height:26px;border-radius:7px;border:1px solid var(--line);background:var(--card);color:var(--mut);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;padding:0}
.co-sum{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0 16px 16px;display:flex;flex-direction:column}
.co-sum>header{padding:11px 0;border-bottom:1px solid var(--line);margin-bottom:6px;display:flex;justify-content:space-between;align-items:baseline}
.co-sr{display:flex;justify-content:space-between;gap:12px;padding:7px 0;font-size:13px;border-bottom:1px solid var(--rail)}
.co-sr span{color:var(--mut);white-space:nowrap}.co-sr b{font-weight:600;text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.co-sr b.good{color:var(--ok)}.co-sr b.low{color:var(--bad)}
.co-sdrip{padding:10px 0;border-bottom:1px solid var(--rail);display:flex;flex-direction:column}
.co-lbl{font-size:10.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--mut)}
.co-bars{display:flex;align-items:flex-end;gap:4px;height:34px;margin:8px 0 6px}.co-bars i{flex:1;background:var(--ac);border-radius:3px 3px 0 0;opacity:.8;min-height:2px}.co-bars i.off{background:var(--line)}
.co-stot{display:flex;flex-direction:column;padding:12px 0 8px}
.co-stot span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}
.co-stot b{font-size:26px;font-weight:800;color:var(--ac);letter-spacing:-.02em;margin-top:2px}
.co-stot i{font-style:normal;font-size:12px;color:var(--mut);margin-top:2px}.co-stot i.low{color:var(--bad)}
.co-empty{padding:22px 6px;text-align:center;font-size:12.5px;color:var(--mut);line-height:1.6}
.co-tu{border:1px solid var(--line);border-radius:12px;background:var(--soft);padding:12px;display:flex;flex-direction:column;gap:10px}
.co-tu-h{font-size:10.5px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;color:var(--mut)}
.co-tu-bank{padding:10px;border-radius:9px;background:var(--card);border:1px solid var(--line);display:flex;flex-direction:column;gap:3px}
.co-amt{display:flex;align-items:center;gap:8px}.co-amt>b{font-size:16px;font-weight:800;color:var(--ac)}
.co-note{font-size:11px;color:var(--warn)}.co-note.bad{color:var(--bad)}
.co-sheet{display:none;flex-direction:column;gap:12px}
.co-sbar{display:none}
@media (max-width:1199px){
  .co-hide{display:none}
  .co-sheet{display:flex}
  .co-form{padding-bottom:84px}
  .co-sbar{position:fixed;left:12px;right:12px;bottom:12px;z-index:30;display:flex;align-items:center;gap:8px;padding:12px 14px;border-radius:14px;background:var(--card);border:1px solid var(--line);box-shadow:0 -8px 24px rgba(0,0,0,.08)}
  .co-sbar>span{display:flex;flex-direction:column;flex:1;min-width:0}
  .co-sbar>span i{font-style:normal;font-size:10.5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}
  .co-sbar>span b{font-size:20px;font-weight:800;color:var(--ac);letter-spacing:-.02em}
}
@media (max-width:640px){
  .co-row2{grid-template-columns:1fr}.co-modes{width:100%}
  .co-cust{flex-wrap:wrap}.co-cn{flex-basis:calc(100% - 44px)}.co-bal{margin-left:44px}
  .co-tiers{gap:6px}.co-tc{padding:9px 8px}.co-tc span{font-size:13px}
}
`;
