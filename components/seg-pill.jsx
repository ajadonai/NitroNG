'use client';

export function SegPill({ value, options, onChange, label, dark, t, fill, compact }) {
  return (
    <div className={`flex items-center gap-2.5 ${fill ? "w-full" : "shrink-0"}`}>
      {label && <span className="text-[11px] uppercase tracking-[1.5px] font-medium hidden desktop:inline whitespace-nowrap" style={{ color: t.textMuted }}>{label}</span>}
      <div className={`flex rounded-[10px] p-[3px] border border-solid gap-[3px] ${fill ? "w-full" : ""}`} style={{ background: dark ? "#111634" : "#faf9f7", borderColor: t.cardBorder }}>
        {options.map(opt => {
          const v = typeof opt === "string" ? opt : opt.value;
          const display = typeof opt === "string" ? opt : opt.label;
          const active = value === v;
          return (
            <button
              key={v}
              onClick={(e) => onChange(v, e)}
              className={`${compact ? "py-[3px] px-1.5 text-[11px] max-lg:py-[2.5px] max-lg:px-1 max-lg:text-[11px] max-md:py-[3px] max-md:px-1.5 max-md:text-[11px]" : "py-[5px] px-3.5 text-[11px] max-lg:py-[4px] max-lg:px-2.5 max-lg:text-[11px] max-md:py-[5px] max-md:px-2.5 max-md:text-[13px]"} rounded-[7px] font-semibold cursor-pointer border-none font-[inherit] transition-all duration-200 whitespace-nowrap ${fill ? "flex-1 min-w-0" : ""}`}
              style={{
                background: active ? (dark ? "#141930" : "#fff") : "transparent",
                color: active ? t.text : t.textMuted,
                boxShadow: active ? "0 1px 3px rgba(0,0,0,.12)" : "none",
                fontWeight: 600,
              }}
            >
              {display}
            </button>
          );
        })}
      </div>
    </div>
  );
}
