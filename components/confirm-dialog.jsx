'use client';
import { useState, useEffect, createContext, useContext, useCallback, useId, useRef } from "react";
import { ModalBtn } from "./ui-primitives";

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

  // confirmText is an accepted alias: several call sites always passed it, and
  // their Delete/Reject dialogs silently fell back to a generic "Confirm".
  const confirm = useCallback(({ title, message, body, confirmLabel, confirmText, confirmColor, danger = false, requireType = null, compact = false }) => {
    return new Promise((resolve) => {
      triggerRef.current = globalThis.document?.activeElement || null;
      setInput("");
      setDialog({ title, message, body, confirmLabel: confirmLabel || confirmText || "Confirm", confirmColor, danger, requireType, compact, resolve });
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

  // The dialog owns the screen while it is up.
  useEffect(() => {
    if (!dialog) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
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
          className="fixed inset-0 z-[1100] backdrop-blur-[6px] flex items-end md:items-center justify-center p-0 md:p-4 animate-[modalFadeIn_.2s_ease]"
          style={{ background: "rgba(0,0,0,.55)" }}
          onClick={handleCancel}
        >
          <div
            ref={dialogRef}
            role={dialog.danger ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            className={`w-full ${dialog.compact ? "md:max-w-[340px]" : "md:max-w-[400px]"} rounded-t-2xl rounded-b-none md:rounded-2xl overflow-hidden md:animate-[modalBounceIn_.3s_cubic-bezier(.34,1.56,.64,1)_both]`}
            onClick={e => e.stopPropagation()}
            style={{
              background: dark ? "#160f22" : "#fff",
              border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`,
              boxShadow: "0 24px 60px rgba(0,0,0,.25)",
            }}
          >
            <div className="md:hidden w-[38px] h-1 rounded-sm mx-auto mt-2.5" style={{ background: dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.14)" }} />
            {/* Header — intent chip, title, X */}
            <div className="flex items-start gap-3 p-4 pb-0">
              <span
                className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0"
                style={dialog.danger
                  ? { background: dark ? "rgba(252,165,165,.12)" : "rgba(220,38,38,.07)", color: dark ? "#fca5a5" : "#dc2626" }
                  : { background: dark ? "rgba(196,125,142,.16)" : "rgba(196,125,142,.09)", color: "#c47d8e" }}
              >
                {dialog.danger ? (
                  dialog.requireType ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>
                  )
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                )}
              </span>
              <h2 id={titleId} className="text-[15px] font-bold leading-tight flex-1 min-w-0 mt-1.5 mb-0" style={{ color: dark ? "#f2efe9" : "#1c1b19" }}>{dialog.title}</h2>
              <button type="button" onClick={handleCancel} aria-label="Close" className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0 cursor-pointer" style={{ background: dark ? "rgba(255,255,255,.05)" : "#faf9f7", border: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}`, color: dark ? "#8b90a0" : "#757170" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Message */}
            <div id={descriptionId} className="px-4 pt-3">
              {dialog.body || <div className="text-[13.5px] leading-[1.6] whitespace-pre-line" style={{ color: dark ? "#8b90a0" : "#757170" }}>{dialog.message}</div>}
            </div>

            {/* Type to confirm */}
            {dialog.requireType && (
              <div className="px-4 pt-3">
                <label htmlFor={confirmationInputId} className="block text-[12.5px] mb-1.5" style={{ color: dark ? "#8b90a0" : "#757170" }}>
                  Type <span className="font-bold" style={{ color: dark ? "#fca5a5" : "#dc2626" }}>{dialog.requireType}</span> to confirm
                </label>
                <input
                  id={confirmationInputId}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={dialog.requireType}
                  autoComplete="off"
                  className="m w-full h-10 px-3.5 rounded-[10px] text-[14px] outline-none tracking-[2px]"
                  style={{
                    background: dark ? "rgba(255,255,255,.05)" : "#faf9f7",
                    border: `1px solid ${input === dialog.requireType ? (dark ? "#6ee7b7" : "#059669") : (dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.12)")}`,
                    color: dark ? "#f2efe9" : "#1c1b19",
                  }}
                />
              </div>
            )}

            {/* Actions — Cancel is the safe way out; it is never painted red. */}
            <div className="flex flex-col-reverse md:flex-row gap-2 md:justify-end p-4">
              <ModalBtn ref={cancelButtonRef} kind="quiet" dark={dark} onClick={handleCancel}>Cancel</ModalBtn>
              <ModalBtn
                kind={dialog.danger ? "danger" : "primary"}
                dark={dark}
                onClick={handleConfirm}
                disabled={!canConfirm}
                style={dialog.confirmColor ? { background: dialog.confirmColor, border: "none", color: "#fff" } : undefined}
              >{dialog.confirmLabel}</ModalBtn>
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
