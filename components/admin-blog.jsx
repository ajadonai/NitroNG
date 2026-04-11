'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { fD } from "../lib/format";

const CATEGORIES = ["Tutorials", "Tips & Tricks", "Announcements", "Updates", "Guides"];

export default function AdminBlogPage({ dark, t }) {
  const confirm = useConfirm();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = list, "new" = create, post object = edit
  const [msg, setMsg] = useState(null);
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
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: "error", text: data.error || "Failed" }); setSaving(false); return false; }
      await load(); setSaving(false); return data;
    } catch { setMsg({ type: "error", text: "Request failed" }); setSaving(false); return false; }
  };

  const savePost = async () => {
    if (!title.trim() || !content.trim()) { setMsg({ type: "error", text: "Title and content required" }); return; }
    const body = { title, slug: slug || undefined, excerpt, content, category, thumbnail, published, showInHowTo };
    if (editing === "new") {
      const ok = await act({ action: "create", ...body });
      if (ok) { setEditing(null); resetForm(); setMsg({ type: "success", text: "Post created" }); }
    } else {
      const ok = await act({ action: "update", postId: editing.id, ...body });
      if (ok) { setEditing(null); resetForm(); setMsg({ type: "success", text: "Post updated" }); }
    }
  };

  const deletePost = async (post) => {
    if (!await confirm({ title: "Delete Post", message: `Delete "${post.title}"? This cannot be undone.`, confirmLabel: "Delete", danger: true })) return;
    const ok = await act({ action: "delete", postId: post.id });
    if (ok) setMsg({ type: "success", text: "Post deleted" });
  };

  const quickToggle = async (post, field) => {
    await act({ action: "update", postId: post.id, [field]: !post[field] });
  };

  const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 8, borderWidth: 1, borderStyle: "solid", borderColor: t.cardBorder, background: dark ? "#0d1020" : "#fff", color: t.text, fontSize: 15, outline: "none", fontFamily: "inherit" };

  // ── Editor View ──
  if (editing !== null) {
    return (
      <>
        <div className="adm-header">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="adm-title" style={{ color: t.text }}>{editing === "new" ? "New Post" : "Edit Post"}</div>
              <div className="adm-subtitle" style={{ color: t.textMuted }}>{editing === "new" ? "Create a new blog post" : `Editing: ${editing.title}`}</div>
            </div>
            <button onClick={() => { setEditing(null); resetForm(); }} className="adm-btn-sm" style={{ borderColor: t.cardBorder, color: t.textSoft }}>← Back</button>
          </div>
          <div className="page-divider" style={{ background: t.cardBorder }} />
        </div>

        {msg && <div style={{ padding: "8px 14px", borderRadius: 8, marginTop: 12, fontSize: 14, background: msg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: msg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{msg.type === "success" ? "✓" : "⚠️"} {msg.text}</span><button onClick={() => setMsg(null)} style={{ background: "none", color: "inherit", border: "none", cursor: "pointer" }}>✕</button></div>}

        <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, padding: 20, marginTop: 16, borderRadius: 14 }}>
          {/* Title + Slug */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 13, color: t.textMuted, fontWeight: 600, display: "block", marginBottom: 4 }}>Title</label>
              <input value={title} onChange={e => { setTitle(e.target.value); if (editing === "new") setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)); }} placeholder="Post title..." style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 13, color: t.textMuted, fontWeight: 600, display: "block", marginBottom: 4 }}>Slug</label>
              <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="auto-generated" style={inputStyle} />
            </div>
          </div>

          {/* Category + Thumbnail */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 13, color: t.textMuted, fontWeight: 600, display: "block", marginBottom: 4 }}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 13, color: t.textMuted, fontWeight: 600, display: "block", marginBottom: 4 }}>Thumbnail URL</label>
              <input value={thumbnail} onChange={e => setThumbnail(e.target.value)} placeholder="https://..." style={inputStyle} />
            </div>
          </div>

          {/* Excerpt */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: t.textMuted, fontWeight: 600, display: "block", marginBottom: 4 }}>Excerpt <span style={{ fontWeight: 400 }}>(optional — shown in previews)</span></label>
            <textarea value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="Brief description..." rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>

          {/* Content */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: t.textMuted, fontWeight: 600, display: "block", marginBottom: 4 }}>Content <span style={{ fontWeight: 400 }}>(Markdown)</span></label>
            {/* Markdown toolbar */}
            <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
              {[["H2","## ",""],["H3","### ",""],["B","**","**"],["I","*","*"],["Link","[","](url)"],["List","- ",""],["Num","1. ",""],["HR","\n---\n",""]].map(([label,before,after])=>(
                <button key={label} type="button" onClick={()=>{const ta=document.getElementById("blog-editor");if(!ta)return;const s=ta.selectionStart,e=ta.selectionEnd,sel=content.substring(s,e);const ins=after?before+(sel||"text")+after:before+sel;const next=content.substring(0,s)+ins+content.substring(e);setContent(next);setTimeout(()=>{ta.focus();ta.selectionStart=ta.selectionEnd=s+ins.length;},0);}} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", background: dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)", border: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, color: t.textMuted, cursor: "pointer" }}>{label}</button>
              ))}
            </div>
            <textarea id="blog-editor" value={content} onChange={e => setContent(e.target.value)} placeholder={"## Your heading here\n\nWrite your paragraph. Leave a blank line between paragraphs.\n\n### Subheading\n\nUse **bold** and *italic* for emphasis.\n\n- Bullet point\n- Another point\n\n1. Numbered item\n2. Another item"} rows={16} style={{ ...inputStyle, resize: "vertical", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, lineHeight: 1.6 }} />
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 13, color: t.accent, cursor: "pointer", fontWeight: 500 }}>Markdown guide</summary>
              <div style={{ marginTop: 8, padding: 14, borderRadius: 10, background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)", fontSize: 13, color: t.textMuted, lineHeight: 1.8, fontFamily: "'JetBrains Mono', monospace" }}>
                <div style={{ fontWeight: 600, color: t.text, marginBottom: 8 }}>Formatting:</div>
                <div><span style={{ color: t.accent }}>## </span>Heading — main sections</div>
                <div><span style={{ color: t.accent }}>### </span>Subheading — subsections</div>
                <div><span style={{ color: t.accent }}>**</span>bold<span style={{ color: t.accent }}>**</span> — strong emphasis</div>
                <div><span style={{ color: t.accent }}>*</span>italic<span style={{ color: t.accent }}>*</span> — subtle emphasis</div>
                <div><span style={{ color: t.accent }}>[</span>text<span style={{ color: t.accent }}>](</span>url<span style={{ color: t.accent }}>)</span> — link</div>
                <div><span style={{ color: t.accent }}>- </span>item — bullet list</div>
                <div><span style={{ color: t.accent }}>1. </span>item — numbered list</div>
                <div><span style={{ color: t.accent }}>---</span> — divider line</div>
                <div style={{ marginTop: 8, fontWeight: 600, color: t.text }}>Tips:</div>
                <div>• Blank line between paragraphs</div>
                <div>• No blank lines needed between list items</div>
                <div>• Start each section with ## heading</div>
              </div>
            </details>
          </div>

          {/* Toggles */}
          <div style={{ display: "flex", gap: 20, marginBottom: 18, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} style={{ accentColor: "#c47d8e", width: 16, height: 16 }} />
              <span style={{ fontSize: 14, color: t.text, fontWeight: 500 }}>Publish</span>
              <span style={{ fontSize: 12, color: t.textMuted }}>(visible on blog)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={showInHowTo} onChange={e => setShowInHowTo(e.target.checked)} style={{ accentColor: "#c47d8e", width: 16, height: 16 }} />
              <span style={{ fontSize: 14, color: t.text, fontWeight: 500 }}>Show in How To</span>
              <span style={{ fontSize: 12, color: t.textMuted }}>(appears on user dashboard)</span>
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="adm-title" style={{ color: t.text }}>Blog</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>{posts.length} posts · {posts.filter(p => p.published).length} published · {posts.filter(p => p.showInHowTo).length} in How To</div>
          </div>
          <button onClick={startNew} className="adm-btn-primary">+ New Post</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {msg && <div style={{ padding: "8px 14px", borderRadius: 8, marginTop: 12, fontSize: 14, background: msg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#ecfdf5") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: msg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{msg.type === "success" ? "✓" : "⚠️"} {msg.text}</span><button onClick={() => setMsg(null)} style={{ background: "none", color: "inherit", border: "none", cursor: "pointer" }}>✕</button></div>}

      <div className="adm-card" style={{ background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, marginTop: 16 }}>
        {loading ? <div className="adm-empty" style={{ color: t.textMuted }}>Loading posts...</div> : posts.length === 0 ? (
          <div className="adm-empty" style={{ color: t.textMuted, padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
            <div style={{ fontSize: 15, marginBottom: 4 }}>No blog posts yet</div>
            <div style={{ fontSize: 13 }}>Create your first post to get started.</div>
          </div>
        ) : posts.map((p, i) => (
          <div key={p.id} className="adm-list-row" style={{ borderBottom: i < posts.length - 1 ? `1px solid ${t.cardBorder}` : "none", flexWrap: "wrap", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 500, color: t.text }}>{p.title}</span>
                <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, fontWeight: 600, background: p.published ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.06)") : (dark ? "rgba(252,211,77,.1)" : "rgba(217,119,6,.06)"), color: p.published ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fcd34d" : "#d97706") }}>{p.published ? "Live" : "Draft"}</span>
                {p.showInHowTo && <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, fontWeight: 600, background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", color: "#c47d8e" }}>How To</span>}
              </div>
              <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>{p.category} · {fD(p.createdAt)} · by {p.authorName}{p.published ? ` · ${p.views} views` : ""}</div>
              {p.excerpt && <div style={{ fontSize: 13, color: t.textSoft, marginTop: 4, lineHeight: 1.4 }}>{p.excerpt.slice(0, 100)}{p.excerpt.length > 100 ? "..." : ""}</div>}
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
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
