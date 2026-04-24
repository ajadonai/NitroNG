'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { SITE } from "../lib/site";

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
    ["Contact",`For questions about these Terms, contact us at ${SITE.email.general}`],
  ];
  return <LegalLayout label="Legal" title="Terms of" titleAccent="Service" date="March 23, 2026" sections={sections} emailField={SITE.email.general} relatedLinks={[["Privacy Policy","/privacy"],["Refund Policy","/refund"],["Cookie Policy","/cookie"]]} action="back"/>;
}

function LegalLayout({label,title,titleAccent,date,sections,emailField,relatedLinks,action}){
  const {t}=useTheme();
  return(
    <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif] transition-[background] duration-500" style={{background:t.bg}}>
      <SharedStyles/>
      <SharedNav action={action}/>
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
        <div className="mt-10 flex gap-4 flex-wrap">
          {relatedLinks.map(([l,h])=><a key={l} href={h} className="text-sm font-medium" style={{color:t.accent}}>{l}</a>)}
        </div>
      </div>
      <SharedFooter/>
    </div>
  );
}
