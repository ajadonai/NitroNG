'use client';
import { useState } from 'react';

const accent = '#c47d8e';

const mockOrders = {
  followers: {
    id: 'NTR-347', platform: 'Instagram', service: 'Instagram Followers',
    tier: 'Premium', quantity: 5000, charge: 12500, speed: '0-6 hours',
    link: 'instagram.com/nitro.ng', balanceAfter: 37500,
  },
  comments: {
    id: 'NTR-351', platform: 'Instagram', service: 'Instagram Comments',
    tier: 'Standard', quantity: 50, charge: 3500, speed: '1-3 hours',
    link: 'instagram.com/p/Cx8kL2mNq4r', balanceAfter: 46500,
  },
  likes: {
    id: 'NTR-355', platform: 'TikTok', service: 'TikTok Likes',
    tier: 'Budget', quantity: 1000, charge: 1800, speed: '0-2 hours',
    link: 'tiktok.com/@nitro/video/72819364', balanceAfter: 23200,
  },
  views: {
    id: 'NTR-360', platform: 'YouTube', service: 'YouTube Views',
    tier: 'Standard', quantity: 10000, charge: 8500, speed: '0-12 hours',
    link: 'youtube.com/watch?v=dQw4w9WgXcQ', balanceAfter: 11500,
  },
};
const mockOrder = mockOrders.followers;

const tierStyles = {
  Budget: { text: '#e0a458', bg: 'rgba(224,164,88,.1)', label: 'No refill' },
  Standard: { text: '#60a5fa', bg: 'rgba(96,165,250,.1)', label: 'Free top-up if count drops' },
  Premium: { text: '#a78bfa', bg: 'rgba(167,139,250,.1)', label: 'Auto-refill if count drops' },
};

const PlatIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);

/* ═══ CURRENT DESIGN (for comparison) ═══ */
function CurrentDesign({ dark, t }) {
  const o = mockOrder;
  return (
    <div className="p-6 max-md:p-5 text-center">
      <div className="relative w-16 h-16 mx-auto mb-4">
        <div className="relative w-16 h-16 rounded-full flex items-center justify-center" style={{ background: dark ? 'rgba(110,231,183,.1)' : 'rgba(5,150,105,.08)' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={dark ? '#6ee7b7' : '#059669'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
      </div>
      <div className="text-xl font-semibold mb-1" style={{ color: t.text }}>Order placed!</div>
      <div className="text-sm mb-5" style={{ color: t.textMuted }}>Your order is being processed. Estimated delivery: {o.speed}.</div>
      <div className="rounded-xl overflow-hidden mb-5 text-left" style={{ border: `1px solid ${t.cardBorder}` }}>
        <div className="py-2 px-4 text-[11px] font-semibold uppercase tracking-[1.5px]" style={{ background: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.03)', color: t.textMuted, borderBottom: `1px solid ${t.cardBorder}` }}>Order summary</div>
        {[['Order ID', o.id], ['Platform', o.platform], ['Service', o.service], ['Quantity', o.quantity.toLocaleString()], ['Est. delivery', o.speed], ['Charged', `₦${o.charge.toLocaleString()}`]].map(([label, val], i, arr) => (
          <div key={label} className="flex justify-between py-2.5 px-4 text-sm" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : 'none' }}>
            <span style={{ color: t.textMuted }}>{label}</span>
            <span className="font-medium" style={{ color: label === 'Charged' ? (dark ? '#6ee7b7' : '#059669') : t.text }}>{val}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <button className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold border border-solid cursor-pointer" style={{ background: 'transparent', borderColor: t.cardBorder, color: t.text }}>Place another</button>
        <button className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold border-none cursor-pointer" style={{ background: accent, color: '#fff' }}>View orders</button>
      </div>
    </div>
  );
}

/* ═══ Cross-sell spotlight data ═══ */
const crossSells = {
  followers: {
    title: 'Complete the look',
    body: 'New followers check your posts first. Add likes so your content looks as popular as your profile.',
    cta: 'Add Likes',
    suggest: 'Likes',
    color: '#f43f5e',
    icon: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill={c} stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  },
  comments: {
    title: 'Pair it with Likes',
    body: 'Comments without likes look odd. Add likes to match and make your engagement look natural.',
    cta: 'Add Likes',
    suggest: 'Likes',
    color: '#f43f5e',
    icon: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill={c} stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  },
  likes: {
    title: 'Make it convincing',
    body: 'Likes are great but comments seal the deal. A few comments make your post look genuinely popular.',
    cta: 'Add Comments',
    suggest: 'Comments',
    color: '#3b82f6',
    icon: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  },
  views: {
    title: 'Boost the engagement',
    body: 'High views + low likes looks suspicious. Add likes so the numbers tell the right story.',
    cta: 'Add Likes',
    suggest: 'Likes',
    color: '#f43f5e',
    icon: (c) => <svg width="16" height="16" viewBox="0 0 24 24" fill={c} stroke="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  },
};

function getCrossSell(serviceName) {
  const lower = serviceName.toLowerCase();
  if (lower.includes('follower')) return crossSells.followers;
  if (lower.includes('comment')) return crossSells.comments;
  if (lower.includes('like')) return crossSells.likes;
  if (lower.includes('view')) return crossSells.views;
  return crossSells.followers;
}

/* ═══ OPTION A: Compact receipt with cross-sell ═══ */
function OptionA({ dark, t, order }) {
  const o = order || mockOrder;
  const ts = tierStyles[o.tier];
  const spot = getCrossSell(o.service);
  const subBg = dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)';
  const subBorder = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.04)';
  return (
    <div className="p-5 max-md:p-4">
      {/* Header — icon + title + check */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.04)', color: t.textMuted }}>
          <PlatIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold" style={{ color: t.text }}>Order placed!</div>
          <div className="text-[11px]" style={{ color: t.textMuted }}>Est. delivery: {o.speed}</div>
        </div>
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: dark ? 'rgba(110,231,183,.1)' : 'rgba(5,150,105,.08)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? '#6ee7b7' : '#059669'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>

      {/* Service + tier + link in one card */}
      <div className="rounded-xl p-3 mb-3" style={{ background: subBg, border: `1px solid ${subBorder}` }}>
        <div className="text-[13px] font-semibold mb-1" style={{ color: t.text }}>{o.service}</div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-semibold py-0.5 px-1.5 rounded" style={{ background: ts.bg, color: ts.text }}>{o.tier}</span>
          <span className="text-[10px]" style={{ color: t.textMuted }}>{ts.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
          <span className="text-[11px] truncate" style={{ color: t.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{o.link}</span>
        </div>
      </div>

      {/* Numbers — 3-col grid */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {[
          ['Qty', o.quantity.toLocaleString(), t.text],
          ['Charged', `₦${o.charge.toLocaleString()}`, dark ? '#fca5a5' : '#dc2626'],
          ['Balance', `₦${o.balanceAfter.toLocaleString()}`, dark ? '#6ee7b7' : '#059669'],
        ].map(([label, val, clr]) => (
          <div key={label} className="rounded-lg py-2 px-1.5 text-center" style={{ background: subBg, border: `1px solid ${subBorder}` }}>
            <div className="text-[9px] uppercase tracking-[.5px] mb-0.5" style={{ color: t.textMuted }}>{label}</div>
            <div className="text-[13px] font-bold" style={{ color: clr, fontFamily: label !== 'Qty' ? "'JetBrains Mono', monospace" : undefined }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Order ID — inline */}
      <div className="flex items-center justify-between py-1.5 px-3 rounded-lg mb-3" style={{ background: dark ? 'rgba(196,125,142,.05)' : 'rgba(196,125,142,.03)', border: `1px solid ${dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.08)'}` }}>
        <span className="text-[11px]" style={{ color: t.textMuted }}>Order ID</span>
        <span className="text-[11px] font-bold" style={{ color: accent, fontFamily: "'JetBrains Mono', monospace" }}>{o.id}</span>
      </div>

      {/* Cross-sell — compact single-line */}
      <div className="flex items-center gap-2.5 rounded-lg py-2.5 px-3 mb-4" style={{ background: subBg, border: `1px solid ${subBorder}` }}>
        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)' }}>
          {spot.icon(spot.color)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold" style={{ color: t.text }}>{spot.title}</div>
          <div className="text-[10px] leading-snug" style={{ color: t.textMuted }}>{spot.body}</div>
        </div>
        <span className="text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer" style={{ color: spot.color }}>{spot.cta} &rarr;</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2.5">
        <button className="flex-1 py-2 rounded-[10px] text-[13px] font-semibold border border-solid cursor-pointer" style={{ background: 'transparent', borderColor: t.cardBorder, color: t.text }}>Place another</button>
        <button className="flex-1 py-2 rounded-[10px] text-[13px] font-semibold border-none cursor-pointer" style={{ background: accent, color: '#fff' }}>View orders</button>
      </div>
    </div>
  );
}

/* ═══ OPTION B: Compact with prominent charge ═══ */
function OptionB({ dark, t }) {
  const o = mockOrder;
  const ts = tierStyles[o.tier];
  return (
    <div className="p-6 max-md:p-5 text-center">
      {/* Success icon with platform */}
      <div className="relative w-[72px] h-[72px] mx-auto mb-4">
        <div className="w-full h-full rounded-2xl flex items-center justify-center" style={{ background: dark ? 'rgba(110,231,183,.08)' : 'rgba(5,150,105,.06)', border: `2px solid ${dark ? 'rgba(110,231,183,.2)' : 'rgba(5,150,105,.15)'}` }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={dark ? '#6ee7b7' : '#059669'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: dark ? '#1a1f2e' : '#fff', border: `1.5px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)'}`, color: t.textMuted }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
        </div>
      </div>

      <div className="text-lg font-semibold mb-0.5" style={{ color: t.text }}>Order placed!</div>
      <div className="text-xs mb-4" style={{ color: t.textMuted }}>{o.service} &middot; {o.tier}</div>

      {/* Big charge */}
      <div className="rounded-2xl py-4 px-5 mb-4" style={{ background: dark ? 'rgba(196,125,142,.06)' : 'rgba(196,125,142,.04)', border: `1px solid ${dark ? 'rgba(196,125,142,.15)' : 'rgba(196,125,142,.1)'}` }}>
        <div className="text-3xl font-bold mb-1" style={{ color: accent, fontFamily: "'JetBrains Mono', monospace" }}>₦{o.charge.toLocaleString()}</div>
        <div className="text-xs" style={{ color: t.textMuted }}>{o.quantity.toLocaleString()} {o.service.split(' ').pop().toLowerCase()} &middot; Wallet balance: ₦{o.balanceAfter.toLocaleString()}</div>
      </div>

      {/* Details */}
      <div className="rounded-xl overflow-hidden mb-4 text-left" style={{ border: `1px solid ${t.cardBorder}` }}>
        {[
          ['Order ID', o.id, { fontFamily: "'JetBrains Mono', monospace", color: accent }],
          ['Link', o.link, { fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }],
          ['Delivery', o.speed, {}],
          ['Refill', ts.label, { color: ts.text, fontSize: 12 }],
        ].map(([label, val, style], i, arr) => (
          <div key={label} className="flex justify-between items-center py-2.5 px-4 gap-3" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : 'none' }}>
            <span className="text-xs shrink-0" style={{ color: t.textMuted }}>{label}</span>
            <span className="text-sm font-medium text-right truncate" style={{ color: t.text, ...style }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold border border-solid cursor-pointer" style={{ background: 'transparent', borderColor: t.cardBorder, color: t.text }}>Place another</button>
        <button className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold border-none cursor-pointer" style={{ background: accent, color: '#fff' }}>View orders</button>
      </div>
    </div>
  );
}

/* ═══ OPTION C: Timeline / progress-oriented ═══ */
function OptionC({ dark, t }) {
  const o = mockOrder;
  const ts = tierStyles[o.tier];
  const green = dark ? '#6ee7b7' : '#059669';
  return (
    <div className="p-6 max-md:p-5">
      {/* Header */}
      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full mb-3" style={{ background: dark ? 'rgba(110,231,183,.08)' : 'rgba(5,150,105,.05)', border: `1px solid ${dark ? 'rgba(110,231,183,.15)' : 'rgba(5,150,105,.1)'}` }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          <span className="text-xs font-semibold" style={{ color: green }}>Order confirmed</span>
        </div>
        <div className="text-xl font-semibold mb-1" style={{ color: t.text }}>{o.quantity.toLocaleString()} {o.service.split(' ').pop()}</div>
        <div className="text-sm" style={{ color: t.textMuted }}>{o.service} &middot; <span style={{ color: ts.text }}>{o.tier}</span></div>
      </div>

      {/* Mini timeline */}
      <div className="flex items-center gap-0 mb-5 px-2">
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: dark ? 'rgba(110,231,183,.12)' : 'rgba(5,150,105,.08)', border: `2px solid ${green}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={green} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span className="text-[9px] font-semibold" style={{ color: green }}>Placed</span>
        </div>
        <div className="flex-1 h-[2px] -mt-3" style={{ background: `linear-gradient(90deg, ${green}, ${dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.1)'})` }} />
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: dark ? 'rgba(196,125,142,.1)' : 'rgba(196,125,142,.06)', border: `2px solid ${accent}` }}>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accent }} />
          </div>
          <span className="text-[9px] font-semibold" style={{ color: accent }}>Processing</span>
        </div>
        <div className="flex-1 h-[2px] -mt-3" style={{ background: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)' }} />
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)', border: `2px solid ${dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)'}` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.15)'} strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span className="text-[9px] font-medium" style={{ color: t.textMuted }}>Done</span>
        </div>
      </div>

      {/* Receipt card */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ border: `1px solid ${t.cardBorder}` }}>
        {/* Link row */}
        <div className="py-2.5 px-4 flex items-center gap-2" style={{ background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)', borderBottom: `1px solid ${t.cardBorder}` }}>
          <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.04)', color: t.textMuted }}>
            <PlatIcon />
          </div>
          <span className="text-xs truncate" style={{ color: t.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{o.link}</span>
        </div>

        {/* Numbers */}
        <div className="grid grid-cols-2" style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
          <div className="py-3 px-4 text-center" style={{ borderRight: `1px solid ${t.cardBorder}` }}>
            <div className="text-[10px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Charged</div>
            <div className="text-base font-bold" style={{ color: accent, fontFamily: "'JetBrains Mono', monospace" }}>₦{o.charge.toLocaleString()}</div>
          </div>
          <div className="py-3 px-4 text-center">
            <div className="text-[10px] uppercase tracking-[1px] mb-1" style={{ color: t.textMuted }}>Balance left</div>
            <div className="text-base font-bold" style={{ color: dark ? '#6ee7b7' : '#059669', fontFamily: "'JetBrains Mono', monospace" }}>₦{o.balanceAfter.toLocaleString()}</div>
          </div>
        </div>

        {/* Details */}
        {[
          ['Order ID', o.id],
          ['Delivery', o.speed],
          ['Refill', ts.label],
        ].map(([label, val], i, arr) => (
          <div key={label} className="flex justify-between py-2.5 px-4 text-sm" style={{ borderBottom: i < arr.length - 1 ? `1px solid ${t.cardBorder}` : 'none' }}>
            <span className="text-xs" style={{ color: t.textMuted }}>{label}</span>
            <span className="text-xs font-medium" style={{ color: label === 'Refill' ? ts.text : label === 'Order ID' ? accent : t.text, fontFamily: label === 'Order ID' ? "'JetBrains Mono', monospace" : undefined }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold border border-solid cursor-pointer" style={{ background: 'transparent', borderColor: t.cardBorder, color: t.text }}>Place another</button>
        <button className="flex-1 py-2.5 rounded-[10px] text-sm font-semibold border-none cursor-pointer" style={{ background: accent, color: '#fff' }}>View orders</button>
      </div>
    </div>
  );
}

export default function PreviewReceipt() {
  const [dark, setDark] = useState(true);

  const t = dark ? {
    text: '#eae7e2', textSoft: '#c4bfb8', textMuted: '#8a8580',
    cardBg: '#131728', cardBorder: 'rgba(255,255,255,.12)',
    accent: '#c47d8e', green: '#6ee7b7',
  } : {
    text: '#1a1a1a', textSoft: '#444', textMuted: '#8a8785',
    cardBg: '#fff', cardBorder: 'rgba(0,0,0,.1)',
    accent: '#c47d8e', green: '#059669',
  };

  const cardStyle = {
    background: dark ? '#0e1120' : '#ffffff',
    border: `1px solid ${t.cardBorder}`,
    borderRadius: 16,
    overflow: 'hidden',
    maxWidth: 420,
    width: '100%',
  };

  return (
    <div style={{ minHeight: '100vh', background: dark ? '#080a14' : '#f3f1ee', padding: '40px 16px', fontFamily: "'Outfit', sans-serif" }}>
      <div className="flex items-center justify-between max-w-[900px] mx-auto mb-8">
        <h1 className="text-2xl font-bold" style={{ color: t.text }}>Order Receipt — Design Options</h1>
        <button onClick={() => setDark(!dark)} className="py-2 px-4 rounded-lg text-sm font-semibold cursor-pointer border border-solid" style={{ background: 'transparent', borderColor: t.cardBorder, color: t.text }}>
          {dark ? 'Light mode' : 'Dark mode'}
        </button>
      </div>

      <div className="max-w-[900px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Bought Followers → suggests Likes */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-[2px] mb-3 px-1" style={{ color: accent }}>Bought Followers &rarr; suggests Likes</div>
          <div style={cardStyle}><OptionA dark={dark} t={t} order={mockOrders.followers} /></div>
        </div>

        {/* Bought Comments → suggests Likes */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-[2px] mb-3 px-1" style={{ color: accent }}>Bought Comments &rarr; suggests Likes</div>
          <div style={cardStyle}><OptionA dark={dark} t={t} order={mockOrders.comments} /></div>
        </div>

        {/* Bought Likes → suggests Comments */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-[2px] mb-3 px-1" style={{ color: accent }}>Bought Likes &rarr; suggests Comments</div>
          <div style={cardStyle}><OptionA dark={dark} t={t} order={mockOrders.likes} /></div>
        </div>

        {/* Bought Views → suggests Likes */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-[2px] mb-3 px-1" style={{ color: accent }}>Bought Views &rarr; suggests Likes</div>
          <div style={cardStyle}><OptionA dark={dark} t={t} order={mockOrders.views} /></div>
        </div>
      </div>
    </div>
  );
}
