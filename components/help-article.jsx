'use client';
import { useEffect, useRef, useState } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter } from './shared-nav';
import { readTime } from '@/lib/markdown';
import { helpTopic } from './help-listing';

const WA_FALLBACK = '2347071656156';

// Same product card the blog builds, injected after the first section of the guide.
const PLATFORMS = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['facebook', 'Facebook'], ['telegram', 'Telegram'], ['spotify', 'Spotify'], ['twitter', 'X'], [' x ', 'X']];

export default function HelpArticle({ post, related }) {
  return <ThemeProvider><HelpArticleInner post={post} related={related} /></ThemeProvider>;
}

function HelpArticleInner({ post, related }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !post.slug) return;
    sent.current = true;
    fetch('/api/blog/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: post.slug }) }).catch(() => {});
  }, [post.slug]);

  const { dark, t } = useTheme();
  const topic = helpTopic(post);
  const rt = readTime(post.content);
  const [toc, setToc] = useState([]);
  const [active, setActive] = useState('');

  const [waNum, setWaNum] = useState(WA_FALLBACK);
  useEffect(() => {
    fetch('/api/settings').then(r => (r.ok ? r.json() : {})).then(d => {
      const n = d?.settings?.social_whatsapp_support?.replace(/\D/g, '');
      if (n) setWaNum(n);
    }).catch(() => {});
  }, []);
  const waLink = `https://wa.me/${waNum}?text=${encodeURIComponent(`Hi *Nitro*, I read "${post.title}" and still need help`)}`;

  useEffect(() => {
    const hs = Array.from(document.querySelectorAll('.blog-article-body h2'));
    hs.forEach((h, i) => { if (!h.id) h.id = 'sec-' + (i + 1); h.style.scrollMarginTop = '76px'; });
    setToc(hs.map(h => ({ id: h.id, text: h.textContent })));
  }, [post.content]);

  useEffect(() => {
    const onScroll = () => {
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
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' });
    const det = e.target.closest('details');
    if (det) det.removeAttribute('open');
  };

  const hay = ` ${post.title} ${post.excerpt || ''} `.toLowerCase();
  const platform = (PLATFORMS.find(([k]) => hay.includes(k)) || [])[1];
  const ctaHtml = `<aside class="hg-cta"><span class="hg-ctat"><b>${platform ? `Growing on ${platform}?` : 'Growing an audience?'}</b><i>Followers, likes and views from ₦100, sent gradually. We never ask for a password.</i></span><a class="hg-ctab" href="/signup">Start with a free account</a></aside>`;
  const parts = (post.content || '').split(/(?=<h2[\s>])/i);
  const body = parts.length > 2 ? [parts[0], parts[1], ctaHtml, ...parts.slice(2)].join('') : post.content;

  const vars = {
    '--hgbg': t.bg || (dark ? '#080b14' : '#f4f1ed'), '--hgtx': t.text,
    '--hgsoft': t.soft || (dark ? '#a09b95' : '#555250'), '--hgmut': t.muted || (dark ? '#8a8580' : '#757170'),
    '--hgcard': dark ? '#111528' : '#ffffff', '--hgline': dark ? 'rgba(255,255,255,.12)' : 'rgba(28,27,25,.11)', '--hgac': '#c47d8e',
  };

  return (
    <div className="hg min-h-dvh flex flex-col" style={{ ...vars, background: 'var(--hgbg)', color: 'var(--hgtx)' }}>
      <style>{HG_CSS}</style>
      <SharedNav action="back" />

      <div className="hg-wrap flex-1">
        <div className="hg-crumb">
          <a href="/help">Help centre</a>
          <i aria-hidden="true">›</i>
          <span>{topic}</span>
        </div>

        <div className="hg-hero">
          <span className="hg-eye">{topic} · {rt} min read</span>
          <h1 className="hg-h1">{post.title}</h1>
          {post.excerpt && <p className="hg-lede">{post.excerpt}</p>}
        </div>

        <div className="hg-cols">
          {toc.length >= 2 ? (
            <>
              <aside className="hg-toc"><span className="hg-eye">In this guide</span>{toc.map(h => <a key={h.id} href={'#' + h.id} onClick={e => jump(e, h.id)} className={active === h.id ? 'on' : ''}>{h.text}</a>)}</aside>
              <details className="hg-tocph"><summary>In this guide · {toc.length} {toc.length === 1 ? 'section' : 'sections'}</summary>{toc.map(h => <a key={h.id} href={'#' + h.id} onClick={e => jump(e, h.id)}>{h.text}</a>)}</details>
            </>
          ) : <span className="hg-toc" />}
          <article className="hg-body">
            <div className="blog-article-body" data-theme={dark ? 'dark' : 'light'} dangerouslySetInnerHTML={{ __html: body }} />
          </article>
        </div>

        {related?.length > 0 && (
          <div className="hg-rel">
            <span className="hg-eye">Next</span>
            <div className="hg-relg">
              {related.slice(0, 3).map(r => (
                <a key={r.slug} href={`/help/${r.slug}`} className="hg-relc">
                  <b>{r.title}</b>
                  {r.excerpt && <i>{r.excerpt}</i>}
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="hg-ask">
          <span className="hg-askt"><b>Did this answer it?</b><i>If not, WhatsApp us and we will walk you through it.</i></span>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="hg-askb">WhatsApp us</a>
        </div>
      </div>
      <SharedFooter />
    </div>
  );
}

const HG_CSS = `
.hg-wrap{max-width:920px;margin:0 auto;padding:44px 28px 56px;display:flex;flex-direction:column;gap:26px;width:100%}
.hg-eye{font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--hgac);display:block}
.hg-crumb{font-size:12px;color:var(--hgmut);display:flex;gap:6px;align-items:center;flex-wrap:wrap}.hg-crumb a{color:var(--hgac);font-weight:600;text-decoration:none}.hg-crumb i{font-style:normal;opacity:.5}
.hg-hero{display:flex;flex-direction:column;gap:10px}
.hg-h1{font-family:'Cormorant Garamond',serif;font-size:clamp(34px,4.6vw,52px);font-weight:600;line-height:1.08;letter-spacing:-.01em;margin:0;text-wrap:balance;color:var(--hgtx)}
.hg-lede{font-size:18px;line-height:1.55;color:var(--hgsoft);margin:0;max-width:62ch}
.hg-cols{display:grid;grid-template-columns:220px 1fr;gap:36px;align-items:start}
.hg-toc{position:sticky;top:20px;display:flex;flex-direction:column;gap:2px}.hg-toc .hg-eye{margin-bottom:8px}.hg-toc a{font-size:13px;color:var(--hgmut);padding:6px 10px;border-left:2px solid var(--hgline);line-height:1.35;text-decoration:none}.hg-toc a.on{color:var(--hgtx);border-left-color:var(--hgac);font-weight:600}
.hg-tocph{display:none;border:1px solid var(--hgline);border-radius:12px;background:var(--hgcard);padding:10px 14px;font-size:13px}.hg-tocph summary{font-weight:600;cursor:pointer;list-style:none}.hg-tocph a{display:block;padding:6px 0;color:var(--hgmut);border-top:1px solid var(--hgline);text-decoration:none}
.hg-body{max-width:66ch;min-width:0}
.hg .blog-article-body{font-size:16.5px;line-height:1.75}
.hg-cta{display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:12px;background:var(--hgcard);border:1px solid var(--hgline);margin:28px 0}.hg-ctat{display:flex;flex-direction:column;min-width:0}.hg-ctat b{font-size:14.5px;font-weight:600;color:var(--hgtx)}.hg-ctat i{font-style:normal;font-size:13px;color:var(--hgmut);line-height:1.45}
.hg-ctab{margin-left:auto;flex-shrink:0;display:inline-flex;align-items:center;height:34px;padding:0 12px;border-radius:9px;background:var(--hgac);color:#fff;font-size:12.5px;font-weight:600;text-decoration:none;white-space:nowrap}
.hg-rel .hg-eye{margin-bottom:10px}.hg-relg{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.hg-relc{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border-radius:12px;background:var(--hgcard);border:1px solid var(--hgline);text-decoration:none;transition:transform .15s}.hg-relc:hover{transform:translateY(-2px)}.hg-relc b{font-size:14px;line-height:1.35;color:var(--hgtx);font-weight:600}.hg-relc i{font-style:normal;font-size:12px;color:var(--hgmut);line-height:1.45}
.hg-ask{display:flex;align-items:center;gap:12px;padding:16px 18px;border-radius:14px;background:var(--hgcard);border:1px solid var(--hgline)}.hg-askt{display:flex;flex-direction:column;min-width:0}.hg-askt b{font-size:15px;font-weight:600;color:var(--hgtx)}.hg-askt i{font-style:normal;font-size:13px;color:var(--hgsoft)}
.hg-askb{margin-left:auto;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;height:38px;padding:0 16px;border-radius:10px;background:var(--hgac);color:#fff;font-size:13.5px;font-weight:600;text-decoration:none;white-space:nowrap}
@media (max-width:900px){
  .hg-wrap{padding:28px 16px 40px;gap:20px}.hg-cols{grid-template-columns:1fr;gap:18px}.hg-toc{display:none}.hg-tocph{display:block}
  .hg-cta,.hg-ask{flex-direction:column;align-items:stretch}.hg-ctab,.hg-askb{margin-left:0;justify-content:center}.hg-relg{grid-template-columns:1fr}
}
`;
