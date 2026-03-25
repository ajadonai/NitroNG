'use client';
import { useState, useEffect } from "react";

export default function Refund(){
  const getAuto=()=>{const h=new Date().getHours();return h>=7&&h<18?false:true;};
  const [dark,setDark]=useState(getAuto);
  const [mo,setMo]=useState(false);
  const toggleTheme=()=>{setMo(true);setDark(d=>!d);};
  useEffect(()=>{if(mo)return;const iv=setInterval(()=>setDark(getAuto()),60000);return()=>clearInterval(iv);},[mo]);
  const t={
    bg:dark?"#080b14":"#f4f1ed",text:dark?"#e8e4df":"#1a1a1a",textSoft:dark?"#8a8680":"#888580",textMuted:dark?"#555250":"#b0ada8",
    accent:"#c47d8e",surface:dark?"rgba(15,18,30,0.92)":"rgba(255,255,255,0.92)",surfaceBorder:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.08)",
    logoGrad:"linear-gradient(135deg,#c47d8e,#8b5e6b)",
  };
  const S=({title,children})=><div style={{marginBottom:32}}><h2 className="serif" style={{fontSize:20,fontWeight:600,color:t.text,marginBottom:10}}>{title}</h2><div style={{fontSize:14,color:t.textSoft,lineHeight:1.9}}>{children}</div></div>;

  return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'Plus Jakarta Sans',-apple-system,sans-serif",transition:"background 1.5s ease"}}>
      <style>{`.serif{font-family:'Plus Jakarta Sans',-apple-system,sans-serif}`}</style>

      <div style={{padding:"24px 0",borderBottom:`1px solid ${t.surfaceBorder}`,position:"sticky",top:0,zIndex:50,background:t.bg,backdropFilter:"blur(20px)",transition:"background 1.5s ease"}}>
        <div style={{maxWidth:800,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={()=>window.location.href="/"} style={{display:"flex",alignItems:"center",gap:10,background:"none",padding:0,border:"none",outline:"none",cursor:"pointer"}}>
            <div style={{width:32,height:32,borderRadius:10,background:t.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#fff"}}>N</div>
            <span className="serif" style={{fontSize:18,fontWeight:600,color:t.text}}>Nitro</span>
          </button>
          <button onClick={toggleTheme} style={{display:"flex",alignItems:"center",background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)",borderRadius:20,padding:3,width:52,height:28,border:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)"}`,position:"relative",flexShrink:0,transition:"background 1.5s cubic-bezier(.4,0,.2,1),border-color 1.5s ease"}}><div style={{width:22,height:22,borderRadius:"50%",background:dark?"#c47d8e":"#e0a458",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,position:"absolute",left:dark?3:27,transition:"left 0.4s cubic-bezier(.4,0,.2,1),background 1.5s cubic-bezier(.4,0,.2,1)",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}>{dark?"🌙":"☀️"}</div></button>
        </div>
      </div>

      <div style={{maxWidth:800,margin:"0 auto",padding:"48px 24px 80px"}}>
        <h1 className="serif" style={{fontSize:"clamp(28px,5vw,40px)",fontWeight:600,color:t.text,marginBottom:6}}>Refund Policy</h1>
        <p style={{fontSize:13,color:t.textMuted,marginBottom:40}}>Last updated: March 23, 2026</p>

        <S title="1. Overview">
          Nitro is committed to delivering every order to your satisfaction. This refund policy outlines the circumstances under which you may be eligible for a refund or wallet credit. All refunds are processed to your Nitro wallet balance unless otherwise stated.
        </S>

        <S title="2. Eligible Refunds">
          You may request a refund in the following cases: the order was not delivered at all within the stated delivery time, the order was only partially delivered (you will be refunded for the undelivered portion), you were charged incorrectly due to a system error, or the service delivered was fundamentally different from what was described.
        </S>

        <S title="3. Non-Refundable Cases">
          Refunds will not be issued in the following situations: natural follower or engagement drops after successful delivery (services with refill guarantees will be refilled instead), orders where the provided link was incorrect or the account was set to private, orders for accounts that were deleted, suspended, or changed username after the order was placed, or dissatisfaction with the speed of delivery when delivery is still within the stated timeframe.
        </S>

        <S title="4. Refill Guarantee">
          Services marked with a refill guarantee will automatically be replenished if followers, likes, or other engagement drops within the stated guarantee period (typically 30 days). Refill requests are processed automatically and do not require a support ticket. Refills are not available for services not marked with a refill guarantee.
        </S>

        <S title="5. How to Request a Refund">
          To request a refund, open a support ticket from your dashboard with the subject line "Refund Request" and include your order ID. Our team will review your request within 24-48 hours. If approved, the refund will be credited to your Nitro wallet immediately.
        </S>

        <S title="6. Wallet Balance Refunds">
          All refunds are credited to your Nitro wallet balance. We do not process refunds directly to payment methods (cards, bank accounts). Wallet balances can be used for future orders on the platform.
        </S>

        <S title="7. Deposit Refunds">
          Deposits to your wallet are non-refundable once credited. If a deposit fails or is not credited to your account, please contact support with your payment reference for investigation. Failed deposits that were debited from your bank will be resolved with the payment processor.
        </S>

        <S title="8. Processing Time">
          Refund requests are typically reviewed within 24-48 hours. Once approved, wallet credits are applied instantly. For disputed transactions involving payment processors, resolution may take 5-10 business days.
        </S>

        <S title="9. Contact">
          For refund-related questions, open a support ticket from your dashboard or contact us at <a href="mailto:support@thenitro.ng" style={{color:t.accent}}>support@thenitro.ng</a>
        </S>

        <div style={{marginTop:40,paddingTop:24,borderTop:`1px solid ${t.surfaceBorder}`,display:"flex",gap:20,fontSize:13,color:t.textMuted}}>
          <a href="/terms" style={{color:t.accent,textDecoration:"none"}}>Terms of Service</a>
          <a href="/privacy" style={{color:t.accent,textDecoration:"none"}}>Privacy Policy</a>
          <a href="/" style={{color:t.textMuted,textDecoration:"none"}}>Back to Home</a>
        </div>
      </div>

      <footer style={{borderTop:`1px solid ${t.surfaceBorder}`,marginTop:40}}>
        <div style={{maxWidth:800,margin:"0 auto",padding:"24px 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
            <div style={{fontSize:12,color:t.textMuted}}>© 2026 Nitro. All rights reserved.</div>
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
