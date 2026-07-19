/* Shared OG / Twitter card — "Dark speed v2", approved 18 Jul 2026.
   Consumed by app/opengraph-image.jsx and app/twitter-image.jsx.
   Fonts load from assets/og-fonts (committed WOFF files, no runtime fetch). */
import { readFile } from 'fs/promises';
import { join } from 'path';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = 'The Nitro NG — Look as big as you are. Growth for Nigerian creators.';

const MARK = 'M 480 4498 L 480 2680 A 961 961 0 0 1 2402 2680 L 2402 3915 A 960 960 0 0 0 4322 3915 L 4322 682';
/* pink lead + echo colors; red/green/yellow are placeholders pending the social template hexes */
const SOCIAL = ['#c47d8e', '#e05252', '#34a97b', '#ecc94b'];
const GLYPH = {
  ig: 'M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z',
  tt: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  x: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  ytBox: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z',
  ytPlay: 'M9.545 15.568V8.432L15.818 12z',
};
const WM = [
  'M499.027 0.607C527.947-3.336 552.492 12.166 560.13 40.247c4.533 120.349.703 241.581 1.949 362.247-9.564 160.805-220 213.024-304.95 79.281-39.913-62.781-18.585-123.25-24.841-191.312-6.618-72.05-110.308-75.064-123.544-5.359-5.213 69.217 4.873 144.373-.544 212.91C103.259 560.806 17.95 566.902 2.992 507.589 2.742 438.032-2.312 366.707 1.292 297.059 11.332 101.918 269.934 67.875 329.474 242.732c17.927 52.672 4.442 105.571 9.677 158.425 6.437 64.798 110.739 72.141 116.201-7.933L455.443 45.098C458.548 22.954 476.544 3.667 499.027.607z',
  'M1599.25 132.742c171.46-12.602 275.71 183.741 182.7 323.989-76.09 114.682-231.52 123.68-321.25 19.127-108.15-125.014-28.49-329.833 138.55-342.116zm6.68 97.389c-97.84 8.159-132.61 134.106-58.49 196.41 51.24 43.063 126.85 26.631 159.12-30.461 42.12-74.52-13.03-173.247-100.63-165.949z',
  'M1182.95 428.518c-3.1 3.082-.16 69.149-1.67 80.368-7.21 53.216-92.07 52.196-97.19-3.604V188.977c1.84-26.269 19.83-46.191 45.1-52.31 53.06 3.626 117.88-9.769 167.92 8.998 112.49 42.133 130.01 201.442 27.45 264.993-.48 1.994 6.26 9.7 7.93 11.831 21.96 27.719 59.61 55.505 43.36 95.417-12.71 31.187-56.98 37.238-80.12 13.372-26.06-26.857-48.25-68.877-74.11-96.709-1.93-2.085-3.97-4.057-5.96-6.051h-32.71zm.66-197.454l-1.99 1.995v106.727l1.99 1.995h60.08c3.06 0 14.49-3.377 18.02-4.692 52.58-19.65 36.51-106.047-16.68-106.047h-61.42v.022z',
  'M1028.47 229.47c-3.81 2.244-14.46 6.935-18.43 6.935h-72.753v271.499c0 2.833-5.122 14.006-6.958 17.066-18.834 31.866-65.727 31.549-86.283 1.382-2.516-3.671-8.228-17.157-8.228-21.123V236.405h-67.427c-5.734 0-20.579-8.091-25.338-12.034C709.713 196.811 725.918 142.03 768.323 136.274c.612.045 1.202-.091 1.814-.068h233.443c1.75.09 3.47-.068 5.19.068 47.53 3.581 60.76 68.9 19.7 93.196z',
  'M636.579 132.725c26.812-3.196 50.406 11.057 57.092 37.28 4.51 109.243.725 219.347 1.949 328.885-5.372 64.186-95.236 65.41-102.829 2.742l.181-326.777c3.695-21.871 21.214-40.456 43.63-43.13h-.023z',
];

export async function loadOgFonts() {
  const dir = join(process.cwd(), 'assets', 'og-fonts');
  const [jak800, jak600, mono700] = await Promise.all([
    readFile(join(dir, 'plus-jakarta-sans-latin-800-normal.woff')),
    readFile(join(dir, 'plus-jakarta-sans-latin-600-normal.woff')),
    readFile(join(dir, 'jetbrains-mono-latin-700-normal.woff')),
  ]);
  return [
    { name: 'Jakarta', data: jak800, weight: 800, style: 'normal' },
    { name: 'Jakarta', data: jak600, weight: 600, style: 'normal' },
    { name: 'Mono', data: mono700, weight: 700, style: 'normal' },
  ];
}

function Tube({ left, top, color }) {
  return (
    <svg style={{ position: 'absolute', left, top }} width="422" height="471" viewBox="0 0 4800 5352" fill="none">
      <path d={MARK} stroke={color} strokeWidth="965" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function OgCard() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: 'linear-gradient(135deg,#0a0d18 0%,#111627 50%,#0e1122 100%)', fontFamily: 'Jakarta', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1200, height: 630, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.04) 1.6px, transparent 1.6px)', backgroundSize: '30px 30px', display: 'flex' }} />
      <div style={{ position: 'absolute', left: 630, top: -60, width: 700, height: 700, borderRadius: 350, background: 'radial-gradient(circle, rgba(196,125,142,.14) 0%, rgba(196,125,142,0) 65%)', display: 'flex' }} />
      <div style={{ position: 'absolute', left: -120, top: 360, width: 480, height: 480, borderRadius: 240, background: 'radial-gradient(circle, rgba(99,102,241,.09) 0%, rgba(99,102,241,0) 65%)', display: 'flex' }} />
      <div style={{ position: 'absolute', left: 520, top: 210, width: 300, height: 5, borderRadius: 3, background: 'linear-gradient(90deg, rgba(196,125,142,0), rgba(196,125,142,.28))', display: 'flex' }} />
      <div style={{ position: 'absolute', left: 580, top: 300, width: 260, height: 5, borderRadius: 3, background: 'linear-gradient(90deg, rgba(196,125,142,0), rgba(196,125,142,.47))', display: 'flex' }} />
      <div style={{ position: 'absolute', left: 545, top: 392, width: 285, height: 5, borderRadius: 3, background: 'linear-gradient(90deg, rgba(196,125,142,0), rgba(196,125,142,.19))', display: 'flex' }} />
      <div style={{ position: 'absolute', left: 806, top: -10, width: 540, height: 560, transform: 'rotate(-6deg)', display: 'flex' }}>
        <Tube left={114} top={0} color={SOCIAL[3]} />
        <Tube left={76} top={29} color={SOCIAL[2]} />
        <Tube left={38} top={58} color={SOCIAL[1]} />
        <Tube left={0} top={84} color={SOCIAL[0]} />
      </div>
      <svg style={{ position: 'absolute', left: 84, top: 80 }} width="190" height="58" viewBox="0 0 1817 558" fill="#f5f3f0">
        {WM.map((d, i) => <path key={i} d={d} />)}
      </svg>
      <div style={{ position: 'absolute', left: 84, top: 240, fontSize: 86, fontWeight: 800, color: '#f5f3f0', letterSpacing: -1.5, display: 'flex' }}>Look as big</div>
      <div style={{ position: 'absolute', left: 84, top: 330, fontSize: 86, fontWeight: 800, color: '#f5f3f0', letterSpacing: -1.5, display: 'flex' }}>
        <span>as you</span>
        <div style={{ width: 22, display: 'flex' }} />
        <span style={{ color: '#c47d8e' }}>are.</span>
      </div>
      <div style={{ position: 'absolute', left: 84, top: 443, fontSize: 27, fontWeight: 600, color: 'rgba(245,243,240,.55)', display: 'flex' }}>Growth for Nigerian creators · gradual, safe delivery</div>
      <div style={{ position: 'absolute', left: 84, top: 514, display: 'flex', gap: 30 }}>
        <svg width="44" height="44" viewBox="0 0 24 24"><path d={GLYPH.ig} fill="rgba(255,255,255,.92)" /></svg>
        <svg width="44" height="44" viewBox="0 0 24 24"><path d={GLYPH.tt} fill="rgba(255,255,255,.92)" /></svg>
        <svg width="44" height="44" viewBox="0 0 24 24"><path d={GLYPH.x} fill="rgba(255,255,255,.92)" /></svg>
        <svg width="44" height="44" viewBox="0 0 24 24"><path d={GLYPH.ytBox} fill="rgba(255,255,255,.92)" /><path d={GLYPH.ytPlay} fill="#0a0d18" /></svg>
      </div>
      <div style={{ position: 'absolute', left: 388, top: 513, width: 176, height: 46, borderRadius: 12, border: '1.5px solid rgba(196,125,142,.45)', background: 'rgba(196,125,142,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Mono', fontSize: 24, fontWeight: 700, color: '#c47d8e' }}>nitro.ng</div>
      <div style={{ position: 'absolute', left: 0, top: 624, display: 'flex' }}>
        {SOCIAL.map((c) => <div key={c} style={{ width: 300, height: 6, background: c, opacity: 0.9, display: 'flex' }} />)}
      </div>
    </div>
  );
}
