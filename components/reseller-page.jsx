'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function ResellerView() {
  return <ThemeProvider><ResellerInner /></ThemeProvider>;
}

function ResellerInner() {
  const { dark, t } = useTheme();
  const accent = '#c47d8e';
  const border = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)';
  const cardBg = dark ? 'rgba(255,255,255,.05)' : '#fff';
  const subtleBg = dark ? 'rgba(196,125,142,.06)' : 'rgba(196,125,142,.04)';
  const subtleBorder = dark ? 'rgba(196,125,142,.14)' : 'rgba(196,125,142,.1)';

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus_Jakarta_Sans,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav />

        {/* Hero */}
        <div className="text-center pt-14 pb-10 max-md:pt-10 max-md:pb-8 px-6">
          <span className="text-xs font-semibold tracking-[2px] uppercase block mb-3" style={{ color: accent }}>The Pit</span>
          <h1 className="text-[clamp(26px,5vw,40px)] font-semibold mb-4 leading-tight max-w-[600px] mx-auto" style={{ color: t.text, fontFamily: "'Cormorant Garamond',serif" }}>
            Earn money promoting Nitro
          </h1>
          <p className="text-[15px] leading-relaxed max-w-[520px] mx-auto mb-6" style={{ color: t.textSoft }}>
            The Pit is Nitro's affiliate programme. Share your link, earn commission on every order from people you refer. No upfront cost, no inventory, no customer service. Just promotion and payouts.
          </p>
          <a href="/pit/apply" className="inline-block px-7 py-3 rounded-full text-[14px] font-semibold text-white no-underline transition-opacity hover:opacity-90" style={{ background: accent }}>
            Apply to The Pit
          </a>
        </div>

        <main className="flex-1 px-6 pb-20 max-w-[800px] mx-auto w-full">

          {/* How it works */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-5" style={{ color: t.text }}>How it works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                ['1. Apply', 'Fill in a short form. We review applications within 48 hours. Once approved, you get access to The Pit dashboard.'],
                ['2. Share your link', 'Create up to 5 tracking links. Share them on social media, WhatsApp groups, your blog, or anywhere your audience is. Every click and signup is tracked.'],
                ['3. Earn commission', 'When someone signs up through your link and places orders, you earn a percentage of the profit on every order they place. Commissions are tracked in real time and paid to your bank account.'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl p-5" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div className="text-[14px] font-semibold mb-2" style={{ color: accent }}>{title}</div>
                  <div className="text-[13px] leading-[1.65]" style={{ color: t.textSoft }}>{desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Commission tiers */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-2" style={{ color: t.text }}>Commission tiers</h2>
            <p className="text-[14px] mb-5 leading-[1.6]" style={{ color: t.textSoft }}>
              Commission is calculated on profit, not gross revenue. As you bring in more converting referrals, your rate increases automatically.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { tier: 'Starter', rate: '30%', threshold: 'From day one', desc: 'Every new member starts here. Earn 30% of profit on every order your referrals place.' },
                { tier: 'Growth', rate: '40%', threshold: '30+ conversions', desc: 'Once 30 of your referrals have placed orders, your rate jumps to 40%.' },
                { tier: 'Pro', rate: '50%', threshold: '100+ conversions', desc: 'At 100 converting referrals, you earn half the profit on every order. This is the highest tier.' },
              ].map(t => (
                <div key={t.tier} className="rounded-xl p-5 text-center" style={{ background: subtleBg, border: `1px solid ${subtleBorder}` }}>
                  <div className="text-[32px] font-bold mb-1" style={{ color: accent }}>{t.rate}</div>
                  <div className="text-[14px] font-semibold mb-1" style={{ color: dark ? '#e5e5e5' : '#1c1b19' }}>{t.tier}</div>
                  <div className="text-[12px] font-medium mb-2" style={{ color: accent }}>{t.threshold}</div>
                  <div className="text-[12px] leading-[1.6]" style={{ color: dark ? '#999' : '#777' }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* What you get */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-5" style={{ color: t.text }}>What you get</h2>
            <div className="flex flex-col gap-3">
              {[
                ['Real-time dashboard', 'See clicks, signups, orders and commissions as they happen. No waiting for end-of-month reports.'],
                ['Up to 5 tracking links', 'Create separate links for different channels. See which one converts best.'],
                ['Bank payouts', 'Commissions are paid directly to your Nigerian bank account. Minimum payout is ₦50.'],
                ['7-day hold period', 'Commissions are held for 7 days after the order to account for refunds. After the hold, they are yours.'],
                ['Team structure', 'Chiefs can invite and manage crew members. Chiefs earn 40% of their crew members\' commissions on top of their own.'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl p-5" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <div className="text-[14px] font-semibold mb-1.5" style={{ color: dark ? '#e5e5e5' : '#1c1b19' }}>{title}</div>
                  <div className="text-[13px] leading-[1.65]" style={{ color: t.textSoft }}>{desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Who it's for */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-2" style={{ color: t.text }}>Who The Pit is for</h2>
            <div className="text-[14px] leading-[1.7] flex flex-col gap-3 mt-4" style={{ color: t.textSoft }}>
              <p><strong style={{ color: dark ? '#e5e5e5' : '#1c1b19' }}>Social media managers</strong> who already advise clients on growth. Recommend Nitro, earn commission when they order.</p>
              <p><strong style={{ color: dark ? '#e5e5e5' : '#1c1b19' }}>Content creators with an audience.</strong> If people trust your recommendations, a single post or story can generate referrals that keep earning for months.</p>
              <p><strong style={{ color: dark ? '#e5e5e5' : '#1c1b19' }}>Community admins.</strong> WhatsApp group admins, Telegram channel owners, forum moderators. If your community includes people who buy social media promotion, your link earns every time they do.</p>
              <p><strong style={{ color: dark ? '#e5e5e5' : '#1c1b19' }}>Anyone with reach.</strong> No minimum audience. If you can get people to click a link and try Nitro, you earn on every order they place going forward.</p>
            </div>
          </section>

          {/* What it's not */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-2" style={{ color: t.text }}>What The Pit is not</h2>
            <div className="text-[14px] leading-[1.7] flex flex-col gap-3 mt-4" style={{ color: t.textSoft }}>
              <p>The Pit is an <strong style={{ color: dark ? '#e5e5e5' : '#1c1b19' }}>affiliate programme</strong>, not a child panel or wholesale API. You do not place orders on behalf of clients. You do not set your own prices. You do not handle delivery or support.</p>
              <p>You share a link. People sign up and use Nitro normally. You earn a percentage of the profit on their orders. That is the entire model.</p>
              <p>If you are looking for a child panel where you resell services under your own brand, that is a different product and we do not offer it. Read <a href="/blog/what-is-a-child-panel-smm" className="underline" style={{ color: accent }}>what is a child panel</a> to understand the difference.</p>
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-14">
            <h2 className="text-lg font-semibold mb-5" style={{ color: t.text }}>FAQ</h2>
            <div className="flex flex-col gap-3">
              {[
                ['How much can I earn?', 'It depends on how many people you refer and how much they spend. If you refer 10 people who each spend ₦10,000 per month and your commission rate is 30% of profit, you earn a meaningful recurring income with no ongoing effort beyond the initial referral.'],
                ['When do I get paid?', 'Commissions are held for 7 days after each order. After the hold period, they move to your available balance. You can request a payout to your bank account at any time once your balance exceeds ₦50.'],
                ['Does it cost anything to join?', 'No. The Pit is free to join. There is no signup fee, no monthly fee, and no minimum activity requirement.'],
                ['What if my referral gets a refund?', 'If an order is refunded during the 7-day hold period, the commission on that order is voided. Commissions that have already cleared the hold period are yours regardless.'],
                ['Can I promote The Pit itself?', 'Yes. If you bring in someone who becomes a Pit member and that person refers customers, you earn a lead split on their commissions too. Chiefs earn 40% of their crew members\' commissions.'],
              ].map(([q, a]) => (
                <details key={q} className="rounded-xl overflow-hidden group" style={{ background: cardBg, border: `1px solid ${border}` }}>
                  <summary className="cursor-pointer px-5 py-4 text-[14px] font-semibold list-none flex items-center justify-between" style={{ color: dark ? '#e5e5e5' : '#1c1b19' }}>
                    {q}
                    <svg className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </summary>
                  <div className="px-5 pb-4 text-[13px] leading-[1.65]" style={{ color: t.textSoft }}>{a}</div>
                </details>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="text-center py-10 rounded-2xl mb-10" style={{ background: subtleBg, border: `1px solid ${subtleBorder}` }}>
            <h2 className="text-xl font-semibold mb-3" style={{ color: dark ? '#e5e5e5' : '#1c1b19', fontFamily: "'Cormorant Garamond',serif" }}>Ready to start earning?</h2>
            <p className="text-[14px] mb-5 max-w-[400px] mx-auto" style={{ color: t.textSoft }}>Applications take two minutes. No upfront cost, ever.</p>
            <a href="/pit/apply" className="inline-block px-7 py-3 rounded-full text-[14px] font-semibold text-white no-underline transition-opacity hover:opacity-90" style={{ background: accent }}>
              Apply to The Pit
            </a>
          </section>

          {/* Related reading */}
          <section>
            <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>Related reading</h2>
            <div className="flex flex-col gap-2">
              {[
                ['/blog/how-to-start-smm-reseller-business-nigeria', 'How to Start an SMM Reseller Business in Nigeria'],
                ['/blog/what-is-a-child-panel-smm', 'What Is a Child Panel? And Should You Buy One?'],
                ['/blog/is-nitro-ng-legit', 'Is Nitro.ng Legit? An Honest Look at How We Operate'],
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
