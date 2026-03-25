'use client';
import NitroLogo from './nitro-logo';
import { useState, useEffect } from "react";

export default function CookiePolicy(){
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
            <NitroLogo size={32} variant="icon"/>
            <span className="serif" style={{fontSize:18,fontWeight:600,color:t.text}}>Nitro</span>
          </button>
          <button onClick={toggleTheme} style={{display:"flex",alignItems:"center",background:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.06)",borderRadius:20,padding:3,width:52,height:28,border:`1px solid ${dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.1)"}`,position:"relative",flexShrink:0,transition:"background 1.5s cubic-bezier(.4,0,.2,1),border-color 1.5s ease"}}><div style={{width:22,height:22,borderRadius:"50%",background:dark?"#c47d8e":"#e0a458",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,position:"absolute",left:dark?3:27,transition:"left 0.4s cubic-bezier(.4,0,.2,1),background 1.5s cubic-bezier(.4,0,.2,1)",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}>{dark?"🌙":"☀️"}</div></button>
        </div>
      </div>

      <div style={{maxWidth:800,margin:"0 auto",padding:"48px 24px 80px"}}>
        <h1 className="serif" style={{fontSize:"clamp(28px,5vw,40px)",fontWeight:600,color:t.text,marginBottom:6}}>Cookie Policy</h1>
        <p style={{fontSize:13,color:t.textMuted,marginBottom:40}}>Last updated: March 23, 2026</p>

        <S title="1. What Are Cookies">
          Cookies are small text files that are stored on your device when you visit a website. They help us recognize your browser, remember your preferences, and improve your experience on Nitro. Cookies do not contain personal information like passwords or payment details.
        </S>

        <S title="2. How We Use Cookies">
          Nitro uses cookies for the following purposes: authentication (keeping you logged in across pages and sessions), preferences (remembering your theme choice, language, and display settings), security (protecting against cross-site request forgery and unauthorized access), and analytics (understanding how users interact with our platform to improve our services).
        </S>

        <S title="3. Types of Cookies We Use">
          <p style={{marginBottom:12}}><strong style={{color:t.text}}>Essential cookies</strong> are required for the platform to function. These include authentication tokens and session identifiers. Without these, you cannot use Nitro.</p>
          <p style={{marginBottom:12}}><strong style={{color:t.text}}>Functional cookies</strong> remember your preferences such as dark/light mode, collapsed sidebar state, and display settings. These improve your experience but are not strictly necessary.</p>
          <p><strong style={{color:t.text}}>Analytics cookies</strong> help us understand usage patterns, popular services, and platform performance. This data is aggregated and anonymized.</p>
        </S>

        <S title="4. Third-Party Cookies">
          Our payment processors (Paystack, Flutterwave) may set their own cookies during the payment process. These are governed by their respective privacy and cookie policies. We do not control third-party cookies.
        </S>

        <S title="5. Cookie Duration">
          Session cookies are deleted when you close your browser. Persistent cookies remain on your device for a set period: authentication cookies last up to 7 days, preference cookies last up to 1 year, and analytics cookies last up to 90 days.
        </S>

        <S title="6. Managing Cookies">
          You can manage or delete cookies through your browser settings. Most browsers allow you to block or delete cookies, view which cookies are stored, and set preferences for specific websites. Note that blocking essential cookies will prevent you from using Nitro.
        </S>

        <S title="7. Changes to This Policy">
          We may update this Cookie Policy from time to time. Changes will be posted on this page with an updated revision date. Continued use of Nitro after changes constitutes acceptance.
        </S>

        <S title="8. Contact">
          For questions about our use of cookies, contact us at <a href="mailto:privacy@thenitro.ng" style={{color:t.accent}}>privacy@thenitro.ng</a>
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
