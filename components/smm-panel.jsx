'use client';
import NitroLogo from './nitro-logo';
import { useState, useEffect, useRef } from "react";

const GATEWAYS = [
  {id:"paystack",name:"Paystack",enabled:true},
  {id:"flutterwave",name:"Flutterwave",enabled:true},
  {id:"monnify",name:"Monnify",enabled:true},
  {id:"korapay",name:"Korapay",enabled:false},
];
const fN = (a) => `₦${Math.abs(a).toLocaleString("en-NG")}`;
const fNc = (a) => {const v=Math.abs(a);if(v>=1e9)return `₦${(v/1e9).toFixed(1)}B`;if(v>=1e6)return `₦${(v/1e6).toFixed(1)}M`;if(v>=1e5)return `₦${Math.round(v/1e3)}K`;return `₦${v.toLocaleString("en-NG")}`;};
const fD = (d) => new Date(d).toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const stColors = (dark) => ({Completed:dark?["#0a2416","#6ee7b7","#166534"]:["#ecfdf5","#059669","#a7f3d0"],Processing:dark?["#0f1629","#a5b4fc","#3730a3"]:["#eef2ff","#4f46e5","#c7d2fe"],Pending:dark?["#1c1608","#fcd34d","#92400e"]:["#fffbeb","#d97706","#fde68a"],Partial:dark?["#1f0a0a","#fca5a5","#991b1b"]:["#fef2f2","#dc2626","#fecaca"],Canceled:dark?["#141414","#a3a3a3","#404040"]:["#f5f5f5","#737373","#d4d4d4"]});
const Badge = ({ s, dark }) => { const v = stColors(dark)[s]||stColors(dark).Canceled; return <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 6, background: v[0], color: v[1], border: `0.5px solid ${v[2]}`, whiteSpace: "nowrap" }}>{s}</span>; };
const Card = ({ children, style, d = 0, dark }) => <div style={{background: dark ? "rgba(15,18,30,0.92)" : "#fff",border: `0.5px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"}`,borderRadius: 14, padding: 20, animation: `fu 0.5s ease ${d}s both`,transition: "background 1.5s cubic-bezier(.4,0,.2,1), border-color 1.5s ease",...style}}>{children}</div>;

function Pagination({total,page,setPage,perPage,setPerPage,t}){
  const totalPages=Math.ceil(total/perPage);
  if(total<=5)return null;
  return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16,flexWrap:"wrap",gap:10}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:12,color:t.textMuted}}>Show</span>
      <select value={perPage} onChange={e=>{setPerPage(Number(e.target.value));setPage(1);}} style={{padding:"4px 8px",borderRadius:6,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:12,outline:"none"}}>{[5,10,20,50].map(n=><option key={n} value={n}>{n}</option>)}</select>
      <span style={{fontSize:12,color:t.textMuted}}>of {total}</span>
    </div>
    {totalPages>1&&<div style={{display:"flex",gap:4}}>{Array.from({length:Math.min(totalPages,7)},(_,i)=>{let p;if(totalPages<=7)p=i+1;else if(page<=4)p=i+1;else if(page>=totalPages-3)p=totalPages-6+i;else p=page-3+i;return <button key={p} onClick={()=>setPage(p)} style={{width:30,height:30,borderRadius:6,fontSize:11,fontWeight:600,background:page===p?t.accentLight:"transparent",color:page===p?t.accent:t.textMuted,border:`1px solid ${page===p?"transparent":t.btnSecBorder}`,boxShadow:page===p?t.accentShadow:"none"}}>{p}</button>})}</div>}
    <div style={{display:"flex",gap:6}}><button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:500,background:t.btnSecondary,color:page===1?t.textMuted:t.textSoft,border:`1px solid ${t.btnSecBorder}`,opacity:page===1?.5:1}}>← Prev</button><button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages} style={{padding:"5px 12px",borderRadius:6,fontSize:11,fontWeight:500,background:t.btnSecondary,color:page>=totalPages?t.textMuted:t.textSoft,border:`1px solid ${t.btnSecBorder}`,opacity:page>=totalPages?.5:1}}>Next →</button></div>
  </div>;
}

function ThemeToggle({ dark, onToggle, compact }) {
  return <button onClick={onToggle} style={{display:"flex",alignItems:"center",background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)",borderRadius:20,padding:3,width:compact?52:64,height:compact?28:32,border:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)"}`,position:"relative",flexShrink:0,transition:"background 1.5s cubic-bezier(.4,0,.2,1), border-color 1.5s ease"}} title={dark?"Switch to day":"Switch to night"}>
    <div style={{width:compact?22:26,height:compact?22:26,borderRadius:"50%",background:dark?"#c47d8e":"#e0a458",display:"flex",alignItems:"center",justifyContent:"center",fontSize:compact?12:14,position:"absolute",left:dark?3:(compact?27:35),transition:"left 0.4s cubic-bezier(.4,0,.2,1), background 1.5s cubic-bezier(.4,0,.2,1)",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}>{dark?"🌙":"☀️"}</div>
  </button>;
}

// Reusable loading button — disables + shows spinner while loading
function LoadBtn({children,onClick,primary,disabled,style:s,t}){
  const [loading,setLoading]=useState(false);
  const handleClick=async()=>{if(loading||disabled)return;setLoading(true);try{await onClick();}catch(e){}finally{setTimeout(()=>setLoading(false),600);}};
  return <button onClick={handleClick} disabled={loading||disabled} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:(loading||disabled)?0.6:1,...s}}>
    {loading&&<span style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:primary?"#fff":"currentColor",borderRadius:"50%",animation:"spin .6s linear infinite",flexShrink:0}}/>}
    {loading?"Processing...":children}
  </button>;
}

// Error boundary wrapper — renders children safely
import { ErrorBoundary } from './error-boundary';
// In production Next.js, this catches render crashes gracefully

export default function App() {
  const [pg, setPg] = useState("dashboard");
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [txs, setTxs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [services, setServices] = useState([]);
  const [sb, setSb] = useState(false);
  const [toast, setToast] = useState(null);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const getAutoTheme = () => {const h=new Date().getHours(),m=new Date().getMinutes();if(h>=7&&h<18)return false;if(h>=19||h<6)return true;if(h===6)return m<30;if(h===18)return m>=30;return true;};
  const [dark, setDark] = useState(getAutoTheme);
  const [manualOverride, setManualOverride] = useState(false);
  useEffect(() => {if(manualOverride)return;const iv=setInterval(()=>setDark(getAutoTheme()),60000);return()=>clearInterval(iv);},[manualOverride]);

  // Fetch real dashboard data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dashboard');
        if (res.status === 401) { window.location.href = '/?login=1'; return; }
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          if (data.orders?.length) setOrders(data.orders);
          if (data.transactions?.length) setTxs(data.transactions);
          if (data.alerts?.length) setAlerts(data.alerts);
        } else {
          console.error('Dashboard API error:', res.status);
          setUser({ name: "User", email: "", balance: 0, refCode: "—", refs: 0, earnings: 0 });
        }
      } catch (err) {
        console.error('Dashboard fetch failed:', err);
        setUser({ name: "User", email: "", balance: 0, refCode: "—", refs: 0, earnings: 0 });
      }
      // Fetch services
      try {
        const sRes = await fetch('/api/services');
        if (sRes.ok) { const sData = await sRes.json(); if (sData.services?.length) setServices(sData.services); }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);
  const reloadDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        if (data.orders) setOrders(data.orders);
        if (data.transactions) setTxs(data.transactions);
      }
    } catch {}
  };
  const toggleTheme = () => {setManualOverride(true);setDark(d=>!d);};
  const toastTimer = useRef(null);
  const notify = (m, e) => { setToast({ m, e }); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 6000); };
  const dismissToast = () => { setToast(null); if (toastTimer.current) clearTimeout(toastTimer.current); };
  const go = (p) => { setPg(p); };
  const placeOrder = async (svc, link, qty) => {
    try {
      const res = await fetch('/api/orders', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({serviceId:svc.id,link,quantity:qty})});
      const data = await res.json();
      if (!res.ok) { notify(data.error || 'Order failed', true); return; }
      notify(`Order ${data.order.id} placed!`);
      await reloadDashboard();
      go('orders');
    } catch { notify('Failed to place order', true); }
  };
  const addFunds = (a) => { reloadDashboard(); notify(`₦${Number(a).toLocaleString()} added to wallet!`); };

  const handleLogout=async()=>{try{await fetch("/api/auth/logout",{method:"POST"});}catch{}window.location.href="/";};
  const NAV = [["dashboard","🏠","Dashboard"],["new-order","🛒","New Order"],["orders","📋","Orders"],["funds","💳","Add Funds"],["services","📦","Services"],["referrals","🔗","Referrals"],["support","💬","Support"],["settings","⚙️","Settings"]];
  const t={bg:dark?"#080b14":"#f4f1ed",text:dark?"#e8e4df":"#1a1a1a",textSoft:dark?"#8a8680":"#888580",textMuted:dark?"#555250":"#b0ada8",surface:dark?"rgba(15,18,30,0.97)":"rgba(255,255,255,0.97)",surfaceBorder:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.08)",cardBg:dark?"rgba(15,18,30,0.85)":"rgba(255,255,255,0.9)",inputBg:dark?"#0d1020":"#fff",inputBorder:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)",accent:"#c47d8e",accentLight:dark?"rgba(196,125,142,0.12)":"rgba(196,125,142,0.08)",accentBorder:dark?"rgba(196,125,142,0.3)":"rgba(196,125,142,0.25)",accentShadow:dark?"inset 0 0 0 1px rgba(196,125,142,0.35)":"inset 0 0 0 1px rgba(196,125,142,0.3)",green:dark?"#6ee7b7":"#059669",red:dark?"#fca5a5":"#dc2626",balGrad:dark?"linear-gradient(135deg, #0d1a2e, #161028)":"linear-gradient(135deg, #f9f5f1, #f0e8e2)",balBorder:dark?"rgba(196,125,142,0.2)":"rgba(196,125,142,0.15)",btnPrimary:"linear-gradient(135deg, #c47d8e, #a3586b)",btnSecondary:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)",btnSecBorder:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",gradBg:dark?"radial-gradient(ellipse at 20% 0%, rgba(196,125,142,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(100,120,180,0.04) 0%, transparent 50%)":"radial-gradient(ellipse at 20% 0%, rgba(196,125,142,0.05) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(180,160,140,0.04) 0%, transparent 50%)",logoGrad:"linear-gradient(135deg, #c47d8e, #8b5e6b)"};

  if (loading || !user) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:dark?"#080b14":"#f4f1ed"}}>
      <div style={{textAlign:"center"}}>
        <div style={{marginBottom:16,animation:"pulse 1.5s ease infinite"}}><NitroLogo size={48} variant="mark"/></div>
        <div style={{fontSize:14,color:dark?"#8a8680":"#888580"}}>Loading your dashboard...</div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
    </div>
  );

  return (
    <div className="root">
      
      <style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}.root{min-height:100vh;background:${t.bg};color:${t.text};font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;transition:background 1.5s cubic-bezier(.4,0,.2,1),color 1.2s ease}input,select,textarea{font-family:inherit}button{cursor:pointer;font-family:inherit;border:none}.m{font-family:'JetBrains Mono',monospace}@keyframes si{from{transform:translateX(80px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes fu{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${dark?"#2a2a2a":"#ccc"};border-radius:3px}.sg{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.g2{display:grid;grid-template-columns:1.5fr 1fr;gap:16px}.og{display:grid;grid-template-columns:1fr 320px;gap:16px}.fg{display:grid;grid-template-columns:1fr 1fr;gap:16px}.rg{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.spg{display:grid;grid-template-columns:1fr 1fr;gap:16px}.layout{display:flex;min-height:100vh}.sb{width:200px;background:${t.surface};border-right:0.5px solid ${t.surfaceBorder};display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100;transition:background 1.5s cubic-bezier(.4,0,.2,1),border-color 1.5s ease;overflow:visible}.mn{margin-left:200px;padding:28px 32px;min-height:100vh;flex:1;position:relative;z-index:1}.ov{display:none}.mh{display:none}.sb-close{display:none}.oth,.otr{display:grid;grid-template-columns:110px 1.5fr 1fr 90px 110px 90px 100px;padding:14px 20px;align-items:center}.ocm{display:none}.sth,.str{display:grid;grid-template-columns:40px 1.5fr 100px 80px 80px 70px 70px;padding:10px 16px;align-items:center}.scm{display:none}.pf-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}@media(max-width:1024px){.sg{grid-template-columns:repeat(2,1fr)}.g2,.og,.fg,.spg{grid-template-columns:1fr}.rg{grid-template-columns:repeat(2,1fr)}.mn{padding:24px 20px}}@media(max-width:768px){.sb{transform:translateX(-100%);width:260px}.sb.open{transform:translateX(0)}.ov{display:block;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:90}.mh{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:${t.surface};border-bottom:0.5px solid ${t.surfaceBorder};position:sticky;top:0;z-index:80}.mn{margin-left:0;padding:16px}.sg{grid-template-columns:repeat(2,1fr);gap:10px}.rg{grid-template-columns:1fr}.oth,.otr{display:none}.ocm{display:block}.sth,.str{display:none}.scm{display:block}.sb-close{display:flex}}@media(max-width:400px){.sg{grid-template-columns:1fr}.mn{padding:12px}}`}</style>
      <div style={{position:"fixed",inset:0,background:t.gradBg,pointerEvents:"none",zIndex:0}}/>
      {toast&&<div style={{position:"fixed",top:16,right:16,left:16,zIndex:200,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px 16px 12px 20px",borderRadius:14,background:toast.e?(dark?"#3b1111":"#fef2f2"):(dark?"#0a2416":"#ecfdf5"),border:`1px solid ${toast.e?(dark?"#7f1d1d":"#fecaca"):(dark?"#166534":"#a7f3d0")}`,color:toast.e?t.red:t.green,fontSize:14,fontWeight:500,animation:"si .3s ease",maxWidth:420,marginLeft:"auto",backdropFilter:"blur(12px)"}}><span>{toast.e?"⚠️":"✓"} {toast.m}</span><button onClick={dismissToast} style={{background:"none",color:t.textMuted,fontSize:18,padding:"2px 4px",lineHeight:1,flexShrink:0}}>✕</button></div>}
      <div className="mh"><button onClick={()=>setSb(true)} style={{background:"none",color:t.text,fontSize:22,padding:4}}>☰</button><button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} style={{display:"flex",alignItems:"center",gap:8,background:"none",padding:0,border:"none",outline:"none",cursor:"pointer"}}><NitroLogo size={28} variant="mark"/><span style={{fontSize:16,fontWeight:700,color:t.text,letterSpacing:1}}>NITRO</span></button><div style={{display:"flex",alignItems:"center",gap:8}}><span className="m" style={{fontSize:12,fontWeight:600,color:t.green}}>{fNc(user.balance)}</span><button onClick={handleLogout} title="Log out" style={{width:28,height:28,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",background:"none",border:`1px solid ${t.btnSecBorder}`,color:t.red,cursor:"pointer"}}><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button></div></div>
      {sb&&<div className="ov" onClick={()=>setSb(false)}/>}
      <aside className={`sb${sb?" open":""}`}>
        <div style={{padding:"16px 14px",borderBottom:`0.5px solid ${t.surfaceBorder}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} style={{display:"flex",alignItems:"center",gap:8,background:"none",padding:0,border:"none",outline:"none",cursor:"pointer"}}><NitroLogo size={32} variant="mark"/><div style={{display:"flex",alignItems:"baseline",gap:4}}><span style={{fontSize:17,fontWeight:700,color:t.text,letterSpacing:1}}>NITRO</span><span style={{fontSize:10,fontWeight:600,color:t.textMuted}}>NG</span></div></button>
          <button className="sb-close" onClick={()=>setSb(false)} style={{background:"none",color:t.textMuted,fontSize:18,padding:4,alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{padding:"10px 14px",borderBottom:`0.5px solid ${t.surfaceBorder}`}}><div style={{fontSize:9,color:t.textMuted,fontWeight:500,textTransform:"uppercase",letterSpacing:2}}>Balance</div><div className="m" style={{fontSize:17,fontWeight:600,color:t.green,marginTop:2}}>{fNc(user.balance)}</div></div>
        <nav style={{flex:1,paddingTop:6,paddingBottom:6,paddingLeft:8,paddingRight:0,display:"flex",flexDirection:"column",gap:1,overflow:"visible"}}>{NAV.map(([id,ic,lb])=>{const act=pg===id;return <button key={id} onClick={()=>go(id)} title={lb} style={{display:"flex",alignItems:"center",gap:10,paddingTop:8,paddingBottom:8,paddingRight:act?0:12,paddingLeft:act?9:12,width:"100%",textAlign:"left",fontSize:13,fontWeight:act?600:400,overflow:"visible",border:"none",background:act?"linear-gradient(135deg, #c47d8e, #a3586b)":"transparent",color:act?"#fff":t.textSoft,borderLeft:act?"3px solid #8b4a5e":"3px solid transparent",borderRadius:act?"0 10px 10px 0":"0 8px 8px 0",marginRight:act?-8:8,position:act?"relative":"static",zIndex:act?3:"auto"}}><span style={{fontSize:15,width:18,textAlign:"center"}}>{ic}</span>{lb}</button>})}</nav>
        <div style={{padding:"10px 14px",borderTop:`0.5px solid ${t.surfaceBorder}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
          <span style={{fontSize:11,color:t.textMuted}}>{dark?"Night":"Day"} mode</span>
          <div style={{display:"flex",alignItems:"center",gap:6}}><ThemeToggle dark={dark} onToggle={toggleTheme} compact/><button onClick={handleLogout} title="Log out" style={{width:26,height:26,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",background:"none",border:`0.5px solid ${t.btnSecBorder}`,color:t.red,cursor:"pointer",flexShrink:0}}><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button></div>
        </div>
        <div style={{padding:"10px 14px",borderTop:`0.5px solid ${t.surfaceBorder}`,display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:26,height:26,borderRadius:"50%",background:t.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",flexShrink:0}}>{user.name[0]}</div>
          <div style={{minWidth:0,flex:1}}><div style={{fontSize:11,fontWeight:600,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div><div style={{fontSize:10,color:t.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div></div>
        </div>
      </aside>
      <main className="mn">
        <div style={{position:"sticky",top:0,zIndex:40,paddingBottom:alerts.filter(a=>!dismissedAlerts.includes(a.id)).length?4:0}}>
        {alerts.filter(a=>!dismissedAlerts.includes(a.id)).map(a=><div key={a.id} style={{padding:"12px 16px",marginBottom:10,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,fontSize:13,fontWeight:500,animation:"fu .3s ease",background:a.type==="warning"?(dark?"rgba(217,119,6,0.1)":"#fffbeb"):a.type==="critical"?(dark?"rgba(220,38,38,0.1)":"#fef2f2"):(dark?"rgba(99,102,241,0.1)":"#eef2ff"),color:a.type==="warning"?(dark?"#fcd34d":"#92400e"):a.type==="critical"?(dark?"#fca5a5":"#dc2626"):(dark?"#a5b4fc":"#4f46e5"),border:`1px solid ${a.type==="warning"?(dark?"rgba(217,119,6,0.2)":"#fde68a"):a.type==="critical"?(dark?"rgba(220,38,38,0.2)":"#fecaca"):(dark?"rgba(99,102,241,0.2)":"#c7d2fe")}`,backdropFilter:"blur(12px)"}}><span>{a.type==="warning"?"⚠️":a.type==="critical"?"🚨":"ℹ️"} {a.message}</span><button onClick={()=>setDismissedAlerts(p=>[...p,a.id])} style={{background:"none",color:"inherit",fontSize:16,padding:2,flexShrink:0,opacity:0.6}}>✕</button></div>)}
        </div>
        <ErrorBoundary t={t} key={pg}>
        <div style={{maxWidth:720}}>
        {pg==="dashboard"&&<Dash user={user} orders={orders} txs={txs} go={go} t={t} dark={dark}/>}
        {pg==="new-order"&&<NewOrd services={services} onPlace={placeOrder} bal={user.balance} t={t} dark={dark}/>}
        {pg==="orders"&&<Ords orders={orders} t={t} dark={dark}/>}
        {pg==="funds"&&<Fnds onAdd={addFunds} bal={user.balance} txs={txs} t={t} dark={dark}/>}
        {pg==="referrals"&&<Refs user={user} t={t} dark={dark}/>}
        {pg==="services"&&<Svcs services={services} go={go} t={t} dark={dark}/>}
        {pg==="support"&&<Sup t={t} dark={dark}/>}
        {pg==="settings"&&<Settings user={user} t={t} dark={dark} toggleTheme={toggleTheme} manualOverride={manualOverride}/>}
        </div>
        </ErrorBoundary>
        <footer style={{borderTop:`1px solid ${t.surfaceBorder}`,marginTop:40,padding:"24px 0 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
            <div style={{fontSize:12,color:t.textMuted}}>© 2026 Nitro. All rights reserved.</div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
              <div style={{display:"flex",gap:16}}>{[["X (Twitter)","https://x.com/TheNitroNG"],["Instagram","https://instagram.com/TheNitroNg"]].map(([s,url])=><a key={s} href={url} target="_blank" rel="noopener" style={{fontSize:12,color:t.textSoft,textDecoration:"none"}}>{s}</a>)}</div>
              <div style={{display:"flex",gap:16}}>{[["Terms","/terms"],["Privacy","/privacy"],["Refund","/refund"],["Cookie","/cookie"]].map(([l,h])=><a key={l} href={h} style={{fontSize:11,color:t.textMuted,textDecoration:"none"}}>{l}</a>)}</div>
            </div>
          </div>
        </footer>
      </main>
      
    </div>
  );
}

const Hdr=({title,sub,action,t})=><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,animation:"fu .4s ease",flexWrap:"wrap",gap:12}}><div><h1 style={{fontSize:22,fontWeight:600,color:t.text,letterSpacing:"-0.2px"}}>{title}</h1>{sub&&<p style={{fontSize:13,color:t.textSoft,marginTop:4}}>{sub}</p>}</div>{action}</div>;
const Stat=({l,v,c,d=0,t,dark})=><div style={{background:dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)",borderRadius:10,padding:16,animation:`fu 0.5s ease ${d}s both`}}><div style={{fontSize:11,color:t.textMuted,fontWeight:500,textTransform:"uppercase",letterSpacing:1.5}}>{l}</div><div className="m" style={{fontSize:20,fontWeight:600,color:c||t.text,marginTop:6}}>{v}</div></div>;

function Dash({user,orders,txs,go,t,dark}){
  const spent=orders.reduce((a,o)=>a+o.charge,0);const act=orders.filter(o=>["Processing","Pending"].includes(o.status)).length;
  return <div><Hdr title="Dashboard" sub="Welcome back — here's your overview" t={t}/><div className="sg" style={{marginBottom:24}}><Stat l="Wallet" v={fN(user.balance)} c={t.green} t={t} dark={dark}/><Stat l="Total Orders" v={orders.length} c={t.accent} d={.05} t={t} dark={dark}/><Stat l="Active" v={act} c="#e0a458" d={.1} t={t} dark={dark}/><Stat l="Total Spent" v={fN(spent)} c={dark?"#f0a0a0":"#dc2626"} d={.15} t={t} dark={dark}/></div>
  <div className="g2"><Card d={.2} dark={dark}><div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><h3 style={{fontSize:15,fontWeight:500,color:t.text}}>Recent orders</h3><button onClick={()=>go("orders")} style={{background:"none",color:t.accent,fontSize:13,fontWeight:500}}>View all →</button></div>{orders.slice(0,5).map((o,i)=><div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",borderBottom:i<Math.min(4,orders.length-1)?`0.5px solid ${t.surfaceBorder}`:"none",gap:12}}><div style={{minWidth:0,flex:1}}><div style={{fontSize:14,fontWeight:500,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.service.split("[")[0].trim()}</div><div style={{fontSize:12,color:t.textMuted,marginTop:3}}>{o.id} · {o.quantity.toLocaleString()} qty</div></div><div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}><Badge s={o.status} dark={dark}/><div className="m" style={{fontSize:13,fontWeight:500,color:o.status==="Completed"?t.green:t.text}}>{fN(o.charge)}</div></div></div>)}</Card>
  <div style={{display:"flex",flexDirection:"column",gap:16}}><Card d={.25} dark={dark}><h3 style={{fontSize:15,fontWeight:500,color:t.text,marginBottom:14}}>Quick actions</h3>{[["Place new order","new-order"],["Add funds","funds"],["Share referral","referrals"]].map(([l,p])=><button key={l} onClick={()=>go(p)} style={{display:"flex",alignItems:"center",padding:"12px 14px",borderRadius:10,border:`0.5px solid ${t.surfaceBorder}`,color:t.text,fontSize:13,fontWeight:500,width:"100%",textAlign:"left",marginBottom:8,background:"transparent"}}>{l}</button>)}</Card>
  <Card d={.3} dark={dark}><div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}><h3 style={{fontSize:15,fontWeight:500,color:t.text}}>Recent transactions</h3><button onClick={()=>go("funds")} style={{background:"none",color:t.accent,fontSize:13,fontWeight:500}}>Show more →</button></div>{txs.slice(0,4).map((tx,i)=><div key={tx.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:i<3?`0.5px solid ${t.surfaceBorder}`:"none"}}><div><div style={{fontSize:13,color:t.text,fontWeight:500}}>{tx.type==="deposit"?"Deposit":tx.type==="referral"?"Referral":"Order"}</div><div style={{fontSize:11,color:t.textMuted,marginTop:2}}>{fD(tx.date)}</div></div><div className="m" style={{fontSize:13,fontWeight:500,color:tx.amount>0?t.green:t.red}}>{tx.amount>0?"+":"-"}{fN(tx.amount)}</div></div>)}</Card></div></div></div>;
}

function NewOrd({services,onPlace,bal,t,dark}){
  const [pl,setPl]=useState("all");const [sel,setSel]=useState(null);const [lnk,setLnk]=useState("");const [qty,setQty]=useState("");const [q,setQ]=useState("");const [placing,setPlacing]=useState(false);
  const list=services.filter(s=>(pl==="all"||s.platform===pl)&&(!q||s.name.toLowerCase().includes(q.toLowerCase())));
  const ch=sel&&qty?(sel.rate/1000)*Number(qty):0;
  return <div><Hdr title="New Order" sub="Select a service and place your order" t={t}/><div className="og"><div style={{animation:"fu .4s ease"}}><div className="pf-grid">{[["all","","All"],["instagram","","Instagram"],["tiktok","","TikTok"],["youtube","","YouTube"],["twitter","","Twitter/X"],["facebook","","Facebook"],["telegram","","Telegram"],["spotify","","Spotify"],["","",""]].map(([id,ic,lb],i)=>id?<button key={id} onClick={()=>setPl(id)} style={{padding:"10px 8px",borderRadius:10,fontSize:13,fontWeight:500,background:pl===id?t.accentLight:t.btnSecondary,color:pl===id?t.accent:t.textSoft,border:`1px solid ${t.btnSecBorder}`,boxShadow:pl===id?t.accentShadow:"none",textAlign:"center",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{lb}</button>:<div key={`empty-${i}`}/>)}</div>
  <input placeholder="Search services..." value={q} onChange={e=>setQ(e.target.value.slice(0,100))} maxLength={100} style={{width:"100%",padding:"12px 16px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,marginBottom:12,outline:"none"}}/>
  <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:480,overflowY:"auto"}}>{list.map(s=><button key={s.id} onClick={()=>{setSel(s);setQty(String(s.min))}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 14px",borderRadius:12,width:"100%",textAlign:"left",background:sel?.id===s.id?t.accentLight:(dark?"rgba(15,18,30,0.6)":"rgba(255,255,255,0.6)"),border:`0.5px solid ${t.surfaceBorder}`,boxShadow:sel?.id===s.id?t.accentShadow:"none",gap:10}}><div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}><div style={{minWidth:0}}><div style={{fontSize:13,fontWeight:500,color:sel?.id===s.id?t.accent:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div><div style={{fontSize:11,color:t.textMuted,marginTop:2}}>Min: {s.min.toLocaleString()} • {s.avg_time}{s.refill?" • 🔄":""}</div></div></div><div className="m" style={{fontSize:13,fontWeight:700,color:t.green,whiteSpace:"nowrap",flexShrink:0}}>₦{s.rate.toLocaleString()}<span style={{fontSize:10,color:t.textMuted,fontWeight:400}}>/1K</span></div></button>)}</div></div>
  <div style={{animation:"fu .5s ease .1s both"}}><Card style={{position:"sticky",top:20}} dark={dark}><h3 style={{fontSize:17,fontWeight:700,color:t.text,marginBottom:18}}>Order Details</h3>{sel?<><div style={{padding:"12px 14px",borderRadius:12,background:t.accentLight,border:`1px solid ${t.accentBorder}`,marginBottom:16}}><div style={{fontSize:12,color:t.accent,fontWeight:600}}>{sel.category}</div><div style={{fontSize:13,color:t.text,fontWeight:500,marginTop:3}}>{sel.name}</div><div style={{fontSize:12,color:t.textMuted,marginTop:3}}>₦{sel.rate.toLocaleString()} per 1,000 • {sel.avg_time}</div></div><label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Link</label><input placeholder="https://instagram.com/username" value={lnk} onChange={e=>setLnk(e.target.value.slice(0,500))} maxLength={500} style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,marginBottom:14,outline:"none"}}/><label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Quantity</label><input type="text" inputMode="numeric" value={qty} onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,"");setQty(v);}} min={sel.min} max={sel.max} style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,marginBottom:4,outline:"none"}}/><div style={{fontSize:11,color:t.textMuted,marginBottom:14}}>Min: {sel.min.toLocaleString()} — Max: {sel.max.toLocaleString()}</div><div style={{padding:14,borderRadius:12,background:dark?"#080b14":"#faf8f5",border:`0.5px solid ${t.surfaceBorder}`,marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,color:t.textSoft}}>Rate</span><span className="m" style={{fontSize:13,color:t.text}}>₦{sel.rate.toLocaleString()} / 1K</span></div><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,color:t.textSoft}}>Quantity</span><span className="m" style={{fontSize:13,color:t.text}}>{Number(qty||0).toLocaleString()}</span></div><div style={{height:1,background:t.surfaceBorder,margin:"6px 0"}}/><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:14,color:t.text,fontWeight:600}}>Total</span><span className="m" style={{fontSize:20,color:t.green,fontWeight:700}}>{fN(ch)}</span></div></div>{ch>bal&&<div style={{padding:"10px 12px",borderRadius:10,background:dark?"rgba(127,29,29,0.2)":"#fef2f2",border:`1px solid ${dark?"#7f1d1d":"#fecaca"}`,marginBottom:14,fontSize:12,color:t.red}}>⚠️ Need {fN(ch-bal)} more.</div>}<button onClick={()=>{if(lnk&&Number(qty)>=sel.min&&ch<=bal&&!placing){setPlacing(true);setTimeout(()=>{onPlace(sel,lnk,Number(qty));setPlacing(false);},800)}}} disabled={!lnk||ch>bal||placing} style={{width:"100%",padding:"14px 0",borderRadius:12,fontSize:15,fontWeight:700,color:"#fff",background:(!lnk||ch>bal||placing)?(dark?"#222":"#ccc"):t.btnPrimary,opacity:(!lnk||ch>bal||placing)?.5:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>{placing&&<span style={{width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>}{placing?"Placing Order...":"Place Order — "+fN(ch)}</button></>:<div style={{textAlign:"center",padding:"40px 0",color:t.textMuted}}><div style={{fontSize:14}}>Select a service to begin</div></div>}</Card></div></div></div>;
}

function Ords({orders,t,dark}){
  const [f,setF]=useState("all");const [pg2,setPg2]=useState(1);const [pp,setPp]=useState(10);const [selOrder,setSelOrder]=useState(null);
  const list=f==="all"?orders:orders.filter(o=>o.status===f);

  // Generate mock timeline for an order
  const getTimeline=(o)=>{
    const tl=[{status:"Placed",desc:"Order submitted and payment confirmed",time:o.created,icon:"📝"}];
    const d=new Date(o.created);
    if(o.status!=="Pending"){tl.push({status:"Processing",desc:"Sent to provider API for delivery",time:new Date(d.getTime()+120000).toISOString(),icon:"⚡"});}
    if(o.status==="Completed"){tl.push({status:"In Progress",desc:`Delivering ${o.quantity.toLocaleString()} to target`,time:new Date(d.getTime()+300000).toISOString(),icon:"🚀"});tl.push({status:"Completed",desc:"Order fully delivered",time:new Date(d.getTime()+3600000).toISOString(),icon:"✅"});}
    if(o.status==="Partial"){tl.push({status:"In Progress",desc:`Delivering ${o.quantity.toLocaleString()} to target`,time:new Date(d.getTime()+300000).toISOString(),icon:"🚀"});tl.push({status:"Partial",desc:`Delivered ${Math.floor(o.quantity*0.7).toLocaleString()} of ${o.quantity.toLocaleString()} — refill eligible`,time:new Date(d.getTime()+7200000).toISOString(),icon:"⚠️"});}
    return tl;
  };

  if(selOrder){
    const o=selOrder;const tl=getTimeline(o);
    return <div>
      <button onClick={()=>setSelOrder(null)} style={{background:"none",color:t.accent,fontSize:13,fontWeight:500,marginBottom:16,display:"flex",alignItems:"center",gap:6}}>← Back to Orders</button>
      <div className="g2">
        <Card dark={dark}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <span className="m" style={{fontSize:18,fontWeight:700,color:t.accent}}>{o.id}</span>
            <Badge s={o.status} dark={dark}/>
          </div>
          <div style={{fontSize:16,fontWeight:600,color:t.text,marginBottom:4}}>{o.service}</div>
          <div style={{fontSize:13,color:t.textMuted,marginBottom:16,wordBreak:"break-all"}}>{o.link}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
            {[["Quantity",o.quantity.toLocaleString()],["Charge",fN(o.charge)],["Placed",fD(o.created)],["Status",o.status]].map(([l,v],i)=><div key={i} style={{padding:12,borderRadius:10,background:dark?"#0a0d18":"#faf8f5",border:`0.5px solid ${t.surfaceBorder}`}}><div style={{fontSize:10,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1.5,marginBottom:3}}>{l}</div><div className="m" style={{fontSize:14,fontWeight:600,color:i===1?t.green:t.text}}>{v}</div></div>)}
          </div>
          {/* Timeline */}
          <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:16}}>Order Timeline</h3>
          <div style={{position:"relative",paddingLeft:28}}>
            <div style={{position:"absolute",left:11,top:4,bottom:4,width:2,background:t.surfaceBorder}}/>
            {tl.map((step,i)=><div key={i} style={{position:"relative",marginBottom:i<tl.length-1?20:0}}>
              <div style={{position:"absolute",left:-28,top:0,width:24,height:24,borderRadius:"50%",background:i===tl.length-1?t.accentLight:(dark?"#0d1020":"#faf8f5"),border:`2px solid ${i===tl.length-1?t.accent:t.surfaceBorder}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,zIndex:1}}>{step.icon}</div>
              <div style={{paddingTop:1}}>
                <div style={{fontSize:13,fontWeight:600,color:i===tl.length-1?t.accent:t.text}}>{step.status}</div>
                <div style={{fontSize:12,color:t.textSoft,marginTop:2}}>{step.desc}</div>
                <div style={{fontSize:11,color:t.textMuted,marginTop:2}}>{fD(step.time)}</div>
              </div>
            </div>)}
          </div>
        </Card>
        <div>
          <Card dark={dark} style={{marginBottom:12}}>
            <h3 style={{fontSize:14,fontWeight:600,color:t.text,marginBottom:12}}>Actions</h3>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {o.status==="Partial"&&<button style={{width:"100%",padding:"10px 0",borderRadius:10,background:dark?"rgba(110,231,183,0.08)":"#ecfdf5",color:t.green,fontSize:13,fontWeight:600,border:`1px solid ${dark?"rgba(110,231,183,0.15)":"#a7f3d0"}`}}>Request Refill</button>}
              {(o.status==="Processing"||o.status==="Pending")&&<button style={{width:"100%",padding:"10px 0",borderRadius:10,background:dark?"rgba(252,165,165,0.08)":"#fef2f2",color:t.red,fontSize:13,fontWeight:600,border:`1px solid ${dark?"rgba(252,165,165,0.15)":"#fecaca"}`}}>Cancel Order</button>}
              <button style={{width:"100%",padding:"10px 0",borderRadius:10,background:t.btnSecondary,color:t.textSoft,fontSize:13,fontWeight:500,border:`1px solid ${t.btnSecBorder}`}}>Check Status</button>
              <button style={{width:"100%",padding:"10px 0",borderRadius:10,background:t.btnSecondary,color:t.textSoft,fontSize:13,fontWeight:500,border:`1px solid ${t.btnSecBorder}`}}>💬 Open Ticket</button>
            </div>
          </Card>
          <Card dark={dark}>
            <h3 style={{fontSize:14,fontWeight:600,color:t.text,marginBottom:8}}>Need Help?</h3>
            <p style={{fontSize:12,color:t.textMuted,lineHeight:1.6}}>If this order is stuck or not delivering as expected, open a support ticket and include the order ID. We'll check with the provider.</p>
          </Card>
        </div>
      </div>
    </div>;
  }

  return <div><Hdr title="Orders" sub={`${orders.length} total orders`} t={t}/><div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",animation:"fu .3s ease"}}>{["all","Completed","Processing","Pending","Partial"].map(x=><button key={x} onClick={()=>{setF(x);setPg2(1);}} style={{padding:"8px 14px",borderRadius:8,fontSize:13,fontWeight:500,background:f===x?t.accentLight:"transparent",color:f===x?t.accent:t.textSoft,border:`1px solid ${t.btnSecBorder}`,boxShadow:f===x?t.accentShadow:"none"}}>{x==="all"?"All":x} {x!=="all"&&`(${orders.filter(o=>o.status===x).length})`}</button>)}</div>
  <Card style={{padding:0,overflow:"hidden"}} dark={dark}>
    <div className="oth" style={{borderBottom:`1px solid ${t.surfaceBorder}`,fontSize:11,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}><div>Order ID</div><div>Service</div><div>Link</div><div>Qty</div><div>Charge</div><div>Status</div><div>Date</div></div>
    {list.slice((pg2-1)*pp,pg2*pp).map(o=><div key={o.id} onClick={()=>setSelOrder(o)} className="otr" style={{borderBottom:`1px solid ${dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.04)"}`,fontSize:13,cursor:"pointer"}}><div className="m" style={{color:t.accent,fontSize:12}}>{o.id}</div><div style={{color:t.text,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.service.split("[")[0].trim()}</div><div style={{color:t.textMuted,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.link}</div><div className="m" style={{color:t.textSoft,fontSize:12}}>{o.quantity.toLocaleString()}</div><div className="m" style={{color:t.text,fontSize:12}}>{fN(o.charge)}</div><div><Badge s={o.status} dark={dark}/></div><div style={{color:t.textMuted,fontSize:11}}>{fD(o.created)}</div></div>)}
    <div className="ocm" style={{padding:12}}>{list.slice((pg2-1)*pp,pg2*pp).map(o=><div key={o.id} onClick={()=>setSelOrder(o)} style={{padding:14,borderRadius:14,background:dark?"#0d1020":"#fff",border:`0.5px solid ${t.surfaceBorder}`,marginBottom:10,cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span className="m" style={{fontSize:12,color:t.accent}}>{o.id}</span><Badge s={o.status} dark={dark}/></div><div style={{fontSize:13,fontWeight:500,color:t.text,marginBottom:3}}>{o.service.split("[")[0].trim()}</div><div style={{fontSize:11,color:t.textMuted,marginBottom:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.link}</div><div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:t.textSoft}}>Qty: <span className="m" style={{color:t.text}}>{o.quantity.toLocaleString()}</span></span><span className="m" style={{color:t.green,fontWeight:600}}>{fN(o.charge)}</span></div><div style={{fontSize:11,color:t.textMuted,marginTop:6}}>{fD(o.created)}</div></div>)}</div>
  </Card>
  <Pagination total={list.length} page={pg2} setPage={setPg2} perPage={pp} setPerPage={setPp} t={t}/>
  </div>;
}

function Fnds({onAdd,bal,txs,t,dark}){
  const [a,setA]=useState("");
  const [payState,setPayState]=useState("idle");
  const [payError,setPayError]=useState("");
  const [payRef,setPayRef]=useState("");
    const [gateway,setGateway]=useState(GATEWAYS.find(g=>g.enabled)?.id||"paystack");
  const [txPage,setTxPage]=useState(1);const [txPp,setTxPp]=useState(10);
  const activeGateways=GATEWAYS.filter(g=>g.enabled);
  const currentGw=GATEWAYS.find(g=>g.id===gateway)||GATEWAYS[0];

  const startPayment=async()=>{
    if(Number(a)<500)return;
    setPayState("verifying");
    setPayError("");
    try{
      const res=await fetch("/api/payments/initialize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount:Number(a)})});
      const data=await res.json();
      if(!res.ok||!data.authorization_url){setPayState("failed");setPayError(data.error||"Failed to start payment");return;}
      setPayRef(data.reference);
      window.location.href=data.authorization_url;
    }catch(err){setPayState("failed");setPayError("Network error. Please try again.");}
  };

  // Check for payment callback on mount
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const ref=params.get("verify")||params.get("reference")||params.get("trxref");
    if(ref){
      setPayState("verifying");setPayRef(ref);
      fetch("/api/payments/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reference:ref})})
        .then(r=>r.json()).then(d=>{
          if(d.success){setPayState("success");setA(String(d.amount||0));onAdd(d.amount||0);}
          else{setPayState("failed");setPayError(d.error||"Verification failed");}
        }).catch(()=>{setPayState("failed");setPayError("Could not verify payment");});
      window.history.replaceState({},"","/dashboard");
    }
  },[]);

  const resetPayment=()=>{setPayState("idle");setPayError("");setA("");};

  const amt=Number(a)||0;

  return <div>
    <Hdr title="Add Funds" sub="Top up your wallet" t={t}/>
    <div className="fg">
      <div>
        {/* ── IDLE STATE: amount selection ── */}
        {payState==="idle"&&<Card dark={dark}>
          <div style={{textAlign:"center",marginBottom:22}}>
            <div style={{fontSize:11,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:2}}>Current Balance</div>
            <div className="m" style={{fontSize:28,fontWeight:700,color:t.green,marginTop:6}}>{fN(bal)}</div>
          </div>
          <label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:1.5}}>Amount (₦)</label>
          <input type="number" placeholder="Enter amount" value={a} onChange={e=>setA(e.target.value)} min="500" className="m" style={{width:"100%",padding:"14px 16px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:18,fontWeight:600,marginBottom:14,outline:"none",textAlign:"center"}}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:20}}>
            {[2000,5000,10000,20000,50000,100000].map(p=><button key={p} onClick={()=>setA(String(p))} className="m" style={{padding:"10px 0",borderRadius:10,fontSize:12,fontWeight:600,background:Number(a)===p?t.accentLight:t.btnSecondary,color:Number(a)===p?t.accent:t.textSoft,border:`1px solid ${t.btnSecBorder}`,boxShadow:Number(a)===p?t.accentShadow:"none"}}>₦{p.toLocaleString()}</button>)}
          </div>
          {/* Payment gateway */}
          <div style={{marginBottom:16}}>
            <label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:1.5}}>Payment Gateway</label>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>{activeGateways.map(g=><button key={g.id} onClick={()=>setGateway(g.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderRadius:10,background:gateway===g.id?(dark?"rgba(196,125,142,0.06)":"rgba(196,125,142,0.04)"):"transparent",border:`1px solid ${gateway===g.id?t.accentBorder:t.btnSecBorder}`}}><span style={{fontSize:14,fontWeight:500,color:t.text}}>{g.name}</span><div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${gateway===g.id?t.accent:t.textMuted}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{gateway===g.id&&<div style={{width:10,height:10,borderRadius:"50%",background:t.accent}}/>}</div></button>)}</div>
          </div>

          {amt>=500&&<div style={{padding:14,borderRadius:12,background:dark?"#0a0d18":"#faf8f5",border:`0.5px solid ${t.surfaceBorder}`,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,color:t.textSoft}}>Amount</span><span className="m" style={{fontSize:13,color:t.text}}>{fN(amt)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,color:t.textSoft}}>Fee</span><span className="m" style={{fontSize:13,color:t.text}}>₦0</span></div>
            <div style={{height:1,background:t.surfaceBorder,margin:"6px 0"}}/>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:14,fontWeight:600,color:t.text}}>Total</span><span className="m" style={{fontSize:16,fontWeight:700,color:t.green}}>{fN(amt)}</span></div>
          </div>}
          <button onClick={startPayment} disabled={amt<500} style={{width:"100%",padding:"15px 0",borderRadius:14,fontSize:15,fontWeight:700,color:"#fff",background:amt>=500?t.btnPrimary:(dark?"#222":"#ccc"),opacity:amt>=500?1:.5}}>{"Pay "+fN(amt)+" Now"}</button>
          <div style={{marginTop:14,display:"flex",justifyContent:"center",gap:8,fontSize:11,color:t.textMuted,flexWrap:"wrap",textAlign:"center"}}><span>Secured by {currentGw.name}</span><span>•</span><span>Instant for cards</span><span>•</span><span>Min ₦500</span></div>
        </Card>}

        {/* ── VERIFYING STATE ── */}
        {payState==="verifying"&&<Card dark={dark}>
          <div style={{textAlign:"center",padding:"30px 0"}}>
            <div style={{width:56,height:56,borderRadius:"50%",border:`3px solid ${t.surfaceBorder}`,borderTopColor:t.accent,animation:"spin 1s linear infinite",margin:"0 auto 20px"}}/>
            <h3 style={{fontSize:18,fontWeight:600,color:t.text,marginBottom:6}}>Verifying Payment</h3>
            <p style={{fontSize:14,color:t.textSoft,marginBottom:4}}>Confirming your payment with {currentGw.name}...</p>
            <p className="m" style={{fontSize:12,color:t.textMuted}}>Ref: {payRef}</p>
            <div style={{marginTop:16,padding:"10px 16px",borderRadius:8,background:dark?"rgba(99,102,241,0.08)":"#eef2ff",display:"inline-block"}}>
              <span style={{fontSize:12,color:dark?"#a5b4fc":"#4f46e5"}}>This usually takes a few seconds</span>
            </div>
          </div>
        </Card>}

        {/* ── SUCCESS STATE ── */}
        {payState==="success"&&<Card dark={dark}>
          <div style={{textAlign:"center",padding:"30px 0"}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:dark?"rgba(110,231,183,0.1)":"rgba(5,150,105,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 16px",border:`2px solid ${t.green}`}}>✓</div>
            <h3 style={{fontSize:20,fontWeight:600,color:t.green,marginBottom:6}}>Payment Successful!</h3>
            <div className="m" style={{fontSize:28,fontWeight:700,color:t.text,marginBottom:4}}>{fN(amt)}</div>
            <p style={{fontSize:14,color:t.textSoft,marginBottom:4}}>has been added to your wallet</p>
            <p className="m" style={{fontSize:12,color:t.textMuted,marginBottom:20}}>Ref: {payRef}</p>
            <div style={{padding:14,borderRadius:12,background:dark?"#0a0d18":"#faf8f5",border:`0.5px solid ${t.surfaceBorder}`,marginBottom:20,maxWidth:280,margin:"0 auto 20px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,color:t.textSoft}}>Amount</span><span className="m" style={{fontSize:13,color:t.green}}>{fN(amt)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:13,color:t.textSoft}}>Gateway</span><span style={{fontSize:13,color:t.text}}>{currentGw.name}</span></div>
              
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,color:t.textSoft}}>New Balance</span><span className="m" style={{fontSize:13,color:t.green,fontWeight:700}}>{fN(bal)}</span></div>
            </div>
            <button onClick={resetPayment} style={{padding:"12px 32px",borderRadius:12,background:t.btnPrimary,color:"#fff",fontSize:14,fontWeight:600}}>Add More Funds</button>
          </div>
        </Card>}

        {/* ── FAILED STATE ── */}
        {payState==="failed"&&<Card dark={dark}>
          <div style={{textAlign:"center",padding:"30px 0"}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:dark?"rgba(252,165,165,0.1)":"rgba(220,38,38,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 16px",border:`2px solid ${t.red}`}}>✕</div>
            <h3 style={{fontSize:20,fontWeight:600,color:t.red,marginBottom:8}}>Payment Failed</h3>
            <p style={{fontSize:14,color:t.textSoft,marginBottom:4}}>{payError}</p>
            <p className="m" style={{fontSize:12,color:t.textMuted,marginBottom:24}}>Ref: {payRef}</p>
            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
              <button onClick={()=>setPayState("popup")} style={{padding:"12px 28px",borderRadius:12,background:t.btnPrimary,color:"#fff",fontSize:14,fontWeight:600}}>Try Again</button>
              <button onClick={resetPayment} style={{padding:"12px 28px",borderRadius:12,background:t.btnSecondary,color:t.textSoft,fontSize:14,fontWeight:500,border:`1px solid ${t.btnSecBorder}`}}>Change Amount</button>
            </div>
            <div style={{marginTop:20,fontSize:12,color:t.textMuted}}>If this keeps happening, <button onClick={()=>{}} style={{background:"none",color:t.accent,fontSize:12}}>contact support</button></div>
          </div>
        </Card>}

        {/* ── CANCELLED STATE ── */}
        {payState==="cancelled"&&<Card dark={dark}>
          <div style={{textAlign:"center",padding:"20px 0"}}>
            
            <h3 style={{fontSize:16,fontWeight:600,color:t.textSoft,marginBottom:6}}>Payment Cancelled</h3>
            <p style={{fontSize:13,color:t.textMuted}}>No charge was made. Returning...</p>
          </div>
        </Card>}
      </div>

      {/* Right column: transactions */}
      <Card d={.1} dark={dark}>
        <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:14}}>Transactions</h3>
        {txs.slice((txPage-1)*txPp,txPage*txPp).map((tx,i)=><div key={tx.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:i<Math.min(txPp,txs.length)-1?`1px solid ${t.surfaceBorder}`:"none",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
            <div style={{width:32,height:32,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,background:tx.amount>0?(dark?"rgba(110,231,183,0.08)":"rgba(5,150,105,0.06)"):(dark?"rgba(252,165,165,0.08)":"rgba(220,38,38,0.06)"),border:`1px solid ${tx.amount>0?(dark?"#16653433":"#a7f3d033"):(dark?"#991b1b33":"#fecaca66")}`}}>
              {tx.type==="deposit"?"↓":"↑"}
            </div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:13,fontWeight:500,color:t.text}}>{tx.type==="deposit"?"Deposit":tx.type==="referral"?"Referral":"Order"}</div>
              <div style={{fontSize:11,color:t.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fD(tx.date)}</div>
            </div>
          </div>
          <div className="m" style={{fontSize:13,fontWeight:600,color:tx.amount>0?t.green:t.red,flexShrink:0}}>{tx.amount>0?"+":"-"}{fN(tx.amount)}</div>
        </div>)}
        <Pagination total={txs.length} page={txPage} setPage={setTxPage} perPage={txPp} setPerPage={setTxPp} t={t}/>
      </Card>
    </div>
  </div>;
}

function Refs({user,t,dark}){const [cp,setCp]=useState(false);const origin=typeof window!=="undefined"?window.location.origin:"https://thenitro.ng";const rl=`${origin}/?ref=${user.refCode}&signup=1`;return <div><Hdr title="Referrals" sub="Earn 5% commission on every order" t={t}/><div className="rg" style={{marginBottom:24}}><Stat l="Code" v={user.refCode} c="#e0a458" t={t} dark={dark}/><Stat l="Referrals" v={user.refs} c={t.accent} d={.05} t={t} dark={dark}/><Stat l="Earnings" v={fN(user.earnings)} c={t.green} d={.1} t={t} dark={dark}/></div><Card d={.15} style={{maxWidth:640}} dark={dark}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:6}}>Your Referral Link</h3><p style={{fontSize:13,color:t.textSoft,marginBottom:14}}>Share this link. Earn 5% of every payment — forever.</p><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><div className="m" style={{flex:1,minWidth:180,padding:"12px 14px",borderRadius:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.textSoft,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rl}</div><button onClick={()=>{navigator.clipboard?.writeText(rl);setCp(true);setTimeout(()=>setCp(false),2000)}} style={{padding:"12px 20px",borderRadius:12,fontSize:14,fontWeight:600,color:"#fff",background:cp?t.green:t.btnPrimary,whiteSpace:"nowrap",flexShrink:0,minWidth:100,textAlign:"center"}}>{cp?"✓ Copied!":"Copy"}</button></div><div style={{marginTop:22,padding:16,borderRadius:14,background:dark?"rgba(224,164,88,0.05)":"rgba(224,164,88,0.04)",border:`1px solid ${dark?"rgba(224,164,88,0.12)":"rgba(224,164,88,0.1)"}`}}><div style={{fontSize:14,fontWeight:600,color:"#e0a458",marginBottom:10}}>How it works</div>{["Share your referral link","They sign up & add funds","You earn 5% on every order","Auto-credited to wallet"].map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><div style={{width:22,height:22,borderRadius:"50%",background:dark?"rgba(224,164,88,0.1)":"rgba(224,164,88,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#e0a458",flexShrink:0}}>{i+1}</div><span style={{fontSize:13,color:t.textSoft}}>{s}</span></div>)}</div></Card></div>;}

function Svcs({services,go,t,dark}){const cats=[...new Set(services.map(s=>s.category))];return <div><Hdr title="Services" sub={`${services.length} services across ${cats.length} platforms`} t={t} action={<button onClick={()=>go("new-order")} style={{padding:"10px 18px",borderRadius:10,background:t.btnPrimary,color:"#fff",fontSize:13,fontWeight:600}}>+ Order</button>}/>{cats.map((cat,ci)=>{const svcs=services.filter(s=>s.category===cat);return <div key={cat} style={{marginBottom:22,animation:`fu .4s ease ${ci*.05}s both`}}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:10,display:"flex",alignItems:"center",gap:8}}>{cat}</h3><Card style={{padding:0,overflow:"hidden"}} dark={dark}><div className="sth" style={{fontSize:10,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1,borderBottom:`1px solid ${t.surfaceBorder}`}}><div>ID</div><div>Service</div><div>Rate/1K</div><div>Min</div><div>Max</div><div>Refill</div><div>Speed</div></div>{svcs.map(s=><div key={s.id} className="str" style={{fontSize:12,borderBottom:`1px solid ${dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.04)"}`,cursor:"pointer"}} onClick={()=>go("new-order")}><div className="m" style={{color:t.textMuted}}>{s.id}</div><div style={{color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</div><div className="m" style={{color:t.green,fontWeight:600}}>₦{s.rate.toLocaleString()}</div><div className="m" style={{color:t.textSoft}}>{s.min.toLocaleString()}</div><div className="m" style={{color:t.textSoft}}>{s.max.toLocaleString()}</div><div style={{color:s.refill?t.green:t.textMuted}}>{s.refill?"✓":"—"}</div><div style={{color:t.textSoft}}>{s.avg_time}</div></div>)}<div className="scm" style={{padding:10}}>{svcs.map(s=><div key={s.id} onClick={()=>go("new-order")} style={{padding:14,borderRadius:14,background:dark?"#0d1020":"#fff",border:`0.5px solid ${t.surfaceBorder}`,marginBottom:8,cursor:"pointer"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><div style={{fontSize:13,fontWeight:500,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,marginRight:10}}>{s.name}</div><div className="m" style={{color:t.green,fontWeight:700,fontSize:14,flexShrink:0}}>₦{s.rate.toLocaleString()}<span style={{fontSize:10,color:t.textMuted}}>/1K</span></div></div><div style={{display:"flex",gap:10,fontSize:11,color:t.textSoft,flexWrap:"wrap"}}><span>Min: {s.min.toLocaleString()}</span><span>Max: {s.max.toLocaleString()}</span><span>{s.avg_time}</span>{s.refill&&<span style={{color:t.green}}>🔄 Refill</span>}</div></div>)}</div></Card></div>})}</div>;}

function Sup({t,dark}){const [su,setSu]=useState("");const [ms,setMs]=useState("");const [oi,setOi]=useState("");const [submitting,setSubmitting]=useState(false);const [faqOpen,setFaqOpen]=useState(null);return <div><Hdr title="Support" sub="Open a ticket or check the FAQ" t={t}/><div className="spg"><Card dark={dark}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:16}}>Open a Ticket</h3><label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Order ID (optional)</label><input placeholder="e.g. ORD-28491" value={oi} onChange={e=>setOi(e.target.value.replace(/[^a-zA-Z0-9\-]/g,"").toUpperCase().slice(0,20))} maxLength={20} style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,marginBottom:14,outline:"none"}}/><label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Subject</label><input placeholder="Brief description" value={su} onChange={e=>setSu(e.target.value.slice(0,200))} maxLength={200} style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,marginBottom:14,outline:"none"}}/><label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Message</label><textarea rows={4} placeholder="Describe your issue..." value={ms} onChange={e=>setMs(e.target.value.slice(0,2000))} maxLength={2000} style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,marginBottom:16,outline:"none",resize:"vertical"}}/><button disabled={submitting} style={{width:"100%",padding:"14px 0",borderRadius:12,background:submitting?(dark?"#333":"#ccc"):t.btnPrimary,color:"#fff",fontSize:15,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={()=>{if(su&&ms&&!submitting){setSubmitting(true);setTimeout(()=>{setSubmitting(false);setSu("");setMs("");setOi("");},1000)}}}>{submitting&&<span style={{width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite"}}/>}{submitting?"Submitting...":"Submit Ticket"}</button></Card><Card d={.1} dark={dark}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:16}}>FAQ</h3>{[["How fast are orders?","Most start in minutes. 0-24 hrs typical."],["What if followers drop?","Refill-guaranteed services auto-replenish."],["Is my account safe?","We never ask for passwords. Public URLs only."],["Can I get a refund?","Yes for undelivered/canceled orders."],["Payment methods?","Paystack — cards, bank transfer, USSD. Min ₦500."]].map(([q,a],i)=>{const isOpen=faqOpen===i;return <div key={i} style={{marginBottom:6,borderRadius:10,border:`1px solid ${isOpen?"rgba(196,125,142,0.2)":t.surfaceBorder}`,transition:"border-color 0.3s ease"}}><button onClick={()=>setFaqOpen(isOpen?null:i)} style={{width:"100%",padding:"11px 12px",fontSize:13,fontWeight:500,color:t.text,cursor:"pointer",background:"none",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,textAlign:"left"}}><span>{q}</span><span style={{fontSize:14,color:isOpen?t.accent:t.textMuted,transition:"transform 0.3s ease",transform:isOpen?"rotate(45deg)":"rotate(0deg)",flexShrink:0}}>+</span></button><div style={{maxHeight:isOpen?200:0,overflow:"hidden",transition:"max-height 0.3s cubic-bezier(0.4,0,0.2,1)"}}><div style={{padding:"0 12px 11px",color:t.textSoft,fontSize:13,lineHeight:1.6}}>{a}</div></div></div>})}</Card></div></div>;}

function Settings({user,t,dark,toggleTheme,manualOverride}){return <div><Hdr title="Settings" sub="Manage your account preferences" t={t}/><div className="fg"><Card dark={dark}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:20}}>Account</h3>{[["Full Name",user.name],["Email Address",user.email],["Referral Code",user.refCode],["Member Since","March 2026"]].map(([label,val],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",borderBottom:i<3?`1px solid ${t.surfaceBorder}`:"none"}}><span style={{fontSize:13,color:t.textSoft}}>{label}</span><span style={{fontSize:13,color:t.text,fontWeight:500}}>{val}</span></div>)}<button style={{marginTop:20,width:"100%",padding:"12px 0",borderRadius:10,background:t.btnSecondary,border:`1px solid ${t.btnSecBorder}`,color:t.text,fontSize:13,fontWeight:600}}>Edit Profile</button></Card><div style={{display:"flex",flexDirection:"column",gap:16}}><Card dark={dark}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:20}}>Appearance</h3><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",borderBottom:`1px solid ${t.surfaceBorder}`}}><div><div style={{fontSize:13,color:t.text,fontWeight:500}}>Theme</div><div style={{fontSize:12,color:t.textMuted,marginTop:2}}>{dark?"Night mode":"Day mode"}{manualOverride?" — manual override":" — auto by time of day"}</div></div><ThemeToggle dark={dark} onToggle={toggleTheme}/></div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0"}}><div><div style={{fontSize:13,color:t.text,fontWeight:500}}>Language</div><div style={{fontSize:12,color:t.textMuted,marginTop:2}}>English</div></div><span style={{fontSize:12,color:t.textMuted}}>Coming soon</span></div></Card><Card dark={dark}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:20}}>Security</h3>{[["Change Password","Update your login password"],["Two-Factor Auth","Extra layer of security"],["Active Sessions","Manage logged-in devices"]].map(([label,desc],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",borderBottom:i<2?`1px solid ${t.surfaceBorder}`:"none"}}><div><div style={{fontSize:13,color:t.text,fontWeight:500}}>{label}</div><div style={{fontSize:12,color:t.textMuted,marginTop:2}}>{desc}</div></div><button style={{padding:"6px 14px",borderRadius:8,background:t.btnSecondary,border:`1px solid ${t.btnSecBorder}`,color:t.textSoft,fontSize:12,fontWeight:500,flexShrink:0}}>Manage</button></div>)}</Card><Card dark={dark}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:20}}>Notifications</h3>{[["Order Updates","Notified when orders complete",true],["Deposit Confirmations","Alerts for successful deposits",true],["Promotions","Special offers and discounts",false]].map(([label,desc,on],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",borderBottom:i<2?`1px solid ${t.surfaceBorder}`:"none"}}><div><div style={{fontSize:13,color:t.text,fontWeight:500}}>{label}</div><div style={{fontSize:12,color:t.textMuted,marginTop:2}}>{desc}</div></div><div style={{width:40,height:22,borderRadius:11,background:on?t.accent:(dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)"),position:"relative",flexShrink:0,cursor:"pointer"}}><div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:on?20:2,transition:"left 0.2s ease",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/></div></div>)}</Card></div></div></div>;}
