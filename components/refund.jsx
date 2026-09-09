'use client';
import { ThemeProvider } from './shared-nav';
import { useT } from "./locale";
import { LegalLayout } from './legal-layout';

export default function Refund(){
  return <ThemeProvider><RefundInner/></ThemeProvider>;
}

function RefundInner(){
  const tr = useT();
  const sections=[
    ["Overview","Refunds for orders on Nitro are credited to your Nitro wallet, which lets us process them instantly, and your balance can be used for any future order on the platform. Money in your wallet stays in your wallet: it is spent on Nitro rather than paid back out."],
    ["Automatic refunds","You are refunded automatically in the following cases: you cancel a pending order before processing begins (full refund), we cancel or are unable to place your order (full refund), or your order is only partially delivered (you are refunded for the undelivered portion). These refunds are automatic and require no action from you."],
    ["Cancellation by you","You can cancel an order from your dashboard before it starts processing. Once processing begins, it cannot be cancelled by you — contact us on WhatsApp if you need help. Orders using scheduled (drip) delivery cannot be cancelled after placement."],
    ["Refunds by Nitro","Our team may issue a full or partial refund to your wallet in cases such as: a billing or system error, a service that was fundamentally different from what was described, or an order that failed to deliver within a reasonable timeframe. To request a review, message us on WhatsApp with your order ID."],
    ["Unused wallet funds","Money you add to your wallet is credit for Nitro services and is not paid back to a bank account. It does not expire, and it can be spent on any service at any time. If something has gone wrong with a payment or an order, message us on WhatsApp and we will sort it out."],
    ["Non-refundable cases","Refunds are not available in the following situations: natural follower or engagement drops after successful delivery (use the refill feature if your service is eligible), orders where the link you provided was incorrect or the account was set to private, orders for accounts that were deleted, suspended, or changed username after placement, or dissatisfaction with delivery speed while delivery is still in progress."],
    ["Refills","Some services include refill coverage. If you lose followers or engagement after delivery, you can request a refill from your dashboard — at no extra cost. Refills are only available on completed orders with an eligible service, and must be requested within the refill window (shown on your order). Refills are not available on services without refill coverage. Important: refills only cover drops that occur after your order has been fully delivered above the original start count. If your count falls below the start count — typically caused by platform-wide cleanups, content removal, username changes, or broader engagement reductions — refill coverage does not apply."],
    ["Failed deposits","If a deposit fails or is debited from your bank but not credited to your Nitro wallet, contact us on WhatsApp with your payment reference. We will investigate and resolve the issue with the payment processor."],
    ["Contact","For refund-related questions, message us on WhatsApp — we typically respond within minutes."],
  ];
  const summary=[
    "Order refunds go to your wallet so they are instant.",
    "Wallet money is credit for Nitro services. It never expires.",
    "Refills on eligible services are free.",
  ];
  const related=[
    {title: tr("Terms of service"),desc: tr("The rules of the service"),href:"/terms"},
    {title: tr("Privacy policy"),desc: tr("What we keep and why"),href:"/privacy"},
    {title: tr("Cookie policy"),desc: tr("What the site remembers"),href:"/cookie"},
  ];
  return <LegalLayout label={tr("Policy")} title={tr("Refund policy")} date="September 7, 2026" summary={summary} sections={sections} related={related}/>;
}
