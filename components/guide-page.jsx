'use client';
import { useState, useEffect } from "react";

export default function GuidePage({ dark, t }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/blog?howto=true")
      .then(r => r.json())
      .then(d => setPosts(d.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fD = (d) => new Date(d).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });

  return (
    <>
      <div className="svc-header">
        <div className="svc-title" style={{ color: t.text }}>Guide</div>
        <div className="svc-subtitle" style={{ color: t.textMuted }}>Step-by-step guides and tutorials</div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {loading ? (
        <div className="p-6">{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-20 rounded-xl mb-2.5`} />)}</div>
      ) : posts.length === 0 ? (
        <div className="p-10 text-center">
          <div className="text-5xl mb-4 opacity-40">📖</div>
          <div className="text-base font-semibold mb-1.5" style={{ color: t.text }}>Tutorials coming soon</div>
          <div className="text-sm mb-4" style={{ color: t.textMuted }}>We're working on guides to help you get the most out of Nitro.</div>
          <a href="/blog" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold no-underline inline-flex items-center gap-1" style={{ color: t.accent }}>
            Visit our blog
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
          {posts.map(p => (
            <a key={p.id} href={`/blog?post=${p.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-[14px] border overflow-hidden block no-underline transition-[border-color] duration-200 hover:brightness-[1.02]" style={{ borderColor: t.cardBorder, background: t.cardBg }}>
              {/* Thumbnail */}
              {p.thumbnail ? (
                <div className="h-[140px]" style={{ background: `url(${p.thumbnail}) center/cover`, borderBottom: `1px solid ${t.cardBorder}` }} />
              ) : (
                <div className="h-[100px] flex items-center justify-center" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", borderBottom: `1px solid ${t.cardBorder}` }}>
                  <span className="text-4xl opacity-30">{p.category === "Tutorials" ? "📖" : p.category === "Tips & Tricks" ? "💡" : p.category === "Announcements" ? "📢" : "📄"}</span>
                </div>
              )}

              <div className="p-3.5">
                <div className="flex gap-1.5 mb-2">
                  <span className="text-[11px] font-semibold text-[#c47d8e] py-0.5 px-2 rounded" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)" }}>{p.category}</span>
                  <span className="text-[11px]" style={{ color: t.textMuted }}>{fD(p.createdAt)}</span>
                </div>
                <h3 className="text-base font-semibold mb-1.5 leading-[1.4] m-0" style={{ color: t.text }}>{p.title}</h3>
                {p.excerpt && <p className="text-[13px] leading-normal m-0" style={{ color: t.textMuted }}>{p.excerpt}</p>}

                <div className="mt-2.5 text-[13px] font-medium" style={{ color: t.accent }}>Read more →</div>
              </div>
            </a>
          ))}
        </div>
        <div className="mt-5 text-center">
          <a href="/blog" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold no-underline inline-flex items-center gap-1" style={{ color: t.accent }}>
            View all posts on our blog
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
        </>
      )}
    </>
  );
}

// Right sidebar for Guide
export function GuideSidebar({ dark, t }) {
  return (
    <>
      <div className="text-xs font-semibold uppercase tracking-[1px] mb-2.5" style={{ color: t.textMuted }}>About Guide</div>
      <div className="text-sm leading-[1.7] mb-4" style={{ color: t.textSoft }}>Step-by-step guides and tutorials to help you get the most out of Nitro. New content is added regularly.</div>

      <div className="py-3 px-3.5 rounded-[10px] border" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", borderColor: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}>
        <div className="text-sm font-semibold mb-1" style={{ color: t.text }}>Need more help?</div>
        <div className="text-[13px] leading-normal mb-2.5" style={{ color: t.textMuted }}>Visit our full blog for more guides, tips, and updates.</div>
        <a href="/blog" target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[#c47d8e] no-underline inline-flex items-center gap-1">
          Visit blog
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
    </>
  );
}
