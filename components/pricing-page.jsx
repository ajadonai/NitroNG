'use client';
import { useState } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import SharedNav, { SharedFooter, SharedStyles } from './shared-nav';

export default function PricingView({ platforms }) {
  return <ThemeProvider><PricingInner platforms={platforms} /></ThemeProvider>;
}

const PLATFORM_ICONS = {
  Instagram: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill={c}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
  TikTok: (c) => <svg width="14" height="16" viewBox="0 0 448 512" fill={c}><path d="M448 209.91a210.06 210.06 0 01-122.77-39.25v178.72A162.55 162.55 0 11185 188.31v89.89a74.62 74.62 0 1052.23 71.18V0h88a121 121 0 00122.77 121.33z"/></svg>,
  YouTube: (c) => <svg width="18" height="13" viewBox="0 0 576 512" fill={c}><path d="M549.655 124.083c-6.281-23.65-24.787-42.276-48.284-48.597C458.781 64 288 64 288 64S117.22 64 74.629 75.486c-23.497 6.322-42.003 24.947-48.284 48.597-11.412 42.867-11.412 132.305-11.412 132.305s0 89.438 11.412 132.305c6.281 23.65 24.787 41.5 48.284 47.821C117.22 448 288 448 288 448s170.78 0 213.371-11.486c23.497-6.321 42.003-24.171 48.284-47.821 11.412-42.867 11.412-132.305 11.412-132.305s0-89.438-11.412-132.305zm-317.51 213.508V175.185l142.739 81.205-142.739 81.201z"/></svg>,
  X: (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill={c}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  Facebook: (c) => <svg width="10" height="18" viewBox="0 0 320 512" fill={c}><path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z"/></svg>,
  Telegram: (c) => <svg width="16" height="14" viewBox="0 0 496 512" fill={c}><path d="M248 8C111.033 8 0 119.033 0 256s111.033 248 248 248 248-111.033 248-248S384.967 8 248 8zm114.952 168.66c-3.732 39.215-19.881 134.378-28.1 178.3-3.476 18.584-10.322 24.816-16.948 25.425-14.4 1.326-25.338-9.517-39.287-18.661-21.827-14.308-34.158-23.215-55.346-37.177-24.485-16.135-8.612-25 5.342-39.5 3.652-3.793 67.107-61.51 68.335-66.746.154-.655.3-3.1-1.154-4.384s-3.59-.849-5.135-.5q-3.283.746-104.608 69.142-14.845 10.194-26.894 9.934c-8.855-.191-25.888-5.006-38.551-9.123-15.531-5.048-27.875-7.717-26.8-16.291q.84-6.7 18.45-13.7 108.446-47.248 144.628-62.3c68.872-28.647 83.183-33.623 92.511-33.789 2.052-.034 6.639.474 9.61 2.885a10.452 10.452 0 013.53 6.716 43.765 43.765 0 01.417 9.769z"/></svg>,
  Spotify: (c) => <svg width="16" height="16" viewBox="0 0 496 512" fill={c}><path d="M248 8C111.1 8 0 119.1 0 256s111.1 248 248 248 248-111.1 248-248S384.9 8 248 8zm100.7 364.9c-4.2 0-6.8-1.3-10.7-3.6-62.4-37.6-135-39.2-206.7-24.5-3.9 1-9 2.6-11.9 2.6-9.7 0-15.8-7.7-15.8-15.8 0-10.3 6.1-15.2 13.6-16.8 81.9-18.1 165.6-16.5 237 26.2 6.1 3.9 9.7 7.4 9.7 16.5s-7.1 15.4-15.2 15.4zm26.9-65.6c-5.2 0-8.7-2.3-12.3-4.2-62.5-37-155.7-51.9-238.6-29.4-4.8 1.3-7.4 2.6-11.9 2.6-10.7 0-19.4-8.7-19.4-19.4s5.2-17.8 15.5-20.7c27.8-7.8 56.2-13.6 97.8-13.6 64.9 0 127.6 16.1 177 45.5 8.1 4.8 11.3 11 11.3 19.7-.1 10.8-8.5 19.5-19.4 19.5zm31-76.2c-5.2 0-8.4-1.3-12.9-3.9-71.2-42.5-198.5-52.7-280.9-29.7-3.6 1-8.1 2.6-12.9 2.6-13.2 0-23.3-10.3-23.3-23.6 0-13.6 8.4-21.3 17.4-23.9 35.2-10.3 74.6-15.2 117.5-15.2 73 0 149.5 15.2 205.4 47.8 7.8 4.5 12.9 10.7 12.9 22.6 0 13.6-10.3 23.3-23.2 23.3z"/></svg>,
  Snapchat: (c) => <svg width="16" height="16" viewBox="0 0 512 512" fill={c}><path d="M496.926 366.6c-3.373-9.176-9.8-14.086-17.112-18.153-1.376-.806-2.641-1.451-3.72-1.947-2.182-1.128-4.414-2.22-6.634-3.373-22.8-12.09-40.609-27.341-52.959-45.42a102.889 102.889 0 01-9.089-16.12c-1.054-3.013-1-4.724-.248-6.287a10.221 10.221 0 012.914-3.038c3.918-2.591 7.96-5.22 10.7-6.993 4.885-3.162 8.754-5.667 11.246-7.44 9.362-6.547 15.909-13.5 20-21.278a42.371 42.371 0 002.1-35.191c-6.2-16.318-21.613-26.449-40.287-26.449a55.543 55.543 0 00-11.718 1.24c-1.029.224-2.059.459-3.063.72.174-11.16-.074-22.94-1.066-34.534C389.5 51.836 375.228 30.471 360.348 13.434A159.992 159.992 0 00256.002 0a159.992 159.992 0 00-108.57 42.091c-14.88 17.038-29.152 38.261-32.673 79.161-.992 11.594-1.24 23.374-1.066 34.534a36.3 36.3 0 01-3.063-.72 55.531 55.531 0 00-11.717-1.24c-18.674 0-34.086 10.131-40.287 26.449a42.373 42.373 0 002.1 35.191c4.088 7.774 10.632 14.727 20 21.278 2.48 1.761 6.349 4.266 11.246 7.44 2.641 1.711 6.5 4.216 10.28 6.72a11.053 11.053 0 013.3 3.311c.794 1.624.818 3.373-.36 6.6a102.645 102.645 0 01-8.94 15.785c-12.077 17.669-29.363 32.648-51.434 44.639C32.355 348.608 20.206 352.75 15.069 366.7c-3.868 10.528-1.339 22.506 8.494 32.6a49.137 49.137 0 0012.4 9.387 134.337 134.337 0 0030.342 12.139 20.024 20.024 0 016.126 4.4c1.9 2.777 1.839 5.753 3.472 10.328 1.24 3.472 3.063 7.071 6.058 10.4 6.7 7.424 16.108 10.9 25.379 13.412 10.943 2.965 22.332 4.168 31.528 8.2 3.533 1.586 6.685 3.919 10.937 7.021 12.021 8.783 28.46 20.8 64.187 20.8 36.2 0 52.847-12.254 64.924-21.062 4.168-3.038 7.282-5.359 10.7-6.9 9.2-4.029 20.584-5.234 31.528-8.2 9.271-2.517 18.674-5.988 25.379-13.412a35.723 35.723 0 006.058-10.4c1.674-4.636 1.586-7.564 3.472-10.328a20.119 20.119 0 016.139-4.4 134.643 134.643 0 0030.342-12.139 49.2 49.2 0 0012.4-9.387c9.919-10.094 12.449-22.106 8.581-32.6z"/></svg>,
  LinkedIn: (c) => <svg width="14" height="14" viewBox="0 0 448 512" fill={c}><path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 01107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.83-48.3 94 0 111.28 61.9 111.28 142.3V448z"/></svg>,
  Pinterest: (c) => <svg width="13" height="16" viewBox="0 0 384 512" fill={c}><path d="M204 6.5C101.4 6.5 0 74.9 0 185.6 0 256 39.6 296 63.6 296c9.9 0 15.6-27.6 15.6-35.4 0-9.3-23.7-29.1-23.7-67.8 0-80.4 61.2-137.4 140.4-137.4 68.1 0 118.5 38.7 118.5 109.8 0 53.1-21.3 152.7-90.3 152.7-24.9 0-46.2-18-46.2-43.8 0-37.8 26.4-74.4 26.4-113.4 0-66.2-93.9-54.2-93.9 25.8 0 16.8 2.1 35.4 9.6 50.7-13.8 59.4-42 147.9-42 209.1 0 18.9 2.7 37.5 4.5 56.4 3.4 3.8 1.7 3.4 6.9 1.5 50.4-69 48.6-82.5 71.4-172.8 12.3 23.4 44.1 36 69.3 36 106.2 0 153.9-103.5 153.9-196.8C384 71.3 298.2 6.5 204 6.5z"/></svg>,
  Twitch: (c) => <svg width="16" height="16" viewBox="0 0 512 512" fill={c}><path d="M391.17 103.47H352.54v109.7h38.63zM285 103H246.37v109.7H285zM120.83 0 24.31 91.42V420.58H140.14V512l96.53-91.42h77.25L487.69 256V0zM449.07 237.75l-77.22 73.12H294.61l-67.6 64v-64H140.14V36.58H449.07z"/></svg>,
  Discord: (c) => <svg width="18" height="14" viewBox="0 0 640 512" fill={c}><path d="M524.531 69.836a1.5 1.5 0 00-.764-.7A485.065 485.065 0 00404.081 32.03a1.816 1.816 0 00-1.923.91 337.461 337.461 0 00-14.9 30.6 447.848 447.848 0 00-134.426 0 309.541 309.541 0 00-15.135-30.6 1.89 1.89 0 00-1.924-.91 483.689 483.689 0 00-119.688 37.107 1.712 1.712 0 00-.788.676C39.068 183.651 18.186 294.69 28.43 404.354a2.016 2.016 0 00.765 1.375 487.666 487.666 0 00146.825 74.189 1.9 1.9 0 002.063-.676A348.2 348.2 0 00208.12 430.4a1.86 1.86 0 00-1.019-2.588 321.173 321.173 0 01-45.868-21.853 1.885 1.885 0 01-.185-3.126c3.082-2.309 6.166-4.711 9.109-7.137a1.819 1.819 0 011.9-.256c96.229 43.917 200.41 43.917 295.5 0a1.812 1.812 0 011.924.233 202.879 202.879 0 009.109 7.16 1.884 1.884 0 01-.162 3.126 301.407 301.407 0 01-45.89 21.83 1.875 1.875 0 00-1 2.611 391.055 391.055 0 0030.014 48.815 1.864 1.864 0 002.063.7A486.048 486.048 0 00610.7 405.729a1.882 1.882 0 00.765-1.352C623.729 277.594 590.933 167.465 524.531 69.836zM222.491 337.58c-28.972 0-52.844-26.587-52.844-59.239S193.056 219.1 222.491 219.1c29.665 0 53.306 26.82 52.843 59.239C275.334 310.993 251.924 337.58 222.491 337.58zm195.38 0c-28.971 0-52.843-26.587-52.843-59.239S388.437 219.1 417.871 219.1c29.667 0 53.307 26.82 52.844 59.239 0 32.654-23.177 59.239-52.844 59.239z"/></svg>,
};

function PlatformIcon({ name, color }) {
  const render = PLATFORM_ICONS[name];
  return render ? render(color) : null;
}

function PricingInner({ platforms }) {
  const { dark, t } = useTheme();
  const [active, setActive] = useState(null);
  const accent = "#c47d8e";
  const border = dark ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)";

  return (
    <>
      <SharedStyles />
      <div className="min-h-dvh flex flex-col font-[Plus Jakarta Sans,system-ui,sans-serif]" style={{ background: t.bg }}>
        <SharedNav />
        <main className="flex-1 py-12 px-6 pb-20 max-w-[900px] mx-auto w-full">

          <div className="mb-10">
            <span className="text-xs font-semibold tracking-[2px] uppercase block mb-3" style={{ color: accent }}>Pricing</span>
            <h1 className="text-[clamp(28px,5vw,40px)] font-semibold mb-2 leading-tight" style={{ color: t.text }}>Transparent <span className="serif italic font-medium text-[clamp(32px,5.5vw,44px)]" style={{ color: accent }}>Naira</span> Pricing</h1>
            <p className="text-[15px] leading-relaxed max-w-[520px]" style={{ color: t.textSoft }}>No hidden fees, no dollar conversion. Pay per 1,000 in Naira. Prices vary by service tier and quality.</p>
          </div>

          {platforms.length === 0 ? (
            <div className="text-center py-16" style={{ color: t.textMuted }}>Pricing data loading...</div>
          ) : (
            <>
              {/* Platform pills */}
              <div className="flex flex-wrap gap-2 mb-8">
                <button onClick={() => setActive(null)} className="py-[7px] px-4 rounded-lg text-[13px] font-semibold cursor-pointer transition-all duration-200" style={{ background: active === null ? accent : (dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.04)"), color: active === null ? "#fff" : t.textSoft, border: `1px solid ${active === null ? accent : border}` }}>All Platforms</button>
                {platforms.map(p => (
                  <button key={p.platform} onClick={() => setActive(p.platform)} className="py-[7px] px-4 rounded-lg text-[13px] font-semibold cursor-pointer transition-all duration-200 flex items-center gap-2" style={{ background: active === p.platform ? accent : (dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.04)"), color: active === p.platform ? "#fff" : t.textSoft, border: `1px solid ${active === p.platform ? accent : border}` }}>
                    <PlatformIcon name={p.platform} color={active === p.platform ? "#fff" : t.textMuted} />
                    {p.platform}
                  </button>
                ))}
              </div>

              {/* Platform cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {platforms.filter(p => !active || p.platform === active).map(p => (
                  <div key={p.platform} className="rounded-2xl overflow-hidden" style={{ background: dark ? "rgba(255,255,255,.06)" : "#fff", border: `1px solid ${border}` }}>
                    <div className="flex items-center gap-3 py-4 px-5" style={{ borderBottom: `1px solid ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.06)"}` }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: dark ? "rgba(196,125,142,.12)" : "rgba(196,125,142,.08)" }}>
                        <PlatformIcon name={p.platform} color={accent} />
                      </div>
                      <div>
                        <div className="text-[15px] font-semibold" style={{ color: t.text }}>{p.platform}</div>
                        <div className="text-[12px]" style={{ color: t.textMuted }}>{p.services.length} service{p.services.length !== 1 ? 's' : ''} available</div>
                      </div>
                    </div>
                    <div className="px-5 py-3">
                      {p.services.map((s, i) => (
                        <div key={s.type} className="flex items-center justify-between py-2.5" style={{ borderBottom: i < p.services.length - 1 ? `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}` : undefined }}>
                          <div>
                            <div className="text-[14px] font-medium" style={{ color: t.text }}>{s.type}</div>
                            <div className="text-[11px] flex items-center gap-2" style={{ color: t.textMuted }}>
                              {s.tiers > 1 && <span>{s.tiers} tiers</span>}
                              {s.refill && <span className="inline-flex items-center gap-0.5"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>Refill</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[14px] font-semibold" style={{ color: accent }}>
                              {s.minPrice === s.maxPrice ? `₦${s.minPrice.toLocaleString()}` : `₦${s.minPrice.toLocaleString()} – ${s.maxPrice.toLocaleString()}`}
                            </div>
                            <div className="text-[11px]" style={{ color: t.textMuted }}>per 1,000</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* CTA */}
          <div className="mt-12 p-6 rounded-[14px] text-center" style={{ background: dark ? "rgba(196,125,142,.08)" : "rgba(196,125,142,.06)", border: `1px solid ${dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.14)"}` }}>
            <p className="text-[15px] mb-1 font-semibold" style={{ color: t.text }}>Ready to grow?</p>
            <p className="text-sm mb-4" style={{ color: t.textSoft }}>Create a free account and place your first order in under a minute.</p>
            <a href="/signup" className="inline-flex items-center gap-2 py-3 px-7 rounded-[10px] bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b] text-white text-sm font-semibold no-underline transition-[transform,box-shadow] duration-200 hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(196,125,142,.31)]">Create free account</a>
          </div>

        </main>
        <SharedFooter />
      </div>
    </>
  );
}
