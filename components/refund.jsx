'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function Refund(){
  return <ThemeProvider><RefundInner/></ThemeProvider>;
}

function RefundInner(){
  const {t}=useTheme();
  const sections=[
    ["Overview","Nitro is committed to delivering every order to your satisfaction. This refund policy outlines the circumstances under which you may be eligible for a refund or wallet credit. All refunds are processed to your Nitro wallet balance unless otherwise stated."],
    ["Eligible Refunds","You may request a refund in the following cases: the order was not delivered at all within the stated delivery time, the order was only partially delivered (you will be refunded for the undelivered portion), you were charged incorrectly due to a system error, or the service delivered was fundamentally different from what was described."],
    ["Non-Refundable Cases","Refunds will not be issued in the following situations: natural follower or engagement drops after successful delivery (services with refill guarantees will be refilled instead), orders where the provided link was incorrect or the account was set to private, orders for accounts that were deleted, suspended, or changed username after the order was placed, or dissatisfaction with the speed of delivery when delivery is still within the stated timeframe."],
    ["Refill Guarantee","Services marked with a refill guarantee will automatically be replenished if followers, likes, or other engagement drops within the stated guarantee period (typically 30 days). Refill requests are processed automatically and do not require a support ticket. Refills are not available for services not marked with a refill guarantee."],
    ["How to Request a Refund","To request a refund, open a support ticket from your dashboard with the subject line \"Refund Request\" and include your order ID. Our team will review your request within 24-48 hours. If approved, the refund will be credited to your Nitro wallet immediately."],
    ["Wallet Balance Refunds","All refunds are credited to your Nitro wallet balance. We do not process refunds directly to payment methods (cards, bank accounts). Wallet balances can be used for future orders on the platform."],
    ["Deposit Refunds","Deposits to your wallet are non-refundable once credited. If a deposit fails or is not credited to your account, please contact support with your payment reference for investigation. Failed deposits that were debited from your bank will be resolved with the payment processor."],
    ["Processing Time","Refund requests are typically reviewed within 24-48 hours. Once approved, wallet credits are applied instantly. For disputed transactions involving payment processors, resolution may take 5-10 business days."],
    ["Contact","For refund-related questions, open a support ticket from your dashboard or contact us at support@thenitro.ng"],
  ];
  return <LegalLayout label="Policy" title="Refund" titleAccent="Policy" date="March 23, 2026" sections={sections} emailField="support@thenitro.ng" relatedLinks={[["Terms of Service","/terms"],["Privacy Policy","/privacy"],["Cookie Policy","/cookie"]]}/>;
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
