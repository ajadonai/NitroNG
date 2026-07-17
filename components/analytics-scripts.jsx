'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { hasConsent } from './cookie-banner';
import { isInternalDashboardPath } from '@/lib/internal-dashboard-path';

export default function AnalyticsScripts() {
  const [enabled, setEnabled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => setEnabled(hasConsent());
    sync();
    window.addEventListener('nitro-consent-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('nitro-consent-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!enabled || isInternalDashboardPath(pathname)) return null;

  return (
    <>
      <Script src="https://www.googletagmanager.com/gtag/js?id=AW-18121451903" strategy="afterInteractive" />
      <Script id="google-ads-init" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','AW-18121451903');`}</Script>
      <Script src="https://t.contentsquare.net/uxa/326b90ddf7f96.js" strategy="lazyOnload" />
      <Script src="https://plausible.io/js/pa-nE8AS3pS0CWFTGc_htkYL.js" strategy="lazyOnload" />
      <Script id="plausible-init" strategy="lazyOnload">{`window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`}</Script>
    </>
  );
}
