'use client';
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { ThemeProvider, useTheme } from "./shared-nav";
import { SITE } from "../lib/site";
import AnnouncementBanner from "./announcement-banner";

const AuthModal = dynamic(() => import("./auth-modal"), { ssr: false });

function PwStrength({ pw, dark }) {
  if (!pw) return <div style={{ minHeight: 20, marginBottom: 6 }} />;
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
    <div style={{ minHeight: 20, marginBottom: 6 }}>
      <div style={{ display: "flex", gap: 3, marginBottom: 3 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= fill ? color : empty, transition: "background .2s" }} />
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, color: color }}>{label}</div>
    </div>
  );
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
  const [activeTestimonial,setActiveTestimonial]=useState(0);
  const testimonialScrollRef=useRef(null);
  const scrollRef=useRef(null);
  const [siteStats,setSiteStats]=useState({users:"12K+",orders:"2M+"});
  const [promoBanner,setPromoBanner]=useState(null);
  const [siteAlerts,setSiteAlerts]=useState([]);
  const [socialLinks,setSocialLinks]=useState({});
  const [pricingData,setPricingData]=useState([]);

  useEffect(()=>{const el=scrollRef.current;if(!el)return;const onScroll=()=>setScrolled(el.scrollTop>20);el.addEventListener("scroll",onScroll);return()=>el.removeEventListener("scroll",onScroll);},[]);
  const [logoutMsg,setLogoutMsg]=useState(false);
  const [googleError,setGoogleError]=useState(false);
  const [sessionExpired,setSessionExpired]=useState(false);
  useEffect(()=>{const p=new URLSearchParams(window.location.search);if(p.get("login"))setModal("login");if(p.get("signup"))setModal("signup");if(p.get("ref"))setModal("signup");if(p.get("session_expired")){setSessionExpired(true);window.history.replaceState({},"","/");}if(p.get("logout")){setLogoutMsg(true);window.history.replaceState({},"","/");setTimeout(()=>setLogoutMsg(false),4000);}if(p.get("google_error")){setGoogleError(true);window.history.replaceState({},"","/");setTimeout(()=>setGoogleError(false),5000);setModal("login");}if(p.get("error")==="account_pending_deletion"){setHeroError("This account is scheduled for deletion. Contact support@nitro.ng to reinstate it.");window.history.replaceState({},"","/");}},[]);
  useEffect(()=>{(async()=>{try{const [maintRes,siRes,stRes,prRes]=await Promise.all([fetch("/api/maintenance-check"),fetch("/api/site-info"),fetch("/api/settings"),fetch("/api/pricing")]);if(maintRes.ok){const m=await maintRes.json();if(m.maintenance){window.location.replace("/maintenance");return;}}if(siRes.ok){const d=await siRes.json();if(d.stats)setSiteStats(d.stats);if(d.promo)setPromoBanner(d.promo);if(d.alerts?.length)setSiteAlerts(d.alerts);}if(stRes.ok){const d=await stRes.json();setSocialLinks(d.settings||{});}if(prRes.ok){const d=await prRes.json();if(d.platforms?.length)setPricingData(d.platforms);}}catch{}})();},[]);
  const closeModal=useCallback(()=>setModal(null),[]);

  // Scroll lock when modal is open
  useEffect(()=>{if(modal){document.body.style.overflow="hidden";}else{document.body.style.overflow="";}return()=>{document.body.style.overflow="";};},[modal]);

  // Hero card auth handlers
  const heroLoginSubmit=async()=>{
    setHeroError("");if(!heroEmail||!heroPw){setHeroError("Please fill in all fields");return;}
    setHeroLoading(true);
    try{const res=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:heroMethod==="email"?heroEmail:`+234${heroEmail}`,password:heroPw})});const data=await res.json();if(!res.ok){if(data.banned){window.location.href="/banned";return;}setHeroError(data.error||"Login failed");setHeroLoading(false);return;}if(!data.user.emailVerified){window.location.replace("/verify");return;}window.location.replace("/dashboard");}catch{setHeroError("Something went wrong.");setHeroLoading(false);}
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
      window.location.replace("/verify");
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
    <div className="root" suppressHydrationWarning style={{height:"100dvh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
      <style suppressHydrationWarning>{`
        .root{background:${t.bg};color:${t.text};transition:background 1.2s ease,color 1.2s ease}
      `}</style>

      {/* ═══ NAVBAR — outside snap container ═══ */}
      <nav className="main-nav" style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:56,background:dark?"#060810":scrolled?"rgba(139,74,94,.98)":"rgba(163,88,107,.96)",borderBottom:`0.5px solid ${dark?"rgba(255,255,255,.06)":"rgba(255,255,255,.15)"}`,flexShrink:0,zIndex:100,transition:"background 1.2s ease"}}>
          <button onClick={()=>scrollRef.current?.scrollTo({top:0,behavior:"smooth"})} className="nav-brand" style={{display:"flex",alignItems:"center",gap:10,background:"none",padding:0}}>
            <div className="nav-logo" style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#c47d8e,#8b5e6b)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(196,125,142,.3)"}}><svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <span className="nav-brand-text" style={{fontSize:16,fontWeight:600,color:"#fff",letterSpacing:1.5}}>NITRO</span>
          </button>
          <div className="nav-right" style={{display:"flex",alignItems:"center",gap:10}}>
            <div className="nav-links" style={{gap:4,alignItems:"center",marginRight:6}}>
              {["Services","Pricing","Testimonials"].map(l=><button key={l} onClick={()=>document.getElementById(l.toLowerCase())?.scrollIntoView({behavior:"smooth"})} className="nav-link-pill" style={{padding:"6px 16px",borderRadius:8,background:"none",fontSize:14,color:dark?"rgba(255,255,255,.5)":"rgba(255,255,255,.6)",fontWeight:500,border:"none",cursor:"pointer"}}>{l}</button>)}
            </div>
            <button onClick={toggleTheme} aria-label={dark?"Switch to light":"Switch to dark"} className="theme-toggle" style={{width:44,height:24,borderRadius:12,background:dark?"rgba(99,102,241,.2)":"rgba(255,255,255,.15)",position:"relative",transition:"background .8s ease",flexShrink:0,border:`0.5px solid ${dark?"rgba(99,102,241,.15)":"rgba(255,255,255,.2)"}`}}>
              <div style={{width:18,height:18,borderRadius:"50%",background:dark?"#1e1b4b":"#fff",position:"absolute",top:2.5,left:dark?22.5:2.5,transition:"left .8s cubic-bezier(.4,0,.2,1), background .8s ease",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {dark?<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                :<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
              </div>
            </button>
            <button onClick={()=>setModal("login")} className="nav-login-btn" style={{padding:"7px 20px",borderRadius:8,background:dark?"rgba(255,255,255,.06)":"rgba(255,255,255,.12)",border:`0.5px solid ${dark?"rgba(255,255,255,.1)":"rgba(255,255,255,.2)"}`,color:dark?"rgba(255,255,255,.8)":"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>Log in</button>
            <button onClick={()=>setModal("signup")} className="nav-signup-btn" style={{padding:"7px 20px",borderRadius:8,background:"#fff",border:"none",color:"#1a1a1a",fontSize:14,fontWeight:600,cursor:"pointer"}}>Get started</button>
          </div>
      </nav>

      <div ref={scrollRef} className="snap-container" style={{flex:1,overflowY:"auto",overflowX:"hidden",position:"relative"}}>

        {/* Site-wide announcement banner */}
        <AnnouncementBanner alerts={siteAlerts} dark={dark} mode="landing" />

        {/* ━━━ HERO ━━━ */}
        <section id="hero" className="snap-section" style={{overflow:"hidden",background:t.heroBg,position:"relative",display:"flex",flexDirection:"column"}}>

          {/* Ambient orbs + particles */}
          <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
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

          <div className="hero-split">
            {/* LEFT */}
            <div className="hero-left">
              <div className="fu hero-eyebrow" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,marginBottom:20,background:dark?"rgba(52,211,153,.06)":"rgba(255,255,255,.1)",border:`1px solid ${dark?"rgba(52,211,153,.12)":"rgba(255,255,255,.15)"}`}}>
                <div className="hero-live-dot" style={{width:6,height:6,borderRadius:"50%",background:"#34d399",boxShadow:"0 0 8px rgba(52,211,153,.5)"}} />
                <span style={{fontSize:11,fontWeight:500,letterSpacing:1,textTransform:"uppercase",color:dark?"#34d399":"#fff"}}>{siteStats.orders||"0"} orders delivered today</span>
              </div>
              <h1 className="fu fd1 hero-h1" style={{color:t.heroText}}>Your audience,<br/><span className="serif hero-refined" style={{color:dark?t.accent:"#fff",textShadow:dark?"none":"0 2px 20px rgba(0,0,0,.15)"}}>amplified.</span></h1>
              <div className="fu fd2 hero-value-line" style={{fontSize:14,fontWeight:500,color:dark?"rgba(244,241,237,.5)":"rgba(255,255,255,.75)",marginBottom:16,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span className="m" style={{padding:"4px 12px",borderRadius:8,fontWeight:600,fontSize:13,background:dark?"rgba(52,211,153,.08)":"rgba(255,255,255,.15)",color:dark?"#34d399":"#fff",border:`1px solid ${dark?"rgba(52,211,153,.12)":"rgba(255,255,255,.2)"}`}}>1,000 followers</span>
                <span>from ₦850</span>
              </div>
              <p className="fu fd2 hero-sub" style={{color:t.heroSoft}}>Real engagement from real accounts. Instant delivery across Instagram, TikTok, YouTube and 25+ platforms.</p>

              {/* Stats — card style */}
              <div className="fu fd3 hero-stats">
                {[[siteStats.orders||"0","Orders\ndelivered",false],[siteStats.users||"0","Active\ncreators",false],["98%","Delivery\nrate",true]].map(([num,label,accent],i)=>
                  <div key={i} className="hero-stat-card" style={{background:accent?(dark?"rgba(196,125,142,.06)":"rgba(255,255,255,.15)"):(dark?"rgba(255,255,255,.04)":"rgba(255,255,255,.1)"),border:`1px solid ${accent?(dark?"rgba(196,125,142,.1)":"rgba(255,255,255,.2)"):(dark?"rgba(255,255,255,.06)":"rgba(255,255,255,.12)")}`}}>
                    <div className="hero-stat-num" style={{color:accent?(dark?t.accent:"#fff"):t.heroText}}>{num}</div>
                    <div className="hero-stat-label" style={{color:dark?"rgba(255,255,255,.4)":"rgba(255,255,255,.6)",whiteSpace:"pre-line"}}>{label}</div>
                  </div>
                )}
              </div>

              {/* CTAs — desktop */}
              <div className="fu fd4 hero-ctas" style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                <button onClick={()=>setModal("signup")} className="hero-cta-btn" style={{padding:"14px 36px",borderRadius:12,background:"#fff",color:"#1a1a1a",fontSize:15,fontWeight:600,border:"none",boxShadow:"0 8px 32px rgba(0,0,0,.15)",cursor:"pointer"}}>Start growing now <span style={{fontSize:18}}>→</span></button>
                <button onClick={()=>document.getElementById("pricing")?.scrollIntoView({behavior:"smooth"})} className="hero-secondary-btn" style={{padding:"14px 28px",borderRadius:12,fontSize:15,fontWeight:500,background:"none",border:`0.5px solid ${dark?"rgba(255,255,255,.12)":"rgba(255,255,255,.3)"}`,color:dark?"rgba(244,241,237,.7)":"#fff",cursor:"pointer"}}>View pricing</button>
              </div>

              {/* Mobile CTA — full width */}
              <div className="hero-mobile-cta fu fd4" style={{display:"none",width:"100%",maxWidth:300}}>
                <button onClick={()=>setModal("signup")} className="hero-cta-btn" style={{width:"100%",padding:"15px 0",borderRadius:14,background:"#fff",color:"#1a1a1a",fontSize:16,fontWeight:600,border:"none",boxShadow:"0 8px 32px rgba(0,0,0,.15)"}}>Start growing now →</button>
              </div>

              {/* Guarantee */}
              <div className="fu fd4 hero-guarantee" style={{display:"flex",alignItems:"center",gap:5,marginTop:14,fontSize:12,color:dark?"rgba(244,241,237,.3)":"rgba(255,255,255,.5)"}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Instant refund if we can't deliver
              </div>
            </div>

            {/* RIGHT — Auth card (desktop) */}
            <div className="hero-right">
              <div style={{background:dark?"rgba(17,22,40,0.95)":"rgba(255,255,255,0.95)",border:`1px solid ${dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.06)"}`,borderRadius:20,padding:"28px 26px",backdropFilter:"blur(20px)",boxShadow:dark?"0 24px 64px rgba(0,0,0,0.5)":"0 24px 64px rgba(0,0,0,0.1)"}}>
                <h2 style={{fontSize:22,fontWeight:600,color:t.text,textAlign:"center",marginBottom:3}}>{heroAuth==="login"?"Let's run it up 🚀":heroAuth==="forgot"?"Forgot password?":(heroSignupStep===1?"Create Account":"Secure Your Account")}</h2>
                <p style={{fontSize:15,color:t.textSoft,textAlign:"center",marginBottom:16,fontWeight:450}}>{heroAuth==="login"?"Sign in and start boosting":heroAuth==="forgot"?"Enter your email for a reset link":(heroSignupStep===1?"Join "+siteStats.users+" Nigerian creators":"Step 2 of 2 — Set your password")}</p>
                {heroAuth!=="forgot"&&heroSignupStep===1&&<><button onClick={()=>{window.location.href="/api/auth/google"}} style={{width:"100%",padding:"11px 0",borderRadius:12,background:dark?"rgba(255,255,255,.06)":"#fff",border:`1px solid ${dark?"rgba(255,255,255,.1)":"rgba(0,0,0,.12)"}`,display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontSize:14,fontWeight:600,color:dark?"#eae7e2":"#333",marginBottom:0}}><svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>{heroAuth==="login"?"Continue with Google":"Sign up with Google"}</button><div style={{display:"flex",alignItems:"center",gap:12,margin:"12px 0"}}><div style={{flex:1,height:1,background:dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)"}}/><span style={{fontSize:12,fontWeight:500,color:t.textMuted}}>or</span><div style={{flex:1,height:1,background:dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)"}}/></div></>}
                {heroAuth==="signup"&&heroSignupStep===1&&<><div style={{display:"flex",gap:8,marginBottom:12}}><div style={{flex:1}}><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>First Name</label><input placeholder="First" value={heroFirstName} onChange={e=>setHeroFirstName(e.target.value.replace(/[^a-zA-Z\u00C0-\u017F\s'\-\.]/g,"").slice(0,50))} style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:15,outline:"none",fontFamily:"inherit"}}/></div><div style={{flex:1}}><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Last Name</label><input placeholder="Last" value={heroLastName} onChange={e=>setHeroLastName(e.target.value.replace(/[^a-zA-Z\u00C0-\u017F\s'\-\.]/g,"").slice(0,50))} style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:15,outline:"none",fontFamily:"inherit"}}/></div></div><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Email Address</label><input placeholder="you@example.com" value={heroEmail} onChange={e=>setHeroEmail(e.target.value.trim().toLowerCase().slice(0,254))} type="email" style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:15,outline:"none",marginBottom:12,fontFamily:"inherit"}}/></>}
                {heroAuth==="signup"&&heroSignupStep===2&&<><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:1.5}}>Password</label><div style={{position:"relative",marginBottom:2}}><input placeholder="Min. 6 characters" value={heroPw} onChange={e=>setHeroPw(e.target.value.slice(0,128))} type={heroShowPw?"text":"password"} style={{width:"100%",padding:"9px 40px 9px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",fontFamily:"inherit"}}/><button onClick={()=>setHeroShowPw(!heroShowPw)} type="button" style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",color:t.textMuted,padding:2}}>{heroShowPw?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}</button></div><PwStrength pw={heroPw} dark={dark} /><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:1.5}}>Confirm Password</label><input placeholder="Re-enter password" value={heroPw2} onChange={e=>setHeroPw2(e.target.value.slice(0,128))} type="password" style={{width:"100%",padding:"9px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${heroPw2&&heroPw!==heroPw2?(dark?"rgba(220,38,38,.4)":"#fecaca"):heroPw2&&heroPw===heroPw2?(dark?"rgba(110,231,183,.4)":"#a7f3d0"):t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:2,fontFamily:"inherit"}}/><div style={{minHeight:14,marginBottom:4}}>{heroPw2&&heroPw===heroPw2?<span style={{fontSize:11,color:dark?"#6ee7b7":"#059669"}}>✓ Passwords match</span>:heroPw2&&heroPw!==heroPw2?<span style={{fontSize:11,color:dark?"#fca5a5":"#dc2626"}}>✕ Passwords don't match</span>:null}</div><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:1.5}}>Referral Code <span style={{fontWeight:400,color:t.textMuted}}>(optional)</span></label><input placeholder="e.g. NTR-7X92" value={heroRefCode} onChange={e=>setHeroRefCode(e.target.value.replace(/[^a-zA-Z0-9\-]/g,"").toUpperCase().slice(0,20))} style={{width:"100%",padding:"9px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:8,fontFamily:"inherit"}}/><label style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:10,cursor:"pointer"}}><input type="checkbox" checked={heroAgree} onChange={e=>setHeroAgree(e.target.checked)} style={{marginTop:2,accentColor:t.accent,width:14,height:14,flexShrink:0}}/><span style={{fontSize:12,color:t.textSoft,lineHeight:1.4}}>I agree to the <a href="/terms" style={{color:t.accent,textDecoration:"none"}}>Terms</a> and <a href="/privacy" style={{color:t.accent,textDecoration:"none"}}>Privacy Policy</a></span></label></>}
                {heroAuth==="login"&&<><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Email Address</label><input placeholder="you@example.com" value={heroEmail} onChange={e=>setHeroEmail(e.target.value.trim().toLowerCase().slice(0,254))} type="email" style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:15,outline:"none",marginBottom:12,fontFamily:"inherit"}}/><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Password</label><input placeholder="Enter password" type="password" value={heroPw} onChange={e=>setHeroPw(e.target.value.slice(0,128))} onKeyDown={e=>{if(e.key==="Enter")heroLoginSubmit()}} style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:15,outline:"none",marginBottom:14,fontFamily:"inherit"}}/><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}><input type="checkbox" style={{accentColor:t.accent,width:14,height:14}}/><span style={{fontSize:13,color:t.textSoft}}>Remember me</span></label><button onClick={()=>{setHeroAuth("forgot");setHeroError("")}} style={{background:"none",color:t.accent,fontSize:13,fontWeight:500}}>Forgot password?</button></div></>}
                {heroAuth==="forgot"&&<><label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Email Address</label><input placeholder="you@example.com" value={heroEmail} onChange={e=>setHeroEmail(e.target.value.trim().toLowerCase().slice(0,254))} type="email" style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:15,outline:"none",marginBottom:16,fontFamily:"inherit"}}/></>}
                <button onClick={heroAuth==="login"?heroLoginSubmit:heroAuth==="forgot"?heroForgotSubmit:(heroSignupStep===2?heroSignupFinalSubmit:heroSignupSubmit)} disabled={heroLoading} style={{width:"100%",padding:"14px 0",borderRadius:12,background:heroLoading?"#999":t.btnPrimary,color:"#fff",fontSize:16,fontWeight:600,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:heroLoading?.7:1,boxShadow:heroLoading?"none":"0 4px 16px rgba(196,125,142,.3)"}}>{heroLoading&&<span style={{width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>}{heroAuth==="login"?(heroLoading?"Logging in...":"Sign In"):heroAuth==="forgot"?(heroLoading?"Sending...":"Send Reset Link"):(heroSignupStep===2?(heroLoading?"Creating...":"Create Account"):(heroLoading?"Please wait...":"Continue →"))}</button>
                {heroAuth==="signup"&&heroSignupStep===2&&<button onClick={()=>{setHeroSignupStep(1);setHeroError("")}} style={{width:"100%",padding:"8px 0",background:"none",color:t.textSoft,fontSize:14,fontWeight:500,marginBottom:8}}>← Back to Step 1</button>}
                <div style={{textAlign:"center",fontSize:14,color:t.textSoft}}>{heroAuth==="login"?"Don't have an account? ":heroAuth==="forgot"?"Remember your password? ":"Already have an account? "}<button onClick={()=>{setHeroAuth(heroAuth==="forgot"?"login":heroAuth==="login"?"signup":"login");setHeroSignupStep(1);setHeroError("")}} style={{background:"none",color:t.accent,fontWeight:600,fontSize:14}}>{heroAuth==="forgot"?"Log In":heroAuth==="login"?"Sign Up Free":"Log In"}</button></div>
                {heroError&&<div style={{marginTop:12,padding:"8px 12px",borderRadius:8,background:dark?"rgba(220,38,38,0.1)":"#fef2f2",border:`1px solid ${dark?"rgba(220,38,38,0.2)":"#fecaca"}`,color:dark?"#fca5a5":"#dc2626",fontSize:13,textAlign:"center"}}>⚠️ {heroError}</div>}
                {heroSuccess&&<div style={{marginTop:12,padding:"8px 12px",borderRadius:8,background:dark?"rgba(110,231,183,0.08)":"#ecfdf5",border:`1px solid ${dark?"rgba(110,231,183,0.15)":"rgba(5,150,105,0.12)"}`,color:dark?"#6ee7b7":"#059669",fontSize:13,textAlign:"center"}}>✓ {heroSuccess}</div>}
              </div>
            </div>
          </div>

          {/* Platform carousel — seamless loop (3x duplication) */}
          <div className="fu fd5 carousel-wrapper" style={{borderTop:`1px solid ${dark?"rgba(255,255,255,.06)":"rgba(255,255,255,.15)"}`}}>
            <div className="carousel-track">
              {[0,1,2].map(rep=><div key={rep} style={{display:"flex",gap:12,paddingRight:12}}>
                {[["Instagram",<svg key="ig" width="15" height="15" viewBox="0 0 24 24" fill={dark?"rgba(255,255,255,.45)":"rgba(255,255,255,.6)"}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>],["TikTok",<svg key="tt" width="13" height="15" viewBox="0 0 448 512" fill={dark?"rgba(255,255,255,.45)":"rgba(255,255,255,.6)"}><path d="M448 209.91a210.06 210.06 0 01-122.77-39.25v178.72A162.55 162.55 0 11185 188.31v89.89a74.62 74.62 0 1052.23 71.18V0h88a121 121 0 00122.77 121.33z"/></svg>],["YouTube",<svg key="yt" width="17" height="12" viewBox="0 0 576 512" fill={dark?"rgba(255,255,255,.45)":"rgba(255,255,255,.6)"}><path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z"/></svg>],["X",<svg key="x" width="13" height="13" viewBox="0 0 24 24" fill={dark?"rgba(255,255,255,.45)":"rgba(255,255,255,.6)"}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>],["Facebook",<svg key="fb" width="9" height="16" viewBox="0 0 320 512" fill={dark?"rgba(255,255,255,.45)":"rgba(255,255,255,.6)"}><path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z"/></svg>],["Telegram",<svg key="tg" width="15" height="13" viewBox="0 0 496 512" fill={dark?"rgba(255,255,255,.45)":"rgba(255,255,255,.6)"}><path d="M248 8C111.033 8 0 119.033 0 256s111.033 248 248 248 248-111.033 248-248S384.967 8 248 8zm114.952 168.66c-3.732 39.215-19.881 134.378-28.1 178.3-3.476 18.584-10.322 24.816-16.948 25.425-14.4 1.326-25.338-9.517-39.287-18.661-21.827-14.308-34.158-23.215-55.346-37.177-24.485-16.135-8.612-25 5.342-39.5 3.652-3.793 67.107-61.51 68.335-66.746.154-.655.3-3.1-1.154-4.384s-3.59-.849-5.135-.5q-3.283.746-104.608 69.142-14.845 10.194-26.894 9.934c-8.855-.191-25.888-5.006-38.551-9.123-15.531-5.048-27.875-7.717-26.8-16.291q.84-6.7 18.45-13.7 108.446-47.248 144.628-62.3c68.872-28.647 83.183-33.623 92.511-33.789 2.052-.034 6.639.474 9.61 2.885a10.452 10.452 0 013.53 6.716 43.765 43.765 0 01.417 9.769z"/></svg>],["Spotify",<svg key="sp" width="15" height="15" viewBox="0 0 496 512" fill={dark?"rgba(255,255,255,.45)":"rgba(255,255,255,.6)"}><path d="M248 8C111.1 8 0 119.1 0 256s111.1 248 248 248 248-111.1 248-248S384.9 8 248 8zm100.7 364.9c-4.2 0-6.8-1.3-10.7-3.6-62.4-37.6-135-39.2-206.7-24.5-3.9 1-9 2.6-11.9 2.6-9.7 0-15.8-7.7-15.8-15.8 0-10.3 6.1-15.2 13.6-16.8 81.9-18.1 165.6-16.5 237 26.2 6.1 3.9 9.7 7.4 9.7 16.5s-7.1 15.4-15.2 15.4zm26.9-65.6c-5.2 0-8.7-2.3-12.3-4.2-62.5-37-155.7-51.9-238.6-29.4-4.8 1.3-7.4 2.6-11.9 2.6-10.7 0-19.4-8.7-19.4-19.4s5.2-17.8 15.5-20.7c27.8-7.8 56.2-13.6 97.8-13.6 64.9 0 127.6 16.1 177 45.5 8.1 4.8 11.3 11 11.3 19.7-.1 10.8-8.5 19.5-19.4 19.5zm31-76.2c-5.2 0-8.4-1.3-12.9-3.9-71.2-42.5-198.5-52.7-280.9-29.7-3.6 1-8.1 2.6-12.9 2.6-13.2 0-23.3-10.3-23.3-23.6 0-13.6 8.4-21.3 17.4-23.9 35.2-10.3 74.6-15.2 117.5-15.2 73 0 149.5 15.2 205.4 47.8 7.8 4.5 12.9 10.7 12.9 22.6 0 13.6-10.3 23.3-23.2 23.3z"/></svg>],["Snapchat",<svg key="sc" width="15" height="15" viewBox="0 0 512 512" fill={dark?"rgba(255,255,255,.45)":"rgba(255,255,255,.6)"}><path d="M496.926 366.6c-3.373-9.176-9.8-14.086-17.112-18.153-1.376-.806-2.641-1.451-3.72-1.947-2.182-1.128-4.414-2.22-6.634-3.373-22.8-12.09-40.609-27.341-52.959-45.42a102.889 102.889 0 01-9.089-16.12c-1.054-3.013-1-4.724-.248-6.287a10.221 10.221 0 012.914-3.038c3.918-2.591 7.96-5.22 10.7-6.993 4.885-3.162 8.754-5.667 11.246-7.44 9.362-6.547 15.909-13.5 20-21.278a42.371 42.371 0 002.1-35.191c-6.2-16.318-21.613-26.449-40.287-26.449a55.543 55.543 0 00-11.718 1.24c-1.029.224-2.059.459-3.063.72.174-11.16-.074-22.94-1.066-34.534-3.522-40.758-17.794-62.123-32.674-79.16A159.992 159.992 0 00256.002 0a159.992 159.992 0 00-108.57 42.091c-14.88 17.038-29.152 38.261-32.673 79.161-.992 11.594-1.24 23.374-1.066 34.534a36.3 36.3 0 01-3.063-.72 55.531 55.531 0 00-11.717-1.24c-18.674 0-34.086 10.131-40.287 26.449a42.373 42.373 0 002.1 35.191c4.088 7.774 10.632 14.727 20 21.278 2.48 1.761 6.349 4.266 11.246 7.44 2.641 1.711 6.5 4.216 10.28 6.72a11.053 11.053 0 013.3 3.311c.794 1.624.818 3.373-.36 6.6a102.645 102.645 0 01-8.94 15.785c-12.077 17.669-29.363 32.648-51.434 44.639C32.355 348.608 20.206 352.75 15.069 366.7c-3.868 10.528-1.339 22.506 8.494 32.6a49.137 49.137 0 0012.4 9.387 134.337 134.337 0 0030.342 12.139 20.024 20.024 0 016.126 4.4c1.9 2.777 1.839 5.753 3.472 10.328 1.24 3.472 3.063 7.071 6.058 10.4 6.7 7.424 16.108 10.9 25.379 13.412 10.943 2.965 22.332 4.168 31.528 8.2 3.533 1.586 6.685 3.919 10.937 7.021 12.021 8.783 28.46 20.8 64.187 20.8 36.2 0 52.847-12.254 64.924-21.062 4.168-3.038 7.282-5.359 10.7-6.9 9.2-4.029 20.584-5.234 31.528-8.2 9.271-2.517 18.674-5.988 25.379-13.412a35.723 35.723 0 006.058-10.4c1.674-4.636 1.586-7.564 3.472-10.328a20.119 20.119 0 016.139-4.4 134.643 134.643 0 0030.342-12.139 49.2 49.2 0 0012.4-9.387c9.919-10.094 12.449-22.106 8.581-32.6z"/></svg>],["LinkedIn",<svg key="li" width="13" height="13" viewBox="0 0 448 512" fill={dark?"rgba(255,255,255,.45)":"rgba(255,255,255,.6)"}><path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 01107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.83-48.3 94 0 111.28 61.9 111.28 142.3V448z"/></svg>],["Pinterest",<svg key="pi" width="12" height="16" viewBox="0 0 384 512" fill={dark?"rgba(255,255,255,.45)":"rgba(255,255,255,.6)"}><path d="M204 6.5C101.4 6.5 0 74.9 0 185.6 0 256 39.6 296 63.6 296c9.9 0 15.6-27.6 15.6-35.4 0-9.3-23.7-29.1-23.7-67.8 0-80.4 61.2-137.4 140.4-137.4 68.1 0 118.5 38.7 118.5 109.8 0 53.1-21.3 152.7-90.3 152.7-24.9 0-46.2-18-46.2-43.8 0-37.8 26.4-74.4 26.4-113.4 0-66.2-93.9-54.2-93.9 25.8 0 16.8 2.1 35.4 9.6 50.7-13.8 59.4-42 147.9-42 209.1 0 18.9 2.7 37.5 4.5 56.4 3.4 3.8 1.7 3.4 6.9 1.5 50.4-69 48.6-82.5 71.4-172.8 12.3 23.4 44.1 36 69.3 36 106.2 0 153.9-103.5 153.9-196.8C384 71.3 298.2 6.5 204 6.5z"/></svg>],["Twitch",<svg key="tw" width="15" height="15" viewBox="0 0 512 512" fill={dark?"rgba(255,255,255,.45)":"rgba(255,255,255,.6)"}><path d="M391.17 103.47H352.54v109.7h38.63zM285 103H246.37v109.7H285zM120.83 0 24.31 91.42V420.58H140.14V512l96.53-91.42h77.25L487.69 256V0zM449.07 237.75l-77.22 73.12H294.61l-67.6 64v-64H140.14V36.58H449.07z"/></svg>],["Discord",<svg key="dc" width="17" height="13" viewBox="0 0 640 512" fill={dark?"rgba(255,255,255,.45)":"rgba(255,255,255,.6)"}><path d="M524.531 69.836a1.5 1.5 0 00-.764-.7A485.065 485.065 0 00404.081 32.03a1.816 1.816 0 00-1.923.91 337.461 337.461 0 00-14.9 30.6 447.848 447.848 0 00-134.426 0 309.541 309.541 0 00-15.135-30.6 1.89 1.89 0 00-1.924-.91 483.689 483.689 0 00-119.688 37.107 1.712 1.712 0 00-.788.676C39.068 183.651 18.186 294.69 28.43 404.354a2.016 2.016 0 00.765 1.375 487.666 487.666 0 00146.825 74.189 1.9 1.9 0 002.063-.676A348.2 348.2 0 00208.12 430.4a1.86 1.86 0 00-1.019-2.588 321.173 321.173 0 01-45.868-21.853 1.885 1.885 0 01-.185-3.126c3.082-2.309 6.166-4.711 9.109-7.137a1.819 1.819 0 011.9-.256c96.229 43.917 200.41 43.917 295.5 0a1.812 1.812 0 011.924.233 202.879 202.879 0 009.109 7.16 1.884 1.884 0 01-.162 3.126 301.407 301.407 0 01-45.89 21.83 1.875 1.875 0 00-1 2.611 391.055 391.055 0 0030.014 48.815 1.864 1.864 0 002.063.7A486.048 486.048 0 00610.7 405.729a1.882 1.882 0 00.765-1.352C623.729 277.594 590.933 167.465 524.531 69.836zM222.491 337.58c-28.972 0-52.844-26.587-52.844-59.239S193.056 219.1 222.491 219.1c29.665 0 53.306 26.82 52.843 59.239C275.334 310.993 251.924 337.58 222.491 337.58zm195.38 0c-28.971 0-52.843-26.587-52.843-59.239S388.437 219.1 417.871 219.1c29.667 0 53.307 26.82 52.844 59.239 0 32.654-23.177 59.239-52.844 59.239z"/></svg>]].map(([name,icon])=><span key={rep+name} className="carousel-item" style={{background:dark?"rgba(15,19,35,.5)":"rgba(255,255,255,.12)",border:`1px solid ${dark?"rgba(255,255,255,.08)":"rgba(255,255,255,.2)"}`,color:dark?"rgba(255,255,255,.5)":"rgba(255,255,255,.75)",backdropFilter:"blur(8px)"}}>{icon} {name}</span>)}
              </div>)}
            </div>
          </div>
        </section>


        {/* ━━━ SECTION 2: WHY NITRO + HOW IT WORKS ━━━ */}
        <section id="services" className="s2 snap-section" style={{background:t.bgAlt,position:"relative",overflow:"hidden"}}>

          {/* WHY NITRO — split layout */}
          <div className="s2-why" style={{display:"grid",gridTemplateColumns:"1fr 1.2fr",gap:60,padding:"80px 48px",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,fontWeight:500,letterSpacing:2,textTransform:"uppercase",marginBottom:16,color:t.accent}}>Why Nitro</div>
              <h2 className="s2-big-heading" style={{fontSize:48,fontWeight:700,lineHeight:1.05,letterSpacing:-1.5,marginBottom:16,color:t.text}}>Not just another<br/>SMM panel.<br/><span className="serif" style={{fontStyle:"italic",fontWeight:400,fontSize:54,color:t.accent,display:"block"}}>The last one you'll need.</span></h2>
              <p style={{fontSize:16,lineHeight:1.7,maxWidth:400,marginBottom:28,color:t.textSoft}}>We built Nitro for Nigerian creators who are tired of slow delivery, fake engagement, and platforms that disappear overnight.</p>
              <div style={{display:"flex",gap:32}}>
                {[["25+","Platforms"],["98%","Delivery rate"],["<60s","Avg. start time"]].map(([num,label])=>(
                  <div key={label}><div style={{fontSize:28,fontWeight:600,lineHeight:1,marginBottom:4,color:t.text}}>{num}</div><div style={{fontSize:13,color:t.textMuted}}>{label}</div></div>
                ))}
              </div>
            </div>
            <div className="s2-feat-list" style={{display:"flex",flexDirection:"column",gap:8}}>
              {[[<svg key="f1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c47d8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,"Instant Delivery","Orders start processing within seconds, not hours.","rgba(196,125,142,.08)"],[<svg key="f2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e0a458" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,"Lowest Rates in Nigeria","Direct provider pricing with no middleman markup.","rgba(224,164,88,.08)"],[<svg key="f3" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,"Real Engagement","Genuine accounts that stick. No bots, no drops.","rgba(110,231,183,.06)"],[<svg key="f4" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>,"24/7 Human Support","Real people on WhatsApp and live chat, any time.","rgba(165,180,252,.06)"],[<svg key="f5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,"Free Auto-Refill","Followers drop? We top them up automatically, free.","rgba(251,191,36,.06)"]].map(([icon,title,desc,bg])=>(
                <div key={title} className="s2-feat-row" style={{display:"flex",alignItems:"flex-start",gap:16,padding:"18px 20px",borderRadius:14,background:dark?"rgba(255,255,255,.02)":"rgba(255,255,255,.6)",border:`1px solid ${dark?"rgba(255,255,255,.05)":"rgba(0,0,0,.05)"}`,transition:"border-color .2s"}}>
                  <div style={{width:40,height:40,borderRadius:10,background:bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{icon}</div>
                  <div style={{flex:1}}><div style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:2}}>{title}</div><div className="s2-feat-desc" style={{fontSize:14,lineHeight:1.5,color:dark?"rgba(244,241,237,.35)":"rgba(28,27,25,.4)"}}>{desc}</div></div>
                </div>
              ))}
            </div>
          </div>

          {/* HOW IT WORKS — horizontal timeline */}
          <div className="s2-how" style={{padding:"60px 48px 80px",margin:"0 -48px",background:dark?"rgba(0,0,0,.15)":"rgba(0,0,0,.03)",borderTop:`1px solid ${dark?"rgba(255,255,255,.04)":"rgba(0,0,0,.04)"}`,borderBottom:`1px solid ${dark?"rgba(255,255,255,.04)":"rgba(0,0,0,.04)"}`}}>
            <div style={{display:"flex",alignItems:"baseline",gap:16,marginBottom:40}}>
              <h3 style={{fontSize:28,fontWeight:600,letterSpacing:-.5,color:t.text}}>How it <span className="serif" style={{fontStyle:"italic",fontWeight:500,fontSize:32,color:t.accent}}>works</span></h3>
              <div style={{flex:1,height:.5,background:dark?"rgba(255,255,255,.06)":"rgba(0,0,0,.06)"}}/>
            </div>
            <div className="s2-timeline" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:0}}>
              {[["01","Create Account","Sign up free in 30 seconds. No card required."],["02","Add Funds","Pay via card, bank transfer, or crypto. Instant."],["03","Place Order","Pick a service, paste your link, confirm. Done."],["04","Watch It Grow","Delivery starts in seconds. Track it live."]].map(([num,title,desc],i)=>(
                <div key={num} className="s2-step-item" style={{position:"relative",paddingRight:i<3?24:0,"--s2-step-bg":dark?"rgba(255,255,255,.02)":"rgba(255,255,255,.5)","--s2-step-border":`1px solid ${dark?"rgba(255,255,255,.05)":"rgba(0,0,0,.05)"}`}}>
                  {i<3&&<div className="s2-step-connector" style={{position:"absolute",top:20,left:52,right:0,height:1,background:dark?"rgba(255,255,255,.06)":"rgba(0,0,0,.06)"}}/>}
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,position:"relative",zIndex:1}}>
                    <div style={{width:40,height:40,borderRadius:12,background:dark?"rgba(196,125,142,.08)":"rgba(196,125,142,.06)",border:`1px solid ${dark?"rgba(196,125,142,.15)":"rgba(196,125,142,.12)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,color:t.accent,flexShrink:0}}>{num}</div>
                    <span style={{fontSize:15,fontWeight:600,color:t.text}}>{title}</span>
                  </div>
                  <div className="s2-step-desc" style={{fontSize:14,lineHeight:1.55,paddingLeft:52,color:dark?"rgba(244,241,237,.35)":"rgba(28,27,25,.4)"}}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="section-divider" style={{background:t.bgAlt}}><div className="section-divider-line" style={{background:`linear-gradient(90deg,transparent,${dark?"rgba(196,125,142,.2)":"rgba(196,125,142,.15)"},transparent)`}}/><div className="section-divider-dot" style={{background:t.accent}}/><div className="section-divider-line" style={{background:`linear-gradient(90deg,transparent,${dark?"rgba(196,125,142,.2)":"rgba(196,125,142,.15)"},transparent)`}}/></div>

        {/* ━━━ SECTION 3: PRICING ━━━ */}
        <section id="pricing" className="s3 snap-section" style={{background:t.bg}}>
          <div className="s3-block">
            <div className="s3-label"><span className="m s3-label-text" style={{color:t.accent}}>Pricing</span></div>
            <div className="s3-content">
              <h2 className="s3-heading" style={{color:t.text}}>Pay per service, <span className="serif s3-heading-accent" style={{color:t.accent}}>no subscriptions.</span></h2>
              <p className="s3-desc" style={{color:t.textSoft}}>No hidden fees. No monthly plans. Just fund your wallet and order. Prices start from <strong style={{color:dark?"#34d399":"#059669"}}>{"₦"}150 per 1,000</strong>.</p>

              <div className="s3-grid">
                {[["Instagram",<svg key="ig" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,"rgba(225,48,108,.08)",[["Followers","₦850/1K"],["Likes","₦400/1K"],["Views","₦200/1K"]],"₦200",true],["TikTok",<svg key="tt" width="16" height="18" viewBox="0 0 448 512" fill="#ff0050"><path d="M448 209.91a210.06 210.06 0 01-122.77-39.25v178.72A162.55 162.55 0 11185 188.31v89.89a74.62 74.62 0 1052.23 71.18V0h88a121 121 0 00122.77 121.33z"/></svg>,"rgba(255,0,80,.06)",[["Followers","₦1,200/1K"],["Likes","₦500/1K"],["Views","₦150/1K"]],"₦150",false],["YouTube",<svg key="yt" width="20" height="14" viewBox="0 0 576 512" fill="#FF0000"><path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z"/></svg>,"rgba(255,0,0,.06)",[["Subscribers","₦2,500/1K"],["Views","₦350/1K"],["Likes","₦600/1K"]],"₦350",false],["Twitter/X",<svg key="x" width="16" height="16" viewBox="0 0 24 24" fill={dark?"#eee":"#222"}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,dark?"rgba(255,255,255,.04)":"rgba(0,0,0,.04)",[["Followers","₦1,000/1K"],["Likes","₦450/1K"],["Retweets","₦700/1K"]],"₦450",false],["Facebook",<svg key="fb" width="10" height="18" viewBox="0 0 320 512" fill="#1877F2"><path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z"/></svg>,"rgba(24,119,242,.06)",[["Page Likes","₦900/1K"],["Followers","₦1,100/1K"],["Post Likes","₦350/1K"]],"₦350",false],["Telegram",<svg key="tg" width="18" height="16" viewBox="0 0 496 512" fill="#0088cc"><path d="M248 8C111.033 8 0 119.033 0 256s111.033 248 248 248 248-111.033 248-248S384.967 8 248 8zm114.952 168.66c-3.732 39.215-19.881 134.378-28.1 178.3-3.476 18.584-10.322 24.816-16.948 25.425-14.4 1.326-25.338-9.517-39.287-18.661-21.827-14.308-34.158-23.215-55.346-37.177-24.485-16.135-8.612-25 5.342-39.5 3.652-3.793 67.107-61.51 68.335-66.746.154-.655.3-3.1-1.154-4.384s-3.59-.849-5.135-.5q-3.283.746-104.608 69.142-14.845 10.194-26.894 9.934c-8.855-.191-25.888-5.006-38.551-9.123-15.531-5.048-27.875-7.717-26.8-16.291q.84-6.7 18.45-13.7 108.446-47.248 144.628-62.3c68.872-28.647 83.183-33.623 92.511-33.789 2.052-.034 6.639.474 9.61 2.885a10.452 10.452 0 013.53 6.716 43.765 43.765 0 01.417 9.769z"/></svg>,"rgba(0,136,204,.06)",[["Members","₦1,500/1K"],["Post Views","₦250/1K"],["Reactions","₦500/1K"]],"₦250",false]].map(([platform,icon,iconBg,services,fromPrice,isPopular])=>(
                  <div key={platform} style={{background:dark?"rgba(255,255,255,.03)":"rgba(255,255,255,.85)",border:`${isPopular?"1.5":"1"}px solid ${isPopular?t.accent:(dark?"rgba(255,255,255,.1)":"rgba(0,0,0,.1)")}`,position:"relative",borderRadius:16,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                    {isPopular&&<div style={{position:"absolute",top:12,right:12,padding:"3px 10px",borderRadius:6,fontSize:10,fontWeight:600,letterSpacing:.5,textTransform:"uppercase",background:dark?"rgba(196,125,142,.12)":"rgba(196,125,142,.08)",color:t.accent,border:`0.5px solid ${dark?"rgba(196,125,142,.2)":"rgba(196,125,142,.15)"}`}}>Most popular</div>}
                    <div style={{padding:"20px 20px 16px",display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:36,height:36,borderRadius:10,background:iconBg,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</div>
                      <span style={{fontSize:16,fontWeight:600,color:t.text}}>{platform}</span>
                    </div>
                    <div style={{flex:1}}>
                      {services.map(([svc,price])=>(
                        <div key={svc} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 20px",borderTop:`1px solid ${dark?"rgba(255,255,255,.06)":"rgba(0,0,0,.06)"}`}}>
                          <span style={{fontSize:14,color:dark?"rgba(244,241,237,.5)":"rgba(28,27,25,.55)"}}>{svc}</span>
                          <span style={{fontSize:14,fontWeight:600,color:dark?"#34d399":"#059669"}}>{price}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:`1px solid ${dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)"}`,background:dark?"rgba(255,255,255,.02)":"rgba(0,0,0,.015)",marginTop:"auto"}}>
                      <span style={{fontSize:13,color:dark?"rgba(244,241,237,.3)":"rgba(28,27,25,.35)"}}>From <strong style={{fontSize:16,fontWeight:600,color:t.text}}>{fromPrice}</strong>/1K</span>
                      <button onClick={()=>setModal("signup")} style={{padding:"7px 18px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",background:dark?"rgba(196,125,142,.12)":"rgba(196,125,142,.08)",color:t.accent}}>Order now</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="s3-deposit" style={{display:"flex",alignItems:"center",gap:16,padding:"20px 24px",borderRadius:14,background:dark?"rgba(52,211,153,.04)":"rgba(5,150,105,.03)",border:`1px solid ${dark?"rgba(52,211,153,.15)":"rgba(5,150,105,.12)"}`}}>
                <div style={{width:40,height:40,borderRadius:10,background:dark?"rgba(52,211,153,.08)":"rgba(5,150,105,.06)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={dark?"#34d399":"#059669"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:600,color:t.text}}>Fund your wallet from <span style={{color:dark?"#34d399":"#059669"}}>{"₦"}500</span></div>
                  <div style={{fontSize:13,color:t.textSoft,marginTop:2}}>Cards, bank transfer, and crypto accepted. Funds arrive instantly.</div>
                </div>
                <button onClick={()=>setModal("signup")} className="s3-deposit-btn" style={{padding:"10px 24px",borderRadius:10,fontSize:14,fontWeight:600,border:"none",background:"#fff",color:"#1a1a1a",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>Add funds {"→"}</button>
              </div>
            </div>
          </div>
        </section>

        <div className="section-divider" style={{background:t.bg}}><div className="section-divider-line" style={{background:`linear-gradient(90deg,transparent,${dark?"rgba(196,125,142,.2)":"rgba(196,125,142,.15)"},transparent)`}}/><div className="section-divider-dot" style={{background:t.accent}}/><div className="section-divider-line" style={{background:`linear-gradient(90deg,transparent,${dark?"rgba(196,125,142,.2)":"rgba(196,125,142,.15)"},transparent)`}}/></div>

        {/* ━━━ SECTION 4: TESTIMONIALS ━━━ */}
        <section id="testimonials" className="s4 snap-section" style={{background:t.bgAlt}}>
          <div className="s4-header-row">
            <div className="s4-header-left">
              <div className="m s4-label" style={{color:t.accent}}>Testimonials</div>
              <h2 className="s4-heading" style={{color:t.text}}>Creators who <span className="serif s4-heading-accent" style={{color:t.accent}}>trust us.</span></h2>
              <p className="s4-desc" style={{color:t.textSoft}}>Real reviews from Nigerian creators and businesses growing with Nitro.</p>
            </div>
            <div className="s4-rating-box" style={{background:dark?"rgba(255,255,255,.03)":"rgba(255,255,255,.7)",border:`1px solid ${dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)"}`}}>
              <span className="m s4-rating-big" style={{color:t.text}}>4.9</span>
              <div>
                <div style={{display:"flex",gap:2,marginBottom:2}}>{Array(5).fill(0).map((_,j)=><svg key={j} width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}</div>
                <span style={{fontSize:12,color:t.textMuted}}>from 850+ reviews</span>
              </div>
            </div>
          </div>

          {/* Desktop/Tablet grid */}
          <div className="s4-grid">
            {[["Chioma A.","Fashion Brand Owner","I was skeptical at first, but Nitro delivered 5K followers to my business page in under 2 hours. My engagement actually went up.",5,"CA","#c47d8e"],["Tunde M.","Music Producer","Been using Nitro for 3 months to boost my YouTube views. The pricing is unbeatable and delivery is always instant.",5,"TM","#e0a458"],["Amara O.","Content Creator","The 24/7 support is what keeps me here. I had an issue at 2AM and someone responded within minutes.",5,"AO","#6ee7b7"],["Emeka N.","Digital Marketer","I manage social media for 12 clients. Nitro's bulk pricing saves me at least ₦50K monthly.",4,"EN","#a5b4fc"],["Blessing I.","Beauty Influencer","Started with ₦500 just to test. Now I deposit ₦20K monthly. My TikTok grew from 2K to 45K in 4 months.",5,"BI","#f472b6"],["Kola D.","E-commerce Seller","Fastest delivery I've seen from any Nigerian SMM panel. Instagram likes come through in literally seconds.",5,"KD","#fbbf24"]].map(([name,role,text,rating,avatar,color],i)=>(
              <div key={i} className="s4-card" style={{background:dark?"rgba(255,255,255,.05)":"rgba(255,255,255,.85)",border:`1px solid ${dark?"rgba(255,255,255,.1)":"rgba(0,0,0,.1)"}`}}>
                <div className="s4-stars">{Array(5).fill(0).map((_,j)=><svg key={j} width="14" height="14" viewBox="0 0 24 24" fill={j<rating?"#fbbf24":"none"} stroke="#fbbf24" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}</div>
                <p className="s4-text" style={{color:dark?"#c0bdb8":"#444"}}>"{text}"</p>
                <div className="s4-author" style={{borderTop:`1px solid ${dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)"}`}}>
                  <div className="s4-avatar" style={{background:color}}>{avatar}</div>
                  <div><div className="s4-name" style={{color:t.text}}>{name}</div><div className="s4-role" style={{color:t.textMuted}}>{role}</div></div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile horizontal scroll */}
          <div className="s4-scroll" ref={testimonialScrollRef} onScroll={()=>{const el=testimonialScrollRef.current;if(!el)return;const idx=Math.round(el.scrollLeft/272);setActiveTestimonial(Math.min(idx,5));}}>
            {[["Chioma A.","Fashion Brand Owner","Nitro delivered 5K followers in under 2 hours. My engagement actually went up.",5,"CA","#c47d8e"],["Tunde M.","Music Producer","3 months boosting YouTube views. Pricing is unbeatable, delivery always instant.",5,"TM","#e0a458"],["Amara O.","Content Creator","24/7 support — had an issue at 2AM, someone responded within minutes.",5,"AO","#6ee7b7"],["Emeka N.","Digital Marketer","Managing 12 clients. Nitro saves me ₦50K monthly with bulk pricing.",4,"EN","#a5b4fc"],["Blessing I.","Beauty Influencer","Started with ₦500. TikTok grew from 2K to 45K in 4 months.",5,"BI","#f472b6"],["Kola D.","E-commerce Seller","Fastest Nigerian SMM panel. Instagram likes in literally seconds.",5,"KD","#fbbf24"]].map(([name,role,text,rating,avatar,color],i)=>(
              <div key={i} className="s4-scroll-card" style={{background:dark?"rgba(255,255,255,.05)":"rgba(255,255,255,.85)",border:`1px solid ${dark?"rgba(255,255,255,.1)":"rgba(0,0,0,.1)"}`}}>
                <div className="s4-stars">{Array(5).fill(0).map((_,j)=><svg key={j} width="12" height="12" viewBox="0 0 24 24" fill={j<rating?"#fbbf24":"none"} stroke="#fbbf24" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}</div>
                <p className="s4-scroll-text" style={{color:dark?"#c0bdb8":"#444"}}>"{text}"</p>
                <div className="s4-author s4-author-sm" style={{borderTop:`1px solid ${dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.08)"}`}}>
                  <div className="s4-avatar s4-avatar-sm" style={{background:color}}>{avatar}</div>
                  <div><div className="s4-name s4-name-sm" style={{color:t.text}}>{name}</div><div className="s4-role" style={{color:t.textMuted}}>{role}</div></div>
                </div>
              </div>
            ))}
          </div>
          <div className="s4-dots">
            {Array(6).fill(0).map((_,i)=><button key={i} className="s4-dot" style={{background:activeTestimonial===i?t.accent:t.textMuted,opacity:activeTestimonial===i?1:.4}} onClick={()=>{testimonialScrollRef.current?.scrollTo({left:i*272,behavior:"smooth"})}}/>)}
          </div>
        </section>




        {/* ━━━ SECTION 6: CTA + FOOTER ━━━ */}
        <div id="cta" className="s6-wrapper snap-section">
          {/* ── CTA — FULL BLEED ── */}
          <div className="s6-cta-bleed" style={{background:dark?"#080510":"linear-gradient(180deg,"+t.bgAlt+" 0%,#c47d8e 25%,#8b4a5e 65%,#5a2d3d 100%)",position:"relative",overflow:"hidden",textAlign:"center"}}>
            {/* Ambient orbs */}
            <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",top:"-20%",left:"15%",background:dark?"rgba(196,125,142,.12)":"rgba(255,255,255,.1)",filter:"blur(100px)",pointerEvents:"none"}}/>
            <div style={{position:"absolute",width:350,height:350,borderRadius:"50%",bottom:"-10%",right:"10%",background:dark?"rgba(120,80,180,.08)":"rgba(255,255,255,.08)",filter:"blur(100px)",pointerEvents:"none"}}/>
            {dark&&<div style={{position:"absolute",width:200,height:200,borderRadius:"50%",top:"40%",right:"30%",background:"rgba(52,211,153,.04)",filter:"blur(80px)",pointerEvents:"none"}}/>}
            {/* Concentric rings */}
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",pointerEvents:"none"}}>
              {[600,400,200].map((s,i)=><div key={i} style={{width:s,height:s,borderRadius:"50%",border:`0.5px solid ${dark?`rgba(196,125,142,${.06-.015*i})`:`rgba(255,255,255,${.1-.02*i})`}`,position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)"}}/>)}
            </div>
            {/* Noise */}
            <div style={{position:"absolute",inset:0,pointerEvents:"none",opacity:.03,backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",backgroundSize:"128px"}}/>

            <div style={{position:"relative",zIndex:2,padding:"64px 60px 48px",maxWidth:640,margin:"0 auto"}} className="s6-cta-content">
              {/* Eyebrow */}
              <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:24}}>
                <div className="hero-live-dot" style={{width:8,height:8,borderRadius:"50%",background:"#34d399",boxShadow:"0 0 12px rgba(52,211,153,.5)"}}/>
                <span style={{fontSize:12,fontWeight:500,letterSpacing:1.5,textTransform:"uppercase",color:dark?"#34d399":"rgba(255,255,255,.85)"}}>{siteStats.orders||"0"} orders delivered today</span>
              </div>

              <h2 style={{fontSize:60,fontWeight:700,color:"#fff",lineHeight:1.02,letterSpacing:-2.5,marginBottom:4}} className="s6-h2-bold">Your Audience</h2>
              <h2 className="serif s6-h2-italic" style={{fontStyle:"italic",fontWeight:400,fontSize:68,lineHeight:1.02,marginBottom:16,color:dark?"#c47d8e":"#fff",textShadow:dark?"none":"0 4px 32px rgba(0,0,0,.15)"}}>Won't Grow Itself.</h2>
              <p style={{fontSize:17,lineHeight:1.7,marginBottom:44,color:dark?"rgba(255,255,255,.4)":"rgba(255,255,255,.8)",maxWidth:440,margin:"0 auto 28px"}}>Every minute you wait, your competitors are getting ahead. Join {siteStats.users||"0"} Nigerian creators already growing with Nitro.</p>

              <div className="s6-buttons" style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap",marginBottom:24}}>
                <button className="s6-btn-primary" onClick={()=>setModal("signup")} style={{padding:"18px 56px",borderRadius:14,fontSize:16,fontWeight:600,border:"none",cursor:"pointer",background:"#fff",color:"#1a1a1a",boxShadow:"0 12px 48px rgba(255,255,255,.1)",position:"relative",overflow:"hidden"}}>Start Growing Now {"\u2192"}</button>
                <button className="s6-btn-ghost" onClick={()=>document.getElementById("pricing")?.scrollIntoView({behavior:"smooth"})} style={{padding:"18px 44px",borderRadius:14,fontSize:16,fontWeight:500,cursor:"pointer",background:"none",color:"#fff",border:`1px solid ${dark?"rgba(255,255,255,.08)":"rgba(255,255,255,.25)"}`}}>View Pricing</button>
              </div>

              {/* Trust strip */}
              <div style={{display:"flex",justifyContent:"center",gap:28,flexWrap:"wrap"}}>
                {[["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z","Refund guarantee"],["M12 12m-10 0a10 10 0 1020 0 10 10 0 10-20 0M12 6v6l4 2","Delivery in seconds"],["M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z","24/7 support"]].map(([path,label])=>(
                  <div key={label} style={{display:"flex",alignItems:"center",gap:6,fontSize:13,fontWeight:450,color:dark?"rgba(255,255,255,.25)":"rgba(255,255,255,.6)"}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={path}/></svg>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── FOOTER ── */}
          <footer style={{padding:"32px 48px 20px",background:dark?"#030508":"#dedad4",position:"relative"}} className="s6-footer">
            {/* Accent line */}
            <div style={{height:1,marginBottom:24,background:`linear-gradient(90deg,transparent,${dark?"rgba(196,125,142,.15)":"rgba(196,125,142,.1)"},transparent)`}}/>

            {/* 4-column grid */}
            <div className="s6-ft-grid" style={{display:"grid",gridTemplateColumns:"1.8fr 1fr 1fr 1fr",gap:32,marginBottom:28}}>
              {/* Brand */}
              <div className="s6-ft-brand">
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                  <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#c47d8e,#8b5e6b)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(196,125,142,.25)"}}><svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                  <span style={{fontSize:16,fontWeight:700,letterSpacing:2,color:t.text}}>NITRO</span>
                </div>
                <p style={{fontSize:14,lineHeight:1.65,maxWidth:260,marginBottom:20,color:dark?"rgba(244,241,237,.3)":"rgba(28,27,25,.4)"}}>Nigeria's fastest SMM panel. Real followers, real engagement, instant delivery across 25+ platforms.</p>
                <div style={{display:"flex",gap:8}}>
                  {[[`https://x.com/${socialLinks.social_twitter||"TheNitroNG"}`,<svg key="x" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>],[`https://instagram.com/${socialLinks.social_instagram||"Nitro.ng"}`,<svg key="ig" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>]].map(([href,icon],i)=>(
                    <a key={i} href={href} target="_blank" rel="noopener" style={{width:34,height:34,borderRadius:9,background:dark?"rgba(255,255,255,.04)":"rgba(0,0,0,.04)",border:`0.5px solid ${dark?"rgba(255,255,255,.06)":"rgba(0,0,0,.06)"}`,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",color:dark?"rgba(244,241,237,.4)":"rgba(28,27,25,.4)"}} className="s6-sico">{icon}</a>
                  ))}
                  {socialLinks.social_whatsapp&&<a href={socialLinks.social_whatsapp} target="_blank" rel="noopener" style={{width:34,height:34,borderRadius:9,background:dark?"rgba(37,211,102,.04)":"rgba(37,211,102,.03)",border:`0.5px solid ${dark?"rgba(37,211,102,.1)":"rgba(37,211,102,.08)"}`,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none"}} className="s6-sico"><svg width="14" height="14" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>}
                  {socialLinks.social_telegram&&<a href={socialLinks.social_telegram} target="_blank" rel="noopener" style={{width:34,height:34,borderRadius:9,background:dark?"rgba(0,136,204,.04)":"rgba(0,136,204,.03)",border:`0.5px solid ${dark?"rgba(0,136,204,.1)":"rgba(0,136,204,.08)"}`,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none"}} className="s6-sico"><svg width="14" height="14" viewBox="0 0 24 24" fill="#0088cc"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a>}
                </div>
              </div>
              {/* Product */}
              <div>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16,color:dark?"rgba(244,241,237,.2)":"rgba(28,27,25,.25)"}}>Product</div>
                {[["Services","#services"],["Pricing","#pricing"],["Testimonials","#testimonials"],["Blog","/blog"]].map(([l,h])=>h.startsWith("#")?<div key={l} className="s6-footer-link" style={{display:"block",fontSize:14,fontWeight:450,padding:"5px 0",cursor:"pointer",color:dark?"rgba(244,241,237,.45)":"rgba(28,27,25,.5)"}} onClick={()=>document.getElementById(h.slice(1))?.scrollIntoView({behavior:"smooth"})}>{l}</div>:<a key={l} href={h} className="s6-footer-link" style={{display:"block",fontSize:14,fontWeight:450,padding:"5px 0",textDecoration:"none",color:dark?"rgba(244,241,237,.45)":"rgba(28,27,25,.5)"}}>{l}</a>)}
              </div>
              {/* Company */}
              <div>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16,color:dark?"rgba(244,241,237,.2)":"rgba(28,27,25,.25)"}}>Company</div>
                {[["FAQ","/faq"],["Terms","/terms"],["Privacy","/privacy"],["Refund","/refund"],["Cookies","/cookie"]].map(([l,h])=><a key={l} href={h} className="s6-footer-link" style={{display:"block",fontSize:14,fontWeight:450,padding:"5px 0",textDecoration:"none",color:dark?"rgba(244,241,237,.45)":"rgba(28,27,25,.5)"}}>{l}</a>)}
              </div>
              {/* Get in touch */}
              <div>
                <div style={{fontSize:11,fontWeight:600,letterSpacing:1.5,textTransform:"uppercase",marginBottom:16,color:dark?"rgba(244,241,237,.2)":"rgba(28,27,25,.25)"}}>Get in touch</div>
                <a href={`mailto:${SITE.email.general}`} className="s6-footer-link" style={{display:"block",fontSize:13,fontWeight:450,padding:"5px 0",textDecoration:"none",color:dark?"rgba(244,241,237,.45)":"rgba(28,27,25,.5)"}}>{SITE.email.general}</a>
                <div className="s6-footer-link" style={{display:"block",fontSize:14,fontWeight:450,padding:"5px 0",cursor:"pointer",color:dark?"rgba(244,241,237,.45)":"rgba(28,27,25,.5)"}} onClick={()=>window.open(socialLinks.social_whatsapp_support?`https://wa.me/${socialLinks.social_whatsapp_support}`:"#","_blank")}>WhatsApp Support</div>
                <a href={SITE.status} target="_blank" rel="noopener" className="s6-footer-link" style={{display:"flex",alignItems:"center",gap:6,fontSize:14,fontWeight:450,padding:"5px 0",textDecoration:"none",color:dark?"rgba(244,241,237,.45)":"rgba(28,27,25,.5)"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Status Page</a>
              </div>
            </div>

            {/* Divider */}
            <div style={{height:.5,marginBottom:22,background:dark?"rgba(255,255,255,.05)":"rgba(0,0,0,.05)"}}/>

            {/* Bottom bar */}
            <div className="s6-footer-bottom" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,color:dark?"rgba(244,241,237,.2)":"rgba(28,27,25,.25)"}}>{"©"} {new Date().getFullYear()>2026?`2026–${new Date().getFullYear()}`:"2026"} Nitro. All rights reserved.</span>
              <div style={{display:"flex",alignItems:"center",gap:16}}>
                <a href="/terms" style={{fontSize:12,textDecoration:"none",color:dark?"rgba(244,241,237,.2)":"rgba(28,27,25,.25)"}}>Terms</a>
                <a href="/privacy" style={{fontSize:12,textDecoration:"none",color:dark?"rgba(244,241,237,.2)":"rgba(28,27,25,.25)"}}>Privacy</a>
                <span style={{fontSize:12,color:dark?"rgba(244,241,237,.15)":"rgba(28,27,25,.2)"}}>Built in Lagos 🇳🇬</span>
              </div>
            </div>
          </footer>
        </div>{/* end s6-wrapper */}


      </div>

      {/* Side navigation indicator — desktop only */}
      <div className="side-nav">
        {sectionIds.map((id,i)=>(
          <button key={id} className={`side-nav-dot${activeSection===i?" side-nav-active":""}`} style={{background:activeSection===i?t.accent:t.textMuted}} onClick={()=>document.getElementById(id)?.scrollIntoView({behavior:"smooth"})} title={id}/>
        ))}
      </div>

      {modal&&<AuthModal key="auth-modal" dark={dark} t={t} mode={modal} setMode={setModal} onClose={closeModal} prefill={heroSignupData}/>}

      {/* Logout toast */}
      {logoutMsg&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:9999,padding:"12px 20px",borderRadius:14,maxWidth:"calc(100% - 32px)",width:"auto",background:dark?"rgba(17,22,40,.97)":"rgba(255,255,255,.97)",border:`1px solid ${dark?"rgba(110,231,183,.2)":"rgba(5,150,105,.15)"}`,backdropFilter:"blur(16px)",boxShadow:dark?"0 12px 40px rgba(0,0,0,.5)":"0 12px 40px rgba(0,0,0,.12)",display:"flex",alignItems:"center",gap:10,animation:"fu .4s ease"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span style={{fontSize:14,fontWeight:500,color:t.text}}>You've been logged out successfully</span></div>}

      {googleError&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:9999,padding:"12px 20px",borderRadius:14,maxWidth:"calc(100% - 32px)",width:"auto",background:dark?"rgba(17,22,40,.97)":"rgba(255,255,255,.97)",border:`1px solid ${dark?"rgba(220,38,38,.2)":"rgba(220,38,38,.15)"}`,backdropFilter:"blur(16px)",boxShadow:dark?"0 12px 40px rgba(0,0,0,.5)":"0 12px 40px rgba(0,0,0,.12)",display:"flex",alignItems:"center",gap:10,animation:"fu .4s ease"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark?"#fca5a5":"#dc2626"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span style={{fontSize:14,fontWeight:500,color:t.text}}>Google sign-in failed. Please try again or use email.</span></div>}

      {/* Session expired banner */}
      {sessionExpired&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:9998,padding:"16px 20px",borderRadius:14,maxWidth:"calc(100% - 32px)",width:400,background:dark?"rgba(17,22,40,.97)":"rgba(255,255,255,.97)",border:`1px solid ${dark?"rgba(224,164,88,.2)":"rgba(217,119,6,.12)"}`,backdropFilter:"blur(16px)",boxShadow:dark?"0 12px 40px rgba(0,0,0,.5)":"0 12px 40px rgba(0,0,0,.12)",animation:"fu .4s ease"}}>
        <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
          <div style={{width:28,height:28,borderRadius:7,background:dark?"rgba(224,164,88,.12)":"rgba(217,119,6,.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark?"#e0a458":"#d97706"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:600,color:dark?"#fbbf24":"#92400e",marginBottom:2}}>Session expired</div>
            <div style={{fontSize:13,color:dark?"#a09b95":"#555250",lineHeight:1.5,marginBottom:10}}>Your account was logged in on another device. If this wasn't you, secure your account.</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button onClick={()=>{setSessionExpired(false);setModal("login");}} style={{padding:"7px 16px",borderRadius:8,background:"linear-gradient(135deg,#c47d8e,#a3586b)",color:"#fff",fontSize:13,fontWeight:600,border:"none",cursor:"pointer"}}>Log In</button>
              <button onClick={()=>{setSessionExpired(false);setModal("forgot");}} style={{padding:"7px 16px",borderRadius:8,background:dark?"rgba(224,164,88,.1)":"rgba(217,119,6,.06)",border:`1px solid ${dark?"rgba(224,164,88,.25)":"rgba(217,119,6,.2)"}`,color:dark?"#e0a458":"#92400e",fontSize:13,fontWeight:600,cursor:"pointer"}}>Reset Password</button>
            </div>
          </div>
          <button onClick={()=>setSessionExpired(false)} style={{background:"none",border:"none",color:dark?"#706c68":"#757170",fontSize:16,cursor:"pointer",padding:0,lineHeight:1,flexShrink:0}}>×</button>
        </div>
      </div>}

      
    </div>
  );
}

const Lbl=({t,children})=><label style={{fontSize:12,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>{children}</label>;

export default function Landing() {
  return <ThemeProvider><LandingInner /></ThemeProvider>;
}
