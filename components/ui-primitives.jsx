'use client';
import { useEffect, useRef } from "react";

/**
 * Shared UI primitives.
 *
 * These exist because the same three defects kept recurring across the app:
 * hand-built modals with no Escape key, inputs whose visible label was never
 * associated with the control, and `outline-none` with nothing put back. Each
 * was correct in some files and wrong in others, because correctness depended
 * on whoever wrote that screen remembering. Centralising them makes the correct
 * version the easy one to reach for.
 */

/** Focus ring for anything that sets outline-none. Never remove one without this. */
export const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-[#c47d8e]/45";

/**
 * Modal with the behaviour every hand-built one kept missing: Escape closes it,
 * the backdrop is a real button rather than a div with a click handler, focus
 * moves into the panel on open and returns where it came from on close, and
 * scrolling inside it does not drag the page behind.
 */
export function Modal({ open, onClose, title, children, dark, maxWidth = 480, labelledBy }) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement;
    const onKey = e => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      // Returning focus matters most for keyboard users, who would otherwise be
      // dropped back at the top of the document.
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <button type="button" aria-label="Close dialog" onClick={onClose}
        className="absolute inset-0 border-none cursor-default" style={{ background: "rgba(0,0,0,.5)" }} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        className={`relative w-full rounded-2xl p-5 max-h-[85vh] overflow-y-auto ${FOCUS_RING}`}
        style={{
          maxWidth,
          overscrollBehavior: "contain",
          background: dark ? "#16121a" : "#fdfcfb",
          border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

let fieldSeq = 0;

/**
 * Labelled input. The label is tied to the control, so screen readers announce
 * it and tapping the label focuses the field — neither of which happens when a
 * label is merely positioned above an input.
 */
export function Field({ label, id, hint, error, dark, className = "", ...inputProps }) {
  const fieldId = id || `f${(fieldSeq += 1)}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <div className="mb-3">
      <label htmlFor={fieldId} className="text-[13px] font-medium block mb-[5px] text-t-text-muted">{label}</label>
      <input
        id={fieldId}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        className={`w-full py-2.5 px-3.5 rounded-lg text-[15px] box-border text-t-text ${FOCUS_RING} ${className}`}
        style={{
          border: `0.5px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.18)"}`,
          background: dark ? "rgba(255,255,255,.12)" : "#fff",
        }}
        {...inputProps}
      />
      {hint && !error && <div id={hintId} className="text-[11.5px] mt-1 text-t-text-muted">{hint}</div>}
      {/* Announced when it appears, so the error is not silent for screen readers. */}
      {error && <div id={errorId} aria-live="polite" className="text-[11.5px] mt-1" style={{ color: dark ? "#f87171" : "#dc2626" }}>{error}</div>}
    </div>
  );
}
