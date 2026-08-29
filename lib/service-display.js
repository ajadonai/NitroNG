// A provider's raw service name, turned into a title and short facts for the admin panel.
//
// All three providers write the same shape: a title, then facts in "| pipes |" (MTP) or
// "[brackets]" (DAO, JAP), with colour dots and emoji sprinkled on. Resellers and users
// never see raw names; this is for admins, who do, and who should not have to read them.

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍]/gu;
const DROP = /^(new!?|read description|cheapest|positive|drip-?feed on!?|hq|uhq|real|organic|provided by us!?)$/i;
const CASE = { tiktok: "TikTok", youtube: "YouTube", soundcloud: "SoundCloud", linkedin: "LinkedIn", usa: "USA", uk: "UK", ww: "Worldwide" };

function norm(v) {
  return v
    .replace(/\s*\/\s*(day|d)\b/gi, "/day")
    .replace(/\bhours?\b/gi, "h").replace(/\bhrs?\b/gi, "h").replace(/\bminutes?\b/gi, "min").replace(/\bmins?\b/gi, "min")
    .replace(/\s*-\s*/g, "–")
    .replace(/(\d)\s+(h|min)\b/g, "$1 $2")
    .trim();
}

function fact(seg) {
  const s = seg.replace(EMOJI, "").replace(/[⌉⌊]/g, "").replace(/\s+/g, " ").trim().replace(/[.:]+$/, "");
  if (!s || DROP.test(s)) return null;
  let m;
  if (/^refill\s*[:\-]?\s*(no|none)$/i.test(s) || /^no refill$/i.test(s) || /^non[- ]?refill/i.test(s)) return "No refill";
  if ((m = s.match(/^refill\s*[:\-]?\s*(\d+)\s*(d|days?)$/i))) return `Refill ${m[1]}d`;
  if ((m = s.match(/^(\d+)\s*days?\s*refill$/i))) return `Refill ${m[1]}d`;
  if (/^refill\s*[:\-]?\s*(yes|lifetime)$/i.test(s) || /^lifetime\s*(guaranteed?|refill)?$/i.test(s)) return "Lifetime refill";
  if ((m = s.match(/^speed\s*[:\-]?\s*(.+)$/i))) return "Speed " + norm(m[1]);
  if (/^(up to\s*)?[\d.,]+\s*[km]?(\s*-\s*[\d.,]+\s*[km]?)?\+?\s*\/\s*(day|d)$/i.test(s)) return "Speed " + norm(s);
  if ((m = s.match(/^daily\s*[:\-]?\s*([\d.,]+\s*[km]?)$/i))) return `Speed ${m[1].toUpperCase()}/day`;
  if ((m = s.match(/^max\s*[:\-]?\s*([\d.,]+\s*[kmb]?)$/i))) return "Max " + m[1].toUpperCase().replace(/\s/g, "");
  if ((m = s.match(/^st(?:art|rat)\s*(?:time)?\s*[:\-]?\s*(.+)$/i))) return "Start " + norm(m[1]);
  if ((m = s.match(/^starts? in\s*(.+)$/i))) return "Start " + norm(m[1]);
  if (/^instant( start)?$/i.test(s)) return "Instant start";
  if (/^(low|non|no)[- ]?drop$/i.test(s)) return s.replace(/-/g, " ").replace(/^\w/, c => c.toUpperCase()).replace(/Drop/, "drop");
  if (/nigeria/i.test(s)) return "NG";
  if (/^hq (real )?(worldwide )?profiles?$/i.test(s)) return "HQ profiles";
  if (/^(ww|worldwide)( profiles?)?$/i.test(s)) return "Worldwide";
  if (s.length > 34) return null;
  return s.replace(/\b([a-z])([a-z]*)\b/gi, (w, a, b) => CASE[w.toLowerCase()] || a.toUpperCase() + b.toLowerCase());
}

/**
 * @param {string} raw the provider's service name as stored
 * @returns {{ title: string, facts: string[] }}
 */
export function serviceDisplay(raw) {
  let s = String(raw || "");
  const ng = /nigeria|\u{1F1F3}\u{1F1EC}/iu.test(s);
  const segs = [];
  s = s.replace(/\[([^\]]*)\]/g, (_, b) => { segs.push(b); return " § "; });
  s = s.replace(/\(([^)]*)\)/g, (_, b) => { segs.push(b); return " § "; });
  const parts = s.split(/\||§/).map(x => x.trim()).filter(Boolean);
  let title = (parts.shift() || "").replace(EMOJI, "").replace(/[⌉⌊]/g, "").replace(/\s+/g, " ").trim();
  // A speed hanging off the end of the title ("… 50K/Day") is a fact, not a name.
  const tail = title.match(/\s(\d[\d.,]*[km]?(?:-\d[\d.,]*[km]?)?\/(?:day|d))$/i);
  if (tail) { segs.push(tail[1]); title = title.slice(0, -tail[0].length); }
  title = title.replace(/\bnigerian?\b\s*/i, "").replace(/\s+/g, " ").replace(/[\s\-–]+$/, "").trim();
  title = title.replace(/\b(tiktok|youtube|soundcloud|linkedin)\b/gi, w => CASE[w.toLowerCase()]);
  const facts = [];
  for (const seg of [...parts, ...segs]) { const f = fact(seg); if (f && !facts.includes(f)) facts.push(f); }
  if (ng && !facts.includes("NG")) facts.unshift("NG");
  return { title: title || String(raw || "").trim(), facts };
}

/** One line: "Title · fact · fact". */
export function serviceLine(raw) {
  const d = serviceDisplay(raw);
  return d.facts.length ? `${d.title} · ${d.facts.join(" · ")}` : d.title;
}
