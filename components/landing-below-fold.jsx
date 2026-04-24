'use client';
import { useState, useRef } from 'react';
import { SITE } from '@/lib/site';

export default function LandingBelowFold({ t, dark, setModal, siteStats, socialLinks }) {
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const testimonialScrollRef = useRef(null);

  return (
    <>
        {/* ━━━ SECTION 2: WHY NITRO + HOW IT WORKS ━━━ */}
        <section id="services" className="s2 snap-section min-h-dvh flex flex-col justify-center p-0 max-desktop:py-14 max-desktop:px-10 max-md:py-10 max-md:px-5 relative overflow-hidden" style={{background:t.bgAlt}}>

          {/* WHY NITRO — split layout */}
          <div className="grid grid-cols-[1fr_1.2fr] max-desktop:!grid-cols-1 gap-[60px] max-desktop:!gap-8 max-md:!gap-6 py-20 px-12 max-desktop:!py-14 max-desktop:!px-10 max-md:!py-12 max-md:!px-5 items-center">
            <div>
              <div className="text-xs font-medium tracking-[2px] uppercase mb-4" style={{color:t.accent}}>Why Nitro</div>
              <h2 className="text-[48px] max-desktop:!text-4xl max-md:!text-[28px] font-bold leading-[1.05] -tracking-[1.5px] mb-4" style={{color:t.text}}>Grow your brand.<br/>Keep your audience.<br/><span className="serif max-desktop:!text-[40px] max-md:!text-[32px] italic font-normal text-[54px] block" style={{color:t.accent}}>No bots. No drops.</span></h2>
              <p className="text-base leading-[1.7] max-w-[400px] mb-7" style={{color:t.textSoft}}>We built Nitro for Nigerian creators who are tired of slow delivery, fake engagement, and platforms that disappear overnight.</p>
              <div className="flex gap-8">
                {[["25+","Platforms"],["98%","Delivery rate"],["<60s","Avg. start time"]].map(([num,label])=>(
                  <div key={label}><div className="text-[28px] font-semibold leading-none mb-1" style={{color:t.text}}>{num}</div><div className="text-[13px]" style={{color:t.textMuted}}>{label}</div></div>
                ))}
              </div>
            </div>
            <div className="s2-feat-list flex flex-col gap-2">
              {[[<svg key="f1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c47d8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,"Instant Delivery","Orders start processing within seconds, not hours.","rgba(196,125,142,.08)"],[<svg key="f2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e0a458" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,"Lowest Rates in Nigeria","Direct provider pricing with no middleman markup.","rgba(224,164,88,.08)"],[<svg key="f3" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,"Real Engagement","Genuine accounts that stick. No bots, no drops.","rgba(110,231,183,.06)"],[<svg key="f4" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,"24/7 Human Support","Real people on WhatsApp and live chat, any time.","rgba(165,180,252,.06)"],[<svg key="f5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,"Free Auto-Refill","Followers drop? We top them up automatically, free.","rgba(251,191,36,.06)"]].map(([icon,title,desc,bg])=>(
                <div key={title} className="s2-feat-row flex items-start gap-4 py-[18px] px-5 rounded-[14px]" style={{background:dark?"rgba(255,255,255,.04)":"rgba(255,255,255,.6)",border:`1px solid ${dark?"rgba(255,255,255,.1)":"rgba(0,0,0,.1)"}`,transition:"border-color .2s"}}>
                  <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0" style={{background:bg}}>{icon}</div>
                  <div className="flex-1"><div className="text-[15px] font-semibold mb-0.5" style={{color:t.text}}>{title}</div><div className="max-md:hidden text-sm leading-[1.5]" style={{color:dark?"rgba(244,241,237,.35)":"rgba(28,27,25,.4)"}}>{desc}</div></div>
                </div>
              ))}
            </div>
          </div>

          {/* HOW IT WORKS — horizontal timeline */}
          <div className="s2-how pt-[60px] px-12 pb-20 -mx-12" style={{background:dark?"rgba(0,0,0,.24)":"rgba(0,0,0,.06)",borderTop:`1px solid ${dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)"}`,borderBottom:`1px solid ${dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)"}`}}>
            <div className="flex items-baseline gap-4 mb-10">
              <h3 className="text-[28px] font-semibold -tracking-[0.5px]" style={{color:t.text}}>How it <span className="serif italic font-medium text-[32px]" style={{color:t.accent}}>works</span></h3>
              <div className="flex-1 h-px" style={{background:dark?"rgba(255,255,255,.06)":"rgba(0,0,0,.06)"}}/>
            </div>
            <div className="grid grid-cols-4 max-md:!grid-cols-2 gap-0 max-md:!gap-2.5">
              {[["01","Create Account","Sign up free in 30 seconds. No card required."],["02","Add Funds","Pay via card, bank transfer, or crypto. Instant."],["03","Place Order","Pick a service, paste your link, confirm. Done."],["04","Watch It Grow","Delivery starts in seconds. Track it live."]].map(([num,title,desc],i)=>(
                <div key={num} className="s2-step-item relative" style={{paddingRight:i<3?24:0,"--s2-step-bg":dark?"rgba(255,255,255,.04)":"rgba(255,255,255,.5)","--s2-step-border":`1px solid ${dark?"rgba(255,255,255,.1)":"rgba(0,0,0,.1)"}`}}>
                  {i<3&&<div className="max-md:!hidden absolute top-5 left-[52px] right-0 h-px" style={{background:dark?"rgba(255,255,255,.06)":"rgba(0,0,0,.06)"}}/>}
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
        <section id="pricing" className="snap-section py-20 px-[60px] max-desktop:py-14 max-desktop:px-10 max-md:py-10 max-md:px-5 max-w-[1200px] mx-auto" style={{background:t.bg}}>
          <div className="flex flex-col text-left max-md:text-center">
            <div className="mb-3 max-md:mb-2.5"><span className="m text-[13px] max-md:text-xs font-semibold tracking-[3px] uppercase" style={{color:t.accent}}>Pricing</span></div>
            <div className="w-full">
              <h2 className="text-4xl max-desktop:text-[32px] max-md:text-[26px] font-semibold mb-2 max-md:mb-1" style={{color:t.text}}>Pay per service, <span className="serif italic font-normal text-[40px] max-desktop:text-4xl max-md:text-[30px]" style={{color:t.accent}}>no subscriptions.</span></h2>
              <p className="text-base max-md:text-[15px] mb-10 max-desktop:mb-8 max-md:mb-6 max-w-[520px] max-desktop:max-w-[440px] max-md:max-w-[300px] max-md:mx-auto leading-[1.6] max-md:leading-[1.5]" style={{color:t.textSoft}}>No hidden fees. No monthly plans. Just fund your wallet and order. Prices start from <strong style={{color:dark?"#34d399":"#059669"}}>{"₦"}150 per 1,000</strong>.</p>

              <div className="grid grid-cols-3 max-desktop:grid-cols-2 max-md:grid-cols-1 gap-4 max-desktop:gap-3 max-md:gap-3 mb-10 max-desktop:mb-8 max-md:mb-6 items-stretch [&>div]:flex [&>div]:flex-col">
                {[["Instagram",<svg key="ig" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,"rgba(225,48,108,.08)",[["Followers","₦850/1K"],["Likes","₦400/1K"],["Views","₦200/1K"]],"₦200",true],["TikTok",<svg key="tt" width="16" height="18" viewBox="0 0 448 512" fill="#ff0050"><path d="M448 209.91a210.06 210.06 0 01-122.77-39.25v178.72A162.55 162.55 0 11185 188.31v89.89a74.62 74.62 0 1052.23 71.18V0h88a121 121 0 00122.77 121.33z"/></svg>,"rgba(255,0,80,.06)",[["Followers","₦1,200/1K"],["Likes","₦500/1K"],["Views","₦150/1K"]],"₦150",false],["YouTube",<svg key="yt" width="20" height="14" viewBox="0 0 576 512" fill="#FF0000"><path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z"/></svg>,"rgba(255,0,0,.06)",[["Subscribers","₦2,500/1K"],["Views","₦350/1K"],["Likes","₦600/1K"]],"₦350",false],["Twitter/X",<svg key="x" width="16" height="16" viewBox="0 0 24 24" fill={dark?"#eee":"#222"}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,dark?"rgba(255,255,255,.04)":"rgba(0,0,0,.04)",[["Followers","₦1,000/1K"],["Likes","₦450/1K"],["Retweets","₦700/1K"]],"₦450",false],["Facebook",<svg key="fb" width="10" height="18" viewBox="0 0 320 512" fill="#1877F2"><path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z"/></svg>,"rgba(24,119,242,.06)",[["Page Likes","₦900/1K"],["Followers","₦1,100/1K"],["Post Likes","₦350/1K"]],"₦350",false],["Telegram",<svg key="tg" width="18" height="16" viewBox="0 0 496 512" fill="#0088cc"><path d="M248 8C111.033 8 0 119.033 0 256s111.033 248 248 248 248-111.033 248-248S384.967 8 248 8zm114.952 168.66c-3.732 39.215-19.881 134.378-28.1 178.3-3.476 18.584-10.322 24.816-16.948 25.425-14.4 1.326-25.338-9.517-39.287-18.661-21.827-14.308-34.158-23.215-55.346-37.177-24.485-16.135-8.612-25 5.342-39.5 3.652-3.793 67.107-61.51 68.335-66.746.154-.655.3-3.1-1.154-4.384s-3.59-.849-5.135-.5q-3.283.746-104.608 69.142-14.845 10.194-26.894 9.934c-8.855-.191-25.888-5.006-38.551-9.123-15.531-5.048-27.875-7.717-26.8-16.291q.84-6.7 18.45-13.7 108.446-47.248 144.628-62.3c68.872-28.647 83.183-33.623 92.511-33.789 2.052-.034 6.639.474 9.61 2.885a10.452 10.452 0 013.53 6.716 43.765 43.765 0 01.417 9.769z"/></svg>,"rgba(0,136,204,.06)",[["Members","₦1,500/1K"],["Post Views","₦250/1K"],["Reactions","₦500/1K"]],"₦250",false]].map(([platform,icon,iconBg,services,fromPrice,isPopular])=>(
                  <div key={platform} className="s3-card relative rounded-2xl overflow-hidden flex flex-col" style={{background:dark?"rgba(255,255,255,.06)":"rgba(255,255,255,.85)",border:`${isPopular?"1.5":"1"}px solid ${isPopular?t.accent:(dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.18)")}`}}>
                    {isPopular&&<div className="absolute top-3 right-3 py-[3px] px-2.5 rounded-md text-[10px] font-semibold tracking-[0.5px] uppercase" style={{background:dark?"rgba(196,125,142,.19)":"rgba(196,125,142,.14)",color:t.accent,border:`0.5px solid ${dark?"rgba(196,125,142,.28)":"rgba(196,125,142,.24)"}`}}>Most popular</div>}
                    <div className="pt-5 px-5 pb-4 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{background:iconBg}}>{icon}</div>
                      <span className="text-base font-semibold" style={{color:t.text}}>{platform}</span>
                    </div>
                    <div className="flex-1">
                      {services.map(([svc,price])=>(
                        <div key={svc} className="flex justify-between items-center py-3 px-5" style={{borderTop:`1px solid ${dark?"rgba(255,255,255,.12)":"rgba(0,0,0,.12)"}`}}>
                          <span className="text-sm" style={{color:dark?"rgba(244,241,237,.5)":"rgba(28,27,25,.55)"}}>{svc}</span>
                          <span className="text-sm font-semibold" style={{color:dark?"#34d399":"#059669"}}>{price}</span>
                        </div>
                      ))}
                    </div>
                    <div className="py-3.5 px-5 flex justify-between items-center mt-auto" style={{borderTop:`1px solid ${dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.14)"}`,background:dark?"rgba(255,255,255,.04)":"rgba(0,0,0,.03)"}}>
                      <span className="text-[13px]" style={{color:dark?"rgba(244,241,237,.3)":"rgba(28,27,25,.35)"}}>From <strong className="text-base font-semibold" style={{color:t.text}}>{fromPrice}</strong>/1K</span>
                      <button onClick={()=>setModal("signup")} className="py-2 px-[22px] rounded-lg text-[13px] font-semibold cursor-pointer font-[inherit] transition-transform duration-200 hover:-translate-y-px" style={{border:`1.5px solid ${t.accent}`,background:dark?"rgba(196,125,142,.24)":"rgba(196,125,142,.18)",color:t.accent,transition:"all .2s"}}>Order now</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="s3-deposit flex items-center gap-4 py-5 px-6 rounded-[14px]" style={{background:dark?"rgba(52,211,153,.08)":"rgba(5,150,105,.06)",border:`1px solid ${dark?"rgba(52,211,153,.24)":"rgba(5,150,105,.19)"}`}}>
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

        <div className="flex items-center gap-3 max-md:gap-2.5 px-[60px] max-desktop:px-10 max-md:px-5" style={{background:t.bg}}><div className="flex-1 h-px" style={{background:`linear-gradient(90deg,transparent,${dark?"rgba(196,125,142,.2)":"rgba(196,125,142,.15)"},transparent)`}}/><div className="w-1.5 h-1.5 max-md:w-[5px] max-md:h-[5px] rounded-full opacity-50 shrink-0" style={{background:t.accent}}/><div className="flex-1 h-px" style={{background:`linear-gradient(90deg,transparent,${dark?"rgba(196,125,142,.2)":"rgba(196,125,142,.15)"},transparent)`}}/></div>

        {/* ━━━ SECTION 4: TESTIMONIALS ━━━ */}
        <section id="testimonials" className="snap-section py-20 px-[60px] max-desktop:py-14 max-desktop:px-10 max-md:py-10 max-md:px-0 max-w-[1200px] mx-auto min-h-dvh max-md:min-h-0 flex flex-col justify-center" style={{background:t.bgAlt}}>
          <div className="flex justify-between items-end max-md:flex-col max-md:items-start max-md:gap-4 mb-10 max-desktop:mb-8 max-md:mb-6 max-md:px-5">
            <div className="flex-1">
              <div className="m text-[13px] max-md:text-xs font-semibold tracking-[3px] uppercase mb-3 max-md:mb-2.5" style={{color:t.accent}}>Testimonials</div>
              <h2 className="text-4xl max-desktop:text-[32px] max-md:text-[26px] font-semibold mb-1.5 max-md:mb-1" style={{color:t.text}}>Creators who <span className="serif italic font-normal text-[40px] max-desktop:text-4xl max-md:text-[30px]" style={{color:t.accent}}>trust us.</span></h2>
              <p className="text-[15px] max-md:text-sm max-w-[440px] max-desktop:max-w-[400px] max-md:max-w-[300px] leading-[1.6]" style={{color:t.textSoft}}>Real reviews from Nigerian creators and businesses growing with Nitro.</p>
            </div>
            <div className="flex items-center gap-3 py-4 px-6 max-md:py-3 max-md:px-4 rounded-[14px] shrink-0" style={{background:dark?"rgba(255,255,255,.06)":"rgba(255,255,255,.7)",border:`1px solid ${dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.14)"}`}}>
              <span className="m text-[32px] max-md:text-2xl font-semibold leading-none" style={{color:t.text}}>4.9</span>
              <div>
                <div className="flex gap-0.5 mb-0.5">{Array(5).fill(0).map((_,j)=><svg key={j} width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}</div>
                <span className="text-xs" style={{color:t.textMuted}}>from 850+ reviews</span>
              </div>
            </div>
          </div>

          {/* Desktop/Tablet grid */}
          <div className="grid grid-cols-3 max-desktop:grid-cols-2 max-md:!hidden gap-4 max-desktop:gap-3.5 items-stretch [&>div]:flex [&>div]:flex-col">
            {[["Chioma A.","Fashion Brand Owner","I was skeptical at first, but Nitro delivered 5K followers to my business page in under 2 hours. My engagement actually went up.",5,"CA","#c47d8e"],["Tunde M.","Music Producer","Been using Nitro for 3 months to boost my YouTube views. The pricing is unbeatable and delivery is always instant.",5,"TM","#e0a458"],["Amara O.","Content Creator","The 24/7 support is what keeps me here. I had an issue at 2AM and someone responded within minutes.",5,"AO","#6ee7b7"],["Emeka N.","Digital Marketer","I manage social media for 12 clients. Nitro's bulk pricing saves me at least ₦50K monthly.",4,"EN","#a5b4fc"],["Blessing I.","Beauty Influencer","Started with ₦500 just to test. Now I deposit ₦20K monthly. My TikTok grew from 2K to 45K in 4 months.",5,"BI","#f472b6"],["Kola D.","E-commerce Seller","Fastest delivery I've seen from any Nigerian SMM panel. Instagram likes come through in literally seconds.",5,"KD","#fbbf24"]].map(([name,role,text,rating,avatar,color],i)=>(
              <div key={i} className="p-6 max-desktop:py-5 max-desktop:px-[18px] rounded-2xl max-desktop:rounded-[14px] flex flex-col gap-3.5 max-desktop:gap-3" style={{background:dark?"rgba(255,255,255,.1)":"rgba(255,255,255,.85)",border:`1px solid ${dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.18)"}`}}>
                <div className="flex gap-[3px]">{Array(5).fill(0).map((_,j)=><svg key={j} width="14" height="14" viewBox="0 0 24 24" fill={j<rating?"#fbbf24":"none"} stroke="#fbbf24" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}</div>
                <p className="text-base max-desktop:text-[15px] leading-[1.65] flex-1" style={{color:dark?"#c0bdb8":"#444"}}>"{text}"</p>
                <div className="flex items-center gap-3 max-desktop:gap-2.5 pt-3.5 max-desktop:pt-3" style={{borderTop:`1px solid ${dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.14)"}`}}>
                  <div className="w-9 h-9 max-desktop:w-8 max-desktop:h-8 rounded-[10px] max-desktop:rounded-lg flex items-center justify-center text-sm font-semibold text-white shrink-0" style={{background:color}}>{avatar}</div>
                  <div><div className="text-[15px] max-desktop:text-sm font-semibold" style={{color:t.text}}>{name}</div><div className="text-sm max-desktop:text-[13px]" style={{color:t.textMuted}}>{role}</div></div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile horizontal scroll */}
          <div className="hidden max-md:flex max-md:gap-3 max-md:overflow-x-auto max-md:snap-x max-md:snap-mandatory max-md:px-5 max-md:pb-1 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden" ref={testimonialScrollRef} onScroll={()=>{const el=testimonialScrollRef.current;if(!el)return;const idx=Math.round(el.scrollLeft/272);setActiveTestimonial(Math.min(idx,5));}}>
            {[["Chioma A.","Fashion Brand Owner","Nitro delivered 5K followers in under 2 hours. My engagement actually went up.",5,"CA","#c47d8e"],["Tunde M.","Music Producer","3 months boosting YouTube views. Pricing is unbeatable, delivery always instant.",5,"TM","#e0a458"],["Amara O.","Content Creator","24/7 support — had an issue at 2AM, someone responded within minutes.",5,"AO","#6ee7b7"],["Emeka N.","Digital Marketer","Managing 12 clients. Nitro saves me ₦50K monthly with bulk pricing.",4,"EN","#a5b4fc"],["Blessing I.","Beauty Influencer","Started with ₦500. TikTok grew from 2K to 45K in 4 months.",5,"BI","#f472b6"],["Kola D.","E-commerce Seller","Fastest Nigerian SMM panel. Instagram likes in literally seconds.",5,"KD","#fbbf24"]].map(([name,role,text,rating,avatar,color],i)=>(
              <div key={i} className="min-w-[260px] max-w-[260px] py-4 px-3.5 rounded-[14px] flex flex-col gap-2.5 snap-start shrink-0" style={{background:dark?"rgba(255,255,255,.1)":"rgba(255,255,255,.85)",border:`1px solid ${dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.18)"}`}}>
                <div className="flex gap-[3px]">{Array(5).fill(0).map((_,j)=><svg key={j} width="12" height="12" viewBox="0 0 24 24" fill={j<rating?"#fbbf24":"none"} stroke="#fbbf24" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}</div>
                <p className="text-sm leading-[1.55] flex-1" style={{color:dark?"#c0bdb8":"#444"}}>"{text}"</p>
                <div className="flex items-center gap-2.5 pt-2.5" style={{borderTop:`1px solid ${dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.14)"}`}}>
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
        <div id="cta" className="min-h-dvh flex flex-col snap-section">
          {/* ── CTA — FULL BLEED ── */}
          <div className="s6-cta-bleed relative overflow-hidden text-center" style={{background:dark?"#080510":"linear-gradient(180deg,"+t.bgAlt+" 0%,#c47d8e 25%,#8b4a5e 65%,#5a2d3d 100%)"}}>
            {/* Ambient orbs */}
            <div className="absolute rounded-full pointer-events-none" style={{width:500,height:500,top:"-20%",left:"15%",background:dark?"rgba(196,125,142,.12)":"rgba(255,255,255,.1)",filter:"blur(100px)"}}/>
            <div className="absolute rounded-full pointer-events-none" style={{width:350,height:350,bottom:"-10%",right:"10%",background:dark?"rgba(120,80,180,.08)":"rgba(255,255,255,.08)",filter:"blur(100px)"}}/>
            {dark&&<div className="absolute rounded-full pointer-events-none" style={{width:200,height:200,top:"40%",right:"30%",background:"rgba(52,211,153,.04)",filter:"blur(80px)"}}/>}
            {/* Concentric rings */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              {[600,400,200].map((s,i)=><div key={i} style={{width:s,height:s,borderRadius:"50%",border:`0.5px solid ${dark?`rgba(196,125,142,${.06-.015*i})`:`rgba(255,255,255,${.1-.02*i})`}`,position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)"}}/>)}
            </div>
            {/* Noise */}
            <div className="absolute inset-0 pointer-events-none opacity-[.03]" style={{backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",backgroundSize:"128px"}}/>

            <div className="relative z-[2] max-w-[640px] mx-auto pt-16 px-[60px] pb-12 max-desktop:!pt-12 max-desktop:!px-10 max-desktop:!pb-9 max-md:!pt-11 max-md:!px-6 max-md:!pb-9">
              <h2 className="text-[60px] max-desktop:!text-[42px] max-md:!text-[34px] font-bold text-white leading-[1.02] -tracking-[2.5px] mb-1">Your Audience</h2>
              <h2 className="serif italic font-normal text-[68px] max-desktop:!text-[48px] max-md:!text-[40px] leading-[1.02] mb-4 max-desktop:!mb-4 max-md:!mb-3.5" style={{color:dark?"#c47d8e":"#fff",textShadow:dark?"none":"0 4px 32px rgba(0,0,0,.15)"}}>Won't Grow Itself.</h2>
              <p className="text-[17px] leading-[1.7] max-w-[440px] mx-auto mb-7" style={{color:dark?"rgba(255,255,255,.4)":"rgba(255,255,255,.8)"}}>Every minute you wait, your competitors are getting ahead. Join {siteStats.users||"0"} Nigerian creators already growing with Nitro.</p>

              <div className="s6-buttons flex gap-3.5 justify-center flex-wrap mb-6">
                <button className="s6-btn-primary py-[18px] px-14 rounded-[14px] text-base font-semibold border-none cursor-pointer relative overflow-hidden transition-transform duration-200 hover:-translate-y-px" onClick={()=>setModal("signup")} style={{background:"#fff",color:"#1a1a1a",boxShadow:"0 12px 48px rgba(255,255,255,.18)"}}>Start Growing Now {"→"}</button>
                <button className="s6-btn-ghost py-[18px] px-11 rounded-[14px] text-base font-medium cursor-pointer bg-transparent transition-transform duration-200 hover:-translate-y-px" onClick={()=>document.getElementById("pricing")?.scrollIntoView({behavior:"smooth"})} style={{color:"#fff",border:`1px solid ${dark?"rgba(255,255,255,.14)":"rgba(255,255,255,.31)"}`}}>View Pricing</button>
              </div>

              {/* Trust strip */}
              <div className="flex justify-center gap-7 flex-wrap">
                {[["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z","Refund guarantee"],["M12 12m-10 0a10 10 0 1020 0 10 10 0 10-20 0M12 6v6l4 2","Delivery in seconds"],["M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z","24/7 support"]].map(([path,label])=>(
                  <div key={label} className="flex items-center gap-1.5 text-[13px] font-medium" style={{color:dark?"rgba(255,255,255,.4)":"rgba(255,255,255,.7)"}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={path}/></svg>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <footer className="py-8 px-12 max-desktop:!py-9 max-desktop:!px-10 max-md:!py-7 max-md:!px-5 pb-5 max-desktop:!pb-6 max-md:!pb-4 relative" style={{background:dark?"#030508":"#dedad4"}}>
            {/* Accent line */}
            <div className="h-px mb-6" style={{background:`linear-gradient(90deg,transparent,${dark?"rgba(196,125,142,.15)":"rgba(196,125,142,.1)"},transparent)`}}/>

            {/* 4-column grid */}
            <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr] max-desktop:grid-cols-3 max-md:grid-cols-2 gap-8 max-desktop:gap-7 max-md:gap-x-4 max-md:gap-y-6 mb-7">
              {/* Brand */}
              <div className="max-desktop:col-span-full">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="w-7 h-7 rounded-[7px] flex items-center justify-center" style={{background:"linear-gradient(135deg,#c47d8e,#8b5e6b)",boxShadow:"0 2px 8px rgba(196,125,142,.25)"}}><svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                  <span className="text-base font-bold tracking-[2px]" style={{color:t.text}}>NITRO</span>
                </div>
                <p className="text-sm leading-[1.65] max-w-[260px] mb-5" style={{color:dark?"rgba(244,241,237,.3)":"rgba(28,27,25,.4)"}}>Nigeria's fastest SMM panel. Real followers, real engagement, instant delivery across 25+ platforms.</p>
                <div className="flex gap-2">
                  {[[`https://x.com/${socialLinks.social_twitter||"TheNitroNG"}`,<svg key="x" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,"X (Twitter)"],[`https://instagram.com/${socialLinks.social_instagram||"Nitro.ng"}`,<svg key="ig" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,"Instagram"]].map(([href,icon,label],i)=>(
                    <a key={i} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="s6-sico w-[44px] h-[44px] rounded-[10px] flex items-center justify-center no-underline" style={{background:dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)",border:`0.5px solid ${dark?"rgba(255,255,255,.12)":"rgba(0,0,0,.12)"}`,color:dark?"rgba(244,241,237,.6)":"rgba(28,27,25,.55)"}}>{icon}</a>
                  ))}
                  {socialLinks.social_whatsapp&&<a href={socialLinks.social_whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="s6-sico w-[44px] h-[44px] rounded-[10px] flex items-center justify-center no-underline" style={{background:dark?"rgba(37,211,102,.08)":"rgba(37,211,102,.06)",border:`0.5px solid ${dark?"rgba(37,211,102,.18)":"rgba(37,211,102,.14)"}`}}><svg width="14" height="14" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>}
                  {socialLinks.social_telegram&&<a href={socialLinks.social_telegram} target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="s6-sico w-[44px] h-[44px] rounded-[10px] flex items-center justify-center no-underline" style={{background:dark?"rgba(0,136,204,.08)":"rgba(0,136,204,.06)",border:`0.5px solid ${dark?"rgba(0,136,204,.18)":"rgba(0,136,204,.14)"}`}}><svg width="14" height="14" viewBox="0 0 24 24" fill="#0088cc"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a>}
                </div>
              </div>
              {/* Product */}
              <div>
                <div className="text-[11px] font-semibold tracking-[1.5px] uppercase mb-4" style={{color:dark?"rgba(244,241,237,.2)":"rgba(28,27,25,.25)"}}>Product</div>
                {[["Services","#services"],["Pricing","#pricing"],["Testimonials","#testimonials"],["Blog","/blog"]].map(([l,h])=>h.startsWith("#")?<div key={l} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} className="s6-footer-link block text-sm font-medium py-[5px] cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{color:dark?"rgba(244,241,237,.45)":"rgba(28,27,25,.5)"}} onClick={()=>document.getElementById(h.slice(1))?.scrollIntoView({behavior:"smooth"})}>{l}</div>:<a key={l} href={h} className="s6-footer-link block text-sm font-medium py-[5px] no-underline" style={{color:dark?"rgba(244,241,237,.45)":"rgba(28,27,25,.5)"}}>{l}</a>)}
              </div>
              {/* Company */}
              <div>
                <div className="text-[11px] font-semibold tracking-[1.5px] uppercase mb-4" style={{color:dark?"rgba(244,241,237,.2)":"rgba(28,27,25,.25)"}}>Company</div>
                {[["FAQ","/faq"],["Terms","/terms"],["Privacy","/privacy"],["Refund","/refund"],["Cookies","/cookie"]].map(([l,h])=><a key={l} href={h} className="s6-footer-link block text-sm font-medium py-[5px] no-underline" style={{color:dark?"rgba(244,241,237,.45)":"rgba(28,27,25,.5)"}}>{l}</a>)}
              </div>
              {/* Get in touch */}
              <div>
                <div className="text-[11px] font-semibold tracking-[1.5px] uppercase mb-4" style={{color:dark?"rgba(244,241,237,.2)":"rgba(28,27,25,.25)"}}>Get in touch</div>
                <a href={`mailto:${SITE.email.general}`} className="s6-footer-link block text-[13px] font-medium py-[5px] no-underline" style={{color:dark?"rgba(244,241,237,.45)":"rgba(28,27,25,.5)"}}>{SITE.email.general}</a>
                <div role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click()}}} className="s6-footer-link block text-sm font-medium py-[5px] cursor-pointer" style={{color:dark?"rgba(244,241,237,.45)":"rgba(28,27,25,.5)"}} onClick={()=>window.open(socialLinks.social_whatsapp_support?`https://wa.me/${socialLinks.social_whatsapp_support}`:"#","_blank")}>WhatsApp Support</div>
                <a href={SITE.status} target="_blank" rel="noopener noreferrer" className="s6-footer-link flex items-center gap-1.5 text-sm font-medium py-[5px] no-underline" style={{color:dark?"rgba(244,241,237,.45)":"rgba(28,27,25,.5)"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Status Page</a>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px mb-[22px]" style={{background:dark?"rgba(255,255,255,.05)":"rgba(0,0,0,.05)"}}/>

            {/* Bottom bar */}
            <div className="flex justify-between items-center pt-5 max-md:pt-3.5 max-md:!flex-col max-md:gap-2.5 max-md:text-center">
              <span className="text-[13px]" style={{color:dark?"rgba(244,241,237,.2)":"rgba(28,27,25,.25)"}}>{"©"} {new Date().getFullYear()>2026?`2026–${new Date().getFullYear()}`:"2026"} Nitro. All rights reserved.</span>
              <div className="flex items-center gap-4">
                <a href="/terms" className="text-xs no-underline" style={{color:dark?"rgba(244,241,237,.2)":"rgba(28,27,25,.25)"}}>Terms</a>
                <a href="/privacy" className="text-xs no-underline" style={{color:dark?"rgba(244,241,237,.2)":"rgba(28,27,25,.25)"}}>Privacy</a>
                <span className="text-xs" style={{color:dark?"rgba(244,241,237,.15)":"rgba(28,27,25,.2)"}}>Built in Lagos 🇳🇬</span>
              </div>
            </div>
          </footer>
        </div>{/* end s6-wrapper */}
    </>
  );
}
