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
              background: dialog.danger ? (dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)") : (dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)"),
            }}>
              {dialog.danger ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={dark ? "#fca5a5" : "#dc2626"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c47d8e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              )}
            </div>

            {/* Title + Message */}
            <div className="confirm-title" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>{dialog.title}</div>
            <div className="confirm-message" style={{ color: dark ? "#a09b95" : "#555250" }}>{dialog.message}</div>

            {/* Type to confirm */}
            {dialog.requireType && (
              <div className="confirm-type-section">
                <div className="confirm-type-label" style={{ color: dark ? "#706c68" : "#757170" }}>
                  Type <span className="m" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>{dialog.requireType}</span> to confirm
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
