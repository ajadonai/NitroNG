'use client';
import { useState, useEffect, useMemo } from "react";
import { RailSec, RailNote, RailLink } from "./rail";
import { SkelBar, SkelList } from "./skeleton";

// Topics a guide can land in, in the order they are shown.
const TOPICS = ["Getting started", "Ordering", "Money", "Account"];

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

// A thumbnail colour per card so the grid is not a row of grey boxes.
const RAMP = ["#60a5fa", "#a78bfa", "#fbbf24", "#f472b6", "#5fd0dc", "#34d399"];

const SEARCH_ICON = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>;

export default function GuidePage({ dark, t }) {
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

  const all = useMemo(() => posts.map((p, i) => ({
    ...p, topic: topicOf(p), minutes: readMinutes(p), colour: RAMP[i % RAMP.length],
  })), [posts]);

  const topics = useMemo(() => TOPICS.filter(name => all.some(p => p.topic === name)), [all]);

  const q = query.trim().toLowerCase();
  const browsing = !q && topic === "All";
  const starters = browsing ? all.slice(0, 3) : [];
  const pool = (browsing ? all.slice(3) : all)
    .filter(p => topic === "All" || p.topic === topic)
    .filter(p => !q || `${p.title} ${p.excerpt || ""}`.toLowerCase().includes(q));
  const groups = topics.map(name => [name, pool.filter(p => p.topic === name)]).filter(([, items]) => items.length);

  const vars = {
    "--card": "var(--t-card-bg)", "--ink": t.text, "--mut": t.textMuted,
    "--dim": dark ? "#5c6170" : "#a19b93", "--line": t.cardBorder,
    "--rail": dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)",
    "--bg": t.bg, "--ac": t.accent,
  };

  return (
    <div className="gp" style={vars}>
      <style>{GUIDE_CSS}</style>

      <div className="gp-head">
        <div>
          <div className="gp-title">Guide</div>
          <div className="gp-sub">How to get the most out of Nitro.</div>
        </div>
        <a className="gp-btn" href="/blog" target="_blank" rel="noopener noreferrer">Open the blog</a>
      </div>

      {loading ? (
        <>
          <SkelBar dark={dark} pills={3} />
          <SkelList dark={dark} rows={3} title rowH={58} />
          <SkelList dark={dark} rows={2} title avatar="square" rowH={92} />
          <SkelList dark={dark} rows={2} title avatar="square" rowH={92} />
        </>
      ) : all.length === 0 ? (
        <div className="gp-empty">
          <b>Guides are on the way</b>
          <span>Short walkthroughs on ordering, money and delivery are being written. Until they land, WhatsApp is faster.</span>
        </div>
      ) : (
        <>
          <div className="gp-bar">
            <label className="gp-srch">
              <span className="gp-si">{SEARCH_ICON}</span>
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search the guides" aria-label="Search the guides" />
            </label>
            {topics.length > 1 && (
              <div className="gp-chips">
                {["All", ...topics].map(name => (
                  <button key={name} type="button" aria-pressed={topic === name} className={"gp-chip" + (topic === name ? " on" : "")} onClick={() => setTopic(name)}>
                    {name === "All" ? `All ${all.length}` : name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {starters.length > 0 && (
            <section className="gp-card">
              <header><h3>Start here</h3><span className="gp-hint">answers most first questions</span></header>
              <div className="gp-rows">
                {starters.map((p, i) => (
                  <a key={p.id} className="gp-row" href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer">
                    <span className="gp-num">{i + 1}</span>
                    <span className="gp-rt"><b>{p.title}</b>{p.excerpt && <i>{p.excerpt}</i>}</span>
                    <span className="gp-when">{p.minutes} min</span>
                    <i className="gp-chev" aria-hidden="true">›</i>
                  </a>
                ))}
              </div>
            </section>
          )}

          {groups.length === 0 && starters.length === 0 && (
            <p className="gp-none">Nothing matches that. Try another word, or ask us on WhatsApp below.</p>
          )}

          {groups.map(([name, items]) => (
            <div key={name} className="gp-grp">
              <span className="gp-kicker">{name}</span>
              <div className="gp-gg">
                {items.map(p => (
                  <a key={p.id} className="gp-gcard" href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer">
                    {p.thumbnail
                      ? <img className="gp-thumb" src={p.thumbnail} alt="" />
                      : <span className="gp-thumb" style={{ background: `linear-gradient(135deg, ${p.colour}8c, ${p.colour}24)` }} />}
                    <span className="gp-gt">
                      <b>{p.title}</b>
                      {p.excerpt && <i>{p.excerpt}</i>}
                      <em>{p.minutes} min read</em>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <div className="gp-ask">
        <span className="gp-rt"><b>Still stuck?</b><i>WhatsApp us — faster than reading, most of the time.</i></span>
        <a className="gp-btn pri" href={waLink || "/contact"} target={waLink ? "_blank" : undefined} rel={waLink ? "noopener noreferrer" : undefined}>WhatsApp us</a>
      </div>
    </div>
  );
}

const GUIDE_CSS = `
.gp{display:flex;flex-direction:column;gap:16px;color:var(--ink)}
.gp *{box-sizing:border-box}
.gp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.gp-title{font-size:22px;font-weight:600;margin-bottom:2px}
.gp-sub{font-size:15px;color:var(--mut)}
.gp-btn{display:inline-flex;align-items:center;justify-content:center;height:40px;padding:0 16px;border-radius:11px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:13px;font-weight:650;white-space:nowrap;text-decoration:none;transition:transform .15s}
.gp-btn:hover{transform:translateY(-1px)}
.gp-btn.pri{background:var(--ac);border-color:var(--ac);color:#fff}
.gp-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.gp-srch{flex:1;min-width:240px;display:flex;align-items:center;gap:9px;height:42px;padding:0 15px;border-radius:12px;background:var(--card);border:1px solid var(--line)}
.gp-srch:focus-within{border-color:var(--ac)}
.gp-si{display:inline-flex;color:var(--dim);flex-shrink:0}
.gp-srch input{flex:1;min-width:0;border:0;background:none;font:inherit;font-size:13.5px;color:var(--ink);outline:none}
.gp-srch input::placeholder{color:var(--dim)}
.gp-chips{display:flex;gap:6px;flex-wrap:wrap}
.gp-chip{font:inherit;font-size:12.5px;font-weight:650;padding:10px 14px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--mut);cursor:pointer;white-space:nowrap}
.gp-chip.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.gp-card{background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden}
.gp-card>header{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:15px 20px;border-bottom:1px solid var(--line)}
.gp-card h3{margin:0;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut)}
.gp-hint{font-size:11.5px;color:var(--dim)}
.gp-rows{display:flex;flex-direction:column}
.gp-row{display:flex;align-items:center;gap:14px;padding:13px 20px;border-top:1px solid var(--rail);text-decoration:none;color:inherit}
.gp-row:first-child{border-top:0}
.gp-row:hover{background:var(--rail)}
.gp-num{width:28px;height:28px;border-radius:50%;background:rgba(196,125,142,.15);color:var(--ac);font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.gp-rt{display:flex;flex-direction:column;min-width:0;flex:1;gap:2px}
.gp-rt b{font-size:13.5px;font-weight:650;line-height:1.3}
.gp-rt i{font-style:normal;font-size:12px;color:var(--mut);line-height:1.35}
.gp-when{font-size:12px;color:var(--dim);white-space:nowrap}
.gp-chev{font-style:normal;color:var(--dim);font-size:17px}
.gp-grp{display:flex;flex-direction:column;gap:10px}
.gp-kicker{font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--ac)}
.gp-gg{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.gp-gcard{display:flex;gap:14px;padding:14px;border-radius:16px;background:var(--card);border:1px solid var(--line);text-decoration:none;color:inherit;transition:transform .15s}
.gp-gcard:hover{transform:translateY(-1px)}
.gp-thumb{width:76px;height:68px;border-radius:12px;flex-shrink:0;object-fit:cover;background:var(--rail)}
.gp-gt{display:flex;flex-direction:column;gap:3px;min-width:0}
.gp-gt b{font-size:14px;font-weight:650;line-height:1.28}
.gp-gt i{font-style:normal;font-size:12px;color:var(--mut);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.gp-gt em{font-style:normal;font-size:11px;color:var(--dim);margin-top:auto;padding-top:4px}
.gp-none{margin:0;font-size:13px;color:var(--mut)}
.gp-empty{display:flex;flex-direction:column;gap:5px;padding:28px 20px;text-align:center;border-radius:18px;background:var(--card);border:1px solid var(--line)}
.gp-empty b{font-size:15px;font-weight:650}
.gp-empty span{font-size:13px;color:var(--mut);line-height:1.5}
.gp-ask{display:flex;align-items:center;gap:14px;padding:18px 20px;border-radius:18px;background:var(--card);border:1px solid var(--line)}
@media (max-width:900px){
  .gp-head{flex-direction:column}.gp-head .gp-btn{width:100%}
  .gp-srch{min-width:0;width:100%}
  .gp-chips{width:100%}.gp-chip{flex:1;text-align:center}
  .gp-gg{grid-template-columns:1fr}
  .gp-ask{flex-direction:column;align-items:stretch}.gp-ask .gp-btn{width:100%}
}
`;

// Right sidebar for Guide
export function GuideSidebar() {
  return (
    <div className="rr">
      <RailSec>About the blog</RailSec>
      <RailNote>Step-by-step guides and tutorials to help you get the most out of Nitro. New ones are added regularly.</RailNote>
      <RailLink href="/blog">Visit the blog</RailLink>
    </div>
  );
}
