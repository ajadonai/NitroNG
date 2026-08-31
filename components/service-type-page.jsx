'use client';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import { trackViewContent } from './capi-tracker';
import { AskCard, PinkButton, naira, perUnit, eyebrowStyle, cardStyle } from './platform-card';
import {
  Crumbs, Contents, Section, Accordion, Steps, RelatedTiles, PageShell,
} from './service-platform-page';

export default function ServiceTypeView({ platform, platformSlug, typeLabel, services, introHtml, copy }) {
  return <ThemeProvider><ServiceTypeInner platform={platform} platformSlug={platformSlug} typeLabel={typeLabel} services={services} introHtml={introHtml} copy={copy} /></ThemeProvider>;
}

// The one line under a tier price, built from that tier's own refill cover.
function tierLine(tier) {
  const unit = perUnit(tier.price) ? 'per unit' : 'per 1,000';
  if (!tier.refill) return `${unit} · no refill`;
  if (tier.refillDays > 0) return `${unit} · refill for ${tier.refillDays} ${tier.refillDays === 1 ? 'day' : 'days'}`;
  return `${unit} · refill for the life of the order`;
}

function TierCards({ tiers }) {
  const { t } = useTheme();
  return (
    <div className="flex gap-3 max-md:flex-col">
      {tiers.map((tier, i) => (
        <span
          key={`${tier.tier}-${i}`}
          className="flex-1 basis-0 min-w-0 flex flex-col gap-[3px] rounded-xl px-4 py-3.5"
          style={{ ...cardStyle(t), ...(tier.tier === 'Standard' ? { borderColor: t.accent } : {}) }}
        >
          <em className="not-italic text-[10.5px] font-bold uppercase tracking-[1.2px]" style={{ color: t.accent }}>{tier.tier}</em>
          <b className="m text-[20px] font-extrabold" style={{ color: t.text, fontVariantNumeric: 'tabular-nums' }}>{naira(tier.price, perUnit(tier.price))}</b>
          <i className="not-italic text-[12.5px]" style={{ color: t.muted }}>{tierLine(tier)}</i>
          {tier.speed && <i className="not-italic text-[12.5px]" style={{ color: t.muted }}>{tier.speed}</i>}
        </span>
      ))}
    </div>
  );
}

function ServiceTypeInner({ platform, platformSlug, typeLabel, services = [], introHtml, copy = {} }) {
  const { dark, t } = useTheme();
  const eyebrow = eyebrowStyle(t);
  const label = typeLabel.toLowerCase();

  useEffect(() => { trackViewContent({ content_name: `services-${platformSlug}-${typeLabel.toLowerCase().replace(/\s+/g, '-')}`, content_type: 'service_type_page' }); }, [platformSlug, typeLabel]);

  const allTiers = services.flatMap(s => s.tiers || []);
  const cheapest = allTiers.length ? Math.min(...allTiers.map(x => x.price)) : 0;
  const unit = perUnit(cheapest);
  const lede = copy.heroDesc || (allTiers.length
    ? `${platform} ${label} from ${naira(cheapest, unit)} ${unit ? 'per unit' : 'per 1,000'}, priced in naira and paid from any Nigerian bank or card.${allTiers.some(x => x.refill) ? ' The tiers differ in one thing: how long we keep replacing what drops.' : ' We never ask for your password.'}`
    : null);

  const steps = [
    ['1', 'Create a free account', 'Sign up in seconds with email or Google. No card needed.'],
    ['2', 'Fund your wallet', 'Add funds via bank transfer, card, or crypto. Minimum ₦1,000.'],
    ['3', 'Place your order', `Choose your ${label} service, paste your link, pick a tier, and confirm.`],
  ];

  const hasFaq = copy.faq?.length > 0;
  const toc = [
    { id: 'which-tier', label: 'Which tier' },
    { id: 'how-to-buy', label: 'How to buy' },
    hasFaq && { id: 'questions', label: 'Questions' },
  ].filter(Boolean);

  const related = [
    { href: `/services/${platformSlug}`, label: `All ${platform} services`, note: platform },
    { href: '/pricing', label: 'Full pricing across all platforms' },
    { href: '/quality', label: 'How Nitro keeps drop rates low' },
    { href: '/reviews', label: 'What using Nitro is actually like' },
  ];

  return (
    <PageShell>
      <Crumbs items={[{ label: 'Services', href: '/services' }, { label: platform, href: `/services/${platformSlug}` }, { label: typeLabel }]} />

      <header className="flex flex-col gap-2.5">
        <span style={eyebrow}>{platform} {label}</span>
        <h1 className="serif m-0 text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.01em]" style={{ color: t.text, textWrap: 'balance' }}>{copy.h1}</h1>
        {lede && <p className="m-0 text-[18px] leading-[1.55] max-w-[62ch]" style={{ color: t.soft }}>{lede}</p>}
      </header>

      {allTiers.length > 0 && (
        <div>
          <div className="flex flex-col gap-3">
            {services.map(s => (
              <div key={s.name} className="flex flex-col gap-2">
                {services.length > 1 && <span style={eyebrow}>{s.name}</span>}
                <TierCards tiers={s.tiers} />
              </div>
            ))}
          </div>
          <div className="mt-2.5">
            <PinkButton href="/signup" full>Buy {platform} {label}</PinkButton>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[220px_1fr] gap-9 items-start max-md:grid-cols-1 max-md:gap-[18px]">
        <Contents items={toc} />
        <article className="flex flex-col gap-[22px] max-w-[66ch] min-w-0">
          <Section id="which-tier" title="Which tier should you pick">
            {introHtml ? (
              <div
                className="blog-article-body text-[15.5px] leading-[1.7]"
                data-theme={dark ? 'dark' : 'light'}
                style={{ color: t.soft, fontSize: '15.5px' }}
                dangerouslySetInnerHTML={{ __html: introHtml }}
              />
            ) : (
              <p className="m-0 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>
                If you are testing us, Budget. If this is an account you care about, Standard: 30 days is long enough for most drops to happen and be replaced. Premium is for accounts where the number is the product.
              </p>
            )}
          </Section>
          <Section id="how-to-buy" title="How to buy">
            <Steps items={steps} />
          </Section>
          {hasFaq && (
            <Section id="questions" title="Frequently asked questions">
              <Accordion items={copy.faq} />
            </Section>
          )}
        </article>
      </div>

      <RelatedTiles items={related} />

      <AskCard title="Want us to place it?" body="Send the link on WhatsApp and we will order it for you." />
    </PageShell>
  );
}
