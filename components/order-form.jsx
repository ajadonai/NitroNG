'use client';
import { useEffect, useState } from "react";
import { BONUS_PRESETS, bonusForNaira } from "../lib/welcome-bonus";
import { calculateOrderPrice, formatOrderQuantity, getDripSchedule, LINK_EXAMPLES, LINK_HINTS, MULTIDAY_THRESHOLD, validateOrderLink } from "../lib/order-form-core";
import NitroLoader from "./nitro-loader";

export function OrderForm({ selSvc, selTier, platform, qty, setQty, link, setLink, dark, t, onClose, compact, onSubmit, orderLoading, comments, setComments, loyaltyDiscount = 0, loyaltyTier = null, activePromotion = null, balance = null, onTopUp, welcomeBonusEligible, pointsRedeemable = false, pointsBalance = 0, redeemPoints = false, setRedeemPoints, tierStyles = {} }) {
  const minQty = selTier?.min || 100;
  const maxQty = selTier?.max || 50000;
  const isPackage = minQty === maxQty;
  useEffect(() => { if (isPackage && String(qty) !== String(minQty)) setQty(String(minQty)); }, [isPackage, minQty]);
  const qtyNum = Number(qty) || 0;
  const qtyOutOfRange = qty !== "" && qtyNum > 0 && (qtyNum < minQty || qtyNum > maxQty);
  const {
    basePrice,
    discountAmount,
    promoDiscountAmount: promoDiscountAmt,
    cappedPromoDiscount,
    priceBeforePoints,
    pointsDiscount,
    price,
  } = calculateOrderPrice({
    quantity: qtyNum,
    tier: selTier,
    loyaltyDiscount,
    activePromotion,
    pointsRedeemable,
    pointsBalance,
    redeemPoints,
  });
  const s = selTier ? tierStyles[selTier.tier] : null;
  const [linkError, setLinkError] = useState("");
  const [linkHelpOpen, setLinkHelpOpen] = useState(false);
  const [dripOn, setDripOn] = useState(false);
  const [dripStep, setDripStep] = useState(1);
  const [dripDays, setDripDays] = useState(3);
  const showMultiDay = selTier?.tags?.includes('drip') && qtyNum >= MULTIDAY_THRESHOLD;
  const {
    daysMax,
    daysMin,
    days: clampedDays,
    perDay,
    zone: dripZone,
  } = getDripSchedule(qtyNum, selSvc?.type, dripDays);

  useEffect(() => { if (!linkHelpOpen) return; const onKey = (e) => { if (e.key === "Escape") setLinkHelpOpen(false); }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }, [linkHelpOpen]);

  /* Link validation */
  const validateLink = (val) => {
    const { cleaned, error } = validateOrderLink(val, {
      platform,
      isProfileService: isProfileSvc,
      isPostService: isPostSvc,
    });
    setLink(cleaned);
    if (cleaned.trim()) setLinkHelpOpen(false);
    setLinkError(error);
  };
  const linkValid = link.trim() && !linkError;

  /* Detect service type from provider apiType (reliable) with name fallback */
  const svcName = (selSvc?.name || "").toLowerCase();
  const apiType = (selTier?.apiType || "").toLowerCase();
  const isComment = apiType.includes("comment") || ((svcName.includes("comment")) && !svcName.includes("comment like") || svcName.includes("likes (comments)") && !svcName.includes("likes (comments)"));
  const isCustomComment = apiType.includes("custom comment") || apiType.includes("comment replies");
  const isMention = apiType.includes("mention");
  const isPoll = apiType === "poll";
  const isSeo = apiType === "seo";
  const isReview = svcName.includes("review") && !svcName.includes("review like");
  const needsComments = isCustomComment || isReview;
  const showComments = isComment || isReview;
  const needsUsernames = isMention;
  const needsAnswer = isPoll;
  const needsKeywords = isSeo;

  const commentLines = (comments || "").split("\n").filter(l => l.trim()).length;
  const minCommentLines = isCustomComment ? Math.max(selTier?.min || 10, 10) : 0;
  const commentShort = needsComments && commentLines > 0 && commentLines < minCommentLines;

  const isMultiPostSvc = /last\s+\d+\s*(tweet|post|video|reel|photo)/i.test(svcName);
  const isChannelSvc = /(channel|group)\s*(member|join|subscriber)/i.test(svcName);
  const isAutoSvc = /\bauto\b/i.test(svcName);
  const isProfileSvc = (/follow|subscri|member|profile visit/i.test(svcName) || isMultiPostSvc || isAutoSvc) && !isChannelSvc;
  const isPostSvc = /view|like|retweet|share|reposts|comment|reaction|vote|save|bookmark|impression|reach|plays/i.test(svcName) && !isProfileSvc && !isChannelSvc;

  const isCommentLikeSvc = svcName.includes("comment like") || svcName.includes("likes (comments)");
  const linkPlaceholder = (LINK_EXAMPLES[platform] ? (isCommentLikeSvc ? LINK_EXAMPLES[platform].commentLike?.[0] : isPostSvc ? LINK_EXAMPLES[platform].post?.[0] : isChannelSvc ? (LINK_EXAMPLES[platform].channel?.[0] || LINK_EXAMPLES[platform].profile?.[0]) : isProfileSvc ? LINK_EXAMPLES[platform].profile?.[0] : null) : null) || LINK_HINTS[platform] || `${platform}.com/...`;
  const linkLabel = platform === "webtraffic" ? "Website URL" : isPoll ? "Post / Poll URL" : "Link";

  return (
    <div>
      {/* ── Service header card ── */}
      <div className="p-5 pb-4 max-md:p-3.5 max-md:pb-3 rounded-t-[14px] desktop:rounded-t-2xl" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", borderBottom: `1px solid ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.12)"}` }}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="text-[17px] font-semibold max-md:text-base" style={{ color: t.text }}>{selSvc?.name}</div>
          {onClose && <button onClick={onClose} className="bg-transparent border border-solid rounded-lg w-7 h-7 flex items-center justify-center cursor-pointer shrink-0" style={{ borderColor: dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)", color: t.textSoft }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
        </div>
        {s && <div className="flex items-center gap-1.5 flex-wrap">
          <div className="inline-flex items-center gap-0 rounded-lg overflow-hidden" style={{ border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}` }}>
            <span className="inline-flex items-center gap-1 font-semibold py-1 px-2.5 text-[12px]" style={{ background: dark ? s.bgD : s.bg, color: s.text }}>{s.label} {selTier.tier}</span>
            <span className="py-1 px-2.5 text-[12px] font-semibold" style={{ color: t.text, fontFamily: "'JetBrains Mono', monospace", background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)" }}>₦{selTier.price.toLocaleString()}</span>
          </div>
          {selTier.tier === "Budget" ? (
            <span className="inline-flex items-center gap-1 text-[11px] py-[3px] px-2 rounded-md" style={{ background: dark ? "rgba(239,68,68,.08)" : "rgba(239,68,68,.06)", color: dark ? "#fca5a5" : "#dc2626" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              No refill
            </span>
          ) : selTier.tier === "Standard" ? (
            <span className="inline-flex items-center gap-1 text-[11px] py-[3px] px-2 rounded-md" style={{ background: dark ? "rgba(110,231,183,.08)" : "rgba(5,150,105,.06)", color: dark ? "#6ee7b7" : "#059669" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              30-day refill
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] py-[3px] px-2 rounded-md" style={{ background: dark ? "rgba(167,139,250,.08)" : "rgba(167,139,250,.06)", color: dark ? "#c4b5fd" : "#7c3aed" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
              Lifetime refill
            </span>
          )}
        </div>}
      </div>

      {/* ── Package note (verified comments etc.) ── */}
      {selTier && isPackage && selSvc?.type === "verified-comments" && (
        <div className="mx-5 max-md:mx-3.5 mt-3 rounded-lg py-2 px-3 flex items-start gap-2" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.05)", border: `1px solid ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)"}` }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={dark ? "#d4949f" : "#a0616e"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <div className="text-[11px] leading-[1.5]" style={{ color: dark ? "#a09890" : "#6e6a65" }}>
            {selTier.tier === "Budget" && "Delivers 1 comment from smaller verified profiles."}
            {selTier.tier === "Standard" && "Delivers 3 comments from mid-tier verified accounts."}
            {selTier.tier === "Premium" && "Delivers 5 comments from top-tier, high-follower verified accounts."}
          </div>
        </div>
      )}

      {/* ── Growth Package bundle breakdown ── */}
      {selTier && isPackage && svcName.includes("growth package") && (
        <div className="mx-5 max-md:mx-3.5 mt-3 rounded-lg py-2.5 px-3" style={{ background: dark ? "rgba(59,130,246,.06)" : "rgba(59,130,246,.04)", border: `1px solid ${dark ? "rgba(59,130,246,.15)" : "rgba(59,130,246,.1)"}` }}>
          <div className="flex items-start gap-2 mb-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={dark ? "#60a5fa" : "#2563eb"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-px"><path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 000 4h4v-4h-4z"/></svg>
            <div className="text-[11.5px] leading-[1.6] font-semibold" style={{ color: dark ? "#60a5fa" : "#2563eb" }}>
              {selTier.tier === "Budget" && "1,000 Followers + 200 Likes + 200 Shares"}
              {selTier.tier === "Standard" && "5,000 Followers + 1,000 Likes + 1,000 Shares"}
              {selTier.tier === "Premium" && "10,000 Followers + 2,000 Likes + 2,000 Shares"}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fbbf24" : "#d97706"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-px"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div className="text-[10.5px] leading-[1.5]" style={{ color: dark ? "#fbbf24" : "#92400e" }}>Likes and shares will be delivered to your most recent post.</div>
          </div>
        </div>
      )}

      {/* ── Form fields ── */}
      <div className="p-5 max-md:p-3.5">
      {selTier && <>
        {dripStep === 1 ? (<>
        <div className="mb-3" data-tour="no-link-input">
          <label className="text-[11px] tracking-[0.5px] uppercase font-semibold block mb-[6px]" style={{ color: t.textMuted }}>{linkLabel}</label>
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${linkError ? (dark ? "#f87171" : "#dc2626") : !link.trim() ? t.accent : dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.19)"}`, background: !link.trim() ? (dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.08)") : (dark ? "#131728" : "#fff") }}>
            <span className="inline-flex items-center px-3 text-sm font-semibold shrink-0 select-none" style={{ borderRight: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.1)"}`, color: t.textMuted }}>https://</span>
            <input type="url" inputMode="url" aria-label={linkLabel} disabled={orderLoading} placeholder={linkPlaceholder} value={link} onChange={e => validateLink(e.target.value)} className="m w-full py-2 px-3 text-[15px] outline-none box-border font-[inherit] disabled:opacity-50 border-0" style={{ background: "transparent", color: t.text }} />
          </div>
          {linkError && <div className="text-[11px] mt-[3px]" style={{ color: dark ? "#f87171" : "#dc2626" }}>{linkError}</div>}
          {!linkError && LINK_EXAMPLES[platform] && (isProfileSvc || isPostSvc || isChannelSvc) && (() => {
              const isCommentLike = svcName.includes("comment like") || svcName.includes("likes (comments)");
              const type = isCommentLike ? "commentLike" : isChannelSvc ? "channel" : isProfileSvc ? "profile" : "post";
              const examples = LINK_EXAMPLES[platform][type] || LINK_EXAMPLES[platform].profile;
              if (!examples || !examples.length) return null;
              return <div className="mt-1.5">
                <button type="button" onClick={() => setLinkHelpOpen(o => !o)} className="flex items-center gap-1.5 border-0 cursor-pointer p-0 mb-0" style={{ background: "transparent", color: dark ? "#d4949f" : "#a0616e" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span className="text-[11px] font-medium">We accept these formats</span>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ transform: linkHelpOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {linkHelpOpen && <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {examples.map((ex, i) => <span key={i} className="text-[11px] py-[3px] px-2 rounded-md" style={{ fontFamily: "'JetBrains Mono', monospace", background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: t.textSoft }}>{ex}</span>)}
                </div>}
              </div>;
            })()}
        </div>
        {showComments && (
          <div className="mb-3.5">
            <label className="text-[11px] tracking-[0.5px] uppercase font-semibold block mb-[6px]" style={{ color: t.textMuted }}>{isReview ? "Reviews" : "Comments"} <span className="font-normal normal-case tracking-normal text-[11px]">({needsComments ? "required, one per line" : "optional, one per line"})</span></label>
            <textarea disabled={orderLoading} placeholder={isReview ? "Great service, highly recommend!\nFast delivery and excellent quality\nBest experience I've had, 5 stars" : "Great content!\nLove this post!\nAmazing work, keep it up\nThis is fire"} value={comments || ""} onChange={e => setComments(e.target.value)} rows={4} className="m w-full py-2.5 px-3 rounded-lg border border-solid text-[13px] leading-[1.5] outline-none box-border font-[inherit] resize-y disabled:opacity-50" style={{ borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.19)", background: dark ? "#131728" : "#fff", color: t.text, fontFamily: "'JetBrains Mono', monospace" }} />
            <div className="text-[11px] mt-1" style={{ color: commentShort ? (dark ? "#fca5a5" : "#dc2626") : t.textMuted }}>{commentShort ? `Need at least ${minCommentLines} unique ${isReview ? "reviews" : "comments"} — you have ${commentLines}` : commentLines > 0 ? `${commentLines} ${isReview ? "reviews" : "comments"} entered · we'll cycle through them` : needsComments ? `Enter at least ${minCommentLines} unique comments, one per line` : `Leave empty to use provider's comments`}</div>
          </div>
        )}
        {needsUsernames && (
          <div className="mb-3.5">
            <label className="text-[11px] tracking-[0.5px] uppercase font-semibold block mb-[6px]" style={{ color: t.textMuted }}>Usernames to mention <span className="font-normal normal-case tracking-normal text-[11px]">(one per line, without @)</span></label>
            <textarea disabled={orderLoading} placeholder={"username1\nusername2\nusername3"} value={comments || ""} onChange={e => setComments(e.target.value)} rows={4} className="m w-full py-2.5 px-3 rounded-lg border border-solid text-[13px] leading-[1.5] outline-none box-border font-[inherit] resize-y disabled:opacity-50" style={{ borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.19)", background: dark ? "#131728" : "#fff", color: t.text, fontFamily: "'JetBrains Mono', monospace" }} />
            <div className="text-[11px] mt-1" style={{ color: t.textMuted }}>{(comments || "").split("\n").filter(l => l.trim()).length} usernames entered</div>
          </div>
        )}
        {needsAnswer && (
          <div className="mb-3.5">
            <label className="text-[11px] tracking-[0.5px] uppercase font-semibold block mb-[6px]" style={{ color: t.textMuted }}>Answer option</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map(n => (
                <button key={n} type="button" disabled={orderLoading} onClick={() => setComments(String(n))} className="flex-1 py-2.5 px-0 rounded-lg text-sm font-semibold cursor-pointer border border-solid disabled:opacity-40 transition-transform duration-200 hover:-translate-y-px" style={{ borderColor: (comments || "") === String(n) ? t.accent : (dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)"), background: (comments || "") === String(n) ? (dark ? "#2a1a22" : "#fdf2f4") : "transparent", color: (comments || "") === String(n) ? t.accent : t.textMuted }}>Option {n}</button>
              ))}
            </div>
            <div className="text-[11px] mt-1" style={{ color: t.textMuted }}>Select which poll answer to vote for</div>
          </div>
        )}
        {needsKeywords && (
          <div className="mb-3.5">
            <label className="text-[11px] tracking-[0.5px] uppercase font-semibold block mb-[6px]" style={{ color: t.textMuted }}>Search Keywords <span className="font-normal normal-case tracking-normal text-[11px]">(required, one per line)</span></label>
            <textarea disabled={orderLoading} placeholder={"best nigerian services\nnigeria social media growth\nbuy instagram followers nigeria"} value={comments || ""} onChange={e => setComments(e.target.value)} rows={3} className="m w-full py-2.5 px-3 rounded-lg border border-solid text-[13px] leading-[1.5] outline-none box-border font-[inherit] resize-y disabled:opacity-50" style={{ borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.19)", background: dark ? "#131728" : "#fff", color: t.text, fontFamily: "'JetBrains Mono', monospace" }} />
            <div className="text-[11px] mt-1" style={{ color: t.textMuted }}>{(comments || "").split("\n").filter(l => l.trim()).length || 0} keywords entered</div>
          </div>
        )}
        <div className="mb-3">
          <label className="text-[11px] tracking-[0.5px] uppercase font-semibold block mb-[6px]" style={{ color: t.textMuted }}>Quantity</label>
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${qtyOutOfRange ? (dark ? "rgba(220,38,38,.4)" : "rgba(220,38,38,.38)") : (dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.19)")}`, background: dark ? "#131728" : "#fff" }}>
            <input type="number" aria-label="Quantity" disabled={orderLoading || isPackage} value={qty} onChange={e => setQty(e.target.value === "" ? "" : e.target.value)} onKeyDown={e => { if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault(); }} className="m w-full py-2 px-3 text-[15px] outline-none box-border font-[inherit] disabled:opacity-50 border-0" style={{ background: "transparent", color: t.text }} />
            {!isPackage && <span className="inline-flex items-center px-3 text-[11px] font-semibold shrink-0 select-none whitespace-nowrap" style={{ borderLeft: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.1)"}`, color: t.textMuted }}>max<br/>{formatOrderQuantity(maxQty)}</span>}
            {isPackage && <span className="inline-flex items-center px-3 text-[11px] font-semibold shrink-0 select-none whitespace-nowrap" style={{ borderLeft: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.1)"}`, color: t.textMuted }}>fixed</span>}
          </div>
          {qtyOutOfRange && <div className="text-[11px] mt-[3px]" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>{qtyNum < minQty ? `Minimum: ${minQty.toLocaleString()}` : `Maximum: ${maxQty.toLocaleString()}`}</div>}
        </div>
          {showMultiDay && (<>
          <div className="rounded-xl mb-3 flex items-center gap-[10px] py-2.5 px-3 cursor-pointer select-none" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.12)"}`, WebkitTapHighlightColor: "transparent" }} onClick={() => setDripOn(v => !v)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={dripOn ? (dark ? "#4ade80" : "#16a34a") : (dark ? "#6e6a65" : "#918b85")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <div className="flex-1">
              <div className="text-[13px] font-semibold" style={{ color: dark ? "#a09b95" : "#555250" }}>Gradual delivery</div>
              <div className="text-[11px]" style={{ color: dark ? "#6e6a65" : "#918b85", marginTop: 1 }}>Spread across multiple days for safety</div>
            </div>
            <div className="relative w-10 h-[22px] shrink-0" aria-hidden="true">
              <div className="absolute inset-0 rounded-[11px] transition-colors duration-200" style={{ background: dripOn ? "#c47d8e" : (dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.15)") }} />
              <div className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-[left] duration-200" style={{ left: dripOn ? 20 : 2 }} />
            </div>
          </div>
          {!dripOn && <div className="flex items-center justify-center gap-1.5 -mt-1.5 mb-3 text-[11px]" style={{ color: dark ? "#fcd34d" : "#b45309" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Large delivery may flag the target account
          </div>}
          </>)}
        {pointsRedeemable && priceBeforePoints > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-[10px] p-2.5 mb-2 border border-solid cursor-pointer select-none" onClick={() => setRedeemPoints(!redeemPoints)} style={{ background: redeemPoints ? (dark ? "rgba(251,191,36,.08)" : "rgba(251,191,36,.07)") : (dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)"), borderColor: redeemPoints ? (dark ? "rgba(251,191,36,.25)" : "rgba(251,191,36,.35)") : t.cardBorder }}>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold" style={{ color: redeemPoints ? (dark ? "#fbbf24" : "#92400e") : t.text }}>Use Nitro Points</div>
              <div className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>{pointsBalance.toLocaleString()} pts available · saves ₦{Math.min(pointsBalance, priceBeforePoints).toLocaleString()}</div>
            </div>
            <div className="relative w-10 h-[22px] shrink-0" aria-hidden="true">
              <div className="absolute inset-0 rounded-[11px] transition-colors duration-200" style={{ background: redeemPoints ? "#fbbf24" : (dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.15)") }} />
              <div className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-[left] duration-200" style={{ left: redeemPoints ? 20 : 2 }} />
            </div>
          </div>
        )}
        <div className="rounded-[10px] p-2.5 mb-3 border border-solid" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.04)", borderColor: t.cardBorder }}>
          {discountAmount > 0 && <div className="flex justify-between mb-1 text-[13px]" style={{ color: dark ? "#6ee7b7" : "#059669" }}><span>Nitro Status discount ({loyaltyDiscount}%)</span><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>-₦{discountAmount.toLocaleString()}</span></div>}
          {cappedPromoDiscount > 0 && <div className="flex justify-between mb-1 text-[13px]" style={{ color: dark ? "#f9a8d4" : "#be185d" }}><span>Discount ({activePromotion.discountPercent}%){cappedPromoDiscount < promoDiscountAmt ? ` · capped at ₦${cappedPromoDiscount.toLocaleString()}` : ''}</span><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>-₦{cappedPromoDiscount.toLocaleString()}</span></div>}
          {pointsDiscount > 0 && <div className="flex justify-between mb-1 text-[13px]" style={{ color: dark ? "#fbbf24" : "#92400e" }}><span>Nitro Points</span><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>-₦{pointsDiscount.toLocaleString()}</span></div>}
          <div className={`flex justify-between items-baseline${(discountAmount > 0 || cappedPromoDiscount > 0 || pointsDiscount > 0) ? " border-t border-solid pt-2 mt-1" : ""}`} style={(discountAmount > 0 || cappedPromoDiscount > 0 || pointsDiscount > 0) ? { borderColor: t.cardBorder } : undefined}>
            <span className="text-[13px] font-semibold" style={{ color: t.textMuted }}>Total</span>
            <span className="font-bold text-[20px]" style={{ color: t.accent, fontFamily: "'JetBrains Mono', monospace" }}>{(discountAmount > 0 || cappedPromoDiscount > 0 || pointsDiscount > 0) && <span className="text-[14px] font-normal line-through mr-1.5" style={{ color: t.textMuted }}>₦{basePrice.toLocaleString()}</span>}₦{price.toLocaleString()}</span>
          </div>
        </div>
          {balance != null && qtyNum > 0 && price > balance ? (
            welcomeBonusEligible ? (
            <div className="rounded-xl p-3.5" style={{ background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", border: `1px solid ${dark ? "rgba(110,231,183,.18)" : "rgba(5,150,105,.12)"}` }}>
              <div className="text-[13px] font-semibold mb-1" style={{ color: t.text }}>Almost there — add funds to place this order</div>
              <div className="text-[11.5px] mb-2.5" style={{ color: t.textMuted }}>Your first deposit gets up to ₦3,000 free to spend.</div>
              {(() => {
                const needed = price - balance;
                const tier = BONUS_PRESETS.find(p => p.amount >= needed) || BONUS_PRESETS[BONUS_PRESETS.length - 1];
                const bonus = bonusForNaira(tier.amount);
                return (
                  <div className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg mb-3 text-[12px] font-semibold" style={{ background: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.07)", color: dark ? "#6ee7b7" : "#059669" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                    Deposit ₦{tier.amount.toLocaleString()} → ₦{(tier.amount + bonus).toLocaleString()} to spend
                  </div>
                );
              })()}
              <button onClick={onTopUp} className="w-full py-2.5 rounded-[10px] border-none text-[14px] font-semibold cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(5,150,105,.3)]" style={{ background: dark ? "#059669" : "#059669", color: "#fff" }}>Add funds & claim bonus</button>
            </div>
            ) : (
            <button onClick={onTopUp} data-tour="no-submit-btn" className="w-full py-2.5 rounded-lg border border-solid text-[15px] font-semibold cursor-pointer flex items-center justify-center gap-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-px" style={{ background: dark ? "rgba(250,204,21,.08)" : "rgba(250,204,21,.1)", borderColor: dark ? "rgba(250,204,21,.25)" : "rgba(250,204,21,.35)", color: dark ? "#fcd34d" : "#b45309" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Insufficient balance · Top up
            </button>
            )
          ) : (<>
            <div className="text-[10.5px] mb-2 px-0.5" style={{ color: t.textMuted }}>Profile must be <b style={{ color: t.text }}>public</b>. No refunds for orders on private profiles.</div>
            <button onClick={() => { if (dripOn && showMultiDay) { setDripStep(2); } else { onSubmit(dripOn && showMultiDay ? clampedDays : undefined); } }} data-tour="no-submit-btn" disabled={!linkValid || qtyOutOfRange || qtyNum <= 0 || ((needsComments || needsUsernames || needsKeywords) && !(comments || "").trim()) || (needsAnswer && !(comments || "").trim()) || commentShort || orderLoading} className="w-full py-2.5 rounded-lg border-none bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-[15px] font-semibold cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.38)]" style={{ opacity: linkValid && !qtyOutOfRange && qtyNum > 0 && (!(needsComments || needsUsernames || needsAnswer || needsKeywords) || (comments || "").trim()) && !commentShort && !orderLoading ? 1 : .5 }}>{orderLoading ? <span className="inline-flex items-center justify-center gap-2"><NitroLoader size={16} mono ariaHidden />Placing...</span> : dripOn && showMultiDay ? "Next" : "Place Order"}</button>
          </>)}
        </>) : (<>
          {/* Step 2: Drip config — replaces entire form body */}
          <div className="flex items-center gap-2 mb-3 cursor-pointer select-none" onClick={() => setDripStep(1)} style={{ WebkitTapHighlightColor: "transparent" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? "#a09b95" : "#555250"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span className="text-[13px] font-semibold" style={{ color: dark ? "#a09b95" : "#555250" }}>Delivery schedule</span>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl py-2.5 px-3 mb-3" style={{ background: dark ? "rgba(74,222,128,.06)" : "rgba(22,163,74,.04)", border: `1px solid ${dark ? "rgba(74,222,128,.12)" : "rgba(22,163,74,.1)"}` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={dark ? "#4ade80" : "#16a34a"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <div className="text-[11.5px] leading-[1.6]" style={{ color: dark ? "#8a8580" : "#6e6a65" }}>
              Delivered in safe batches to protect the target account.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-xl py-2.5 px-2 text-center" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.12)"}` }}>
              <div className="text-[10px] mb-0.5" style={{ color: t.textMuted }}>Total</div>
              <div className="text-[13px] font-semibold" style={{ color: t.text, fontFamily: "'JetBrains Mono', monospace" }}>{qtyNum.toLocaleString()}</div>
            </div>
            <div className="rounded-xl py-2.5 px-2 text-center" style={{ background: dripZone === "safe" ? (dark ? "rgba(74,222,128,.08)" : "rgba(22,163,74,.05)") : dripZone === "moderate" ? (dark ? "rgba(250,204,21,.08)" : "rgba(202,138,4,.05)") : (dark ? "rgba(239,68,68,.08)" : "rgba(220,38,38,.05)"), border: `1px solid ${dripZone === "safe" ? (dark ? "rgba(74,222,128,.18)" : "rgba(22,163,74,.15)") : dripZone === "moderate" ? (dark ? "rgba(250,204,21,.18)" : "rgba(202,138,4,.15)") : (dark ? "rgba(239,68,68,.18)" : "rgba(220,38,38,.15)")}` }}>
              <div className="text-[10px] mb-0.5" style={{ color: t.textMuted }}>Per day</div>
              <div className="text-[13px] font-semibold" style={{ color: dripZone === "safe" ? (dark ? "#4ade80" : "#16a34a") : dripZone === "moderate" ? (dark ? "#fcd34d" : "#b45309") : (dark ? "#fca5a5" : "#dc2626"), fontFamily: "'JetBrains Mono', monospace" }}>~{perDay.toLocaleString()}</div>
            </div>
            <div className="rounded-xl py-2.5 px-2 text-center" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.12)"}` }}>
              <div className="text-[10px] mb-0.5" style={{ color: t.textMuted }}>Duration</div>
              <div className="text-[13px] font-semibold" style={{ color: t.text, fontFamily: "'JetBrains Mono', monospace" }}>{clampedDays} days</div>
            </div>
            <div className="rounded-xl py-2.5 px-2 text-center" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.12)"}` }}>
              <div className="text-[10px] mb-0.5" style={{ color: t.textMuted }}>Completes by</div>
              <div className="text-[13px] font-semibold" style={{ color: t.text, fontFamily: "'JetBrains Mono', monospace" }}>{new Date(Date.now() + clampedDays * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div>
            </div>
          </div>
          {daysMin < daysMax ? (<>
          <style>{`
            .nitro-drip-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 3px; outline: none; }
            .nitro-drip-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); background: var(--thumb-color, #c47d8e); }
            .nitro-drip-slider::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; cursor: pointer; border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); background: var(--thumb-color, #c47d8e); }
          `}</style>
          <div className="mb-3 px-1">
            <input type="range" min={daysMin} max={daysMax} value={clampedDays} onChange={e => setDripDays(Number(e.target.value))} className="nitro-drip-slider" style={{ background: `linear-gradient(to right, ${dripZone === "safe" ? "#4ade80" : dripZone === "moderate" ? "#fbbf24" : "#ef4444"} ${((clampedDays - daysMin) / (daysMax - daysMin)) * 100}%, ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"} ${((clampedDays - daysMin) / (daysMax - daysMin)) * 100}%)`, "--thumb-color": dripZone === "safe" ? "#4ade80" : dripZone === "moderate" ? "#fbbf24" : "#ef4444" }} />
            <div className="flex justify-between text-[10px] mt-1.5" style={{ color: t.textMuted }}>
              <span>{daysMin} days</span>
              <span>{daysMax} days</span>
            </div>
          </div>
          </>) : (
          <div className="flex items-center justify-center gap-1.5 mb-3 py-2 rounded-lg text-[11px]" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)", color: t.textMuted }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Fixed at {clampedDays} days for this order size
          </div>
          )}
          <div className="rounded-[10px] p-2.5 mb-3 border border-solid" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.04)", borderColor: t.cardBorder }}>
            <div className="flex justify-between items-baseline">
              <span className="text-[13px] font-semibold" style={{ color: t.textMuted }}>Total</span>
              <span className="font-bold text-[20px]" style={{ color: t.accent, fontFamily: "'JetBrains Mono', monospace" }}>₦{price.toLocaleString()}</span>
            </div>
          </div>
          <button onClick={() => onSubmit(clampedDays)} data-tour="no-submit-btn" disabled={orderLoading} className="w-full py-2.5 rounded-lg border-none bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-[15px] font-semibold cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.38)]" style={{ opacity: !orderLoading ? 1 : .5 }}>{orderLoading ? <span className="inline-flex items-center justify-center gap-2"><NitroLoader size={16} mono ariaHidden />Placing...</span> : "Place Order"}</button>
        </>)}
      </>}
      </div>
    </div>
  );
}
