'use client';
import { useEffect, useMemo, useState } from "react";
import { useConfirm } from "./confirm-dialog";
import { fD } from "../lib/format";
import AnnouncementBanner from "./announcement-banner";

// Three things on one page: what is live right now across every audience, a
// composer that shows the strip exactly as people will see it, and the past
// notices with a one-tap restore. Several notices can be live at once; the
// newest shows first. Nothing on a live row is destructive: Take down moves a
// notice to Past, and Remove lives there, where it means what it says.
const AUD = { everyone: "Everyone", landing: "Visitors", users: "Users", admin: "Admin" };
const TYPES = [["info", "Notice"], ["warning", "Heads up"], ["success", "Fixed"], ["urgent", "Urgent"]];
const EXPIRY = [["never", "When I take it down"], ["6h", "6 h"], ["24h", "24 h"], ["3d", "3 days"]];
const EXPIRY_MS = { "6h": 6 * 3600e3, "24h": 24 * 3600e3, "3d": 3 * 86400e3 };
// An explainer: a line of text on a desktop, an (i) you tap on a phone.
function Hint({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="aa-hintw">
      <span className="aa-hint">{text}</span>
      <button type="button" className="aa-i" aria-label="What this means" onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>i</button>
      {open && <><span className="aa-iback" onClick={e => { e.stopPropagation(); setOpen(false); }} /><span className="aa-pop" onClick={e => e.stopPropagation()}>{text}</span></>}
    </span>
  );
}

const PLACEHOLDER = "What is affected · what it means for them · what we are doing. e.g. Instagram Followers *Budget* is delivering slower than usual. Orders still go through, just past the estimate.";
const CH = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;

const bold = (msg) => String(msg || "").split(/(\*[^*]+\*)/).map((p, i) => p.startsWith("*") && p.endsWith("*") ? <b key={i}>{p.slice(1, -1)}</b> : p);
const post = (body) => fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function AdminAlertsPage({ dark, t }) {
  const confirm = useConfirm();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pastShown, setPastShown] = useState(6);
  const blank = { target: "users", type: "info", message: "", actionLabel: "", actionHref: "", expiry: "never" };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);      // alert id being edited, if any
  const [composeOpen, setComposeOpen] = useState(false); // the composer is a closed card until you need it
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch("/api/admin/alerts").then(r => r.json()).then(d => { setAlerts(d.alerts || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const live = useMemo(() => alerts.filter(a => a.active), [alerts]);
  const past = useMemo(() => alerts.filter(a => !a.active), [alerts]);
  const liveFor = (target) => live.filter(a => a.target === target || a.target === "everyone" || target === "everyone");

  const submit = async () => {
    const message = form.message.trim();
    if (!message || saving) return;
    setSaving(true);
    try {
      const hasAction = form.actionLabel.trim() && form.actionHref.trim();
      const expiresAt = EXPIRY_MS[form.expiry] ? new Date(Date.now() + EXPIRY_MS[form.expiry]).toISOString() : null;
      if (editing) {
        const res = await post({ action: "update", id: editing, message, type: form.type, target: form.target, actionLabel: hasAction ? form.actionLabel.trim() : null, actionHref: hasAction ? form.actionHref.trim() : null, expiresAt });
        if (res.ok) setAlerts(prev => prev.map(a => a.id === editing ? { ...a, message, type: form.type, target: form.target, actionLabel: hasAction ? form.actionLabel.trim() : null, actionHref: hasAction ? form.actionHref.trim() : null, expiresAt } : a));
      } else {
        const body = { action: "create", message, type: form.type, target: form.target, expiresAt };
        if (hasAction) { body.actionLabel = form.actionLabel.trim(); body.actionHref = form.actionHref.trim(); }
        const res = await post(body);
        const data = await res.json();
        if (res.ok && data.alert) setAlerts(prev => [{ ...data.alert, expiresAt, created: data.alert.created || new Date().toISOString() }, ...prev]);
      }
      setForm(blank); setEditing(null);
    } catch {}
    setSaving(false);
  };

  const setActive = async (id, active) => {
    try {
      const res = await post({ action: "toggle", id });
      if (res.ok) setAlerts(prev => prev.map(a => a.id === id ? { ...a, active } : a));
    } catch {}
  };
  const remove = async (a) => {
    const ok = await confirm({ title: "Remove notice", message: `Remove "${a.message.slice(0, 60)}${a.message.length > 60 ? "…" : ""}" for good?`, confirmLabel: "Remove", danger: true });
    if (!ok) return;
    try { const res = await post({ action: "delete", id: a.id }); if (res.ok) setAlerts(prev => prev.filter(x => x.id !== a.id)); } catch {}
  };
  const edit = (a) => {
    setEditing(a.id);
    setForm({ target: a.target, type: a.type, message: a.message, actionLabel: a.actionLabel || "", actionHref: a.actionHref || "", expiry: "never" });
    document.getElementById("aa-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const vars = {
    "--card": dark ? "#141930" : "#ffffff", "--ink": t.text, "--mut": t.textMuted, "--dim": dark ? "#5c6170" : "#a19b93",
    "--line": t.cardBorder, "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)", "--soft": dark ? "#111634" : "#faf9f7",
    "--ac": dark ? "#e0a0b0" : "#c47d8e", "--ac-bg": dark ? "rgba(196,125,142,.16)" : "rgba(196,125,142,.09)",
    "--warn": dark ? "#fcd34d" : "#b45309", "--warn-bg": dark ? "rgba(251,191,36,.12)" : "rgba(217,119,6,.09)",
    "--ok": dark ? "#6ee7b7" : "#0a7d54", "--ok-bg": dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.09)",
    "--bad": dark ? "#fca5a5" : "#c62828", "--bad-bg": dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.09)",
    "--pri": t.accent,
  };
  const tcls = { info: "t-ac", warning: "t-warn", success: "t-ok", urgent: "t-bad" };
  const tlabel = Object.fromEntries(TYPES);
  const previewAlerts = [
    { id: "preview", message: form.message.trim() || "Your notice will read like this.", type: form.type, actionLabel: form.actionLabel.trim() && form.actionHref.trim() ? form.actionLabel.trim() : null, actionHref: form.actionHref.trim() || null },
    ...liveFor(form.target).filter(a => a.id !== editing),
  ];

  const Row = ({ a, livePane }) => (
    <div className={`aa-row ${tcls[a.type] || "t-ac"}`}>
      <div className="aa-top"><span className="aa-dot" /><span className="aa-lbl">{tlabel[a.type] || "Notice"}</span><span className="aa-aud">{AUD[a.target] || a.target}</span></div>
      <div className="aa-msg">{bold(a.message)}{a.actionLabel && a.actionHref && <a className="aa-act" href={a.actionHref} target="_blank" rel="noopener noreferrer">{a.actionLabel}{CH}</a>}</div>
      <div className="aa-foot">
        <span className="aa-when">{a.created ? fD(a.created) : ""}{a.expiresAt ? ` · comes down ${fD(a.expiresAt)}` : ""}</span>
        <span className="aa-acts">
        {livePane
          ? <><button type="button" className="aa-b" onClick={() => setActive(a.id, false)}>Take down</button><button type="button" className="aa-b" onClick={() => edit(a)}>Edit</button></>
          : <><button type="button" className="aa-b sm" onClick={() => setActive(a.id, true)}>Restore</button><button type="button" className="aa-b sm danger" onClick={() => remove(a)}>Remove</button></>}
        </span>
      </div>
    </div>
  );

  return (
    <>
      <div className="adm-header">
        <div>
          <div className="adm-title" style={{ color: t.text }}>Announcements</div>
          <div className="adm-subtitle" style={{ color: t.textMuted }}>Notices at the top of the site. Several can be live at once; the newest shows first.</div>
        </div>
        <div className="page-divider" style={{ background: t.cardBorder }} />
      </div>
      <div className="aa" style={vars}>
        <style>{CSS}</style>

        <section className="aa-card">
          <header><h3>Live now</h3><span className="aa-cnt">{loading ? "Loading…" : `${live.length} ${live.length === 1 ? "notice" : "notices"}`}</span></header>
          {!loading && live.length === 0 && <div className="aa-empty">Nothing is live. Post a notice below and it shows at once.</div>}
          {live.map(a => <Row key={a.id} a={a} livePane />)}
        </section>

        <section className={`aa-card aa-composer${composeOpen || editing ? " open" : ""}`} id="aa-composer">
          <header onClick={() => { if (editing) return; setComposeOpen(v => !v); }} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!editing) setComposeOpen(v => !v); } }}>
            <h3>{editing ? "Edit notice" : "Post a notice"}</h3>
            <span className="aa-cnt">{composeOpen || editing ? <Hint text="Shows at the top of the site for the audience you pick." /> : "Open to write one"}<i className={`aa-chev${composeOpen || editing ? " up" : ""}`} /></span>
          </header>
          {(composeOpen || editing) && <div className="aa-cb">
            <div className="aa-row2">
              <div className="aa-fld"><label>Who sees it</label><div className="aa-segs">{Object.entries(AUD).map(([k, v]) => <button type="button" key={k} className={`aa-seg${form.target === k ? " on" : ""}`} onClick={() => set("target", k)}>{v}</button>)}</div></div>
              <div className="aa-fld"><label>What kind</label><div className="aa-segs aa-types">{TYPES.map(([k, v]) => <button type="button" key={k} className={`aa-seg ${tcls[k]}${form.type === k ? " on" : ""}`} onClick={() => set("type", k)}><i />{v}</button>)}</div></div>
            </div>
            <div className="aa-fld">
              <label>Message</label>
              <textarea className="aa-ta" rows={3} value={form.message} onChange={e => set("message", e.target.value)} placeholder={PLACEHOLDER} />
              <Hint text="Say what is affected, what it means for them, and what we are doing about it. Put *stars* around a word to make it bold." />
            </div>
            <div className="aa-row2">
              <div className="aa-fld"><label>Link <em>optional</em></label><div className="aa-inl"><input className="aa-in" value={form.actionLabel} onChange={e => set("actionLabel", e.target.value)} placeholder="Link text" /><input className="aa-in wide" value={form.actionHref} onChange={e => set("actionHref", e.target.value)} placeholder="https://nitro.ng/…" /></div></div>
              <div className="aa-fld"><label>Comes down</label><div className="aa-segs">{EXPIRY.map(([k, v]) => <button type="button" key={k} className={`aa-seg${form.expiry === k ? " on" : ""}`} onClick={() => set("expiry", k)}>{v}</button>)}</div></div>
            </div>
            <div className="aa-fld"><label>How it will look</label><AnnouncementBanner alerts={previewAlerts} dark={dark} mode="dashboard" preview /></div>
            <div className="aa-foot">
              <button type="button" className="aa-pri" disabled={!form.message.trim() || saving} onClick={submit}>{saving ? "Saving…" : editing ? "Save changes" : "Post notice"}</button>
              {editing && <button type="button" className="aa-b" onClick={() => { setEditing(null); setForm(blank); setComposeOpen(false); }}>Cancel</button>}
              <Hint text="It goes live the moment you post. When more than one is live, the newest shows first." />
            </div>
          </div>}
        </section>

        <section className="aa-card">
          <header><h3>Past notices</h3><span className="aa-cnt"><Hint text="Taken down but kept. Restore puts one back as it was. Remove deletes it for good." /></span></header>
          {!loading && past.length === 0 && <div className="aa-empty">No past notices yet.</div>}
          {past.slice(0, pastShown).map(a => <Row key={a.id} a={a} />)}
          {past.length > pastShown && <button type="button" className="aa-more" onClick={() => setPastShown(n => n + 12)}>Show {Math.min(12, past.length - pastShown)} more</button>}
        </section>
      </div>
    </>
  );
}

const CSS = `
.aa{display:flex;flex-direction:column;gap:16px;color:var(--ink)}
.aa *{box-sizing:border-box}
.aa-card{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.aa-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:11px 16px;border-bottom:1px solid var(--line)}
.aa-composer>header{cursor:pointer;user-select:none;border-bottom:0}.aa-composer.open>header{border-bottom:1px solid var(--line)}.aa-composer>header:hover{background:var(--soft)}
.aa-chev{display:inline-block;width:8px;height:8px;border-right:1.5px solid var(--dim);border-bottom:1.5px solid var(--dim);transform:rotate(45deg);margin:0 3px 3px 10px;transition:transform .15s}.aa-chev.up{transform:rotate(-135deg);margin-bottom:-2px}
.aa-card h3{margin:0;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut);font-weight:700}.aa-cnt{font-size:11.5px;color:var(--dim);text-align:right}
.aa-empty{padding:18px 16px;font-size:13px;color:var(--dim)}
.t-ac{--c:var(--ac);--cbg:var(--ac-bg)}.t-warn{--c:var(--warn);--cbg:var(--warn-bg)}.t-ok{--c:var(--ok);--cbg:var(--ok-bg)}.t-bad{--c:var(--bad);--cbg:var(--bad-bg)}
.aa-dot{width:8px;height:8px;border-radius:50%;background:var(--c);flex-shrink:0;box-shadow:0 0 0 3px var(--cbg)}
.aa-lbl{font-size:10.5px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--c);flex-shrink:0}
.aa-aud{font-size:10.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--mut);background:var(--soft);border:1px solid var(--line);padding:2px 7px;border-radius:999px}

.aa-row{padding:12px 16px;border-top:1px solid var(--rail);display:flex;flex-direction:column;gap:8px}.aa-row:first-of-type{border-top:0}
.aa-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.aa-msg{font-size:13.5px;line-height:1.45;padding-left:16px}.aa-msg b{font-weight:700}
.aa-act{display:inline-flex;align-items:center;gap:3px;font-size:12.5px;font-weight:700;color:var(--c);white-space:nowrap;text-decoration:none;margin-left:8px}.aa-act svg{width:12px;height:12px}
.aa-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;padding-left:16px}.aa-when{font-size:11.5px;color:var(--dim);white-space:nowrap}.aa-acts{display:flex;gap:6px;flex-shrink:0}
.aa-b{font:inherit;font-size:12px;font-weight:600;padding:6px 11px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}.aa-b.danger{color:var(--bad)}.aa-b.sm{padding:4px 9px;font-size:11.5px}
.aa-more{display:block;width:100%;padding:10px;border:0;border-top:1px solid var(--rail);background:transparent;color:var(--mut);font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.aa-cb{padding:14px 16px 16px;display:flex;flex-direction:column;gap:14px}
.aa-row2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.aa-fld{display:flex;flex-direction:column;gap:6px;min-width:0}.aa-fld label{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)}.aa-fld label em{font-style:normal;font-weight:500;letter-spacing:0;text-transform:none;color:var(--dim);margin-left:4px}
.aa-segs{display:flex;gap:4px;padding:3px;border-radius:11px;background:var(--soft);border:1px solid var(--line)}
.aa-seg{flex:1;font:inherit;font-size:12.5px;font-weight:600;padding:7px 8px;border-radius:8px;border:0;background:transparent;color:var(--mut);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}
.aa-seg.on{background:var(--card);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.aa-types .aa-seg i{width:7px;height:7px;border-radius:50%;background:var(--c)}.aa-types .aa-seg.on{color:var(--c)}
.aa-ta{width:100%;min-height:74px;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;font-size:13.5px;line-height:1.5;resize:vertical;outline:none}.aa-ta:focus{border-color:var(--pri)}
.aa-hint{font-size:11.5px;color:var(--dim);line-height:1.45}
.aa-hintw{display:inline-flex;align-items:center;position:relative}.aa-i{display:none}
.aa-pop{display:none}
.aa-inl{display:flex;gap:8px}.aa-in{flex:1;min-width:0;padding:9px 12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:inherit;font-size:13px;outline:none}.aa-in.wide{flex:2}.aa-in:focus{border-color:var(--pri)}
.aa-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.aa-pri{font:inherit;font-size:13.5px;font-weight:800;padding:11px 18px;border-radius:11px;border:0;background:var(--pri);color:#fff;cursor:pointer;box-shadow:0 8px 22px rgba(196,125,142,.28)}.aa-pri:disabled{opacity:.45;cursor:default;box-shadow:none}
@media (max-width:767px){
  .aa-hint{display:none}.aa-i{display:inline-flex;width:18px;height:18px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--mut);font:inherit;font-size:11px;font-weight:700;font-style:italic;align-items:center;justify-content:center;cursor:pointer;padding:0;flex-shrink:0}
  .aa-iback{position:fixed;inset:0;z-index:19}.aa-pop{display:block;position:absolute;right:0;top:24px;z-index:20;width:min(280px,78vw);padding:10px 12px;border-radius:10px;background:var(--card);border:1px solid var(--line);box-shadow:0 12px 30px rgba(0,0,0,.18);font-size:12.5px;color:var(--ink);line-height:1.5;text-align:left;font-style:normal;font-weight:400}
  .aa-row2{grid-template-columns:1fr}
  .aa-seg{font-size:12px;padding:7px 5px}
}
`;
