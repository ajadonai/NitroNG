'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function Privacy(){
  return <ThemeProvider><PrivacyInner/></ThemeProvider>;
}

function PrivacyInner(){
  const {t}=useTheme();
  const sections=[
    ["Information We Collect","When you use Nitro, we collect information you provide directly, such as your name, email address, phone number, and payment details during registration and transactions. We also automatically collect technical data including your IP address, browser type, device information, operating system, referring URLs, pages viewed, time spent on pages, click patterns, and interaction data. Additionally, we collect transaction data including order history, wallet activity, payment records, and service usage metrics."],
    ["How We Use Your Information","We use the information we collect to provide, operate, and maintain our services, process your transactions and deliver ordered services, communicate with you about your account, orders, and support requests, improve and personalize your experience on the Platform, conduct research, analytics, and data analysis to enhance our services, detect, prevent, and address fraud, abuse, and security issues, comply with legal obligations and enforce our terms, and send you updates and relevant communications about our services."],
    ["Data Sharing & Disclosure","We may share your information with third-party payment processors (Paystack, Flutterwave, Monnify, Korapay) to facilitate transactions, with API service providers to fulfill your orders (only the minimum data required, such as target URLs), with analytics and infrastructure providers that help us operate the Platform, and with law enforcement or regulatory authorities when required by law. We do not sell your personal contact information to third-party advertisers. We may share aggregated, anonymized data with partners for commercial purposes."],
    ["Cookies & Tracking","We use cookies and similar technologies to keep you logged in and maintain your session, remember your preferences such as theme settings, analyze usage patterns and improve the Platform, and ensure security and prevent fraud. You can manage cookie preferences through your browser settings, though disabling certain cookies may affect Platform functionality."],
    ["Data Retention","We retain your personal data for as long as your account is active or as needed to provide services. Transaction records and order history are retained for a minimum of 5 years for legal and accounting purposes. After account deletion, we may retain anonymized and aggregated data indefinitely for analytics. Backup copies may persist in our systems for a reasonable period after deletion."],
    ["Data Security","We implement industry-standard security measures including encryption of data in transit and at rest, secure payment processing through certified payment gateways, regular security audits and monitoring, and access controls limiting employee access to personal data. While we strive to protect your information, no method of electronic transmission or storage is 100% secure."],
    ["Your Rights","Depending on your location and applicable law, you may have the right to access the personal data we hold about you, request correction of inaccurate data, request deletion of your account and associated data (subject to retention requirements), object to certain processing of your data, and request a copy of your data in a portable format. To exercise these rights, contact us at info@nitro.ng. We will respond within 30 days."],
    ["Children's Privacy","Nitro is not intended for users under 18 years of age. We do not knowingly collect personal information from minors. If we learn that we have collected data from a user under 18, we will delete that information promptly."],
    ["International Data","Your data may be processed and stored in Nigeria and other countries where our service providers operate. By using the Platform, you consent to the transfer of your information to these locations."],
    ["Third-Party Links","The Platform may contain links to third-party websites and social media platforms. We are not responsible for the privacy practices or content of these external sites."],
    ["Changes to This Policy","We may update this Privacy Policy from time to time. Material changes will be communicated through the Platform or via email. Continued use of the Platform after changes constitutes acceptance of the updated policy."],
    ["Contact Us","For privacy-related questions or requests, contact us at info@nitro.ng"],
  ];
  return <LegalLayout label="Privacy" title="Privacy" titleAccent="Policy" date="March 23, 2026" sections={sections} emailField="info@nitro.ng" relatedLinks={[["Terms of Service","/terms"],["Refund Policy","/refund"],["Cookie Policy","/cookie"]]}/>;
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
