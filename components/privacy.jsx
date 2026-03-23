'use client';
import { useState } from "react";

export default function Privacy(){
  const getAuto=()=>{const h=new Date().getHours();return h>=7&&h<18?false:true;};
  const [dark]=useState(getAuto);
  const t={
    bg:dark?"#080b14":"#f4f1ed",text:dark?"#e8e4df":"#1a1a1a",textSoft:dark?"#8a8680":"#888580",textMuted:dark?"#555250":"#b0ada8",
    accent:"#c47d8e",surface:dark?"rgba(15,18,30,0.92)":"rgba(255,255,255,0.92)",surfaceBorder:dark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.08)",
    logoGrad:"linear-gradient(135deg,#c47d8e,#8b5e6b)",
  };
  const S=({title,children})=><div style={{marginBottom:32}}><h2 className="serif" style={{fontSize:20,fontWeight:600,color:t.text,marginBottom:10}}>{title}</h2><div style={{fontSize:14,color:t.textSoft,lineHeight:1.9}}>{children}</div></div>;

  return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:"'Outfit',sans-serif",transition:"background 1.5s ease"}}>
      
      <style>{`.serif{font-family:'Cormorant Garamond',serif}`}</style>

      <div style={{padding:"24px 0",borderBottom:`1px solid ${t.surfaceBorder}`,position:"sticky",top:0,zIndex:50,background:t.bg,backdropFilter:"blur(20px)",transition:"background 1.5s ease"}}>
        <div style={{maxWidth:800,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} style={{display:"flex",alignItems:"center",gap:10,background:"none",padding:0}}>
            <div style={{width:32,height:32,borderRadius:10,background:t.logoGrad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"#fff"}}>B</div>
            <span className="serif" style={{fontSize:18,fontWeight:600,color:t.text}}>BoostPanel</span>
          </button>
        </div>
      </div>

      <div style={{maxWidth:800,margin:"0 auto",padding:"48px 24px 80px"}}>
        <h1 className="serif" style={{fontSize:"clamp(28px,5vw,40px)",fontWeight:600,color:t.text,marginBottom:6}}>Privacy Policy</h1>
        <p style={{fontSize:13,color:t.textMuted,marginBottom:40}}>Last updated: March 23, 2026</p>

        <S title="1. Information We Collect">
          When you use BoostPanel, we collect information you provide directly, such as your name, email address, phone number, and payment details during registration and transactions. We also automatically collect technical data including your IP address, browser type, device information, operating system, referring URLs, pages viewed, time spent on pages, click patterns, and interaction data. Additionally, we collect transaction data including order history, wallet activity, payment records, and service usage metrics.
        </S>

        <S title="2. How We Use Your Information">
          We use the information we collect to provide, operate, and maintain our services, process your transactions and deliver ordered services, communicate with you about your account, orders, and support requests, improve and personalize your experience on the Platform, conduct research, analytics, and data analysis to enhance our services and develop new features, generate aggregated and anonymized insights for business intelligence, marketing analysis, and strategic planning, detect, prevent, and address fraud, abuse, and security issues, comply with legal obligations and enforce our terms, and send you updates, promotional materials, and relevant communications about our services. By using the Platform, you acknowledge that data generated through your use of our services may be utilized by BoostPanel for internal and commercial purposes, including service optimization, product development, market research, and business analytics.
        </S>

        <S title="3. Data Sharing & Disclosure">
          We may share your information with third-party payment processors (Paystack, Flutterwave, Monnify, Korapay) to facilitate transactions, with API service providers to fulfill your orders (only the minimum data required, such as target URLs), with analytics and infrastructure providers that help us operate the Platform, with law enforcement or regulatory authorities when required by law or to protect our legal rights, and in connection with a merger, acquisition, or sale of assets. We do not sell your personal contact information to third-party advertisers. However, we may share aggregated, anonymized data that does not identify you personally with partners, advertisers, or other third parties for commercial purposes.
        </S>

        <S title="4. Cookies & Tracking">
          We use cookies and similar technologies to keep you logged in and maintain your session, remember your preferences such as theme settings, analyze usage patterns and improve the Platform, and ensure security and prevent fraud. You can manage cookie preferences through your browser settings, though disabling certain cookies may affect Platform functionality.
        </S>

        <S title="5. Data Retention">
          We retain your personal data for as long as your account is active or as needed to provide services. Transaction records and order history are retained for a minimum of 5 years for legal and accounting purposes. After account deletion, we may retain anonymized and aggregated data indefinitely for analytics and business purposes. Backup copies may persist in our systems for a reasonable period after deletion.
        </S>

        <S title="6. Data Security">
          We implement industry-standard security measures including encryption of data in transit and at rest, secure payment processing through certified payment gateways, regular security audits and monitoring, and access controls limiting employee access to personal data. While we strive to protect your information, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.
        </S>

        <S title="7. Your Rights">
          Depending on your location and applicable law, you may have the right to access the personal data we hold about you, request correction of inaccurate data, request deletion of your account and associated data (subject to our retention requirements), object to certain processing of your data, and request a copy of your data in a portable format. To exercise these rights, contact us at <a href="mailto:privacy@boostpanel.ng" style={{color:t.accent}}>privacy@boostpanel.ng</a>. We will respond within 30 days.
        </S>

        <S title="8. Children's Privacy">
          BoostPanel is not intended for users under 18 years of age. We do not knowingly collect personal information from minors. If we learn that we have collected data from a user under 18, we will delete that information promptly.
        </S>

        <S title="9. International Data">
          Your data may be processed and stored in Nigeria and other countries where our service providers operate. By using the Platform, you consent to the transfer of your information to these locations.
        </S>

        <S title="10. Third-Party Links">
          The Platform may contain links to third-party websites and social media platforms. We are not responsible for the privacy practices or content of these external sites. We encourage you to review the privacy policies of any third-party services you interact with.
        </S>

        <S title="11. Changes to This Policy">
          We may update this Privacy Policy from time to time. Material changes will be communicated through the Platform or via email. Continued use of the Platform after changes constitutes acceptance of the updated policy.
        </S>

        <S title="12. Contact Us">
          For privacy-related questions or requests, contact us at <a href="mailto:privacy@boostpanel.ng" style={{color:t.accent}}>privacy@boostpanel.ng</a>
        </S>

        <div style={{marginTop:40,paddingTop:24,borderTop:`1px solid ${t.surfaceBorder}`,display:"flex",gap:20,fontSize:13,color:t.textMuted}}>
          <a href="/terms" style={{color:t.accent,textDecoration:"none"}}>Terms of Service</a>
          <a href="/" style={{color:t.textMuted,textDecoration:"none"}}>Back to Home</a>
        </div>
      </div>

      <footer style={{borderTop:`1px solid ${t.surfaceBorder}`,marginTop:40}}>
        <div style={{maxWidth:800,margin:"0 auto",padding:"24px 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
            <div style={{fontSize:12,color:t.textMuted}}>© 2026 BoostPanel. All rights reserved.</div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
              <div style={{display:"flex",gap:16}}>{["Twitter","Instagram"].map(s=><a key={s} href="#" style={{fontSize:12,color:t.textSoft,textDecoration:"none"}}>{s}</a>)}</div>
              <div style={{display:"flex",gap:16}}>{[["Terms","/terms"],["Privacy","/privacy"],["Refund","#"],["Cookie","#"]].map(([l,h])=><a key={l} href={h} style={{fontSize:11,color:t.textMuted,textDecoration:"none"}}>{l}</a>)}</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
