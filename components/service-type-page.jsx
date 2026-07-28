'use client';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { trackViewContent } from './capi-tracker';
import { ProductScreenshot } from './product-screenshot';

export default function ServiceTypeView({ platform, platformSlug, typeLabel, services, introHtml, copy }) {
  return <ThemeProvider><ServiceTypeInner platform={platform} platformSlug={platformSlug} typeLabel={typeLabel} services={services} introHtml={introHtml} copy={copy} /></ThemeProvider>;
}

function ServiceTypeInner({ platform, platformSlug, typeLabel, services, introHtml, copy }) {
  const { dark, t } = useTheme();
  const accent = "#c47d8e";
  const border = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)";
  const cardBg = dark ? "rgba(255,255,255,.05)" : "#fff";

  useEffect(() => { trackViewContent({ content_name: `services-${platformSlug}-${typeLabel.toLowerCase().replace(/\s+/g, '-')}`, content_type: 'service_type_page' }); }, [platformSlug, typeLabel]);

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav />

        {/* Breadcrumb */}
        <nav className="max-w-[700px] mx-auto w-full px-6 pt-8 max-md:pt-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-[12px] list-none p-0 m-0" style={{ color: t.textMuted }}>
            <li><a href="/services" className="no-underline hover:underline" style={{ color: t.textMuted }}>Services</a></li>
            <li aria-hidden="true"><ChevronRight /></li>
            <li><a href={`/services/${platformSlug}`} className="no-underline hover:underline" style={{ color: t.textMuted }}>{platform}</a></li>
            <li aria-hidden="true"><ChevronRight /></li>
            <li style={{ color: accent }}>{typeLabel}</li>
          </ol>
        </nav>

        {/* Hero */}
        <div className="text-center pt-6 pb-8 max-md:pt-4 max-md:pb-6 px-6 max-w-[700px] mx-auto">
          <h1 className="text-[clamp(24px,4.5vw,36px)] font-semibold leading-tight" style={{ color: t.text }}>
            {copy.h1}
          </h1>
        </div>

        <main className="flex-1 px-6 pb-20 max-w-[900px] mx-auto w-full">

          {/* Intro copy */}
          {introHtml && (
            <section className="mb-10 max-w-[700px]">
              <div
                className="blog-article-body text-[15px] leading-[1.75]"
                data-theme={dark ? 'dark' : 'light'}
                style={{ color: t.textSoft, fontSize: '15px' }}
                dangerouslySetInnerHTML={{ __html: introHtml }}
              />
            </section>
          )}

          {/* Price table */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>{platform} {typeLabel.toLowerCase()} pricing</h2>
            <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1.5px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)"}` }}>
              {/* Header */}
              <div className="py-3 px-6 max-md:px-4 grid grid-cols-[1fr_90px_70px_100px] max-md:grid-cols-[1fr_80px] gap-2 text-[12px] font-medium" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}`, color: t.textMuted }}>
                <span>Service</span>
                <span className="text-right">Per 1,000</span>
                <span className="text-center max-md:hidden">Refill</span>
                <span className="text-right max-md:hidden">Speed</span>
              </div>
              {/* Rows */}
              <div className="divide-y" style={{ borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)" }}>
                {services.map(s => s.tiers.map((tier, ti) => (
                  <div key={`${s.name}-${ti}`} className="grid grid-cols-[1fr_90px_70px_100px] max-md:grid-cols-[1fr_80px] gap-2 items-center py-3.5 px-6 max-md:px-4">
                    <div className="min-w-0">
                      <div className="text-[14px] max-md:text-[13px] font-medium truncate" style={{ color: t.text }}>
                        {s.tiers.length > 1 ? `${s.name} — ${tier.tier}` : s.name}
                      </div>
                      <div className="md:hidden flex items-center gap-2 mt-0.5 text-[11px]" style={{ color: t.textMuted }}>
                        {tier.refill && <span className="text-green-500">Refill</span>}
                        <span>{tier.speed}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {tier.price >= 100000 ? (
                        <>
                          <div className="text-[14px] max-md:text-[13px] font-bold" style={{ color: accent }}>₦{(tier.price / 1000).toLocaleString()}</div>
                          <div className="text-[10px]" style={{ color: t.textMuted }}>per unit</div>
                        </>
                      ) : (
                        <div className="text-[14px] max-md:text-[13px] font-bold" style={{ color: accent }}>₦{tier.price.toLocaleString()}</div>
                      )}
                    </div>
                    <div className="text-center max-md:hidden text-[12px]" style={{ color: tier.refill ? '#22c55e' : t.textMuted }}>
                      {tier.refill ? '✓' : '—'}
                    </div>
                    <div className="text-right max-md:hidden text-[12px]" style={{ color: t.textMuted }}>
                      {tier.speed}
                    </div>
                  </div>
                )))}
              </div>
              {/* CTA */}
              <div className="py-3 px-6 max-md:px-4 text-center" style={{ borderTop: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}`, background: dark ? "rgba(255,255,255,.02)" : "rgba(0,0,0,.01)" }}>
                <a href="/signup" className="inline-flex items-center gap-2 py-2.5 px-6 rounded-[10px] bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-[13px] font-semibold no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]">
                  Buy {platform} {typeLabel.toLowerCase()}
                </a>
              </div>
            </div>
            <div className="mt-3 py-3 px-4 rounded-xl flex items-start gap-3" style={{ background: dark ? "rgba(251,191,36,.06)" : "rgba(251,191,36,.06)", border: `1px solid ${dark ? "rgba(251,191,36,.16)" : "rgba(217,119,6,.12)"}` }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fbbf24" : "#d97706"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0018 8 6 6 0 006 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 018.91 14"/></svg>
              <div className="text-[12px] leading-[1.55]" style={{ color: t.textSoft }}>Prices are in Naira per 1,000 units and update with the exchange rate. The price you see at checkout is the price you pay.</div>
            </div>
          </section>

          {/* How it works */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold mb-5" style={{ color: t.text }}>How to buy {platform} {typeLabel.toLowerCase()} on Nitro</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                ['1', 'Create a free account', 'Sign up in seconds with email or Google. No card needed.'],
                ['2', 'Fund your wallet', 'Add funds via bank transfer, card, or crypto. Minimum ₦1,000.'],
                ['3', 'Place your order', `Choose your ${typeLabel.toLowerCase()} service, paste your link, pick a tier, and confirm.`],
              ].map(([num, title, desc]) => (
                <div key={num} className="p-5 rounded-xl" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold mb-3" style={{ background: dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)", color: accent }}>{num}</div>
                  <div className="text-[14px] font-semibold mb-1" style={{ color: t.text }}>{title}</div>
                  <div className="text-[13px] leading-[1.6]" style={{ color: t.textMuted }}>{desc}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 max-w-[540px] mx-auto">
              <ProductScreenshot src="/images/nitro-place-order-instagram-naira.webp" alt="Placing an Instagram order on Nitro showing Naira prices and Nigerian targeted services" dark={dark} />
            </div>
          </section>

          {/* Tiers diagram */}
          <div className="mb-12 max-w-[600px] mx-auto">
            <ProductScreenshot src="/images/nitro-smm-tiers-budget-standard-premium.webp" alt="Nitro tier comparison showing refill cover on Budget, Standard and Premium" dark={dark} />
          </div>

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

          {/* Related */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>Related</h2>
            <div className="flex flex-col gap-2.5">
              <a href={`/services/${platformSlug}`} className="flex items-center gap-3 py-3.5 px-5 rounded-xl no-underline transition-colors duration-150" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.1)"}`, color: t.text }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                <span className="text-[14px] font-medium">All {platform} services</span>
              </a>
              {[
                { href: '/pricing', label: 'Full pricing across all platforms' },
                { href: '/quality', label: 'How Nitro keeps drop rates low' },
                { href: '/reviews', label: 'What using Nitro is actually like' },
              ].map(({ href, label }) => (
                <a key={href} href={href} className="flex items-center gap-3 py-3.5 px-5 rounded-xl no-underline transition-colors duration-150" style={{ background: cardBg, border: `1px solid ${border}`, color: t.text }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  <span className="text-[14px] font-medium">{label}</span>
                </a>
              ))}
            </div>
          </section>

          {/* Bottom CTA */}
          <div className="p-8 max-md:p-6 rounded-2xl text-center" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.1)"}` }}>
            <h2 className="text-xl max-md:text-lg font-semibold mb-2" style={{ color: t.text }}>Ready to grow on {platform}?</h2>
            <p className="text-sm mb-5 max-w-[400px] mx-auto" style={{ color: t.textSoft }}>Create a free account, fund your wallet with as little as ₦1,000, and place your first order in under a minute.</p>
            <a href="/signup" className="inline-flex items-center gap-2 py-3.5 px-8 rounded-xl bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-[15px] font-semibold no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]">Create free account</a>
          </div>

          <div className="mt-6 text-center text-[12px] leading-[1.6]" style={{ color: t.textMuted }}>
            We accept bank transfer, debit/credit card, and crypto. Works with Opay, Palmpay, Kuda, Moniepoint, and all Nigerian banks.
          </div>
        </main>
        <SharedFooter />
      </div>
    </>
  );
}

function ChevronRight() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>;
}
