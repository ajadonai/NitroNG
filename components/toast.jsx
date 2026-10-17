'use client';
import { useState, useCallback, useMemo, useRef, createContext, useContext } from "react";
import { OffsetIcon } from "./offset-icons";

const ToastContext = createContext(null);

let toastId = 0;

const TYPES = {
  success: {
    bgD: "rgba(16,32,22,.95)", bgL: "rgba(236,253,245,.97)",
    brdD: "rgba(110,231,183,.35)", brdL: "rgba(5,150,105,.3)",
    colD: "#6ee7b7", colL: "#059669",
    icon: <OffsetIcon name="checkCircle" size={15} />,
  },
  error: {
    bgD: "rgba(32,16,16,.95)", bgL: "rgba(254,242,242,.97)",
    brdD: "rgba(252,165,165,.35)", brdL: "rgba(220,38,38,.25)",
    colD: "#fca5a5", colL: "#dc2626",
    icon: <OffsetIcon name="xCircle" size={15} />,
  },
  warning: {
    bgD: "rgba(32,28,16,.95)", bgL: "rgba(255,251,235,.97)",
    brdD: "rgba(251,191,36,.35)", brdL: "rgba(217,119,6,.25)",
    colD: "#fbbf24", colL: "#d97706",
    icon: <OffsetIcon name="alert" size={15} />,
  },
  info: {
    bgD: "rgba(16,20,32,.95)", bgL: "rgba(239,246,255,.97)",
    brdD: "rgba(96,165,250,.35)", brdL: "rgba(37,99,235,.25)",
    colD: "#60a5fa", colL: "#2563eb",
    icon: <OffsetIcon name="info" size={15} />,
  },
};

export function ToastProvider({ children, dark }) {
  const [toasts, setToasts] = useState([]);
  const [paused, setPaused] = useState({});
  const timers = useRef({});

  const removeToast = useCallback((id) => {
    delete timers.current[id];
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
  }, []);

  const startTimer = useCallback((id, ms) => {
    timers.current[id] = { tid: setTimeout(() => removeToast(id), ms), start: Date.now(), remaining: ms };
  }, [removeToast]);

  const addToast = useCallback((type, title, desc, opts = {}) => {
    const id = ++toastId;
    const duration = opts.duration || 5000;
    const position = opts.position || "top";
    const cta = opts.cta || null;
    setToasts(prev => [...prev, { id, type, title, desc, duration, position, cta }]);
    startTimer(id, duration);
  }, [startTimer]);

  const pauseToast = useCallback((id) => {
    const t = timers.current[id];
    if (!t) return;
    clearTimeout(t.tid);
    t.remaining = Math.max(0, t.remaining - (Date.now() - t.start));
    setPaused(prev => ({ ...prev, [id]: true }));
  }, []);

  const resumeToast = useCallback((id) => {
    const t = timers.current[id];
    if (!t) return;
    setPaused(prev => { const n = { ...prev }; delete n[id]; return n; });
    startTimer(id, t.remaining);
  }, [startTimer]);

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
    const col = dark ? tt.colD : tt.colL;
    const isBottom = t.position === "bottom";
    const animClass = t.leaving
      ? (isBottom ? "toast-exit-bottom" : "toast-exit")
      : (isBottom ? "toast-enter-bottom" : "toast-enter");

    return (
      <div
        key={t.id}
        className={`rounded-xl overflow-hidden pointer-events-auto backdrop-blur-[20px] shadow-[0_4px_20px_rgba(0,0,0,.1),0_1px_4px_rgba(0,0,0,.04)] ${animClass}`}
        style={{
          background: dark ? tt.bgD : tt.bgL,
          border: `1px solid ${dark ? tt.brdD : tt.brdL}`,
        }}
        onMouseEnter={() => pauseToast(t.id)}
        onMouseLeave={() => resumeToast(t.id)}
      >
        <div className="flex gap-3 items-center py-3.5 px-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${col}20`, color: col }}>{tt.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm md:text-[15px] font-semibold" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>{t.title}</div>
            {t.desc && <div className="text-[13px] md:text-sm mt-0.5" style={{ color: dark ? "#a09b95" : "#555250" }}>{t.desc}</div>}
          </div>
          {t.cta && (
            <button
              onClick={() => { t.cta.onClick(); removeToast(t.id); }}
              className="py-1 px-3 rounded-md text-xs font-semibold whitespace-nowrap shrink-0"
              style={{
                background: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.06)",
                color: dark ? "#f5f3f0" : "#1a1917",
              }}
            >{t.cta.label}</button>
          )}
          <button
            onClick={() => removeToast(t.id)}
            className="bg-transparent text-base p-0.5 shrink-0 opacity-40 hover:opacity-80 transition-opacity duration-150 cursor-pointer"
            style={{ color: dark ? "#8a8580" : "#757170" }}
          ><OffsetIcon name="close" size={12} /></button>
        </div>
        <div className="h-[3px] relative overflow-hidden mx-4 mb-3 rounded-full" style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)" }}>
          <div className="h-full rounded-full toast-progress-bar" style={{ background: col, opacity: 0.5, animationDuration: `${t.duration}ms`, animationPlayState: paused[t.id] ? "paused" : "running" }} />
        </div>
      </div>
    );
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {topToasts.length > 0 && (
        <div className="fixed right-3 left-3 md:left-auto md:right-5 md:w-[360px] top-3 md:top-16 z-[1200] flex flex-col gap-2 pointer-events-none">
          {topToasts.map(renderToast)}
        </div>
      )}
      {bottomToasts.length > 0 && (
        <div className="fixed right-3 left-3 md:left-auto md:right-5 md:w-[360px] bottom-[72px] md:bottom-20 z-[1200] flex flex-col gap-2 pointer-events-none">
          {bottomToasts.map(renderToast)}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
