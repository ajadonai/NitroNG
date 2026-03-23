'use client';
import { useState, useEffect } from "react";

export default function Maintenance(){
  const getAuto=()=>{const h=new Date().getHours();return h>=7&&h<18?false:true;};
  const [dark,setDark]=useState(getAuto);
  const [mo,setMo]=useState(false);
  const toggleTheme=()=>{setMo(true);setDark(d=>!d);};
  useEffect(()=>{if(mo)return;const iv=setInterval(()=>setDark(getAuto()),60000);return()=>clearInterval(iv);},[mo]);
  const [dots,setDots]=useState("");
  useEffect(()=>{const iv=setInterval(()=>setDots(d=>d.length>=3?"":d+"."),500);return()=>clearInterval(iv);},[]);

  const t={
    bg:dark?"#080b14":"#f4f1ed",text:dark?"#e8e4df":"#1a1a1a",textSoft:dark?"#8a8680":"#888580",textMuted:dark?"#555250":"#b0ada8",
    accent:"#c47d8e",green:dark?"#6ee7b7":"#059669",
    surface:dark?"rgba(15,18,30,0.92)":"rgba(255,255,255,0.92)",surfaceBorder:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.08)",
    logoGrad:"linear-gradient(135deg,#c47d8e,#8b5e6b)",
  };

  return(
    <div className="root">
      
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .root{min-height:100vh;background:${t.bg};font-family:'Outfit',sans-serif;display:flex;flex-direction:column;position:relative;overflow:hidden}
        .serif{font-family:'Cormorant Garamond',serif}.m{font-family:'JetBrains Mono',monospace}
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,-15px)}}
        @keyframes pulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.8;transform:scale(1.02)}}
        @keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
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
      <div className="orb" style={{width:300,height:300,top:"-10%",left:"-8%",background:dark?"rgba(196,125,142,0.08)":"rgba(196,125,142,0.06)",animation:"float1 18s ease-in-out infinite"}}/>
      <div className="orb" style={{width:250,height:250,bottom:"-10%",right:"-8%",background:dark?"rgba(100,120,200,0.06)":"rgba(100,120,200,0.04)",animation:"float1 22s ease-in-out infinite 5s"}}/>
      <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(${dark?"rgba(255,255,255,0.015)":"rgba(0,0,0,0.015)"} 1px,transparent 1px),linear-gradient(90deg,${dark?"rgba(255,255,255,0.015)":"rgba(0,0,0,0.015)"} 1px,transparent 1px)`,backgroundSize:"60px 60px",pointerEvents:"none"}}/>

      <div style={{textAlign:"center",position:"relative",zIndex:1,padding:24,maxWidth:480}}>
        <div style={{background:t.surface,border:`1px solid ${t.surfaceBorder}`,borderRadius:24,padding:"48px 36px",backdropFilter:"blur(20px)",boxShadow:dark?"0 20px 60px rgba(0,0,0,0.4)":"0 20px 60px rgba(0,0,0,0.08)"}}>

          {/* Animated gear */}
          <div style={{width:64,height:64,borderRadius:"50%",border:`3px solid ${t.surfaceBorder}`,borderTopColor:t.accent,animation:"spin 3s linear infinite",margin:"0 auto 24px"}}/>

          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:20}}>
            <div style={{width:36,height:36,borderRadius:10,background:t.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,fontWeight:700,color:"#fff"}}>B</div>
            <span className="serif" style={{fontSize:20,fontWeight:600,color:t.text}}>BoostPanel</span>
          </div>

          <h1 className="serif" style={{fontSize:"clamp(24px,5vw,36px)",fontWeight:600,color:t.text,marginBottom:10}}>Under Maintenance</h1>
          <p style={{fontSize:15,color:t.textSoft,lineHeight:1.7,marginBottom:8}}>
            We're performing scheduled upgrades to improve your experience. Everything will be back to normal shortly.
          </p>
          <p className="m" style={{fontSize:14,color:t.accent,fontWeight:500,animation:"pulse 2s ease-in-out infinite"}}>
            Working on it{dots}
          </p>

          <div style={{marginTop:28,padding:16,borderRadius:14,background:dark?"#0a0d18":"#faf8f5",border:`1px solid ${t.surfaceBorder}`}}>
            <div style={{fontSize:11,color:t.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Estimated Return</div>
            <div className="m" style={{fontSize:20,fontWeight:700,color:t.green}}>~30 minutes</div>
            <div style={{fontSize:12,color:t.textMuted,marginTop:6}}>Orders in progress will not be affected</div>
          </div>

          <div style={{marginTop:24,display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <a href="https://twitter.com/boostpanel" style={{fontSize:13,color:t.accent,textDecoration:"none",fontWeight:500}}>Follow @boostpanel for updates</a>
          </div>
        </div>

        <div style={{marginTop:20,fontSize:12,color:t.textMuted}}>
          Questions? Email <a href="mailto:support@boostpanel.ng" style={{color:t.accent,textDecoration:"none"}}>support@boostpanel.ng</a>
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
