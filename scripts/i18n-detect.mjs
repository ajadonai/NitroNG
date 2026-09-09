/**
 * Finding English that a customer can read but nobody has wrapped.
 *
 * One engine, two callers. `scripts/i18n-wrap.mjs` uses it to rewrite a file;
 * `tests/i18n-drift-guard.test.js` uses it to fail the build when a new page
 * ships English under a French dashboard. They share this module rather than
 * each carrying a regex, because two detectors that are supposed to agree will
 * not: the wrapper learned the `}Text<` shape three passes after the guard
 * would have needed it, and in between "Support on WhatsApp" sat in plain
 * sight on the dashboard while every report said the dictionaries were full.
 *
 * The shapes it knows, each one added because something shipped English:
 *
 *   <p>Some words</p>                     inline text node
 *   <p>\n  Some words\n</p>               text node alone on its own line
 *   >Some words{' '}                      fragment holding a trailing space
 *   {cond ? 'Some words' : tr("Other")}   quoted string, either quote style
 *   placeholder="Some words"              the attributes that carry prose
 *   { label: "Some words", onClick: … }   a quoted value on a prose-ish key
 *
 * That last one is the newest and the most expensive so far. The three tiles
 * on the dashboard overview — How it works, What to expect, Support — were
 * `label:` values rendered at `{q.label}`, and so were the seven tutorial
 * steps and four expectation cards behind them. Twenty-eight strings, read in
 * English by every customer on every non-English dashboard, invisible to a
 * detector that only understood markup.
 *
 * What it refuses to touch matters as much. CSS classes, SVG path data, URLs,
 * identifiers and brand names are skipped, and so is anything on the
 * DELIBERATELY_ENGLISH list below.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Where customer-facing prose lives. */
export const SCANNED = ['components', 'app'];

/**
 * What the guard does not police, and why each one:
 *
 *   admin — Trip's own screens. Nobody else ever opens them, so translating
 *           them would be work in exchange for nothing. This is the single
 *           biggest exclusion and it is a product decision, not a technical one.
 *   api   — route handlers. Error strings there are read by developers and by
 *           the reseller API, which is documented in English on purpose.
 *   tests — obviously.
 *   locale routes — app/fr, app/sw and app/ar hold each page's title and
 *           description already written in that language. They are the
 *           translation, not something awaiting one, and there is no hook to
 *           wrap them in: metadata is resolved on the server before any
 *           component exists.
 */
export const NOT_SCANNED = [/(^|\/)admin[-/]/, /^app\/api\//, /\.test\./, /\/m\/.*\.test\./, /^app\/(fr|sw|ar)\//];

const isScanned = (rel) => !NOT_SCANNED.some((re) => re.test(rel));

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (/\.jsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/**
 * Every covered file with unwrapped prose in it, as { file: count }, plus the
 * strings themselves for whoever has to go and fix them. One number per file:
 * a string that cannot be wrapped where it sits still counts, because a
 * customer reading it does not care that moving it is the harder job.
 */
export function scanRepo(root = process.cwd()) {
  const rows = new Map();
  for (const dir of SCANNED) {
    for (const abs of walk(path.join(root, dir))) {
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (!isScanned(rel)) continue;
      const { found, moduleScope } = scan(fs.readFileSync(abs, 'utf8'));
      const texts = [...new Set([...found, ...moduleScope].map((f) => f.text))];
      if (texts.length) rows.set(rel, { count: texts.length, texts, moduleScope });
    }
  }
  return rows;
}

/** Anything that is plainly not prose. Kept deliberately blunt: a false skip
 *  costs one manual wrap, a false wrap puts a CSS class through a translator. */
export const NOT_PROSE = [
  /^[a-z-]+$/,                          // css class, html attr
  /^[Mm][\d.\s,-]/,                     // svg path data
  /^https?:|^\/|^#|^data:/,             // urls, anchors
  /^[A-Z_]+$/,                          // CONSTANTS
  /[{}<>$`]/,                           // embedded code
  /^rgba?\(|^linear-gradient|^-?[\d.]+(px|rem|em|%)\b|^var\(/,
  // A CSS duration, so a transition or animation shorthand is not offered for
  // translation: "transform .15s", "progress-pulse 2.8s ease-in-out infinite".
  /(^|\s)[\d.]+m?s(\s|$)/,
  // A CSS at-rule inside a <style> block: '@keyframes skeletonShimmer' was
  // wrapped, which would have put the animation name through a translator and
  // silently broken the animation that referenced it.
  /^@[a-z-]+\s/i,
  // A font stack: "'JetBrains Mono', monospace".
  /\b(serif|monospace|ui-monospace|system-ui|cursive)\b/,
  // A CSS selector inside a <style> block: ".rcp-ck svg", ".rcp-f:first-child",
  // ".tx-col.is-off:hover". Nothing a customer reads starts with a dot.
  /^\.|^[a-z]+:(?:first|last|nth|hover|focus|before|after)/,
  // SVG and CSS keyword values that are not words on a page.
  /^(currentColor|round|butt|square|miter|bevel|evenodd|nonzero|inherit|initial|unset)$/,
  // A tracking identifier: the Google Ads conversion label
  // "AW-18121451903/9P3HCL_TlaMcEP_S_cBD".
  /^[A-Z]{2}-\d{5,}/,
  // A fragment that starts mid-expression, or arithmetic: ", icon:" and
  // "(p + (dx" both reached the list before these.
  /^[,;:]|^\([a-z]\s*[+\-*/]/,
  /^[\w.-]+@|^[\w-]+\.(com|ng|io|js|json)$/,
  /^(true|false|null|undefined|none|auto|flex|grid|button|submit|text|email|password|tel|number)$/i,
  /\b(?:className|onClick|style|aria-|data-)\b/,
  // Comparison operators read as tags: `a > b && c < d` looks exactly like
  // `>text<` to a regex, and the first run duly offered to translate it.
  // `===` and a ternary opening an array are both code that reads as a text
  // node once a nearby `<svg …>` supplies the `>`: the funds page offered
  // `: g.id === "crypto" ?` and `0 ? ["Coupon bonus",` for translation.
  /&&|\|\||=>|\?\?|===|!==|\?\s*\[|\w\(|\breturn\b|\bconst\b|\bawait\b/,
  // A person's name with an initial: "Blessing I.", "Tunde M." — testimonial
  // bylines, which stay as the person wrote them.
  /^[A-Z][a-z]+ [A-Z]\.$/,
  // Identifiers a customer copies rather than reads.
  /^e\.g\. |RC ?\d{5,}/,
  // A service as the catalogue names it, which the API and the order form both
  // use — translating it here would describe something by another name.
  /^(Instagram|TikTok|YouTube|X|Facebook|Telegram) (Followers|Likes|Views|Subscribers|Comments|Shares)$/,
  // Brand names travel untranslated. This list is the catalogue's platforms,
  // read out of components/new-order.jsx rather than guessed — a missing one
  // means a translator is handed "Boomplay" and asked what it means.
  // The category headings above them ("Music", "Web Traffic", "SEO & Reviews",
  // "Social Platforms") are deliberately NOT here: those are our words.
  /^(Instagram|TikTok|WhatsApp|Telegram|YouTube|Facebook|Twitter|X \(Twitter\)|Google|Google Analytics|Nitro|Threads|Twitch|LinkedIn|Snapchat|Spotify)$/,
  /^(Pinterest|Reddit|Discord|Kick|Tumblr|Quora|OnlyFans|Clubhouse|Kwai|Vimeo|Bluesky)$/,
  /^(Audiomack|Boomplay|Apple Music|SoundCloud|Deezer|Tidal|Shazam|Mixcloud)$/,
  /^(Trustpilot|App Store|Play Store)$/,
  // A property access that reached here as text: `r => r.qty <` reads as
  // `>text<` once the arrow's own `>` is mistaken for a closing tag.
  /^[\w$]+(\.[\w$]+)+$/,
];

/**
 * English that stays English on purpose — every entry with the reason, because
 * the value of this list is not that it silences the guard but that it makes
 * somebody write down why. Reviewing it is the moment to ask "should this
 * actually be translated?", which is a question that never gets asked about a
 * string nobody ever noticed.
 */
export const DELIBERATELY_ENGLISH = new Map([
  ["Budget", "A tier name. It is the label on the button the customer presses; translating it here would name the tier something the order form never says."],
  ["Standard", "A tier name — see Budget."],
  ["Premium", "A tier name — see Budget."],
  ["Hi Nitro, I need help", "The WhatsApp prefill. Addressed to the support desk in Lagos, not to the customer reading it."],
]);

/** Is this a sentence a customer reads, and is it ours to translate? */
export function isProse(s) {
  const t = s.trim();
  if (t.length < 2 || t.length > 400) return false;
  if (!/[A-Za-z]{2}/.test(t)) return false;
  // Look past anything decorative at the front. "🇳🇬 Nigerian Services" and
  // "— Look for the flag! Local engagement for Naija creators." both sat
  // untranslated on the mobile order guide because the first character was not
  // a letter, so neither ever reached this test as prose. A flag, a bullet or a
  // dash in front of a sentence does not stop it being a sentence.
  const head = t.replace(/^[^\p{L}\p{N}₦$£€]+/u, "");
  if (!head) return false;
  if (!/[A-Za-z]/.test(head[0]) && !/^[₦$£€\d]/.test(head)) return false;
  if (NOT_PROSE.some((re) => re.test(t))) return false;
  if (DELIBERATELY_ENGLISH.has(t)) return false;
  // Tailwind-ish soup: many tokens, none of them words with spaces between them
  if (/^[\w:[\]/.%-]+(\s+[\w:[\]/.%-]+){2,}$/.test(t) && !/[a-z] [a-z]/.test(t)) return false;
  return true;
}

/**
 * Object keys whose value is prose often enough to be worth reading. Not every
 * key: `id`, `name`, `key`, `type` and `variant` carry identifiers that would
 * break if translated, and `value` is usually a number.
 */
/**
 * Names whose value is prose often enough to be worth reading — as an object
 * key, `{ label: "How it works" }`, and as a JSX prop, `<RailFact label="Top
 * platform" />`. One list for both, because they were two lists once and the
 * prop half was missing `label`: "Top platform", "Average order", "This week",
 * "Member since", "Your code", "Referrals" and "Earned" sat in English in the
 * dashboard sidebar, and Trip reported them after the object-key half of the
 * very same word had already been fixed twenty lines above.
 *
 * Not every name: `id`, `name`, `key`, `type`, `variant` and `value` carry
 * identifiers that break when translated.
 */
const PROSE_NAMES = "label|title|desc|description|heading|subheading|subtitle|sub|subtext|caption|hint|tooltip|cta|blurb|summary|note|body|placeholder|empty|error|aria-label|alt";

/** A quoted string, either quote style, allowing the other quote inside it. */
const QUOTED = `(?:"((?:[^"\\\\]|\\\\.)*)"|'((?:[^'\\\\]|\\\\.)*)')`;

const PROSE_KEY = new RegExp(`\\b(${PROSE_NAMES})\\s*:\\s*${QUOTED}`, "g");

/** The same names as JSX props. Deliberately not every quoted attribute:
 *  className, keys and ids are quoted too, and a wrapped CSS class is a broken
 *  layout sent to a translator. */
const PROSE_ATTR = new RegExp(`\\b(${PROSE_NAMES})=${QUOTED}`, "g");

/** tr() is a hook, so a string outside a component cannot simply be wrapped —
 *  it has to be moved inside one first. Those are reported, never rewritten. */
// Capital initial, both forms. React names components that way, and the rule
// earns its keep: `function txStatusMeta(tx, dk)` is a plain helper called from
// a render, and the older `[A-Za-z]` here let the wrapper put tr() inside it —
// where tr is not a parameter, not in scope, and a ReferenceError on first use.
const COMPONENT_START = /^(?:export\s+)?(?:default\s+)?function\s+[A-Z]\w*|^(?:export\s+)?const\s+[A-Z]\w*\s*=\s*(?:\(|function|forwardRef|memo)/;

function componentMask(lines) {
  const mask = new Array(lines.length).fill(false);
  let depth = 0, started = false;
  lines.forEach((l, i) => {
    if (COMPONENT_START.test(l)) { started = true; depth = 0; }
    if (started) {
      depth += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
      mask[i] = true;
      // A body ends when its braces balance — not when a line happens to start
      // with `}`. That older test never fired for a single-line arrow component
      // (`const IS = (d) => <svg …/>;` opens no block at all), so the mask
      // stayed "inside IS" for the rest of the file and the module-scope
      // constant two lines below it — PLATFORM_GROUPS — was wrapped in tr().
      // tr() is a hook; that is a crash on import, not a translation bug.
      if (depth <= 0) started = false;
    }
  });
  return mask;
}

/**
 * Read a source file. Returns the rewritten text plus what was found, split by
 * whether tr() can be called where the string sits.
 *
 * Note there is no "already wrapped" set. An earlier version kept one per file
 * and skipped any string that appeared wrapped anywhere in it — which is the
 * second reason the overview tiles hid for weeks: "How it works" was wrapped in
 * the modal heading twenty lines below, so the tile label was suppressed before
 * anything even looked at it. The shapes above cannot match wrapped text
 * anyway: `{tr("X")}` carries braces, and every shape excludes them.
 */
export function scan(raw) {
  const lines = raw.split('\n');
  const mask = componentMask(lines);
  const found = [];        // wrappable right here
  const moduleScope = [];  // must move inside a component first

  const record = (text, i) => {
    const at = { text, line: i + 1 };
    if (!mask[i]) { moduleScope.push(at); return false; }
    found.push(at);
    return true;
  };

  const prevNonBlank = (i) => { for (let k = i - 1; k >= 0; k--) if (lines[k].trim()) return lines[k].trim(); return ''; };
  const nextNonBlank = (i) => { for (let k = i + 1; k < lines.length; k++) if (lines[k].trim()) return lines[k].trim(); return ''; };

  const out = lines.map((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return line;
    let next = line;

    // 1. a text node alone on its own line, confirmed by its neighbours. Without
    //    that confirmation every line of plain JavaScript reads as prose — which,
    //    on the first run of the wrapper, is exactly what happened.
    const solo = line.trim();
    if (!/[<>{}();=]/.test(solo) && isProse(solo)
        && /[>}]$/.test(prevNonBlank(i)) && /^[<{]/.test(nextNonBlank(i))
        && record(solo, i)) {
      return line.replace(solo, `{tr(${JSON.stringify(solo)})}`);
    }

    // 2. inline text nodes  >Some words<  — and the same thing after a JSX
    //    expression, }Some words<, which is how "Support on WhatsApp" sat in
    //    plain sight next to an icon through three passes of the wrapper.
    next = next.replace(/(?<![=!])([>}])([^<>{}\n]+)</g, (m, open, text) => {
      const t = text.trim();
      if (!isProse(t) || !record(t, i)) return m;
      const [lead] = text.match(/^\s*/); const [tail] = text.match(/\s*$/);
      return `${open}${lead}{tr(${JSON.stringify(t)})}${tail}<`;
    });

    // 2b. text that runs INTO an expression rather than out of one:
    //     >Your first deposit earns up to {money(…)}
    //
    //     The mirror of the `}Text<` shape, and it hid the same way. Shape 2
    //     needs a `<` to close on, so a sentence ending at a `{` was invisible:
    //     the funds page rendered "Your first deposit earns up to ₦1,500
    //     offerts. Plus vous ajoutez…" — English, then French, in one line,
    //     because only the half after the amount had ever been seen.
    next = next.replace(/(?<![=!])([>}])([^<>{}\n]+)\{/g, (m, open, text) => {
      const t = text.trim();
      // Everything between one attribute's `}` and the next attribute's `{` is
      // an attribute name, and it always ends in `=`: `value={x} onChange={y}`
      // offered " onChange=" for translation. Parens mean it is an expression,
      // not a sentence — "catch (err)" and "= topup.next.min)" both arrived
      // that way.
      if (/=$/.test(t) || /[()]/.test(t)) return m;
      if (!isProse(t) || !record(t, i)) return m;
      const [lead] = text.match(/^\s*/); const [tail] = text.match(/\s*$/);
      return `${open}${lead}{tr(${JSON.stringify(t)})}${tail}{`;
    });

    // 2c. text that opens on a tag and runs to the end of the line, with the
    //     markup continuing below:
    //
    //       <b>{pct}%</b> of what you spend comes back as points
    //       </div>
    //
    //     Shape 1 wants the sentence alone on its own line and shape 2 wants a
    //     `<` to close on. This has neither, so the rewards page said
    //     "0.5% of what you spend comes back as points" in English under a
    //     French heading. The next line must open markup, which is what keeps
    //     ordinary wrapped JavaScript out.
    next = next.replace(/(?<![=!])([>}])([^<>{}\n=]+)$/, (m, open, text) => {
      const t = text.trim();
      if (/[()]/.test(t) || !/^[<{]/.test(nextNonBlank(i))) return m;
      if (!isProse(t) || !record(t, i)) return m;
      const [lead] = text.match(/^\s*/);
      return `${open}${lead}{tr(${JSON.stringify(t)})}`;
    });

    // 3. a fragment holding a trailing space:  >Some words{' '}
    next = next.replace(/>([^<>{}\n]+?)\{' '\}/g, (m, text) => {
      const t = text.trim();
      if (!isProse(t) || !record(t, i)) return m;
      return `>{tr(${JSON.stringify(t)})}{' '}`;
    });

    // 4. prose in the attributes that carry it
    next = next.replace(PROSE_ATTR, (m, attr, dq, sq) => {
      const t = dq ?? sq;
      if (!isProse(t) || !record(t, i)) return m;
      return `${attr}={tr(${JSON.stringify(t)})}`;
    });

    // 5b. a quoted string in a ternary the page renders:
    //     {extra > 0 ? "You get" : "Total"}
    //
    //     This file's header claimed for weeks that it handled this shape. It
    //     never did — no rule implemented it — and "You get" sat in English on
    //     the wallet summary the whole time. Documentation is not a feature.
    //
    //     Only expression containers preceded by neither `=` nor `$`. The `=`
    //     keeps className={a ? "flex gap-2" : "hidden"} and style={{…}} out,
    //     because a wrapped CSS class is a broken layout sent to a translator.
    //     The `$` keeps `${x ? "right-0 text-right" : ""}` out — four Tailwind
    //     strings came through from className template literals before that
    //     half of the guard existed. An existing tr("…") is matched first and
    //     passed through, so a half-wrapped ternary cannot become tr(tr("…")).
    next = next.replace(/(^|[^=$])(\{[^{}]*\?[^{}]*\})/g, (m, pre, expr) => {
      const done = expr.replace(
        /tr\(\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*\)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g,
        (q, dq, sq) => {
          const t = dq ?? sq;
          if (t === undefined || !isProse(t) || !record(t, i)) return q;
          return `tr(${JSON.stringify(t)})`;
        });
      return pre + done;
    });

    // 5. a quoted value on a prose-ish key — the shape that hid the three
    //    dashboard tiles and both of their modals.
    next = next.replace(PROSE_KEY, (m, key, dq, sq) => {
      const t = dq ?? sq;
      if (!isProse(t) || !record(t, i)) return m;
      return `${key}: tr(${JSON.stringify(t)})`;
    });

    return next;
  });

  return { out: out.join('\n'), found, moduleScope };
}
