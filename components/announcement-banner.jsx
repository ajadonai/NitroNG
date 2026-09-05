'use client';
import { useState, useEffect } from "react";

// Nine times out of ten this is an operational notice, so it is drawn as a
// status line, not an alert box: a dot in the type colour, the type as one
// small word, the message, an optional action, and a dismiss that stays out of
// the text. Several notices can be live at once; the newest shows first and
// dismissing one reveals the next.
const TYPES = {
  info:    { label: "Notice",   c: ["#8b5e6b", "#e0a0b0"], bg: ["rgba(196,125,142,.08)", "rgba(196,125,142,.14)"] },
  warning: { label: "Heads up", c: ["#b45309", "#fcd34d"], bg: ["rgba(217,119,6,.08)",   "rgba(251,191,36,.12)"] },
  success: { label: "Fixed",    c: ["#0a7d54", "#6ee7b7"], bg: ["rgba(5,150,105,.08)",   "rgba(110,231,183,.12)"] },
  urgent:  { label: "Urgent",   c: ["#c62828", "#fca5a5"], bg: ["rgba(220,38,38,.08)",   "rgba(252,165,165,.12)"] },
};

const CSS = `
.an{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;background:var(--card);border:1px solid var(--line);font-size:13px;line-height:1.4;min-width:0;color:var(--ink)}
.an-dot{width:8px;height:8px;border-radius:50%;background:var(--c);flex-shrink:0;box-shadow:0 0 0 3px var(--cbg)}
.an-lbl{font-size:10.5px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--c);flex-shrink:0}
.an-msg{flex:1;min-width:0}.an-msg strong{font-weight:700}
.an-act{display:inline-flex;align-items:center;gap:3px;font-size:12.5px;font-weight:700;color:var(--c);white-space:nowrap;flex-shrink:0;text-decoration:none}.an-act svg{width:12px;height:12px}.an-act:hover{text-decoration:underline}
.an-cnt{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:var(--dim);flex-shrink:0;padding-left:8px;border-left:1px solid var(--line)}
.an-x{width:24px;height:24px;border-radius:7px;border:0;background:transparent;color:var(--dim);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin:-4px -4px -4px 0;padding:0}.an-x svg{width:11px;height:11px}.an-x:hover{background:var(--soft);color:var(--ink)}
.an-land{border-radius:0;border:0;border-bottom:1px solid var(--line);background:var(--cbg);padding:9px 20px;justify-content:center}
.an-land .an-msg{flex:0 1 auto}
@media (max-width:767px){
  .an{flex-wrap:wrap;padding:10px 12px;row-gap:6px}
  .an-msg{flex-basis:100%;order:3}.an-act{order:4}.an-cnt{order:5;margin-left:auto}.an-x{order:2;margin-left:auto}
  .an-land{padding:10px 14px}.an-land .an-msg{text-align:left}
}
`;

export default function AnnouncementBanner({ alerts, dark, mode = "dashboard", onDismiss, preview = false }) {
  const [dismissed, setDismissed] = useState(new Set());
  const [leaving, setLeaving] = useState(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("nitro_dismissed_alerts") || "[]");
      const sessionStored = JSON.parse(sessionStorage.getItem("nitro_dismissed_alerts_session") || "[]");
      setDismissed(new Set([...stored, ...sessionStored]));
    } catch {}
  }, []);

  const dismiss = (alert) => {
    setLeaving(alert.id);
    setTimeout(() => {
      setLeaving(null);
      setDismissed(prev => {
        const next = new Set(prev);
        next.add(alert.id);
        try {
          // Urgent and warning come back next session; the rest stay dismissed.
          if (alert.type === "urgent" || alert.type === "warning") {
            const arr = JSON.parse(sessionStorage.getItem("nitro_dismissed_alerts_session") || "[]");
            if (!arr.includes(alert.id)) { arr.push(alert.id); sessionStorage.setItem("nitro_dismissed_alerts_session", JSON.stringify(arr)); }
          } else {
            const arr = JSON.parse(localStorage.getItem("nitro_dismissed_alerts") || "[]");
            if (!arr.includes(alert.id)) { arr.push(alert.id); localStorage.setItem("nitro_dismissed_alerts", JSON.stringify(arr)); }
          }
        } catch {}
        return next;
      });
      if (onDismiss) onDismiss(alert.id);
    }, 250);
  };

  const visible = preview ? (alerts || []) : (alerts || []).filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const alert = visible[0];
  const type = TYPES[alert.type] ? alert.type : "info";
  const T = TYPES[type];
  const i = dark ? 1 : 0;
  const action = alert.action || (alert.actionLabel && alert.actionHref ? { label: alert.actionLabel, href: alert.actionHref } : null);
  const isLeaving = leaving === alert.id;
  const vars = {
    "--c": T.c[i], "--cbg": T.bg[i],
    "--card": dark ? "#171126" : "#ffffff", "--ink": dark ? "#f2efe9" : "#1c1b19",
    "--dim": dark ? "#5c6170" : "#a19b93", "--line": dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)", "--soft": dark ? "#111634" : "#faf9f7",
  };
  const landing = mode === "landing";

  return (
    <div
      className={`an${landing ? " an-land" : ""} ${isLeaving ? "animate-[announceOut_.25s_ease_forwards]" : "animate-[announceIn_.35s_cubic-bezier(.34,1.2,.64,1)_both]"}`}
      role="status"
      style={{ ...vars, ...(preview ? { marginBottom: 0 } : landing
        ? { position: "fixed", top: 57, left: 0, right: 0, zIndex: 90, backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }
        : { marginBottom: 16 }) }}
    >
      <style>{CSS}</style>
      <span className="an-dot" />
      <span className="an-lbl">{T.label}</span>
      <span className="an-msg">
        {alert.message.split(/(\*[^*]+\*)/).map((part, k) =>
          part.startsWith('*') && part.endsWith('*') ? <strong key={k}>{part.slice(1, -1)}</strong> : part
        )}
      </span>
      {action && (
        <a href={action.href || "#"} target="_blank" rel="noopener noreferrer" className="an-act">
          {action.label || "Learn more"}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
      )}
      {visible.length > 1 && <span className="an-cnt">1 of {visible.length}</span>}
      <button type="button" onClick={() => { if (!preview) dismiss(alert); }} className="an-x" aria-label="Dismiss" tabIndex={preview ? -1 : 0}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}
