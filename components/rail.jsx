'use client';
// The right rail, both sides: an eyebrow with a hairline (the same one the left
// rail uses), then a card of rows. Three row kinds: a fact, a list row, a step.

export function RailSec({ children, action }) {
  return <div className="rr-sec"><span>{children}</span>{action ? <span className="rr-act">{action}</span> : null}</div>;
}
export function RailCard({ children, style }) { return <div className="rr-card" style={style}>{children}</div>; }
export function RailFact({ label, value, mono = true, color }) {
  return <div className="rr-fact"><span>{label}</span><b className={mono ? "m" : ""} style={color ? { color } : undefined}>{value}</b></div>;
}
export function RailRow({ tile, round = false, title, sub, right, bar, onClick, href }) {
  const body = <>
    {tile != null && <span className={"rr-tile" + (round ? " round" : "")}>{tile}</span>}
    <span className="rr-txt"><b>{title}</b>{sub != null && sub !== "" && <i>{sub}</i>}{bar != null && <span className="rr-bar"><i style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} /></span>}</span>
    {right != null && <span className="rr-right m">{right}</span>}
  </>;
  const cls = "rr-row" + (tile == null ? " notile" : "") + (onClick || href ? " click" : "");
  if (href) return <a className={cls} href={href} target="_blank" rel="noopener noreferrer">{body}</a>;
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{body}</button>;
  return <div className={cls}>{body}</div>;
}
export function RailStep({ n, title, sub }) {
  return <div className="rr-row"><span className="rr-num">{n}</span><span className="rr-txt"><b>{title}</b>{sub && <i>{sub}</i>}</span></div>;
}
export function RailJump({ label, onClick }) { return <button type="button" className="rr-jump" onClick={onClick}><span>{label}</span><i>›</i></button>; }
export function RailNote({ children }) { return <div className="rr-note">{children}</div>; }
export function RailLink({ children, onClick, href }) {
  if (href) return <a className="rr-link" href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
  return <button type="button" className="rr-link" onClick={onClick}>{children}</button>;
}
export function RailBtn({ children, onClick }) { return <button type="button" className="rr-btn" onClick={onClick}>{children}</button>; }
export function RailEmpty({ children }) { return <div className="rr-empty">{children}</div>; }
export function RailLegend({ items }) {
  return <div className="rr-card rr-leg">{items.map(([name, color]) => <span key={name}><i style={{ background: color }} />{name}</span>)}</div>;
}
