'use client';
import { useState, useEffect } from "react";

function ThemeToggle({dark,onToggle}){
  return <button onClick={onToggle} style={{display:"flex",alignItems:"center",background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)",borderRadius:20,padding:3,width:52,height:28,border:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)"}`,position:"relative",flexShrink:0,transition:"background 1.5s cubic-bezier(.4,0,.2,1),border-color 1.5s ease"}}><div style={{width:22,height:22,borderRadius:"50%",background:dark?"#c47d8e":"#e0a458",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,position:"absolute",left:dark?3:27,transition:"left 0.4s cubic-bezier(.4,0,.2,1),background 1.5s cubic-bezier(.4,0,.2,1)",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}>{dark?"🌙":"☀️"}</div></button>;
}

export default function AdminLogin(){
  const getAuto=()=>{const h=new Date().getHours(),m=new Date().getMinutes();if(h>=7&&h<18)return false;if(h>=19||h<6)return true;if(h===6)return m<30;if(h===18)return m>=30;return true;};
  const [dark,setDark]=useState(getAuto);
  const [mo,setMo]=useState(false);
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [showPw,setShowPw]=useState(false);
  const [remember,setRemember]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{if(mo)return;const iv=setInterval(()=>setDark(getAuto()),60000);return()=>clearInterval(iv);},[mo]);
  const toggleTheme=()=>{setMo(true);setDark(d=>!d);};

  const handleLogin=(e)=>{
    e.preventDefault();
    setError("");
    if(!email||!pw){setError("Please fill in all fields");return;}
    setLoading(true);
    setTimeout(()=>{setLoading(false);setError("Invalid credentials. Contact the super admin if you need access.");},1500);
  };

  const t={
    bg:dark?"#080b14":"#f4f1ed",text:dark?"#e8e4df":"#1a1a1a",textSoft:dark?"#8a8680":"#888580",textMuted:dark?"#555250":"#b0ada8",
    surface:dark?"rgba(15,18,30,0.92)":"rgba(255,255,255,0.92)",surfaceBorder:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.08)",
    inputBg:dark?"#0d1020":"#fff",inputBorder:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)",
    accent:"#c47d8e",red:dark?"#fca5a5":"#dc2626",
    btnPrimary:"linear-gradient(135deg,#c47d8e,#a3586b)",
    logoGrad:"linear-gradient(135deg,#c47d8e,#8b5e6b)",
  };

  return (
    <div className="root">
      
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .root{min-height:100vh;background:${t.bg};font-family:'Outfit',sans-serif;display:flex;align-items:center;justify-content:center;transition:background 1.5s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}
        .serif{font-family:'Cormorant Garamond',serif}
        button{cursor:pointer;font-family:inherit;border:none}input{font-family:inherit}
        @keyframes fu{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes f1{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(30px,-20px) scale(1.05)}50%{transform:translate(-10px,15px) scale(0.95)}75%{transform:translate(20px,10px) scale(1.02)}}
        @keyframes f2{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-25px,15px) scale(1.03)}66%{transform:translate(15px,-25px) scale(0.97)}}
        @keyframes f3{0%,100%{transform:translate(0,0)}50%{transform:translate(10px,-15px)}}
        @keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:.3;transform:translate(-50%,-50%) scale(1)}50%{opacity:.6;transform:translate(-50%,-50%) scale(1.05)}}
        @keyframes drift{0%{transform:translateY(0) translateX(0)}25%{transform:translateY(-8px) translateX(4px)}50%{transform:translateY(2px) translateX(-6px)}75%{transform:translateY(-4px) translateX(8px)}100%{transform:translateY(0) translateX(0)}}
        .orb{position:absolute;border-radius:50%;pointer-events:none;filter:blur(80px)}
      `}</style>

      {/* ── GRADIENT ORBS ── */}
      <div className="orb" style={{width:400,height:400,top:"-20%",left:"-15%",background:dark?"rgba(196,125,142,0.1)":"rgba(196,125,142,0.07)",animation:"f1 20s ease-in-out infinite"}}/>
      <div className="orb" style={{width:300,height:300,bottom:"-15%",right:"-10%",background:dark?"rgba(100,120,200,0.08)":"rgba(100,120,200,0.05)",animation:"f2 25s ease-in-out infinite"}}/>
      <div className="orb" style={{width:200,height:200,top:"60%",left:"-8%",background:dark?"rgba(110,231,183,0.06)":"rgba(16,185,129,0.04)",animation:"f3 18s ease-in-out infinite"}}/>
      <div className="orb" style={{width:180,height:180,top:"10%",right:"15%",background:dark?"rgba(196,125,142,0.06)":"rgba(196,125,142,0.04)",animation:"f2 22s ease-in-out infinite 5s"}}/>

      {/* ── SPINNING RINGS ── */}
      <div style={{position:"absolute",width:200,height:200,borderRadius:"50%",top:"8%",right:"8%",border:`1.5px solid ${dark?"rgba(196,125,142,0.08)":"rgba(196,125,142,0.06)"}`,animation:"spin 40s linear infinite",pointerEvents:"none"}}/>
      <div style={{position:"absolute",width:140,height:140,borderRadius:"50%",bottom:"12%",left:"10%",border:`1px dashed ${dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)"}`,animation:"spin 30s linear infinite reverse",pointerEvents:"none"}}/>
      <div style={{position:"absolute",width:80,height:80,borderRadius:"50%",top:"25%",left:"18%",border:`1px solid ${dark?"rgba(100,120,200,0.06)":"rgba(100,120,200,0.04)"}`,animation:"spin 20s linear infinite",pointerEvents:"none"}}/>

      {/* ── PULSE RINGS behind card ── */}
      <div style={{position:"absolute",width:480,height:480,borderRadius:"50%",border:`1px solid ${dark?"rgba(196,125,142,0.06)":"rgba(196,125,142,0.04)"}`,top:"50%",left:"50%",transform:"translate(-50%,-50%)",animation:"pulse 4s ease-in-out infinite",pointerEvents:"none"}}/>
      <div style={{position:"absolute",width:580,height:580,borderRadius:"50%",border:`1px solid ${dark?"rgba(196,125,142,0.03)":"rgba(196,125,142,0.02)"}`,top:"50%",left:"50%",transform:"translate(-50%,-50%)",animation:"pulse 4s ease-in-out infinite 1s",pointerEvents:"none"}}/>

      {/* ── FLOATING PARTICLES ── */}
      {[[12,"8%","15%",6],[8,"75%","20%",9],[10,"20%","80%",12],[6,"85%","75%",8],[9,"50%","5%",15],[7,"10%","45%",10],[5,"90%","50%",7],[8,"40%","90%",11]].map(([s,l,tp,d],i)=>
        <div key={i} style={{position:"absolute",width:s,height:s,borderRadius:"50%",left:l,top:tp,background:dark?`rgba(196,125,142,${.1+i*.02})`:`rgba(196,125,142,${.08+i*.015})`,animation:`drift ${d}s ease-in-out infinite ${i*.7}s`,pointerEvents:"none"}}/>
      )}

      {/* ── SHIELD WATERMARK ── */}
      <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:220,opacity:dark?.015:.02,pointerEvents:"none",zIndex:0,lineHeight:1}}>🛡️</div>

      {/* ── GRID PATTERN ── */}
      <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(${dark?"rgba(255,255,255,.015)":"rgba(0,0,0,.015)"} 1px,transparent 1px),linear-gradient(90deg,${dark?"rgba(255,255,255,.015)":"rgba(0,0,0,.015)"} 1px,transparent 1px)`,backgroundSize:"60px 60px",pointerEvents:"none"}}/>

      {/* ── CORNER ACCENTS ── */}
      <div style={{position:"absolute",top:0,left:0,width:250,height:250,background:`linear-gradient(135deg,${dark?"rgba(196,125,142,.05)":"rgba(196,125,142,.04)"} 0%,transparent 70%)`,pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:0,right:0,width:250,height:250,background:`linear-gradient(315deg,${dark?"rgba(100,120,200,.05)":"rgba(100,120,200,.04)"} 0%,transparent 70%)`,pointerEvents:"none"}}/>

      {/* ── THEME TOGGLE ── */}
      <div style={{position:"absolute",top:20,right:20,zIndex:10}}><ThemeToggle dark={dark} onToggle={toggleTheme}/></div>

      {/* ── LOGIN CARD ── */}
      <div style={{width:"100%",maxWidth:400,padding:16,position:"relative",zIndex:1,animation:"fu .5s ease"}}>
        <div style={{background:t.surface,border:`1px solid ${t.surfaceBorder}`,borderRadius:24,padding:"40px 32px",backdropFilter:"blur(20px)",boxShadow:dark?"0 20px 60px rgba(0,0,0,.4)":"0 20px 60px rgba(0,0,0,.08)",transition:"background 1.5s ease,border-color 1.5s ease"}}>
          
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{width:52,height:52,borderRadius:16,background:t.logoGrad,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:700,color:"#fff",marginBottom:14,boxShadow:"0 8px 24px rgba(196,125,142,.25)"}}>B</div>
            <h1 className="serif" style={{fontSize:28,fontWeight:600,color:t.text}}>Admin Access</h1>
            <p style={{fontSize:13,color:t.textMuted,marginTop:6}}>Authorized personnel only</p>
          </div>

          {error&&<div style={{padding:"10px 14px",borderRadius:10,background:dark?"rgba(220,38,38,.1)":"#fef2f2",border:`1px solid ${dark?"rgba(220,38,38,.2)":"#fecaca"}`,color:t.red,fontSize:13,marginBottom:16,animation:"fu .3s ease"}}>⚠️ {error}</div>}

          <label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Email Address</label>
          <input value={email} onChange={e=>{setEmail(e.target.value);setError("");}} placeholder="admin@boostpanel.ng" type="email" style={{width:"100%",padding:"12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none",marginBottom:16}}/>

          <label style={{fontSize:11,color:t.textSoft,fontWeight:600,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:1.5}}>Password</label>
          <div style={{position:"relative",marginBottom:10}}>
            <input value={pw} onChange={e=>{setPw(e.target.value);setError("");}} placeholder="Enter password" type={showPw?"text":"password"} style={{width:"100%",padding:"12px 44px 12px 14px",borderRadius:10,background:t.inputBg,border:`1px solid ${t.inputBorder}`,color:t.text,fontSize:14,outline:"none"}}/>
            <button onClick={()=>setShowPw(!showPw)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",color:t.textMuted,fontSize:14,padding:2}}>{showPw?"🙈":"👁️"}</button>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
            <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} style={{accentColor:t.accent,width:15,height:15}}/><span style={{fontSize:12,color:t.textSoft}}>Remember me</span></label>
            <button style={{background:"none",color:t.accent,fontSize:12,fontWeight:500}}>Forgot password?</button>
          </div>

          <button onClick={handleLogin} disabled={loading} style={{width:"100%",padding:"14px 0",borderRadius:12,background:loading?"#999":t.btnPrimary,color:"#fff",fontSize:15,fontWeight:700,marginBottom:20,opacity:loading?.7:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading&&<span style={{width:16,height:16,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite",flexShrink:0}}/>}
            {loading?"Authenticating...":"Log In"}
          </button>

          <div style={{textAlign:"center",padding:"14px 0",borderTop:`1px solid ${t.surfaceBorder}`}}>
            <p style={{fontSize:11,color:t.textMuted,lineHeight:1.6}}>🔒 Restricted area. Access attempts are logged.</p>
          </div>
        </div>

        <div style={{textAlign:"center",marginTop:20}}>
          <a href="/" style={{fontSize:13,color:t.textMuted,textDecoration:"none"}}>← Back to boostpanel.ng</a>
        </div>
      </div>

      <footer style={{position:"absolute",bottom:0,left:0,right:0,borderTop:`1px solid ${t.surfaceBorder}`}}>
        <div style={{maxWidth:800,margin:"0 auto",padding:"16px 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
            <div style={{fontSize:12,color:t.textMuted}}>© 2026 BoostPanel. All rights reserved.</div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
              <div style={{display:"flex",gap:16}}>{["Twitter","Instagram"].map(s=><a key={s} href="#" style={{fontSize:12,color:t.textSoft,textDecoration:"none"}}>{s}</a>)}</div>
              <div style={{display:"flex",gap:16}}>{[["Terms","/terms"],["Privacy","/privacy"],["Refund","/refund"],["Cookie","/cookie"]].map(([l,h])=><a key={l} href={h} style={{fontSize:11,color:t.textMuted,textDecoration:"none"}}>{l}</a>)}</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
