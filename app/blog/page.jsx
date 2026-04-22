'use client';
import { useState, useEffect } from "react";
import { fD } from '@/lib/markdown';

export default function BlogPage() {
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const s = localStorage.getItem("nitro-theme");
    if (s === "night") setDark(true);
    else if (s === "day") setDark(false);
    else { const h = new Date().getHours(), m = new Date().getMinutes(); setDark(h >= 19 || h < 6 || (h === 6 && m < 30) || (h === 18 && m >= 30)); }
  }, []);

  const toggle = () => { const n = !dark; setDark(n); localStorage.setItem("nitro-theme", n ? "night" : "day"); };

  useEffect(() => {
    fetch("/api/blog").then(r => r.json()).then(d => { setPosts(d.posts || []); setCategories(d.categories || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = activeCat === "all" ? posts : posts.filter(p => p.category === activeCat);

  const v = {
    bg: dark ? "#080b14" : "#f4f1ed",
    card: dark ? "rgba(255,255,255,.03)" : "#fff",
    bdr: dark ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.04)",
    div: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)",
    txt: dark ? "#e5e5e5" : "#1a1a1a",
    mut: dark ? "#888" : "#666",
    sft: dark ? "#666" : "#999",
    fnt: dark ? "#555" : "#aaa",
    acc: "#c47d8e",
    tbg: dark ? "#111" : "#eee",
    grd: dark ? "linear-gradient(135deg, #2a1a22, #1a1225)" : "linear-gradient(135deg, #e8d5db, #d4a8b5)",
    tbtn: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)",
  };

  const Hdr = () => (
    <div className="flex justify-between items-center max-w-[1100px] mx-auto" style={{ padding: "16px clamp(16px,3vw,32px)", borderBottom: "1px solid " + v.div }}>
      <a href="/blog" className="flex items-center gap-2.5 no-underline">
        <div className="w-8 h-8 rounded-lg bg-[linear-gradient(135deg,#c47d8e,#8b5e6b)] flex items-center justify-center text-base font-semibold text-white shrink-0">N</div>
        <span className="text-base font-semibold" style={{ color: v.txt }}>Nitro <span className="font-normal" style={{ color: v.sft }}>Blog</span></span>
      </a>
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="w-8 h-8 rounded-lg text-base cursor-pointer flex items-center justify-center" style={{ background: v.tbtn, border: "1px solid " + v.bdr, color: v.mut }}>{dark ? "\u2600" : "\u263E"}</button>
        <a href="/" className="text-[13px] no-underline" style={{ color: v.mut }}>{"\u2190 Nitro"}</a>
      </div>
    </div>
  );

  const Ftr = () => (
    <div className="text-center py-6 px-5" style={{ borderTop: "1px solid " + v.div }}>
      <p className="text-[13px] m-0" style={{ color: v.fnt }}>{"\u00A9"} {new Date().getFullYear()} Nitro {"\u2014"} Premium SMM Services</p>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: v.bg, fontFamily: "'Outfit',sans-serif" }}>
      <Hdr />
      <div className="text-center max-w-[600px] mx-auto" style={{ padding: "clamp(30px,5vw,56px) 20px clamp(16px,2vw,28px)" }}>
        <h1 className="font-semibold mb-2.5 leading-tight" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(30px,5vw,44px)", color: v.txt }}>The Nitro Blog</h1>
        <p className="text-base leading-relaxed m-0" style={{ color: v.mut }}>Tips, guides, and updates to help you grow your social media presence.</p>
      </div>
      {categories.length > 1 && (
        <div className="flex gap-1.5 justify-center px-5 pb-6 flex-wrap">
          <button onClick={() => setActiveCat("all")} className="py-[5px] px-4 rounded-[18px] text-[13px] cursor-pointer font-[inherit]" style={{ border: "1px solid " + (activeCat === "all" ? v.acc : v.bdr), background: activeCat === "all" ? v.acc : "transparent", color: activeCat === "all" ? "#fff" : v.mut }}>All</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCat(cat)} className="py-[5px] px-4 rounded-[18px] text-[13px] cursor-pointer font-[inherit] capitalize" style={{ border: "1px solid " + (activeCat === cat ? v.acc : v.bdr), background: activeCat === cat ? v.acc : "transparent", color: activeCat === cat ? "#fff" : v.mut }}>{cat}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 max-[899px]:grid-cols-2 max-[599px]:grid-cols-1 gap-6 max-[899px]:gap-4 max-[899px]:px-5 max-[899px]:pb-10 max-w-[1100px] mx-auto" style={{ padding: "0 clamp(16px,3vw,40px) 60px" }}>
        {loading ? (
          <div className="col-span-full text-center py-[60px] px-5 text-base" style={{ color: v.mut }}>Loading posts...</div>
        ) : filtered.length > 0 ? filtered.map(p => (
          <a key={p.id} href={'/blog/' + p.slug} className="no-underline">
            <article className="transition-[box-shadow,transform] duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,.08)] hover:-translate-y-0.5 rounded-xl overflow-hidden cursor-pointer h-full" style={{ background: v.card, border: "1px solid " + v.bdr }}>
              {p.thumbnail ? (
                <div className="h-40" style={{ background: `url(${p.thumbnail}) center/cover no-repeat ${v.tbg}` }} />
              ) : (
                <div className="h-40" style={{ background: v.grd }} />
              )}
              <div className="py-4 px-[18px]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.8px] mb-[7px]" style={{ color: v.acc }}>{p.category}</div>
                <h2 className="text-base font-semibold mb-1.5 leading-[1.3]" style={{ color: v.txt }}>{p.title}</h2>
                <p className="text-sm leading-normal mb-2.5 line-clamp-2" style={{ color: v.mut }}>{p.excerpt}</p>
                <div className="text-xs" style={{ color: v.fnt }}>{p.authorName || "Nitro Team"} {"\u00B7"} {fD(p.createdAt)}</div>
              </div>
            </article>
          </a>
        )) : (
          <div className="col-span-full text-center py-[60px] px-5 text-base" style={{ color: v.mut }}>No posts yet {"\u2014"} check back soon.</div>
        )}
      </div>
      <Ftr />
    </div>
  );
}
