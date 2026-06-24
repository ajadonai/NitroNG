'use client';
import { useState, useEffect } from 'react';

const PAGE_SIZE = 15;

export default function ChangelogPage() {
  const [dark, setDark] = useState(false);
  const [nav, setNav] = useState({ href: '/', label: 'Back to Home' });
  const [entries, setEntries] = useState([]);
  const [showCount, setShowCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try { setDark(localStorage.getItem('nitro-theme') === 'dark'); } catch {}
  }, []);

  const toggleTheme = () => {
    setDark(d => {
      const next = !d;
      try { next ? localStorage.setItem('nitro-theme', 'dark') : localStorage.removeItem('nitro-theme'); } catch {}
      return next;
    });
  };

  useEffect(() => {
    try {
      const c = document.cookie || '';
      if (c.includes('crew_token') || c.includes('nitro_token')) {
        setNav({ href: '/m', label: 'Back to Dashboard' });
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetch('/api/changelog').then(r => r.json()).then(data => { setEntries(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const t = {
    bg: dark ? '#090c15' : '#f0ede8',
    text: dark ? '#f5f3f0' : '#1c1b19',
    textSoft: dark ? '#a09b95' : '#555250',
    textMuted: dark ? '#8a8580' : '#757170',
    cardBg: dark ? 'rgba(255,255,255,.05)' : '#ffffff',
    cardBorder: dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)',
    hair: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)',
    accent: '#c47d8e',
  };

  const TAGS = {
    new: { label: 'New', c: dark ? '#e8acba' : '#a3586b' },
    improved: { label: 'Improved', c: dark ? '#93c5fd' : '#2563eb' },
    fixed: { label: 'Fixed', c: dark ? '#6ee7b7' : '#059669' },
  };

  const visible = entries.slice(0, showCount);
  const hasMore = showCount < entries.length;

  const groups = [];
  for (const e of visible) {
    const label = new Date(e.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    let g = groups.find(x => x.label === label);
    if (!g) { g = { label, items: [] }; groups.push(g); }
    g.items.push(e);
  }
  const dayLabel = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'Outfit', system-ui, sans-serif", position: 'relative', overflowX: 'hidden', transition: 'background .35s, color .35s' }}>
      <style>{`
        .cl-glow{position:absolute;top:0;left:0;right:0;height:420px;pointer-events:none;z-index:0}
        .cl-wrap{max-width:740px;margin:0 auto;padding:30px 28px 96px;position:relative;z-index:1}
        .cl-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:54px}
        .cl-back{display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:500;text-decoration:none;transition:opacity .15s}
        .cl-back:hover{opacity:.6}
        .cl-back svg{width:16px;height:16px}
        .cl-toggle{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;cursor:pointer;transition:.15s}
        .cl-toggle:hover{transform:translateY(-1px)}
        .cl-toggle svg{width:17px;height:17px}
        .cl-kicker{display:inline-flex;align-items:center;gap:9px;margin-bottom:20px}
        .cl-mk{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:linear-gradient(135deg,#c47d8e,#8b5e6b)}
        .cl-klbl{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase}
        .cl-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:66px;font-weight:600;line-height:.98;letter-spacing:-1px;margin:0 0 16px}
        .cl-lede{font-size:17px;line-height:1.6;max-width:480px;margin:0}
        .cl-rule{height:1px;margin:40px 0 8px}
        .cl-tl{position:relative;padding-left:34px}
        .cl-rail{position:absolute;left:5px;top:6px;bottom:14px;width:1px}
        .cl-month{position:relative;font-family:'Cormorant Garamond',Georgia,serif;font-size:25px;font-weight:600;letter-spacing:-.3px;margin:34px 0 6px}
        .cl-month:first-of-type{margin-top:8px}
        .cl-month .yr{font-style:italic;font-weight:500;opacity:.5;margin-left:6px}
        .cl-mmk{position:absolute;left:-34px;top:50%;transform:translateY(-50%);width:13px;height:13px;border-radius:50%;border:1.5px solid #c47d8e}
        .cl-entry{position:relative;padding:18px 0}
        .cl-entry + .cl-entry{border-top:1px solid var(--cl-hair)}
        .cl-dot{position:absolute;left:-34px;top:24px;width:11px;height:11px;border-radius:50%}
        .cl-meta{display:flex;align-items:center;gap:9px;margin-bottom:8px;font-size:12.5px}
        .cl-tag{font-weight:600;letter-spacing:.2px}
        .cl-sep{width:3px;height:3px;border-radius:50%;opacity:.5}
        .cl-date{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500}
        .cl-title{font-size:17.5px;font-weight:600;line-height:1.35;margin:0 0 6px;letter-spacing:-.1px}
        .cl-desc{font-size:15px;line-height:1.62;margin:0;max-width:560px}
        .cl-more{display:flex;align-items:center;justify-content:center;gap:8px;margin:32px auto 0;padding:10px 24px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;transition:.15s}
        .cl-more:hover{transform:translateY(-1px)}
        .cl-loading{text-align:center;padding:60px 0;font-size:15px}
        @media(max-width:640px){
          .cl-wrap{padding:24px 20px 72px}
          .cl-top{margin-bottom:38px}
          .cl-h1{font-size:46px}
          .cl-lede{font-size:15.5px}
          .cl-tl{padding-left:28px}
          .cl-rail{left:4px}
          .cl-mmk{left:-28px}
          .cl-dot{left:-28px}
        }
      `}</style>

      <div className="cl-glow" style={{ background: `radial-gradient(620px 300px at 28% -8%, rgba(196,125,142,${dark ? '.14' : '.16'}), transparent 70%)` }} />

      <div className="cl-wrap" style={{ '--cl-hair': t.hair }}>
        <div className="cl-top">
          <a href={nav.href} className="cl-back" style={{ color: t.textSoft }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            {nav.label}
          </a>
          <button onClick={toggleTheme} className="cl-toggle" aria-label="Toggle theme" style={{ background: t.cardBg, border: `1px solid ${t.cardBorder}`, color: t.textSoft }}>
            {dark
              ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>}
          </button>
        </div>

        <header>
          <span className="cl-kicker">
            <span className="cl-mk">
              <svg width="13" height="15" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z" /></svg>
            </span>
            <span className="cl-klbl" style={{ color: t.textMuted }}>Product Updates</span>
          </span>
          <h1 className="cl-h1">Changelog<span style={{ color: t.accent }}>.</span></h1>
          <p className="cl-lede" style={{ color: t.textSoft }}>Every feature, improvement, and fix we ship to help your content reach further.</p>
          <div className="cl-rule" style={{ background: t.hair }} />
        </header>

        {loading ? (
          <div className="cl-loading" style={{ color: t.textMuted }}>Loading...</div>
        ) : (
          <>
            <div className="cl-tl">
              <div className="cl-rail" style={{ background: t.hair }} />
              {groups.map(group => {
                const [mo, yr] = group.label.split(' ');
                return (
                  <div key={group.label}>
                    <div className="cl-month" style={{ color: t.text }}>
                      <span className="cl-mmk" style={{ background: t.bg }} />
                      {mo}<span className="yr">{yr}</span>
                    </div>
                    {group.items.map((entry, i) => {
                      const tag = TAGS[entry.tag] || TAGS.new;
                      return (
                        <article key={entry.id || entry.date + i} className="cl-entry">
                          <span className="cl-dot" style={{ background: tag.c, boxShadow: `0 0 0 4px ${t.bg}` }} />
                          <div className="cl-meta">
                            <span className="cl-tag" style={{ color: tag.c }}>{tag.label}</span>
                            <span className="cl-sep" style={{ background: t.textMuted }} />
                            <span className="cl-date" style={{ color: t.textMuted }}>{dayLabel(entry.date)}</span>
                          </div>
                          <h3 className="cl-title" style={{ color: t.text }}>{entry.title}</h3>
                          <p className="cl-desc" style={{ color: t.textSoft }}>{entry.description}</p>
                        </article>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <button onClick={() => setShowCount(c => c + PAGE_SIZE)} className="cl-more" style={{ background: dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.08)', border: `1px solid ${dark ? 'rgba(196,125,142,.25)' : 'rgba(196,125,142,.2)'}`, color: t.accent }}>
                Show older updates
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
