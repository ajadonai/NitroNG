'use client';
import { useState, useEffect, useRef } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter } from './shared-nav';
import { fD, readTime } from '@/lib/markdown';
import { Avatar } from "./avatar";
import { copyText } from '@/lib/clipboard';

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
  const copy = () => { copyText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); };
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

  // One product card inside the text, after the first section, about the platform the piece is about.
  const PLATFORMS = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['facebook', 'Facebook'], ['telegram', 'Telegram'], ['spotify', 'Spotify'], ['twitter', 'X'], [' x ', 'X']];
  const hay = ` ${post.title} ${post.excerpt || ''} `.toLowerCase();
  const platform = (PLATFORMS.find(([k]) => hay.includes(k)) || [])[1];
  const ctaHtml = `<aside class="rd-cta"><span class="rd-ctat"><b>${platform ? `Growing on ${platform}?` : 'Growing an audience?'}</b><i>Followers, likes and views from ₦100, sent gradually. We never ask for a password.</i></span><a class="rd-ctab" href="/signup">Start with a free account</a></aside>`;
  const parts = (post.content || '').split(/(?=<h2[\s>])/i);
  const body = parts.length > 2 ? [parts[0], parts[1], ctaHtml, ...parts.slice(2)].join('') : post.content;

  const vars = {
    "--rbg": t.bg || (dark ? "#080b14" : "#f4f1ed"), "--rtx": t.text, "--rsoft": t.soft || t.textSoft || (dark ? "#a09b95" : "#555250"), "--rmut": t.muted || t.textMuted || (dark ? "#8a8580" : "#757170"),
    "--rcard": dark ? "#111528" : "#ffffff", "--rline": dark ? "rgba(255,255,255,.12)" : "rgba(28,27,25,.11)", "--rac": "#c47d8e",
  };
  return (
    <div className="rd min-h-screen relative" style={{ ...vars, background: "var(--rbg)", color: "var(--rtx)" }}>
      <style>{RD_CSS}</style>
      <SharedNav action="back" />
      <div className="fixed top-0 left-0 right-0 h-[3px] z-[120] pointer-events-none"><div className="h-full" style={{ width: `${pct}%`, background: "var(--rac)", transition: "width .1s linear" }} /></div>

      <div className="rd-wrap">
        <div className="rd-hero">
          <span className="rd-eye">{post.category} · {rt} min read</span>
          <h1 className="rd-h1">{post.title}</h1>
          {post.excerpt && <p className="rd-lede">{post.excerpt}</p>}
          <div className="rd-by">
            <Avatar size={34} />
            <span className="rd-byt"><b>{post.authorName || "Nitro Team"}</b><i>{fD(post.createdAt)}{post.views >= 100 ? ` · ${post.views.toLocaleString()} reads` : ""}</i></span>
            <span className="rd-share"><ShareButtons post={post} dark={dark} size={32} /></span>
          </div>
        </div>

        {post.thumbnail && <div className="rd-art" style={{ backgroundImage: `url(${post.thumbnail})` }} />}

        <div className="rd-cols">
          {toc.length >= 3 ? (
            <>
              <aside className="rd-toc"><span className="rd-eye">In this article</span>{toc.map(h => <a key={h.id} href={'#' + h.id} onClick={e => jump(e, h.id)} className={active === h.id ? "on" : ""}>{h.text}</a>)}</aside>
              <details className="rd-tocph"><summary>In this article · {toc.length} parts</summary>{toc.map(h => <a key={h.id} href={'#' + h.id} onClick={e => jump(e, h.id)}>{h.text}</a>)}</details>
            </>
          ) : <span className="rd-toc empty" />}
          <article ref={articleRef} className="rd-body">
            <div className="blog-article-body" data-theme={dark ? 'dark' : 'light'} dangerouslySetInnerHTML={{ __html: body }} />
            <div className="rd-end"><span>Found this useful? Pass it on.</span><span className="rd-share"><ShareButtons post={post} dark={dark} size={32} /></span></div>
            <div className="rd-author"><Avatar size={44} /><span className="rd-byt"><b>Written by {post.authorName || "the Nitro Team"}</b><i>Research and growth notes from the team behind Nigeria's fastest content promotion platform. <a href="https://x.com/TheNitroNG" target="_blank" rel="noopener noreferrer">Follow on X</a></i></span></div>
          </article>
        </div>

        {(prev || next) && (
          <div className="rd-pn">
            {prev ? <a href={`/blog/${prev.slug}`} className="rd-pnc"><em>Previous</em><b>{prev.title}</b></a> : <span />}
            {next && <a href={`/blog/${next.slug}`} className="rd-pnc right"><em>Next</em><b>{next.title}</b></a>}
          </div>
        )}

        {related?.length > 0 && (
          <div className="rd-rel">
            <span className="rd-eye">Related articles</span>
            <div className="rd-relg">
              {related.slice(0, 3).map(r => <a key={r.slug} href={`/blog/${r.slug}`} className="rd-relc"><em>{r.category}</em><b>{r.title}</b>{r.createdAt && <i>{fD(r.createdAt)}</i>}</a>)}
            </div>
          </div>
        )}

        <a href={backHref} className="rd-back">← Back to {backLabel.toLowerCase()}</a>
      </div>
      <SharedFooter />
    </div>
  );
}

const RD_CSS = `
.rd-wrap{max-width:920px;margin:0 auto;padding:44px 28px 56px;display:flex;flex-direction:column;gap:26px}
.rd-eye{font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--rac);display:block}
.rd-hero{display:flex;flex-direction:column;gap:10px}
.rd-h1{font-family:'Cormorant Garamond',serif;font-size:clamp(34px,4.6vw,52px);font-weight:600;line-height:1.08;letter-spacing:-.01em;margin:0;text-wrap:balance;color:var(--rtx)}
.rd-lede{font-size:18px;line-height:1.55;color:var(--rsoft);margin:0;max-width:62ch}
.rd-by{display:flex;align-items:center;gap:10px;margin-top:6px;flex-wrap:wrap}.rd-byt{display:flex;flex-direction:column;min-width:0}.rd-byt b{font-size:13.5px;font-weight:600;color:var(--rtx)}.rd-byt i{font-style:normal;font-size:12px;color:var(--rmut)}.rd-byt i a{color:var(--rac);font-weight:600;text-decoration:none}
.rd-share{margin-left:auto;display:flex;gap:6px}
.rd-art{height:320px;border-radius:16px;background-size:cover;background-position:center}
.rd-cols{display:grid;grid-template-columns:220px 1fr;gap:36px;align-items:start}
.rd-toc{position:sticky;top:20px;display:flex;flex-direction:column;gap:2px}.rd-toc .rd-eye{margin-bottom:8px}.rd-toc a{font-size:13px;color:var(--rmut);padding:6px 10px;border-left:2px solid var(--rline);line-height:1.35;text-decoration:none}.rd-toc a.on{color:var(--rtx);border-left-color:var(--rac);font-weight:600}
.rd-tocph{display:none;border:1px solid var(--rline);border-radius:12px;background:var(--rcard);padding:10px 14px;font-size:13px}.rd-tocph summary{font-weight:600;cursor:pointer;list-style:none}.rd-tocph a{display:block;padding:6px 0;color:var(--rmut);border-top:1px solid var(--rline);text-decoration:none}
.rd-body{max-width:66ch;min-width:0}
.rd .blog-article-body{font-size:16.5px;line-height:1.75}
.rd-cta{display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:12px;background:var(--rcard);border:1px solid var(--rline);margin:28px 0}.rd-ctat{display:flex;flex-direction:column;min-width:0}.rd-ctat b{font-size:14.5px;font-weight:600;color:var(--rtx)}.rd-ctat i{font-style:normal;font-size:13px;color:var(--rmut);line-height:1.45}
.rd-ctab{margin-left:auto;flex-shrink:0;display:inline-flex;align-items:center;height:34px;padding:0 12px;border-radius:9px;background:var(--rac);color:#fff;font-size:12.5px;font-weight:600;text-decoration:none;white-space:nowrap}
.rd-end{display:flex;align-items:center;gap:10px;margin-top:36px;padding:14px 0;border-top:1px solid var(--rline);font-size:13px;font-weight:600;color:var(--rsoft);flex-wrap:wrap}
.rd-author{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:14px;background:var(--rcard);border:1px solid var(--rline);margin-top:10px}.rd-author .rd-byt i{line-height:1.5;margin-top:2px;white-space:normal}
.rd-pn{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rd-pnc{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border-radius:12px;background:var(--rcard);border:1px solid var(--rline);text-decoration:none}.rd-pnc.right{text-align:right}.rd-pnc em{font-style:normal;font-size:10.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--rac)}.rd-pnc b{font-size:13.5px;line-height:1.35;color:var(--rtx);font-weight:600}
.rd-rel .rd-eye{margin-bottom:10px}.rd-relg{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.rd-relc{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border-radius:12px;background:var(--rcard);border:1px solid var(--rline);text-decoration:none;transition:transform .15s}.rd-relc:hover{transform:translateY(-2px)}.rd-relc em{font-style:normal;font-size:10.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--rac)}.rd-relc b{font-size:14px;line-height:1.35;color:var(--rtx);font-weight:600}.rd-relc i{font-style:normal;font-size:12px;color:var(--rmut)}
.rd-back{font-size:13px;font-weight:600;color:var(--rac);text-decoration:none}
@media (max-width:900px){
  .rd-wrap{padding:28px 16px 40px;gap:20px}.rd-cols{grid-template-columns:1fr;gap:18px}.rd-toc{display:none}.rd-tocph{display:block}.rd-art{height:200px}
  .rd-cta{flex-direction:column;align-items:stretch}.rd-ctab{margin-left:0;justify-content:center}.rd-relg{grid-template-columns:1fr}.rd-pn{grid-template-columns:1fr}.rd-pnc.right{text-align:left}.rd-share{margin-left:0;width:100%}
}
`;
