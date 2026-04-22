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

  // Form state
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
            <button onClick={() => { setEditing(null); resetForm(); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft }}>← Back</button>
          </div>
          <div className="page-divider" style={{ background: t.cardBorder }} />
        </div>


        <div className="adm-card p-5 mt-4 rounded-[14px]" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
          {/* Title + Slug */}
          <div className="grid grid-cols-2 gap-3 mb-3.5">
            <div>
              <label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Title</label>
              <input value={title} onChange={e => { setTitle(e.target.value); if (editing === "new") setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)); }} placeholder="Post title..." className={inputCls} style={inputSt} />
            </div>
            <div>
              <label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Slug</label>
              <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="auto-generated" className={inputCls} style={inputSt} />
            </div>
          </div>

          {/* Category + Thumbnail */}
          <div className="grid grid-cols-2 gap-3 mb-3.5">
            <div>
              <label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls} style={inputSt}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Thumbnail URL</label>
              <input value={thumbnail} onChange={e => setThumbnail(e.target.value)} placeholder="https://..." className={inputCls} style={inputSt} />
            </div>
          </div>

          {/* Excerpt */}
          <div className="mb-3.5">
            <label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Excerpt <span className="font-normal">(optional — shown in previews)</span></label>
            <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Brief description..." rows={2} className={`${inputCls} resize-y`} style={inputSt} />
          </div>

          {/* Content */}
          <div className="mb-3.5">
            <label className="text-[13px] font-semibold block mb-1" style={{ color: t.textMuted }}>Content <span className="font-normal">(Markdown)</span></label>
            {/* Markdown toolbar */}
            <div className="flex gap-1 mb-1.5 flex-wrap">
              {[["H2","## ",""],["H3","### ",""],["B","**","**"],["I","*","*"],["Link","[","](url)"],["List","- ",""],["Num","1. ",""],["HR","\n---\n",""]].map(([label,before,after])=>(
                <button key={label} type="button" onClick={()=>{const ta=document.getElementById("blog-editor");if(!ta)return;const s=ta.selectionStart,e=ta.selectionEnd,sel=content.substring(s,e);const ins=after?before+(sel||"text")+after:before+sel;const next=content.substring(0,s)+ins+content.substring(e);setContent(next);setTimeout(()=>{ta.focus();ta.selectionStart=ta.selectionEnd=s+ins.length;},0);}} className="py-1 px-2.5 rounded-md text-xs font-semibold cursor-pointer" style={{ fontFamily: "'JetBrains Mono',monospace", background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, color: t.textMuted }}>{label}</button>
              ))}
            </div>
            <textarea id="blog-editor" value={content} onChange={e => setContent(e.target.value)} placeholder={"## Your heading here\n\nWrite your paragraph. Leave a blank line between paragraphs.\n\n### Subheading\n\nUse **bold** and *italic* for emphasis.\n\n- Bullet point\n- Another point\n\n1. Numbered item\n2. Another item"} rows={16} className={`${inputCls} resize-y text-sm leading-[1.6]`} style={{ ...inputSt, fontFamily: "'JetBrains Mono', monospace" }} />
            <details className="mt-2">
              <summary className="text-[13px] cursor-pointer font-medium" style={{ color: t.accent }}>Markdown guide</summary>
              <div className="mt-2 p-3.5 rounded-[10px] text-[13px] leading-[1.8]" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", color: t.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
                <div className="font-semibold mb-2" style={{ color: t.text }}>Formatting:</div>
                <div><span style={{ color: t.accent }}>## </span>Heading — main sections</div>
                <div><span style={{ color: t.accent }}>### </span>Subheading — subsections</div>
                <div><span style={{ color: t.accent }}>**</span>bold<span style={{ color: t.accent }}>**</span> — strong emphasis</div>
                <div><span style={{ color: t.accent }}>*</span>italic<span style={{ color: t.accent }}>*</span> — subtle emphasis</div>
                <div><span style={{ color: t.accent }}>[</span>text<span style={{ color: t.accent }}>](</span>url<span style={{ color: t.accent }}>)</span> — link</div>
                <div><span style={{ color: t.accent }}>- </span>item — bullet list</div>
                <div><span style={{ color: t.accent }}>1. </span>item — numbered list</div>
                <div><span style={{ color: t.accent }}>---</span> — divider line</div>
                <div className="mt-2 font-semibold" style={{ color: t.text }}>Tips:</div>
                <div>• Blank line between paragraphs</div>
                <div>• No blank lines needed between list items</div>
                <div>• Start each section with ## heading</div>
              </div>
            </details>
          </div>

          {/* Toggles */}
          <div className="flex gap-5 mb-[18px] flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} className="w-4 h-4" style={{ accentColor: "#c47d8e" }} />
              <span className="text-sm font-medium" style={{ color: t.text }}>Publish</span>
              <span className="text-xs" style={{ color: t.textMuted }}>(visible on blog)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showInHowTo} onChange={e => setShowInHowTo(e.target.checked)} className="w-4 h-4" style={{ accentColor: "#c47d8e" }} />
              <span className="text-sm font-medium" style={{ color: t.text }}>Show in How To</span>
              <span className="text-xs" style={{ color: t.textMuted }}>(appears on user dashboard)</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={savePost} disabled={saving} className="adm-btn-primary" style={{ opacity: title && content && !saving ? 1 : .4 }}>{saving ? "Saving..." : editing === "new" ? "Create Post" : "Save Changes"}</button>
            <button onClick={() => { setEditing(null); resetForm(); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft }}>Cancel</button>
          </div>
        </div>
      </>
    );
  }

  // ── List View ──
  return (
    <>
      <div className="adm-header">
        <div className="flex justify-between items-start">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Blog</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{posts.length} posts · {posts.filter(p => p.published).length} published · {posts.filter(p => p.showInHowTo).length} in How To</div>
          </div>
          <button onClick={startNew} className="adm-btn-primary">+ New Post</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>


      <div className="adm-card mt-4" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}` }}>
        {loading ? <div className="adm-empty">{[1,2,3].map(i => <div key={i} className={`skel-bone ${dark ? "skel-dark" : "skel-light"} h-[60px] rounded-lg mb-2`} />)}</div> : posts.length === 0 ? (
          <div className="adm-empty p-10 text-center" style={{ color: t.textMuted }}>
            <div className="text-[32px] mb-3">📝</div>
            <div className="text-[15px] mb-1">No blog posts yet</div>
            <div className="text-[13px]">Create your first post to get started.</div>
          </div>
        ) : posts.map((p, i) => (
          <div key={p.id} className="adm-list-row flex-wrap gap-2.5" style={{ borderBottom: i < posts.length - 1 ? `1px solid ${t.cardBorder}` : "none" }}>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[15px] font-medium" style={{ color: t.text }}>{p.title}</span>
                <span className="text-[11px] py-px px-1.5 rounded font-semibold" style={{ background: p.published ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : (dark ? "rgba(252,211,77,.1)" : "rgba(217,119,6,.06)"), color: p.published ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fcd34d" : "#d97706") }}>{p.published ? "Live" : "Draft"}</span>
                {p.showInHowTo && <span className="text-[11px] py-px px-1.5 rounded font-semibold" style={{ background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", color: "#c47d8e" }}>How To</span>}
              </div>
              <div className="text-[13px] mt-0.5" style={{ color: t.textMuted }}>{p.category} · {fD(p.createdAt)} · by {p.authorName}{p.published ? ` · ${p.views} views` : ""}</div>
              {p.excerpt && <div className="text-[13px] mt-1 leading-[1.4]" style={{ color: t.textSoft }}>{p.excerpt.slice(0, 100)}{p.excerpt.length > 100 ? "..." : ""}</div>}
            </div>
            <div className="flex gap-1 items-center flex-wrap">
              <button onClick={() => startEdit(p)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.accent }}>Edit</button>
              <button onClick={() => quickToggle(p, "published")} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: p.published ? (dark ? "#fcd34d" : "#d97706") : (dark ? "#6ee7b7" : "#059669") }}>{p.published ? "Unpublish" : "Publish"}</button>
              <button onClick={() => quickToggle(p, "showInHowTo")} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: p.showInHowTo ? t.textMuted : "#c47d8e" }}>{p.showInHowTo ? "Remove from How To" : "Add to How To"}</button>
              <button onClick={() => deletePost(p)} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: dark ? "#fca5a5" : "#dc2626" }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
