/**
 * Wrap a component's user-facing English in tr(), or list what it would wrap.
 *
 *   node scripts/i18n-wrap.mjs components/dashboard.jsx --dry
 *   node scripts/i18n-wrap.mjs components/dashboard.jsx
 *
 * Doing this by hand, file by file, is what let the landing page ship with
 * French headings above English paragraphs three times running. Each miss was a
 * shape the ad-hoc regex of the moment did not cover, so all of them are here:
 *
 *   <p>Some words</p>                     inline text node
 *   <p>\n  Some words\n</p>               text node alone on its own line
 *   {cond ? 'Some words' : tr("Other")}   quoted string, either quote style
 *   >Some words{' '}                      fragment holding a trailing space
 *
 * What it refuses to touch matters as much. CSS class strings, SVG path data,
 * URLs, identifiers, and anything already inside tr() are skipped — and so is
 * anything at module scope, because tr() comes from a hook and calling it
 * outside a component is a runtime crash, not a translation bug. Those are
 * reported instead, to be moved inside the component by hand.
 *
 * Always dry-run first and read the list. This decides what a customer sees.
 */
import fs from 'node:fs';

const [file, ...flags] = process.argv.slice(2);
const DRY = flags.includes('--dry');

if (!file || !fs.existsSync(file)) {
  console.error('Usage: node scripts/i18n-wrap.mjs <file.jsx> [--dry]');
  process.exit(1);
}

const raw = fs.readFileSync(file, 'utf8');

// Anything that is plainly not prose. Kept deliberately blunt: a false skip
// costs one manual wrap, a false wrap puts a CSS class through a translator.
const NOT_PROSE = [
  /^[a-z-]+$/,                          // css class, html attr
  /^[Mm][\d.\s,-]/,                     // svg path data
  /^https?:|^\/|^#|^data:/,             // urls, anchors
  /^[A-Z_]+$/,                          // CONSTANTS
  /[{}<>$`]/,                           // embedded code
  /^rgba?\(|^linear-gradient|^\d+px|^var\(/,
  /^[\w.-]+@|^[\w-]+\.(com|ng|io|js|json)$/,
  /^(true|false|null|undefined|none|auto|flex|grid|button|submit|text|email|password|tel|number)$/i,
  /\b(?:className|onClick|style|aria-|data-)\b/,
  // Comparison operators read as tags: `a > b && c < d` looks exactly like
  // `>text<` to a regex, and the first run duly offered to translate it.
  /&&|\|\||=>|\?\?|\.\w+\(|\breturn\b|\bconst\b|\bawait\b/,
  // A person's name with an initial: "Blessing I.", "Tunde M." — testimonial
  // bylines, which stay as the person wrote them.
  /^[A-Z][a-z]+ [A-Z]\.$/,
  // Identifiers a customer copies rather than reads: example codes and the
  // company registration number in the footer.
  /^e\.g\. |RC ?\d{5,}/,
  // A service as the catalogue names it, which the API and the order form
  // both use — translating it here would describe something by another name.
  /^(Instagram|TikTok|YouTube|X|Facebook|Telegram) (Followers|Likes|Views|Subscribers|Comments|Shares)$/,
  // Brand names travel untranslated.
  /^(Instagram|TikTok|WhatsApp|Telegram|YouTube|Facebook|Twitter|X \(Twitter\)|Google|Nitro|Threads|Twitch|LinkedIn|Snapchat|Spotify)$/,
];

const isProse = (s) => {
  const t = s.trim();
  if (t.length < 2 || t.length > 400) return false;
  if (!/[A-Za-z]{2}/.test(t)) return false;
  if (!/[A-Za-z]/.test(t[0]) && !/^[₦$£€\d]/.test(t)) return false;
  if (NOT_PROSE.some((re) => re.test(t))) return false;
  // Tailwind-ish soup: many tokens, none of them words with spaces between them
  if (/^[\w:[\]/.%-]+(\s+[\w:[\]/.%-]+){2,}$/.test(t) && !/[a-z] [a-z]/.test(t)) return false;
  return true;
};

const lines = raw.split('\n');
const alreadyWrapped = new Set([...raw.matchAll(/tr\("((?:[^"\\]|\\.)*)"\)/g)].map((m) => m[1]));

// Component boundaries: tr() is a hook, so anything outside one is reported
// rather than wrapped — calling it at module scope is a crash, not a bug.
const COMPONENT_START = /^(?:export\s+)?(?:default\s+)?function\s+[A-Za-z]\w*|^(?:export\s+)?const\s+[A-Z]\w*\s*=\s*(?:\(|function|forwardRef|memo)/;
const inComponent = new Array(lines.length).fill(false);
{
  let depth = 0, started = false;
  lines.forEach((l, i) => {
    if (COMPONENT_START.test(l)) { started = true; depth = 0; }
    if (started) {
      depth += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
      inComponent[i] = true;
      if (depth <= 0 && /^\}/.test(l)) started = false;
    }
  });
}

const found = [];
const atModuleScope = [];
const record = (text, i) => {
  if (alreadyWrapped.has(text)) return false;
  if (!inComponent[i]) { atModuleScope.push(`${i + 1}: ${text.slice(0, 70)}`); return false; }
  found.push(text);
  return true;
};

// A line is a JSX text node only if the markup around it says so: the previous
// non-blank line ends a tag, and the next opens or closes one. Without this
// check every line of plain JavaScript without braces reads as prose — which,
// on the first run of this script, is exactly what happened.
const prevNonBlank = (i) => { for (let k = i - 1; k >= 0; k--) if (lines[k].trim()) return lines[k].trim(); return ''; };
const nextNonBlank = (i) => { for (let k = i + 1; k < lines.length; k++) if (lines[k].trim()) return lines[k].trim(); return ''; };

const out = lines.map((line, i) => {
  if (/^\s*(\/\/|\*|\/\*)/.test(line)) return line;
  let next = line;

  // 1. a text node alone on its own line, confirmed by its neighbours
  const solo = line.trim();
  if (!/[<>{}();=]/.test(solo) && isProse(solo)
      && /[>}]$/.test(prevNonBlank(i)) && /^[<{]/.test(nextNonBlank(i))
      && record(solo, i)) {
    return line.replace(solo, `{tr(${JSON.stringify(solo)})}`);
  }

  // 2. inline text nodes  >Some words<  — and the same thing after a JSX
  //    expression, }Some words<, which is how "Support on WhatsApp" sat in
  //    plain sight next to an icon through three passes of this script.
  next = next.replace(/([>}])([^<>{}\n]+)</g, (m, open, text) => {
    const t = text.trim();
    if (!isProse(t) || !record(t, i)) return m;
    const [lead] = text.match(/^\s*/); const [tail] = text.match(/\s*$/);
    return `${open}${lead}{tr(${JSON.stringify(t)})}${tail}<`;
  });

  // 3. a fragment holding a trailing space:  >Some words{' '}
  next = next.replace(/>([^<>{}\n]+?)\{' '\}/g, (m, text) => {
    const t = text.trim();
    if (!isProse(t) || !record(t, i)) return m;
    return `>{tr(${JSON.stringify(t)})}{' '}`;
  });

  // 4. prose in the attributes that carry it. Deliberately NOT every quoted
  //    string: className, keys and ids are quoted too, and a wrapped CSS class
  //    is a broken layout sent to a translator.
  next = next.replace(/(placeholder|title|aria-label|alt)=(["'])((?:[^"'\\]|\\.)+?)\2/g, (m, attr, q, text) => {
    if (!isProse(text) || !record(text, i)) return m;
    return `${attr}={tr(${JSON.stringify(text)})}`;
  });

  return next;
});

const unique = [...new Set(found)];

if (DRY) {
  console.log(`${file}\n${unique.length} string(s) would be wrapped:\n`);
  unique.forEach((s) => console.log('  •', s.length > 100 ? s.slice(0, 97) + '…' : s));
} else {
  fs.writeFileSync(file, out.join('\n'));
  console.log(`${file}: wrapped ${unique.length} string(s)`);
}
if (atModuleScope.length) {
  console.log(`\n${atModuleScope.length} at module scope — tr() is a hook, so move these inside the component by hand:`);
  atModuleScope.forEach((s) => console.log('  !', s));
}
