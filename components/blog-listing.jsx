'use client';
import { useState, useEffect, useCallback } from "react";
import { fD } from '@/lib/markdown';

export default function BlogListing({ initialPosts, initialCategories, initialTotalPages }) {
  const [posts, setPosts] = useState(initialPosts);
  const [categories, setCategories] = useState(initialCategories);
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);

  useEffect(() => {
    const s = localStorage.getItem("nitro-theme");
    if (s === "night") setDark(true);
    else if (s === "day") setDark(false);
    else { const h = new Date().getHours(), m = new Date().getMinutes(); setDark(h >= 19 || h < 6 || (h === 6 && m < 30) || (h === 18 && m >= 30)); }
  }, []);

  const toggle = () => { const n = !dark; setDark(n); localStorage.setItem("nitro-theme", n ? "night" : "day"); };

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
    const t = setTimeout(() => fetchPosts(page, activeCat, search), delay);
    return () => clearTimeout(t);
  }, [page, activeCat, search, fetchPosts]);

  const changeCat = (cat) => { setActiveCat(cat); setPage(1); };
  const onSearch = (e) => { setSearch(e.target.value); setPage(1); };

  const v = {
    bg: dark ? "#080b14" : "#f4f1ed",
    card: dark ? "rgba(255,255,255,.05)" : "#fff",
    bdr: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.04)",
    div: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.06)",
    txt: dark ? "#e5e5e5" : "#1a1a1a",
    mut: dark ? "#888" : "#666",
    sft: dark ? "#666" : "#999",
    fnt: dark ? "#555" : "#aaa",
    acc: "#c47d8e",
    tbg: dark ? "#111" : "#eee",
    grd: dark ? "linear-gradient(135deg, #2a1a22, #1a1225)" : "linear-gradient(135deg, #e8d5db, #d4a8b5)",
    tbtn: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.08)",
  };

  const Hdr = () => (
    <div className="flex justify-between items-center max-w-[1100px] mx-auto" style={{ padding: "16px clamp(16px,3vw,32px)", borderBottom: "1px solid " + v.div }}>
      <a href="/blog" className="flex items-center gap-2.5 no-underline">
        <div className="w-8 h-8 rounded-lg bg-[linear-gradient(135deg,#c47d8e,#8b5e6b)] flex items-center justify-center shrink-0"><svg width="12" height="13" viewBox="0 0 1601 1785" fill="#fff"><path d="M1600.82 160.089V1313c-.85 53.13-10.35 104.17-27.19 151.74-48.19 136.54-156.38 244.73-292.92 292.92-50.12 17.76-103.94 27.34-160.08 27.34 0 0-79.39 0-160.01-27.34-85.1-28.88-155.38-85.49-208.28-141.55-72.59-76.84-112.13-179.09-112.13-284.74V1023.4v-3.08-12.9c.08-1.39.08-2.7.08-4.17 0-1.39 0-2.7-.08-4.09-2.08-84.64-69.97-153.06-154.53-155.84-1.85-.08-3.71-.15-5.48-.15-1.78 0-3.71.08-5.48.15-84.56 2.78-152.44 71.2-154.61 155.84-.08 1.39-.08 2.7-.08 4.09 0 1.47 0 2.78.08 4.17v534.87c0 88.42-71.67 160.09-160.09 160.09-44.17 0-84.25-17.92-113.21-46.88C17.92 1626.84 0 1586.76 0 1542.59V995.288c.927-53.132 10.426-104.178 27.261-151.672C75.45 707.003 183.643 598.81 320.179 550.621c50.119-17.685 103.946-27.338 160.089-27.338 0 0 79.388 0 160.012 27.338 85.103 28.882 155.379 85.489 208.278 141.555 72.593 76.84 112.132 179.087 112.132 284.732v307.972l-.077.92v12.89c-.077 1.39-.077 2.78-.077 4.17 0 1.39 0 2.7.077 4.17 2.085 84.64 69.967 152.99 154.527 155.84 1.86 0 3.71 0 5.49 0 1.77 0 3.7 0 5.48 0 84.56-2.85 152.44-71.2 154.6-155.84V160.089C1280.71 71.666 1352.38 0 1440.8 0c44.18 0 84.18 17.916 113.14 46.876 28.96 28.96 46.88 69.04 46.88 113.213z"/></svg></div>
        <span className="text-base font-semibold" style={{ color: v.txt }}>Nitro <span className="font-normal" style={{ color: v.sft }}>Blog</span></span>
      </a>
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="w-8 h-8 rounded-lg text-base cursor-pointer flex items-center justify-center transition-transform duration-200 hover:-translate-y-px" style={{ background: v.tbtn, border: "1px solid " + v.bdr, color: v.mut }}>{dark ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>}</button>
        <a href="/" className="text-[13px] no-underline" style={{ color: v.mut }}>{"← Nitro"}</a>
      </div>
    </div>
  );

  const Ftr = () => (
    <div className="text-center py-6 px-5" style={{ borderTop: "1px solid " + v.div }}>
      <p className="text-[13px] m-0" style={{ color: v.fnt }}>{"©"} {new Date().getFullYear()} Nitro {"—"} Premium SMM Services</p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: v.bg, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <Hdr />
      <div className="text-center max-w-[600px] mx-auto" style={{ padding: "clamp(30px,5vw,56px) 20px clamp(16px,2vw,28px)" }}>
        <h1 className="font-semibold mb-2.5 leading-tight" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(30px,5vw,44px)", color: v.txt }}>The Nitro NG Blog</h1>
        <p className="text-base leading-relaxed m-0" style={{ color: v.mut }}>Tips, guides, and updates to help you grow your social media presence.</p>
        <div className="relative mt-5 max-w-[400px] mx-auto">
          <input
            type="text"
            value={search}
            onChange={onSearch}
            placeholder="Search articles..."
            className="w-full py-2.5 pl-10 pr-8 rounded-xl text-sm outline-none font-[inherit]"
            style={{ background: v.card, border: "1px solid " + v.bdr, color: v.txt }}
          />
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={v.sft} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          {search && <button aria-label="Clear search" onClick={() => { setSearch(""); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-xs cursor-pointer border-none" style={{ background: v.tbtn, color: v.mut }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
        </div>
      </div>
      {categories.length > 1 && (
        <div className="flex justify-center px-5 pb-6">
          <select
            value={activeCat}
            onChange={e => changeCat(e.target.value)}
            className="py-[7px] pl-[10px] pr-[28px] rounded-lg text-[13px] font-medium appearance-none cursor-pointer font-[inherit] bg-no-repeat bg-[right_8px_center]"
            style={{ background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)", border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)"}`, color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)", textAlign: "center", textAlignLast: "center", backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='${dark ? "%23666" : "%23999"}' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")` }}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-3 max-[899px]:grid-cols-2 max-[599px]:grid-cols-1 gap-6 max-[899px]:gap-4 max-[899px]:px-5 max-[899px]:pb-10 max-w-[1100px] mx-auto" style={{ padding: "0 clamp(16px,3vw,40px) 40px" }}>
        {loading ? (
          <div className="col-span-full text-center py-[60px] px-5 text-base" style={{ color: v.mut }}>Loading posts...</div>
        ) : posts.length > 0 ? posts.map(p => (
          <a key={p.id} href={'/blog/' + p.slug} className="no-underline">
            <article className="transition-[box-shadow,transform] duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,.14)] hover:-translate-y-0.5 rounded-xl overflow-hidden cursor-pointer h-full flex flex-col" style={{ background: v.card, border: "1px solid " + v.bdr }}>
              {p.thumbnail ? (
                <div className="h-40 flex-shrink-0" style={{ background: `url(${p.thumbnail}) center/cover no-repeat ${v.tbg}` }} />
              ) : (
                <div className="h-40 flex-shrink-0" style={{ background: v.grd }} />
              )}
              <div className="py-4 px-[18px] flex flex-col flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.8px] mb-[7px]" style={{ color: v.acc }}>{p.category}</div>
                <h2 className="text-base font-semibold mb-1.5 leading-[1.3]" style={{ color: v.txt }}>{p.title}</h2>
                <p className="text-sm leading-normal mb-2.5 line-clamp-2" style={{ color: v.mut }}>{p.excerpt}</p>
                <div className="mt-auto text-xs" style={{ color: v.fnt }}>{p.authorName || "Nitro Team"} {"·"} {fD(p.createdAt)}</div>
              </div>
            </article>
          </a>
        )) : (
          <div className="col-span-full text-center py-[60px] px-5 text-base" style={{ color: v.mut }}>No posts yet {"—"} check back soon.</div>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 pb-10">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="py-2 px-4 rounded-lg text-sm cursor-pointer font-[inherit] disabled:opacity-30 disabled:cursor-default"
            style={{ border: "1px solid " + v.bdr, background: v.card, color: v.mut }}
          >{"←"} Prev</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className="w-9 h-9 rounded-lg text-sm cursor-pointer font-[inherit]"
              style={{ border: "1px solid " + (n === page ? v.acc : v.bdr), background: n === page ? v.acc : v.card, color: n === page ? "#fff" : v.mut }}
            >{n}</button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="py-2 px-4 rounded-lg text-sm cursor-pointer font-[inherit] disabled:opacity-30 disabled:cursor-default"
            style={{ border: "1px solid " + v.bdr, background: v.card, color: v.mut }}
          >Next {"→"}</button>
        </div>
      )}
      <Ftr />
    </div>
  );
}
