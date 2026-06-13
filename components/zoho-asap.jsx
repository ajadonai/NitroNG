"use client";

import Script from "next/script";

export default function ZohoASAP() {
  return (
    <Script
      id="zohodeskasap"
      strategy="afterInteractive"
      src="https://desk.zoho.com/portal/api/web/asapApp/1367186000000418004?orgId=927725248"
    />
  );
}
