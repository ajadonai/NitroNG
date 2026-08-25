'use client';
import { useState, useCallback } from 'react';
import { ThemeProvider, useTheme } from './shared-nav';
import { useToast } from './toast';

export default function PanelManagerView() {
  return <ThemeProvider><PanelManagerInner /></ThemeProvider>;
}

export function PanelManagerDashboard({ dark, t, onNavigate }) {
  return <PanelManagerInner dark={dark} t={t} onNavigate={onNavigate} />;
}

export function PanelManagerSidebar({ dark, t, onNavigate }) {
  return (
    <div className="flex flex-col gap-0">
      <div className="rpm-sb-head text-t-text-muted" style={{ background: dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.08)' }}>Panel Manager</div>
      {[
        ['Overview', 'overview'],
        ['Branding', 'branding'],
        ['Services', 'services'],
        ['Pricing', 'pricing'],
        ['Features', 'features'],
        ['Customers', 'customers'],
        ['Payments', 'payments'],
      ].map(([title, id]) => (
        <div key={id} className="rpm-sb-item" style={{ background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.02)' }}>
          <div className="text-sm font-medium mb-0.5 text-t-text">{title}</div>
        </div>
      ))}
      <div className="rpm-sb-head mt-2 text-t-text-muted" style={{ background: dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.08)' }}>Navigation</div>
      <div className="rpm-sb-item" style={{ background: dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.02)', cursor: onNavigate ? 'pointer' : undefined }} onClick={onNavigate ? () => onNavigate('lab') : undefined}>
        <div className="text-sm font-medium mb-0.5 text-t-text">Back to Reseller Lab</div>
        <div className="text-xs text-t-text-muted">Return to lab overview</div>
      </div>
    </div>
  );
}

const N = n => '₦' + Math.round(n).toLocaleString('en-US');

const CURATED_CATALOG = [
  { platform: 'Instagram', groups: [
    { name: 'Followers', tiers: [{ tier: 'Standard', cost: 2720 }, { tier: 'Premium', cost: 4100 }] },
    { name: 'Followers', nigerian: true, tiers: [{ tier: 'Standard', cost: 3200 }, { tier: 'Premium', cost: 4800 }] },
    { name: 'Likes', tiers: [{ tier: 'Premium', cost: 1150 }] },
    { name: 'Views', tiers: [{ tier: 'Standard', cost: 380 }] },
  ]},
  { platform: 'TikTok', groups: [
    { name: 'Followers', tiers: [{ tier: 'Standard', cost: 3100 }] },
    { name: 'Likes', tiers: [{ tier: 'Standard', cost: 680 }] },
    { name: 'Views', tiers: [{ tier: 'Standard', cost: 520 }] },
  ]},
  { platform: 'YouTube', groups: [
    { name: 'Subscribers', tiers: [{ tier: 'Standard', cost: 7150 }] },
    { name: 'Views', tiers: [{ tier: 'Standard', cost: 420 }] },
  ]},
  { platform: 'Spotify', groups: [
    { name: 'Plays', tiers: [{ tier: 'Standard', cost: 290 }] },
  ]},
  { platform: 'X (Twitter)', groups: [
    { name: 'Followers', tiers: [{ tier: 'Standard', cost: 3400 }] },
  ]},
];

const PROVIDER_CATALOG = [
  { id: 'p-101', platform: 'Instagram', name: 'Followers [R1] [Max: 1M] [Start: 0-1h] [Speed: 50K/day]', desc: 'Real-looking accounts with profile pictures and posts. Gradual delivery over 24-48h.', cost: 2720, min: 100, max: '1M', speed: '50K/day', refill: '30 days' },
  { id: 'p-102', platform: 'Instagram', name: 'Followers [HQ] [Max: 500K] [Refill: 30d]', desc: 'High-quality followers with bios, photos and recent activity. Slower but more realistic.', cost: 4100, min: 50, max: '500K', speed: '20K/day', refill: '30 days' },
  { id: 'p-103', platform: 'Instagram', name: 'Followers [Real Mixed] [Max: 100K] [Refill: 60d]', desc: 'Mix of real and high-quality accounts. Best retention rate in catalog.', cost: 5800, min: 50, max: '100K', speed: '10K/day', refill: '60 days' },
  { id: 'p-104', platform: 'Instagram', name: 'Likes [Real] [Max: 50K] [Refill: 30d]', desc: 'Likes from real accounts with activity history. Refill guaranteed.', cost: 1150, min: 50, max: '50K', speed: '30K/day', refill: '30 days' },
  { id: 'p-105', platform: 'Instagram', name: 'Likes [Premium] [Max: 200K] [Speed: 100K/day]', desc: 'Fast premium likes. Ideal for boosting new posts within hours.', cost: 1680, min: 100, max: '200K', speed: '100K/day', refill: null },
  { id: 'p-106', platform: 'Instagram', name: 'Views [Reel] [Max: 10M] [Instant]', desc: 'Reel views with instant start. Helps push content into Explore.', cost: 380, min: 500, max: '10M', speed: 'Instant', refill: null },
  { id: 'p-107', platform: 'Instagram', name: 'Views [Story] [Max: 5M] [Speed: 500K/day]', desc: 'Story views from real-looking accounts. Boosts story engagement metrics.', cost: 290, min: 500, max: '5M', speed: '500K/day', refill: null },
  { id: 'p-108', platform: 'Instagram', name: 'Comments [Custom] [Max: 10K] [Speed: 5K/day]', desc: 'Custom comments — you provide the text. Realistic accounts with profile pictures.', cost: 4200, min: 10, max: '10K', speed: '5K/day', refill: null },
  { id: 'p-109', platform: 'Instagram', name: 'Saves [Real] [Max: 50K] [Speed: 10K/day]', desc: 'Real saves that signal content quality to the algorithm.', cost: 620, min: 100, max: '50K', speed: '10K/day', refill: null },
  { id: 'p-110', platform: 'Instagram', name: 'Shares [Max: 50K] [Speed: 10K/day]', desc: 'Post shares to DMs and stories. Boosts reach and discovery.', cost: 540, min: 100, max: '50K', speed: '10K/day', refill: null },
  { id: 'p-201', platform: 'TikTok', name: 'Views [No Drop] [Max: 10M] [Instant]', desc: 'Stable views with no-drop guarantee. Instant start.', cost: 520, min: 500, max: '10M', speed: 'Instant', refill: null },
  { id: 'p-202', platform: 'TikTok', name: 'Views [Explore Page] [Max: 5M] [Speed: 1M/day]', desc: 'Views optimised for For You Page discovery. Higher engagement rate.', cost: 780, min: 1000, max: '5M', speed: '1M/day', refill: null },
  { id: 'p-203', platform: 'TikTok', name: 'Followers [Max: 500K] [Start: 0-1h] [Speed: 20K/day]', desc: 'Standard followers. Fast start within 1 hour of order.', cost: 3100, min: 100, max: '500K', speed: '20K/day', refill: null },
  { id: 'p-204', platform: 'TikTok', name: 'Followers [Real Active] [Max: 100K] [Refill: 30d]', desc: 'Active accounts that may engage with content. 30-day refill.', cost: 4800, min: 50, max: '100K', speed: '5K/day', refill: '30 days' },
  { id: 'p-205', platform: 'TikTok', name: 'Likes [Max: 200K] [Speed: 50K/day]', desc: 'Fast likes for TikTok posts. Helps trigger algorithmic boost.', cost: 680, min: 100, max: '200K', speed: '50K/day', refill: null },
  { id: 'p-206', platform: 'TikTok', name: 'Shares [Max: 100K] [Speed: 20K/day]', desc: 'Video shares that increase reach and discoverability.', cost: 450, min: 100, max: '100K', speed: '20K/day', refill: null },
  { id: 'p-207', platform: 'TikTok', name: 'Comments [Custom] [Max: 5K] [Speed: 2K/day]', desc: 'Custom text comments from realistic accounts.', cost: 3900, min: 10, max: '5K', speed: '2K/day', refill: null },
  { id: 'p-208', platform: 'TikTok', name: 'Live Views [Max: 10K] [60 min]', desc: 'Viewers join your TikTok Live and stay up to 60 minutes.', cost: 1200, min: 50, max: '10K', speed: 'Live', refill: null },
  { id: 'p-301', platform: 'YouTube', name: 'Subscribers [Max: 100K] [Start: 0-6h] [Speed: 5K/day]', desc: 'Channel subscribers. Starts within 6 hours.', cost: 7150, min: 50, max: '100K', speed: '5K/day', refill: null },
  { id: 'p-302', platform: 'YouTube', name: 'Views [Retention: 60-90s] [Max: 10M] [Speed: 50K/day]', desc: 'High-retention views (60-90 seconds average). Counts in YouTube Studio.', cost: 420, min: 500, max: '10M', speed: '50K/day', refill: null },
  { id: 'p-303', platform: 'YouTube', name: 'Views [4000 Watch Hours] [Max: 4000h]', desc: 'Watch-hour package for monetisation eligibility. Full 4000 hours.', cost: 12500, min: 1, max: '4000h', speed: '200h/day', refill: null },
  { id: 'p-304', platform: 'YouTube', name: 'Likes [Max: 100K] [Speed: 20K/day]', desc: 'Video likes from accounts with history.', cost: 850, min: 50, max: '100K', speed: '20K/day', refill: null },
  { id: 'p-305', platform: 'YouTube', name: 'Comments [Custom] [Max: 5K] [Speed: 1K/day]', desc: 'Custom text comments under your videos.', cost: 5200, min: 10, max: '5K', speed: '1K/day', refill: null },
  { id: 'p-306', platform: 'YouTube', name: 'Shares [Max: 50K] [Speed: 10K/day]', desc: 'Video shares to social platforms and messaging apps.', cost: 680, min: 100, max: '50K', speed: '10K/day', refill: null },
  { id: 'p-401', platform: 'Spotify', name: 'Plays [Max: 10M] [Speed: 100K/day]', desc: 'Track plays from global accounts. Counts in Spotify for Artists.', cost: 290, min: 1000, max: '10M', speed: '100K/day', refill: null },
  { id: 'p-402', platform: 'Spotify', name: 'Followers [Max: 100K] [Speed: 5K/day]', desc: 'Artist or playlist followers.', cost: 1800, min: 100, max: '100K', speed: '5K/day', refill: null },
  { id: 'p-403', platform: 'Spotify', name: 'Monthly Listeners [Max: 500K] [30 days]', desc: 'Unique monthly listeners maintained for 30 days.', cost: 2400, min: 100, max: '500K', speed: '10K/day', refill: null },
  { id: 'p-404', platform: 'Spotify', name: 'Playlist Adds [Max: 10K] [Speed: 2K/day]', desc: 'Track added to user playlists. Boosts algorithmic recommendations.', cost: 3200, min: 50, max: '10K', speed: '2K/day', refill: null },
  { id: 'p-501', platform: 'X (Twitter)', name: 'Followers [Max: 500K] [Speed: 10K/day]', desc: 'Profile followers with avatars and bios.', cost: 3400, min: 100, max: '500K', speed: '10K/day', refill: null },
  { id: 'p-502', platform: 'X (Twitter)', name: 'Likes [Max: 100K] [Speed: 50K/day]', desc: 'Post likes from accounts with tweet history.', cost: 920, min: 50, max: '100K', speed: '50K/day', refill: null },
  { id: 'p-503', platform: 'X (Twitter)', name: 'Views [Post] [Max: 10M] [Instant]', desc: 'Post impressions / views. Instant delivery.', cost: 180, min: 500, max: '10M', speed: 'Instant', refill: null },
  { id: 'p-504', platform: 'X (Twitter)', name: 'Retweets [Max: 50K] [Speed: 10K/day]', desc: 'Retweets from active accounts. Amplifies post reach.', cost: 1100, min: 50, max: '50K', speed: '10K/day', refill: null },
  { id: 'p-601', platform: 'Facebook', name: 'Page Likes [Max: 100K] [Speed: 5K/day]', desc: 'Facebook page likes from global accounts.', cost: 2100, min: 100, max: '100K', speed: '5K/day', refill: null },
  { id: 'p-602', platform: 'Facebook', name: 'Followers [Max: 200K] [Speed: 10K/day]', desc: 'Profile followers. Separate from page likes.', cost: 1950, min: 100, max: '200K', speed: '10K/day', refill: null },
  { id: 'p-603', platform: 'Facebook', name: 'Post Likes [Max: 50K] [Speed: 20K/day]', desc: 'Likes on individual posts, photos, or videos.', cost: 750, min: 50, max: '50K', speed: '20K/day', refill: null },
  { id: 'p-604', platform: 'Facebook', name: 'Video Views [Max: 5M] [Speed: 500K/day]', desc: 'Video views counted in Facebook Insights.', cost: 320, min: 500, max: '5M', speed: '500K/day', refill: null },
];

const INITIAL_PANEL_IDS = ['p-101', 'p-104', 'p-201', 'p-203', 'p-301'];
const PER_PAGE = 10;

const MOCK_DEPOSITS = [
  { user: 'Chiamaka O.', sender: 'C. Obi Ventures', ref: 'BLS-8QK2PLLM', amount: 15000, date: '6 Aug, 09:12' },
  { user: 'Tunde A.', sender: 'Tunde Adeyemi', ref: 'BLS-2ZV9XKCD', amount: 5000, date: '6 Aug, 08:47' },
  { user: 'Blessing E.', sender: 'Blessing Ek.', ref: 'BLS-MRT1BGGF', amount: 25000, date: '5 Aug, 22:03' },
];

const MOCK_CUSTOMERS = [
  ['bella_o', 'Chiamaka O.', 34, '₦8,400', '2 Jun 2026', 'Active'],
  ['tunde.a', 'Tunde A.', 21, '₦1,150', '14 Jun 2026', 'Active'],
  ['blessing', 'Blessing E.', 17, '₦0', '1 Jul 2026', 'Active'],
  ['mrsteve', 'Steve I.', 9, '₦3,000', '19 Jul 2026', 'Active'],
  ['dara_xx', 'Dara M.', 2, '₦500', '2 Aug 2026', 'New'],
];

const SWATCHES = ['#c47d8e', '#e05252', '#2563eb', '#34a97b', '#d97706', '#7c3aed'];

const TABS = [
  ['overview', 'Overview'],
  ['branding', 'Branding'],
  ['services', 'Services'],
  ['pricing', 'Pricing'],
  ['features', 'Features'],
  ['customers', 'Customers'],
  ['payments', 'Payments'],
];

function CopyIco() {
  return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>;
}

function WarnIco() {
  return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
}

function BackArrow() {
  return <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>;
}

function ChevronIco({ open }) {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: '.15s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>;
}

function PlusIco() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}

function SearchIco() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
}

function PanelManagerInner({ dark: darkProp, t: tProp, onNavigate } = {}) {
  const theme = useTheme();
  const dark = darkProp ?? theme.dark;
  const t = tProp ?? theme.t;
  const toast = useToast();

  const [tab, setTab] = useState('overview');
  const [panelName, setPanelName] = useState('Bella SMM');
  const [brandColor, setBrandColor] = useState('#c47d8e');
  const [markup, setMarkup] = useState(30);
  const [panelCat, setPanelCat] = useState('curated');
  const [overrides, setOverrides] = useState({});
  const [feats, setFeats] = useState({ grad: true, refill: true, bonus: false, wa: true });
  const [panelServiceIds, setPanelServiceIds] = useState(INITIAL_PANEL_IDS);
  const [nameOverrides, setNameOverrides] = useState({});
  const [descOverrides, setDescOverrides] = useState({});
  const [openGroups, setOpenGroups] = useState({});
  const [expandedService, setExpandedService] = useState(null);
  const [pricingSort, setPricingSort] = useState('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [providerPage, setProviderPage] = useState(0);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [deposits, setDeposits] = useState(MOCK_DEPOSITS);

  const paused = false;

  const accent = '#c47d8e';
  const green = dark ? '#6ee7b7' : '#059669';
  const amber = dark ? '#e0a458' : '#d97706';
  const red = dark ? '#fca5a5' : '#dc2626';
  const border = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)';
  const hair = dark ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.08)';
  const card = dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.85)';
  const panel = dark ? '#131728' : '#fff';
  const muted = dark ? '#8a8580' : '#757170';
  const soft = dark ? '#c9c5c0' : '#4a4744';
  const track = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)';
  const code = dark ? '#0d101d' : '#faf8f5';
  const accentSoft = dark ? 'rgba(196,125,142,.12)' : 'rgba(196,125,142,.08)';
  const accentSoft2 = dark ? 'rgba(196,125,142,.22)' : 'rgba(196,125,142,.16)';
  const greenSoft = dark ? 'rgba(110,231,183,.12)' : 'rgba(5,150,105,.1)';
  const amberSoft = dark ? 'rgba(224,164,88,.12)' : 'rgba(217,119,6,.1)';
  const redSoft = dark ? 'rgba(252,165,165,.1)' : 'rgba(220,38,38,.08)';
  const grad = 'linear-gradient(135deg, #c47d8e, #8b5e6b)';

  const price = useCallback((cost, i) => {
    const o = overrides[i];
    return o != null && o !== '' ? Number(o) : Math.round(cost * (1 + markup / 100));
  }, [overrides, markup]);

  const copyText = useCallback((text, label) => {
    try { navigator.clipboard.writeText(text); } catch (e) { /* noop */ }
    toast?.success?.(label || 'Copied', text, { duration: 3000 });
  }, [toast]);

  const handleOverride = useCallback((i, val) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    setOverrides(prev => ({ ...prev, [i]: cleaned }));
  }, []);

  const toggleFeat = useCallback((key) => {
    setFeats(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === 'grad') {
        toast?.info?.(next.grad ? 'Gradual delivery ON' : 'Gradual delivery OFF', next.grad ? 'Customers can pick it at checkout' : 'Checkout shows full speed only', { duration: 3000 });
      } else if (key === 'refill') {
        toast?.info?.(next.refill ? 'Refill button enabled' : 'Refill button disabled', null, { duration: 3000 });
      } else if (key === 'bonus') {
        toast?.info?.(next.bonus ? 'Welcome bonus enabled' : 'Welcome bonus disabled', next.bonus ? 'New signups get ₦500 credit' : null, { duration: 3000 });
      } else if (key === 'wa') {
        toast?.info?.(next.wa ? 'WhatsApp link enabled' : 'WhatsApp link disabled', null, { duration: 3000 });
      }
      return next;
    });
  }, [toast]);

  const approveDeposit = useCallback((idx) => {
    const d = deposits[idx];
    setDeposits(prev => prev.filter((_, i) => i !== idx));
    toast?.success?.('Deposit approved', d.user + ' credited ' + N(d.amount), { duration: 3000 });
  }, [deposits, toast]);

  const rejectDeposit = useCallback((idx) => {
    const d = deposits[idx];
    setDeposits(prev => prev.filter((_, i) => i !== idx));
    toast?.error?.('Deposit rejected', d.ref, { duration: 3000 });
  }, [deposits, toast]);

  const renderOverview = () => (
    <>
      <div className="rpm-grid4">
        {[
          ['SALES THIS MONTH', N(86400), 'paid to your bank'],
          ['FULFILMENT', N(61200), 'drawn from wallet'],
          ['YOUR MARGIN', N(25200), 'sales minus fulfilment'],
          ['CUSTOMERS', '47', '5 new this month'],
        ].map(([label, value, desc]) => (
          <div key={label} className="rpm-card rpm-stat">
            <div className="rpm-sl">{label}</div>
            <div className="rpm-sv m">{value}</div>
            <div className="rpm-sd">{desc}</div>
          </div>
        ))}
      </div>
      <div className="rpm-slab">Panel</div>
      <div className="rpm-grid2">
        <div className="rpm-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {[
              ['Storefront', 'bella-smm.nitro.ng'],
              ['Plan', '₦25,000/month, auto-renews from wallet'],
              ['Next renewal', paused ? '1 Aug 2026, missed' : '1 Sep 2026'],
              ['Currency', 'NGN'],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', gap: 10, fontSize: 12.5 }}>
                <span style={{ width: 110, flexShrink: 0, fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: muted, paddingTop: 2 }}>{l}</span>
                <span style={{ fontWeight: 600, color: soft }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 15, flexWrap: 'wrap' }}>
            <button className="rpm-btn-p" onClick={() => toast?.info?.('Opening bella-smm.nitro.ng')}>Visit storefront</button>
            <button className="rpm-btn-g" onClick={() => copyText('https://bella-smm.nitro.ng', 'Link copied')}>Copy link</button>
          </div>
        </div>
        <div className="rpm-card" style={{ padding: 16 }}>
          <div className="rpm-sl">LATEST ORDERS ON YOUR PANEL</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              ['bella_o', 'IG Followers · 1k', 'In progress', N(3536)],
              ['mrsteve', 'TikTok Views · 5k', 'Completed', N(3380)],
              ['tunde.a', 'IG Likes · 500', 'Completed', N(748)],
            ].map(([u, s, st, a]) => (
              <div key={u + s} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
                <span className="m" style={{ color: muted }}>{u}</span>
                <span style={{ flex: 1, color: soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</span>
                <span className="rpm-stag" style={{ background: st === 'Completed' ? greenSoft : amberSoft, color: st === 'Completed' ? green : amber }}>{st.toUpperCase()}</span>
                <b className="m" style={{ fontSize: 12 }}>{a}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  const renderBranding = () => (
    <div className="rpm-grid2">
      <div className="rpm-card" style={{ padding: 16 }}>
        <div className="rpm-fld">
          <span className="rpm-fl">Panel name</span>
          <input className="rpm-fin" value={panelName} onChange={e => setPanelName(e.target.value)} style={{ background: code, borderColor: border, color: t.text }} />
        </div>
        <div className="rpm-fld">
          <span className="rpm-fl">Logo</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: brandColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
              {(panelName || 'P')[0].toUpperCase()}
            </div>
            <button className="rpm-btn-g" onClick={() => toast?.info?.('Upload coming in build')}>Upload logo</button>
          </div>
        </div>
        <div className="rpm-fld">
          <span className="rpm-fl">Accent color</span>
          <div className="rpm-swatches">
            {SWATCHES.map(c => (
              <div key={c} className={`rpm-swatch${c === brandColor ? ' on' : ''}`} style={{ background: c, borderColor: c === brandColor ? t.text : 'transparent' }} onClick={() => setBrandColor(c)} />
            ))}
          </div>
        </div>
        <button className="rpm-btn-p" onClick={() => toast?.success?.('Branding saved')}>Save branding</button>
      </div>
      <div>
        <span className="rpm-fl">Live preview</span>
        <div className="rpm-preview" style={{ borderColor: hair, background: panel }}>
          <div className="rpm-pv-top" style={{ background: brandColor }}>
            <b>{panelName || 'Your Panel'}</b>
            <span>SIGN IN</span>
          </div>
          <div className="rpm-pv-body">
            <div className="rpm-pv-line" style={{ width: '70%', background: track }} />
            <div className="rpm-pv-line" style={{ width: '45%', background: track }} />
            <div className="rpm-pv-line" style={{ width: '58%', background: track }} />
            <div className="rpm-pv-btn" style={{ background: brandColor }} />
          </div>
        </div>
        <div style={{ fontSize: 11, color: muted, marginTop: 9, lineHeight: 1.6 }}>
          Your customers see this name, this color and your logo. Nitro appears nowhere.
        </div>
      </div>
    </div>
  );

  const [perPage, setPerPage] = useState(25);

  const renderServices = () => {
    const allPlatforms = [...new Set(PROVIDER_CATALOG.map(s => s.platform))];
    let filtered = PROVIDER_CATALOG.filter(s => {
      const matchPlat = platformFilter === 'all' || s.platform === platformFilter;
      if (!matchPlat) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q) || s.platform.toLowerCase().includes(q);
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
    const safePage = Math.min(providerPage, totalPages - 1);
    const start = safePage * perPage;
    const pageItems = filtered.slice(start, start + perPage);

    return (
      <>
        <div className="rpm-search-wrap" style={{ background: code, borderColor: border }}>
          <SearchIco />
          <input className="rpm-search" placeholder="Search 15,000+ services..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setProviderPage(0); }} style={{ color: t.text }} />
          {searchQuery && <button className="rpm-search-clear" style={{ color: muted }} onClick={() => setSearchQuery('')}>&times;</button>}
        </div>

        <div className="rpm-toolbar" style={{ borderColor: border }}>
          <select className="rpm-sel" value={platformFilter} onChange={e => { setPlatformFilter(e.target.value); setProviderPage(0); }} style={{ background: code, borderColor: border, color: soft }}>
            <option value="all">All platforms</option>
            {allPlatforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <span style={{ fontSize: 11, color: muted }}>{filtered.length ? start + 1 : 0}&ndash;{Math.min(start + perPage, filtered.length)} of {filtered.length}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>{panelServiceIds.length} on panel</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="rpm-sel" value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setProviderPage(0); }} style={{ background: code, borderColor: border, color: soft }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="rpm-svc-list" style={{ background: card, borderColor: border }}>
          <div className="rpm-svc-hdr" style={{ borderColor: hair, color: muted }}>
            <span className="rpm-sh-plat">Platform</span>
            <span className="rpm-sh-name">Service</span>
            <span className="rpm-sh-cost">Cost/1k</span>
            <span className="rpm-sh-spec">Speed</span>
            <span className="rpm-sh-ref">Refill</span>
            <span className="rpm-sh-act"></span>
          </div>
          {pageItems.map(svc => {
            const isOn = panelServiceIds.includes(svc.id);
            const isExp = expandedService === svc.id;
            return (
              <div key={svc.id}>
                <div className={`rpm-svc-row${isOn ? ' rpm-svc-row-on' : ''}`} style={{ borderColor: hair }} onClick={() => setExpandedService(prev => prev === svc.id ? null : svc.id)}>
                  <span className="rpm-sr-plat" style={{ color: muted }}>{svc.platform}</span>
                  <span className="rpm-sr-name" style={{ color: t.text }}>{svc.name}</span>
                  <span className="rpm-sr-cost m" style={{ color: soft }}>{N(svc.cost)}</span>
                  <span className="rpm-sr-spec" style={{ color: soft }}>{svc.speed}</span>
                  <span className="rpm-sr-ref" style={{ color: svc.refill ? green : muted }}>{svc.refill || '—'}</span>
                  <button className={isOn ? 'rpm-r-on' : 'rpm-r-add'} style={isOn ? { background: greenSoft, color: green } : { background: accentSoft, color: accent }} onClick={e => { e.stopPropagation(); setPanelServiceIds(prev => isOn ? prev.filter(id => id !== svc.id) : [...prev, svc.id]); toast?.info?.(isOn ? 'Removed' : 'Added', svc.name, { duration: 2000 }); }}>
                    {isOn ? 'Added' : 'Add'}
                  </button>
                </div>
                {isExp && (
                  <div className="rpm-svc-detail" style={{ background: track, borderColor: hair }}>
                    <div style={{ fontSize: 12, color: soft, lineHeight: 1.6, marginBottom: 8 }}>{svc.desc}</div>
                    <div className="rpm-svc-specgrid" style={{ color: soft }}>
                      <span style={{ color: muted }}>Min:</span><span>{svc.min}</span>
                      <span style={{ color: muted }}>Max:</span><span>{svc.max}</span>
                      <span style={{ color: muted }}>Speed:</span><span>{svc.speed}</span>
                      <span style={{ color: muted }}>Refill:</span><span style={{ color: svc.refill ? green : muted }}>{svc.refill || 'None'}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12.5, color: muted }}>No services match your search.</div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="rpm-pagination">
            <button className="rpm-btn-g" disabled={safePage === 0} onClick={() => setProviderPage(0)} style={{ fontSize: 11, padding: '7px 10px' }}>&laquo;</button>
            <button className="rpm-btn-g" disabled={safePage === 0} onClick={() => setProviderPage(p => p - 1)}>Prev</button>
            <span style={{ fontSize: 12, color: muted, fontWeight: 600 }}>{safePage + 1} / {totalPages}</span>
            <button className="rpm-btn-g" disabled={safePage >= totalPages - 1} onClick={() => setProviderPage(p => p + 1)}>Next</button>
            <button className="rpm-btn-g" disabled={safePage >= totalPages - 1} onClick={() => setProviderPage(totalPages - 1)} style={{ fontSize: 11, padding: '7px 10px' }}>&raquo;</button>
          </div>
        )}
        <div style={{ fontSize: 10.5, color: muted, marginTop: 8 }}>Click a row to see full details. When backend is live, this pulls directly from upstream APIs.</div>
      </>
    );
  };

  const renderPricing = () => {
    const panelSvcs = PROVIDER_CATALOG.filter(s => panelServiceIds.includes(s.id));
    const panelGrouped = {};
    panelSvcs.forEach(s => { if (!panelGrouped[s.platform]) panelGrouped[s.platform] = []; panelGrouped[s.platform].push(s); });

    const totalCuratedTiers = CURATED_CATALOG.reduce((a, p) => a + p.groups.reduce((b, g) => b + g.tiers.length, 0), 0);

    return (
      <>
        <div className="rpm-card" style={{ padding: 16, marginBottom: 14 }}>
          <div className="rpm-mkrow">
            <span style={{ fontSize: 12.5, color: soft }}><b>Default markup</b> over your reseller rates, applied to every service without an override</span>
            <span className="rpm-mkchip">Markup <b className="m">{markup}%</b></span>
          </div>
          <input type="range" className="rpm-mkr" min={10} max={100} step={5} value={markup} onChange={e => setMarkup(Number(e.target.value))} style={{ accentColor: accent }} />
          <div className="rpm-mkscale"><span>10%</span><span>100%</span></div>
        </div>
        <div className="rpm-card" style={{ padding: 16, marginBottom: 14 }}>
          <div className="rpm-mkrow">
            <span style={{ fontSize: 12.5, color: soft }}><b>Catalog mode</b></span>
            <div className="rpm-catseg" style={{ background: track }}>
              {[['curated', 'Curated tiers'], ['full', 'Full providers']].map(([k, l]) => (
                <button key={k} className={panelCat === k ? 'on' : ''} style={panelCat === k ? { background: panel, color: accent, boxShadow: '0 1px 3px rgba(0,0,0,.1)' } : { color: muted }} onClick={() => { setPanelCat(k); toast?.info?.('Catalog updated', k === 'curated' ? 'Selling Nitro curated tiers' : 'Selling your custom catalog', { duration: 3000 }); }}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        {panelCat === 'curated' ? (
          <>
            {CURATED_CATALOG.map(({ platform, groups }) => {
              const platKey = 'cur-' + platform;
              const isPlatOpen = openGroups[platKey] !== false;
              return (
                <div key={platform} className="rpm-pgroup rpm-pgroup-plat">
                  <div className="rpm-pghead rpm-pghead-plat" onClick={() => setOpenGroups(prev => ({ ...prev, [platKey]: prev[platKey] === false }))}>
                    <ChevronIco open={isPlatOpen} />
                    <span className="rpm-pgname" style={{ color: t.text }}>{platform}</span>
                    <span className="rpm-pgmeta" style={{ color: muted }}>{groups.length} groups</span>
                  </div>
                  {isPlatOpen && groups.map((grp, gi) => {
                    const grpKey = `cur-${platform}-${grp.name}${grp.nigerian ? '-ng' : ''}`;
                    const isGrpOpen = openGroups[grpKey] !== false;
                    return (
                      <div key={gi} className={`rpm-subgrp${grp.nigerian ? ' rpm-subgrp-ng' : ''}`}>
                        <div className="rpm-subghead" style={{ borderColor: hair }} onClick={() => setOpenGroups(prev => ({ ...prev, [grpKey]: prev[grpKey] === false }))}>
                          <ChevronIco open={isGrpOpen} />
                          <span className="rpm-subgname">{grp.name}</span>
                          {grp.nigerian && <span className="rpm-ng-badge">NG</span>}
                          <span className="rpm-subgmeta">{grp.tiers.length} tier{grp.tiers.length > 1 ? 's' : ''}</span>
                        </div>
                        {isGrpOpen && grp.tiers.map((tr, ti) => {
                          const tierKey = `cur-${platform}-${grp.name}${grp.nigerian ? '-ng' : ''}-${tr.tier}`;
                          const p = price(tr.cost, tierKey);
                          const margin = p - tr.cost;
                          const isExp = expandedService === tierKey;
                          const hasOverride = overrides[tierKey] != null && overrides[tierKey] !== '';
                          return (
                            <div key={ti}>
                              <div className="rpm-tier-row rpm-tier-row-click" style={{ borderColor: hair }} onClick={() => setExpandedService(prev => prev === tierKey ? null : tierKey)}>
                                <span className="rpm-cur-dot" style={{ background: grp.nigerian ? '#16a34a' : green }} />
                                <span className="rpm-tier-name" style={{ color: soft }}>{tr.tier}</span>
                                <span className="rpm-tier-lbl" style={{ color: muted }}>Cost</span>
                                <span className="rpm-tier-val m" style={{ color: soft }}>{N(tr.cost)}</span>
                                <span className="rpm-tier-lbl" style={{ color: muted }}>Sell</span>
                                <span className="rpm-tier-val m" style={{ color: hasOverride ? accent : soft, fontWeight: hasOverride ? 700 : 400 }}>{N(p)}</span>
                                <span className="rpm-margin m" style={{ color: margin >= 0 ? green : red, fontWeight: 700 }}>{margin >= 0 ? '+' : ''}{N(margin)}</span>
                                <ChevronIco open={isExp} />
                              </div>
                              {isExp && (
                                <div className="rpm-sdetail rpm-sdetail-tier" style={{ background: track, borderColor: hair }}>
                                  <div className="rpm-sdrow"><span className="rpm-sdl" style={{ color: muted }}>Your cost / 1k</span><span className="rpm-sdv m" style={{ color: soft }}>{N(tr.cost)}</span></div>
                                  <div className="rpm-sdrow"><span className="rpm-sdl" style={{ color: muted }}>Auto price / 1k</span><span className="rpm-sdv m" style={{ color: soft }}>{N(Math.round(tr.cost * (1 + markup / 100)))}</span></div>
                                  <div className="rpm-sdrow">
                                    <span className="rpm-sdl" style={{ color: muted }}>Custom price</span>
                                    <input className="rpm-ov-in m" placeholder="auto" value={overrides[tierKey] ?? ''} onChange={e => handleOverride(tierKey, e.target.value)} style={{ background: code, borderColor: border, color: t.text }} />
                                  </div>
                                  <div className="rpm-sdrow">
                                    <span className="rpm-sdl" style={{ color: muted }}>You keep / 1k</span>
                                    <span className="rpm-sdv m" style={{ color: margin >= 0 ? green : red, fontWeight: 700 }}>{margin >= 0 ? '+' : ''}{N(margin)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: muted, marginTop: 10, lineHeight: 1.6 }}>
              Curated catalog mirrors Nitro's live menu — {totalCuratedTiers} tiers across {CURATED_CATALOG.length} platforms. Your {markup}% markup is applied automatically. Prices sync via the same cron that updates Nitro. Switch to <b style={{ color: accent, cursor: 'pointer' }} onClick={() => setPanelCat('full')}>Full providers</b> to build a custom catalog.
            </div>
          </>
        ) : (
          <>
            {panelSvcs.length === 0 ? (
              <div className="rpm-card" style={{ padding: 28, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: muted, marginBottom: 14 }}>No services on your panel yet.</div>
                <button className="rpm-btn-p" onClick={() => setTab('services')}>Browse catalog</button>
              </div>
            ) : (
              <>
                <div className="rpm-toolbar" style={{ borderColor: border, marginTop: 0 }}>
                  <span style={{ fontSize: 11, color: muted }}>{panelSvcs.length} services on panel</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select className="rpm-sel" value={pricingSort} onChange={e => setPricingSort(e.target.value)} style={{ background: code, borderColor: border, color: soft }}>
                      <option value="name">Sort: A-Z</option>
                      <option value="price-asc">Sort: Price low</option>
                      <option value="price-desc">Sort: Price high</option>
                      <option value="margin-desc">Sort: Best margin</option>
                    </select>
                  </div>
                </div>
                {(() => {
                  let sorted = [...panelSvcs];
                  if (pricingSort === 'price-asc') sorted.sort((a, b) => a.cost - b.cost);
                  else if (pricingSort === 'price-desc') sorted.sort((a, b) => b.cost - a.cost);
                  else if (pricingSort === 'margin-desc') sorted.sort((a, b) => (price(b.cost, b.id) - b.cost) - (price(a.cost, a.id) - a.cost));
                  else sorted.sort((a, b) => a.name.localeCompare(b.name));
                  const sg = {};
                  sorted.forEach(s => { if (!sg[s.platform]) sg[s.platform] = []; sg[s.platform].push(s); });
                  return Object.entries(sg).map(([platform, svcs]) => {
                    const platKey = 'full-' + platform;
                    const isOpen = openGroups[platKey] !== false;
                    return (
                      <div key={platform} className="rpm-pgroup rpm-pgroup-plat">
                        <div className="rpm-pghead rpm-pghead-plat" onClick={() => setOpenGroups(prev => ({ ...prev, [platKey]: prev[platKey] === false }))}>
                          <ChevronIco open={isOpen} />
                          <span className="rpm-pgname" style={{ color: t.text }}>{platform}</span>
                          <span className="rpm-pgmeta" style={{ color: muted }}>{svcs.length} services</span>
                        </div>
                        {isOpen && svcs.map(svc => {
                          const p = price(svc.cost, svc.id);
                          const margin = p - svc.cost;
                          const isExp = expandedService === svc.id;
                          const displayName = nameOverrides[svc.id] || svc.name;
                          return (
                            <div key={svc.id} className="rpm-srow-wrap rpm-srow-wrap-svc" style={{ borderColor: hair }}>
                              <div className="rpm-srow rpm-srow-svc" onClick={() => setExpandedService(prev => prev === svc.id ? null : svc.id)}>
                                <span className="rpm-sname" style={{ color: t.text }}>{displayName}</span>
                                <span className="rpm-sprice m" style={{ color: soft }}>{N(svc.cost)}</span>
                                <span className="rpm-sprice m" style={{ color: soft }}>{N(p)}</span>
                                <span className="rpm-margin m" style={{ color: margin >= 0 ? green : red, fontWeight: 700 }}>{margin >= 0 ? '+' : ''}{N(margin)}</span>
                                <ChevronIco open={isExp} />
                              </div>
                              {isExp && (
                                <div className="rpm-sdetail" style={{ background: track, borderColor: hair }}>
                                  <div className="rpm-sdrow">
                                    <span className="rpm-sdl" style={{ color: muted }}>Display name</span>
                                    <input className="rpm-ov-in rpm-ov-wide" placeholder={svc.name} value={nameOverrides[svc.id] ?? ''} onChange={e => setNameOverrides(prev => ({ ...prev, [svc.id]: e.target.value }))} style={{ background: code, borderColor: border, color: t.text }} />
                                  </div>
                                  <div className="rpm-sdrow">
                                    <span className="rpm-sdl" style={{ color: muted }}>Description</span>
                                    <textarea className="rpm-ov-in rpm-ov-wide rpm-ov-ta" placeholder={svc.desc} value={descOverrides[svc.id] ?? ''} onChange={e => setDescOverrides(prev => ({ ...prev, [svc.id]: e.target.value }))} style={{ background: code, borderColor: border, color: t.text }} rows={2} />
                                  </div>
                                  <div className="rpm-sdrow"><span className="rpm-sdl" style={{ color: muted }}>Your cost / 1k</span><span className="rpm-sdv m" style={{ color: soft }}>{N(svc.cost)}</span></div>
                                  <div className="rpm-sdrow"><span className="rpm-sdl" style={{ color: muted }}>Customer price / 1k</span><span className="rpm-sdv m" style={{ color: soft }}>{N(p)}</span></div>
                                  <div className="rpm-sdrow">
                                    <span className="rpm-sdl" style={{ color: muted }}>Override price</span>
                                    <input className="rpm-ov-in m" placeholder="auto" value={overrides[svc.id] ?? ''} onChange={e => handleOverride(svc.id, e.target.value)} style={{ background: code, borderColor: border, color: t.text }} />
                                  </div>
                                  <div className="rpm-sdrow">
                                    <span className="rpm-sdl" style={{ color: muted }}>You keep / 1k</span>
                                    <span className="rpm-sdv m" style={{ color: margin >= 0 ? green : red, fontWeight: 700 }}>{margin >= 0 ? '+' : ''}{N(margin)}</span>
                                  </div>
                                  <div className="rpm-sdrow"><span className="rpm-sdl" style={{ color: muted }}>Min / Max</span><span className="rpm-sdv" style={{ color: soft, fontSize: 12 }}>{svc.min} — {svc.max}</span></div>
                                  <div className="rpm-sdrow"><span className="rpm-sdl" style={{ color: muted }}>Speed</span><span className="rpm-sdv" style={{ color: soft, fontSize: 12 }}>{svc.speed}</span></div>
                                  <div className="rpm-sdrow"><span className="rpm-sdl" style={{ color: muted }}>Refill</span><span className="rpm-sdv" style={{ color: svc.refill ? green : muted, fontSize: 12 }}>{svc.refill || 'None'}</span></div>
                                  <button className="rpm-sremove" style={{ color: red }} onClick={e => { e.stopPropagation(); setPanelServiceIds(prev => prev.filter(id => id !== svc.id)); setExpandedService(null); toast?.info?.('Removed', (displayName) + ' removed from panel'); }}>Remove from panel</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
                <button className="rpm-add-trigger" style={{ border: `1px dashed ${accent}`, color: accent, background: accentSoft }} onClick={() => setTab('services')}>
                  <PlusIco /> Browse catalog to add more services
                </button>
              </>
            )}
            <div style={{ fontSize: 11, color: muted, marginTop: 10 }}>Expand a service to edit its name, description, or set a custom price. Overrides win over the default markup.</div>
          </>
        )}
      </>
    );
  };

  const renderFeatures = () => {
    const F = [
      ['grad', 'Gradual delivery', 'OPT-IN', "Nitro's slow, natural-looking delivery engine on your storefront. Your customers pick it at checkout as a premium option most panels can't offer."],
      ['refill', 'Refill button', '', 'Customers can trigger refills on eligible orders themselves, no ticket needed.'],
      ['bonus', 'Welcome bonus', '', 'New signups get ₦500 storefront credit to place a first order.'],
      ['wa', 'WhatsApp support link', '', 'A chat button on your storefront that opens your WhatsApp business number.'],
    ];
    return (
      <div className="rpm-card" style={{ borderColor: border }}>
        {F.map(([k, title, badge, desc]) => (
          <div key={k} className="rpm-featrow" style={{ borderColor: hair }}>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: 13, fontWeight: 800 }}>
                {title}
                {badge && <span className="rpm-fb2" style={{ background: accentSoft2, color: accent }}>{badge}</span>}
              </h4>
              <p style={{ fontSize: 11.5, color: muted, lineHeight: 1.55, marginTop: 2 }}>{desc}</p>
            </div>
            <div className={`rpm-sw${feats[k] ? ' on' : ''}`} onClick={() => toggleFeat(k)} style={feats[k] ? {} : { background: track, borderColor: border }} />
          </div>
        ))}
      </div>
    );
  };

  const renderCustomers = () => (
    <>
      <div className="rpm-tbl-wrap">
        <div className="rpm-tbl" style={{ borderColor: hair, background: panel }}>
          <table>
            <thead><tr>
              <th style={{ color: muted, borderColor: hair }}>Username</th>
              <th style={{ color: muted, borderColor: hair }}>Name</th>
              <th style={{ color: muted, borderColor: hair }}>Orders</th>
              <th style={{ color: muted, borderColor: hair }}>Balance</th>
              <th style={{ color: muted, borderColor: hair }}>Joined</th>
              <th style={{ color: muted, borderColor: hair }}>Status</th>
            </tr></thead>
            <tbody>
              {MOCK_CUSTOMERS.map(([u, n, o, b, j, s]) => (
                <tr key={u}>
                  <td className="m" style={{ color: t.text, fontWeight: 600, borderColor: hair }}>{u}</td>
                  <td style={{ color: soft, borderColor: hair }}>{n}</td>
                  <td className="m" style={{ color: soft, borderColor: hair }}>{o}</td>
                  <td className="m" style={{ color: soft, borderColor: hair }}>{b}</td>
                  <td style={{ color: soft, borderColor: hair }}>{j}</td>
                  <td style={{ borderColor: hair }}>
                    <span className="rpm-stag" style={{ background: s === 'New' ? accentSoft2 : greenSoft, color: s === 'New' ? accent : green }}>{s.toUpperCase()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 11, color: muted, marginTop: 10 }}>Balances live on your storefront and are funded by deposits you approve in Payments.</div>
    </>
  );

  const renderPayments = () => (
    <>
      <div className="rpm-grid2" style={{ marginBottom: 14 }}>
        <div className="rpm-card" style={{ padding: 16 }}>
          <span className="rpm-fl">How customers pay you</span>
          <div style={{ fontSize: 11.5, color: muted, lineHeight: 1.6, marginBottom: 12 }}>These details show on your storefront's top-up page. Money goes straight to you, never through Nitro.</div>
          <div className="rpm-fld"><span className="rpm-fl">Bank name</span><input className="rpm-fin" defaultValue="OPay" style={{ background: code, borderColor: border, color: t.text }} /></div>
          <div className="rpm-fld"><span className="rpm-fl">Account number</span><input className="rpm-fin m" defaultValue="8123456790" style={{ background: code, borderColor: border, color: t.text }} /></div>
          <div className="rpm-fld"><span className="rpm-fl">Account name</span><input className="rpm-fin" defaultValue="Bella Adeola" style={{ background: code, borderColor: border, color: t.text }} /></div>
          <div className="rpm-fld"><span className="rpm-fl">USDT address &middot; optional</span><input className="rpm-fin m" placeholder="TRC20 address" style={{ background: code, borderColor: border, color: t.text }} /></div>
          <button className="rpm-btn-p" onClick={() => toast?.success?.('Payout details saved', 'Shown on your top-up page', { duration: 3000 })}>Save payout details</button>
        </div>
        <div className="rpm-card" style={{ padding: 16 }}>
          <span className="rpm-fl">The flow</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            {[
              ['1', 'Customer transfers to your account above'],
              ['2', 'You approve it in the queue below'],
              ['3', 'Their storefront balance is credited'],
              ['4', 'Their orders fulfil from your Nitro wallet'],
            ].map(([n, text]) => (
              <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, color: soft }}>
                <span style={{ width: 22, height: 22, borderRadius: 99, background: accentSoft2, color: accent, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rpm-slab">Deposit approvals <i style={{ fontStyle: 'normal', color: accent }}>&middot; {deposits.length} pending</i></div>
      <div className="rpm-card" style={{ borderColor: border }}>
        {deposits.length ? deposits.map((d, i) => (
          <div key={d.ref} className="rpm-dep" style={{ borderColor: hair, boxShadow: `inset 2.5px 0 0 ${amber}` }}>
            <div className="rpm-dav" style={{ background: accentSoft2, color: accent }}>
              {d.user.split(' ').map(w => w[0]).join('').slice(0, 2)}
            </div>
            <div className="rpm-dinfo">
              <div className="rpm-dnm">{d.user}</div>
              <div className="rpm-dfrow">
                <span className="rpm-dflab" style={{ color: muted }}>SENDER</span>
                <span className="rpm-dfval" style={{ color: soft }}>{d.sender}</span>
              </div>
              <div className="rpm-dfrow">
                <span className="rpm-dflab" style={{ color: muted }}>REF</span>
                <span className="rpm-dfval" style={{ color: soft }}>
                  <span className="rpm-dref m" style={{ background: track, borderColor: hair, color: soft }}>
                    {d.ref}
                    <button onClick={e => { e.stopPropagation(); copyText(d.ref, 'Reference copied'); }} style={{ color: muted, display: 'flex' }}><CopyIco /></button>
                  </span>
                </span>
              </div>
              <div className="rpm-dfrow">
                <span className="rpm-dflab" style={{ color: muted }}>DATE</span>
                <span className="rpm-dfval" style={{ color: muted, fontWeight: 500 }}>{d.date}</span>
              </div>
            </div>
            <div className="rpm-dright">
              <div className="rpm-damt m">{N(d.amount)}</div>
              <div style={{ display: 'flex', gap: 7 }}>
                <button className="rpm-b-ok" onClick={() => approveDeposit(i)}>Approve</button>
                <button className="rpm-b-no" style={{ borderColor: `color-mix(in srgb, ${red} 35%, transparent)`, color: red }} onClick={() => rejectDeposit(i)}>Reject</button>
              </div>
            </div>
          </div>
        )) : (
          <div style={{ padding: 22, textAlign: 'center', fontSize: 12.5, color: muted }}>Queue clear. New transfers from your customers land here.</div>
        )}
      </div>
    </>
  );

  const tabContent = { overview: renderOverview, branding: renderBranding, services: renderServices, pricing: renderPricing, features: renderFeatures, customers: renderCustomers, payments: renderPayments };

  return (
    <>
      <style>{`
        .rpm-sb-head{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;padding:6px 10px;border-radius:8px}
        .rpm-sb-item{padding:10px 12px;border-radius:8px;margin-bottom:6px}
        .rpm-card{background:${card};border:.5px solid ${border};border-radius:15px}
        .rpm-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        .rpm-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .rpm-stat{padding:15px}
        .rpm-sl{font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${muted}}
        .rpm-sv{font-size:19px;font-weight:800;margin-top:5px}
        .rpm-sd{font-size:11px;color:${muted};margin-top:3px}
        .rpm-slab{font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${muted};margin:24px 0 10px}
        .rpm-stag{font-size:9px;font-weight:800;padding:2px 8px;border-radius:99px}
        .rpm-btn-p{background:${grad};color:#fff;font-size:12.5px;font-weight:800;padding:10px 18px;border-radius:10px;border:none;cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:7px;box-shadow:0 4px 12px rgba(196,125,142,.25);font-family:inherit}
        .rpm-btn-p:hover{transform:translateY(-1px)}
        .rpm-btn-g{font-size:12px;font-weight:700;padding:9px 14px;border-radius:10px;border:1px solid ${border};color:${soft};background:${card};cursor:pointer;transition:.15s;font-family:inherit}
        .rpm-btn-g:hover{color:${t.text}}
        .rpm-fld{margin-bottom:12px}
        .rpm-fl{font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${muted};display:block;margin-bottom:5px}
        .rpm-fin{width:100%;background:${code};border:1px solid ${border};border-radius:9px;padding:10px 12px;font-size:12.5px;color:${t.text};outline:none;transition:.12s;font-family:inherit;box-sizing:border-box}
        .rpm-fin:focus{border-color:${accent}}
        .rpm-swatches{display:flex;gap:8px;flex-wrap:wrap}
        .rpm-swatch{width:34px;height:34px;border-radius:11px;border:2px solid transparent;transition:.15s;cursor:pointer}
        .rpm-swatch.on{transform:scale(1.08)}
        .rpm-preview{border:1px solid ${hair};border-radius:13px;overflow:hidden}
        .rpm-pv-top{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;color:#fff}
        .rpm-pv-top b{font-size:14px;font-weight:800}
        .rpm-pv-top span{font-size:9px;font-weight:700;background:rgba(255,255,255,.22);border-radius:99px;padding:3px 8px}
        .rpm-pv-body{padding:12px 14px}
        .rpm-pv-line{height:8px;border-radius:99px;margin-bottom:7px}
        .rpm-pv-btn{height:26px;border-radius:8px;width:110px;margin-top:4px}
        .rpm-mkrow{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
        .rpm-mkchip{background:${accentSoft2};color:${accent};border-radius:99px;padding:5px 13px;font-weight:800;font-size:11.5px;white-space:nowrap}
        .rpm-mkr{width:100%;margin-top:12px}
        .rpm-mkscale{display:flex;justify-content:space-between;font-size:9.5px;color:${muted};margin-top:3px}
        .rpm-catseg{display:flex;gap:4px;border-radius:10px;padding:3px}
        .rpm-catseg button{font-size:10.5px;font-weight:800;padding:6px 11px;border-radius:8px;border:none;cursor:pointer;transition:.15s;white-space:nowrap;font-family:inherit;background:none}
        .rpm-tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
        .rpm-tbl{border:1px solid ${hair};border-radius:14px;overflow:hidden}
        .rpm-tbl table{width:100%;min-width:640px;border-collapse:collapse;font-size:12.5px}
        .rpm-tbl th{text-align:left;padding:10px 14px;font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid ${hair}}
        .rpm-tbl td{padding:11px 14px;border-bottom:1px solid ${hair};vertical-align:middle}
        .rpm-tbl tr:last-child td{border-bottom:none}
        .rpm-ov-in{width:96px;background:${code};border:1px solid ${border};border-radius:8px;padding:7px 9px;font-size:12px;color:${t.text};outline:none;font-family:inherit;box-sizing:border-box}
        .rpm-ov-in:focus{border-color:${accent}}
        .rpm-pgroup{border-radius:14px;overflow:hidden;border:1px solid ${border};background:${card};margin-bottom:10px}
        .rpm-pghead{display:flex;align-items:center;gap:10px;padding:13px 16px;cursor:pointer;transition:.1s;user-select:none}
        .rpm-pghead:hover{background:${track}}
        .rpm-pgname{font-size:13.5px;font-weight:800;flex:1}
        .rpm-pgmeta{font-size:11px;white-space:nowrap}
        .rpm-srow-wrap{border-top:1px solid}
        .rpm-srow{display:flex;align-items:center;gap:10px;padding:11px 16px;cursor:pointer;transition:.1s}
        .rpm-srow:hover{background:${track}}
        .rpm-sname{flex:1;font-size:12.5px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .rpm-sprice{font-size:12px;white-space:nowrap}
        .rpm-sdetail{padding:14px 18px 18px 48px;display:flex;flex-direction:column;gap:12px;border-top:1px solid}
        .rpm-sdrow{display:flex;align-items:center;gap:12px}
        .rpm-sdl{width:120px;flex-shrink:0;font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase}
        .rpm-sdv{font-size:12.5px;font-weight:600}
        .rpm-sremove{font-size:11px;background:none;border:none;cursor:pointer;font-weight:700;padding:4px 0;align-self:flex-start;font-family:inherit;margin-top:2px}
        .rpm-sremove:hover{text-decoration:underline}
        .rpm-search-wrap{display:flex;align-items:center;gap:8px;border:1px solid;border-radius:11px;padding:10px 14px;margin-bottom:4px}
        .rpm-search{flex:1;background:none;border:none;font-size:13px;outline:none;font-family:inherit}
        .rpm-search::placeholder{color:${muted}}
        .rpm-search-clear{background:none;border:none;font-size:18px;cursor:pointer;padding:0 4px;line-height:1;font-family:inherit}
        .rpm-search-clear:hover{color:${t.text}}
        .rpm-pagination{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px}
        .rpm-pagination button:disabled{opacity:0.35;cursor:default}
        .rpm-cur-dot{width:7px;height:7px;border-radius:99px;flex-shrink:0}
        .rpm-srow-ro{cursor:default}
        .rpm-srow-ro:hover{background:none !important}
        .rpm-margin{font-size:12px;white-space:nowrap;min-width:60px;text-align:right}

        .rpm-pgroup-plat{border-left:3px solid ${accent}}
        .rpm-pghead-plat{background:${dark ? 'rgba(196,125,142,.06)' : 'rgba(196,125,142,.04)'};padding:16px 18px}
        .rpm-pghead-plat .rpm-pgname{font-size:15px;font-weight:900;letter-spacing:-.3px}

        .rpm-subgrp{margin:8px 12px;border-radius:10px;border:1px solid ${hair};background:${dark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.015)'};overflow:hidden}
        .rpm-subghead{display:flex;align-items:center;gap:10px;padding:13px 16px 13px 16px;cursor:pointer;transition:.1s;user-select:none}
        .rpm-subghead:hover{background:${track}}
        .rpm-subgname{font-weight:700;font-size:13px;color:${t.text}}
        .rpm-subgmeta{font-size:10.5px;color:${muted};margin-left:auto}

        .rpm-subgrp-ng{background:${dark ? 'rgba(74,222,128,.06)' : 'rgba(22,163,74,.035)'};border-color:${dark ? 'rgba(74,222,128,.25)' : 'rgba(22,163,74,.18)'}}
        .rpm-subgrp-ng .rpm-subghead:hover{background:${dark ? 'rgba(74,222,128,.1)' : 'rgba(22,163,74,.06)'}}
        .rpm-ng-badge{font-size:9px;font-weight:800;padding:2px 7px;border-radius:4px;background:${dark ? 'rgba(74,222,128,.15)' : 'rgba(22,163,74,.1)'};color:${dark ? '#4ade80' : '#16a34a'};letter-spacing:.5px}

        .rpm-tier-row{display:flex;align-items:center;gap:10px;padding:12px 16px 12px 38px;border-top:1px solid;font-size:12.5px}
        .rpm-tier-row-click{cursor:pointer;transition:.08s}
        .rpm-tier-row-click:hover{background:${track}}
        .rpm-tier-name{font-weight:700;min-width:75px}
        .rpm-tier-lbl{font-size:8.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase}
        .rpm-tier-val{font-size:12.5px;min-width:60px}
        .rpm-sdetail-tier{padding:12px 16px 16px 48px;border-top:1px solid ${hair}}

        .rpm-srow-wrap-svc{background:${dark ? 'rgba(255,255,255,.015)' : 'rgba(0,0,0,.008)'}}
        .rpm-srow-svc{padding-left:32px}
        .rpm-ov-wide{width:100% !important;max-width:280px}
        .rpm-ov-ta{resize:vertical;font-family:inherit;line-height:1.5;min-height:44px}
        .rpm-chips{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px}
        .rpm-chips button{font-size:11px;font-weight:700;padding:6px 13px;border-radius:99px;border:none;cursor:pointer;white-space:nowrap;transition:.15s;font-family:inherit;flex-shrink:0}
        .rpm-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 12px;font-size:11px}
        .rpm-sel{font-size:11px;font-weight:600;padding:5px 8px;border-radius:7px;border:1px solid;outline:none;font-family:inherit;cursor:pointer}
        .rpm-svc-list{border:1px solid;border-radius:14px;overflow:hidden}
        .rpm-svc-hdr{display:grid;grid-template-columns:90px 1fr 80px 80px 70px 60px;gap:6px;padding:9px 14px;font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid}
        .rpm-svc-row{display:grid;grid-template-columns:90px 1fr 80px 80px 70px 60px;gap:6px;padding:10px 14px;font-size:12px;align-items:center;border-bottom:1px solid;cursor:pointer;transition:.08s}
        .rpm-svc-row:hover{background:${track}}
        .rpm-svc-row:last-child{border-bottom:none}
        .rpm-svc-row-on{background:${greenSoft}}
        .rpm-sr-plat{font-size:10.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .rpm-sr-name{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
        .rpm-sr-cost,.rpm-sr-spec,.rpm-sr-ref{font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .rpm-r-on,.rpm-r-add{font-size:10px;font-weight:800;padding:5px 10px;border-radius:7px;border:none;cursor:pointer;transition:.12s;font-family:inherit;white-space:nowrap}
        .rpm-r-on:hover,.rpm-r-add:hover{transform:translateY(-1px)}
        .rpm-svc-detail{padding:10px 14px 14px;border-bottom:1px solid}
        .rpm-svc-specgrid{display:grid;grid-template-columns:55px 1fr 55px 1fr;gap:4px 10px;font-size:11.5px;font-weight:600}
        .rpm-add-trigger{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;padding:13px;border-radius:13px;font-size:12.5px;font-weight:700;cursor:pointer;transition:.15s;font-family:inherit;margin-top:12px}
        .rpm-add-trigger:hover{transform:translateY(-1px)}
        .rpm-featrow{display:flex;gap:13px;align-items:center;padding:14px 16px;border-bottom:1px solid ${hair}}
        .rpm-featrow:last-child{border-bottom:none}
        .rpm-fb2{font-size:8.5px;font-weight:800;letter-spacing:.6px;padding:2px 7px;border-radius:99px;margin-left:7px;vertical-align:1px}
        .rpm-sw{width:38px;height:22px;border-radius:99px;background:${grad};border:1px solid transparent;position:relative;transition:.18s;flex-shrink:0;cursor:pointer}
        .rpm-sw::after{content:"";position:absolute;width:16px;height:16px;border-radius:99px;background:#fff;top:2px;left:18px;transition:.18s;box-shadow:0 1px 3px rgba(0,0,0,.25)}
        .rpm-sw:not(.on){background:${track};border-color:${border}}
        .rpm-sw:not(.on)::after{left:2px}
        .rpm-dep{display:flex;gap:13px;padding:13px 16px;border-bottom:1px solid ${hair};align-items:flex-start}
        .rpm-dep:last-child{border-bottom:none}
        .rpm-dav{width:36px;height:36px;border-radius:99px;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
        .rpm-dinfo{flex:1;min-width:0}
        .rpm-dnm{font-size:13.5px;font-weight:700}
        .rpm-dfrow{display:flex;align-items:center;gap:10px;margin-top:5px}
        .rpm-dflab{width:46px;flex-shrink:0;font-size:8.5px;font-weight:800;letter-spacing:1px}
        .rpm-dfval{font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:6px;min-width:0}
        .rpm-dref{display:inline-flex;align-items:center;gap:6px;border:1px solid ${hair};border-radius:7px;padding:2px 8px;font-size:10.5px}
        .rpm-dright{display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0}
        .rpm-damt{font-size:15.5px;font-weight:700}
        .rpm-b-ok{background:linear-gradient(135deg,#34d399,#059669);color:#fff;font-size:11.5px;font-weight:800;padding:7px 14px;border-radius:9px;border:none;cursor:pointer;transition:.15s;font-family:inherit}
        .rpm-b-ok:hover{transform:translateY(-1px)}
        .rpm-b-no{font-size:11.5px;font-weight:700;padding:7px 12px;border-radius:9px;border:1px solid;background:none;cursor:pointer;transition:.15s;font-family:inherit}
        .rpm-b-no:hover{background:${redSoft}}
        .rpm-crumb{display:flex;align-items:center;gap:8px;font-size:12px;color:${muted};margin-bottom:14px}
        .rpm-crumb button{color:${accent};font-weight:700;display:inline-flex;align-items:center;gap:5px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:12px}
        .rpm-phead{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:18px}
        .rpm-phead h1{font-size:24px;font-weight:800;letter-spacing:-.5px;display:flex;align-items:center;gap:11px;flex-wrap:wrap;margin:0}
        .rpm-badge{font-size:10px;font-weight:800;padding:4px 11px;border-radius:99px}
        .rpm-urlpill{display:inline-flex;align-items:center;gap:7px;background:${card};border:1px solid ${border};border-radius:10px;padding:8px 13px;font-size:12.5px;color:${soft}}
        .rpm-urlpill button{color:${muted};display:flex;border:none;background:none;cursor:pointer}
        .rpm-urlpill button:hover{color:${accent}}
        .rpm-banner{display:flex;gap:11px;align-items:flex-start;padding:13px 16px;border-radius:13px;background:${amberSoft};border:1px solid color-mix(in srgb,${amber} 30%,transparent);font-size:12.5px;line-height:1.6;color:${soft};margin-bottom:18px}
        .rpm-banner svg{color:${amber};flex-shrink:0;margin-top:2px}
        .rpm-tabs{display:flex;gap:4px;padding:4px;border-radius:13px;background:${card};border:1px solid ${border};margin-bottom:20px}
        .rpm-tabs button{flex:1;padding:10px 12px;border-radius:9px;font-size:12.5px;font-weight:700;color:${muted};transition:.15s;white-space:nowrap;border:none;background:none;cursor:pointer;font-family:inherit}
        .rpm-tabs button.on{background:${grad};color:#fff}
        .rpm-tabs .rpm-n{font-size:9px;font-weight:800;background:${amberSoft};color:${amber};border-radius:99px;padding:1px 6px;margin-left:5px;vertical-align:1px}
        .rpm-tabs button.on .rpm-n{background:rgba(255,255,255,.25);color:#fff}
        @media(max-width:768px){
          .rpm-grid4{grid-template-columns:repeat(2,1fr)}
          .rpm-grid2{grid-template-columns:1fr}
          .rpm-phead h1{font-size:20px}
          .rpm-tabs{flex-wrap:wrap}
          .rpm-tabs button{flex:1 1 24%;min-width:0}
          .rpm-sdetail{padding:8px 16px 14px 16px}
          .rpm-svc-hdr{grid-template-columns:70px 1fr 70px 60px}
          .rpm-svc-hdr .rpm-sh-spec,.rpm-svc-hdr .rpm-sh-ref{display:none}
          .rpm-svc-row{grid-template-columns:70px 1fr 70px 60px}
          .rpm-sr-spec,.rpm-sr-ref{display:none}
          .rpm-margin{min-width:50px;font-size:11px}
          .rpm-tier-row{padding-left:28px;flex-wrap:wrap;gap:6px 10px}
          .rpm-tier-lbl{display:none}
          .rpm-subgrp{margin:6px 8px}
          .rpm-sdetail-tier{padding:12px 14px 14px 28px}
          .rpm-srow-svc{padding-left:20px}
          .rpm-ov-wide{max-width:100% !important}
        }
        @media(max-width:480px){
          .rpm-grid4{grid-template-columns:1fr}
          .rpm-grid2{grid-template-columns:1fr}
          .rpm-tabs button{font-size:11.5px;padding:9px 8px}
          .rpm-srow{padding:10px 14px}
          .rpm-pghead{padding:11px 14px}
          .rpm-pghead-plat{padding:12px 14px}
          .rpm-pghead-plat .rpm-pgname{font-size:13px}
          .rpm-subgrp{margin:5px 6px}
          .rpm-subghead{padding:11px 12px}
          .rpm-tier-row{padding-left:22px;padding-right:10px}
          .rpm-sdetail{padding:12px 14px 14px 14px}
          .rpm-sdetail-tier{padding:10px 12px 14px 22px}
          .rpm-sdl{width:90px;font-size:8.5px}
          .rpm-sprice{font-size:11px}
          .rpm-search-wrap{padding:9px 12px}
          .rpm-svc-hdr{grid-template-columns:1fr 60px 55px}
          .rpm-svc-hdr .rpm-sh-plat,.rpm-svc-hdr .rpm-sh-spec,.rpm-svc-hdr .rpm-sh-ref{display:none}
          .rpm-svc-row{grid-template-columns:1fr 60px 55px}
          .rpm-sr-plat,.rpm-sr-spec,.rpm-sr-ref{display:none}
          .rpm-sr-name{font-size:11px}
          .rpm-margin{min-width:auto;font-size:10.5px}
          .rpm-ov-in{width:80px !important}
          .rpm-ov-wide{width:100% !important;max-width:100% !important}
          .rpm-svc-specgrid{grid-template-columns:55px 1fr;gap:3px 8px;font-size:11px}
          .rpm-srow-svc{padding-left:16px}
        }
      `}</style>
      <div>
        <div className="rpm-crumb">
          <button onClick={() => onNavigate?.('lab')}><BackArrow />Reseller Lab</button>
          <span>/</span>
          <span>Panel Manager</span>
        </div>
        <div className="rpm-phead">
          <h1>
            {panelName || 'Your Panel'}
            <span className="rpm-badge" style={paused ? { background: amberSoft, color: amber } : { background: greenSoft, color: green }}>
              {paused ? '● PAUSED' : '● LIVE'}
            </span>
          </h1>
          <span className="rpm-urlpill m">
            bella-smm.nitro.ng
            <button onClick={() => copyText('https://bella-smm.nitro.ng', 'Link copied')}><CopyIco /></button>
          </span>
        </div>
        {paused && (
          <div className="rpm-banner">
            <WarnIco />
            <span><b style={{ color: t.text }}>Renewal missed.</b> Your wallet couldn't cover {N(25000)} on 1 Aug, so the storefront is paused. Nothing is deleted; customers and balances are safe. Fund the wallet and it's back instantly.</span>
            <button className="rpm-btn-p" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={() => toast?.info?.('Opening Wallet')}>Top up {N(25000)}</button>
          </div>
        )}
        <div className="rpm-tabs">
          {TABS.map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {l}
              {k === 'payments' && deposits.length > 0 && <span className="rpm-n">{deposits.length}</span>}
            </button>
          ))}
        </div>
        {tabContent[tab]()}
      </div>
    </>
  );
}
