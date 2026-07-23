'use client';
import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useToast } from "./toast";
import { fN } from "../lib/format";
import { distributeByCurve } from "../lib/drip-feed";
import { cleanLink } from "@/lib/clean-link";

const TIER_CLR_ORDER = { Budget: "#f59e0b", Standard: "#3b82f6", Premium: "#a855f7" };
const DRIP_DAILY_CAP = { followers: 5000, likes: 10000, views: 75000, plays: 75000, comments: 1000, reviews: 100, engagement: 15000 };
const DRIP_DEFAULT_CAP = 15000;
const MULTIDAY_THRESHOLD_DEFAULT = 3000;
const DRIP_MIN_FLOOR = { followers: 3, views: 1, plays: 1, likes: 2, comments: 3, reviews: 3, engagement: 2 };
function dripDailyCap(type) { return DRIP_DAILY_CAP[(type || "").toLowerCase()] || DRIP_DEFAULT_CAP; }
function dripMaxDays(qty) { return qty <= 5000 ? 5 : qty <= 10000 ? 7 : qty <= 25000 ? 12 : qty <= 50000 ? 18 : qty <= 100000 ? 25 : 30; }
function dripMinDays(qty, type) { const floor = DRIP_MIN_FLOOR[(type || "").toLowerCase()] || 3; return Math.max(floor, Math.ceil(qty / dripDailyCap(type))); }
function dripZone(perDay, type) { const cap = dripDailyCap(type); return perDay <= cap * 0.5 ? "safe" : perDay <= cap ? "moderate" : "hot"; }

const MODE_ICONS = {
  single: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  bulk: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
};

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
  const tiers = selectedGroup?.tiers || [];
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
  const margin = totalCost > 0 ? Math.round((totalCharge - totalCost) / totalCost * 100) : 0;

  const canAddToBatch = mode === "bulk" && selectedTier && validQty && link.trim() && linkValid;
  const batchTotalCharge = batchItems.reduce((s, it) => s + it.sellPer1k * it.quantity / 1000, 0);
  const batchTotalCost = batchItems.reduce((s, it) => s + it.costNgn * it.quantity / 1000, 0);
  const batchTotalOrders = batchItems.length;
  const batchMargin = batchTotalCost > 0 ? Math.round((batchTotalCharge - batchTotalCost) / batchTotalCost * 100) : 0;
  const activeCharge = mode === "bulk" ? batchTotalCharge : totalCharge;
  const activeMargin = mode === "bulk" ? batchMargin : margin;
  const insufficientBal = charge && user && activeCharge > 0 && activeCharge > user.balance;

  const hasDripSchedule = mode !== "bulk" && effectiveDripDays >= 2;
  const scheduledDateMissing = hasDripSchedule && dripStart === "scheduled" && !dripStartDate;
  const scheduledDatePast = hasDripSchedule && dripStart === "scheduled" && dripStartDate &&
    new Date(`${dripStartDate}T${dripStartTime || "09:00"}`) < new Date();
  const ready = user && !submitting && !scheduledDateMissing && !scheduledDatePast && (
    mode === "single" ? (selectedTier && validQty && !!link) :
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
      setLink(""); setQty(""); setDripOn(false); setDripDays(3); setDripStart("now"); setDripStartDate(""); setDripWindowOn(false); setDripCurve("even"); setDripPause(false); setDripPauseDay(1); setBatchItems([]);
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

  const inp = { width: "100%", padding: "10px 13px", borderRadius: 10, fontSize: 14, outline: "none", background: dark ? "rgba(19,23,40,1)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.14)"}`, color: t.text, fontFamily: "inherit", transition: "border-color .15s" };
  const inpM = { ...inp, fontFamily: "'JetBrains Mono', monospace", fontSize: 13 };
  const lab = { fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: t.textMuted, display: "block", marginBottom: 6 };
  const card = { background: dark ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`, borderRadius: 16, padding: 20 };

  const submitBlock = insufficientBal ? (
    <div>
      <button disabled style={{ width: "100%", padding: 13, borderRadius: 12, fontSize: 14.5, fontWeight: 800, background: dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.06)", color: dark ? "#fca5a5" : "#dc2626", border: `1.5px solid ${dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.12)"}`, cursor: "default" }}>
        Insufficient balance · {fN(user.balance)}
      </button>
      {!topUpOpen ? (
        <button onClick={() => { setTopUpOpen(true); setTopUpAmount(String(shortfall)); setTopUpChannel(null); setTopUpLink(null); setTopUpBank(null); setTopUpSender(""); setTopUpDone(null); }} style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 10, fontSize: 13, fontWeight: 700, background: "none", color: t.accent, border: `1.5px solid ${dark ? "rgba(196,125,142,.25)" : "rgba(196,125,142,.2)"}`, cursor: "pointer" }}>
          Top up {user.name?.split(" ")[0]}
        </button>
      ) : (
        <div style={{ marginTop: 10, padding: 14, borderRadius: 12, background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.025)", border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: t.textMuted, marginBottom: 10 }}>Top up · {user.name?.split(" ")[0]}</div>
          {!topUpChannel ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setTopUpChannel("flutterwave")} style={{ flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 12.5, fontWeight: 700, background: dark ? "rgba(251,191,36,.1)" : "rgba(251,191,36,.08)", color: dark ? "#fbbf24" : "#b45309", border: `1px solid ${dark ? "rgba(251,191,36,.2)" : "rgba(251,191,36,.15)"}`, cursor: "pointer" }}>Flutterwave</button>
              <button onClick={handleSelectManual} style={{ flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 12.5, fontWeight: 700, background: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)", color: dark ? "#6ee7b7" : "#059669", border: `1px solid ${dark ? "rgba(110,231,183,.2)" : "rgba(5,150,105,.12)"}`, cursor: "pointer" }}>Bank transfer</button>
            </div>
          ) : topUpDone === "pending" ? (
            <div style={{ textAlign: "center", padding: "6px 0" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: dark ? "#fbbf24" : "#b45309", marginBottom: 4 }}>Submitted for approval</div>
              <div style={{ fontSize: 11.5, color: t.textMuted, lineHeight: 1.5 }}>A superadmin will review and approve this deposit.</div>
              <button onClick={resetTopUp} style={{ marginTop: 10, padding: "8px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "none", color: t.textMuted, border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}`, cursor: "pointer" }}>Done</button>
            </div>
          ) : topUpLink ? (
            <div>
              <div style={{ fontSize: 12, color: t.soft, marginBottom: 8 }}>Payment link generated. Copy and send to the user.</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input readOnly value={topUpLink} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12, background: dark ? "rgba(19,23,40,1)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)"}`, color: t.text, fontFamily: "'JetBrains Mono', monospace" }} />
                <button onClick={() => { navigator.clipboard.writeText(topUpLink); toast.success("Copied", "Payment link copied"); }} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: t.accent, color: "#fff", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>Copy</button>
              </div>
              <button onClick={resetTopUp} style={{ width: "100%", marginTop: 8, padding: 8, borderRadius: 8, fontSize: 12, fontWeight: 600, background: "none", color: t.textMuted, border: "none", cursor: "pointer" }}>Done</button>
            </div>
          ) : topUpChannel === "manual" && !topUpBank ? (
            <div style={{ textAlign: "center", padding: 8 }}>
              <div style={{ fontSize: 12, color: t.textMuted }}>{topUpLoading ? "Loading bank details..." : "Bank transfer not available"}</div>
              {!topUpLoading && <button onClick={() => setTopUpChannel(null)} style={{ marginTop: 8, fontSize: 12, color: t.accent, background: "none", border: "none", cursor: "pointer" }}>Back</button>}
            </div>
          ) : topUpChannel === "manual" && topUpBank ? (
            <div>
              <div style={{ padding: 10, borderRadius: 9, background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.025)", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: t.textMuted }}>{topUpBank.bankName}</span>
                  <button onClick={() => { navigator.clipboard.writeText(topUpBank.accountNumber); toast.success("Copied", "Account number copied"); }} style={{ fontSize: 10, fontWeight: 600, color: t.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}>Copy</button>
                </div>
                <div className="m" style={{ fontSize: 16, fontWeight: 800, color: t.text, letterSpacing: 1 }}>{topUpBank.accountNumber}</div>
                <div style={{ fontSize: 11, color: t.soft, marginTop: 2 }}>{topUpBank.accountName}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: t.accent }}>₦</span>
                <input type="number" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} placeholder="Amount" style={{ flex: 1, padding: "9px 12px", borderRadius: 9, fontSize: 14, fontWeight: 600, background: dark ? "rgba(19,23,40,1)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.14)"}`, color: t.text, outline: "none", fontFamily: "'JetBrains Mono', monospace" }} />
              </div>
              <input value={topUpSender} onChange={e => setTopUpSender(e.target.value)} placeholder="Sender / Account name" style={{ width: "100%", padding: "9px 12px", borderRadius: 9, fontSize: 13, background: dark ? "rgba(19,23,40,1)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.14)"}`, color: t.text, outline: "none", fontFamily: "inherit", marginBottom: 10, boxSizing: "border-box" }} />
              {!topUpBank.canCreditDirectly && <div style={{ fontSize: 10.5, color: dark ? "#fbbf24" : "#b45309", marginBottom: 8 }}>This deposit will need superadmin approval</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setTopUpChannel(null); setTopUpBank(null); setTopUpSender(""); }} style={{ flex: 1, padding: 9, borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "none", color: t.textMuted, border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}`, cursor: "pointer" }}>Back</button>
                <button onClick={handleTopUp} disabled={topUpLoading || !Number(topUpAmount) || topUpSender.trim().length < 3} style={{ flex: 1, padding: 9, borderRadius: 9, fontSize: 12.5, fontWeight: 700, background: dark ? "rgba(110,231,183,.15)" : "rgba(5,150,105,.1)", color: dark ? "#6ee7b7" : "#059669", border: "none", cursor: topUpLoading || !Number(topUpAmount) || topUpSender.trim().length < 3 ? "default" : "pointer", opacity: topUpLoading || !Number(topUpAmount) || topUpSender.trim().length < 3 ? 0.5 : 1 }}>
                  {topUpLoading ? "Processing..." : topUpBank.canCreditDirectly ? "Credit now" : "Submit for approval"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: t.accent }}>₦</span>
                <input type="number" value={topUpAmount} onChange={e => setTopUpAmount(e.target.value)} placeholder="Amount" style={{ flex: 1, padding: "9px 12px", borderRadius: 9, fontSize: 14, fontWeight: 600, background: dark ? "rgba(19,23,40,1)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.14)"}`, color: t.text, outline: "none", fontFamily: "'JetBrains Mono', monospace" }} />
              </div>
              {Number(topUpAmount) > 0 && Number(topUpAmount) < 1000 && <div style={{ fontSize: 11, color: dark ? "#fca5a5" : "#dc2626", marginBottom: 8 }}>Flutterwave minimum is ₦1,000</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setTopUpChannel(null); setTopUpLink(null); }} style={{ flex: 1, padding: 9, borderRadius: 9, fontSize: 12.5, fontWeight: 600, background: "none", color: t.textMuted, border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}`, cursor: "pointer" }}>Back</button>
                <button onClick={handleTopUp} disabled={topUpLoading || !Number(topUpAmount) || Number(topUpAmount) < 1000} style={{ flex: 1, padding: 9, borderRadius: 9, fontSize: 12.5, fontWeight: 700, background: dark ? "rgba(251,191,36,.15)" : "rgba(251,191,36,.1)", color: dark ? "#fbbf24" : "#b45309", border: "none", cursor: topUpLoading || !Number(topUpAmount) || Number(topUpAmount) < 1000 ? "default" : "pointer", opacity: topUpLoading || !Number(topUpAmount) || Number(topUpAmount) < 1000 ? 0.5 : 1 }}>
                  {topUpLoading ? "Processing..." : "Generate link"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  ) : (
    <button onClick={handleSubmit} disabled={!ready} style={{ width: "100%", padding: 13, borderRadius: 12, fontSize: 14.5, fontWeight: 800, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", transition: ".15s", border: "none", cursor: ready ? "pointer" : "default", opacity: ready ? 1 : .4 }}>
      {submitting ? "Creating..." : mode === "bulk" ? `Create ${batchTotalOrders} Order${batchTotalOrders !== 1 ? "s" : ""}` : effectiveDripDays >= 2 ? `Create Drip Order (${effectiveDripDays}d)` : "Create Order"}
    </button>
  );

  const summaryContent = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: t.textMuted }}>Order Summary</span>
      </div>
      {user && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 9, background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.025)", marginBottom: 12 }}>
          <div style={{ width: 22, height: 22, borderRadius: 99, background: dark ? "rgba(196,125,142,.22)" : "rgba(196,125,142,.12)", color: t.accent, fontSize: 8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(user.name)}</div>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.text, flex: 1 }}>{user.name}</span>
          <span className="m" style={{ fontSize: 11, fontWeight: 600, color: dark ? "#6ee7b7" : "#059669" }}>{fN(user.balance)}</span>
        </div>
      )}
      {mode === "bulk" && batchItems.length > 0 ? (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: t.textMuted, marginBottom: 6 }}>Batch · {batchItems.length} item{batchItems.length !== 1 ? "s" : ""}</div>
          {batchItems.map((item, i) => {
            const lp = item.link.replace(/^https?:\/\//, "").slice(0, 24) + (item.link.length > 32 ? "…" : "");
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
                <span style={{ width: 5, height: 5, borderRadius: 99, background: TIER_CLR_ORDER[item.tier] || "#3b82f6", flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, fontWeight: 500, color: t.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.groupName} · {item.tier}</span>
                <span className="m" style={{ fontSize: 11, color: t.textMuted }}>{item.quantity.toLocaleString()}</span>
              </div>
            );
          })}
          <div style={{ height: 1, background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", margin: "10px 0" }} />
          <SumRow label="Total orders" value={String(batchTotalOrders)} t={t} mono />
          <SumRow label="Provider cost" value={fN(batchTotalCost)} t={t} mono muted />
          <SumRow label="Profit" value={`${batchMargin}%`} t={t} mono color={batchMargin < 33 ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669")} />
          <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)"}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted }}>{charge ? "Total charge" : "Service value"}</div>
            <div className="m" style={{ fontSize: 22, fontWeight: 800, color: t.accent, marginTop: 2 }}>{fN(batchTotalCharge)}</div>
          </div>
          {!charge && <div style={{ marginTop: 10, padding: "8px 11px", borderRadius: 9, fontSize: 11.5, lineHeight: 1.5, background: dark ? "rgba(224,164,88,.12)" : "rgba(224,164,88,.08)", color: dark ? "#e0a458" : "#b45309" }}>Free order — {user?.name?.split(" ")[0]} gets {fN(batchTotalCharge)} in services without being charged.</div>}
        </>
      ) : (!selectedTier || !nLinks || !qtyNum) ? (
        <div style={{ textAlign: "center", padding: "20px 10px" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 10px", display: "block" }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <div style={{ fontSize: 12.5, color: t.textMuted, lineHeight: 1.6 }}>Pick a service, link{mode === "bulk" ? "s" : ""} and quantity.<br />The breakdown builds here.</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text }}>{selectedGroup?.name}</div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 6, color: TIER_CLR_ORDER[selectedTier?.tier] || "#3b82f6", background: `${(TIER_CLR_ORDER[selectedTier?.tier] || "#3b82f6")}18` }}>
              <span style={{ width: 5, height: 5, borderRadius: 99, background: "currentColor" }} />{selectedTier?.tier}
            </span>
          </div>
          <div style={{ height: 1, background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)", margin: "0 0 8px" }} />
          <SumRow label="Price per 1k" value={fN(sellPer1k)} t={t} mono />
          <SumRow label="Quantity" value={qtyNum.toLocaleString()} t={t} mono />
          <SumRow label="Provider cost" value={fN(totalCost)} t={t} mono muted />
          <SumRow label="Profit" value={`${margin}%`} t={t} mono color={margin < 33 ? (dark ? "#fca5a5" : "#dc2626") : (dark ? "#6ee7b7" : "#059669")} />
          <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)"}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.textMuted }}>{charge ? "Total charge" : "Service value"}</div>
            <div className="m" style={{ fontSize: 22, fontWeight: 800, color: t.accent, marginTop: 2 }}>{fN(totalCharge)}</div>
          </div>
          {effectiveDripDays >= 2 && qtyNum > 0 && (() => {
            const days = effectiveDripDays;
            const provMin = selectedTier?.service?.min || 50;
            const dayAmounts = distributeByCurve(qtyNum, days, dripCurve, dripPause ? dripPauseDay : 0, provMin);
            const skipDay = dripPause && dripPauseDay > 0 && dripPauseDay < days ? dripPauseDay + 1 : 0;
            const activeDaysCount = dayAmounts.filter(q => q > 0).length;
            const showDays = Math.min(days, 3);
            return (
              <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: t.textMuted }}>Drip · {activeDaysCount < days ? `${activeDaysCount}/${days}d` : `${days}d`} · {dripCurve}</span>
                  {dripPause && <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: dark ? "rgba(251,191,36,.15)" : "rgba(251,191,36,.1)", color: dark ? "#fbbf24" : "#b45309" }}>⏸ after day {dripPauseDay}</span>}
                </div>
                {dayAmounts.slice(0, showDays).map((amt, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: i + 1 === skipDay ? (dark ? "#fbbf24" : "#b45309") : t.soft, padding: "2.5px 0" }}>
                    <span>Day {i + 1}{i + 1 === skipDay ? " ⏸" : ""}</span>
                    <span className="m">{amt === 0 ? "—" : Math.max(amt, 0).toLocaleString()}</span>
                  </div>
                ))}
                {days > 3 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: t.soft, padding: "2.5px 0" }}><span>… day {days}</span><span className="m">{Math.max(dayAmounts[days - 1], 0).toLocaleString()}</span></div>}
                {dripStart === "scheduled" && dripStartDate && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>Starts {dripStartDate} {dripStartTime}</div>}
                {dripWindowOn && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>Window: {dripWindowStart > 12 ? dripWindowStart - 12 : dripWindowStart || 12}{dripWindowStart >= 12 ? "PM" : "AM"} – {dripWindowEnd > 12 ? dripWindowEnd - 12 : dripWindowEnd || 12}{dripWindowEnd >= 12 ? "PM" : "AM"}</div>}
              </div>
            );
          })()}
          {!charge && <div style={{ marginTop: 10, padding: "8px 11px", borderRadius: 9, fontSize: 11.5, lineHeight: 1.5, background: dark ? "rgba(224,164,88,.12)" : "rgba(224,164,88,.08)", color: dark ? "#e0a458" : "#b45309" }}>Free order — {user?.name?.split(" ")[0]} gets {fN(totalCharge)} in services without being charged.</div>}
        </>
      )}
    </>
  );

  return (
    <>
      <div className={mobileReview ? "max-md:hidden" : ""}>
        <div className="adm-page-title" style={{ fontSize: 23, fontWeight: 800, letterSpacing: -.2 }}>Create Order</div>
        <div style={{ fontSize: 13, color: t.textMuted, marginTop: 3 }}>Place orders on behalf of users</div>
        <div style={{ height: 1.5, background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)", margin: "18px 0 20px" }} />
      </div>

      {/* mode seg */}
      <div className={mobileReview ? "max-md:hidden" : ""} style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 12, background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)", border: `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.1)"}`, marginBottom: 20 }}>
        {["single", "bulk"].map(m => (
          <button key={m} onClick={() => { setMode(m); setBatchItems([]); }} style={{ padding: "8px 22px", borderRadius: 9, fontSize: 13.5, fontWeight: mode === m ? 700 : 600, color: mode === m ? "#fff" : t.textMuted, background: mode === m ? "linear-gradient(135deg,#c47d8e,#8b5e6b)" : "none", display: "flex", alignItems: "center", gap: 7, transition: ".15s", border: "none", cursor: "pointer" }}>
            {MODE_ICONS[m]}{m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }} className="max-md:flex-col">
        {/* form */}
        <div style={{ flex: 1, ...card }} className={mobileReview ? "max-md:hidden" : ""}>
          {/* user search */}
          <div style={{ marginBottom: 16 }}>
            <span style={lab}>User</span>
            {!user ? (
              <div ref={searchRef} style={{ position: "relative" }}>
                <input value={userSearch} onChange={e => { setUserSearch(e.target.value); searchUsers(e.target.value); }} placeholder="Search by name or email..." style={inp} autoComplete="off" />
                {userDDOpen && (
                  <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 5px)", background: dark ? "rgba(19,23,40,1)" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.14)"}`, borderRadius: 11, zIndex: 40, overflow: "hidden", boxShadow: "0 14px 40px rgba(0,0,0,.5)" }}>
                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                      {userResults.length === 0 ? (
                        <div style={{ padding: "12px", color: t.textMuted, fontSize: 12.5, textAlign: "center" }}>{searching ? "Searching..." : "No users found"}</div>
                      ) : userResults.map(u => (
                        <button key={u.id} onClick={() => { setUser(u); setUserSearch(""); setUserDDOpen(false); resetTopUp(); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", width: "100%", textAlign: "left", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)"}`, cursor: "pointer", background: "none", border: "none", color: "inherit" }}>
                          <div style={{ width: 30, height: 30, borderRadius: 99, background: dark ? "rgba(196,125,142,.22)" : "rgba(196,125,142,.12)", color: t.accent, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(u.name)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: t.text }}>{u.name}</div>
                            <div style={{ fontSize: 11.5, color: t.textMuted }}>{u.email}</div>
                          </div>
                          <span className="m" style={{ marginLeft: "auto", fontSize: 12, color: dark ? "#6ee7b7" : "#059669" }}>{fN(u.balance)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.06)", border: `1px solid ${dark ? "rgba(196,125,142,.22)" : "rgba(196,125,142,.14)"}` }}>
                <div style={{ width: 30, height: 30, borderRadius: 99, background: dark ? "rgba(196,125,142,.22)" : "rgba(196,125,142,.12)", color: t.accent, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(user.name)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: t.text }}>{user.name}</div>
                  <div style={{ fontSize: 11.5, color: t.textMuted }}>{user.email} · balance <span className="m" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{fN(user.balance)}</span></div>
                </div>
                <button onClick={() => { setUser(null); resetTopUp(); }} style={{ marginLeft: "auto", color: t.textMuted, cursor: "pointer", background: "none", border: "none", padding: 0 }} aria-label="Clear user">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )}
          </div>

          {/* platform + group */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <span style={lab}>Platform</span>
              <select value={platform} onChange={e => { setPlatform(e.target.value); setGroupId(""); setTierId(""); }} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
                <option value="">Select platform...</option>
                {platforms.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <span style={lab}>Service group</span>
              <select value={groupId} onChange={e => { setGroupId(e.target.value); setTierId(""); }} disabled={!platform} style={{ ...inp, appearance: "none", cursor: platform ? "pointer" : "default", opacity: platform ? 1 : .45 }}>
                <option value="">{platform ? "Select service group..." : "Select platform first"}</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}{g.nigerian ? " 🇳🇬" : ""}</option>)}
              </select>
            </div>
          </div>

          {/* tier pills */}
          <div style={{ marginBottom: 16 }}>
            <span style={lab}>Tier</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tiers.length === 0 ? (
                <div style={{ padding: "8px 13px", borderRadius: 12, border: `1.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.1)"}`, opacity: .45 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: t.textMuted }}>Pick a service group first</span>
                </div>
              ) : tiers.map(ti => {
                const clr = TIER_CLR_ORDER[ti.tier] || "#3b82f6";
                const active = tierId === ti.id;
                return (
                  <button key={ti.id} onClick={() => setTierId(ti.id)} style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 12, padding: "8px 13px 8px 10px", border: `1.5px solid ${active ? t.accent : (dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.1)")}`, background: active ? (dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.06)") : (dark ? "rgba(19,23,40,1)" : "#fff"), transition: ".15s", textAlign: "left", cursor: "pointer" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: clr, flexShrink: 0 }} />
                    <span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: clr, display: "block" }}>{ti.tier}</span>
                      <span className="m" style={{ fontSize: 11, color: t.textMuted, display: "block", marginTop: 1 }}>{fN(Number(ti.sellPer1k) / 100)}/1k</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* link */}
          <div style={{ marginBottom: 16 }}>
            <span style={lab}>Link</span>
            <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: `1px solid ${link && linkValid === false ? (dark ? "#f87171" : "#dc2626") : !link ? t.accent : (dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.14)")}`, background: !link ? (dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.08)") : (dark ? "rgba(19,23,40,1)" : "#fff"), transition: "border-color .15s" }}>
              <span style={{ display: "inline-flex", alignItems: "center", padding: "0 10px", fontSize: 13, fontWeight: 600, color: t.textMuted, borderRight: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, userSelect: "none", flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>https://</span>
              <input value={link} onChange={e => setLink(e.target.value.replace(/^https?:\/\//i, "").trim())} onBlur={() => { if (link) setLink(cleanLink(fullLink(link)).replace(/^https?:\/\//i, "")); }} placeholder={platform ? ({"Instagram":"instagram.com/username","TikTok":"tiktok.com/@username","YouTube":"youtube.com/@channel","Twitter":"x.com/username","Facebook":"facebook.com/pagename"}[platform] || "paste link here") : "paste link here"} style={{ ...inpM, border: "none", borderRadius: 0, flex: 1 }} />
            </div>
            {link && linkValid === false && <div style={{ fontSize: 11, color: dark ? "#f87171" : "#dc2626", marginTop: 4 }}>Enter a valid URL — e.g. instagram.com/username</div>}
          </div>

          {/* quantity */}
          <div style={{ marginBottom: 16 }}>
            <span style={lab}>Quantity</span>
            <input value={qty} onChange={e => setQty(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="1000" style={inpM} />
            <div style={{ fontSize: 11.5, color: (selectedTier && qty && !validQty) ? (dark ? "#fca5a5" : "#dc2626") : t.textMuted, marginTop: 5 }}>
              {selectedTier ? `Min ${minQty.toLocaleString()} · Max ${maxQty.toLocaleString()}` : "Pick a tier to see limits"}
            </div>
          </div>

          {/* drip panel */}
          {showDripPanel && mode !== "bulk" && qtyNum > 0 && (() => {
            const zoneClr = zone === "safe" ? { bg: dark ? "rgba(74,222,128,.08)" : "rgba(22,163,74,.05)", border: dark ? "rgba(74,222,128,.18)" : "rgba(22,163,74,.15)", text: dark ? "#4ade80" : "#16a34a" } : zone === "moderate" ? { bg: dark ? "rgba(250,204,21,.08)" : "rgba(202,138,4,.05)", border: dark ? "rgba(250,204,21,.18)" : "rgba(202,138,4,.15)", text: dark ? "#fcd34d" : "#b45309" } : { bg: dark ? "rgba(239,68,68,.08)" : "rgba(220,38,38,.05)", border: dark ? "rgba(239,68,68,.18)" : "rgba(220,38,38,.15)", text: dark ? "#fca5a5" : "#dc2626" };
            const segBtn = (val, label, active) => (
              <button key={val} onClick={() => setDripCurve(val)} style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 11.5, fontWeight: 700, color: active ? "#fff" : t.textMuted, background: active ? t.accent : "none", border: active ? "none" : `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}`, cursor: "pointer", transition: ".15s" }}>{label}</button>
            );
            const hourLabel = (h) => { const ap = h >= 12 ? "PM" : "AM"; return `${h === 0 ? 12 : h > 12 ? h - 12 : h}${ap}`; };
            return (
              <div style={{ marginBottom: 16, borderRadius: 13, border: `1.5px solid ${dripOn ? t.accent : (dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)")}`, overflow: "hidden", transition: "border-color .2s" }}>
                {/* header toggle */}
                <div onClick={() => setDripOn(!dripOn)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", cursor: "pointer", userSelect: "none", background: dripOn ? (dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.04)") : "none", transition: ".15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dripOn ? t.accent : t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6l3-3"/><path d="M12 2v6l-3-3"/><path d="M12 22c-4-4-8-7.6-8-12a8 8 0 1116 0c0 4.4-4 8-8 12z"/></svg>
                    <span style={{ fontSize: 13, fontWeight: 700, color: dripOn ? t.text : t.textMuted }}>Drip Delivery</span>
                  </div>
                  <div style={{ position: "relative", width: 38, height: 21, borderRadius: 99, background: dripOn ? (dark ? "rgba(196,125,142,.22)" : "rgba(196,125,142,.15)") : (dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)"), border: `1px solid ${dripOn ? t.accent : (dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)")}`, transition: ".2s", flexShrink: 0 }}>
                    <i style={{ position: "absolute", top: 2, left: dripOn ? 19 : 2, width: 15, height: 15, borderRadius: 99, background: dripOn ? t.accent : t.textMuted, transition: ".2s", display: "block" }} />
                  </div>
                </div>

                {dripOn && (
                  <div style={{ padding: "2px 14px 14px" }}>
                    <style>{`.adm-drip-sl{-webkit-appearance:none;appearance:none;height:6px;border-radius:3px;outline:none;cursor:pointer}.adm-drip-sl::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;cursor:pointer;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);background:var(--thumb-clr,#c47d8e)}.adm-drip-sl::-moz-range-thumb{width:18px;height:18px;border-radius:50%;cursor:pointer;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);background:var(--thumb-clr,#c47d8e)}`}</style>
                    {/* days slider */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                        <span style={{ ...lab, marginBottom: 0 }}>Days</span>
                        <span className="m" style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{clampedDays}</span>
                      </div>
                      <input type="range" min={daysMin} max={daysMax} value={clampedDays} onChange={e => setDripDays(Number(e.target.value))} className="adm-drip-sl" style={{ width: "100%", background: `linear-gradient(to right, ${zoneClr.text} ${((clampedDays - daysMin) / Math.max(daysMax - daysMin, 1)) * 100}%, ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"} ${((clampedDays - daysMin) / Math.max(daysMax - daysMin, 1)) * 100}%)`, "--thumb-clr": zoneClr.text }} />
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: t.textMuted }}>{daysMin}d min</span>
                        <span style={{ fontSize: 11, color: t.textMuted }}>{daysMax}d max</span>
                      </div>
                      <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: zoneClr.bg, border: `1px solid ${zoneClr.border}`, textAlign: "center" }}>
                        <span className="m" style={{ fontSize: 14, fontWeight: 800, color: zoneClr.text }}>~{perDay.toLocaleString()}</span>
                        <span style={{ fontSize: 11, color: zoneClr.text, marginLeft: 6 }}>per day · {zone === "safe" ? "Safe" : zone === "moderate" ? "Moderate" : "Hot"}</span>
                      </div>
                    </div>

                    {/* start time */}
                    <div style={{ marginBottom: 14 }}>
                      <span style={lab}>Start</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[["now", "Now"], ["scheduled", "Schedule"]].map(([val, label]) => (
                          <button key={val} onClick={() => setDripStart(val)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, color: dripStart === val ? "#fff" : t.textMuted, background: dripStart === val ? t.accent : "none", border: dripStart === val ? "none" : `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}`, cursor: "pointer", transition: ".15s" }}>{label}</button>
                        ))}
                      </div>
                      {dripStart === "scheduled" && (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                            <input type="date" value={dripStartDate} onChange={e => setDripStartDate(e.target.value)} style={{ ...inpM, fontSize: 12, ...(scheduledDateMissing || scheduledDatePast ? { borderColor: "#ef4444" } : {}) }} />
                            <input type="time" value={dripStartTime} onChange={e => setDripStartTime(e.target.value)} style={{ ...inpM, fontSize: 12 }} />
                          </div>
                          {scheduledDatePast && <div style={{ fontSize: 10.5, color: "#ef4444", marginTop: 4 }}>Date must be in the future</div>}
                        </>
                      )}
                    </div>

                    {/* delivery window */}
                    <div style={{ marginBottom: 14 }}>
                      <div onClick={() => setDripWindowOn(!dripWindowOn)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}>
                        <span style={{ ...lab, marginBottom: 0 }}>Delivery window</span>
                        <div style={{ position: "relative", width: 32, height: 18, borderRadius: 99, background: dripWindowOn ? (dark ? "rgba(196,125,142,.22)" : "rgba(196,125,142,.15)") : (dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)"), border: `1px solid ${dripWindowOn ? t.accent : (dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)")}`, transition: ".2s" }}>
                          <i style={{ position: "absolute", top: 1.5, left: dripWindowOn ? 15 : 1.5, width: 13, height: 13, borderRadius: 99, background: dripWindowOn ? t.accent : t.textMuted, transition: ".2s", display: "block" }} />
                        </div>
                      </div>
                      {dripWindowOn && (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                          <select value={dripWindowStart} onChange={e => setDripWindowStart(Number(e.target.value))} style={{ ...inpM, fontSize: 12, flex: 1 }}>
                            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                          </select>
                          <span style={{ fontSize: 11, color: t.textMuted, flexShrink: 0 }}>to</span>
                          <select value={dripWindowEnd} onChange={e => setDripWindowEnd(Number(e.target.value))} style={{ ...inpM, fontSize: 12, flex: 1 }}>
                            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* distribution curve */}
                    <div style={{ marginBottom: 14 }}>
                      <span style={lab}>Distribution</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {segBtn("even", "Even", dripCurve === "even")}
                        {segBtn("frontload", "Front-load", dripCurve === "frontload")}
                        {segBtn("rampup", "Ramp-up", dripCurve === "rampup")}
                      </div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginTop: 5 }}>
                        {dripCurve === "even" ? "Same amount each day" : dripCurve === "frontload" ? "More on day 1, tapering down" : "Starts small, builds up"}
                      </div>
                    </div>

                    {/* pause point */}
                    <div>
                      <div onClick={() => setDripPause(!dripPause)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}>
                        <span style={{ ...lab, marginBottom: 0 }}>Pause point</span>
                        <div style={{ position: "relative", width: 32, height: 18, borderRadius: 99, background: dripPause ? (dark ? "rgba(196,125,142,.22)" : "rgba(196,125,142,.15)") : (dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)"), border: `1px solid ${dripPause ? t.accent : (dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)")}`, transition: ".2s" }}>
                          <i style={{ position: "absolute", top: 1.5, left: dripPause ? 15 : 1.5, width: 13, height: 13, borderRadius: 99, background: dripPause ? t.accent : t.textMuted, transition: ".2s", display: "block" }} />
                        </div>
                      </div>
                      {dripPause && (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: t.textMuted }}>Pause after day</span>
                          <input type="number" min={1} max={clampedDays - 1} value={dripPauseDay} onChange={e => setDripPauseDay(Math.max(1, Math.min(clampedDays - 1, Number(e.target.value) || 1)))} style={{ ...inpM, width: 54, fontSize: 12, textAlign: "center" }} />
                          <span style={{ fontSize: 11, color: t.textMuted }}>of {clampedDays}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* add to batch + batch list (bulk mode) */}
          {mode === "bulk" && (
            <div style={{ marginBottom: 16 }}>
              <button onClick={addToBatch} disabled={!canAddToBatch} style={{ width: "100%", padding: "10px 13px", borderRadius: 10, fontSize: 13, fontWeight: 700, color: canAddToBatch ? t.accent : t.textMuted, background: "none", border: `1.5px dashed ${canAddToBatch ? t.accent : (dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)")}`, cursor: canAddToBatch ? "pointer" : "default", opacity: canAddToBatch ? 1 : .4, transition: ".15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add to Batch
              </button>
              {batchItems.length > 0 && (
                <div style={{ marginTop: 10, borderRadius: 11, border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, overflow: "hidden" }}>
                  {batchItems.map((item, i) => {
                    const itemTotal = item.sellPer1k * item.quantity / 1000;
                    const linkPreview = item.link.replace(/^https?:\/\//, "").slice(0, 30) + (item.link.length > 38 ? "…" : "");
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: i < batchItems.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)"}` : "none", background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)" }}>
                        <span style={{ width: 7, height: 7, borderRadius: 99, background: TIER_CLR_ORDER[item.tier] || "#3b82f6", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.groupName} · {item.tier}</div>
                          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1, fontFamily: "'JetBrains Mono', monospace" }}>{linkPreview} · {item.quantity.toLocaleString()} · <span className="m">{fN(itemTotal)}</span></div>
                        </div>
                        <button onClick={() => editBatchItem(i)} style={{ color: t.textMuted, cursor: "pointer", background: "none", border: "none", padding: 2, flexShrink: 0 }} aria-label="Edit item">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => removeBatchItem(i)} style={{ color: t.textMuted, cursor: "pointer", background: "none", border: "none", padding: 2, flexShrink: 0 }} aria-label="Remove item">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* charge toggle */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 13px", borderRadius: 11, background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)"}` }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: t.text }}>Charge user</div>
                <div style={{ fontSize: 11.5, color: t.textMuted, marginTop: 2 }}>{charge ? "Deducted from the user's balance" : "Free order — the user won't be charged"}</div>
              </div>
              <button onClick={() => { setCharge(!charge); resetTopUp(); }} style={{ position: "relative", width: 38, height: 21, borderRadius: 99, background: charge ? (dark ? "rgba(196,125,142,.22)" : "rgba(196,125,142,.15)") : (dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)"), border: `1px solid ${charge ? t.accent : (dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)")}`, transition: ".2s", flexShrink: 0, cursor: "pointer", padding: 0 }} aria-label="Toggle charge">
                <i style={{ position: "absolute", top: 2, left: charge ? 19 : 2, width: 15, height: 15, borderRadius: 99, background: charge ? t.accent : t.textMuted, transition: ".2s", display: "block" }} />
              </button>
            </div>
          </div>

          {/* desktop: submit / top-up */}
          <div className="max-md:hidden">
            {submitBlock}
          </div>

          {/* mobile: review button */}
          <button onClick={() => setMobileReview(true)} disabled={!ready && !insufficientBal} className="md:hidden" style={{ width: "100%", padding: 13, borderRadius: 12, fontSize: 14.5, fontWeight: 800, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", border: "none", cursor: !ready && !insufficientBal ? "default" : "pointer", opacity: !ready && !insufficientBal ? .4 : 1 }}>
            Review Order
          </button>
        </div>

      </div>

      {/* mobile: summary step */}
      {mobileReview && (
        <div className="md:hidden">
          <button onClick={() => setMobileReview(false)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: t.accent, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 12 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back to form
          </button>
          <div style={card}>{summaryContent}</div>
          <div style={{ marginTop: 14 }}>{submitBlock}</div>
        </div>
      )}

      {/* desktop: portal summary into dash-right sidebar */}
      {sidebarEl && createPortal(<>{summaryContent}<div style={{ marginTop: 16 }}>{submitBlock}</div></>, sidebarEl)}
    </>
  );
}

function SumRow({ label, value, t, mono, small, muted, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13, color: t.soft }}>
      <span>{label}</span>
      <span className={mono ? "m" : ""} style={{ fontWeight: 700, color: color || (muted ? t.textMuted : t.text), ...(small ? { fontSize: 12.5 } : {}) }}>{value}</span>
    </div>
  );
}

