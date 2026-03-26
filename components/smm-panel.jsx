'use client';
import { useState, useEffect, useMemo } from "react";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
  { id: "new-order", label: "New Order", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
  { id: "orders", label: "Orders", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  { id: "add-funds", label: "Add Funds", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  { id: "services", label: "Services", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { id: "referrals", label: "Referrals", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
  { id: "support", label: "Support", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> },
  { id: "settings", label: "Settings", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg> },
];

const fN=(a)=>`₦${Math.abs(a/100).toLocaleString("en-NG")}`;
const fD=(d)=>new Date(d).toLocaleDateString("en-NG",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});

export default function SMMPanel(){
  const getAuto=()=>{const h=new Date().getHours(),m=new Date().getMinutes();if(h>=7&&h<18)return false;if(h>=19||h<6)return true;if(h===6)return m<30;if(h===18)return m>=30;return true;};
  const [dark,setDark]=useState(false);
  const [themeMode,setThemeMode]=useState("auto");
  const [active,setActive]=useState("overview");
  const [leftOpen,setLeftOpen]=useState(false);
  const [user,setUser]=useState(null);
  const [orders,setOrders]=useState([]);
  const [txs,setTxs]=useState([]);

  useEffect(()=>{const saved=localStorage.getItem("nitro-theme")||"auto";setThemeMode(saved);if(saved==="day")setDark(false);else if(saved==="night")setDark(true);else setDark(getAuto());},[]);
  useEffect(()=>{if(themeMode!=="auto")return;const iv=setInterval(()=>setDark(getAuto()),60000);return()=>clearInterval(iv);},[themeMode]);
  const toggleTheme=()=>{const next=!dark;setDark(next);const mode=next?"night":"day";setThemeMode(mode);localStorage.setItem("nitro-theme",mode);};

  useEffect(()=>{
    async function load(){
      try{
        const res=await fetch("/api/dashboard");
        if(res.status===401){window.location.href="/?login=1";return;}
        if(res.ok){const data=await res.json();setUser(data.user);if(data.orders?.length)setOrders(data.orders);if(data.transactions?.length)setTxs(data.transactions);}
        else setUser({name:"User",email:"",balance:0,refCode:"—",refs:0,earnings:0});
      }catch{setUser({name:"User",email:"",balance:0,refCode:"—",refs:0,earnings:0});}
    }
    load();
  },[]);

  const handleLogout=async()=>{try{await fetch("/api/auth/logout",{method:"POST"});}catch{}window.location.replace("/?logout=1");};

  const t=useMemo(()=>({
    bg:dark?"#080b14":"#f4f1ed",
    sidebarBg:dark?"#060810":"#eceae5",
    sidebarBorder:dark?"rgba(255,255,255,.06)":"rgba(0,0,0,.08)",
    cardBg:dark?"rgba(255,255,255,.03)":"rgba(255,255,255,.75)",
    cardBorder:dark?"rgba(255,255,255,.06)":"rgba(0,0,0,.08)",
    text:dark?"#eae7e2":"#1a1917",
    textSoft:dark?"#8a8680":"#666460",
    textMuted:dark?"#555250":"#8a8785",
    accent:"#c47d8e",
    navActive:dark?"rgba(196,125,142,.08)":"rgba(196,125,142,.08)",
    inputBg:dark?"#0d1020":"#fff",
    inputBorder:dark?"rgba(255,255,255,.08)":"rgba(0,0,0,.12)",
    green:dark?"#6ee7b7":"#059669",
    btnPrimary:"linear-gradient(135deg,#c47d8e,#a3586b)",
  }),[dark]);

  const initials=user?user.name.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2):"";
  const firstName=user?user.name.split(" ")[0]:"";
  const balance=user?fN(user.balance):"₦0";

  if(!user)return <div style={{height:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:t.bg}}><div style={{width:24,height:24,border:`2px solid ${dark?"rgba(196,125,142,.3)":"rgba(196,125,142,.2)"}`,borderTopColor:t.accent,borderRadius:"50%",animation:"spin .6s linear infinite"}}/></div>;

  return (
    <div className="dash-root" style={{height:"100dvh",display:"flex",flexDirection:"column",background:t.bg}}>

      {/* ═══ TOP NAV ═══ */}
      <nav className="dash-nav" style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,zIndex:20,background:t.sidebarBg,borderBottom:`1px solid ${t.sidebarBorder}`}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button className="dash-hamburger" onClick={()=>setLeftOpen(!leftOpen)} style={{background:"none",color:t.textSoft,display:"none",padding:4}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
          <a href="/" style={{display:"flex",alignItems:"center",gap:8,textDecoration:"none"}}>
            <div style={{width:26,height:26,borderRadius:7,background:"linear-gradient(135deg,#c47d8e,#8b5e6b)",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <span style={{fontSize:14,fontWeight:700,color:t.text,letterSpacing:1.5}}>NITRO</span>
          </a>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <button onClick={toggleTheme} style={{width:44,height:24,borderRadius:12,background:dark?"rgba(99,102,241,.25)":"rgba(0,0,0,.06)",position:"relative",border:`1px solid ${dark?"rgba(99,102,241,.2)":"rgba(0,0,0,.08)"}`}}>
            <div style={{width:18,height:18,borderRadius:"50%",background:dark?"#1e1b4b":"#fff",position:"absolute",top:2,left:dark?23:3,transition:"left .6s cubic-bezier(.4,0,.2,1)",boxShadow:dark?"0 0 6px rgba(99,102,241,.3)":"0 1px 4px rgba(0,0,0,.15)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {dark?<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              :<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="5"/></svg>}
            </div>
          </button>
          <button style={{background:"none",color:t.textSoft,display:"flex",position:"relative",padding:2}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            <div style={{position:"absolute",top:0,right:0,width:7,height:7,borderRadius:"50%",background:"#dc2626"}}/>
          </button>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:30,height:30,borderRadius:10,background:t.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff"}}>{initials}</div>
            <span className="dash-nav-name" style={{fontSize:13,fontWeight:550,color:t.text}}>{firstName}</span>
          </div>
        </div>
      </nav>

      {/* ═══ BODY ═══ */}
      <div style={{display:"flex",flex:1,position:"relative",overflow:"hidden"}}>

        {/* ── LEFT SIDEBAR ── */}
        <aside className="dash-left" style={{background:t.sidebarBg,borderRight:`1px solid ${t.sidebarBorder}`,display:"flex",flexDirection:"column",padding:"16px 12px",flexShrink:0,overflow:"auto"}}>
          {NAV_ITEMS.map(item=>(
            <button key={item.id} onClick={()=>{setActive(item.id);setLeftOpen(false);}} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:12,background:active===item.id?t.navActive:"transparent",color:active===item.id?t.accent:t.textSoft,fontSize:13,fontWeight:active===item.id?600:450,marginBottom:2,textAlign:"left",width:"100%"}}>
              <span style={{opacity:active===item.id?1:.6,flexShrink:0}}>{item.icon}</span>
              {item.label}
            </button>
          ))}
          <div style={{flex:1}}/>
          {/* Divider + Balance */}
          <div style={{height:1,background:t.sidebarBorder,margin:"8px 14px"}}/>
          <div style={{padding:"10px 14px",marginBottom:4}}>
            <div style={{fontSize:10,color:t.textMuted,textTransform:"uppercase",letterSpacing:1.5,marginBottom:4}}>Balance</div>
            <div className="m" style={{fontSize:18,fontWeight:700,color:t.green}}>{balance}</div>
          </div>
          <div style={{height:1,background:t.sidebarBorder,margin:"4px 14px 8px"}}/>
          {/* Logout */}
          <button onClick={handleLogout} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:12,background:"transparent",color:"#dc2626",fontSize:13,fontWeight:450,textAlign:"left",width:"100%",opacity:.7}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log Out
          </button>
        </aside>

        {/* ── Overlay ── */}
        {leftOpen&&<div className="dash-overlay" onClick={()=>setLeftOpen(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,.3)",zIndex:10}}/>}

        {/* ── MAIN CONTENT ── */}
        <main className="dash-main" style={{flex:1,overflow:"auto",background:t.bg}}>
          <div style={{fontSize:22,fontWeight:700,color:t.text,marginBottom:4}}>Welcome back, {firstName}</div>
          <div style={{fontSize:13,color:t.textMuted,marginBottom:24}}>Here's what's happening with your account.</div>

          <div className="dash-stats">
            {[["Wallet Balance",balance,t.green],["Total Orders",String(orders.length||0),"#a5b4fc"],["Pending",String(orders.filter(o=>o.status==="Pending"||o.status==="Processing").length||0),"#e0a458"]].map(([label,val,color])=>(
              <div key={label} style={{padding:20,borderRadius:16,background:t.cardBg,border:`1px solid ${t.cardBorder}`}}>
                <div style={{fontSize:12,color:t.textMuted,marginBottom:8}}>{label}</div>
                <div className="m" style={{fontSize:24,fontWeight:700,color}}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{padding:40,borderRadius:16,background:t.cardBg,border:`1px solid ${t.cardBorder}`,display:"flex",alignItems:"center",justifyContent:"center",minHeight:300}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:14,color:t.textMuted,marginBottom:8}}>{active.charAt(0).toUpperCase()+active.slice(1).replace("-"," ")} content goes here</div>
              <div style={{fontSize:12,color:t.textMuted,opacity:.5}}>This is the main content area</div>
            </div>
          </div>
        </main>

        {/* ── RIGHT SIDEBAR — Activity ── */}
        <aside className="dash-right" style={{background:t.sidebarBg,borderLeft:`1px solid ${t.sidebarBorder}`,padding:"20px 16px",flexShrink:0,overflow:"auto"}}>
          <div style={{fontSize:10,fontWeight:650,color:t.textMuted,textTransform:"uppercase",letterSpacing:1.5,marginBottom:12,paddingLeft:4}}>Recent Activity</div>
          {orders.length>0?orders.slice(0,8).map((o,i)=>(
            <div key={i} style={{padding:"10px 12px",borderRadius:10,background:t.cardBg,marginBottom:6}}>
              <div style={{fontSize:12,fontWeight:500,color:t.text,marginBottom:2}}>{o.serviceName||"Order #"+o.id}</div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:11,fontWeight:600,color:o.status==="Completed"?t.green:o.status==="Pending"?"#e0a458":"#a5b4fc"}}>{o.status}</span>
                <span style={{fontSize:10,color:t.textMuted}}>{o.createdAt?fD(o.createdAt):""}</span>
              </div>
            </div>
          )):(
            <>
              {[["No orders yet","Place your first order to see activity here"]].map(([title,desc])=>(
                <div key={title} style={{padding:"20px 14px",borderRadius:12,background:t.cardBg,border:`1px solid ${t.cardBorder}`,textAlign:"center"}}>
                  <div style={{fontSize:13,color:t.textSoft,marginBottom:4}}>{title}</div>
                  <div style={{fontSize:11,color:t.textMuted}}>{desc}</div>
                </div>
              ))}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
