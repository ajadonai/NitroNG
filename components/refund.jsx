'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { SITE } from "../lib/site";

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
    ["Contact",`For refund-related questions, open a support ticket from your dashboard or contact us at ${SITE.email.general}`],
  ];
  return <LegalLayout label="Policy" title="Refund" titleAccent="Policy" date="March 23, 2026" sections={sections} emailField={SITE.email.general} relatedLinks={[["Terms of Service","/terms"],["Privacy Policy","/privacy"],["Cookie Policy","/cookie"]]}/>;
}

function LegalLayout({label,title,titleAccent,date,sections,emailField,relatedLinks}){
  const {t}=useTheme();
  return(
    <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif] transition-[background] duration-500" style={{background:t.bg}}>
      <SharedStyles/><SharedNav action="back"/>
      <div className="flex-1 max-w-[780px] mx-auto w-full py-12 px-6 pb-[60px]">
        <div className="mb-10">
          <div className="text-[11px] font-semibold uppercase tracking-[3px] mb-2.5" style={{color:t.accent}}>{label}</div>
          <h1 className="text-[clamp(32px,5vw,44px)] font-bold tracking-tight leading-tight mb-2" style={{color:t.text}}>{title} <span className="serif font-normal italic text-[clamp(36px,5.5vw,50px)]" style={{color:t.accent}}>{titleAccent}</span></h1>
          <p className="text-[13px] font-medium" style={{color:t.muted}}>Last updated: {date}</p>
        </div>
        <div className="flex flex-col gap-4">
          {sections.map(([sTitle,content],i)=>(
            <div key={i} className="p-6 rounded-[18px] backdrop-blur-[16px] relative overflow-hidden" style={{background:t.surface,border:`1px solid ${t.surfaceBrd}`}}>
              <div className="absolute top-0 left-0 w-1/4 h-0.5 opacity-30" style={{background:t.accent}}/>
              <div className="flex items-start gap-4">
                <span className="text-[13px] font-semibold shrink-0 mt-0.5 w-6" style={{color:t.accent}}>{String(i+1).padStart(2,"0")}</span>
                <div className="flex-1">
                  <h2 className="text-[17px] font-semibold mb-2.5 -tracking-[.2px]" style={{color:t.text}}>{sTitle}</h2>
                  <p className="text-[15px] leading-[1.85]" style={{color:t.soft,fontWeight:500}}>
                    {emailField&&content.includes(emailField)?<>{content.split(emailField)[0]}<a href={`mailto:${emailField}`} style={{color:t.accent}}>{emailField}</a>{content.split(emailField)[1]||""}</>:content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 flex gap-4 flex-wrap">{relatedLinks.map(([l,h])=><a key={l} href={h} className="text-sm font-medium" style={{color:t.accent}}>{l}</a>)}</div>
      </div>
      <SharedFooter/>
    </div>
  );
}
