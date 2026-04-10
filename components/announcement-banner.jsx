'use client';
import { useState, useEffect } from "react";

const ICONS = {
  info: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  warning: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  success: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  urgent: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};

const STYLES = {
  info: {
    bgD: "rgba(14,17,32,.92)", bgL: "rgba(255,255,255,.92)",
    brdD: "rgba(196,125,142,.12)", brdL: "rgba(196,125,142,.1)",
    colD: "#c47d8e", colL: "#8b5e6b",
  },
  warning: {
    bgD: "rgba(20,18,12,.92)", bgL: "rgba(255,253,245,.92)",
    brdD: "rgba(251,191,36,.12)", brdL: "rgba(217,119,6,.1)",
    colD: "#fbbf24", colL: "#d97706",
  },
  success: {
    bgD: "rgba(12,20,16,.92)", bgL: "rgba(245,255,250,.92)",
    brdD: "rgba(110,231,183,.12)", brdL: "rgba(5,150,105,.1)",
    colD: "#6ee7b7", colL: "#059669",
  },
  urgent: {
    bgD: "rgba(24,12,12,.92)", bgL: "rgba(255,245,245,.92)",
    brdD: "rgba(252,165,165,.15)", brdL: "rgba(220,38,38,.1)",
    colD: "#fca5a5", colL: "#dc2626",
  },
};

/**
 * AnnouncementBanner — overlays content with zero layout impact
 *
 * @param {Array} alerts - [{ id, message, type, action? }]
 * @param {boolean} dark
 * @param {"dashboard"|"landing"} mode - determines positioning
 * @param {function} onDismiss - called with alert id
 */
export default function AnnouncementBanner({ alerts, dark, mode = "dashboard", onDismiss }) {
  const [dismissed, setDismissed] = useState(new Set());
  const [leaving, setLeaving] = useState(null);

  // Load dismissed IDs from storage on mount
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
        // Urgent/warning → sessionStorage (comes back next session)
        // Info/success → localStorage (permanent)
        try {
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

  const visible = (alerts || []).filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  // Only show the first active alert (stack them = visual clutter)
  const alert = visible[0];
  const type = STYLES[alert.type] ? alert.type : "info";
  const s = STYLES[type];
  const icon = ICONS[type] || ICONS.info;
  const isLeaving = leaving === alert.id;

  const posStyle = mode === "landing"
    ? { position: "fixed", top: 57, left: 0, right: 0, zIndex: 90 }
    : { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 };

  return (
    <div
      className={`nitro-announce${isLeaving ? " nitro-announce-out" : ""}`}
      style={{
        ...posStyle,
        background: dark ? s.bgD : s.bgL,
        borderBottom: `1px solid ${dark ? s.brdD : s.brdL}`,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <div className="nitro-announce-inner">
        <div className="nitro-announce-icon" style={{ color: dark ? s.colD : s.colL }}>
          {icon(dark ? s.colD : s.colL)}
        </div>
        <div className="nitro-announce-text" style={{ color: dark ? "rgba(255,255,255,.85)" : "rgba(0,0,0,.75)" }}>
          {alert.message}
          {alert.action && (
            <a href={alert.action.href || "#"} className="nitro-announce-action" style={{ color: dark ? s.colD : s.colL }}>
              {alert.action.label || "Learn more →"}
            </a>
          )}
        </div>
        <button
          onClick={() => dismiss(alert)}
          className="nitro-announce-x"
          style={{ color: dark ? "#706c68" : "#999" }}
        >✕</button>
      </div>
    </div>
  );
}
