'use client';
import { useState, useRef, useEffect } from 'react';
import { SITE } from '@/lib/site';

// Tier colours are the ones the order form uses (components/new-order.jsx), so the landing and the app agree.
const TIER_STYLE = {
  Budget:   { text: "#854F0B", textDark: "#e0a458", bg: "#fef7ed", bgDark: "#2d2210", brd: "#e8d5b8", brdDark: "#5a4020", grad: "linear-gradient(135deg,#e0a458,#b45309)" },
  Standard: { text: "#185FA5", textDark: "#60a5fa", bg: "#eef4fb", bgDark: "#0f1e30", brd: "#b8d0e8", brdDark: "#1e4070", grad: "linear-gradient(135deg,#60a5fa,#2563eb)" },
  Premium:  { text: "#534AB7", textDark: "#a78bfa", bg: "#f5eef5", bgDark: "#221535", brd: "#d4b8d4", brdDark: "#3d2060", grad: "linear-gradient(135deg,#a78bfa,#7c3aed)" },
};
const TIER_ICON = {
  Budget: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  Standard: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  Premium: <><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></>,
};
// "From" prices are Instagram followers per 1,000. Static until /api/pricing exposes per-tier prices (Claude Code: see the note in the PR).
const TIERS = [
  { name: "Budget", tfor: "For tests, views and volume", price: "₦1,559", chip: "Lowest price", pop: false, li: [["ok","Cheapest rate per 1,000"],["ok","Tested source, fast start"],["no","No refill cover"]], fine: "Best when a drop wouldn't hurt: views, tests, big cheap pushes." },
  { name: "Standard", tfor: "For everyday growth", price: "₦2,720", chip: "Most picked", pop: true, li: [["ok","Balanced speed and retention"],["ok","30-day refill cover"],["ok","Our default recommendation"]], fine: "Where most orders land. Reliable enough to build a page on." },
  { name: "Premium", tfor: "For accounts that matter", price: "₦5,675", chip: "Top quality", pop: false, li: [["ok","Highest-quality sources"],["ok","Longest refill cover"],["ok","Slowest to drop, most natural"]], fine: "For brands, artists and anyone whose numbers get looked at." },
];
const QUOTES = [
  ["I was skeptical at first, but Nitro got my content in front of the right people fast. My engagement actually went up.","Chioma A.","Fashion Brand Owner","CA","#c47d8e"],
  ["The human support is what keeps me here. I had an issue at 2AM and someone responded within minutes.","Amara O.","Content Creator","AO","#6ee7b7"],
  ["Fastest promotion platform in Nigeria. Results come through in literally seconds.","Kola D.","E-commerce Seller","KD","#fbbf24"],
];
const Check = ({ size = 14, sw = 3 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12"/></svg>;
const Star = ({ c }) => <svg width="14" height="14" viewBox="0 0 24 24" fill={c} stroke={c} strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const BF_CSS = `
.lv3-sh{display:flex;align-items:baseline;gap:18px;margin-bottom:14px}
.lv3-sh .num{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;font-weight:700;color:#c47d8e;flex-shrink:0}
.lv3-sh h2{font-size:clamp(30px,3.4vw,44px);font-weight:700;letter-spacing:-1.4px;line-height:1.08}
.lv3-sh h2 .serif{font-style:italic;font-weight:500;color:#c47d8e;letter-spacing:-.5px}
.lv3-sub{font-size:16px;line-height:1.65;max-width:560px;margin-left:30px}
.lv3-glow{position:absolute;border-radius:50%;filter:blur(110px);pointer-events:none}
.lv3-grain{position:absolute;inset:0;pointer-events:none;opacity:.05;background-image:${GRAIN}}
.lv3-dots{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(rgba(196,125,142,.26) 1px,transparent 1px);background-size:26px 26px;-webkit-mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%);mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%);opacity:.55}
.lv3-tcard{position:relative;border-radius:22px;padding:26px 26px 24px;display:flex;flex-direction:column;overflow:hidden;transition:transform .25s,box-shadow .25s}
.lv3-tcard::before{content:"";position:absolute;inset:0 0 auto 0;height:5px;background:var(--tg)}
.lv3-tcard:hover{transform:translateY(-5px);box-shadow:0 18px 50px rgba(139,74,94,.14)}
.lv3-tbtn{display:block;text-align:center;margin-top:22px;padding:14px;border-radius:999px;font-size:14.5px;font-weight:800;color:#fff;background:var(--tg);box-shadow:0 8px 22px rgba(0,0,0,.14);transition:transform .2s;text-decoration:none}
.lv3-tbtn:hover{transform:scale(1.02)}
.lv3-pcard{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:12px;font-size:12.5px;opacity:.6;transition:opacity .5s,filter .5s}
.lv3-pcard.dim{opacity:.3;filter:grayscale(1)}
.lv3-ps{font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:99px;white-space:nowrap}
.lv3-bcard{border-radius:18px;padding:20px;position:relative;transition:transform .25s,box-shadow .25s}
.lv3-bcard:hover{transform:translateY(-4px);box-shadow:0 18px 50px rgba(139,74,94,.14)}
.lv3-bento{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:14px;margin-top:30px;grid-template-areas:"feat feat video" "feat feat video" "r1 r2 stat"}
@media (max-width:1199px){.lv3-bento{grid-template-columns:1fr 1fr;grid-template-areas:"feat feat" "video stat" "r1 r2"}.lv3-sh h2{font-size:clamp(28px,4vw,36px)}}
@media (max-width:767px){.lv3-bento{grid-template-columns:1fr;grid-template-areas:"feat" "video" "r1" "r2" "stat"}.lv3-sub{margin-left:0}.lv3-sh{gap:12px}}
.lv3-veq i{width:3px;border-radius:2px;background:#fff;animation:lv3eq .9s ease-in-out infinite}
.lv3-veq i:nth-child(2){animation-delay:.2s}.lv3-veq i:nth-child(3){animation-delay:.4s}
@keyframes lv3eq{0%,100%{height:5px}50%{height:14px}}
.lv3-qdot{width:6px;height:6px;border-radius:99px;opacity:.4;padding:0;transition:.3s;border:none}
.lv3-qdot.on{opacity:1;background:#c47d8e!important;width:22px}
/* ── footer: statement, channel card, columns, ghost wordmark ── */
.lv3-ft{position:relative;overflow:hidden;color:#f6ecee}
.lv3-ft-ghost{position:absolute;left:50%;bottom:-.34em;transform:translateX(-50%);font-size:290px;font-weight:800;letter-spacing:-.04em;line-height:1;color:transparent;-webkit-text-stroke:1px rgba(246,217,222,.09);pointer-events:none;user-select:none;white-space:nowrap}
.lv3-ft-in{position:relative;z-index:2;max-width:1200px;margin:0 auto;padding:0 60px}
.lv3-ft-head{display:flex;align-items:center;justify-content:space-between;gap:48px;padding:56px 0 44px;border-bottom:1px solid rgba(246,217,222,.12)}
.lv3-ft-stmt{font-size:38px;font-weight:600;letter-spacing:-.02em;line-height:1.12;max-width:15ch}
.lv3-ft-stmt em{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:600;color:#e8a0b2}
.lv3-chan{flex-shrink:0;display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid rgba(246,217,222,.14);max-width:400px;text-decoration:none;color:inherit;transition:transform .2s,border-color .2s}
.lv3-chan:hover{transform:translateY(-2px);border-color:rgba(246,217,222,.3)}
.lv3-chan-i{width:42px;height:42px;border-radius:13px;background:rgba(37,211,102,.14);border:1px solid rgba(37,211,102,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#4be284}
.lv3-chan b{display:block;font-size:14px;font-weight:700}
.lv3-chan i{display:block;font-style:normal;font-size:12px;color:rgba(246,236,238,.55);margin-top:2px;line-height:1.5}
.lv3-chan-btn{flex-shrink:0;background:#25d366;color:#06220f;font-size:12.5px;font-weight:800;padding:10px 16px;border-radius:10px;white-space:nowrap}
.lv3-ft-cols{display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr;gap:48px;padding:44px 0 52px}
.lv3-ft-brand p{font-size:13px;line-height:1.7;color:rgba(246,236,238,.5);max-width:26ch;margin:14px 0 0}
.lv3-ft-status{display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:7px 12px;border-radius:999px;background:rgba(75,226,132,.08);border:1px solid rgba(75,226,132,.22);font-size:11.5px;font-weight:700;color:#4be284;text-decoration:none}
.lv3-ft-status i{width:7px;height:7px;border-radius:50%;background:#4be284;animation:lv3pulse 2.2s ease-out infinite}
@keyframes lv3pulse{0%{box-shadow:0 0 0 0 rgba(75,226,132,.35)}80%,100%{box-shadow:0 0 0 6px rgba(75,226,132,0)}}
.lv3-ft-soc{width:36px;height:36px;border-radius:11px;background:rgba(255,255,255,.06);border:1px solid rgba(246,217,222,.16);display:flex;align-items:center;justify-content:center;color:rgba(246,236,238,.75);text-decoration:none;transition:transform .2s,color .2s}
.lv3-ft-soc:hover{transform:translateY(-2px);color:#fff}
.lv3-ft-h4{font-size:10.5px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:rgba(246,236,238,.4);margin:4px 0 16px}
.lv3-ft-l{display:block;font-size:13.5px;font-weight:500;color:rgba(246,236,238,.72);text-decoration:none;padding:5px 0;transition:color .2s;cursor:pointer;background:none;border:none;text-align:left;font-family:inherit}
.lv3-ft-l:hover{color:#fff}
.lv3-ft-base{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0 26px;border-top:1px solid rgba(246,217,222,.12);font-size:11.5px;color:rgba(246,236,238,.4)}
@media (max-width:1199px){
  .lv3-ft-in{padding:0 40px}
  .lv3-ft-head{flex-wrap:wrap;padding:46px 0 36px}
  .lv3-ft-stmt{font-size:32px}
  .lv3-ft-cols{grid-template-columns:1fr 1fr 1fr;gap:36px;padding:36px 0 44px}
  .lv3-ft-brand{grid-column:1/-1}
  .lv3-ft-ghost{font-size:190px}
}
@media (max-width:767px){
  .lv3-ft-in{padding:0 20px}
  .lv3-ft-head{flex-direction:column;align-items:stretch;gap:22px;padding:40px 0 30px}
  .lv3-ft-stmt{font-size:27px;max-width:none;text-align:center;margin:0 auto}
  .lv3-chan{max-width:none}
  .lv3-chan-btn{padding:10px 13px}
  .lv3-ft-cols{grid-template-columns:1fr 1fr;gap:28px 20px;padding:32px 0 40px}
  .lv3-ft-contact{grid-column:1/-1}
  .lv3-ft-ghost{font-size:120px;bottom:-.3em}
  .lv3-ft-base{flex-direction:column;gap:8px;text-align:center;padding-bottom:22px}
}
@media (prefers-reduced-motion:reduce){.lv3-veq i{animation:none}.lv3-ft-status i{animation:none}}
`;

export default function LandingV3BelowFold({ t, dark, setModal, siteStats, socialLinks, scrollRoot, pricingData }) {
  const wrapRef = useRef(null);
  const [qi, setQi] = useState(0);
  const [qFade, setQFade] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [vprog, setVprog] = useState(0);
  const [funnelRan, setFunnelRan] = useState(false);
  const [dimmed, setDimmed] = useState(0);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    const root = scrollRoot?.current;
    const els = wrapRef.current?.querySelectorAll("[data-reveal]:not(.revealed)");
    if (!els?.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("revealed"); if (e.target.dataset.funnel) setFunnelRan(true); io.unobserve(e.target); } });
    }, { root: root || null, threshold: 0.15 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [scrollRoot]);
  useEffect(() => { if (!funnelRan) return; const ids = [0,1,2,3].map((i) => setTimeout(() => setDimmed(i + 1), 600 + i * 350)); return () => ids.forEach(clearTimeout); }, [funnelRan]);
  useEffect(() => { const rm = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches; if (rm) return; const iv = setInterval(() => { setQFade(true); setTimeout(() => { setQi(i => (i + 1) % QUOTES.length); setQFade(false); }, 180); }, 6000); return () => clearInterval(iv); }, []);
  useEffect(() => { if (!playing) return; setVprog(0); const iv = setInterval(() => setVprog(p => { if (p >= 100) { setPlaying(false); return 0; } return p + 1.2; }), 100); return () => clearInterval(iv); }, [playing]);
  useEffect(() => { setProcessing(siteStats?.processing ?? null); }, [siteStats?.processing]);

  const pick = (q) => { setQFade(true); setTimeout(() => { setQi(q); setQFade(false); }, 180); };
  const wa = socialLinks?.social_whatsapp_support ? `https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g, "")}` : null;
  const waChannel = socialLinks?.social_whatsapp_channel || "https://whatsapp.com/channel/0029Vb8hC6rJ3jv7Ig2m3D3Q";
  const panel = dark ? "#160f22" : "#fff";
  const brd = dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.09)";
  const hair = dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.07)";
  const soft = dark ? "rgba(244,241,237,.58)" : "rgba(28,27,25,.58)";
  const muted = dark ? "rgba(244,241,237,.36)" : "rgba(28,27,25,.42)";
  const text = dark ? "#f0ede8" : "#1c1b19";
  const bgAlt = dark ? "#0b0f1c" : "#fcefe8";
  const bgRose = dark ? "#1a1220" : "#f7dde4";
  const [qt, qn, qr, qinit, qc] = QUOTES[qi];

  return (
    <div ref={wrapRef} style={{ color: text }}>
      <style>{BF_CSS}</style>

      {/* ━━━ 01 TIERS ━━━ */}
      <div className="relative overflow-hidden" style={{ background: t.bg }}>
        <div className="lv3-glow" style={{ width: 640, height: 640, top: -220, right: -160, background: dark ? "rgba(196,125,142,.14)" : "rgba(249,168,117,.28)" }}/>
        <div className="lv3-glow" style={{ width: 460, height: 460, bottom: -160, left: -120, background: dark ? "rgba(96,165,250,.08)" : "rgba(96,165,250,.14)" }}/>
        <div className="lv3-grain"/>
        <section id="tiers" className="snap-section relative max-w-[1200px] mx-auto py-[88px] px-[60px] max-desktop:py-16 max-desktop:px-10 max-md:py-[52px] max-md:px-5">
          <div className="lv3-sh" data-reveal><span className="num">01</span><h2>Pick your <span className="serif">quality.</span></h2></div>
          <p className="lv3-sub" data-reveal="1" style={{ color: soft }}>Every service comes in three tiers. Same platforms, same wallet, different sourcing and different cover. You always know what you're buying.</p>
          <div data-reveal="2" className="flex flex-wrap gap-x-[22px] gap-y-2 mt-7 mb-[30px] ml-[30px] max-md:ml-0 max-md:gap-x-3.5">
            <div className="w-full text-[13px] font-bold mb-0.5">All tiers include:</div>
            {["Naira pricing, no FX markup","Starts in under 60 seconds","Live order tracking","Real humans on WhatsApp"].map(x => <span key={x} className="inline-flex items-center gap-[7px] text-[13.5px]" style={{ color: soft }}><span style={{ color: "#c47d8e" }}><Check/></span>{x}</span>)}
          </div>
          <div data-reveal="3" className="grid grid-cols-3 max-desktop:grid-cols-2 max-md:grid-cols-1 gap-[18px] items-stretch">
            {TIERS.map(tier => { const livePrice = pricingData?.heroTiers?.[tier.name]; const s = TIER_STYLE[tier.name]; const tc = dark ? s.textDark : s.text, tbg = dark ? s.bgDark : s.bg, tb = dark ? s.brdDark : s.brd; return (
              <div key={tier.name} className={"lv3-tcard" + (tier.name === "Budget" ? " max-desktop:col-span-2 max-md:col-span-1" : "")} style={{ "--tg": s.grad, background: panel, border: tier.pop ? `1.5px solid ${tb}` : `1px solid ${brd}` }}>
                <div className="flex items-center justify-between gap-2.5 mb-3.5">
                  <span className="text-[11px] font-extrabold tracking-[2px] uppercase" style={{ color: muted }}>Tier</span>
                  <span className="inline-flex items-center gap-1.5 py-[5px] px-[11px] rounded-full text-[11px] font-extrabold tracking-[.4px]" style={{ background: tbg, color: tc, border: `1px solid ${tb}` }}>{tier.chip}</span>
                </div>
                <h3 className="text-[30px] font-extrabold -tracking-[1px] leading-[1.05] flex items-center gap-2.5" style={{ color: text }}>
                  <span className="w-8 h-8 rounded-[10px] inline-flex items-center justify-center shrink-0 text-white" style={{ background: s.grad }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">{TIER_ICON[tier.name]}</svg></span>{tier.name}
                </h3>
                <div className="text-sm mt-1.5 min-h-[22px]" style={{ color: soft }}>{tier.tfor}</div>
                <div className="flex items-baseline gap-1.5 mt-[18px]"><b className="m text-[34px] font-extrabold -tracking-[1.5px]" style={{ color: tc }}>{livePrice || tier.price}</b><span className="text-[13px]" style={{ color: muted }}>/ 1,000 Instagram followers</span></div>
                <div className="h-px my-[20px] mb-4" style={{ background: hair }}/>
                <ul className="list-none p-0 m-0 flex flex-col gap-[11px] flex-1">
                  {tier.li.map(([k, x]) => <li key={x} className="flex gap-2.5 text-sm leading-[1.5]" style={{ color: k === "no" ? muted : text }}><span className="mt-[3px]" style={{ color: k === "no" ? muted : tc }}>{k === "no" ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="12" x2="18" y2="12"/></svg> : <Check size={15}/>}</span><span>{x}</span></li>)}
                </ul>
                <a href="/signup" onClick={e => { e.preventDefault(); setModal("signup"); }} className="lv3-tbtn">Start with {tier.name}</a>
                <div className="text-[11.5px] leading-[1.5] mt-3 text-center" style={{ color: muted }}>{tier.fine}</div>
              </div>
            ); })}
          </div>
          <div className="mt-6 ml-[30px] max-md:ml-0 text-[13.5px]" style={{ color: soft }}>Prices shown are Instagram followers per 1,000. <a href="/pricing" className="font-bold no-underline" style={{ color: "#c47d8e" }}>See every platform →</a></div>
        </section>
      </div>

      {/* ━━━ 02 CURATION ━━━ */}
      <div className="relative overflow-hidden" style={{ background: bgAlt, borderTop: `1px solid ${hair}`, borderBottom: `1px solid ${hair}` }}>
        <div className="lv3-dots"/>
        <div className="lv3-glow" style={{ width: 560, height: 560, top: -180, left: "30%", background: "rgba(196,125,142,.18)" }}/>
        <section id="curated" className="snap-section relative max-w-[1200px] mx-auto py-[88px] px-[60px] max-desktop:py-16 max-desktop:px-10 max-md:py-[52px] max-md:px-5">
          <div className="lv3-sh" data-reveal><span className="num">02</span><h2>Stop testing panels. <span className="serif">We already did.</span></h2></div>
          <div className="grid grid-cols-[1fr_1.1fr] max-desktop:grid-cols-1 gap-[60px] max-desktop:gap-[34px] items-center mt-2">
            <div>
              <p className="lv3-sub" data-reveal="1" style={{ color: soft }}>Most people find good services the expensive way: buy from five panels, watch three drop, chase refunds from two. Nitro tests every service before it's listed, sorts it into a tier you can understand, and pulls it the moment quality slips.</p>
              <div data-reveal="2" className="flex flex-col gap-3 mt-[26px] ml-[30px] max-md:ml-0">
                {[[<><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></>,"Tested before it's listed","Real orders, real retention checks. If it doesn't hold, it never goes up."],[<><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></>,"Retested, and delisted when it slips","Suppliers change. When one degrades, the service comes down until it passes again."],[<><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,"Three tiers, zero guesswork","Budget, Standard, Premium. Not 400 lookalike listings with mystery names."]].map(([ico, b, s], i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0" style={{ background: "rgba(196,125,142,.16)", color: "#c47d8e" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{ico}</svg></div>
                    <div><b className="block text-[14.5px]">{b}</b><span className="text-[13px] leading-[1.5]" style={{ color: soft }}>{s}</span></div>
                  </div>
                ))}
              </div>
            </div>
            <div data-reveal="2" data-funnel="1" className="grid grid-cols-[1fr_44px_1fr] max-md:grid-cols-1 gap-3 max-md:gap-2.5 items-center">
              <div className="flex flex-col gap-2">
                <div className="text-[10.5px] font-extrabold tracking-[1.4px] uppercase text-center mb-0.5" style={{ color: muted }}>Everywhere else</div>
                {[["Panel A · IG Followers","Dropped 40%","bad"],["Panel B · IG Followers","Never delivered","bad"],["Panel C · IG Followers","3 days late","meh"],["Panel D · IG Followers","Refund pending","meh"],["Panel E · IG Followers","Actually good","ok"]].map(([n, s, k], i) => (
                  <div key={n} className={"lv3-pcard" + (i < dimmed ? " dim" : "")} style={{ background: panel, border: `1px solid ${brd}`, color: text }}>
                    <span className="font-bold flex-1">{n}</span>
                    <span className="lv3-ps" style={k === "bad" ? { background: dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.1)", color: dark ? "#fca5a5" : "#dc2626" } : k === "meh" ? { background: dark ? "rgba(224,164,88,.14)" : "rgba(217,119,6,.12)", color: dark ? "#e0a458" : "#d97706" } : { background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.1)", color: dark ? "#6ee7b7" : "#059669" }}>{s}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center max-md:rotate-90" style={{ color: "#c47d8e" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div>
              <div className="flex flex-col gap-2">
                <div className="text-[10.5px] font-extrabold tracking-[1.4px] uppercase text-center mb-0.5" style={{ color: muted }}>On Nitro</div>
                <div className="p-[14px_15px] rounded-[14px] flex flex-col gap-2" style={{ background: panel, border: "1.5px solid rgba(196,125,142,.5)", boxShadow: "0 14px 34px rgba(196,125,142,.18)" }}>
                  <div className="flex items-center justify-between text-xs font-extrabold">Instagram Followers <i className="not-italic text-[9.5px] font-extrabold tracking-[1px] py-[3px] px-2 rounded-full text-white" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}>TESTED</i></div>
                  {[["Cheapest that still holds","Budget"],["Refill-backed everyday pick","Standard"],["Top source, longest cover","Premium"]].map(([x, tn]) => { const s = TIER_STYLE[tn]; return (
                    <div key={tn} className="flex items-center gap-2 text-[12.5px]"><span style={{ color: dark ? "#34d399" : "#059669" }}><Check/></span>{x}<span className="ml-auto text-[10px] font-extrabold py-0.5 px-[7px] rounded-full uppercase" style={{ background: dark ? s.bgDark : s.bg, color: dark ? s.textDark : s.text }}>{tn}</span></div>
                  ); })}
                  <div className="text-[11px] mt-0.5" style={{ color: muted }}>Panel E made it in. The other four didn't. That's the whole job.</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ━━━ 03 STEPS ━━━ */}
      <div className="relative overflow-hidden" style={{ background: t.bg }}>
        <div className="lv3-glow" style={{ width: 560, height: 560, bottom: -280, right: "8%", background: dark ? "rgba(242,184,102,.08)" : "rgba(242,184,102,.16)" }}/>
        <div className="lv3-grain"/>
        <section id="how" className="snap-section relative max-w-[1200px] mx-auto py-[88px] px-[60px] max-desktop:py-16 max-desktop:px-10 max-md:py-[52px] max-md:px-5">
          <div className="lv3-sh" data-reveal><span className="num">03</span><h2>Three steps, <span className="serif">no waiting.</span></h2></div>
          <div data-reveal="1" className="grid grid-cols-3 max-md:grid-cols-1 gap-10 max-desktop:gap-6 max-md:gap-[22px] mt-9 ml-[30px] max-md:ml-0">
            {[["/01","Fund your wallet","Card, transfer or crypto. From ₦1,000, and your first deposit earns up to ₦1,500 free."],["/02","Paste your link","Pick the service and tier, paste the post or profile, choose instant or gradual delivery."],["/03","Watch it deliver","Progress live on your dashboard, usually within minutes. Refill cover on Standard and Premium."]].map(([n, h, p]) => (
              <div key={n}><div className="m text-xs font-bold mb-3" style={{ color: "#c47d8e" }}>{n}</div><h4 className="text-lg font-bold mb-2">{h}</h4><p className="text-[14.5px] leading-[1.6]" style={{ color: soft }}>{p}</p></div>
            ))}
          </div>
        </section>
      </div>
      <div className="h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(196,125,142,.5),transparent)" }}/>

      {/* ━━━ 04 REVIEWS (bento) ━━━ */}
      <div className="relative overflow-hidden" style={{ background: bgRose }}>
        <div className="lv3-glow" style={{ width: 700, height: 700, top: -300, left: -200, background: "rgba(196,125,142,.26)" }}/>
        <div className="lv3-glow" style={{ width: 520, height: 520, bottom: -240, right: -120, background: dark ? "rgba(196,125,142,.1)" : "rgba(255,255,255,.55)" }}/>
        <div className="lv3-grain"/>
        <section id="reviews" className="snap-section relative max-w-[1200px] mx-auto py-[88px] px-[60px] max-desktop:py-16 max-desktop:px-10 max-md:py-[52px] max-md:px-5">
          <div className="lv3-sh" data-reveal><span className="num">04</span><h2>Creators who <span className="serif">trust us.</span></h2></div>
          <p className="lv3-sub" data-reveal="1" style={{ color: soft }}>Real reviews from Nigerian creators and businesses growing with Nitro. Tap the video.</p>
          <div className="lv3-bento" data-reveal="2">
            <div className="lv3-bcard flex flex-col justify-center min-h-[340px] max-md:min-h-0 overflow-hidden py-[34px] px-9 max-md:py-[26px] max-md:px-[22px]" style={{ gridArea: "feat", background: panel, border: `1px solid ${brd}` }}>
              <div className="absolute -top-2.5 left-[22px] serif text-[160px] leading-none select-none" style={{ color: "rgba(196,125,142,.2)" }}>“</div>
              <div className="flex gap-[3px] mb-4 relative">{[0,1,2,3,4].map(i => <Star key={i} c="#c47d8e"/>)}</div>
              <blockquote className="serif italic font-medium text-[clamp(24px,2.6vw,34px)] leading-[1.25] relative m-0 transition-opacity duration-300" style={{ opacity: qFade ? 0 : 1 }}>“{qt}”</blockquote>
              <div className="flex items-center gap-3 mt-[22px] relative">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: qc }}>{qinit}</div>
                <div><b className="block text-sm">{qn}</b><span className="text-[12.5px]" style={{ color: muted }}>{qr}</span></div>
                <div className="flex gap-1.5 ml-auto">{QUOTES.map((_, i) => <button key={i} type="button" aria-label={`Quote ${i + 1}`} onClick={() => pick(i)} className={"lv3-qdot" + (i === qi ? " on" : "")} style={{ background: muted }}/>)}</div>
              </div>
            </div>
            <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPlaying(p => !p); } }} onClick={() => setPlaying(p => !p)} className="lv3-bcard p-0 overflow-hidden cursor-pointer min-h-[340px] max-desktop:min-h-[300px] max-md:min-h-[260px]" style={{ gridArea: "video", background: "linear-gradient(160deg,#f472b655 0%,#1b1420 70%),#1b1420", border: `1px solid ${brd}` }} aria-label="Play video testimonial">
              <span className="absolute top-3 left-3 py-1 px-2.5 rounded-full text-[10px] font-extrabold text-white z-[3]" style={{ background: "rgba(0,0,0,.45)" }}>TikTok</span>
              <span className="absolute top-3 right-3 py-[3px] px-2 rounded-[7px] text-[10px] font-bold text-white z-[3] m" style={{ background: "rgba(0,0,0,.45)" }}>0:24</span>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-bold text-white" style={{ background: "#f472b6", border: "2.5px solid rgba(255,255,255,.5)" }}>BI</div>
                <div className="text-xs font-semibold text-center px-[18px] leading-[1.5] transition-opacity duration-300" style={{ color: "rgba(255,255,255,.85)", opacity: playing ? 0 : 1 }}>“My TikTok reach has been incredible…”</div>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[54px] h-[54px] rounded-full flex items-center justify-center z-[3] transition-opacity duration-200" style={{ background: "rgba(255,255,255,.92)", boxShadow: "0 6px 24px rgba(0,0,0,.3)", opacity: playing ? 0 : 1 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="#8b4a5e"><polygon points="6 3 21 12 6 21 6 3"/></svg></div>
              <div className="absolute left-0 right-0 bottom-0 pt-[34px] px-3.5 pb-3.5 z-[2]" style={{ background: "linear-gradient(transparent,rgba(0,0,0,.72))" }}><h5 className="text-[13.5px] font-bold text-white m-0">Blessing I.</h5><span className="text-[11.5px]" style={{ color: "rgba(255,255,255,.75)" }}>Beauty Influencer</span></div>
              {playing && <div className="lv3-veq absolute bottom-4 right-3.5 flex items-end gap-[2.5px] h-3.5 z-[4]"><i/><i/><i/></div>}
              <div className="absolute left-0 right-0 bottom-0 h-[3px] z-[4] transition-opacity" style={{ background: "rgba(255,255,255,.25)", opacity: playing ? 1 : 0 }}><div className="h-full bg-white" style={{ width: `${vprog}%` }}/></div>
            </div>
            <div className="lv3-bcard flex flex-col gap-2.5" style={{ gridArea: "r1", background: panel, border: `1px solid ${brd}` }}>
              <div className="flex gap-0.5">{[0,1,2,3,4].map(i => <Star key={i} c="#fbbf24"/>)}</div>
              <p className="text-sm leading-[1.55] flex-1 m-0">"Been using Nitro for 3 months to promote my YouTube channel. The pricing is unbeatable and delivery is always fast."</p>
              <div className="flex items-center gap-[9px] text-[12.5px]" style={{ color: muted }}><i className="not-italic w-7 h-7 rounded-[9px] flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: "#e0a458" }}>TM</i><div><b className="block text-[13px]" style={{ color: text }}>Tunde M.</b>Music Producer</div></div>
            </div>
            <div className="lv3-bcard flex flex-col gap-2.5" style={{ gridArea: "r2", background: panel, border: `1px solid ${brd}` }}>
              <span className="inline-flex self-start py-[3px] px-[9px] rounded-full text-[10.5px] font-extrabold" style={{ background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.1)", color: dark ? "#6ee7b7" : "#059669" }}>Saves ₦50K monthly</span>
              <p className="text-sm leading-[1.55] flex-1 m-0">"I manage social media for 12 clients. Nitro's bulk pricing saves me at least ₦50K monthly."</p>
              <div className="flex items-center gap-[9px] text-[12.5px]" style={{ color: muted }}><i className="not-italic w-7 h-7 rounded-[9px] flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: "#a5b4fc" }}>EN</i><div><b className="block text-[13px]" style={{ color: text }}>Emeka N.</b>Digital Marketer</div></div>
            </div>
            <div className="lv3-bcard text-white flex flex-col justify-center gap-1.5 overflow-hidden" style={{ gridArea: "stat", background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", border: "none" }}>
              <div className="absolute rounded-full" style={{ width: 220, height: 220, right: -80, top: -90, background: "rgba(255,255,255,.16)", filter: "blur(30px)" }}/>
              <div className="m text-[38px] font-bold -tracking-[1px] leading-none relative">4.9<small className="text-base font-semibold">★</small></div>
              <div className="text-[12.5px] relative" style={{ opacity: .9 }}>average across 320+ reviews</div>
              <div className="flex mt-2 relative">{[["CA","#c47d8e"],["TM","#e0a458"],["AO","#6ee7b7"],["EN","#a5b4fc"],["BI","#f472b6"],["+","rgba(255,255,255,.25)"]].map(([a, c], i) => <i key={a} className="not-italic w-[26px] h-[26px] rounded-full text-[9px] font-extrabold flex items-center justify-center text-white" style={{ background: c, border: "2px solid rgba(255,255,255,.8)", marginLeft: i ? -8 : 0 }}>{a}</i>)}</div>
            </div>
          </div>
        </section>
      </div>

      {/* ━━━ CTA + FOOTER ━━━ */}
      <div id="cta" className="flex flex-col snap-section">
        <div className="relative overflow-hidden" style={{ background: dark ? "linear-gradient(160deg,#1a1220,#080510)" : "linear-gradient(160deg,#c47d8e 0%,#a3586b 45%,#6d3448 100%)" }}>
          <div className="absolute rounded-full pointer-events-none" style={{ width: 600, height: 600, top: -220, left: -120, background: dark ? "rgba(196,125,142,.14)" : "rgba(255,215,195,.3)", filter: "blur(110px)" }}/>
          <div className="absolute rounded-full pointer-events-none" style={{ width: 420, height: 420, bottom: -160, right: "6%", background: dark ? "rgba(120,80,180,.1)" : "rgba(255,240,180,.22)", filter: "blur(110px)" }}/>
          {[760, 520].map(s => <div key={s} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none" style={{ width: s, height: s, left: "78%", border: "1px solid rgba(255,255,255,.12)" }}/>)}
          <div className="lv3-grain"/>
          <div className="relative z-[2] max-w-[1100px] mx-auto grid grid-cols-[1.15fr_.85fr] max-desktop:grid-cols-1 gap-[50px] max-desktop:gap-[34px] items-center pt-[84px] px-[60px] pb-[76px] max-desktop:!pt-16 max-desktop:!px-10 max-desktop:!pb-[60px] max-md:!pt-14 max-md:!px-[22px] max-md:!pb-[52px]">
            <div>
              <div data-reveal className="text-[11px] font-bold tracking-[3px] uppercase mb-4" style={{ color: dark ? "#c47d8e" : "rgba(255,255,255,.72)" }}>No card. No contract. No waiting.</div>
              <h2 data-reveal="1" className="text-[clamp(36px,4.6vw,62px)] font-bold text-white leading-[1.02] -tracking-[2.4px] m-0">Your audience <br/><span className="serif italic font-normal -tracking-[.5px]">won't grow itself.</span></h2>
              <p data-reveal="2" className="text-[16.5px] leading-[1.7] max-w-[480px] mt-[18px] mb-[26px]" style={{ color: "rgba(255,255,255,.82)" }}>Every minute you wait, someone with worse content and better numbers is getting the deal, the booking, the follow. Fund a wallet, pick a tier, watch it move.</p>
              <div data-reveal="3" className="flex gap-3 flex-wrap items-center max-md:flex-col max-md:items-stretch">
                <a href="/signup" onClick={e => { e.preventDefault(); setModal("signup"); }} className="py-4 px-[34px] rounded-full text-[15.5px] font-extrabold no-underline text-center transition-transform duration-200 hover:scale-[1.04]" style={{ background: "#fff", color: "#1a1a1a", boxShadow: "0 10px 32px rgba(0,0,0,.2)" }}>Start Growing Now →</a>
                {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 py-[15px] px-6 rounded-full text-[14.5px] font-bold text-white no-underline transition-colors duration-200" style={{ background: "rgba(37,211,102,.2)", border: "1px solid rgba(37,211,102,.5)" }}><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d={WA_PATH}/></svg>Ask us anything</a>}
              </div>
              <div data-reveal="3" className="flex items-center gap-3 mt-[26px] text-[13px]" style={{ color: "rgba(255,255,255,.8)" }}>
                <div className="flex">{[["TM","#e0a458"],["AO","#6ee7b7"],["EN","#a5b4fc"],["BI","#f472b6"],["KD","#fbbf24"]].map(([a, c], i) => <i key={a} className="not-italic w-[30px] h-[30px] rounded-full text-[10px] font-extrabold flex items-center justify-center text-white" style={{ background: c, border: "2px solid rgba(255,255,255,.9)", marginLeft: i ? -9 : 0 }}>{a}</i>)}</div>
                <span><b className="text-white">{siteStats?.users || "2,300"}+ creators</b> already here.{processing != null && <> <span className="m">{processing}</span> orders delivering right now.</>}</span>
              </div>
            </div>
            <div data-reveal="2" className="relative rounded-[22px] p-[26px] text-white backdrop-blur-[14px]" style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.28)" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-[13px] flex items-center justify-center shrink-0" style={{ background: "#fff", color: "#8b4a5e" }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg></div>
                <div><b className="block text-base font-extrabold">Your first push is on us</b><span className="text-[12.5px]" style={{ opacity: .85 }}>Up to ₦1,500 in promo credit, first deposit</span></div>
              </div>
              <ul className="list-none p-0 m-0 flex flex-col gap-[9px]">
                {["Fund from ₦1,000 by card, transfer or crypto","Pick Budget, Standard or Premium per order","Delivery starts in under 60 seconds","Undelivered orders refund automatically"].map(x => <li key={x} className="flex gap-[9px] text-[13.5px] items-start leading-[1.45]"><span className="mt-[3px]"><Check/></span>{x}</li>)}
              </ul>
              <div className="mt-4 pt-3.5 flex justify-between gap-2.5 flex-wrap text-[11.5px]" style={{ borderTop: "1px solid rgba(255,255,255,.22)", opacity: .85 }}><span>Account in 30 seconds</span><b className="m">0 monthly fees</b></div>
            </div>
          </div>
        </div>

          <footer className="lv3-ft" style={{background:dark?"#050710":"#2a1a22"}}>
            <div className="lv3-grain"/>
            <div className="absolute rounded-full pointer-events-none" style={{width:520,height:400,top:"-40%",left:"18%",background:"rgba(196,125,142,.14)",filter:"blur(110px)"}}/>
            <div className="lv3-ft-ghost" aria-hidden="true">NITRO</div>
            <div className="lv3-ft-in">

              {/* Row 1: the statement + the channel card */}
              <div className="lv3-ft-head">
                <div className="lv3-ft-stmt">The audience is out there. <em>Go get them.</em></div>
                <a className="lv3-chan" href={waChannel} target="_blank" rel="noopener noreferrer">
                  <span className="lv3-chan-i"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d={WA_PATH}/></svg></span>
                  <span><b>Promos land on WhatsApp first</b><i>Deals, new services and free credit drops, straight to your phone.</i></span>
                  <span className="lv3-chan-btn"><span className="max-md:hidden">Join the channel</span><span className="hidden max-md:!inline">Join</span></span>
                </a>
              </div>

              {/* Row 2: brand + link columns */}
              <div className="lv3-ft-cols">
                <div className="lv3-ft-brand">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-[7px] flex items-center justify-center" style={{background:"linear-gradient(135deg,#c47d8e,#8b5e6b)",boxShadow:"0 2px 8px rgba(196,125,142,.25)"}}><svg width="11" height="12" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg></div>
                    <span className="text-base font-bold tracking-[2px] text-white">NITRO</span>
                  </div>
                  <p>We handle the promotion so you can focus on content. {siteStats.uniquePlatforms?`${siteStats.uniquePlatforms}+`:"28+"} platforms, naira pricing, fast delivery.</p>
                  <a className="lv3-ft-status" href={SITE.status} target="_blank" rel="noopener noreferrer"><i/>All systems live</a>
                  <div className="flex gap-2 mt-[18px]">
                    <a href={`https://x.com/${(socialLinks.social_twitter||"TheNitroNG").replace(/^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/?/i,"").replace(/^@/,"").replace(/\/$/,"")}`} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="lv3-ft-soc"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
                    <a href={`https://instagram.com/${(socialLinks.social_instagram||"Nitro.ng").replace(/^(https?:\/\/)?(www\.)?(instagram\.com)\/?/i,"").replace(/^@/,"").replace(/\/$/,"")}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="lv3-ft-soc"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg></a>
                    {wa&&<a href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="lv3-ft-soc"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d={WA_PATH}/></svg></a>}
                    {socialLinks.social_telegram_support&&<a href={`https://t.me/${socialLinks.social_telegram_support.replace(/^(https?:\/\/)?(t\.me\/)?@?/,"")}`} target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="lv3-ft-soc"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a>}
                  </div>
                </div>
                <div>
                  <div className="lv3-ft-h4">Product</div>
                  {[["Pricing","/pricing","tiers"],["Services","/services"],["Resellers","/resellers"],["Blog","/blog"],["What's New","/changelog"]].map(([l,h,scrollId])=><a key={l} href={h} className="lv3-ft-l" {...(scrollId?{onClick:e=>{e.preventDefault();document.getElementById(scrollId)?.scrollIntoView({behavior:"smooth",block:"start"})}}:{})}>{l}</a>)}
                </div>
                <div>
                  <div className="lv3-ft-h4">Company</div>
                  {[["About","/about"],["FAQ","/faq"],["Terms","/terms"],["Privacy","/privacy"],["Refund","/refund"],["Cookies","/cookie"]].map(([l,h])=><a key={l} href={h} className="lv3-ft-l">{l}</a>)}
                  <button type="button" className="lv3-ft-l" onClick={()=>window.dispatchEvent(new Event('nitro-cookie-reset'))}>Cookie settings</button>
                </div>
                <div className="lv3-ft-contact">
                  <div className="lv3-ft-h4">Get in touch</div>
                  <a href={`mailto:${SITE.email.general}`} className="lv3-ft-l">{SITE.email.general}</a>
                  <a href={wa||"#"} target="_blank" rel="noopener noreferrer" className="lv3-ft-l">WhatsApp support</a>
                  <a href={SITE.status} target="_blank" rel="noopener noreferrer" className="lv3-ft-l">Status page</a>
                </div>
              </div>

              {/* Row 3: baseline */}
              <div className="lv3-ft-base">
                <span className="m">{"©"} {new Date().getFullYear()>2025?`2025–${new Date().getFullYear()}`:"2025"} The Nitro NG · RC 9514845</span>
                <span>Built in Lagos 🇳🇬</span>
              </div>

            </div>
          </footer>
        </div>{/* end cta */}
    </div>
  );
}
