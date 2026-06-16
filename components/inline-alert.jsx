const TYPES = {
  success: {
    bgD: "rgba(110,231,183,.1)", bgL: "rgba(5,150,105,.06)",
    brdD: "rgba(110,231,183,.28)", brdL: "rgba(5,150,105,.2)",
    colD: "#6ee7b7", colL: "#059669",
    icon: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  },
  error: {
    bgD: "rgba(252,165,165,.1)", bgL: "rgba(220,38,38,.06)",
    brdD: "rgba(252,165,165,.28)", brdL: "rgba(220,38,38,.2)",
    colD: "#fca5a5", colL: "#dc2626",
    icon: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  },
  warning: {
    bgD: "rgba(251,191,36,.1)", bgL: "rgba(217,119,6,.06)",
    brdD: "rgba(251,191,36,.28)", brdL: "rgba(217,119,6,.2)",
    colD: "#fbbf24", colL: "#d97706",
    icon: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  },
  info: {
    bgD: "rgba(96,165,250,.1)", bgL: "rgba(37,99,235,.06)",
    brdD: "rgba(96,165,250,.28)", brdL: "rgba(37,99,235,.2)",
    colD: "#60a5fa", colL: "#2563eb",
    icon: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  },
};

export default function InlineAlert({ type = "error", dark, children, onDismiss, className = "" }) {
  const t = TYPES[type] || TYPES.error;
  const col = dark ? t.colD : t.colL;
  return (
    <div className={`flex items-start gap-3 py-3 px-3.5 rounded-xl overflow-hidden relative ${className}`} style={{
      background: dark ? t.bgD : t.bgL,
      border: `1px solid ${dark ? t.brdD : t.brdL}`,
    }}>
      <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ background: col }} />
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ml-1" style={{ background: `${col}18` }}>
        {t.icon(col)}
      </div>
      <div className="flex-1 min-w-0 pt-0.5 text-[13px] font-medium leading-snug" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>
        {children}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="bg-transparent border-none cursor-pointer p-1 shrink-0 opacity-50 hover:opacity-80" style={{ color: dark ? "#8a8580" : "#757170" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      )}
    </div>
  );
}
