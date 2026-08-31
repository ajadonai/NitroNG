'use client';
import { useEffect, useMemo, useState } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

const WA_FALLBACK = '2347071656156';

// Topics a guide can land in, in the order they are shown.
const HELP_TOPICS = ['Getting started', 'Orders', 'Money', 'Account'];

// First list whose words appear in the title or slug wins, so a new guide
// falls somewhere sensible without anyone editing this file.
const TOPIC_WORDS = [
  ['Getting started', ['getting started', 'first order', 'get started', 'start here', 'sign up', 'signup', 'create an account', 'how nitro works', 'beginner', '60 seconds', 'right link', 'copy your']],
  ['Money', ['fund', 'wallet', 'deposit', 'payment', 'pay ', 'price', 'naira', 'refund', 'coupon', 'referral', 'bonus', 'money', 'top up', 'topup', 'invoice', 'withdraw']],
  ['Orders', ['order', 'status', 'tier', 'refill', 'deliver', 'drop', 'cancel', 'partial', 'link', 'speed', 'service', 'track']],
  ['Account', ['account', 'password', 'log in', 'login', 'security', 'profile', 'settings', 'email', 'notification', 'delete', 'api key']],
];

export function helpTopic({ title = '', slug = '' } = {}) {
  const hay = ` ${title} ${String(slug).replace(/-/g, ' ')} `.toLowerCase();
  for (const [topic, words] of TOPIC_WORDS) if (words.some(w => hay.includes(w))) return topic;
  return 'Getting started';
}

const WORDS = ['no', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
const spell = n => (n <= 20 ? WORDS[n] : String(n));

function useWhatsAppLink(text = 'Hi *Nitro*, I need help') {
  const [num, setNum] = useState(WA_FALLBACK);
  useEffect(() => {
    fetch('/api/settings').then(r => (r.ok ? r.json() : {})).then(d => {
      const n = d?.settings?.social_whatsapp_support?.replace(/\D/g, '');
      if (n) setNum(n);
    }).catch(() => {});
  }, []);
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

export default function HelpListing({ articles }) {
  return <ThemeProvider><HelpListingInner articles={articles} /></ThemeProvider>;
}

function HelpListingInner({ articles }) {
  const { t } = useTheme();
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('All');
  const waLink = useWhatsAppLink();

  const all = useMemo(() => (articles || []).map(a => ({ ...a, topic: helpTopic(a) })), [articles]);
  const topics = useMemo(() => HELP_TOPICS.filter(name => all.some(a => a.topic === name)), [all]);

  const q = query.trim().toLowerCase();
  const groups = topics
    .filter(name => topic === 'All' || name === topic)
    .map(name => [name, all.filter(a => a.topic === name && (!q || `${a.title} ${a.excerpt || ''}`.toLowerCase().includes(q)))])
    .filter(([, items]) => items.length);

  const n = all.length;
  const lede = n === 0
    ? 'Short guides on ordering, money, delivery and everything else are on the way. Until then, WhatsApp is faster.'
    : `${spell(n)} short guide${n === 1 ? '' : 's'} on ordering, money, delivery and everything else. If none of them answer it, WhatsApp is faster.`;

  const eyebrow = { fontSize: 10.5, fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: t.accent, display: 'block' };
  const card = { background: t.cardBg, border: `1px solid ${t.cardBorder}` };

  return (
    <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif] transition-[background] duration-500" style={{ background: t.bg, color: t.text }}>
      <SharedStyles />
      <SharedNav />
      <main className="flex-1 w-full max-w-[920px] mx-auto px-7 pt-11 pb-14 max-md:px-4 max-md:pt-7 max-md:pb-10 flex flex-col gap-[26px] max-md:gap-5">

        <header className="flex flex-col gap-2.5">
          <span style={eyebrow}>Help centre</span>
          <h1 className="serif m-0 text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.01em]" style={{ color: t.text, textWrap: 'balance' }}>How Nitro works</h1>
          <p className="m-0 text-[18px] leading-[1.55] max-w-[62ch]" style={{ color: t.soft }}>{lede}</p>
        </header>

        <div className="flex flex-col gap-3">
          <label className="h-[46px] rounded-xl flex items-center gap-2.5 px-4" style={card}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search the guides"
              aria-label="Search the guides"
              className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm"
              style={{ color: t.text }}
            />
          </label>
          {topics.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Topics">
              {['All', ...topics].map(name => {
                const on = topic === name;
                return (
                  <button
                    key={name}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setTopic(name)}
                    className="text-[12.5px] font-semibold py-2 px-3 rounded-full cursor-pointer max-md:flex-1 text-center whitespace-nowrap"
                    style={on ? { background: t.text, color: t.bg, border: `1px solid ${t.text}` } : { ...card, color: t.muted }}
                  >{name === 'All' ? `All ${n}` : name}</button>
                );
              })}
            </div>
          )}
        </div>

        {groups.length === 0 && (
          <p className="m-0 text-sm" style={{ color: t.muted }}>Nothing matches that. Try another word, or ask us on WhatsApp below.</p>
        )}

        {groups.map(([name, items]) => (
          <section key={name}>
            <span style={{ ...eyebrow, marginBottom: 8 }}>{name}</span>
            <div className="rounded-[14px] overflow-hidden" style={card}>
              {items.map((a, i) => (
                <a
                  key={a.slug}
                  href={`/help/${a.slug}`}
                  className="flex justify-between items-center gap-2.5 px-[18px] py-3.5 no-underline"
                  style={{ borderTop: i ? `1px solid ${t.cardBorder}` : undefined }}
                >
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <b className="text-[14.5px] font-semibold" style={{ color: t.text }}>{a.title}</b>
                    {a.excerpt && <span className="text-[12.5px] leading-[1.45]" style={{ color: t.muted }}>{a.excerpt}</span>}
                  </span>
                  <span aria-hidden="true" className="text-[18px] shrink-0" style={{ color: t.muted }}>›</span>
                </a>
              ))}
            </div>
          </section>
        ))}

        <div className="flex items-center gap-3 rounded-[14px] px-[18px] py-4 max-md:flex-col max-md:items-stretch" style={card}>
          <span className="flex flex-col gap-0.5">
            <b className="text-[15px]" style={{ color: t.text }}>Cannot find it?</b>
            <span className="text-[13px]" style={{ color: t.soft }}>WhatsApp us — we are there all day and we answer in minutes.</span>
          </span>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="ml-auto max-md:ml-0 max-md:w-full inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold no-underline text-white transition-transform duration-200 hover:-translate-y-px" style={{ background: t.btnPrimary }}>WhatsApp us</a>
        </div>

      </main>
      <SharedFooter />
    </div>
  );
}
