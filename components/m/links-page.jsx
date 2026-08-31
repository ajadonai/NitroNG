"use client";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Card, Chip, Empty, Fact, Facts, Field, Modal, initialsOf, longDate, pitVars } from "./kit";
import { useTheme } from "../shared-nav";
import { useToast } from "../toast";
import { useHeaderAction } from "./shell";
import { copyText } from '@/lib/clipboard';

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/* ── Create link ── */
function CreateModal({ open, onClose, onCreated, team, leadSplit }) {
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
    const submittedSlug = slug.trim();
    try {
      const body = { name: name.trim(), slug: submittedSlug };
      if (assignee !== "self") body.affiliateId = assignee;
      const res = await fetch("/api/pit/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "The server returned an invalid response");
      onClose();
      onCreated();
    } catch (err) {
      // The insert may have committed even if the response failed afterwards.
      // Reconcile with the server before telling the user creation failed.
      try {
        const checkRes = await fetch("/api/pit/links", { cache: "no-store" });
        const checkData = await checkRes.json();
        if (checkRes.ok && checkData.links?.some((link) => link.slug === submittedSlug)) {
          onClose();
          onCreated();
          return;
        }
      } catch {}
      setError(`Something went wrong: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const canCreate = name.trim() && slug.trim() && slugStatus === "ok" && !creating;
  const hint = slugStatus === "ok" ? "That one is free."
    : slugStatus === "taken" ? "Someone already has that one."
      : slugStatus === "checking" ? "Checking…"
        : "Lowercase letters, numbers and dashes.";
  const summary = assignee === "self"
    ? "You keep the whole commission pot on every order this link brings in."
    : `${team.find(m => m.id === assignee)?.name} takes ${marketerSplit}% of the pot, you take ${leadSplit}%, on every order this link brings in.`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New tracking link"
      sub="One link per place you promote. Keep it, or hand it to someone in your crew."
      wide
      footer={<>
        {error && <span className="pt-err">{error}</span>}
        <button type="button" className="pt-b" onClick={onClose}>Cancel</button>
        <button type="button" className="pt-b pri" disabled={!canCreate} onClick={handleCreate}>{creating ? "Creating…" : "Create link"}</button>
      </>}
    >
      <Field label="Link name" value={name} onChange={onNameChange} placeholder="e.g. IG business owners" hint="So you recognise it later." />
      <label className="pt-lbl">Link slug</label>
      <div className="lnk-slug">
        <span className="m">nitro.ng/?via=</span>
        <input className="m" value={slug} onChange={e => onSlugChange(e.target.value)} placeholder="ig-business-owners" />
      </div>
      <div className={"pt-hint" + (slugStatus === "ok" ? " ok" : slugStatus === "taken" ? " bad" : "")}>{hint}</div>

      <label className="pt-lbl">Whose link is it</label>
      <div className="lnk-pick">
        <button type="button" className={"lnk-op" + (assignee === "self" ? " on" : "")} onClick={() => setAssignee("self")}>
          <span className="pt-av sm">{initialsOf("You")}</span>
          <span className="pt-tt"><b>Yourself</b><i>Run it as your own link</i></span>
          <span className="pt-c">100% you</span>
        </button>
        {team.map(m => (
          <button key={m.id} type="button" className={"lnk-op" + (assignee === m.id ? " on" : "")} onClick={() => setAssignee(m.id)}>
            <span className="pt-av sm">{initialsOf(m.name)}</span>
            <span className="pt-tt"><b>{m.name}</b><i>{m.handle ? `@${m.handle}` : "In your crew"}</i></span>
            <span className="pt-c">{marketerSplit} / {leadSplit}</span>
          </button>
        ))}
      </div>
      <div className="pt-note" style={{ marginTop: 10 }}>{summary}</div>
    </Modal>
  );
}

/* ── The detail that opens under a row ── */
const ACTION_LABELS = { created: "created", reassigned: "reassigned", paused: "paused", resumed: "resumed", deleted: "deleted" };

function LinkDetail({ link, isSelf, copied, onCopy, onReassign, onArchive }) {
  const [logs, setLogs] = useState(null);
  useEffect(() => {
    fetch(`/api/pit/links?logs=${link.id}`).then(r => r.json()).then(d => setLogs(d.logs || [])).catch(() => setLogs([]));
  }, [link.id]);
  const rate = link.clicks > 0 ? ((link.commissions / link.clicks) * 100).toFixed(1) : "0";
  return (
    <div className="lnk-x">
      <div className="lnk-url">
        <span className="m">nitro.ng/?via={link.slug}</span>
        <button type="button" className="pt-b sm" onClick={() => onCopy(link.slug)}>{copied === link.slug ? "Copied" : "Copy"}</button>
      </div>
      <div className="lnk-tiles">
        <span><b className="m">{link.clicks.toLocaleString()}</b><i>Clicks</i></span>
        <span><b className="m">{link.commissions.toLocaleString()}</b><i>Paid</i></span>
        <span><b className="m">{rate}%</b><i>Of clicks</i></span>
      </div>
      <div className="pt-note">Assigned to {isSelf ? "you" : link.affiliateName || "nobody"} · made {longDate(link.createdAt)}</div>
      {logs && logs.length > 0 && (
        <div className="lnk-log">
          {logs.map(log => (
            <div key={log.id} className="lnk-lr">
              <b>{log.actorName}</b>
              <i>{log.detail?.toLowerCase() || ACTION_LABELS[log.action] || log.action}</i>
              <span className="pt-c">{longDate(log.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="lnk-xf">
        <button type="button" className="pt-b sm" onClick={() => onReassign(link)}>Hand it to someone</button>
        <button type="button" className="pt-b sm bad" onClick={() => onArchive(link.id)}>Delete</button>
      </div>
    </div>
  );
}

/* ── Page ── */
export default function LinksPage({ initialData }) {
  const { dark, t } = useTheme();
  const toast = useToast();
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
    <button type="button" className="pt-b pri" onClick={() => setShowCreate(true)}>+ New link</button>
  ), []));

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
    toast.success(enabled ? "Link paused" : "Link activated");
    reload();
  };

  const archive = async (id) => {
    await fetch("/api/pit/links", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    toast.success("Link archived");
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
    toast.success("Link reassigned");
    reload();
  };

  const copyLink = (linkSlug) => {
    copyText(`https://nitro.ng/?via=${linkSlug}`);
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

  const clicks = allLinks.reduce((n, l) => n + l.clicks, 0);
  const paid = allLinks.reduce((n, l) => n + l.commissions, 0);
  const live = allLinks.filter(l => l.enabled).length;
  const best = [...allLinks].sort((a, b) => b.clicks - a.clicks)[0] || null;

  return (
    <div className="lnk" style={pitVars(dark, t)}>
      <style>{LNK_CSS}</style>

      <Facts>
        <Fact value={clicks.toLocaleString()} label="Clicks" sub={`across ${allLinks.length} ${allLinks.length === 1 ? "link" : "links"}`} />
        <Fact value={paid.toLocaleString()} label="Paid" sub={clicks ? `${((paid / clicks) * 100).toFixed(1)}% of clicks` : "no clicks yet"} kind="ok" />
        <Fact value={String(allLinks.length)} label="Links" sub={`${live} live, ${allLinks.length - live} paused`} />
        <Fact value={best ? best.name : "—"} label="Busiest link" sub={best ? `${best.clicks.toLocaleString()} clicks` : "nothing to compare yet"} mono={false} />
      </Facts>

      {allLinks.length > 0 && (
        <div className="pt-bar">
          <label className="pt-srch">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a link, a slug or a person" />
          </label>
          <select className="pt-sel" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter links">
            <option value="all">All</option>
            <option value="active">Live</option>
            <option value="paused">Paused</option>
          </select>
          <select className="pt-sel" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort links">
            <option value="new">Newest</option>
            <option value="old">Oldest</option>
            <option value="clicks">Most clicks</option>
            <option value="conv">Most paid</option>
            <option value="rate">Best rate</option>
          </select>
          <span className="pt-cnt">{filtered.length} {filtered.length === 1 ? "link" : "links"}</span>
        </div>
      )}

      <CreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => { reload(); toast.success("Link created"); }} team={team} leadSplit={leadSplit} />

      <Modal
        open={!!reassignLink}
        onClose={() => setReassignLink(null)}
        title="Hand this link over"
        sub={reassignLink?.name}
        footer={<>
          <button type="button" className="pt-b" onClick={() => setReassignLink(null)}>Cancel</button>
          <button type="button" className="pt-b pri" onClick={handleReassign}>Hand it over</button>
        </>}
      >
        <label className="pt-lbl">Whose link is it now</label>
        <select className="pt-in" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
          <option value="">Me</option>
          {team.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
        </select>
      </Modal>

      <Card title="Links" cnt="tap the short link to copy it">
        {allLinks.length === 0 ? (
          <Empty>No links yet. Make one and start tracking.</Empty>
        ) : filtered.length === 0 ? (
          <Empty>No link matches that.</Empty>
        ) : <>
          <div className="pt-lh">
            <span>Link</span><span className="r">Clicks</span><span className="r">Paid</span><span>Whose</span><span /><span />
          </div>
          <div className="pt-list" style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity 200ms" }}>
            {filtered.map((link) => {
              const isSelf = link.affiliateId === memberId;
              return (
                <div key={link.id}>
                  <div className="pt-r lk">
                    <span className="pt-tt">
                      <b>{link.name}</b>
                      <button type="button" className="pt-cp m" onClick={() => copyLink(link.slug)}>
                        {copied === link.slug ? "Copied" : `nitro.ng/?via=${link.slug} ⧉`}
                      </button>
                    </span>
                    <span className="pt-num m">{link.clicks.toLocaleString()}</span>
                    <span className="pt-num m">{link.commissions.toLocaleString()}</span>
                    <span className="pt-c">{isSelf ? "You" : link.affiliateName || "Nobody"}</span>
                    <Chip kind={link.enabled ? "ok" : "dim"}>{link.enabled ? "Live" : "Paused"}</Chip>
                    <span className="pt-acts">
                      <button type="button" className="pt-b sm" onClick={() => setExpandedId(expandedId === link.id ? null : link.id)}>Stats</button>
                      <button type="button" className="pt-b sm" onClick={() => toggleEnabled(link.id, link.enabled)}>{link.enabled ? "Pause" : "Start"}</button>
                    </span>
                  </div>
                  {expandedId === link.id && (
                    <LinkDetail
                      link={link}
                      isSelf={isSelf}
                      copied={copied}
                      onCopy={copyLink}
                      onReassign={(l) => { setReassignTo(l.affiliateId === memberId ? "" : l.affiliateId); setReassignLink(l); }}
                      onArchive={archive}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>}
      </Card>
    </div>
  );
}

const LNK_CSS = `
.lnk{display:flex;flex-direction:column;gap:14px}
.lnk-slug{display:flex;align-items:center;gap:2px;height:38px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--in)}
.lnk-slug>span{font-size:13px;color:var(--mut);flex-shrink:0}
.lnk-slug input{flex:1;min-width:0;border:0;background:none;outline:none;font:inherit;font-size:13px;font-weight:700;color:var(--ac)}
.lnk-pick{display:flex;flex-direction:column;gap:6px}
.lnk-op{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:11px;border:1px solid var(--line);background:var(--card);font:inherit;font-size:13px;color:var(--ink);cursor:pointer;text-align:left}
.lnk-op.on{border-color:var(--ac)}
.lnk-op .pt-c{margin-left:auto}
.lnk-x{padding:0 16px 14px;display:flex;flex-direction:column;gap:10px;background:var(--soft);border-top:1px solid var(--rail)}
.lnk-url{display:flex;align-items:center;gap:10px;margin-top:12px;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);min-width:0}
.lnk-url span{flex:1;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lnk-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.lnk-tiles span{display:flex;flex-direction:column;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--card)}
.lnk-tiles b{font-size:18px;font-weight:800}
.lnk-tiles i{font-style:normal;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-top:3px}
.lnk-log{display:flex;flex-direction:column}
.lnk-lr{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:baseline;padding:6px 0;border-top:1px solid var(--rail);font-size:12.5px;color:var(--mut)}
.lnk-lr:first-child{border-top:0}
.lnk-lr b{font-weight:600;color:var(--ink)}
.lnk-lr i{font-style:normal;min-width:0;overflow:hidden;text-overflow:ellipsis}
.lnk-xf{display:flex;gap:8px}
.lnk .pt-list>div+div>.pt-r{border-top:1px solid var(--rail)}
@media (min-width:900.99px){
  .lnk .pt-lh{grid-template-columns:1fr 80px 70px 110px 70px 124px}
  .lnk .pt-r.lk{grid-template-columns:1fr 80px 70px 110px 70px 124px}
}
@media (max-width:900.98px){
  .lnk .pt-r.lk{grid-template-areas:"tt tt" "cnt ty" "act act"}
  .lnk .pt-r.lk .pt-num{display:none}
  .lnk .pt-r.lk .pt-c{justify-self:start}
  .lnk-tiles{grid-template-columns:1fr}
}
`;
