'use client';
import { useState, useEffect, useRef } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter } from './shared-nav';
import { fD, readTime } from '@/lib/markdown';
import { Avatar } from "./avatar";

function useTrackView(slug) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !slug) return;
    sent.current = true;
    fetch('/api/blog/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug }) }).catch(() => {});
  }, [slug]);
}

export default function BlogPost({ post, backHref, backLabel, related, prev, next }) {
  return <ThemeProvider><BlogPostInner post={post} backHref={backHref || '/blog'} backLabel={backLabel || 'All posts'} related={related} prev={prev} next={next} /></ThemeProvider>;
}

function ShareButtons({ post, dark, size = 34 }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : `https://nitro.ng/blog/${post.slug}`;
  const text = post.title;
  const copy = () => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const linkStyle = { background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", border: `0.5px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}`, color: "#c47d8e" };
  const xStyle = { background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)", border: `0.5px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)"}`, color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.45)" };
  const waStyle = { background: dark ? "rgba(37,211,102,.08)" : "rgba(37,211,102,.05)", border: `0.5px solid ${dark ? "rgba(37,211,102,.18)" : "rgba(37,211,102,.12)"}`, color: "#25d366" };
  const copiedStyle = { background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)", color: dark ? "#6ee7b7" : "#059669", border: `0.5px solid ${dark ? "rgba(110,231,183,.2)" : "rgba(5,150,105,.15)"}` };
  const cls = "rounded-[10px] flex items-center justify-center cursor-pointer border-none transition-all duration-200 hover:-translate-y-px no-underline";
  const dim = { width: size, height: size };
  return (
    <>
      <button onClick={copy} title={copied ? "Copied!" : "Copy link"} className={cls} style={{ ...dim, ...(copied ? copiedStyle : linkStyle) }}>
        {copied
          ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>}
      </button>
      <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" title="Share on X" className={cls} style={{ ...dim, ...xStyle }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </a>
      <a href={`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`} target="_blank" rel="noopener noreferrer" title="Share on WhatsApp" className={cls} style={{ ...dim, ...waStyle }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>
    </>
  );
}

function BlogPostInner({ post, backHref, backLabel, related, prev, next }) {
  useTrackView(post.slug);
  const { dark, t } = useTheme();
  const rt = readTime(post.content);
  const [pct, setPct] = useState(0);
  const [toc, setToc] = useState([]);
  const [active, setActive] = useState('');
  const articleRef = useRef(null);

  const catBg = dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.08)";
  const bodyColor = dark ? "#bbb" : "#333";
  const metaColor = dark ? "#666" : "#999";
  const thumbBg = dark ? "#111" : "#eee";
  const chipBg = dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.05)";
  const hair = dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.07)";
  const cardBg = dark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.7)";

  // Build TOC from rendered h2s, assign anchor ids
  useEffect(() => {
    const hs = Array.from(document.querySelectorAll('.blog-article-body h2'));
    hs.forEach((h, i) => { if (!h.id) h.id = 'sec-' + (i + 1); h.style.scrollMarginTop = '76px'; });
    setToc(hs.map(h => ({ id: h.id, text: h.textContent })));
  }, [post.content]);

  // Progress + active section
  useEffect(() => {
    const onScroll = () => {
      const el = articleRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = Math.max(1, el.offsetHeight - window.innerHeight);
      const done = Math.min(1, Math.max(0, -rect.top / total));
      setPct(Math.round(done * 100));
      const hs = Array.from(document.querySelectorAll('.blog-article-body h2'));
      let cur = hs[0]?.id || '';
      hs.forEach(h => { if (h.getBoundingClientRect().top < 150) cur = h.id; });
      setActive(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [toc.length]);

  const jump = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 76;
    window.scrollTo({ top: y, behavior: 'smooth' });
    const det = e.target.closest('details');
    if (det) det.removeAttribute('open');
  };

  return (
    <div className="min-h-screen relative" style={{ background: t.bg, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <SharedNav action="back" />

      {/* Reading progress */}
      <div className="fixed top-0 left-0 right-0 h-[3px] z-[120] pointer-events-none">
        <div className="h-full rounded-r-full" style={{ width: pct + "%", background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", transition: "width .1s linear" }} />
      </div>

      {/* Desktop share rail with % read */}
      <div className="hidden lg:flex fixed flex-col gap-2 items-center z-[60]" style={{ left: "max(16px, calc((100vw - 720px) / 2 - 76px))", top: "50%", transform: "translateY(-50%)" }}>
        <div className="text-[11px] font-bold" style={{ color: "#c47d8e", fontVariantNumeric: "tabular-nums" }}>{pct}%</div>
        <div className="text-[10px] font-semibold uppercase tracking-[1px] mb-1" style={{ color: dark ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.25)" }}>Share</div>
        <ShareButtons post={post} dark={dark} />
      </div>

      {/* Desktop table of contents */}
      {toc.length >= 3 && (
        <div className="hidden min-[1240px]:block fixed w-[184px] z-[60]" style={{ right: "max(16px, calc((100vw - 720px) / 2 - 216px))", top: "50%", transform: "translateY(-50%)" }}>
          <div className="text-[10px] font-bold uppercase tracking-[1.4px] mb-2.5" style={{ color: dark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)" }}>In this piece</div>
          {toc.map(h => (
            <a key={h.id} href={'#' + h.id} onClick={e => jump(e, h.id)} className="block text-[12.5px] leading-[1.4] py-[5px] pl-3 no-underline transition-colors duration-150" style={{ borderLeft: `2px solid ${active === h.id ? "#c47d8e" : hair}`, color: active === h.id ? "#c47d8e" : (dark ? "rgba(255,255,255,.4)" : "rgba(0,0,0,.4)"), fontWeight: active === h.id ? 700 : 500 }}>{h.text}</a>
          ))}
        </div>
      )}

      <article ref={articleRef} className="max-w-[720px] mx-auto" style={{ padding: "clamp(24px,4vw,44px) clamp(16px,3vw,24px) 56px" }}>
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <a href={backHref} className="text-[13px] no-underline font-semibold" style={{ color: t.accent }}>{"←"} {backLabel}</a>
          <div className="py-[3px] px-2.5 rounded text-[11px] font-semibold uppercase tracking-[1px]" style={{ background: catBg, color: t.accent }}>{post.category}</div>
        </div>

        <h1 className="font-semibold mb-3" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(32px,5vw,52px)", lineHeight: 1.12, letterSpacing: "-0.5px", color: t.text }}>{post.title}</h1>
        {post.excerpt && <p className="mb-6" style={{ fontSize: "clamp(15px,2vw,18px)", lineHeight: 1.65, color: dark ? "rgba(244,241,237,.55)" : "rgba(28,27,25,.55)", maxWidth: 640 }}>{post.excerpt}</p>}

        <div className="flex items-center gap-3.5 pb-6 flex-wrap" style={{ borderBottom: "1px solid " + t.surfaceBrd }}>
          <Avatar size={40} />
          <div>
            <div className="text-[14.5px] font-bold" style={{ color: t.text }}>{post.authorName || "Nitro Team"}</div>
            <div className="text-xs flex items-center gap-2 flex-wrap mt-0.5" style={{ color: metaColor }}>
              {fD(post.createdAt)}
              <span className="inline-flex items-center gap-1 py-[2px] px-2 rounded-full text-[11px] font-semibold" style={{ background: chipBg, color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.5)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>{rt} min read
              </span>
              {post.views >= 100 && <span className="inline-flex items-center gap-1 py-[2px] px-2 rounded-full text-[11px] font-semibold" style={{ background: chipBg, color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.5)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>{post.views.toLocaleString()} views
              </span>}
            </div>
          </div>
        </div>

        {/* Mobile share */}
        <div className="flex lg:hidden gap-2 mt-4">
          <ShareButtons post={post} dark={dark} size={32} />
        </div>

        {/* Hero art */}
        {post.thumbnail && (
          <div className="rounded-2xl bg-cover bg-center mt-6 mb-8" style={{ aspectRatio: "16/8.2", backgroundImage: "url(" + post.thumbnail + ")", backgroundColor: thumbBg, boxShadow: dark ? "0 14px 40px rgba(0,0,0,.4)" : "0 14px 40px rgba(28,27,25,.1)" }} />
        )}
        {!post.thumbnail && <div className="mt-2 mb-6" />}

        {/* Mobile / narrow TOC */}
        {toc.length >= 3 && (
          <details className="min-[1240px]:hidden mb-6 rounded-xl overflow-hidden" style={{ background: cardBg, border: "1px solid " + hair }}>
            <summary className="list-none cursor-pointer px-4 py-3 text-[13px] font-bold flex items-center justify-between" style={{ color: t.text }}>
              In this piece
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </summary>
            {toc.map(h => (
              <a key={h.id} href={'#' + h.id} onClick={e => jump(e, h.id)} className="block px-4 py-2 text-[13px] no-underline" style={{ color: dark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.55)", borderTop: "1px solid " + hair }}>{h.text}</a>
            ))}
          </details>
        )}

        <div className="blog-article-body" data-theme={dark ? 'dark' : 'light'} style={{ color: bodyColor }} dangerouslySetInnerHTML={{ __html: post.content }} />

        {/* End share */}
        <div className="flex items-center gap-2.5 mt-10 py-4 flex-wrap" style={{ borderTop: "1px solid " + t.surfaceBrd, borderBottom: "1px solid " + t.surfaceBrd }}>
          <span className="text-[13px] font-bold mr-auto" style={{ color: t.text }}>Found this useful? Pass it on.</span>
          <ShareButtons post={post} dark={dark} size={32} />
        </div>

        {/* Author card */}
        <div className="flex items-center gap-4 mt-7 p-5 rounded-2xl" style={{ background: cardBg, border: "1px solid " + hair }}>
          <Avatar size={48} />
          <div>
            <div className="text-[15px] font-bold" style={{ color: t.text }}>Written by {post.authorName || "the Nitro Team"}</div>
            <div className="text-[13px] leading-[1.6] mt-0.5" style={{ color: dark ? "rgba(244,241,237,.5)" : "rgba(28,27,25,.5)" }}>
              Research and growth notes from the team behind Nigeria's fastest content promotion platform.{" "}
              <a href="https://x.com/TheNitroNG" target="_blank" rel="noopener noreferrer" className="no-underline font-bold" style={{ color: t.accent }}>Follow on X {"→"}</a>
            </div>
          </div>
        </div>

        {/* Conversion CTA */}
        <div className="relative overflow-hidden text-center mt-7 rounded-[18px] px-7 py-8" style={{ background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff" }}>
          <div className="absolute rounded-full pointer-events-none" style={{ width: 280, height: 280, left: -90, bottom: -140, background: "rgba(255,255,255,.12)", filter: "blur(40px)" }} />
          <div className="absolute rounded-full pointer-events-none" style={{ width: 230, height: 230, right: -70, top: -110, background: "rgba(255,255,255,.1)", filter: "blur(36px)" }} />
          <div className="relative inline-flex mb-3.5 py-[5px] px-3 rounded-full text-[11.5px] font-bold" style={{ background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.25)" }}>{"🎁"} Up to {"₦"}3,000 free promo credit to start</div>
          <div className="relative font-semibold mb-1.5" style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", fontSize: 30 }}>Put this to work.</div>
          <p className="relative text-[14px] mb-4.5" style={{ opacity: .92, marginBottom: 18 }}>Consistent, affordable momentum wins. That{"’"}s the product.</p>
          <a href="/signup" className="relative inline-block py-3 px-8 rounded-xl text-[14px] font-extrabold no-underline transition-transform duration-150 hover:-translate-y-0.5" style={{ background: "#fff", color: "#8b4a5e" }}>Create free account</a>
        </div>

        {/* Prev / next */}
        {(prev || next) && (
          <div className="grid grid-cols-2 max-[599px]:grid-cols-1 gap-3 mt-7">
            {prev ? (
              <a href={`/blog/${prev.slug}`} className="p-4 rounded-[14px] no-underline transition-transform duration-150 hover:-translate-y-0.5" style={{ background: cardBg, border: "1px solid " + hair }}>
                <div className="text-[10.5px] font-extrabold uppercase tracking-[1px] mb-1.5" style={{ color: dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.35)" }}>{"←"} Previous</div>
                <div className="text-[13.5px] font-bold leading-[1.4]" style={{ color: t.text }}>{prev.title}</div>
              </a>
            ) : <span />}
            {next && (
              <a href={`/blog/${next.slug}`} className="p-4 rounded-[14px] no-underline text-right transition-transform duration-150 hover:-translate-y-0.5" style={{ background: cardBg, border: "1px solid " + hair }}>
                <div className="text-[10.5px] font-extrabold uppercase tracking-[1px] mb-1.5" style={{ color: dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.35)" }}>Next {"→"}</div>
                <div className="text-[13.5px] font-bold leading-[1.4]" style={{ color: t.text }}>{next.title}</div>
              </a>
            )}
          </div>
        )}

        {/* Related */}
        {related?.length > 0 && (
          <div className="mt-9 mb-2">
            <h2 className="text-lg font-semibold mb-4" style={{ color: t.text }}>Related articles</h2>
            <div className="grid grid-cols-2 max-[599px]:grid-cols-1 gap-4">
              {related.map(r => (
                <a key={r.slug} href={`/blog/${r.slug}`} className="no-underline group">
                  <div className="rounded-xl overflow-hidden flex flex-col h-full transition-[box-shadow,transform] duration-200 group-hover:shadow-[0_6px_20px_rgba(0,0,0,.1)] group-hover:-translate-y-0.5" style={{ background: cardBg, border: "1px solid " + hair }}>
                    {r.thumbnail ? (
                      <div className="h-28 shrink-0" style={{ background: `url(${r.thumbnail}) center/cover no-repeat ${thumbBg}` }} />
                    ) : (
                      <div className="h-28 shrink-0" style={{ background: dark ? 'linear-gradient(135deg, #2a1a22, #1a1225)' : 'linear-gradient(135deg, #e8d5db, #d4a8b5)' }} />
                    )}
                    <div className="p-3.5 flex flex-col flex-1 gap-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.8px]" style={{ color: t.accent }}>{r.category}</div>
                      <div className="text-[13px] font-semibold leading-[1.35] line-clamp-2 flex-1" style={{ color: t.text }}>{r.title}</div>
                      {r.createdAt && <div className="text-[11px]" style={{ color: metaColor }}>{fD(r.createdAt)}</div>}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        <a href={backHref} className="inline-block mt-6 py-2.5 px-5 rounded-lg text-sm no-underline" style={{ border: "1px solid " + t.surfaceBrd, color: t.muted }}>{"←"} Back to {backLabel.toLowerCase()}</a>
      </article>
      <SharedFooter />
    </div>
  );
}
