'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';


export default function Refund(){
  return <ThemeProvider><RefundInner/></ThemeProvider>;
}

function RefundInner(){
  const {t}=useTheme();
  const sections=[
    ["Overview","All refunds on Nitro are credited to your Nitro wallet balance. We do not process refunds to bank accounts, cards, or any external payment method. Your wallet balance can be used for any future order on the platform."],
    ["Automatic Refunds","You are refunded automatically in the following cases: you cancel a pending order before processing begins (full refund), our provider cancels or fails to place your order (full refund), or your order is only partially delivered (you are refunded for the undelivered portion). These refunds are automatic and require no action from you."],
    ["Cancellation by You","You can cancel an order from your dashboard if it has not yet been sent to our provider for processing. Once an order is sent to a provider, it cannot be cancelled by you — contact us on WhatsApp if you need help. Orders using scheduled (drip) delivery cannot be cancelled after placement."],
    ["Refunds by Nitro","Our team may issue a full or partial refund to your wallet in cases such as: a billing or system error, a service that was fundamentally different from what was described, or an order that failed to deliver within a reasonable timeframe. To request a review, message us on WhatsApp with your order ID."],
    ["Non-Refundable Cases","Refunds are not available in the following situations: natural follower or engagement drops after successful delivery (use the refill feature if your service is eligible), orders where the link you provided was incorrect or the account was set to private, orders for accounts that were deleted, suspended, or changed username after placement, dissatisfaction with delivery speed while delivery is still in progress, or wallet deposits that have already been credited to your account."],
    ["Refills","Some services include refill coverage. If you lose followers or engagement after delivery, you can request a refill from your dashboard — at no extra cost. Refills are only available on completed orders with an eligible service, and must be requested within the refill window (shown on your order). Refills are not available on services without refill coverage. Important: refills only cover drops that occur after your order has been fully delivered above the original start count. If your count falls below the start count — typically caused by platform-wide cleanups, content removal, username changes, or broader engagement reductions — refill coverage does not apply."],
    ["Failed Deposits","If a deposit fails or is debited from your bank but not credited to your Nitro wallet, contact us on WhatsApp with your payment reference. We will investigate and resolve the issue with the payment processor."],
    ["Contact","For refund-related questions, message us on WhatsApp — we typically respond within minutes."],
  ];
  return <LegalLayout label="Policy" title="Refund" titleAccent="Policy" date="June 14, 2026" sections={sections} relatedLinks={[["Terms of Service","/terms"],["Privacy Policy","/privacy"],["Cookie Policy","/cookie"]]}/>;
}

function LegalLayout({label,title,titleAccent,date,sections,relatedLinks}){
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
                    {content}
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
