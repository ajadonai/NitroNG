'use client';
import { ThemeProvider } from './shared-nav';
import { LegalLayout } from './legal-layout';
import { SITE } from "../lib/site";

export default function CookiePolicy(){
  return <ThemeProvider><CookieInner/></ThemeProvider>;
}

function CookieInner(){
  const sections=[
    ["What are cookies","Cookies are small text files that are stored on your device when you visit a website. They help us recognize your browser, remember your preferences, and improve your experience on Nitro. Cookies do not contain personal information like passwords or payment details."],
    ["How we use cookies","Nitro uses cookies for authentication (keeping you logged in across pages and sessions), preferences (remembering your theme choice, language, and display settings), security (protecting against cross-site request forgery and unauthorized access), and analytics (understanding how users interact with our platform to improve our services)."],
    ["Types of cookies we use","We use three categories of cookies. Essential cookies are required for the platform to function — these include authentication tokens and session identifiers, and without them you cannot use Nitro. Functional cookies remember your preferences such as dark/light mode, collapsed sidebar state, and display settings. Analytics cookies help us understand usage patterns, popular services, and platform performance using aggregated and anonymized data."],
    ["Third-party cookies","Our payment processors (Flutterwave, NOWPayments) may set their own cookies during the payment process. These are governed by their respective privacy and cookie policies. We do not control third-party cookies."],
    ["Cookie duration","Session cookies are deleted when you close your browser. Persistent cookies remain on your device for a set period: authentication cookies last up to 7 days, preference cookies last up to 1 year, and analytics cookies last up to 90 days."],
    ["Managing cookies","You can manage or delete cookies through your browser settings. Most browsers allow you to block or delete cookies, view which cookies are stored, and set preferences for specific websites. Note that blocking essential cookies will prevent you from using Nitro."],
    ["Changes to this policy","We may update this Cookie Policy from time to time. Changes will be posted on this page with an updated revision date. Continued use of Nitro after changes constitutes acceptance."],
    ["Contact",`For questions about our use of cookies, contact us at ${SITE.email.general}`],
  ];
  const summary=[
    "Necessary cookies keep you signed in.",
    "Analytics counts visits, no names.",
    "You can change your choice any time from the footer.",
  ];
  const related=[
    {title:"Terms of service",desc:"The rules of the service",href:"/terms"},
    {title:"Privacy policy",desc:"What we keep and why",href:"/privacy"},
    {title:"Refund policy",desc:"When money comes back",href:"/refund"},
  ];
  return <LegalLayout label="Legal" title="Cookie policy" date="March 23, 2026" summary={summary} sections={sections} related={related}/>;
}
