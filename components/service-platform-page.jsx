'use client';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { trackViewContent } from './capi-tracker';
import { ProductScreenshot } from './product-screenshot';

export default function ServicePlatformView({ platform, services, copy, nextPlatform, relatedLinks }) {
  return <ThemeProvider><ServicePlatformInner platform={platform} services={services} copy={copy} nextPlatform={nextPlatform} relatedLinks={relatedLinks} /></ThemeProvider>;
}

function ServicePlatformInner({ platform, services, copy, nextPlatform, relatedLinks }) {
  const { dark, t } = useTheme();
  const accent = "#c47d8e";
  const border = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)";
  const cardBg = dark ? "rgba(255,255,255,.05)" : "#fff";

  useEffect(() => { trackViewContent({ content_name: `services-${platform.toLowerCase()}`, content_type: 'service_page' }); }, [platform]);

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav />

        {/* Hero */}
        <div className="text-center pt-14 pb-10 max-md:pt-10 max-md:pb-8 px-6 max-w-[700px] mx-auto">
          <span className="text-xs font-semibold tracking-[2px] uppercase block mb-3" style={{ color: accent }}>{platform} Services</span>
          <h1 className="text-[clamp(26px,5vw,40px)] font-semibold mb-4 leading-tight" style={{ color: t.text }}>
            {copy.h1}
          </h1>
          <p className="text-[15px] leading-relaxed max-w-[520px] mx-auto" style={{ color: t.textSoft }}>
            {copy.heroDesc}
          </p>
        </div>

        <main className="flex-1 px-6 pb-20 max-w-[900px] mx-auto w-full">

          {/* What you can get */}
          {copy.whatYouGet?.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>What you can get</h2>
              <ul className="space-y-2.5 list-none p-0 m-0">
                {copy.whatYouGet.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-[14px] leading-[1.6]" style={{ color: t.textSoft }}>
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-[13px] mt-4 leading-[1.6]" style={{ color: t.textMuted }}>
                Every service comes in Budget, Standard or Premium. Budget has no refill. Standard carries refill for 30 days. Premium carries refill for the life of the order on services marked refill included.
              </p>
            </section>
          )}

          {/* New order screenshot */}
          <div className="mb-10 max-w-[540px] mx-auto">
            <ProductScreenshot src="/images/nitro-place-order-instagram-naira.webp" alt="Placing an Instagram order on Nitro showing Naira prices and Nigerian targeted services" dark={dark} />
          </div>

          {/* Price table */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>{platform} services and pricing</h2>
            <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1.5px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)"}` }}>
              <div className="py-3 px-6 max-md:px-4 flex items-center gap-2 text-[12px] font-medium" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}`, color: t.textMuted }}>
                <span className="flex-1">Service</span>
                <span className="w-[120px] text-right max-md:w-[100px]">Price per 1K</span>
              </div>
              <div className="divide-y" style={{ borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)" }}>
                {services.map(s => (
                  <div key={s.type} className="flex items-center justify-between py-4 px-6 max-md:px-4 max-md:py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] max-md:text-[14px] font-medium" style={{ color: t.text }}>{s.type}</div>
                      <div className="flex items-center gap-3 mt-0.5 text-[12px] max-md:text-[11px]" style={{ color: t.textMuted }}>
                        {s.tiers > 1 && <span className="inline-flex items-center gap-1"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>{s.tiers} tiers</span>}
                        {s.refill && <span className="inline-flex items-center gap-1 text-green-500"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>Refill</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      {s.minPrice >= 100000 ? (
                        <>
                          <div className="text-[15px] max-md:text-[14px] font-bold" style={{ color: accent }}>
                            {s.minPrice === s.maxPrice ? `₦${(s.minPrice / 1000).toLocaleString()}` : `₦${(s.minPrice / 1000).toLocaleString()} – ${(s.maxPrice / 1000).toLocaleString()}`}
                          </div>
                          <div className="text-[11px]" style={{ color: t.textMuted }}>per unit</div>
                        </>
                      ) : (
                        <>
                          <div className="text-[15px] max-md:text-[14px] font-bold" style={{ color: accent }}>
                            {s.minPrice === s.maxPrice ? `₦${s.minPrice.toLocaleString()}` : `₦${s.minPrice.toLocaleString()} – ${s.maxPrice.toLocaleString()}`}
                          </div>
                          <div className="text-[11px]" style={{ color: t.textMuted }}>per 1,000</div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="py-3 px-6 max-md:px-4 text-center" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}`, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)" }}>
                <a href="/signup" className="inline-flex items-center gap-2 py-2.5 px-6 rounded-[10px] bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-[13px] font-semibold no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]">
                  Start growing on {platform}
                </a>
              </div>
            </div>
            <div className="mt-3 py-3 px-4 rounded-xl flex items-start gap-3" style={{ background: dark ? "rgba(251,191,36,.06)" : "rgba(251,191,36,.06)", border: `1px solid ${dark ? "rgba(251,191,36,.16)" : "rgba(217,119,6,.12)"}` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fbbf24" : "#d97706"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/></svg>
              <div className="text-[12px] leading-[1.55]" style={{ color: t.textSoft }}><strong style={{ color: t.text }}>Budget</strong> is great for a quick boost but has no refill. <strong style={{ color: t.text }}>Standard</strong> includes a 30-day refill, and <strong style={{ color: t.text }}>Premium</strong> comes with lifetime refill.</div>
            </div>
          </section>

          {/* How it works */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold mb-5" style={{ color: t.text }}>How to buy {platform} {copy.mainService || 'services'} on Nitro</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                ['1', 'Create a free account', 'Sign up in seconds — no card required. Just an email or Google account.'],
                ['2', 'Fund your wallet', 'Add funds via bank transfer, card, or crypto. Minimum ₦1,000.'],
                ['3', 'Place your order', `Choose ${/^[aeiou]/i.test(platform) || platform === 'X' ? 'an' : 'a'} ${platform} service, paste your link, pick a tier, and confirm. Results start within minutes.`],
              ].map(([num, title, desc]) => (
                <div key={num} className="p-5 rounded-xl" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold mb-3" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)", color: accent }}>{num}</div>
                  <div className="text-[14px] font-semibold mb-1" style={{ color: t.text }}>{title}</div>
                  <div className="text-[13px] leading-[1.6]" style={{ color: t.textMuted }}>{desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Why Nitro */}
          {copy.whySection && (
            <section className="mb-12">
              <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>Why use Nitro for {platform}</h2>
              <div className="text-[14px] leading-[1.75] space-y-3" style={{ color: t.textSoft }}>
                {copy.whySection.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </section>
          )}

          {/* FAQ */}
          {copy.faq?.length > 0 && (
            <section className="mb-12">
              <h2 className="text-lg font-semibold mb-5" style={{ color: t.text }}>Frequently asked questions</h2>
              <div className="flex flex-col gap-3">
                {copy.faq.map(({ q, a }) => (
                  <div key={q} className="rounded-xl p-5" style={{ background: cardBg, border: `1px solid ${border}` }}>
                    <div className="text-[14px] font-semibold mb-1.5" style={{ color: t.text }}>{q}</div>
                    <div className="text-[13px] leading-[1.65]" style={{ color: t.textMuted }}>{a}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related links + next platform */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>Related</h2>
            <div className="flex flex-col gap-2.5">
              {relatedLinks?.map(({ href, label }) => (
                <a key={href} href={href} className="flex items-center gap-3 py-3.5 px-5 rounded-xl no-underline transition-colors duration-150" style={{ background: cardBg, border: `1px solid ${border}`, color: t.text }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  <span className="text-[14px] font-medium">{label}</span>
                </a>
              ))}
              {nextPlatform && (
                <a href={`/services/${nextPlatform.slug}`} className="flex items-center justify-between py-3.5 px-5 rounded-xl no-underline transition-colors duration-150" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.1)"}`, color: t.text }}>
                  <span className="text-[14px] font-medium">Browse {nextPlatform.name} services</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </a>
              )}
            </div>
          </section>

          {/* Bottom CTA */}
          <div className="p-8 max-md:p-6 rounded-2xl text-center" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.1)"}` }}>
            <h2 className="text-xl max-md:text-lg font-semibold mb-2" style={{ color: t.text }}>Ready to grow on {platform}?</h2>
            <p className="text-sm mb-5 max-w-[400px] mx-auto" style={{ color: t.textSoft }}>Create a free account, fund your wallet with as little as ₦1,000, and place your first order in under a minute.</p>
            <a href="/signup" className="inline-flex items-center gap-2 py-3.5 px-8 rounded-xl bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-[15px] font-semibold no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]">Create free account</a>
          </div>

          {/* Payment methods */}
          <div className="mt-6 text-center text-[12px] leading-[1.6]" style={{ color: t.textMuted }}>
            We accept bank transfer, debit/credit card, and crypto. Works with Opay, Palmpay, Kuda, Moniepoint, and all Nigerian banks.
          </div>
        </main>
        <SharedFooter />
      </div>
    </>
  );
}
