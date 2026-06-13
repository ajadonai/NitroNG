"use client";

import Script from "next/script";

export default function ZohoASAP() {
  return (
    <Script
      id="zohodeskasap"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          var d=document;
          var s=d.createElement("script");
          s.type="text/javascript";
          s.id="zohodeskasapscript";
          s.defer=true;
          s.src="https://desk.zoho.com/portal/api/web/asapApp/1367186000000418004?orgId=927725248";
          var t=d.getElementsByTagName("script")[0];
          t.parentNode.insertBefore(s,t);
          window.ZohoDeskAsapReady=function(a){
            var e=window.ZohoDeskAsap__asyncalls=window.ZohoDeskAsap__asyncalls||[];
            window.ZohoDeskAsapReadyStatus?(a&&e.push(a),e.forEach(function(f){f&&f()}),window.ZohoDeskAsap__asyncalls=null):a&&e.push(a);
          };
        `,
      }}
    />
  );
}
