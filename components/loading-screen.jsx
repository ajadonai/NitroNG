'use client';
import { useEffect, useState } from 'react';

export default function LoadingScreen() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    try {
      const s = typeof window !== "undefined" ? localStorage.getItem("nitro-theme") : null;
      if (s === "night") setDark(true);
      else if (s === "day") setDark(false);
      else { const h = new Date().getHours(), m = new Date().getMinutes(); setDark(h >= 19 || h < 6 || (h === 6 && m < 30) || (h === 18 && m >= 30)); }
    } catch { const h = new Date().getHours(); setDark(h >= 19 || h < 6); }
  }, []);

  const bg = dark ? "#060810" : "#f4f1ed";
  const accent = "#c47d8e";
  const glow = dark ? "rgba(196,125,142,.25)" : "rgba(196,125,142,.2)";
  const ring = dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)";
  const ring2 = dark ? "rgba(196,125,142,.05)" : "rgba(196,125,142,.03)";
  const ring3 = dark ? "rgba(196,125,142,.025)" : "rgba(196,125,142,.015)";
  const track = dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)";
  const muted = dark ? "#555250" : "#b0ada8";
  const text = dark ? "#eae7e2" : "#1c1b19";
  const orbA = dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)";
  const orbB = dark ? "rgba(110,160,230,.04)" : "rgba(110,160,230,.03)";
  const particle = dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)";

  return (
    <div className="h-dvh flex items-center justify-center relative overflow-hidden" style={{ background:bg, fontFamily:"'Outfit',sans-serif" }}>
      <style>{`
        @keyframes breathe{0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.05);filter:brightness(1.15)}}
        @keyframes pulse-ring{0%{transform:scale(1);opacity:.3}50%{transform:scale(1.15);opacity:.08}100%{transform:scale(1);opacity:.3}}
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(12px,-8px)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-10px,12px)}}
        @keyframes float3{0%,100%{transform:translate(0,0)}50%{transform:translate(8px,12px)}}
        @keyframes dotPulse{0%,80%,100%{opacity:.3}40%{opacity:1}}
        @keyframes progressFill{0%{width:0}100%{width:90%}}
        .ld-logo{width:64px;height:64px;border-radius:18px}
        .ld-title{font-size:20px}
        .ld-sub{font-size:12px;margin-bottom:40px}
        .ld-bar{width:200px;height:3px}
        .ld-r1{width:160px;height:160px}
        .ld-r2{width:220px;height:220px}
        .ld-r3{width:280px;height:280px}
        .ld-o1{width:300px;height:300px}
        .ld-o2{width:250px;height:250px}
        .ld-dot{width:4px;height:4px}
        .ld-svg{width:28px;height:28px}
        @media(min-width:768px){
          .ld-logo{width:80px;height:80px;border-radius:22px}
          .ld-title{font-size:24px}
          .ld-sub{font-size:14px;margin-bottom:48px}
          .ld-bar{width:260px;height:3px}
          .ld-r1{width:200px;height:200px}
          .ld-r2{width:280px;height:280px}
          .ld-r3{width:360px;height:360px}
          .ld-o1{width:400px;height:400px}
          .ld-o2{width:320px;height:320px}
          .ld-dot{width:5px;height:5px}
          .ld-svg{width:34px;height:34px}
        }
        @media(min-width:1200px){
          .ld-logo{width:88px;height:88px;border-radius:24px}
          .ld-title{font-size:28px}
          .ld-sub{font-size:15px;margin-bottom:56px}
          .ld-bar{width:300px;height:4px}
          .ld-r1{width:240px;height:240px}
          .ld-r2{width:340px;height:340px}
          .ld-r3{width:440px;height:440px}
          .ld-o1{width:500px;height:500px}
          .ld-o2{width:400px;height:400px}
          .ld-dot{width:5px;height:5px}
          .ld-svg{width:38px;height:38px}
        }
      `}</style>

      <div className="ld-o1 absolute top-[15%] -left-[10%] rounded-full blur-[80px] pointer-events-none animate-[float1_20s_ease-in-out_infinite]" style={{background:orbA}}/>
      <div className="ld-o2 absolute bottom-[10%] -right-[15%] rounded-full blur-[70px] pointer-events-none animate-[float2_25s_ease-in-out_infinite]" style={{background:orbB}}/>

      {[["20%","75%",3,0],["45%","15%",4,1],["70%","80%",3,.5],["80%","25%",4,1.5],["10%","50%",3,2],["60%","40%",4,.3]].map(([t2,l,s,d],i)=>(
        <div key={i} className="absolute rounded-full pointer-events-none" style={{top:t2,left:l,width:s,height:s,background:particle,animation:`float3 ${3.5+i}s ease-in-out infinite ${d}s`}}/>
      ))}

      <div className="ld-r1 absolute rounded-full pointer-events-none animate-[pulse-ring_3s_ease-in-out_infinite]" style={{border:`1px solid ${ring}`}}/>
      <div className="ld-r2 absolute rounded-full pointer-events-none animate-[pulse-ring_3s_ease-in-out_infinite_.5s]" style={{border:`1px solid ${ring2}`}}/>
      <div className="ld-r3 absolute rounded-full pointer-events-none animate-[pulse-ring_3s_ease-in-out_infinite_1s]" style={{border:`1px solid ${ring3}`}}/>

      <div className="relative z-[1] flex flex-col items-center">
        <div className="ld-logo bg-[linear-gradient(135deg,#c47d8e,#8b5e6b)] flex items-center justify-center mb-6 animate-[breathe_4s_ease-in-out_infinite]" style={{boxShadow:`0 12px 40px ${glow}`}}>
          <svg className="ld-svg" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span className="ld-title font-bold tracking-[3px] mb-1.5" style={{color:text}}>NITRO</span>
        <span className="ld-sub font-normal tracking-[1px]" style={{color:muted}}>Loading your experience</span>
        <div className="ld-bar rounded-sm overflow-hidden relative mb-3" style={{background:track}}>
          <div style={{width:"90%",height:"100%",borderRadius:2,background:`linear-gradient(90deg,${accent},#a3586b)`,animation:"progressFill 1.5s ease-out forwards",boxShadow:`0 0 8px ${dark?"rgba(196,125,142,.3)":"rgba(196,125,142,.2)"}`}}/>
        </div>
        <div className="flex gap-1 mt-1">
          {[0,1,2].map(i=><div key={i} className="ld-dot rounded-full" style={{background:accent,animation:`dotPulse 1.4s ease-in-out infinite ${i*.2}s`}}/>)}
        </div>
      </div>
    </div>
  );
}
