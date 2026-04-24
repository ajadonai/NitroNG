'use client';
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { ThemeProvider, useTheme } from "./shared-nav";
import { SITE } from "../lib/site";
import AnnouncementBanner from "./announcement-banner";

const AuthModal = dynamic(() => import("./auth-modal"), { ssr: false });
const BelowFold = dynamic(() => import('./landing-below-fold'), { ssr: true });

function PwStrength({ pw, dark }) {
  if (!pw) return <div className="min-h-[20px] mb-1.5" />;
  const hasLen = pw.length >= 8;
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum = /[0-9]/.test(pw);
  const hasSym = /[^a-zA-Z0-9]/.test(pw);
  const score = (hasLen ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSym ? 1 : 0);
  const levels = [null, ["Weak", "#ef4444"], ["Fair", "#f59e0b"], ["Good", "#3b82f6"], ["Strong", "#22c55e"]];
  const tooShort = pw.length < 6;
  const [label, color] = tooShort ? ["Too short", "#ef4444"] : (levels[score] || ["Weak", "#ef4444"]);
  const fill = tooShort ? 1 : score;
  const empty = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)";
  return (
    <div className="min-h-[20px] mb-1.5">
      <div className="flex gap-[3px] mb-[3px]">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-[3px] flex-1 rounded-sm" style={{ background: i <= fill ? color : empty, transition: "background .2s" }} />
        ))}
      </div>
      <div className="text-[11px] font-medium" style={{ color: color }}>{label}</div>
    </div>
  );
}


function LandingInner(){
  const { dark, toggleTheme, t: baseT } = useTheme();

  const [modal,setModal]=useState(null);
  const [heroAuth,setHeroAuth]=useState("login");
  const [heroMethod,setHeroMethod]=useState("email");
  const [heroName,setHeroName]=useState("");
  const [heroFirstName,setHeroFirstName]=useState("");
  const [heroLastName,setHeroLastName]=useState("");
  const [heroEmail,setHeroEmail]=useState("");
  const [heroPw,setHeroPw]=useState("");
  const [heroLoading,setHeroLoading]=useState(false);
  const [heroError,setHeroError]=useState("");
  const [heroSuccess,setHeroSuccess]=useState("");
  const [heroSignupData,setHeroSignupData]=useState(null);
  const [heroSignupStep,setHeroSignupStep]=useState(1);
  const [heroPw2,setHeroPw2]=useState("");
  const [heroPhone,setHeroPhone]=useState("");
  const [heroRefCode,setHeroRefCode]=useState("");
  const [heroAgree,setHeroAgree]=useState(false);
  const [heroShowPw,setHeroShowPw]=useState(false);
  const [scrolled,setScrolled]=useState(false);
  const [activeSection,setActiveSection]=useState(0);
  const scrollRef=useRef(null);
  const [siteStats,setSiteStats]=useState({users:"12K+",orders:"2M+"});
  const [siteAlerts,setSiteAlerts]=useState([]);
  const [socialLinks,setSocialLinks]=useState({});

  useEffect(()=>{const el=scrollRef.current;if(!el)return;const onScroll=()=>setScrolled(el.scrollTop>20);el.addEventListener("scroll",onScroll);return()=>el.removeEventListener("scroll",onScroll);},[]);
  const [logoutMsg,setLogoutMsg]=useState(false);
  const [googleError,setGoogleError]=useState(false);
  const [sessionExpired,setSessionExpired]=useState(false);
  useEffect(()=>{const p=new URLSearchParams(window.location.search);if(p.get("login"))setModal("login");if(p.get("signup"))setModal("signup");if(p.get("ref"))setModal("signup");if(p.get("session_expired")){setSessionExpired(true);window.history.replaceState({},"","/");}if(p.get("logout")){setLogoutMsg(true);window.history.replaceState({},"","/");setTimeout(()=>setLogoutMsg(false),4000);}if(p.get("google_error")){setGoogleError(true);window.history.replaceState({},"","/");setTimeout(()=>setGoogleError(false),5000);setModal("login");}if(p.get("error")==="account_pending_deletion"){setHeroError("This account is scheduled for deletion. Contact support@nitro.ng to reinstate it.");window.history.replaceState({},"","/");}},[]);
  useEffect(()=>{(async()=>{try{const [maintRes,siRes,stRes]=await Promise.all([fetch("/api/maintenance-check"),fetch("/api/site-info"),fetch("/api/settings")]);if(maintRes.ok){const m=await maintRes.json();if(m.maintenance){window.location.replace("/maintenance");return;}}if(siRes.ok){const d=await siRes.json();if(d.stats)setSiteStats(d.stats);if(d.alerts?.length)setSiteAlerts(d.alerts);}if(stRes.ok){const d=await stRes.json();setSocialLinks(d.settings||{});}}catch{}})();},[]);
  const closeModal=useCallback(()=>setModal(null),[]);

  // Scroll lock when modal is open
  useEffect(()=>{if(modal){document.body.style.overflow="hidden";}else{document.body.style.overflow="";}return()=>{document.body.style.overflow="";};},[modal]);

  // Hero card auth handlers
  const heroLoginSubmit=async()=>{
    setHeroError("");if(!heroEmail||!heroPw){setHeroError("Please fill in all fields");return;}
    setHeroLoading(true);
    try{const res=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:heroMethod==="email"?heroEmail:`+234${heroEmail}`,password:heroPw})});const data=await res.json();if(!res.ok){if(data.banned){window.location.href="/banned";return;}setHeroError(data.error||"Login failed");setHeroLoading(false);return;}window.location.replace("/dashboard");}catch{setHeroError("Something went wrong.");setHeroLoading(false);}
  };
  const heroSignupSubmit=()=>{
    setHeroError("");if(!heroFirstName||!heroLastName){setHeroError("Please enter your first and last name");return;}if(!heroEmail){setHeroError("Please enter your email");return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(heroEmail)){setHeroError("Please enter a valid email");return;}
    setHeroSignupStep(2);
  };
  const heroSignupFinalSubmit=async()=>{
    setHeroError("");
    if(!heroPw||heroPw.length<6){setHeroError("Password must be at least 6 characters");return;}
    if(heroPw!==heroPw2){setHeroError("Passwords don't match");return;}
    if(!heroAgree){setHeroError("Please agree to the Terms of Service");return;}
    setHeroLoading(true);
    try{
      const res=await fetch("/api/auth/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:`${heroFirstName} ${heroLastName}`,firstName:heroFirstName,lastName:heroLastName,email:heroEmail,password:heroPw,phone:heroPhone?`+234${heroPhone}`:undefined,referralCode:heroRefCode||undefined})});
      const data=await res.json();
      if(!res.ok){setHeroError(data.error||"Signup failed");setHeroLoading(false);return;}
      window.location.replace("/dashboard");
    }catch{setHeroError("Something went wrong.");setHeroLoading(false);}
  };
  const heroForgotSubmit=async()=>{
    setHeroError("");if(!heroEmail){setHeroError("Please enter your email");return;}
    setHeroLoading(true);
    try{const res=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:heroEmail})});const data=await res.json();if(!res.ok){setHeroError(data.error||"Failed to send reset link");setHeroLoading(false);return;}setHeroError("");setHeroLoading(false);setHeroAuth("login");setHeroSuccess("Reset link sent! Check your email.");}catch{setHeroError("Something went wrong.");setHeroLoading(false);}
  };

  const sectionIds=["hero","services","pricing","testimonials","cta"];
  const currentSec=useRef(0);
  useEffect(()=>{
    const handleKey=(e)=>{
      if(modal)return;if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
      if(e.code==="Space"){e.preventDefault();const next=e.shiftKey?Math.max(0,currentSec.current-1):Math.min(sectionIds.length-1,currentSec.current+1);currentSec.current=next;document.getElementById(sectionIds[next])?.scrollIntoView({behavior:"smooth"});}
    };
    window.addEventListener("keydown",handleKey);return()=>window.removeEventListener("keydown",handleKey);
  },[modal]);
  useEffect(()=>{
    const el=scrollRef.current;if(!el)return;
    const onScroll=()=>{const sections=sectionIds.map(id=>document.getElementById(id)).filter(Boolean);const st=el.scrollTop;let c=0,min=Infinity;sections.forEach((s,i)=>{const d=Math.abs(s.offsetTop-st);if(d<min){min=d;c=i;}});currentSec.current=c;setActiveSection(c);};
    el.addEventListener("scroll",onScroll,{passive:true});return()=>el.removeEventListener("scroll",onScroll);
  },[]);

  const t=useMemo(()=>({
    ...baseT,
    bgAlt:dark?"#0f1322":"#e6e3dc",
    logoGrad:"linear-gradient(135deg,#c47d8e,#8b5e6b)",
    heroBg:dark?"linear-gradient(135deg,#060810 0%,#0a0f1e 40%,#0d0a18 100%)":"linear-gradient(135deg,#c47d8e 0%,#a3586b 40%,#8b4a5e 100%)",
    heroText:dark?"#eae7e2":"#fff",heroSoft:dark?"#b0aca8":"rgba(255,255,255,.85)",heroMuted:dark?"#7d7974":"rgba(255,255,255,.55)",
    heroGlass:dark?"rgba(15,19,35,.5)":"rgba(255,255,255,.12)",heroGlassBrd:dark?"rgba(255,255,255,.08)":"rgba(255,255,255,.2)",
    heroAccentBadge:dark?"rgba(196,125,142,.15)":"rgba(255,255,255,.15)",
  }),[dark,baseT]);

  return(
    <div className="root h-dvh overflow-hidden flex flex-col" suppressHydrationWarning>
      <style suppressHydrationWarning>{`
        .root{background:${t.bg};color:${t.text};transition:background 1.2s ease,color 1.2s ease}
      `}</style>

      {/* ═══ NAVBAR — outside snap container ═══ */}
      <nav className="main-nav px-8 max-desktop:px-7 max-md:px-3.5 h-14 max-md:h-[52px] flex items-center justify-between shrink-0 z-[100]" style={{background:dark?"#060810":scrolled?"rgba(139,74,94,.98)":"rgba(163,88,107,.96)",borderBottom:`0.5px solid ${dark?"rgba(255,255,255,.12)":"rgba(255,255,255,.24)"}`,transition:"background 1.2s ease"}}>
          <button onClick={()=>scrollRef.current?.scrollTo({top:0,behavior:"smooth"})} className="nav-brand flex items-center gap-2.5 bg-transparent p-0">
            <div className="nav-logo w-[30px] h-[30px] rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#c47d8e,#8b5e6b)",boxShadow:"0 2px 8px rgba(196,125,142,.3)"}}><svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <span className="nav-brand-text text-base font-semibold tracking-[1.5px]" style={{color:"#fff"}}>NITRO</span>
          </button>
          <div className="nav-right flex items-center gap-2.5">
            <div className="flex max-desktop:hidden gap-1 items-center mr-1.5">
              {["Services","Pricing","Testimonials"].map(l=><button key={l} onClick={()=>document.getElementById(l.toLowerCase())?.scrollIntoView({behavior:"smooth"})} className="nav-link-pill py-1.5 px-4 rounded-lg bg-transparent text-sm font-medium border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{color:dark?"rgba(255,255,255,.75)":"rgba(255,255,255,.75)"}}>{l}</button>)}
            </div>
            <button onClick={toggleTheme} aria-label={dark?"Switch to light":"Switch to dark"} className="theme-toggle w-[44px] h-[24px] rounded-xl relative shrink-0" style={{background:dark?"rgba(99,102,241,.28)":"rgba(255,255,255,.24)",transition:"background .8s ease",border:`0.5px solid ${dark?"rgba(99,102,241,.24)":"rgba(255,255,255,.28)"}`}}>
              <div className="w-[18px] h-[18px] rounded-full absolute flex items-center justify-center" style={{background:dark?"#1e1b4b":"#fff",top:2.5,left:dark?22.5:2.5,transition:"left .8s cubic-bezier(.4,0,.2,1), background .8s ease"}}>
                {dark?<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                :<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
              </div>
            </button>
            <button onClick={()=>setModal("login")} className="nav-login-btn py-[7px] px-5 rounded-lg text-sm font-semibold cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{background:dark?"rgba(255,255,255,.12)":"rgba(255,255,255,.19)",border:`0.5px solid ${dark?"rgba(255,255,255,.18)":"rgba(255,255,255,.28)"}`,color:dark?"rgba(255,255,255,.8)":"#fff"}}>Log in</button>
            <button onClick={()=>setModal("signup")} className="nav-signup-btn max-desktop:!hidden py-[7px] px-5 rounded-lg border-none text-sm font-semibold cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{background:"#fff",color:"#1a1a1a"}}>Get started</button>
          </div>
      </nav>

      <div ref={scrollRef} className="snap-container flex-1 overflow-y-auto overflow-x-hidden relative">

        {/* Site-wide announcement banner */}
        <AnnouncementBanner alerts={siteAlerts} dark={dark} mode="landing" />

        {/* ━━━ HERO ━━━ */}
        <section id="hero" className="snap-section overflow-hidden relative flex flex-col" style={{background:t.heroBg}}>

          {/* Ambient orbs + particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div style={{position:"absolute",top:"-8%",left:"25%",width:500,height:400,borderRadius:"50%",background:dark?"rgba(196,125,142,.06)":"rgba(255,255,255,.08)",filter:"blur(100px)",animation:"float1 20s ease-in-out infinite"}}/>
            <div style={{position:"absolute",bottom:"5%",right:"10%",width:250,height:250,borderRadius:"50%",background:dark?"rgba(110,160,230,.04)":"rgba(255,255,255,.06)",filter:"blur(80px)",animation:"float2 25s ease-in-out infinite"}}/>
            {[["12%","20%",4,0],["22%","70%",3,1.2],["55%","12%",3,.6],["45%","85%",5,1.8],["75%","30%",3,2.4],["65%","65%",4,.9],["30%","45%",3,1.5],["85%","55%",4,2]].map(([top,left,s,d],i)=><div key={i} className="hero-particle" style={{position:"absolute",top,left,width:s,height:s,borderRadius:"50%",background:dark?"rgba(196,125,142,.2)":"rgba(255,255,255,.2)",animation:`float3 ${3.5+i*.5}s ease-in-out infinite ${d}s`}}/>)}
            {/* Social network constellation */}
            <svg className="hero-constellation" style={{position:"absolute",right:0,top:0,width:"60%",height:"100%",opacity:dark?.6:.5}} viewBox="0 0 600 420" preserveAspectRatio="xMidYMid slice" fill="none">
              <line x1="180" y1="80" x2="280" y2="140" stroke={dark?"rgba(196,125,142,.06)":"rgba(255,255,255,.1)"} strokeWidth="1"/>
              <line x1="280" y1="140" x2="400" y2="100" stroke={dark?"rgba(196,125,142,.05)":"rgba(255,255,255,.08)"} strokeWidth="1"/>
              <line x1="400" y1="100" x2="500" y2="180" stroke={dark?"rgba(196,125,142,.06)":"rgba(255,255,255,.1)"} strokeWidth="1"/>
              <line x1="250" y1="250" x2="350" y2="300" stroke={dark?"rgba(196,125,142,.05)":"rgba(255,255,255,.08)"} strokeWidth="1"/>
              <line x1="350" y1="300" x2="480" y2="260" stroke={dark?"rgba(196,125,142,.06)":"rgba(255,255,255,.1)"} strokeWidth="1"/>
              <line x1="180" y1="80" x2="250" y2="250" stroke={dark?"rgba(196,125,142,.03)":"rgba(255,255,255,.05)"} strokeWidth="1"/>
              <line x1="400" y1="100" x2="350" y2="300" stroke={dark?"rgba(196,125,142,.03)":"rgba(255,255,255,.05)"} strokeWidth="1"/>
              <g opacity={dark?"0.07":"0.12"}><rect x="160" y="60" width="40" height="40" rx="10" stroke={dark?"rgba(196,125,142,.5)":"rgba(255,255,255,.5)"} strokeWidth="1"/><rect x="168" y="68" width="24" height="24" rx="6" stroke={dark?"rgba(196,125,142,.5)":"rgba(255,255,255,.5)"} strokeWidth=".8"/><circle cx="184" cy="80" r="5" stroke={dark?"rgba(196,125,142,.5)":"rgba(255,255,255,.5)"} strokeWidth=".8"/><circle cx="188" cy="73" r="1.5" fill={dark?"rgba(196,125,142,.5)":"rgba(255,255,255,.5)"}/></g>
              <g opacity={dark?"0.06":"0.1"}><rect x="380" y="80" width="40" height="40" rx="10" stroke={dark?"rgba(110,231,183,.5)":"rgba(255,255,255,.5)"} strokeWidth="1"/><path d="M393 93 L400 100 L407 93 L407 107 L393 107 Z" stroke={dark?"rgba(110,231,183,.5)":"rgba(255,255,255,.5)"} strokeWidth=".8"/></g>
              <g opacity={dark?"0.06":"0.1"}><rect x="260" y="120" width="40" height="40" rx="10" stroke={dark?"rgba(165,180,252,.5)":"rgba(255,255,255,.5)"} strokeWidth="1"/><circle cx="280" cy="140" r="10" stroke={dark?"rgba(165,180,252,.5)":"rgba(255,255,255,.5)"} strokeWidth=".8"/><polygon points="277,136 285,140 277,144" fill={dark?"rgba(165,180,252,.5)":"rgba(255,255,255,.5)"}/></g>
              <g opacity={dark?"0.05":"0.08"}><rect x="480" y="160" width="40" height="40" rx="10" stroke={dark?"rgba(251,191,36,.4)":"rgba(255,255,255,.4)"} strokeWidth="1"/><circle cx="500" cy="180" r="8" stroke={dark?"rgba(251,191,36,.4)":"rgba(255,255,255,.4)"} strokeWidth=".8"/><path d="M497 175 L497 183 M493 179 L501 179" stroke={dark?"rgba(251,191,36,.4)":"rgba(255,255,255,.4)"} strokeWidth=".8"/></g>
              <g opacity={dark?"0.04":"0.07"}><rect x="230" y="230" width="40" height="40" rx="10" stroke={dark?"rgba(196,125,142,.5)":"rgba(255,255,255,.4)"} strokeWidth="1"/><path d="M243 243 C243 238 250 234 250 243 C250 234 257 238 257 243 C257 250 250 255 250 255 C250 255 243 250 243 243" stroke={dark?"rgba(196,125,142,.5)":"rgba(255,255,255,.4)"} strokeWidth=".8"/></g>
              <g opacity={dark?"0.04":"0.07"}><rect x="330" y="280" width="40" height="40" rx="10" stroke={dark?"rgba(110,231,183,.4)":"rgba(255,255,255,.4)"} strokeWidth="1"/><path d="M343 295 L350 300 L357 295 M343 305 L350 300 L357 305" stroke={dark?"rgba(110,231,183,.4)":"rgba(255,255,255,.4)"} strokeWidth=".8"/></g>
              <circle cx="180" cy="80" r="3" fill={dark?"rgba(196,125,142,.15)":"rgba(255,255,255,.15)"}/>
              <circle cx="280" cy="140" r="3" fill={dark?"rgba(165,180,252,.12)":"rgba(255,255,255,.12)"}/>
              <circle cx="400" cy="100" r="3" fill={dark?"rgba(110,231,183,.12)":"rgba(255,255,255,.12)"}/>
              <circle cx="500" cy="180" r="3" fill={dark?"rgba(251,191,36,.1)":"rgba(255,255,255,.1)"}/>
              <circle cx="250" cy="250" r="2" fill={dark?"rgba(196,125,142,.1)":"rgba(255,255,255,.1)"}/>
              <circle cx="350" cy="300" r="2" fill={dark?"rgba(110,231,183,.08)":"rgba(255,255,255,.08)"}/>
              <circle cx="320" cy="160" r="180" fill={dark?"rgba(196,125,142,.015)":"rgba(255,255,255,.03)"}/>
            </svg>
          </div>

          <div className="flex items-center justify-center gap-12 max-desktop:gap-0 pt-14 pb-10 max-desktop:py-0 px-[60px] max-desktop:px-10 max-md:px-5 max-w-[1200px] mx-auto w-full relative z-[1] flex-1 max-desktop:flex-col max-desktop:text-center max-desktop:min-h-0">
            {/* LEFT */}
            <div className="flex-1 max-w-[540px] text-left relative z-[1] max-desktop:flex-none max-desktop:text-center max-desktop:max-w-full max-desktop:flex max-desktop:flex-col max-desktop:items-center">
              <h1 className="fu fd1 text-[52px] max-desktop:text-[48px] max-md:text-[34px] font-semibold leading-[1.05] -tracking-[1.5px] mb-2 max-md:mb-1.5" style={{color:t.heroText}}>Real growth for<br/><span className="serif italic font-medium text-[58px] max-desktop:text-[54px] max-md:text-[40px]" style={{color:dark?t.accent:"#fff",textShadow:dark?"none":"0 2px 20px rgba(0,0,0,.15)"}}>your social media.</span></h1>
              <div className="fu fd2 max-desktop:justify-center max-md:!text-[13px] text-sm font-medium mb-4 flex items-center gap-2 flex-wrap" style={{color:dark?"rgba(244,241,237,.5)":"rgba(255,255,255,.75)"}}>
                <span className="m py-1 px-3 rounded-lg font-semibold text-[13px]" style={{background:dark?"rgba(52,211,153,.14)":"rgba(255,255,255,.24)",color:dark?"#34d399":"#fff",border:`1px solid ${dark?"rgba(52,211,153,.19)":"rgba(255,255,255,.28)"}`}}>1,000 followers</span>
                <span>from ₦850</span>
              </div>
              <p className="fu fd2 text-base max-md:text-sm font-normal max-w-[460px] max-desktop:max-w-[480px] max-md:max-w-[320px] mb-6 max-desktop:mb-5 max-md:mb-[18px] leading-[1.65] max-md:leading-[1.6] max-desktop:text-center" style={{color:t.heroSoft}}>Real engagement from real accounts. Trusted by thousands of Nigerian creators across Instagram, TikTok, YouTube and more.</p>

              {/* Stats — card style */}
              <div className="fu fd3 flex gap-2.5 max-md:gap-2 mb-7 max-md:mb-6 w-full max-w-[460px] max-desktop:max-w-[400px] max-md:max-w-[340px] max-desktop:justify-center">
                {[[siteStats.orders||"0","Orders\ndelivered",false],[siteStats.users||"0","Active\ncreators",false],["98%","Delivery\nrate",true]].map(([num,label,accent],i)=>
                  <div key={i} className="flex-1 py-3.5 px-2.5 max-md:py-3 max-md:px-1.5 rounded-xl max-md:rounded-[10px] text-center" style={{background:accent?(dark?"rgba(196,125,142,.12)":"rgba(255,255,255,.24)"):(dark?"rgba(255,255,255,.08)":"rgba(255,255,255,.18)"),border:`1px solid ${accent?(dark?"rgba(196,125,142,.18)":"rgba(255,255,255,.28)"):(dark?"rgba(255,255,255,.12)":"rgba(255,255,255,.19)")}`}}>
                    <div className="text-xl max-md:text-lg font-bold mb-0.5" style={{color:accent?(dark?t.accent:"#fff"):t.heroText}}>{num}</div>
                    <div className="text-[10px] max-md:text-[9px] font-medium uppercase tracking-[.5px] leading-[1.3]" style={{color:dark?"rgba(255,255,255,.4)":"rgba(255,255,255,.6)",whiteSpace:"pre-line"}}>{label}</div>
                  </div>
                )}
              </div>

              {/* CTAs — desktop */}
              <div className="fu fd4 max-desktop:!hidden flex gap-3 items-center flex-wrap">
                <button onClick={()=>setModal("signup")} className="hero-cta-btn py-3.5 px-9 rounded-xl text-[15px] font-semibold border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{background:"#fff",color:"#1a1a1a",boxShadow:"0 8px 32px rgba(0,0,0,.24)"}}>Place your first order <span className="text-lg">→</span></button>
                <button onClick={()=>document.getElementById("pricing")?.scrollIntoView({behavior:"smooth"})} className="hero-secondary-btn py-3.5 px-7 rounded-xl text-[15px] font-medium bg-transparent cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{border:`0.5px solid ${dark?"rgba(255,255,255,.19)":"rgba(255,255,255,.38)"}`,color:dark?"rgba(244,241,237,.7)":"#fff"}}>View pricing</button>
              </div>

              {/* Mobile CTA — full width */}
              <div className="fu fd4 hidden max-desktop:!flex max-desktop:flex-col max-desktop:items-center max-desktop:mt-6 max-md:mt-5 w-full max-w-[300px]">
                <button onClick={()=>setModal("signup")} className="hero-cta-btn w-full py-[15px] rounded-[14px] text-base font-semibold border-none" style={{background:"#fff",color:"#1a1a1a",boxShadow:"0 8px 32px rgba(0,0,0,.24)"}}>Place your first order →</button>
              </div>

              {/* Guarantee */}
              <div className="fu fd4 hero-guarantee flex items-center gap-[5px] mt-3.5 text-xs" style={{color:dark?"rgba(244,241,237,.3)":"rgba(255,255,255,.5)"}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Instant refund if we can't deliver
              </div>
            </div>

            {/* RIGHT — Auth card (desktop) */}
            <div className="w-[400px] shrink-0 max-desktop:hidden">
              <div className="rounded-[20px] py-7 px-[26px] backdrop-blur-[20px]" style={{background:dark?"rgba(17,22,40,0.95)":"rgba(255,255,255,0.95)",border:`1px solid ${dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.12)"}`,boxShadow:dark?"0 24px 64px rgba(0,0,0,0.5)":"0 24px 64px rgba(0,0,0,.18)"}}>
                <h2 className="text-[22px] font-semibold text-center mb-[3px]" style={{color:t.text}}>{heroAuth==="login"?"Let's run it up":heroAuth==="forgot"?"Forgot password?":(heroSignupStep===1?"Create Account":"Secure Your Account")}</h2>
                <p className="text-[15px] text-center mb-4 font-medium" style={{color:t.textSoft}}>{heroAuth==="login"?"Sign in and start boosting":heroAuth==="forgot"?"Enter your email for a reset link":(heroSignupStep===1?"Join "+siteStats.users+" Nigerian creators":"Step 2 of 2 — Set your password")}</p>
                {heroAuth!=="forgot"&&heroSignupStep===1&&<><button onClick={()=>{window.location.href="/api/auth/google"}} style={{width:"100%",padding:"11px 0",borderRadius:12,background:dark?"rgba(255,255,255,.12)":"#fff",border:`1px solid ${dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.19)"}`,display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontSize:14,fontWeight:600,color:dark?"#eae7e2":"#333",marginBottom:0}}><svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>{heroAuth==="login"?"Continue with Google":"Sign up with Google"}</button><div style={{display:"flex",alignItems:"center",gap:12,margin:"12px 0"}}><div style={{flex:1,height:1,background:dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.14)"}}/><span style={{fontSize:12,fontWeight:500,color:t.textMuted}}>or</span><div style={{flex:1,height:1,background:dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.14)"}}/></div></>}
                {heroAuth==="signup"&&heroSignupStep===1&&<><div style={{display:"flex",gap:8,marginBottom:12}}><div style={{flex:1}}><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>First Name</label><input placeholder="First" value={heroFirstName} onChange={e=>setHeroFirstName(e.target.value.replace(/[^a-zA-Z\u00C0-\u017F\s'\-\.]/g,"").slice(0,50))} style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:15,outline:"none",fontFamily:"inherit"}}/></div><div style={{flex:1}}><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Last Name</label><input placeholder="Last" value={heroLastName} onChange={e=>setHeroLastName(e.target.value.replace(/[^a-zA-Z\u00C0-\u017F\s'\-\.]/g,"").slice(0,50))} style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:15,outline:"none",fontFamily:"inherit"}}/></div></div><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Email Address</label><input placeholder="you@example.com" value={heroEmail} onChange={e=>setHeroEmail(e.target.value.trim().toLowerCase().slice(0,254))} type="email" style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:15,outline:"none",marginBottom:12,fontFamily:"inherit"}}/></>}
                {heroAuth==="signup"&&heroSignupStep===2&&<><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:1.5}}>Password</label><div style={{position:"relative",marginBottom:2}}><input placeholder="Min. 6 characters" value={heroPw} onChange={e=>setHeroPw(e.target.value.slice(0,128))} type={heroShowPw?"text":"password"} style={{width:"100%",padding:"9px 40px 9px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",fontFamily:"inherit"}}/><button onClick={()=>setHeroShowPw(!heroShowPw)} type="button" style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",color:t.textMuted,padding:2}}>{heroShowPw?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div><PwStrength pw={heroPw} dark={dark} /><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:1.5}}>Confirm Password</label><input placeholder="Re-enter password" value={heroPw2} onChange={e=>setHeroPw2(e.target.value.slice(0,128))} type="password" style={{width:"100%",padding:"9px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${heroPw2&&heroPw!==heroPw2?(dark?"rgba(220,38,38,.4)":"#fecaca"):heroPw2&&heroPw===heroPw2?(dark?"rgba(110,231,183,.4)":"#a7f3d0"):t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:2,fontFamily:"inherit"}}/><div style={{minHeight:14,marginBottom:4}}>{heroPw2&&heroPw===heroPw2?<span style={{fontSize:11,color:dark?"#6ee7b7":"#059669"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polyline points="20 6 9 17 4 12"/></svg> Passwords match</span>:heroPw2&&heroPw!==heroPw2?<span style={{fontSize:11,color:dark?"#fca5a5":"#dc2626"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Passwords don't match</span>:null}</div><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:1.5}}>Referral Code <span style={{fontWeight:400,color:t.textMuted}}>(optional)</span></label><input placeholder="e.g. NTR-7X92" value={heroRefCode} onChange={e=>setHeroRefCode(e.target.value.replace(/[^a-zA-Z0-9\-]/g,"").toUpperCase().slice(0,20))} style={{width:"100%",padding:"9px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:8,fontFamily:"inherit"}}/><label style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:10,cursor:"pointer"}}><input type="checkbox" checked={heroAgree} onChange={e=>setHeroAgree(e.target.checked)} style={{marginTop:2,accentColor:t.accent,width:14,height:14,flexShrink:0}}/><span style={{fontSize:12,color:t.textSoft,lineHeight:1.4}}>I agree to the <a href="/terms" style={{color:t.accent,textDecoration:"none"}}>Terms</a> and <a href="/privacy" style={{color:t.accent,textDecoration:"none"}}>Privacy Policy</a></span></label></>}
                {heroAuth==="login"&&<><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Email Address</label><input placeholder="you@example.com" value={heroEmail} onChange={e=>setHeroEmail(e.target.value.trim().toLowerCase().slice(0,254))} type="email" style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:15,outline:"none",marginBottom:12,fontFamily:"inherit"}}/><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Password</label><input placeholder="Enter password" type="password" value={heroPw} onChange={e=>setHeroPw(e.target.value.slice(0,128))} onKeyDown={e=>{if(e.key==="Enter")heroLoginSubmit()}} style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:15,outline:"none",marginBottom:14,fontFamily:"inherit"}}/><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}><input type="checkbox" style={{accentColor:t.accent,width:14,height:14}}/><span style={{fontSize:13,color:t.textSoft}}>Remember me</span></label><button onClick={()=>{setHeroAuth("forgot");setHeroError("")}} style={{background:"none",color:t.accent,fontSize:13,fontWeight:500}}>Forgot password?</button></div></>}
                {heroAuth==="forgot"&&<><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Email Address</label><input placeholder="you@example.com" value={heroEmail} onChange={e=>setHeroEmail(e.target.value.trim().toLowerCase().slice(0,254))} type="email" style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:15,outline:"none",marginBottom:16,fontFamily:"inherit"}}/></>}
                <button onClick={heroAuth==="login"?heroLoginSubmit:heroAuth==="forgot"?heroForgotSubmit:(heroSignupStep===2?heroSignupFinalSubmit:heroSignupSubmit)} disabled={heroLoading} className="w-full py-3.5 px-0 rounded-xl text-base font-semibold mb-3.5 flex items-center justify-center gap-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{background:heroLoading?"#999":t.btnPrimary,color:"#fff",opacity:heroLoading?.7:1,boxShadow:heroLoading?"none":"0 4px 16px rgba(196,125,142,.38)"}}>{heroLoading&&<span style={{width:16,height:16,border:"2px solid rgba(255,255,255,.38)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>}{heroAuth==="login"?(heroLoading?"Logging in...":"Sign In"):heroAuth==="forgot"?(heroLoading?"Sending...":"Send Reset Link"):(heroSignupStep===2?(heroLoading?"Creating...":"Create Account"):(heroLoading?"Please wait...":"Continue →"))}</button>
                {heroAuth==="signup"&&heroSignupStep===2&&<button onClick={()=>{setHeroSignupStep(1);setHeroError("")}} className="w-full py-2 px-0 bg-transparent text-sm font-medium mb-2" style={{color:t.textSoft}}>← Back to Step 1</button>}
                <div className="text-center text-sm" style={{color:t.textSoft}}>{heroAuth==="login"?"Don't have an account? ":heroAuth==="forgot"?"Remember your password? ":"Already have an account? "}<button onClick={()=>{setHeroAuth(heroAuth==="forgot"?"login":heroAuth==="login"?"signup":"login");setHeroSignupStep(1);setHeroError("")}} className="bg-transparent font-semibold text-sm" style={{color:t.accent}}>{heroAuth==="forgot"?"Log In":heroAuth==="login"?"Sign Up Free":"Log In"}</button></div>
                {heroError&&<div className="mt-3 py-2 px-3 rounded-lg text-[13px] text-center" style={{background:dark?"rgba(220,38,38,.18)":"#fef2f2",border:`1px solid ${dark?"rgba(220,38,38,.28)":"#fecaca"}`,color:dark?"#fca5a5":"#dc2626"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {heroError}</div>}
                {heroSuccess&&<div className="mt-3 py-2 px-3 rounded-lg text-[13px] text-center" style={{background:dark?"rgba(110,231,183,.14)":"#ecfdf5",border:`1px solid ${dark?"rgba(110,231,183,.24)":"rgba(5,150,105,.19)"}`,color:dark?"#6ee7b7":"#059669"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polyline points="20 6 9 17 4 12"/></svg> {heroSuccess}</div>}
              </div>
            </div>
          </div>

          {/* Platform carousel — seamless loop (3x duplication) */}
          <div className="fu fd5 shrink-0 py-3.5 max-md:py-2.5 overflow-hidden" style={{borderTop:`1px solid ${dark?"rgba(255,255,255,.12)":"rgba(255,255,255,.24)"}`}}>
            <div className="carousel-track">
              {[0,1].map(rep=><div key={rep} className="flex gap-3 pr-3">
                {[["Instagram",<svg key="ig" width="15" height="15" viewBox="0 0 24 24" fill={dark?"rgba(255,255,255,.6)":"rgba(255,255,255,.75)"}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>],["TikTok",<svg key="tt" width="13" height="15" viewBox="0 0 448 512" fill={dark?"rgba(255,255,255,.6)":"rgba(255,255,255,.75)"}><path d="M448 209.91a210.06 210.06 0 01-122.77-39.25v178.72A162.55 162.55 0 11185 188.31v89.89a74.62 74.62 0 1052.23 71.18V0h88a121 121 0 00122.77 121.33z"/></svg>],["YouTube",<svg key="yt" width="17" height="12" viewBox="0 0 576 512" fill={dark?"rgba(255,255,255,.6)":"rgba(255,255,255,.75)"}><path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z"/></svg>],["X",<svg key="x" width="13" height="13" viewBox="0 0 24 24" fill={dark?"rgba(255,255,255,.6)":"rgba(255,255,255,.75)"}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>],["Facebook",<svg key="fb" width="9" height="16" viewBox="0 0 320 512" fill={dark?"rgba(255,255,255,.6)":"rgba(255,255,255,.75)"}><path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z"/></svg>],["Telegram",<svg key="tg" width="15" height="13" viewBox="0 0 496 512" fill={dark?"rgba(255,255,255,.6)":"rgba(255,255,255,.75)"}><path d="M248 8C111.033 8 0 119.033 0 256s111.033 248 248 248 248-111.033 248-248S384.967 8 248 8zm114.952 168.66c-3.732 39.215-19.881 134.378-28.1 178.3-3.476 18.584-10.322 24.816-16.948 25.425-14.4 1.326-25.338-9.517-39.287-18.661-21.827-14.308-34.158-23.215-55.346-37.177-24.485-16.135-8.612-25 5.342-39.5 3.652-3.793 67.107-61.51 68.335-66.746.154-.655.3-3.1-1.154-4.384s-3.59-.849-5.135-.5q-3.283.746-104.608 69.142-14.845 10.194-26.894 9.934c-8.855-.191-25.888-5.006-38.551-9.123-15.531-5.048-27.875-7.717-26.8-16.291q.84-6.7 18.45-13.7 108.446-47.248 144.628-62.3c68.872-28.647 83.183-33.623 92.511-33.789 2.052-.034 6.639.474 9.61 2.885a10.452 10.452 0 013.53 6.716 43.765 43.765 0 01.417 9.769z"/></svg>],["Spotify",<svg key="sp" width="15" height="15" viewBox="0 0 496 512" fill={dark?"rgba(255,255,255,.6)":"rgba(255,255,255,.75)"}><path d="M248 8C111.1 8 0 119.1 0 256s111.1 248 248 248 248-111.1 248-248S384.9 8 248 8zm100.7 364.9c-4.2 0-6.8-1.3-10.7-3.6-62.4-37.6-135-39.2-206.7-24.5-3.9 1-9 2.6-11.9 2.6-9.7 0-15.8-7.7-15.8-15.8 0-10.3 6.1-15.2 13.6-16.8 81.9-18.1 165.6-16.5 237 26.2 6.1 3.9 9.7 7.4 9.7 16.5s-7.1 15.4-15.2 15.4zm26.9-65.6c-5.2 0-8.7-2.3-12.3-4.2-62.5-37-155.7-51.9-238.6-29.4-4.8 1.3-7.4 2.6-11.9 2.6-10.7 0-19.4-8.7-19.4-19.4s5.2-17.8 15.5-20.7c27.8-7.8 56.2-13.6 97.8-13.6 64.9 0 127.6 16.1 177 45.5 8.1 4.8 11.3 11 11.3 19.7-.1 10.8-8.5 19.5-19.4 19.5zm31-76.2c-5.2 0-8.4-1.3-12.9-3.9-71.2-42.5-198.5-52.7-280.9-29.7-3.6 1-8.1 2.6-12.9 2.6-13.2 0-23.3-10.3-23.3-23.6 0-13.6 8.4-21.3 17.4-23.9 35.2-10.3 74.6-15.2 117.5-15.2 73 0 149.5 15.2 205.4 47.8 7.8 4.5 12.9 10.7 12.9 22.6 0 13.6-10.3 23.3-23.2 23.3z"/></svg>],["Snapchat",<svg key="sc" width="15" height="15" viewBox="0 0 512 512" fill={dark?"rgba(255,255,255,.6)":"rgba(255,255,255,.75)"}><path d="M496.926 366.6c-3.373-9.176-9.8-14.086-17.112-18.153-1.376-.806-2.641-1.451-3.72-1.947-2.182-1.128-4.414-2.22-6.634-3.373-22.8-12.09-40.609-27.341-52.959-45.42a102.889 102.889 0 01-9.089-16.12c-1.054-3.013-1-4.724-.248-6.287a10.221 10.221 0 012.914-3.038c3.918-2.591 7.96-5.22 10.7-6.993 4.885-3.162 8.754-5.667 11.246-7.44 9.362-6.547 15.909-13.5 20-21.278a42.371 42.371 0 002.1-35.191c-6.2-16.318-21.613-26.449-40.287-26.449a55.543 55.543 0 00-11.718 1.24c-1.029.224-2.059.459-3.063.72.174-11.16-.074-22.94-1.066-34.534-3.522-40.758-17.794-62.123-32.674-79.16A159.992 159.992 0 00256.002 0a159.992 159.992 0 00-108.57 42.091c-14.88 17.038-29.152 38.261-32.673 79.161-.992 11.594-1.24 23.374-1.066 34.534a36.3 36.3 0 01-3.063-.72 55.531 55.531 0 00-11.717-1.24c-18.674 0-34.086 10.131-40.287 26.449a42.373 42.373 0 002.1 35.191c4.088 7.774 10.632 14.727 20 21.278 2.48 1.761 6.349 4.266 11.246 7.44 2.641 1.711 6.5 4.216 10.28 6.72a11.053 11.053 0 013.3 3.311c.794 1.624.818 3.373-.36 6.6a102.645 102.645 0 01-8.94 15.785c-12.077 17.669-29.363 32.648-51.434 44.639C32.355 348.608 20.206 352.75 15.069 366.7c-3.868 10.528-1.339 22.506 8.494 32.6a49.137 49.137 0 0012.4 9.387 134.337 134.337 0 0030.342 12.139 20.024 20.024 0 016.126 4.4c1.9 2.777 1.839 5.753 3.472 10.328 1.24 3.472 3.063 7.071 6.058 10.4 6.7 7.424 16.108 10.9 25.379 13.412 10.943 2.965 22.332 4.168 31.528 8.2 3.533 1.586 6.685 3.919 10.937 7.021 12.021 8.783 28.46 20.8 64.187 20.8 36.2 0 52.847-12.254 64.924-21.062 4.168-3.038 7.282-5.359 10.7-6.9 9.2-4.029 20.584-5.234 31.528-8.2 9.271-2.517 18.674-5.988 25.379-13.412a35.723 35.723 0 006.058-10.4c1.674-4.636 1.586-7.564 3.472-10.328a20.119 20.119 0 016.139-4.4 134.643 134.643 0 0030.342-12.139 49.2 49.2 0 0012.4-9.387c9.919-10.094 12.449-22.106 8.581-32.6z"/></svg>],["LinkedIn",<svg key="li" width="13" height="13" viewBox="0 0 448 512" fill={dark?"rgba(255,255,255,.6)":"rgba(255,255,255,.75)"}><path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 01107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.83-48.3 94 0 111.28 61.9 111.28 142.3V448z"/></svg>],["Pinterest",<svg key="pi" width="12" height="16" viewBox="0 0 384 512" fill={dark?"rgba(255,255,255,.6)":"rgba(255,255,255,.75)"}><path d="M204 6.5C101.4 6.5 0 74.9 0 185.6 0 256 39.6 296 63.6 296c9.9 0 15.6-27.6 15.6-35.4 0-9.3-23.7-29.1-23.7-67.8 0-80.4 61.2-137.4 140.4-137.4 68.1 0 118.5 38.7 118.5 109.8 0 53.1-21.3 152.7-90.3 152.7-24.9 0-46.2-18-46.2-43.8 0-37.8 26.4-74.4 26.4-113.4 0-66.2-93.9-54.2-93.9 25.8 0 16.8 2.1 35.4 9.6 50.7-13.8 59.4-42 147.9-42 209.1 0 18.9 2.7 37.5 4.5 56.4 3.4 3.8 1.7 3.4 6.9 1.5 50.4-69 48.6-82.5 71.4-172.8 12.3 23.4 44.1 36 69.3 36 106.2 0 153.9-103.5 153.9-196.8C384 71.3 298.2 6.5 204 6.5z"/></svg>],["Twitch",<svg key="tw" width="15" height="15" viewBox="0 0 512 512" fill={dark?"rgba(255,255,255,.6)":"rgba(255,255,255,.75)"}><path d="M391.17 103.47H352.54v109.7h38.63zM285 103H246.37v109.7H285zM120.83 0 24.31 91.42V420.58H140.14V512l96.53-91.42h77.25L487.69 256V0zM449.07 237.75l-77.22 73.12H294.61l-67.6 64v-64H140.14V36.58H449.07z"/></svg>],["Discord",<svg key="dc" width="17" height="13" viewBox="0 0 640 512" fill={dark?"rgba(255,255,255,.6)":"rgba(255,255,255,.75)"}><path d="M524.531 69.836a1.5 1.5 0 00-.764-.7A485.065 485.065 0 00404.081 32.03a1.816 1.816 0 00-1.923.91 337.461 337.461 0 00-14.9 30.6 447.848 447.848 0 00-134.426 0 309.541 309.541 0 00-15.135-30.6 1.89 1.89 0 00-1.924-.91 483.689 483.689 0 00-119.688 37.107 1.712 1.712 0 00-.788.676C39.068 183.651 18.186 294.69 28.43 404.354a2.016 2.016 0 00.765 1.375 487.666 487.666 0 00146.825 74.189 1.9 1.9 0 002.063-.676A348.2 348.2 0 00208.12 430.4a1.86 1.86 0 00-1.019-2.588 321.173 321.173 0 01-45.868-21.853 1.885 1.885 0 01-.185-3.126c3.082-2.309 6.166-4.711 9.109-7.137a1.819 1.819 0 011.9-.256c96.229 43.917 200.41 43.917 295.5 0a1.812 1.812 0 011.924.233 202.879 202.879 0 009.109 7.16 1.884 1.884 0 01-.162 3.126 301.407 301.407 0 01-45.89 21.83 1.875 1.875 0 00-1 2.611 391.055 391.055 0 0030.014 48.815 1.864 1.864 0 002.063.7A486.048 486.048 0 00610.7 405.729a1.882 1.882 0 00.765-1.352C623.729 277.594 590.933 167.465 524.531 69.836zM222.491 337.58c-28.972 0-52.844-26.587-52.844-59.239S193.056 219.1 222.491 219.1c29.665 0 53.306 26.82 52.843 59.239C275.334 310.993 251.924 337.58 222.491 337.58zm195.38 0c-28.971 0-52.843-26.587-52.843-59.239S388.437 219.1 417.871 219.1c29.667 0 53.307 26.82 52.844 59.239 0 32.654-23.177 59.239-52.844 59.239z"/></svg>]].map(([name,icon])=><span key={rep+name} className="inline-flex items-center gap-[9px] max-md:gap-[7px] py-2.5 px-5 max-md:py-2 max-md:px-3.5 rounded-xl text-base max-md:text-sm font-medium whitespace-nowrap shrink-0" style={{background:dark?"rgba(15,19,35,.5)":"rgba(255,255,255,.19)",border:`1px solid ${dark?"rgba(255,255,255,.14)":"rgba(255,255,255,.28)"}`,color:dark?"rgba(255,255,255,.5)":"rgba(255,255,255,.75)",backdropFilter:"blur(8px)"}}>{icon} {name}</span>)}
              </div>)}
            </div>
          </div>
        </section>


        <BelowFold t={t} dark={dark} setModal={setModal} siteStats={siteStats} socialLinks={socialLinks} />


      </div>

      {/* Side navigation indicator — desktop only */}
      <div className="side-nav">
        {sectionIds.map((id,i)=>(
          <button key={id} className={`side-nav-dot${activeSection===i?" side-nav-active":""}`} style={{background:activeSection===i?t.accent:t.textMuted}} onClick={()=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"})} title={id} aria-label={id}/>
        ))}
      </div>

      {modal&&<AuthModal key="auth-modal" dark={dark} t={t} mode={modal} setMode={setModal} onClose={closeModal} prefill={heroSignupData}/>}

      {/* Logout toast */}
      {logoutMsg&&<div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] py-3 px-5 rounded-[14px] max-w-[calc(100%-32px)] w-auto flex items-center gap-2.5" style={{background:dark?"rgba(17,22,40,.97)":"rgba(255,255,255,.97)",border:`1px solid ${dark?"rgba(110,231,183,.28)":"rgba(5,150,105,.24)"}`,backdropFilter:"blur(16px)",boxShadow:dark?"0 12px 40px rgba(0,0,0,.5)":"0 12px 40px rgba(0,0,0,.19)",animation:"fu .4s ease"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span className="text-sm font-medium" style={{color:t.text}}>You've been logged out successfully</span></div>}

      {googleError&&<div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] py-3 px-5 rounded-[14px] max-w-[calc(100%-32px)] w-auto flex items-center gap-2.5" style={{background:dark?"rgba(17,22,40,.97)":"rgba(255,255,255,.97)",border:`1px solid ${dark?"rgba(220,38,38,.28)":"rgba(220,38,38,.24)"}`,backdropFilter:"blur(16px)",boxShadow:dark?"0 12px 40px rgba(0,0,0,.5)":"0 12px 40px rgba(0,0,0,.19)",animation:"fu .4s ease"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark?"#fca5a5":"#dc2626"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span className="text-sm font-medium" style={{color:t.text}}>Google sign-in failed. Please try again or use email.</span></div>}

      {/* Session expired banner */}
      {sessionExpired&&<div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9998] py-4 px-5 rounded-[14px] max-w-[calc(100%-32px)] w-[400px]" style={{background:dark?"rgba(17,22,40,.97)":"rgba(255,255,255,.97)",border:`1px solid ${dark?"rgba(224,164,88,.28)":"rgba(217,119,6,.19)"}`,backdropFilter:"blur(16px)",boxShadow:dark?"0 12px 40px rgba(0,0,0,.5)":"0 12px 40px rgba(0,0,0,.19)",animation:"fu .4s ease"}}>
        <div className="flex gap-2.5 items-start">
          <div className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0 mt-px" style={{background:dark?"rgba(224,164,88,.12)":"rgba(217,119,6,.08)"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark?"#e0a458":"#d97706"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div className="flex-1">
            <div className="text-sm font-semibold mb-0.5" style={{color:dark?"#fbbf24":"#92400e"}}>Session expired</div>
            <div className="text-[13px] leading-[1.5] mb-2.5" style={{color:dark?"#a09b95":"#555250"}}>Your account was logged in on another device. If this wasn't you, secure your account.</div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={()=>{setSessionExpired(false);setModal("login");}} className="py-[7px] px-4 rounded-lg text-[13px] font-semibold border-none cursor-pointer transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{background:"linear-gradient(135deg,#c47d8e,#a3586b)",color:"#fff"}}>Log In</button>
              <button onClick={()=>{setSessionExpired(false);setModal("forgot");}} className="py-[7px] px-4 rounded-lg text-[13px] font-semibold cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{background:dark?"rgba(224,164,88,.18)":"rgba(217,119,6,.12)",border:`1px solid ${dark?"rgba(224,164,88,.31)":"rgba(217,119,6,.28)"}`,color:dark?"#e0a458":"#92400e"}}>Reset Password</button>
            </div>
          </div>
          <button onClick={()=>setSessionExpired(false)} className="bg-transparent border-none text-base cursor-pointer p-0 leading-none shrink-0" style={{color:dark?"#706c68":"#757170"}}>×</button>
        </div>
      </div>}

      
    </div>
  );
}

const Lbl=({t,children})=><label className="text-xs font-semibold block mb-[5px] uppercase tracking-[1.5px]" style={{color:t.textSoft}}>{children}</label>;

export default function Landing() {
  return <ThemeProvider><LandingInner /></ThemeProvider>;
}
