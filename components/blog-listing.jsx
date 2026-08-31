'use client';
import { useState, useEffect, useCallback } from "react";
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter } from './shared-nav';
import { fD } from '@/lib/markdown';

// The blog index on the reading layout the posts already use: SharedNav, the
// rd- token set, a Cormorant hero with search, category chips, and the posts
// as cards. Data flow is unchanged — server-rendered first page, /api/blog
// for search, category and pagination.

export default function BlogListing(props) {
  return <ThemeProvider><BlogListingInner {...props} /></ThemeProvider>;
}

function BlogListingInner({ initialPosts, initialCategories, initialTotalPages }) {
  const { dark, t } = useTheme();
  const [posts, setPosts] = useState(initialPosts);
  const [categories, setCategories] = useState(initialCategories);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);

  const fetchPosts = useCallback((p, cat, q) => {
    if (p === 1 && cat === 'all' && !q) {
      setPosts(initialPosts);
      setCategories(initialCategories);
      setTotalPages(initialTotalPages);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ page: p });
    if (cat && cat !== 'all') params.set('category', cat);
    if (q) params.set('search', q);
    fetch("/api/blog?" + params).then(r => r.json()).then(d => {
      setPosts(d.posts || []);
      setCategories(d.categories || []);
      setTotalPages(d.totalPages || 1);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [initialPosts, initialCategories, initialTotalPages]);

  useEffect(() => {
    const delay = search ? 300 : 0;
    const timer = setTimeout(() => fetchPosts(page, activeCat, search), delay);
    return () => clearTimeout(timer);
  }, [page, activeCat, search, fetchPosts]);

  const changeCat = (cat) => { setActiveCat(cat); setPage(1); };

  const vars = {
    "--rbg": t.bg || (dark ? "#080b14" : "#f4f1ed"), "--rtx": t.text, "--rsoft": t.soft || t.textSoft || (dark ? "#a09b95" : "#555250"), "--rmut": t.muted || t.textMuted || (dark ? "#8a8580" : "#757170"),
    "--rcard": dark ? "#111528" : "#ffffff", "--rline": dark ? "rgba(255,255,255,.12)" : "rgba(28,27,25,.11)", "--rac": "#c47d8e",
  };

  return (
    <div className="rd min-h-screen" style={{ ...vars, background: "var(--rbg)", color: "var(--rtx)" }}>
      <style>{BL_CSS}</style>
      <SharedNav action="back" />
      <div className="bl-wrap">
        <div className="bl-hero">
          <span className="bl-eye">The Nitro Blog</span>
          <h1 className="bl-h1">Tips, guides and updates</h1>
          <p className="bl-lede">Everything we have learned about growing an audience in Nigeria — written for the people doing the growing.</p>
          <div className="bl-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search articles…" aria-label="Search articles" />
            {search && <button type="button" aria-label="Clear search" onClick={() => { setSearch(""); setPage(1); }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
          </div>
        </div>

        {categories.length > 1 && (
          <div className="bl-chips">
            <button type="button" className={`bl-chip${activeCat === "all" ? " on" : ""}`} onClick={() => changeCat("all")}>All</button>
            {categories.map(cat => (
              <button type="button" key={cat} className={`bl-chip${activeCat === cat ? " on" : ""}`} onClick={() => changeCat(cat)}>{cat}</button>
            ))}
          </div>
        )}

        <div className="bl-grid">
          {loading ? (
            <div className="bl-empty">Loading posts…</div>
          ) : posts.length > 0 ? posts.map(p => (
            <a key={p.id} href={'/blog/' + p.slug} className="bl-card">
              <span className="bl-thumb" style={p.thumbnail ? { backgroundImage: `url(${p.thumbnail})` } : undefined} />
              <span className="bl-body">
                <em>{p.category}</em>
                <b>{p.title}</b>
                {p.excerpt && <p>{p.excerpt}</p>}
                <i>{p.authorName || "Nitro Team"} · {fD(p.createdAt)}</i>
              </span>
            </a>
          )) : (
            <div className="bl-empty">Nothing matches{search ? ` "${search}"` : ""} — try another word or category.</div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="bl-pages">
            <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button type="button" key={n} className={n === page ? "on" : ""} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next →</button>
          </div>
        )}
      </div>
      <SharedFooter />
    </div>
  );
}

const BL_CSS = `
.bl-wrap{max-width:1020px;margin:0 auto;padding:44px 28px 56px;display:flex;flex-direction:column;gap:24px}
.bl-eye{font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--rac);display:block}
.bl-hero{display:flex;flex-direction:column;gap:10px}
.bl-h1{font-family:'Cormorant Garamond',serif;font-size:clamp(34px,4.6vw,52px);font-weight:600;line-height:1.08;letter-spacing:-.01em;margin:0;text-wrap:balance;color:var(--rtx)}
.bl-lede{font-size:17px;line-height:1.55;color:var(--rsoft);margin:0;max-width:58ch}
.bl-search{position:relative;display:flex;align-items:center;max-width:420px;margin-top:8px;color:var(--rmut)}
.bl-search svg{position:absolute;left:14px;pointer-events:none}
.bl-search input{width:100%;height:46px;padding:0 38px 0 40px;border-radius:12px;border:1px solid var(--rline);background:var(--rcard);color:var(--rtx);font:inherit;font-size:14px;outline:none}
.bl-search input:focus{border-color:var(--rac)}
.bl-search button{position:absolute;right:10px;display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;border:1px solid var(--rline);background:var(--rcard);color:var(--rmut);cursor:pointer;padding:0}
.bl-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:-8px}
.bl-chip{font:inherit;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:999px;border:1px solid var(--rline);background:var(--rcard);color:var(--rmut);cursor:pointer}
.bl-chip.on{background:var(--rtx);color:var(--rbg);border-color:var(--rtx)}
.bl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.bl-card{display:flex;flex-direction:column;border-radius:14px;overflow:hidden;background:var(--rcard);border:1px solid var(--rline);text-decoration:none;transition:transform .15s}
.bl-card:hover{transform:translateY(-2px)}
.bl-thumb{height:150px;flex-shrink:0;background-color:var(--rline);background-image:linear-gradient(135deg,rgba(196,125,142,.5),rgba(139,94,107,.22));background-size:cover;background-position:center}
.bl-body{display:flex;flex-direction:column;gap:6px;padding:14px 16px 16px;flex:1}
.bl-body em{font-style:normal;font-size:10.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--rac)}
.bl-body b{font-size:15px;line-height:1.35;color:var(--rtx);font-weight:600}
.bl-body p{font-size:13px;line-height:1.5;color:var(--rmut);margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.bl-body i{font-style:normal;font-size:12px;color:var(--rmut);margin-top:auto;padding-top:6px}
.bl-empty{grid-column:1/-1;text-align:center;padding:56px 20px;font-size:15px;color:var(--rmut)}
.bl-pages{display:flex;justify-content:center;align-items:center;gap:6px;flex-wrap:wrap}
.bl-pages button{font:inherit;font-size:13px;font-weight:600;min-width:36px;height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--rline);background:var(--rcard);color:var(--rmut);cursor:pointer}
.bl-pages button.on{background:var(--rac);border-color:var(--rac);color:#fff}
.bl-pages button:disabled{opacity:.35;cursor:default}
@media (max-width:900px){.bl-wrap{padding:28px 16px 40px;gap:18px}.bl-grid{grid-template-columns:1fr 1fr;gap:12px}}
@media (max-width:600px){.bl-grid{grid-template-columns:1fr}.bl-thumb{height:170px}}
`;
