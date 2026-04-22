'use client';
import { useState, useEffect, useRef } from "react";
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function VerifyAccount(){
  return <ThemeProvider><VerifyInner/></ThemeProvider>;
}

function VerifyInner(){
  const {dark,t}=useTheme();
  const [code,setCode]=useState(["","","","","",""]);
  const [verifying,setVerifying]=useState(false);
  const [error,setError]=useState("");
  const [resendTimer,setResendTimer]=useState(60);
  const [verified,setVerified]=useState(false);
  const [userEmail,setUserEmail]=useState("");
  const inputs=useRef([]);

  useEffect(()=>{fetch("/api/auth/me").then(r=>r.json()).then(d=>{if(d.user?.email)setUserEmail(d.user.email);}).catch(()=>{});},[]);
  useEffect(()=>{if(resendTimer<=0)return;const iv=setInterval(()=>setResendTimer(p=>p-1),1000);return()=>clearInterval(iv);},[resendTimer]);

  const submitCode=async(codeStr)=>{
    setVerifying(true);setError("");
    try{
      const res=await fetch("/api/auth/verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:codeStr})});
      const data=await res.json();
      if(!res.ok){setError(data.error||"Invalid code");setVerifying(false);return;}
      setVerified(true);
    }catch{setError("Something went wrong. Please try again.");setVerifying(false);}
  };
  const resendCode=async()=>{
    setResendTimer(60);
    try{const res=await fetch("/api/auth/verify",{method:"PUT"});const data=await res.json();if(!res.ok)setError(data.error||"Failed to resend");}catch{setError("Failed to resend code");}
  };
  const handleChange=(i,val)=>{
    if(!/^\d*$/.test(val))return;
    const next=[...code];next[i]=val.slice(-1);setCode(next);setError("");
    if(val&&i<5)inputs.current[i+1]?.focus();
    if(next.every(d=>d)&&next.join("").length===6){setVerifying(true);submitCode(next.join(""));}
  };
  const handleKeyDown=(i,e)=>{if(e.key==="Backspace"&&!code[i]&&i>0)inputs.current[i-1]?.focus();};
  const handlePaste=(e)=>{
    e.preventDefault();const pasted=e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
    if(!pasted.length)return;const next=[...code];for(let i=0;i<6;i++)next[i]=pasted[i]||"";
    setCode(next);inputs.current[Math.min(pasted.length,5)]?.focus();
    if(next.every(d=>d)){setVerifying(true);submitCode(next.join(""));}
  };
  const resend=()=>{if(resendTimer<=0){resendCode();setError("");setCode(["","","","","",""]);inputs.current[0]?.focus();}};

  return(
    <div style={{minHeight:"100dvh",background:t.bg,fontFamily:"'Outfit',system-ui,sans-serif",transition:"background .5s ease",display:"flex",flexDirection:"column"}}>
      <SharedStyles/>
      <style>{`
        @keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
        @keyframes pop{0%{transform:scale(0.8);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
      `}</style>
      <SharedNav action={null}/>

      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div className="w-full max-w-[440px] max-lg:max-w-[420px] max-md:max-w-full h-[580px] max-lg:h-[540px] max-md:h-[520px] max-h-[90dvh] max-md:max-h-none overflow-hidden rounded-[20px] max-md:rounded-2xl backdrop-blur-[20px] text-center flex flex-col justify-center py-9 px-8 max-lg:py-8 max-lg:px-7 max-md:py-6 max-md:px-5" style={{background:dark?"rgba(17,22,40,0.98)":"rgba(255,255,255,0.98)",border:`1px solid ${t.surfaceBrd}`,boxShadow:dark?"0 20px 60px rgba(0,0,0,0.5)":"0 20px 60px rgba(0,0,0,0.1)"}}>

          {!verified?<>
            <div style={{marginBottom:20}}><div style={{width:38,height:38,borderRadius:10,background:t.grad,display:"inline-flex",alignItems:"center",justifyContent:"center"}}><svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M4,16 L4,4 L16,16 L16,4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></div></div>
            <h2 style={{fontSize:24,fontWeight:600,color:t.text,marginBottom:4}}>Verify Your Account</h2>
            <p style={{fontSize:15,color:t.soft,marginBottom:4,fontWeight:450}}>We sent a 6-digit code to</p>
            <p style={{fontSize:14,color:t.accent,fontWeight:600,marginBottom:28}}>{userEmail||"your email"}</p>
            <div style={{height:36,marginBottom:2,display:"flex",alignItems:"center"}}>{error?<div style={{width:"100%",padding:"8px 12px",borderRadius:8,background:dark?"rgba(220,38,38,0.1)":"#fef2f2",border:`1px solid ${dark?"rgba(220,38,38,0.2)":"#fecaca"}`,color:t.red,fontSize:13,lineHeight:1.2}}>⚠️ {error}</div>:null}</div>
            <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:28}}>
              {code.map((digit,i)=>(
                <input key={i} ref={el=>inputs.current[i]=el} className="m w-12 h-14 max-md:w-[42px] max-md:h-12 text-center text-2xl max-md:text-xl font-bold rounded-xl max-md:rounded-[10px] outline-none transition-[border-color,box-shadow] duration-200 focus:!border-accent focus:shadow-[0_0_0_3px_rgba(196,125,142,.15)]" type="text" inputMode="numeric" maxLength={1} value={digit}
                  onChange={e=>handleChange(i,e.target.value)} onKeyDown={e=>handleKeyDown(i,e)} onPaste={i===0?handlePaste:undefined} disabled={verifying}
                  style={{maxWidth:"calc((100vw - 140px)/6)",background:t.inputBg,border:`1px solid ${digit?t.accent:t.inputBorder}`,color:t.text,opacity:verifying?.5:1}}/>
              ))}
            </div>
            {verifying&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:20,color:t.accent}}>
              <span style={{width:16,height:16,border:"2px solid rgba(196,125,142,.3)",borderTopColor:t.accent,borderRadius:"50%",animation:"spin .6s linear infinite",display:"inline-block"}}/>
              <span style={{fontSize:15,fontWeight:500}}>Verifying...</span>
            </div>}
            <div style={{fontSize:14,color:t.muted,marginBottom:24}}>
              {resendTimer>0?<span>Resend code in <span style={{color:t.accent,fontWeight:600}}>{resendTimer}s</span></span>
              :<button onClick={resend} style={{background:"none",color:t.accent,fontWeight:600,fontSize:14,cursor:"pointer"}}>Resend Code</button>}
            </div>
            <div style={{paddingTop:16,borderTop:`1px solid ${t.surfaceBrd}`,fontSize:13,color:t.muted,lineHeight:1.6}}>
              Check your spam folder if you don't see it.<br/>Code expires in 15 minutes.
            </div>
          </>:<>
            <div style={{animation:"pop .4s ease"}}>
              <div style={{width:64,height:64,borderRadius:"50%",background:dark?"rgba(110,231,183,.1)":"rgba(5,150,105,.08)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:32,marginBottom:16,border:`2px solid ${t.green}`}}>✓</div>
              <h2 style={{fontSize:24,fontWeight:600,color:t.text,marginBottom:8}}>Verified!</h2>
              <p style={{fontSize:15,color:t.soft,marginBottom:28,fontWeight:450}}>Your account has been verified successfully. You're all set to start using Nitro.</p>
              <a href="/dashboard" style={{display:"inline-block",padding:"14px 40px",borderRadius:12,background:t.btnPrimary,color:"#fff",fontSize:16,fontWeight:600}}>Go to Dashboard</a>
            </div>
          </>}
        </div>
      </div>
      <SharedFooter/>
    </div>
  );
}
