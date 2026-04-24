'use client';
import { useState, useEffect } from "react";

const QUOTES = [
  { text: "Move fast. Break nothing. Ship everything.", author: "The Nitro Way" },
  { text: "Your users are sleeping. Their followers aren't.", author: "Dashboard Wisdom" },
  { text: "Every panel that matters was once just an idea.", author: "Builder's Creed" },
  { text: "Numbers don't lie. Neither does your uptime.", author: "Operator's Code" },
];

export default function AdminLogin(){
  const getAuto=()=>{const h=new Date().getHours(),m=new Date().getMinutes();if(h>=7&&h<18)return false;if(h>=19||h<6)return true;if(h===6)return m<30;if(h===18)return m>=30;return true;};
  const [dark,setDark]=useState(false);
  const [themeMode,setThemeMode]=useState("auto");
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [showPw,setShowPw]=useState(false);
  const [remember,setRemember]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [quoteIdx,setQuoteIdx]=useState(0);
  const [logoutMsg,setLogoutMsg]=useState(false);

  useEffect(()=>{const saved=(typeof window!=="undefined"?localStorage.getItem("nitro-theme"):null)||"auto";setThemeMode(saved);if(saved==="day")setDark(false);else if(saved==="night")setDark(true);else setDark(getAuto());},[]);
  useEffect(()=>{if(themeMode!=="auto")return;const iv=setInterval(()=>setDark(getAuto()),60000);return()=>clearInterval(iv);},[themeMode]);
  useEffect(()=>{const iv=setInterval(()=>setQuoteIdx(q=>(q+1)%QUOTES.length),6000);return()=>clearInterval(iv);},[]);
  useEffect(()=>{const p=new URLSearchParams(window.location.search);if(p.get("logout")){setLogoutMsg(true);window.history.replaceState({},"","/admin/login");setTimeout(()=>setLogoutMsg(false),4000);}},[]);
  const toggleTheme=()=>{const next=!dark;setDark(next);const mode=next?"night":"day";setThemeMode(mode);try{localStorage.setItem("nitro-theme",mode)}catch{};};

  const handleLogin=async()=>{
    setError("");
    if(!email||!pw){setError("Please fill in all fields");return;}
    setLoading(true);
    try{
      const res=await fetch("/api/auth/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password:pw})});
      const data=await res.json();
      if(!res.ok){setError(data.error||"Login failed");setLoading(false);return;}
      window.location.href="/admin";
    }catch{setError("Something went wrong.");setLoading(false);}
  };

  const t={
    heroBg:dark?"linear-gradient(145deg,#060810 0%,#0a0f1e 40%,#0d0a18 100%)":"linear-gradient(135deg,#c47d8e 0%,#a3586b 40%,#8b4a5e 100%)",
    panelBg:dark?"linear-gradient(160deg,#0a0816 0%,#12091e 50%,#0d0618 100%)":"linear-gradient(160deg,#b36b7d 0%,#9b5068 50%,#7d3e52 100%)",
    text:dark?"#eae7e2":"#1c1b19",textSoft:dark?"#8a8680":"#888580",textMuted:dark?"#555250":"#b0ada8",
    accent:"#c47d8e",
    cardBg:dark?"rgba(17,22,40,0.95)":"rgba(255,255,255,0.95)",
    cardBorder:dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.12)",
    inputBg:dark?"#0d1020":"#fff",inputBorder:dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.18)",
    accentLight:dark?"rgba(196,125,142,.12)":"rgba(196,125,142,.08)",
    btnPrimary:"linear-gradient(135deg,#c47d8e,#a3586b)",
    red:dark?"#fca5a5":"#dc2626",
  };

  const q=QUOTES[quoteIdx];

  const ThemeToggleBtn=()=>(
    <button onClick={toggleTheme} aria-label={dark?"Switch to light":"Switch to dark"} className="theme-toggle w-[52px] h-7 rounded-[14px] relative transition-[background] duration-[0.8s] ease shrink-0" style={{background:dark?"rgba(99,102,241,.31)":"rgba(255,255,255,.28)",border:`1px solid ${dark?"rgba(99,102,241,.28)":"rgba(255,255,255,.31)"}`}}>
      <div className="w-[22px] h-[22px] rounded-full absolute top-0.5 flex items-center justify-center" style={{background:dark?"#1e1b4b":"#fff",left:dark?27:3,transition:"left .8s cubic-bezier(.4,0,.2,1), background .8s ease, box-shadow .8s ease",boxShadow:dark?"0 0 8px rgba(99,102,241,.3)":"0 1px 6px rgba(0,0,0,.15)"}}>
        {dark?<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
        :<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
      </div>
    </button>
  );

  return (
    <div className="transition-[background,color] duration-[1.2s] ease min-h-dvh flex flex-row relative overflow-hidden">

      {/* ═══ LEFT PANEL — desktop & tablet ═══ */}
      <div className="w-[42%] max-lg:w-[38%] max-md:!hidden py-10 px-10 max-lg:py-8 max-lg:px-7 relative overflow-hidden flex flex-col justify-between" style={{background:t.panelBg,borderRight:`1px solid ${dark?"rgba(255,255,255,.12)":"rgba(255,255,255,.18)"}`}}>
        {/* Orbs + Grid pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-[length:40px_40px]" style={{backgroundImage:`linear-gradient(${dark?"rgba(196,125,142,.03)":"rgba(255,255,255,.04)"} 1px, transparent 1px), linear-gradient(90deg, ${dark?"rgba(196,125,142,.03)":"rgba(255,255,255,.04)"} 1px, transparent 1px)`}}/>
          <div className="absolute -top-[15%] -left-[10%] w-[300px] h-[300px] rounded-full blur-[80px] animate-[float1_20s_ease-in-out_infinite]" style={{background:dark?"rgba(196,125,142,.08)":"rgba(255,255,255,.06)"}}/>
          <div className="absolute -bottom-[10%] -right-[15%] w-[200px] h-[200px] rounded-full blur-[60px] animate-[float2_25s_ease-in-out_infinite]" style={{background:dark?"rgba(110,160,230,.05)":"rgba(255,255,255,.05)"}}/>
          {[["15%","70%",3,0],["40%","80%",4,1],["70%","20%",3,.5],["85%","60%",4,1.5]].map(([top,left,s,d],i)=><div key={i} className="absolute rounded-full" style={{top,left,width:s,height:s,background:dark?"rgba(196,125,142,.2)":"rgba(255,255,255,.2)",animation:`float3 ${3.5+i*.5}s ease-in-out infinite ${d}s`}}/>)}
        </div>

        {/* Top: Logo */}
        <div className="relative z-[1]">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-[7px] bg-[linear-gradient(135deg,#c47d8e,#8b5e6b)] flex items-center justify-center"><svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <span className="text-[15px] font-semibold text-white tracking-[1.5px]">NITRO</span>
          </div>
          <div className="text-[10px] font-medium tracking-[2px] uppercase" style={{color:dark?"rgba(196,125,142,.5)":"rgba(255,255,255,.4)"}}>Command Center</div>
        </div>

        {/* Center: Quote */}
        <div className="relative z-[1] flex-1 flex items-center">
          <div key={quoteIdx} className="animate-[fadeQuote_6s_ease-in-out]">
            <div className="text-[26px] max-lg:text-[22px] font-light leading-[1.4] mb-5 -tracking-[0.3px]" style={{color:"#fff"}}>"{q.text}"</div>
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-px" style={{background:t.accent}}/>
              <span className="text-sm font-medium" style={{color:dark?"rgba(196,125,142,.6)":"rgba(255,255,255,.6)"}}>{q.author}</span>
            </div>
          </div>
        </div>

        {/* Bottom: Dots + Stats */}
        <div className="relative z-[1]">
          <div className="flex gap-1.5 mb-5">
            {QUOTES.map((_,i)=><div key={i} className="transition-all duration-500 ease" style={{width:quoteIdx===i?20:6,height:6,borderRadius:3,background:quoteIdx===i?t.accent:(dark?"rgba(255,255,255,.15)":"rgba(255,255,255,.2)")}}/>)}
          </div>
          <div className="flex gap-8 max-lg:gap-6">
            <div><div className="m text-lg max-lg:text-base font-semibold" style={{color:"#fff"}}>2,400+</div><div className="text-[13px] mt-0.5" style={{color:dark?"rgba(255,255,255,.35)":"rgba(255,255,255,.45)"}}>Users</div></div>
            <div><div className="m text-lg max-lg:text-base font-semibold" style={{color:"#fff"}}>18K+</div><div className="text-[13px] mt-0.5" style={{color:dark?"rgba(255,255,255,.35)":"rgba(255,255,255,.45)"}}>Orders</div></div>
            <div><div className="m text-lg max-lg:text-base font-semibold" style={{color:"#fff"}}>99.9%</div><div className="text-[13px] mt-0.5" style={{color:dark?"rgba(255,255,255,.35)":"rgba(255,255,255,.45)"}}>Uptime</div></div>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT SIDE — Login ═══ */}
      <div className="flex-1 relative overflow-hidden flex flex-col" style={{background:t.heroBg}}>
        {/* Right-side orb */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[10%] -right-[5%] w-[300px] h-[300px] rounded-full blur-[80px] animate-[float2_22s_ease-in-out_infinite]" style={{background:dark?"rgba(196,125,142,.04)":"rgba(255,255,255,.06)"}}/>
        </div>

        {/* Mobile: full nav */}
        <nav className="hidden max-md:!flex items-center justify-between h-[52px] shrink-0 z-10 px-5" style={{borderBottom:`1px solid ${dark?"rgba(255,255,255,.12)":"rgba(255,255,255,.19)"}`}}>
          <a href="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-[30px] h-[30px] rounded-lg bg-[linear-gradient(135deg,#c47d8e,#8b5e6b)] flex items-center justify-center"><svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <span className="text-[17px] font-semibold text-white tracking-[1.5px]">NITRO</span>
          </a>
          <ThemeToggleBtn/>
        </nav>

        {/* Desktop/Tablet: toggle top-right */}
        <div className="flex justify-end z-10 py-4 px-6 max-lg:py-3.5 max-lg:px-5 max-md:!hidden">
          <ThemeToggleBtn/>
        </div>

        {/* Card */}
        <div className="admin-center flex-1 flex items-center justify-center relative z-[1]">
          <div className="fu w-full max-w-[400px] max-lg:max-w-[380px] max-md:max-w-full py-9 px-8 max-lg:py-8 max-lg:px-7 max-md:py-7 max-md:px-[22px] rounded-[20px] max-md:rounded-[18px] backdrop-blur-[20px] [&_input]:transition-[border-color] [&_input]:duration-200 [&_input:focus]:!border-accent" style={{background:t.cardBg,border:`1px solid ${t.cardBorder}`,boxShadow:dark?"0 24px 64px rgba(0,0,0,0.5)":"0 24px 64px rgba(0,0,0,.18)"}}>

            <div className="flex justify-center mb-5">
              <div className="inline-flex items-center gap-1.5 py-1 px-3.5 rounded-[20px]" style={{background:t.accentLight,border:`1px solid ${dark?"rgba(196,125,142,.24)":"rgba(196,125,142,.18)"}`}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span className="text-[11px] font-semibold tracking-[1px]" style={{color:t.accent}}>ADMIN</span>
              </div>
            </div>

            <h2 className="text-[22px] font-semibold text-center mb-1" style={{color:t.text}}>Command Center</h2>
            <p className="text-[15px] text-center mb-6 font-medium" style={{color:t.textSoft}}>Authorized operators only.</p>

            <div className="min-h-9 mb-1 flex items-center">{error?<div className="w-full py-2 px-3 rounded-lg text-[13px] leading-[1.2]" style={{background:dark?"rgba(220,38,38,.18)":"#fef2f2",border:`1px solid ${dark?"rgba(220,38,38,.28)":"#fecaca"}`,color:t.red}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> {error}</div>:null}</div>

            <label className="block text-[11px] font-semibold mb-[5px] uppercase tracking-[1.5px]" style={{color:t.textSoft}}>Email Address</label>
            <input value={email} onChange={e=>{setEmail(e.target.value.trim().toLowerCase());setError("");}} placeholder="admin@nitro.ng" type="email" autoComplete="email" className="w-full py-3 px-3.5 rounded-xl text-[15px] outline-none mb-4 font-[inherit]" style={{background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text}}/>

            <label className="block text-[11px] font-semibold mb-[5px] uppercase tracking-[1.5px]" style={{color:t.textSoft}}>Password</label>
            <div className="relative mb-4">
              <input value={pw} onChange={e=>{setPw(e.target.value);setError("");}} placeholder="Enter password" type={showPw?"text":"password"} onKeyDown={e=>{if(e.key==="Enter")handleLogin()}} className="w-full py-3 pr-11 pl-3.5 rounded-xl text-[15px] outline-none font-[inherit]" style={{background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text}}/>
              <button onClick={()=>setShowPw(!showPw)} type="button" className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent p-0.5" style={{color:t.textMuted}}>
                {showPw?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                :<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>

            <div className="flex items-center mb-6">
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} className="w-3.5 h-3.5" style={{accentColor:t.accent}}/><span className="text-[13px]" style={{color:t.textSoft}}>Remember me</span></label>
            </div>

            <button onClick={handleLogin} disabled={loading} className="w-full py-3.5 rounded-xl text-white text-base font-semibold mb-4 flex items-center justify-center gap-2 border-none tracking-[0.5px]" style={{background:loading?"#999":t.btnPrimary,opacity:loading?.7:1,boxShadow:loading?"none":"0 6px 24px rgba(196,125,142,.35)"}}>
              {loading&&<span className="w-4 h-4 rounded-full animate-[spin_0.6s_linear_infinite]" style={{border:"2px solid rgba(255,255,255,.38)",borderTopColor:"#fff"}}/>}
              {loading?"Authenticating...":"Access Dashboard"}
            </button>

            <div className="text-center pt-3" style={{borderTop:`1px solid ${t.cardBorder}`}}>
              <p className="text-xs mb-2" style={{color:t.textMuted}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:"inline",verticalAlign:"middle"}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Access attempts are logged.</p>
              <a href="/" className="text-[13px] no-underline" style={{color:t.textSoft}}>← Back to Nitro</a>
            </div>
          </div>
        </div>
      </div>

      {/* Logout toast */}
      {logoutMsg&&<div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] py-3 px-6 rounded-[14px] backdrop-blur-[16px] flex items-center gap-2.5 animate-[fu_0.4s_ease]" style={{background:dark?"rgba(17,22,40,.95)":"rgba(255,255,255,.95)",border:`1px solid ${dark?"rgba(255,255,255,.14)":"rgba(0,0,0,.12)"}`,boxShadow:dark?"0 8px 32px rgba(0,0,0,.4)":"0 8px 32px rgba(0,0,0,.18)"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span className="text-sm font-medium" style={{color:t.text}}>You've been logged out successfully</span></div>}
    </div>
  );
}
