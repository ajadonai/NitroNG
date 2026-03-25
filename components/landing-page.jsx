'use client';
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

function ThemeToggle({dark,onToggle,compact}){
  return <button onClick={onToggle} style={{display:"flex",alignItems:"center",background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)",borderRadius:20,padding:3,width:compact?52:64,height:compact?28:32,border:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)"}`,position:"relative",flexShrink:0,transition:"background 1.5s cubic-bezier(.4,0,.2,1),border-color 1.5s ease"}}><div style={{width:compact?22:26,height:compact?22:26,borderRadius:"50%",background:dark?"#c47d8e":"#e0a458",display:"flex",alignItems:"center",justifyContent:"center",fontSize:compact?12:14,position:"absolute",left:dark?3:(compact?27:35),transition:"left 0.4s cubic-bezier(.4,0,.2,1),background 1.5s cubic-bezier(.4,0,.2,1)",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}>{dark?"🌙":"☀️"}</div></button>;
}

function useReveal(){
  const ref=useRef(null);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    const el=ref.current;if(!el)return;
    const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting){setVisible(true);obs.disconnect();}},{threshold:0.15});
    obs.observe(el);return()=>obs.disconnect();
  },[]);
  return [ref,visible];
}
function Reveal({children,delay=0,style={}}){
  const [ref,v]=useReveal();
  return <div ref={ref} style={{opacity:v?1:0,transform:v?"translateY(0)":"translateY(30px)",transition:`opacity 0.7s cubic-bezier(.4,0,.2,1) ${delay}s, transform 0.7s cubic-bezier(.4,0,.2,1) ${delay}s`,...style}}>{children}</div>;
}

export default function Landing(){
  const getAuto=()=>{const h=new Date().getHours(),m=new Date().getMinutes();if(h>=7&&h<18)return false;if(h>=19||h<6)return true;if(h===6)return m<30;if(h===18)return m>=30;return true;};
  const [dark,setDark]=useState(getAuto);
  const [mo,setMo]=useState(false);
  const [modal,setModal]=useState(null);
  const [faqOpen,setFaqOpen]=useState(null);
  const [scrolled,setScrolled]=useState(false);
  const [siteStats,setSiteStats]=useState({users:"12K+",orders:"2M+"});
  const [promoBanner,setPromoBanner]=useState({message:"New! Sign up today and get 10% bonus on your first deposit.",type:"info"});
  const [siteAlerts,setSiteAlerts]=useState([]);
  useEffect(()=>{if(mo)return;const iv=setInterval(()=>setDark(getAuto()),60000);return()=>clearInterval(iv);},[mo]);
  useEffect(()=>{const onScroll=()=>setScrolled(window.scrollY>20);window.addEventListener("scroll",onScroll);return()=>window.removeEventListener("scroll",onScroll);},[]);
  useEffect(()=>{const p=new URLSearchParams(window.location.search);if(p.get("login"))setModal("login");if(p.get("signup"))setModal("signup");if(p.get("ref")){setModal("signup");}},[]);
  useEffect(()=>{(async()=>{try{const res=await fetch("/api/site-info");if(res.ok){const d=await res.json();if(d.stats)setSiteStats(d.stats);if(d.promo)setPromoBanner(d.promo);else setPromoBanner(null);if(d.alerts?.length)setSiteAlerts(d.alerts);}}catch{}})();},[]);
  const closeModal=useCallback(()=>setModal(null),[]);
  const toggleTheme=()=>{setMo(true);setDark(d=>!d);};

  const t=useMemo(()=>({
    bg:dark?"#080b14":"#f4f1ed",text:dark?"#e8e4df":"#1a1a1a",textSoft:dark?"#8a8680":"#888580",textMuted:dark?"#555250":"#b0ada8",
    surface:dark?"rgba(15,18,30,0.85)":"rgba(255,255,255,0.9)",surfaceBorder:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.08)",
    inputBg:dark?"#0d1020":"#fff",inputBorder:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)",
    accent:"#c47d8e",accentLight:dark?"rgba(196,125,142,0.12)":"rgba(196,125,142,0.08)",
    green:dark?"#6ee7b7":"#059669",
    btnPrimary:"linear-gradient(135deg,#c47d8e,#a3586b)",
    btnSecondary:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)",btnSecBorder:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",
    logoGrad:"linear-gradient(135deg,#c47d8e,#8b5e6b)",
    overlay:dark?"rgba(0,0,0,0.7)":"rgba(0,0,0,0.4)",
    cardShadow:dark?"0 2px 20px rgba(0,0,0,0.4)":"0 2px 20px rgba(0,0,0,0.06)",
  }),[dark]);

  const SECTIONS=["hero","features","pricing","social-proof","faq","cta-footer"];
  const currentSection=useRef(0);
  useEffect(()=>{
    const handleKey=(e)=>{
      if(modal) return;
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
      if(e.code==="Space"){
        e.preventDefault();
        const next=e.shiftKey
          ? Math.max(0,currentSection.current-1)
          : Math.min(SECTIONS.length-1,currentSection.current+1);
        currentSection.current=next;
        document.getElementById(SECTIONS[next])?.scrollIntoView({behavior:"smooth"});
      }
    };
    const obs=new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          const idx=SECTIONS.indexOf(entry.target.id);
          if(idx>=0) currentSection.current=idx;
        }
      });
    },{threshold:0.3});
    SECTIONS.forEach(id=>{const el=document.getElementById(id);if(el)obs.observe(el);});
    window.addEventListener("keydown",handleKey);
    return()=>{window.removeEventListener("keydown",handleKey);obs.disconnect();};
  },[modal]);

  return(
    <div className="root">
      
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .root{min-height:100vh;background:${t.bg};color:${t.text};font-family:'Outfit',sans-serif;transition:background 1.5s cubic-bezier(.4,0,.2,1),color 1.2s ease;overflow-x:clip;scroll-behavior:smooth}
        .snap-section{min-height:100vh;display:flex;flex-direction:column;justify-content:center;scroll-snap-align:start}
        .m{font-family:'JetBrains Mono',monospace}.serif{font-family:'Cormorant Garamond',serif}
        button{cursor:pointer;font-family:inherit;border:none}input,textarea{font-family:inherit}
        @keyframes fi{from{opacity:0}to{opacity:1}}@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        @keyframes float1{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(30px,-20px) scale(1.05)}50%{transform:translate(-10px,15px) scale(0.95)}75%{transform:translate(20px,10px) scale(1.02)}}
        @keyframes float2{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-25px,15px) scale(1.03)}66%{transform:translate(15px,-25px) scale(0.97)}}
        @keyframes float3{0%,100%{transform:translate(0,0)}50%{transform:translate(-15px,-20px)}}
        @keyframes pulse-glow{0%,100%{opacity:0.4}50%{opacity:0.8}}
        @keyframes spin-slow{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes orbit-float{0%,100%{transform-origin:center;filter:brightness(1)}50%{filter:brightness(1.2);transform:scale(1.08)}}
        @keyframes pulse-ring{0%,100%{transform:scale(1);opacity:0.3}50%{transform:scale(1.06);opacity:0.6}}
        @keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${dark?"#2a2a2a":"#ccc"};border-radius:3px}
        .sec{max-width:1100px;margin:0 auto;padding:0 24px}
        .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
        .g3p{display:grid;grid-template-columns:repeat(3,1fr);gap:36px}
        .g4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        @media(max-width:900px){.g3,.g3p{grid-template-columns:1fr}.g4{grid-template-columns:repeat(2,1fr)}.hero-stats{gap:20px!important}}
        @media(max-width:500px){.g4{grid-template-columns:1fr}}@media(max-width:400px){.g3,.g3p{grid-template-columns:1fr!important}.sec{padding:0 14px}}
        .orb{position:absolute;border-radius:50%;pointer-events:none;filter:blur(80px)}
        details summary::-webkit-details-marker{display:none}
        details summary::marker{display:none}
        details[open] .faq-chevron{transform:rotate(45deg)}
      `}</style>

      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
        <div className="orb" style={{width:400,height:400,top:"-10%",left:"-5%",background:dark?"rgba(196,125,142,0.08)":"rgba(196,125,142,0.06)",animation:"float1 20s ease-in-out infinite"}}/>
        <div className="orb" style={{width:300,height:300,top:"40%",right:"-5%",background:dark?"rgba(100,120,200,0.06)":"rgba(100,120,200,0.04)",animation:"float2 25s ease-in-out infinite"}}/>
        <div className="orb" style={{width:250,height:250,bottom:"5%",left:"30%",background:dark?"rgba(110,231,183,0.05)":"rgba(16,185,129,0.04)",animation:"float3 18s ease-in-out infinite"}}/>
        <div className="orb" style={{width:150,height:150,top:"20%",left:"50%",background:dark?"rgba(196,125,142,0.06)":"rgba(196,125,142,0.04)",animation:"float2 15s ease-in-out infinite 3s"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(${dark?"rgba(255,255,255,0.015)":"rgba(0,0,0,0.015)"} 1px,transparent 1px),linear-gradient(90deg,${dark?"rgba(255,255,255,0.015)":"rgba(0,0,0,0.015)"} 1px,transparent 1px)`,backgroundSize:"60px 60px",opacity:0.5}}/>
      </div>

      <div style={{position:"sticky",top:0,zIndex:50}}>
        <div>{[...(promoBanner?[promoBanner]:[]),...siteAlerts].map((a,i)=><div key={i} style={{padding:"10px 16px",textAlign:"center",fontSize:13,fontWeight:500,background:a.type==="warning"?(dark?(scrolled?"rgba(217,119,6,0.25)":"rgba(217,119,6,0.15)"):(scrolled?"#fff3cd":"#fffbeb")):(dark?(scrolled?"rgba(99,102,241,0.25)":"rgba(99,102,241,0.15)"):(scrolled?"#dde4ff":"#eef2ff")),color:a.type==="warning"?(dark?"#fcd34d":"#92400e"):(dark?"#a5b4fc":"#4f46e5"),borderBottom:`1px solid ${a.type==="warning"?(dark?"rgba(217,119,6,0.2)":"#fde68a"):(dark?"rgba(99,102,241,0.2)":"#c7d2fe")}`,backdropFilter:"blur(20px)",transition:"background 0.3s ease"}}>{a.type==="warning"?"⚠️":"✨"} {a.message}</div>)}</div>
      <nav style={{backdropFilter:"blur(20px)",background:scrolled?(dark?"rgba(8,11,20,0.98)":"rgba(244,241,237,0.98)"):(dark?"rgba(8,11,20,0.4)":"rgba(244,241,237,0.4)"),borderBottom:`1px solid ${scrolled?t.surfaceBorder:"transparent"}`,transition:"background 0.3s ease, border-color 0.3s ease",boxShadow:scrolled?(dark?"0 1px 12px rgba(0,0,0,0.3)":"0 1px 12px rgba(0,0,0,0.06)"):"none"}}>
        <div className="sec" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 24px"}}>
          <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} style={{display:"flex",alignItems:"center",gap:10,background:"none",padding:0,border:"none",outline:"none",cursor:"pointer"}}>
            <div style={{width:34,height:34,borderRadius:10,background:t.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff"}}>B</div>
            <span className="serif" style={{fontSize:20,fontWeight:600,color:t.text,letterSpacing:"0.3px"}}>BoostPanel</span>
          </button>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <ThemeToggle dark={dark} onToggle={toggleTheme} compact/>
            <button onClick={()=>setModal("login")} className="nav-login" style={{padding:"9px 20px",borderRadius:10,background:"transparent",border:`1px solid ${t.surfaceBorder}`,color:t.text,fontSize:13,fontWeight:600,transition:"background 1.5s ease"}}>Log In</button>
            <button onClick={()=>setModal("signup")} style={{padding:"9px 16px",borderRadius:10,background:t.btnPrimary,color:"#fff",fontSize:13,fontWeight:600}}>Sign Up</button>
          </div>
        </div>
      </nav>
      </div>

      <section id="hero" className="snap-section" style={{padding:"100px 24px 80px",textAlign:"center",position:"relative",zIndex:1}}>
        <div className="sec">
          <div style={{position:"absolute",top:40,right:"10%",width:120,height:120,border:`2px solid ${dark?"rgba(196,125,142,0.1)":"rgba(196,125,142,0.08)"}`,borderRadius:"50%",animation:"spin-slow 30s linear infinite",pointerEvents:"none"}}/>
          <div style={{position:"absolute",bottom:20,left:"8%",width:80,height:80,border:`1.5px dashed ${dark?"rgba(110,231,183,0.1)":"rgba(16,185,129,0.08)"}`,borderRadius:"50%",animation:"spin-slow 20s linear infinite reverse",pointerEvents:"none"}}/>
          <Reveal>
            <div style={{display:"inline-block",padding:"6px 18px",borderRadius:20,background:t.accentLight,border:`1px solid ${dark?"rgba(196,125,142,0.2)":"rgba(196,125,142,0.15)"}`,fontSize:13,color:t.accent,fontWeight:500,marginBottom:28}}>🚀 Nigeria's Premium SMM Platform</div>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="serif" style={{fontSize:"clamp(38px, 6vw, 68px)",fontWeight:700,color:t.text,lineHeight:1.1,marginBottom:22,letterSpacing:"-1px"}}>
              Grow Your Social Media<br/><span style={{background:"linear-gradient(135deg,#c47d8e,#a3586b)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Effortlessly</span>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p style={{fontSize:"clamp(15px, 2vw, 18px)",color:t.textSoft,maxWidth:560,margin:"0 auto 40px",lineHeight:1.7}}>
              Real followers, likes, and views for Instagram, TikTok, YouTube & more. Instant delivery. Naira payments. Trusted by thousands.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
              <button onClick={()=>setModal("signup")} style={{padding:"15px 40px",borderRadius:14,background:t.btnPrimary,color:"#fff",fontSize:16,fontWeight:700,boxShadow:"0 4px 24px rgba(196,125,142,0.3)",transition:"transform 0.2s"}} onMouseEnter={e=>e.target.style.transform="translateY(-2px)"} onMouseLeave={e=>e.target.style.transform="translateY(0)"}>Get Started Free</button>
              <button onClick={()=>document.getElementById("pricing")?.scrollIntoView({behavior:"smooth"})} style={{padding:"15px 40px",borderRadius:14,background:t.btnSecondary,color:t.text,fontSize:16,fontWeight:600,border:`1px solid ${t.btnSecBorder}`}}>View Pricing ↓</button>
            </div>
          </Reveal>
          <Reveal delay={0.45}>
            <div className="hero-stats" style={{display:"flex",justifyContent:"center",gap:40,marginTop:64,flexWrap:"wrap"}}>
              {[[siteStats.users,"Active Users","👥"],[siteStats.orders,"Orders Delivered","📦"],["₦500","Min Deposit","💳"],["24/7","Support","💬"]].map(([v,l,ic])=>
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{fontSize:14,marginBottom:4}}>{ic}</div>
                  <div className="m" style={{fontSize:24,fontWeight:700,color:t.accent}}>{v}</div>
                  <div style={{fontSize:12,color:t.textMuted,marginTop:2}}>{l}</div>
                </div>
              )}
            </div>
          </Reveal>
        </div>
        <div style={{marginTop:72,overflow:"hidden",borderTop:`1px solid ${t.surfaceBorder}`,borderBottom:`1px solid ${t.surfaceBorder}`,padding:"16px 0",position:"relative",transition:"border-color 1.5s ease"}}>
          <div style={{display:"flex",animation:"marquee 30s linear infinite",width:"max-content"}}>
            {[...Array(2)].map((_,ri)=>(
              <div key={ri} style={{display:"flex",gap:48,paddingRight:48,flexShrink:0}}>
                {["Instagram Followers","TikTok Views","YouTube Subscribers","Twitter Likes","Facebook Page Likes","Telegram Members","Spotify Plays","Instagram Reels","TikTok Followers","YouTube Watch Time","Real Engagement","Instant Delivery","Naira Payments","Refill Guarantee","24/7 Support"].map((txt,i)=>(
                  <span key={`${ri}-${i}`} style={{fontSize:14,fontWeight:500,color:i%3===0?t.accent:t.textMuted,whiteSpace:"nowrap",letterSpacing:"0.3px",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{width:4,height:4,borderRadius:"50%",background:t.accent,opacity:0.5,flexShrink:0}}/>
                    {txt}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="snap-section" style={{padding:"80px 24px",position:"relative",zIndex:1}}>
        <div className="sec">
          <Reveal><div style={{textAlign:"center",marginBottom:48}}>
            <h2 className="serif" style={{fontSize:"clamp(28px,4vw,42px)",fontWeight:600,color:t.text,marginBottom:12}}>Why BoostPanel?</h2>
            <p style={{fontSize:15,color:t.textSoft,maxWidth:480,margin:"0 auto"}}>Everything you need to grow, in one place.</p>
          </div></Reveal>
          <div className="g3">
            {[["⚡","Instant Delivery","Orders start in minutes. Real-time tracking on every order."],["💳","Pay in Naira","Paystack — cards, bank transfer, USSD. No dollar conversion."],["📸","All Platforms","Instagram, TikTok, YouTube, Twitter/X, Facebook, Telegram, Spotify."],["🔄","Refill Guarantee","Auto-replenish dropped followers within the guarantee period."],["🔒","100% Safe","No passwords needed. Delivery via public URLs only."],["🔗","Earn 5% Forever","Refer friends and earn commission on every order they make."]].map(([ic,title,desc],i)=>
              <Reveal key={i} delay={i*0.08} style={{display:"flex"}}>
                <div style={{padding:28,borderRadius:20,background:t.surface,border:`1px solid ${t.surfaceBorder}`,backdropFilter:"blur(12px)",boxShadow:t.cardShadow,transition:"background 1.5s ease,border-color 1.5s ease,transform 0.2s",cursor:"default",flex:1}} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-4px)"} onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
                  <div style={{width:48,height:48,borderRadius:14,background:t.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,marginBottom:16}}>{ic}</div>
                  <h3 style={{fontSize:16,fontWeight:600,color:t.text,marginBottom:8}}>{title}</h3>
                  <p style={{fontSize:13,color:t.textSoft,lineHeight:1.7}}>{desc}</p>
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      <section id="pricing" className="snap-section" style={{padding:"80px 24px",position:"relative",zIndex:1}}>
        <div className="sec" style={{maxWidth:1400}}>
          <Reveal><div style={{textAlign:"center",marginBottom:48}}>
            <h2 className="serif" style={{fontSize:"clamp(28px,4vw,42px)",fontWeight:600,color:t.text,marginBottom:12}}>Transparent Pricing</h2>
            <p style={{fontSize:15,color:t.textSoft,maxWidth:480,margin:"0 auto"}}>No subscriptions. Pay-as-you-go. All prices per 1,000 units.</p>
          </div></Reveal>
          <div className="g3p">
            {[["TikTok","🎵",[["Followers","₦4,650"],["Views","₦465"],["Likes","₦2,325"],["Shares","₦1,200"]],false],["Instagram","📸",[["Followers","₦3,875"],["Likes","₦1,860"],["Reels Views","₦775"],["Story Views","₦1,240"]],true],["YouTube","▶️",[["Subscribers","₦12,400"],["Views","₦3,100"],["Watch Time","₦77,500"],["Likes","₦1,500"]],false]].map(([name,ic,prices,pop],i)=>
              <Reveal key={name} delay={i*0.1} style={{display:"flex"}}>
                <div style={{padding:"32px 34px",borderRadius:20,background:t.surface,border:`1px solid ${pop?"rgba(196,125,142,0.25)":t.surfaceBorder}`,backdropFilter:"blur(12px)",boxShadow:pop?"0 0 40px rgba(196,125,142,0.1)":t.cardShadow,transition:"background 1.5s ease,transform 0.2s",position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",flex:1,transform:pop?"scale(1.03)":"scale(1)"}} onMouseEnter={e=>e.currentTarget.style.transform=pop?"scale(1.05)":"scale(1.02)"} onMouseLeave={e=>e.currentTarget.style.transform=pop?"scale(1.03)":"scale(1)"}>
                  {pop&&<div style={{position:"absolute",top:0,left:0,right:0,height:3,background:t.btnPrimary}}/>}
                  {pop&&<div style={{position:"absolute",top:14,right:14,padding:"3px 10px",borderRadius:6,background:t.accent,color:"#fff",fontSize:10,fontWeight:700,letterSpacing:1}}>POPULAR</div>}
                  <div style={{fontSize:36,marginBottom:8}}>{ic}</div>
                  <h3 style={{fontSize:18,fontWeight:600,color:t.text,marginBottom:16}}>{name}</h3>
                  <div style={{flex:1}}>{prices.map(([svc,price])=>
                    <div key={svc} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${t.surfaceBorder}`}}>
                      <span style={{fontSize:14,color:t.textSoft}}>{svc}</span>
                      <span className="m" style={{fontSize:14,fontWeight:600,color:t.green}}>{price}</span>
                    </div>
                  )}</div>
                  <button onClick={()=>setModal("signup")} style={{marginTop:20,width:"100%",padding:"12px 0",borderRadius:10,background:pop?t.btnPrimary:t.btnSecondary,color:pop?"#fff":t.text,fontSize:14,fontWeight:600,border:pop?"none":`1px solid ${t.btnSecBorder}`}}>Get Started</button>
                </div>
              </Reveal>
            )}
          </div>
          <Reveal delay={0.3}><div style={{marginTop:40,textAlign:"center"}}>
            <p style={{fontSize:13,color:t.textMuted,marginBottom:16,textTransform:"uppercase",letterSpacing:1.5,fontWeight:600}}>All platforms we support</p>
            <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:10}}>
              {[["📸","Instagram"],["🎵","TikTok"],["▶️","YouTube"],["𝕏","Twitter/X"],["📘","Facebook"],["✈️","Telegram"],["🎵","Spotify"],["👻","Snapchat"],["🔗","LinkedIn"],["📌","Pinterest"],["🎮","Twitch"],["💬","Discord"]].map(([ic,name])=>
                <span key={name} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:10,background:t.surface,border:`1px solid ${t.surfaceBorder}`,fontSize:13,color:t.textSoft,fontWeight:500,backdropFilter:"blur(8px)",transition:"background 1.5s ease"}}>{ic} {name}</span>
              )}
            </div>
            <p style={{fontSize:12,color:t.textMuted,marginTop:14}}>All prices in ₦ per 1,000 units. More services available after signup.</p>
          </div></Reveal>
        </div>
      </section>

      <section id="social-proof" className="snap-section" style={{padding:"60px 24px",position:"relative",zIndex:1}}>
        <div className="sec">
          <Reveal><div style={{textAlign:"center",marginBottom:36}}>
            <h2 className="serif" style={{fontSize:"clamp(26px,4vw,38px)",fontWeight:600,color:t.text,marginBottom:10}}>How It Works</h2>
          </div></Reveal>
          <div className="g4" style={{maxWidth:900,margin:"0 auto 60px"}}>
            {[["1","Sign Up","Create a free account in 30 seconds"],["2","Add Funds","Top up with Paystack — from ₦500"],["3","Place Order","Pick a service, paste your link, order"],["4","Watch Growth","Delivery starts instantly"]].map(([n,title,desc],i)=>
              <Reveal key={i} delay={i*0.08} style={{display:"flex"}}>
                <div style={{textAlign:"center",padding:20,borderRadius:16,background:t.surface,border:`1px solid ${t.surfaceBorder}`,backdropFilter:"blur(12px)",transition:"background 1.5s ease",flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <div style={{width:40,height:40,borderRadius:"50%",background:t.btnPrimary,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff",marginBottom:12,boxShadow:"0 4px 16px rgba(196,125,142,0.25)",flexShrink:0}}>{n}</div>
                  <h3 style={{fontSize:14,fontWeight:600,color:t.text,marginBottom:4}}>{title}</h3>
                  <p style={{fontSize:12,color:t.textSoft,lineHeight:1.5}}>{desc}</p>
                </div>
              </Reveal>
            )}
          </div>
          <Reveal><h2 className="serif" style={{fontSize:"clamp(26px,4vw,38px)",fontWeight:600,color:t.text,marginBottom:32,textAlign:"center"}}>Trusted by Creators</h2></Reveal>
          <div className="g3">
            {[["Chioma A.","Instagram Influencer","BoostPanel helped me hit 50K followers. Delivery is fast and followers stay. Best panel in Nigeria.","⭐⭐⭐⭐⭐"],["Tunde O.","Music Artist","I use it for Spotify and YouTube. Instant delivery, Naira payments, no stress. Streams tripled.","⭐⭐⭐⭐⭐"],["Blessing E.","Business Owner","My boutique's IG went from 2K to 25K. Real engagement. I recommend to every business owner.","⭐⭐⭐⭐⭐"]].map(([name,role,text,stars],i)=>
              <Reveal key={i} delay={i*0.1} style={{display:"flex"}}>
                <div style={{padding:24,borderRadius:18,background:t.surface,border:`1px solid ${t.surfaceBorder}`,backdropFilter:"blur(12px)",boxShadow:t.cardShadow,transition:"background 1.5s ease",flex:1,display:"flex",flexDirection:"column"}}>
                  <div style={{fontSize:13,marginBottom:8}}>{stars}</div>
                  <div style={{fontSize:13,color:t.textSoft,lineHeight:1.7,marginBottom:14,fontStyle:"italic",flex:1}}>"{text}"</div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:34,height:34,borderRadius:"50%",background:t.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff"}}>{name[0]}</div>
                    <div><div style={{fontSize:13,fontWeight:600,color:t.text}}>{name}</div><div style={{fontSize:11,color:t.textMuted}}>{role}</div></div>
                  </div>
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      <section id="faq" className="snap-section" style={{padding:"60px 24px",position:"relative",zIndex:1}}>
        <div className="sec" style={{maxWidth:800}}>
          <Reveal><h2 className="serif" style={{fontSize:"clamp(28px,4vw,42px)",fontWeight:600,color:t.text,marginBottom:32,textAlign:"center"}}>Frequently Asked Questions</h2></Reveal>
          {[["How does BoostPanel work?","Sign up for free, add funds to your wallet via Paystack (cards, bank transfer, or USSD), choose a service from our catalog, paste your social media link, and place your order. Delivery starts within minutes and you can track progress in real-time."],["Is it safe to use?","Absolutely. We never ask for your passwords or login credentials. All services are delivered using your public profile URL only. Your accounts remain completely secure."],["How do I pay?","We accept Nigerian Naira payments via Paystack — debit cards, bank transfer, and USSD. Minimum deposit is ₦500 and you can top up any amount to your wallet."],["Will my followers drop?","Some natural fluctuation may occur. Services marked with refill guarantee will automatically replenish any drops within the guarantee period at no extra cost."],["Can I earn money with BoostPanel?","Yes! Every account gets a referral link. Share it and earn 5% commission on every order your referrals make — credited to your wallet automatically, forever."],["How fast is delivery?","Most services start delivering within minutes of placing your order. Typical completion time is 0-24 hours depending on the service type and quantity ordered."]].map(([q,a],i)=>{
            const isOpen=faqOpen===i;
            return <Reveal key={i} delay={i*0.05}>
              <div style={{marginBottom:10,borderRadius:14,background:t.surface,border:`1px solid ${isOpen?"rgba(196,125,142,0.2)":t.surfaceBorder}`,transition:"background 1.5s ease, border-color 0.3s ease"}}>
                <button onClick={()=>setFaqOpen(isOpen?null:i)} style={{width:"100%",padding:"18px 24px",fontSize:16,fontWeight:500,color:t.text,cursor:"pointer",background:"none",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,textAlign:"left"}}>
                  <span>{q}</span>
                  <span style={{fontSize:18,color:isOpen?t.accent:t.textMuted,flexShrink:0,transition:"transform 0.3s ease, color 0.3s ease",transform:isOpen?"rotate(45deg)":"rotate(0deg)"}}>+</span>
                </button>
                <div style={{maxHeight:isOpen?300:0,overflow:"hidden",transition:"max-height 0.35s cubic-bezier(0.4,0,0.2,1)"}}>
                  <div style={{padding:"0 24px 18px",fontSize:14,color:t.textSoft,lineHeight:1.8,borderTop:`1px solid ${t.surfaceBorder}`}}><div style={{paddingTop:14}}>{a}</div></div>
                </div>
              </div>
            </Reveal>;
          })}
        </div>
      </section>

      <section id="cta-footer" className="snap-section" style={{padding:"0",position:"relative",zIndex:1,display:"flex",flexDirection:"column"}}>
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"60px 24px"}}>
          <Reveal>
            <div style={{textAlign:"center",maxWidth:600,margin:"0 auto",padding:"56px 32px",borderRadius:24,background:t.surface,border:`1px solid ${t.surfaceBorder}`,backdropFilter:"blur(12px)"}}>
              <h2 className="serif" style={{fontSize:"clamp(30px,5vw,48px)",fontWeight:700,color:t.text,marginBottom:16}}>Ready to <span style={{color:t.accent}}>Grow</span>?</h2>
              <p style={{fontSize:16,color:t.textSoft,marginBottom:32}}>Join thousands of Nigerian creators already using BoostPanel.</p>
              <button onClick={()=>setModal("signup")} style={{padding:"16px 52px",borderRadius:14,background:t.btnPrimary,color:"#fff",fontSize:17,fontWeight:700,boxShadow:"0 4px 28px rgba(196,125,142,0.3)"}}>Create Free Account</button>
            </div>
          </Reveal>
        </div>
        <Footer t={t} dark={dark}/>
      </section>

      {modal&&<AuthModal dark={dark} t={t} mode={modal} setMode={setModal} onClose={closeModal}/>}
    </div>
  );
}

function AuthModal({dark,t,mode,setMode,onClose}){
  const [method,setMethod]=useState("email");
  const [showPw,setShowPw]=useState(false);
  const [step,setStep]=useState(1);
  const [remember,setRemember]=useState(false);
  const [authLoading,setAuthLoading]=useState(false);
  const [error,setError]=useState("");
  // Form fields
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [pw,setPw]=useState("");
  const [pw2,setPw2]=useState("");
  const [refCode,setRefCode]=useState("");
  const [agree,setAgree]=useState(false);
  useEffect(()=>{setStep(1);setAuthLoading(false);setError("");setPw("");setPw2("");setName("");setEmail("");setPhone("");},[mode]);
  useEffect(()=>{const p=new URLSearchParams(window.location.search);const r=p.get("ref");if(r)setRefCode(r);},[]);

  const handleLogin=async()=>{
    setError("");
    const contact=method==="email"?email:phone;
    if(!contact||!pw){setError("Please fill in all fields");return;}
    setAuthLoading(true);
    try{
      const res=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:method==="email"?email:`+234${phone}`,password:pw})});
      const data=await res.json();
      if(!res.ok){setError(data.error||"Login failed");setAuthLoading(false);return;}
      if(!data.user.emailVerified){window.location.href="/verify";return;}
      window.location.href="/dashboard";
    }catch{setError("Something went wrong. Please try again.");setAuthLoading(false);}
  };

  const handleSignup=async()=>{
    setError("");
    if(!name||!email||!pw){setError("Please fill in all fields");return;}
    if(pw.length<6){setError("Password must be at least 6 characters");return;}
    if(pw!==pw2){setError("Passwords don't match");return;}
    if(!agree){setError("Please agree to the Terms of Service");return;}
    setAuthLoading(true);
    try{
      const res=await fetch("/api/auth/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,email:method==="email"?email:`+234${phone}`,password:pw,referralCode:refCode||undefined})});
      const data=await res.json();
      if(!res.ok){setError(data.error||"Signup failed");setAuthLoading(false);return;}
      window.location.href="/verify";
    }catch{setError("Something went wrong. Please try again.");setAuthLoading(false);}
  };

  const [showPw2,setShowPw2]=useState(false);
  const validEmail=email&&/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const validPhone=phone&&/^[0-9]{10,11}$/.test(phone);
  const pwMatch=pw2.length>0&&pw===pw2;
  const pwMismatch=pw2.length>0&&pw!==pw2;

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:100,background:t.overlay,backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,animation:"fi 0.2s ease"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:420,maxHeight:'90vh',overflowY:'auto',background:dark?"rgba(15,18,30,0.98)":"rgba(255,255,255,0.98)",border:`1px solid ${t.surfaceBorder}`,borderRadius:24,padding:"32px 28px",boxShadow:dark?"0 20px 60px rgba(0,0,0,0.5)":"0 20px 60px rgba(0,0,0,0.1)",backdropFilter:"blur(20px)",position:"relative"}}>
        <button onClick={onClose} style={{position:"absolute",top:14,right:14,background:"none",color:t.textMuted,fontSize:20,padding:4,lineHeight:1,border:"none",cursor:"pointer"}}>✕</button>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{width:42,height:42,borderRadius:12,background:t.logoGrad,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:"#fff",marginBottom:10}}>B</div>
          <h2 className="serif" style={{fontSize:24,fontWeight:600,color:t.text}}>{mode==="login"?"Welcome Back":step===1?"Create Account":"Almost Done"}</h2>
          <p style={{fontSize:13,color:t.textSoft,marginTop:4}}>{mode==="login"?"Log in to your account":step===1?"Step 1 of 2 — Your details":"Step 2 of 2 — Secure your account"}</p>
        </div>
        {error&&<div style={{padding:"10px 14px",borderRadius:10,background:dark?"rgba(220,38,38,0.1)":"#fef2f2",border:`1px solid ${dark?"rgba(220,38,38,0.2)":"#fecaca"}`,color:dark?"#fca5a5":"#dc2626",fontSize:13,marginBottom:16,animation:"fu .3s ease"}}>⚠️ {error}</div>}
        {mode==="login"&&<>
          <div style={{display:"flex",gap:0,marginBottom:6,background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)",borderRadius:10,padding:3,border:`1px solid ${t.surfaceBorder}`}}>
            <button onClick={()=>setMethod("email")} style={{flex:1,padding:"8px 0",borderRadius:8,fontSize:13,fontWeight:500,background:method==="email"?t.accentLight:"transparent",color:method==="email"?t.accent:t.textMuted,border:"none",cursor:"pointer"}}>📧 Email</button>
            <button onClick={()=>setMethod("phone")} style={{flex:1,padding:"8px 0",borderRadius:8,fontSize:13,fontWeight:500,background:method==="phone"?t.accentLight:"transparent",color:method==="phone"?t.accent:t.textMuted,border:"none",cursor:"pointer"}}>📱 Phone</button>
          </div>
          {method==="email"?<div key="email-login"><Lbl t={t}>Email Address</Lbl><input value={email} onChange={e=>setEmail(e.target.value.trim().toLowerCase().slice(0,254))} placeholder="you@example.com" type="email" autoComplete="email" style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:16}}/></div>:<div key="phone-login"><Lbl t={t}>Phone Number</Lbl><div style={{display:"flex",gap:8,marginBottom:16}}><div style={{padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.textSoft,fontSize:14,flexShrink:0}}>🇳🇬 +234</div><input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,11))} placeholder="8012345678" type="tel" autoComplete="tel" style={{flex:1,padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/></div></div>}
          <Lbl t={t}>Password</Lbl>
          <div style={{position:"relative",marginBottom:16}}>
            <input value={pw} onChange={e=>setPw(e.target.value.slice(0,128))} placeholder="Enter password" maxLength={128} type={showPw?"text":"password"} onKeyDown={e=>e.key==="Enter"&&handleLogin()} style={{width:"100%",padding:"12px 44px 12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/>
            <button onClick={()=>setShowPw(!showPw)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",color:t.textMuted,fontSize:14,padding:2,border:"none",cursor:"pointer"}}>{showPw?<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>:<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}</button>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{accentColor:t.accent,width:15,height:15}}/><span style={{fontSize:12,color:t.textSoft}}>Remember me</span></label>
            <button style={{background:"none",color:t.accent,fontSize:12,fontWeight:500,border:"none",cursor:"pointer"}}>Forgot password?</button>
          </div>
          <button onClick={handleLogin} disabled={authLoading} style={{width:"100%",padding:"14px 0",borderRadius:12,background:authLoading?"#999":t.btnPrimary,color:"#fff",fontSize:15,fontWeight:700,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:authLoading?.7:1,border:"none",cursor:"pointer"}}>{authLoading&&<span style={{width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>}{authLoading?"Logging in...":"Log In"}</button>
          <div style={{textAlign:"center",fontSize:13,color:t.textSoft}}>Don't have an account? <button onClick={()=>setMode("signup")} style={{background:"none",color:t.accent,fontWeight:600,fontSize:13,border:"none",cursor:"pointer"}}>Sign Up Free</button></div>
        </>}
        {mode==="signup"&&step===1&&<>
          <Lbl t={t}>Full Name</Lbl>
          <input value={name} onChange={e=>setName(e.target.value.replace(/[^a-zA-ZÀ-ÿ\s'\-\.]/g,"").slice(0,100))} placeholder="Enter your full name" maxLength={100} type="text" style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:16}}/>
          <div style={{display:"flex",gap:0,marginBottom:6,background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)",borderRadius:10,padding:3,border:`1px solid ${t.surfaceBorder}`}}>
            <button onClick={()=>setMethod("email")} style={{flex:1,padding:"8px 0",borderRadius:8,fontSize:13,fontWeight:500,background:method==="email"?t.accentLight:"transparent",color:method==="email"?t.accent:t.textMuted,border:"none",cursor:"pointer"}}>📧 Email</button>
            <button onClick={()=>setMethod("phone")} style={{flex:1,padding:"8px 0",borderRadius:8,fontSize:13,fontWeight:500,background:method==="phone"?t.accentLight:"transparent",color:method==="phone"?t.accent:t.textMuted,border:"none",cursor:"pointer"}}>📱 Phone</button>
          </div>
          {method==="email"?<div key="email-signup"><Lbl t={t}>Email Address</Lbl><input value={email} onChange={e=>setEmail(e.target.value.trim().toLowerCase().slice(0,254))} placeholder="you@example.com" type="email" autoComplete="email" style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:email&&!validEmail?4:16}}/>{email&&!validEmail&&<div style={{fontSize:11,color:dark?"#fca5a5":"#dc2626",marginBottom:12}}>Please enter a valid email address</div>}</div>:<div key="phone-signup"><Lbl t={t}>Phone Number</Lbl><div style={{display:"flex",gap:8,marginBottom:phone&&!validPhone?4:16}}><div style={{padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.textSoft,fontSize:14,flexShrink:0}}>🇳🇬 +234</div><input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,11))} placeholder="8012345678" type="tel" autoComplete="tel" style={{flex:1,padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/></div>{phone&&!validPhone&&<div style={{fontSize:11,color:dark?"#fca5a5":"#dc2626",marginBottom:12}}>Enter 10-11 digits (e.g. 08012345678)</div>}</div>}
          <button onClick={()=>{setError("");if(!name){setError("Please enter your name");return;}if(method==="email"&&!email){setError("Please enter your email");return;}if(method==="email"&&!validEmail){setError("Please enter a valid email (e.g. you@gmail.com)");return;}if(method==="phone"&&!phone){setError("Please enter your phone number");return;}if(method==="phone"&&!validPhone){setError("Please enter a valid phone number (10-11 digits)");return;}setStep(2);}} style={{width:"100%",padding:"14px 0",borderRadius:12,background:t.btnPrimary,color:"#fff",fontSize:15,fontWeight:700,marginBottom:16,border:"none",cursor:"pointer"}}>Continue →</button>
          <div style={{textAlign:"center",fontSize:13,color:t.textSoft}}>Already have an account? <button onClick={()=>setMode("login")} style={{background:"none",color:t.accent,fontWeight:600,fontSize:13,border:"none",cursor:"pointer"}}>Log In</button></div>
        </>}
        {mode==="signup"&&step===2&&<>
          <Lbl t={t}>Password</Lbl>
          <div style={{position:"relative",marginBottom:4}}>
            <input placeholder="Min. 6 characters" value={pw} onChange={e=>setPw(e.target.value.slice(0,128))} type={showPw?"text":"password"} maxLength={128} style={{width:"100%",padding:"12px 44px 12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/>
            <button onClick={()=>setShowPw(!showPw)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",color:t.textMuted,fontSize:14,padding:2,border:"none",cursor:"pointer"}}>{showPw?<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>:<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}</button>
          </div>
          <PwStrength pw={pw} t={t}/>
          <Lbl t={t}>Confirm Password</Lbl>
          <div style={{position:"relative",marginBottom:4}}>
            <input value={pw2} onChange={e=>setPw2(e.target.value.slice(0,128))} placeholder="Re-enter password" maxLength={128} type={showPw2?"text":"password"} style={{width:"100%",padding:"12px 44px 12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${pwMismatch?(dark?"rgba(220,38,38,0.4)":"#fecaca"):pwMatch?(dark?"rgba(110,231,183,0.4)":"#a7f3d0"):t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/>
            <button onClick={()=>setShowPw2(!showPw2)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",color:t.textMuted,fontSize:14,padding:2,border:"none",cursor:"pointer"}}>{showPw2?<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>:<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}</button>
          </div>
          {pwMatch&&<div style={{fontSize:11,color:dark?"#6ee7b7":"#059669",marginBottom:12}}>✓ Passwords match</div>}
          {pwMismatch&&<div style={{fontSize:11,color:dark?"#fca5a5":"#dc2626",marginBottom:12}}>✕ Passwords don't match</div>}
          {!pw2&&<div style={{height:12,marginBottom:12}}/>}
          <Lbl t={t}>Referral Code <span style={{color:t.textMuted,fontWeight:400}}>(optional)</span></Lbl>
          <input value={refCode} onChange={e=>setRefCode(e.target.value.replace(/[^a-zA-Z0-9\-]/g,"").toUpperCase().slice(0,20))} placeholder="e.g. BOOST-7X92" maxLength={20} type="text" style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:16}}/>
          <label style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:24,cursor:"pointer"}}>
            <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} style={{marginTop:3,accentColor:t.accent,width:16,height:16,flexShrink:0}}/>
            <span style={{fontSize:12,color:t.textSoft,lineHeight:1.5}}>I agree to the <a href="/terms" style={{color:t.accent,textDecoration:"none"}}>Terms of Service</a> and <a href="/privacy" style={{color:t.accent,textDecoration:"none"}}>Privacy Policy</a></span>
          </label>
          <button onClick={handleSignup} disabled={authLoading} style={{width:"100%",padding:"14px 0",borderRadius:12,background:authLoading?"#999":t.btnPrimary,color:"#fff",fontSize:15,fontWeight:700,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:authLoading?.7:1,border:"none",cursor:"pointer"}}>{authLoading&&<span style={{width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>}{authLoading?"Creating Account...":"Create Account"}</button>
          <button onClick={()=>setStep(1)} style={{width:"100%",padding:"10px 0",borderRadius:10,background:"transparent",color:t.textSoft,fontSize:13,fontWeight:500,border:"none",cursor:"pointer"}}>← Back to Step 1</button>
        </>}
        {mode==="signup"&&<div style={{display:"flex",justifyContent:"center",gap:6,marginTop:16}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:step===1?t.accent:t.textMuted,transition:"background 0.3s ease"}}/>
          <div style={{width:8,height:8,borderRadius:"50%",background:step===2?t.accent:t.textMuted,transition:"background 0.3s ease"}}/>
        </div>}
      </div>
    </div>
  );
}

// Password strength meter
function PwStrength({pw,t}){
  const checks=[pw.length>=8,/[A-Z]/.test(pw),/[0-9]/.test(pw),/[^A-Za-z0-9]/.test(pw)];
  const score=checks.filter(Boolean).length;
  const labels=["","Weak","Fair","Good","Strong"];
  const colors=["","#dc2626","#d97706","#2563eb","#059669"];
  if(!pw)return null;
  return <div style={{marginBottom:14}}>
    <div style={{display:"flex",gap:4,marginBottom:4}}>{[1,2,3,4].map(i=><div key={i} style={{flex:1,height:3,borderRadius:2,background:i<=score?colors[score]:(t.inputBorder||"#ddd"),transition:"background 0.3s"}}/>)}</div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{fontSize:11,color:colors[score],fontWeight:500}}>{labels[score]}</span>
      <span style={{fontSize:10,color:t.textMuted}}>{checks[0]?"✓":"✗"} 8+ chars {checks[1]?"✓":"✗"} uppercase {checks[2]?"✓":"✗"} number {checks[3]?"✓":"✗"} symbol</span>
    </div>
  </div>;
}

const Lbl=({t,children})=><label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>{children}</label>;
const Inp=({t,dark,ph,type})=><input placeholder={ph} type={type} style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:16}}/>;

export function Footer({t,dark}){
  return(
    <footer style={{position:"relative",zIndex:1,borderTop:`1px solid ${t.surfaceBorder}`,transition:"border-color 1.5s ease,background 1.5s ease"}}>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"48px 24px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:40,marginBottom:40}}>
          <div style={{maxWidth:280}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:32,height:32,borderRadius:10,background:t.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#fff"}}>B</div>
              <span className="serif" style={{fontSize:18,fontWeight:600,color:t.text}}>BoostPanel</span>
            </div>
            <p style={{fontSize:13,color:t.textSoft,lineHeight:1.7}}>Nigeria's premium SMM platform. Grow your social media with real followers, likes, and views.</p>
          </div>
          <div style={{display:"flex",gap:48,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:t.textMuted,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Platform</div>
              {["Services","Pricing","API Docs","Status"].map(l=><a key={l} href="#" style={{display:"block",fontSize:13,color:t.textSoft,textDecoration:"none",marginBottom:8}}>{l}</a>)}
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:t.textMuted,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Company</div>
              {["About","Blog","Contact","Careers"].map(l=><a key={l} href="#" style={{display:"block",fontSize:13,color:t.textSoft,textDecoration:"none",marginBottom:8}}>{l}</a>)}
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:t.textMuted,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12}}>Legal</div>
              {[["Terms of Service","/terms"],["Privacy Policy","/privacy"],["Refund Policy","/refund"],["Cookie Policy","/cookie"]].map(([l,h])=><a key={l} href={h} style={{display:"block",fontSize:13,color:t.textSoft,textDecoration:"none",marginBottom:8}}>{l}</a>)}
            </div>
          </div>
        </div>
        <div style={{height:1,background:t.surfaceBorder,marginBottom:20,transition:"background 1.5s ease"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          <div style={{fontSize:12,color:t.textMuted}}>© 2026 BoostPanel. All rights reserved.</div>
          <div style={{display:"flex",gap:16}}>{["Twitter","Instagram"].map(s=><a key={s} href="#" style={{fontSize:12,color:t.textSoft,textDecoration:"none"}}>{s}</a>)}</div>
        </div>
      </div>
    </footer>
  );
}
