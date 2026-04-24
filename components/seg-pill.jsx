'use client';

export function SegPill({ value, options, onChange, label, dark, t, fill, compact }) {
  return (
    <div className={`flex items-center gap-2.5 ${fill ? "w-full" : "shrink-0"}`}>
      {label && <span className="text-[10px] uppercase tracking-[1.5px] font-medium hidden desktop:inline whitespace-nowrap" style={{ color: t.textMuted }}>{label}</span>}
      <div className={`flex rounded-full p-[3px] border border-solid ${fill ? "w-full" : ""}`} style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)", borderColor: dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.14)" }}>
        {options.map(opt => {
          const v = typeof opt === "string" ? opt : opt.value;
          const display = typeof opt === "string" ? opt : opt.label;
          const active = value === v;
          return (
            <button
              key={v}
              onClick={(e) => onChange(v, e)}
              className={`${compact ? "py-[3px] px-1.5 text-[10px] max-lg:py-[2.5px] max-lg:px-1 max-lg:text-[9.5px] max-md:py-[3px] max-md:px-1.5 max-md:text-[11px]" : "py-[5px] px-3.5 text-[11.5px] max-lg:py-[4px] max-lg:px-2.5 max-lg:text-[11px] max-md:py-[5px] max-md:px-2.5 max-md:text-[13px]"} rounded-full font-medium capitalize cursor-pointer border-none font-[inherit] transition-all duration-200 whitespace-nowrap ${fill ? "flex-1 min-w-0" : ""}`}
              style={{
                background: active ? t.accent : "transparent",
                color: active ? "#fff" : t.textMuted,
                boxShadow: active ? "0 1px 4px rgba(196,125,142,.25)" : "none",
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
