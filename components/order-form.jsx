'use client';
import { TRAFFIC_COUNTRIES, TRAFFIC_CONTINENTS } from '@/lib/traffic-targets';
import { docDateLocale } from "../lib/format";
import { useEffect, useState, useRef } from "react";
import { useToast } from "./toast";
import { BONUS_PRESETS, MAX_BONUS_NAIRA, bonusForNaira } from "../lib/welcome-bonus";
import { calculateOrderPrice, formatOrderQuantity, getDripSchedule, getLinkPlaceholder, LINK_EXAMPLES, MULTIDAY_THRESHOLD, validateOrderLink } from "../lib/order-form-core";
import NitroLoader from "./nitro-loader";
import { useMoney, useT } from "./locale";
import { Emph } from "./ui-primitives";
import { msg } from "../lib/i18n";
import { OffsetIcon } from "./offset-icons";
import { ServiceGlyph } from "./service-glyph";

const TRAFFIC_DEVICES = [
  { value: 'desktop', label: msg('Desktop') },
  { value: 'android', label: msg('Mobile (Android)') },
  { value: 'ios', label: msg('Mobile (iOS)') },
  { value: 'mobile', label: msg('Mixed (Mobile)') },
  { value: 'all', label: msg('Mixed (Mobile & Desktop)') },
];
const TRAFFIC_TYPES = [
  { value: 'keyword', label: msg('Google Keyword') },
  { value: 'referrer', label: msg('Custom Referrer') },
  { value: 'blank', label: msg('Blank Referrer') },
];

/**
 * The vote, where the customer is already looking at the service. Only someone
 * who has ordered it can cast one — the list has no Nitro testing behind it, so
 * an opinion from someone who never bought it would be worth less than nothing.
 * Tapping the thumb you already hold clears it.
 */
/**
 * A disabled button teaches nothing: you tap it, nothing happens, and at 50%
 * opacity on a phone it does not read as disabled in the first place. It still
 * looks inactive, but the tap now says why rather than swallowing itself.
 */
function FullListRate({ fullList, onVote, onNeedOrder, dark, t }) {
  const tr = useT();
  const can = !!fullList.ordered && !!onVote;
  const THUMB = (down) => down
    ? <OffsetIcon name="thumbDown" />
    : <OffsetIcon name="thumbUp" />;
  return (
    <div className="mx-3.5 mt-2 flex items-center gap-2">
      <span className="text-[11px] flex-1 min-w-0" style={{ color: t.textMuted }}>{can ? tr("Rate it") : tr("Rate it after your order")}</span>
      {[false, true].map(down => {
        const on = fullList.mine === (down ? "down" : "up");
        const n = down ? fullList.down : fullList.up;
        return (
          <button key={String(down)} type="button" onClick={() => can ? onVote(down ? "down" : "up") : onNeedOrder?.()}
            aria-label={down ? tr("Bad service") : tr("Good service")} aria-pressed={on}
            className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full border border-solid text-[11px] font-semibold font-[inherit] transition-colors duration-150"
            style={{ cursor: can ? "pointer" : "default", opacity: can ? 1 : .5, borderColor: on ? (dark ? "#6ee7b7" : "#059669") : t.cardBorder, color: on ? (dark ? "#6ee7b7" : "#059669") : t.textMuted, background: on ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.07)") : "transparent" }}>
            <span className="w-3.5 h-3.5 inline-flex [&_svg]:w-3.5 [&_svg]:h-3.5">{THUMB(down)}</span>
            <span className="m" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{n || 0}</span>
          </button>
        );
      })}
    </div>
  );
}

/* The fields carry their label inside the box, the way the guest checkout's
   do, and say what is wrong inside the box too: the border turns red and the
   message sits under what was typed, so nothing hangs loose between fields.
   Logical properties: this sheet does not go through the RTL build plugin. */
const OF_CSS = `
.of-f{position:relative;border:1.5px solid var(--of-line);border-radius:12px;background:var(--of-field);padding:8px 12px 9px;transition:border-color .15s,box-shadow .15s}
.of-f:focus-within,.of-f.open{border-color:var(--t-accent);box-shadow:0 0 0 3px rgba(196,125,142,.16)}
.of-f.err{border-color:var(--of-bad);box-shadow:0 0 0 3px color-mix(in srgb,var(--of-bad) 13%,transparent)}
.of-lr{display:flex;align-items:center;gap:6px;min-height:16px;font-size:11px;font-weight:600;color:var(--of-mut)}
.of-f.err .of-lr{color:var(--of-bad)}
.of-meta{margin-inline-start:auto;font-weight:500;white-space:nowrap}
.of-f.err .of-meta{font-weight:700}
.of-ir{display:flex;align-items:center;gap:6px;min-height:24px;margin-top:3px}
.of-pre{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:500;color:var(--of-mut)}
.of-in{flex:1;min-width:0;width:100%;border:0;outline:none;background:transparent;padding:0;margin:0;font-family:'JetBrains Mono',monospace;font-size:14.5px;font-weight:600;color:var(--of-ink)}
.of-in::placeholder{color:var(--of-mut);opacity:.6;font-weight:500}
.of-in:disabled{opacity:.5}
.of-in.big{font-size:17px}
textarea.of-in{display:block;resize:vertical;min-height:66px;font-size:13px;line-height:1.5;font-weight:500}
.of-unit{font-size:12.5px;color:var(--of-mut);white-space:nowrap}
.of-tick{display:inline-flex;color:var(--of-ok)}
.of-note{display:flex;align-items:flex-start;gap:6px;margin-top:5px;font-size:11px;line-height:1.4;color:var(--of-mut)}
.of-note svg{margin-top:1px;flex-shrink:0}
.of-note.bad{font-size:11.5px;color:var(--of-bad)}
.of-note.warn{color:var(--of-warn)}
.of-line{display:flex;align-items:center;flex-wrap:wrap;gap:3px 12px;margin-top:5px;font-size:11px;color:var(--of-mut)}
.of-pub{margin-inline-start:auto;display:inline-flex;align-items:center;gap:4px}
.of-tb{display:inline-flex;align-items:center;gap:4px;padding:0;border:0;background:transparent;font:inherit;font-size:11px;font-weight:650;color:var(--t-accent-ink);cursor:pointer}
.of-end{margin-inline-start:auto;display:inline-flex}
.of-tb .of-n{padding:0 5px;border-radius:5px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;line-height:16px;background:rgba(196,125,142,.14)}
.of-tb.bad{color:var(--of-bad)}
.of-tb.bad .of-n{background:color-mix(in srgb,var(--of-bad) 14%,transparent)}
.of-chev{transition:transform .15s}
.of-tb[aria-expanded="true"] .of-chev{transform:rotate(180deg)}
.of-pop{position:absolute;z-index:5;width:min(240px,calc(100% - 20px));padding:4px;border:1px solid var(--of-line);border-radius:12px;background:var(--t-card-bg);box-shadow:0 12px 30px rgba(0,0,0,.18)}
.of-pop.saved{inset-inline-end:10px;top:30px}
.of-pop.fmts{inset-inline-start:10px;top:calc(100% + 6px)}
.of-ph{padding:5px 8px 4px;font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--of-mut)}
.of-pi{display:flex;align-items:center;gap:4px;min-height:32px;border-radius:8px}
.of-pi.pin{background:rgba(196,125,142,.1)}
.of-pi-pick{flex:1;min-width:0;height:32px;padding:0 8px;border:0;border-radius:8px;background:transparent;text-align:start;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500;color:var(--of-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
.of-pi-pick:hover{background:color-mix(in srgb,var(--of-ink) 5%,transparent)}
.of-pi.pin .of-pi-pick{color:var(--t-accent-ink)}
.of-pi-star{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;border:0;border-radius:7px;background:transparent;color:var(--of-mut);cursor:pointer}
.of-pi.pin .of-pi-star{color:var(--t-accent-ink)}
.of-ex{display:block;padding:6px 8px;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500;color:var(--of-ink);overflow-wrap:anywhere}
.of-pg{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:3px;padding:5px 4px 2px;border-top:1px solid var(--of-line);font-size:11px;color:var(--of-mut)}
.of-pg button{width:26px;height:24px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:7px;background:color-mix(in srgb,var(--of-ink) 6%,transparent);color:var(--of-ink);cursor:pointer}
.of-pg button:disabled{opacity:.35;cursor:default}
.of-track{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:3px;margin-top:8px;padding:3px;border-radius:10px;background:var(--of-track)}
.of-track button{height:26px;min-width:0;border:0;border-radius:7px;background:transparent;font-family:'JetBrains Mono',monospace;font-size:11.5px;font-weight:600;color:var(--of-mut);cursor:pointer}
.of-track button.on{color:var(--t-accent-ink);background:var(--t-card-bg);box-shadow:0 1px 2px rgba(0,0,0,.1),inset 0 0 0 1px color-mix(in srgb,var(--t-accent) 45%,transparent)}
.of-track button:disabled{opacity:.5;cursor:default}
.of-opt{display:flex;flex-wrap:wrap;gap:5px;margin-top:4px}
.of-opt button{flex:1;min-width:60px;height:32px;border:1px solid var(--of-line);border-radius:8px;background:var(--t-card-bg);font:inherit;font-size:12.5px;font-weight:600;color:var(--of-mut);cursor:pointer}
.of-opt button.on{color:var(--t-accent-ink);border-color:color-mix(in srgb,var(--t-accent) 60%,transparent);background:rgba(196,125,142,.12);box-shadow:1.5px 1.5px 0 var(--of-print)}
`;
const CHEV = <svg className="of-chev" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>;

/** Five round numbers between min and max, for the quantity presets. */
function presetsFor(min, max) {
  const nice = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
  const pool = nice.filter(v => v >= min && v <= max);
  if (!pool.length || pool[0] !== min) pool.unshift(min);
  if (pool[pool.length - 1] !== max) pool.push(max);
  if (pool.length <= 5) return pool;
  const step = (pool.length - 1) / 4;
  return [0, 1, 2, 3, 4].map(i => pool[Math.round(i * step)]);
}

export function OrderForm({ selSvc, selTier, platform, qty, setQty, link, setLink, dark, t, onClose, inline, onSubmit, orderLoading, comments, setComments, loyaltyDiscount = 0, activePromotion = null, balance = null, onTopUp, welcomeBonusEligible, pointsRedeemable = false, pointsBalance = 0, redeemPoints = false, setRedeemPoints, trafficConfig, setTrafficConfig, tierStyles = {}, socialLinks = {}, fullList = null, onVote, onBackToPicks, assumeFunded = false, glyph = null, unit = "" }) {
  const tr = useT();
  const money = useMoney();
  const minQty = selTier?.min || 100;
  const maxQty = selTier?.max || 50000;
  const isPackage = minQty === maxQty;
  useEffect(() => { if (isPackage && String(qty) !== String(minQty)) setQty(String(minQty)); }, [isPackage, minQty]);
  const qtyNum = Number(qty) || 0;
  const qtyOutOfRange = qty !== "" && qtyNum > 0 && (qtyNum < minQty || qtyNum > maxQty);
  const {
    basePrice,
    discountAmount,
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
  const toast = useToast();
  const [linkError, setLinkError] = useState("");
  const [linkHelpOpen, setLinkHelpOpen] = useState(false);
  const [dripOn, setDripOn] = useState(false);
  const [dripStep, setDripStep] = useState(1);
  const [dripDays, setDripDays] = useState(3);
  const [discordOpen, setDiscordOpen] = useState(true);
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
  const isCustomComment = selTier?.customComments || apiType.includes("custom comment") || apiType.includes("comment replies");
  const isMention = apiType.includes("mention");
  const isPoll = apiType === "poll";
  const isSeo = apiType === "seo";
  const isReview = svcName.includes("review") && !svcName.includes("review like");
  const needsComments = isCustomComment || isReview;
  const showComments = isCustomComment || isReview;
  const needsUsernames = isMention;
  const needsAnswer = isPoll;
  const needsKeywords = isSeo;
  const showTraffic = !!(selTier?.trafficTargeting && platform === "webtraffic" && setTrafficConfig);

  useEffect(() => {
    if (showTraffic && !trafficConfig) {
      setTrafficConfig({ country: '', device: 'all', trafficType: 'keyword', keyword: '', referrer: '' });
    } else if (!showTraffic && trafficConfig) {
      setTrafficConfig(null);
    }
  }, [showTraffic]);

  const trafficValid = !showTraffic || (
    trafficConfig &&
    trafficConfig.country.trim().length >= 2 &&
    trafficConfig.device &&
    (trafficConfig.trafficType === 'blank' ||
      (trafficConfig.trafficType === 'keyword' && trafficConfig.keyword.trim()) ||
      (trafficConfig.trafficType === 'referrer' && trafficConfig.referrer.trim()))
  );

  // Only lines with words count: providers reject emoji-only lines, so we say so here rather than after paying.
  const commentLines = (comments || "").split("\n").filter(l => /[\p{L}\p{N}]/u.test(l)).length;
  const minCommentLines = isCustomComment ? Math.max(selTier?.min || 10, 10) : 0;
  const commentShort = needsComments && commentLines > 0 && commentLines < minCommentLines;

  const isMultiPostSvc = /last\s+\d+\s*(tweet|post|video|reel|photo)/i.test(svcName);
  const isChannelSvc = /(channel|group)\s*(member|join|subscriber)/i.test(svcName);
  // apiType first, name only as a fallback — the same order this file already
  // uses for every other type above, and for the same reason. Reading the name
  // alone is what let the auto services through: the public label deliberately
  // strips the provider's "[Auto Likes]" tag, so `svcName` for those rows is
  // "Instagram Nigerian Likes" and /\bauto\b/ never matched. The form then
  // classified a subscription as a post service and asked for a post link,
  // which is the one input it cannot work with.
  const isAutoSvc = apiType === "subscriptions" || /\bauto\b/i.test(svcName);
  // Twitch/Kick live viewers watch the CHANNEL page — the profile link is the
  // right link, matching the server rule in order-create-input.server.js.
  const isLiveChannelSvc = /\blive\b/i.test(svcName) && (platform === "twitch" || platform === "kick");
  const isProfileSvc = (/follow|subscri|member|profile visit/i.test(svcName) || isMultiPostSvc || isAutoSvc || isLiveChannelSvc) && !isChannelSvc;
  const isPostSvc = /view|like|retweet|share|reposts|comment|reaction|vote|save|bookmark|impression|reach|plays|watch.?time/i.test(svcName) && !isProfileSvc && !isChannelSvc;

  const linkPlaceholder = getLinkPlaceholder(platform, svcName);
  const linkLabel = platform === "webtraffic" ? "Website URL"
    : isPoll ? "Post or poll link"
    // An auto service is pointed at an account, not a post, so the field says
    // so rather than leaving "Link" to be read as the usual post link.
    : isAutoSvc ? (platform === "telegram" || platform === "youtube" ? "Channel link" : "Profile link")
    : isChannelSvc ? "Channel link" : isProfileSvc ? "Profile link" : isPostSvc ? "Post link" : "Link";

  // Saved handles. The list is the customer's last distinct links on this
  // platform, read from their own order history — nothing new is collected.
  // The pin is a per-device preference for now (localStorage); a synced
  // preference means a column on User and is the follow-up.
  //
  // These used to sit open as a row of pills under the link box. Five links
  // long enough to be truncated wrap to three or four lines, on top of a form
  // that is already tall on a phone, and they are useful to the minority who
  // order for more than one account. So they stay behind a "Saved" button and
  // open as a small pop-over of handles, five a page — the list holds up to
  // twenty — so the form's height never depends on how many accounts someone
  // has ordered for.
  const HANDLES_PER_PAGE = 5;
  const [recentLinks, setRecentLinks] = useState([]);
  const [pinned, setPinned] = useState(null);
  const [handlesOpen, setHandlesOpen] = useState(false);
  const handlesRef = useRef(null);
  const formatsRef = useRef(null);
  /**
   * Both disclosures close when the tap lands anywhere else.
   *
   * They are inline expanders rather than overlays, so nothing was dismissing
   * them — open the saved handles, open the accepted formats, and the form kept
   * both stacked under the link box for the rest of the order. Pointerdown
   * rather than click so they are gone before whatever was tapped reacts, and
   * capture so a stopPropagation inside the form cannot swallow it.
   */
  useEffect(() => {
    if (!handlesOpen && !linkHelpOpen) return undefined;
    const onDown = (e) => {
      if (handlesOpen && !handlesRef.current?.contains(e.target)) setHandlesOpen(false);
      if (linkHelpOpen && !formatsRef.current?.contains(e.target)) setLinkHelpOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [handlesOpen, linkHelpOpen]);
  const [handlePage, setHandlePage] = useState(0);
  useEffect(() => {
    if (!platform || platform === "webtraffic") { setRecentLinks([]); setPinned(null); return undefined; }
    let dead = false;
    fetch(`/api/orders/recent-links?platform=${encodeURIComponent(platform)}`)
      .then(r => (r.ok ? r.json() : { links: [] }))
      .then(d => {
        if (dead) return;
        setRecentLinks(Array.isArray(d.links) ? d.links : []);
        // The pin arrives with the links, from the account rather than the
        // browser. It used to be read out of localStorage here, which made it
        // per-device: a handle pinned on a laptop was simply absent on a phone.
        setPinned(d.pinned || null);
      })
      .catch(() => { if (!dead) setPinned(null); });
    setPinned(null);
    // A different platform is a different list, so it opens closed on page one
    // rather than on page three of the last platform's handles.
    setHandlesOpen(false);
    setHandlePage(0);
    return () => { dead = true; };
  }, [platform]);
  // A pinned handle fills an EMPTY box and never overwrites what was typed.
  useEffect(() => { if (pinned && !link) validateLink(pinned); }, [pinned]);
  const togglePin = (url) => {
    const next = pinned === url ? null : url;
    setPinned(next);
    // Optimistic: the star flips immediately and the write follows. A failed
    // write leaves the old pin on the server, which the next visit corrects —
    // better than a star that hesitates on every tap.
    fetch("/api/orders/recent-links", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, link: next }),
    }).catch(() => {});
  };
  // The handle alone — "nitro.ng", "@kemi", "p/ABC123" — the address minus its site.
  const handleOf = (url) => { const x = String(url).replace(/^https?:\/\/(www\.|m\.)?/, "").replace(/\/$/, ""); const i = x.indexOf("/"); return i > 0 && i < x.length - 1 ? x.slice(i + 1) : x; };
  const shortLink = (url) => { const s = String(url).replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""); return s.length > 34 ? s.slice(0, 33) + "…" : s; };

  const ofVars = {
    "--of-line": t.cardBorder, "--of-ink": t.text, "--of-mut": t.textMuted,
    "--of-field": dark ? "rgba(255,255,255,.035)" : "#faf8f8",
    "--of-bad": dark ? "#f87171" : "#dc2626", "--of-ok": dark ? "#34d399" : "#047857", "--of-warn": dark ? "#fcd34d" : "#b45309",
    "--of-print": dark ? "#6b3a4a" : "#efc4cf", "--of-track": dark ? "#130d1e" : "#f1edee",
  };
  return (
    <div className="relative" style={ofVars}>
      <style>{OF_CSS}</style>
      {!inline && (
      <div className="flex items-center gap-[11px] px-3.5 pt-4 pb-3">
        <div className="md:hidden absolute left-1/2 -translate-x-1/2 top-2 w-[38px] h-1 rounded-sm" style={{ background: "rgba(127,127,127,.35)" }} />
        {glyph && <ServiceGlyph type={glyph} tone={t.accentInk} dark={dark} size={36} radius={11} print />}
        <div className="flex flex-col gap-[3px] min-w-0 flex-1">
          <div className="text-[15px] font-bold truncate" style={{ color: t.text }}>{selSvc?.name}</div>
          {/* What was picked, said in one line. Each fact carries its own icon,
              so they need no separator between them. Refill follows the tier
              model — Budget none, Standard 30 days, Premium for life — the same
              promise the tier explainer makes. */}
          {s && (
            <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[11.5px]" style={{ color: t.textMuted }}>
              <span className="inline-flex items-center gap-1 font-bold" style={{ color: dark ? s.textD : s.text }}>{s.label}{selTier.tier}</span>
              <span className="inline-flex items-center gap-1 font-semibold">
                <OffsetIcon name="refresh" size={12} />
                {selTier.tier === "Budget" ? tr("No refill") : selTier.tier === "Standard" ? tr("30-day refill") : tr("Lifetime refill")}
              </span>
            </div>
          )}
          {/* A full-list order has no tier to show. What it has instead is the
              public service number the row showed — the one thing a customer
              can quote back to us — and whose refill this is. */}
          {fullList && (
            <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[11.5px]" style={{ color: t.textMuted }}>
              <span className="inline-flex items-center gap-1 font-bold" style={{ color: t.textSoft }}>{tr("Full list")}<span className="m opacity-80">#{fullList.id}</span></span>
              <span className="inline-flex items-center gap-1 font-semibold" style={fullList.refill ? { color: dark ? "#6ee7b7" : "#059669" } : undefined}>
                <OffsetIcon name="refresh" size={12} />
                {fullList.refill ? tr("Refill included") : tr("No refill")}
              </span>
            </div>
          )}
        </div>
        {onClose && <button onClick={onClose} aria-label={tr("Close")} className="nitro-x self-start"><OffsetIcon name="close" size={13} /></button>}
      </div>
      )}

      {/* ── Full list: the terms, and the way back to a tested pick ── */}
      {fullList && (
        <>
          <div className="mx-3.5 mt-3 rounded-lg py-2 px-3 flex items-center gap-2 flex-wrap" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)", border: `1px solid ${t.cardBorder}` }}>
            <span className="text-[11px] leading-[1.5] flex-1 min-w-0" style={{ color: dark ? "#a09890" : "#6e6a65" }}>{tr("Sold as listed — the terms shown are the terms you get.")}</span>
            {onBackToPicks && <button type="button" onClick={onBackToPicks} className="text-[11px] font-bold cursor-pointer border-none bg-transparent font-[inherit] shrink-0 inline-flex items-center gap-1" style={{ color: t.accentInk }}>{tr("Use Nitro's pick instead")}<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="dir-flip"><polyline points="9 18 15 12 9 6"/></svg></button>}
          </div>
          <FullListRate fullList={fullList} onVote={onVote} onNeedOrder={() => toast.info(tr("Order it first"), tr("Rating is for people who have actually used the service."))} dark={dark} t={t} />
        </>
      )}

      {/* ── Package note (verified comments etc.) ── */}
      {selTier && isPackage && selSvc?.type === "verified-comments" && (
        <div className="mx-3.5 mt-3 rounded-lg py-2 px-3 flex items-start gap-2" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.05)", border: `1px solid ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)"}` }}>
          <OffsetIcon name="info" size={13} color={dark ? "#d4949f" : "#a0616e"} className="shrink-0 mt-px" />
          <div className="text-[11px] leading-[1.5]" style={{ color: dark ? "#a09890" : "#6e6a65" }}>
            {selTier.tier === "Budget" && "Delivers 1 comment from smaller verified profiles."}
            {selTier.tier === "Standard" && "Delivers 3 comments from mid-tier verified accounts."}
            {selTier.tier === "Premium" && "Delivers 5 comments from top-tier, high-follower verified accounts."}
          </div>
        </div>
      )}

      {/* ── Growth Package bundle breakdown ── */}
      {selTier && isPackage && svcName.includes("growth package") && (
        <div className="mx-3.5 mt-3 rounded-lg py-2.5 px-3" style={{ background: dark ? "rgba(59,130,246,.06)" : "rgba(59,130,246,.04)", border: `1px solid ${dark ? "rgba(59,130,246,.15)" : "rgba(59,130,246,.1)"}` }}>
          <div className="flex items-start gap-2 mb-2">
            <OffsetIcon name="wallet" size={13} color={dark ? "#60a5fa" : "#2563eb"} className="shrink-0 mt-px" />
            <div className="text-[11px] leading-[1.6] font-semibold" style={{ color: dark ? "#60a5fa" : "#2563eb" }}>
              {selTier.tier === "Budget" && "1,000 Followers + 200 Likes + 200 Shares"}
              {selTier.tier === "Standard" && "5,000 Followers + 1,000 Likes + 1,000 Shares"}
              {selTier.tier === "Premium" && "10,000 Followers + 2,000 Likes + 2,000 Shares"}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <OffsetIcon name="alert" size={12} color={dark ? "#fbbf24" : "#d97706"} className="shrink-0 mt-px" />
            <div className="text-[11px] leading-[1.5]" style={{ color: dark ? "#fbbf24" : "#92400e" }}>{tr("Likes and shares will be delivered to your most recent post.")}</div>
          </div>
        </div>
      )}

      {/* ── Discord setup instructions ── */}
      {selTier && platform === "discord" && (selSvc?.type === "followers" || selSvc?.type === "engagement") && (() => {
        // Admin-editable: the bot changes without warning and used to require a
        // code change, which meant customers followed a dead link until someone
        // noticed. Settings → Discord bot links; Premium tiers run on a
        // different provider bot than Standard.
        const botUrl = (selTier?.tier === "Premium" && socialLinks?.discord_bot_url_premium)
          || socialLinks?.discord_bot_url || "https://nowon.tools";
        return (
          <div className="mx-3.5 mt-3 rounded-lg overflow-hidden" style={{ border: `1px solid ${dark ? "rgba(88,101,242,.25)" : "rgba(88,101,242,.18)"}`, background: dark ? "rgba(88,101,242,.06)" : "rgba(88,101,242,.04)" }}>
            <button type="button" onClick={() => setDiscordOpen(o => !o)} className="w-full flex items-center justify-between gap-2 py-2.5 px-3 border-0 cursor-pointer" style={{ background: "transparent", color: dark ? "#818cf8" : "#5865F2" }}>
              <div className="flex items-center gap-2">
                <OffsetIcon name="alert" size={14} className="shrink-0" />
                <span className="text-[11px] font-semibold">{tr("Required setup before ordering")}</span>
              </div>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ transform: discordOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {discordOpen && (
              <div className="px-3 pb-3">
                <ol className="m-0 pl-5 text-[11px] leading-[1.7] flex flex-col gap-1" style={{ color: dark ? "#a5b4fc" : "#4338ca" }}>
                  <li><a href={botUrl} target="_blank" rel="noopener noreferrer" style={{ color: dark ? "#c7d2fe" : "#4338ca", fontWeight: 600, textDecoration: "underline" }}>{tr("Add the bot to your server")}</a></li>
                  <li><Emph color="inherit">{tr("Set verification level to *None* or *Low*")}</Emph> <span style={{ color: dark ? "rgba(165,180,252,.6)" : "rgba(67,56,202,.55)" }}>{tr("(Server Settings → Safety Setup)")}</span></li>
                  <li>{tr("Disable any anti-raid bots")}</li>
                  <li style={{ color: dark ? "#fca5a5" : "#dc2626" }}>{tr("Don't ban or kick members while the order is running")}</li>
                  <li><Emph color="inherit">{tr("Use a *permanent* invite link (set to never expire)")}</Emph></li>
                </ol>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Form fields ── */}
      <div className={inline ? "p-3.5 pt-3" : "px-3.5 pt-1 pb-3.5"}>
      {selTier && <>
        {dripStep === 1 ? (<>
        <div className="mb-2.5" data-tour="no-link-input">
          {(() => {
            const isCommentLike = svcName.includes("comment like") || svcName.includes("likes (comments)");
            const kind = isCommentLike ? "commentLike" : isChannelSvc ? "channel" : isProfileSvc ? "profile" : "post";
            const examples = LINK_EXAMPLES[platform] && (isProfileSvc || isPostSvc || isChannelSvc)
              ? (LINK_EXAMPLES[platform][kind] || LINK_EXAMPLES[platform].profile || []) : [];
            const ordered = pinned
              ? [...recentLinks.filter(r => r.link === pinned), ...recentLinks.filter(r => r.link !== pinned)]
              : recentLinks;
            const pages = Math.max(1, Math.ceil(ordered.length / HANDLES_PER_PAGE));
            const page = Math.min(handlePage, pages - 1);
            const shown = ordered.slice(page * HANDLES_PER_PAGE, (page + 1) * HANDLES_PER_PAGE);
            const showSaved = recentLinks.length > 0 && !orderLoading;
            return (
              <div className={`of-f${linkError ? " err" : handlesOpen || linkHelpOpen ? " open" : ""}`}>
                <div className="of-lr">
                  <label htmlFor="of-link">{tr(linkLabel)}</label>
                  {/* Saved handles stay out of sight until asked for. */}
                  {showSaved && (
                    <span ref={handlesRef} className="of-end">
                      <button type="button" className="of-tb" onClick={() => { setHandlesOpen(o => !o); setLinkHelpOpen(false); }} aria-expanded={handlesOpen}>
                        <OffsetIcon name="bookmark" size={12} />{tr("Saved")}{CHEV}
                      </button>
                      {handlesOpen && (
                        <div className="of-pop saved" role="group" aria-label={tr("Saved handles")}>
                          <div className="of-ph">{tr("Recent links")}</div>
                          {shown.map(r => {
                            const isPin = pinned === r.link;
                            return (
                              <div key={r.link} className={`of-pi${isPin ? " pin" : ""}`}>
                                <button type="button" onClick={() => { validateLink(r.link); setHandlesOpen(false); }} className="of-pi-pick" title={shortLink(r.link)}>{handleOf(r.link)}</button>
                                <button type="button" onClick={() => togglePin(r.link)} aria-pressed={isPin} aria-label={isPin ? tr("Unpin") : tr("Pin as default")} title={isPin ? tr("Unpin") : tr("Pin as default")} className="of-pi-star"><OffsetIcon name="star" size={14} className={isPin ? "ic-on" : undefined} /></button>
                              </div>
                            );
                          })}
                          {pages > 1 && (
                            <div className="of-pg">
                              <button type="button" onClick={() => setHandlePage(page - 1)} disabled={page === 0} aria-label={tr("Previous")}><svg className="dir-flip" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg></button>
                              <span className="m">{page + 1} {tr("of")} {pages}</span>
                              <button type="button" onClick={() => setHandlePage(page + 1)} disabled={page >= pages - 1} aria-label={tr("Next")}><svg className="dir-flip" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg></button>
                            </div>
                          )}
                        </div>
                      )}
                    </span>
                  )}
                </div>
                <div className="of-ir">
                  <span className="of-pre">https://</span>
                  <input id="of-link" type="url" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={orderLoading} placeholder={linkPlaceholder} value={link} onChange={e => validateLink(e.target.value)} className="of-in" />
                  {linkValid && <span className="of-tick"><OffsetIcon name="checkCircle" size={16} /></span>}
                </div>
                {linkError && <div className="of-note bad" role="alert"><OffsetIcon name="alert" size={13} /><span>{tr(linkError)}</span></div>}
                {/* Said once, where the wrong link would otherwise be typed.
                    Two customers ordered these against a reel and the
                    dispatcher read "reel" out of the URL as the account name,
                    so the order could never have delivered. */}
                {isAutoSvc && !linkError && <div className="of-note warn"><OffsetIcon name="info" size={13} /><span>{tr("This is an auto service: it delivers to the posts you make from now on, so give it your account link, not a link to one post.")}</span></div>}
                {(examples.length > 0 || (platform !== "webtraffic" && !linkError)) && (
                  <div className="of-line">
                    {/* The formats this link may take, behind their own button
                        since a link can take several. It turns red beside a
                        wrong link, which is when it is wanted. */}
                    {examples.length > 0 && (
                      <span ref={formatsRef}>
                        <button type="button" className={`of-tb${linkError ? " bad" : ""}`} onClick={() => { setLinkHelpOpen(o => !o); setHandlesOpen(false); }} aria-expanded={linkHelpOpen}>
                          <OffsetIcon name="help" size={12} />{tr("Accepted formats")}<span className="of-n">{examples.length}</span>{CHEV}
                        </button>
                        {linkHelpOpen && (
                          <div className="of-pop fmts" role="group" aria-label={tr("Accepted formats")}>
                            {examples.map(ex => <span key={ex} className="of-ex">{ex}</span>)}
                          </div>
                        )}
                      </span>
                    )}
                    {platform !== "webtraffic" && !linkError && <span className="of-pub"><OffsetIcon name="lock" size={12} />{tr("Public profiles only")}</span>}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        {showTraffic && trafficConfig && (
          <div className="mb-3.5 rounded-xl p-3.5" style={{ background: dark ? "rgba(99,153,255,.06)" : "rgba(59,130,246,.04)", border: `1px solid ${dark ? "rgba(99,153,255,.15)" : "rgba(59,130,246,.1)"}` }}>
            <div className="flex items-center gap-2 mb-3">
              <OffsetIcon name="globe" size={14} color={dark ? "#60a5fa" : "#2563eb"} />
              <span className="text-[11px] font-semibold" style={{ color: dark ? "#60a5fa" : "#2563eb" }}>{tr("Traffic Targeting")}</span>
            </div>
            <div className="mb-2.5">
              <label className="text-[11px] tracking-[0.5px] uppercase font-semibold block mb-[5px]" style={{ color: t.textMuted }}>{tr("Country")} <span className="font-normal normal-case tracking-normal">{tr("(where the visitors come from)")}</span></label>
              <select disabled={orderLoading} value={trafficConfig.country} onChange={e => setTrafficConfig(c => ({ ...c, country: e.target.value }))} className="w-full py-2 px-3 rounded-lg border border-solid text-[13px] outline-none box-border font-[inherit] disabled:opacity-50 cursor-pointer" style={{ borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.19)", background: dark ? "#160f22" : "#fff", color: t.text }}>
                <option value="">{tr("Choose a target…")}</option>
                <option value="WW">{tr("Worldwide")}</option>
                <optgroup label={tr("Continent")}>
                  {Object.entries(TRAFFIC_CONTINENTS).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </optgroup>
                <optgroup label={tr("Country")}>
                  {Object.entries(TRAFFIC_COUNTRIES).filter(([code]) => code !== "WW").map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="mb-2.5">
              <label className="text-[11px] tracking-[0.5px] uppercase font-semibold block mb-[5px]" style={{ color: t.textMuted }}>{tr("Device")}</label>
              <div className="flex flex-wrap gap-1.5">
                {TRAFFIC_DEVICES.map(d => (
                  <button key={d.value} type="button" disabled={orderLoading} onClick={() => setTrafficConfig(c => ({ ...c, device: d.value }))} className="py-[6px] px-2.5 rounded-lg text-[11px] font-medium cursor-pointer border border-solid disabled:opacity-40 transition-colors duration-150" style={{ borderColor: trafficConfig.device === d.value ? (dark ? "#60a5fa" : "#2563eb") : (dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.12)"), background: trafficConfig.device === d.value ? (dark ? "rgba(99,153,255,.15)" : "rgba(59,130,246,.08)") : "transparent", color: trafficConfig.device === d.value ? (dark ? "#93bbfd" : "#1d4ed8") : t.textMuted }}>{tr(d.label)}</button>
                ))}
              </div>
            </div>
            <div className="mb-2.5">
              <label className="text-[11px] tracking-[0.5px] uppercase font-semibold block mb-[5px]" style={{ color: t.textMuted }}>{tr("Type of Traffic")}</label>
              <div className="flex gap-1.5">
                {TRAFFIC_TYPES.map(tt => (
                  <button key={tt.value} type="button" disabled={orderLoading} onClick={() => setTrafficConfig(c => ({ ...c, trafficType: tt.value, keyword: tt.value === 'keyword' ? c.keyword : '', referrer: tt.value === 'referrer' ? c.referrer : '' }))} className="flex-1 py-[7px] px-2 rounded-lg text-[11px] font-medium cursor-pointer border border-solid disabled:opacity-40 transition-colors duration-150" style={{ borderColor: trafficConfig.trafficType === tt.value ? (dark ? "#60a5fa" : "#2563eb") : (dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.12)"), background: trafficConfig.trafficType === tt.value ? (dark ? "rgba(99,153,255,.15)" : "rgba(59,130,246,.08)") : "transparent", color: trafficConfig.trafficType === tt.value ? (dark ? "#93bbfd" : "#1d4ed8") : t.textMuted }}>{tr(tt.label)}</button>
                ))}
              </div>
            </div>
            {trafficConfig.trafficType === 'keyword' && (
              <div>
                <label className="text-[11px] tracking-[0.5px] uppercase font-semibold block mb-[5px]" style={{ color: t.textMuted }}>{tr("Google Keyword")}</label>
                <input type="text" disabled={orderLoading} placeholder={tr("best smm panel nigeria")} value={trafficConfig.keyword} onChange={e => setTrafficConfig(c => ({ ...c, keyword: e.target.value }))} className="w-full py-2 px-3 rounded-lg border border-solid text-[13px] outline-none box-border font-[inherit] disabled:opacity-50" style={{ borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.19)", background: dark ? "#160f22" : "#fff", color: t.text }} />
                <div className="text-[11px] mt-1" style={{ color: t.textMuted }}>{tr("Max 5 keywords, separated by commas")}</div>
              </div>
            )}
            {trafficConfig.trafficType === 'referrer' && (
              <div>
                <label className="text-[11px] tracking-[0.5px] uppercase font-semibold block mb-[5px]" style={{ color: t.textMuted }}>{tr("Referrer URL")}</label>
                <input type="url" disabled={orderLoading} placeholder="https://instagram.com" value={trafficConfig.referrer} onChange={e => setTrafficConfig(c => ({ ...c, referrer: e.target.value }))} className="w-full py-2 px-3 rounded-lg border border-solid text-[13px] outline-none box-border font-[inherit] disabled:opacity-50" style={{ borderColor: dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.19)", background: dark ? "#160f22" : "#fff", color: t.text }} />
              </div>
            )}
          </div>
        )}
        {showComments && (() => {
          const what = isReview ? "reviews" : "comments";
          const rotate = isCustomComment && commentLines > 0 && qtyNum > commentLines && !commentShort;
          return (
            <div className={`of-f mb-2${commentShort ? " err" : ""}`}>
              <div className="of-lr">
                <label htmlFor="of-lines">{isReview ? tr("Reviews") : tr("Comments")}, {needsComments ? tr("one per line") : tr("optional, one per line")}</label>
                {needsComments && <span className="of-meta m">{commentLines} / {minCommentLines}</span>}
              </div>
              <textarea id="of-lines" disabled={orderLoading} placeholder={isReview ? "Great service, highly recommend!\nFast delivery and excellent quality\nBest experience I've had, 5 stars" : "Great content!\nLove this post!\nAmazing work, keep it up\nThis is fire"} value={comments || ""} onChange={e => setComments(e.target.value)} rows={3} className="of-in" />
              {(commentShort || rotate || (!needsComments && commentLines === 0)) && (
                <div className={`of-note${commentShort ? " bad" : rotate ? " warn" : ""}`}>
                  <OffsetIcon name={commentShort ? "alert" : "info"} size={13} />
                  <span>{commentShort ? `Need at least ${minCommentLines} unique ${what}, you have ${commentLines}` : rotate ? `${commentLines} unique ${what} will rotate to fill ${qtyNum}` : "Leave empty to use provider's comments"}</span>
                </div>
              )}
            </div>
          );
        })()}
        {needsUsernames && (
          <div className="of-f mb-2">
            <div className="of-lr"><label htmlFor="of-users">{tr("Usernames to mention")}</label><span className="of-meta">{(comments || "").split("\n").filter(l => l.trim()).length} {tr("usernames entered")}</span></div>
            <textarea id="of-users" disabled={orderLoading} placeholder={"username1\nusername2\nusername3"} value={comments || ""} onChange={e => setComments(e.target.value)} rows={3} className="of-in" />
            <div className="of-note"><OffsetIcon name="info" size={13} /><span>{tr("(one per line, without @)")}</span></div>
          </div>
        )}
        {needsAnswer && (
          <div className="of-f mb-2">
            <div className="of-lr">{tr("Answer option")}<span className="of-meta">{tr("Select which poll answer to vote for")}</span></div>
            <div className="of-opt">
              {[1, 2, 3, 4].map(n => (
                <button key={n} type="button" disabled={orderLoading} onClick={() => setComments(String(n))} aria-pressed={(comments || "") === String(n)} className={(comments || "") === String(n) ? "on" : ""}>{tr("Option")} {n}</button>
              ))}
            </div>
          </div>
        )}
        {needsKeywords && (
          <div className="of-f mb-2">
            <div className="of-lr"><label htmlFor="of-keys">{tr("Search Keywords")}</label><span className="of-meta">{(comments || "").split("\n").filter(l => l.trim()).length || 0} {tr("keywords entered")}</span></div>
            <textarea id="of-keys" disabled={orderLoading} placeholder={"best nigerian services\nnigeria social media growth\nbuy instagram followers nigeria"} value={comments || ""} onChange={e => setComments(e.target.value)} rows={3} className="of-in" />
            <div className="of-note"><OffsetIcon name="info" size={13} /><span>{tr("(required, one per line)")}</span></div>
          </div>
        )}
        <div className={`of-f mb-2${qtyOutOfRange ? " err" : ""}`}>
          <div className="of-lr">
            <label htmlFor="of-qty">{tr("How many")}</label>
            {/* The range, and the problem with it, said in the box's own label. */}
            {!isPackage && <span className="of-meta">{qtyOutOfRange ? (qtyNum < minQty ? `${tr("Minimum is")} ${formatOrderQuantity(minQty)}` : `${tr("Maximum is")} ${formatOrderQuantity(maxQty)}`) : `${formatOrderQuantity(minQty)} ${tr("to")} ${formatOrderQuantity(maxQty)}`}</span>}
          </div>
          <div className="of-ir">
            <input id="of-qty" type="text" inputMode="numeric" autoComplete="off" aria-label={tr("Quantity")} disabled={orderLoading || isPackage} value={qty === "" ? "" : qtyNum.toLocaleString("en-NG")} onChange={e => { const d = e.target.value.replace(/\D/g, "").slice(0, 10); setQty(d === "" ? "" : d); }} className="of-in big" />
            {isPackage && <span className="of-unit">{tr("fixed")}</span>}
          </div>
          {!isPackage && (
            <div className="of-track">
              {presetsFor(minQty, maxQty).map(v => (
                <button key={v} type="button" disabled={orderLoading} onClick={() => setQty(String(v))} aria-pressed={qtyNum === v} className={qtyNum === v ? "on" : ""}>{formatOrderQuantity(v)}</button>
              ))}
            </div>
          )}
        </div>
          {(showMultiDay || (pointsRedeemable && priceBeforePoints > 0)) && (
          <div className="rounded-xl mb-2 border-[1.5px] border-solid overflow-hidden" style={{ borderColor: t.cardBorder, background: dark ? "rgba(255,255,255,.035)" : "#faf8f8" }}>
            {showMultiDay && (
            <div className="flex items-center gap-[10px] py-2.5 px-3 cursor-pointer select-none" onClick={() => setDripOn(!dripOn)}>
              <div className="relative w-10 h-[22px] shrink-0" aria-hidden="true">
                <div className="absolute inset-0 rounded-[11px] transition-colors duration-200" style={{ background: dripOn ? t.accent : (dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.15)") }} />
                <div className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-[left] duration-200" style={{ left: dripOn ? 20 : 2 }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold" style={{ color: t.text }}>{tr("Gradual delivery")}</div>
                <div className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>{dripOn ? tr("Spread across days, looks natural") : tr("Large delivery may flag the target account")}</div>
              </div>
            </div>
            )}
            {pointsRedeemable && priceBeforePoints > 0 && (
            <div className="flex items-center gap-[10px] py-2.5 px-3 cursor-pointer select-none" onClick={() => setRedeemPoints(!redeemPoints)} style={showMultiDay ? { borderTop: `1px solid ${t.cardBorder}` } : undefined}>
              <div className="relative w-10 h-[22px] shrink-0" aria-hidden="true">
                <div className="absolute inset-0 rounded-[11px] transition-colors duration-200" style={{ background: redeemPoints ? t.accent : (dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.15)") }} />
                <div className="absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-[left] duration-200" style={{ left: redeemPoints ? 20 : 2 }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold" style={{ color: t.text }}>Use Nitro Points</div>
                <div className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>{pointsBalance.toLocaleString()} {tr("points available, saves")} {money(Math.min(pointsBalance, priceBeforePoints), { round: "down" })}</div>
              </div>
            </div>
            )}
          </div>
          )}
        {(() => {
          // During the tour, the form behaves as though the wallet covers it.
          //
          // Trip's call, and the right one: the tour is a demonstration, not a
          // live order. A new customer has ₦0 by definition, so without this
          // nearly everybody taking the tour is shown a Top up button on the
          // step that exists to teach placing an order — the walkthrough ends
          // by demonstrating the wrong thing.
          //
          // Safe because the tour's overlay (fixed inset-0, z-210, no
          // pointer-events:none) sits above this modal and swallows every
          // click, so the button it shows cannot be pressed while the tour is
          // up. It is a picture of the finished flow, not an offer.
          const short = !assumeFunded && balance != null && qtyNum > 0 && price > balance;
          const hasCut = discountAmount > 0 || cappedPromoDiscount > 0 || pointsDiscount > 0;
          return (<>
          {short && welcomeBonusEligible && (
            <div className="rounded-xl p-3.5" style={{ background: dark ? "rgba(110,231,183,.06)" : "rgba(5,150,105,.04)", border: `1px solid ${dark ? "rgba(110,231,183,.18)" : "rgba(5,150,105,.12)"}` }}>
              <div className="text-[13px] font-semibold mb-1" style={{ color: t.text }}>{tr("Almost there — add funds to place this order")}</div>
              <div className="text-[11px] mb-2.5" style={{ color: t.textMuted }}>{tr("Your first deposit gets up to")} {money(MAX_BONUS_NAIRA, { round: "down" })} {tr("free to spend.")}</div>
              {(() => {
                const needed = price - balance;
                const tier = BONUS_PRESETS.find(p => p.amount >= needed) || BONUS_PRESETS[BONUS_PRESETS.length - 1];
                const bonus = bonusForNaira(tier.amount);
                return (
                  <div className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg mb-3 text-[11px] font-semibold" style={{ background: dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.07)", color: dark ? "#6ee7b7" : "#059669" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                    {tr("Deposit")} {money(tier.amount)} <span className="dir-flip">→</span> {money(tier.amount + bonus, { round: "down" })} {tr("to spend")}
                  </div>
                );
              })()}
              <button onClick={onTopUp} className="nitro-money-btn w-full py-2.5 border-none text-[13px] font-semibold cursor-pointer">{tr("Add funds & claim bonus")}</button>
            </div>
          )}
          {/* The public-profile rule moved into the link box's footnote. */}
          <div className="sticky bottom-0 z-[2] -mx-3.5 -mb-3.5 mt-3 flex items-center gap-3 px-3.5 pt-[11px] pb-3.5 border-t border-solid" style={{ borderColor: t.cardBorder, background: dark ? "#160f22" : "#fff" }}>
            <div className="flex flex-col flex-1 min-w-0 leading-tight gap-px">
              <span className="flex items-baseline gap-[7px]">
                {hasCut && <span className="m text-[12px] line-through" style={{ color: t.textMuted }}>{money(basePrice)}</span>}
                <span className="m text-[20px] font-bold" style={{ color: t.text }}>{money(price)}</span>
              </span>
              {discountAmount > 0 && <span className="text-[11px] font-semibold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{tr("Nitro Status saves you")} {money(discountAmount, { round: "down" })}</span>}
              {cappedPromoDiscount > 0 && <span className="text-[11px] font-semibold" style={{ color: dark ? "#f9a8d4" : "#be185d" }}>{tr("Sale saves you")} {money(cappedPromoDiscount, { round: "down" })}</span>}
              {pointsDiscount > 0 && <span className="text-[11px] font-semibold" style={{ color: dark ? "#6ee7b7" : "#059669" }}>{money(pointsDiscount, { round: "down" })} {tr("in points applied")}</span>}
              {short && <span className="text-[11px] font-semibold" style={{ color: dark ? "#fcd34d" : "#b45309" }}>{tr("Balance")} {money(balance, { round: "down" })}, {tr("short by")} {money(price - balance)}</span>}
              {!hasCut && !short && qtyNum > 0 && <span className="text-[11px] truncate" style={{ color: t.textMuted }}>{qtyNum.toLocaleString("en-NG")}{unit ? ` ${unit}` : ""}</span>}
            </div>
            {short
              ? <button onClick={onTopUp} data-tour="no-submit-btn" data-tour-mode="topup" className="nitro-money-btn shrink-0 h-[44px] px-5 border-none text-[14px] font-bold cursor-pointer font-[inherit]">{tr("Top up")}</button>
              : (() => {
                const ready = linkValid && !qtyOutOfRange && qtyNum > 0 && (!(needsComments || needsUsernames || needsAnswer || needsKeywords) || (comments || "").trim()) && !commentShort && trafficValid && !orderLoading;
                return <button onClick={() => { if (dripOn && showMultiDay) { setDripStep(2); } else { onSubmit(dripOn && showMultiDay ? clampedDays : undefined); } }} data-tour="no-submit-btn" data-tour-mode="order" disabled={!ready} className="dash-btn-primary shrink-0 h-[44px] px-5 border-none rounded-xl text-[14px] font-bold cursor-pointer font-[inherit] text-white flex items-center justify-center gap-2 disabled:cursor-not-allowed" style={{ background: t.accent, opacity: ready ? 1 : .45 }}>{orderLoading ? <span className="inline-flex items-center justify-center gap-2"><NitroLoader size={16} mono ariaHidden />{tr("Placing...")}</span> : dripOn && showMultiDay ? tr("Next") : tr("Place order")}</button>;
              })()}
          </div>
          </>);
        })()}
        </>) : (<>
          {/* Step 2: Drip config — replaces entire form body */}
          <div className="flex items-center gap-2 mb-3 cursor-pointer select-none" onClick={() => setDripStep(1)} style={{ WebkitTapHighlightColor: "transparent" }}>
            <svg className="dir-flip" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? "#a09b95" : "#555250"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            <span className="text-[13px] font-semibold" style={{ color: dark ? "#a09b95" : "#555250" }}>{tr("Delivery schedule")}</span>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl py-2.5 px-3 mb-3" style={{ background: dark ? "rgba(74,222,128,.06)" : "rgba(22,163,74,.04)", border: `1px solid ${dark ? "rgba(74,222,128,.12)" : "rgba(22,163,74,.1)"}` }}>
            <OffsetIcon name="shield" size={15} color={dark ? "#4ade80" : "#16a34a"} className="shrink-0 mt-px" />
            <div className="text-[11px] leading-[1.6]" style={{ color: dark ? "#8a8580" : "#6e6a65" }}>
              {tr("Delivered in safe batches to protect the target account.")}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-xl py-2.5 px-2 text-center" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.12)"}` }}>
              <div className="text-[11px] mb-0.5" style={{ color: t.textMuted }}>{tr("Total")}</div>
              <div className="text-[13px] font-semibold" style={{ color: t.text, fontFamily: "'JetBrains Mono', monospace" }}>{qtyNum.toLocaleString()}</div>
            </div>
            <div className="rounded-xl py-2.5 px-2 text-center" style={{ background: dripZone === "safe" ? (dark ? "rgba(74,222,128,.08)" : "rgba(22,163,74,.05)") : dripZone === "moderate" ? (dark ? "rgba(250,204,21,.08)" : "rgba(202,138,4,.05)") : (dark ? "rgba(239,68,68,.08)" : "rgba(220,38,38,.05)"), border: `1px solid ${dripZone === "safe" ? (dark ? "rgba(74,222,128,.18)" : "rgba(22,163,74,.15)") : dripZone === "moderate" ? (dark ? "rgba(250,204,21,.18)" : "rgba(202,138,4,.15)") : (dark ? "rgba(239,68,68,.18)" : "rgba(220,38,38,.15)")}` }}>
              <div className="text-[11px] mb-0.5" style={{ color: t.textMuted }}>{tr("Per day")}</div>
              <div className="text-[13px] font-semibold" style={{ color: dripZone === "safe" ? (dark ? "#4ade80" : "#16a34a") : dripZone === "moderate" ? (dark ? "#fcd34d" : "#b45309") : (dark ? "#fca5a5" : "#dc2626"), fontFamily: "'JetBrains Mono', monospace" }}>~{perDay.toLocaleString()}</div>
            </div>
            <div className="rounded-xl py-2.5 px-2 text-center" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.12)"}` }}>
              <div className="text-[11px] mb-0.5" style={{ color: t.textMuted }}>{tr("Duration")}</div>
              <div className="text-[13px] font-semibold" style={{ color: t.text, fontFamily: "'JetBrains Mono', monospace" }}>{clampedDays} days</div>
            </div>
            <div className="rounded-xl py-2.5 px-2 text-center" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.12)"}` }}>
              <div className="text-[11px] mb-0.5" style={{ color: t.textMuted }}>{tr("Completes by")}</div>
              <div className="text-[13px] font-semibold" style={{ color: t.text, fontFamily: "'JetBrains Mono', monospace" }}>{new Date(Date.now() + clampedDays * 86400000).toLocaleDateString(docDateLocale(), { day: "numeric", month: "short" })}</div>
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
            <div className="flex justify-between text-[11px] mt-1.5" style={{ color: t.textMuted }}>
              <span>{daysMin} days</span>
              <span>{daysMax} days</span>
            </div>
          </div>
          </>) : (
          <div className="flex items-center justify-center gap-1.5 mb-3 py-2 rounded-lg text-[11px]" style={{ background: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.03)", color: t.textMuted }}>
            <OffsetIcon name="clockPlain" size={12} />
            Fixed at {clampedDays} {tr("days for this order size")}
          </div>
          )}
          <div className="rounded-[10px] p-2.5 mb-3 border border-solid" style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.04)", borderColor: t.cardBorder }}>
            <div className="flex justify-between items-baseline">
              <span className="text-[13px] font-semibold" style={{ color: t.textMuted }}>{tr("Total")}</span>
              <span className="font-bold text-[18px]" style={{ color: "var(--t-accent-ink)", fontFamily: "'JetBrains Mono', monospace" }}>{money(price)}</span>
            </div>
          </div>
          <button onClick={() => onSubmit(clampedDays)} data-tour="no-submit-btn" data-tour-mode="order" disabled={orderLoading} className="w-full py-2.5 dash-btn-primary border-none bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-[15px] font-semibold cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.38)]" style={{ opacity: !orderLoading ? 1 : .5 }}>{orderLoading ? <span className="inline-flex items-center justify-center gap-2"><NitroLoader size={16} mono ariaHidden />{tr("Placing...")}</span> : "Place Order"}</button>
        </>)}
      </>}
      </div>
    </div>
  );
}
