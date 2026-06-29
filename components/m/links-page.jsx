"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { EmptyState, Modal } from "./kit";
import { useTheme } from "../shared-nav";
import { useHeaderAction } from "./shell";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/* ── Create Link Modal ── */
function CreateModal({ open, onClose, onCreated, team, memberId, leadSplit, dark, t }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState("idle");
  const [assignee, setAssignee] = useState("self");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const checkTimer = useRef(null);
  const marketerSplit = 100 - leadSplit;

  useEffect(() => {
    if (open) { setName(""); setSlug(""); setSlugEdited(false); setSlugStatus("idle"); setAssignee("self"); setError(null); }
  }, [open]);

  const checkSlug = useCallback((val) => {
    clearTimeout(checkTimer.current);
    if (!val) { setSlugStatus("idle"); return; }
    setSlugStatus("checking");
    checkTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pit/links?check=${encodeURIComponent(val)}`);
        const d = await res.json();
        setSlugStatus(d.available ? "ok" : "taken");
      } catch { setSlugStatus("idle"); }
    }, 400);
  }, []);

  const onNameChange = (val) => {
    setName(val);
    if (!slugEdited) {
      const s = slugify(val);
      setSlug(s);
      checkSlug(s);
    }
  };

  const onSlugChange = (val) => {
    const s = val.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(s);
    setSlugEdited(true);
    checkSlug(s);
  };

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) { setError("Name is required"); return; }
    if (!slug.trim()) { setError("Slug is required"); return; }
    if (slugStatus === "taken") { setError("That slug is taken"); return; }
    setCreating(true);
    try {
      const body = { name: name.trim(), slug: slug.trim() };
      if (assignee !== "self") body.affiliateId = assignee;
      const res = await fetch("/api/pit/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.error) { setError(d.error); return; }
      onClose();
      onCreated();
    } catch {
      setError("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const canCreate = name.trim() && slug.trim() && slugStatus === "ok" && !creating;
  const insetBg = dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.025)";
  const tileBg = dark ? "#161b2b" : "#fff";
  const accentTint = dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.1)";

  const getSummary = () => {
    if (assignee === "self") return <>You&apos;ll earn the <b style={{ color: t.text, fontWeight: 600 }}>full commission pot</b> on every completed order from this link.</>;
    const member = team.find(m => m.id === assignee);
    return <><b style={{ color: t.text, fontWeight: 600 }}>{member?.name}</b> earns <b style={{ color: t.text, fontWeight: 600 }}>{marketerSplit}%</b> of the pot and <b style={{ color: t.text, fontWeight: 600 }}>you earn {leadSplit}%</b> on every completed order from this link.</>;
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] backdrop-blur-[3px] flex items-center max-md:items-end justify-center p-5 max-md:p-0 animate-[modalFadeIn_.2s_ease]"
      style={{ background: dark ? "rgba(0,0,0,.45)" : "rgba(28,24,20,.34)" }}
      onClick={onClose}
    >
      <div
        className="w-[90%] max-w-[500px] max-md:w-full max-md:max-w-none rounded-[20px] max-md:rounded-b-none max-h-[92vh] max-md:max-h-[96vh] overflow-y-auto animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]"
        onClick={e => e.stopPropagation()}
        style={{
          background: dark ? "#0e1120" : "#fffdfb",
          border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.08)"}`,
          boxShadow: "0 24px 70px rgba(0,0,0,.28)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pt-[22px] px-6">
          <div>
            <div className="serif text-[22px] font-semibold tracking-[-0.3px]" style={{ color: t.text }}>New tracking link</div>
            <div className="text-[13px] mt-1 leading-relaxed" style={{ color: t.muted }}>Create a link, then keep it for yourself or hand it to a crew member.</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-[9px] border-none flex items-center justify-center shrink-0 cursor-pointer" style={{ background: insetBg, color: t.muted }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pt-5">
          {/* Name */}
          <div className="mb-[18px]">
            <label className="text-[12.5px] font-semibold mb-[7px] flex items-center gap-[7px]" style={{ color: t.soft }}>
              Link name <span className="font-normal text-[11px]" style={{ color: t.muted }}>so you recognise it later</span>
            </label>
            <input
              value={name}
              onChange={e => onNameChange(e.target.value)}
              placeholder="e.g. IG business owners"
              className="w-full rounded-[11px] py-3 px-[14px] text-[14.5px] outline-none transition-all duration-150"
              style={{
                background: tileBg,
                border: `1px solid ${t.surfaceBrd}`,
                color: t.text,
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Slug */}
          <div className="mb-[18px]">
            <label className="text-[12.5px] font-semibold mb-[7px] block" style={{ color: t.soft }}>Link slug</label>
            <div
              className="flex items-center rounded-[11px] px-[14px] transition-all duration-150"
              style={{ background: tileBg, border: `1px solid ${t.surfaceBrd}` }}
            >
              <span className="m text-[14px] shrink-0" style={{ color: t.muted }}>nitro.ng/?via=</span>
              <input
                value={slug}
                onChange={e => onSlugChange(e.target.value)}
                placeholder="ig-business-owners"
                className="flex-1 min-w-0 m text-[14px] font-semibold py-3 px-1 bg-transparent border-none outline-none"
                style={{ color: t.accent, fontFamily: "'JetBrains Mono', monospace" }}
              />
            </div>
            <div className="flex items-center gap-[5px] text-[11.5px] font-semibold mt-[7px] min-h-[16px]" style={{
              color: slugStatus === "ok" ? t.green : slugStatus === "taken" ? t.red : t.muted,
            }}>
              {slugStatus === "ok" && <>✓ Available</>}
              {slugStatus === "taken" && <>✕ Unavailable</>}
              {slugStatus === "checking" && <>Checking...</>}
              {slugStatus === "idle" && <>Lowercase letters, numbers and dashes.</>}
            </div>
          </div>

          {/* Assignee */}
          <div className="mb-[18px]">
            <label className="text-[12.5px] font-semibold mb-[7px] block" style={{ color: t.soft }}>Assign to</label>
            <div className="flex flex-col gap-2">
              {/* Self */}
              <button
                onClick={() => setAssignee("self")}
                className="w-full flex items-center gap-3 py-[11px] px-[13px] rounded-xl cursor-pointer border-none text-left transition-all duration-150"
                style={{
                  background: assignee === "self" ? accentTint : tileBg,
                  border: `1px solid ${assignee === "self" ? t.accent : t.surfaceBrd}`,
                  boxShadow: assignee === "self" ? `0 0 0 1px ${t.accent} inset` : "none",
                  fontFamily: "inherit",
                }}
              >
                <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center text-[12px] font-bold text-white shrink-0" style={{ background: t.grad }}>
                  {initials("You")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold" style={{ color: t.text }}>Yourself</div>
                  <div className="text-[11.5px]" style={{ color: t.muted }}>Run it as your own link</div>
                </div>
                <span className="text-[10.5px] font-bold tracking-[.3px] py-1 px-[9px] rounded-[7px] shrink-0 whitespace-nowrap" style={{
                  color: assignee === "self" ? t.accent : t.soft,
                  background: assignee === "self" ? "rgba(196,125,142,.16)" : insetBg,
                }}>100% you</span>
                <div className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: assignee === "self" ? t.accent : t.surfaceBrd }}>
                  {assignee === "self" && <div className="w-[9px] h-[9px] rounded-full" style={{ background: t.accent }} />}
                </div>
              </button>

              {/* Team members */}
              {team.map(m => (
                <button
                  key={m.id}
                  onClick={() => setAssignee(m.id)}
                  className="w-full flex items-center gap-3 py-[11px] px-[13px] rounded-xl cursor-pointer border-none text-left transition-all duration-150"
                  style={{
                    background: assignee === m.id ? accentTint : tileBg,
                    border: `1px solid ${assignee === m.id ? t.accent : t.surfaceBrd}`,
                    boxShadow: assignee === m.id ? `0 0 0 1px ${t.accent} inset` : "none",
                    fontFamily: "inherit",
                  }}
                >
                  <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center text-[12px] font-bold text-white shrink-0" style={{ background: t.grad }}>
                    {initials(m.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold" style={{ color: t.text }}>{m.name}</div>
                    {m.handle && <div className="text-[11.5px]" style={{ color: t.muted }}>@{m.handle}</div>}
                  </div>
                  <span className="text-[10.5px] font-bold tracking-[.3px] py-1 px-[9px] rounded-[7px] shrink-0 whitespace-nowrap" style={{
                    color: assignee === m.id ? t.accent : t.soft,
                    background: assignee === m.id ? "rgba(196,125,142,.16)" : insetBg,
                  }}>{marketerSplit} / {leadSplit}</span>
                  <div className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: assignee === m.id ? t.accent : t.surfaceBrd }}>
                    {assignee === m.id && <div className="w-[9px] h-[9px] rounded-full" style={{ background: t.accent }} />}
                  </div>
                </button>
              ))}

            </div>
          </div>

          {/* Summary */}
          <div className="flex gap-[10px] items-start rounded-xl py-3 px-[14px] mb-1 text-[12.5px] leading-relaxed" style={{ background: accentTint, border: `1px solid rgba(196,125,142,.2)`, color: t.soft }}>
            <svg className="shrink-0 mt-px" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>{getSummary()}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-[10px] py-[18px] px-6 mt-1.5 sticky bottom-0" style={{
          borderTop: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)"}`,
          background: dark ? "#0e1120" : "#fffdfb",
        }}>
          {error && <span className="text-[11.5px] mr-auto" style={{ color: t.red }}>{error}</span>}
          <span className="mr-auto" />
          <button
            onClick={onClose}
            className="py-[11px] px-[18px] rounded-[11px] text-[14px] font-semibold border cursor-pointer"
            style={{ background: "transparent", color: t.soft, borderColor: t.surfaceBrd, fontFamily: "inherit" }}
          >Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="py-[11px] px-[18px] rounded-[11px] text-[14px] font-semibold border-none cursor-pointer text-white disabled:opacity-45 disabled:cursor-not-allowed"
            style={{ background: t.grad, fontFamily: "inherit", boxShadow: canCreate ? "0 4px 14px rgba(196,125,142,.28)" : "none" }}
          >{creating ? "Creating..." : "Create link"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Link Card ── */
const ACTION_LABELS = { created: "Created", reassigned: "Reassigned", paused: "Paused", resumed: "Resumed", deleted: "Deleted" };
const ACTION_ICONS = {
  created: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  reassigned: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
  paused: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>,
  resumed: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  deleted: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>,
};

function LinkCard({ link, isSelf, dark, t, copied, onCopy, onToggle, onArchive, onReassign, team, expanded, onExpand }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logs, setLogs] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  useEffect(() => {
    if (!expanded) return;
    fetch(`/api/pit/links?logs=${link.id}`).then(r => r.json()).then(d => setLogs(d.logs || [])).catch(() => setLogs([]));
  }, [expanded, link.id]);

  const active = link.enabled;
  const rate = link.clicks > 0 ? ((link.commissions / link.clicks) * 100).toFixed(1) : "0";
  const dimClass = !active ? "opacity-55" : "";

  const tint = isSelf
    ? (dark ? "rgba(196,125,142,.10)" : "rgba(196,125,142,.08)")
    : active
      ? (dark ? "rgba(110,231,183,.07)" : "rgba(5,150,105,.06)")
      : (dark ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.03)");
  const brd = isSelf
    ? (dark ? "rgba(196,125,142,.32)" : "rgba(196,125,142,.28)")
    : active
      ? (dark ? "rgba(110,231,183,.22)" : "rgba(5,150,105,.20)")
      : (dark ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.09)");

  const tileBg = dark ? "#161b2b" : "#fff";

  return (
    <div
      className="rounded-[18px] p-5 max-md:p-4 transition-transform duration-150 hover:-translate-y-px"
      style={{ background: tint, border: `1px solid ${brd}`, boxShadow: dark ? "none" : "0 1px 2px rgba(0,0,0,.04),0 8px 22px rgba(0,0,0,.05)" }}
    >
      {/* Top row */}
      <div className="flex items-center gap-[11px] cursor-pointer" onClick={onExpand}>
        <svg className="shrink-0 transition-transform duration-200" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2" style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}><polyline points="9 18 15 12 9 6"/></svg>
        <span className="text-[15.5px] font-semibold tracking-[-0.1px]" style={{ color: t.text }}>{link.name}</span>
        {isSelf && <span className="text-[10px] font-bold tracking-[.4px] uppercase py-[3px] px-2 rounded-md" style={{ color: t.accent, background: "rgba(196,125,142,.16)" }}>Self</span>}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold py-[3px] px-[8px] rounded-md" style={{
            color: active ? t.green : t.muted,
            background: active ? (dark ? "rgba(110,231,183,.1)" : "rgba(5,150,105,.08)") : (dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"),
          }}>{active ? "Active" : "Paused"}</span>
          {/* Kebab */}
          <div className="relative" ref={menuRef} onClick={e => e.stopPropagation()}>
          <button onClick={() => setMenuOpen(o => !o)} className="w-[30px] h-[30px] rounded-lg border-none flex items-center justify-center cursor-pointer" style={{ background: "transparent", color: t.muted }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
          </button>
          {menuOpen && (
            <div className="absolute top-9 right-0 min-w-[150px] rounded-[11px] p-[5px] z-10" style={{ background: dark ? "#0f1320" : "#fffdfb", border: `1px solid ${t.surfaceBrd}`, boxShadow: "0 12px 30px rgba(0,0,0,.18)" }}>
              <button onClick={() => { setMenuOpen(false); onReassign(link); }} className="w-full text-left flex items-center gap-[9px] py-[9px] px-[11px] rounded-[7px] text-[13px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: t.soft, fontFamily: "inherit" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                Reassign
              </button>
              <button onClick={() => { setMenuOpen(false); onToggle(link.id, link.enabled); }} className="w-full text-left flex items-center gap-[9px] py-[9px] px-[11px] rounded-[7px] text-[13px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: t.soft, fontFamily: "inherit" }}>
                {active
                  ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>Pause link</>
                  : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>Resume link</>
                }
              </button>
              <button onClick={() => { setMenuOpen(false); onArchive(link.id); }} className="w-full text-left flex items-center gap-[9px] py-[9px] px-[11px] rounded-[7px] text-[13px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: dark ? "#fca5a5" : "#dc2626", fontFamily: "inherit" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
              </button>
            </div>
          )}
          </div>
        </div>
      </div>

      {expanded && <>
        {/* URL line */}
        <div className={`flex items-center gap-3 mt-4 mb-4 max-md:mt-3 max-md:mb-3 py-[14px] px-[18px] max-md:flex-col max-md:items-stretch max-md:gap-[10px] rounded-xl ${dimClass}`} style={{ background: tileBg, border: `1px solid ${t.surfaceBrd}` }}>
          <span className="m text-[14.5px] flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            <span style={{ color: t.soft }}>nitro.ng/?</span><span style={{ color: t.accent, fontWeight: 600 }}>via={link.slug}</span>
          </span>
          <button
            onClick={() => onCopy(link.slug)}
            className="flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-white border-none rounded-[9px] py-2 px-[14px] cursor-pointer transition-opacity duration-150 shrink-0 opacity-95 hover:opacity-100"
            style={{ background: copied === link.slug ? t.green : t.grad, fontFamily: "inherit" }}
          >
            {copied === link.slug
              ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
              : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
            }
          </button>
        </div>

        {/* Stats */}
        <div className={`grid grid-cols-3 gap-3 ${dimClass}`}>
          {[
            { n: link.clicks.toLocaleString(), k: "Clicks", color: t.text },
            { n: link.commissions.toLocaleString(), k: "Conversions", color: t.green },
            { n: `${rate}%`, k: "Rate", color: t.accent },
          ].map(s => (
            <div key={s.k} className="rounded-xl py-[13px] px-[15px]" style={{ background: tileBg, border: `1px solid ${t.surfaceBrd}` }}>
              <div className="m text-[21px] max-md:text-[17px] font-semibold tracking-[-0.5px] leading-none" style={{ color: s.color }}>{s.n}</div>
              <div className="text-[11px] font-medium mt-1.5" style={{ color: t.muted }}>{s.k}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 mt-4 text-[12.5px]" style={{ color: t.muted }}>
          <span className="w-5 h-5 rounded-md text-white flex items-center justify-center text-[9px] font-bold shrink-0" style={{ background: t.grad }}>{initials(isSelf ? "You" : link.affiliateName)}</span>
          <span>Assigned to <b style={{ color: t.soft, fontWeight: 600 }}>{isSelf ? "You" : link.affiliateName}</b></span>
          <span style={{ opacity: .5 }}>·</span>
          <span>Created {fmtDate(link.createdAt)}</span>
        </div>

        {/* Activity */}
        {logs && logs.length > 0 && (
          <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${t.surfaceBrd}` }}>
            <div className="text-[11px] font-semibold uppercase tracking-[.5px] mb-2" style={{ color: t.muted }}>Activity</div>
            <div className="flex flex-col gap-[6px]">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-2 text-[12px]" style={{ color: t.muted }}>
                  <span className="mt-px shrink-0" style={{ color: log.action === "reassigned" ? t.accent : t.muted }}>{ACTION_ICONS[log.action] || ACTION_ICONS.created}</span>
                  <span className="flex-1 min-w-0"><b style={{ color: t.soft, fontWeight: 600 }}>{log.actorName}</b> {log.detail?.toLowerCase() || ACTION_LABELS[log.action]?.toLowerCase() || log.action}</span>
                  <span className="shrink-0 text-[11px]">{fmtDate(log.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>}
    </div>
  );
}

/* ── Main Page ── */
export default function LinksPage({ initialData }) {
  const { dark, t } = useTheme();
  const [data, setData] = useState(initialData);
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("new");
  const [reassignLink, setReassignLink] = useState(null);
  const [reassignTo, setReassignTo] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const memberId = data?.memberId;
  const team = data?.team || [];
  const leadSplit = data?.leadSplit || 40;

  useHeaderAction(useMemo(() => (
    <button
      onClick={() => setShowCreate(true)}
      className="flex items-center gap-[7px] py-[11px] px-[18px] rounded-[11px] text-[14px] font-semibold border-none cursor-pointer text-white shrink-0"
      style={{ background: t.grad, fontFamily: "inherit", boxShadow: "0 4px 14px rgba(196,125,142,.28)" }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      New Link
    </button>
  ), [t.grad]));

  const reload = () => {
    setRefreshing(true);
    fetch("/api/pit/links")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData({ ...d, memberId, leadSplit }); })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  };

  const toggleEnabled = async (id, enabled) => {
    await fetch("/api/pit/links", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, enabled: !enabled }) });
    reload();
  };

  const archive = async (id) => {
    await fetch("/api/pit/links", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    reload();
  };

  const handleReassign = async () => {
    if (!reassignLink) return;
    const body = { id: reassignLink.id };
    if (reassignTo === "unassigned") body.affiliateId = null;
    else body.affiliateId = reassignTo || memberId;
    await fetch("/api/pit/links", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setReassignLink(null);
    setReassignTo("");
    reload();
  };

  const copyLink = (linkSlug) => {
    navigator.clipboard.writeText(`https://nitro.ng/?via=${linkSlug}`);
    setCopied(linkSlug);
    setTimeout(() => setCopied(null), 2000);
  };

  const allLinks = data?.links || [];

  const filtered = useMemo(() => {
    let list = allLinks;
    if (filter === "active") list = list.filter(l => l.enabled);
    if (filter === "paused") list = list.filter(l => !l.enabled);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.slug.toLowerCase().includes(q) ||
        (l.affiliateName || "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "new") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sort === "old") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === "clicks") return b.clicks - a.clicks;
      if (sort === "conv") return b.commissions - a.commissions;
      if (sort === "rate") return (b.clicks ? b.commissions / b.clicks : 0) - (a.clicks ? a.commissions / a.clicks : 0);
      return 0;
    });
  }, [allLinks, filter, query, sort]);

  const ctrlBg = dark ? "#0f1320" : "#fffdfb";
  const ctrlShadow = dark ? "none" : "0 1px 2px rgba(0,0,0,.04),0 8px 22px rgba(0,0,0,.05)";

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      {allLinks.length > 0 && (
        <>
          <div className="flex items-center gap-[10px] flex-wrap">
            <label className="flex items-center gap-[9px] flex-1 min-w-[200px] max-md:flex-[100%] max-md:order-[-1] px-[13px] rounded-[11px]" style={{ background: ctrlBg, border: `1px solid ${t.surfaceBrd}`, boxShadow: ctrlShadow }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by link, slug or person" className="border-none bg-transparent outline-none text-[14px] py-[11px] w-full" style={{ color: t.text, fontFamily: "inherit" }} />
            </label>
            <div className="relative flex items-center rounded-[11px] px-[11px] max-md:ml-auto" style={{ background: ctrlBg, border: `1px solid ${t.surfaceBrd}`, boxShadow: ctrlShadow }}>
              <select value={filter} onChange={e => setFilter(e.target.value)} className="appearance-none border-none bg-transparent outline-none text-[13.5px] font-semibold py-[11px] pr-5 cursor-pointer capitalize" style={{ color: t.text, fontFamily: "inherit" }}>
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
              <svg className="absolute right-[11px] pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div className="relative flex items-center rounded-[11px] px-[11px]" style={{ background: ctrlBg, border: `1px solid ${t.surfaceBrd}`, boxShadow: ctrlShadow }}>
              <select value={sort} onChange={e => setSort(e.target.value)} className="appearance-none border-none bg-transparent outline-none text-[13.5px] font-semibold py-[11px] pr-5 cursor-pointer" style={{ color: t.text, fontFamily: "inherit" }}>
                <option value="new">Newest</option>
                <option value="old">Oldest</option>
                <option value="clicks">Most clicks</option>
                <option value="conv">Most conversions</option>
                <option value="rate">Best rate</option>
              </select>
              <svg className="absolute right-[11px] pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.muted} strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div className="text-[12.5px] font-medium mx-0.5" style={{ color: t.muted }}>{filtered.length} link{filtered.length !== 1 ? "s" : ""}</div>
        </>
      )}

      {/* Create modal */}
      <CreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={reload} team={team} memberId={memberId} leadSplit={leadSplit} dark={dark} t={t} />

      {/* Reassign modal */}
      <Modal open={!!reassignLink} onClose={() => setReassignLink(null)} title="Reassign Link" subtitle={reassignLink?.name} dark={dark} t={t}>
        <div>
          <label className="text-[11.5px] font-medium block mb-1" style={{ color: t.muted }}>Assign to</label>
          <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="w-full py-[9px] px-3 rounded-lg text-[13.5px] bg-transparent outline-none" style={{ color: t.text, border: `1px solid ${t.surfaceBrd}`, fontFamily: "inherit" }}>
            <option value="">Me</option>
            {team.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
          </select>
        </div>
        <div className="flex gap-2 justify-end mt-1">
          <button onClick={() => setReassignLink(null)} className="py-[7px] px-4 rounded-lg text-[12.5px] font-medium border-none cursor-pointer" style={{ background: "transparent", color: t.muted, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={handleReassign} className="py-[7px] px-4 rounded-lg text-[12.5px] font-semibold border-none cursor-pointer text-white" style={{ background: t.grad, fontFamily: "inherit" }}>Reassign</button>
        </div>
      </Modal>

      {/* Links */}
      {allLinks.length === 0 ? (
        <EmptyState
          title="No tracking links yet"
          subtitle="Create your first link to start tracking referrals."
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
          t={t}
        />
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-[14px]" style={{ color: t.muted }}>No links match your search.</div>
      ) : (
        <div className="flex flex-col gap-4 transition-opacity duration-200" style={{ opacity: refreshing ? 0.6 : 1 }}>
          {filtered.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              isSelf={link.affiliateId === memberId}
              dark={dark}
              t={t}
              copied={copied}
              onCopy={copyLink}
              onToggle={toggleEnabled}
              onArchive={archive}
              onReassign={(l) => { setReassignTo(l.affiliateId === memberId ? "" : l.affiliateId); setReassignLink(l); }}
              team={team}
              expanded={expandedId === link.id}
              onExpand={() => setExpandedId(expandedId === link.id ? null : link.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
