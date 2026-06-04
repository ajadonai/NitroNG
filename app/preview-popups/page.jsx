'use client';
import { useState } from 'react';

const ACCENT = '#c47d8e';

const POPUPS = [
  {
    id: 1,
    location: 'New Order → Before First Order Submit',
    trigger: 'First-time order placement',
    priority: 'Must-have',
    type: 'modal',
    render: (dark) => (
      <ModalMock dark={dark} title="Before you place your order" cta="Got it, place my order">
        <Tip dark={dark} icon="🔒" title="Your account is safe">
          We never ask for your password. All we need is your public link — your account won't be affected.
        </Tip>
        <Tip dark={dark} icon="⏳" title="Delivery is gradual">
          Orders are delivered gradually over minutes to hours, not all at once. This keeps things natural and safe for your account.
        </Tip>
        <Tip dark={dark} icon="📉" title="Small drops are normal">
          Platforms regularly clean up inactive accounts. If your count drops slightly, that's normal — it's not a problem with your order.
        </Tip>
        <Tip dark={dark} icon="🔄" title="Refill services have you covered">
          If you picked a Standard or Premium tier, we'll automatically top you back up if any drop happens. No action needed from you.
        </Tip>
      </ModalMock>
    ),
  },
  {
    id: 2,
    location: 'New Order → Tier Selection Tooltip',
    trigger: 'User taps info icon next to tier chips',
    priority: 'Must-have',
    type: 'tooltip / bottom sheet',
    render: (dark) => (
      <TooltipMock dark={dark} title="What do the tiers mean?">
        <TierRow dark={dark} color="#854F0B" bg={dark ? "#2d2210" : "#fef7ed"} tier="Budget" icon="🛡️"
          desc="Cheapest option. No refill — if the count drops, it stays dropped. Best for one-time boosts where you don't need long-term retention." />
        <TierRow dark={dark} color="#185FA5" bg={dark ? "#0f1e30" : "#eef4fb"} tier="Standard" icon="⚡"
          desc="Mid-range. Comes with a free top-up if the count drops during the refill window (usually 30 days). Great for most people." />
        <TierRow dark={dark} color="#534AB7" bg={dark ? "#221535" : "#f5eef5"} tier="Premium" icon="👑"
          desc="Highest quality accounts with lifetime guarantee. If the count ever drops, we refill it forever. Best for profiles you're building long-term." />
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.08)', fontSize: 13, color: dark ? '#e0c0c8' : '#8a4a5a', lineHeight: 1.5 }}>
          💡 With platforms actively removing fake accounts, we recommend <strong>Standard or Premium</strong> for anything you want to keep long-term.
        </div>
      </TooltipMock>
    ),
  },
  {
    id: 3,
    location: 'New Order → Link Input Helper',
    trigger: 'User focuses the link input field',
    priority: 'Should-have',
    type: 'inline callout',
    render: (dark) => (
      <InlineCallout dark={dark}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: dark ? '#fff' : '#1a1a1a' }}>Paste the right link</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: dark ? '#aaa' : '#555' }}>
          <strong>For followers:</strong> paste your <em>profile</em> link<br />
          <span style={{ color: dark ? '#666' : '#999', fontSize: 12 }}>e.g. instagram.com/yourname</span>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: dark ? '#aaa' : '#555', marginTop: 6 }}>
          <strong>For likes & views:</strong> paste the <em>post or video</em> link<br />
          <span style={{ color: dark ? '#666' : '#999', fontSize: 12 }}>e.g. instagram.com/p/ABC123 or tiktok.com/@user/video/123</span>
        </div>
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: dark ? 'rgba(234,179,8,.1)' : 'rgba(234,179,8,.08)', fontSize: 12, color: dark ? '#fbbf24' : '#92400e' }}>
          ⚠️ Wrong link type is the #1 reason orders get cancelled. Double-check before submitting!
        </div>
      </InlineCallout>
    ),
  },
  {
    id: 4,
    location: 'Order Completed → Status Card',
    trigger: 'User views a completed order',
    priority: 'Must-have',
    type: 'dismissible banner inside order details',
    render: (dark) => (
      <StatusBanner dark={dark} color="#22c55e" bg={dark ? 'rgba(34,197,94,.1)' : 'rgba(34,197,94,.06)'} icon="✅">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Your order is complete!</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.85 }}>
          If you notice a small dip in the next few days, don't worry — platforms routinely clean up inactive accounts and it's completely normal.
          {' '}<strong>Services with refill will top you back up automatically.</strong>
        </div>
      </StatusBanner>
    ),
  },
  {
    id: 5,
    location: 'Order Partial → Status Card',
    trigger: 'User views a partial order',
    priority: 'Must-have',
    type: 'info banner inside order details',
    render: (dark) => (
      <StatusBanner dark={dark} color="#f59e0b" bg={dark ? 'rgba(245,158,11,.1)' : 'rgba(245,158,11,.06)'} icon="⏸️">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Partial delivery</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.85 }}>
          Part of your order has been delivered and the rest has been refunded to your wallet. This usually happens when a provider runs out of capacity mid-delivery — it's not an error.
          You can use the refunded balance to place a new order anytime.
        </div>
      </StatusBanner>
    ),
  },
  {
    id: 6,
    location: 'Pricing Page → Top Banner',
    trigger: 'User visits pricing/services page',
    priority: 'Should-have',
    type: 'dismissible banner',
    render: (dark) => (
      <StatusBanner dark={dark} color={ACCENT} bg={dark ? 'rgba(196,125,142,.1)' : 'rgba(196,125,142,.06)'} icon="💡">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Choosing the right tier matters</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.85 }}>
          Social platforms are getting better at removing fake accounts. <strong>Budget</strong> is great for a quick boost, but if you want followers that stick, go with <strong>Standard</strong> (30-day refill) or <strong>Premium</strong> (lifetime guarantee). The small price difference pays for itself.
        </div>
      </StatusBanner>
    ),
  },
  {
    id: 7,
    location: 'Dashboard → First Visit / Periodic',
    trigger: 'First dashboard visit or once every 30 days',
    priority: 'Should-have',
    type: 'dismissible card',
    render: (dark) => (
      <DashCard dark={dark} title="How growth services work">
        <Tip dark={dark} icon="🌱" title="It's a gradual process">
          We deliver followers, likes, and views from real accounts over time — not all at once. This protects your account and looks natural.
        </Tip>
        <Tip dark={dark} icon="🧹" title="Platforms do routine cleanups">
          Instagram, TikTok, and others regularly remove inactive accounts from everyone's follower lists. This isn't unique to growth services — it happens to organic followers too.
        </Tip>
        <Tip dark={dark} icon="🛡️" title="Refill is your safety net">
          Standard and Premium tiers include automatic refills. If a cleanup hits your count, we top you back up at no extra cost.
        </Tip>
        <Tip dark={dark} icon="🎯" title="Pro tip">
          Combine growth services with your own content strategy. Accounts that post regularly retain followers much better than inactive ones.
        </Tip>
      </DashCard>
    ),
  },
  {
    id: 8,
    location: 'Add Funds → Payment Method Info',
    trigger: 'User opens wallet/add funds page',
    priority: 'Nice-to-have',
    type: 'inline helper',
    render: (dark) => (
      <InlineCallout dark={dark}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: dark ? '#fff' : '#1a1a1a' }}>Payment methods</div>
        <PaymentRow dark={dark} icon="💳" method="Card / Bank Transfer" detail="Instant · Powered by Flutterwave · No extra fees" />
        <PaymentRow dark={dark} icon="🪙" method="Crypto (USDT, BTC, etc.)" detail="Usually confirms in 5–30 mins depending on network" />
        <PaymentRow dark={dark} icon="🏦" method="Direct Bank Transfer" detail="Send to our account · Confirmed within minutes during business hours" />
      </InlineCallout>
    ),
  },
];

function ModalMock({ dark, title, cta, children }) {
  const bg = dark ? '#1a1a2e' : '#fff';
  const border = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)';
  return (
    <div style={{ background: bg, borderRadius: 16, border: `1px solid ${border}`, padding: '24px 20px', maxWidth: 440 }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: dark ? '#fff' : '#1a1a1a' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
      <button style={{ marginTop: 20, width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{cta}</button>
    </div>
  );
}

function Tip({ dark, icon, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: dark ? '#e0e0e0' : '#1a1a1a', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: dark ? '#999' : '#555' }}>{children}</div>
      </div>
    </div>
  );
}

function TooltipMock({ dark, title, children }) {
  const bg = dark ? '#1a1a2e' : '#fff';
  const border = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)';
  return (
    <div style={{ background: bg, borderRadius: 14, border: `1px solid ${border}`, padding: '18px 16px', maxWidth: 420 }}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: dark ? '#fff' : '#1a1a1a' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function TierRow({ dark, color, bg, tier, icon, desc }) {
  return (
    <div style={{ padding: '10px 14px', borderRadius: 10, background: bg }}>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 4 }}>{icon} {tier}</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: dark ? '#aaa' : '#555' }}>{desc}</div>
    </div>
  );
}

function InlineCallout({ dark, children }) {
  const bg = dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)';
  const border = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)';
  return (
    <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: '16px 18px', maxWidth: 420 }}>
      {children}
    </div>
  );
}

function StatusBanner({ dark, color, bg, icon, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 12, background: bg, border: `1px solid ${color}22`, maxWidth: 480 }}>
      <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>{icon}</span>
      <div style={{ color: dark ? '#ddd' : '#333' }}>{children}</div>
    </div>
  );
}

function DashCard({ dark, title, children }) {
  const bg = dark ? '#1a1a2e' : '#fff';
  const border = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)';
  return (
    <div style={{ background: bg, borderRadius: 14, border: `1px solid ${border}`, padding: '20px 18px', maxWidth: 460 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: dark ? '#fff' : '#1a1a1a' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
      <button style={{ marginTop: 18, padding: '8px 16px', borderRadius: 8, border: `1px solid ${dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.1)'}`, background: 'none', color: dark ? '#aaa' : '#666', fontSize: 13, cursor: 'pointer' }}>Dismiss</button>
    </div>
  );
}

function PaymentRow({ dark, icon, method, detail }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)'}` }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: dark ? '#e0e0e0' : '#1a1a1a' }}>{method}</div>
        <div style={{ fontSize: 12, color: dark ? '#777' : '#888', marginTop: 2 }}>{detail}</div>
      </div>
    </div>
  );
}

const PRIORITY_COLORS = {
  'Must-have': { bg: '#dc262622', text: '#dc2626' },
  'Should-have': { bg: '#f59e0b22', text: '#f59e0b' },
  'Nice-to-have': { bg: '#22c55e22', text: '#22c55e' },
};

export default function PreviewPopups() {
  const [dark, setDark] = useState(true);
  const bg = dark ? '#0a0a1a' : '#f5f3ee';
  const text = dark ? '#e0e0e0' : '#1a1a1a';
  const muted = dark ? '#777' : '#888';

  return (
    <div style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'Outfit, system-ui, sans-serif', padding: '40px 20px 80px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Popup Preview</h1>
            <p style={{ fontSize: 14, color: muted, marginTop: 6 }}>Review all proposed educational popups. Delete this page before shipping.</p>
          </div>
          <button onClick={() => setDark(!dark)} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${dark ? 'rgba(255,255,255,.15)' : 'rgba(0,0,0,.12)'}`, background: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.04)', color: text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {dark ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        {POPUPS.map((p) => {
          const pc = PRIORITY_COLORS[p.priority];
          return (
            <div key={p.id} style={{ marginBottom: 48 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: text }}>#{p.id}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: pc.bg, color: pc.text }}>{p.priority}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)', color: muted }}>{p.type}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: text, marginBottom: 4 }}>{p.location}</div>
              <div style={{ fontSize: 12, color: muted, marginBottom: 14 }}>Trigger: {p.trigger}</div>
              {p.render(dark)}
            </div>
          );
        })}

        <div style={{ marginTop: 60, padding: '20px', borderRadius: 12, border: `1px solid ${dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)'}`, background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: text }}>Implementation notes</div>
          <ul style={{ fontSize: 13, lineHeight: 1.8, color: muted, paddingLeft: 20, margin: 0 }}>
            <li><strong>#1</strong> shows only on first order (tracked in localStorage)</li>
            <li><strong>#2</strong> shows when tapping an info icon next to tier chips</li>
            <li><strong>#3</strong> shows inline when user focuses the link input</li>
            <li><strong>#4 & #5</strong> show inside expanded order details, dismissible per order</li>
            <li><strong>#6</strong> shows once on pricing page (dismissible, localStorage)</li>
            <li><strong>#7</strong> shows on first dashboard visit, then once every 30 days</li>
            <li><strong>#8</strong> shows inline on the add funds page (always visible)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
