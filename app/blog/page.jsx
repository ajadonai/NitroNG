'use client';
import { useState, useEffect } from "react";
import DOMPurify from "dompurify";

const fD = (d) => new Date(d).toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" });
const readTime = (text) => { const w = (text || "").replace(/<[^>]*>/g, "").replace(/[#*_\[\]()]/g, "").split(/\s+/).length; return Math.max(1, Math.round(w / 200)); };

/* Lightweight markdown → HTML */
function md(src) {
  if (!src) return "";
  // Split into blocks by double newline
  const blocks = src.split(/\n{2,}/);
  const out = [];
  let inList = null; // 'ul' or 'ol'
  
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    
    // Heading
    if (/^#{1,3} /.test(trimmed)) {
      if (inList) { out.push(`</${inList}>`); inList = null; }
      const level = trimmed.match(/^(#{1,3})/)[1].length;
      const text = inline(trimmed.replace(/^#{1,3}\s+/, ''));
      out.push(`<h${level}>${text}</h${level}>`);
      continue;
    }
    
    // Horizontal rule
    if (/^---+$/.test(trimmed)) {
      if (inList) { out.push(`</${inList}>`); inList = null; }
      out.push('<hr/>');
      continue;
    }
    
    // Check if block is a list
    const lines = trimmed.split('\n');
    const isUL = lines.every(l => /^[-*] /.test(l.trim()));
    const isOL = lines.every(l => /^\d+\. /.test(l.trim()));
    
    if (isUL) {
      if (inList !== 'ul') { if (inList) out.push(`</${inList}>`); out.push('<ul>'); inList = 'ul'; }
      lines.forEach(l => out.push(`<li>${inline(l.trim().replace(/^[-*] /, ''))}</li>`));
      continue;
    }
    if (isOL) {
      if (inList !== 'ol') { if (inList) out.push(`</${inList}>`); out.push('<ol>'); inList = 'ol'; }
      lines.forEach(l => out.push(`<li>${inline(l.trim().replace(/^\d+\. /, ''))}</li>`));
      continue;
    }
    
    // Regular paragraph — join lines within same block
    if (inList) { out.push(`</${inList}>`); inList = null; }
    out.push(`<p>${inline(lines.join(' '))}</p>`);
  }
  if (inList) out.push(`</${inList}>`);
  return out.join('\n');
}

function inline(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

export default function BlogPage() {
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState("all");
  const [post, setPost] = useState(null);
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
    fetch("/api/blog").then(r => r.json()).then(d => { setPosts(d.posts || []); setCategories(d.categories || []); setLoading(false); 
      // Auto-open post from ?post=slug query param
      const params = new URLSearchParams(window.location.search);
      const slug = params.get("post");
      if (slug) {
        fetch("/api/blog?slug=" + slug).then(r => r.json()).then(pd => { if (pd.post) setPost(pd.post); });
      }
    }).catch(() => setLoading(false));
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
    tbtn: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)",
  };

  const Hdr = () => (
    <div className="flex justify-between items-center max-w-[1100px] mx-auto" style={{ padding: "16px clamp(16px,3vw,32px)", borderBottom: "1px solid " + v.div }}>
      <a href="/blog" onClick={e => { if (post) { e.preventDefault(); setPost(null); } }} className="flex items-center gap-2.5 no-underline">
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

  if (post) {
    const rt = readTime(post.content);
    const ini = (post.authorName || "Nitro Team").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    return (
      <div className="min-h-screen" style={{ background: v.bg, fontFamily: "'Outfit',sans-serif" }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "https://nitro.ng" }, { "@type": "ListItem", position: 2, name: "Blog", item: "https://nitro.ng/blog" }, { "@type": "ListItem", position: 3, name: post.title }] }) }} />
        <Hdr />
        <article className="max-w-[680px] mx-auto" style={{ padding: "clamp(24px,4vw,40px) clamp(16px,3vw,24px) 48px" }}>
          <button onClick={() => setPost(null)} className="bg-transparent border-none text-[13px] cursor-pointer font-[inherit] p-0 mb-7" style={{ color: v.acc }}>{"\u2190 All posts"}</button>
          <div className="inline-block py-[3px] px-2.5 rounded text-[11px] font-semibold uppercase tracking-[1px] mb-4" style={{ background: v.catBg, color: v.acc }}>{post.category}</div>
          <h1 className="font-semibold leading-[1.2] mb-4" style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(24px,5vw,34px)", color: v.txt }}>{post.title}</h1>
          <div className="flex items-center gap-3 mb-8 pb-6" style={{ borderBottom: "1px solid " + v.div }}>
            <div className="w-8 h-8 rounded-full bg-[linear-gradient(135deg,#c47d8e,#8b5e6b)] flex items-center justify-center text-[13px] font-semibold text-white shrink-0">{ini}</div>
            <div>
              <div className="text-sm font-medium" style={{ color: v.txt }}>{post.authorName || "Nitro Team"}</div>
              <div className="text-xs" style={{ color: v.sft }}>{fD(post.createdAt)} {"\u00B7"} {rt} min read {"\u00B7"} {post.views || 0} views</div>
            </div>
          </div>
          {post.thumbnail && <div className="rounded-xl bg-cover bg-center mb-8" style={{ height: "clamp(180px,25vw,300px)", backgroundImage: "url(" + post.thumbnail + ")", backgroundColor: v.tbg }} />}
          <div className="blog-article-body" style={{ color: v.body }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(md(post.content)) }} />
          <div className="h-px my-8" style={{ background: v.div }} />
          <button onClick={() => setPost(null)} className="inline-block py-2.5 px-5 rounded-lg bg-transparent text-sm cursor-pointer font-[inherit]" style={{ border: "1px solid " + (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"), color: dark ? "#888" : "#666" }}>{"\u2190 Back to all posts"}</button>
        </article>
        <Ftr />
      </div>
    );
  }

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
          <article key={p.id} onClick={() => openPost(p.slug)} className="transition-[box-shadow,transform] duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,.08)] hover:-translate-y-0.5 rounded-xl overflow-hidden cursor-pointer" style={{ background: v.card, border: "1px solid " + v.bdr }}>
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
        )) : (
          <div className="col-span-full text-center py-[60px] px-5 text-base" style={{ color: v.mut }}>No posts yet {"\u2014"} check back soon.</div>
        )}
      </div>
      <Ftr />
    </div>
  );
}
