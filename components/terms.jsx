'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function Terms(){
  return <ThemeProvider><TermsInner/></ThemeProvider>;
}

function TermsInner(){
  const {t}=useTheme();
  const sections=[
    ["Acceptance of Terms","By creating an account on Nitro (\"the Platform\"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use our services. We reserve the right to update these terms at any time, and continued use of the Platform constitutes acceptance of any modifications."],
    ["Description of Services","Nitro is a social media marketing (SMM) platform that provides digital marketing services including but not limited to social media engagement, followers, views, likes, and related promotional services across various platforms. We act as an intermediary between you and third-party service providers. We do not guarantee specific outcomes, and delivery times are estimates only."],
    ["Account Registration","You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. You must be at least 18 years of age to use this Platform. We reserve the right to suspend or terminate accounts that violate these terms, provide false information, or engage in fraudulent activity."],
    ["Payments, Wallet & Refunds","All payments are processed in Nigerian Naira (₦) through our supported payment gateways. Funds added to your wallet are non-refundable except in cases where services cannot be delivered. Refunds for undelivered or cancelled orders are credited to your Nitro wallet, not to your original payment method, unless otherwise required by law. We reserve the right to modify service pricing at any time without prior notice."],
    ["Service Delivery & Guarantees","Delivery times are estimates and may vary based on demand, provider availability, and platform conditions. Services marked with \"refill\" include automatic replenishment within the stated period if engagement drops. We do not guarantee that services will not be removed by the target social media platform. We are not responsible for account suspensions, bans, or penalties imposed by third-party social media platforms as a result of using our services."],
    ["Data Collection & Usage","By using Nitro, you acknowledge and consent to our collection and use of data generated through your interaction with the Platform. This includes account information, transaction history, order data, usage patterns, device information, and communication records. We use this data to operate and improve our services, personalize your experience, process transactions, and for internal business purposes including research, analytics, and service optimization."],
    ["Prohibited Uses","You agree not to use the Platform for any illegal activity or to violate any applicable law, to distribute malware, spam, or harmful content, to attempt to gain unauthorized access to our systems, to resell our services without authorization, to abuse our referral program through fraudulent means, or to engage in any activity that could damage the Platform's reputation or operations."],
    ["Intellectual Property","All content, branding, design, and technology on Nitro is the property of Nitro and is protected by applicable intellectual property laws. You may not copy, reproduce, or distribute any part of the Platform without our express written consent."],
    ["Limitation of Liability","Nitro is provided \"as is\" without warranties of any kind. We shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform. Our total liability for any claim shall not exceed the amount you paid to us in the 30 days preceding the claim."],
    ["Termination","We may suspend or terminate your account at our sole discretion, with or without cause, and with or without notice. Upon termination, your right to use the Platform ceases immediately. Wallet balances on terminated accounts due to terms violations are forfeited."],
    ["Governing Law","These Terms shall be governed by and construed in accordance with the laws of the Federal Republic of Nigeria. Any disputes shall be resolved through the courts of Lagos State, Nigeria."],
    ["Contact","For questions about these Terms, contact us at legal@thenitro.ng"],
  ];
  return <LegalLayout label="Legal" title="Terms of" titleAccent="Service" date="March 23, 2026" sections={sections} emailField="legal@thenitro.ng" relatedLinks={[["Privacy Policy","/privacy"],["Refund Policy","/refund"],["Cookie Policy","/cookie"]]} action="back"/>;
}

function LegalLayout({label,title,titleAccent,date,sections,emailField,relatedLinks,action}){
  const {t}=useTheme();
  return(
    <div style={{minHeight:"100dvh",background:t.bg,fontFamily:"'Outfit',system-ui,sans-serif",transition:"background .5s ease",display:"flex",flexDirection:"column"}}>
      <SharedStyles/>
      <SharedNav action={action}/>
      <div style={{flex:1,maxWidth:780,margin:"0 auto",width:"100%",padding:"48px 24px 60px"}}>
        <div style={{marginBottom:40}}>
          <div style={{fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:3,color:t.accent,marginBottom:10}}>{label}</div>
          <h1 style={{fontSize:"clamp(32px,5vw,44px)",fontWeight:700,color:t.text,letterSpacing:-.5,lineHeight:1.1,marginBottom:8}}>{title} <span className="serif" style={{fontWeight:400,fontStyle:"italic",color:t.accent,fontSize:"clamp(36px,5.5vw,50px)"}}>{titleAccent}</span></h1>
          <p className="m" style={{fontSize:13,color:t.muted,fontWeight:500}}>Last updated: {date}</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {sections.map(([sTitle,content],i)=>(
            <div key={i} style={{padding:"24px 24px",borderRadius:18,background:t.surface,border:`1px solid ${t.surfaceBrd}`,backdropFilter:"blur(16px)",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,width:"25%",height:2,background:t.accent,opacity:.3}}/>
              <div style={{display:"flex",alignItems:"flex-start",gap:16}}>
                <span className="m" style={{fontSize:13,fontWeight:600,color:t.accent,flexShrink:0,marginTop:2,width:24}}>{String(i+1).padStart(2,"0")}</span>
                <div style={{flex:1}}>
                  <h2 style={{fontSize:17,fontWeight:600,color:t.text,marginBottom:10,letterSpacing:-.2}}>{sTitle}</h2>
                  <p style={{fontSize:15,color:t.soft,lineHeight:1.85,fontWeight:450}}>
                    {emailField&&content.includes(emailField)?<>{content.split(emailField)[0]}<a href={`mailto:${emailField}`} style={{color:t.accent}}>{emailField}</a>{content.split(emailField)[1]||""}</>:content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop:40,display:"flex",gap:16,flexWrap:"wrap"}}>
          {relatedLinks.map(([l,h])=><a key={l} href={h} style={{fontSize:14,color:t.accent,fontWeight:500}}>{l}</a>)}
        </div>
      </div>
      <SharedFooter/>
    </div>
  );
}
