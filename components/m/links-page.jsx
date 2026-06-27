"use client";
import { useState } from "react";
import PortalShell from "./shell";
import { StatusBadge, EmptyState, ErrorBanner } from "./kit";
import { useTheme } from "../shared-nav";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function Inner({ member, initialData }) {
  const { dark, t } = useTheme();
  const [data, setData] = useState(initialData);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  const reload = () => {
    fetch("/api/pit/links")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .catch(() => {});
  };

  const handleCreate = async () => {
    setError(null);
    if (!name.trim()) { setError("Name is required"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/pit/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() || undefined }),
      });
      const d = await res.json();
      if (d.error) { setError(d.error); return; }
      setShowCreate(false);
      setName("");
      setSlug("");
      reload();
    } catch {
      setError("Something went wrong");
    } finally {
      setCreating(false);
    }
  };

  const toggleEnabled = async (id, enabled) => {
    await fetch("/api/pit/links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: !enabled }),
    });
    reload();
  };

  const archive = async (id) => {
    await fetch("/api/pit/links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    reload();
  };

  const copyLink = (linkSlug) => {
    navigator.clipboard.writeText(`https://nitro.ng/?via=${linkSlug}`);
    setCopied(linkSlug);
    setTimeout(() => setCopied(null), 2000);
  };

  const links = data?.links || [];

  return (
    <div className="flex flex-col gap-5">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div className="text-[13px]" style={{ color: t.muted }}>{links.length} link{links.length !== 1 ? "s" : ""}</div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="py-[8px] px-4 rounded-xl text-[13px] font-semibold border-none cursor-pointer text-white transition-transform duration-150 hover:-translate-y-px"
          style={{ background: t.grad, fontFamily: "inherit" }}
        >
          + New Link
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-[14px] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
          <div className="py-[10px] px-[18px]" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${t.surfaceBrd}` }}>
            <div className="text-[12px] font-semibold tracking-[0.3px] uppercase" style={{ color: t.muted }}>Create Link</div>
          </div>
          <div className="p-[18px] flex flex-col gap-3">
            <div>
              <label className="text-[11.5px] font-medium block mb-1" style={{ color: t.muted }}>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Instagram Bio"
                className="w-full py-[9px] px-3 rounded-lg text-[13.5px] bg-transparent outline-none"
                style={{ color: t.text, border: `1px solid ${t.surfaceBrd}`, fontFamily: "inherit" }}
              />
            </div>
            <div>
              <label className="text-[11.5px] font-medium block mb-1" style={{ color: t.muted }}>Custom slug (optional)</label>
              <div className="flex items-center rounded-lg overflow-hidden" style={{ border: `1px solid ${t.surfaceBrd}` }}>
                <span className="text-[12px] py-[9px] pl-3 shrink-0" style={{ color: t.muted }}>nitro.ng/?via=</span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                  placeholder="auto"
                  className="flex-1 py-[9px] px-1 pr-3 text-[13.5px] bg-transparent outline-none border-none"
                  style={{ color: t.accent, fontFamily: "inherit" }}
                />
              </div>
            </div>
            {error && <div className="text-[12.5px]" style={{ color: t.red }}>{error}</div>}
            <div className="flex gap-2 justify-end mt-1">
              <button
                onClick={() => { setShowCreate(false); setName(""); setSlug(""); setError(null); }}
                className="py-[7px] px-4 rounded-lg text-[12.5px] font-medium border-none cursor-pointer"
                style={{ background: "transparent", color: t.muted, fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="py-[7px] px-4 rounded-lg text-[12.5px] font-semibold border-none cursor-pointer text-white disabled:opacity-50"
                style={{ background: t.grad, fontFamily: "inherit" }}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Links list */}
      {links.length === 0 ? (
        <EmptyState
          title="No tracking links yet"
          subtitle="Create your first link to start tracking referrals."
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
          t={t}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {links.map((link) => (
            <div key={link.id} className="rounded-[14px] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
              <div className="py-[10px] px-[18px] flex items-center justify-between" style={{ background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", borderBottom: `1px solid ${t.surfaceBrd}` }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-semibold truncate" style={{ color: t.text }}>{link.name}</span>
                  <StatusBadge status={link.enabled ? "active" : "suspended"} label={link.enabled ? "Active" : "Paused"} dark={dark} t={t} />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleEnabled(link.id, link.enabled)}
                    className="p-1.5 rounded-md bg-transparent border-none cursor-pointer"
                    style={{ color: t.muted }}
                    title={link.enabled ? "Pause" : "Enable"}
                  >
                    {link.enabled
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    }
                  </button>
                  <button
                    onClick={() => archive(link.id)}
                    className="p-1.5 rounded-md bg-transparent border-none cursor-pointer"
                    style={{ color: t.muted }}
                    title="Archive"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
              <div className="py-[14px] px-[18px]">
                <div className="flex items-center gap-3 mb-3 rounded-lg py-2.5 px-3" style={{ background: dark ? "rgba(196,125,142,.06)" : "rgba(196,125,142,.04)", border: `1px solid ${dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.1)"}` }}>
                  <span className="m text-[12.5px] flex-1 truncate"><span style={{ color: t.soft }}>nitro.ng/?</span><span style={{ color: t.accent, fontWeight: 600 }}>via={link.slug}</span></span>
                  <button
                    onClick={() => copyLink(link.slug)}
                    className="flex items-center gap-1 py-1 px-2.5 rounded-md text-[10px] font-semibold border-none cursor-pointer shrink-0 transition-all duration-150"
                    style={{ background: copied === link.slug ? t.green : t.grad, color: "#fff" }}
                  >
                    {copied === link.slug
                      ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied</>
                      : <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</>
                    }
                  </button>
                </div>
                <div className="flex items-center gap-4 flex-wrap text-[12px]" style={{ color: t.muted }}>
                  <span><b className="m" style={{ color: t.text }}>{link.clicks}</b> clicks</span>
                  <span><b className="m" style={{ color: t.text }}>{link.commissions}</b> conversions</span>
                  {link.affiliateName && <span>Assigned to <b style={{ color: t.text }}>{link.affiliateName}</b></span>}
                  <span>{fmtDate(link.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LinksPage({ member, initialData }) {
  return <PortalShell member={member}><Inner member={member} initialData={initialData} /></PortalShell>;
}
