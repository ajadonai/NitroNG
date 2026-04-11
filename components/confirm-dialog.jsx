'use client';
import { useState, useEffect, createContext, useContext, useCallback } from "react";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children, dark }) {
  const [dialog, setDialog] = useState(null);
  const [input, setInput] = useState("");

  const confirm = useCallback(({ title, message, confirmLabel = "Confirm", confirmColor, danger = false, requireType = null }) => {
    return new Promise((resolve) => {
      setInput("");
      setDialog({ title, message, confirmLabel, confirmColor, danger, requireType, resolve });
    });
  }, []);

  const handleConfirm = () => {
    if (dialog?.requireType && input !== dialog.requireType) return;
    dialog?.resolve(true);
    setDialog(null);
    setInput("");
  };

  const handleCancel = () => {
    dialog?.resolve(false);
    setDialog(null);
    setInput("");
  };

  useEffect(() => {
    if (!dialog) return;
    const handler = (e) => { if (e.key === "Escape") handleCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [dialog]);

  const canConfirm = !dialog?.requireType || input === dialog.requireType;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="confirm-overlay" onClick={handleCancel}>
          <div className="confirm-dialog" onClick={e => e.stopPropagation()} style={{
            background: dark ? "#0e1120" : "#fff",
            borderWidth: 1, borderStyle: "solid",
            borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)",
            boxShadow: dark ? "0 20px 60px rgba(0,0,0,.5)" : "0 20px 60px rgba(0,0,0,.12)",
          }}>
            {/* Icon */}
            <div className="confirm-icon" style={{
              background: dialog.danger
                ? (dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)")
                : (dark ? "rgba(96,165,250,.1)" : "rgba(37,99,235,.06)"),
            }}>
              {dialog.danger ? (
                dialog.requireType ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fca5a5" : "#dc2626"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fca5a5" : "#dc2626"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
                )
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dark ? "#60a5fa" : "#2563eb"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              )}
            </div>

            {/* Title + Message */}
            <div className="confirm-title" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>{dialog.title}</div>
            <div className="confirm-message" style={{ color: dark ? "#a09b95" : "#555250" }}>{dialog.message}</div>

            {/* Type to confirm */}
            {dialog.requireType && (
              <div className="confirm-type-section">
                <div className="confirm-type-label" style={{ color: dark ? "#706c68" : "#757170" }}>
                  Type <span style={{ color: dark ? "#fca5a5" : "#dc2626" }}>{dialog.requireType}</span> to confirm
                </div>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={dialog.requireType}
                  className="m confirm-type-input"
                  style={{
                    background: dark ? "#0a0d1a" : "#f9f8f6",
                    borderColor: input === dialog.requireType ? (dark ? "#6ee7b7" : "#059669") : (dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"),
                    color: dark ? "#f5f3f0" : "#1a1917",
                  }}
                  autoFocus
                />
              </div>
            )}

            {/* Buttons */}
            <div className="confirm-buttons">
              <button onClick={handleCancel} className="confirm-btn-cancel" style={{
                background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)",
                color: dark ? "#a09b95" : "#555250",
                borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)",
              }}>Cancel</button>
              <button onClick={handleConfirm} disabled={!canConfirm} className="confirm-btn-action" style={{
                background: dialog.danger ? (canConfirm ? (dark ? "#dc2626" : "#dc2626") : (dark ? "#555" : "#ccc")) : (canConfirm ? "linear-gradient(135deg,#c47d8e,#8b5e6b)" : (dark ? "#555" : "#ccc")),
                color: canConfirm ? "#fff" : (dark ? "#888" : "#999"),
                opacity: canConfirm ? 1 : .5,
              }}>{dialog.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}
