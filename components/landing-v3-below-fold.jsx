'use client';
import { useState, useRef, useEffect } from 'react';
import { useMoney, useLocale, useT } from './locale';
import { MAX_BONUS_NAIRA } from '@/lib/welcome-bonus';
import { WaButton } from "./wa-button";
import { SharedFooter } from "./shared-nav";
import { OffsetIcon } from "./offset-icons";
import { PlatformIcon } from "./platform-icon";
import { PAT_WA } from "./rewards";

// Tier colours are the ones the order form uses (components/new-order.jsx), so the landing and the app agree.
const TIER_STYLE = {
  Budget:   { text: "#854F0B", textDark: "#e0a458", bg: "#fef7ed", bgDark: "#2d2210", brd: "#e8d5b8", brdDark: "#5a4020", grad: "linear-gradient(135deg,#e0a458,#b45309)" },
  Standard: { text: "#185FA5", textDark: "#60a5fa", bg: "#eef4fb", bgDark: "#0f1e30", brd: "#b8d0e8", brdDark: "#1e4070", grad: "linear-gradient(135deg,#60a5fa,#2563eb)" },
  Premium:  { text: "#534AB7", textDark: "#a78bfa", bg: "#f5eef5", bgDark: "#221535", brd: "#d4b8d4", brdDark: "#3d2060", grad: "linear-gradient(135deg,#a78bfa,#7c3aed)" },
};
// The same three the order form shows, in the offset-print set.
const TIER_ICON = { Budget: "shield", Standard: "bolt", Premium: "crown" };
const Check = ({ size = 14, sw = 3 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12"/></svg>;
const Star = ({ c }) => <OffsetIcon name="star" size={14} color={c} />;
const WA_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";
const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/* Below the hero, redrawn in the offset print (approved 17 Oct 2026, mockup
   "Nitro Landing"). Sections are named the way the menu names them instead of
   numbered 01 to 05, which suggested an order the page does not have. Colours
   come from --lp-* set on the wrapper so light and dark share one sheet.
   Logical properties, and no child combinators (the i18n scanner reads those
   as copy). */
const BF_CSS = `
.lv3-glow{position:absolute;border-radius:50%;filter:blur(110px);pointer-events:none}
.lv3-grain{position:absolute;inset:0;pointer-events:none;opacity:.05;background-image:${GRAIN}}
.lv3-dots{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(rgba(196,125,142,.26) 1px,transparent 1px);background-size:26px 26px;-webkit-mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%);mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%);opacity:.55}
.lp-eb{display:inline-flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--lp-acc-ink)}
.lp-eb::before{content:"";width:8px;height:8px;border-radius:2px;background:#c47d8e;box-shadow:1.5px 1.5px 0 var(--lp-print)}
.lp-head h2{margin:12px 0 0;font-size:clamp(30px,3.6vw,48px);font-weight:700;letter-spacing:-1.4px;line-height:1.05;text-wrap:balance}
.lp-head h2 em{font-style:italic;font-weight:500;letter-spacing:-.5px;color:#c47d8e}
.lp-sub{margin:16px 0 0;max-width:58ch;font-size:16.5px;line-height:1.65;color:var(--lp-soft)}
.lp-tile{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:40px;height:40px;border-radius:11px;color:var(--lp-acc-ink);background:var(--lp-wash);box-shadow:2px 2px 0 var(--lp-print)}
.lp-tile.tc{color:var(--tc);background:color-mix(in srgb,var(--tc) 13%,var(--lp-card));box-shadow:2px 2px 0 color-mix(in srgb,var(--tc) 32%,transparent)}
.lp-tile.sm{width:30px;height:30px;border-radius:9px}
.lp-badge{display:inline-flex;align-items:center;padding:3px 7px;border-radius:7px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;font-weight:700;line-height:1;color:var(--lp-acc-ink);background:var(--lp-wash);box-shadow:inset 0 0 0 1px rgba(196,125,142,.35),1.5px 1.5px 0 var(--lp-print)}
.lp-inc{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
.lp-inc span{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 13px 0 6px;border-radius:999px;background:var(--lp-card);box-shadow:inset 0 0 0 1px var(--lp-line);font-size:13.5px;color:var(--lp-soft)}
.lp-inc i{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;color:var(--lp-ok);background:color-mix(in srgb,var(--lp-ok) 13%,var(--lp-card))}
.lp-tiers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin-top:40px;align-items:stretch}
.lp-tier{position:relative;display:flex;flex-direction:column;border-radius:20px;background:var(--lp-card);box-shadow:inset 0 0 0 1px var(--lp-line),4px 4px 0 color-mix(in srgb,var(--tc) 22%,transparent);overflow:hidden;transition:transform .2s}
.lp-tier:hover{transform:translateY(-3px)}
.lp-tier.pick{box-shadow:inset 0 0 0 1.5px var(--tc),6px 6px 0 color-mix(in srgb,var(--tc) 30%,transparent);transform:translateY(-8px)}
.lp-tier.pick:hover{transform:translateY(-11px)}
.lp-tband{position:relative;overflow:hidden;padding:20px 22px 18px;background:color-mix(in srgb,var(--tc) 9%,var(--lp-card));border-bottom:1px solid color-mix(in srgb,var(--tc) 18%,transparent)}
.lp-tband::after{content:"";position:absolute;inset-inline-end:-30px;top:-30px;width:130px;height:130px;border-radius:50%;border:1.5px solid color-mix(in srgb,var(--tc) 22%,transparent);box-shadow:0 0 0 18px color-mix(in srgb,var(--tc) 5%,transparent);pointer-events:none}
.lp-thead{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px}
.lp-tname{display:flex;align-items:center;gap:12px;min-width:0}
.lp-tname b{display:block;font-size:24px;font-weight:750;letter-spacing:-.02em}
.lp-tname small{display:block;margin-top:1px;font-size:13px;color:var(--lp-mut)}
.lp-flag{flex-shrink:0;white-space:nowrap;display:inline-flex;align-items:center;padding:4px 9px;border-radius:7px;font-size:11px;font-weight:750;color:var(--tc);background:var(--lp-card);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tc) 40%,transparent),1.5px 1.5px 0 color-mix(in srgb,var(--tc) 30%,transparent)}
.lp-tbody{display:flex;flex-direction:column;gap:16px;flex:1;padding:20px 22px 22px}
.lp-price{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px}
.lp-price b{font-size:36px;font-weight:700;line-height:1;letter-spacing:-.04em;color:var(--tc)}
.lp-price span{font-size:13px;color:var(--lp-mut)}
.lp-refill{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--lp-field)}
.lp-refill b{display:block;font-size:14px;font-weight:700}
.lp-refill small{display:block;font-size:12px;color:var(--lp-mut)}
.lp-pts{margin:0;padding:0;list-style:none;display:grid;gap:9px;font-size:14.5px;color:var(--lp-soft)}
.lp-pts li{display:flex;align-items:flex-start;gap:9px}
.lp-pts li svg{margin-top:3px;color:var(--tc)}
.lp-tcta{margin-top:auto;display:flex;flex-direction:column;gap:8px}
.lp-tbtn{display:flex;align-items:center;justify-content:center;height:46px;border-radius:999px;font-size:15px;font-weight:700;text-decoration:none;color:var(--tc);background:var(--lp-card);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--tc) 55%,transparent),3px 3px 0 color-mix(in srgb,var(--tc) 25%,transparent);transition:transform .15s}
.lp-tbtn:hover{transform:translateY(-1px)}
.lp-tier.pick .lp-tbtn{color:#fff;background:var(--tc);box-shadow:3px 3px 0 color-mix(in srgb,var(--tc) 45%,#000)}
.lp-tcta small{text-align:center;font-size:12.5px;line-height:1.5;color:var(--lp-mut)}
.lp-fine{margin-top:26px;font-size:14px;color:var(--lp-soft)}
.lp-fine a{font-weight:650;text-decoration:none;color:var(--lp-acc-ink)}
.lp-two{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
.lp-points{display:grid;gap:18px;margin-top:28px}
.lp-pt{display:flex;align-items:flex-start;gap:14px}
.lp-pt b{display:block;font-size:16px;font-weight:700}
.lp-pt small{display:block;margin-top:2px;font-size:14.5px;line-height:1.5;color:var(--lp-soft)}
.lp-sheet{background:var(--lp-card);border-radius:20px;box-shadow:inset 0 0 0 1px var(--lp-line),5px 5px 0 var(--lp-print);padding:20px}
.lp-sheet-h{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:14px;border-bottom:1px dashed var(--lp-line)}
.lp-sheet-h b{display:block;font-size:15px;font-weight:700}
.lp-sheet-h small{display:block;font-size:12.5px;color:var(--lp-mut)}
.lp-prow{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:11px 2px;border-bottom:1px solid var(--lp-hair);transition:opacity .5s}
.lp-av{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;font-weight:700;color:var(--lp-mut);background:var(--lp-field)}
.lp-prow b{font-size:14px;font-weight:650;text-decoration:line-through;text-decoration-color:transparent;transition:text-decoration-color .5s,color .5s}
.lp-prow.lost b{color:var(--lp-mut);text-decoration-color:color-mix(in srgb,var(--lp-mut) 70%,transparent)}
.lp-prow.lost{opacity:.75}
.lp-stamp{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:7px;font-size:12px;font-weight:750;white-space:nowrap;color:var(--sc);background:color-mix(in srgb,var(--sc) 10%,var(--lp-card));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--sc) 38%,transparent);transform:rotate(-2deg)}
.lp-prow.won{margin:6px -8px 0;padding:12px 10px;border:0;border-radius:12px;background:color-mix(in srgb,var(--lp-ok) 8%,var(--lp-card));box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--lp-ok) 40%,transparent)}
.lp-prow.won b{text-decoration:none}
.lp-prow.won .lp-av{color:var(--lp-ok);background:color-mix(in srgb,var(--lp-ok) 14%,var(--lp-card))}
.lp-becomes{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:16px;font-size:13px;color:var(--lp-mut)}
.lp-ch{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:999px;font-size:12.5px;font-weight:700;color:var(--tc);background:color-mix(in srgb,var(--tc) 10%,var(--lp-card));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tc) 35%,transparent)}
.lp-caption{margin:14px 0 0;font-size:19px;font-style:italic;font-weight:600;line-height:1.3;color:var(--lp-soft)}
.lp-big{background:var(--lp-card);border-radius:20px;box-shadow:inset 0 0 0 1px var(--lp-line),5px 5px 0 var(--lp-print);padding:26px}
.lp-big-n{font-size:clamp(54px,6.6vw,76px);font-weight:700;line-height:.95;letter-spacing:-.05em;color:#c47d8e}
.lp-big-l{margin-top:8px;font-size:15px;font-weight:650}
.lp-big-l small{display:block;font-size:13px;font-weight:500;color:var(--lp-mut)}
.lp-trio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:20px}
.lp-trio div{padding:12px;border-radius:12px;background:var(--lp-field)}
.lp-trio b{display:block;font-size:22px;font-weight:700;letter-spacing:-.03em}
.lp-trio span{display:block;font-size:12.5px;color:var(--lp-mut)}
.lp-cloud{display:flex;flex-wrap:wrap;gap:7px;margin-top:18px}
.lp-cloud span{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px 0 5px;border-radius:999px;background:var(--lp-field);font-size:12.5px;font-weight:600;color:var(--lp-soft)}
.lp-cloud span.more{padding-inline-start:11px}
.lp-ctas{display:flex;flex-wrap:wrap;gap:10px;margin-top:30px}
.lp-cta{height:46px;padding:0 20px;border-radius:999px;font-size:14.5px}
.lp-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin-top:40px}
.lp-step{display:flex;flex-direction:column;overflow:hidden;border-radius:20px;background:var(--lp-card);box-shadow:inset 0 0 0 1px var(--lp-line)}
.lp-vig{height:170px;display:grid;place-items:center;padding:18px;border-bottom:1px solid var(--lp-hair);background:radial-gradient(120% 120% at 0% 0%,rgba(196,125,142,.1),transparent 60%),var(--lp-field)}
.lp-stxt{padding:18px 20px 22px}
.lp-sn{display:flex;align-items:center;gap:10px}
.lp-sn .lp-tile{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:13px;font-weight:700}
.lp-sn b{font-size:18px;font-weight:750;letter-spacing:-.01em}
.lp-stxt p{margin:10px 0 0;font-size:14.5px;line-height:1.6;color:var(--lp-soft)}
.lp-mini{width:100%;max-width:260px;padding:12px 14px;border-radius:14px;background:var(--lp-card);box-shadow:inset 0 0 0 1px var(--lp-line),3px 3px 0 var(--lp-print)}
.lp-lab{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--lp-mut)}
.lp-bal{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px}
.lp-bal b{font-size:24px;font-weight:700;letter-spacing:-.04em}
.lp-coin{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 12px;border-radius:999px;font-size:12px;font-weight:750;color:#4a2a12;background:radial-gradient(120% 140% at 30% 20%,#ffe9a8,#f8c145 58%,#eda63a);box-shadow:0 2px 8px rgba(212,150,30,.3),inset 0 0 0 1.5px rgba(255,255,255,.6)}
.lp-field{display:flex;align-items:center;gap:8px;height:36px;margin-top:6px;padding:0 10px;border-radius:10px;background:var(--lp-field);box-shadow:inset 0 0 0 1.5px #c47d8e;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12.5px;font-weight:600}
.lp-caret{width:1.5px;height:16px;background:#c47d8e;animation:lpBlink 1s steps(1) infinite}
@keyframes lpBlink{50%{opacity:0}}
.lp-tierpick{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:8px}
.lp-tierpick span{height:28px;border-radius:8px;display:grid;place-items:center;font-size:11px;font-weight:700;color:var(--lp-mut);background:var(--lp-field)}
.lp-tierpick span.on{color:#fff;background:var(--tc);box-shadow:2px 2px 0 color-mix(in srgb,var(--tc) 40%,#000)}
.lp-prog{display:flex;align-items:center;justify-content:space-between;gap:8px}
.lp-prog b{font-size:13px;font-weight:700}
.lp-st{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 7px;border-radius:6px;font-size:10.5px;font-weight:750;color:var(--sc);background:color-mix(in srgb,var(--sc) 10%,var(--lp-card));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--sc) 35%,transparent)}
.lp-st i{width:6px;height:6px;border-radius:50%;background:currentColor;animation:lpFade 1.6s ease-in-out infinite}
@keyframes lpFade{50%{opacity:.35}}
.lp-bar{height:7px;margin-top:10px;border-radius:4px;background:var(--lp-hair);overflow:hidden}
.lp-bar span{display:block;height:100%;border-radius:4px;background:var(--sc);animation:lpGrow 4s ease-in-out infinite}
@keyframes lpGrow{0%{width:18%}60%,100%{width:72%}}
.lp-pn{display:flex;justify-content:space-between;margin-top:6px;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;font-weight:600;color:var(--lp-mut)}
.lv3-bcard{border-radius:20px;padding:20px;position:relative;transition:transform .25s}
.lv3-bcard:hover{transform:translateY(-3px)}
.lp-print{box-shadow:inset 0 0 0 1px var(--lp-line),5px 5px 0 var(--lp-print)}
.lv3-bento{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:16px;margin-top:34px;grid-template-areas:"feat feat video" "feat feat video" "r1 r2 stat"}
.lv3-veq i{width:3px;border-radius:2px;background:#fff;animation:lv3eq .9s ease-in-out infinite}
.lv3-veq i:nth-child(2){animation-delay:.2s}
.lv3-veq i:nth-child(3){animation-delay:.4s}
@keyframes lv3eq{0%,100%{height:5px}50%{height:14px}}
.lv3-qdot{width:6px;height:6px;border-radius:99px;opacity:.4;padding:0;transition:.3s;border:none}
.lv3-qdot.on{opacity:1;background:#c47d8e!important;width:22px}
.lp-offer{position:relative;border-radius:22px;padding:24px;color:#fff;background:rgba(255,255,255,.1);box-shadow:inset 0 0 0 1px rgba(255,255,255,.28),5px 5px 0 rgba(30,8,20,.3);backdrop-filter:blur(8px)}
.lp-gift{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;flex-shrink:0;color:#7a3e58;background:#fff;box-shadow:2px 2px 0 rgba(30,8,20,.3)}
.lp-offer li i{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;background:rgba(255,255,255,.2)}
.lp-chan{position:relative;overflow:hidden;isolation:isolate;flex-shrink:0;display:flex;align-items:center;gap:14px;max-width:440px;padding:16px 18px;border-radius:18px;color:#fff;text-decoration:none;background:radial-gradient(85% 140% at 100% 0%,rgba(90,255,170,.45),transparent 62%),linear-gradient(150deg,#0b5641,#128c7e 50%,#1db75d);box-shadow:4px 4px 0 #083b2c;transition:transform .2s}
.lp-chan:hover{transform:translateY(-2px)}
.lp-chan::before{content:"";position:absolute;inset:-96px 0 0 -96px;z-index:-1;background-image:${PAT_WA};background-size:96px 96px;opacity:.13;animation:lpDrift 36s linear infinite}
@keyframes lpDrift{to{transform:translate(96px,96px)}}
.lp-chan-g{position:relative;width:42px;height:42px;border-radius:13px;display:grid;place-items:center;flex-shrink:0;background:rgba(255,255,255,.2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.3)}
.lp-chan-g::after{content:"";position:absolute;inset:-5px;border-radius:16px;border:2px solid rgba(255,255,255,.55);animation:lpRing 2.6s ease-out infinite}
@keyframes lpRing{0%{opacity:.9;transform:scale(.86)}100%{opacity:0;transform:scale(1.28)}}
.lp-chan b{display:block;font-size:15px;font-weight:750}
.lp-chan i{display:block;margin-top:2px;font-style:normal;font-size:12.5px;line-height:1.45;opacity:.9}
.lp-chan-go{margin-inline-start:auto;flex-shrink:0;padding:8px 14px;border-radius:999px;font-size:13px;font-weight:750;white-space:nowrap;color:#0b6b47;background:#fff;box-shadow:2px 2px 0 rgba(0,0,0,.2)}
@media (max-width:1199px){.lp-two{grid-template-columns:1fr;gap:34px}.lp-tiers{grid-template-columns:repeat(2,minmax(0,1fr))}.lv3-bento{grid-template-columns:1fr 1fr;grid-template-areas:"feat feat" "video stat" "r1 r2"}}
@media (max-width:767px){.lp-tiers,.lp-steps{grid-template-columns:1fr}.lp-tier.pick{transform:none}.lp-tier.pick:hover{transform:translateY(-3px)}.lv3-bento{grid-template-columns:1fr;grid-template-areas:"feat" "video" "r1" "r2" "stat"}.lp-price b{font-size:32px}}
@media (prefers-reduced-motion:reduce){.lv3-veq i,.lp-caret,.lp-st i,.lp-bar span,.lp-chan::before,.lp-chan-g::after{animation:none}.lp-tier,.lv3-bcard{transition:none}}
`;

/* At module scope, not inside the component: a component defined in render is
   a new type on every render, so React remounted these whenever the quotes
   turned over, and the fresh copies lost the "revealed" class the scroll
   observer had added. The section headings vanished six seconds in. */
function Head({ eyebrow, a, b }) {
  return <div className="lp-head" data-reveal><span className="lp-eb">{eyebrow}</span><h2>{a} <em className="serif">{b}</em></h2></div>;
}
function Point({ icon, title, sub }) {
  return <div className="lp-pt"><span className="lp-tile"><OffsetIcon name={icon} size={19} /></span><div><b>{title}</b><small>{sub}</small></div></div>;
}

export default function LandingV3BelowFold({ t, dark, setModal, siteStats, socialLinks, scrollRoot, pricingData }) {
  const money = useMoney();
  // tr, not t: t is the theme, passed in as a prop on this component.
  const tr = useT();

  // These two live inside the component because their copy is translated, and
  // tr() comes from a hook — at module scope it does not exist, which is what
  // broke the page. Keeping the English here as literals also keeps
  // `npm run i18n:report` able to see them; a scanner reading code cannot
  // follow a variable.
  // "From" prices are Instagram followers per 1,000, in naira. Plain numbers,
  // not formatted strings: the currency switcher decides how they are shown.
  const TIERS = [
    { name: "Budget", tfor: tr("For tests, views and volume"), price: 1559, chip: tr("Lowest price"), pop: false, refill: [tr("No refill"), tr("No refill cover")], li: [tr("Cheapest rate per 1,000"), tr("Tested source, fast start")], fine: tr("Best when a drop wouldn't hurt: views, tests, big cheap pushes.") },
    { name: "Standard", tfor: tr("For everyday growth"), price: 2720, chip: tr("Most picked"), pop: true, refill: [tr("30-day refill"), tr("Drops topped up for 30 days")], li: [tr("Balanced speed and retention"), tr("Our default recommendation")], fine: tr("Where most orders land. Reliable enough to build a page on.") },
    { name: "Premium", tfor: tr("For accounts that matter"), price: 5675, chip: tr("Top quality"), pop: false, refill: [tr("Lifetime refill"), tr("For the life of the order")], li: [tr("Highest-quality sources"), tr("Slowest to drop, most natural")], fine: tr("For brands, artists and anyone whose numbers get looked at.") },
  ];
  // Half Pidgin, half plain English — the plain ones still read Nigerian through
  // what they say (a 2am WhatsApp reply, naira pricing) rather than through
  // grammar, so the Pidgin reads as deliberate instead of as a theme.
  const QUOTES = [
    [tr("I no go lie, I first think say na scam. I try am with small money, e land sharp sharp. Now every new drop, na Nitro I dey run."),"Chioma A.",tr("Fashion Brand Owner"),"CA","#c47d8e"],
    [tr("I messaged them at 2am expecting to hear back the next morning. Someone replied within minutes. That is why I stayed."),"Aisha B.",tr("Content Creator"),"AB","#6ee7b7"],
    [tr("I don try plenty panels. Na here my order dey start before I even close the page. And na naira, no dollar wahala."),"Kola D.",tr("E-commerce Seller"),"KD","#fbbf24"],
  ];

  const { currency } = useLocale() || { currency: "NGN" };
  const wrapRef = useRef(null);
  const [qi, setQi] = useState(0);
  const [qFade, setQFade] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [vprog, setVprog] = useState(0);
  const [funnelRan, setFunnelRan] = useState(false);
  const [dimmed, setDimmed] = useState(0);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    const root = scrollRoot?.current;
    const els = wrapRef.current?.querySelectorAll("[data-reveal]:not(.revealed)");
    if (!els?.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("revealed"); if (e.target.dataset.funnel) setFunnelRan(true); io.unobserve(e.target); } });
    }, { root: root || null, threshold: 0.15 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [scrollRoot]);
  useEffect(() => { if (!funnelRan) return; const ids = [0,1,2,3].map((i) => setTimeout(() => setDimmed(i + 1), 600 + i * 350)); return () => ids.forEach(clearTimeout); }, [funnelRan]);
  useEffect(() => { const rm = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches; if (rm) return; const iv = setInterval(() => { setQFade(true); setTimeout(() => { setQi(i => (i + 1) % QUOTES.length); setQFade(false); }, 180); }, 6000); return () => clearInterval(iv); }, []);
  useEffect(() => { if (!playing) return; setVprog(0); const iv = setInterval(() => setVprog(p => { if (p >= 100) { setPlaying(false); return 0; } return p + 1.2; }), 100); return () => clearInterval(iv); }, [playing]);
  useEffect(() => { setProcessing(siteStats?.processing ?? null); }, [siteStats?.processing]);

  const pick = (q) => { setQFade(true); setTimeout(() => { setQi(q); setQFade(false); }, 180); };
  const wa = socialLinks?.social_whatsapp_support ? `https://wa.me/${socialLinks.social_whatsapp_support.replace(/\D/g, "")}` : null;
  const waChannel = socialLinks?.social_whatsapp_channel || "https://whatsapp.com/channel/0029Vb8hC6rJ3jv7Ig2m3D3Q";
  const panel = dark ? "#160f22" : "#fff";
  const brd = dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.09)";
  const hair = dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.07)";
  const soft = dark ? "rgba(244,241,237,.58)" : "rgba(28,27,25,.58)";
  const muted = dark ? "rgba(244,241,237,.36)" : "rgba(28,27,25,.42)";
  const text = dark ? "#f0ede8" : "#1c1b19";
  const bgAlt = dark ? "#0b0f1c" : "#fcefe8";
  const bgRose = dark ? "#1a1220" : "#f7dde4";
  const [qt, qn, qr, qinit, qc] = QUOTES[qi];

  // The three figures section 03 claims, counted by the same buildAll the list
  // itself runs — so the landing page and the rows behind "Browse the full
  // list" cannot drift apart. The fallbacks are what was measured on 16 Sep
  // 2026 and cover the render before /api/site-info lands; they are not the
  // source of truth. A constant here goes stale within a week of a sync and
  // nobody notices, which is how the blog came to quote 17,852.
  const nFull = siteStats?.fullList || 7581;
  const nCurated = siteStats?.services || 267;
  const nPlat = siteStats?.fullPlatforms || 31;

  const tierC = (name) => (dark ? TIER_STYLE[name].textDark : TIER_STYLE[name].text);
  const vars = {
    color: text,
    "--lp-card": panel, "--lp-line": brd, "--lp-hair": hair, "--lp-text": text, "--lp-soft": soft, "--lp-mut": muted,
    "--lp-acc-ink": dark ? "#e3a4b5" : "#83535f", "--lp-print": dark ? "#6b3a4a" : "#efc4cf",
    "--lp-wash": dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", "--lp-field": dark ? "rgba(255,255,255,.05)" : "#f7f1ec",
    "--lp-ok": dark ? "#6ee7b7" : "#059669", "--lp-warn": dark ? "#fbbf24" : "#b45309", "--lp-bad": dark ? "#fca5a5" : "#c62828",
  };
  const SECTION = "snap-section relative max-w-[1200px] mx-auto py-[88px] px-[60px] max-desktop:py-16 max-desktop:px-10 max-md:py-[52px] max-md:px-5";
  const PANELS = [["A", tr("Dropped 40%"), "bad"], ["B", tr("Never delivered"), "bad"], ["C", tr("3 days late"), "warn"], ["D", tr("Refund pending"), "warn"], ["E", tr("Actually good"), "ok"]];

  return (
    <div ref={wrapRef} style={vars}>
      <style>{BF_CSS}</style>

      {/* ━━━ TIERS ━━━ */}
      <div className="relative overflow-hidden" style={{ background: t.bg }}>
        <div className="lv3-glow" style={{ width: 640, height: 640, top: -220, right: -160, background: dark ? "rgba(196,125,142,.14)" : "rgba(249,168,117,.28)" }}/>
        <div className="lv3-glow" style={{ width: 460, height: 460, bottom: -160, left: -120, background: dark ? "rgba(96,165,250,.08)" : "rgba(96,165,250,.14)" }}/>
        <div className="lv3-grain"/>
        <section id="tiers" className={SECTION}>
          <Head eyebrow={tr("Tiers")} a={tr("Pick your")} b={tr("quality.")} />
          <p className="lp-sub" data-reveal="1">{tr("Every service comes in three tiers. Same platforms, same wallet, different sourcing and different cover. You always know what you're buying.")}</p>
          <div className="lp-inc" data-reveal="2">
            {[currency === "NGN" ? tr("Naira pricing, no FX markup") : tr("Prices shown in your currency"), tr("Starts in under 60 seconds"), tr("Live order tracking"), tr("Real humans on WhatsApp")].map(x => <span key={x}><i><Check size={12}/></i>{x}</span>)}
          </div>
          <div className="lp-tiers" data-reveal="3">
            {TIERS.map(tier => { const livePrice = pricingData?.heroTiers?.[tier.name]; return (
              <article key={tier.name} className={"lp-tier" + (tier.pop ? " pick" : "") + (tier.name === "Budget" ? " max-desktop:col-span-2 max-md:col-span-1" : "")} style={{ "--tc": tierC(tier.name) }}>
                <div className="lp-tband">
                  <div className="lp-thead">
                    <div className="lp-tname"><span className="lp-tile tc" style={{ width: 42, height: 42 }}><OffsetIcon name={TIER_ICON[tier.name]} size={20} /></span><div><b>{tier.name}</b><small>{tier.tfor}</small></div></div>
                    <span className="lp-flag">{tier.chip}</span>
                  </div>
                </div>
                <div className="lp-tbody">
                  <div className="lp-price"><b className="m">{money(livePrice ?? tier.price)}</b><span>{tr("per 1,000 Instagram followers")}</span></div>
                  <div className="lp-refill"><span className="lp-tile tc sm"><OffsetIcon name="refresh" size={15} /></span><div><b>{tier.refill[0]}</b><small>{tier.refill[1]}</small></div></div>
                  <ul className="lp-pts">{tier.li.map(x => <li key={x}><Check size={15}/><span>{x}</span></li>)}</ul>
                  <div className="lp-tcta">
                    <a href="/signup" onClick={e => { e.preventDefault(); setModal("signup"); }} className="lp-tbtn">{tr("Start with")} {tier.name}</a>
                    <small>{tier.fine}</small>
                  </div>
                </div>
              </article>
            ); })}
          </div>
          <div className="lp-fine">{tr("Prices shown are Instagram followers per 1,000.")} <a href="/pricing">{tr("See every platform →")}</a></div>
        </section>
      </div>

      {/* ━━━ WHY CURATED ━━━ */}
      <div className="relative overflow-hidden" style={{ background: bgAlt, borderTop: `1px solid ${hair}`, borderBottom: `1px solid ${hair}` }}>
        <div className="lv3-dots"/>
        <div className="lv3-glow" style={{ width: 560, height: 560, top: -180, left: "30%", background: "rgba(196,125,142,.18)" }}/>
        <section id="curated" className={SECTION}>
          <div className="lp-two">
            <div>
              <Head eyebrow={tr("Why curated")} a={tr("Stop testing panels.")} b={tr("We already did.")} />
              <p className="lp-sub" data-reveal="1">{tr("Most people find good services the expensive way: buy from five panels, watch three drop, chase refunds from two. Nitro tests every service before it's listed, sorts it into a tier you can understand, and pulls it the moment quality slips.")}</p>
              <div className="lp-points" data-reveal="2">
                <Point icon="checkCircle" title={tr("Tested before it's listed")} sub={tr("Real orders, real retention checks. If it doesn't hold, it never goes up.")} />
                <Point icon="refresh" title={tr("Retested, and delisted when it slips")} sub={tr("Suppliers change. When one degrades, the service comes down until it passes again.")} />
                <Point icon="layers" title={tr("Three tiers, zero guesswork")} sub={tr("Budget, Standard, Premium. Not 400 lookalike listings with mystery names.")} />
              </div>
            </div>
            {/* The test sheet: the four that failed are struck through one after
                another once it scrolls into view, and Panel E is kept. */}
            <div data-reveal="2" data-funnel="1">
              <div className="lp-sheet">
                <div className="lp-sheet-h"><div><b>{tr("Instagram Followers")}</b><small>{tr("Everywhere else")}</small></div><span className="lp-badge">{tr("Tested")}</span></div>
                {PANELS.map(([l, res, k], i) => { const won = k === "ok"; return (
                  <div key={l} className={"lp-prow" + (won ? " won" : i < dimmed ? " lost" : "")}>
                    <span className="lp-av">{won ? <Check size={14}/> : l}</span>
                    <b>{tr("Panel")} {l}</b>
                    <span className="lp-stamp" style={{ "--sc": `var(--lp-${k})` }}>{res}</span>
                  </div>
                ); })}
                <div className="lp-becomes">{tr("On Nitro")} {["Budget", "Standard", "Premium"].map(n => <span key={n} className="lp-ch" style={{ "--tc": tierC(n) }}>{n}</span>)}</div>
              </div>
              <p className="lp-caption serif">{tr("Panel E made it in. The other four didn't. That's the whole job.")}</p>
            </div>
          </div>
        </section>
      </div>

      {/* ━━━ FULL LIST ━━━ */}
      {/* Directly after curation, because it only makes sense as the answer to
          it: we curated, and we kept everything else. Every number in here is
          measured, not rounded up from the services table: the full-list size
          is what a customer can actually open and order, after packages,
          duplicates and untiled rows come out. */}
      <div className="relative overflow-hidden" style={{ background: t.bg }}>
        <div className="lv3-glow" style={{ width: 600, height: 600, top: -240, left: "6%", background: dark ? "rgba(96,165,250,.09)" : "rgba(96,165,250,.16)" }}/>
        <div className="lv3-grain"/>
        <section id="catalogue" className={SECTION}>
          <div className="lp-two">
            <div>
              <Head eyebrow={tr("Full list")} a={tr("And when you want")} b={tr("everything else.")} />
              <p className="lp-sub" data-reveal="1">{tr("The curated list is")} {nCurated.toLocaleString()} {tr("services we test and stand behind. Behind it sits the full list:")} {nFull.toLocaleString()} {tr("more, every one priced in naira, each carrying its own refill and speed terms. It is the same catalogue our resellers buy through the API, and it is open to anyone with an account.")}</p>
              <div className="lp-points" data-reveal="2">
                <Point icon="grid" title={`${nPlat} ${tr("platforms, not just the big four")}`} sub={tr("Spotify, Audiomack, Boomplay, Threads, WhatsApp, Twitch, Google reviews. The full list reaches every one of them.")} />
                <Point icon="naira" title={tr("Priced in naira, no dollar card")} sub={tr("The full list costs what it costs. No FX at checkout, no virtual card, no middleman taking a cut on the way.")} />
                <Point icon="tag" title={tr("Terms printed on every row")} sub={tr("The refill and speed shown on a service are the terms you get, said plainly, rather than cover we did not buy.")} />
              </div>
              {/* Two buttons because the section serves two readers: a creator
                  who wants the wider catalogue, and a reseller who wants the API. */}
              <div className="lp-ctas" data-reveal="3">
                <a href="/services" className="nb pri lp-cta">{tr("Browse the full list")}</a>
                <a href="/resellers" className="nb sec lp-cta">{tr("Reseller API")}</a>
              </div>
            </div>
            <div className="lp-big" data-reveal="2">
              <div className="lp-big-n m">{nFull.toLocaleString()}</div>
              <div className="lp-big-l">{tr("Full list")}<small>{tr("Live and orderable today")}</small></div>
              <div className="lp-trio">
                <div><b className="m">{nCurated.toLocaleString()}</b><span>{tr("Curated")}</span></div>
                <div><b className="m">{nPlat}</b><span>{tr("Platforms")}</span></div>
                <div><b className="m">₦</b><span>{tr("One currency")}</span></div>
              </div>
              <div className="lp-cloud">
                {["Instagram", "TikTok", "YouTube", "Spotify", "Telegram", "Facebook", "Twitch", "WhatsApp", "Audiomack", "Boomplay", "Threads"].map(c => <span key={c}><PlatformIcon platform={c} dark={dark} size={20} />{c}</span>)}
                <span className="more">+ {Math.max(nPlat - 11, 0)} {tr("more")}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
      <div className="h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(196,125,142,.5),transparent)" }}/>

      {/* ━━━ HOW IT WORKS ━━━ */}
      {/* A real sequence, so these keep their numbers. Each step shows the
          screen it describes. */}
      <div className="relative overflow-hidden" style={{ background: t.bg }}>
        <div className="lv3-glow" style={{ width: 560, height: 560, bottom: -280, right: "8%", background: dark ? "rgba(242,184,102,.08)" : "rgba(242,184,102,.16)" }}/>
        <div className="lv3-grain"/>
        <section id="how" className={SECTION}>
          <Head eyebrow={tr("How it works")} a={tr("Three steps,")} b={tr("no waiting.")} />
          <div className="lp-steps" data-reveal="1">
            {[
              [tr("Fund your wallet"), <>{tr("Card, transfer or crypto. From")} {money(1000)}{tr(", and your first deposit earns up to")} {money(MAX_BONUS_NAIRA, { round: "down" })} {tr("free.")}</>,
                <div className="lp-mini" key="v1"><div className="lp-lab">{tr("Balance")}</div><div className="lp-bal"><b className="m">{money(11000)}</b><span className="lp-coin"><OffsetIcon name="topup" size={13} />{tr("Top up")}</span></div></div>],
              [tr("Paste your link"), tr("Pick the service and tier, paste the post or profile, choose instant or gradual delivery."),
                <div className="lp-mini" key="v2"><div className="lp-lab">{tr("Profile link")}</div><div className="lp-field">instagram.com/yourname<span className="lp-caret" aria-hidden="true" /></div><div className="lp-tierpick" style={{ "--tc": tierC("Standard") }}><span>Budget</span><span className="on">Standard</span><span>Premium</span></div></div>],
              [tr("Watch it deliver"), tr("Progress live on your dashboard, usually within minutes. Refill cover on Standard and Premium."),
                <div className="lp-mini" key="v3" style={{ "--sc": dark ? "#a5b4fc" : "#4f46e5" }}><div className="lp-prog"><b>{tr("Instagram Followers")}</b><span className="lp-st"><i />{tr("Delivering")}</span></div><div className="lp-bar"><span /></div><div className="lp-pn"><span>NTR-48213</span><span>2,000</span></div></div>],
            ].map(([h, p, vig], i) => (
              <article key={i} className="lp-step">
                <div className="lp-vig" aria-hidden="true">{vig}</div>
                <div className="lp-stxt"><div className="lp-sn"><span className="lp-tile sm">{i + 1}</span><b>{h}</b></div><p>{p}</p></div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <div className="h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(196,125,142,.5),transparent)" }}/>

      {/* ━━━ REVIEWS (bento) ━━━ */}
      <div className="relative overflow-hidden" style={{ background: bgRose }}>
        <div className="lv3-glow" style={{ width: 700, height: 700, top: -300, left: -200, background: "rgba(196,125,142,.26)" }}/>
        <div className="lv3-glow" style={{ width: 520, height: 520, bottom: -240, right: -120, background: dark ? "rgba(196,125,142,.1)" : "rgba(255,255,255,.55)" }}/>
        <div className="lv3-grain"/>
        <section id="reviews" className={SECTION}>
          <Head eyebrow={tr("Reviews")} a={tr("Creators who")} b={tr("trust us.")} />
          <p className="lp-sub" data-reveal="1">{tr("Real reviews from Nigerian creators and businesses growing with Nitro. Tap the video.")}</p>
          <div className="lv3-bento" data-reveal="2">
            <div className="lv3-bcard lp-print flex flex-col justify-center min-h-[340px] max-md:min-h-0 overflow-hidden py-[34px] px-9 max-md:py-[26px] max-md:px-[22px]" style={{ gridArea: "feat", background: panel }}>
              <div className="absolute -top-2.5 left-[22px] serif text-[160px] leading-none select-none" style={{ color: "rgba(196,125,142,.2)" }}>“</div>
              <div className="flex gap-[3px] mb-4 relative">{[0,1,2,3,4].map(i => <Star key={i} c="#e0a458"/>)}</div>
              <blockquote className="serif italic font-medium text-[clamp(24px,2.6vw,34px)] leading-[1.25] relative m-0 transition-opacity duration-300" style={{ opacity: qFade ? 0 : 1 }}>“{qt}”</blockquote>
              <div className="flex items-center gap-3 mt-[22px] relative">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: qc, boxShadow: `2px 2px 0 color-mix(in srgb, ${qc} 45%, #000)` }}>{qinit}</div>
                <div><b className="block text-sm">{qn}</b><span className="text-[12.5px]" style={{ color: muted }}>{qr}</span></div>
                <div className="flex gap-1.5 ml-auto">{QUOTES.map((_, i) => <button key={i} type="button" aria-label={`Quote ${i + 1}`} onClick={() => pick(i)} className={"lv3-qdot" + (i === qi ? " on" : "")} style={{ background: muted }}/>)}</div>
              </div>
            </div>
            <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPlaying(p => !p); } }} onClick={() => setPlaying(p => !p)} className="lv3-bcard p-0 overflow-hidden cursor-pointer min-h-[340px] max-desktop:min-h-[300px] max-md:min-h-[260px]" style={{ gridArea: "video", background: "radial-gradient(80% 100% at 70% 30%,rgba(246,170,200,.45),transparent 60%),linear-gradient(160deg,#2a1420,#5a2840 60%,#8e4a66)", boxShadow: "5px 5px 0 #3a1828" }} aria-label={tr("Play video testimonial")}>
              <span className="absolute top-3 left-3 py-1 px-2.5 rounded-[7px] text-[10px] font-extrabold text-white z-[3] m" style={{ background: "rgba(0,0,0,.4)" }}>TikTok</span>
              <span className="absolute top-3 right-3 py-1 px-2 rounded-[7px] text-[10px] font-bold text-white z-[3] m" style={{ background: "rgba(0,0,0,.4)" }}>0:24</span>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-bold text-white" style={{ background: "#e05a8a", border: "2.5px solid rgba(255,255,255,.5)" }}>BI</div>
                <div className="serif italic text-[17px] font-semibold text-center px-[18px] leading-[1.4] transition-opacity duration-300" style={{ color: "rgba(255,255,255,.9)", opacity: playing ? 0 : 1 }}>{tr("“My TikTok reach changed within a week…”")}</div>
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[58px] h-[58px] rounded-full flex items-center justify-center z-[3] transition-opacity duration-200" style={{ background: "#fff", color: "#8e4a66", boxShadow: "0 0 0 10px rgba(255,255,255,.18)", opacity: playing ? 0 : 1 }}><OffsetIcon name="play" size={20} /></div>
              <div className="absolute left-0 right-0 bottom-0 pt-[34px] px-3.5 pb-3.5 z-[2]" style={{ background: "linear-gradient(transparent,rgba(0,0,0,.6))" }}><h5 className="text-[13.5px] font-bold text-white m-0">Blessing I.</h5><span className="text-[11.5px]" style={{ color: "rgba(255,255,255,.75)" }}>{tr("Beauty Influencer")}</span></div>
              {playing && <div className="lv3-veq absolute bottom-4 right-3.5 flex items-end gap-[2.5px] h-3.5 z-[4]"><i/><i/><i/></div>}
              <div className="absolute left-0 right-0 bottom-0 h-[3px] z-[4] transition-opacity" style={{ background: "rgba(255,255,255,.25)", opacity: playing ? 1 : 0 }}><div className="h-full bg-white" style={{ width: `${vprog}%` }}/></div>
            </div>
            <div className="lv3-bcard flex flex-col gap-2.5" style={{ gridArea: "r1", background: panel, boxShadow: `inset 0 0 0 1px ${brd}` }}>
              <div className="flex gap-0.5">{[0,1,2,3,4].map(i => <Star key={i} c="#e0a458"/>)}</div>
              <p className="text-sm leading-[1.55] flex-1 m-0">{tr("Every song I drop, I run the views here first. Three months now, e never fail me once.")}</p>
              <div className="flex items-center gap-[9px] text-[12.5px]" style={{ color: muted }}><i className="not-italic w-8 h-8 rounded-[10px] flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: "#d98a3a", boxShadow: "2px 2px 0 #8a4f16" }}>TM</i><div><b className="block text-[13px]" style={{ color: text }}>Tunde M.</b>{tr("Music Producer")}</div></div>
            </div>
            <div className="lv3-bcard flex flex-col gap-2.5" style={{ gridArea: "r2", background: panel, boxShadow: `inset 0 0 0 1px ${brd}` }}>
              <span className="inline-flex self-start py-[3px] px-[9px] rounded-[7px] text-[11px] font-extrabold" style={{ background: dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.1)", color: dark ? "#6ee7b7" : "#059669" }}>{tr("Saves ₦50K monthly")}</span>
              <p className="text-sm leading-[1.55] flex-1 m-0">{tr("I run social media for 12 clients. The bulk pricing alone saves me ₦50,000 every month.")}</p>
              <div className="flex items-center gap-[9px] text-[12.5px]" style={{ color: muted }}><i className="not-italic w-8 h-8 rounded-[10px] flex items-center justify-center text-[11px] font-bold text-white shrink-0" style={{ background: "#6b7fe0", boxShadow: "2px 2px 0 #34418a" }}>EN</i><div><b className="block text-[13px]" style={{ color: text }}>Emeka N.</b>{tr("Digital Marketer")}</div></div>
            </div>
            <div className="lv3-bcard text-white flex flex-col justify-center gap-1.5 overflow-hidden" style={{ gridArea: "stat", background: "radial-gradient(90% 120% at 100% 0%,rgba(255,200,215,.4),transparent 60%),linear-gradient(140deg,#6a3450,#b56c82)", boxShadow: "4px 4px 0 #3a1828" }}>
              <div className="flex gap-0.5 relative">{[0,1,2,3,4].map(i => <Star key={i} c="#ffe3a3"/>)}</div>
              <div className="m text-[44px] font-bold -tracking-[2px] leading-none relative mt-1">4.9</div>
              <div className="text-[12.5px] relative" style={{ opacity: .9 }}>{tr("average across 320+ reviews")}</div>
              <div className="flex mt-2 relative">{[["CA","#c47d8e"],["TM","#d98a3a"],["AB","#2bb58b"],["EN","#6b7fe0"],["BI","#e05a8a"],["+","rgba(255,255,255,.25)"]].map(([a, c], i) => <i key={a} className="not-italic w-[26px] h-[26px] rounded-full text-[9px] font-extrabold flex items-center justify-center text-white" style={{ background: c, border: "2px solid rgba(255,255,255,.8)", marginLeft: i ? -8 : 0 }}>{a}</i>)}</div>
            </div>
          </div>
        </section>
      </div>

      {/* ━━━ CTA + FOOTER ━━━ */}
      <div id="cta" className="flex flex-col snap-section">
        <div className="relative overflow-hidden" style={{ background: dark ? "linear-gradient(160deg,#1a1220,#080510)" : "linear-gradient(120deg,#4a2236 0%,#7a3e58 50%,#b06a82 100%)" }}>
          <div className="absolute rounded-full pointer-events-none" style={{ width: 600, height: 600, top: -220, left: -120, background: dark ? "rgba(196,125,142,.14)" : "rgba(255,215,195,.22)", filter: "blur(110px)" }}/>
          {[760, 520].map(sz => <div key={sz} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none" style={{ width: sz, height: sz, left: "78%", border: "1px solid rgba(255,255,255,.12)" }}/>)}
          <div className="lv3-grain"/>
          <div className="relative z-[2] max-w-[1100px] mx-auto grid grid-cols-[1.15fr_.85fr] max-desktop:grid-cols-1 gap-[50px] max-desktop:gap-[34px] items-center pt-[84px] px-[60px] pb-[76px] max-desktop:!pt-16 max-desktop:!px-10 max-desktop:!pb-[60px] max-md:!pt-14 max-md:!px-[22px] max-md:!pb-[52px]">
            <div>
              <div data-reveal className="lp-eb" style={{ color: "rgba(255,255,255,.85)", "--lp-print": "rgba(0,0,0,.25)" }}>{tr("No card. No contract. No waiting.")}</div>
              <h2 data-reveal="1" className="text-[clamp(36px,4.6vw,62px)] font-bold text-white leading-[1.02] -tracking-[2.4px] mt-4 mb-0">{tr("Your audience")} <br/><span className="serif italic font-medium -tracking-[.5px]" style={{ color: "#ffd9e3" }}>{tr("won't grow itself.")}</span></h2>
              <p data-reveal="2" className="text-[16.5px] leading-[1.7] max-w-[480px] mt-[18px] mb-[26px]" style={{ color: "rgba(255,255,255,.86)" }}>{tr("Every minute you wait, someone with worse content and better numbers is getting the deal, the booking, the follow. Fund a wallet, pick a tier, watch it move.")}</p>
              <div data-reveal="3" className="flex gap-3 flex-wrap items-center max-md:flex-col max-md:items-stretch">
                <a href="/signup" onClick={e => { e.preventDefault(); setModal("signup"); }} className="py-4 px-[34px] rounded-full text-[15.5px] font-extrabold no-underline text-center transition-transform duration-200 hover:-translate-y-px" style={{ background: "#fff", color: "#5a2840", boxShadow: "3px 3px 0 rgba(30,8,20,.35)" }}>{tr("Start Growing Now →")}</a>
                {wa && <WaButton href={wa} size="lg" className="pill">{tr("Ask us anything")}</WaButton>}
              </div>
              <div data-reveal="3" className="flex items-center gap-3 mt-[26px] text-[13px]" style={{ color: "rgba(255,255,255,.85)" }}>
                <div className="flex">{[["TM","#d98a3a"],["AB","#2bb58b"],["EN","#6b7fe0"],["BI","#e05a8a"],["KD","#e0a458"]].map(([a, c], i) => <i key={a} className="not-italic w-[30px] h-[30px] rounded-full text-[10px] font-extrabold flex items-center justify-center text-white" style={{ background: c, border: "2px solid rgba(255,255,255,.9)", marginLeft: i ? -9 : 0 }}>{a}</i>)}</div>
                <span><b className="text-white">{siteStats?.users || "2,300"}{tr("+ creators")}</b> {tr("already here.")}{processing != null && <> <span className="m">{processing}</span> {tr("orders delivering right now.")}</>}</span>
              </div>
            </div>
            <div data-reveal="2" className="lp-offer">
              <div className="flex items-center gap-3 mb-4">
                <span className="lp-gift"><OffsetIcon name="gift" size={20} /></span>
                <div><b className="block text-base font-extrabold">{tr("Your first push is on us")}</b><span className="text-[12.5px]" style={{ opacity: .85 }}>{tr("Up to")} {money(MAX_BONUS_NAIRA, { round: "down" })} {tr("in promo credit, first deposit")}</span></div>
              </div>
              <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
                {[<>{tr("Fund from")} {money(1000)} {tr("by card, transfer or crypto")}</>,tr("Pick Budget, Standard or Premium per order"),tr("Delivery starts in under 60 seconds"),tr("Undelivered orders refund automatically")].map((x, i) => <li key={i} className="flex gap-2.5 text-[14px] items-center leading-[1.45]"><i><Check size={12}/></i>{x}</li>)}
              </ul>
              <div className="mt-4 pt-3.5 flex justify-between gap-2.5 flex-wrap text-[12px]" style={{ borderTop: "1px solid rgba(255,255,255,.22)", opacity: .9 }}><span>{tr("Account in 30 seconds")}</span><b className="m">{tr("0 monthly fees")}</b></div>
            </div>
          </div>
        </div>

          {/* The closing pitch. Not a <footer> any more, and no ghost wordmark
              of its own: the shared footer sits directly beneath and carries
              both, so keeping them here drew NITRO twice down one screen. */}
          <section className="lv3-ft lv3-closer" style={{background:dark?"#050710":"#2a1a22"}}>
            <div className="lv3-grain"/>
            <div className="absolute rounded-full pointer-events-none" style={{width:520,height:400,top:"-40%",left:"18%",background:"rgba(196,125,142,.14)",filter:"blur(110px)"}}/>
            <div className="lv3-ft-in">
              <div className="lv3-ft-head">
                <div className="lv3-ft-stmt">{tr("The audience is out there.")} <em>{tr("Go get them.")}</em></div>
                {/* The same lively green card as Stay updated on the home page. */}
                <a className="lp-chan" href={waChannel} target="_blank" rel="noopener noreferrer">
                  <span className="lp-chan-g"><svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d={WA_PATH}/></svg></span>
                  <span><b>{tr("Promos land on WhatsApp first")}</b><i>{tr("Deals, new services and free credit drops, straight to your phone.")}</i></span>
                  <span className="lp-chan-go"><span className="max-md:hidden">{tr("Join the channel")}</span><span className="hidden max-md:!inline">{tr("Join")}</span></span>
                </a>
              </div>
            </div>
          </section>

          {/* The same footer the other nineteen pages render. */}
          <SharedFooter />
        </div>{/* end cta */}
    </div>
  );
}
