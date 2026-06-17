'use client';
import { useState, useRef, useEffect } from 'react';
import { SITE } from '@/lib/site';
import Waves from '@/components/wave-background';

const PLATFORM_ICONS = {
  Instagram: (dark) => ({ icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>, bg: "rgba(225,48,108,.08)" }),
  TikTok: (dark) => ({ icon: <svg width="16" height="18" viewBox="0 0 448 512" fill="#ff0050"><path d="M448 209.91a210.06 210.06 0 01-122.77-39.25v178.72A162.55 162.55 0 11185 188.31v89.89a74.62 74.62 0 1052.23 71.18V0h88a121 121 0 00122.77 121.33z"/></svg>, bg: "rgba(255,0,80,.06)" }),
  YouTube: (dark) => ({ icon: <svg width="20" height="14" viewBox="0 0 576 512" fill="#FF0000"><path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z"/></svg>, bg: "rgba(255,0,0,.06)" }),
  "Twitter/X": (dark) => ({ icon: <svg width="16" height="16" viewBox="0 0 24 24" fill={dark?"#eee":"#222"}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>, bg: dark?"rgba(255,255,255,.07)":"rgba(0,0,0,.04)" }),
  Facebook: (dark) => ({ icon: <svg width="10" height="18" viewBox="0 0 320 512" fill="#1877F2"><path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z"/></svg>, bg: "rgba(24,119,242,.06)" }),
  Telegram: (dark) => ({ icon: <svg width="18" height="16" viewBox="0 0 496 512" fill="#0088cc"><path d="M248 8C111.033 8 0 119.033 0 256s111.033 248 248 248 248-111.033 248-248S384.967 8 248 8zm114.952 168.66c-3.732 39.215-19.881 134.378-28.1 178.3-3.476 18.584-10.322 24.816-16.948 25.425-14.4 1.326-25.338-9.517-39.287-18.661-21.827-14.308-34.158-23.215-55.346-37.177-24.485-16.135-8.612-25 5.342-39.5 3.652-3.793 67.107-61.51 68.335-66.746.154-.655.3-3.1-1.154-4.384s-3.59-.849-5.135-.5q-3.283.746-104.608 69.142-14.845 10.194-26.894 9.934c-8.855-.191-25.888-5.006-38.551-9.123-15.531-5.048-27.875-7.717-26.8-16.291q.84-6.7 18.45-13.7 108.446-47.248 144.628-62.3c68.872-28.647 83.183-33.623 92.511-33.789 2.052-.034 6.639.474 9.61 2.885a10.452 10.452 0 013.53 6.716 43.765 43.765 0 01.417 9.769z"/></svg>, bg: "rgba(0,136,204,.06)" }),
  Spotify: (dark) => ({ icon: <svg width="18" height="18" viewBox="0 0 496 512" fill="#1DB954"><path d="M248 8C111.1 8 0 119.1 0 256s111.1 248 248 248 248-111.1 248-248S384.9 8 248 8zm100.7 364.9c-4.2 0-6.8-1.3-10.7-3.6-62.4-37.6-135-39.2-206.7-24.5-3.9 1-9 2.6-11.9 2.6-9.7 0-15.8-7.7-15.8-15.8 0-10.3 6.1-15.2 13.6-16.8 81.9-18.1 165.6-16.5 237 26.2 6.1 3.9 9.7 7.4 9.7 16.5s-7.1 15.4-15.2 15.4zm26.9-65.6c-5.2 0-8.7-2.3-12.3-4.2-62.5-37-155.7-51.9-238.6-29.4-4.8 1.3-7.4 2.6-11.9 2.6-10.7 0-19.4-8.7-19.4-19.4s5.2-17.8 15.5-20.7c27.8-7.8 56.2-13.6 97.8-13.6 64.9 0 127.6 16.1 177 45.5 8.1 4.8 11.3 11 11.3 19.7-.1 10.8-8.5 19.5-19.4 19.5zm31-76.2c-5.2 0-8.4-1.3-12.9-3.9-71.2-42.5-198.5-52.7-280.9-29.7-3.6 1-8.1 2.6-12.9 2.6-13.2 0-23.3-10.3-23.3-23.6 0-13.6 8.4-21.3 17.4-23.9 35.2-10.3 74.6-15.2 117.5-15.2 73 0 149.5 15.2 205.4 47.8 7.8 4.5 12.9 10.7 12.9 22.6 0 13.6-11 23.3-23.2 23.3z"/></svg>, bg: "rgba(29,185,84,.06)" }),
  Snapchat: (dark) => ({ icon: <svg width="18" height="18" viewBox="0 0 512 512" fill="#FFFC00"><path d="M496.926 366.6c-3.373-9.176-9.8-14.086-17.112-18.153-1.376-.806-2.641-1.451-3.72-1.947-2.182-1.128-4.414-2.22-6.634-3.373-22.8-12.09-40.609-27.341-52.753-45.541a117.22 117.22 0 01-8.8-14.974c-2.49-5.236-2.4-8.41-.2-11.344a22.537 22.537 0 015.4-4.848c3.249-2.182 6.5-4.5 9.752-6.634 5.91-3.87 11.2-7.55 14.673-10.468C449.78 240.138 456.588 228 456.588 213.4c0-19.468-14.337-33.967-33.4-33.967a43.82 43.82 0 00-12.453 1.827l-.3.1a1.478 1.478 0 01-.4.1c-.623.2-.747.1-.747-.5V162.68c0-39.665-9.427-71.907-28.07-95.779C359.622 38.157 321.27 22 273.466 22c-47.732 0-86.144 16.157-107.879 44.9C146.944 90.752 137.553 123 137.553 162.68v18.28c0 .6-.124.7-.747.5a1.478 1.478 0 01-.4-.1l-.3-.1a43.82 43.82 0 00-12.453-1.827c-19.06 0-33.4 14.5-33.4 33.967 0 14.6 6.808 26.742 19.054 35.986 3.461 2.6 8.472 6.434 14.673 10.468 3.249 2.132 6.5 4.452 9.752 6.634a22.537 22.537 0 015.4 4.848c2.2 2.934 2.29 6.108-.2 11.344a117.22 117.22 0 01-8.8 14.974c-12.144 18.2-29.95 33.451-52.753 45.541a82.98 82.98 0 01-6.634 3.373c-1.079.5-2.344 1.141-3.72 1.947-7.31 4.067-13.739 8.977-17.112 18.153-3.174 8.6-1.578 18.5 4.689 29.064a26.817 26.817 0 003.9 5.286c.71.684 1.5 1.327 2.3 1.971 10.4 7.93 23.442 12.64 32.3 15.283 2.38.72 4.5 1.327 6.071 1.826.5.15 1.008.361 1.54.597a4.19 4.19 0 012.267 2.466c.536 1.652.535 3.456 1.3 5.608 1.614 4.5 5.174 9.353 14.573 9.353a37.57 37.57 0 009.577-1.428c11.269-3.049 18.6-4.5 24.171-4.5a20.1 20.1 0 016.31.958c7.886 2.714 14.873 8.063 22.759 13.8 11.919 8.65 25.411 18.5 45.4 24.97A104.91 104.91 0 00267.266 490c3.562 0 7.2-.312 10.782-.884 20.689-4.625 35.6-15.283 48.2-24.17 7.886-5.74 14.873-11.089 22.759-13.8a20.1 20.1 0 016.31-.958c5.574 0 12.9 1.451 24.171 4.5a37.57 37.57 0 009.577 1.428c9.4 0 12.959-4.848 14.573-9.353.76-2.152.76-3.956 1.3-5.608a4.19 4.19 0 012.267-2.466c.536-.236 1.044-.447 1.54-.597 1.577-.5 3.7-1.106 6.071-1.826 8.851-2.643 21.907-7.353 32.3-15.283.8-.647 1.587-1.29 2.3-1.971a26.817 26.817 0 003.9-5.286c6.266-10.566 7.862-20.472 4.688-29.069z"/></svg>, bg: "rgba(255,252,0,.06)" }),
  LinkedIn: (dark) => ({ icon: <svg width="16" height="16" viewBox="0 0 448 512" fill="#0A66C2"><path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 01107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.83-48.3 94 0 111.28 61.9 111.28 142.3V448z"/></svg>, bg: "rgba(10,102,194,.06)" }),
};
const POPULAR_PLATFORM = "Instagram";

export default function LandingBelowFold({ t, dark, setModal, siteStats, socialLinks, scrollRoot, pricingData }) {
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const testimonialScrollRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const root = scrollRoot?.current;
    const els = wrapRef.current?.querySelectorAll("[data-reveal]:not(.revealed)");
    if (!els?.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("revealed"); io.unobserve(e.target); } });
    }, { root: root || null, threshold: 0.15 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [scrollRoot, pricingData]);

  return (
    <div ref={wrapRef}>
        {/* ━━━ SECTION 2: WHY NITRO + HOW IT WORKS ━━━ */}
        <section id="services" className="s2 snap-section min-h-dvh flex flex-col justify-center p-0 max-desktop:py-14 max-desktop:px-10 max-md:py-10 max-md:px-5 relative overflow-hidden" style={{background:t.bgAlt}}>

          {/* WHY NITRO — split layout */}
          <div className="grid grid-cols-[1fr_1.2fr] max-desktop:!grid-cols-1 gap-[60px] max-desktop:!gap-8 max-md:!gap-6 py-20 px-12 max-desktop:!py-14 max-desktop:!px-10 max-md:!py-12 max-md:!px-5 items-center">
            <div>
              <div data-reveal className="text-xs font-medium tracking-[2px] uppercase mb-4" style={{color:t.accent}}>Why Nitro</div>
              <h2 data-reveal="1" className="text-[48px] max-desktop:!text-4xl max-md:!text-[28px] font-bold leading-[1.05] -tracking-[1.5px] mb-4" style={{color:t.text}}>Grow your brand.<br/>Keep your audience.<br/><span className="serif max-desktop:!text-[40px] max-md:!text-[32px] italic font-normal text-[54px] block" style={{color:t.accent}}>Built for Nigeria.</span></h2>
              <p data-reveal="2" className="text-base leading-[1.7] max-w-[400px] mb-7" style={{color:t.textSoft}}>The growth tools Nigerian creators and businesses actually deserve — Naira pricing, instant delivery, automatic refunds, and a team that picks up when you call.</p>
            </div>
            <div data-reveal="2" className="s2-feat-list flex flex-col gap-2">
              {[[<svg key="f1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c47d8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,"Instant Delivery","Orders start processing within seconds, not hours.","rgba(196,125,142,.08)"],[<svg key="f2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e0a458" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,"Best Value in Nigeria","Transparent pricing, no hidden fees or markup.","rgba(224,164,88,.08)"],[<svg key="f3" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,"Lasting Results","Reach that sticks, backed by continuous monitoring.","rgba(110,231,183,.06)"],[<svg key="f4" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,"24/7 Human Support","Real people on WhatsApp and live chat, any time.","rgba(165,180,252,.06)"],[<svg key="f5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,"Satisfaction Guarantee","Not happy with results? We make it right, free.","rgba(251,191,36,.06)"]].map(([icon,title,desc,bg])=>(
                <div key={title} className="s2-feat-row flex items-start gap-4 py-[18px] px-5 rounded-[14px]" style={{background:dark?"rgba(255,255,255,.07)":"rgba(255,255,255,.6)",border:`1px solid ${dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.1)"}`,transition:"border-color .2s"}}>
                  <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{background:bg}}>{icon}</div>
                  <div className="flex-1"><div className="text-[15px] font-semibold mb-0.5" style={{color:t.text}}>{title}</div><div className="max-md:hidden text-sm leading-[1.5]" style={{color:dark?"rgba(244,241,237,.35)":"rgba(28,27,25,.4)"}}>{desc}</div></div>
                </div>
              ))}
            </div>
          </div>

          {/* HOW IT WORKS — horizontal timeline */}
          <div className="s2-how pt-[60px] px-12 pb-20 max-desktop:!px-10 max-md:!px-5" style={{backgroundColor:dark?"rgba(0,0,0,.24)":"rgba(0,0,0,.06)",backgroundImage:`linear-gradient(to right,${dark?"rgba(255,255,255,.07)":"rgba(0,0,0,.04)"} 1px,transparent 1px),linear-gradient(to bottom,${dark?"rgba(255,255,255,.07)":"rgba(0,0,0,.04)"} 1px,transparent 1px)`,backgroundSize:"40px 40px",borderTop:`1px solid ${dark?"rgba(255,255,255,.12)":"rgba(0,0,0,.08)"}`,borderBottom:`1px solid ${dark?"rgba(255,255,255,.12)":"rgba(0,0,0,.08)"}`}}>
            <div className="flex items-baseline gap-4 mb-10">
              <h3 data-reveal className="text-[28px] font-semibold -tracking-[0.5px]" style={{color:t.text}}>How it <span className="serif italic font-medium text-[32px]" style={{color:t.accent}}>works</span></h3>
              <div className="flex-1 h-px" style={{background:dark?"rgba(255,255,255,.09)":"rgba(0,0,0,.06)"}}/>
            </div>
            <div className="grid grid-cols-4 max-md:!grid-cols-2 gap-0 max-md:!gap-2.5">
              {[["01","Create Account","Sign up free in 30 seconds. No card required."],["02","Add Funds","Pay via card, bank transfer, or crypto. Instant."],["03","Place Order","Pick a service, paste your link, confirm. Done."],["04","Watch It Grow","Delivery starts in seconds. Track it live."]].map(([num,title,desc],i)=>(
                <div key={num} data-reveal={String(i+1)} className="s2-step-item relative" style={{paddingRight:i<3?24:0,"--s2-step-bg":dark?"rgba(255,255,255,.07)":"rgba(255,255,255,.6)","--s2-step-border":`1px solid ${dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.1)"}`}}>
                  {i<3&&<div className="max-md:!hidden absolute top-5 left-[52px] right-0 h-px" style={{background:dark?"rgba(255,255,255,.09)":"rgba(0,0,0,.06)"}}/>}
                  <div className="flex items-center gap-3 mb-3 relative z-[1]">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0" style={{background:dark?"rgba(196,125,142,.14)":"rgba(196,125,142,.12)",border:`1px solid ${dark?"rgba(196,125,142,.24)":"rgba(196,125,142,.19)"}`,color:t.accent}}>{num}</div>
                    <span className="text-[15px] font-semibold" style={{color:t.text}}>{title}</span>
                  </div>
                  <div className="max-md:!pl-0 max-md:!text-[13px] text-sm leading-[1.55] pl-[52px]" style={{color:dark?"rgba(244,241,237,.35)":"rgba(28,27,25,.4)"}}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3 max-md:gap-2.5 px-[60px] max-desktop:px-10 max-md:px-5" style={{background:t.bgAlt}}><div className="flex-1 h-px" style={{background:`linear-gradient(90deg,transparent,${dark?"rgba(196,125,142,.2)":"rgba(196,125,142,.15)"},transparent)`}}/><div className="w-1.5 h-1.5 max-md:w-[5px] max-md:h-[5px] rounded-full opacity-50 shrink-0" style={{background:t.accent}}/><div className="flex-1 h-px" style={{background:`linear-gradient(90deg,transparent,${dark?"rgba(196,125,142,.2)":"rgba(196,125,142,.15)"},transparent)`}}/></div>

        {/* ━━━ SECTION 3: PRICING ━━━ */}
        <div className="relative overflow-hidden" style={{background:t.bg}}>
          <Waves dark={dark} />
        <section id="pricing" className="snap-section py-20 px-[60px] max-desktop:py-14 max-desktop:px-10 max-md:py-10 max-md:px-5 max-w-[1200px] mx-auto relative">
          <div className="flex flex-col text-left max-md:text-center">
            <div data-reveal className="mb-3 max-md:mb-2.5"><span className="m text-[13px] max-md:text-xs font-semibold tracking-[3px] uppercase" style={{color:t.accent}}>Pricing</span></div>
            <div className="w-full">
              <h2 data-reveal="1" className="text-4xl max-desktop:text-[32px] max-md:text-[26px] font-semibold mb-2 max-md:mb-1" style={{color:t.text}}>Pay per service, <span className="serif italic font-normal text-[40px] max-desktop:text-4xl max-md:text-[30px]" style={{color:t.accent}}>no subscriptions.</span></h2>
              <p data-reveal="2" className="text-base max-md:text-[15px] mb-10 max-desktop:mb-8 max-md:mb-6 max-w-[520px] max-desktop:max-w-[440px] max-md:max-w-[300px] max-md:mx-auto leading-[1.6] max-md:leading-[1.5]" style={{color:t.textSoft}}>No hidden fees. No monthly plans. Just fund your wallet and order.</p>

              {pricingData?.length > 0 && <div data-reveal="3" className="grid grid-cols-3 max-desktop:grid-cols-2 max-md:grid-cols-1 gap-4 max-desktop:gap-3 max-md:gap-3 mb-10 max-desktop:mb-8 max-md:mb-6 items-stretch [&>div]:flex [&>div]:flex-col">
                {pricingData.filter(p => PLATFORM_ICONS[p.platform]).slice(0, 6).map(p => {
                  const pi = PLATFORM_ICONS[p.platform](dark);
                  const isPopular = p.platform === POPULAR_PLATFORM;
                  const fromPrice = `₦${(p.minPrice / 100).toLocaleString()}`;
                  return (
                  <div key={p.platform} className="s3-card relative rounded-2xl overflow-hidden flex flex-col" style={{background:dark?"rgba(255,255,255,.09)":"rgba(255,255,255,.85)",border:`${isPopular?"1.5":"1"}px solid ${isPopular?t.accent:(dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.18)")}`}}>
                    {isPopular&&<div className="absolute top-3 right-3 py-[3px] px-2.5 rounded-md text-[10px] font-semibold tracking-[0.5px] uppercase" style={{background:dark?"rgba(196,125,142,.19)":"rgba(196,125,142,.14)",color:t.accent,border:`0.5px solid ${dark?"rgba(196,125,142,.28)":"rgba(196,125,142,.24)"}`}}>Most popular</div>}
                    <div className="pt-5 px-5 pb-4 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{background:pi.bg}}>{pi.icon}</div>
                      <span className="text-base font-semibold" style={{color:t.text}}>{p.platform}</span>
                    </div>
                    <div className="flex-1">
                      {p.services.slice(0, 3).map(s=>(
                        <div key={s.type} className="flex justify-between items-center py-3 px-5" style={{borderTop:`1px solid ${dark?"rgba(255,255,255,.16)":"rgba(0,0,0,.12)"}`}}>
                          <span className="text-sm" style={{color:dark?"rgba(244,241,237,.5)":"rgba(28,27,25,.55)"}}>{s.type}</span>
                          <span className="text-sm font-semibold" style={{color:dark?"#34d399":"#059669"}}>{s.price}</span>
                        </div>
                      ))}
                    </div>
                    <div className="py-3.5 px-5 flex justify-between items-center mt-auto" style={{borderTop:`1px solid ${dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.14)"}`,background:dark?"rgba(255,255,255,.07)":"rgba(0,0,0,.03)"}}>
                      <span className="text-[13px]" style={{color:dark?"rgba(244,241,237,.3)":"rgba(28,27,25,.35)"}}>From <strong className="text-base font-semibold" style={{color:t.text}}>{fromPrice}</strong>/1K</span>
                      <button onClick={()=>setModal("signup")} className="py-2 px-[22px] rounded-lg text-[13px] font-semibold cursor-pointer font-[inherit] transition-transform duration-200 hover:-translate-y-px" style={{border:`1.5px solid ${t.accent}`,background:dark?"rgba(196,125,142,.24)":"rgba(196,125,142,.18)",color:t.accent,transition:"all .2s"}}>Order now</button>
                    </div>
                  </div>
                  );
                })}
              </div>}

              <div data-reveal="4" className="s3-deposit flex items-center gap-4 py-5 px-6 rounded-[14px]" style={{background:dark?"rgba(52,211,153,.08)":"rgba(5,150,105,.06)",border:`1px solid ${dark?"rgba(52,211,153,.24)":"rgba(5,150,105,.19)"}`}}>
                <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{background:dark?"rgba(52,211,153,.08)":"rgba(5,150,105,.06)"}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark?"#34d399":"#059669"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold" style={{color:t.text}}>Fund your wallet from <span style={{color:dark?"#34d399":"#059669"}}>{"₦"}500</span></div>
                  <div className="text-[13px] mt-0.5" style={{color:t.textSoft}}>Cards, bank transfer, and crypto accepted. Funds arrive instantly.</div>
                </div>
                <button onClick={()=>setModal("signup")} className="s3-deposit-btn py-2.5 px-6 rounded-[10px] text-sm font-semibold border-none cursor-pointer whitespace-nowrap shrink-0 transition-transform duration-200 hover:-translate-y-px" style={{background:"#fff",color:"#1a1a1a"}}>Add funds {"→"}</button>
              </div>
            </div>
          </div>
        </section>
        </div>

        <div className="flex items-center gap-3 max-md:gap-2.5 px-[60px] max-desktop:px-10 max-md:px-5" style={{background:t.bg}}><div className="flex-1 h-px" style={{background:`linear-gradient(90deg,transparent,${dark?"rgba(196,125,142,.2)":"rgba(196,125,142,.15)"},transparent)`}}/><div className="w-1.5 h-1.5 max-md:w-[5px] max-md:h-[5px] rounded-full opacity-50 shrink-0" style={{background:t.accent}}/><div className="flex-1 h-px" style={{background:`linear-gradient(90deg,transparent,${dark?"rgba(196,125,142,.2)":"rgba(196,125,142,.15)"},transparent)`}}/></div>

        {/* ━━━ SECTION 4: TESTIMONIALS ━━━ */}
        <section id="testimonials" className="snap-section py-20 px-[60px] max-desktop:py-14 max-desktop:px-10 max-md:py-10 max-md:px-0 max-w-[1200px] mx-auto min-h-dvh max-md:min-h-0 flex flex-col justify-center" style={{backgroundColor:t.bgAlt,backgroundImage:`linear-gradient(to right,${dark?"rgba(255,255,255,.07)":"rgba(0,0,0,.04)"} 1px,transparent 1px),linear-gradient(to bottom,${dark?"rgba(255,255,255,.07)":"rgba(0,0,0,.04)"} 1px,transparent 1px)`,backgroundSize:"40px 40px"}}>
          <div className="flex justify-between items-end max-md:flex-col max-md:items-start max-md:gap-4 mb-10 max-desktop:mb-8 max-md:mb-6 max-md:px-5">
            <div className="flex-1">
              <div data-reveal className="m text-[13px] max-md:text-xs font-semibold tracking-[3px] uppercase mb-3 max-md:mb-2.5" style={{color:t.accent}}>Testimonials</div>
              <h2 data-reveal="1" className="text-4xl max-desktop:text-[32px] max-md:text-[26px] font-semibold mb-1.5 max-md:mb-1" style={{color:t.text}}>Creators who <span className="serif italic font-normal text-[40px] max-desktop:text-4xl max-md:text-[30px]" style={{color:t.accent}}>trust us.</span></h2>
              <p data-reveal="2" className="text-[15px] max-md:text-sm max-w-[440px] max-desktop:max-w-[400px] max-md:max-w-[300px] leading-[1.6]" style={{color:t.textSoft}}>Real reviews from Nigerian creators and businesses growing with Nitro.</p>
            </div>
            <div data-reveal="3" className="flex items-center gap-3 py-4 px-6 rounded-[14px] shrink-0 max-md:hidden" style={{background:dark?"rgba(255,255,255,.09)":"rgba(255,255,255,.7)",border:`1px solid ${dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.14)"}`}}>
              <span className="m text-[32px] max-md:text-2xl font-semibold leading-none" style={{color:t.text}}>4.9</span>
              <div>
                <div className="flex gap-0.5 mb-0.5">{Array(5).fill(0).map((_,j)=><svg key={j} width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}</div>
                <span className="text-xs" style={{color:t.textMuted}}>from 850+ reviews</span>
              </div>
            </div>
          </div>

          {/* Desktop/Tablet grid */}
          <div data-reveal="3" className="grid grid-cols-3 max-desktop:grid-cols-2 max-md:!hidden gap-4 max-desktop:gap-3.5 items-stretch [&>div]:flex [&>div]:flex-col">
            {[["Chioma A.","Fashion Brand Owner","I was skeptical at first, but Nitro got my content in front of the right people fast. My engagement actually went up.",5,"CA","#c47d8e"],["Tunde M.","Music Producer","Been using Nitro for 3 months to promote my YouTube channel. The pricing is unbeatable and delivery is always instant.",5,"TM","#e0a458"],["Amara O.","Content Creator","The 24/7 support is what keeps me here. I had an issue at 2AM and someone responded within minutes.",5,"AO","#6ee7b7"],["Emeka N.","Digital Marketer","I manage social media for 12 clients. Nitro's bulk pricing saves me at least ₦50K monthly.",4,"EN","#a5b4fc"],["Blessing I.","Beauty Influencer","Started with ₦500 just to test. Now I deposit ₦20K monthly. My TikTok reach has been incredible.",5,"BI","#f472b6"],["Kola D.","E-commerce Seller","Fastest promotion platform in Nigeria. Results come through in literally seconds.",5,"KD","#fbbf24"]].map(([name,role,text,rating,avatar,color],i)=>(
              <div key={i} className="p-6 max-desktop:py-5 max-desktop:px-[18px] rounded-2xl max-desktop:rounded-[14px] flex flex-col gap-3.5 max-desktop:gap-3" style={{background:dark?"rgba(255,255,255,.14)":"rgba(255,255,255,.85)",border:`1px solid ${dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.18)"}`}}>
                <div className="flex gap-[3px]">{Array(5).fill(0).map((_,j)=><svg key={j} width="14" height="14" viewBox="0 0 24 24" fill={j<rating?"#fbbf24":"none"} stroke="#fbbf24" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}</div>
                <p className="text-base max-desktop:text-[15px] leading-[1.65] flex-1" style={{color:dark?"#c0bdb8":"#444"}}>"{text}"</p>
                <div className="flex items-center gap-3 max-desktop:gap-2.5 pt-3.5 max-desktop:pt-3" style={{borderTop:`1px solid ${dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.14)"}`}}>
                  <div className="w-9 h-9 max-desktop:w-8 max-desktop:h-8 rounded-[10px] max-desktop:rounded-lg flex items-center justify-center text-sm font-semibold text-white shrink-0" style={{background:color}}>{avatar}</div>
                  <div><div className="text-[15px] max-desktop:text-sm font-semibold" style={{color:t.text}}>{name}</div><div className="text-sm max-desktop:text-[13px]" style={{color:t.textMuted}}>{role}</div></div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile horizontal scroll */}
          <div className="hidden max-md:flex max-md:gap-3 max-md:overflow-x-auto max-md:snap-x max-md:snap-mandatory max-md:px-5 max-md:pb-1 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden" ref={testimonialScrollRef} onScroll={()=>{const el=testimonialScrollRef.current;if(!el)return;const idx=Math.round(el.scrollLeft/272);setActiveTestimonial(Math.min(idx,5));}}>
            {[["Chioma A.","Fashion Brand Owner","Nitro got my content in front of the right audience fast. My engagement actually went up.",5,"CA","#c47d8e"],["Tunde M.","Music Producer","3 months promoting my YouTube. Pricing is unbeatable, delivery always instant.",5,"TM","#e0a458"],["Amara O.","Content Creator","24/7 support — had an issue at 2AM, someone responded within minutes.",5,"AO","#6ee7b7"],["Emeka N.","Digital Marketer","Managing 12 clients. Nitro saves me ₦50K monthly with bulk pricing.",4,"EN","#a5b4fc"],["Blessing I.","Beauty Influencer","Started with ₦500. My TikTok reach has been incredible since.",5,"BI","#f472b6"],["Kola D.","E-commerce Seller","Fastest promotion platform in Nigeria. Results in literally seconds.",5,"KD","#fbbf24"]].map(([name,role,text,rating,avatar,color],i)=>(
              <div key={i} className="min-w-[260px] max-w-[260px] py-4 px-3.5 rounded-[14px] flex flex-col gap-2.5 snap-start shrink-0" style={{background:dark?"rgba(255,255,255,.14)":"rgba(255,255,255,.85)",border:`1px solid ${dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.18)"}`}}>
                <div className="flex gap-[3px]">{Array(5).fill(0).map((_,j)=><svg key={j} width="12" height="12" viewBox="0 0 24 24" fill={j<rating?"#fbbf24":"none"} stroke="#fbbf24" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}</div>
                <p className="text-sm leading-[1.55] flex-1" style={{color:dark?"#c0bdb8":"#444"}}>"{text}"</p>
                <div className="flex items-center gap-2.5 pt-2.5" style={{borderTop:`1px solid ${dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.14)"}`}}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-semibold text-white shrink-0" style={{background:color}}>{avatar}</div>
                  <div><div className="text-sm font-semibold" style={{color:t.text}}>{name}</div><div className="text-sm max-desktop:text-[13px]" style={{color:t.textMuted}}>{role}</div></div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden max-md:flex max-md:justify-center max-md:gap-1.5 max-md:mt-4 max-md:px-5">
            {Array(6).fill(0).map((_,i)=><button key={i} className="w-1.5 h-1.5 rounded-full border-none p-0 transition-all duration-300" style={{background:activeTestimonial===i?t.accent:t.textMuted,opacity:activeTestimonial===i?1:.4}} onClick={()=>{testimonialScrollRef.current?.scrollTo({left:i*272,behavior:"smooth"})}} aria-label={`Testimonial ${i+1}`}/>)}
          </div>
        </section>



        {/* ━━━ SECTION 6: CTA + FOOTER ━━━ */}
        <div id="cta" className="flex flex-col snap-section">
          {/* ── CTA — FULL BLEED ── */}
          <div className="s6-cta-bleed relative overflow-hidden text-center" style={{background:dark?"#080510":"linear-gradient(180deg,"+t.bgAlt+" 0%,#c47d8e 25%,#8b4a5e 65%,#5a2d3d 100%)"}}>
            {/* Ambient orbs */}
            <div className="absolute rounded-full pointer-events-none" style={{width:550,height:550,top:"-18%",left:"12%",background:dark?"rgba(196,125,142,.14)":"rgba(255,255,255,.16)",filter:"blur(120px)"}}/>
            <div className="absolute rounded-full pointer-events-none" style={{width:400,height:400,bottom:"-12%",right:"8%",background:dark?"rgba(120,80,180,.1)":"rgba(255,255,255,.14)",filter:"blur(120px)"}}/>
            {dark&&<div className="absolute rounded-full pointer-events-none" style={{width:250,height:250,top:"35%",right:"28%",background:"rgba(52,211,153,.05)",filter:"blur(90px)"}}/>}
            {/* Concentric rings */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              {[700,480,260].map((s,i)=><div key={i} style={{width:s,height:s,borderRadius:"50%",border:`0.5px solid ${dark?`rgba(196,125,142,${.1-.02*i})`:`rgba(255,255,255,${.15-.03*i})`}`,position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)"}}/>)}
            </div>
            {/* Noise */}
            <div className="absolute inset-0 pointer-events-none opacity-[.03]" style={{backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",backgroundSize:"128px"}}/>

            <div className="relative z-[2] max-w-[640px] mx-auto pt-20 px-[60px] pb-16 max-desktop:!pt-16 max-desktop:!px-10 max-desktop:!pb-12 max-md:!pt-14 max-md:!px-6 max-md:!pb-12">
              <h2 data-reveal className="text-[60px] max-desktop:!text-[42px] max-md:!text-[34px] font-bold text-white leading-[1.02] -tracking-[2.5px] mb-1">Your Audience</h2>
              <h2 data-reveal="1" className="serif italic font-normal text-[68px] max-desktop:!text-[48px] max-md:!text-[40px] leading-[1.02] mb-5 max-desktop:!mb-5 max-md:!mb-4" style={{color:dark?"#c47d8e":"#fff",textShadow:dark?"none":"0 4px 32px rgba(0,0,0,.15)"}}>Won't Grow Itself.</h2>
              <p data-reveal="2" className="text-[17px] leading-[1.7] max-w-[440px] mx-auto mb-9 max-md:!mb-7" style={{color:dark?"rgba(255,255,255,.5)":"rgba(255,255,255,.8)"}}>Every minute you wait, your competitors are getting ahead. Join {siteStats.users||"0"} Nigerian creators already growing with Nitro.</p>

              <div data-reveal="3" className="s6-buttons flex gap-3.5 justify-center flex-wrap mb-8 max-md:!mb-6">
                <button className="s6-btn-primary py-[18px] px-14 rounded-[14px] text-base font-semibold border-none cursor-pointer relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg" onClick={()=>setModal("signup")} style={{background:"#fff",color:"#1a1a1a",boxShadow:"0 8px 32px rgba(255,255,255,.2), 0 2px 8px rgba(255,255,255,.14)"}}>Start Growing Now {"→"}</button>
                <button className="s6-btn-ghost py-[18px] px-11 rounded-[14px] text-base font-medium cursor-pointer bg-transparent transition-all duration-200 hover:-translate-y-0.5" onClick={()=>document.getElementById("pricing")?.scrollIntoView({behavior:"smooth",block:"start"})} style={{color:"#fff",border:`1px solid ${dark?"rgba(255,255,255,.2)":"rgba(255,255,255,.5)"}`,backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)"}}><span style={{opacity:.9}}>View Pricing</span></button>
              </div>

              {/* Trust strip */}
              <div data-reveal="4" className="flex justify-center gap-3 flex-wrap">
                {[["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z","Refund guarantee"],["M12 12m-10 0a10 10 0 1020 0 10 10 0 10-20 0M12 6v6l4 2","Delivery in seconds"],["M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z","24/7 support"]].map(([path,label])=>(
                  <div key={label} className="flex items-center gap-1.5 text-[12px] font-medium py-1.5 px-3.5 rounded-full" style={{color:dark?"rgba(255,255,255,.6)":"rgba(255,255,255,.85)",background:dark?"rgba(255,255,255,.09)":"rgba(255,255,255,.16)",border:`0.5px solid ${dark?"rgba(255,255,255,.12)":"rgba(255,255,255,.18)"}`}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={path}/></svg>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <footer className="py-10 px-12 max-desktop:!py-9 max-desktop:!px-10 max-md:!py-8 max-md:!px-5 pb-6 max-desktop:!pb-6 max-md:!pb-5 relative" style={{background:dark?"#030508":"#dedad4"}}>
            {/* 4-column grid */}
            <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr] max-desktop:grid-cols-3 max-md:grid-cols-2 gap-8 max-desktop:gap-7 max-md:gap-x-4 max-md:gap-y-7 mb-8">
              {/* Brand */}
              <div className="max-desktop:col-span-full">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-[7px] flex items-center justify-center" style={{background:"linear-gradient(135deg,#c47d8e,#8b5e6b)",boxShadow:"0 2px 8px rgba(196,125,142,.25)"}}><svg width="11" height="12" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg></div>
                  <span className="text-base font-bold tracking-[2px]" style={{color:t.text}}>NITRO</span>
                </div>
                <p className="text-[13px] leading-[1.7] max-w-[260px] mb-5" style={{color:dark?"rgba(244,241,237,.45)":"rgba(28,27,25,.5)"}}>We handle the promotion so you can focus on content. {siteStats.platforms?`${siteStats.platforms}+`:"35+"} platforms, Naira pricing, instant delivery.</p>
                <div className="flex gap-2.5">
                  <a href={`https://x.com/${(socialLinks.social_twitter||"TheNitroNG").replace(/^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/?/i,"").replace(/^@/,"").replace(/\/$/,"")}`} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="s6-sico w-10 h-10 rounded-[10px] flex items-center justify-center no-underline transition-transform duration-200 hover:-translate-y-px" style={{background:dark?"rgba(255,255,255,.10)":"rgba(0,0,0,.06)",border:`0.5px solid ${dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.1)"}`,color:dark?"rgba(244,241,237,.5)":"rgba(28,27,25,.45)"}}><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
                  <a href={`https://instagram.com/${(socialLinks.social_instagram||"Nitro.ng").replace(/^(https?:\/\/)?(www\.)?(instagram\.com)\/?/i,"").replace(/^@/,"").replace(/\/$/,"")}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="s6-sico w-10 h-10 rounded-[10px] flex items-center justify-center no-underline transition-transform duration-200 hover:-translate-y-px" style={{background:dark?"rgba(225,48,108,.08)":"rgba(225,48,108,.06)",border:`0.5px solid ${dark?"rgba(225,48,108,.18)":"rgba(225,48,108,.14)"}`}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>
                  {socialLinks.social_whatsapp_support&&<a href={`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="s6-sico w-10 h-10 rounded-[10px] flex items-center justify-center no-underline transition-transform duration-200 hover:-translate-y-px" style={{background:dark?"rgba(37,211,102,.08)":"rgba(37,211,102,.06)",border:`0.5px solid ${dark?"rgba(37,211,102,.18)":"rgba(37,211,102,.14)"}`}}><svg width="14" height="14" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>}
                  {socialLinks.social_telegram_support&&<a href={`https://t.me/${socialLinks.social_telegram_support.replace(/^(https?:\/\/)?(t\.me\/)?@?/,"")}`} target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="s6-sico w-10 h-10 rounded-[10px] flex items-center justify-center no-underline transition-transform duration-200 hover:-translate-y-px" style={{background:dark?"rgba(0,136,204,.08)":"rgba(0,136,204,.06)",border:`0.5px solid ${dark?"rgba(0,136,204,.18)":"rgba(0,136,204,.14)"}`}}><svg width="14" height="14" viewBox="0 0 24 24" fill="#0088cc"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a>}
                </div>
              </div>
              {/* Product */}
              <div>
                <div className="text-[11px] font-semibold tracking-[1.5px] uppercase mb-4" style={{color:dark?"rgba(244,241,237,.4)":"rgba(28,27,25,.45)"}}>Product</div>
                {[["Services","#services"],["Pricing","#pricing"],["Testimonials","#testimonials"],["Blog","/blog"]].map(([l,h])=>h.startsWith("#")?<div key={l} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} className="s6-footer-link block text-[13px] font-medium py-[5px] cursor-pointer transition-all duration-200 hover:-translate-y-px hover:opacity-80" style={{color:dark?"rgba(244,241,237,.6)":"rgba(28,27,25,.6)"}} onClick={()=>document.getElementById(h.slice(1))?.scrollIntoView({behavior:"smooth",block:"start"})}>{l}</div>:<a key={l} href={h} className="s6-footer-link block text-[13px] font-medium py-[5px] no-underline transition-all duration-200 hover:-translate-y-px hover:opacity-80" style={{color:dark?"rgba(244,241,237,.6)":"rgba(28,27,25,.6)"}}>{l}</a>)}
              </div>
              {/* Company */}
              <div>
                <div className="text-[11px] font-semibold tracking-[1.5px] uppercase mb-4" style={{color:dark?"rgba(244,241,237,.4)":"rgba(28,27,25,.45)"}}>Company</div>
                {[["FAQ","/faq"],["Terms","/terms"],["Privacy","/privacy"],["Refund","/refund"],["Cookies","/cookie"]].map(([l,h])=><a key={l} href={h} className="s6-footer-link block text-[13px] font-medium py-[5px] no-underline transition-all duration-200 hover:-translate-y-px hover:opacity-80" style={{color:dark?"rgba(244,241,237,.6)":"rgba(28,27,25,.6)"}}>{l}</a>)}
              </div>
              {/* Get in touch */}
              <div>
                <div className="text-[11px] font-semibold tracking-[1.5px] uppercase mb-4" style={{color:dark?"rgba(244,241,237,.4)":"rgba(28,27,25,.45)"}}>Get in touch</div>
                <a href={`mailto:${SITE.email.general}`} className="s6-footer-link block text-[13px] font-medium py-[5px] no-underline transition-all duration-200 hover:-translate-y-px hover:opacity-80" style={{color:dark?"rgba(244,241,237,.6)":"rgba(28,27,25,.6)"}}>{SITE.email.general}</a>
                <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} className="s6-footer-link block text-[13px] font-medium py-[5px] cursor-pointer transition-all duration-200 hover:-translate-y-px hover:opacity-80" style={{color:dark?"rgba(244,241,237,.6)":"rgba(28,27,25,.6)"}} onClick={()=>window.open(socialLinks.social_whatsapp_support?`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g,"")}`:"#","_blank")}>WhatsApp Support</div>
                <a href={SITE.status} target="_blank" rel="noopener noreferrer" className="s6-footer-link flex items-center gap-1.5 text-[13px] font-medium py-[5px] no-underline transition-all duration-200 hover:-translate-y-px hover:opacity-80" style={{color:dark?"rgba(244,241,237,.6)":"rgba(28,27,25,.6)"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Status Page</a>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px mb-5" style={{background:dark?"rgba(255,255,255,.09)":"rgba(0,0,0,.06)"}}/>

            {/* Bottom bar */}
            <div className="flex justify-between items-center max-md:!flex-col max-md:gap-2 max-md:text-center">
              <span className="text-xs" style={{color:dark?"rgba(244,241,237,.35)":"rgba(28,27,25,.4)"}}>{"©"} {new Date().getFullYear()>2025?`2025–${new Date().getFullYear()}`:"2025"} The Nitro NG. All rights reserved. RC 9514845</span>
              <span className="text-xs" style={{color:dark?"rgba(244,241,237,.3)":"rgba(28,27,25,.35)"}}>Built in Lagos 🇳🇬</span>
            </div>
          </footer>
        </div>{/* end s6-wrapper */}
    </div>
  );
}
