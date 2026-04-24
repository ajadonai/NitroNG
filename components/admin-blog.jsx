'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { fD } from "../lib/format";

const CATEGORIES = ["Tutorials", "Tips & Tricks", "Announcements", "Updates", "Guides"];

export default function AdminBlogPage({ dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [sortNew, setSortNew] = useState(true);
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(6);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Tutorials");
  const [thumbnail, setThumbnail] = useState("");
  const [published, setPublished] = useState(false);
  const [showInHowTo, setShowInHowTo] = useState(false);

  const load = () => fetch("/api/admin/blog").then(r => r.json()).then(d => setPosts(d.posts || []));
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const resetForm = () => { setTitle(""); setSlug(""); setExcerpt(""); setContent(""); setCategory("Tutorials"); setThumbnail(""); setPublished(false); setShowInHowTo(false); };

  const startEdit = (post) => {
    setEditing(post);
    setTitle(post.title); setSlug(post.slug); setExcerpt(post.excerpt || ""); setContent(post.content);
    setCategory(post.category); setThumbnail(post.thumbnail || ""); setPublished(post.published); setShowInHowTo(post.showInHowTo);
  };

  const startNew = () => { resetForm(); setEditing("new"); };

  const act = async (body) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { toast.error("Failed", data.error || "Something went wrong"); setSaving(false); return false; }
      await load(); setSaving(false); return data;
    } catch { toast.error("Request failed", "Check your connection"); setSaving(false); return false; }
  };

  const savePost = async () => {
    if (!title.trim() || !content.trim()) { toast.error("Missing fields", "Title and content required"); return; }
    const body = { title, slug: slug || undefined, excerpt, content, category, thumbnail, published, showInHowTo };
    if (editing === "new") {
      const ok = await act({ action: "create", ...body });
      if (ok) { setEditing(null); resetForm(); toast.success("Post created", ""); }
    } else {
      const ok = await act({ action: "update", postId: editing.id, ...body });
      if (ok) { setEditing(null); resetForm(); toast.success("Post updated", ""); }
    }
  };

  const deletePost = async (post) => {
    if (!await confirm({ title: "Delete Post", message: `Delete "${post.title}"? This cannot be undone.`, confirmLabel: "Delete", danger: true })) return;
    const ok = await act({ action: "delete", postId: post.id });
    if (ok) toast.success("Post deleted", "");
  };

  const quickToggle = async (post, field) => {
    await act({ action: "update", postId: post.id, [field]: !post[field] });
  };

  const inputCls = "w-full box-border py-2.5 px-3.5 rounded-lg text-[15px] outline-none font-[inherit] border";
  const inputSt = { borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text };
  const cardBg = dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.85)";
  const cardBd = `0.5px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`;
  const headerBg = dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)";
  const headerBorder = `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)"}`;

  // ── Editor View ──
  if (editing !== null) {
    return (
      <>
        <div className="adm-header">
          <div className="flex justify-between items-center">
            <div>
              <div className="adm-title" style={{ color: t.text }}>{editing === "new" ? "New Post" : "Edit Post"}</div>
              <div className="adm-subtitle" style={{ color: t.textMuted }}>{editing === "new" ? "Create a new blog post" : `Editing: ${editing.title}`}</div>
            </div>
            <button onClick={() => { setEditing(null); resetForm(); }} className="adm-btn-sm flex items-center gap-1.5" style={{ borderColor: t.cardBorder, color: t.textSoft }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </button>
          </div>
          <div className="page-divider" style={{ background: t.cardBorder }} />
        </div>

        <div className="grid grid-cols-[1fr_320px] max-md:grid-cols-1 gap-4 mt-4">
          {/* ── Left: Content ── */}
          <div className="flex flex-col gap-4">
            {/* Title */}
            <div className="adm-card" style={{ background: cardBg, border: cardBd }}>
              <div className="set-card-header" style={{ background: headerBg, borderBottom: headerBorder }}>
                <div className="set-card-title" style={{ color: t.textMuted }}>Content</div>
              </div>
              <div className="set-card-body">
                <div className="mb-3.5">
                  <label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Title</label>
                  <input value={title} onChange={e => { setTitle(e.target.value); if (editing === "new") setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)); }} placeholder="Post title..." className={inputCls} style={inputSt} />
                </div>
                <div className="mb-3.5">
                  <label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Excerpt <span className="font-normal">(shown in previews)</span></label>
                  <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Brief description..." rows={2} className={`${inputCls} resize-y`} style={inputSt} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[13px] font-semibold" style={{ color: t.textMuted }}>Content <span className="font-normal">(Markdown)</span></label>
                    <details className="relative">
                      <summary className="text-[12px] cursor-pointer font-medium list-none flex items-center gap-1" style={{ color: t.accent }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        Markdown guide
                      </summary>
                      <div className="absolute right-0 top-full mt-1 z-10 w-[280px] p-3.5 rounded-[10px] text-[12px] leading-[1.8] shadow-lg" style={{ background: dark ? "#141828" : "#fff", border: `1px solid ${t.cardBorder}`, color: t.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
                        <div className="font-semibold mb-1.5" style={{ color: t.text }}>Formatting:</div>
                        <div><span style={{ color: t.accent }}>## </span>Heading</div>
                        <div><span style={{ color: t.accent }}>### </span>Subheading</div>
                        <div><span style={{ color: t.accent }}>**</span>bold<span style={{ color: t.accent }}>**</span></div>
                        <div><span style={{ color: t.accent }}>*</span>italic<span style={{ color: t.accent }}>*</span></div>
                        <div><span style={{ color: t.accent }}>[</span>text<span style={{ color: t.accent }}>](</span>url<span style={{ color: t.accent }}>)</span></div>
                        <div><span style={{ color: t.accent }}>- </span>bullet list</div>
                        <div><span style={{ color: t.accent }}>1. </span>numbered list</div>
                        <div><span style={{ color: t.accent }}>---</span> divider</div>
                      </div>
                    </details>
                  </div>
                  <div className="flex gap-1 mb-1.5 flex-wrap">
                    {[["H2","## ",""],["H3","### ",""],["B","**","**"],["I","*","*"],["Link","[","](url)"],["List","- ",""],["Num","1. ",""],["HR","\n---\n",""]].map(([label,before,after])=>(
                      <button key={label} type="button" onClick={()=>{const ta=document.getElementById("blog-editor");if(!ta)return;const s=ta.selectionStart,e=ta.selectionEnd,sel=content.substring(s,e);const ins=after?before+(sel||"text")+after:before+sel;const next=content.substring(0,s)+ins+content.substring(e);setContent(next);setTimeout(()=>{ta.focus();ta.selectionStart=ta.selectionEnd=s+ins.length;},0);}} className="py-1 px-2.5 rounded-md text-xs font-semibold cursor-pointer transition-transform duration-150 hover:-translate-y-px" style={{ fontFamily: "'JetBrains Mono',monospace", background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)"}`, color: t.textMuted }}>{label}</button>
                    ))}
                  </div>
                  <textarea id="blog-editor" value={content} onChange={e => setContent(e.target.value)} placeholder={"## Your heading here\n\nWrite your paragraph...\n\n### Subheading\n\nUse **bold** and *italic* for emphasis."} rows={18} className={`${inputCls} resize-y text-sm leading-[1.6]`} style={{ ...inputSt, fontFamily: "'JetBrains Mono', monospace" }} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Settings ── */}
          <div className="flex flex-col gap-4">
            {/* Publishing */}
            <div className="adm-card" style={{ background: cardBg, border: cardBd }}>
              <div className="set-card-header" style={{ background: headerBg, borderBottom: headerBorder }}>
                <div className="set-card-title" style={{ color: t.textMuted }}>Publishing</div>
              </div>
              <div className="set-card-body">
                <div className="flex flex-col gap-3 mb-4">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} className="w-4 h-4 shrink-0" style={{ accentColor: "#c47d8e" }} />
                    <div>
                      <div className="text-sm font-medium" style={{ color: t.text }}>Publish</div>
                      <div className="text-[11px]" style={{ color: t.textMuted }}>Visible on the blog</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={showInHowTo} onChange={e => setShowInHowTo(e.target.checked)} className="w-4 h-4 shrink-0" style={{ accentColor: "#c47d8e" }} />
                    <div>
                      <div className="text-sm font-medium" style={{ color: t.text }}>Show in Guide</div>
                      <div className="text-[11px]" style={{ color: t.textMuted }}>Appears on user dashboard</div>
                    </div>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={savePost} disabled={saving} className="adm-btn-primary flex-1 text-[13px]" style={{ opacity: title && content && !saving ? 1 : .4 }}>{saving ? "Saving..." : editing === "new" ? "Create Post" : "Save Changes"}</button>
                  <button onClick={() => { setEditing(null); resetForm(); }} className="adm-btn-sm text-[13px]" style={{ borderColor: t.cardBorder, color: t.textSoft }}>Cancel</button>
                </div>
              </div>
            </div>

            {/* Meta */}
            <div className="adm-card" style={{ background: cardBg, border: cardBd }}>
              <div className="set-card-header" style={{ background: headerBg, borderBottom: headerBorder }}>
                <div className="set-card-title" style={{ color: t.textMuted }}>Meta</div>
              </div>
              <div className="set-card-body">
                <div className="mb-3">
                  <label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Slug</label>
                  <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="auto-generated" className={`${inputCls} text-[13px]`} style={inputSt} />
                </div>
                <div className="mb-3">
                  <label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className={`${inputCls} text-[13px]`} style={inputSt}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Thumbnail URL</label>
                  <input value={thumbnail} onChange={e => setThumbnail(e.target.value)} placeholder="https://..." className={`${inputCls} text-[13px]`} style={inputSt} />
                  {thumbnail && <div className="mt-2 rounded-lg overflow-hidden h-[120px]" style={{ border: `1px solid ${t.cardBorder}` }}><img src={thumbnail} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} /></div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── List View ──
  const pubCount = posts.filter(p => p.published).length;
  const draftCount = posts.filter(p => !p.published).length;
  const guideCount = posts.filter(p => p.showInHowTo).length;
  const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);

  const filtered = (filter === "all" ? posts : filter === "published" ? posts.filter(p => p.published) : filter === "draft" ? posts.filter(p => !p.published) : posts.filter(p => p.showInHowTo)).slice().sort((a, b) => sortNew ? new Date(b.createdAt) - new Date(a.createdAt) : new Date(a.createdAt) - new Date(b.createdAt));
  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice(page * perPage, (page + 1) * perPage);

  return (
    <>
      <div className="adm-header">
        <div className="flex justify-between items-start">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Blog</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Manage posts, guides, and announcements</div>
          </div>
          <button onClick={startNew} className="adm-btn-primary flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Post
          </button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {/* Stats */}
      <div className="adm-stats mt-4">
        {[
          ["Published", String(pubCount), dark ? "#6ee7b7" : "#059669"],
          ["Drafts", String(draftCount), dark ? "#fcd34d" : "#d97706"],
          ["In Guide", String(guideCount), "#c47d8e"],
          ["Total Views", String(totalViews), dark ? "#60a5fa" : "#2563eb"],
        ].map(([label, val, color]) => (
          <div key={label} className="dash-stat-card" style={{ background: cardBg, border: cardBd }}>
            <div className="dash-stat-dot" style={{ background: color }} />
            <div className="dash-stat-label" style={{ color: t.textMuted }}>{label}</div>
            <div className="m dash-stat-value" style={{ color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 mt-4 mb-4 flex-wrap">
        {[["all", `All (${posts.length})`], ["published", `Published (${pubCount})`], ["draft", `Drafts (${draftCount})`], ["guide", `Guide (${guideCount})`]].map(([val, label]) => (
          <button key={val} onClick={() => { setFilter(val); setPage(0); }} className="py-1.5 px-3.5 rounded-full text-[13px] font-medium cursor-pointer font-[inherit] transition-transform duration-150 hover:-translate-y-px" style={{ border: `1px solid ${filter === val ? t.accent : t.cardBorder}`, background: filter === val ? (dark ? "rgba(196,125,142,.14)" : "rgba(196,125,142,.12)") : "transparent", color: filter === val ? t.accent : t.textMuted }}>{label}</button>
        ))}
      </div>

      {/* Posts */}
      <div className="adm-card" style={{ background: cardBg, border: cardBd }}>
        <div className="set-card-header flex items-center justify-between" style={{ background: headerBg, borderBottom: headerBorder }}>
          <div className="set-card-title" style={{ color: t.textMuted }}>Posts</div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setSortNew(v => !v); setPage(0); }} className="flex items-center gap-1 text-[12px] font-medium cursor-pointer" style={{ color: t.textMuted, background: "none", border: "none", padding: 0, fontFamily: "inherit" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points={sortNew ? "6 9 12 15 18 9" : "18 15 12 9 6 15"}/></svg>
              {sortNew ? "Newest first" : "Oldest first"}
            </button>
            <span className="text-[12px] font-medium" style={{ color: t.textMuted }}>{filtered.length} {filtered.length === 1 ? "post" : "posts"}</span>
          </div>
        </div>

        {loading ? <div className="p-5">{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[72px] rounded-lg mb-2`} />)}</div> : filtered.length === 0 ? (
          <div className="py-[60px] px-5 text-center">
            <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ display: "block", margin: "0 auto 14px", opacity: .7 }}>
              <rect x="12" y="8" width="40" height="48" rx="6" stroke={t.accent} strokeWidth="1.5" opacity=".3" />
              <line x1="22" y1="20" x2="42" y2="20" stroke={t.accent} strokeWidth="1.5" opacity=".2" strokeLinecap="round" />
              <line x1="22" y1="28" x2="38" y2="28" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
              <line x1="22" y1="36" x2="34" y2="36" stroke={t.accent} strokeWidth="1.5" opacity=".15" strokeLinecap="round" />
            </svg>
            <div className="text-base font-semibold mb-1" style={{ color: t.textSoft }}>{filter === "all" ? "No blog posts yet" : `No ${filter} posts`}</div>
            <div className="text-sm" style={{ color: t.textMuted }}>{filter === "all" ? "Create your first post to get started" : "Try a different filter"}</div>
          </div>
        ) : paged.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3.5 py-3.5 px-5 max-md:px-4 max-md:flex-col max-md:items-start max-md:gap-2.5" style={{ borderBottom: i < paged.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            {/* Thumbnail */}
            {p.thumbnail && (
              <div className="w-[72px] h-[48px] max-md:w-full max-md:h-[120px] rounded-lg overflow-hidden shrink-0" style={{ background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)" }}>
                <img src={p.thumbnail} alt="" className="w-full h-full object-cover" onError={e => { e.target.parentNode.style.display = "none"; }} />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-[15px] font-semibold" style={{ color: t.text }}>{p.title}</span>
                <span className="text-[11px] py-0.5 px-2 rounded-full font-semibold" style={{ background: p.published ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : (dark ? "rgba(252,211,77,.1)" : "rgba(217,119,6,.06)"), color: p.published ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fcd34d" : "#d97706") }}>{p.published ? "Live" : "Draft"}</span>
                {p.showInHowTo && <span className="text-[11px] py-0.5 px-2 rounded-full font-semibold" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", color: "#c47d8e" }}>Guide</span>}
              </div>
              <div className="text-[13px]" style={{ color: t.textMuted }}>
                <span className="font-medium" style={{ color: t.textSoft }}>{p.category}</span>
                {" · "}{fD(p.createdAt)} · {p.authorName}
                {p.published && p.views > 0 && <> · <span style={{ color: dark ? "#60a5fa" : "#2563eb" }}>{p.views} views</span></>}
              </div>
              {p.excerpt && <div className="text-[13px] mt-1 leading-[1.4]" style={{ color: t.textSoft }}>{p.excerpt.slice(0, 120)}{p.excerpt.length > 120 ? "..." : ""}</div>}
            </div>

            {/* Actions */}
            <div className="flex gap-1.5 items-center shrink-0 max-md:w-full">
              <button onClick={() => startEdit(p)} className="adm-btn-sm flex items-center gap-1" style={{ borderColor: t.cardBorder, color: t.accent }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
              <button onClick={() => quickToggle(p, "published")} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: p.published ? (dark ? "#fcd34d" : "#d97706") : (dark ? "#6ee7b7" : "#059669") }}>{p.published ? "Unpublish" : "Publish"}</button>
              <button onClick={() => quickToggle(p, "showInHowTo")} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: p.showInHowTo ? t.textMuted : "#c47d8e" }}>{p.showInHowTo ? "- Guide" : "+ Guide"}</button>
              <button onClick={() => deletePost(p)} className="adm-btn-sm" style={{ borderColor: dark ? "rgba(252,165,165,.28)" : "rgba(220,38,38,.24)", color: dark ? "#fca5a5" : "#dc2626" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              </button>
            </div>
          </div>
        ))}

        {totalPages > 1 && (
          <div className="flex items-center justify-between py-3 px-5" style={{ borderTop: `1px solid ${t.cardBorder}` }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="adm-btn-sm flex items-center gap-1" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: page === 0 ? .35 : 1 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Prev
            </button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[12px]" style={{ color: t.textMuted }}>
                <span>Show</span>
                <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(0); }} className="py-1 px-1.5 rounded-md text-[12px] font-medium cursor-pointer font-[inherit]" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", border: `1px solid ${t.cardBorder}`, color: t.textMuted }}>
                  {[6, 12, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <span className="text-[12px] font-medium" style={{ color: t.textMuted }}>Page {page + 1} of {totalPages}</span>
            </div>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="adm-btn-sm flex items-center gap-1" style={{ borderColor: t.cardBorder, color: t.textMuted, opacity: page >= totalPages - 1 ? .35 : 1 }}>
              Next
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
