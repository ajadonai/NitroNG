'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { SITE } from "../lib/site";

export default function CookiePolicy(){
  return <ThemeProvider><CookieInner/></ThemeProvider>;
}

function CookieInner(){
  const {t}=useTheme();
  const sections=[
    ["What Are Cookies","Cookies are small text files that are stored on your device when you visit a website. They help us recognize your browser, remember your preferences, and improve your experience on Nitro. Cookies do not contain personal information like passwords or payment details."],
    ["How We Use Cookies","Nitro uses cookies for authentication (keeping you logged in across pages and sessions), preferences (remembering your theme choice, language, and display settings), security (protecting against cross-site request forgery and unauthorized access), and analytics (understanding how users interact with our platform to improve our services)."],
    ["Types of Cookies We Use","We use three categories of cookies. Essential cookies are required for the platform to function — these include authentication tokens and session identifiers, and without them you cannot use Nitro. Functional cookies remember your preferences such as dark/light mode, collapsed sidebar state, and display settings. Analytics cookies help us understand usage patterns, popular services, and platform performance using aggregated and anonymized data."],
    ["Third-Party Cookies","Our payment processors (Flutterwave, NOWPayments) may set their own cookies during the payment process. These are governed by their respective privacy and cookie policies. We do not control third-party cookies."],
    ["Cookie Duration","Session cookies are deleted when you close your browser. Persistent cookies remain on your device for a set period: authentication cookies last up to 7 days, preference cookies last up to 1 year, and analytics cookies last up to 90 days."],
    ["Managing Cookies","You can manage or delete cookies through your browser settings. Most browsers allow you to block or delete cookies, view which cookies are stored, and set preferences for specific websites. Note that blocking essential cookies will prevent you from using Nitro."],
    ["Changes to This Policy","We may update this Cookie Policy from time to time. Changes will be posted on this page with an updated revision date. Continued use of Nitro after changes constitutes acceptance."],
    ["Contact",`For questions about our use of cookies, contact us at ${SITE.email.general}`],
  ];
  return <LegalLayout label="Cookies" title="Cookie" titleAccent="Policy" date="March 23, 2026" sections={sections} emailField={SITE.email.general} relatedLinks={[["Terms of Service","/terms"],["Privacy Policy","/privacy"],["Refund Policy","/refund"]]}/>;
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
