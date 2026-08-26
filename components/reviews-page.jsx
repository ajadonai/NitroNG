'use client';
import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { ProductScreenshot } from './product-screenshot';

export default function ReviewsView() {
  return <ThemeProvider><ReviewsInner /></ThemeProvider>;
}

function ReviewsInner() {
  const { dark, t } = useTheme();
  const accent = "#c47d8e";
  const border = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)";
  const cardBg = dark ? "rgba(255,255,255,.05)" : "#fff";

  const [stats, setStats] = useState(null);
  useEffect(() => {
    fetch('/api/site-info').then(r => r.json()).then(d => setStats(d.stats)).catch(() => {});
  }, []);

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav />

        <div className="text-center pt-14 pb-10 max-md:pt-10 max-md:pb-8 px-6">
          <span className="text-xs font-semibold tracking-[2px] uppercase block mb-3" style={{ color: accent }}>Reviews</span>
          <h1 className="text-[clamp(26px,5vw,40px)] font-semibold mb-4 leading-tight" style={{ color: t.text }}>
            What using Nitro is actually like
          </h1>
          <p className="text-[15px] leading-relaxed max-w-[520px] mx-auto" style={{ color: t.textSoft }}>
            Not a wall of five star quotes. An honest account of what customers experience here, including the parts people complain about.
          </p>
        </div>

        <main className="flex-1 px-6 pb-20 max-w-[800px] mx-auto w-full">

          {/* Order failure diagram */}
          <div className="mb-12 max-w-[540px] mx-auto">
            <ProductScreenshot src="/images/nitro-order-refund-wallet-credit-nigeria.webp" alt="What happens when a Nitro order does not deliver, with value returned to your wallet as credit" dark={dark} />
          </div>

          {/* Live stats */}
          {stats && (
            <section className="mb-12">
              <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>The numbers, pulled from our own system</h2>
              <p className="text-[13px] mb-5 leading-[1.6]" style={{ color: t.textSoft }}>
                These update automatically. They are not marketing figures, they are what our database says right now.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Orders placed', value: stats.orders },
                  { label: 'Accounts created', value: stats.users },
                  { label: 'Delivery rate', value: stats.deliveryRate != null ? `${stats.deliveryRate}%` : null },
                  { label: 'Services listed', value: stats.services },
                ].filter(s => s.value != null).map(s => (
                  <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.1)"}` }}>
                    <div className="text-[22px] font-bold mb-1" style={{ color: accent }}>{s.value}</div>
                    <div className="text-[11px]" style={{ color: t.textMuted }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {stats.deliveryRate != null && (
                <p className="text-[13px] mt-3 leading-[1.6]" style={{ color: t.textMuted }}>
                  The {stats.deliveryRate}% delivery rate means roughly one order in {Math.round(100 / (100 - stats.deliveryRate))} does not complete as expected. Those orders get their value returned to the customer's wallet. We publish the real number instead of a rounder one because the real number is the one you can hold us to.
                </p>
              )}
            </section>
          )}

          {/* Order tracker screenshot */}
          <div className="mb-12 max-w-[540px] mx-auto">
            <ProductScreenshot src="/images/nitro-order-tracking-start-current-target.webp" alt="Nitro order tracker showing 870 of 1,000 Instagram followers delivered with start count and live status" dark={dark} />
          </div>

          {/* What works */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold mb-5" style={{ color: t.text }}>What people tell us works</h2>
            <div className="flex flex-col gap-3">
              {[
                ['The wallet system', 'Fund once, then order without touching a payment page again. People who place a lot of small orders notice this most.'],
                ['Paying with what they already have', 'Payments run through Flutterwave, so Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank card or transfer all work. Everything is in Naira. This is the most common piece of positive feedback we get, mostly from people who spent months unable to check out on foreign panels.'],
                ['WhatsApp support', 'No ticket queue. You message a real line and a person answers, usually within minutes during Lagos hours. This is the thing that most changes how people feel about us after something goes wrong.'],
                ['The catalogue being small', 'We list services in the hundreds rather than thousands, because we test services before listing them and pull the ones that degrade. Customers who came from panels with fifteen thousand listings tell us it is a relief not to be guessing which entries are dead.'],
                ['Live order tracking', 'Start count, current count, target, visible in the dashboard while the order runs.'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl p-5" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div className="text-[13px] font-semibold mb-1.5" style={{ color: t.text }}>{title}</div>
                  <div className="text-[13px] leading-[1.65]" style={{ color: t.textMuted }}>{desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Complaints */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold mb-5" style={{ color: t.text }}>What people complain about</h2>
            <div className="flex flex-col gap-3">
              {[
                ['"My followers dropped."', 'This is the most common one and it is a real property of the product, not a fault we can eliminate. Some accounts in every follower service get removed when a platform runs a purge. What we can control is source quality and refills. Standard services carry refill for 30 days, Premium carries it for the life of the order, on services marked refill included. Budget carries none, which we state on the service before you buy.'],
                ['"The order is still pending."', 'Some services start within minutes. Others queue at the supplier. When an order sits longer than it should, message us with the order ID and we chase the supplier or cancel and return the value to your wallet. The honest fix on our side is better expected time estimates on each service, which we are still improving.'],
                ['"I wanted my money back in my bank account."', 'We refund to your Nitro wallet as spendable credit, not to your bank account. This is written on our refund page and in our terms. It is the single thing people most often did not realise before ordering, so we are saying it here as plainly as we can. If that is a dealbreaker, better to know now than after you deposit.'],
                ['"The service I wanted is not listed."', 'A direct consequence of curating. If a service is missing it is usually because it failed testing or the supplier became unreliable. Ask on WhatsApp. Sometimes we can source it, sometimes the honest answer is that we could not find a version that works.'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl p-5" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div className="text-[13px] font-semibold mb-1.5" style={{ color: t.text }}>{title}</div>
                  <div className="text-[13px] leading-[1.65]" style={{ color: t.textMuted }}>{desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Refill table */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>How refills actually behave</h2>
            <p className="text-[13px] mb-4 leading-[1.6]" style={{ color: t.textSoft }}>
              Worth being specific, because "refill guarantee" is used loosely across this industry.
            </p>
            <div className="rounded-xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${border}` }}>
              <div className="grid grid-cols-3 gap-0 text-[11px] font-medium py-3 px-5" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.03)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}`, color: t.textMuted }}>
                <span>Tier</span><span>Refill</span><span>What that means</span>
              </div>
              {[
                ['Budget', 'None', 'What arrives is what you keep. Sensible for views, risky for followers.'],
                ['Standard', '30 days', 'Drops inside 30 days on a refill included service get replaced.'],
                ['Premium', 'Life of the order', 'Same, with no expiry window, on services marked for it.'],
              ].map(([tier, refill, meaning]) => (
                <div key={tier} className="grid grid-cols-3 gap-0 py-3.5 px-5 text-[13px]" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)"}` }}>
                  <span className="font-medium" style={{ color: t.text }}>{tier}</span>
                  <span style={{ color: t.textSoft }}>{refill}</span>
                  <span style={{ color: t.textMuted }}>{meaning}</span>
                </div>
              ))}
            </div>
            <div className="text-[13px] mt-3 leading-[1.6] space-y-1" style={{ color: t.textMuted }}>
              <p>Three limits we will not hide. Refill applies to services marked refill included, not to everything. Refill restores the count, it does not return the same accounts. And refill cannot cover you deleting the post, switching the account to private, or the account being restricted, because there is nothing left to refill into.</p>
            </div>
          </section>

          {/* Where we are weak */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>Where we are honestly still weak</h2>
            <div className="text-[13px] leading-[1.75] space-y-3" style={{ color: t.textSoft }}>
              <p>We launched recently. We do not have five years of history and we are not going to pretend otherwise.</p>
              <p>Our third party review footprint is still thin, which is inconvenient for us and reasonable for you to weigh. Our catalogue is smaller than the big panels. Our delivery time estimates on individual services need work. And our support, while fast, is a small team, so at 3am on a Sunday you may be waiting longer than at 2pm on a Tuesday.</p>
            </div>
          </section>

          {/* CTA */}
          <section className="mb-12">
            <div className="p-8 max-md:p-6 rounded-2xl text-center" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.1)"}` }}>
              <h2 className="text-xl max-md:text-lg font-semibold mb-2" style={{ color: t.text }}>The cheapest way to form your own opinion</h2>
              <div className="text-[13px] leading-[1.65] max-w-[500px] mx-auto mb-5 space-y-2" style={{ color: t.textSoft }}>
                <p>Do not decide based on this page. We wrote it, so it is not evidence.</p>
                <p>Deposit ₦1,000, which is our minimum and deliberately low for this exact reason. Buy one small order on something cheap. Watch whether it starts, whether the tracker matches your actual count, and how fast WhatsApp replies.</p>
                <p>That test tells you more in one afternoon than any review page can.</p>
              </div>
              <a href="/signup" className="inline-flex items-center gap-2 py-3.5 px-8 rounded-xl bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-[15px] font-semibold no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]">Create free account</a>
            </div>
          </section>

          {/* Third party */}
          <section className="text-center text-[13px] leading-[1.65]" style={{ color: t.textMuted }}>
            <p className="font-medium mb-1" style={{ color: t.textSoft }}>Third party listings</p>
            <p>Trustpilot &middot; Google Business Profile &middot; Instagram and X at @TheNitroNG</p>
          </section>

        </main>
        <SharedFooter />
      </div>
    </>
  );
}
