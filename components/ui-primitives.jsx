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
/** Anything that owns the screen locks the page behind it. One hook so every
 * hand-rolled overlay stops re-implementing (or forgetting) the same effect. */
export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [locked]);
}

// Intent tints for the header icon chip. Accent for ordinary actions, red for
// destructive ones, green for good news — same semantics as buttons sitewide.
const INTENT_CHIP = {
  accent: dk => dk ? { background: "rgba(196,125,142,.16)", color: "#c47d8e" } : { background: "rgba(196,125,142,.09)", color: "#c47d8e" },
  danger: dk => dk ? { background: "rgba(252,165,165,.12)", color: "#fca5a5" } : { background: "rgba(220,38,38,.07)", color: "#dc2626" },
  success: dk => dk ? { background: "rgba(110,231,183,.12)", color: "#6ee7b7" } : { background: "rgba(5,150,105,.09)", color: "#059669" },
  warn: dk => dk ? { background: "rgba(251,191,36,.12)", color: "#fcd34d" } : { background: "rgba(217,119,6,.08)", color: "#b45309" },
};

/** Modal action button in the shared semantic colours. */
export function ModalBtn({ kind = "quiet", dark, className = "", style: styleOverride, ...props }) {
  const style = kind === "primary" ? { background: "linear-gradient(135deg,#c47d8e,#8b5e6b)", color: "#fff", border: "none", boxShadow: "0 8px 22px rgba(196,125,142,.28)" }
    : kind === "danger" ? { background: "#dc2626", color: "#fff", border: "none" }
    : kind === "success" ? { background: dark ? "#10b981" : "#059669", color: "#fff", border: "none" }
    : kind === "warn" ? { background: "#d97706", color: "#fff", border: "none" }
    : { background: dark ? "rgba(255,255,255,.05)" : "#faf9f7", color: dark ? "#8b90a0" : "#757170", border: `1px solid ${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.12)"}` };
  return (
    <button
      type="button"
      className={`font-[inherit] text-[13px] py-[9px] px-4 rounded-[10px] cursor-pointer whitespace-nowrap ${kind === "quiet" ? "font-bold" : "font-extrabold"} transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[.97] disabled:opacity-45 disabled:cursor-default ${FOCUS_RING} ${className}`}
      style={{ ...style, ...styleOverride }}
      {...props}
    />
  );
}

export function Modal({ open, onClose, title, subtitle, icon, intent = "accent", footer, children, dark, maxWidth = 480, labelledBy, variant = "dialog", bare = false }) {
  const sheet = variant === "sheet";
  // The full anatomy — icon chip, title, subtitle, X, footer — renders when a
  // dialog passes a title without `bare`. Bare callers keep their own layout.
  const headered = !sheet && !bare && !!title;
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    restoreRef.current = document.activeElement;
    const onKey = e => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    // The modal owns the screen while it is up.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Returning focus matters most for keyboard users, who would otherwise be
      // dropped back at the top of the document.
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  const ink = dark ? "#f2efe9" : "#1c1b19";
  const mut = dark ? "#8b90a0" : "#757170";
  const line = dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)";
  return (
    <div className={sheet ? "fixed inset-0 z-[300]" : "fixed inset-0 z-[300] flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-[6px]"}>
      <button type="button" aria-label="Close dialog" onClick={onClose}
        className="absolute inset-0 border-none cursor-default" style={{ background: "rgba(0,0,0,.55)" }} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        className={sheet
          ? `absolute inset-0 w-full h-full overflow-y-auto flex flex-col ${FOCUS_RING}`
          : `relative w-full rounded-t-2xl rounded-b-none md:rounded-2xl max-h-[85vh] ${bare || headered ? "overflow-hidden flex flex-col" : "p-5 overflow-y-auto"} ${FOCUS_RING}`}
        style={{
          maxWidth: sheet ? undefined : maxWidth,
          overscrollBehavior: "contain",
          background: dark ? "#131728" : "#fff",
          border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`,
          boxShadow: "0 24px 60px rgba(0,0,0,.25)",
        }}
      >
        {headered ? (
          <>
            <div className="md:hidden w-[38px] h-1 rounded-sm mx-auto mt-2.5 shrink-0" style={{ background: dark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.14)" }} />
            <div className="flex items-start gap-3 p-4 pb-0 shrink-0">
              {icon && (
                <span className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0" style={(INTENT_CHIP[intent] || INTENT_CHIP.accent)(dark)}>
                  {icon}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold leading-tight" style={{ color: ink }}>{title}</div>
                {subtitle && <div className="text-[12.5px] mt-0.5 leading-relaxed" style={{ color: mut }}>{subtitle}</div>}
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className={`w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0 cursor-pointer ${FOCUS_RING}`} style={{ background: dark ? "rgba(255,255,255,.05)" : "#faf9f7", border: `1px solid ${line}`, color: mut }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-4 py-3.5 overflow-y-auto min-h-0" style={{ color: ink }}>{children}</div>
            {footer && <div className="flex flex-col-reverse md:flex-row gap-2 md:justify-end px-4 pb-4 pt-0.5 shrink-0">{footer}</div>}
          </>
        ) : children}
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
      {hint && !error && <div id={hintId} className="text-[11px] mt-1 text-t-text-muted">{hint}</div>}
      {/* Announced when it appears, so the error is not silent for screen readers. */}
      {error && <div id={errorId} aria-live="polite" className="text-[11px] mt-1" style={{ color: dark ? "#f87171" : "#dc2626" }}>{error}</div>}
    </div>
  );
}
