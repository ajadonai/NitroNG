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
    bgD: "rgba(196,125,142,.12)", bgL: "rgba(196,125,142,.06)",
    brdD: "rgba(196,125,142,.3)", brdL: "rgba(196,125,142,.25)",
    colD: "#c47d8e", colL: "#8b5e6b",
  },
  warning: {
    bgD: "rgba(251,191,36,.12)", bgL: "rgba(217,119,6,.06)",
    brdD: "rgba(251,191,36,.35)", brdL: "rgba(217,119,6,.3)",
    colD: "#fbbf24", colL: "#d97706",
  },
  success: {
    bgD: "rgba(110,231,183,.1)", bgL: "rgba(5,150,105,.05)",
    brdD: "rgba(110,231,183,.3)", brdL: "rgba(5,150,105,.25)",
    colD: "#6ee7b7", colL: "#059669",
  },
  urgent: {
    bgD: "rgba(252,165,165,.12)", bgL: "rgba(220,38,38,.06)",
    brdD: "rgba(252,165,165,.35)", brdL: "rgba(220,38,38,.3)",
    colD: "#fca5a5", colL: "#dc2626",
  },
};

export default function AnnouncementBanner({ alerts, dark, mode = "dashboard", onDismiss }) {
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

  const alert = visible[0];
  const type = STYLES[alert.type] ? alert.type : "info";
  const s = STYLES[type];
  const icon = ICONS[type] || ICONS.info;
  const isLeaving = leaving === alert.id;

  return (
    <div
      className={isLeaving ? "animate-[announceOut_.25s_ease_forwards]" : "animate-[announceIn_.35s_cubic-bezier(.34,1.2,.64,1)_both]"}
      style={{
        ...(mode === "landing"
          ? { position: "fixed", top: 57, left: 0, right: 0, zIndex: 90 }
          : { marginBottom: 16 }),
        background: dark ? s.bgD : s.bgL,
        borderTop: `1px solid ${dark ? s.brdD : s.brdL}`,
        borderRight: `1px solid ${dark ? s.brdD : s.brdL}`,
        borderBottom: `1px solid ${dark ? s.brdD : s.brdL}`,
        borderLeft: `3px solid ${dark ? s.colD : s.colL}`,
        borderRadius: mode !== "landing" ? 12 : 0,
      }}
    >
      <div className="flex items-center gap-2 md:gap-2.5 py-[9px] px-4 pr-9 md:py-2.5 md:pl-6 md:pr-11 justify-center relative">
        <div className="shrink-0" style={{ color: dark ? s.colD : s.colL }}>
          {icon(dark ? s.colD : s.colL)}
        </div>
        <div className="text-[13px] md:text-sm font-medium" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>
          {alert.message}
          {alert.action && (
            <a
              href={alert.action.href || "#"}
              className="text-xs md:text-[13px] font-semibold ml-1.5 hover:underline"
              style={{ color: dark ? s.colD : s.colL }}
            >
              {alert.action.label || "Learn more →"}
            </a>
          )}
        </div>
        <button
          onClick={() => dismiss(alert)}
          className="bg-transparent cursor-pointer py-1.5 px-2.5 text-sm opacity-50 hover:opacity-80 absolute right-2 top-1/2 -translate-y-1/2"
          style={{ color: dark ? "#706c68" : "#999" }}
        ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
    </div>
  );
}
