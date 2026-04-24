'use client';
import { useState, useEffect } from "react";
import DOMPurify from "dompurify";

export default function HowToPage({ dark, t }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

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
        <div style={{ padding: 24 }}>{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ height: 80, borderRadius: 12, marginBottom: 10 }} />)}</div>
      ) : posts.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".4"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg></div>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 6 }}>Tutorials coming soon</div>
          <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 16 }}>We're working on guides to help you get the most out of Nitro.</div>
          <a href="/blog" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: t.accent, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
            Visit our blog
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      ) : (
        <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {posts.map(p => (
            <div key={p.id} onClick={() => window.open(`/blog?post=${p.slug}`, '_blank')} style={{ borderRadius: 14, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: t.cardBg, overflow: "hidden", cursor: "pointer", transition: "border-color .2s, transform .2s", ":hover": { transform: "translateY(-2px)" } }}>
              {/* Thumbnail */}
              {p.thumbnail ? (
                <div style={{ height: 140, background: `url(${p.thumbnail}) center/cover`, borderBottom: `1px solid ${t.cardBorder}` }} />
              ) : (
                <div style={{ height: 100, background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: `1px solid ${t.cardBorder}` }}>
                  <span style={{ opacity: .3 }}>{p.category === "Tutorials" ? <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg> : p.category === "Tips & Tricks" ? <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg> : p.category === "Announcements" ? <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg> : <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}</span>
                </div>
              )}

              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#c47d8e", background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", padding: "2px 8px", borderRadius: 4 }}>{p.category}</span>
                  <span style={{ fontSize: 11, color: t.textMuted }}>{fD(p.createdAt)}</span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: t.text, margin: "0 0 6px", lineHeight: 1.4 }}>{p.title}</h3>
                {p.excerpt && <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, margin: 0 }}>{p.excerpt}</p>}
                <div style={{ marginTop: 10, fontSize: 13, color: t.accent, fontWeight: 500 }}>Read more →</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <a href="/blog" target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: t.accent, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
            View all posts on our blog
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
        </>
      )}
    </>
  );
}

// Right sidebar for How To
export function HowToSidebar({ dark, t }) {
  return (
    <>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>About How To</div>
      <div style={{ fontSize: 14, color: t.textSoft, lineHeight: 1.7, marginBottom: 16 }}>Step-by-step guides and tutorials to help you get the most out of Nitro. New content is added regularly.</div>

      <div style={{ padding: "12px 14px", borderRadius: 10, background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)", borderWidth: 1, borderStyle: "solid", borderColor: dark ? "rgba(196,125,142,.19)" : "rgba(196,125,142,.14)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 4 }}>Need more help?</div>
        <div style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, marginBottom: 10 }}>Visit our full blog for more guides, tips, and updates.</div>
        <a href="/blog" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#c47d8e", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
          Visit blog
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
    </>
  );
}
