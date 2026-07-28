export function ProductScreenshot({ src, alt, dark }) {
  const border = dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)";
  const chromeBg = dark ? "rgba(255,255,255,.06)" : "#f0eeec";
  const urlBg = dark ? "rgba(255,255,255,.04)" : "#fff";
  const urlText = dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.4)";
  const shadow = dark
    ? "0 8px 32px rgba(0,0,0,.3), 0 2px 6px rgba(0,0,0,.2)"
    : "0 8px 32px rgba(0,0,0,.06), 0 2px 6px rgba(0,0,0,.04)";

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1.5px solid ${border}`, boxShadow: shadow }}>
      <div className="flex items-center gap-1.5 px-3.5 py-2.5" style={{ background: chromeBg, borderBottom: `1px solid ${border}` }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#ff5f57" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#febc2e" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#28c840" }} />
        <span className="ml-2 flex-1 rounded-md px-3 py-1 text-[11px]" style={{ background: urlBg, color: urlText, border: `1px solid ${border}` }}>
          nitro.ng
        </span>
      </div>
      <img src={src} alt={alt} className="w-full block" loading="lazy" />
    </div>
  );
}
