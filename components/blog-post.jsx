'use client';
import { useState } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter } from './shared-nav';
import { md, fD, readTime } from '@/lib/markdown';
import { Avatar } from "./avatar";

export default function BlogPost({ post }) {
  return <ThemeProvider><BlogPostInner post={post} /></ThemeProvider>;
}

function ShareBar({ post, dark, t }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : `https://nitro.ng/blog/${post.slug}`;
  const text = post.title;
  const copy = () => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const linkStyle = { background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", border: `0.5px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}`, color: "#c47d8e" };
  const xStyle = { background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)", border: `0.5px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)"}`, color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.45)" };
  const waStyle = { background: dark ? "rgba(37,211,102,.08)" : "rgba(37,211,102,.05)", border: `0.5px solid ${dark ? "rgba(37,211,102,.18)" : "rgba(37,211,102,.12)"}`, color: "#25d366" };
  const copiedStyle = { background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)", color: dark ? "#6ee7b7" : "#059669", border: `0.5px solid ${dark ? "rgba(110,231,183,.2)" : "rgba(5,150,105,.15)"}` };

  return (
    <>
      {/* Desktop \u2014 sticky left sidebar */}
      <div className="hidden lg:flex fixed flex-col gap-2 items-center" style={{ left: "max(16px, calc((100vw - 680px) / 2 - 72px))", top: "50%", transform: "translateY(-50%)" }}>
        <div className="text-[10px] font-semibold uppercase tracking-[1px] mb-1" style={{ color: dark ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.25)" }}>Share</div>
        <button onClick={copy} title={copied ? "Copied!" : "Copy link"} className="w-9 h-9 rounded-[10px] flex items-center justify-center cursor-pointer border-none transition-all duration-200 hover:-translate-y-px" style={copied ? copiedStyle : linkStyle}>
          {copied
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>}
        </button>
        <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" title="Share on X" className="w-9 h-9 rounded-[10px] flex items-center justify-center no-underline transition-all duration-200 hover:-translate-y-px" style={xStyle}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </a>
        <a href={`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`} target="_blank" rel="noopener noreferrer" title="Share on WhatsApp" className="w-9 h-9 rounded-[10px] flex items-center justify-center no-underline transition-all duration-200 hover:-translate-y-px" style={waStyle}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </a>
      </div>
    </>
  );
}

function MobileShare({ post, dark }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : `https://nitro.ng/blog/${post.slug}`;
  const text = post.title;
  const copy = () => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const linkStyle = { background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", border: `0.5px solid ${dark ? "rgba(196,125,142,.2)" : "rgba(196,125,142,.15)"}`, color: "#c47d8e" };
  const xStyle = { background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)", border: `0.5px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)"}`, color: dark ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.45)" };
  const waStyle = { background: dark ? "rgba(37,211,102,.08)" : "rgba(37,211,102,.05)", border: `0.5px solid ${dark ? "rgba(37,211,102,.18)" : "rgba(37,211,102,.12)"}`, color: "#25d366" };
  const copiedStyle = { background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)", color: dark ? "#6ee7b7" : "#059669", border: `0.5px solid ${dark ? "rgba(110,231,183,.2)" : "rgba(5,150,105,.15)"}` };
  return (
    <div className="flex lg:hidden gap-2 mt-4 mb-6">
      <button onClick={copy} className="flex items-center gap-1.5 py-1.5 px-3 rounded-full text-[12px] font-medium cursor-pointer border-none transition-all duration-200" style={copied ? copiedStyle : linkStyle}>
        {copied
          ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
          : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>Copy link</>}
      </button>
      <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 py-1.5 px-3 rounded-full text-[12px] font-medium no-underline" style={xStyle}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>Post
      </a>
      <a href={`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 py-1.5 px-3 rounded-full text-[12px] font-medium no-underline" style={waStyle}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>Share
      </a>
    </div>
  );
}

function BlogPostInner({ post }) {
  const { dark, t } = useTheme();
  const rt = readTime(post.content);
  const catBg = dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.08)";
  const bodyColor = dark ? "#bbb" : "#333";
  const metaColor = dark ? "#666" : "#999";
  const thumbBg = dark ? "#111" : "#eee";

  return (
    <div className="min-h-screen relative" style={{ background: t.bg, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <SharedNav action="back" />
      <ShareBar post={post} dark={dark} t={t} />
      <article className="max-w-[680px] mx-auto" style={{ padding: "clamp(24px,4vw,40px) clamp(16px,3vw,24px) 48px" }}>
        <div className="flex items-center gap-3 mb-5">
          <a href="/blog" className="text-[13px] no-underline" style={{ color: t.accent }}>{"\u2190"} All posts</a>
          <div className="py-[3px] px-2.5 rounded text-[11px] font-semibold uppercase tracking-[1px]" style={{ background: catBg, color: t.accent }}>{post.category}</div>
        </div>
        <h1 className="font-semibold leading-[1.2] mb-4" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(24px,5vw,34px)", color: t.text }}>{post.title}</h1>
        <div className="flex items-center gap-3 pb-6" style={{ borderBottom: "1px solid " + t.surfaceBrd }}>
          <Avatar size={32} />
          <div>
            <div className="text-sm font-medium" style={{ color: t.text }}>{post.authorName || "Nitro Team"}</div>
            <div className="text-xs" style={{ color: metaColor }}>{fD(post.createdAt)} {"\u00B7"} {rt} min read{post.views >= 100 ? <> {"\u00B7"} {post.views.toLocaleString()} views</> : null}</div>
          </div>
        </div>
        <MobileShare post={post} dark={dark} />
        {post.thumbnail && <div className="rounded-xl bg-cover bg-center mb-8" style={{ height: "clamp(180px,25vw,300px)", backgroundImage: "url(" + post.thumbnail + ")", backgroundColor: thumbBg }} />}
        <div className="blog-article-body" data-theme={dark ? 'dark' : 'light'} style={{ color: bodyColor }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(md(post.content)) }} />
        <div className="h-px my-8" style={{ background: t.surfaceBrd }} />
        <a href="/blog" className="inline-block py-2.5 px-5 rounded-lg text-sm no-underline" style={{ border: "1px solid " + t.surfaceBrd, color: t.muted }}>{"\u2190"} Back to all posts</a>
      </article>
      <SharedFooter />
    </div>
  );
}
