'use client';
import { OffsetIcon } from "./offset-icons";

// The right rail, both sides: an eyebrow with a hairline (the same one the left
// rail uses), then a card of rows. Three row kinds: a fact, a list row, a step.
//
// Offset print (approved 17 Oct 2026): a heading, a fact, a jump and an empty
// card can each carry an icon. `icon` is a name from the shared set, or a node
// for the currency coin, which has to read the locale.
const railIcon = (icon, size) => (typeof icon === "string" ? <OffsetIcon name={icon} size={size} /> : icon);

export function RailSec({ children, action, icon }) {
  return <div className="rr-sec"><span>{icon && <i className="rr-si">{railIcon(icon, 14)}</i>}{children}</span>{action ? <span className="rr-act">{action}</span> : null}</div>;
}
export function RailCard({ children, style }) { return <div className="rr-card" style={style}>{children}</div>; }
export function RailFact({ label, value, mono = true, color, icon }) {
  return <div className="rr-fact"><span>{icon && <i className="rr-fi" style={color ? { color } : undefined}>{railIcon(icon, 15)}</i>}{label}</span><b className={mono ? "m" : ""} style={color ? { color } : undefined}>{value}</b></div>;
}
export function RailRow({ tile, round = false, print = false, title, sub, right, bar, onClick, href }) {
  const body = <>
    {tile != null && <span className={"rr-tile" + (round ? " round" : "") + (print ? " print" : "")}>{tile}</span>}
    <span className="rr-txt"><b>{title}</b>{sub != null && sub !== "" && <i>{sub}</i>}{bar != null && <span className="rr-bar"><i style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} /></span>}</span>
    {right != null && <span className="rr-right m">{right}</span>}
  </>;
  const cls = "rr-row" + (tile == null ? " notile" : "") + (onClick || href ? " click" : "");
  if (href) return <a className={cls} href={href} target="_blank" rel="noopener noreferrer">{body}</a>;
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{body}</button>;
  return <div className={cls}>{body}</div>;
}
export function RailStep({ n, tile, title, sub }) {
  return <div className="rr-row"><span className={"rr-num" + (tile ? " tile" : "")}>{tile || n}</span><span className="rr-txt"><b>{title}</b>{sub && <i>{sub}</i>}</span></div>;
}
const ARROW = <svg className="dir-flip" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export function RailJump({ label, onClick, icon }) { return <button type="button" className="rr-jump" onClick={onClick}>{icon && <i className="rr-ji">{railIcon(icon, 15)}</i>}<span>{label}</span><i className="rr-arrow">{ARROW}</i></button>; }
export function RailNote({ children }) { return <div className="rr-note">{children}</div>; }
export function RailLink({ children, onClick, href }) {
  if (href) return <a className="rr-link" href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
  return <button type="button" className="rr-link" onClick={onClick}>{children}</button>;
}
export function RailBtn({ children, onClick }) { return <button type="button" className="rr-btn" onClick={onClick}>{children}</button>; }
export function RailEmpty({ children, icon }) { return <div className="rr-empty">{icon && <i className="rr-ei">{railIcon(icon, 18)}</i>}{children}</div>; }
export function RailLegend({ items }) {
  return <div className="rr-card rr-leg">{items.map(([name, color]) => <span key={name}><i style={{ background: color }} />{name}</span>)}</div>;
}
