'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { ProductScreenshot } from './product-screenshot';

export default function QualityView({ serviceCount, platformCount }) {
  return <ThemeProvider><QualityInner serviceCount={serviceCount} platformCount={platformCount} /></ThemeProvider>;
}

function QualityInner({ serviceCount, platformCount }) {
  const { dark, t } = useTheme();
  const accent = "#c47d8e";
  const border = dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)";
  const cardBg = dark ? "rgba(255,255,255,.06)" : "#fff";
  const softBg = dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.02)";

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav action="login" />
        <main className="flex-1 py-16 px-6 pb-20 max-w-[1100px] mx-auto w-full">

          {/* Hero */}
          <div className="mb-14 text-center">
            <span className="text-xs font-semibold tracking-[2px] uppercase block mb-3" style={{ color: accent }}>Service quality</span>
            <h1 className="text-[clamp(28px,5vw,44px)] font-semibold mb-4 leading-tight" style={{ color: t.text }}>
              Low drop rates.<br />
              <span className="serif italic font-medium text-[clamp(32px,5.5vw,48px)]" style={{ color: accent }}>Every service, tested.</span>
            </h1>
            <p className="text-[15px] leading-[1.7] max-w-[620px] mx-auto" style={{ color: t.textSoft }}>
              Most SMM panels list hundreds of services and leave you to figure out which ones actually work. Nitro does the testing for you — we curate every service so you don't waste money on drops.
            </p>
          </div>

          {/* The problem */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-3" style={{ color: t.text }}>Why most panels have high drop rates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div>
                <p className="text-[14px] leading-[1.75] mb-4" style={{ color: t.textSoft }}>
                  "Drops" happen when followers, likes, or views disappear after delivery. On most SMM panels, this is common because they list services from dozens of providers without testing them. You place an order, the numbers go up, and a week later half of it is gone.
                </p>
                <p className="text-[14px] leading-[1.75]" style={{ color: t.textSoft }}>
                  The result? You spend hours testing services yourself, wasting money on bad ones, and still never knowing which provider is reliable this week. It's a guessing game.
                </p>
              </div>
              <div>
                <p className="text-[14px] leading-[1.75] mb-4" style={{ color: t.textSoft }}>
                  The root cause is simple: most panels are resellers with no quality control. They connect to a provider API, list everything available, and let customers sort through the mess. When a service starts dropping, they don't notice — you do.
                </p>
                <p className="text-[14px] leading-[1.75]" style={{ color: t.textSoft }}>
                  Nigerian creators and businesses waste real money on this cycle. At Nitro, we decided to solve it at the source instead of passing the problem to you.
                </p>
              </div>
            </div>
          </section>

          {/* How Nitro curates */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-5 text-center" style={{ color: t.text }}>How Nitro keeps drop rates low</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                ['We test before you see it', "Every service is tested internally before it goes live on the platform. If a provider’s service drops heavily in testing, it never reaches customers."],
                ['We monitor after delivery', "We track delivery quality across providers. When a service starts underperforming, we either replace the provider or take the service offline — before you notice."],
                ['We limit our catalogue', "We don’t list 500 services to look impressive. We list the ones that actually work. A smaller, curated list beats a massive unreliable one."],
                ['We pick providers carefully', "We work with a shortlist of vetted providers. Not the cheapest — the most consistent. Reliability matters more than saving fractions of a kobo per order."],
                ['We offer refill protection', "Even with careful curation, no service is 100% drop-proof. That’s why Standard and Premium tiers include automatic refill — if numbers drop, we top them up at no cost."],
                ['We respond when things go wrong', "If you notice unusual drops, our WhatsApp support team investigates and resolves it. You talk to a real person, not a ticket system."],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl p-5" style={{ background: softBg, border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}` }}>
                  <div className="text-[14px] font-semibold mb-1.5" style={{ color: t.text }}>{title}</div>
                  <div className="text-[13px] leading-[1.6]" style={{ color: t.textMuted }}>{desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Order tracker screenshot */}
          <div className="mb-14 max-w-[600px] mx-auto">
            <ProductScreenshot src="/images/nitro-order-tracking-start-current-target.webp" alt="Nitro order tracker showing 870 of 1,000 Instagram followers delivered with start count and live status" dark={dark} />
          </div>

          {/* Refill tiers */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-5 text-center" style={{ color: t.text }}>Three tiers of protection</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                ['Budget', 'Lowest price, no refill. Good for testing or one-time boosts where you just need the initial push.', dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.03)"],
                ['Standard', '30-day refill guarantee. If numbers drop within 30 days, we top them back up automatically. Best balance of price and reliability.', dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.05)"],
                ['Premium', 'Lifetime refill. Numbers drop at any point — we refill them, no questions asked. For accounts where every follower counts.', dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.08)"],
              ].map(([tier, desc, bg]) => (
                <div key={tier} className="rounded-2xl p-6 text-center" style={{ background: bg, border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}` }}>
                  <div className="text-base font-bold mb-2" style={{ color: tier === 'Premium' ? accent : t.text }}>{tier}</div>
                  <div className="text-[13px] leading-[1.65]" style={{ color: t.textMuted }}>{desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Tiers diagram */}
          <div className="mb-14 max-w-[600px] mx-auto">
            <ProductScreenshot src="/images/nitro-smm-tiers-budget-standard-premium.webp" alt="Nitro tier comparison showing refill cover on Budget, Standard and Premium" dark={dark} />
          </div>

          {/* Refill diagram */}
          <div className="mb-14 max-w-[600px] mx-auto">
            <ProductScreenshot src="/images/nitro-how-smm-refill-works-nigeria.webp" alt="How a refill works on Nitro, from order completion through drops to restored count" dark={dark} />
          </div>

          {/* Dashboard + pricing screenshots */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
            <ProductScreenshot src="/images/nitro-dashboard-nigeria-smm-panel.webp" alt="The Nitro NG dashboard showing wallet balance, active orders and recent activity" dark={dark} />
            <ProductScreenshot src="/images/nitro-naira-pricing-transparent-tiers.webp" alt="Nitro pricing page explaining Budget, Standard and Premium refill tiers with Naira starting prices" dark={dark} />
          </div>

          {/* What this means */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-3" style={{ color: t.text }}>What this means for you</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div>
                <h3 className="text-[14px] font-semibold mb-2" style={{ color: t.text }}>Stop wasting money on trial and error</h3>
                <p className="text-[14px] leading-[1.75]" style={{ color: t.textSoft }}>
                  On other panels, you have to test 5 different follower services before you find one that sticks. That's 4 wasted orders. On Nitro, every service you see has already been tested — the bad ones were filtered out before they reached you.
                </p>
              </div>
              <div>
                <h3 className="text-[14px] font-semibold mb-2" style={{ color: t.text }}>Your growth actually sticks</h3>
                <p className="text-[14px] leading-[1.75]" style={{ color: t.textSoft }}>
                  Growing from 1,000 to 10,000 followers doesn't help if half of them drop the next week. With curated services and refill protection, the numbers you build on Nitro are numbers you keep. Your social proof stays consistent.
                </p>
              </div>
            </div>
          </section>

          {/* FAQ-style section targeting long-tail keywords */}
          <section className="mb-14 max-w-[700px] mx-auto">
            <h2 className="text-lg font-semibold mb-5 text-center" style={{ color: t.text }}>Common questions about drop rates</h2>
            <div className="flex flex-col gap-3">
              {[
                ['What is a "drop" in SMM?', 'A drop is when followers, likes, or views you received through a promotion service disappear after some time. This usually happens because the accounts providing the engagement get flagged or removed by the platform.'],
                ['Can any panel guarantee zero drops?', 'No — anyone who claims 0% drop rate is not being honest. Social platforms constantly remove suspicious accounts. The difference is how a panel handles it: low drop rates from careful curation, plus automatic refill when drops do happen.'],
                ['How is Nitro different from other SMM panels?', 'Most panels list every service their providers offer without testing. Nitro curates — we test services internally, monitor delivery quality, and remove underperforming providers. You only see services that have passed our quality checks.'],
                ['Do I need to track my own drop rates?', "No. If you use a Standard or Premium tier service, refills happen automatically when we detect drops. You don't need to open a ticket or contact support — the system handles it."],
                ['What platforms does Nitro support?', `Instagram, TikTok, YouTube, X (Twitter), Facebook, Telegram, Spotify, Snapchat, LinkedIn, Twitch, Discord, and more — ${serviceCount || '35'}+ service categories across ${platformCount || '10'}+ platforms.`],
              ].map(([q, a]) => (
                <div key={q} className="rounded-xl p-5" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div className="text-[14px] font-semibold mb-1.5" style={{ color: t.text }}>{q}</div>
                  <div className="text-[13px] leading-[1.65]" style={{ color: t.textMuted }}>{a}</div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div className="p-6 rounded-[14px] text-center" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)", border: `1px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.14)"}` }}>
            <p className="text-[15px] mb-1 font-semibold" style={{ color: t.text }}>Stop guessing. Start growing.</p>
            <p className="text-sm mb-4" style={{ color: t.textSoft }}>Every service on Nitro is tested and monitored. Naira pricing, automatic refills, real support.</p>
            <a href="/signup" className="inline-flex items-center gap-2 py-3 px-7 rounded-[10px] bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-sm font-semibold no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]">Create free account</a>
          </div>

        </main>
        <SharedFooter />
      </div>
    </>
  );
}
