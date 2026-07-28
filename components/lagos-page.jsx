'use client';
import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function LagosView() {
  return <ThemeProvider><LagosInner /></ThemeProvider>;
}

function LagosInner() {
  const { dark, t } = useTheme();
  const accent = '#c47d8e';
  const border = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)';
  const cardBg = dark ? 'rgba(255,255,255,.05)' : '#fff';
  const subtleBg = dark ? 'rgba(196,125,142,.06)' : 'rgba(196,125,142,.04)';
  const subtleBorder = dark ? 'rgba(196,125,142,.14)' : 'rgba(196,125,142,.1)';
  const bold = dark ? '#e5e5e5' : '#1c1b19';

  const [stats, setStats] = useState(null);
  const [wa, setWa] = useState(null);
  useEffect(() => {
    fetch('/api/site-info').then(r => r.json()).then(d => setStats(d.stats)).catch(() => {});
    fetch('/api/settings?keys=social_whatsapp_support').then(r => r.json()).then(d => {
      const num = d.social_whatsapp_support?.replace(/\D/g, '');
      if (num) setWa(num);
    }).catch(() => {});
  }, []);

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus_Jakarta_Sans,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav />

        <div className="text-center pt-14 pb-10 max-md:pt-10 max-md:pb-8 px-6">
          <span className="text-xs font-semibold tracking-[2px] uppercase block mb-3" style={{ color: accent }}>Lagos, Nigeria</span>
          <h1 className="text-[clamp(26px,5vw,40px)] font-semibold mb-4 leading-tight max-w-[650px] mx-auto" style={{ color: t.text, fontFamily: "'Cormorant Garamond',serif" }}>
            SMM panel based in Lagos
          </h1>
          <p className="text-[15px] leading-relaxed max-w-[540px] mx-auto" style={{ color: t.textSoft }}>
            Nitro is a Nigerian company. We are based in Lagos, we price in Naira, and we answer on WhatsApp during Lagos hours. No international middleman, no dollar conversion, no guessing what timezone support lives in.
          </p>
        </div>

        <main className="flex-1 px-6 pb-20 max-w-[800px] mx-auto w-full">

          {/* Why Lagos matters */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>Why being Lagos-based matters</h2>
            <div className="text-[14px] leading-[1.7] flex flex-col gap-3" style={{ color: t.textSoft }}>
              <p>Most SMM panels that show up in Nigerian search results are not Nigerian. They are international services with a Nigeria landing page, priced in dollars or with an exchange rate baked in. When something goes wrong, support is in a different timezone and may not understand how Opay or bank transfer works.</p>
              <p>Nitro is different because we are actually here. The team is in Lagos. The business operates on West Africa Time. When you message support at 2 PM on a Tuesday, you are talking to someone who is also at 2 PM on a Tuesday, not someone working a night shift in another country.</p>
              <p>That sounds like a small thing until you need it.</p>
            </div>
          </section>

          {/* Stats */}
          {stats && (
            <section className="mb-14">
              <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>Live numbers from our system</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Orders placed', value: stats.orders },
                  { label: 'Accounts', value: stats.users },
                  { label: 'Delivery rate', value: stats.deliveryRate != null ? `${stats.deliveryRate}%` : null },
                  { label: 'Services', value: stats.services },
                ].filter(s => s.value != null).map(s => (
                  <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: subtleBg, border: `1px solid ${subtleBorder}` }}>
                    <div className="text-[22px] font-bold mb-1" style={{ color: accent }}>{s.value}</div>
                    <div className="text-[12px]" style={{ color: t.textMuted }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* What you get */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-5" style={{ color: t.text }}>What being local means for you</h2>
            <div className="flex flex-col gap-3">
              {[
                ['Naira pricing, no conversion', 'Every service is priced in Naira. When you deposit ₦5,000, you get ₦5,000 in your wallet. No dollar conversion, no exchange rate markup, no surprises on your bank statement.'],
                ['Your bank, your wallet', 'Pay by bank transfer from any Nigerian bank, debit or credit card, USSD, or wallets like Opay, PalmPay, Kuda, Moniepoint and VBank. All through Flutterwave. Crypto is also accepted.'],
                ['WhatsApp support in your timezone', 'Our support line is on WhatsApp. Response is fastest between 9 AM and 10 PM WAT, seven days a week. You are not waiting for a ticket system to route you to someone in another country.'],
                ['₦1,000 minimum deposit', 'You do not need to convert dollars or meet a high minimum. Deposit ₦1,000 and you can start ordering. First deposit of ₦2,500 or more earns up to ₦3,000 in free promotion credit.'],
                ['Services across 28 platforms', 'Instagram, TikTok, YouTube, Facebook, X, Telegram, Spotify, Audiomack, Boomplay, and 19 more. Music promotion for Nigerian artists on local platforms is something most international panels do not offer.'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl p-5" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div className="text-[14px] font-semibold mb-1.5" style={{ color: bold }}>{title}</div>
                  <div className="text-[13px] leading-[1.65]" style={{ color: t.textSoft }}>{desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Popular services */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-2" style={{ color: t.text }}>Popular services in Lagos</h2>
            <p className="text-[14px] mb-5 leading-[1.6]" style={{ color: t.textSoft }}>
              Lagos creators, businesses and agencies order these services most. Prices are per 1,000, at the time of writing.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]" style={{ color: t.textSoft }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border}` }}>
                    <th className="text-left py-2.5 font-semibold" style={{ color: bold }}>Service</th>
                    <th className="text-right py-2.5 font-semibold" style={{ color: bold }}>From</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Instagram Followers', '₦3,818', '/services/instagram/followers'],
                    ['Instagram Likes', '₦1,663', '/services/instagram/likes'],
                    ['Instagram Views', '₦315', '/services/instagram/views'],
                    ['TikTok Followers', '₦14,089', '/services/tiktok/followers'],
                    ['TikTok Views', '₦472', '/services/tiktok/views'],
                    ['YouTube Subscribers', '₦37,610', '/services/youtube/subscribers'],
                    ['Facebook Page Followers', '₦1,549', '/services/facebook/followers'],
                    ['X Followers', '₦5,409', '/services/x/followers'],
                    ['Spotify Plays', '₦1,193', '/services/spotify/plays'],
                    ['Audiomack Plays', '₦1,491', '/services/spotify'],
                  ].map(([service, price, href]) => (
                    <tr key={service} style={{ borderBottom: `1px solid ${border}` }}>
                      <td className="py-2.5"><a href={href} className="no-underline hover:underline" style={{ color: accent }}>{service}</a></td>
                      <td className="py-2.5 text-right font-medium tabular-nums">{price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[12px] mt-3" style={{ color: t.textMuted }}>
              The cheapest service on the catalogue is ₦158 per 1,000. <a href="/pricing" className="underline" style={{ color: accent }}>See all pricing</a>.
            </p>
          </section>

          {/* Contact */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-5" style={{ color: t.text }}>Reach us</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {wa && (
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="rounded-xl p-5 no-underline block transition-shadow hover:shadow-lg" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div className="text-[14px] font-semibold mb-1" style={{ color: bold }}>WhatsApp</div>
                  <div className="text-[13px]" style={{ color: accent }}>Message us directly</div>
                  <div className="text-[12px] mt-2" style={{ color: t.textMuted }}>Fastest between 9 AM — 10 PM WAT</div>
                </a>
              )}
              <a href="mailto:support@nitro.ng" className="rounded-xl p-5 no-underline block transition-shadow hover:shadow-lg" style={{ background: cardBg, border: `1px solid ${border}` }}>
                <div className="text-[14px] font-semibold mb-1" style={{ color: bold }}>Email</div>
                <div className="text-[13px]" style={{ color: accent }}>support@nitro.ng</div>
                <div className="text-[12px] mt-2" style={{ color: t.textMuted }}>We reply within 24 hours</div>
              </a>
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-5" style={{ color: t.text }}>FAQ</h2>
            <div className="flex flex-col gap-3">
              {[
                ['Is there a physical office I can visit?', 'No. Nitro is an online-only business. We do not have a walk-in office. All support is handled through WhatsApp and email. This is standard for SMM panels globally.'],
                ['Do you deliver to Lagos only?', 'No. Nitro serves customers across Nigeria and anywhere in the world. Being based in Lagos means our team and support hours are on Lagos time, but the services work regardless of where you or your audience are located.'],
                ['Can I pay with my Nigerian bank?', 'Yes. We accept bank transfer from any Nigerian bank, plus Opay, PalmPay, Kuda, Moniepoint, VBank, debit and credit cards, USSD and crypto. Everything is processed through Flutterwave in Naira.'],
                ['What are your operating hours?', 'The platform runs 24/7. Orders process around the clock. Support is fastest between 9 AM and 10 PM West Africa Time, seven days a week.'],
                ['Why should I choose a Lagos panel over an international one?', 'Naira pricing with no conversion, payment methods that work with your bank, and support in your timezone. International panels may offer lower headline prices but add dollar conversion fees and respond during different hours. For a deeper comparison, read our guide on Nigerian vs international SMM panels.'],
              ].map(([q, a]) => (
                <details key={q} className="rounded-xl overflow-hidden group" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <summary className="cursor-pointer px-5 py-4 text-[14px] font-semibold list-none flex items-center justify-between" style={{ color: bold }}>
                    {q}
                    <svg className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </summary>
                  <div className="px-5 pb-4 text-[13px] leading-[1.65]" style={{ color: t.textSoft }}>{a}</div>
                </details>
              ))}
            </div>
          </section>

          {/* Related */}
          <section>
            <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>Related reading</h2>
            <div className="flex flex-col gap-2">
              {[
                ['/blog/nigerian-vs-international-smm-panels', 'Nigerian vs International SMM Panels'],
                ['/blog/smm-panel-opay-palmpay-kuda-bank-transfer', 'SMM Panels That Accept Opay, PalmPay, Kuda and Bank Transfer'],
                ['/blog/is-nitro-ng-legit', 'Is Nitro.ng Legit?'],
                ['/contact', 'Contact Us'],
              ].map(([href, label]) => (
                <a key={href} href={href} className="text-[14px] no-underline hover:underline" style={{ color: accent }}>{label}</a>
              ))}
            </div>
          </section>

        </main>

        <SharedFooter />
      </div>
    </>
  );
}
