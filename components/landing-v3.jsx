'use client';
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { ThemeProvider, useTheme, ThemeToggle } from "./shared-nav";
import { NitroWordmark } from "./nitro-logo";
import NitroLoader from "./nitro-loader";
import { SITE } from "../lib/site";
import AnnouncementBanner from "./announcement-banner";
import { trackViewContent } from "./capi-tracker";
import InlineAlert from "./inline-alert";
import { PublicNavSheet, SHEET_LINKS } from "./public-nav-sheet";

// The mobile hero card. Colours come in as CSS variables from the component so it follows the theme.
const HC_CSS = `
.hc{border-radius:22px;background:var(--cbg);border:1px solid var(--cline);box-shadow:var(--shadow);color:var(--cink);text-align:left;overflow:hidden;padding-bottom:14px}
.hc-strip{display:flex;align-items:center;justify-content:center;gap:7px;padding:9px 16px;font-size:12px;color:var(--cmut);background:var(--csoft);border-bottom:1px solid var(--cline)}
.hc-strip i{width:6px;height:6px;border-radius:50%;background:#34d399;box-shadow:0 0 0 3px rgba(52,211,153,.2);flex-shrink:0}.hc-strip b{color:var(--cink);font-weight:700}
.hc-facts{display:grid;grid-template-columns:1fr 1fr 1fr;margin:14px 16px 12px;border:1px solid var(--cline);border-radius:14px;overflow:hidden}
.hc-f{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px;padding:10px 6px;border-left:1px solid var(--cline);min-width:0}.hc-f:first-child{border-left:0}
.hc-f b{font-size:18px;font-weight:800;letter-spacing:-.01em;font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.hc-f span{font-size:10px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:var(--cmut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hc-f.ac{background:var(--acbg)}.hc-f.ac b{color:#c47d8e}
.hc-gift{display:flex;align-items:center;gap:10px;margin:0 16px 12px;padding:10px 12px;border-radius:14px;background:var(--acbg)}
.hc-gi{width:32px;height:32px;border-radius:10px;background:var(--cbg);color:#c47d8e;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}.hc-gi svg{width:16px;height:16px}
.hc-gift>span:last-child{display:flex;flex-direction:column;line-height:1.25;min-width:0}.hc-gift b{font-size:13px;font-weight:700}.hc-gift i{font-style:normal;font-size:12px;color:var(--cmut)}
.hc-cta{display:block;margin:0 16px;padding:14px;border-radius:14px;font-size:15px;font-weight:700;text-align:center;color:#fff;background:linear-gradient(135deg,#c47d8e,#a3586b);box-shadow:0 6px 24px rgba(196,125,142,.4);cursor:pointer}
.hc-login{text-align:center;font-size:13px;color:var(--cmut);margin:12px 16px 0}.hc-login a{color:#c47d8e;font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.hc-trust{display:flex;justify-content:center;gap:14px;margin:12px 16px 0;padding-top:12px;border-top:1px solid var(--cline);font-size:11px;color:var(--cdim)}
.hc-trust span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.hc-trust svg{width:11px;height:11px}
`;


// v3 hero: aurora, rings, rolling word, icon arc, stats strip and marquee.
const HERO_WORDS = ["music","brand","page","business","church","content"];
const LV3_CSS = `
.lv3-ring{position:absolute;border-radius:50%;border:1px solid;animation:lv3spin 90s linear infinite}
.lv3-ring-dash{border-style:dashed;animation-duration:130s;animation-direction:reverse}
@keyframes lv3spin{to{transform:rotate(360deg)}}
.lv3-aur{position:absolute;border-radius:50%;filter:blur(110px)}
.lv3-a1{animation:lv3aur 22s ease-in-out infinite alternate}.lv3-a2{animation:lv3aur2 28s ease-in-out infinite alternate}
@keyframes lv3aur{from{transform:translate(0,0) scale(1)}to{transform:translate(60px,30px) scale(1.12)}}
@keyframes lv3aur2{from{transform:translate(0,0) scale(1)}to{transform:translate(-50px,-40px) scale(1.08)}}
.lv3-grain-h{position:absolute;inset:0;opacity:.05;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.lv3-roller{display:inline-grid;text-align:left;vertical-align:top;height:1.02em;overflow:hidden}
.lv3-roller>span{grid-area:1/1;display:block;font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;letter-spacing:-.5px;opacity:0;transform:translateY(105%);transition:transform .55s cubic-bezier(.2,.7,.2,1),opacity .4s;white-space:nowrap}
.lv3-roller>span.on{opacity:1;transform:translateY(0)}
.lv3-roller>span.out{opacity:0;transform:translateY(-105%)}
.lv3-arc{position:relative;height:420px;display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:6px 0}
.lv3-ficon{width:52px;height:52px;border-radius:15px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.26);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.18);animation:lv3float 7s ease-in-out infinite}
.lv3-ficon-sm{width:44px;height:44px}
@keyframes lv3float{0%,100%{margin-top:0}50%{margin-top:-10px}}
.lv3-mq{display:flex;width:max-content;animation:lv3mq 50s linear infinite}
.lv3-mq:hover{animation-play-state:paused}
@keyframes lv3mq{to{transform:translateX(-50%)}}
.lv3-fold{display:flex;flex-direction:column}
@media (min-width:1200px){
  .lv3-fold{height:calc(100dvh - 56px);overflow:hidden}
  .lv3-fold #hero{flex:1;min-height:0}
  .lv3-fold .lv3-strip{flex-shrink:0}
}
/* iPad Pro landscape and small desktops: the arc column breathes less */
@media (min-width:1200px) and (max-width:1365px){
  .lv3-arc{height:330px}
  .lv3-ficon{width:44px;height:44px;border-radius:13px}
  .lv3-ficon svg{width:18px;height:18px}
  .lv3-ficon-sm{width:38px;height:38px}
  .lv3-ficon-sm svg{width:13px;height:13px}
}
/* shorter desktop viewports: the hero interior compresses so the strip stays in frame */
@media (min-width:1200px) and (max-height:820px){
  .lv3-fold #hero .lv3-grid{padding-top:24px;padding-bottom:20px}
  .lv3-fold .lv3-strip .lv3-stat{padding-top:16px;padding-bottom:16px}
}
@media (prefers-reduced-motion:reduce){.lv3-ring,.lv3-aur,.lv3-ficon,.lv3-mq{animation:none!important}.lv3-roller>span{transition:none}}
`;

const AuthModal = dynamic(() => import("./auth-modal"), { ssr: false });
const BelowFold = dynamic(() => import('./landing-v3-below-fold'), { ssr: true });

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
  const empty = dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)";
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


function CountUp({value,duration=1500}){const[display,setDisplay]=useState("0");const rafRef=useRef(null);useEffect(()=>{if(value==null)return;if(rafRef.current)cancelAnimationFrame(rafRef.current);const str=String(value);const m=str.match(/^([\d.]+)(.*)$/);if(!m){setDisplay(str);return;}const target=parseFloat(m[1]);const suffix=m[2];const dec=m[1].includes(".");if(target===0){setDisplay("0"+suffix);return;}const start=performance.now();const step=now=>{const p=Math.min((now-start)/duration,1);const e=1-Math.pow(1-p,3);const n=e*target;setDisplay((dec?n.toFixed(1):String(Math.round(n)))+suffix);if(p<1)rafRef.current=requestAnimationFrame(step);};rafRef.current=requestAnimationFrame(step);return()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);};},[value,duration]);return display;}

function LandingInner({ initialAuthQuery }){
  const { dark, toggleTheme, t: baseT } = useTheme();

  const initialVia=initialAuthQuery?.via||"";
  const initialRef=initialAuthQuery?.ref||"";
  const [modal,setModal]=useState(initialAuthQuery?.initialModal||null);
  const [navOpen,setNavOpen]=useState(false);
  const resetToken=initialAuthQuery?.resetToken||null;
  const [heroAuth,setHeroAuth]=useState(initialAuthQuery?.initialHeroAuth||"login");
  const [heroMethod,setHeroMethod]=useState("email");
  const [heroName,setHeroName]=useState("");
  const [heroFirstName,setHeroFirstName]=useState("");
  const [heroLastName,setHeroLastName]=useState("");
  const [heroEmail,setHeroEmail]=useState("");
  const [heroPw,setHeroPw]=useState("");
  const [heroRemember,setHeroRemember]=useState(true);
  const [heroLoading,setHeroLoading]=useState(false);
  const [heroError,setHeroError]=useState("");
  const [heroSuccess,setHeroSuccess]=useState("");
  const [heroSignupData,setHeroSignupData]=useState(null);
  const [heroSignupStep,setHeroSignupStep]=useState(1);
  const [heroPw2,setHeroPw2]=useState("");
  const [heroPhone,setHeroPhone]=useState("");
  const [heroRefCode,setHeroRefCode]=useState(initialRef);
  const heroVia=initialVia;
  const [heroAgree,setHeroAgree]=useState(false);
  const [heroShowPw,setHeroShowPw]=useState(false);
  const [scrolled,setScrolled]=useState(false);
  const [activeSection,setActiveSection]=useState(0);
  const scrollRef=useRef(null);
  const [siteStats,setSiteStats]=useState({users:null,orders:null,deliveryRate:0,processing:0});
  const [siteAlerts,setSiteAlerts]=useState([]);
  const [socialLinks,setSocialLinks]=useState({});
  const [pricingData,setPricingData]=useState(null);
  const [word,setWord]=useState(0);
  useEffect(()=>{if(typeof matchMedia!=="undefined"&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;const iv=setInterval(()=>setWord(w=>(w+1)%HERO_WORDS.length),2600);return()=>clearInterval(iv);},[]);

  useEffect(()=>{const el=scrollRef.current;if(!el)return;const onScroll=()=>setScrolled(Math.max(el.scrollTop,window.scrollY)>20);el.addEventListener("scroll",onScroll);window.addEventListener("scroll",onScroll,{passive:true});return()=>{el.removeEventListener("scroll",onScroll);window.removeEventListener("scroll",onScroll);};},[]);
  useEffect(()=>{trackViewContent({content_name:'homepage',content_type:'landing'});},[]);
  useEffect(()=>{if(initialVia)fetch('/api/click',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:initialVia})}).catch(()=>{});},[initialVia]);
  const [logoutMsg,setLogoutMsg]=useState(false);
  const [googleError,setGoogleError]=useState(false);
  const [sessionExpired,setSessionExpired]=useState(false);
  useEffect(()=>{const p=new URLSearchParams(window.location.search);if(p.get("reset")){window.history.replaceState({},"","/");return;}if(p.get("session_expired")){setSessionExpired(true);window.history.replaceState({},"","/");}if(p.get("logout")){setLogoutMsg(true);window.history.replaceState({},"","/");setTimeout(()=>setLogoutMsg(false),4000);}if(p.get("google_error")){setGoogleError(true);window.history.replaceState({},"","/");setTimeout(()=>setGoogleError(false),5000);setModal("login");}if(p.get("error")==="account_pending_deletion"){setHeroError("Account pending deletion. Contact support@nitro.ng before the deletion deadline to cancel.");window.history.replaceState({},"","/");}if(p.get("error")==="disposable_email"){setHeroError("Disposable email addresses aren't allowed. Please sign up with a permanent email.");setModal("signup");window.history.replaceState({},"","/");}if(["google_cancelled","google_state_mismatch","google_token_failed","google_no_email","google_failed","google_missing_params","google_not_configured","google_account_deleted"].includes(p.get("error"))){setGoogleError(true);window.history.replaceState({},"","/");setTimeout(()=>setGoogleError(false),5000);setModal("login");}},[]);
  useEffect(()=>{(async()=>{try{const [maintRes,siRes,stRes,prRes]=await Promise.all([fetch("/api/maintenance-check"),fetch("/api/site-info"),fetch("/api/settings"),fetch("/api/pricing")]);if(maintRes.ok){const m=await maintRes.json();if(m.maintenance){window.location.replace("/maintenance");return;}}if(siRes.ok){const d=await siRes.json();if(d.stats)setSiteStats(d.stats);if(d.alerts?.length)setSiteAlerts(d.alerts);}if(stRes.ok){const d=await stRes.json();setSocialLinks(d.settings||{});}if(prRes.ok){const d=await prRes.json();if(d.platforms?.length)setPricingData(d);}}catch{}})();},[]);
  const closeModal=useCallback(()=>setModal(null),[]);

  // Scroll lock when modal is open
  useEffect(()=>{if(modal){document.body.style.overflow="hidden";}else{document.body.style.overflow="";}return()=>{document.body.style.overflow="";};},[modal]);

  // Hero card auth handlers
  const heroLoginSubmit=async()=>{
    setHeroError("");if(!heroEmail||!heroPw){setHeroError("Please fill in all fields");return;}
    setHeroLoading(true);
    try{const res=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:heroMethod==="email"?heroEmail:`+234${heroEmail}`,password:heroPw,remember:heroRemember})});const data=await res.json();if(!res.ok){if(data.banned){window.location.href="/banned";return;}setHeroError(data.error||"Login failed");setHeroLoading(false);return;}window.location.replace("/dashboard");}catch{setHeroError("Something went wrong.");setHeroLoading(false);}
  };
  const heroSignupSubmit=()=>{
    setHeroError("");if(!heroFirstName||!heroLastName){setHeroError("Please enter your first and last name");return;}if(!heroEmail){setHeroError("Please enter your email");return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(heroEmail)){setHeroError("Please enter a valid email");return;}
    const cleanPhone=heroPhone.replace(/^0+/,"");if(!cleanPhone||!/^[789]\d{9}$/.test(cleanPhone)){setHeroError("Please enter a valid Nigerian phone number");return;}
    setHeroSignupStep(2);
  };
  const heroSignupFinalSubmit=async()=>{
    setHeroError("");
    if(!heroPw||heroPw.length<6){setHeroError("Password must be at least 6 characters");return;}
    if(heroPw!==heroPw2){setHeroError("Passwords don't match");return;}
    if(!heroAgree){setHeroError("Please agree to the Terms of Service");return;}
    setHeroLoading(true);
    try{
      const res=await fetch("/api/auth/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:`${heroFirstName} ${heroLastName}`,firstName:heroFirstName,lastName:heroLastName,email:heroEmail,password:heroPw,phone:heroPhone?`+234${heroPhone.replace(/^0+/,"")}`:undefined,referralCode:heroRefCode||undefined,via:heroVia||undefined})});
      const data=await res.json();
      if(!res.ok){setHeroError(data.error||"Signup failed");setHeroLoading(false);return;}
      window.fbq&&window.fbq("track","CompleteRegistration",{content_name:"signup",status:true},{eventID:data.eventId});
      setTimeout(()=>window.location.replace("/dashboard"),300);
    }catch{setHeroError("Something went wrong.");setHeroLoading(false);}
  };
  const heroForgotSubmit=async()=>{
    setHeroError("");if(!heroEmail){setHeroError("Please enter your email");return;}
    setHeroLoading(true);
    try{const res=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:heroEmail})});const data=await res.json();if(!res.ok){setHeroError(data.error||"Failed to send reset link");setHeroLoading(false);return;}setHeroError("");setHeroLoading(false);setHeroAuth("login");setHeroSuccess("Reset link sent! Check your email.");}catch{setHeroError("Something went wrong.");setHeroLoading(false);}
  };
  const handleHeroAuthSubmit=(event)=>{
    event.preventDefault();
    if(heroLoading)return;
    if(heroAuth==="login")return heroLoginSubmit();
    if(heroAuth==="forgot")return heroForgotSubmit();
    return heroSignupStep===2?heroSignupFinalSubmit():heroSignupSubmit();
  };

  const sectionIds=["hero","tiers","curated","how","reviews","cta"];
  const currentSec=useRef(0);
  useEffect(()=>{
    const handleKey=(e)=>{
      if(modal)return;if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA")return;
      if(e.code==="Space"){e.preventDefault();const next=e.shiftKey?Math.max(0,currentSec.current-1):Math.min(sectionIds.length-1,currentSec.current+1);currentSec.current=next;document.getElementById(sectionIds[next])?.scrollIntoView({behavior:"smooth",block:"start"});}
    };
    window.addEventListener("keydown",handleKey);return()=>window.removeEventListener("keydown",handleKey);
  },[modal]);
  useEffect(()=>{
    const el=scrollRef.current;if(!el)return;
    // offsetTop is useless here: the below-fold sections live inside positioned
    // wrappers, so it reads 0 for all of them. Measure against the container.
    const onScroll=()=>{const top=el.getBoundingClientRect().top;const sections=sectionIds.map(id=>document.getElementById(id)).filter(Boolean);let c=0,min=Infinity;sections.forEach((s,i)=>{const d=Math.abs(s.getBoundingClientRect().top-top);if(d<min){min=d;c=i;}});currentSec.current=c;setActiveSection(c);};
    el.addEventListener("scroll",onScroll,{passive:true});return()=>el.removeEventListener("scroll",onScroll);
  },[]);

  const t=useMemo(()=>({
    ...baseT,
    bgAlt:dark?"#0f1322":"#e6e3dc",
    logoGrad:"linear-gradient(135deg,#c47d8e,#8b5e6b)",
    heroBg:dark?"linear-gradient(135deg,#120c1e 0%,#0a0f1e 40%,#0d0a18 100%)":"linear-gradient(135deg,#c47d8e 0%,#a3586b 40%,#8b4a5e 100%)",
    heroText:dark?"#eae7e2":"#fff",heroSoft:dark?"#b0aca8":"rgba(255,255,255,.85)",heroMuted:dark?"#7d7974":"rgba(255,255,255,.55)",
    heroGlass:dark?"rgba(15,19,35,.5)":"rgba(255,255,255,.16)",heroGlassBrd:dark?"rgba(255,255,255,.12)":"rgba(255,255,255,.2)",
    heroAccentBadge:dark?"rgba(196,125,142,.15)":"rgba(255,255,255,.15)",
  }),[dark,baseT]);

  return(
    <div className="root h-dvh overflow-hidden flex flex-col max-desktop:h-auto max-desktop:min-h-dvh max-desktop:overflow-visible" suppressHydrationWarning>
      <style suppressHydrationWarning>{`
        .root{background:${t.bg};color:${t.text};transition:background 1.2s ease,color 1.2s ease}
      `}</style>

      {/* ═══ NAVBAR — outside snap container ═══ */}
      <nav className="main-nav relative px-8 max-desktop:px-7 max-md:px-3.5 h-14 max-md:h-[52px] flex items-center justify-between shrink-0 z-[100] max-desktop:sticky max-desktop:top-0" style={{background:dark?"#120c1e":scrolled?"rgba(139,74,94,.98)":"rgba(163,88,107,.96)",borderBottom:`0.5px solid ${dark?"rgba(255,255,255,.16)":"rgba(255,255,255,.24)"}`,transition:"background 1.2s ease"}}>
          <button onClick={()=>{scrollRef.current?.scrollTo({top:0,behavior:"smooth"});window.scrollTo({top:0,behavior:"smooth"});}} className="nav-brand flex items-center gap-2.5 bg-transparent p-0">
            <span className="md:hidden w-[30px] h-[30px] rounded-lg flex items-center justify-center" style={{background:"linear-gradient(135deg,#c47d8e,#8b5e6b)",boxShadow:"0 2px 8px rgba(196,125,142,.3)"}}><svg width="12" height="13" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg></span>
            <span className="max-md:hidden h-7 px-3 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)" }}><NitroWordmark height={12} color="#fff" /></span>
          </button>
          <div className="max-desktop:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 items-center">
              {[["Tiers","tiers"],["Why curated","curated"],["How it works","how"],["Reviews","reviews"]].map(([l,id])=><button key={l} onClick={()=>document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"})} className="nav-link-pill py-1.5 px-4 rounded-lg bg-transparent text-sm font-medium border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{color:"rgba(255,255,255,.75)"}}>{l}</button>)}<a href="/resellers" className="nav-link-pill py-1.5 px-4 rounded-lg bg-transparent text-sm font-medium border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px no-underline" style={{color:"rgba(255,255,255,.75)"}}>Resellers</a><a href="/blog" className="nav-link-pill py-1.5 px-4 rounded-lg bg-transparent text-sm font-medium border-none cursor-pointer transition-transform duration-200 hover:-translate-y-px no-underline" style={{color:"rgba(255,255,255,.75)"}}>Blog</a>
          </div>
          <div className="nav-right flex items-center gap-2.5">
            <ThemeToggle dark={dark} onToggle={toggleTheme} />
            <button onClick={()=>setModal("login")} className="nav-login-btn py-[7px] px-5 rounded-lg text-sm font-semibold cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{background:dark?"rgba(255,255,255,.16)":"rgba(255,255,255,.19)",border:`0.5px solid ${dark?"rgba(255,255,255,.18)":"rgba(255,255,255,.28)"}`,color:dark?"rgba(255,255,255,.8)":"#fff"}}>Log in</button>
            <button type="button" onClick={()=>setNavOpen(true)} aria-label="Open menu" aria-expanded={navOpen} className="desktop:hidden w-9 h-9 rounded-lg border-none cursor-pointer flex items-center justify-center" style={{background:"rgba(255,255,255,.14)",color:"#fff"}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><button onClick={()=>setModal("signup")} className="nav-signup-btn max-desktop:!hidden py-[7px] px-5 rounded-lg border-none text-sm font-semibold cursor-pointer transition-transform duration-200 hover:-translate-y-px" style={{background:"#fff",color:"#1a1a1a"}}>Get started</button>
          </div>
      </nav>
      <PublicNavSheet open={navOpen} onClose={()=>setNavOpen(false)} dark={dark} links={SHEET_LINKS} liveCount={siteStats.processing} onLogin={()=>{setNavOpen(false);setModal("login")}} onSignup={()=>{setNavOpen(false);setModal("signup")}} />

      <div ref={scrollRef} className="snap-container flex-1 overflow-y-auto overflow-x-hidden relative max-desktop:flex-none max-desktop:overflow-y-visible max-desktop:overflow-x-clip">

        {/* Site-wide announcement banner */}
        <AnnouncementBanner alerts={siteAlerts} dark={dark} mode="landing" />

        {/* ━━━ HERO (v3): on desktop the fold holds hero + stats + marquee in one viewport ━━━ */}
        <div className="lv3-fold snap-section">
        <section id="hero" className="overflow-hidden relative flex flex-col" style={{background:t.heroBg}}>
          <style>{LV3_CSS}</style>

          {/* Living background: warm aurora, slow rings, grain */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="lv3-aur lv3-a1" style={{top:"-25%",left:"8%",width:560,height:440,background:dark?"rgba(196,125,142,.16)":"rgba(255,205,190,.28)"}}/>
            <div className="lv3-aur lv3-a2" style={{bottom:"-30%",right:"18%",width:560,height:460,background:dark?"rgba(96,165,250,.09)":"rgba(255,235,170,.16)"}}/>
            <div className="lv3-ring lv3-ring-dash" style={{width:900,height:900,right:-300,top:-250,borderColor:dark?"rgba(196,125,142,.14)":"rgba(255,255,255,.1)"}}/>
            <div className="lv3-ring" style={{width:640,height:640,right:-170,top:-120,borderColor:dark?"rgba(196,125,142,.14)":"rgba(255,255,255,.1)"}}/>
            <div className="lv3-ring" style={{width:1100,height:1100,left:-500,bottom:-700,borderColor:dark?"rgba(196,125,142,.14)":"rgba(255,255,255,.1)"}}/>
            <div className="lv3-grain-h"/>
          </div>

          <div className={`lv3-grid grid grid-cols-[1.1fr_96px_.9fr] max-desktop:grid-cols-1 gap-x-[18px] max-desktop:gap-y-[30px] items-center pt-14 pb-12 max-desktop:pt-6 max-desktop:pb-4 max-md:pb-2 px-[60px] max-desktop:px-10 max-md:px-5 max-w-[1200px] mx-auto w-full relative z-[1] flex-1 max-desktop:text-center max-desktop:min-h-0 ${siteAlerts.length > 0 ? "max-md:pt-[50px]" : "max-md:pt-2"}`}>
            {/* LEFT */}
            <div className="text-left relative z-[1] max-desktop:text-center max-desktop:flex max-desktop:flex-col max-desktop:items-center">
              <div className="fu text-[11px] font-bold tracking-[3px] uppercase mb-[22px] max-md:mb-3.5" style={{color:dark?t.accent:"rgba(255,255,255,.72)"}}>Nigeria's social growth engine</div>
              <h1 className="fu fd1 text-[clamp(40px,5vw,66px)] max-md:text-[clamp(34px,9vw,44px)] font-semibold leading-[1.02] -tracking-[2.2px] max-md:-tracking-[1.2px]" style={{color:t.heroText}}>
                Your <span className="lv3-roller" aria-live="polite">{HERO_WORDS.map((w,i)=><span key={w} className={i===word?"on":i===((word+HERO_WORDS.length-1)%HERO_WORDS.length)?"out":""} style={{color:dark?t.accent:"#fff"}} aria-hidden={i!==word}>{w}</span>)}</span><br/>deserves a bigger audience.
              </h1>
              <p className="fu fd2 text-[clamp(15px,1.3vw,17.5px)] max-md:text-[14px] leading-[1.65] max-w-[520px] max-desktop:mx-auto mt-6 mb-7 max-md:mt-4 max-md:mb-4" style={{color:t.heroSoft}}>Followers, likes and views for Instagram, TikTok, YouTube and {siteStats.uniquePlatforms?`${siteStats.uniquePlatforms}+`:"25+"} more platforms. Paid in naira, delivered in minutes, tested before you ever see it, and real people on WhatsApp when you need them.</p>

              {/* CTAs — desktop/tablet */}
              <div className="fu fd3 flex gap-[18px] items-center flex-wrap max-desktop:!hidden">
                <a href="/signup" onClick={e=>{e.preventDefault();setModal("signup")}} className="hero-cta-btn inline-flex items-center gap-2 py-[15px] px-[26px] rounded-xl text-[15px] font-bold no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,.22)]" style={{background:dark?"linear-gradient(135deg,#c47d8e,#8b5e6b)":"#fff",color:dark?"#fff":"#1a1a1a"}}>🎁 Start with ₦1,500 free credit →</a>
                <a href="/pricing" onClick={e=>{e.preventDefault();document.getElementById("tiers")?.scrollIntoView({behavior:"smooth",block:"start"})}} className="text-[15px] font-semibold no-underline pb-0.5" style={{color:dark?t.text:"#fff",borderBottom:`1.5px solid ${dark?"rgba(255,255,255,.2)":"rgba(255,255,255,.5)"}`}}>See the tiers</a>
              </div>

              {/* Mobile hero card: the live format (strip, facts, gift, CTA, log in, trust) */}
              <div className="fu fd4 hidden max-desktop:!flex max-desktop:flex-col max-desktop:items-center max-desktop:mt-4 max-md:mt-3 w-full max-md:max-w-full relative z-[2]">
                <style>{HC_CSS}</style>
                <div className="hc w-full max-w-[380px] max-md:max-w-full" style={{"--cbg":dark?"#171126":"#fff","--cink":dark?"#f2efe9":"#1a1a1a","--cmut":dark?"rgba(255,255,255,.5)":"rgba(0,0,0,.45)","--cdim":dark?"rgba(255,255,255,.35)":"rgba(0,0,0,.35)","--cline":dark?"rgba(255,255,255,.1)":"rgba(0,0,0,.08)","--csoft":dark?"rgba(255,255,255,.05)":"rgba(0,0,0,.03)","--acbg":dark?"rgba(196,125,142,.16)":"rgba(196,125,142,.1)","--shadow":dark?"0 20px 60px rgba(0,0,0,.5)":"0 20px 60px rgba(0,0,0,.16)"}}>
                  {siteStats.processing!=null&&<div className="hc-strip"><i/><span>Live activity: <b><CountUp value={siteStats.processing}/></b></span></div>}
                  <div className="hc-facts">
                    {[[siteStats.orders||"0","Orders",false],[siteStats.users||"0","Accounts",false],...(siteStats.deliveryRate!=null?[[`${siteStats.deliveryRate}%`,"Delivery",true]]:[])].map(([num,label,ac],i)=>
                      <div key={i} className={"hc-f"+(ac?" ac":"")}><b><CountUp value={num}/></b><span>{label}</span></div>
                    )}
                  </div>
                  <div className="hc-gift">
                    <span className="hc-gi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg></span>
                    <span><b>Up to ₦1,500 in free promo credit</b><i>to give your next post a real push</i></span>
                  </div>
                  <a href="/signup" onClick={e=>{e.preventDefault();setModal("signup")}} className="hc-cta hero-cta-pulse no-underline">Create free account →</a>
                  <div className="hc-login">Already have an account? <a href="/?login=1" onClick={e=>{e.preventDefault();setModal("login")}}>Log in</a></div>
                  <div className="hc-trust">
                    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Trusted by creators</span>
                    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>Fast delivery</span>
                    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Human support</span>
                  </div>
                </div>
              </div>

              {/* Trust — desktop/tablet */}
              <div className="fu fd4 flex max-md:!hidden max-desktop:justify-center items-center gap-[18px] mt-[22px] text-xs flex-wrap" style={{color:dark?"rgba(255,255,255,.4)":"rgba(255,255,255,.66)"}}>
                <span className="inline-flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Trusted by creators across Nigeria</span>
                {socialLinks.social_whatsapp_support&&<a href={`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 no-underline" style={{color:"inherit"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>We reply fast on WhatsApp</a>}
              </div>
            </div>

            {/* ARC — floating platform icons on their own column, desktop only */}
            <div className="lv3-arc max-desktop:!hidden" aria-hidden="true">
              <div className="lv3-ficon" style={{transform:"translateX(-10px)",animationDelay:"0s"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></div>
              <div className="lv3-ficon" style={{transform:"translateX(14px)",animationDelay:"1.4s"}}><svg width="20" height="22" viewBox="0 0 448 512" fill="currentColor"><path d="M448 209.91a210.06 210.06 0 01-122.77-39.25v178.72A162.55 162.55 0 11185 188.31v89.89a74.62 74.62 0 1052.23 71.18V0h88a121 121 0 00122.77 121.33z"/></svg></div>
              <div className="lv3-ficon" style={{transform:"translateX(-4px)",animationDelay:"2.8s"}}><svg width="24" height="17" viewBox="0 0 576 512" fill="currentColor"><path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z"/></svg></div>
              <div className="lv3-ficon lv3-ficon-sm" style={{transform:"translateX(12px)",animationDelay:"2s"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></div>
            </div>

            {/* RIGHT — Auth card (desktop) */}
            <div className="w-full max-w-[400px] justify-self-end max-desktop:hidden">
              <form onSubmit={handleHeroAuthSubmit} noValidate className="fu fd2 rounded-[20px] pt-[26px] px-[26px] pb-[22px] relative z-[2]" style={{background:dark?"#160f22":"#fff",border:`1px solid ${dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.09)"}`,boxShadow:"0 30px 80px rgba(0,0,0,.26)"}}>
                <h2 className="text-[22px] font-semibold text-center mb-[3px] text-t-text">{heroAuth==="login"?"Let's run it up":heroAuth==="forgot"?"Forgot password?":(heroSignupStep===1?"Create your free account":"Secure Your Account")}</h2>
                <p className="text-[15px] text-center mb-4 font-medium text-t-text-soft">{heroAuth==="login"?"Log in and start boosting":heroAuth==="forgot"?"Enter your email for a reset link":(heroSignupStep===1?"Free to join, no card needed.":"Step 2 of 2. Set your password")}</p>
                {heroAuth==="signup"&&heroSignupStep===1&&<div className="text-center mb-3"><span className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full text-[11px] font-semibold text-accent" style={{background:dark?"rgba(196,125,142,.15)":"rgba(196,125,142,.1)"}}>🎁 Get up to ₦1,500 free on your first deposit</span></div>}
                {heroAuth!=="forgot"&&heroSignupStep===1&&<><button type="button" onClick={()=>{const gp=new URLSearchParams();if(heroRefCode)gp.set('ref',heroRefCode);if(heroVia)gp.set('via',heroVia);window.location.href=`/api/auth/google${gp.size?`?${gp}`:''}`;}} style={{width:"100%",padding:"11px 0",borderRadius:12,background:dark?"rgba(255,255,255,.16)":"#fff",border:`1px solid ${dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.19)"}`,display:"flex",alignItems:"center",justifyContent:"center",gap:10,fontSize:13,fontWeight:600,color:dark?"#eae7e2":"#333",marginBottom:0}}><svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>{heroAuth==="login"?"Continue with Google":"Sign up with Google"}</button><div style={{display:"flex",alignItems:"center",gap:12,margin:"12px 0"}}><div style={{flex:1,height:1,background:dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.14)"}}/><span className="text-t-text-muted" style={{fontSize:11,fontWeight:500}}>or</span><div style={{flex:1,height:1,background:dark?"rgba(255,255,255,.18)":"rgba(0,0,0,.14)"}}/></div></>}
                {heroAuth==="signup"&&heroSignupStep===1&&<>
                  <div style={{display:"flex",gap:8,marginBottom:12}}>
                    <div className="flex-1">
                      <label htmlFor="hero-signup-first" className="text-t-text-soft" style={{fontSize:11,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>First Name</label>
                      <input id="hero-signup-first" name="firstName" autoComplete="given-name" placeholder="First" value={heroFirstName} onChange={e=>setHeroFirstName(e.target.value.replace(/[^a-zA-Z\u00C0-\u017F]/g,"").slice(0,50))} className="text-t-text font-[inherit]" style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,fontSize:15,outline:"none"}}/>
                    </div>
                    <div className="flex-1">
                      <label htmlFor="hero-signup-last" className="text-t-text-soft" style={{fontSize:11,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Last Name</label>
                      <input id="hero-signup-last" name="lastName" autoComplete="family-name" placeholder="Last" value={heroLastName} onChange={e=>setHeroLastName(e.target.value.replace(/[^a-zA-Z\u00C0-\u017F]/g,"").slice(0,50))} className="text-t-text font-[inherit]" style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,fontSize:15,outline:"none"}}/>
                    </div>
                  </div>
                  <label htmlFor="hero-signup-email" className="text-t-text-soft" style={{fontSize:11,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Email Address</label>
                  <input id="hero-signup-email" name="email" autoComplete="email" placeholder="you@example.com" value={heroEmail} onChange={e=>setHeroEmail(e.target.value.trim().toLowerCase().slice(0,254))} type="email" className="text-t-text font-[inherit]" style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,fontSize:15,outline:"none",marginBottom:12}}/>
                  <label htmlFor="hero-signup-phone" className="text-t-text-soft" style={{fontSize:11,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>WhatsApp Number <span style={{color:dark?"#fca5a5":"#dc2626"}}>*</span></label>
                  <div style={{display:"flex",gap:8,marginBottom:12}}>
                    <div aria-hidden="true" className="text-t-text-soft" style={{padding:"11px 12px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,fontSize:15,flexShrink:0,display:"flex",alignItems:"center",gap:6,userSelect:"none"}}><span style={{fontSize:15,lineHeight:1}}>🇳🇬</span> +234</div>
                    <input id="hero-signup-phone" name="phone" autoComplete="tel" placeholder="8012345678" value={heroPhone} onChange={e=>setHeroPhone(e.target.value.replace(/\D/g,"").slice(0,11))} type="tel" className="text-t-text font-[inherit]" style={{flex:1,padding:"11px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,fontSize:15,outline:"none"}}/>
                  </div>
                </>}
                {heroAuth==="signup"&&heroSignupStep===2&&<>
                  <label htmlFor="hero-signup-password" className="text-t-text-soft" style={{fontSize:11,fontWeight:600,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:1.5}}>Password</label>
                  <div style={{position:"relative",marginBottom:2}}>
                    <input id="hero-signup-password" name="password" autoComplete="new-password" placeholder="Min. 6 characters" value={heroPw} onChange={e=>setHeroPw(e.target.value.slice(0,128))} type={heroShowPw?"text":"password"} className="text-t-text font-[inherit]" style={{width:"100%",padding:"9px 40px 9px 14px",borderRadius:10,background:t.inputBg,border:"1px solid "+t.inputBorder,fontSize:13,outline:"none"}}/>
                    <button onClick={()=>setHeroShowPw(!heroShowPw)} type="button" aria-label={heroShowPw?"Hide password":"Show password"} className="text-t-text-muted" style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",padding:2}}>{heroShowPw?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}</button>
                  </div>
                  <PwStrength pw={heroPw} dark={dark} />
                  {heroPw&&heroPw.length<6&&<div className="text-t-text-muted" style={{fontSize:11,marginBottom:4,lineHeight:1.5}}>Use 6+ characters with a mix of uppercase, numbers, and symbols for a strong password.</div>}
                  <label htmlFor="hero-signup-confirm" className="text-t-text-soft" style={{fontSize:11,fontWeight:600,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:1.5}}>Confirm Password</label>
                  <input id="hero-signup-confirm" name="passwordConfirmation" autoComplete="new-password" placeholder="Re-enter password" value={heroPw2} onChange={e=>setHeroPw2(e.target.value.slice(0,128))} type="password" className="text-t-text font-[inherit]" style={{width:"100%",padding:"9px 14px",borderRadius:10,background:t.inputBg,border:"1px solid "+(heroPw2&&heroPw!==heroPw2?(dark?"rgba(220,38,38,.4)":"#fecaca"):heroPw2&&heroPw===heroPw2?(dark?"rgba(110,231,183,.4)":"#a7f3d0"):t.inputBorder),fontSize:13,outline:"none",marginBottom:2}}/>
                  <div style={{minHeight:14,marginBottom:4}}>{heroPw2&&heroPw===heroPw2?<span style={{fontSize:11,color:dark?"#6ee7b7":"#059669"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><polyline points="20 6 9 17 4 12"/></svg> Passwords match</span>:heroPw2&&heroPw!==heroPw2?<span style={{fontSize:11,color:dark?"#fca5a5":"#dc2626"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Passwords don't match</span>:null}</div>
                  <label htmlFor="hero-signup-referral" className="text-t-text-soft" style={{fontSize:11,fontWeight:600,display:"block",marginBottom:3,textTransform:"uppercase",letterSpacing:1.5}}>Referral Code <span className="text-t-text-muted" style={{fontWeight:400}}>(optional)</span></label>
                  <input id="hero-signup-referral" name="referralCode" placeholder="e.g. NTR-7X92" value={heroRefCode} onChange={e=>setHeroRefCode(e.target.value.replace(/[^a-zA-Z0-9\-]/g,"").toUpperCase().slice(0,20))} className="text-t-text font-[inherit]" style={{width:"100%",padding:"9px 14px",borderRadius:10,background:t.inputBg,border:"1px solid "+t.inputBorder,fontSize:13,outline:"none",marginBottom:8}}/>
                  <label htmlFor="hero-signup-terms" style={{display:"flex",alignItems:"flex-start",gap:6,marginBottom:10,cursor:"pointer"}}><input id="hero-signup-terms" name="termsAccepted" type="checkbox" checked={heroAgree} onChange={e=>setHeroAgree(e.target.checked)} style={{marginTop:2,accentColor:t.accent,width:14,height:14,flexShrink:0}}/><span className="text-t-text-soft" style={{fontSize:11,lineHeight:1.4}}>I agree to the <a href="/terms" className="text-accent no-underline">Terms</a> and <a href="/privacy" className="text-accent no-underline">Privacy Policy</a></span></label>
                </>}
                {heroAuth==="login"&&<>
                  <label htmlFor="hero-login-email" className="text-t-text-soft" style={{fontSize:11,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Email Address</label>
                  <input id="hero-login-email" name="email" autoComplete="username" placeholder="you@example.com" value={heroEmail} onChange={e=>setHeroEmail(e.target.value.trim().toLowerCase().slice(0,254))} type="email" className="text-t-text font-[inherit]" style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:"1px solid "+t.inputBorder,fontSize:15,outline:"none",marginBottom:12}}/>
                  <label htmlFor="hero-login-password" className="text-t-text-soft" style={{fontSize:11,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Password</label>
                  <input id="hero-login-password" name="password" autoComplete="current-password" placeholder="Enter password" type="password" value={heroPw} onChange={e=>setHeroPw(e.target.value.slice(0,128))} className="text-t-text font-[inherit]" style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:"1px solid "+t.inputBorder,fontSize:15,outline:"none",marginBottom:14}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <label htmlFor="hero-login-remember" style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}><input id="hero-login-remember" name="remember" type="checkbox" checked={heroRemember} onChange={e=>setHeroRemember(e.target.checked)} style={{accentColor:t.accent,width:14,height:14}}/><span className="text-t-text-soft" style={{fontSize:13}}>Remember me</span></label>
                    <button type="button" onClick={()=>{setHeroAuth("forgot");setHeroError("")}} className="text-accent" style={{background:"none",fontSize:13,fontWeight:500}}>Forgot password?</button>
                  </div>
                </>}
                {heroAuth==="forgot"&&<>
                  <label htmlFor="hero-forgot-email" className="text-t-text-soft" style={{fontSize:11,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Email Address</label>
                  <input id="hero-forgot-email" name="email" autoComplete="email" placeholder="you@example.com" value={heroEmail} onChange={e=>setHeroEmail(e.target.value.trim().toLowerCase().slice(0,254))} type="email" className="text-t-text font-[inherit]" style={{width:"100%",padding:"11px 14px",borderRadius:12,background:t.inputBg,border:"1px solid "+t.inputBorder,fontSize:15,outline:"none",marginBottom:16}}/>
                </>}
                <button type="submit" disabled={heroLoading} className="w-full py-3.5 px-0 rounded-xl text-base font-semibold mb-3.5 flex items-center justify-center gap-2 transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]" style={{background:heroLoading?"#999":t.btnPrimary,color:"#fff",opacity:heroLoading?.7:1,boxShadow:heroLoading?"none":"0 4px 16px rgba(196,125,142,.38)"}}>{heroLoading&&<NitroLoader size={16} mono ariaHidden />}{heroAuth==="login"?(heroLoading?"Logging in...":"Log In"):heroAuth==="forgot"?(heroLoading?"Sending…":"Send Reset Link"):(heroSignupStep===2?(heroLoading?"Creating...":"Create Account"):(heroLoading?"Please wait...":"Continue →"))}</button>
                {heroAuth==="signup"&&heroSignupStep===2&&<button type="button" onClick={()=>{setHeroSignupStep(1);setHeroError("")}} className="w-full py-2 px-0 bg-transparent text-sm font-medium mb-2 text-t-text-soft">← Back to Step 1</button>}
                <div className="text-center text-[13px] text-t-text-muted">{heroAuth==="signup"&&heroSignupStep===1?"Takes 30 seconds. ":""}{heroAuth==="login"?"Don't have an account? ":heroAuth==="forgot"?"Remember your password? ":"Already have an account? "}<button type="button" onClick={()=>{setHeroAuth(heroAuth==="forgot"?"login":heroAuth==="login"?"signup":"login");setHeroSignupStep(1);setHeroError("")}} className="bg-transparent font-semibold text-[13px] text-accent">{heroAuth==="forgot"?"Log In":heroAuth==="login"?"Sign Up Free":"Log In"}</button></div>
                {heroError&&<InlineAlert type="error" dark={dark} className="mt-3">{heroError}</InlineAlert>}
                {heroSuccess&&<InlineAlert type="success" dark={dark} className="mt-3">{heroSuccess}</InlineAlert>}
              </form>
            </div>
          </div>
        </section>

        {/* Stats strip (desktop/tablet — the phone hero card already carries the stats) + platform marquee (all viewports) */}
        <div className="lv3-strip">
          <div className="max-md:hidden grid grid-cols-4 max-desktop:grid-cols-2" style={{background:dark?"#160f22":"#fff",borderBottom:`1px solid ${dark?"rgba(255,255,255,.09)":"rgba(0,0,0,.07)"}`}}>
            {[[siteStats.orders||"0","Orders placed",false],[siteStats.users||"0","Accounts created",false],...(siteStats.deliveryRate!=null?[[`${siteStats.deliveryRate}%`,"Delivery benchmark",false]]:[]),...(siteStats.processing!=null?[[siteStats.processing,"Delivering right now",true]]:[])].map(([v,l,g],i,arr)=>
              <div key={l} className="lv3-stat py-7 px-12 max-desktop:py-[22px] max-desktop:px-8" style={{borderRight:i<arr.length-1?`1px solid ${dark?"rgba(255,255,255,.09)":"rgba(0,0,0,.07)"}`:"none"}}>
                <div className="m text-[30px] font-bold -tracking-[1px] leading-none" style={{color:g?(dark?"#34d399":"#059669"):t.text}}><CountUp value={v}/></div>
                <div className="text-[10.5px] font-bold tracking-[2px] uppercase mt-2.5" style={{color:dark?"rgba(244,241,237,.36)":"rgba(28,27,25,.42)"}}>{l}</div>
              </div>
            )}
          </div>
          <div className="overflow-hidden py-3.5" style={{background:dark?"#050710":"#2a1a22"}}>
            <div className="lv3-mq">{[0,1].map(rep=><div key={rep} className="flex">{["Instagram","TikTok","YouTube","X / Twitter","WhatsApp","Spotify","Telegram","Facebook","Snapchat","Twitch","LinkedIn","Threads","Discord","Audiomack","Boomplay"].map((p,i)=><span key={p} className="text-xs font-extrabold tracking-[3px] uppercase px-[34px] whitespace-nowrap" style={{color:(i+1)%3===0?"#f2b866":"rgba(255,255,255,.78)"}}>{p}</span>)}</div>)}</div>
          </div>
        </div>
        </div>

        <BelowFold t={t} dark={dark} setModal={setModal} siteStats={siteStats} socialLinks={socialLinks} scrollRoot={scrollRef} pricingData={pricingData} />


      </div>

      {/* Side navigation indicator — desktop only */}
      <div className="side-nav">
        {sectionIds.map((id,i)=>(
          <button key={id} className={`side-nav-dot${activeSection===i?" side-nav-active":""}`} style={{background:activeSection===i?t.accent:t.textMuted}} onClick={()=>document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"})} title={id} aria-label={id}/>
        ))}
      </div>

      {modal&&<AuthModal key="auth-modal" elevated dark={dark} t={t} mode={modal} setMode={setModal} onClose={closeModal} prefill={heroSignupData} via={heroVia} referralCode={heroRefCode} resetToken={resetToken}/>}

      {/* Logout toast */}
      {/* Same proportions as the app's success toast: the tick sits in its own
          tinted badge, so the text is not pressed against the icon. */}
      {logoutMsg&&<div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] py-3.5 px-[18px] rounded-xl max-w-[calc(100%-32px)] w-auto flex items-center gap-3" style={{background:dark?"rgba(16,32,22,.95)":"rgba(236,253,245,.97)",border:`1px solid ${dark?"rgba(110,231,183,.35)":"rgba(5,150,105,.3)"}`,backdropFilter:"blur(20px)",boxShadow:dark?"0 12px 40px rgba(0,0,0,.5)":"0 12px 40px rgba(0,0,0,.19)",animation:"fu .4s ease"}}><span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{background:dark?"rgba(110,231,183,.13)":"rgba(5,150,105,.13)",color:dark?"#6ee7b7":"#059669"}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span><span className="text-sm md:text-[15px] font-semibold leading-snug text-t-text">You've been logged out successfully</span></div>}

      {googleError&&<div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] py-3 px-5 rounded-[14px] max-w-[calc(100%-32px)] w-auto flex items-center gap-2.5" style={{background:dark?"rgba(17,22,40,.97)":"rgba(255,255,255,.97)",border:`1px solid ${dark?"rgba(220,38,38,.28)":"rgba(220,38,38,.24)"}`,backdropFilter:"blur(16px)",boxShadow:dark?"0 12px 40px rgba(0,0,0,.5)":"0 12px 40px rgba(0,0,0,.19)",animation:"fu .4s ease"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark?"#fca5a5":"#dc2626"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span className="text-sm font-medium text-t-text">Google sign-in failed. Please try again or use email.</span></div>}

      {/* Floating WhatsApp button */}
      {socialLinks.social_whatsapp_support&&<a href={`https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" className="fixed bottom-6 right-6 max-md:bottom-5 max-md:right-4 z-[90] w-14 h-14 max-md:w-12 max-md:h-12 rounded-full flex items-center justify-center no-underline transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(37,211,102,.35)]" style={{background:"#25d366",boxShadow:"0 4px 16px rgba(37,211,102,.3)"}}><svg width="26" height="26" className="max-md:w-[22px] max-md:h-[22px]" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>}

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
          <button onClick={()=>setSessionExpired(false)} className="bg-transparent border-none text-base cursor-pointer p-0 leading-none shrink-0" style={{color:dark?"#8a8580":"#757170"}}>×</button>
        </div>
      </div>}

      
    </div>
  );
}

const Lbl=({t,children})=><label className="text-xs font-semibold block mb-[5px] uppercase tracking-[1.5px] text-t-text-soft">{children}</label>;

export default function LandingV3({ initialAuthQuery }) {
  return <ThemeProvider><LandingInner initialAuthQuery={initialAuthQuery} /></ThemeProvider>;
}
