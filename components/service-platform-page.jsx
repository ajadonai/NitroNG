'use client';
import { useEffect, useState } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { trackViewContent } from './capi-tracker';
import { AskCard, PinkButton, priceRange, eyebrowStyle, cardStyle } from './platform-card';

// ── The reading layout shared by the two service templates ──
// Same 920px column, eyebrow, Cormorant H1, sticky contents and opaque cards as
// the legal pages and the blog post. Exported so the type page reuses them
// rather than growing a second copy.

export function Crumbs({ items }) {
  const { t } = useTheme();
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[12px]" style={{ color: t.muted }}>
      {items.map(({ label, href }, i) => (
        <span key={label} className="flex items-center gap-1.5">
          {i > 0 && <i className="not-italic opacity-50" aria-hidden="true">›</i>}
          {href
            ? <a href={href} className="font-semibold no-underline" style={{ color: t.accent }}>{label}</a>
            : <span aria-current="page">{label}</span>}
        </span>
      ))}
    </nav>
  );
}

// Sticky list on a desktop, a <details> under 768px. Same markup shape as
// LegalLayout so both surfaces behave identically.
export function Contents({ items }) {
  const { t } = useTheme();
  const key = items.map(i => i.id).join('|');
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const ids = key ? key.split('|') : [];
    const onScroll = () => {
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) cur = id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [key]);

  const eyebrow = eyebrowStyle(t);
  return (
    <>
      <aside className="sticky top-5 flex flex-col gap-0.5 max-md:hidden">
        <span style={{ ...eyebrow, marginBottom: 8 }}>On this page</span>
        {items.map(({ id, label }) => {
          const on = id === active;
          return (
            <a key={id} href={`#${id}`} className="text-[13px] leading-[1.35] px-2.5 py-1.5 no-underline" style={{ color: on ? t.text : t.muted, borderLeft: `2px solid ${on ? t.accent : t.cardBorder}`, fontWeight: on ? 600 : 400 }}>{label}</a>
          );
        })}
      </aside>
      <details className="md:hidden rounded-xl px-3.5 py-2.5 text-[13px]" style={cardStyle(t)}>
        <summary className="font-semibold cursor-pointer" style={{ color: t.text }}>On this page · {items.length} {items.length === 1 ? 'section' : 'sections'}</summary>
        {items.map(({ id, label }) => (
          <a key={id} href={`#${id}`} className="block py-1.5 no-underline" style={{ color: t.muted, borderTop: `1px solid ${t.cardBorder}` }}>{label}</a>
        ))}
      </details>
    </>
  );
}

export function Section({ id, title, children }) {
  const { t } = useTheme();
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="serif m-0 mb-2 text-[27px] font-semibold tracking-[-0.01em]" style={{ color: t.text }}>{title}</h2>
      {children}
    </section>
  );
}

export function Paras({ items }) {
  const { t } = useTheme();
  return (
    <div className="flex flex-col gap-3">
      {items.map((p, i) => <p key={i} className="m-0 text-[15.5px] leading-[1.7]" style={{ color: t.soft }}>{p}</p>)}
    </div>
  );
}

// Two-column plain tiles. `note` is optional — a tile with only a title is fine.
export function Tiles({ items }) {
  const { t } = useTheme();
  return (
    <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
      {items.map(({ title, note }) => (
        <span key={title} className="flex flex-col gap-1 rounded-xl px-4 py-3.5" style={cardStyle(t)}>
          <b className="text-[14.5px] font-semibold leading-[1.35]" style={{ color: t.text }}>{title}</b>
          {note && <i className="not-italic text-[13px] leading-[1.45]" style={{ color: t.muted }}>{note}</i>}
        </span>
      ))}
    </div>
  );
}

// Copy in the database uses markdown links; render them rather than printing
// the brackets. Everything else stays plain text.
function linkify(text, accent) {
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  const out = [];
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<a key={m.index} href={m[2]} className="font-semibold no-underline" style={{ color: accent }}>{m[1]}</a>);
    last = m.index + m[0].length;
  }
  if (!out.length) return text;
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// One open at a time.
export function Accordion({ items }) {
  const { t } = useTheme();
  const [open, setOpen] = useState(0);
  return (
    <div className="rounded-[14px] overflow-hidden" style={cardStyle(t)}>
      {items.map(({ q, a }, i) => (
        <div key={q} style={{ borderTop: i === 0 ? 'none' : `1px solid ${t.cardBorder}` }}>
          <button
            type="button"
            onClick={() => setOpen(open === i ? -1 : i)}
            aria-expanded={open === i}
            className="w-full flex items-center justify-between gap-2.5 px-[18px] py-3.5 text-left bg-transparent border-0"
          >
            <b className="text-[15px] font-semibold" style={{ color: open === i ? t.accent : t.text }}>{q}</b>
            <i className="not-italic text-[18px] leading-none shrink-0" style={{ color: t.muted }} aria-hidden="true">{open === i ? '−' : '+'}</i>
          </button>
          {open === i && (
            <p className="m-0 px-[18px] pb-3.5 text-[14.5px] leading-[1.65] max-w-[66ch]" style={{ color: t.soft }}>{linkify(a, t.accent)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// The numbered rows, in one card, same frame as the accordion.
export function Steps({ items }) {
  const { t } = useTheme();
  return (
    <div className="rounded-[14px] overflow-hidden" style={cardStyle(t)}>
      {items.map(([num, title, desc], i) => (
        <div key={num} className="flex flex-col gap-0.5 px-[18px] py-3.5" style={{ borderTop: i === 0 ? 'none' : `1px solid ${t.cardBorder}` }}>
          <b className="flex items-center text-[14.5px] font-semibold" style={{ color: t.text }}>
            <span className="inline-flex w-[22px] h-[22px] mr-2 rounded-full items-center justify-center text-[11px] font-extrabold shrink-0" style={{ background: 'rgba(196,125,142,.14)', color: t.accent }}>{num}</span>
            {title}
          </b>
          <i className="not-italic text-[12.5px] leading-[1.45]" style={{ color: t.muted }}>{desc}</i>
        </div>
      ))}
    </div>
  );
}

const SECTION_LABEL = { services: 'Services', pricing: 'Pricing', quality: 'Quality', reviews: 'Reviews', blog: 'Blog', help: 'Help' };
export function sectionOf(href) {
  const seg = String(href || '').split('/').filter(Boolean)[0] || '';
  return SECTION_LABEL[seg] || (seg ? seg[0].toUpperCase() + seg.slice(1) : 'Nitro');
}

export function RelatedTiles({ items }) {
  const { t } = useTheme();
  if (!items.length) return null;
  return (
    <div>
      <span style={{ ...eyebrowStyle(t), marginBottom: 10 }}>Related</span>
      <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
        {items.map(({ href, label, note }) => (
          <a key={href} href={href} className="flex flex-col gap-1 rounded-xl px-4 py-3.5 no-underline transition-transform duration-200 hover:-translate-y-px" style={cardStyle(t)}>
            <em className="not-italic text-[10.5px] font-bold uppercase tracking-[1.2px]" style={{ color: t.accent }}>{note || sectionOf(href)}</em>
            <b className="text-[14px] leading-[1.35] font-semibold" style={{ color: t.text }}>{label}</b>
          </a>
        ))}
      </div>
    </div>
  );
}

export function PageShell({ children }) {
  const { t } = useTheme();
  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif] transition-[background] duration-500" style={{ background: t.bg, color: t.text }}>
        <SharedNav />
        <div className="flex-1 w-full max-w-[920px] mx-auto px-7 pt-11 pb-14 max-md:px-4 max-md:pt-7 max-md:pb-10 flex flex-col gap-[26px] max-md:gap-5">
          {children}
        </div>
        <SharedFooter />
      </div>
    </>
  );
}

// ── The platform template ──

// The sub-line under a service name, built from the row's own numbers. The
// wording matches the pricing page so the two surfaces read the same.
function serviceNote(s) {
  const n = `${s.tiers} ${s.tiers === 1 ? 'tier' : 'tiers'}`;
  const parts = [n];
  if (s.refill) parts.push(s.tiers >= 3 ? 'refill on Standard and Premium' : 'refill');
  if (s.nigerian) parts.push('Nigerian accounts');
  if (s.name?.includes('🇺🇸')) parts.push('American accounts');
  return parts.join(' · ');
}

export default function ServicePlatformView({ platform, services, copy, nextPlatform, relatedLinks }) {
  return <ThemeProvider><ServicePlatformInner platform={platform} services={services} copy={copy} nextPlatform={nextPlatform} relatedLinks={relatedLinks} /></ThemeProvider>;
}

function ServicePlatformInner({ platform, services = [], copy = {}, nextPlatform, relatedLinks = [] }) {
  const { t } = useTheme();
  const card = cardStyle(t);
  const eyebrow = eyebrowStyle(t);

  useEffect(() => { trackViewContent({ content_name: `services-${platform.toLowerCase()}`, content_type: 'service_page' }); }, [platform]);

  const article = /^[aeiou]/i.test(platform) || platform === 'X' ? 'an' : 'a';
  const steps = [
    ['1', 'Create a free account', 'Sign up in seconds — no card required. Just an email or Google account.'],
    ['2', 'Fund your wallet', 'Add funds via bank transfer, card, or crypto. Minimum ₦1,000.'],
    ['3', 'Place your order', `Choose ${article} ${platform} service, paste your link, pick a tier, and confirm. Results start within minutes.`],
  ];

  const hasGet = copy.whatYouGet?.length > 0;
  const hasWhy = copy.whySection?.length > 0;
  const hasFaq = copy.faq?.length > 0;

  const toc = [
    hasGet && { id: 'what-you-can-get', label: 'What you can get' },
    { id: 'how-to-buy', label: 'How to buy' },
    hasWhy && { id: 'why-nitro', label: 'Why Nitro' },
    hasFaq && { id: 'questions', label: 'Questions' },
  ].filter(Boolean);

  // whatYouGet is a flat list of sentences; where one carries an em dash the
  // half after it is the tile's note.
  const tiles = (copy.whatYouGet || []).map(line => {
    const i = line.indexOf(' — ');
    return i === -1 ? { title: line } : { title: line.slice(0, i), note: line.slice(i + 3) };
  });

  const related = [
    ...relatedLinks.map(({ href, label }) => ({ href, label })),
    ...(nextPlatform ? [{ href: `/services/${nextPlatform.slug}`, label: `Browse ${nextPlatform.name} services`, note: 'Next platform' }] : []),
  ];

  return (
    <PageShell>
      <Crumbs items={[{ label: 'Services', href: '/services' }, { label: platform }]} />

      <header className="flex flex-col gap-2.5">
        <span style={eyebrow}>{platform} · {services.length} {services.length === 1 ? 'service' : 'services'}</span>
        <h1 className="serif m-0 text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.01em]" style={{ color: t.text, textWrap: 'balance' }}>{copy.h1}</h1>
        {copy.heroDesc && <p className="m-0 text-[18px] leading-[1.55] max-w-[62ch]" style={{ color: t.soft }}>{copy.heroDesc}</p>}
      </header>

      {services.length > 0 && (
        <div>
          <div className="rounded-[14px] overflow-hidden" style={card}>
            <div className="flex items-baseline justify-between gap-2.5 px-[18px] py-3" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
              <b className="text-[15px] font-semibold" style={{ color: t.text }}>{platform} services and prices</b>
              <span className="text-[12px] text-right" style={{ color: t.muted }}>per 1,000</span>
            </div>
            {services.map((s, i) => (
              <div key={s.type} className="flex items-center justify-between gap-2.5 px-[18px] py-3.5" style={{ borderTop: i === 0 ? 'none' : `1px solid ${t.cardBorder}` }}>
                <span className="flex flex-col min-w-0">
                  <b className="text-[15px] font-semibold" style={{ color: t.text }}>{s.type}</b>
                  <span className="text-[12px]" style={{ color: t.muted }}>{serviceNote(s)}</span>
                </span>
                <b className="m shrink-0 text-[14px] font-semibold whitespace-nowrap" style={{ color: t.text, fontVariantNumeric: 'tabular-nums' }}>{priceRange(s.minPrice, s.maxPrice)}</b>
              </div>
            ))}
          </div>
          <div className="mt-2.5">
            <PinkButton href="/signup" full>Start growing on {platform}</PinkButton>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[220px_1fr] gap-9 items-start max-md:grid-cols-1 max-md:gap-[18px]">
        <Contents items={toc} />
        <article className="flex flex-col gap-[22px] max-w-[66ch] min-w-0">
          {hasGet && (
            <Section id="what-you-can-get" title="What you can get">
              <Tiles items={tiles} />
            </Section>
          )}
          <Section id="how-to-buy" title={`How to buy ${platform} ${copy.mainService || 'services'} on Nitro`}>
            <Steps items={steps} />
          </Section>
          {hasWhy && (
            <Section id="why-nitro" title={`Why use Nitro for ${platform}`}>
              <Paras items={copy.whySection} />
            </Section>
          )}
          {hasFaq && (
            <Section id="questions" title="Frequently asked questions">
              <Accordion items={copy.faq} />
            </Section>
          )}
        </article>
      </div>

      <RelatedTiles items={related} />

      <AskCard title="Not sure which tier?" body="Start with Budget on a small order and move up. Or ask us on WhatsApp." />
    </PageShell>
  );
}
