'use client';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter } from './shared-nav';
import { md, fD, readTime } from '@/lib/markdown';

export default function BlogPost({ post }) {
  return <ThemeProvider><BlogPostInner post={post} /></ThemeProvider>;
}

function BlogPostInner({ post }) {
  const { dark, t } = useTheme();
  const rt = readTime(post.content);
  const ini = (post.authorName || "Nitro Team").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const catBg = dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.08)";
  const bodyColor = dark ? "#bbb" : "#333";
  const metaColor = dark ? "#666" : "#999";
  const thumbBg = dark ? "#111" : "#eee";

  return (
    <div className="min-h-screen" style={{ background: t.bg, fontFamily: "'Outfit',sans-serif" }}>
      <SharedNav action="back" />
      <article className="max-w-[680px] mx-auto" style={{ padding: "clamp(24px,4vw,40px) clamp(16px,3vw,24px) 48px" }}>
        <a href="/blog" className="inline-block text-[13px] no-underline mb-7" style={{ color: t.accent }}>{"\u2190"} All posts</a>
        <div className="inline-block py-[3px] px-2.5 rounded text-[11px] font-semibold uppercase tracking-[1px] mb-4" style={{ background: catBg, color: t.accent }}>{post.category}</div>
        <h1 className="font-semibold leading-[1.2] mb-4" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(24px,5vw,34px)", color: t.text }}>{post.title}</h1>
        <div className="flex items-center gap-3 mb-8 pb-6" style={{ borderBottom: "1px solid " + t.surfaceBrd }}>
          <div className="w-8 h-8 rounded-full bg-[linear-gradient(135deg,#c47d8e,#8b5e6b)] flex items-center justify-center text-[13px] font-semibold text-white shrink-0">{ini}</div>
          <div>
            <div className="text-sm font-medium" style={{ color: t.text }}>{post.authorName || "Nitro Team"}</div>
            <div className="text-xs" style={{ color: metaColor }}>{fD(post.createdAt)} {"\u00B7"} {rt} min read {"\u00B7"} {post.views || 0} views</div>
          </div>
        </div>
        {post.thumbnail && <div className="rounded-xl bg-cover bg-center mb-8" style={{ height: "clamp(180px,25vw,300px)", backgroundImage: "url(" + post.thumbnail + ")", backgroundColor: thumbBg }} />}
        <div className="blog-article-body" data-theme={dark ? 'dark' : 'light'} style={{ color: bodyColor }} dangerouslySetInnerHTML={{ __html: md(post.content) }} />
        <div className="h-px my-8" style={{ background: t.surfaceBrd }} />
        <a href="/blog" className="inline-block py-2.5 px-5 rounded-lg text-sm no-underline" style={{ border: "1px solid " + t.surfaceBrd, color: t.muted }}>{"\u2190"} Back to all posts</a>
      </article>
      <SharedFooter />
    </div>
  );
}
