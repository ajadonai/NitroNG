'use client';
import { useState, useEffect } from 'react';
import { FAQ_GROUPS } from "@/lib/faq-data";
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';



const TOPICS = ["All", ...FAQ_GROUPS.map(([g]) => g)];
const ACCENT = "#c47d8e";
const WA_FALLBACK = "2347071656156";

export default function FAQ() {
  return <ThemeProvider><FAQInner /></ThemeProvider>;
}

function FAQInner() {
  const { t } = useTheme();
  const [open, setOpen] = useState(FAQ_GROUPS[0][1][0][0]);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("All");
  const [waNum, setWaNum] = useState(WA_FALLBACK);

  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : {}).then(d => {
      const n = d.settings?.social_whatsapp_support?.replace(/\D/g, "");
      if (n) setWaNum(n);
    }).catch(() => {});
  }, []);

  const q = query.trim().toLowerCase();
  const groups = FAQ_GROUPS
    .filter(([g]) => topic === "All" || g === topic)
    .map(([g, qs]) => [g, q ? qs.filter(([a, b]) => a.toLowerCase().includes(q) || b.toLowerCase().includes(q)) : qs])
    .filter(([, qs]) => qs.length);

  const line = t.surfaceBrd;
  const eyebrow = "text-[10.5px] font-bold tracking-[1.6px] uppercase block";
  const waLink = `https://wa.me/${waNum}?text=${encodeURIComponent("Hi *Nitro*, I need help")}`;

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav />
        <main className="flex-1 w-full max-w-[920px] mx-auto px-7 pt-11 pb-14 max-md:px-4 max-md:pt-7 max-md:pb-10 flex flex-col gap-[26px] max-md:gap-5">

          <div className="flex flex-col gap-2.5">
            <span className={eyebrow} style={{ color: ACCENT }}>Help</span>
            <h1 className="serif font-semibold m-0 text-[clamp(34px,4.6vw,52px)] leading-[1.08] tracking-[-0.01em] text-balance" style={{ color: t.text }}>Questions, answered</h1>
            <p className="text-[13.5px] m-0" style={{ color: t.textMuted }}>The things people ask before their first order, and after it.</p>
          </div>

          <div className="flex flex-col gap-3">
            <label className="h-[46px] rounded-xl flex items-center gap-2.5 px-4" style={{ background: t.cardBg, border: `1px solid ${line}` }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search the questions"
                aria-label="Search the questions"
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm"
                style={{ color: t.text }}
              />
            </label>
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Topics">
              {TOPICS.map(name => {
                const on = topic === name;
                return (
                  <button
                    key={name}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setTopic(name)}
                    className="text-[12.5px] font-semibold py-2 px-3 rounded-full cursor-pointer max-md:flex-1 text-center whitespace-nowrap"
                    style={on
                      ? { background: t.text, color: t.bg, border: `1px solid ${t.text}` }
                      : { background: t.cardBg, color: t.textMuted, border: `1px solid ${line}` }}
                  >{name}</button>
                );
              })}
            </div>
          </div>

          {groups.length === 0 && (
            <p className="text-sm m-0" style={{ color: t.textMuted }}>Nothing matches that. Try another word, or ask us on WhatsApp below.</p>
          )}

          {groups.map(([g, qs]) => (
            <section key={g}>
              <span className={`${eyebrow} mb-2`} style={{ color: ACCENT }}>{g}</span>
              <div className="rounded-[14px] overflow-hidden" style={{ background: t.cardBg, border: `1px solid ${line}` }}>
                {qs.map(([question, answer], i) => {
                  const isOpen = open === question;
                  return (
                    <div key={question} style={{ borderTop: i ? `1px solid ${line}` : undefined }}>
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : question)}
                        aria-expanded={isOpen}
                        className="w-full flex justify-between items-center gap-2.5 py-3.5 px-[18px] bg-transparent border-none cursor-pointer text-left"
                      >
                        <span className="text-[15px] font-semibold transition-colors duration-200" style={{ color: isOpen ? ACCENT : t.text }}>{question}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isOpen ? ACCENT : t.textMuted} strokeWidth="2" strokeLinecap="round" className="shrink-0" aria-hidden="true">
                          <path d="M5 12h14" />
                          {!isOpen && <path d="M12 5v14" />}
                        </svg>
                      </button>
                      {isOpen && (
                        <p className="text-[14.5px] leading-[1.65] max-w-[66ch] m-0 px-[18px] pb-3.5" style={{ color: t.textSoft }}>{answer}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <div className="flex items-center gap-3 px-[18px] py-4 rounded-[14px] max-md:flex-col max-md:items-stretch" style={{ background: t.cardBg, border: `1px solid ${line}` }}>
            <div className="flex flex-col min-w-0">
              <span className="text-[15px] font-semibold" style={{ color: t.text }}>Still stuck?</span>
              <span className="text-[13px]" style={{ color: t.textMuted }}>WhatsApp us, we are there all day.</span>
            </div>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto max-md:ml-0 h-[38px] px-4 rounded-[9px] inline-flex items-center justify-center text-[13px] font-semibold text-white no-underline whitespace-nowrap transition-transform duration-150 hover:-translate-y-px"
              style={{ background: ACCENT }}
            >WhatsApp us</a>
          </div>

        </main>
        <SharedFooter />
      </div>
    </>
  );
}
