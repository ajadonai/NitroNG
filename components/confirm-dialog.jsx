'use client';
import { useState, useEffect, createContext, useContext, useCallback, useId, useRef } from "react";

const ConfirmContext = createContext(null);

export const DIALOG_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function getDialogFocusableElements(container) {
  if (!container?.querySelectorAll) return [];

  return Array.from(container.querySelectorAll(DIALOG_FOCUSABLE_SELECTOR)).filter(element => (
    !element.disabled
    && !element.hidden
    && element.tabIndex !== -1
    && element.getAttribute?.('aria-hidden') !== 'true'
  ));
}

export function trapDialogFocus(event, container, activeElement = globalThis.document?.activeElement) {
  if (event.key !== 'Tab' || !container) return false;

  const focusable = getDialogFocusableElements(container);
  if (focusable.length === 0) {
    event.preventDefault();
    container.focus?.({ preventScroll: true });
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const focusIsOutside = !container.contains?.(activeElement);

  if (event.shiftKey && (activeElement === first || focusIsOutside)) {
    event.preventDefault();
    last.focus?.({ preventScroll: true });
    return true;
  }

  if (!event.shiftKey && (activeElement === last || focusIsOutside)) {
    event.preventDefault();
    first.focus?.({ preventScroll: true });
    return true;
  }

  return false;
}

export function restoreDialogTrigger(trigger) {
  if (!trigger?.isConnected || typeof trigger.focus !== 'function') return false;
  trigger.focus({ preventScroll: true });
  return true;
}

export function ConfirmProvider({ children, dark }) {
  const [dialog, setDialog] = useState(null);
  const [input, setInput] = useState("");
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const triggerRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const confirmationInputId = useId();

  const confirm = useCallback(({ title, message, body, confirmLabel = "Confirm", confirmColor, danger = false, requireType = null, compact = false }) => {
    return new Promise((resolve) => {
      triggerRef.current = globalThis.document?.activeElement || null;
      setInput("");
      setDialog({ title, message, body, confirmLabel, confirmColor, danger, requireType, compact, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (dialog?.requireType && input !== dialog.requireType) return;
    dialog?.resolve(true);
    setDialog(null);
    setInput("");
  }, [dialog, input]);

  const handleCancel = useCallback(() => {
    dialog?.resolve(false);
    setDialog(null);
    setInput("");
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;

    cancelButtonRef.current?.focus({ preventScroll: true });

    const handler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancel();
        return;
      }

      trapDialogFocus(event, dialogRef.current);
    };

    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      restoreDialogTrigger(triggerRef.current);
    };
  }, [dialog, handleCancel]);

  const canConfirm = !dialog?.requireType || input === dialog.requireType;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[1100] backdrop-blur-[4px] flex items-center justify-center p-4 animate-[modalFadeIn_.2s_ease]"
          style={{ background: "rgba(0,0,0,.45)" }}
          onClick={handleCancel}
        >
          <div
            ref={dialogRef}
            role={dialog.danger ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            className={`${dialog.compact ? "max-w-[340px]" : "w-[90%] max-w-[420px]"} rounded-2xl pt-7 px-6 pb-[22px] text-center animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]`}
            onClick={e => e.stopPropagation()}
            style={{
              background: dark ? "#0e1120" : "#fff",
              border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}`,
              boxShadow: dark ? "0 20px 60px rgba(0,0,0,.4)" : "0 20px 60px rgba(0,0,0,.1)",
            }}
          >
            {/* Icon */}
            <div
              className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center mx-auto mb-4"
              style={{
                background: dialog.danger
                  ? (dark ? "rgba(252,165,165,.1)" : "rgba(220,38,38,.06)")
                  : (dark ? "rgba(96,165,250,.1)" : "rgba(37,99,235,.06)"),
              }}
            >
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
            <h2 id={titleId} className="text-[17px] font-semibold mb-1.5" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>{dialog.title}</h2>
            <div id={descriptionId}>
              {dialog.body || <div className="text-sm leading-[1.65] mb-5" style={{ color: dark ? "#a09b95" : "#555250" }}>{dialog.message}</div>}
            </div>

            {/* Type to confirm */}
            {dialog.requireType && (
              <div className="mb-[18px]">
                <label htmlFor={confirmationInputId} className="block text-[13px] mb-1.5" style={{ color: dark ? "#8a8580" : "#757170" }}>
                  Type <span style={{ color: dark ? "#fca5a5" : "#dc2626" }}>{dialog.requireType}</span> to confirm
                </label>
                <input
                  id={confirmationInputId}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={dialog.requireType}
                  autoComplete="off"
                  className="m w-full py-2.5 px-3.5 rounded-lg text-[15px] text-center outline-none tracking-[2px]"
                  style={{
                    background: dark ? "#0a0d1a" : "#f9f8f6",
                    border: `1px solid ${input === dialog.requireType ? (dark ? "#6ee7b7" : "#059669") : (dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)")}`,
                    color: dark ? "#f5f3f0" : "#1a1917",
                  }}
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2.5">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={handleCancel}
                className="flex-1 py-3 rounded-[10px] text-[15px] font-semibold cursor-pointer transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[.97]"
                style={dialog.danger ? {
                  background: dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)",
                  color: dark ? "#a09b95" : "#555250",
                  border: `1px solid ${dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.14)"}`,
                } : {
                  background: dark ? "rgba(252,165,165,.10)" : "rgba(220,38,38,.06)",
                  color: dark ? "#fca5a5" : "#dc2626",
                  border: `1px solid ${dark ? "rgba(252,165,165,.26)" : "rgba(220,38,38,.22)"}`,
                }}
              >Cancel</button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="flex-1 py-3 rounded-[10px] text-[15px] font-semibold cursor-pointer transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[.97]"
                style={{
                  background: dialog.danger ? (canConfirm ? "#dc2626" : (dark ? "#555" : "#ccc")) : (canConfirm ? (dark ? "#10b981" : "#059669") : (dark ? "#555" : "#ccc")),
                  border: `1px solid ${dialog.danger ? (dark ? "rgba(252,165,165,.3)" : "rgba(220,38,38,.3)") : (dark ? "rgba(16,185,129,.4)" : "rgba(5,150,105,.3)")}`,
                  color: canConfirm ? "#fff" : (dark ? "#888" : "#999"),
                  opacity: canConfirm ? 1 : .5,
                }}
              >{dialog.confirmLabel}</button>
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
