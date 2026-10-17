'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useT } from "./locale";
import { msg } from "../lib/i18n";
import { dateLocale } from "../lib/format";
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';
import { OffsetIcon } from "./offset-icons";

export default function ChangelogPage({ initialEntries }) {
  return <ThemeProvider><ChangelogInner entries={initialEntries || []} /></ThemeProvider>;
}

// Each kind is a printed tile in its own colour, with the word above the title.
const KINDS = [['new', msg('New'), 'spark', ['#c47d8e', '#e3a4b5']], ['improved', msg('Improved'), 'trend', ['#2563eb', '#93c5fd']], ['fixed', msg('Fixed'), 'wrench', ['#047c57', '#6ee7b7']]];
const kindOf = e => (KINDS.some(([k]) => k === e.tag) ? e.tag : 'new');
const KIND = Object.fromEntries(KINDS.map(([k, label, icon, tone]) => [k, { label, icon, tone }]));
// The newest two months open; the rest fold to their heading and counts.
const OPEN_MONTHS = 2;

/* The changelog in the landing page's print (approved 17 Oct 2026, mockup
   "Nitro Resellers and What's New"): a timeline grouped by day, so a date is
   printed once beside its changes rather than on every row; older months fold;
   filters are the tabs with counts Tasks and the Blog use. Logical properties,
   since this sheet does not go through the RTL build plugin. */
const CL_CSS = `
.cl{position:relative;overflow:hidden}
.cl-glow{position:absolute;width:560px;height:560px;top:-240px;inset-inline-end:-160px;border-radius:50%;filter:blur(100px);pointer-events:none}
.cl-in{position:relative;max-width:860px;margin:0 auto;padding:52px 24px 64px}
.cl-eb{display:inline-flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--t-accent-ink)}
.cl-eb::before{content:"";width:8px;height:8px;border-radius:2px;background:#c47d8e;box-shadow:1.5px 1.5px 0 var(--cl-print)}
.cl-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap}
.cl-head h1{margin:12px 0 0;font-size:clamp(38px,5vw,54px);font-weight:600;line-height:1.04;letter-spacing:-.01em;text-wrap:balance;color:var(--t-text)}
.cl-head p{margin:14px 0 0;max-width:58ch;font-size:16px;line-height:1.65;color:var(--t-text-soft)}
.cl-card{border-radius:20px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),4px 4px 0 var(--cl-print)}
.cl-latest{display:flex;align-items:center;gap:12px;padding:12px 16px 12px 14px;border-radius:16px;box-shadow:inset 0 0 0 1px var(--t-card-border),3px 3px 0 var(--cl-print)}
.cl-latest small{display:block;font-size:10.5px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:var(--t-text-muted)}
.cl-latest b{display:block;margin-top:2px;font-size:14.5px;font-weight:750;color:var(--t-text)}
.cl-tabs{display:flex;gap:6px;overflow-x:auto;margin:22px -4px 0;padding:3px 4px 6px;scrollbar-width:none}
.cl-tab{display:inline-flex;align-items:center;gap:7px;flex-shrink:0;height:36px;padding-inline:13px;border:0;border-radius:999px;font:inherit;font-size:13px;font-weight:650;white-space:nowrap;cursor:pointer;color:var(--t-text-soft);background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border)}
.cl-tab .c{padding:2px 6px;border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;color:var(--t-accent-ink);background:rgba(196,125,142,.12)}
.cl-tab.on{color:var(--t-text);box-shadow:inset 0 0 0 1.5px #c47d8e,2px 2px 0 var(--cl-print)}
.cl-tab.on .c{color:#fff;background:#96626f}
.cl-tab:focus-visible,.cl-tog:focus-visible{outline:2px solid var(--t-accent);outline-offset:2px}
.cl-month{margin-top:34px}
.cl-mh{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid var(--t-card-border)}
.cl-mh h2{margin:0;font-size:30px;font-weight:600;line-height:1;color:var(--t-text)}
.cl-mix{display:flex;flex-wrap:wrap;gap:6px;margin-inline-start:auto}
.cl-k{display:inline-flex;align-items:center;padding:3px 8px;border-radius:7px;font-size:11px;font-weight:700;white-space:nowrap;color:var(--kc);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--kc) 35%,transparent)}
.cl-tog{height:32px;padding-inline:13px;border:0;border-radius:999px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;color:var(--t-accent-ink);background:var(--t-card-bg);box-shadow:inset 0 0 0 1.5px rgba(196,125,142,.45),1.5px 1.5px 0 var(--cl-print)}
.cl-days{position:relative;display:grid;gap:18px;margin-top:18px}
.cl-days::before{content:"";position:absolute;top:10px;bottom:10px;inset-inline-start:7px;width:2px;border-radius:2px;background:var(--t-card-border)}
.cl-day{display:grid;grid-template-columns:118px minmax(0,1fr);align-items:start}
.cl-dl{position:relative;display:flex;flex-direction:column;padding-top:12px;padding-inline-start:28px}
.cl-dl::after{content:"";position:absolute;inset-inline-start:2px;top:15px;width:12px;height:12px;border-radius:50%;background:var(--t-card-bg);box-shadow:inset 0 0 0 2.5px #c47d8e,1.5px 1.5px 0 var(--cl-print)}
.cl-day.first .cl-dl::after{background:#c47d8e}
.cl-dl b{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:800;color:var(--t-text)}
.cl-dl small{font-size:11px;color:var(--t-text-muted)}
.cl-ents{overflow:hidden}
.cl-ent{display:flex;align-items:flex-start;gap:13px;padding:14px 18px;border-top:1px solid var(--t-card-border)}
.cl-ent:first-child{border-top:0}
.cl-ent .ic-tile{margin-top:1px}
.cl-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.cl-kd{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--kc)}
.cl-tx b{font-size:15px;font-weight:700;line-height:1.35;color:var(--t-text)}
.cl-tx span{font-size:13.5px;line-height:1.55;color:var(--t-text-soft)}
.cl-empty{margin:30px 0 0;font-size:14.5px;color:var(--t-text-muted)}
.cl-wa{position:relative;overflow:hidden;isolation:isolate;display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:36px;padding:22px 24px;border-radius:22px;color:#fff;text-decoration:none;transition:transform .2s;background:radial-gradient(85% 120% at 100% 0%,rgba(90,255,170,.45),transparent 62%),linear-gradient(155deg,#0b5641 0%,#128c7e 50%,#1db75d 100%);box-shadow:4px 4px 0 #0c5440}
.dark .cl-wa{box-shadow:4px 4px 0 #1d6b53}
.cl-wa:hover{transform:translateY(-2px)}
.cl-wa:focus-visible{outline:2px solid var(--t-accent);outline-offset:3px}
.cl-wa .p{height:42px;display:inline-flex;align-items:center;padding-inline:20px;border-radius:999px;font-size:14px;font-weight:700;white-space:nowrap;color:#0b3d2e;background:#fff;box-shadow:2.5px 2.5px 0 rgba(0,0,0,.25)}
.cl-wa::before{content:"";position:absolute;inset:-96px 0 0 -96px;z-index:-1;background-image:var(--cl-wpat);background-size:96px 96px;opacity:.13;animation:clDrift 36s linear infinite}
@keyframes clDrift{to{transform:translate(96px,96px)}}
.cl-wa .g{width:44px;height:44px;flex-shrink:0;display:grid;place-items:center;border-radius:14px;background:rgba(255,255,255,.18);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3),2px 2px 0 rgba(0,0,0,.16)}
.cl-wa .tx{flex:1;min-width:14em}
.cl-wa .tx b{display:block;font-size:17px;font-weight:750}
.cl-wa .tx span{display:block;margin-top:3px;font-size:13.5px;opacity:.92}
@media (max-width:767px){
  .cl-in{padding:32px 16px 48px}
  .cl-latest{width:100%}
  .cl-mh h2{font-size:25px}
  .cl-mix{order:3;width:100%;margin-inline-start:0}
  .cl-day{grid-template-columns:1fr;gap:8px}
  .cl-dl{flex-direction:row;align-items:baseline;gap:8px;padding-top:0}
  .cl-dl::after{top:3px}
  .cl-ents{margin-inline-start:28px}
  .cl-ent{gap:11px;padding:13px 14px}
  .cl-wa .p{flex-basis:100%;justify-content:center}
}
@media (prefers-reduced-motion:reduce){.cl-wa::before{animation:none}.cl-wa{transition:none}}
`;
const PAT_WA = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12h22a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H19l-6 5v-5h-3a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z"/><path d="M56 24l4 4 8-9M63 24l4 4 8-9"/><circle cx="74" cy="68" r="6"/><path d="M48 44l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/><path d="M12 70h18M12 76h12"/></svg>')}")`;

function ChangelogInner({ entries }) {
  const tr = useT();
  const loc = useLocale();
  const { dark, t } = useTheme();
  const [kind, setKind] = useState('all');
  const [open, setOpen] = useState(null);

  // Dates in the reader's language, from the locale the page rendered with, so
  // the server and the browser print the same month.
  const fmt = useMemo(() => {
    const l = dateLocale(loc?.lang);
    const month = new Intl.DateTimeFormat(l, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const day = new Intl.DateTimeFormat(l, { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const weekday = new Intl.DateTimeFormat(l, { weekday: 'long', timeZone: 'UTC' });
    const full = new Intl.DateTimeFormat(l, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const at = d => new Date(`${d}T12:00:00Z`);
    return { month: d => month.format(at(d)), day: d => day.format(at(d)), weekday: d => weekday.format(at(d)), full: d => full.format(at(d)) };
  }, [loc?.lang]);

  const counts = useMemo(() => {
    const c = { all: entries.length, new: 0, improved: 0, fixed: 0 };
    for (const e of entries) c[kindOf(e)] += 1;
    return c;
  }, [entries]);

  const months = useMemo(() => {
    const out = [];
    for (const e of entries) {
      if (kind !== 'all' && kindOf(e) !== kind) continue;
      const key = e.date.slice(0, 7);
      let m = out.find(x => x.key === key);
      if (!m) { m = { key, items: [], days: [] }; out.push(m); }
      m.items.push(e);
      let d = m.days.find(x => x.date === e.date);
      if (!d) { d = { date: e.date, items: [] }; m.days.push(d); }
      d.items.push(e);
    }
    return out;
  }, [entries, kind]);

  // Which months are open: the newest two of the whole list unless the reader
  // has opened or folded one. Keyed by month, so a filter keeps the choice.
  const allKeys = useMemo(() => [...new Set(entries.map(e => e.date.slice(0, 7)))], [entries]);
  const isOpen = key => (open ? open.has(key) : allKeys.indexOf(key) < OPEN_MONTHS);
  const toggle = key => setOpen(prev => {
    const next = new Set(prev || allKeys.slice(0, OPEN_MONTHS));
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const [waLink, setWaLink] = useState(null);
  useEffect(() => {
    fetch('/api/settings').then(r => r.ok ? r.json() : {}).then(d => {
      const num = d?.settings?.social_whatsapp_support;
      if (num) setWaLink(`https://wa.me/${num.replace(/\D/g, '')}`);
    }).catch(() => {});
  }, []);

  const tone = pair => (dark ? pair[1] : pair[0]);
  const latest = entries[0];
  const latestCount = latest ? entries.filter(e => e.date === latest.date).length : 0;
  const oldest = entries[entries.length - 1];
  const vars = { background: t.bg, color: t.text, '--cl-print': dark ? '#6b3a4a' : '#efc4cf', '--cl-wpat': PAT_WA };

  return (
    <div className="min-h-dvh flex flex-col" style={vars}>
      <style>{CL_CSS}</style>
      <SharedStyles />
      <SharedNav />
      <main className="cl flex-1 w-full">
        <div className="cl-glow" style={{ background: dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.18)' }} />
        <div className="cl-in">
          <header className="cl-head">
            <div>
              <span className="cl-eb">{tr("What’s new")}</span>
              <h1 className="serif">{tr("What changed on Nitro")}</h1>
              <p>{tr("Everything we ship that you would notice, newest first.")}{oldest ? <> <span className="m">{entries.length}</span> {entries.length === 1 ? tr("entry since") : tr("entries since")} {fmt.month(oldest.date)}.</> : null}</p>
            </div>
            {latest && (
              <div className="cl-card cl-latest">
                <span className="ic-tile" style={{ width: 30, height: 30, borderRadius: 9 }}><OffsetIcon name="calendar" size={16} /></span>
                <div><small>{tr("Latest update")}</small><b>{fmt.full(latest.date)}, {latestCount} {latestCount === 1 ? tr("change") : tr("changes")}</b></div>
              </div>
            )}
          </header>

          <div className="cl-tabs" role="group" aria-label={tr("Show")}>
            {[['all', msg('All')], ...KINDS].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={`cl-tab${kind === k ? ' on' : ''}`}>
                {tr(label)}<span className="c">{counts[k]}</span>
              </button>
            ))}
          </div>

          {months.length === 0 && <p className="cl-empty">{tr("Nothing to show here yet.")}</p>}

          {months.map(m => {
            const on = isOpen(m.key);
            const mix = KINDS.map(([k]) => [k, m.items.filter(e => kindOf(e) === k).length]).filter(([, n]) => n);
            return (
              <section key={m.key} className="cl-month" aria-label={fmt.month(m.days[0].date)}>
                <div className="cl-mh">
                  <h2 className="serif">{fmt.month(m.days[0].date)}</h2>
                  <span className="pbadge tag">{m.items.length} {m.items.length === 1 ? tr("change") : tr("changes")}</span>
                  <span className="cl-mix">{mix.map(([k, n]) => <span key={k} className="cl-k" style={{ '--kc': tone(KIND[k].tone) }}>{tr(KIND[k].label)} {n}</span>)}</span>
                  <button type="button" className="cl-tog" onClick={() => toggle(m.key)} aria-expanded={on}>{on ? tr("Fold") : tr("Show")}</button>
                </div>
                {on && (
                  <div className="cl-days">
                    {m.days.map((d, di) => (
                      <div key={d.date} className={`cl-day${di === 0 && m.key === months[0].key ? ' first' : ''}`}>
                        <div className="cl-dl"><b>{fmt.day(d.date)}</b><small>{fmt.weekday(d.date)}</small></div>
                        <div className="cl-card cl-ents">
                          {d.items.map((e, i) => {
                            const k = KIND[kindOf(e)];
                            return (
                              <article key={e.id || `${e.date}-${i}`} className="cl-ent">
                                <span className="ic-tile tc" style={{ width: 32, height: 32, '--tc': tone(k.tone) }}><OffsetIcon name={k.icon} size={15} /></span>
                                <span className="cl-tx"><span className="cl-kd" style={{ '--kc': tone(k.tone) }}>{tr(k.label)}</span><b>{e.title}</b><span>{e.description}</span></span>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {/* The live WhatsApp card the Blog ends on, so the two read alike. */}
          <a className="cl-wa" href={waLink || '/contact'} target={waLink ? '_blank' : undefined} rel={waLink ? 'noopener noreferrer' : undefined}>
            <span className="g"><OffsetIcon name="chat" size={20} /></span>
            <span className="tx"><b>{tr("Want something we have not built?")}</b><span>{tr("Tell us on WhatsApp. Half of this list started as a message.")}</span></span>
            <span className="p">{tr("WhatsApp us")}</span>
          </a>
        </div>
      </main>
      <SharedFooter />
    </div>
  );
}
