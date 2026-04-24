'use client';
import { useState, useCallback, useMemo, createContext, useContext } from "react";

const ToastContext = createContext(null);

let toastId = 0;

const TYPES = {
  success: {
    bgD: "rgba(16,32,22,.95)", bgL: "rgba(236,253,245,.97)",
    brdD: "rgba(110,231,183,.35)", brdL: "rgba(5,150,105,.3)",
    colD: "#6ee7b7", colL: "#059669",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  },
  error: {
    bgD: "rgba(32,16,16,.95)", bgL: "rgba(254,242,242,.97)",
    brdD: "rgba(252,165,165,.35)", brdL: "rgba(220,38,38,.25)",
    colD: "#fca5a5", colL: "#dc2626",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  },
  warning: {
    bgD: "rgba(32,28,16,.95)", bgL: "rgba(255,251,235,.97)",
    brdD: "rgba(251,191,36,.35)", brdL: "rgba(217,119,6,.25)",
    colD: "#fbbf24", colL: "#d97706",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  },
  info: {
    bgD: "rgba(16,20,32,.95)", bgL: "rgba(239,246,255,.97)",
    brdD: "rgba(96,165,250,.35)", brdL: "rgba(37,99,235,.25)",
    colD: "#60a5fa", colL: "#2563eb",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  },
};

export function ToastProvider({ children, dark }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, title, desc, opts = {}) => {
    const id = ++toastId;
    const duration = opts.duration || 5000;
    const position = opts.position || "top";
    const cta = opts.cta || null;
    setToasts(prev => [...prev, { id, type, title, desc, duration, position, cta }]);
    setTimeout(() => removeToast(id), duration);
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
  };

  const toast = useMemo(() => ({
    success: (title, desc, opts) => addToast("success", title, desc, opts),
    error: (title, desc, opts) => addToast("error", title, desc, opts),
    warning: (title, desc, opts) => addToast("warning", title, desc, opts),
    info: (title, desc, opts) => addToast("info", title, desc, opts),
  }), [addToast]);

  const topToasts = toasts.filter(t => t.position === "top");
  const bottomToasts = toasts.filter(t => t.position === "bottom");

  const renderToast = (t) => {
    const tt = TYPES[t.type];
    const isBottom = t.position === "bottom";
    const animClass = t.leaving
      ? (isBottom ? "toast-exit-bottom" : "toast-exit")
      : (isBottom ? "toast-enter-bottom" : "toast-enter");

    return (
      <div
        key={t.id}
        className={`rounded-[14px] overflow-hidden pointer-events-auto backdrop-blur-[20px] shadow-[0_8px_32px_rgba(0,0,0,.25),0_2px_8px_rgba(0,0,0,.1)] ${animClass}`}
        style={{
          background: dark ? tt.bgD : tt.bgL,
          border: `1.5px solid ${dark ? tt.brdD : tt.brdL}`,
        }}
      >
        <div className="flex gap-2.5 items-center py-3 px-3.5 md:py-3.5 md:px-4">
          <div className="shrink-0" style={{ color: dark ? tt.colD : tt.colL }}>{tt.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm md:text-[15px] font-semibold" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>{t.title}</div>
            {t.desc && <div className="text-[13px] md:text-sm mt-0.5" style={{ color: dark ? "#a09b95" : "#555250" }}>{t.desc}</div>}
          </div>
          {t.cta && (
            <button
              onClick={() => { t.cta.onClick(); removeToast(t.id); }}
              className="py-1 px-3 rounded-md text-xs font-semibold whitespace-nowrap shrink-0"
              style={{
                background: dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)",
                color: dark ? "#f5f3f0" : "#1a1917",
              }}
            >{t.cta.label}</button>
          )}
          <button
            onClick={() => removeToast(t.id)}
            className="bg-transparent text-base p-0.5 shrink-0 opacity-50 hover:opacity-90 transition-opacity duration-150 cursor-pointer"
            style={{ color: dark ? "#706c68" : "#757170" }}
          ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div className="h-0.5 relative">
          <div className="h-full opacity-30 toast-progress-bar" style={{ background: dark ? tt.colD : tt.colL, animationDuration: `${t.duration}ms` }} />
        </div>
      </div>
    );
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {topToasts.length > 0 && (
        <div className="fixed right-3 left-3 md:left-auto md:right-5 md:w-[360px] top-3 md:top-16 z-[200] flex flex-col gap-2 pointer-events-none">
          {topToasts.map(renderToast)}
        </div>
      )}
      {bottomToasts.length > 0 && (
        <div className="fixed right-3 left-3 md:left-auto md:right-5 md:w-[360px] bottom-[72px] md:bottom-20 z-[200] flex flex-col gap-2 pointer-events-none">
          {bottomToasts.map(renderToast)}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
