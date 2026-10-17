'use client';
import { useLocale } from "./locale";

// The offset-print icon set, chosen 17 Oct 2026 (mockups: Nitro Sidebar Icons,
// Nitro User Icons, Nitro Icon Details). Each outline sits over its own shape,
// shifted down and right. The shape's colour is CSS (.ic-off in globals.css):
// grey at rest, rose on the row you are on. One file for both rails, the More
// sheet and every customer page, so they cannot drift apart. The dock draws its
// own five (DOCK_ICONS).
//
// The drawings are fixed strings written here, never user input, which is what
// makes injecting them as markup safe.
const SET = {
  home: { o: '<path d="M4.5 10.8 12 4.8l7.5 6V19a1.6 1.6 0 0 1-1.6 1.6H6.1A1.6 1.6 0 0 1 4.5 19z"/>', l: '<path d="M4.5 10.8 12 4.8l7.5 6V19a1.6 1.6 0 0 1-1.6 1.6h-3.3v-5.1H9.4v5.1H6.1A1.6 1.6 0 0 1 4.5 19z"/>' },
  rocket: { o: '<path d="M12 2.8c3.1 2.3 4.6 5.7 4.6 9.2l-1.9 3.3H9.3L7.4 12c0-3.5 1.5-6.9 4.6-9.2z"/>', l: '<path d="M12 2.8c3.1 2.3 4.6 5.7 4.6 9.2l-1.9 3.3H9.3L7.4 12c0-3.5 1.5-6.9 4.6-9.2z"/><circle cx="12" cy="9.3" r="1.6"/><path d="M7.5 12.6 5 15.1v2.7l3.2-1.6M16.5 12.6l2.5 2.5v2.7l-3.2-1.6M10.6 17.4c0 1.6.6 2.8 1.4 3.6.8-.8 1.4-2 1.4-3.6"/>' },
  receipt: { o: '<path d="M6 3h11.6v17.2l-1.93-1.35-1.93 1.35-1.94-1.35-1.93 1.35-1.93-1.35L6 20.2z"/>', l: '<path d="M6 3h11.6v17.2l-1.93-1.35-1.93 1.35-1.94-1.35-1.93 1.35-1.93-1.35L6 20.2z"/><path d="M9 7.8h5.6M9 11.3h5.6M9 14.8h3.1"/>' },
  receiptPlus: { o: '<path d="M6 3h11.6v17.2l-1.93-1.35-1.93 1.35-1.94-1.35-1.93 1.35-1.93-1.35L6 20.2z"/>', l: '<path d="M6 3h11.6v17.2l-1.93-1.35-1.93 1.35-1.94-1.35-1.93 1.35-1.93-1.35L6 20.2z"/><path d="M11.8 7.5v6M8.8 10.5h6"/>' },
  wallet: { o: '<rect x="3" y="6" width="17.6" height="13" rx="3"/>', l: '<rect x="3" y="6" width="17.6" height="13" rx="3"/><path d="M14.4 10.4h6.2v4.8h-6.2a2.4 2.4 0 0 1 0-4.8z"/>' },
  gift: { o: '<rect x="4" y="10" width="16" height="10.5" rx="1.6"/>', l: '<rect x="4" y="10" width="16" height="10.5" rx="1.6"/><rect x="3" y="6.8" width="18" height="3.4" rx="1"/><path d="M12 6.8v13.7M12 6.8C10.6 3.8 6.8 3.5 7 6c.2 1.8 5 .8 5 .8s4.8 1 5-.8c.2-2.5-3.6-2.2-5 .8"/>' },
  tasks: { o: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/>', l: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5v-.9c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v.9M8.8 13l2.2 2.2 4.2-4.4"/>' },
  grid: { o: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>', l: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>' },
  code: { o: '<rect x="3" y="5" width="18" height="14" rx="2.5"/>', l: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M9.5 10 7.2 12l2.3 2M14.5 10l2.3 2-2.3 2M12.8 9.2l-1.6 5.6"/>' },
  doc: { o: '<path d="M6 3.5h8.5l4 4V20a.9.9 0 0 1-.9.9H6.9A.9.9 0 0 1 6 20z"/>', l: '<path d="M6 3.5h8.5l4 4V20a.9.9 0 0 1-.9.9H6.9A.9.9 0 0 1 6 20z"/><path d="M14.5 3.5v4h4M9 12h6M9 15.5h6M9 9h2.5"/>' },
  chat: { o: '<path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.2A8.5 8.5 0 1 0 12 3.5z"/>', l: '<path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.2A8.5 8.5 0 1 0 12 3.5z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" stroke-width="2.4"/>' },
  referral: { o: '<path d="M3.5 19.5c0-3.6 2.7-6 6-6s6 2.4 6 6z"/>', l: '<circle cx="9.5" cy="8" r="3.2"/><path d="M3.5 19.5c0-3.6 2.7-6 6-6s6 2.4 6 6M18.5 8v6M15.5 11h6"/>' },
  spark: { o: '<path d="M11 4l2 6.1 6.1 2-6.1 2-2 6.1-2-6.1L2.9 12.1l6.1-2z"/>', l: '<path d="M11 4l2 6.1 6.1 2-6.1 2-2 6.1-2-6.1L2.9 12.1l6.1-2z"/><path d="M19 2.8v3.4M17.3 4.5h3.4"/>' },
  phone: { o: '<rect x="6.5" y="2.8" width="11" height="18.4" rx="2.4"/>', l: '<rect x="6.5" y="2.8" width="11" height="18.4" rx="2.4"/><path d="M12 8.6v5.8M9.1 11.5h5.8M10.5 18h3"/>' },
  gear: { o: '<path d="M12 3.4l1.5 2 2.4-.6.7 2.4 2.4.8-.6 2.4 1.7 1.8-1.7 1.8.6 2.4-2.4.8-.7 2.4-2.4-.6-1.5 2-1.5-2-2.4.6-.7-2.4-2.4-.8.6-2.4L3.9 12l1.7-1.8L5 7.8l2.4-.8.7-2.4 2.4.6z"/>', l: '<path d="M12 3.4l1.5 2 2.4-.6.7 2.4 2.4.8-.6 2.4 1.7 1.8-1.7 1.8.6 2.4-2.4.8-.7 2.4-2.4-.6-1.5 2-1.5-2-2.4.6-.7-2.4-2.4-.8.6-2.4L3.9 12l1.7-1.8L5 7.8l2.4-.8.7-2.4 2.4.6z"/><circle cx="12" cy="12" r="2.8"/>' },
  logout: { o: '<rect x="4.5" y="4" width="8" height="16" rx="1.5"/>', l: '<path d="M12.5 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h6.5M15.5 8l4 4-4 4M19.5 12h-9"/>' },
  gauge: { o: '<path d="M3.5 16a8.5 8.5 0 0 1 17 0z"/>', l: '<path d="M3.5 16a8.5 8.5 0 0 1 17 0M12 16l3.6-4.6M5 19.5h14"/>' },
  refresh: { o: '<circle cx="12" cy="12" r="5"/>', l: '<path d="M19.5 9.2A8 8 0 0 0 5.4 7.1M4.5 14.8a8 8 0 0 0 14.1 2.1M5 3.6v3.7h3.7M19 20.4v-3.7h-3.7"/><circle cx="12" cy="12" r="2.2"/>' },
  users: { o: '<path d="M3 19.5c0-3.3 2.4-5.5 5.5-5.5s5.5 2.2 5.5 5.5z"/>', l: '<circle cx="8.5" cy="8.5" r="3"/><path d="M3 19.5c0-3.3 2.4-5.5 5.5-5.5s5.5 2.2 5.5 5.5M15.5 5.8a3 3 0 0 1 0 5.6M16.6 14.1c2.6.4 4.4 2.5 4.4 5.4"/>' },
  store: { o: '<rect x="4.5" y="10.5" width="15" height="9.5"/>', l: '<path d="M4.5 11v9h15v-9M3 9.8l1.7-5.3h14.6L21 9.8a2.6 2.6 0 0 1-5.1.3 2.6 2.6 0 0 1-5.1 0 2.6 2.6 0 0 1-5.1 0A2.6 2.6 0 0 1 3 9.8zM10 20v-4.5h4V20"/>' },
  trophy: { o: '<path d="M7.5 4h9v4.5a4.5 4.5 0 0 1-9 0z"/>', l: '<path d="M7.5 4h9v4.5a4.5 4.5 0 0 1-9 0zM7.5 5.5H5a2.3 2.3 0 0 0 2.8 3.6M16.5 5.5H19a2.3 2.3 0 0 1-2.8 3.6M12 13v3.5M8.5 20.5h7M9.5 16.5h5v4h-5z"/>' },
  layers: { o: '<path d="M12 4 3.5 8.5 12 13l8.5-4.5z"/>', l: '<path d="M12 4 3.5 8.5 12 13l8.5-4.5zM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5"/>' },
  db: { o: '<path d="M5 6.5v11c0 1.7 3.1 3 7 3s7-1.3 7-3v-11c0-1.7-3.1-3-7-3s-7 1.3-7 3z"/>', l: '<ellipse cx="12" cy="6.5" rx="7" ry="3"/><path d="M5 6.5v11c0 1.7 3.1 3 7 3s7-1.3 7-3v-11M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>' },
  tag: { o: '<path d="M11.5 3.5h7a2 2 0 0 1 2 2v7l-9 9a1.5 1.5 0 0 1-2.1 0l-6.4-6.4a1.5 1.5 0 0 1 0-2.1z"/>', l: '<path d="M11.5 3.5h7a2 2 0 0 1 2 2v7l-9 9a1.5 1.5 0 0 1-2.1 0l-6.4-6.4a1.5 1.5 0 0 1 0-2.1z"/><circle cx="16" cy="8" r="1.4"/>' },
  tagPct: { o: '<path d="M11.5 3.5h7a2 2 0 0 1 2 2v7l-9 9a1.5 1.5 0 0 1-2.1 0l-6.4-6.4a1.5 1.5 0 0 1 0-2.1z"/>', l: '<path d="M11.5 3.5h7a2 2 0 0 1 2 2v7l-9 9a1.5 1.5 0 0 1-2.1 0l-6.4-6.4a1.5 1.5 0 0 1 0-2.1z"/><path d="M9.6 15.4l5.2-5.2M10.2 10.8h.01M14.2 14.8h.01" stroke-width="2.2"/>' },
  updown: { o: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/>', l: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8.5 15.5v-7M6.3 10.7l2.2-2.2 2.2 2.2M15.5 8.5v7M13.3 13.3l2.2 2.2 2.2-2.2"/>' },
  percent: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M9 15l6-6M9.3 9.3h.01M14.7 14.7h.01" stroke-width="2.2"/>' },
  bell: { o: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/>', l: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2.2 2.2 0 0 0 4 0"/>' },
  mail: { o: '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/>', l: '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="m3.5 7 8.5 6 8.5-6"/>' },
  link: { o: '<rect x="2.6" y="9.2" width="10" height="5.6" rx="2.8" transform="rotate(-45 7.6 12)"/><rect x="11.4" y="9.2" width="10" height="5.6" rx="2.8" transform="rotate(-45 16.4 12)"/>', l: '<rect x="2.6" y="9.2" width="10" height="5.6" rx="2.8" transform="rotate(-45 7.6 12)"/><rect x="11.4" y="9.2" width="10" height="5.6" rx="2.8" transform="rotate(-45 16.4 12)"/>' },
  plane: { o: '<path d="M20.5 3.5 3 10.5l7 2.8 2.8 7z"/>', l: '<path d="M20.5 3.5 3 10.5l7 2.8 2.8 7zM20.5 3.5 10 13.3"/>' },
  flag: { o: '<path d="M5.5 4h12l-2.5 4 2.5 4h-12z"/>', l: '<path d="M5.5 21V4h12l-2.5 4 2.5 4h-12"/>' },
  clock: { o: '<circle cx="12.5" cy="12" r="7.5"/>', l: '<path d="M5 12a7.5 7.5 0 1 0 2.2-5.3M4.8 4.2v3.6h3.6M12.5 8.3v3.9l2.7 1.6"/>' },
    copy: { o: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.4"/>', l: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.4"/><path d="M15.5 8.5V5.9a2.4 2.4 0 0 0-2.4-2.4H5.9a2.4 2.4 0 0 0-2.4 2.4v7.2a2.4 2.4 0 0 0 2.4 2.4h2.6"/>' },
  card: { o: '<rect x="2.8" y="5.5" width="18.4" height="13" rx="2.4"/>', l: '<rect x="2.8" y="5.5" width="18.4" height="13" rx="2.4"/><path d="M2.8 9.8h18.4M6.5 15h3"/>' },
  bars: { o: '<rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="7.5" width="4" height="12.5" rx="1"/><rect x="16" y="3.5" width="4" height="16.5" rx="1"/>', l: '<rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="7.5" width="4" height="12.5" rx="1"/><rect x="16" y="3.5" width="4" height="16.5" rx="1"/>' },
  terminal: { o: '<rect x="3" y="4" width="18" height="16" rx="2.4"/>', l: '<rect x="3" y="4" width="18" height="16" rx="2.4"/><path d="M7 9.5 9.5 12 7 14.5M11.5 14.5h5"/>' },
  team: { o: '<path d="M12 3l7.5 2.7v5.4c0 5-3.3 8.8-7.5 10.1-4.2-1.3-7.5-5.1-7.5-10.1V5.7z"/>', l: '<path d="M12 3l7.5 2.7v5.4c0 5-3.3 8.8-7.5 10.1-4.2-1.3-7.5-5.1-7.5-10.1V5.7z"/><circle cx="12" cy="10" r="2.2"/><path d="M8.6 16c.6-1.8 2-2.8 3.4-2.8s2.8 1 3.4 2.8"/>' },
  alert: { o: '<path d="M10.3 4.3a2 2 0 0 1 3.4 0l7.6 13.2a2 2 0 0 1-1.7 3H4.4a2 2 0 0 1-1.7-3z"/>', l: '<path d="M10.3 4.3a2 2 0 0 1 3.4 0l7.6 13.2a2 2 0 0 1-1.7 3H4.4a2 2 0 0 1-1.7-3zM12 9.5V14M12 17h.01"/>' },
  plug: { o: '<path d="M7.5 8h9v4a4.5 4.5 0 0 1-9 0z"/>', l: '<path d="M9.5 3v5M14.5 3v5M7.5 8h9v4a4.5 4.5 0 0 1-9 0zM12 16.5V21"/>' },
  wrench: { o: '<path d="M14.6 4.1a4.6 4.6 0 0 0-1.2 5.1l-8.6 8.6a1.8 1.8 0 0 0 2.5 2.5l8.6-8.6a4.6 4.6 0 0 0 5.1-1.2l-2.7-.6-.6-2.7 2.2-2.1a4.6 4.6 0 0 0-5.3-1z"/>', l: '<path d="M14.6 4.1a4.6 4.6 0 0 0-1.2 5.1l-8.6 8.6a1.8 1.8 0 0 0 2.5 2.5l8.6-8.6a4.6 4.6 0 0 0 5.1-1.2l-2.7-.6-.6-2.7 2.2-2.1a4.6 4.6 0 0 0-5.3-1z"/>' },
  shield: { o: '<path d="M12 3l7.5 2.7v5.4c0 5-3.3 8.8-7.5 10.1-4.2-1.3-7.5-5.1-7.5-10.1V5.7z"/>', l: '<path d="M12 3l7.5 2.7v5.4c0 5-3.3 8.8-7.5 10.1-4.2-1.3-7.5-5.1-7.5-10.1V5.7z"/>' },
  shieldCheck: { o: '<path d="M12 3l7.5 2.7v5.4c0 5-3.3 8.8-7.5 10.1-4.2-1.3-7.5-5.1-7.5-10.1V5.7z"/>', l: '<path d="M12 3l7.5 2.7v5.4c0 5-3.3 8.8-7.5 10.1-4.2-1.3-7.5-5.1-7.5-10.1V5.7z"/><path d="M8.8 12.2l2.2 2.2 4.3-4.4"/>' },
  shieldX: { o: '<path d="M12 3l7.5 2.7v5.4c0 5-3.3 8.8-7.5 10.1-4.2-1.3-7.5-5.1-7.5-10.1V5.7z"/>', l: '<path d="M12 3l7.5 2.7v5.4c0 5-3.3 8.8-7.5 10.1-4.2-1.3-7.5-5.1-7.5-10.1V5.7z"/><path d="M9.8 9.8l4.4 4.4M14.2 9.8l-4.4 4.4"/>' },
  bolt: { o: '<path d="M13.5 2.8 5.5 13.5h5.8L10 21.2l8.5-11h-5.8z"/>', l: '<path d="M13.5 2.8 5.5 13.5h5.8L10 21.2l8.5-11h-5.8z"/>' },
  crown: { o: '<path d="M3.5 8.5l4.5 4 4-6.5 4 6.5 4.5-4-1.8 10H5.3z"/>', l: '<path d="M3.5 8.5l4.5 4 4-6.5 4 6.5 4.5-4-1.8 10H5.3zM5.5 21h13"/>' },
  clockPlain: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>' },
  play: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M10.3 8.8v6.4l5.2-3.2z"/>' },
  bulb: { o: '<path d="M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.4V17h5v-.8c0-1 .4-1.8 1.1-2.4A6 6 0 0 0 12 3z"/>', l: '<path d="M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.4V17h5v-.8c0-1 .4-1.8 1.1-2.4A6 6 0 0 0 12 3zM9.5 20.5h5"/>' },
  wand: { o: '<path d="M15 3.5l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z"/>', l: '<path d="M15 3.5l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1zM12.5 11.5 4 20M19.5 13.5v2.6M18.2 14.8h2.6"/>' },
  list: { o: '<rect x="3.5" y="4" width="17" height="16" rx="3"/>', l: '<rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M8 9h8M8 12.5h8M8 16h5"/>' },
  checkCircle: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.3l2.5 2.5 4.9-5"/>' },
  xCircle: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M9.3 9.3l5.4 5.4M14.7 9.3l-5.4 5.4"/>' },
  pauseCircle: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>' },
  info: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8h.01" stroke-width="2.4"/>' },
  help: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.5"/><path d="M12 16.8h.01" stroke-width="2.4"/>' },
  globe: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5z"/>' },
  book: { o: '<path d="M3.5 5.5c3-1 5.8-.7 8.5 1v13c-2.7-1.7-5.5-2-8.5-1z"/><path d="M20.5 5.5c-3-1-5.8-.7-8.5 1v13c2.7-1.7 5.5-2 8.5-1z"/>', l: '<path d="M3.5 5.5c3-1 5.8-.7 8.5 1v13c-2.7-1.7-5.5-2-8.5-1zM20.5 5.5c-3-1-5.8-.7-8.5 1v13c2.7-1.7 5.5-2 8.5-1z"/>' },
  cart: { o: '<path d="M6.2 6.5h14.3l-1.8 8H7.8z"/>', l: '<path d="M3 4h2.5l2.3 10.5h10.9M6.2 6.5h14.3l-1.8 8"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>' },
  bookmark: { o: '<path d="M6.5 3.5h11V21L12 16.8 6.5 21z"/>', l: '<path d="M6.5 3.5h11V21L12 16.8 6.5 21z"/>' },
  thumbUp: { o: '<path d="M8 10.5l3.4-6.2c1.2-.5 2.6.4 2.4 1.8L13.3 9.5h5a1.8 1.8 0 0 1 1.8 2.1l-1.1 6.4a2 2 0 0 1-2 1.7H8z"/><rect x="4" y="10.5" width="4" height="9.2" rx=".8"/>', l: '<path d="M8 10.5l3.4-6.2c1.2-.5 2.6.4 2.4 1.8L13.3 9.5h5a1.8 1.8 0 0 1 1.8 2.1l-1.1 6.4a2 2 0 0 1-2 1.7H8z"/><rect x="4" y="10.5" width="4" height="9.2" rx=".8"/>' },
  thumbDown: { o: '<g transform="rotate(180 12 12)"><path d="M8 10.5l3.4-6.2c1.2-.5 2.6.4 2.4 1.8L13.3 9.5h5a1.8 1.8 0 0 1 1.8 2.1l-1.1 6.4a2 2 0 0 1-2 1.7H8z"/><rect x="4" y="10.5" width="4" height="9.2" rx=".8"/></g>', l: '<g transform="rotate(180 12 12)"><path d="M8 10.5l3.4-6.2c1.2-.5 2.6.4 2.4 1.8L13.3 9.5h5a1.8 1.8 0 0 1 1.8 2.1l-1.1 6.4a2 2 0 0 1-2 1.7H8z"/><rect x="4" y="10.5" width="4" height="9.2" rx=".8"/></g>' },
  star: { o: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>', l: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>' },
  diamond: { o: '<path d="M7 4h10l3.5 5L12 20.5 3.5 9z"/>', l: '<path d="M7 4h10l3.5 5L12 20.5 3.5 9zM3.5 9h17M9.6 4 8.2 9 12 20.5 15.8 9l-1.4-5"/>' },
  infinity: { o: '<path d="M12 12c-1.9-2.5-3.4-3.8-5.3-3.8a3.8 3.8 0 0 0 0 7.6c1.9 0 3.4-1.3 5.3-3.8zm0 0c1.9 2.5 3.4 3.8 5.3 3.8a3.8 3.8 0 0 0 0-7.6c-1.9 0-3.4 1.3-5.3 3.8z"/>', l: '<path d="M12 12c-1.9-2.5-3.4-3.8-5.3-3.8a3.8 3.8 0 0 0 0 7.6c1.9 0 3.4-1.3 5.3-3.8zm0 0c1.9 2.5 3.4 3.8 5.3 3.8a3.8 3.8 0 0 0 0-7.6c-1.9 0-3.4 1.3-5.3 3.8z"/>' },
  comment: { o: '<path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1h-9l-4.5 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z"/>', l: '<path d="M4 5.5h16a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1h-9l-4.5 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1zM7.5 9.5h9M7.5 13h6"/>' },
  bank: { o: '<path d="M3.5 9.5 12 4.5l8.5 5z"/><rect x="3.5" y="17.5" width="17" height="2.5" rx=".6"/>', l: '<path d="M3.5 9.5 12 4.5l8.5 5zM5.5 10.5v6.5M9.8 10.5v6.5M14.2 10.5v6.5M18.5 10.5v6.5"/><rect x="3.5" y="17.5" width="17" height="2.5" rx=".6"/>' },
  crypto: { o: '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"/>', l: '<path d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9zM8.3 9.3h7.4M12 9.3v7.4"/>' },
  mobile: { o: '<rect x="6.5" y="2.8" width="11" height="18.4" rx="2.4"/>', l: '<rect x="6.5" y="2.8" width="11" height="18.4" rx="2.4"/><circle cx="12" cy="11" r="3"/><path d="M12 9.7v2.6M10.6 17.8h2.8"/>' },
  topup: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M12 16V8M8.5 11.5 12 8l3.5 3.5"/>' },
  user: { o: '<path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5z"/>', l: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/>' },
  megaphone: { o: '<path d="M4 9.5v5h3l9 5V4.5l-9 5z"/>', l: '<path d="M4 9.5v5h3l9 5V4.5l-9 5zM19 9a4 4 0 0 1 0 6M7 14.5l1.5 5.5h3l-1-5"/>' },
  lock: { o: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/>', l: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5V17"/>' },
  monitor: { o: '<rect x="3" y="4" width="18" height="12.5" rx="2.2"/>', l: '<rect x="3" y="4" width="18" height="12.5" rx="2.2"/><path d="M9 20.5h6M12 16.5v4"/>' },
  key: { o: '<circle cx="8" cy="15" r="4.5"/>', l: '<circle cx="8" cy="15" r="4.5"/><path d="M11.3 11.7 19.5 3.5M16.2 6.8l2.3 2.3M13.8 9.2l1.8 1.8"/>' },
  activity: { o: '<rect x="3" y="4.5" width="18" height="15" rx="3"/>', l: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M6.5 12.5H9l1.5-3.5 3 7 1.5-3.5h2.5"/>' },
  trash: { o: '<path d="M6.3 7h11.4l-1 13H7.3z"/>', l: '<path d="M6.3 7h11.4l-1 13H7.3zM4 7h16M9.5 7V4.6h5V7M10.2 10.8v6M13.8 10.8v6"/>' },
  sun: { o: '<circle cx="12" cy="12" r="4"/>', l: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>' },
  moon: { o: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>', l: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>' },
  contrast: { o: '<path d="M12 3.5a8.5 8.5 0 0 1 0 17z"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/>' },
  offline: { o: '<circle cx="12" cy="13" r="6.5"/>', l: '<path d="M3.5 9a12.5 12.5 0 0 1 17 0M6.5 12.2a8 8 0 0 1 11 0M9.5 15.4a3.6 3.6 0 0 1 5 0M4 4l16 16"/><path d="M12 18.6h.01" stroke-width="2.4"/>' },
  pen: { o: '<path d="M14.5 4.5l5 5L9 20H4v-5z"/>', l: '<path d="M14.5 4.5l5 5L9 20H4v-5zM13 6l5 5"/>' },
  queue: { o: '<rect x="4" y="5" width="16" height="3.6" rx="1.8"/><rect x="4" y="10.2" width="12" height="3.6" rx="1.8"/><rect x="4" y="15.4" width="8" height="3.6" rx="1.8"/>', l: '<rect x="4" y="5" width="16" height="3.6" rx="1.8"/><rect x="4" y="10.2" width="12" height="3.6" rx="1.8"/><rect x="4" y="15.4" width="8" height="3.6" rx="1.8"/>' },
  moneyIn: { o: '<path d="M3.5 14h17v4a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18z"/>', l: '<path d="M3.5 14v4A2.5 2.5 0 0 0 6 20.5h12a2.5 2.5 0 0 0 2.5-2.5v-4M12 3.5v10M7.5 9.5l4.5 4.5 4.5-4.5"/>' },
  moneyOut: { o: '<path d="M3.5 14h17v4a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18z"/>', l: '<path d="M3.5 14v4A2.5 2.5 0 0 0 6 20.5h12a2.5 2.5 0 0 0 2.5-2.5v-4M12 14V4M7.5 8.5 12 4l4.5 4.5"/>' },
  plusCircle: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.5 12h7"/>' },
  minusCircle: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/>' },
  naira: { o: '<circle cx="12" cy="12" r="8.5"/>', l: '<circle cx="12" cy="12" r="8.5"/><path d="M9.3 16.2V7.8l5.4 8.4V7.8M7.4 10.9h9.2M7.4 13.3h9.2" stroke-width="1.5"/>' },
  // Blog: a landscape page with a picture block, so it never reads as the History receipt.
  news: { o: '<rect x="3" y="5" width="18" height="14" rx="2.5"/>', l: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><rect x="6.2" y="8.2" width="5.3" height="4.3" rx=".8"/><path d="M14.3 9h3.4M14.3 12h3.4M6.2 15.8h11.5"/>' },
  drip: { o: '<path d="M12 3.5c3.4 4 5.5 7.3 5.5 10a5.5 5.5 0 0 1-11 0c0-2.7 2.1-6 5.5-10z"/>', l: '<path d="M12 3.5c3.4 4 5.5 7.3 5.5 10a5.5 5.5 0 0 1-11 0c0-2.7 2.1-6 5.5-10z"/>' },
  swap: { o: '<rect x="3.5" y="5" width="17" height="14" rx="3"/>', l: '<path d="M7 9.5h10l-3-3M17 14.5H7l3 3"/>' },
  trend: { o: '<path d="M3.5 17l5-5 4 3 7.5-7.5V19.5h-16.5z"/>', l: '<path d="M3.5 17l5-5 4 3 7.5-7.5M15 7.5h5v5"/>' },
  share: { o: '<circle cx="17.5" cy="5.5" r="2.8"/><circle cx="6.5" cy="12" r="2.8"/><circle cx="17.5" cy="18.5" r="2.8"/>', l: '<circle cx="17.5" cy="5.5" r="2.8"/><circle cx="6.5" cy="12" r="2.8"/><circle cx="17.5" cy="18.5" r="2.8"/><path d="M9 13.4l6 3.7M15 6.9 9 10.6"/>' },
  bellOff: { o: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/>', l: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2.2 2.2 0 0 0 4 0M4 4l16 16"/>' },
  download: { o: '<path d="M3.5 14h17v4a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18z"/>', l: '<path d="M3.5 14v4A2.5 2.5 0 0 0 6 20.5h12a2.5 2.5 0 0 0 2.5-2.5v-4M12 3.5v10M7.5 9.5l4.5 4.5 4.5-4.5"/>' },
  calendar: { o: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/>', l: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>' },
  // The close X (Trip chose the chip, 17 Oct 2026): the X on a small printed square.
  close: { o: '<rect x="3.5" y="3.5" width="17" height="17" rx="5.5"/>', l: '<path d="M15.3 8.7 8.7 15.3M8.7 8.7l6.6 6.6" stroke-width="2.1"/>' },
};

const markup = (o, l) =>
  `<g class="ic-off" transform="translate(1.5 1.5)">${o}</g><g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${l}</g>`;

/**
 * `color` sets the stroke through currentColor, for the places that used to
 * pass a colour straight to the svg (status icons, tier tints).
 */
export function OffsetIcon({ name, size = 18, color, className, style }) {
  const icon = SET[name];
  if (!icon) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      className={name === 'close' ? ['ic-x', className].filter(Boolean).join(' ') : className}
      style={{ overflow: 'visible', ...(color ? { color } : null), ...style }}
      dangerouslySetInnerHTML={{ __html: markup(icon.o, icon.l) }}
    />
  );
}

// The money coin shows the currency picked in the top bar, not always naira.
const COIN_MARK = {
  NGN: ['M9.3 16.2V7.8l5.4 8.4V7.8M7.4 10.9h9.2M7.4 13.3h9.2', 1.5],
  USD: ['M14.8 9.2c-.5-1-1.5-1.6-2.8-1.6-1.6 0-2.7.9-2.7 2.1 0 2.9 5.6 1.6 5.6 4.5 0 1.3-1.2 2.2-2.9 2.2-1.3 0-2.4-.6-2.9-1.6M12 6v12', 1.6],
  GBP: ['M14.9 16.4H9c1.1-.9 1.5-2.1 1.5-3.4v-2.6a2.4 2.4 0 0 1 4.3-1.5M8.9 12.6h4.6', 1.6],
  GHS: ['M15 9.3a3.8 3.8 0 1 0 0 5.4M12 6.2v11.6', 1.6],
  KES: ['M6.8 8.8v6.4M6.8 12.4l2.8-3.6M7.9 11.1l1.9 4.1M12.9 10.3c-.3-.5-.8-.8-1.4-.8-.8 0-1.3.4-1.3 1 0 1.4 2.9.8 2.9 2.3 0 .6-.6 1.1-1.4 1.1-.7 0-1.2-.3-1.5-.8M14.3 8.8v6.4M14.3 12.3c.3-.6.8-.9 1.4-.9.8 0 1.2.5 1.2 1.3v2.5', 1.3],
};

export function CurrencyCoin({ size = 18, color, className, style }) {
  const code = useLocale()?.currency;
  const [d, w] = COIN_MARK[code] || COIN_MARK.NGN;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}
      style={{ overflow: 'visible', ...(color ? { color } : null), ...style }}
      dangerouslySetInnerHTML={{ __html: markup('<circle cx="12" cy="12" r="8.5"/>', `<circle cx="12" cy="12" r="8.5"/><path d="${d}" stroke-width="${w}"/>`) }}
    />
  );
}
