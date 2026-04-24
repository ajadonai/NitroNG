export const fD = (d) => new Date(d).toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" });
export const readTime = (text) => { const w = (text || "").replace(/<[^>]*>/g, "").replace(/[#*_\[\]()]/g, "").split(/\s+/).length; return Math.max(1, Math.round(w / 200)); };

export function md(src) {
  if (!src) return "";
  if (/^<[a-z][\s\S]*>/i.test(src.trim())) return src;
  const lines = src.split('\n');
  const out = [];
  let inList = null;
  let inBlockquote = false;
  let inTable = false;
  let inCode = false;
  let codeLang = '';
  let codeLines = [];
  let i = 0;

  function flushList() { if (inList) { out.push(`</${inList}>`); inList = null; } }
  function flushBq() { if (inBlockquote) { out.push('</blockquote>'); inBlockquote = false; } }
  function flushTable() { if (inTable) { out.push('</tbody></table>'); inTable = false; } }
  function flushAll() { flushList(); flushBq(); flushTable(); }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inCode) {
      if (trimmed === '```') {
        out.push(`<pre><code${codeLang ? ` class="language-${codeLang}"` : ''}>${codeLines.join('\n')}</code></pre>`);
        inCode = false;
        codeLines = [];
        codeLang = '';
      } else {
        codeLines.push(trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      }
      i++;
      continue;
    }

    if (/^```/.test(trimmed)) {
      flushAll();
      inCode = true;
      codeLang = trimmed.slice(3).trim();
      i++;
      continue;
    }

    if (trimmed === '') {
      flushList();
      flushBq();
      i++;
      continue;
    }

    if (/^#{1,3} /.test(trimmed)) {
      flushAll();
      const level = trimmed.match(/^(#{1,3})/)[1].length;
      const text = inline(trimmed.replace(/^#{1,3}\s+/, ''));
      out.push(`<h${level}>${text}</h${level}>`);
      i++;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flushAll();
      out.push('<hr/>');
      i++;
      continue;
    }

    if (/^> /.test(trimmed) || trimmed === '>') {
      flushList(); flushTable();
      if (!inBlockquote) { out.push('<blockquote>'); inBlockquote = true; }
      const bqText = trimmed.replace(/^>\s?/, '');
      if (bqText) out.push(`<p>${inline(bqText)}</p>`);
      i++;
      continue;
    }

    if (/^\|/.test(trimmed) && /\|$/.test(trimmed)) {
      flushList(); flushBq();
      if (!inTable) {
        const headers = trimmed.split('|').filter(c => c.trim() !== '').map(c => `<th>${inline(c.trim())}</th>`);
        out.push(`<table><thead><tr>${headers.join('')}</tr></thead><tbody>`);
        inTable = true;
        if (i + 1 < lines.length && /^\|[-\s|:]+\|$/.test(lines[i + 1].trim())) i++;
      } else {
        const cells = trimmed.split('|').filter(c => c.trim() !== '').map(c => `<td>${inline(c.trim())}</td>`);
        out.push(`<tr>${cells.join('')}</tr>`);
      }
      i++;
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (/^[-*] /.test(trimmed)) {
      flushBq(); flushTable();
      if (inList !== 'ul') { if (inList) out.push(`</${inList}>`); out.push('<ul>'); inList = 'ul'; }
      out.push(`<li>${inline(trimmed.replace(/^[-*] /, ''))}</li>`);
      i++;
      continue;
    }

    if (/^\d+\. /.test(trimmed)) {
      flushBq(); flushTable();
      if (inList !== 'ol') { if (inList) out.push(`</${inList}>`); out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${inline(trimmed.replace(/^\d+\. /, ''))}</li>`);
      i++;
      continue;
    }

    flushAll();
    let para = trimmed;
    while (i + 1 < lines.length && lines[i + 1].trim() !== '' && !/^(#{1,3} |[-*] |\d+\. |>|\||```|---+$)/.test(lines[i + 1].trim())) {
      i++;
      para += ' ' + lines[i].trim();
    }
    out.push(`<p>${inline(para)}</p>`);
    i++;
  }

  if (inCode) out.push(`<pre><code>${codeLines.join('\n')}</code></pre>`);
  flushAll();
  return out.join('\n');
}

export function inline(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) =>
      url.startsWith('/') ? `<a href="${url}">${text}</a>` : `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`);
}
