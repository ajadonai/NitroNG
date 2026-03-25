'use client';
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";



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
  const [dark,setDark]=useState(false);
  const [themeMode,setThemeMode]=useState("auto");
  const [modal,setModal]=useState(null);
  const [faqOpen,setFaqOpen]=useState(null);
  const [activeStep,setActiveStep]=useState(0);
  const [scrolled,setScrolled]=useState(false);
  const scrollRef=useRef(null);
  const [siteStats,setSiteStats]=useState({users:"12K+",orders:"2M+"});
  const [promoBanner,setPromoBanner]=useState({message:"New! Sign up today and get 10% bonus on your first deposit.",type:"info"});
  const [siteAlerts,setSiteAlerts]=useState([]);
  useEffect(()=>{const saved=localStorage.getItem("nitro-theme")||"auto";setThemeMode(saved);if(saved==="day")setDark(false);else if(saved==="night")setDark(true);else setDark(getAuto());},[]);
  useEffect(()=>{if(themeMode!=="auto")return;const iv=setInterval(()=>setDark(getAuto()),60000);return()=>clearInterval(iv);},[themeMode]);
  useEffect(()=>{const iv=setInterval(()=>setActiveStep(s=>(s+1)%4),3500);return()=>clearInterval(iv);},[]);
  useEffect(()=>{const el=scrollRef.current;if(!el)return;const onScroll=()=>setScrolled(el.scrollTop>20);el.addEventListener("scroll",onScroll);return()=>el.removeEventListener("scroll",onScroll);},[]);
  useEffect(()=>{const p=new URLSearchParams(window.location.search);if(p.get("login"))setModal("login");if(p.get("signup"))setModal("signup");if(p.get("ref")){setModal("signup");}},[]);
  useEffect(()=>{(async()=>{try{const res=await fetch("/api/site-info");if(res.ok){const d=await res.json();if(d.stats)setSiteStats(d.stats);if(d.promo)setPromoBanner(d.promo);else setPromoBanner(null);if(d.alerts?.length)setSiteAlerts(d.alerts);}}catch{}})();},[]);
  const closeModal=useCallback(()=>setModal(null),[]);
  const toggleTheme=()=>{const next=!dark;setDark(next);const mode=next?"night":"day";setThemeMode(mode);localStorage.setItem("nitro-theme",mode);};

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
    heroBg:dark?"#060810":"#c49a93",heroText:dark?"#eae7e2":"#1c1b19",heroSoft:dark?"#b0aca8":"#4a4542",heroMuted:dark?"#7d7974":"#887f78",heroGlass:dark?"rgba(15,19,35,.5)":"rgba(255,255,255,.35)",heroGlassBrd:dark?"rgba(255,255,255,.08)":"rgba(255,255,255,.25)",heroAccentBadge:dark?"rgba(196,125,142,.15)":"rgba(255,255,255,.25)",
  }),[dark]);

  const sectionIds=["hero","services","pricing","testimonials","faq","cta"];
  const currentSec=useRef(0);
  useEffect(()=>{
    const handleKey=(e)=>{
      if(modal) return;
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
      if(e.code==="Space"){
        e.preventDefault();
        const next=e.shiftKey?Math.max(0,currentSec.current-1):Math.min(sectionIds.length-1,currentSec.current+1);
        currentSec.current=next;
        document.getElementById(sectionIds[next])?.scrollIntoView({behavior:"smooth"});
      }
    };
    window.addEventListener("keydown",handleKey);
    return()=>window.removeEventListener("keydown",handleKey);
  },[modal]);
  useEffect(()=>{
    const el=scrollRef.current;if(!el)return;
    const onScroll=()=>{
      const sections=sectionIds.map(id=>document.getElementById(id)).filter(Boolean);
      const scrollTop=el.scrollTop;
      let closest=0;let minDist=Infinity;
      sections.forEach((sec,i)=>{const dist=Math.abs(sec.offsetTop-scrollTop);if(dist<minDist){minDist=dist;closest=i;}});
      currentSec.current=closest;
    };
    el.addEventListener("scroll",onScroll,{passive:true});
    return()=>el.removeEventListener("scroll",onScroll);
  },[]);

  return(
    <div className="root" style={{height:"100vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <style>{`
        .root{background:${t.bg};color:${t.text};font-family:'Outfit','Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;transition:background .5s ease,color .5s ease}
        .serif{font-family:'Cormorant Garamond',serif}
        .m{font-family:'JetBrains Mono',monospace}
        button{cursor:pointer;font-family:inherit;border:none}input{font-family:inherit}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${dark?"#2a2a2a":"#d0cdc8"};border-radius:2px}
        @keyframes fu{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fi{from{opacity:0}to{opacity:1}}
        @keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        @keyframes scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .fu{animation:fu .5s cubic-bezier(.2,.8,.2,1) both}
        .fd1{animation-delay:.06s}.fd2{animation-delay:.12s}.fd3{animation-delay:.18s}.fd4{animation-delay:.24s}.fd5{animation-delay:.3s}
        .lift{transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s ease,border-color .3s ease}

        .pricing-sec{min-height:calc(100vh - 100px);display:flex;flex-direction:column;position:relative;background:#1a1520;overflow:hidden}
        .pricing-bg{position:absolute;inset:0;pointer-events:none}
        .pricing-glow-center{position:absolute;top:15%;left:50%;transform:translateX(-50%);width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(196,125,142,.12) 0%,transparent 70%);animation:glow-pulse 4s ease-in-out infinite}
        .pricing-glow-left{position:absolute;bottom:10%;left:10%;width:300px;height:300px;border-radius:50%;background:rgba(254,44,85,.04);filter:blur(80px)}
        .pricing-glow-right{position:absolute;top:20%;right:10%;width:250px;height:250px;border-radius:50%;background:rgba(255,0,0,.03);filter:blur(60px)}
        .pricing-content{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;position:relative;z-index:1}
        .pricing-header{text-align:center;margin-bottom:40px}
        .pricing-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 18px;border-radius:24px;background:rgba(196,125,142,.1);border:1px solid rgba(196,125,142,.15);font-size:13px;font-weight:550;color:#c47d8e;margin-bottom:20px}
        .pricing-title{font-size:48px;font-weight:900;color:#f5f2ed;letter-spacing:-1px;line-height:1.05;margin-bottom:12px}
        .pricing-title-accent{font-weight:300;font-style:italic;color:#c47d8e;font-size:54px}
        .pricing-sub{font-size:17px;color:#b0aaa4;font-weight:430;max-width:440px;margin:0 auto}
        .pricing-cards{display:flex;gap:20px;align-items:center;max-width:1000px;width:100%}
        .pc{flex:1;padding:28px 24px;border-radius:22px;position:relative;overflow:hidden;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.08);backdrop-filter:blur(20px);transition:all .4s cubic-bezier(.16,1,.3,1)}
        .pc:hover{transform:translateY(-6px) scale(1.02);box-shadow:0 20px 50px rgba(0,0,0,.3);border-color:rgba(255,255,255,.15)}
        .pc-pop{padding:32px 26px;background:rgba(196,125,142,.08);border-color:rgba(196,125,142,.35);transform:scale(1.04);box-shadow:0 20px 60px rgba(196,125,142,.15);z-index:2}
        .pc-pop:hover{transform:scale(1.08) translateY(-4px)}
        .pc-topbar{position:absolute;top:0;left:0;right:0;height:3px}
        .pop-badge{position:absolute;top:14px;right:14px;padding:4px 12px;border-radius:8px;background:linear-gradient(135deg,#c47d8e,#a3586b);color:#fff;font-size:10px;font-weight:700;letter-spacing:1.5px;animation:pulse-ring 2.5s ease-in-out infinite}
        .pc-head{display:flex;align-items:center;gap:12px;margin-bottom:20px}
        .pc-icon{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .pc-name{font-size:20px;font-weight:800;color:#f5f2ed;letter-spacing:-.3px}
        .pc-unit{font-size:11px;color:#7a7470;font-weight:430;margin-top:1px}
        .pc-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0}
        .pc-svc{font-size:14px;color:#b0aaa4;font-weight:430}
        .pc-price{font-size:14px;font-weight:700;color:#6ee7b7}
        .pc-btn{margin-top:20px;width:100%;padding:13px 0;border-radius:12px;background:transparent;color:#f5f2ed;font-size:14px;font-weight:650;border:1px solid rgba(255,255,255,.08);cursor:pointer;font-family:inherit;transition:all .3s}
        .pc-btn-pop{background:linear-gradient(135deg,#c47d8e,#a3586b);color:#fff;border:none;box-shadow:0 6px 24px rgba(196,125,142,.25)}
        .pricing-note{margin-top:28px;text-align:center;font-size:13px;color:#7a7470;font-weight:430}
        @media(max-width:768px){
          .pricing-sec{min-height:auto}
          .pricing-content{padding:24px 16px}
          .pricing-header{margin-bottom:24px}
          .pricing-title{font-size:28px}
          .pricing-title-accent{font-size:32px}
          .pricing-sub{font-size:13px}
          .pricing-badge{font-size:11px;padding:5px 14px}
          .pricing-cards{flex-direction:column;gap:12px}
          .pc{padding:20px 18px;border-radius:18px}
          .pc-pop{padding:22px 20px;transform:none;box-shadow:none}
          .pc-pop:hover{transform:none}
          .pc:hover{transform:none;box-shadow:none}
          .pc-head{gap:10px;margin-bottom:16px}
          .pc-icon{width:40px;height:40px;border-radius:12px}
          .pc-icon svg{width:18px;height:18px}
          .pc-name{font-size:17px}
          .pc-btn{padding:11px 0;margin-top:16px}
          .pricing-note{margin-top:20px;font-size:12px}
          .pricing-glow-center{width:300px;height:300px}
          .pricing-glow-left,.pricing-glow-right{display:none}
        }
        .feat{transition:all .35s cubic-bezier(.16,1,.3,1)}
        .feat:hover{transform:translateY(-3px);box-shadow:${dark?"0 14px 36px rgba(0,0,0,.25)":"0 14px 36px rgba(0,0,0,.06)"}}
        .lift:hover{transform:translateY(-4px);box-shadow:${dark?"0 12px 32px rgba(0,0,0,.3)":"0 12px 32px rgba(0,0,0,.07)"};border-color:${dark?"rgba(255,255,255,.12)":"rgba(0,0,0,.10)"}!important}
        .sec{min-height:calc(100vh - 100px);display:flex;flex-direction:column;justify-content:center;position:relative}
        @media(max-width:1024px){.sec{min-height:calc(100vh - 100px)}.hero-stats{gap:32px!important}}
        @media(max-width:768px){.sec{min-height:calc(100vh - 96px)}.nav-links{display:none!important}.nav-login{display:none!important}.test-grid{grid-template-columns:1fr!important}.test-hide{display:none!important}.hero-stats{gap:24px!important}.hero-content{padding:16px 24px 12px!important}.hero-badge{font-size:12px!important;margin-bottom:20px!important}.hero-h1{font-size:36px!important}.hero-refined{font-size:40px!important}.hero-sub{font-size:15px!important;margin-bottom:28px!important}.hero-btns{gap:10px!important}.hero-btn{padding:13px 28px!important;font-size:14px!important;border-radius:12px!important}.hero-stat-val{font-size:18px!important}.hero-carousel-item{padding:7px 14px!important;font-size:12px!important;border-radius:10px!important;gap:6px!important}.s2-features{grid-template-columns:1fr 1fr!important}.s2-features{gap:8px!important}.s2-features .feat{padding:14px!important;border-radius:14px!important}.feat-desc{display:none!important}.feat-row{gap:10px!important;margin-bottom:0!important}.feat-ic{width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;border-radius:9px!important;font-size:15px!important}.s2-features .feat h3{font-size:13px!important}.s2-label{display:none!important}.s2-wrap{padding:16px 20px 10px!important}.s2-steps-wrap{padding:10px 20px 20px!important}.s2-wrap h2{font-size:22px!important}.s2-wrap h2 .serif{font-size:25px!important}.s2-steps-wrap h2{font-size:18px!important}.s2-steps{display:flex!important;flex-direction:row!important;gap:8px!important;grid-template-columns:none!important}.s2-step{flex:1!important;padding:16px 8px!important;text-align:center!important;flex-direction:column!important}.s2-step-icon{width:auto!important;height:auto!important;border-radius:0!important;margin-bottom:6px!important;background:none!important;border:none!important;box-shadow:none!important;transform:none!important;font-size:18px!important}.s2-step-emoji{display:none!important}.s2-step-num{display:inline!important}.s2-step-text{display:none!important}.s2-connector{display:none!important}}
        @media(max-width:480px){.sec{min-height:calc(100vh - 92px)}}
      `}</style>

      {/* ═══ NAVBAR ═══ */}
      <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 36px",height:60,background:dark?"rgba(12,16,34,.95)":"rgba(255,255,255,.95)",backdropFilter:"blur(16px)",borderBottom:`1px solid ${t.surfaceBorder}`,flexShrink:0,zIndex:100}}>
        <button onClick={()=>scrollRef.current?.scrollTo({top:0,behavior:"smooth"})} style={{display:"flex",alignItems:"center",gap:10,background:"none",padding:0}}>
          <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#c47d8e,#8b5e6b)",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
          <span style={{fontSize:17,fontWeight:700,color:t.text,letterSpacing:1.5}}>NITRO</span>
        </button>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div className="nav-links" style={{display:"flex",gap:24,alignItems:"center"}}>
            {["Services","Pricing","FAQ"].map(l=><button key={l} onClick={()=>document.getElementById(l.toLowerCase())?.scrollIntoView({behavior:"smooth"})} style={{background:"none",fontSize:14,color:t.textSoft,fontWeight:450}}>{l}</button>)}
          </div>
          <button onClick={toggleTheme} style={{width:44,height:24,borderRadius:12,background:dark?"#c47d8e":"rgba(0,0,0,0.08)",position:"relative",transition:"all .3s",flexShrink:0}}><div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:dark?23:3,transition:"left .3s cubic-bezier(.2,.8,.2,1)",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/></button>
          <button onClick={()=>setModal("login")} className="nav-login" style={{padding:"9px 20px",borderRadius:10,background:"transparent",border:`1px solid ${t.surfaceBorder}`,color:t.text,fontSize:13,fontWeight:600}}>Log In</button>
          <button onClick={()=>setModal("signup")} style={{padding:"9px 20px",borderRadius:10,background:t.btnPrimary,color:"#fff",fontSize:13,fontWeight:600}}>Get Started</button>
        </div>
      </nav>

      {/* Promo */}
      {(promoBanner||siteAlerts.length>0)&&<div style={{flexShrink:0}}>{[...(promoBanner?[promoBanner]:[]),...siteAlerts].map((a,i)=><div key={i} style={{padding:"10px 16px",textAlign:"center",fontSize:13,fontWeight:500,background:a.type==="warning"?(dark?"rgba(217,119,6,0.15)":"#fffbeb"):(dark?"rgba(99,102,241,0.15)":"#eef2ff"),color:a.type==="warning"?(dark?"#fcd34d":"#92400e"):(dark?"#a5b4fc":"#4f46e5"),borderBottom:`1px solid ${t.surfaceBorder}`}}>{a.type==="warning"?"⚠️":"✨"} {a.message}</div>)}</div>}

      {/* ═══ SCROLLABLE CONTENT ═══ */}
      <div ref={scrollRef} style={{flex:1,overflowY:"auto",overflowX:"hidden",WebkitOverflowScrolling:"touch",scrollBehavior:"smooth"}}>

        {/* ━━━ SCREEN 1: HERO ━━━ */}
        <section id="hero" className="sec" style={{textAlign:"center",overflow:"hidden",background:t.heroBg}}>
          <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}><div style={{position:"absolute",top:"-15%",left:"50%",transform:"translateX(-50%)",width:700,height:450,borderRadius:"50%",background:dark?"rgba(196,125,142,.06)":"rgba(255,255,255,.12)",filter:"blur(100px)"}}/><div style={{position:"absolute",bottom:"10%",right:"-10%",width:250,height:250,borderRadius:"50%",background:dark?"rgba(110,231,183,.03)":"rgba(255,255,255,.06)",filter:"blur(80px)"}}/></div>
          <div className="hero-content" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 40px",position:"relative",zIndex:1}}>
            <div style={{maxWidth:720}}>
              <div className="fu hero-badge" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"6px 18px",borderRadius:24,background:t.heroAccentBadge,border:`1px solid ${dark?"rgba(196,125,142,.15)":"rgba(255,255,255,.3)"}`,fontSize:13,fontWeight:550,color:dark?t.accent:"#fff",marginBottom:28,backdropFilter:"blur(8px)"}}>🚀 Trusted by {siteStats.users} creators across Nigeria</div>
              <h1 className="fu fd1 hero-h1" style={{fontSize:"clamp(42px,5.5vw,64px)",fontWeight:800,lineHeight:1.08,letterSpacing:-1,marginBottom:22,color:t.heroText}}>Social Growth,<br/><span className="serif hero-refined" style={{fontStyle:"italic",fontWeight:400,color:dark?t.accent:"#fff",fontSize:"clamp(46px,6vw,72px)",textShadow:dark?"none":"0 2px 20px rgba(196,125,142,.15)"}}>Refined.</span></h1>
              <p className="fu fd2 hero-sub" style={{fontSize:18,color:t.heroSoft,fontWeight:430,maxWidth:480,margin:"0 auto 36px",lineHeight:1.65}}>Real followers. Real engagement. Instant delivery. Nigeria's most trusted SMM platform.</p>
              <div className="fu fd3 hero-btns" style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
                <button onClick={()=>setModal("signup")} className="hero-btn" style={{padding:"15px 36px",borderRadius:14,background:t.btnPrimary,color:"#fff",fontSize:16,fontWeight:700,boxShadow:"0 8px 28px rgba(196,125,142,.3)"}}>Get Started Free →</button>
                <button onClick={()=>document.getElementById("pricing")?.scrollIntoView({behavior:"smooth"})} className="hero-btn" style={{padding:"15px 36px",borderRadius:14,background:t.heroGlass,color:t.heroText,fontSize:16,fontWeight:500,border:`1px solid ${t.heroGlassBrd}`,backdropFilter:"blur(12px)"}}>View Pricing</button>
              </div>
              <div className="fu fd4 hero-stats" style={{display:"flex",justifyContent:"center",gap:48,marginTop:48,flexWrap:"wrap"}}>
                {[[siteStats.users,"Active Users","👥"],[siteStats.orders,"Orders","📦"],["₦500","Min Deposit","💳"],["24/7","Support","💬"]].map(([v,l,ic])=><div key={l}><div style={{fontSize:16,marginBottom:4}}>{ic}</div><div className="m hero-stat-val" style={{fontSize:22,fontWeight:700,color:t.heroText}}>{v}</div><div style={{fontSize:12,color:t.heroMuted,marginTop:2,fontWeight:450}}>{l}</div></div>)}
              </div>
            </div>
          </div>
          <div className="fu fd5" style={{flexShrink:0,padding:"14px 0",overflow:"hidden",borderTop:`1px solid ${dark?t.surfaceBorder:"rgba(255,255,255,.15)"}`}}>
            <div style={{display:"flex",animation:"scroll 30s linear infinite",width:"fit-content"}}>
              {[0,1].map(rep=><div key={rep} style={{display:"flex",gap:12,paddingRight:12}}>
                {[["📸","Instagram"],["🎵","TikTok"],["▶️","YouTube"],["𝕏","Twitter/X"],["📘","Facebook"],["✈️","Telegram"],["🎵","Spotify"],["👻","Snapchat"],["🔗","LinkedIn"],["📌","Pinterest"],["🎮","Twitch"],["💬","Discord"]].map(([ic,name])=><span key={rep+name} className="hero-carousel-item" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"10px 20px",borderRadius:12,background:t.heroGlass,border:`1px solid ${t.heroGlassBrd}`,fontSize:14,color:t.heroSoft,fontWeight:450,backdropFilter:"blur(8px)",whiteSpace:"nowrap",flexShrink:0}}>{ic} {name}</span>)}
              </div>)}
            </div>
          </div>
        </section>

        {/* ━━━ SCREEN 2: WHY NITRO + HOW IT WORKS ━━━ */}
        <section id="services" style={{minHeight:"calc(100vh - 100px)",display:"flex",flexDirection:"column",position:"relative",background:dark?"rgba(255,255,255,.015)":"rgba(0,0,0,.012)",overflow:"hidden"}}>
          <div style={{flex:1,display:"flex",flexDirection:"column",position:"relative",zIndex:1,overflow:"hidden",padding:"0 48px"}}>
            <div style={{maxWidth:1140,margin:"0 auto",width:"100%",flex:1,display:"flex",flexDirection:"column"}}>

              {/* WHY NITRO block */}
              <div className="s2-wrap" style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"20px 0 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:20}}>
                  <div className="s2-label" style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:3,color:t.accent}}>Features</div>
                  <h2 style={{fontSize:32,fontWeight:800,color:t.text,letterSpacing:-.5,lineHeight:1}}>Why <span className="serif" style={{fontWeight:400,fontStyle:"italic",color:t.accent,fontSize:36}}>Nitro</span>?</h2>
                </div>
                <div className="s2-features" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
                  {[["⚡","Instant Delivery","Orders start within minutes. Real-time tracking from your dashboard.","#c47d8e"],["🛡️","Safe & Secure","No passwords ever. All services via public URL only.",dark?"#a5b4fc":"#6366f1"],["💳","Naira Payments","Cards, bank transfer, USSD. Minimum ₦500 deposit.",t.green],["🔄","Auto Refill","Follower drops replenished automatically. Zero extra cost.","#e0a458"],["📊","Live Dashboard","Modern app-like panel to manage orders and track growth.","#c47d8e"],["🤝","5% Referrals","Earn commission on every order your referrals make. Forever.",t.green]].map(([ic,title,desc,color],i)=><div key={i} className="feat" style={{padding:"22px 20px",borderRadius:18,position:"relative",overflow:"hidden",background:t.surface,border:`1px solid ${t.surfaceBorder}`,backdropFilter:"blur(16px)"}}><div style={{position:"absolute",top:0,left:0,width:"30%",height:2,background:color,opacity:.3,borderRadius:"18px 18px 0 0"}}/><div className="feat-row" style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}><div className="feat-ic" style={{width:42,height:42,borderRadius:12,background:`${color}${dark?"14":"0a"}`,border:`1px solid ${color}${dark?"18":"0e"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{ic}</div><h3 style={{fontSize:16,fontWeight:650,color:t.text,letterSpacing:-.2}}>{title}</h3></div><p className="feat-desc" style={{fontSize:13,color:t.textSoft,lineHeight:1.55,fontWeight:430}}>{desc}</p></div>)}
                </div>
              </div>

              {/* Divider */}
              <div style={{height:1,background:t.surfaceBorder,margin:"8px 0"}}/>

              {/* HOW IT WORKS block */}
              <div className="s2-steps-wrap" style={{flexShrink:0,paddingBottom:32,paddingTop:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:24}}>
                  <h2 style={{fontSize:28,fontWeight:800,color:t.text,letterSpacing:-.3}}>How It Works</h2>
                  <div className="s2-label" style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:3,color:t.green}}>4 Simple Steps</div>
                </div>
                <div className="s2-steps" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:0,position:"relative"}}>
                  <div className="s2-connector" style={{position:"absolute",top:28,left:"12%",right:"12%",height:2,background:dark?"rgba(255,255,255,.04)":"rgba(0,0,0,.035)",zIndex:0}}><div style={{height:"100%",width:`${(activeStep/3)*100}%`,background:t.btnPrimary,borderRadius:1,transition:"width .6s cubic-bezier(.16,1,.3,1)"}}/></div>
                  {[["Sign Up","Free account in 30 seconds.","👤"],["Fund Wallet","From ₦500 via Paystack.","💰"],["Place Order","Pick service, paste link.","🚀"],["Watch Growth","Delivery starts instantly.","📈"]].map(([title,desc,icon],i)=>{const isActive=activeStep===i;const isPast=i<activeStep;return <div key={i} className="s2-step" onMouseEnter={()=>setActiveStep(i)} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"0 12px",position:"relative",zIndex:1,cursor:"pointer"}}><div className="s2-step-icon" style={{width:56,height:56,borderRadius:16,marginBottom:14,background:isActive?t.btnPrimary:t.surface,border:`1.5px solid ${isActive?"transparent":(isPast?t.accent+"30":t.surfaceBorder)}`,backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:isActive?24:20,boxShadow:isActive?"0 8px 24px rgba(196,125,142,.25)":"none",transition:"all .4s cubic-bezier(.16,1,.3,1)",transform:isActive?"scale(1.08)":"none"}}><span className="s2-step-emoji" style={{display:isActive?"inline":"none"}}>{icon}</span><span className="s2-step-num m" style={{display:isActive?"none":"inline",fontSize:16,fontWeight:700,color:isPast?t.accent:t.textMuted,transition:"color .3s"}}>0{i+1}</span></div><div style={{textAlign:"center"}}><div style={{fontSize:14,fontWeight:isActive?650:500,color:isActive?t.text:(isPast?t.text:t.textSoft),transition:"all .3s",marginBottom:3}}>{title}</div><div className="s2-step-text" style={{fontSize:12,color:t.textMuted,fontWeight:430,lineHeight:1.4,maxHeight:isActive?40:0,overflow:"hidden",opacity:isActive?1:0,transition:"all .4s cubic-bezier(.16,1,.3,1)"}}>{desc}</div></div></div>})}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━ SCREEN 3: PRICING ━━━ */}
        <section id="pricing" className="pricing-sec">
          <div className="pricing-bg">
            <div className="pricing-glow-center"/>
            <div className="pricing-glow-left"/>
            <div className="pricing-glow-right"/>
          </div>
          <div className="pricing-content">
            <div className="pricing-header">
              <div className="pricing-badge">💰 Pay-as-you-go • No subscriptions</div>
              <h2 className="pricing-title">Transparent <span className="serif pricing-title-accent">Pricing</span></h2>
              <p className="pricing-sub">All prices per 1,000 units. No hidden fees.</p>
            </div>
            <div className="pricing-cards">
              {[
                ["TikTok",0,[["Followers","₦4,650"],["Views","₦465"],["Likes","₦2,325"],["Shares","₦1,200"]],false,"linear-gradient(135deg,#25F4EE,#FE2C55)","rgba(254,44,85,.15)"],
                ["Instagram",1,[["Followers","₦3,875"],["Likes","₦1,860"],["Reels Views","₦775"],["Story Views","₦1,240"]],true,"linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)","rgba(196,125,142,.2)"],
                ["YouTube",2,[["Subscribers","₦12,400"],["Views","₦3,100"],["Watch Time","₦77,500"],["Likes","₦1,500"]],false,"linear-gradient(135deg,#FF0000,#CC0000)","rgba(255,0,0,.12)"]
              ].map(([name,idx,prices,pop,gradient,glow])=><div key={name} className={`pc ${pop?"pc-pop":""}`}>
                {pop&&<><div className="pc-topbar" style={{background:gradient}}/><div className="pop-badge">POPULAR</div></>}
                <div className="pc-head">
                  <div className="pc-icon" style={{background:gradient,boxShadow:`0 4px 16px ${glow}`}}>
                    {idx===0&&<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.89 2.89 2.89 0 012.88-2.89c.28 0 .54.04.79.1V9.01a6.37 6.37 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.75a8.27 8.27 0 004.85 1.56V6.86a4.84 4.84 0 01-1.09-.17z"/></svg>}
                    {idx===1&&<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="#fff" stroke="none"/></svg>}
                    {idx===2&&<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/></svg>}
                  </div>
                  <div><h3 className="pc-name">{name}</h3><div className="pc-unit">per 1,000</div></div>
                </div>
                {prices.map(([svc,price],j)=><div key={svc} className="pc-row" style={{borderBottom:j<prices.length-1?"1px solid rgba(255,255,255,.05)":"none"}}><span className="pc-svc">{svc}</span><span className="m pc-price">{price}</span></div>)}
                <button onClick={()=>setModal("signup")} className={`pc-btn ${pop?"pc-btn-pop":""}`}>Get Started</button>
              </div>)}
            </div>
            <p className="pricing-note">All prices in ₦. More platforms available after signup.</p>
          </div>
        </section>

        {/* ━━━ SCREEN 4: TESTIMONIALS (9 on web, 3 on mobile) ━━━ */}
        <section id="testimonials" className="sec" style={{background:dark?"rgba(255,255,255,.015)":"rgba(0,0,0,.012)",padding:"60px 40px"}}>
          <div style={{maxWidth:1100,margin:"0 auto",width:"100%"}}>
            <div style={{textAlign:"center",marginBottom:48}}>
              <h2 style={{fontSize:"clamp(28px,4vw,40px)",fontWeight:700,color:t.text,marginBottom:10}}>Trusted by <span style={{color:t.accent}}>Creators</span></h2>
              <p style={{fontSize:16,color:t.textSoft,fontWeight:430}}>Real people. Real results. Real growth.</p>
            </div>
            <div className="test-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
              {[["Chioma A.","Instagram Influencer","Nitro helped me hit 50K followers. The delivery is incredibly fast and the followers actually stay. Best panel in Nigeria by far."],["Tunde O.","Music Artist","I use Nitro for Spotify and YouTube promotion. Instant delivery, Naira payments, zero stress. My streams tripled in two months."],["Blessing E.","Business Owner","My boutique's Instagram went from 2K to 25K. Real engagement that converts to sales. I recommend Nitro to every business owner I know."],["David K.","Content Creator","I was skeptical at first but the results speak for themselves. My TikTok blew up after using Nitro's views service. 100K views overnight."],["Amara N.","Brand Manager","test-hide","Managing social growth for multiple brands is easy with Nitro. The dashboard is clean, delivery is fast, and the refill guarantee gives me peace of mind."],["Emeka C.","Student Entrepreneur","test-hide","Started a social media agency using Nitro as my backend. The API is solid, prices are competitive, and I earn 5% on every referral. Game changer."],["Fatima B.","Fashion Blogger","test-hide","The quality of followers on Instagram is what sold me. Not bots — real accounts that actually engage with my content. Worth every Naira."],["Uche M.","Podcast Host","test-hide","YouTube subscribers and watch time from Nitro helped me hit monetization. The support team is responsive and the platform just works."],["Grace O.","Fitness Coach","test-hide","I've tried every SMM panel in Nigeria. Nitro is the only one with consistent delivery, actual refills, and a dashboard that doesn't look like it's from 2010."]].map(([name,role,text,cls],i)=><div key={i} className={`lift ${cls||""}`} style={{padding:"24px 22px",borderRadius:18,background:t.surface,border:`1px solid ${t.surfaceBorder}`,backdropFilter:"blur(8px)",display:"flex",flexDirection:"column"}}><div style={{fontSize:13,color:"#e0a458",marginBottom:10,letterSpacing:1}}>★★★★★</div><p style={{fontSize:14,color:t.textSoft,lineHeight:1.7,fontWeight:430,fontStyle:"italic",flex:1,marginBottom:16}}>"{text}"</p><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:36,height:36,borderRadius:"50%",background:t.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"#fff"}}>{name[0]}</div><div><div style={{fontSize:14,fontWeight:600,color:t.text}}>{name}</div><div style={{fontSize:12,color:t.textMuted,fontWeight:430}}>{role}</div></div></div></div>)}
            </div>
          </div>
        </section>

        {/* ━━━ SCREEN 5: FAQ ━━━ */}
        <section id="faq" className="sec" style={{padding:"60px 40px"}}>
          <div style={{maxWidth:760,margin:"0 auto",width:"100%"}}>
            <div style={{textAlign:"center",marginBottom:48}}>
              <h2 style={{fontSize:"clamp(28px,4vw,40px)",fontWeight:700,color:t.text,marginBottom:10}}>Frequently Asked Questions</h2>
              <p style={{fontSize:16,color:t.textSoft,fontWeight:430}}>Everything you need to know about Nitro</p>
            </div>
            {[["How does Nitro work?","Sign up free, add funds via Paystack, choose a service, paste your link, and order. Delivery starts within minutes and you can track progress in real-time from your dashboard."],["Is it safe to use?","Absolutely. We never ask for your passwords or login credentials. All services are delivered using your public profile URL only. Your accounts remain completely secure."],["How do I pay?","We accept Nigerian Naira payments via Paystack — debit cards, bank transfer, and USSD. Minimum deposit is ₦500 and funds are added to your wallet instantly."],["Will my followers drop?","Some natural fluctuation may occur. Services marked with refill guarantee will automatically replenish any drops within the guarantee period at no extra cost."],["Can I earn money with Nitro?","Yes! Every account gets a unique referral link. Share it and earn 5% commission on every order your referrals make — credited to your wallet automatically, forever."],["How fast is delivery?","Most services start delivering within minutes of placing your order. Typical completion time is 0-24 hours depending on the service type and quantity ordered."]].map(([q,a],i)=>{const isOpen=faqOpen===i;return <div key={i} style={{marginBottom:10,borderRadius:16,background:t.surface,border:`1px solid ${isOpen?"rgba(196,125,142,.25)":t.surfaceBorder}`,backdropFilter:"blur(8px)",transition:"border-color .3s ease",overflow:"hidden"}}><button onClick={()=>setFaqOpen(isOpen?null:i)} style={{width:"100%",padding:"20px 24px",fontSize:16,fontWeight:500,color:t.text,background:"none",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left",gap:16}}><span>{q}</span><span style={{fontSize:20,color:isOpen?t.accent:t.textMuted,transition:"transform .3s cubic-bezier(.2,.8,.2,1)",transform:isOpen?"rotate(45deg)":"none",flexShrink:0,lineHeight:1}}>+</span></button><div style={{maxHeight:isOpen?300:0,overflow:"hidden",transition:"max-height .4s cubic-bezier(.4,0,.2,1)"}}><div style={{padding:"0 24px 20px",fontSize:15,color:t.textSoft,lineHeight:1.75,fontWeight:430,borderTop:`1px solid ${t.surfaceBorder}`}}><div style={{paddingTop:16}}>{a}</div></div></div></div>})}
          </div>
        </section>

        {/* ━━━ SCREEN 6: CTA + FOOTER ━━━ */}
        <section id="cta" className="sec" style={{background:dark?"rgba(255,255,255,.015)":"rgba(0,0,0,.012)"}}>
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px"}}>
            <div style={{textAlign:"center",maxWidth:600,margin:"0 auto",padding:"60px 40px",borderRadius:24,background:t.surface,border:`1px solid ${t.surfaceBorder}`,backdropFilter:"blur(12px)",boxShadow:dark?"0 8px 32px rgba(0,0,0,.2)":"0 8px 32px rgba(0,0,0,.04)"}}>
              <h2 style={{fontSize:"clamp(30px,4.5vw,48px)",fontWeight:800,color:t.text,marginBottom:16}}>Ready to <span className="serif" style={{fontStyle:"italic",fontWeight:400,color:t.accent}}>Grow</span>?</h2>
              <p style={{fontSize:16,color:t.textSoft,marginBottom:36,fontWeight:430}}>Join {siteStats.users} Nigerian creators already using Nitro.</p>
              <button onClick={()=>setModal("signup")} style={{padding:"16px 52px",borderRadius:14,background:t.btnPrimary,color:"#fff",fontSize:17,fontWeight:700,boxShadow:"0 8px 28px rgba(196,125,142,.25)"}}>Create Free Account</button>
            </div>
          </div>
          <Footer t={t} dark={dark}/>
        </section>

      </div>

      {modal&&<AuthModal dark={dark} t={t} mode={modal} setMode={setModal} onClose={closeModal}/>}
    </div>
  );
}

const Lbl=({t,children})=><label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>{children}</label>;
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
function AuthModal({dark,t,mode,setMode,onClose}){
  const [method,setMethod]=useState("email");
  const [showPw,setShowPw]=useState(false);
  const [showPw2,setShowPw2]=useState(false);
  const [step,setStep]=useState(1);
  const [remember,setRemember]=useState(false);
  const [authLoading,setAuthLoading]=useState(false);
  const [error,setError]=useState("");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [emailTaken,setEmailTaken]=useState(false);
  const [emailChecking,setEmailChecking]=useState(false);
  const emailCheckTimer=useRef(null);
  const [phone,setPhone]=useState("");
  const [pw,setPw]=useState("");
  const [pw2,setPw2]=useState("");
  const [refCode,setRefCode]=useState("");
  const [agree,setAgree]=useState(false);
  const [forgotSent,setForgotSent]=useState(false);
  useEffect(()=>{setStep(1);setAuthLoading(false);setError("");setPw("");setPw2("");setName("");setEmail("");setPhone("");setEmailTaken(false);setForgotSent(false);},[mode]);
  useEffect(()=>{
    if(mode!=="signup"||!email||!validEmail){setEmailTaken(false);return;}
    setEmailChecking(true);
    if(emailCheckTimer.current)clearTimeout(emailCheckTimer.current);
    emailCheckTimer.current=setTimeout(()=>{
      fetch("/api/auth/check-email",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})})
        .then(r=>r.json()).then(d=>{setEmailTaken(!d.available);setEmailChecking(false);})
        .catch(()=>setEmailChecking(false));
    },600);
    return()=>{if(emailCheckTimer.current)clearTimeout(emailCheckTimer.current);};
  },[email,mode]);
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

  const handleForgot=async()=>{
    setError("");
    if(!email){setError("Please enter your email");return;}
    setAuthLoading(true);
    try{
      const res=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
      const data=await res.json();
      if(!res.ok){setError(data.error||"Failed to send reset link");setAuthLoading(false);return;}
      setForgotSent(true);setAuthLoading(false);
    }catch{setError("Something went wrong.");setAuthLoading(false);}
  };

  const validEmail=email&&/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const validPhone=phone&&/^[0-9]{10,11}$/.test(phone);
  const pwMatch=pw2.length>0&&pw===pw2;
  const pwMismatch=pw2.length>0&&pw!==pw2;

  const EyeBtn=({show,toggle})=><button onClick={toggle} type="button" style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",color:t.textMuted,padding:2,border:"none",cursor:"pointer"}}>{show?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}</button>;
  const MethodToggle=()=><div style={{display:"flex",gap:0,marginBottom:20,background:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)",borderRadius:10,padding:3,border:`1px solid ${t.surfaceBorder}`}}><button onClick={()=>setMethod("email")} style={{flex:1,padding:"9px 0",borderRadius:8,fontSize:13,fontWeight:550,background:method==="email"?t.accentLight:"transparent",color:method==="email"?t.accent:t.textMuted,border:"none",cursor:"pointer"}}>Email</button><button onClick={()=>setMethod("phone")} style={{flex:1,padding:"9px 0",borderRadius:8,fontSize:13,fontWeight:550,background:method==="phone"?t.accentLight:"transparent",color:method==="phone"?t.accent:t.textMuted,border:"none",cursor:"pointer"}}>Phone</button></div>;

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:100,background:t.overlay,backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16,animation:"fi 0.2s ease"}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:440,height:580,maxHeight:"90vh",overflow:"hidden",background:dark?"rgba(17,22,40,0.98)":"rgba(255,255,255,0.98)",border:`1px solid ${t.surfaceBorder}`,borderRadius:20,padding:"36px 32px",boxShadow:dark?"0 20px 60px rgba(0,0,0,0.5)":"0 20px 60px rgba(0,0,0,0.1)",backdropFilter:"blur(20px)",position:"relative"}}>
        <button onClick={onClose} style={{position:"absolute",top:16,right:16,background:"none",color:t.textMuted,fontSize:20,padding:4,lineHeight:1,border:"none",cursor:"pointer"}}>✕</button>
        
        {/* Logo */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:24}}><div style={{width:38,height:38,borderRadius:10,background:"linear-gradient(135deg,#c47d8e,#8b5e6b)",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div></div>

        {/* Title */}
        <h2 style={{fontSize:24,fontWeight:700,color:t.text,textAlign:"center",marginBottom:4}}>{mode==="login"?"Welcome back":mode==="forgot"?"Forgot password?":step===1?"Create Account":"Secure Your Account"}</h2>
        <p style={{fontSize:14,color:t.textSoft,textAlign:"center",marginBottom:28,fontWeight:430}}>{mode==="login"?"Log in to your Nitro account":mode==="forgot"?(forgotSent?"Check your email for the reset link":"Enter your email and we'll send a reset link"):step===1?"Step 1 of 2 — Your details":"Step 2 of 2 — Set your password"}</p>

        {/* Error */}
        {error&&<div style={{padding:"10px 14px",borderRadius:10,background:dark?"rgba(220,38,38,0.1)":"#fef2f2",border:`1px solid ${dark?"rgba(220,38,38,0.2)":"#fecaca"}`,color:dark?"#fca5a5":"#dc2626",fontSize:13,marginBottom:16,animation:"fu .3s ease"}}>⚠️ {error}</div>}

        {/* ── LOGIN ── */}
        {mode==="login"&&<>
          <MethodToggle/>
          <Lbl t={t}>{method==="email"?"Email Address":"Phone Number"}</Lbl>
          {method==="email"?<input value={email} onChange={e=>setEmail(e.target.value.trim().toLowerCase().slice(0,254))} placeholder="you@example.com" type="email" autoComplete="email" style={{width:"100%",padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:16}}/>:<div style={{display:"flex",gap:8,marginBottom:16}}><div style={{padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.textSoft,fontSize:14,flexShrink:0}}>+234</div><input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,11))} placeholder="8012345678" type="tel" autoComplete="tel" style={{flex:1,padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/></div>}
          <Lbl t={t}>Password</Lbl>
          <div style={{position:"relative",marginBottom:16}}>
            <input value={pw} onChange={e=>setPw(e.target.value.slice(0,128))} placeholder="Enter password" maxLength={128} type={showPw?"text":"password"} onKeyDown={e=>e.key==="Enter"&&handleLogin()} style={{width:"100%",padding:"12px 44px 12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/>
            <EyeBtn show={showPw} toggle={()=>setShowPw(!showPw)}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{accentColor:t.accent,width:15,height:15}}/><span style={{fontSize:12,color:t.textSoft}}>Remember me</span></label>
            <button onClick={()=>setMode("forgot")} style={{background:"none",color:t.accent,fontSize:12,fontWeight:500,border:"none",cursor:"pointer"}}>Forgot password?</button>
          </div>
          <button onClick={handleLogin} disabled={authLoading} style={{width:"100%",padding:"14px 0",borderRadius:12,background:authLoading?"#999":t.btnPrimary,color:"#fff",fontSize:15,fontWeight:700,marginBottom:20,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:authLoading?.7:1,border:"none",cursor:"pointer"}}>{authLoading&&<span style={{width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>}{authLoading?"Logging in...":"Log In"}</button>
          <div style={{textAlign:"center",fontSize:13,color:t.textSoft}}>Don't have an account? <button onClick={()=>setMode("signup")} style={{background:"none",color:t.accent,fontWeight:600,fontSize:13,border:"none",cursor:"pointer"}}>Sign Up Free</button></div>
        </>}

        {/* ── SIGNUP STEP 1 ── */}
        {mode==="signup"&&step===1&&<>
          <Lbl t={t}>Full Name</Lbl>
          <input value={name} onChange={e=>setName(e.target.value.replace(/[^a-zA-Z\u00C0-\u017F\s'\-\.]/g,"").slice(0,100))} placeholder="Enter your full name" maxLength={100} type="text" style={{width:"100%",padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:16}}/>
          <MethodToggle/>
          <Lbl t={t}>{method==="email"?"Email Address":"Phone Number"}</Lbl>
          {method==="email"?<><input value={email} onChange={e=>setEmail(e.target.value.trim().toLowerCase().slice(0,254))} placeholder="you@example.com" type="email" autoComplete="email" style={{width:"100%",padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:email&&!validEmail?4:16}}/>{email&&!validEmail&&<div style={{fontSize:11,color:dark?"#fca5a5":"#dc2626",marginBottom:12}}>Please enter a valid email</div>}{email&&validEmail&&emailTaken&&<div style={{fontSize:11,color:dark?"#fca5a5":"#dc2626",marginBottom:12}}>This email is already registered</div>}{email&&validEmail&&emailChecking&&<div style={{fontSize:11,color:t.textMuted,marginBottom:12}}>Checking...</div>}</>:<div style={{display:"flex",gap:8,marginBottom:phone&&!validPhone?4:16}}><div style={{padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.textSoft,fontSize:14,flexShrink:0}}>+234</div><input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,"").slice(0,11))} placeholder="8012345678" type="tel" autoComplete="tel" style={{flex:1,padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/></div>}
          {phone&&!validPhone&&method==="phone"&&<div style={{fontSize:11,color:dark?"#fca5a5":"#dc2626",marginBottom:12}}>Enter 10-11 digits</div>}
          <button onClick={()=>{setError("");if(!name){setError("Please enter your name");return;}if(method==="email"&&(!email||!validEmail)){setError("Please enter a valid email");return;}if(method==="phone"&&(!phone||!validPhone)){setError("Please enter a valid phone number");return;}setStep(2);}} style={{width:"100%",padding:"14px 0",borderRadius:12,background:t.btnPrimary,color:"#fff",fontSize:15,fontWeight:700,marginBottom:20,border:"none",cursor:"pointer"}}>Continue →</button>
          <div style={{textAlign:"center",fontSize:13,color:t.textSoft}}>Already have an account? <button onClick={()=>setMode("login")} style={{background:"none",color:t.accent,fontWeight:600,fontSize:13,border:"none",cursor:"pointer"}}>Log In</button></div>
          <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:20}}><div style={{width:8,height:8,borderRadius:"50%",background:t.accent}}/><div style={{width:8,height:8,borderRadius:"50%",background:t.textMuted}}/></div>
        </>}

        {/* ── SIGNUP STEP 2 ── */}
        {mode==="signup"&&step===2&&<>
          <Lbl t={t}>Password</Lbl>
          <div style={{position:"relative",marginBottom:4}}>
            <input placeholder="Min. 6 characters" value={pw} onChange={e=>setPw(e.target.value.slice(0,128))} type={showPw?"text":"password"} maxLength={128} style={{width:"100%",padding:"12px 44px 12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/>
            <EyeBtn show={showPw} toggle={()=>setShowPw(!showPw)}/>
          </div>
          <PwStrength pw={pw} t={t}/>
          <Lbl t={t}>Confirm Password</Lbl>
          <div style={{position:"relative",marginBottom:4}}>
            <input value={pw2} onChange={e=>setPw2(e.target.value.slice(0,128))} placeholder="Re-enter password" maxLength={128} type={showPw2?"text":"password"} style={{width:"100%",padding:"12px 44px 12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${pwMismatch?(dark?"rgba(220,38,38,0.4)":"#fecaca"):pwMatch?(dark?"rgba(110,231,183,0.4)":"#a7f3d0"):t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/>
            <EyeBtn show={showPw2} toggle={()=>setShowPw2(!showPw2)}/>
          </div>
          {pwMatch&&<div style={{fontSize:11,color:dark?"#6ee7b7":"#059669",marginBottom:12}}>✓ Passwords match</div>}
          {pwMismatch&&<div style={{fontSize:11,color:dark?"#fca5a5":"#dc2626",marginBottom:12}}>✕ Passwords don't match</div>}
          {!pw2&&<div style={{height:12,marginBottom:12}}/>}
          <Lbl t={t}>Referral Code <span style={{color:t.textMuted,fontWeight:400}}>(optional)</span></Lbl>
          <input value={refCode} onChange={e=>setRefCode(e.target.value.replace(/[^a-zA-Z0-9\-]/g,"").toUpperCase().slice(0,20))} placeholder="e.g. NTR-7X92" maxLength={20} type="text" style={{width:"100%",padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:16}}/>
          <label style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:24,cursor:"pointer"}}>
            <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} style={{marginTop:3,accentColor:t.accent,width:16,height:16,flexShrink:0}}/>
            <span style={{fontSize:12,color:t.textSoft,lineHeight:1.5}}>I agree to the <a href="/terms" style={{color:t.accent,textDecoration:"none"}}>Terms of Service</a> and <a href="/privacy" style={{color:t.accent,textDecoration:"none"}}>Privacy Policy</a></span>
          </label>
          <button onClick={handleSignup} disabled={authLoading} style={{width:"100%",padding:"14px 0",borderRadius:12,background:authLoading?"#999":t.btnPrimary,color:"#fff",fontSize:15,fontWeight:700,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:authLoading?.7:1,border:"none",cursor:"pointer"}}>{authLoading&&<span style={{width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>}{authLoading?"Creating Account...":"Create Account"}</button>
          <button onClick={()=>setStep(1)} style={{width:"100%",padding:"10px 0",borderRadius:10,background:"transparent",color:t.textSoft,fontSize:13,fontWeight:500,border:"none",cursor:"pointer"}}>← Back to Step 1</button>
          <div style={{display:"flex",justifyContent:"center",gap:6,marginTop:16}}><div style={{width:8,height:8,borderRadius:"50%",background:t.textMuted}}/><div style={{width:8,height:8,borderRadius:"50%",background:t.accent}}/></div>
        </>}

        {/* ── FORGOT PASSWORD ── */}
        {mode==="forgot"&&!forgotSent&&<>
          <Lbl t={t}>Email Address</Lbl>
          <input value={email} onChange={e=>setEmail(e.target.value.trim().toLowerCase().slice(0,254))} placeholder="you@example.com" type="email" style={{width:"100%",padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:20}}/>
          <button onClick={handleForgot} disabled={authLoading} style={{width:"100%",padding:"14px 0",borderRadius:12,background:authLoading?"#999":t.btnPrimary,color:"#fff",fontSize:15,fontWeight:700,marginBottom:20,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:authLoading?.7:1,border:"none",cursor:"pointer"}}>{authLoading&&<span style={{width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>}{authLoading?"Sending...":"Send Reset Link"}</button>
          <div style={{textAlign:"center",fontSize:13,color:t.textSoft}}>Remember your password? <button onClick={()=>setMode("login")} style={{background:"none",color:t.accent,fontWeight:600,fontSize:13,border:"none",cursor:"pointer"}}>Log In</button></div>
        </>}
        {mode==="forgot"&&forgotSent&&<>
          <div style={{width:64,height:64,borderRadius:"50%",background:dark?"rgba(110,231,183,0.1)":"rgba(5,150,105,0.06)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",border:`2px solid ${t.green}`}}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={t.green} strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg></div>
          <p style={{fontSize:14,color:t.textSoft,textAlign:"center",marginBottom:4}}>Reset link sent to</p>
          <p className="m" style={{fontSize:14,fontWeight:600,color:t.text,textAlign:"center",marginBottom:24}}>{email}</p>
          <p style={{fontSize:13,color:t.textMuted,textAlign:"center",marginBottom:24}}>Check your inbox and spam folder. The link expires in 15 minutes.</p>
          <button onClick={()=>setMode("login")} style={{width:"100%",padding:"14px 0",borderRadius:12,background:t.btnPrimary,color:"#fff",fontSize:15,fontWeight:700,border:"none",cursor:"pointer"}}>Back to Login</button>
        </>}
      </div>
    </div>
  );
}

export function Footer({t,dark}){
  return(
    <footer style={{position:"relative",zIndex:1,borderTop:`1px solid ${t.surfaceBorder}`,transition:"border-color 1.5s ease,background 1.5s ease"}}>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"48px 24px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:40,marginBottom:40}}>
          <div style={{maxWidth:280}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#c47d8e,#8b5e6b)",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <span className="serif" style={{fontSize:18,fontWeight:600,color:t.text}}>Nitro</span>
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
          <div style={{fontSize:12,color:t.textMuted}}>© 2026 Nitro. All rights reserved.</div>
          <div style={{display:"flex",gap:16}}>{["Twitter","Instagram"].map(s=><a key={s} href="#" style={{fontSize:12,color:t.textSoft,textDecoration:"none"}}>{s}</a>)}</div>
        </div>
      </div>
    </footer>
  );
}

