'use client';
import { useState, useEffect } from "react";

export default function NotFound(){
  const getAuto=()=>{const h=new Date().getHours();if(h>=7&&h<18)return false;return true;};
  const [dark,setDark]=useState(getAuto);
  const [mo,setMo]=useState(false);
  const toggleTheme=()=>{setMo(true);setDark(d=>!d);};
  useEffect(()=>{if(mo)return;const iv=setInterval(()=>setDark(getAuto()),60000);return()=>clearInterval(iv);},[mo]);

  const t={
    bg:dark?"#080b14":"#f4f1ed",text:dark?"#e8e4df":"#1a1a1a",textSoft:dark?"#8a8680":"#888580",textMuted:dark?"#555250":"#b0ada8",
    accent:"#c47d8e",
    btnPrimary:"linear-gradient(135deg,#c47d8e,#a3586b)",
    btnSecondary:dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.03)",btnSecBorder:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",
    logoGrad:"linear-gradient(135deg,#c47d8e,#8b5e6b)",
    surface:dark?"rgba(15,18,30,0.85)":"rgba(255,255,255,0.9)",surfaceBorder:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.08)",
  };

  return(
    <div className="root">
      
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .root{min-height:100vh;background:${t.bg};font-family:'Outfit',sans-serif;display:flex;flex-direction:column;transition:background 1.5s ease;position:relative;overflow:hidden}
        .serif{font-family:'Cormorant Garamond',serif}
        .m{font-family:'JetBrains Mono',monospace}
        button,a{cursor:pointer;font-family:inherit;border:none;text-decoration:none}
        @keyframes float1{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(30px,-20px) scale(1.05)}50%{transform:translate(-10px,15px) scale(0.95)}75%{transform:translate(20px,10px) scale(1.02)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}33%{transform:translate(-20px,15px)}66%{transform:translate(15px,-20px)}}
        @keyframes drift{0%{transform:translateY(0)}50%{transform:translateY(-6px)}100%{transform:translateY(0)}}
        .orb{position:absolute;border-radius:50%;pointer-events:none;filter:blur(80px)}
      `}</style>

      <div style={{padding:"14px 0",borderBottom:`1px solid ${t.surfaceBorder}`,position:"sticky",top:0,zIndex:50,background:dark?"rgba(8,11,20,0.8)":"rgba(244,241,237,0.8)",backdropFilter:"blur(20px)",transition:"background 1.5s ease"}}>
        <div style={{maxWidth:800,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} style={{display:"flex",alignItems:"center",gap:10,background:"none",padding:0,border:"none",outline:"none",cursor:"pointer"}}>
            <div style={{width:32,height:32,borderRadius:10,background:t.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#fff"}}>B</div>
            <span className="serif" style={{fontSize:18,fontWeight:600,color:t.text}}>BoostPanel</span>
          </button>
          <button onClick={toggleTheme} style={{display:"flex",alignItems:"center",background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)",borderRadius:20,padding:3,width:52,height:28,border:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)"}`,position:"relative",flexShrink:0,transition:"background 1.5s cubic-bezier(.4,0,.2,1),border-color 1.5s ease"}}><div style={{width:22,height:22,borderRadius:"50%",background:dark?"#c47d8e":"#e0a458",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,position:"absolute",left:dark?3:27,transition:"left 0.4s cubic-bezier(.4,0,.2,1),background 1.5s cubic-bezier(.4,0,.2,1)",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}>{dark?"🌙":"☀️"}</div></button>
        </div>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div className="orb" style={{width:350,height:350,top:"-15%",left:"-10%",background:dark?"rgba(196,125,142,0.08)":"rgba(196,125,142,0.06)",animation:"float1 20s ease-in-out infinite"}}/>
      <div className="orb" style={{width:250,height:250,bottom:"-10%",right:"-8%",background:dark?"rgba(100,120,200,0.06)":"rgba(100,120,200,0.04)",animation:"float2 22s ease-in-out infinite"}}/>
      <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(${dark?"rgba(255,255,255,0.015)":"rgba(0,0,0,0.015)"} 1px,transparent 1px),linear-gradient(90deg,${dark?"rgba(255,255,255,0.015)":"rgba(0,0,0,0.015)"} 1px,transparent 1px)`,backgroundSize:"60px 60px",pointerEvents:"none"}}/>

      {/* Content */}
      <div style={{textAlign:"center",position:"relative",zIndex:1,padding:24,maxWidth:500}}>
        {/* Animated 404 number */}
        <div className="m" style={{fontSize:"clamp(80px,20vw,160px)",fontWeight:700,color:t.accent,lineHeight:1,marginBottom:8,opacity:0.15,letterSpacing:"-4px"}}>404</div>
        
        {/* Logo */}
        <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:24}}>
          <div style={{width:36,height:36,borderRadius:10,background:t.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:700,color:"#fff"}}>B</div>
          <span className="serif" style={{fontSize:20,fontWeight:600,color:t.text}}>BoostPanel</span>
        </div>

        <h1 className="serif" style={{fontSize:"clamp(28px,5vw,42px)",fontWeight:600,color:t.text,marginBottom:12}}>Page Not Found</h1>
        <p style={{fontSize:15,color:t.textSoft,lineHeight:1.7,marginBottom:32,maxWidth:380,margin:"0 auto 32px"}}>
          The page you're looking for doesn't exist or has been moved. Let's get you back on track.
        </p>

        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
          <a href="/" style={{padding:"13px 32px",borderRadius:12,background:t.btnPrimary,color:"#fff",fontSize:15,fontWeight:600,display:"inline-block"}}>Go Home</a>
          <a href="/dashboard" style={{padding:"13px 32px",borderRadius:12,background:t.btnSecondary,color:t.text,fontSize:15,fontWeight:600,border:`1px solid ${t.btnSecBorder}`,display:"inline-block"}}>Dashboard</a>
        </div>

        <div style={{marginTop:40,fontSize:12,color:t.textMuted}}>
          If you think this is an error, <a href="/support" style={{color:t.accent}}>contact support</a>
        </div>
      </div>

      </div>
      <footer style={{position:"relative",bottom:0,left:0,right:0,borderTop:`1px solid ${t.surfaceBorder}`}}>
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
