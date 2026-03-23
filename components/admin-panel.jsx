'use client';
import { useState, useEffect, useRef } from "react";

const ROLES = {
  superadmin: { label: "Super Admin", color: "#c47d8e", pages: ["overview","orders","users","tickets","---1","services","api","payments","---2","analytics","alerts","coupons","notifications","maintenance","activity","---3","team","settings"] },
  admin: { label: "Admin", color: "#a5b4fc", pages: ["overview","orders","users","tickets","---1","services","analytics","alerts","coupons","notifications","activity"] },
  support: { label: "Support", color: "#6ee7b7", pages: ["overview","orders","users","tickets","activity"] },
  finance: { label: "Finance", color: "#fcd34d", pages: ["overview","orders","payments","analytics","activity"] },
};

const MOCK_ORDERS=[{id:"ORD-28491",user:"Chidi Okafor",email:"chidi@gmail.com",service:"Instagram Followers [Real]",link:"instagram.com/coolbrand",quantity:5000,charge:19375,cost:12594,status:"Completed",created:"2026-03-22T14:30:00",apiOrderId:"MTP-991204"},{id:"ORD-28490",user:"Amina Bello",email:"amina@yahoo.com",service:"TikTok Views [Instant]",link:"tiktok.com/@user/video/123",quantity:50000,charge:23250,cost:15113,status:"Processing",created:"2026-03-22T12:15:00",apiOrderId:"MTP-991203"},{id:"ORD-28489",user:"Tunde Adeyemi",email:"tunde@outlook.com",service:"YouTube Subscribers [Lifetime]",link:"youtube.com/@mychannel",quantity:1000,charge:12400,cost:8060,status:"Pending",created:"2026-03-21T22:00:00",apiOrderId:"MTP-991202"},{id:"ORD-28488",user:"Ngozi Eze",email:"ngozi@gmail.com",service:"Twitter/X Followers",link:"x.com/mybrand",quantity:2000,charge:12400,cost:8060,status:"Completed",created:"2026-03-21T10:45:00",apiOrderId:"MTP-991201"},{id:"ORD-28487",user:"Segun Akinola",email:"segun@mail.com",service:"Instagram Likes [Instant]",link:"instagram.com/p/ABC123",quantity:10000,charge:18600,cost:12090,status:"Partial",created:"2026-03-20T18:00:00",apiOrderId:"MTP-991200"},{id:"ORD-28486",user:"Fatima Yusuf",email:"fatima@gmail.com",service:"Spotify Plays [Premium]",link:"open.spotify.com/track/xyz",quantity:100000,charge:279000,cost:181350,status:"Completed",created:"2026-03-19T09:00:00",apiOrderId:"MTP-991199"},{id:"ORD-28485",user:"Emeka Nwankwo",email:"emeka@live.com",service:"Facebook Page Likes",link:"facebook.com/mybiz",quantity:3000,charge:23250,cost:15113,status:"Completed",created:"2026-03-18T16:20:00",apiOrderId:"MTP-991198"},{id:"ORD-28484",user:"Blessing Okoro",email:"blessing@gmail.com",service:"Telegram Members",link:"t.me/mychannel",quantity:5000,charge:27125,cost:17631,status:"Processing",created:"2026-03-18T11:00:00",apiOrderId:"MTP-991197"}];
const MOCK_USERS=[{id:1,name:"Chidi Okafor",email:"chidi@gmail.com",balance:45000,orders:23,spent:156000,joined:"2026-01-15",status:"Active",ref:"BOOST-C4K1"},{id:2,name:"Amina Bello",email:"amina@yahoo.com",balance:120500,orders:67,spent:890000,joined:"2025-11-20",status:"Active",ref:"BOOST-A8B2"},{id:3,name:"Tunde Adeyemi",email:"tunde@outlook.com",balance:8250,orders:12,spent:64000,joined:"2026-02-28",status:"Active",ref:"BOOST-T3A9"},{id:4,name:"Ngozi Eze",email:"ngozi@gmail.com",balance:310000,orders:145,spent:2340000,joined:"2025-09-10",status:"Active",ref:"BOOST-N7E5"},{id:5,name:"Segun Akinola",email:"segun@mail.com",balance:0,orders:3,spent:12000,joined:"2026-03-18",status:"Suspended",ref:"BOOST-S2A0"},{id:6,name:"Fatima Yusuf",email:"fatima@gmail.com",balance:54000,orders:31,spent:445000,joined:"2025-12-05",status:"Active",ref:"BOOST-F1Y6"},{id:7,name:"Emeka Nwankwo",email:"emeka@live.com",balance:22000,orders:18,spent:198000,joined:"2026-01-22",status:"Active",ref:"BOOST-E9N3"},{id:8,name:"Blessing Okoro",email:"blessing@gmail.com",balance:87000,orders:42,spent:567000,joined:"2025-10-15",status:"Active",ref:"BOOST-B4O8"}];
const MOCK_TICKETS=[{id:"TK-401",user:"Chidi Okafor",email:"chidi@gmail.com",subject:"Order not delivered",orderId:"ORD-28491",message:"My Instagram followers order stuck on processing for 3 hours.",status:"Open",created:"2026-03-22T15:00:00",replies:[]},{id:"TK-400",user:"Amina Bello",email:"amina@yahoo.com",subject:"Followers dropped",orderId:"ORD-28480",message:"Lost about 500 followers. Service says 30-day refill.",status:"Open",created:"2026-03-22T10:30:00",replies:[]},{id:"TK-399",user:"Tunde Adeyemi",email:"tunde@outlook.com",subject:"Payment not credited",orderId:"",message:"Paystack payment not reflected. Ref: PAY-2026032109.",status:"In Progress",created:"2026-03-21T09:15:00",replies:[{from:"admin",msg:"Checking with Paystack.",time:"2026-03-21T10:00:00"}]},{id:"TK-398",user:"Ngozi Eze",email:"ngozi@gmail.com",subject:"Refund request",orderId:"ORD-28470",message:"Wrong service. Please refund.",status:"Resolved",created:"2026-03-20T14:00:00",replies:[{from:"admin",msg:"Refunded to wallet.",time:"2026-03-20T16:30:00"}]}];
const MOCK_SERVICES=[{id:1,name:"IG Followers [Real]",category:"Instagram",apiId:1001,costPer1k:2518,sellPer1k:3875,markup:54,enabled:true,refill:true},{id:2,name:"IG Likes [Instant]",category:"Instagram",apiId:1002,costPer1k:1209,sellPer1k:1860,markup:54,enabled:true,refill:false},{id:3,name:"TikTok Followers",category:"TikTok",apiId:2001,costPer1k:3023,sellPer1k:4650,markup:54,enabled:true,refill:true},{id:4,name:"TikTok Views",category:"TikTok",apiId:2002,costPer1k:302,sellPer1k:465,markup:54,enabled:true,refill:false},{id:5,name:"YT Subscribers",category:"YouTube",apiId:3001,costPer1k:8060,sellPer1k:12400,markup:54,enabled:true,refill:true},{id:6,name:"YT Views",category:"YouTube",apiId:3002,costPer1k:2015,sellPer1k:3100,markup:54,enabled:true,refill:false},{id:7,name:"Twitter/X Followers",category:"Twitter/X",apiId:4001,costPer1k:4030,sellPer1k:6200,markup:54,enabled:true,refill:true},{id:8,name:"FB Page Likes",category:"Facebook",apiId:5001,costPer1k:5038,sellPer1k:7750,markup:54,enabled:true,refill:true},{id:9,name:"Telegram Members",category:"Telegram",apiId:6001,costPer1k:3526,sellPer1k:5425,markup:54,enabled:false,refill:true},{id:10,name:"Spotify Plays",category:"Spotify",apiId:7001,costPer1k:1814,sellPer1k:2790,markup:54,enabled:true,refill:false}];
const MOCK_ADMINS=[{id:1,name:"You (Owner)",email:"admin@boostpanel.ng",role:"superadmin",lastActive:"2026-03-23T10:30:00",status:"Active"},{id:2,name:"David Ojo",email:"david@boostpanel.ng",role:"admin",lastActive:"2026-03-23T09:15:00",status:"Active"},{id:3,name:"Grace Adebayo",email:"grace@boostpanel.ng",role:"support",lastActive:"2026-03-22T18:00:00",status:"Active"},{id:4,name:"Ibrahim Musa",email:"ibrahim@boostpanel.ng",role:"finance",lastActive:"2026-03-21T14:00:00",status:"Inactive"}];
const MOCK_ACTIVITY=[{id:1,admin:"You (Owner)",action:"Credited N5,000 to Chidi Okafor",type:"credit",time:"2026-03-23T10:25:00"},{id:2,admin:"David Ojo",action:"Cancelled order ORD-28483",type:"cancel",time:"2026-03-23T09:10:00"},{id:3,admin:"Grace Adebayo",action:"Replied to ticket TK-399",type:"ticket",time:"2026-03-22T17:45:00"},{id:4,admin:"You (Owner)",action:"Suspended user Segun Akinola",type:"ban",time:"2026-03-22T15:30:00"},{id:5,admin:"David Ojo",action:"Synced 10 services from API",type:"sync",time:"2026-03-22T12:00:00"},{id:6,admin:"You (Owner)",action:"Updated exchange rate",type:"settings",time:"2026-03-22T10:00:00"},{id:7,admin:"Grace Adebayo",action:"Resolved ticket TK-398",type:"ticket",time:"2026-03-21T16:30:00"},{id:8,admin:"Ibrahim Musa",action:"Refilled order ORD-28475",type:"refill",time:"2026-03-21T14:00:00"},{id:9,admin:"You (Owner)",action:"Invited Ibrahim Musa as Finance admin",type:"admin",time:"2026-03-20T09:00:00"},{id:10,admin:"David Ojo",action:"Credited N20,000 to Amina Bello",type:"credit",time:"2026-03-19T11:30:00"}];

const MOCK_ALERTS=[
  {id:1,message:"Scheduled maintenance tonight 11PM - 1AM WAT. Orders may be delayed.",type:"warning",target:"both",active:true,createdBy:"You (Owner)",created:"2026-03-23T09:00:00",expiresAt:"2026-03-24T01:00:00"},
  {id:2,message:"New! TikTok services now available with 30-day refill guarantee.",type:"info",target:"dashboard",active:true,createdBy:"David Ojo",created:"2026-03-22T14:00:00",expiresAt:null},
  {id:3,message:"Paystack maintenance completed. All payments are back to normal.",type:"info",target:"login",active:false,createdBy:"You (Owner)",created:"2026-03-21T08:00:00",expiresAt:"2026-03-21T20:00:00"},
];

const fN=(a)=>`₦${Math.abs(a).toLocaleString("en-NG")}`;
const fD=(d)=>new Date(d).toLocaleDateString("en-NG",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const stC=(dark)=>({Completed:dark?["#0a2416","#6ee7b7","#166534"]:["#ecfdf5","#059669","#a7f3d0"],Processing:dark?["#0f1629","#a5b4fc","#3730a3"]:["#eef2ff","#4f46e5","#c7d2fe"],Pending:dark?["#1c1608","#fcd34d","#92400e"]:["#fffbeb","#d97706","#fde68a"],Partial:dark?["#1f0a0a","#fca5a5","#991b1b"]:["#fef2f2","#dc2626","#fecaca"],Canceled:dark?["#141414","#a3a3a3","#404040"]:["#f5f5f5","#737373","#d4d4d4"],Open:dark?["#1c1608","#fcd34d","#92400e"]:["#fffbeb","#d97706","#fde68a"],"In Progress":dark?["#0f1629","#a5b4fc","#3730a3"]:["#eef2ff","#4f46e5","#c7d2fe"],Resolved:dark?["#0a2416","#6ee7b7","#166534"]:["#ecfdf5","#059669","#a7f3d0"],Active:dark?["#0a2416","#6ee7b7","#166534"]:["#ecfdf5","#059669","#a7f3d0"],Suspended:dark?["#1f0a0a","#fca5a5","#991b1b"]:["#fef2f2","#dc2626","#fecaca"],Inactive:dark?["#141414","#a3a3a3","#404040"]:["#f5f5f5","#737373","#d4d4d4"]});
const Badge=({s,dark})=>{const v=stC(dark)[s]||stC(dark).Canceled;return <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:6,background:v[0],color:v[1],border:`1px solid ${v[2]}`,whiteSpace:"nowrap"}}>{s}</span>};
const Card=({children,style,d=0,dark})=><div style={{background:dark?"rgba(15,18,30,0.85)":"rgba(255,255,255,0.9)",border:`1px solid ${dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.07)"}`,borderRadius:18,padding:20,animation:`fu 0.5s ease ${d}s both`,backdropFilter:"blur(12px)",boxShadow:dark?"0 1px 3px rgba(0,0,0,0.3)":"0 1px 8px rgba(0,0,0,0.04)",transition:"background 1.5s cubic-bezier(.4,0,.2,1),border-color 1.5s ease,box-shadow 1.5s ease",...style}}>{children}</div>;
const Hdr=({title,sub,action,t})=><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,animation:"fu .4s ease",flexWrap:"wrap",gap:12}}><div><h1 className="serif" style={{fontSize:26,fontWeight:600,color:t.text,letterSpacing:"-0.3px"}}>{title}</h1>{sub&&<p style={{fontSize:13,color:t.textSoft,marginTop:4}}>{sub}</p>}</div>{action}</div>;
const Stat=({l,v,sub,c,ic,d=0,t,dark})=><Card d={d} dark={dark}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:10,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1.5}}>{l}</div>{ic&&<span style={{fontSize:16}}>{ic}</span>}</div><div className="m" style={{fontSize:18,fontWeight:700,color:c||t.accent,marginTop:5,wordBreak:"break-all"}}>{v}</div>{sub&&<div style={{fontSize:11,color:t.textMuted,marginTop:3}}>{sub}</div>}</Card>;
// Reusable pagination
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

const ATYPE={"credit":"💰","alert":"📢","cancel":"✕","ticket":"💬","ban":"🚫","sync":"🔄","settings":"⚙️","refill":"🔁","admin":"🛡️"};
function ErrorBoundary({children}){return <>{children}</>;}

function ThemeToggle({dark,onToggle,compact}){return <button onClick={onToggle} style={{display:"flex",alignItems:"center",background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)",borderRadius:20,padding:3,width:compact?52:64,height:compact?28:32,border:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)"}`,position:"relative",flexShrink:0,transition:"background 1.5s cubic-bezier(.4,0,.2,1),border-color 1.5s ease"}}><div style={{width:compact?22:26,height:compact?22:26,borderRadius:"50%",background:dark?"#c47d8e":"#e0a458",display:"flex",alignItems:"center",justifyContent:"center",fontSize:compact?12:14,position:"absolute",left:dark?3:(compact?27:35),transition:"left 0.4s cubic-bezier(.4,0,.2,1),background 1.5s cubic-bezier(.4,0,.2,1)",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}>{dark?"🌙":"☀️"}</div></button>;}

export default function AdminPanel(){
  const [pg,setPg]=useState("overview");const [alerts,setAlerts]=useState(MOCK_ALERTS);
  const [maint,setMaint]=useState({enabled:false,message:"We're performing scheduled upgrades to improve your experience. Everything will be back to normal shortly.",estimatedReturn:"~30 minutes",showTwitter:true});
  const [gateways,setGateways]=useState([
    {id:"paystack",name:"Paystack",icon:"💳",desc:"Cards, Bank Transfer, USSD",enabled:true,priority:1},
    {id:"flutterwave",name:"Flutterwave",icon:"🦋",desc:"Cards, Bank Transfer, Mobile Money",enabled:true,priority:2},
    {id:"monnify",name:"Monnify",icon:"🏦",desc:"Bank Transfer, USSD",enabled:true,priority:3},
    {id:"korapay",name:"Korapay",icon:"💠",desc:"Cards, Bank Transfer",enabled:false,priority:4},
  ]);const [activityLog,setActivityLog]=useState(MOCK_ACTIVITY);const [adminList,setAdminList]=useState(MOCK_ADMINS.map(a=>({...a,customPages:null})));const [sb,setSb]=useState(false);const [mini,setMini]=useState(false);const [toast,setToast]=useState(null);const [currentAdmin]=useState(MOCK_ADMINS[0]);const role=ROLES[currentAdmin.role];
  const [siteSettings,setSiteSettings]=useState({whatsapp:"2348012345678",twitter:"boostpanel",instagram:"boostpanel.ng",siteName:"BoostPanel",supportEmail:"support@boostpanel.ng",minDeposit:"500",defaultMarkup:"54",referralBonus:"500",promoEnabled:true,promoMessage:"Sign up today and get 10% bonus on your first deposit.",promoType:"info"});
  const getAutoTheme=()=>{const h=new Date().getHours(),m=new Date().getMinutes();if(h>=7&&h<18)return false;if(h>=19||h<6)return true;if(h===6)return m<30;if(h===18)return m>=30;return true;};
  const [dark,setDark]=useState(getAutoTheme);const [manualOverride,setManualOverride]=useState(false);
  useEffect(()=>{if(manualOverride)return;const iv=setInterval(()=>setDark(getAutoTheme()),60000);return()=>clearInterval(iv);},[manualOverride]);
  const toggleTheme=()=>{setManualOverride(true);setDark(d=>!d);};const toastTimer=useRef(null);
  const notify=(m,e)=>{setToast({m,e});if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(null),6000);};
  const logAction=(action,type)=>{setActivityLog(p=>[{id:Date.now(),admin:currentAdmin.name,action,type,time:new Date().toISOString()},...p]);};
  const dismissToast=()=>{setToast(null);if(toastTimer.current)clearTimeout(toastTimer.current);};
  const go=(p)=>{if(role.pages.includes(p)){setPg(p);setSb(false);}};
  const ALL_NAV=[["overview","📊","Overview"],["orders","📋","Orders"],["users","👥","Users"],["tickets","💬","Tickets"],["---1","",""],["services","📦","Services"],["api","🔌","API"],["payments","💳","Payments"],["---2","",""],["analytics","📈","Analytics"],["alerts","📢","Alerts"],["coupons","🎟️","Coupons"],["notifications","📣","Notifications"],["maintenance","🔧","Maintenance"],["activity","📝","Activity"],["---3","",""],["team","🛡️","Team"],["settings","⚙️","Settings"]];
  const NAV=ALL_NAV.filter(([id])=>role.pages.includes(id));
  const t={bg:dark?"#080b14":"#f4f1ed",text:dark?"#e8e4df":"#1a1a1a",textSoft:dark?"#8a8680":"#888580",textMuted:dark?"#555250":"#b0ada8",surface:dark?"rgba(15,18,30,0.97)":"rgba(255,255,255,0.97)",surfaceBorder:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.08)",inputBg:dark?"#0d1020":"#fff",inputBorder:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)",accent:"#c47d8e",accentLight:dark?"rgba(196,125,142,0.12)":"rgba(196,125,142,0.08)",accentBorder:dark?"rgba(196,125,142,0.3)":"rgba(196,125,142,0.25)",accentShadow:dark?"inset 0 0 0 1px rgba(196,125,142,0.35)":"inset 0 0 0 1px rgba(196,125,142,0.3)",green:dark?"#6ee7b7":"#059669",red:dark?"#fca5a5":"#dc2626",btnPrimary:"linear-gradient(135deg,#c47d8e,#a3586b)",btnSecondary:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)",btnSecBorder:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",logoGrad:"linear-gradient(135deg,#c47d8e,#8b5e6b)",gradBg:dark?"radial-gradient(ellipse at 20% 0%,rgba(196,125,142,0.06) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(100,120,180,0.04) 0%,transparent 50%)":"radial-gradient(ellipse at 20% 0%,rgba(196,125,142,0.05) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(180,160,140,0.04) 0%,transparent 50%)"};
  const Btn=({children,primary,onClick,style:s})=><button onClick={onClick} style={{padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:600,color:primary?"#fff":t.textSoft,background:primary?t.btnPrimary:t.btnSecondary,border:`1px solid ${primary?"transparent":t.btnSecBorder}`,whiteSpace:"nowrap",...s}}>{children}</button>;
  const FilterBtn=({active,onClick,children})=><button onClick={onClick} style={{padding:"8px 14px",borderRadius:8,fontSize:13,fontWeight:500,background:active?t.accentLight:"transparent",color:active?t.accent:t.textSoft,border:`1px solid ${t.btnSecBorder}`,boxShadow:active?t.accentShadow:"none"}}>{children}</button>;
  return(<div className="root"><style>{`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}.root{min-height:100vh;background:${t.bg};color:${t.text};font-family:'Outfit',sans-serif;transition:background 1.5s cubic-bezier(.4,0,.2,1),color 1.2s ease}input,select,textarea{font-family:inherit}button{cursor:pointer;font-family:inherit;border:none}.m{font-family:'JetBrains Mono',monospace}.serif{font-family:'Cormorant Garamond',serif}@keyframes si{from{transform:translateX(80px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}@keyframes fu{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:${dark?"#2a2a2a":"#ccc"};border-radius:3px}.sg{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.g2{display:grid;grid-template-columns:1fr 1fr;gap:20px}.sb{width:260px;background:${t.surface};border-right:1px solid ${t.surfaceBorder};display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100;backdrop-filter:blur(20px);transition:all .3s cubic-bezier(.4,0,.2,1),background 1.5s cubic-bezier(.4,0,.2,1)}.sb.collapsed{width:68px}.sb.collapsed .sb-hide{display:none}.sb.collapsed .sb-nav-label{display:none}.mn{margin-left:260px;padding:28px 32px;min-height:100vh;position:relative;z-index:1;transition:margin-left .3s cubic-bezier(.4,0,.2,1)}.mn.shifted{margin-left:68px}.ov{display:none}.mh{display:none}.sb-close{display:none}.sb-collapse{display:flex}.dtable{display:block}.mcard{display:none}.role-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}@media(max-width:1024px){.sg{grid-template-columns:repeat(2,1fr)}.g2{grid-template-columns:1fr}.mn{padding:20px}.role-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:768px){.sb{transform:translateX(-100%);width:280px}.sb.collapsed{transform:translateX(-100%);width:280px}.sb.open{transform:translateX(0)!important;width:280px!important}.ov{display:block;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:90;backdrop-filter:blur(4px)}.mh{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:${t.surface};border-bottom:1px solid ${t.surfaceBorder};position:sticky;top:0;z-index:80;backdrop-filter:blur(20px)}.mn,.mn.shifted{margin-left:0;padding:14px}.sg{grid-template-columns:repeat(2,1fr);gap:10px}.sb-close{display:flex}.sb-collapse{display:none}.dtable{display:none}.mcard{display:block}.role-grid{grid-template-columns:1fr}}@media(max-width:400px){.sg{grid-template-columns:1fr}.mn{padding:10px}}`}</style>
  <div style={{position:"fixed",inset:0,background:t.gradBg,pointerEvents:"none",zIndex:0}}/>
  {toast&&<div style={{position:"fixed",top:16,right:16,left:16,zIndex:200,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"12px 16px 12px 20px",borderRadius:14,background:toast.e?(dark?"#3b1111":"#fef2f2"):(dark?"#0a2416":"#ecfdf5"),border:`1px solid ${toast.e?(dark?"#7f1d1d":"#fecaca"):(dark?"#166534":"#a7f3d0")}`,color:toast.e?t.red:t.green,fontSize:14,fontWeight:500,animation:"si .3s ease",maxWidth:420,marginLeft:"auto",backdropFilter:"blur(12px)"}}><span>{toast.e?"⚠️":"✓"} {toast.m}</span><button onClick={dismissToast} style={{background:"none",color:t.textMuted,fontSize:18,padding:"2px 4px",lineHeight:1,flexShrink:0}}>✕</button></div>}
  <div className="mh"><button onClick={()=>setSb(true)} style={{background:"none",color:t.text,fontSize:22,padding:4}}>☰</button><button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} style={{display:"flex",alignItems:"center",gap:8,background:"none",padding:0,border:"none",outline:"none",cursor:"pointer"}}><div style={{width:28,height:28,borderRadius:8,background:t.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",fontWeight:700}}>B</div><span className="serif" style={{fontSize:17,fontWeight:600,color:t.text}}>Admin</span></button><div style={{width:28}}></div></div>
  {sb&&<div className="ov" onClick={()=>setSb(false)}/>}
  <aside className={`sb${sb?" open":""}${mini?" collapsed":""}`}><div style={{padding:mini?"16px 10px 12px":"20px 16px 12px",borderBottom:`1px solid ${t.surfaceBorder}`,display:"flex",alignItems:"center",justifyContent:mini?"center":"space-between"}}>{!mini&&<button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} style={{display:"flex",alignItems:"center",gap:10,background:"none",padding:0,border:"none",outline:"none",cursor:"pointer"}}><div style={{width:32,height:32,borderRadius:10,background:t.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#fff"}}>B</div><div className="sb-hide"><div className="serif" style={{fontSize:16,fontWeight:600,color:t.text}}>BoostPanel</div><div style={{fontSize:9,color:t.textMuted,letterSpacing:2,textTransform:"uppercase"}}>Admin Panel</div></div></button>}{mini&&<button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} style={{background:"none",padding:0,border:"none",outline:"none",cursor:"pointer"}}><div style={{width:32,height:32,borderRadius:10,background:t.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#fff"}}>B</div></button>}<button className="sb-close" onClick={()=>setSb(false)} style={{background:"none",color:t.textMuted,fontSize:20,padding:4}}>✕</button>{!mini&&<button className="sb-collapse" onClick={()=>setMini(true)} style={{background:t.btnSecondary,color:t.textSoft,fontSize:14,padding:"6px 8px",borderRadius:6,border:`1px solid ${t.btnSecBorder}`}}>⟨⟨</button>}</div>
  {!mini&&<div className="sb-hide" style={{margin:"10px 12px 4px",padding:"10px 12px",borderRadius:12,background:t.accentLight,border:`1px solid ${t.accentBorder}`}}><div style={{fontSize:10,color:t.textMuted,textTransform:"uppercase",letterSpacing:1.5}}>Logged in as</div><div style={{fontSize:13,fontWeight:600,color:t.text,marginTop:2}}>{currentAdmin.name}</div><div style={{marginTop:5}}><span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:4,background:role.color+"22",color:role.color,border:`1px solid ${role.color}44`}}>{role.label}</span></div></div>}
  {mini&&<div style={{padding:"10px 0",display:"flex",justifyContent:"center"}}><button onClick={()=>setMini(false)} style={{background:t.accentLight,color:t.accent,fontSize:14,padding:"8px 10px",borderRadius:6,border:`1px solid ${t.accentBorder}`}}>⟩⟩</button></div>}
  <nav style={{flex:1,padding:mini?"6px 6px":"6px 10px",display:"flex",flexDirection:"column",gap:1,overflowY:"auto"}}>{NAV.map(([id,ic,lb])=>id.startsWith("---")?<div key={id} style={{height:1,background:t.surfaceBorder,margin:mini?"8px 4px":"8px 14px"}}/>:<button key={id} onClick={()=>go(id)} title={lb} style={{display:"flex",alignItems:"center",gap:12,padding:mini?"10px 0":"10px 14px",borderRadius:10,width:"100%",textAlign:"left",justifyContent:mini?"center":"flex-start",background:pg===id?t.accentLight:"transparent",color:pg===id?t.accent:t.textSoft,fontSize:13,fontWeight:500,border:"1px solid transparent",boxShadow:pg===id?t.accentShadow:"none"}}><span style={{fontSize:15,width:20,textAlign:"center"}}>{ic}</span><span className="sb-nav-label">{lb}</span></button>)}</nav>
  <div style={{padding:mini?"10px 6px":"10px 14px",borderTop:`1px solid ${t.surfaceBorder}`,display:"flex",alignItems:"center",justifyContent:mini?"center":"space-between"}}>{!mini&&<span style={{fontSize:12,color:t.textMuted}}>{dark?"Night":"Day"}</span>}<ThemeToggle dark={dark} onToggle={toggleTheme} compact={mini}/></div></aside>
  <main className={`mn${mini?" shifted":""}`}>
    <div style={{position:"sticky",top:0,zIndex:40,paddingBottom:alerts.filter(a=>a.active&&(a.target==="both"||a.target==="dashboard")).length?4:0}}>
    {alerts.filter(a=>a.active&&(a.target==="both"||a.target==="dashboard")).map(a=><div key={a.id} style={{padding:"12px 20px",marginBottom:12,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,fontSize:13,fontWeight:500,animation:"fu .3s ease",background:a.type==="warning"?(dark?"rgba(217,119,6,0.1)":"#fffbeb"):a.type==="critical"?(dark?"rgba(220,38,38,0.1)":"#fef2f2"):(dark?"rgba(99,102,241,0.1)":"#eef2ff"),color:a.type==="warning"?(dark?"#fcd34d":"#92400e"):a.type==="critical"?(dark?"#fca5a5":"#dc2626"):(dark?"#a5b4fc":"#4f46e5"),border:`1px solid ${a.type==="warning"?(dark?"rgba(217,119,6,0.2)":"#fde68a"):a.type==="critical"?(dark?"rgba(220,38,38,0.2)":"#fecaca"):(dark?"rgba(99,102,241,0.2)":"#c7d2fe")}`,backdropFilter:"blur(12px)"}}><span>{a.type==="warning"?"⚠️":a.type==="critical"?"🚨":"ℹ️"} {a.message}</span></div>)}
    </div>
    <ErrorBoundary t={t} key={pg}>
    {pg==="overview"&&<Overview t={t} dark={dark} orders={MOCK_ORDERS} users={MOCK_USERS} tickets={MOCK_TICKETS} activity={activityLog}/>}
    {pg==="orders"&&<AllOrders t={t} dark={dark} orders={MOCK_ORDERS} Btn={Btn} FilterBtn={FilterBtn} notify={notify}/>}
    {pg==="users"&&<UsersPage t={t} dark={dark} users={MOCK_USERS} Btn={Btn} FilterBtn={FilterBtn} notify={notify}/>}
    {pg==="services"&&<ServiceMgmt t={t} dark={dark} services={MOCK_SERVICES} Btn={Btn} notify={notify}/>}
    {pg==="api"&&<ApiSettings t={t} dark={dark} Btn={Btn} notify={notify}/>}
    {pg==="payments"&&<PaymentsPage t={t} dark={dark} gateways={gateways} setGateways={setGateways} Btn={Btn} FilterBtn={FilterBtn} notify={notify} logAction={logAction} isSuperAdmin={currentAdmin.role==="superadmin"}/>}
    {pg==="tickets"&&<TicketsPage t={t} dark={dark} tickets={MOCK_TICKETS} Btn={Btn} FilterBtn={FilterBtn} notify={notify}/>}
    {pg==="activity"&&<ActivityLog t={t} dark={dark} activity={activityLog}/>}
    {pg==="analytics"&&<AnalyticsPage t={t} dark={dark} orders={MOCK_ORDERS} users={MOCK_USERS} Btn={Btn}/>}
    {pg==="maintenance"&&<MaintenancePage t={t} dark={dark} maint={maint} setMaint={setMaint} Btn={Btn} notify={notify} logAction={logAction} isSuperAdmin={currentAdmin.role==="superadmin"}/>}
    {pg==="alerts"&&<AlertsPage t={t} dark={dark} alerts={alerts} setAlerts={setAlerts} Btn={Btn} FilterBtn={FilterBtn} notify={notify} isSuperAdmin={currentAdmin.role==="superadmin"} currentAdmin={currentAdmin} logAction={logAction}/>}
    {pg==="coupons"&&<CouponsPage t={t} dark={dark} Btn={Btn} FilterBtn={FilterBtn} notify={notify} logAction={logAction}/>}
    {pg==="notifications"&&<NotificationsPage t={t} dark={dark} Btn={Btn} notify={notify} logAction={logAction} users={MOCK_USERS}/>}
    {pg==="team"&&<AdminRoles t={t} dark={dark} admins={adminList} setAdmins={setAdminList} Btn={Btn} FilterBtn={FilterBtn} notify={notify} isSuperAdmin={currentAdmin.role==="superadmin"} logAction={logAction}/>}
    {pg==="settings"&&<SiteSettingsPage t={t} dark={dark} settings={siteSettings} setSettings={setSiteSettings} Btn={Btn} notify={notify} logAction={logAction}/>}
    </ErrorBoundary>
    <footer style={{borderTop:`1px solid ${t.surfaceBorder}`,marginTop:40,padding:"24px 0 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
        <div style={{fontSize:12,color:t.textMuted}}>© 2026 BoostPanel. All rights reserved.</div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
          <div style={{display:"flex",gap:16}}>{["Twitter","Instagram"].map(s=><a key={s} href="#" style={{fontSize:12,color:t.textSoft,textDecoration:"none"}}>{s}</a>)}</div>
          <div style={{display:"flex",gap:16}}>{[["Terms","/terms"],["Privacy","/privacy"],["Refund","/refund"],["Cookie","/cookie"]].map(([l,h])=><a key={l} href={h} style={{fontSize:11,color:t.textMuted,textDecoration:"none"}}>{l}</a>)}</div>
        </div>
      </div>
    </footer>
  </main></div>);
}

function Overview({t,dark,orders,users,tickets,activity}){const rev=orders.reduce((a,o)=>a+o.charge,0),cost=orders.reduce((a,o)=>a+o.cost,0),profit=rev-cost;return <div><Hdr title="Overview" sub="Business performance at a glance" t={t}/><div className="sg" style={{marginBottom:24}}><Stat l="Revenue" v={fN(rev)} c={t.green} ic="💰" t={t} dark={dark}/><Stat l="Profit" v={fN(profit)} sub={`${Math.round(profit/rev*100)}% margin`} c={t.accent} ic="📈" d={.05} t={t} dark={dark}/><Stat l="Users" v={users.length} sub={`${users.filter(u=>u.status==="Active").length} active`} c="#a5b4fc" ic="👥" d={.1} t={t} dark={dark}/><Stat l="Open Tickets" v={tickets.filter(x=>x.status==="Open").length} c="#fcd34d" ic="💬" d={.15} t={t} dark={dark}/></div><div className="g2"><Card d={.2} dark={dark}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:14}}>Recent Orders</h3>{orders.slice(0,5).map((o,i)=><div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<4?`1px solid ${t.surfaceBorder}`:"none",gap:8,flexWrap:"wrap"}}><div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:500,color:t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.user} — {o.service.split("[")[0].trim()}</div><div className="m" style={{fontSize:11,color:t.textMuted,marginTop:2}}>{o.id}</div></div><div style={{textAlign:"right",flexShrink:0}}><Badge s={o.status} dark={dark}/><div className="m" style={{fontSize:11,color:t.green,marginTop:3}}>{fN(o.charge)}</div></div></div>)}</Card><Card d={.25} dark={dark}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:14}}>Recent Admin Activity</h3>{activity.slice(0,6).map((a,i)=><div key={a.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 0",borderBottom:i<5?`1px solid ${t.surfaceBorder}`:"none"}}><span style={{fontSize:16,flexShrink:0,marginTop:1}}>{ATYPE[a.type]||"📝"}</span><div><div style={{fontSize:13,color:t.text}}><span style={{fontWeight:600}}>{a.admin}</span> {a.action}</div><div style={{fontSize:11,color:t.textMuted,marginTop:2}}>{fD(a.time)}</div></div></div>)}</Card></div></div>;}

function AllOrders({t,dark,orders,Btn,FilterBtn,notify}){
  const [oPage,setOPage]=useState(1);const [oPerPage,setOPerPage]=useState(10);const [f,setF]=useState("all");const [q,setQ]=useState("");const list=orders.filter(o=>(f==="all"||o.status===f)&&(!q||o.id.toLowerCase().includes(q.toLowerCase())||o.user.toLowerCase().includes(q.toLowerCase())));const bulkActions=()=>{if(f==="all")return null;const count=list.length;if(f==="Processing")return <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Btn onClick={()=>notify(`Checking ${count} processing orders...`)}>🔄 Check All ({count})</Btn><Btn onClick={()=>notify(`Cancelling ${count}...`,true)} style={{color:t.red}}>✕ Cancel All ({count})</Btn></div>;if(f==="Pending")return <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Btn onClick={()=>notify(`Checking ${count} pending...`)}>🔄 Check All ({count})</Btn><Btn onClick={()=>notify(`Cancelling ${count}...`,true)} style={{color:t.red}}>✕ Cancel All ({count})</Btn></div>;if(f==="Completed")return <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Btn onClick={()=>notify(`Refilling ${count}...`)}>🔁 Refill All ({count})</Btn><Btn onClick={()=>notify(`Checking ${count}...`)}>🔄 Check All ({count})</Btn></div>;if(f==="Partial")return <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Btn onClick={()=>notify(`Refilling ${count}...`)}>🔁 Refill All ({count})</Btn><Btn onClick={()=>notify(`Checking ${count}...`)}>🔄 Check All ({count})</Btn><Btn onClick={()=>notify(`Cancelling ${count}...`,true)} style={{color:t.red}}>✕ Cancel All ({count})</Btn></div>;if(f==="Canceled")return <div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Btn onClick={()=>notify(`Re-ordering ${count}...`)}>🔄 Re-order All ({count})</Btn></div>;return null;};return <div><Hdr title="All Orders" sub={`${orders.length} orders`} t={t} action={bulkActions()}/><div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>{["all","Completed","Processing","Pending","Partial","Canceled"].map(x=><FilterBtn key={x} active={f===x} onClick={()=>{setF(x);setOPage(1);}}>{x==="all"?"All":x} ({orders.filter(o=>x==="all"||o.status===x).length})</FilterBtn>)}</div>{f==="all"&&<div style={{padding:"10px 14px",borderRadius:10,background:t.accentLight,border:`1px solid ${t.accentBorder}`,marginBottom:14,fontSize:13,color:t.accent}}>💡 Select a category to see bulk actions</div>}<input placeholder="Search..." value={q} onChange={e=>setQ(e.target.value)} style={{width:"100%",maxWidth:400,padding:"10px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:13,marginBottom:16,outline:"none"}}/>{list.slice((oPage-1)*oPerPage,oPage*oPerPage).map(o=><Card key={o.id} dark={dark} style={{marginBottom:10,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}><div style={{flex:1,minWidth:200}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}><span className="m" style={{fontSize:12,color:t.accent}}>{o.id}</span><Badge s={o.status} dark={dark}/></div><div style={{fontSize:14,fontWeight:500,color:t.text}}>{o.service.split("[")[0].trim()}</div><div style={{fontSize:12,color:t.textMuted,marginTop:3}}>by {o.user} • {o.quantity.toLocaleString()} qty • {fD(o.created)}</div></div><div style={{textAlign:"right",flexShrink:0}}><div className="m" style={{fontSize:15,fontWeight:700,color:t.green}}>{fN(o.charge)}</div><div className="m" style={{fontSize:11,color:t.textMuted}}>cost {fN(o.cost)} • profit {fN(o.charge-o.cost)}</div><div style={{display:"flex",gap:6,marginTop:8,justifyContent:"flex-end",flexWrap:"wrap"}}><Btn onClick={()=>notify("Status refreshed")}>🔄 Check</Btn>{o.status!=="Completed"&&o.status!=="Canceled"&&<Btn onClick={()=>notify("Cancelled",true)} style={{color:t.red}}>✕ Cancel</Btn>}<Btn onClick={()=>notify("Refill requested")}>🔁 Refill</Btn></div></div></div></Card>)}</div>;}

function UsersPage({t,dark,users,Btn,FilterBtn,notify}){
  const [uPage,setUPage]=useState(1);const [uPerPage,setUPerPage]=useState(10);const [f,setF]=useState("all");const [q,setQ]=useState("");const [creditId,setCreditId]=useState(null);const [creditAmt,setCreditAmt]=useState("");const list=users.filter(u=>(f==="all"||(f==="active"&&u.status==="Active")||(f==="suspended"&&u.status==="Suspended"))&&(!q||u.name.toLowerCase().includes(q.toLowerCase())||u.email.toLowerCase().includes(q.toLowerCase())));const doCredit=(u)=>{if(Number(creditAmt)>0){notify(`${fN(Number(creditAmt))} credited to ${u.name}`);setCreditId(null);setCreditAmt("");}};return <div><Hdr title="Users" sub={`${users.length} registered`} t={t}/><div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}><FilterBtn active={f==="all"} onClick={()=>{setF("all");setUPage(1);}}>All ({users.length})</FilterBtn><FilterBtn active={f==="active"} onClick={()=>{setF("active");setUPage(1);}}>Active ({users.filter(u=>u.status==="Active").length})</FilterBtn><FilterBtn active={f==="suspended"} onClick={()=>{setF("suspended");setUPage(1);}}>Suspended ({users.filter(u=>u.status==="Suspended").length})</FilterBtn></div><input placeholder="Search users..." value={q} onChange={e=>setQ(e.target.value)} style={{width:"100%",maxWidth:400,padding:"10px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:13,marginBottom:16,outline:"none"}}/>{list.slice((uPage-1)*uPerPage,uPage*uPerPage).map(u=><Card key={u.id} dark={dark} style={{marginBottom:10,padding:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}><div style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:180}}><div style={{width:38,height:38,borderRadius:"50%",background:`hsl(${u.id*45},40%,${dark?30:60}%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#fff",flexShrink:0}}>{u.name[0]}</div><div><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontSize:14,fontWeight:600,color:t.text}}>{u.name}</span><Badge s={u.status} dark={dark}/></div><div style={{fontSize:12,color:t.textMuted,marginTop:2}}>{u.email}</div></div></div><div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}><div style={{textAlign:"center"}}><div className="m" style={{fontSize:14,fontWeight:700,color:t.green}}>{fN(u.balance)}</div><div style={{fontSize:10,color:t.textMuted}}>Balance</div></div><div style={{textAlign:"center"}}><div className="m" style={{fontSize:14,fontWeight:700,color:t.text}}>{u.orders}</div><div style={{fontSize:10,color:t.textMuted}}>Orders</div></div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Btn onClick={()=>{setCreditId(creditId===u.id?null:u.id);setCreditAmt("");}}>💰 Credit</Btn><Btn onClick={()=>notify(u.status==="Active"?`${u.name} suspended`:`${u.name} reactivated`)} style={{color:u.status==="Active"?t.red:t.green}}>{u.status==="Active"?"🚫 Suspend":"✓ Activate"}</Btn></div></div></div>{creditId===u.id&&<div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${t.surfaceBorder}`,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><input type="number" placeholder="Amount" value={creditAmt} onChange={e=>setCreditAmt(e.target.value)} className="m" style={{flex:1,minWidth:120,padding:"10px 12px",borderRadius:8,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/>{[1000,5000,10000,50000].map(p=><button key={p} onClick={()=>setCreditAmt(String(p))} className="m" style={{padding:"8px 10px",borderRadius:8,fontSize:11,fontWeight:600,background:Number(creditAmt)===p?t.accentLight:t.btnSecondary,color:Number(creditAmt)===p?t.accent:t.textSoft,border:`1px solid ${t.btnSecBorder}`}}>₦{p.toLocaleString()}</button>)}<Btn primary onClick={()=>{if(Number(creditAmt)>0){const btn=event?.target;if(btn)btn.disabled=true;doCredit(u);}}}>Credit {creditAmt?fN(Number(creditAmt)):""}</Btn><button onClick={()=>setCreditId(null)} style={{background:"none",color:t.textMuted,fontSize:16,padding:4}}>✕</button></div>}</Card>)}</div>;}

function ServiceMgmt({t,dark,services,Btn,notify}){return <div><Hdr title="Services" sub={`${services.length} configured`} t={t} action={<div style={{display:"flex",gap:8}}><Btn primary onClick={()=>notify("Synced")}>🔄 Sync</Btn><Btn onClick={()=>notify("Coming soon")}>+ Add</Btn></div>}/><div className="dtable"><Card style={{padding:0,overflow:"hidden",overflowX:"auto"}} dark={dark}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{borderBottom:`1px solid ${t.surfaceBorder}`}}>{["ID","Service","API","Cost/1K","Sell/1K","Markup","Refill","Status"].map(h=><th key={h} style={{padding:"12px 14px",textAlign:"left",fontSize:10,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>{h}</th>)}</tr></thead><tbody>{services.map(s=><tr key={s.id} style={{borderBottom:`1px solid ${dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.04)"}`}}><td className="m" style={{padding:"12px 14px",color:t.textMuted}}>{s.id}</td><td style={{padding:"12px 14px",color:t.text}}>{s.name}</td><td className="m" style={{padding:"12px 14px",color:t.textMuted}}>{s.apiId}</td><td className="m" style={{padding:"12px 14px",color:t.red}}>{fN(s.costPer1k)}</td><td className="m" style={{padding:"12px 14px",color:t.green}}>{fN(s.sellPer1k)}</td><td className="m" style={{padding:"12px 14px",color:"#e0a458",fontWeight:600}}>{s.markup}%</td><td style={{padding:"12px 14px",color:s.refill?t.green:t.textMuted}}>{s.refill?"✓":"—"}</td><td style={{padding:"12px 14px"}}><span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:4,background:s.enabled?t.green+"18":t.textMuted+"18",color:s.enabled?t.green:t.textMuted}}>{s.enabled?"Active":"Off"}</span></td></tr>)}</tbody></table></Card></div><div className="mcard">{services.map(s=><Card key={s.id} dark={dark} style={{marginBottom:10,padding:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:13,fontWeight:500,color:t.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span><span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:4,background:s.enabled?t.green+"18":t.textMuted+"18",color:s.enabled?t.green:t.textMuted}}>{s.enabled?"Active":"Off"}</span></div><div style={{display:"flex",gap:12,fontSize:11,color:t.textMuted,flexWrap:"wrap"}}><span>Cost: <span className="m" style={{color:t.red}}>{fN(s.costPer1k)}</span></span><span>Sell: <span className="m" style={{color:t.green}}>{fN(s.sellPer1k)}</span></span><span>Markup: <span className="m" style={{color:"#e0a458"}}>{s.markup}%</span></span></div></Card>)}</div><Card dark={dark} style={{marginTop:16}}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:12}}>Global Markup</h3><div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><input defaultValue="54" className="m" style={{width:80,padding:"10px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:16,fontWeight:600,textAlign:"center",outline:"none"}}/><span style={{fontSize:14,color:t.textSoft}}>%</span><Btn primary onClick={()=>notify("Updated")}>Apply</Btn></div></Card></div>;}

function ApiSettings({t,dark,Btn,notify}){return <div><Hdr title="API Settings" sub="MoreThanPanel" t={t}/><div className="g2"><Card dark={dark}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:18}}>Connection</h3>{[["API URL","https://morethanpanel.com/api/v2"],["API Key","••••••••••••"],["Status","Connected ✓"]].map(([l,v],i)=><div key={i} style={{marginBottom:14}}><label style={{fontSize:10,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1.5,display:"block",marginBottom:4}}>{l}</label><div className="m" style={{padding:"10px 14px",borderRadius:8,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:l==="Status"?t.green:t.textSoft,fontSize:12,wordBreak:"break-all"}}>{v}</div></div>)}<div style={{display:"flex",gap:8}}><Btn primary onClick={()=>notify("OK!")}>🔌 Test</Btn><Btn onClick={()=>notify("Saved")}>Save</Btn></div></Card><Card dark={dark}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:18}}>Balance</h3><div style={{textAlign:"center",marginBottom:18}}><div className="m" style={{fontSize:28,fontWeight:700,color:t.green}}>{fN(752300)}</div></div>{[["Orders Today","142"],["This Week","894"],["Failed (7d)","3"]].map(([l,v],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:i<2?`1px solid ${t.surfaceBorder}`:"none"}}><span style={{fontSize:13,color:t.textSoft}}>{l}</span><span className="m" style={{fontSize:13,color:t.text}}>{v}</span></div>)}<Btn primary onClick={()=>notify("Refreshed")} style={{marginTop:14,width:"100%",display:"flex",justifyContent:"center"}}>🔄 Refresh</Btn></Card></div></div>;}

function PaystackSettings({t,dark,Btn,notify}){return <div><Hdr title="Paystack" sub="Payment config" t={t}/><div className="g2"><Card dark={dark}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:18}}>API Keys</h3>{[["Public Key","pk_live_••••••••"],["Secret Key","sk_live_••••••••"],["Webhook URL","https://boostpanel.ng/api/paystack/webhook"],["Webhook Secret","whsec_••••••••"]].map(([l,v],i)=><div key={i} style={{marginBottom:14}}><label style={{fontSize:10,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1.5,display:"block",marginBottom:4}}>{l}</label><div className="m" style={{padding:"10px 14px",borderRadius:8,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.textSoft,fontSize:11,wordBreak:"break-all"}}>{v}</div></div>)}<div style={{display:"flex",gap:8}}><Btn primary onClick={()=>notify("Verified!")}>✓ Verify</Btn><Btn onClick={()=>notify("Saved")}>Save</Btn></div></Card><Card dark={dark}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:18}}>Currency</h3>{[["Currency","NGN"],["USD → NGN","₦1,550"],["Min Deposit","₦500"],["Max Deposit","₦5,000,000"]].map(([l,v],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"11px 0",borderBottom:i<3?`1px solid ${t.surfaceBorder}`:"none"}}><span style={{fontSize:13,color:t.textSoft}}>{l}</span><span className="m" style={{fontSize:13,color:t.text}}>{v}</span></div>)}<div style={{marginTop:16}}><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><input defaultValue="1550" className="m" style={{flex:1,minWidth:100,padding:"10px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/><Btn primary onClick={()=>notify("Updated")}>Update</Btn></div></div></Card></div></div>;}

function TicketsPage({t,dark,tickets,Btn,FilterBtn,notify}){const [f,setF]=useState("all");const [sel,setSel]=useState(null);const [tPage,setTPage]=useState(1);const [tPerPage,setTPerPage]=useState(10);const list=tickets.filter(tk=>f==="all"||tk.status===f);return <div><Hdr title="Tickets" sub={`${tickets.filter(x=>x.status==="Open").length} open`} t={t}/><div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>{["all","Open","In Progress","Resolved"].map(x=><FilterBtn key={x} active={f===x} onClick={()=>setF(x)}>{x==="all"?"All":x}</FilterBtn>)}</div><div className="g2"><Card style={{padding:0,overflow:"hidden"}} dark={dark}>{list.slice((tPage-1)*tPerPage,tPage*tPerPage).map((tk,i)=><button key={tk.id} onClick={()=>setSel(tk)} style={{width:"100%",padding:"14px 18px",borderBottom:i<list.length-1?`1px solid ${t.surfaceBorder}`:"none",textAlign:"left",background:sel?.id===tk.id?t.accentLight:"transparent",display:"block"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:6}}><span className="m" style={{fontSize:12,color:t.accent}}>{tk.id}</span><Badge s={tk.status} dark={dark}/></div><div style={{fontSize:13,fontWeight:500,color:t.text}}>{tk.subject}</div><div style={{fontSize:12,color:t.textMuted,marginTop:2}}>{tk.user} • {fD(tk.created)}</div></button>)}</Card><Card dark={dark}>{sel?<><h3 style={{fontSize:16,fontWeight:600,color:t.text,marginBottom:4}}>{sel.subject}</h3><div style={{fontSize:12,color:t.textMuted,marginBottom:14}}>From: {sel.user} ({sel.email})</div><div style={{padding:14,borderRadius:12,background:dark?"#0d1020":"#faf8f5",border:`1px solid ${t.surfaceBorder}`,marginBottom:14}}><div style={{fontSize:13,color:t.text,lineHeight:1.6}}>{sel.message}</div></div>{sel.replies.map((r,i)=><div key={i} style={{padding:12,borderRadius:12,background:t.accentLight,border:`1px solid ${t.accentBorder}`,marginBottom:8}}><div style={{fontSize:11,color:t.accent,fontWeight:600,marginBottom:3}}>Admin • {fD(r.time)}</div><div style={{fontSize:13,color:t.text}}>{r.msg}</div></div>)}<textarea placeholder="Reply..." rows={3} style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,marginBottom:10,outline:"none",resize:"vertical"}}/><div style={{display:"flex",gap:8}}><Btn primary onClick={()=>{notify("Sending...");setTimeout(()=>notify("Reply sent!"),600)}}>📩 Send</Btn>{sel.status!=="Resolved"&&<Btn onClick={()=>notify("Resolved")}>✓ Resolve</Btn>}</div></>:<div style={{textAlign:"center",padding:"50px 0",color:t.textMuted}}>Select a ticket</div>}</Card></div></div>;}

function ActivityLog({t,dark,activity}){
  const [q,setQ]=useState("");const [af,setAf]=useState("all");const [page,setPage]=useState(1);const [perPage,setPerPage]=useState(10);
  const admins=[...new Set(activity.map(a=>a.admin))];
  const filtered=activity.filter(a=>(af==="all"||a.admin===af)&&(!q||a.action.toLowerCase().includes(q.toLowerCase())||a.admin.toLowerCase().includes(q.toLowerCase())));
  const list=filtered.slice((page-1)*perPage,page*perPage);
  const setFilter=(v)=>{setAf(v);setPage(1);};
  return <div><Hdr title="Activity Log" sub={`${activity.length} total actions`} t={t}/>
    <input placeholder="Search actions, admins..." value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} style={{width:"100%",maxWidth:400,padding:"10px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:13,marginBottom:12,outline:"none"}}/>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}><button onClick={()=>setFilter("all")} style={{padding:"8px 14px",borderRadius:8,fontSize:13,fontWeight:500,background:af==="all"?t.accentLight:"transparent",color:af==="all"?t.accent:t.textSoft,border:`1px solid ${t.btnSecBorder}`,boxShadow:af==="all"?t.accentShadow:"none"}}>All Admins</button>{admins.map(a=><button key={a} onClick={()=>setFilter(a)} style={{padding:"8px 14px",borderRadius:8,fontSize:13,fontWeight:500,background:af===a?t.accentLight:"transparent",color:af===a?t.accent:t.textSoft,border:`1px solid ${t.btnSecBorder}`,boxShadow:af===a?t.accentShadow:"none"}}>{a}</button>)}</div>
    <Card style={{padding:0,overflow:"hidden"}} dark={dark}>
      {list.length===0&&<div style={{padding:40,textAlign:"center",color:t.textMuted}}>No matching activity</div>}
      {list.map((a,i)=><div key={a.id} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"16px 20px",borderBottom:i<list.length-1?`1px solid ${t.surfaceBorder}`:"none"}}><div style={{width:36,height:36,borderRadius:10,background:t.accentLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{ATYPE[a.type]||"📝"}</div><div style={{flex:1}}><div style={{fontSize:14,color:t.text}}><span style={{fontWeight:600}}>{a.admin}</span></div><div style={{fontSize:13,color:t.textSoft,marginTop:2}}>{a.action}</div><div style={{fontSize:11,color:t.textMuted,marginTop:3}}>{fD(a.time)}</div></div></div>)}
    </Card>
    <Pagination total={filtered.length} page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} t={t}/>
  </div>;
}

function AdminRoles({t,dark,admins,setAdmins,Btn,FilterBtn,notify,isSuperAdmin,logAction}){
  const [editingId,setEditingId]=useState(null);
  const allPages=["overview","orders","users","services","api","paystack","tickets","admins","activity","alerts"];
  const togglePage=(adminId,page)=>{setAdmins(p=>p.map(a=>{if(a.id!==adminId)return a;const current=a.customPages||ROLES[a.role].pages;const next=current.includes(page)?current.filter(x=>x!==page):[...current,page];return{...a,customPages:next};}));};
  const getPages=(a)=>a.customPages||ROLES[a.role].pages;
  const resetPerms=(adminId)=>{const admin=admins.find(a=>a.id===adminId);setAdmins(p=>p.map(a=>a.id===adminId?{...a,customPages:null}:a));if(admin)logAction(`Reset permissions for ${admin.name} to ${ROLES[admin.role].label} defaults`,"admin");notify("Permissions reset to default");};
  return <div><Hdr title="Admin Roles" sub="Manage access" t={t} action={isSuperAdmin?<Btn primary onClick={()=>notify("Invite sent!")}>+ Invite Admin</Btn>:null}/><Card dark={dark} style={{marginBottom:20}}><h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:14}}>Role Permissions</h3><div className="role-grid">{Object.entries(ROLES).map(([key,r])=><div key={key} style={{padding:14,borderRadius:14,background:dark?"#0d1020":"#faf8f5",border:`1px solid ${t.surfaceBorder}`}}><div style={{fontSize:14,fontWeight:600,color:r.color,marginBottom:8}}>{r.label}</div>{r.pages.map(p=><div key={p} style={{fontSize:12,color:t.textSoft,display:"flex",alignItems:"center",gap:6,marginBottom:3}}><span style={{color:t.green,fontSize:10}}>✓</span>{p[0].toUpperCase()+p.slice(1)}</div>)}</div>)}</div></Card>{!isSuperAdmin&&<div style={{padding:"14px 18px",borderRadius:12,background:t.accentLight,border:`1px solid ${t.accentBorder}`,marginBottom:20,fontSize:13,color:t.accent}}>🔒 Only the Super Admin can invite, remove, or reset passwords for admins.</div>}{admins.map(a=><Card key={a.id} dark={dark} style={{marginBottom:10,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:180}}><div style={{width:38,height:38,borderRadius:"50%",background:ROLES[a.role].color+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:ROLES[a.role].color,flexShrink:0}}>{a.name[0]}</div><div><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontSize:14,fontWeight:600,color:t.text}}>{a.name}</span><Badge s={a.status} dark={dark}/>{a.customPages&&<span style={{fontSize:10,fontWeight:600,padding:"2px 6px",borderRadius:4,background:dark?"rgba(217,119,6,0.1)":"#fffbeb",color:dark?"#fcd34d":"#92400e"}}>Custom</span>}</div><div style={{fontSize:12,color:t.textMuted,marginTop:2}}>{a.email}</div></div></div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:4,background:ROLES[a.role].color+"22",color:ROLES[a.role].color}}>{ROLES[a.role].label}</span>
          <span style={{fontSize:12,color:t.textMuted}}>{fD(a.lastActive)}</span>
          {isSuperAdmin&&a.id!==1&&<Btn onClick={()=>setEditingId(editingId===a.id?null:a.id)}>{editingId===a.id?"Done":"🔧 Permissions"}</Btn>}
          {isSuperAdmin&&a.id!==1&&<Btn onClick={()=>notify(`Password reset sent to ${a.name}`)}>🔑 Reset PW</Btn>}
          {isSuperAdmin&&a.id!==1&&<Btn onClick={()=>notify(`${a.name} removed`)} style={{color:t.red}}>Remove</Btn>}
        </div>
      </div>
      {/* Permission editor — inline */}
      {isSuperAdmin&&editingId===a.id&&a.id!==1&&<div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${t.surfaceBorder}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:12,fontWeight:600,color:t.text}}>Page Access</span>{a.customPages&&<button onClick={()=>resetPerms(a.id)} style={{background:"none",color:t.accent,fontSize:11,fontWeight:500}}>Reset to {ROLES[a.role].label} defaults</button>}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{allPages.map(pg=>{const has=getPages(a).includes(pg);return <button key={pg} onClick={()=>togglePage(a.id,pg)} style={{padding:"7px 14px",borderRadius:8,fontSize:12,fontWeight:500,background:has?(dark?"rgba(110,231,183,0.1)":"#ecfdf5"):(dark?"rgba(255,255,255,0.03)":"rgba(0,0,0,0.02)"),color:has?t.green:t.textMuted,border:`1px solid ${has?(dark?"rgba(110,231,183,0.2)":"#a7f3d0"):t.btnSecBorder}`}}>{has?"✓":"✗"} {pg[0].toUpperCase()+pg.slice(1)}</button>})}</div>
      </div>}
    </Card>)}</div>;}


function MaintenancePage({t,dark,maint,setMaint,Btn,notify,logAction,isSuperAdmin}){
  const [msg,setMsg]=useState(maint.message);
  const [eta,setEta]=useState(maint.estimatedReturn);
  const toggle=()=>{
    const next=!maint.enabled;
    setMaint(p=>({...p,enabled:next,message:msg,estimatedReturn:eta}));
    logAction(next?"Enabled maintenance mode":"Disabled maintenance mode","settings");
    notify(next?"🔧 Maintenance mode ON — site is now down for users":"✅ Maintenance mode OFF — site is live");
  };
  const save=()=>{setMaint(p=>({...p,message:msg,estimatedReturn:eta}));notify("Settings saved");};
  return <div>
    <Hdr title="Maintenance Mode" sub="Take the site offline for users" t={t}/>
    {/* Status banner */}
    <div style={{padding:"16px 20px",borderRadius:14,marginBottom:24,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,background:maint.enabled?(dark?"rgba(252,165,165,0.08)":"#fef2f2"):(dark?"rgba(110,231,183,0.08)":"#ecfdf5"),border:`1px solid ${maint.enabled?(dark?"rgba(252,165,165,0.15)":"#fecaca"):(dark?"rgba(110,231,183,0.15)":"#a7f3d0")}`}}>
      <div>
        <div style={{fontSize:16,fontWeight:600,color:maint.enabled?t.red:t.green}}>{maint.enabled?"🔴 Site is OFFLINE":"🟢 Site is LIVE"}</div>
        <div style={{fontSize:13,color:t.textSoft,marginTop:2}}>{maint.enabled?"Users see the maintenance page instead of the app":"Everything is running normally"}</div>
      </div>
      <button onClick={toggle} style={{padding:"10px 24px",borderRadius:10,fontSize:14,fontWeight:600,background:maint.enabled?t.btnPrimary:(dark?"rgba(252,165,165,0.1)":"#fef2f2"),color:maint.enabled?"#fff":t.red,border:maint.enabled?"none":`1px solid ${dark?"rgba(252,165,165,0.2)":"#fecaca"}`}}>{maint.enabled?"🟢 Go Live":"🔴 Enable Maintenance"}</button>
    </div>
    {/* Settings */}
    <Card dark={dark} style={{marginBottom:20}}>
      <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:16}}>Maintenance Page Settings</h3>
      <div style={{marginBottom:16}}>
        <label style={{fontSize:10,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1.5,display:"block",marginBottom:6}}>Message shown to users</label>
        <textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={3} style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",resize:"vertical"}}/>
      </div>
      <div style={{marginBottom:16}}>
        <label style={{fontSize:10,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1.5,display:"block",marginBottom:6}}>Estimated Return Time</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {["~15 minutes","~30 minutes","~1 hour","~2 hours","No ETA"].map(v=><button key={v} onClick={()=>setEta(v)} style={{padding:"8px 14px",borderRadius:8,fontSize:12,fontWeight:500,background:eta===v?t.accentLight:"transparent",color:eta===v?t.accent:t.textMuted,border:`1px solid ${t.btnSecBorder}`,boxShadow:eta===v?t.accentShadow:"none"}}>{v}</button>)}
          <input placeholder="Custom time..." value={["~15 minutes","~30 minutes","~1 hour","~2 hours","No ETA"].includes(eta)?"":eta} onChange={e=>setEta(e.target.value)} style={{padding:"8px 14px",borderRadius:8,fontSize:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,outline:"none",width:140}}/>
        </div>
      </div>
      <Btn primary onClick={save}>Save Settings</Btn>
    </Card>
    {/* Preview */}
    <Card dark={dark}>
      <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:16}}>Preview</h3>
      <div style={{borderRadius:14,overflow:"hidden",border:`1px solid ${t.surfaceBorder}`}}>
        <div style={{padding:"32px 24px",background:dark?"#060912":"#f0ece6",textAlign:"center"}}>
          <div style={{width:40,height:40,borderRadius:"50%",border:`2px solid ${t.surfaceBorder}`,borderTopColor:t.accent,margin:"0 auto 16px"}}/>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,marginBottom:14}}>
            <div style={{width:28,height:28,borderRadius:8,background:t.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#fff"}}>B</div>
            <span className="serif" style={{fontSize:16,fontWeight:600,color:t.text}}>BoostPanel</span>
          </div>
          <h2 className="serif" style={{fontSize:22,fontWeight:600,color:t.text,marginBottom:6}}>Under Maintenance</h2>
          <p style={{fontSize:13,color:t.textSoft,lineHeight:1.6,marginBottom:10,maxWidth:360,margin:"0 auto 10px"}}>{msg}</p>
          <div style={{padding:10,borderRadius:8,background:dark?"#0a0d18":"#faf8f5",border:`1px solid ${t.surfaceBorder}`,display:"inline-block"}}>
            <div style={{fontSize:9,color:t.textMuted,textTransform:"uppercase",letterSpacing:1.5,marginBottom:3}}>Estimated Return</div>
            <div className="m" style={{fontSize:16,fontWeight:700,color:t.green}}>{eta}</div>
          </div>
        </div>
      </div>
    </Card>
  </div>;
}

function PaymentGateways({t,dark,gateways,setGateways,Btn,notify,logAction,isSuperAdmin}){
  const toggleGateway=(id)=>{
    if(!isSuperAdmin){notify("Only Super Admin can change gateways",true);return;}
    const gw=gateways.find(g=>g.id===id);
    const enabled=gateways.filter(g=>g.enabled);
    if(gw.enabled&&enabled.length<=1){notify("At least one gateway must be active",true);return;}
    setGateways(p=>p.map(g=>g.id===id?{...g,enabled:!g.enabled}:g));
    logAction(`${gw.enabled?"Disabled":"Enabled"} ${gw.name} payment gateway`,"settings");
    notify(`${gw.name} ${gw.enabled?"disabled":"enabled"}`);
  };
  const movePriority=(id,dir)=>{
    if(!isSuperAdmin)return;
    const idx=gateways.findIndex(g=>g.id===id);
    if((dir===-1&&idx===0)||(dir===1&&idx===gateways.length-1))return;
    const next=[...gateways];
    [next[idx],next[idx+dir]]=[next[idx+dir],next[idx]];
    next.forEach((g,i)=>g.priority=i+1);
    setGateways(next);
  };
  return <div>
    <Hdr title="Payment Gateways" sub="Manage available payment methods" t={t}/>
    {!isSuperAdmin&&<div style={{padding:"14px 18px",borderRadius:12,background:t.accentLight,border:`1px solid ${t.accentBorder}`,marginBottom:20,fontSize:13,color:t.accent}}>🔒 Only the Super Admin can enable/disable payment gateways.</div>}
    <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
      <div style={{padding:"10px 16px",borderRadius:10,background:dark?"rgba(110,231,183,0.08)":"#ecfdf5",border:`1px solid ${dark?"rgba(110,231,183,0.15)":"#a7f3d0"}`,fontSize:13,color:t.green}}>{gateways.filter(g=>g.enabled).length} active</div>
      <div style={{padding:"10px 16px",borderRadius:10,background:t.btnSecondary,border:`1px solid ${t.btnSecBorder}`,fontSize:13,color:t.textMuted}}>{gateways.filter(g=>!g.enabled).length} disabled</div>
    </div>
    {gateways.map((g,i)=><Card key={g.id} dark={dark} style={{marginBottom:12,padding:18,border:g.enabled?`1px solid ${dark?"rgba(110,231,183,0.15)":"#a7f3d0"}`:undefined,opacity:g.enabled?1:0.6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div style={{display:"flex",alignItems:"center",gap:14,flex:1,minWidth:200}}>
          <div style={{fontSize:28}}>{g.icon}</div>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:16,fontWeight:600,color:t.text}}>{g.name}</span>
              {g.enabled?<span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:4,background:dark?"rgba(110,231,183,0.1)":"#ecfdf5",color:t.green}}>● Active</span>:<span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:4,background:dark?"rgba(255,255,255,0.04)":"#f5f5f5",color:t.textMuted}}>Disabled</span>}
              <span className="m" style={{fontSize:10,color:t.textMuted}}>Priority #{g.priority}</span>
            </div>
            <div style={{fontSize:13,color:t.textSoft,marginTop:3}}>{g.desc}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {isSuperAdmin&&<><button onClick={()=>movePriority(g.id,-1)} disabled={i===0} style={{width:30,height:30,borderRadius:6,background:t.btnSecondary,color:i===0?t.textMuted:t.textSoft,border:`1px solid ${t.btnSecBorder}`,fontSize:14,opacity:i===0?.4:1}}>↑</button>
          <button onClick={()=>movePriority(g.id,1)} disabled={i===gateways.length-1} style={{width:30,height:30,borderRadius:6,background:t.btnSecondary,color:i===gateways.length-1?t.textMuted:t.textSoft,border:`1px solid ${t.btnSecBorder}`,fontSize:14,opacity:i===gateways.length-1?.4:1}}>↓</button></>}
          {isSuperAdmin&&<button onClick={()=>toggleGateway(g.id)} style={{padding:"8px 18px",borderRadius:8,fontSize:12,fontWeight:600,background:g.enabled?(dark?"rgba(252,165,165,0.1)":"#fef2f2"):(dark?"rgba(110,231,183,0.1)":"#ecfdf5"),color:g.enabled?t.red:t.green,border:`1px solid ${g.enabled?(dark?"rgba(252,165,165,0.2)":"#fecaca"):(dark?"rgba(110,231,183,0.2)":"#a7f3d0")}`}}>{g.enabled?"Disable":"Enable"}</button>}
        </div>
      </div>
    </Card>)}
    <Card dark={dark} style={{marginTop:8}}>
      <div style={{fontSize:13,color:t.textMuted,lineHeight:1.7}}>
        <span style={{fontWeight:600,color:t.text}}>How it works:</span> Enabled gateways appear on the Add Funds page for users. Priority determines the display order — the first enabled gateway is pre-selected by default. At least one gateway must remain active at all times.
      </div>
    </Card>
  </div>;
}

function AlertsPage({t,dark,alerts,setAlerts,Btn,FilterBtn,notify,isSuperAdmin,currentAdmin,logAction}){
  const [msg,setMsg]=useState("");const [type,setType]=useState("info");const [target,setTarget]=useState("both");const [duration,setDuration]=useState("none");const [customUnit,setCustomUnit]=useState("h");const [f,setF]=useState("active");
  const list=alerts.filter(a=>f==="all"||( f==="active"?a.active:!a.active));
  const getExpiry=(dur)=>{if(dur==="none")return null;const ms={"1h":3600000,"6h":21600000,"24h":86400000,"3d":259200000,"7d":604800000};if(ms[dur])return new Date(Date.now()+ms[dur]).toISOString();const num=parseInt(dur);if(!num)return null;const mult=customUnit==="d"?86400000:customUnit==="m"?60000:3600000;return new Date(Date.now()+num*mult).toISOString();};
  const createAlert=()=>{if(!msg.trim())return;const newA={id:Date.now(),message:msg,type,target,active:true,createdBy:currentAdmin.name,created:new Date().toISOString(),expiresAt:getExpiry(duration)};setAlerts(p=>[newA,...p]);setMsg("");logAction(`Published ${type} alert: "${msg.slice(0,50)}${msg.length>50?'...':''}"`,"alert");notify("Alert published!");};
  const toggleAlert=(id)=>{const alert=alerts.find(a=>a.id===id);setAlerts(p=>p.map(a=>a.id===id?{...a,active:!a.active}:a));if(alert)logAction(`${alert.active?'Paused':'Activated'} alert: "${alert.message.slice(0,40)}..."`,"alert");};
  const deleteAlert=(id)=>{const alert=alerts.find(a=>a.id===id);setAlerts(p=>p.filter(a=>a.id!==id));if(alert)logAction(`Deleted alert: "${alert.message.slice(0,40)}..."`,"alert");notify("Alert deleted");};
  const typeColors={info:{bg:dark?"rgba(99,102,241,0.1)":"#eef2ff",color:dark?"#a5b4fc":"#4f46e5",border:dark?"rgba(99,102,241,0.2)":"#c7d2fe",icon:"ℹ️"},warning:{bg:dark?"rgba(217,119,6,0.1)":"#fffbeb",color:dark?"#fcd34d":"#92400e",border:dark?"rgba(217,119,6,0.2)":"#fde68a",icon:"⚠️"},critical:{bg:dark?"rgba(220,38,38,0.1)":"#fef2f2",color:dark?"#fca5a5":"#dc2626",border:dark?"rgba(220,38,38,0.2)":"#fecaca",icon:"🚨"}};
  return <div>
    <Hdr title="Alerts" sub="Broadcast messages to users" t={t}/>
    {/* Create new alert */}
    <Card dark={dark} style={{marginBottom:24}}>
      <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:16}}>New Alert</h3>
      <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Write your alert message..." rows={2} style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,marginBottom:14,outline:"none",resize:"vertical"}}/>
      <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <div>
          <div style={{fontSize:10,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>Type</div>
          <div style={{display:"flex",gap:6}}>{["info","warning","critical"].map(tp=><button key={tp} onClick={()=>setType(tp)} style={{padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:600,background:type===tp?typeColors[tp].bg:"transparent",color:type===tp?typeColors[tp].color:t.textMuted,border:`1px solid ${type===tp?typeColors[tp].border:t.btnSecBorder}`}}>{typeColors[tp].icon} {tp[0].toUpperCase()+tp.slice(1)}</button>)}</div>
        </div>
        <div>
          <div style={{fontSize:10,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>Show On</div>
          <div style={{display:"flex",gap:6}}>{[["both","🌐 Both"],["dashboard","📊 Dashboard"],["login","🔐 Login Page"]].map(([val,lb])=><button key={val} onClick={()=>setTarget(val)} style={{padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:500,background:target===val?t.accentLight:"transparent",color:target===val?t.accent:t.textMuted,border:`1px solid ${t.btnSecBorder}`,boxShadow:target===val?t.accentShadow:"none"}}>{lb}</button>)}</div>
        </div>
        <div>
          <div style={{fontSize:10,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>Duration</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>{[["none","♾️ Indefinite"],["1h","1 Hour"],["6h","6 Hours"],["24h","24 Hours"],["3d","3 Days"],["7d","7 Days"]].map(([val,lb])=><button key={val} onClick={()=>setDuration(val)} style={{padding:"6px 12px",borderRadius:8,fontSize:12,fontWeight:500,background:duration===val?t.accentLight:"transparent",color:duration===val?t.accent:t.textMuted,border:`1px solid ${t.btnSecBorder}`,boxShadow:duration===val?t.accentShadow:"none"}}>{lb}</button>)}
            <div style={{display:"flex",alignItems:"center",gap:4}}><input type="number" placeholder="Custom" value={duration.match(/^\d+$/)?duration:""} onChange={e=>{if(e.target.value)setDuration(e.target.value);else setDuration("none");}} min="1" style={{padding:"6px 10px",borderRadius:8,fontSize:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,outline:"none",width:70,textAlign:"center"}}/><select value={customUnit} onChange={e=>setCustomUnit(e.target.value)} style={{padding:"6px 8px",borderRadius:8,fontSize:12,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,outline:"none"}}><option value="h">Hours</option><option value="d">Days</option><option value="m">Minutes</option></select></div>
          </div>
        </div>
      </div>
      {/* Preview */}
      {msg&&<div style={{padding:"12px 16px",borderRadius:10,background:typeColors[type].bg,border:`1px solid ${typeColors[type].border}`,color:typeColors[type].color,fontSize:13,fontWeight:500,marginBottom:14}}>{typeColors[type].icon} {msg}</div>}
      <Btn primary onClick={createAlert}>📢 Publish Alert</Btn>
    </Card>
    {/* Active alerts list */}
    <div style={{display:"flex",gap:8,marginBottom:16}}><FilterBtn active={f==="active"} onClick={()=>{setF("active");setUPage(1);}}>Active ({alerts.filter(a=>a.active).length})</FilterBtn><FilterBtn active={f==="all"} onClick={()=>{setF("all");setUPage(1);}}>All ({alerts.length})</FilterBtn></div>
    {list.length===0&&<Card dark={dark}><div style={{textAlign:"center",padding:"30px 0",color:t.textMuted}}>No alerts</div></Card>}
    {list.map(a=>{const tc=typeColors[a.type]||typeColors.info;return <Card key={a.id} dark={dark} style={{marginBottom:10,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:200}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
            <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:4,background:tc.bg,color:tc.color,border:`1px solid ${tc.border}`}}>{tc.icon} {a.type[0].toUpperCase()+a.type.slice(1)}</span>
            <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:4,background:t.accentLight,color:t.accent}}>{a.target==="both"?"🌐 Both":a.target==="dashboard"?"📊 Dashboard":"🔐 Login"}</span>
            {a.active?<span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:4,background:dark?"rgba(110,231,183,0.1)":"#ecfdf5",color:t.green}}>● Live</span>:<span style={{fontSize:11,color:t.textMuted}}>Inactive</span>}
          </div>
          <div style={{fontSize:14,color:t.text,marginBottom:4}}>{a.message}</div>
          <div style={{fontSize:11,color:t.textMuted}}>by {a.createdBy} • {fD(a.created)}{a.expiresAt?` • Expires ${fD(a.expiresAt)}`:" • ♾️ Indefinite"}</div>
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          <Btn onClick={()=>{toggleAlert(a.id);notify(a.active?"Alert deactivated":"Alert activated")}}>{a.active?"⏸ Pause":"▶ Activate"}</Btn>
          <Btn onClick={()=>deleteAlert(a.id)} style={{color:t.red}}>✕ Delete</Btn>
        </div>
      </div>
    </Card>})}
  </div>;
}
function SiteSettingsPage({t,dark,settings,setSettings,Btn,notify,logAction}){
  const [tab,setTab]=useState("general");
  const [form,setForm]=useState({...settings});
  const upd=(k,v)=>setForm(p=>({...p,[k]:v}));
  const save=()=>{setSettings({...form});notify("Settings saved!");logAction("Updated site settings","settings");};
  const Field=({label,field,placeholder,type="text"})=><div style={{marginBottom:16}}>
    <label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>{label}</label>
    <input type={type} value={form[field]||""} onChange={e=>upd(field,e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/>
  </div>;
  const Tab=({id,label})=><button onClick={()=>setTab(id)} style={{padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:500,background:tab===id?t.accentLight:"transparent",color:tab===id?t.accent:t.textSoft,border:"1px solid transparent",boxShadow:tab===id?t.accentShadow:"none"}}>{label}</button>;
  return <div>
    <Hdr title="Settings" sub="Manage global platform settings — superadmin only" t={t} action={<Btn primary onClick={save}>💾 Save All</Btn>}/>
    <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}><Tab id="general" label="General"/><Tab id="socials" label="Socials & Contact"/><Tab id="promo" label="Promo Banner"/></div>
    {tab==="general"&&<div className="g2"><Card dark={dark}>
      <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:20}}>General</h3>
      <Field label="Site Name" field="siteName" placeholder="BoostPanel"/>
      <Field label="Support Email" field="supportEmail" placeholder="support@boostpanel.ng"/>
      <Field label="Minimum Deposit (₦)" field="minDeposit" placeholder="500" type="number"/>
      <Field label="Default Markup (%)" field="defaultMarkup" placeholder="54" type="number"/>
      <Field label="Referral Bonus (₦)" field="referralBonus" placeholder="500" type="number"/>
    </Card><Card dark={dark}>
      <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:12}}>Notes</h3>
      <div style={{fontSize:13,color:t.textSoft,lineHeight:1.7}}>
        <p style={{marginBottom:8}}>Changes here affect the entire platform immediately.</p>
        <p style={{marginBottom:8}}><strong style={{color:t.text}}>Minimum Deposit</strong> is the lowest amount users can add to their wallet.</p>
        <p style={{marginBottom:8}}><strong style={{color:t.text}}>Default Markup</strong> is applied to new services synced from the API.</p>
        <p><strong style={{color:t.text}}>Referral Bonus</strong> is credited to both referrer and new user on email verification.</p>
      </div>
    </Card></div>}
    {tab==="socials"&&<div className="g2"><Card dark={dark}>
      <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:20}}>Social & Contact</h3>
      <Field label="WhatsApp Number" field="whatsapp" placeholder="2348012345678"/>
      <div style={{fontSize:11,color:t.textMuted,marginTop:-10,marginBottom:16}}>Full number with country code, no + or spaces. Powers the floating chat icon.</div>
      <Field label="Twitter / X Handle" field="twitter" placeholder="boostpanel"/>
      <Field label="Instagram Handle" field="instagram" placeholder="boostpanel.ng"/>
    </Card><Card dark={dark}>
      <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:16}}>Preview</h3>
      <div style={{padding:16,borderRadius:12,background:dark?"#0d1020":"#faf8f5",border:`1px solid ${t.surfaceBorder}`}}>
        <div style={{fontSize:12,color:t.textMuted,marginBottom:8,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>WhatsApp</div>
        <a href={`https://wa.me/${form.whatsapp}`} target="_blank" rel="noopener" style={{fontSize:13,color:t.accent,wordBreak:"break-all"}}>wa.me/{form.whatsapp}</a>
        <div style={{fontSize:12,color:t.textMuted,marginTop:14,marginBottom:8,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Socials</div>
        <div style={{display:"flex",flexDirection:"column",gap:4}}>
          <a href={`https://twitter.com/${form.twitter}`} target="_blank" rel="noopener" style={{fontSize:13,color:t.accent}}>twitter.com/{form.twitter}</a>
          <a href={`https://instagram.com/${form.instagram}`} target="_blank" rel="noopener" style={{fontSize:13,color:t.accent}}>instagram.com/{form.instagram}</a>
        </div>
      </div>
    </Card></div>}
    {tab==="promo"&&<div className="g2"><Card dark={dark}>
      <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:20}}>Promo Banner</h3>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <span style={{fontSize:13,color:t.text,fontWeight:500}}>Show banner on homepage</span>
        <button onClick={()=>upd("promoEnabled",!form.promoEnabled)} style={{width:44,height:24,borderRadius:12,background:form.promoEnabled?t.accent:(dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)"),position:"relative",border:"none",cursor:"pointer",transition:"background 0.2s"}}><div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:form.promoEnabled?22:2,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/></button>
      </div>
      <Field label="Banner Message" field="promoMessage" placeholder="Sign up today and get 10% bonus on your first deposit."/>
      <div style={{marginBottom:16}}>
        <label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Banner Type</label>
        <div style={{display:"flex",gap:8}}>{[["info","ℹ️ Info"],["warning","⚠️ Warning"]].map(([v,lb])=><button key={v} onClick={()=>upd("promoType",v)} style={{flex:1,padding:"10px 0",borderRadius:10,fontSize:13,fontWeight:500,background:(form.promoType||"info")===v?t.accentLight:t.btnSecondary,color:(form.promoType||"info")===v?t.accent:t.textSoft,border:`1px solid ${t.btnSecBorder}`}}>{lb}</button>)}</div>
      </div>
    </Card><Card dark={dark}>
      <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:16}}>Preview</h3>
      {form.promoEnabled!==false?<div style={{padding:"10px 16px",textAlign:"center",fontSize:13,fontWeight:500,borderRadius:10,background:(form.promoType||"info")==="warning"?(dark?"rgba(217,119,6,0.15)":"#fffbeb"):(dark?"rgba(99,102,241,0.15)":"#eef2ff"),color:(form.promoType||"info")==="warning"?(dark?"#fcd34d":"#92400e"):(dark?"#a5b4fc":"#4f46e5"),border:`1px solid ${(form.promoType||"info")==="warning"?(dark?"rgba(217,119,6,0.2)":"#fde68a"):(dark?"rgba(99,102,241,0.2)":"#c7d2fe")}`}}>{(form.promoType||"info")==="warning"?"⚠️":"✨"} {form.promoMessage||"Sign up today and get 10% bonus on your first deposit."}</div>:<div style={{padding:"20px",textAlign:"center",fontSize:13,color:t.textMuted,background:dark?"#0d1020":"#faf8f5",borderRadius:10,border:`1px solid ${t.surfaceBorder}`}}>Banner is currently hidden</div>}
    </Card></div>}
  </div>;
}

function PaymentsPage({t,dark,gateways,setGateways,Btn,FilterBtn,notify,logAction,isSuperAdmin}){
  const [tab,setTab]=useState("gateways");
  const Tab=({id,label})=><button onClick={()=>setTab(id)} style={{padding:"10px 18px",borderRadius:10,fontSize:13,fontWeight:500,background:tab===id?t.accentLight:"transparent",color:tab===id?t.accent:t.textSoft,border:"1px solid transparent",boxShadow:tab===id?t.accentShadow:"none"}}>{label}</button>;
  const toggleGw=(id)=>{setGateways(p=>p.map(g=>g.id===id?{...g,enabled:!g.enabled}:g));logAction(`Toggled ${id} gateway`,"settings");};
  return <div>
    <Hdr title="Payments" sub="Payment gateways and transaction history" t={t}/>
    <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}><Tab id="gateways" label="Gateways"/><Tab id="transactions" label="Transactions"/><Tab id="paystack" label="Paystack Config"/></div>
    {tab==="gateways"&&<div>{gateways.map(g=><Card key={g.id} dark={dark} style={{marginBottom:10,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:24}}>{g.icon}</span><div><div style={{fontSize:14,fontWeight:600,color:t.text}}>{g.name}</div><div style={{fontSize:12,color:t.textMuted,marginTop:2}}>{g.desc}</div></div></div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:12,color:t.textMuted}}>Priority: {g.priority}</span>
          <Badge s={g.enabled?"Active":"Inactive"} dark={dark}/>
          {isSuperAdmin&&<button onClick={()=>{toggleGw(g.id);notify(`${g.name} ${g.enabled?"disabled":"enabled"}`);}} style={{width:44,height:24,borderRadius:12,background:g.enabled?t.accent:(dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)"),position:"relative",border:"none",cursor:"pointer",transition:"background 0.2s"}}><div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:g.enabled?22:2,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/></button>}
        </div>
      </div>
    </Card>)}</div>}
    {tab==="transactions"&&<Card dark={dark}>
      <div style={{textAlign:"center",padding:"40px 0",color:t.textMuted}}>
        <div style={{fontSize:32,marginBottom:12}}>💳</div>
        <div style={{fontSize:14,fontWeight:500}}>Transaction history will appear here</div>
        <div style={{fontSize:12,marginTop:4}}>Connected to Paystack webhook for real-time updates</div>
      </div>
    </Card>}
    {tab==="paystack"&&<Card dark={dark}>
      <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:20}}>Paystack Configuration</h3>
      {[["Public Key","pk_test_•••••••••••••••"],["Secret Key","sk_test_•••••••••••••••"],["Webhook URL","https://boostpanel.ng/api/webhooks/paystack"],["Callback URL","https://boostpanel.ng/api/payments/callback"]].map(([label,val],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0",borderBottom:i<3?`1px solid ${t.surfaceBorder}`:"none",flexWrap:"wrap",gap:8}}><span style={{fontSize:13,color:t.textSoft}}>{label}</span><span className="m" style={{fontSize:12,color:t.text}}>{val}</span></div>)}
      <Btn primary onClick={()=>notify("Paystack config saved")} style={{marginTop:16}}>Save Config</Btn>
    </Card>}
  </div>;
}

function AnalyticsPage({t,dark,orders,users,Btn}){
  const [range,setRange]=useState("7d");
  const rev=orders.reduce((a,o)=>a+o.charge,0);const cost=orders.reduce((a,o)=>a+o.cost,0);const profit=rev-cost;
  const RangeBtn=({id,label})=><button onClick={()=>setRange(id)} style={{padding:"8px 14px",borderRadius:8,fontSize:12,fontWeight:500,background:range===id?t.accentLight:"transparent",color:range===id?t.accent:t.textSoft,border:`1px solid ${range===id?t.accentBorder:t.btnSecBorder}`}}>{label}</button>;
  return <div>
    <Hdr title="Analytics" sub="Revenue, orders, and growth" t={t} action={<div style={{display:"flex",gap:6}}><RangeBtn id="24h" label="24h"/><RangeBtn id="7d" label="7 days"/><RangeBtn id="30d" label="30 days"/><RangeBtn id="90d" label="90 days"/></div>}/>
    <div className="sg" style={{marginBottom:24}}>
      <Stat l="Revenue" v={fN(rev)} c={t.green} ic="💰" t={t} dark={dark}/>
      <Stat l="Profit" v={fN(profit)} sub={`${Math.round(profit/rev*100)}% margin`} c={t.accent} ic="📈" d={.05} t={t} dark={dark}/>
      <Stat l="Orders" v={orders.length} sub={`${orders.filter(o=>o.status==="Completed").length} completed`} c="#a5b4fc" ic="📋" d={.1} t={t} dark={dark}/>
      <Stat l="New Users" v={users.filter(u=>u.status==="Active").length} c="#6ee7b7" ic="👥" d={.15} t={t} dark={dark}/>
    </div>
    <div className="g2">
      <Card dark={dark}>
        <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:16}}>Top Services</h3>
        {[["IG Followers [Real]",42,"₦816,750"],["TikTok Views",38,"₦883,500"],["YT Subscribers",21,"₦260,400"],["Twitter/X Followers",18,"₦111,600"],["Spotify Plays",15,"₦418,500"]].map(([name,count,rev],i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<4?`1px solid ${t.surfaceBorder}`:"none"}}>
          <div><div style={{fontSize:13,fontWeight:500,color:t.text}}>{name}</div><div style={{fontSize:11,color:t.textMuted,marginTop:2}}>{count} orders</div></div>
          <span className="m" style={{fontSize:12,color:t.green,fontWeight:600}}>{rev}</span>
        </div>)}
      </Card>
      <Card dark={dark}>
        <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:16}}>Revenue Breakdown</h3>
        {[["Instagram",45,t.accent],["TikTok",25,"#a5b4fc"],["YouTube",15,"#fcd34d"],["Twitter/X",8,"#6ee7b7"],["Others",7,t.textMuted]].map(([platform,pct,color],i)=><div key={i} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:t.text}}>{platform}</span><span className="m" style={{color:t.textSoft}}>{pct}%</span></div>
          <div style={{height:6,borderRadius:3,background:dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.05)"}}><div style={{height:6,borderRadius:3,background:color,width:`${pct}%`,transition:"width 0.5s ease"}}/></div>
        </div>)}
      </Card>
    </div>
  </div>;
}

function CouponsPage({t,dark,Btn,FilterBtn,notify,logAction}){
  const [coupons,setCoupons]=useState([
    {id:1,code:"WELCOME10",type:"percent",value:10,minOrder:0,maxUses:100,used:34,active:true,expires:"2026-04-30"},
    {id:2,code:"BOOST500",type:"flat",value:50000,minOrder:500000,maxUses:50,used:12,active:true,expires:"2026-05-15"},
    {id:3,code:"VIP20",type:"percent",value:20,minOrder:1000000,maxUses:10,used:10,active:false,expires:"2026-03-01"},
  ]);
  const [f,setF]=useState("all");
  const list=coupons.filter(c=>f==="all"||(f==="active"?c.active:!c.active));
  const toggle=(id)=>{setCoupons(p=>p.map(c=>c.id===id?{...c,active:!c.active}:c));notify("Coupon updated");logAction("Updated coupon","settings");};
  return <div>
    <Hdr title="Coupons" sub="Manage promo codes and discounts" t={t} action={<Btn primary onClick={()=>notify("Create coupon modal — coming soon")}>+ Create Coupon</Btn>}/>
    <div style={{display:"flex",gap:8,marginBottom:16}}><FilterBtn active={f==="all"} onClick={()=>setF("all")}>All ({coupons.length})</FilterBtn><FilterBtn active={f==="active"} onClick={()=>setF("active")}>Active ({coupons.filter(c=>c.active).length})</FilterBtn><FilterBtn active={f==="expired"} onClick={()=>setF("expired")}>Inactive ({coupons.filter(c=>!c.active).length})</FilterBtn></div>
    {list.map(c=><Card key={c.id} dark={dark} style={{marginBottom:10,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{padding:"8px 14px",borderRadius:8,background:t.accentLight,border:`1px solid ${t.accentBorder}`}}><span className="m" style={{fontSize:14,fontWeight:700,color:t.accent}}>{c.code}</span></div>
          <div>
            <div style={{fontSize:13,fontWeight:500,color:t.text}}>{c.type==="percent"?`${c.value}% off`:`₦${(c.value/100).toLocaleString()} off`}</div>
            <div style={{fontSize:11,color:t.textMuted,marginTop:2}}>Min order: {c.minOrder?fN(c.minOrder):"None"} • Used: {c.used}/{c.maxUses} • Expires: {c.expires}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Badge s={c.active?"Active":"Inactive"} dark={dark}/>
          <button onClick={()=>toggle(c.id)} style={{width:44,height:24,borderRadius:12,background:c.active?t.accent:(dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)"),position:"relative",border:"none",cursor:"pointer",transition:"background 0.2s"}}><div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:c.active?22:2,transition:"left 0.2s",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}}/></button>
          <Btn onClick={()=>notify("Edit modal — coming soon")}>Edit</Btn>
        </div>
      </div>
    </Card>)}
  </div>;
}

function NotificationsPage({t,dark,Btn,notify,logAction,users}){
  const [method,setMethod]=useState("banner");
  const [target,setTarget]=useState("all");
  const [msg,setMsg]=useState("");
  const [subject,setSubject]=useState("");
  const [history]=useState([
    {id:1,method:"banner",target:"All users",message:"New TikTok services available!",sent:"2026-03-22T14:00:00",by:"David Ojo"},
    {id:2,method:"email",target:"All users",message:"Scheduled maintenance tonight",sent:"2026-03-21T10:00:00",by:"Owner"},
    {id:3,method:"banner",target:"Active users",message:"Referral bonus doubled this week!",sent:"2026-03-19T09:00:00",by:"Owner"},
  ]);
  const send=()=>{if(!msg){notify("Message is required",true);return;}notify("Notification sent!");logAction(`Sent ${method} notification to ${target}`,"admin");setMsg("");setSubject("");};
  return <div>
    <Hdr title="Notifications" sub="Send announcements to users" t={t}/>
    <div className="g2">
      <Card dark={dark}>
        <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:20}}>New Notification</h3>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Method</label>
          <div style={{display:"flex",gap:8}}>{[["banner","📢 Dashboard Banner"],["email","📧 Email Blast"]].map(([v,lb])=><button key={v} onClick={()=>setMethod(v)} style={{flex:1,padding:"10px 0",borderRadius:10,fontSize:13,fontWeight:500,background:method===v?t.accentLight:t.btnSecondary,color:method===v?t.accent:t.textSoft,border:`1px solid ${t.btnSecBorder}`}}>{lb}</button>)}</div>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Target</label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{[["all","All Users"],["active","Active Only"],["new","New (30d)"]].map(([v,lb])=><button key={v} onClick={()=>setTarget(v)} style={{padding:"10px 16px",borderRadius:10,fontSize:13,fontWeight:500,background:target===v?t.accentLight:t.btnSecondary,color:target===v?t.accent:t.textSoft,border:`1px solid ${t.btnSecBorder}`}}>{lb}</button>)}</div>
        </div>
        {method==="email"&&<div style={{marginBottom:16}}>
          <label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Subject</label>
          <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Email subject line" style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/>
        </div>}
        <div style={{marginBottom:16}}>
          <label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Message</label>
          <textarea rows={4} value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Type your notification message..." style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",resize:"vertical"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:12,color:t.textMuted}}>Sending to ~{target==="all"?users.length:target==="active"?users.filter(u=>u.status==="Active").length:Math.floor(users.length*0.3)} users</span>
          <Btn primary onClick={send}>📣 Send Notification</Btn>
        </div>
      </Card>
      <Card dark={dark}>
        <h3 style={{fontSize:15,fontWeight:600,color:t.text,marginBottom:16}}>Recent Notifications</h3>
        {history.map((n,i)=><div key={n.id} style={{padding:"12px 0",borderBottom:i<history.length-1?`1px solid ${t.surfaceBorder}`:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:6}}>
            <span style={{fontSize:12,fontWeight:600,padding:"2px 8px",borderRadius:4,background:n.method==="email"?(dark?"rgba(99,102,241,0.1)":"#eef2ff"):(dark?"rgba(217,119,6,0.1)":"#fffbeb"),color:n.method==="email"?(dark?"#a5b4fc":"#4f46e5"):(dark?"#fcd34d":"#92400e")}}>{n.method==="email"?"📧 Email":"📢 Banner"}</span>
            <span style={{fontSize:11,color:t.textMuted}}>{fD(n.sent)} • {n.by}</span>
          </div>
          <div style={{fontSize:13,color:t.text}}>{n.message}</div>
          <div style={{fontSize:11,color:t.textMuted,marginTop:2}}>To: {n.target}</div>
        </div>)}
      </Card>
    </div>
  </div>;
}
