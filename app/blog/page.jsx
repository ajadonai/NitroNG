'use client';
import { useState, useEffect } from "react";

const fD = (d) => new Date(d).toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" });
const readTime = (html) => { const w = (html || "").replace(/<[^>]*>/g, "").split(/\s+/).length; return Math.max(1, Math.round(w / 200)); };

export default function BlogPage() {
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const s = localStorage.getItem("nitro-blog-theme");
    if (s === "dark") setDark(true);
    else if (s === "light") setDark(false);
    else setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  const toggle = () => { const n = !dark; setDark(n); localStorage.setItem("nitro-blog-theme", n ? "dark" : "light"); };

  useEffect(() => {
    fetch("/api/blog").then(r => r.json()).then(d => { setPosts(d.posts || []); setCategories(d.categories || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const openPost = async (slug) => {
    const r = await fetch("/api/blog?slug=" + slug);
    const d = await r.json();
    if (d.post) { setPost(d.post); window.scrollTo(0, 0); }
  };

  const filtered = activeCat === "all" ? posts : posts.filter(p => p.category === activeCat);

  const v = {
    bg: dark ? "#080b14" : "#f4f1ed",
    card: dark ? "rgba(255,255,255,.03)" : "#fff",
    bdr: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)",
    div: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)",
    txt: dark ? "#e5e5e5" : "#1a1a1a",
    body: dark ? "#bbb" : "#333",
    mut: dark ? "#888" : "#666",
    sft: dark ? "#666" : "#999",
    fnt: dark ? "#555" : "#aaa",
    acc: "#c47d8e",
    catBg: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.08)",
    tbg: dark ? "#111" : "#eee",
    grd: dark ? "linear-gradient(135deg, #2a1a22, #1a1225)" : "linear-gradient(135deg, #e8d5db, #d4a8b5)",
    tbtn: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)",
  };

  const Hdr = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px clamp(16px,3vw,32px)", borderBottom: "1px solid " + v.div, maxWidth: 1100, margin: "0 auto" }}>
      <a href="/blog" onClick={e => { if (post) { e.preventDefault(); setPost(null); } }} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff", flexShrink: 0 }}>N</div>
        <span style={{ fontSize: 16, fontWeight: 600, color: v.txt }}>Nitro <span style={{ fontWeight: 400, color: v.sft }}>Blog</span></span>
      </a>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={toggle} style={{ width: 28, height: 28, borderRadius: 6, background: v.tbtn, border: "none", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{dark ? "\u2600" : "\u263E"}</button>
        <a href="/" style={{ fontSize: 12, color: v.mut, textDecoration: "none" }}>{"\u2190 Nitro"}</a>
      </div>
    </div>
  );

  const Ftr = () => (
    <div style={{ textAlign: "center", padding: "24px 20px", borderTop: "1px solid " + v.div }}>
      <p style={{ fontSize: 12, color: v.fnt, margin: 0 }}>{"\u00A9"} {new Date().getFullYear()} Nitro {"\u2014"} Premium SMM Services</p>
    </div>
  );

  if (post) {
    const rt = readTime(post.content);
    const ini = (post.authorName || "Nitro Team").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    return (
      <div style={{ minHeight: "100vh", background: v.bg, fontFamily: "'Outfit',sans-serif" }}>
        <Hdr />
        <article style={{ maxWidth: 680, margin: "0 auto", padding: "clamp(24px,4vw,40px) clamp(16px,3vw,24px) 48px" }}>
          <button onClick={() => setPost(null)} style={{ background: "none", border: "none", color: v.acc, fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 28 }}>{"\u2190 All posts"}</button>
          <div style={{ display: "inline-block", padding: "3px 10px", borderRadius: 4, background: v.catBg, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: v.acc, marginBottom: 16 }}>{post.category}</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(24px,5vw,34px)", fontWeight: 600, lineHeight: 1.2, margin: "0 0 16px", color: v.txt }}>{post.title}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32, paddingBottom: 24, borderBottom: "1px solid " + v.div }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#fff", flexShrink: 0 }}>{ini}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: v.txt }}>{post.authorName || "Nitro Team"}</div>
              <div style={{ fontSize: 11, color: v.sft }}>{fD(post.createdAt)} {"\u00B7"} {rt} min read {"\u00B7"} {post.views || 0} views</div>
            </div>
          </div>
          {post.thumbnail && <div style={{ height: "clamp(180px,25vw,300px)", borderRadius: 12, backgroundImage: "url(" + post.thumbnail + ")", backgroundSize: "cover", backgroundPosition: "center", backgroundColor: v.tbg, marginBottom: 32 }} />}
          <div className="blog-article-body" style={{ color: v.body }} dangerouslySetInnerHTML={{ __html: post.content }} />
          <div style={{ height: 1, background: v.div, margin: "32px 0" }} />
          <button onClick={() => setPost(null)} style={{ display: "inline-block", padding: "10px 20px", borderRadius: 8, border: "1px solid " + (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"), background: "none", color: dark ? "#888" : "#666", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{"\u2190 Back to all posts"}</button>
        </article>
        <Ftr />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: v.bg, fontFamily: "'Outfit',sans-serif" }}>
      <Hdr />
      <div style={{ textAlign: "center", padding: "clamp(30px,5vw,56px) 20px clamp(16px,2vw,28px)", maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(30px,5vw,44px)", fontWeight: 600, margin: "0 0 10px", color: v.txt, lineHeight: 1.1 }}>The Nitro Blog</h1>
        <p style={{ fontSize: 15, color: v.mut, lineHeight: 1.6, margin: 0 }}>Tips, guides, and updates to help you grow your social media presence.</p>
      </div>
      {categories.length > 1 && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "0 20px 24px", flexWrap: "wrap" }}>
          <button onClick={() => setActiveCat("all")} style={{ padding: "5px 16px", borderRadius: 18, border: "1px solid " + (activeCat === "all" ? v.acc : v.bdr), background: activeCat === "all" ? v.acc : "transparent", color: activeCat === "all" ? "#fff" : v.mut, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>All</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCat(cat)} style={{ padding: "5px 16px", borderRadius: 18, border: "1px solid " + (activeCat === cat ? v.acc : v.bdr), background: activeCat === cat ? v.acc : "transparent", color: activeCat === cat ? "#fff" : v.mut, fontSize: 12, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize" }}>{cat}</button>
          ))}
        </div>
      )}
      <div className="blog-grid" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 clamp(16px,3vw,40px) 60px" }}>
        {loading ? (
          <div className="blog-empty" style={{ color: v.mut }}>Loading posts...</div>
        ) : filtered.length > 0 ? filtered.map(p => (
          <article key={p.id} onClick={() => openPost(p.slug)} className="blog-card" style={{ background: v.card, borderRadius: 12, overflow: "hidden", cursor: "pointer", border: "1px solid " + v.bdr }}>
            <div style={{ height: 160, backgroundImage: p.thumbnail ? "url(" + p.thumbnail + ")" : "none", background: p.thumbnail ? undefined : v.grd, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: v.tbg }} />
            <div style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: .8, color: v.acc, marginBottom: 7 }}>{p.category}</div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px", color: v.txt, lineHeight: 1.3 }}>{p.title}</h2>
              <p style={{ fontSize: 13, color: v.mut, lineHeight: 1.5, margin: "0 0 10px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.excerpt}</p>
              <div style={{ fontSize: 11, color: v.fnt }}>{p.authorName || "Nitro Team"} {"\u00B7"} {fD(p.createdAt)}</div>
            </div>
          </article>
        )) : (
          <div className="blog-empty" style={{ color: v.mut }}>No posts yet {"\u2014"} check back soon.</div>
        )}
      </div>
      <Ftr />
    </div>
  );
}
