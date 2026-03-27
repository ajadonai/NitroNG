'use client';
import { useState, useCallback, useMemo, createContext, useContext } from "react";

const ToastContext = createContext(null);

let toastId = 0;

const TYPES = {
  success: {
    bgD: "rgba(16,32,22,.95)", bgL: "rgba(236,253,245,.97)",
    brdD: "rgba(110,231,183,.2)", brdL: "rgba(5,150,105,.15)",
    colD: "#6ee7b7", colL: "#059669",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  },
  error: {
    bgD: "rgba(32,16,16,.95)", bgL: "rgba(254,242,242,.97)",
    brdD: "rgba(252,165,165,.2)", brdL: "rgba(220,38,38,.12)",
    colD: "#fca5a5", colL: "#dc2626",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  },
  warning: {
    bgD: "rgba(32,28,16,.95)", bgL: "rgba(255,251,235,.97)",
    brdD: "rgba(251,191,36,.2)", brdL: "rgba(217,119,6,.12)",
    colD: "#fbbf24", colL: "#d97706",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  },
  info: {
    bgD: "rgba(16,20,32,.95)", bgL: "rgba(239,246,255,.97)",
    brdD: "rgba(96,165,250,.2)", brdL: "rgba(37,99,235,.1)",
    colD: "#60a5fa", colL: "#2563eb",
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  },
};

export function ToastProvider({ children, dark }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, title, desc, duration = 5000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, title, desc, duration }]);
    setTimeout(() => removeToast(id), duration);
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
  };

  const toast = useMemo(() => ({
    success: (title, desc) => addToast("success", title, desc),
    error: (title, desc) => addToast("error", title, desc),
    warning: (title, desc) => addToast("warning", title, desc),
    info: (title, desc) => addToast("info", title, desc),
  }), [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div className="toast-container">
        {toasts.map(t => {
          const tt = TYPES[t.type];
          return (
            <div key={t.id} className={`toast-item ${t.leaving ? "toast-exit" : "toast-enter"}`} style={{
              background: dark ? tt.bgD : tt.bgL,
              borderWidth: 1, borderStyle: "solid",
              borderColor: dark ? tt.brdD : tt.brdL,
            }}>
              <div className="toast-content">
                <div className="toast-icon" style={{ color: dark ? tt.colD : tt.colL }}>{tt.icon}</div>
                <div className="toast-text">
                  <div className="toast-title" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>{t.title}</div>
                  {t.desc && <div className="toast-desc" style={{ color: dark ? "#a09b95" : "#555250" }}>{t.desc}</div>}
                </div>
                <button onClick={() => removeToast(t.id)} className="toast-close" style={{ color: dark ? "#706c68" : "#757170" }}>✕</button>
              </div>
              <div className="toast-progress">
                <div className="toast-progress-bar" style={{ background: dark ? tt.colD : tt.colL, animationDuration: `${t.duration}ms` }} />
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
