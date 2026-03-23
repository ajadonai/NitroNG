'use client';
import { useState, useEffect, useRef } from "react";

export default function VerifyAccount(){
  const getAuto=()=>{const h=new Date().getHours();if(h>=7&&h<18)return false;return true;};
  const [dark,setDark]=useState(getAuto);
  const [code,setCode]=useState(["","","","","",""]);
  const [verifying,setVerifying]=useState(false);
  const [error,setError]=useState("");
  const [resendTimer,setResendTimer]=useState(60);
  const [verified,setVerified]=useState(false);
  const inputs=useRef([]);

  // Countdown timer for resend
  useEffect(()=>{
    if(resendTimer<=0)return;
    const iv=setInterval(()=>setResendTimer(p=>p-1),1000);
    return()=>clearInterval(iv);
  },[resendTimer]);

  const handleChange=(i,val)=>{
    if(!/^\d*$/.test(val))return; // digits only
    const next=[...code];
    next[i]=val.slice(-1); // single digit
    setCode(next);
    setError("");
    if(val&&i<5)inputs.current[i+1]?.focus();
    // Auto-submit when all 6 filled
    if(next.every(d=>d)&&next.join("").length===6){
      setVerifying(true);
      setTimeout(()=>{
        if(next.join("")==="123456"){setVerified(true);}
        else{setError("Invalid code. Please try again.");setVerifying(false);}
      },1200);
    }
  };

  const handleKeyDown=(i,e)=>{
    if(e.key==="Backspace"&&!code[i]&&i>0){inputs.current[i-1]?.focus();}
  };

  const handlePaste=(e)=>{
    e.preventDefault();
    const pasted=e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
    if(pasted.length===0)return;
    const next=[...code];
    for(let i=0;i<6;i++)next[i]=pasted[i]||"";
    setCode(next);
    const focusIdx=Math.min(pasted.length,5);
    inputs.current[focusIdx]?.focus();
    if(next.every(d=>d)){
      setVerifying(true);
      setTimeout(()=>{
        if(next.join("")==="123456"){setVerified(true);}
        else{setError("Invalid code. Please try again.");setVerifying(false);}
      },1200);
    }
  };

  const resend=()=>{if(resendTimer<=0){setResendTimer(60);setError("");setCode(["","","","","",""]);inputs.current[0]?.focus();}};

  const t={
    bg:dark?"#080b14":"#f4f1ed",text:dark?"#e8e4df":"#1a1a1a",textSoft:dark?"#8a8680":"#888580",textMuted:dark?"#555250":"#b0ada8",
    surface:dark?"rgba(15,18,30,0.92)":"rgba(255,255,255,0.92)",surfaceBorder:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.08)",
    inputBg:dark?"#0d1020":"#fff",inputBorder:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)",
    accent:"#c47d8e",green:dark?"#6ee7b7":"#059669",red:dark?"#fca5a5":"#dc2626",
    btnPrimary:"linear-gradient(135deg,#c47d8e,#a3586b)",
    logoGrad:"linear-gradient(135deg,#c47d8e,#8b5e6b)",
  };

  return(
    <div className="root">
      
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .root{min-height:100vh;background:${t.bg};font-family:'Outfit',sans-serif;display:flex;align-items:center;justify-content:center;transition:background 1.5s ease;position:relative;overflow:hidden}
        .serif{font-family:'Cormorant Garamond',serif}.m{font-family:'JetBrains Mono',monospace}
        button{cursor:pointer;font-family:inherit;border:none}input{font-family:inherit}
        @keyframes fu{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        @keyframes pop{0%{transform:scale(0.8);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
        @keyframes float1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(15px,-10px) scale(1.03)}}
        .orb{position:absolute;border-radius:50%;pointer-events:none;filter:blur(80px)}
        .code-input{width:48px;height:56px;max-width:calc((100vw - 120px)/6);text-align:center;font-size:24px;font-weight:700;border-radius:12px;outline:none;transition:border-color 0.2s,box-shadow 0.2s}
        .code-input:focus{border-color:#c47d8e!important;box-shadow:0 0 0 3px rgba(196,125,142,0.15)}
      `}</style>

      {/* Background */}
      <div className="orb" style={{width:300,height:300,top:"-15%",right:"-10%",background:dark?"rgba(196,125,142,0.08)":"rgba(196,125,142,0.06)",animation:"float1 18s ease-in-out infinite"}}/>
      <div className="orb" style={{width:200,height:200,bottom:"-10%",left:"-5%",background:dark?"rgba(100,120,200,0.06)":"rgba(100,120,200,0.04)",animation:"float1 22s ease-in-out infinite 3s"}}/>
      <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(${dark?"rgba(255,255,255,0.015)":"rgba(0,0,0,0.015)"} 1px,transparent 1px),linear-gradient(90deg,${dark?"rgba(255,255,255,0.015)":"rgba(0,0,0,0.015)"} 1px,transparent 1px)`,backgroundSize:"60px 60px",pointerEvents:"none"}}/>

      {/* Card */}
      <div style={{width:"100%",maxWidth:420,padding:20,position:"relative",zIndex:1,animation:"fu 0.5s ease"}}>
        <div style={{background:t.surface,border:`1px solid ${t.surfaceBorder}`,borderRadius:24,padding:"40px 32px",backdropFilter:"blur(20px)",boxShadow:dark?"0 20px 60px rgba(0,0,0,0.4)":"0 20px 60px rgba(0,0,0,0.08)",transition:"background 1.5s ease",textAlign:"center"}}>

          {!verified?<>
            {/* Logo */}
            <div style={{width:48,height:48,borderRadius:14,background:t.logoGrad,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"#fff",marginBottom:16,boxShadow:"0 8px 24px rgba(196,125,142,0.2)"}}>B</div>
            <h1 className="serif" style={{fontSize:26,fontWeight:600,color:t.text,marginBottom:6}}>Verify Your Account</h1>
            <p style={{fontSize:14,color:t.textSoft,marginBottom:6}}>We sent a 6-digit code to</p>
            <p style={{fontSize:14,color:t.accent,fontWeight:600,marginBottom:28}}>user@example.com</p>

            {/* Error */}
            {error&&<div style={{padding:"10px 14px",borderRadius:10,background:dark?"rgba(220,38,38,0.1)":"#fef2f2",border:`1px solid ${dark?"rgba(220,38,38,0.2)":"#fecaca"}`,color:t.red,fontSize:13,marginBottom:16,animation:"fu 0.2s ease"}}>⚠️ {error}</div>}

            {/* 6-digit code input */}
            <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:24}}>
              {code.map((digit,i)=>(
                <input
                  key={i}
                  ref={el=>inputs.current[i]=el}
                  className="code-input m"
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e=>handleChange(i,e.target.value)}
                  onKeyDown={e=>handleKeyDown(i,e)}
                  onPaste={i===0?handlePaste:undefined}
                  disabled={verifying}
                  style={{background:t.inputBg,border:`1px solid ${digit?t.accent:t.inputBorder}`,color:t.text,opacity:verifying?0.5:1}}
                />
              ))}
            </div>

            {/* Verifying state */}
            {verifying&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:20,color:t.accent}}>
              <span style={{width:16,height:16,border:"2px solid rgba(196,125,142,0.3)",borderTopColor:t.accent,borderRadius:"50%",animation:"spin 0.6s linear infinite"}}/>
              <span style={{fontSize:14,fontWeight:500}}>Verifying...</span>
            </div>}

            {/* Resend */}
            <div style={{fontSize:13,color:t.textMuted}}>
              {resendTimer>0?(
                <span>Resend code in <span className="m" style={{color:t.accent,fontWeight:600}}>{resendTimer}s</span></span>
              ):(
                <button onClick={resend} style={{background:"none",color:t.accent,fontWeight:600,fontSize:13}}>Resend Code</button>
              )}
            </div>

            <div style={{marginTop:24,paddingTop:16,borderTop:`1px solid ${t.surfaceBorder}`,fontSize:12,color:t.textMuted,lineHeight:1.6}}>
              Check your spam folder if you don't see it. <br/>Code expires in 15 minutes.
            </div>
          </>:<>
            {/* Success state */}
            <div style={{animation:"pop 0.4s ease"}}>
              <div style={{width:64,height:64,borderRadius:"50%",background:dark?"rgba(110,231,183,0.1)":"rgba(5,150,105,0.08)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:32,marginBottom:16,border:`2px solid ${t.green}`}}>✓</div>
              <h1 className="serif" style={{fontSize:26,fontWeight:600,color:t.text,marginBottom:8}}>Verified!</h1>
              <p style={{fontSize:14,color:t.textSoft,marginBottom:28}}>Your account has been verified successfully. You're all set to start using BoostPanel.</p>
              <a href="/dashboard" style={{display:"inline-block",padding:"14px 40px",borderRadius:12,background:t.btnPrimary,color:"#fff",fontSize:15,fontWeight:700,textDecoration:"none"}}>Go to Dashboard</a>
            </div>
          </>}
        </div>

        <div style={{textAlign:"center",marginTop:20}}>
          <a href="/" style={{fontSize:13,color:t.textMuted,textDecoration:"none"}}>← Back to home</a>
        </div>
      </div>
    </div>
  );
}
