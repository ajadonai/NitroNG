'use client';
import { useState, useEffect, useMemo } from "react";
import { useT } from "./locale";
import { msg } from "../lib/i18n";
import { OffsetIcon } from "./offset-icons";
import { PAT_WA } from "./rewards";
import { RailSec, RailNote, RailLink } from "./rail";
import { Bone } from "./skeleton";

// Topics a guide can land in, in the order they are shown.
const TOPICS = [msg("Getting started"), msg("Ordering"), msg("Money"), msg("Account")];
// Each topic's printed tile, and the colour its cards carry when a guide has no picture.
const TOPIC_LOOK = { "Getting started": ["bolt", "#c47d8e"], Ordering: ["cart", "#2563eb"], Money: ["wallet", "#d97706"], Account: ["user", "#7c3aed"] };

// First list whose words appear in the title or slug wins, so a new guide
// falls somewhere sensible without anyone editing this file.
const TOPIC_WORDS = [
  ["Getting started", ["getting started", "first order", "get started", "start here", "sign up", "signup", "create an account", "how nitro works", "beginner", "60 seconds", "right link", "copy your"]],
  ["Money", ["fund", "wallet", "deposit", "payment", "price", "naira", "refund", "coupon", "referral", "bonus", "money", "top up", "topup", "invoice", "withdraw", "leaderboard", "reward", "points"]],
  ["Ordering", ["order", "status", "tier", "refill", "deliver", "drop", "cancel", "partial", "link", "speed", "service", "track", "bulk"]],
  ["Account", ["account", "password", "log in", "login", "security", "profile", "settings", "email", "notification", "delete", "api key"]],
];

function topicOf({ title = "", slug = "" }) {
  const hay = ` ${title} ${String(slug).replace(/-/g, " ")} `.toLowerCase();
  for (const [topic, words] of TOPIC_WORDS) if (words.some(w => hay.includes(w))) return topic;
  return "Getting started";
}

// The list endpoint sends the excerpt but not the body, so length is estimated
// from how much summary a guide needed — a minute for every 30 characters of it,
// held between 2 and 9. If a body ever comes back, it wins.
function readMinutes(p) {
  if (p.content) {
    const words = String(p.content).replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
    return Math.max(1, Math.round(words / 200));
  }
  return Math.min(9, Math.max(2, Math.round((p.excerpt || p.title || "").length / 30)));
}

const SEARCH_ICON = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;

const ARROW = <svg className="dir-flip" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;

// A guide's picture, whole, at the 15 by 8 the blog draws them at. A guide
// without one gets its topic's printed tile on a wash of the topic colour.
function Thumb({ p }) {
  if (p.thumbnail) return <img className="gp-thumb" src={p.thumbnail} alt="" loading="lazy" />;
  const [icon, c] = TOPIC_LOOK[p.topic] || TOPIC_LOOK["Getting started"];
  return <span className="gp-thumb gp-noimg" style={{ "--tc": c }}><span className="ic-tile tc" style={{ "--tc": c }}><OffsetIcon name={icon} size={22} /></span></span>;
}

// Shaped like the page it stands in for, block for block.
function GuideSkeleton({ dark }) {
  return (
    <>
      <Bone dark={dark} w="100%" h={44} r={13} />
      <div className="gp-tabs">{[56, 128, 92, 82].map(w => <Bone key={w} dark={dark} w={w} h={34} r={999} style={{ flexShrink: 0 }} />)}</div>
      <div className="gp-card">
        <div className="gp-ch"><Bone dark={dark} w={30} h={30} r={10} /><Bone dark={dark} w={90} h={12} /></div>
        <div className="gp-feat sk"><Bone dark={dark} w="100%" h="100%" r={0} style={{ minHeight: 200 }} /><span className="gp-ft"><Bone dark={dark} w={110} h={10} /><Bone dark={dark} w="90%" h={22} /><Bone dark={dark} w="70%" h={22} /><Bone dark={dark} w="100%" h={10} /><Bone dark={dark} w="80%" h={10} /></span></div>
        {[0, 1].map(i => <div key={i} className="gp-srow sk"><Bone dark={dark} w={26} h={26} r={999} /><span className="gp-st"><Bone dark={dark} w="75%" h={12} /><Bone dark={dark} w="55%" h={10} /></span></div>)}
      </div>
      <div className="gp-grp">
        <div className="gp-gh"><Bone dark={dark} w={26} h={26} r={9} /><Bone dark={dark} w={100} h={13} /></div>
        <div className="gp-gg">{[0, 1].map(i => <div key={i} className="gp-post sk"><Bone dark={dark} w="100%" h="auto" r={0} style={{ aspectRatio: "15 / 8" }} /><span className="gp-pt"><Bone dark={dark} w="85%" h={14} /><Bone dark={dark} w="100%" h={10} /><Bone dark={dark} w="70%" h={10} /></span></div>)}</div>
      </div>
    </>
  );
}

export default function GuidePage({ dark }) {
  const tr = useT();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("All");
  const [waLink, setWaLink] = useState(null);

  useEffect(() => {
    fetch("/api/blog?howto=true")
      .then(r => r.json())
      .then(d => setPosts(d.posts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // The same WhatsApp number the legal pages read, with /contact as the fallback.
  useEffect(() => {
    fetch("/api/settings").then(r => r.ok ? r.json() : {}).then(d => {
      const num = d?.settings?.social_whatsapp_support;
      if (num) setWaLink(`https://wa.me/${num.replace(/\D/g, "")}`);
    }).catch(() => {});
  }, []);

  const all = useMemo(() => posts.map(p => ({ ...p, topic: topicOf(p), minutes: readMinutes(p) })), [posts]);
  const topics = useMemo(() => TOPICS.filter(name => all.some(p => p.topic === name)), [all]);
  const counts = useMemo(() => Object.fromEntries(topics.map(name => [name, all.filter(p => p.topic === name).length])), [all, topics]);

  const q = query.trim().toLowerCase();
  const browsing = !q && topic === "All";
  const starters = browsing ? all.slice(0, 3) : [];
  const pool = (browsing ? all.slice(3) : all)
    .filter(p => topic === "All" || p.topic === topic)
    .filter(p => !q || `${p.title} ${p.excerpt || ""}`.toLowerCase().includes(q));
  const groups = topics.map(name => [name, pool.filter(p => p.topic === name)]).filter(([, items]) => items.length);
  const [first, ...next] = starters;
  const link = (p) => ({ href: `/blog/${p.slug}`, target: "_blank", rel: "noopener noreferrer" });

  return (
    <div className="gp" style={{ "--wpat": PAT_WA }}>
      <style>{GUIDE_CSS}</style>

      <div className="gp-head">
        <div>
          <div className="serif text-[32px] max-md:text-[26px] font-semibold leading-none tracking-[-.015em] text-t-text">{tr("Blog")}</div>
          <div className="text-[13px] mt-1.5 text-t-text-muted">{tr("Guides to get the most out of Nitro.")}</div>
        </div>
        <a className="nb sec" href="/blog" target="_blank" rel="noopener noreferrer">{tr("Open the blog")}{ARROW}</a>
      </div>

      {loading ? <GuideSkeleton dark={dark} /> : all.length === 0 ? (
        <div className="gp-card gp-empty">
          <b>{tr("Guides are on the way")}</b>
          <span>{tr("Short walkthroughs on ordering, money and delivery are being written. Until they land, WhatsApp is faster.")}</span>
        </div>
      ) : (
        <>
          <label className="gp-srch">
            <span className="gp-si">{SEARCH_ICON}</span>
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={tr("Search the guides")} aria-label={tr("Search the guides")} />
          </label>
          {topics.length > 1 && (
            <div className="gp-tabs" role="group" aria-label={tr("Topics")}>
              {["All", ...topics].map(name => (
                <button key={name} type="button" aria-pressed={topic === name} className={"gp-tab" + (topic === name ? " on" : "")} onClick={() => setTopic(name)}>
                  {name === "All" ? tr("All") : tr(name)}<span className="c m">{name === "All" ? all.length : counts[name]}</span>
                </button>
              ))}
            </div>
          )}

          {first && (
            <section className="gp-card">
              <header className="gp-ch"><span className="ic-tile"><OffsetIcon name="flag" size={14} /></span><b>{tr("Start here")}</b><small>{tr("answers most first questions")}</small></header>
              <a className="gp-feat" {...link(first)}>
                <Thumb p={first} />
                <span className="gp-ft">
                  <span className="gp-eb">{tr("Read this first")}</span>
                  <b className="serif">{first.title}</b>
                  {first.excerpt && <i>{first.excerpt}</i>}
                  <span className="gp-fm"><span className="pbadge tag">{first.minutes} {tr("min read")}</span><span className="gp-read">{tr("Read the guide")}{ARROW}</span></span>
                </span>
              </a>
              {next.map((p, i) => (
                <a key={p.id} className="gp-srow" {...link(p)}>
                  <span className="gp-n m">{i + 2}</span>
                  <span className="gp-st"><b>{p.title}</b>{p.excerpt && <i>{p.excerpt}</i>}</span>
                  <span className="gp-when">{p.minutes} {tr("min")}</span>
                </a>
              ))}
            </section>
          )}

          {groups.length === 0 && starters.length === 0 && (
            <p className="gp-none">{tr("Nothing matches that. Try another word, or ask us on WhatsApp below.")}</p>
          )}

          {groups.map(([name, items]) => {
            const [icon, c] = TOPIC_LOOK[name] || TOPIC_LOOK["Getting started"];
            return (
              <div key={name} className="gp-grp">
                <div className="gp-gh"><span className="ic-tile tc" style={{ "--tc": c }}><OffsetIcon name={icon} size={13} /></span><b>{tr(name)}</b><span className="pbadge tag">{items.length}</span></div>
                <div className="gp-gg">
                  {items.map((p, i) => (
                    // A guide alone in its row takes the full width, picture beside it.
                    <a key={p.id} className={"gp-post" + (items.length % 2 === 1 && i === items.length - 1 ? " wide" : "")} {...link(p)}>
                      <Thumb p={p} />
                      <span className="gp-pt">
                        <b>{p.title}</b>
                        {p.excerpt && <i>{p.excerpt}</i>}
                        <span className="gp-pf"><span className="pbadge tag">{p.minutes} {tr("min read")}</span><span className="gp-arw">{ARROW}</span></span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* The way out of the page: the live WhatsApp card from home. */}
      <a className="gp-ask" href={waLink || "/contact"} target={waLink ? "_blank" : undefined} rel={waLink ? "noopener noreferrer" : undefined}>
        <span className="gp-askg"><OffsetIcon name="chat" size={18} /></span>
        <span className="gp-askt"><b>{tr("Still stuck?")}</b><span>{tr("WhatsApp us. Faster than reading, most of the time.")}</span></span>
        <span className="gp-askp">{tr("WhatsApp us")}</span>
      </a>
    </div>
  );
}

/* The page in the offset print (approved 17 Oct 2026, mockup "Nitro API and
   Blog"). Called Blog, as the sidebar names it. The first guide is a feature
   with its picture whole; topics are tabs with counts and a grid of guides;
   Still stuck is the live WhatsApp card from home. Logical properties: this
   sheet does not go through the RTL build plugin. */
const GUIDE_CSS = `
.gp{display:grid;grid-template-columns:minmax(0,1fr);grid-auto-rows:max-content;align-content:start;gap:14px}
.gp-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
.gp-srch{display:flex;align-items:center;gap:10px;height:44px;padding-inline:15px;border-radius:13px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #efc4cf}
.dark .gp-srch{box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #5e3242}
.gp-srch:focus-within{box-shadow:inset 0 0 0 1.5px #c47d8e,2px 2px 0 #efc4cf}
.gp-si{display:inline-flex;flex-shrink:0;color:var(--t-text-muted)}
.gp-srch input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13.5px;color:var(--t-text);outline:none}
.gp-srch input::placeholder{color:var(--t-text-muted)}
.gp-tabs{display:flex;gap:6px;overflow-x:auto;padding:2px 3px 5px;margin:-2px -3px;scrollbar-width:none}
.gp-tab{display:inline-flex;align-items:center;gap:7px;height:34px;padding-inline:13px;border:0;border-radius:999px;font:inherit;font-size:13px;font-weight:600;white-space:nowrap;flex-shrink:0;cursor:pointer;color:var(--t-text-soft);background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border)}
.gp-tab .c{font-size:11px;font-weight:800;padding:2px 6px;border-radius:6px;color:var(--t-accent-ink);background:rgba(196,125,142,.12)}
.gp-tab.on{color:var(--t-text);box-shadow:inset 0 0 0 1.5px #c47d8e,2px 2px 0 #efc4cf}
.dark .gp-tab.on{box-shadow:inset 0 0 0 1.5px #c47d8e,2px 2px 0 #5e3242}
.gp-tab.on .c{color:#fff;background:#c47d8e}
.gp-tab:focus-visible{outline:2px solid #c47d8e;outline-offset:2px}
.gp-card{overflow:hidden;border-radius:18px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #efc4cf}
.dark .gp-card{box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #5e3242}
.gp-ch{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--t-card-border)}
.gp-ch .ic-tile{width:30px;height:30px}
.gp-ch b{font-size:13.5px;font-weight:700;color:var(--t-text)}
.gp-ch small{margin-inline-start:auto;font-size:12px;color:var(--t-text-muted)}
.gp-thumb{display:block;width:100%;aspect-ratio:15/8;object-fit:cover;background:#1a0f14}
.gp-noimg{display:grid;place-items:center;background:color-mix(in srgb,var(--tc) 12%,var(--t-card-bg))}
.gp-noimg .ic-tile{width:52px;height:52px;border-radius:16px}
.gp-feat{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);text-decoration:none;color:inherit}
.gp-feat .gp-thumb{height:100%;min-height:200px;aspect-ratio:auto}
.gp-ft{display:flex;flex-direction:column;gap:8px;padding:18px 20px}
.gp-eb{font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--t-text-muted)}
.gp-ft b{font-size:25px;font-weight:700;line-height:1.08;letter-spacing:-.01em;color:var(--t-text)}
.gp-ft i{font-style:normal;font-size:13px;line-height:1.55;color:var(--t-text-soft)}
.gp-fm{margin-top:auto;padding-top:6px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.gp-read{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--t-accent-ink)}
.gp-feat:hover .gp-read{text-decoration:underline}
.gp-srow{display:flex;align-items:center;gap:12px;padding:12px 18px;border-top:1px solid var(--t-card-border);text-decoration:none;color:inherit;transition:background-color .15s}
.gp-srow:hover{background:rgba(196,125,142,.05)}
.gp-n{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;font-size:12px;font-weight:800;color:var(--t-accent-ink);background:rgba(196,125,142,.12);box-shadow:1.5px 1.5px 0 #efc4cf}
.dark .gp-n{box-shadow:1.5px 1.5px 0 #5e3242}
.gp-st{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.gp-st b{font-size:13.5px;font-weight:650;line-height:1.3;color:var(--t-text)}
.gp-st i{font-style:normal;font-size:12px;color:var(--t-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gp-when{font-size:11.5px;color:var(--t-text-muted);white-space:nowrap}
.gp-grp{display:grid;gap:10px}
.gp-gh{display:flex;align-items:center;gap:9px}
.gp-gh .ic-tile{width:26px;height:26px;border-radius:9px}
.gp-gh b{font-size:14px;font-weight:700;color:var(--t-text)}
.gp-gg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.gp-post{display:flex;flex-direction:column;overflow:hidden;border-radius:18px;background:var(--t-card-bg);box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #efc4cf;text-decoration:none;color:inherit;transition:transform .15s}
.dark .gp-post{box-shadow:inset 0 0 0 1px var(--t-card-border),2px 2px 0 #5e3242}
.gp-post:hover{transform:translateY(-2px)}
.gp-post.wide{grid-column:1/-1;flex-direction:row}
.gp-post.wide .gp-thumb{width:46%;flex-shrink:0;align-self:center}
.gp-pt{flex:1;display:flex;flex-direction:column;gap:6px;padding:14px 16px 16px;min-width:0}
.gp-pt b{font-size:14.5px;font-weight:700;line-height:1.3;color:var(--t-text)}
.gp-pt i{font-style:normal;font-size:12.5px;line-height:1.5;color:var(--t-text-soft);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.gp-pf{margin-top:auto;padding-top:6px;display:flex;align-items:center;justify-content:space-between}
.gp-arw{display:inline-flex;color:var(--t-accent-ink)}
.gp-feat.sk,.gp-srow.sk,.gp-post.sk{cursor:default}
.gp-post.sk:hover{transform:none}
.gp-none{margin:0;font-size:13px;color:var(--t-text-muted)}
.gp-empty{display:flex;flex-direction:column;gap:5px;padding:28px 20px;text-align:center}
.gp-empty b{font-size:15px;font-weight:650;color:var(--t-text)}
.gp-empty span{font-size:13px;line-height:1.5;color:var(--t-text-muted)}
.gp-ask{position:relative;overflow:hidden;isolation:isolate;display:flex;align-items:center;gap:14px;padding:18px 20px;border-radius:20px;color:#fff;text-decoration:none;background:radial-gradient(85% 120% at 100% 0%,rgba(90,255,170,.45),transparent 62%),linear-gradient(155deg,#0b5641 0%,#128c7e 50%,#1db75d 100%);box-shadow:3px 3px 0 #0c5440;transition:transform .2s}
.dark .gp-ask{box-shadow:3px 3px 0 #1d6b53}
.gp-ask:hover{transform:translateY(-2px)}
.gp-ask::before{content:"";position:absolute;inset:-96px 0 0 -96px;z-index:-1;background-image:var(--wpat);background-size:96px 96px;opacity:.13;animation:gpDrift 36s linear infinite}
@keyframes gpDrift{to{transform:translate(96px,96px)}}
.gp-askg{width:40px;height:40px;border-radius:13px;display:grid;place-items:center;flex-shrink:0;background:rgba(255,255,255,.18);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3),2px 2px 0 rgba(0,0,0,.16)}
.gp-askt{flex:1;min-width:0}
.gp-askt b{display:block;font-size:15.5px;font-weight:750}
.gp-askt span{display:block;margin-top:2px;font-size:12.5px;opacity:.92}
.gp-askp{height:40px;display:inline-flex;align-items:center;padding-inline:18px;border-radius:999px;font-size:13.5px;font-weight:700;color:#0b3d2e;background:#fff;box-shadow:2.5px 2.5px 0 rgba(0,0,0,.25);white-space:nowrap}
@media (max-width:767px){
  .gp-feat{grid-template-columns:minmax(0,1fr)}
  .gp-feat .gp-thumb{min-height:0;height:auto;aspect-ratio:15/8}
  .gp-ch,.gp-srow{padding-inline:14px}
  .gp-gg{grid-template-columns:minmax(0,1fr)}
  .gp-post.wide{flex-direction:column}
  .gp-post.wide .gp-thumb{width:100%}
  .gp-ask{flex-wrap:wrap}
  .gp-askp{flex-basis:100%;justify-content:center}
}
@media (prefers-reduced-motion:reduce){.gp-ask::before{animation:none}}
`;

// Right sidebar for Guide
export function GuideSidebar() {
  const tr = useT();
  return (
    <div className="rr">
      <RailSec icon="news">{tr("About the blog")}</RailSec>
      <RailNote>{tr("Step-by-step guides and tutorials to help you get the most out of Nitro. New ones are added regularly.")}</RailNote>
      <RailLink href="/blog">{tr("Visit the blog")}</RailLink>
    </div>
  );
}
