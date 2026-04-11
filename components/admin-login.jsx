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
    cardBorder:dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.06)",
    inputBg:dark?"#0d1020":"#fff",inputBorder:dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.1)",
    accentLight:dark?"rgba(196,125,142,.12)":"rgba(196,125,142,.08)",
    btnPrimary:"linear-gradient(135deg,#c47d8e,#a3586b)",
    red:dark?"#fca5a5":"#dc2626",
  };

  const q=QUOTES[quoteIdx];

  const ThemeToggleBtn=()=>(
    <button onClick={toggleTheme} aria-label={dark?"Switch to light":"Switch to dark"} className="theme-toggle" style={{width:52,height:28,borderRadius:14,background:dark?"rgba(99,102,241,.25)":"rgba(255,255,255,.2)",position:"relative",transition:"background .8s ease",flexShrink:0,border:`1px solid ${dark?"rgba(99,102,241,.2)":"rgba(255,255,255,.25)"}`}}>
      <div style={{width:22,height:22,borderRadius:"50%",background:dark?"#1e1b4b":"#fff",position:"absolute",top:2,left:dark?27:3,transition:"left .8s cubic-bezier(.4,0,.2,1), background .8s ease, box-shadow .8s ease",boxShadow:dark?"0 0 8px rgba(99,102,241,.3)":"0 1px 6px rgba(0,0,0,.15)",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {dark?<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
        :<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>}
      </div>
    </button>
  );

  return (
    <div className="admin-root" style={{minHeight:"100dvh",display:"flex",flexDirection:"row",position:"relative",overflow:"hidden"}}>

      {/* ═══ LEFT PANEL — desktop & tablet ═══ */}
      <div className="admin-panel" style={{background:t.panelBg,position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"space-between",borderRight:`1px solid ${dark?"rgba(255,255,255,.06)":"rgba(255,255,255,.1)"}`}}>
        {/* Orbs + Grid pattern */}
        <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
          <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(${dark?"rgba(196,125,142,.03)":"rgba(255,255,255,.04)"} 1px, transparent 1px), linear-gradient(90deg, ${dark?"rgba(196,125,142,.03)":"rgba(255,255,255,.04)"} 1px, transparent 1px)`,backgroundSize:"40px 40px"}}/>
          <div style={{position:"absolute",top:"-15%",left:"-10%",width:300,height:300,borderRadius:"50%",background:dark?"rgba(196,125,142,.08)":"rgba(255,255,255,.06)",filter:"blur(80px)",animation:"float1 20s ease-in-out infinite"}}/>
          <div style={{position:"absolute",bottom:"-10%",right:"-15%",width:200,height:200,borderRadius:"50%",background:dark?"rgba(110,160,230,.05)":"rgba(255,255,255,.05)",filter:"blur(60px)",animation:"float2 25s ease-in-out infinite"}}/>
          {[["15%","70%",3,0],["40%","80%",4,1],["70%","20%",3,.5],["85%","60%",4,1.5]].map(([top,left,s,d],i)=><div key={i} style={{position:"absolute",top,left,width:s,height:s,borderRadius:"50%",background:dark?"rgba(196,125,142,.2)":"rgba(255,255,255,.2)",animation:`float3 ${3.5+i*.5}s ease-in-out infinite ${d}s`}}/>)}
        </div>

        {/* Top: Logo */}
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <div style={{width:28,height:28,borderRadius:7,background:"linear-gradient(135deg,#c47d8e,#8b5e6b)",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="12" height="12" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <span style={{fontSize:15,fontWeight:600,color:"#fff",letterSpacing:1.5}}>NITRO</span>
          </div>
          <div style={{fontSize:10,fontWeight:500,color:dark?"rgba(196,125,142,.5)":"rgba(255,255,255,.4)",letterSpacing:2,textTransform:"uppercase"}}>Command Center</div>
        </div>

        {/* Center: Quote */}
        <div style={{position:"relative",zIndex:1,flex:1,display:"flex",alignItems:"center"}}>
          <div key={quoteIdx} className="admin-quote">
            <div className="admin-quote-text" style={{color:"#fff"}}>"{q.text}"</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:24,height:1,background:t.accent}}/>
              <span style={{fontSize:14,fontWeight:500,color:dark?"rgba(196,125,142,.6)":"rgba(255,255,255,.6)"}}>{q.author}</span>
            </div>
          </div>
        </div>

        {/* Bottom: Dots + Stats */}
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",gap:6,marginBottom:20}}>
            {QUOTES.map((_,i)=><div key={i} className="admin-quote-dot" style={{width:quoteIdx===i?20:6,height:6,borderRadius:3,background:quoteIdx===i?t.accent:(dark?"rgba(255,255,255,.15)":"rgba(255,255,255,.2)")}}/>)}
          </div>
          <div className="admin-stats">
            <div><div className="m admin-stat-num" style={{color:"#fff"}}>2,400+</div><div className="admin-stat-label" style={{color:dark?"rgba(255,255,255,.35)":"rgba(255,255,255,.45)"}}>Users</div></div>
            <div><div className="m admin-stat-num" style={{color:"#fff"}}>18K+</div><div className="admin-stat-label" style={{color:dark?"rgba(255,255,255,.35)":"rgba(255,255,255,.45)"}}>Orders</div></div>
            <div><div className="m admin-stat-num" style={{color:"#fff"}}>99.9%</div><div className="admin-stat-label" style={{color:dark?"rgba(255,255,255,.35)":"rgba(255,255,255,.45)"}}>Uptime</div></div>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT SIDE — Login ═══ */}
      <div style={{flex:1,background:t.heroBg,position:"relative",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {/* Right-side orb */}
        <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
          <div style={{position:"absolute",top:"10%",right:"-5%",width:300,height:300,borderRadius:"50%",background:dark?"rgba(196,125,142,.04)":"rgba(255,255,255,.06)",filter:"blur(80px)",animation:"float2 22s ease-in-out infinite"}}/>
        </div>

        {/* Mobile: full nav */}
        <nav className="admin-nav-mobile" style={{display:"none",alignItems:"center",justifyContent:"space-between",height:52,flexShrink:0,zIndex:10,borderBottom:`1px solid ${dark?"rgba(255,255,255,.06)":"rgba(255,255,255,.12)"}`}}>
          <a href="/" style={{display:"flex",alignItems:"center",gap:10,textDecoration:"none"}}>
            <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#c47d8e,#8b5e6b)",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <span style={{fontSize:17,fontWeight:600,color:"#fff",letterSpacing:1.5}}>NITRO</span>
          </a>
          <ThemeToggleBtn/>
        </nav>

        {/* Desktop/Tablet: toggle top-right */}
        <div className="admin-toggle-row" style={{display:"flex",justifyContent:"flex-end",zIndex:10}}>
          <ThemeToggleBtn/>
        </div>

        {/* Card */}
        <div className="admin-center" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:1}}>
          <div className="admin-card fu" style={{width:"100%",background:t.cardBg,border:`1px solid ${t.cardBorder}`,borderRadius:20,backdropFilter:"blur(20px)",boxShadow:dark?"0 24px 64px rgba(0,0,0,0.5)":"0 24px 64px rgba(0,0,0,0.1)"}}>

            <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 14px",borderRadius:20,background:t.accentLight,border:`1px solid ${dark?"rgba(196,125,142,.15)":"rgba(196,125,142,.1)"}`}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span style={{fontSize:11,fontWeight:600,color:t.accent,letterSpacing:1}}>ADMIN</span>
              </div>
            </div>

            <h2 style={{fontSize:22,fontWeight:600,color:t.text,textAlign:"center",marginBottom:4}}>Command Center</h2>
            <p style={{fontSize:15,color:t.textSoft,textAlign:"center",marginBottom:24,fontWeight:450}}>Authorized operators only.</p>

            <div style={{minHeight:36,marginBottom:4,display:"flex",alignItems:"center"}}>{error?<div style={{width:"100%",padding:"8px 12px",borderRadius:8,background:dark?"rgba(220,38,38,0.1)":"#fef2f2",border:`1px solid ${dark?"rgba(220,38,38,0.2)":"#fecaca"}`,color:t.red,fontSize:13,lineHeight:1.2}}>⚠️ {error}</div>:null}</div>

            <label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Email Address</label>
            <input value={email} onChange={e=>{setEmail(e.target.value.trim().toLowerCase());setError("");}} placeholder="admin@nitro.ng" type="email" autoComplete="email" style={{width:"100%",padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:15,outline:"none",marginBottom:16,fontFamily:"inherit"}}/>

            <label style={{fontSize:11,fontWeight:600,color:t.textSoft,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Password</label>
            <div style={{position:"relative",marginBottom:16}}>
              <input value={pw} onChange={e=>{setPw(e.target.value);setError("");}} placeholder="Enter password" type={showPw?"text":"password"} onKeyDown={e=>{if(e.key==="Enter")handleLogin()}} style={{width:"100%",padding:"12px 44px 12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:15,outline:"none",fontFamily:"inherit"}}/>
              <button onClick={()=>setShowPw(!showPw)} type="button" style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",color:t.textMuted,padding:2}}>
                {showPw?<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                :<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
              </button>
            </div>

            <div style={{display:"flex",alignItems:"center",marginBottom:24}}>
              <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{accentColor:t.accent,width:14,height:14}}/><span style={{fontSize:13,color:t.textSoft}}>Remember me</span></label>
            </div>

            <button onClick={handleLogin} disabled={loading} style={{width:"100%",padding:"14px 0",borderRadius:12,background:loading?"#999":t.btnPrimary,color:"#fff",fontSize:16,fontWeight:600,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:loading?.7:1,border:"none",boxShadow:loading?"none":"0 6px 24px rgba(196,125,142,.35)",letterSpacing:.5}}>
              {loading&&<span style={{width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>}
              {loading?"Authenticating...":"Access Dashboard"}
            </button>

            <div style={{textAlign:"center",padding:"12px 0 0",borderTop:`1px solid ${t.cardBorder}`}}>
              <p style={{fontSize:12,color:t.textMuted,marginBottom:8}}>🔒 Access attempts are logged.</p>
              <a href="/" style={{fontSize:13,color:t.textSoft,textDecoration:"none"}}>← Back to Nitro</a>
            </div>
          </div>
        </div>
      </div>

      {/* Logout toast */}
      {logoutMsg&&<div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",zIndex:9999,padding:"12px 24px",borderRadius:14,background:dark?"rgba(17,22,40,.95)":"rgba(255,255,255,.95)",border:`1px solid ${dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.06)"}`,backdropFilter:"blur(16px)",boxShadow:dark?"0 8px 32px rgba(0,0,0,.4)":"0 8px 32px rgba(0,0,0,.1)",display:"flex",alignItems:"center",gap:10,animation:"fu .4s ease"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span style={{fontSize:14,fontWeight:500,color:t.text}}>You've been logged out successfully</span></div>}
    </div>
  );
}
