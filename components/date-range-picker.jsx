'use client';
import { useState, useEffect, useLayoutEffect, useRef } from "react";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function inRange(d, start, end) { if (!start || !end) return false; const t = d.getTime(); return t >= start.getTime() && t <= end.getTime(); }

function formatRange(start, end, presetLabel) {
  if (presetLabel) return presetLabel;
  if (!start && !end) return "All time";
  const fmt = (d) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  if (start && end && sameDay(start, end)) return fmt(start);
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  return `To ${fmt(end)}`;
}

const DEFAULT_PRESETS = [
  { label: "All time", value: null },
  { label: "Today", value: () => { const d = startOfDay(new Date()); return { start: d, end: d }; } },
  { label: "7 days", value: () => { const e = startOfDay(new Date()), s = new Date(e); s.setDate(s.getDate() - 6); return { start: s, end: e }; } },
  { label: "This month", value: () => { const now = new Date(); return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: startOfDay(now) }; } },
  { label: "30 days", value: () => { const e = startOfDay(new Date()), s = new Date(e); s.setDate(s.getDate() - 29); return { start: s, end: e }; } },
];

function MiniCalendar({ month, year, start, end, hovered, onSelect, onHover, dark, t }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = startOfDay(new Date());

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  if (rows[rows.length - 1].length < 7) {
    while (rows[rows.length - 1].length < 7) rows[rows.length - 1].push(null);
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0, marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: t.textMuted, padding: "2px 0" }}>{d}</div>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0 }}>
          {row.map((cell, ci) => {
            if (!cell) return <div key={ci} style={{ padding: "5px 0" }} />;
            const isToday = sameDay(cell, today);
            const isStart = sameDay(cell, start);
            const isEnd = sameDay(cell, end);
            const isSelected = isStart || isEnd;
            const rangeEnd = end || hovered;
            const isInRange = start && rangeEnd && !isSelected && inRange(cell, start < rangeEnd ? start : rangeEnd, start < rangeEnd ? rangeEnd : start);
            const isFuture = cell > today;

            let bg = "transparent";
            let color = t.text;
            let borderRadius = "6px";
            let fontWeight = 400;

            if (isSelected) {
              bg = t.accent;
              color = "#fff";
              fontWeight = 600;
            } else if (isInRange) {
              bg = dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.12)";
              borderRadius = 0;
            }
            if (isFuture) {
              color = dark ? "rgba(255,255,255,.2)" : "rgba(0,0,0,.2)";
            }

            return (
              <div
                key={ci}
                onClick={() => !isFuture && onSelect(cell)}
                onMouseEnter={() => !isFuture && onHover(cell)}
                style={{
                  textAlign: "center",
                  padding: "5px 0",
                  fontSize: 13,
                  fontWeight,
                  color,
                  background: bg,
                  borderRadius,
                  cursor: isFuture ? "default" : "pointer",
                  position: "relative",
                  transition: "background .15s",
                  borderBottom: isToday && !isSelected ? `2px solid ${t.accent}` : "2px solid transparent",
                }}
                onMouseOver={(e) => { if (!isFuture && !isSelected && !isInRange) e.currentTarget.style.background = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.05)"; }}
                onMouseOut={(e) => { if (!isSelected && !isInRange) e.currentTarget.style.background = "transparent"; }}
              >
                {cell.getDate()}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function DateRangePicker({ dark, t, value, onChange, presets, defaultPreset }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [picking, setPicking] = useState(null);
  const [hovered, setHovered] = useState(null);
  const items = presets || DEFAULT_PRESETS;
  const [presetLabel, setPresetLabel] = useState(() => {
    if (defaultPreset) {
      const match = (presets || DEFAULT_PRESETS).find(p => p.label === defaultPreset);
      if (match) return match.label;
    }
    return null;
  });
  const [isMobile, setIsMobile] = useState(false);
  const ref = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    if (!defaultPreset || value) return;
    const match = items.find(p => p.label === defaultPreset);
    if (match?.value) onChange(match.value());
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setPicking(null); setHovered(null); } };
    const esc = (e) => { if (e.key === "Escape") { setOpen(false); setPicking(null); setHovered(null); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !dropRef.current) return;
    const el = dropRef.current;
    const rect = el.getBoundingClientRect();
    if (rect.left < 4) { el.style.right = "auto"; el.style.left = "0"; }
    else if (rect.right > window.innerWidth - 4) { el.style.left = "auto"; el.style.right = "0"; }
  }, [open]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const handlePreset = (preset) => {
    if (!preset.value) {
      onChange(null);
      setPresetLabel("All time");
    } else {
      const range = preset.value();
      onChange(range);
      setPresetLabel(preset.label);
    }
    setPicking(null);
    setHovered(null);
    setOpen(false);
  };

  const handleCalendarSelect = (day) => {
    if (!picking) {
      setPicking(day);
      setHovered(null);
    } else {
      const start = day < picking ? day : picking;
      const end = day < picking ? picking : day;
      onChange({ start, end });
      setPresetLabel(null);
      setPicking(null);
      setHovered(null);
      setOpen(false);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
    setPresetLabel(null);
    setPicking(null);
    setHovered(null);
  };

  const displayText = presetLabel || formatRange(value?.start, value?.end);

  const btnStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "inherit",
    cursor: "pointer",
    border: `1px solid ${dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)"}`,
    background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)",
    color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
    transition: "border-color .15s",
  };

  const dropdownBg = dark ? "#1a1d2e" : "#fff";
  const dropdownBorder = dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)";

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(!open)} style={btnStyle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .6 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{displayText}</span>
        {value ? (
          <span onClick={handleClear} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", background: dark ? "rgba(255,255,255,.15)" : "rgba(0,0,0,.12)", cursor: "pointer", marginLeft: 2 }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </span>
        ) : (
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ opacity: .5, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open && (
        <div ref={dropRef} style={{
          position: "absolute",
          right: isMobile ? -8 : 0,
          top: "calc(100% + 6px)",
          background: dropdownBg,
          border: `1px solid ${dropdownBorder}`,
          borderRadius: 12,
          boxShadow: dark ? "0 8px 32px rgba(0,0,0,.5)" : "0 8px 32px rgba(0,0,0,.12)",
          zIndex: 50,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          overflow: isMobile ? "auto" : "hidden",
          minWidth: isMobile ? 280 : 420,
          maxHeight: isMobile ? "70vh" : "none",
        }}>
          {/* Presets */}
          <div style={{
            width: isMobile ? "100%" : 140,
            borderRight: isMobile ? "none" : `1px solid ${dropdownBorder}`,
            borderBottom: isMobile ? `1px solid ${dropdownBorder}` : "none",
            padding: isMobile ? "6px 8px" : "6px 0",
            flexShrink: 0,
            display: "flex",
            flexWrap: "wrap",
            flexDirection: isMobile ? "row" : "column",
            gap: isMobile ? 4 : 0,
          }}>
            {items.map((p) => {
              const active = presetLabel === p.label || (!value && !presetLabel && p.label === "All time");
              return (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p)}
                  style={{
                    display: "block",
                    width: isMobile ? "auto" : "100%",
                    textAlign: isMobile ? "center" : "left",
                    padding: isMobile ? "4px 8px" : "7px 12px",
                    borderRadius: isMobile ? 6 : 0,
                    fontSize: isMobile ? 11 : 13,
                    fontWeight: active ? 600 : 400,
                    fontFamily: "inherit",
                    background: active ? (dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)") : (isMobile ? (dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)") : "transparent"),
                    color: active ? t.accent : (dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)"),
                    border: isMobile ? `1px solid ${active ? (dark ? "rgba(196,125,142,.5)" : "rgba(196,125,142,.45)") : (dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.1)")}` : (active ? `1px solid ${dark ? "rgba(196,125,142,.5)" : "rgba(196,125,142,.45)"}` : "1px solid transparent"),
                    cursor: "pointer",
                    transition: "background .15s",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? (dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)") : (isMobile ? (dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)") : "transparent"); }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Calendar */}
          <div style={{ padding: "12px 14px", flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 6, color: t.textSoft, fontSize: 16 }} onMouseEnter={e => e.currentTarget.style.background = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.05)"} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{MONTHS[viewMonth]} {viewYear}</span>
              <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 6, color: t.textSoft, fontSize: 16 }} onMouseEnter={e => e.currentTarget.style.background = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.05)"} onMouseLeave={e => e.currentTarget.style.background = "none"}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 6 15 12 9 18" /></svg>
              </button>
            </div>

            {picking && (
              <div style={{ fontSize: 11, color: t.accent, marginBottom: 6, fontWeight: 500 }}>
                Select end date
              </div>
            )}

            <MiniCalendar
              month={viewMonth}
              year={viewYear}
              start={picking || value?.start}
              end={picking ? null : value?.end}
              hovered={picking ? hovered : null}
              onSelect={handleCalendarSelect}
              onHover={setHovered}
              dark={dark}
              t={t}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterDropdown({ dark, t, value, onChange, options, icon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !dropRef.current) return;
    const el = dropRef.current;
    const rect = el.getBoundingClientRect();
    if (rect.left < 4) { el.style.right = "auto"; el.style.left = "0"; }
    else if (rect.right > window.innerWidth - 4) { el.style.left = "auto"; el.style.right = "0"; }
  }, [open]);

  const current = options.find(o => o.value === value);
  const dropdownBg = dark ? "#1a1d2e" : "#fff";
  const dropdownBorder = dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)";

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
        border: `1px solid ${dropdownBorder}`,
        background: dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.06)",
        color: dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)",
        transition: "border-color .15s",
      }}>
        {icon || null}
        <span>{current?.label || value}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ opacity: .5, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div ref={dropRef} style={{
          position: "absolute",
          right: 0,
          top: "calc(100% + 6px)",
          background: dropdownBg,
          border: `1px solid ${dropdownBorder}`,
          borderRadius: 10,
          boxShadow: dark ? "0 8px 32px rgba(0,0,0,.5)" : "0 8px 32px rgba(0,0,0,.12)",
          zIndex: 50,
          minWidth: 140,
          padding: "4px 0",
          overflow: "hidden",
        }}>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "7px 12px",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  fontFamily: "inherit",
                  background: active ? (dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)") : "transparent",
                  color: active ? t.accent : (dark ? "rgba(255,255,255,.7)" : "rgba(0,0,0,.7)"),
                  border: "none",
                  cursor: "pointer",
                  transition: "background .15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.04)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? (dark ? "rgba(196,125,142,.15)" : "rgba(196,125,142,.08)") : "transparent"; }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
