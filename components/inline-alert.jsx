import { useT } from "./locale";
import { OffsetIcon } from "./offset-icons";

const TYPES = {
  success: {
    bgD: "rgba(110,231,183,.1)", bgL: "rgba(5,150,105,.06)",
    brdD: "rgba(110,231,183,.28)", brdL: "rgba(5,150,105,.2)",
    colD: "#6ee7b7", colL: "#059669",
    icon: (c) => <OffsetIcon name="checkCircle" size={14} color={c} />,
  },
  error: {
    bgD: "rgba(252,165,165,.1)", bgL: "rgba(220,38,38,.06)",
    brdD: "rgba(252,165,165,.28)", brdL: "rgba(220,38,38,.2)",
    colD: "#fca5a5", colL: "#dc2626",
    icon: (c) => <OffsetIcon name="xCircle" size={14} color={c} />,
  },
  warning: {
    bgD: "rgba(251,191,36,.1)", bgL: "rgba(217,119,6,.06)",
    brdD: "rgba(251,191,36,.28)", brdL: "rgba(217,119,6,.2)",
    colD: "#fbbf24", colL: "#d97706",
    icon: (c) => <OffsetIcon name="alert" size={14} color={c} />,
  },
  info: {
    bgD: "rgba(96,165,250,.1)", bgL: "rgba(37,99,235,.06)",
    brdD: "rgba(96,165,250,.28)", brdL: "rgba(37,99,235,.2)",
    colD: "#60a5fa", colL: "#2563eb",
    icon: (c) => <OffsetIcon name="info" size={14} color={c} />,
  },
};

export default function InlineAlert({ type = "error", dark, children, onDismiss, className = "" }) {
  const tr = useT();
  const t = TYPES[type] || TYPES.error;
  const col = dark ? t.colD : t.colL;
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className={`flex items-start gap-3 py-3 px-3.5 rounded-xl overflow-hidden relative ${className}`}
      style={{
      background: dark ? t.bgD : t.bgL,
      border: `1px solid ${dark ? t.brdD : t.brdL}`,
      }}
    >
      <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ background: col }} />
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ml-1" style={{ background: `${col}18` }}>
        {t.icon(col)}
      </div>
      <div className="flex-1 min-w-0 pt-0.5 text-[13px] font-medium leading-snug" style={{ color: dark ? "#f5f3f0" : "#1a1917" }}>
        {children}
      </div>
      {onDismiss && (
        <button type="button" aria-label={tr("Dismiss message")} onClick={onDismiss} className="bg-transparent border-none cursor-pointer p-1 shrink-0 opacity-50 hover:opacity-80" style={{ color: dark ? "#8a8580" : "#757170" }}>
          <OffsetIcon name="close" size={12} />
        </button>
      )}
    </div>
  );
}
