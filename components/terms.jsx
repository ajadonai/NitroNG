'use client';
import NitroLogo from './nitro-logo';
import { useState, useEffect } from "react";

export default function Terms(){
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

      {/* Header */}
      <div style={{padding:"24px 0",borderBottom:`1px solid ${t.surfaceBorder}`,position:"sticky",top:0,zIndex:50,background:t.bg,backdropFilter:"blur(20px)",transition:"background 1.5s ease"}}>
        <div style={{maxWidth:800,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={()=>window.location.href="/"} style={{display:"flex",alignItems:"center",gap:10,background:"none",padding:0,border:"none",outline:"none",cursor:"pointer"}}>
            <NitroLogo size={32} variant="icon"/>
            <span className="serif" style={{fontSize:18,fontWeight:600,color:t.text}}>Nitro</span>
          </button>
          <button onClick={toggleTheme} style={{display:"flex",alignItems:"center",background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)",borderRadius:20,padding:3,width:52,height:28,border:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)"}`,position:"relative",flexShrink:0,transition:"background 1.5s cubic-bezier(.4,0,.2,1),border-color 1.5s ease"}}><div style={{width:22,height:22,borderRadius:"50%",background:dark?"#c47d8e":"#e0a458",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,position:"absolute",left:dark?3:27,transition:"left 0.4s cubic-bezier(.4,0,.2,1),background 1.5s cubic-bezier(.4,0,.2,1)",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}>{dark?"🌙":"☀️"}</div></button>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:800,margin:"0 auto",padding:"48px 24px 80px"}}>
        <h1 className="serif" style={{fontSize:"clamp(28px,5vw,40px)",fontWeight:600,color:t.text,marginBottom:6}}>Terms of Service</h1>
        <p style={{fontSize:13,color:t.textMuted,marginBottom:40}}>Last updated: March 23, 2026</p>

        <S title="1. Acceptance of Terms">
          By creating an account on Nitro ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use our services. We reserve the right to update these terms at any time, and continued use of the Platform constitutes acceptance of any modifications.
        </S>

        <S title="2. Description of Services">
          Nitro is a social media marketing (SMM) platform that provides digital marketing services including but not limited to social media engagement, followers, views, likes, and related promotional services across various platforms. We act as an intermediary between you and third-party service providers. We do not guarantee specific outcomes, and delivery times are estimates only.
        </S>

        <S title="3. Account Registration">
          You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. You must be at least 18 years of age to use this Platform. We reserve the right to suspend or terminate accounts that violate these terms, provide false information, or engage in fraudulent activity.
        </S>

        <S title="4. Payments, Wallet & Refunds">
          All payments are processed in Nigerian Naira (₦) through our supported payment gateways. Funds added to your wallet are non-refundable except in cases where services cannot be delivered. Refunds for undelivered or cancelled orders are credited to your Nitro wallet, not to your original payment method, unless otherwise required by law. We reserve the right to modify service pricing at any time without prior notice. Minimum deposit amounts and payment gateway availability may vary.
        </S>

        <S title="5. Service Delivery & Guarantees">
          Delivery times are estimates and may vary based on demand, provider availability, and platform conditions. Services marked with "refill" include automatic replenishment within the stated period if engagement drops. We do not guarantee that services will not be removed by the target social media platform. Partial delivery may occur, in which case you may be eligible for a partial refund or refill. We are not responsible for account suspensions, bans, or penalties imposed by third-party social media platforms as a result of using our services.
        </S>

        <S title="6. Data Collection & Usage">
          By using Nitro, you acknowledge and consent to our collection and use of data generated through your interaction with the Platform. This includes account information, transaction history, order data, usage patterns, device information, IP addresses, and communication records. We use this data to operate and improve our services, personalize your experience, process transactions, provide customer support, conduct analytics, develop new features, ensure platform security, and for internal business purposes including but not limited to research, analytics, marketing insights, and service optimization. We may aggregate and anonymize data for statistical analysis, reporting, and business intelligence purposes. By using the Platform, you grant Nitro a non-exclusive, royalty-free license to use, process, and analyze data generated through your use of our services for any lawful business purpose.
        </S>

        <S title="7. Prohibited Uses">
          You agree not to use the Platform for any illegal activity or to violate any applicable law, to distribute malware, spam, or harmful content, to attempt to gain unauthorized access to our systems, to resell our services without authorization, to abuse our referral program through fraudulent means, or to engage in any activity that could damage the Platform's reputation or operations.
        </S>

        <S title="8. Intellectual Property">
          All content, branding, design, and technology on Nitro is the property of Nitro and is protected by applicable intellectual property laws. You may not copy, reproduce, or distribute any part of the Platform without our express written consent.
        </S>

        <S title="9. Limitation of Liability">
          Nitro is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform. Our total liability for any claim shall not exceed the amount you paid to us in the 30 days preceding the claim. We are not responsible for any losses resulting from third-party platform changes, API provider failures, or circumstances beyond our reasonable control.
        </S>

        <S title="10. Termination">
          We may suspend or terminate your account at our sole discretion, with or without cause, and with or without notice. Upon termination, your right to use the Platform ceases immediately. Wallet balances on terminated accounts due to terms violations are forfeited.
        </S>

        <S title="11. Governing Law">
          These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any disputes shall be resolved through the courts of Lagos State, Nigeria.
        </S>

        <S title="12. Contact">
          For questions about these Terms, contact us at <a href="mailto:legal@thenitro.ng" style={{color:t.accent}}>legal@thenitro.ng</a>
        </S>

        <div style={{marginTop:40,paddingTop:24,borderTop:`1px solid ${t.surfaceBorder}`,display:"flex",gap:20,fontSize:13,color:t.textMuted}}>
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
