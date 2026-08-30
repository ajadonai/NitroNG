'use client';
import { useEffect, useMemo, useState } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function ChangelogPage({ initialEntries }) {
  return <ThemeProvider><ChangelogInner entries={initialEntries || []} /></ThemeProvider>;
}

const KINDS = [['new', 'New'], ['improved', 'Improved'], ['fixed', 'Fixed']];
const kindOf = e => (KINDS.some(([k]) => k === e.tag) ? e.tag : 'new');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthOf = d => { const x = new Date(d); return `${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
const dayOf = d => { const x = new Date(d); return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()].slice(0, 3)}`; };

function ChangelogInner({ entries }) {
  const { dark, t } = useTheme();
  const [kind, setKind] = useState('all');

  const counts = useMemo(() => {
    const c = { all: entries.length, new: 0, improved: 0, fixed: 0 };
    for (const e of entries) c[kindOf(e)] += 1;
    return c;
  }, [entries]);

  const groups = useMemo(() => {
    const out = [];
    for (const e of entries) {
      if (kind !== 'all' && kindOf(e) !== kind) continue;
      const label = monthOf(e.date);
      let g = out.find(x => x.label === label);
      if (!g) { g = { label, items: [] }; out.push(g); }
      g.items.push(e);
    }
    return out;
  }, [entries, kind]);

  const [waLink, setWaLink] = useState(null);
  useEffect(() => {
    fetch('/api/settings').then(r => r.ok ? r.json() : {}).then(d => {
      const num = d?.settings?.social_whatsapp_support;
      if (num) setWaLink(`https://wa.me/${num.replace(/\D/g, '')}`);
    }).catch(() => {});
  }, []);

  const KIND_STYLE = {
    new: { color: t.accent, borderColor: 'rgba(196,125,142,.5)' },
    improved: { color: dark ? '#93c5fd' : '#2563eb', borderColor: dark ? 'rgba(147,197,253,.45)' : 'rgba(37,99,235,.4)' },
    fixed: { color: dark ? '#6ee7b7' : '#059669', borderColor: dark ? 'rgba(110,231,183,.45)' : 'rgba(5,150,105,.4)' },
  };

  const eyebrow = { fontSize: 10.5, fontWeight: 700, letterSpacing: '1.6px', textTransform: 'uppercase', color: t.accent, display: 'block' };
  const card = { background: t.cardBg, border: `1px solid ${t.cardBorder}` };
  const oldest = entries[entries.length - 1];

  return (
    <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif] transition-[background] duration-500" style={{ background: t.bg, color: t.text, '--cl-line': t.cardBorder }}>
      <style>{CL_CSS}</style>
      <SharedStyles />
      <SharedNav />
      <div className="flex-1 w-full max-w-[920px] mx-auto px-7 pt-11 pb-14 max-md:px-4 max-md:pt-7 max-md:pb-10 flex flex-col gap-[26px] max-md:gap-5">

        <header className="flex flex-col gap-2.5">
          <span style={eyebrow}>What&apos;s new</span>
          <h1 className="serif m-0 text-[clamp(34px,4.6vw,52px)] font-semibold leading-[1.08] tracking-[-0.01em]" style={{ color: t.text, textWrap: 'balance' }}>What changed on Nitro</h1>
          <p className="m-0 text-[18px] leading-[1.55] max-w-[62ch]" style={{ color: t.soft }}>
            Everything we ship that you would notice, newest first.{oldest ? ` ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} since ${monthOf(oldest.date)}.` : ''}
          </p>
        </header>

        <div className="flex flex-wrap gap-1.5 -mt-3.5 max-md:-mt-2.5">
          {[['all', 'All'], ...KINDS].map(([k, label]) => {
            const on = kind === k;
            return (
              <button key={k} type="button" onClick={() => setKind(k)} className="text-[12.5px] font-semibold rounded-full px-3 py-2 cursor-pointer transition-transform duration-150 hover:-translate-y-px"
                style={on ? { background: t.text, color: t.bg, border: `1px solid ${t.text}` } : { ...card, color: t.muted }}>
                {label} {counts[k]}
              </button>
            );
          })}
        </div>

        {groups.length === 0 && (
          <p className="m-0 text-[14.5px]" style={{ color: t.muted }}>Nothing to show here yet.</p>
        )}

        {groups.map(group => (
          <div key={group.label}>
            <h2 className="serif text-[26px] font-semibold mt-1.5 mb-2.5" style={{ color: t.text }}>{group.label}</h2>
            <div className="rounded-[14px] overflow-hidden" style={card}>
              {group.items.map((entry, i) => {
                const k = kindOf(entry);
                return (
                  <article key={entry.id || entry.date + i} className="cl-te">
                    <span className="cl-ty" style={KIND_STYLE[k]}>{KINDS.find(([x]) => x === k)[1]}</span>
                    <span className="cl-tt">
                      <b className="text-[15px] font-semibold" style={{ color: t.text }}>{entry.title}</b>
                      <span className="text-[13.5px] leading-[1.5]" style={{ color: t.soft }}>{entry.description}</span>
                    </span>
                    <span className="cl-day m" style={{ color: t.muted }}>{dayOf(entry.date)}</span>
                  </article>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3 rounded-[14px] px-[18px] py-4 max-md:flex-col max-md:items-stretch" style={card}>
          <span className="flex flex-col gap-0.5">
            <b className="text-[15px]" style={{ color: t.text }}>Want something we have not built?</b>
            <span className="text-[13px]" style={{ color: t.soft }}>Tell us on WhatsApp. Half of this list started as a message.</span>
          </span>
          <a href={waLink || '/contact'} target={waLink ? '_blank' : undefined} rel={waLink ? 'noopener noreferrer' : undefined} className="ml-auto max-md:ml-0 max-md:w-full inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold no-underline text-white transition-transform duration-200 hover:-translate-y-px" style={{ background: t.btnPrimary }}>WhatsApp us</a>
        </div>
      </div>
      <SharedFooter />
    </div>
  );
}

const CL_CSS = `
.cl-te{display:grid;grid-template-columns:90px 1fr 60px;gap:12px;align-items:start;padding:14px 18px;border-top:1px solid var(--cl-line)}.cl-te:first-child{border-top:0}
.cl-ty{justify-self:start;margin-top:2px;font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:3px 8px;border-radius:999px;border:1px solid;background:transparent;white-space:nowrap}
.cl-tt{display:flex;flex-direction:column;min-width:0}
.cl-day{font-size:12px;text-align:right;margin-top:3px;white-space:nowrap}
@media (max-width:767px){.cl-te{grid-template-columns:1fr auto;grid-template-areas:"ty d" "tt tt";gap:6px 10px}.cl-ty{grid-area:ty}.cl-day{grid-area:d}.cl-tt{grid-area:tt}}
`;
