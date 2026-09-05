'use client';
// Loading states shaped like the pages they stand in for: the same facts row,
// toolbar and list the loaded page draws, so nothing jumps when data lands.

export function Bone({ dark, w = "100%", h = 12, r = 6, style }) {
  return <div className={`skel-bone ${dark ? "skel-dark" : "skel-light"}`} style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

const line = (dark) => dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.12)";
const card = (dark) => dark ? "#171126" : "#fff";

// The facts row: a card split into tiles, each with a big number and two lines under it.
export function SkelFacts({ dark, n = 4 }) {
  return (
    <div className="skf" style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 1fr)`, background: card(dark), border: `1px solid ${line(dark)}`, borderRadius: 14 }}>
      <style>{`@media (max-width:900px){.skf{grid-template-columns:1fr 1fr !important}.skf>div:nth-child(3){border-left:0 !important}.skf>div:nth-child(n+3){border-top:1px solid ${line(dark)}}}`}</style>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ padding: "12px 16px", borderLeft: i ? `1px solid ${line(dark)}` : 0, display: "flex", flexDirection: "column", gap: 7 }}>
          <Bone dark={dark} w="55%" h={20} />
          <Bone dark={dark} w="40%" h={9} />
          <Bone dark={dark} w="65%" h={9} />
        </div>
      ))}
    </div>
  );
}

// The toolbar: a search box and a couple of dropdowns.
export function SkelBar({ dark, search = true, pills = 2, right = false }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {search && <Bone dark={dark} w={300} h={36} r={10} style={{ maxWidth: "100%" }} />}
      {Array.from({ length: pills }, (_, i) => <Bone key={i} dark={dark} w={110} h={36} r={10} />)}
      {right && <Bone dark={dark} w={80} h={34} r={9} style={{ marginLeft: "auto" }} />}
    </div>
  );
}

// A list card: an optional header strip, then rows of avatar, two lines, a figure on the right.
export function SkelList({ dark, rows = 5, header = true, avatar = true, title, rowH = 56, bare = false }) {
  return (
    <div style={bare ? {} : { background: card(dark), border: `1px solid ${line(dark)}`, borderRadius: 14, overflow: "hidden" }}>
      {title && <div style={{ padding: "11px 16px", borderBottom: `1px solid ${line(dark)}` }}><Bone dark={dark} w={120} h={10} /></div>}
      {header && !title && !bare && <div style={{ height: 34, padding: "0 14px", display: "flex", alignItems: "center", gap: 12, background: dark ? "#111634" : "#faf9f7", borderBottom: `1px solid ${line(dark)}` }}><Bone dark={dark} w={60} h={8} /><Bone dark={dark} w={80} h={8} /><Bone dark={dark} w={50} h={8} /></div>}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: rowH, borderTop: i ? `1px solid ${dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)"}` : 0 }}>
          {avatar && <Bone dark={dark} w={34} h={34} r={avatar === "square" ? 10 : 17} style={{ flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}><Bone dark={dark} w={`${45 + (i % 3) * 12}%`} h={11} /><Bone dark={dark} w={`${28 + (i % 2) * 10}%`} h={9} /></div>
          <Bone dark={dark} w={64} h={12} style={{ flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

// A block of text: a few lines at the widths a paragraph settles into.
export function SkelText({ dark, lines = 3, h = 10 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: lines }, (_, i) => <Bone key={i} dark={dark} w={i === lines - 1 ? "55%" : `${88 - (i % 2) * 14}%`} h={h} />)}
    </div>
  );
}
