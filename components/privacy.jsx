'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { SITE } from "../lib/site";

export default function Privacy(){
  return <ThemeProvider><PrivacyInner/></ThemeProvider>;
}

function PrivacyInner(){
  const {t}=useTheme();
  const sections=[
    ["Information We Collect","When you use Nitro, we collect information you provide directly, such as your name, email address, phone number, and payment details during registration and transactions. We also automatically collect technical data including your IP address, browser type, device information, operating system, referring URLs, pages viewed, time spent on pages, click patterns, and interaction data. Additionally, we collect transaction data including order history, wallet activity, payment records, and service usage metrics."],
    ["How We Use Your Information","We use the information we collect to provide, operate, and maintain our services, process your transactions and deliver ordered services, communicate with you about your account, orders, and support requests, improve and personalize your experience on the Platform, conduct research, analytics, and data analysis to enhance our services, detect, prevent, and address fraud, abuse, and security issues, comply with legal obligations and enforce our terms, and send you updates and relevant communications about our services."],
    ["Data Sharing & Disclosure","We may share your information with third-party payment processors (Flutterwave, NOWPayments, Monnify, Korapay) to facilitate transactions, with API service providers to fulfill your orders (only the minimum data required, such as target URLs), with analytics and infrastructure providers that help us operate the Platform, and with law enforcement or regulatory authorities when required by law. We do not sell your personal contact information to third-party advertisers. We may share aggregated, anonymized data with partners for commercial purposes."],
    ["Cookies & Tracking","We use cookies and similar technologies to keep you logged in and maintain your session, remember your preferences such as theme settings, analyze usage patterns and improve the Platform, and ensure security and prevent fraud. You can manage cookie preferences through your browser settings, though disabling certain cookies may affect Platform functionality."],
    ["Data Retention","We retain your personal data for as long as your account is active or as needed to provide services. Transaction records and order history are retained for a minimum of 5 years for legal and accounting purposes. After account deletion, we may retain anonymized and aggregated data indefinitely for analytics. Backup copies may persist in our systems for a reasonable period after deletion."],
    ["Data Security","We implement industry-standard security measures including encryption of data in transit and at rest, secure payment processing through certified payment gateways, regular security audits and monitoring, and access controls limiting employee access to personal data. While we strive to protect your information, no method of electronic transmission or storage is 100% secure."],
    ["Your Rights",`Depending on your location and applicable law, you may have the right to access the personal data we hold about you, request correction of inaccurate data, request deletion of your account and associated data (subject to retention requirements), object to certain processing of your data, and request a copy of your data in a portable format. To exercise these rights, contact us at ${SITE.email.general}. We will respond within 30 days.`],
    ["Children's Privacy","Nitro is not intended for users under 18 years of age. We do not knowingly collect personal information from minors. If we learn that we have collected data from a user under 18, we will delete that information promptly."],
    ["International Data","Your data may be processed and stored in Nigeria and other countries where our service providers operate. By using the Platform, you consent to the transfer of your information to these locations."],
    ["Third-Party Links","The Platform may contain links to third-party websites and social media platforms. We are not responsible for the privacy practices or content of these external sites."],
    ["Changes to This Policy","We may update this Privacy Policy from time to time. Material changes will be communicated through the Platform or via email. Continued use of the Platform after changes constitutes acceptance of the updated policy."],
    ["Contact Us",`For privacy-related questions or requests, contact us at ${SITE.email.general}`],
  ];
  return <LegalLayout label="Privacy" title="Privacy" titleAccent="Policy" date="March 23, 2026" sections={sections} emailField={SITE.email.general} relatedLinks={[["Terms of Service","/terms"],["Refund Policy","/refund"],["Cookie Policy","/cookie"]]}/>;
}

function LegalLayout({label,title,titleAccent,date,sections,emailField,relatedLinks}){
  const {t}=useTheme();
  return(
    <div className="min-h-dvh flex flex-col font-[Outfit,system-ui,sans-serif] transition-[background] duration-500" style={{background:t.bg}}>
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
