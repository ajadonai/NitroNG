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

  const bg = dark ? "#090c15" : "#f4f1ed";
  const accent = "#c47d8e";
  const glow = dark ? "rgba(196,125,142,.25)" : "rgba(196,125,142,.2)";
  const ring = dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)";
  const ring2 = dark ? "rgba(196,125,142,.05)" : "rgba(196,125,142,.03)";
  const ring3 = dark ? "rgba(196,125,142,.025)" : "rgba(196,125,142,.015)";
  const track = dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)";
  const muted = dark ? "#555250" : "#b0ada8";
  const text = dark ? "#eae7e2" : "#1c1b19";
  const orbA = dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)";
  const orbB = dark ? "rgba(110,160,230,.04)" : "rgba(110,160,230,.03)";
  const particle = dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)";

  return (
    <div className="h-dvh flex items-center justify-center relative overflow-hidden" style={{ background:bg, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
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
          <svg className="ld-svg" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg>
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
