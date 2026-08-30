'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";
import { useToast } from "./toast";
import { FilterDropdown } from "./date-range-picker";
import { SkelFacts, SkelList, SkelBar } from "./skeleton";

const CATEGORIES = ["Tutorials", "Tips & Tricks", "Announcements", "Updates", "Guides"];
const SORTS = [{ value: "new", label: "Newest" }, { value: "old", label: "Oldest" }, { value: "views", label: "Most read" }];
const SORT_WORD = { new: "newest first", old: "oldest first", views: "most read first" };
const SEARCH = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></svg>;

export default function AdminBlogPage({ dark, t }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("new");
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
    if (ok) { setEditing(null); resetForm(); toast.success("Post deleted", ""); }
  };

  const quickToggle = async (post, field) => {
    await act({ action: "update", postId: post.id, [field]: !post[field] });
  };

  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": t.accent, "--acln": dark ? "rgba(196,125,142,.7)" : "rgba(196,125,142,.55)", "--ok": dark ? "#6ee7b7" : "#0a7d54", "--bad": dark ? "#fca5a5" : "#c62828",
  };

  const inputCls = "w-full box-border py-2.5 px-3.5 rounded-lg text-[15px] outline-none font-[inherit] border";
  const inputSt = { borderColor: t.cardBorder, background: dark ? "#131728" : "#fff", color: t.text };
  const cardBg = dark ? "#141930" : "#ffffff";
  const cardBd = `0.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`;
  const headerBg = dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)";
  const headerBorder = `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`;

  // ── Editor View ──
  if (editing !== null) {
    return (
      <div className="bl" style={vars}>
        <style>{BL_CSS}</style>
        <div className="adm-header">
          <div className="adm-header-row">
            <div>
              <div className="adm-title" style={{ color: t.text }}>{editing === "new" ? "New post" : "Edit post"}</div>
              <div className="adm-subtitle" style={{ color: t.textMuted }}>{editing === "new" ? "Write a post, guide or research piece." : editing.title}</div>
            </div>
            <button type="button" className="bl-b" onClick={() => { setEditing(null); resetForm(); }}>Back to posts</button>
          </div>
          <div className="page-divider" style={{ background: t.cardBorder }} />
        </div>

        <div className="grid grid-cols-[1fr_320px] max-md:grid-cols-1 gap-4">
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
                      <button key={label} type="button" onClick={()=>{const ta=document.getElementById("blog-editor");if(!ta)return;const s=ta.selectionStart,e=ta.selectionEnd,sel=content.substring(s,e);const ins=after?before+(sel||"text")+after:before+sel;const next=content.substring(0,s)+ins+content.substring(e);setContent(next);setTimeout(()=>{ta.focus();ta.selectionStart=ta.selectionEnd=s+ins.length;},0);}} className="py-1 px-2.5 rounded-md text-xs font-semibold cursor-pointer transition-transform duration-150 hover:-translate-y-px" style={{ fontFamily: "'JetBrains Mono',monospace", background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)", border: `1px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.12)"}`, color: t.textMuted }}>{label}</button>
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
                  <button type="button" onClick={savePost} disabled={saving} className="bl-b pri flex-1" style={{ opacity: title && content && !saving ? 1 : .4 }}>{saving ? "Saving…" : editing === "new" ? "Create post" : "Save changes"}</button>
                  {editing !== "new" && <button type="button" onClick={() => deletePost(editing)} disabled={saving} className="bl-b bad">Delete</button>}
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
                  <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${t.cardBorder}`, background: dark ? "#131728" : "#fff" }}>
                    <span className="inline-flex items-center px-3 text-[13px] font-semibold shrink-0 select-none" style={{ borderRight: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, color: t.textMuted }}>https://</span>
                    <input value={thumbnail} onChange={e => setThumbnail(e.target.value)} placeholder="i.imgur.com/..." className="w-full box-border py-2.5 px-3.5 text-[13px] outline-none font-[inherit] border-0" style={{ background: "transparent", color: t.text }} />
                  </div>
                  {thumbnail && <div className="mt-2 rounded-lg overflow-hidden h-[120px]" style={{ border: `1px solid ${t.cardBorder}` }}><img src={thumbnail} alt="Thumbnail preview" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} /></div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List View ──
  const dateOf = (iso) => { const d = new Date(iso); const yr = d.getFullYear() !== new Date().getFullYear(); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(yr && { year: "numeric" }) }); };
  const liveCount = posts.filter(p => p.published).length;
  const draftCount = posts.length - liveCount;
  const guideCount = posts.filter(p => p.showInHowTo).length;
  const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
  const mostRead = posts.reduce((best, p) => (p.views || 0) > (best?.views || 0) ? p : best, null);

  const q = query.trim().toLowerCase();
  const filtered = (filter === "all" ? posts : filter === "published" ? posts.filter(p => p.published) : filter === "draft" ? posts.filter(p => !p.published) : posts.filter(p => p.showInHowTo))
    .filter(p => !q || (p.title || "").toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q) || (p.slug || "").includes(q))
    .slice().sort((a, b) => sort === "views" ? (b.views || 0) - (a.views || 0) : sort === "old" ? new Date(a.createdAt) - new Date(b.createdAt) : new Date(b.createdAt) - new Date(a.createdAt));
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice(page * perPage, (page + 1) * perPage);
  const from = filtered.length ? page * perPage + 1 : 0;
  const to = Math.min((page + 1) * perPage, filtered.length);
  const chips = [["all", "All", posts.length], ["published", "Live", liveCount], ["draft", "Drafts", draftCount], ["guide", "Guide", guideCount]];

  return (
    <div className="bl" style={vars}>
      <style>{BL_CSS}</style>
      <div className="adm-header">
        <div className="adm-header-row">
          <div>
            <div className="adm-title" style={{ color: t.text }}>Blog</div>
            <div className="adm-subtitle" style={{ color: t.textMuted }}>Posts, guides and research.</div>
          </div>
          <button type="button" className="bl-b pri" onClick={startNew}>+ New post</button>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>

      {loading ? <><SkelFacts dark={dark} /><SkelBar dark={dark} /><SkelList dark={dark} rows={6} title avatar="square" rowH={62} /></> : <>
        <div className="bl-stats">
          <div className="bl-stt"><b className="m">{posts.length}</b><span>Posts</span><i>{liveCount} live · {draftCount} {draftCount === 1 ? "draft" : "drafts"}</i></div>
          <div className="bl-stt"><b className="m">{guideCount}</b><span>In the guide</span><i>shown on Help</i></div>
          <div className="bl-stt"><b className="m">{totalViews.toLocaleString()}</b><span>Views</span><i>all time</i></div>
          <div className="bl-stt"><b className="m">{mostRead?.views ? mostRead.views.toLocaleString() : "—"}</b><span>Most read</span><i title={mostRead?.views ? mostRead.title : undefined}>{mostRead?.views ? mostRead.title : "no views yet"}</i></div>
        </div>

        <div className="bl-bar">
          <div className="bl-srch"><span className="bl-si">{SEARCH}</span><input value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Search" /></div>
          {chips.map(([val, label, n]) => (
            <button key={val} type="button" className={"bl-tg" + (filter === val ? " on" : "")} onClick={() => { setFilter(val); setPage(0); }}>{label} {n}</button>
          ))}
          <FilterDropdown dark={dark} t={t} value={sort} onChange={v => { setSort(v); setPage(0); }} options={SORTS} />
        </div>

        <section className="bl-card">
          <header><h3>Posts</h3><span className="bl-cnt">{SORT_WORD[sort]} · {from}–{to} of {filtered.length}</span></header>
          <div className="bl-list">
            {paged.length === 0 ? <div className="bl-empty">{posts.length === 0 ? "No posts yet." : "Nothing matches."}</div> : paged.map(p => (
              <div key={p.id} className="bl-r">
                <span className="bl-thumb">{p.thumbnail && <img src={p.thumbnail} alt="" onError={e => { e.target.style.display = "none"; }} />}</span>
                <span className="bl-tt"><b>{p.title}</b><i>{p.category} · {dateOf(p.createdAt)}{p.showInHowTo ? " · in the guide" : ""}</i></span>
                <span className="m bl-mid">{(p.views || 0).toLocaleString()} views</span>
                <span className="bl-st"><i className={"bl-dot " + (p.published ? "ok" : "dim")} />{p.published ? "Live" : "Draft"}</span>
                <span className="bl-a">
                  <button type="button" className="bl-b sm" disabled={saving} onClick={() => startEdit(p)}>Edit</button>
                  <button type="button" className="bl-b sm" disabled={saving} onClick={() => quickToggle(p, "published")}>{p.published ? "Unpublish" : "Publish"}</button>
                </span>
              </div>
            ))}
          </div>
          <div className="bl-pg">
            <span className="bl-cnt">{from}–{to} of {filtered.length} ·
              <select className="bl-pp" value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(0); }}>{[6, 12, 25, 50].map(n => <option key={n} value={n}>{n} per page</option>)}</select>
            </span>
            {totalPages > 1 && (
              <span className="bl-pgn">
                <button type="button" className="bl-ib" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} aria-label="Previous page">‹</button>
                <span className="bl-cnt">{page + 1} of {totalPages}</span>
                <button type="button" className="bl-ib" disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} aria-label="Next page">›</button>
              </span>
            )}
          </div>
        </section>
      </>}
    </div>
  );
}

const BL_CSS = `
.bl{display:flex;flex-direction:column;gap:14px;color:var(--ink)}
.bl *{box-sizing:border-box}
.bl .m{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.bl-b{font:inherit;font-size:12.5px;font-weight:600;height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;transition:transform .15s}.bl-b:hover{transform:translateY(-1px)}.bl-b:disabled{opacity:.5;cursor:not-allowed;transform:none}
.bl-b.sm{height:30px;padding:0 10px;font-size:12px}.bl-b.pri{background:var(--ac);color:#fff;border-color:var(--ac)}.bl-b.bad{color:var(--bad)}
.bl-stats{display:grid;grid-template-columns:repeat(4,1fr);background:var(--card);border:1px solid var(--line);border-radius:14px}
.bl-stt{padding:12px 16px;border-left:1px solid var(--line);display:flex;flex-direction:column;min-width:0}.bl-stt:first-child{border-left:0}
.bl-stt b{font-size:20px;font-weight:800;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bl-stt span{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:2px;white-space:nowrap}.bl-stt i{font-style:normal;font-size:11.5px;color:var(--dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.bl-srch{display:flex;align-items:center;gap:8px;height:36px;padding:0 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);font-size:13px;min-width:260px}.bl-srch:focus-within{border-color:var(--acln)}
.bl-si{display:inline-flex;width:14px;height:14px;color:var(--dim);flex-shrink:0}.bl-si svg{width:14px;height:14px}.bl-srch input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13px;color:var(--ink);outline:none}.bl-srch input::placeholder{color:var(--dim)}
.bl-tg{font:inherit;font-size:12.5px;font-weight:600;padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);cursor:pointer;white-space:nowrap}.bl-tg.on{background:var(--ink);color:var(--card);border-color:var(--ink)}
.bl-bar>div:last-child{margin-left:auto}
.bl-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.bl-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}.bl-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.bl-cnt{font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-list{display:flex;flex-direction:column}.bl-empty{padding:28px 16px;text-align:center;font-size:13px;color:var(--mut)}
.bl-r{display:grid;grid-template-columns:44px 1fr 80px 80px auto;align-items:center;gap:12px;padding:11px 16px;border-top:1px solid var(--rail);font-size:13px}.bl-r:first-child{border-top:0}
.bl-thumb{width:44px;height:34px;border-radius:8px;background:var(--soft);border:1px solid var(--line);overflow:hidden;flex-shrink:0;display:block}.bl-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.bl-tt{display:flex;flex-direction:column;min-width:0}.bl-tt b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bl-tt i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-mid{font-size:12px;color:var(--mut);white-space:nowrap}
.bl-st{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--mut);white-space:nowrap}.bl-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}.bl-dot.ok{background:var(--ok)}.bl-dot.dim{background:var(--dim)}
.bl-a{display:flex;gap:6px;justify-content:flex-end}
.bl-pg{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid var(--line);background:var(--soft)}
.bl-pp{font:inherit;font-size:12px;color:var(--ac);font-weight:600;background:none;border:0;cursor:pointer;padding:0 0 0 4px}
.bl-pgn{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;flex-shrink:0}
.bl-ib{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--mut);font:inherit;font-size:14px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}.bl-ib:disabled{opacity:.4;cursor:not-allowed}
@media (max-width:900px){
  .bl-stats{grid-template-columns:1fr 1fr}.bl-stt:nth-child(3){border-left:0}.bl-stt:nth-child(n+3){border-top:1px solid var(--line)}.bl-stt b{font-size:17px}
  .bl-srch{width:100%;min-width:0}.bl-tg{flex:1;text-align:center;padding:8px 6px}
  .bl-r{grid-template-columns:44px 1fr;grid-template-areas:"th tt" "th meta" "acts acts";gap:6px 10px;padding:12px 14px}
  .bl-thumb{grid-area:th;align-self:start}.bl-tt{grid-area:tt}.bl-tt b{white-space:normal}.bl-tt i{white-space:normal}
  .bl-mid{grid-area:meta}.bl-st{grid-area:meta;justify-self:end}
  .bl-a{grid-area:acts;justify-content:stretch;margin-top:4px}.bl-a .bl-b{flex:1;height:36px}
  .bl-pg{flex-wrap:wrap}
}
`;
