export const fD = (d) => new Date(d).toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" });
export const readTime = (text) => { const w = (text || "").replace(/<[^>]*>/g, "").replace(/[#*_\[\]()]/g, "").split(/\s+/).length; return Math.max(1, Math.round(w / 200)); };

/* Lightweight markdown → HTML */
export function md(src) {
  if (!src) return "";
  const blocks = src.split(/\n{2,}/);
  const out = [];
  let inList = null;

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (/^#{1,3} /.test(trimmed)) {
      if (inList) { out.push(`</${inList}>`); inList = null; }
      const level = trimmed.match(/^(#{1,3})/)[1].length;
      const text = inline(trimmed.replace(/^#{1,3}\s+/, ''));
      out.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      if (inList) { out.push(`</${inList}>`); inList = null; }
      out.push('<hr/>');
      continue;
    }

    const lines = trimmed.split('\n');
    const isUL = lines.every(l => /^[-*] /.test(l.trim()));
    const isOL = lines.every(l => /^\d+\. /.test(l.trim()));

    if (isUL) {
      if (inList !== 'ul') { if (inList) out.push(`</${inList}>`); out.push('<ul>'); inList = 'ul'; }
      lines.forEach(l => out.push(`<li>${inline(l.trim().replace(/^[-*] /, ''))}</li>`));
      continue;
    }
    if (isOL) {
      if (inList !== 'ol') { if (inList) out.push(`</${inList}>`); out.push('<ol>'); inList = 'ol'; }
      lines.forEach(l => out.push(`<li>${inline(l.trim().replace(/^\d+\. /, ''))}</li>`));
      continue;
    }

    if (inList) { out.push(`</${inList}>`); inList = null; }
    out.push(`<p>${inline(lines.join(' '))}</p>`);
  }
  if (inList) out.push(`</${inList}>`);
  return out.join('\n');
}

export function inline(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
