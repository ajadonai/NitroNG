'use client';
import { useState, useEffect } from "react";

const fD = (d) => new Date(d).toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" });

export default function BlogPage() {
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [selectedPost, setSelectedPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/blog").then(r => r.json()).then(d => {
      setPosts(d.posts || []);
      setCategories(d.categories || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadPost = async (slug) => {
    const res = await fetch(`/api/blog?slug=${slug}`);
    const d = await res.json();
    if (d.post) setSelectedPost(d.post);
  };

  const filtered = activeCat === "all" ? posts : posts.filter(p => p.category === activeCat);

  // Single post view
  if (selectedPost) return (
    <div className="blog-wrap">
      <header className="blog-header">
        <a href="/blog" onClick={e => { e.preventDefault(); setSelectedPost(null); }} className="blog-logo">
          <div className="blog-logo-mark">N</div>
          <span className="blog-logo-text">Nitro <span className="blog-logo-sub">Blog</span></span>
        </a>
        <a href="/" className="blog-back-home">← Back to Nitro</a>
      </header>
      <article className="blog-article">
        <div className="blog-article-cat">{selectedPost.category}</div>
        <h1 className="blog-article-title">{selectedPost.title}</h1>
        <div className="blog-article-meta">{selectedPost.authorName || "Nitro Team"} · {fD(selectedPost.createdAt)} · {selectedPost.views || 0} views</div>
        {selectedPost.thumbnail && <div className="blog-article-thumb" style={{ backgroundImage: `url(${selectedPost.thumbnail})` }} />}
        <div className="blog-article-body" dangerouslySetInnerHTML={{ __html: selectedPost.content }} />
        <button onClick={() => setSelectedPost(null)} className="blog-back-btn">← Back to all posts</button>
      </article>
      <footer className="blog-footer">
        <p>© {new Date().getFullYear()} Nitro — Premium SMM Services</p>
      </footer>
    </div>
  );

  // Post list view
  return (
    <div className="blog-wrap">
      <header className="blog-header">
        <a href="/blog" className="blog-logo">
          <div className="blog-logo-mark">N</div>
          <span className="blog-logo-text">Nitro <span className="blog-logo-sub">Blog</span></span>
        </a>
        <a href="/" className="blog-back-home">← Back to Nitro</a>
      </header>

      <div className="blog-hero">
        <h1 className="blog-hero-title">Nitro Blog</h1>
        <p className="blog-hero-desc">Tips, guides, and updates to help you grow your social media presence.</p>
      </div>

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="blog-cats">
          <button onClick={() => setActiveCat("all")} className={`blog-cat-btn${activeCat === "all" ? " blog-cat-active" : ""}`}>All</button>
          {categories.map(c => (
            <button key={c} onClick={() => setActiveCat(c)} className={`blog-cat-btn${activeCat === c ? " blog-cat-active" : ""}`}>{c}</button>
          ))}
        </div>
      )}

      {/* Posts grid */}
      <div className="blog-grid">
        {loading ? (
          <div className="blog-empty">Loading posts...</div>
        ) : filtered.length > 0 ? filtered.map(p => (
          <article key={p.id} className="blog-card" onClick={() => loadPost(p.slug)}>
            {p.thumbnail && <div className="blog-card-thumb" style={{ backgroundImage: `url(${p.thumbnail})` }} />}
            <div className="blog-card-body">
              <div className="blog-card-cat">{p.category}</div>
              <h2 className="blog-card-title">{p.title}</h2>
              <p className="blog-card-excerpt">{p.excerpt}</p>
              <div className="blog-card-meta">{p.authorName || "Nitro Team"} · {fD(p.createdAt)}</div>
            </div>
          </article>
        )) : (
          <div className="blog-empty">No posts yet — check back soon.</div>
        )}
      </div>

      <footer className="blog-footer">
        <p>© {new Date().getFullYear()} Nitro — Premium SMM Services</p>
      </footer>
    </div>
  );
}
