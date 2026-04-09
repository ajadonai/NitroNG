'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function CookiePolicy(){
  return <ThemeProvider><CookieInner/></ThemeProvider>;
}

function CookieInner(){
  const {t}=useTheme();
  const sections=[
    ["What Are Cookies","Cookies are small text files that are stored on your device when you visit a website. They help us recognize your browser, remember your preferences, and improve your experience on Nitro. Cookies do not contain personal information like passwords or payment details."],
    ["How We Use Cookies","Nitro uses cookies for authentication (keeping you logged in across pages and sessions), preferences (remembering your theme choice, language, and display settings), security (protecting against cross-site request forgery and unauthorized access), and analytics (understanding how users interact with our platform to improve our services)."],
    ["Types of Cookies We Use","We use three categories of cookies. Essential cookies are required for the platform to function — these include authentication tokens and session identifiers, and without them you cannot use Nitro. Functional cookies remember your preferences such as dark/light mode, collapsed sidebar state, and display settings. Analytics cookies help us understand usage patterns, popular services, and platform performance using aggregated and anonymized data."],
    ["Third-Party Cookies","Our payment processors (Paystack, Flutterwave) may set their own cookies during the payment process. These are governed by their respective privacy and cookie policies. We do not control third-party cookies."],
    ["Cookie Duration","Session cookies are deleted when you close your browser. Persistent cookies remain on your device for a set period: authentication cookies last up to 7 days, preference cookies last up to 1 year, and analytics cookies last up to 90 days."],
    ["Managing Cookies","You can manage or delete cookies through your browser settings. Most browsers allow you to block or delete cookies, view which cookies are stored, and set preferences for specific websites. Note that blocking essential cookies will prevent you from using Nitro."],
    ["Changes to This Policy","We may update this Cookie Policy from time to time. Changes will be posted on this page with an updated revision date. Continued use of Nitro after changes constitutes acceptance."],
    ["Contact","For questions about our use of cookies, contact us at info@nitro.ng"],
  ];
  return <LegalLayout label="Cookies" title="Cookie" titleAccent="Policy" date="March 23, 2026" sections={sections} emailField="info@nitro.ng" relatedLinks={[["Terms of Service","/terms"],["Privacy Policy","/privacy"],["Refund Policy","/refund"]]}/>;
}

function LegalLayout({label,title,titleAccent,date,sections,emailField,relatedLinks}){
  const {t}=useTheme();
  return(
    <div style={{minHeight:"100dvh",background:t.bg,fontFamily:"'Outfit',system-ui,sans-serif",transition:"background .5s ease",display:"flex",flexDirection:"column"}}>
      <SharedStyles/><SharedNav action="back"/>
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
        <div style={{marginTop:40,display:"flex",gap:16,flexWrap:"wrap"}}>{relatedLinks.map(([l,h])=><a key={l} href={h} style={{fontSize:14,color:t.accent,fontWeight:500}}>{l}</a>)}</div>
      </div>
      <SharedFooter/>
    </div>
  );
}
