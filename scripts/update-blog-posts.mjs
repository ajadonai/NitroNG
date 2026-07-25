import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// ═══ 1. Update existing post ═══
const linkGuide = `<h2>Profile Link vs. Post Link — What's the Difference?</h2>
<p>Social media services fall into two categories, and each needs a different link:</p>
<ul>
  <li><strong>Profile link</strong> — your account page. Use this for <strong>followers</strong> and <strong>subscribers</strong>.</li>
  <li><strong>Post link</strong> — a specific photo, video, reel, or tweet. Use this for <strong>likes, views, comments, shares,</strong> and other <strong>engagement</strong>.</li>
</ul>
<p>Using the wrong type is the #1 reason orders get cancelled. Here's how to copy the right one on every platform.</p>

<h2>How to Copy Your Instagram Link</h2>
<h3>Instagram profile link (for followers)</h3>
<p>Open the Instagram app, go to your profile, and tap the URL bar in your browser. Your link looks like:</p>
<p><code>https://instagram.com/yourpage</code></p>
<p>No extra path after your username — just <code>instagram.com/yourpage</code>.</p>

<h3>Instagram post link (for likes, views, comments)</h3>
<p>Open the post or reel, tap the three dots (<strong>...</strong>), then tap <strong>"Copy link"</strong>. Your link looks like:</p>
<p><code>https://instagram.com/p/ABC123xyz</code> (for photos)<br/>
<code>https://instagram.com/reel/ABC123xyz</code> (for reels)</p>

<h2>How to Copy Your TikTok Link</h2>
<h3>TikTok profile link (for followers)</h3>
<p>Open your TikTok profile in a browser or tap <strong>Share profile</strong> and copy the link:</p>
<p><code>https://tiktok.com/@yourpage</code></p>

<h3>TikTok video link (for likes, views)</h3>
<p>Open the video, tap <strong>Share</strong>, then tap <strong>"Copy link"</strong>:</p>
<p><code>https://tiktok.com/@yourpage/video/1234567890</code></p>
<p>The link must have <code>/video/</code> in it — that's how you know it's a video link, not a profile link.</p>

<h2>How to Copy Your Twitter / X Link</h2>
<h3>X profile link (for followers)</h3>
<p><code>https://x.com/yourhandle</code></p>

<h3>X post link (for likes, retweets, views)</h3>
<p>Tap the share icon on any tweet, then <strong>"Copy link"</strong>:</p>
<p><code>https://x.com/yourhandle/status/1234567890</code></p>
<p>The <code>/status/</code> part tells you it's a tweet link.</p>

<h2>How to Copy Your YouTube Link</h2>
<h3>YouTube channel link (for subscribers)</h3>
<p>Go to your channel page and copy the URL:</p>
<p><code>https://youtube.com/@yourchannel</code></p>

<h3>YouTube video link (for views, likes)</h3>
<p>Open the video, tap <strong>Share</strong>, then <strong>"Copy link"</strong>:</p>
<p><code>https://youtube.com/watch?v=ABC123</code> (regular video)<br/>
<code>https://youtube.com/shorts/ABC123</code> (Shorts)</p>

<h2>How to Copy Your Facebook Link</h2>
<h3>Facebook page link (for followers)</h3>
<p><code>https://facebook.com/yourpage</code></p>

<h3>Facebook post link (for likes, comments, shares)</h3>
<p>Click the timestamp on any post to open it, then copy the URL from your browser:</p>
<p><code>https://facebook.com/yourpage/posts/1234567</code></p>

<h2>How to Copy Your Threads Link</h2>
<h3>Threads profile link (for followers)</h3>
<p><code>https://threads.net/@yourpage</code></p>

<h3>Threads post link (for likes)</h3>
<p><code>https://threads.net/@yourpage/post/ABC123</code></p>

<h2>How to Copy Your Spotify Link</h2>
<h3>Spotify artist link (for followers)</h3>
<p>Open the artist page, tap <strong>Share</strong>, then <strong>"Copy link"</strong>:</p>
<p><code>https://open.spotify.com/artist/ABC123</code></p>

<h3>Spotify track link (for plays)</h3>
<p><code>https://open.spotify.com/track/ABC123</code></p>

<h2>Quick Reference</h2>
<table>
  <thead><tr><th>Service type</th><th>Link you need</th><th>How to tell</th></tr></thead>
  <tbody>
    <tr><td>Followers / Subscribers</td><td>Profile or channel link</td><td>Just your username in the URL, nothing after it</td></tr>
    <tr><td>Likes / Views / Comments</td><td>Post, video, or reel link</td><td>URL contains /p/, /reel/, /video/, /status/, /watch, etc.</td></tr>
  </tbody>
</table>

<h2>Nitro Helps You Get It Right</h2>
<p>When you place an order on Nitro, you'll see a tip below the link field showing exactly which link type the service needs. If you use the wrong type, Nitro will catch it and tell you before the order goes through — so you never waste money on a cancelled order.</p>

<p>Still confused? Open a support ticket inside your dashboard and we'll help you out.</p>`;

await p.blogPost.update({
  where: { slug: 'how-to-find-the-right-link' },
  data: {
    title: 'How to Copy Your Social Media Link for Orders (Instagram, TikTok, YouTube & More)',
    excerpt: 'Learn how to copy the right Instagram, TikTok, YouTube, Twitter, and Facebook link for your order. Profile link vs post link explained for every platform.',
    content: linkGuide,
  }
});
console.log('Updated: how-to-find-the-right-link');

// ═══ 2. Create safety post ═══
const safetyContent = `<h2>What Are Tracking Parameters?</h2>
<p>When you copy a link from Instagram, TikTok, or any social media app, the platform often adds extra characters to the end of the URL. These are called <strong>tracking parameters</strong>, and they look like this:</p>
<p><code>https://instagram.com/p/ABC123?igsh=MXJ2bGk...</code><br/>
<code>https://tiktok.com/@user/video/123?is_from_webapp=1&sender_device=pc</code><br/>
<code>https://x.com/user/status/123?s=20&t=abc123</code></p>
<p>Everything after the <strong>?</strong> is a tracking parameter. The actual link to your content is just the part before it.</p>

<h2>Why Tracking Parameters Are a Problem</h2>
<p>These parameters exist so the platform can track <strong>who shared the link, where it was shared, and which device was used</strong>. When you paste a tracked link into any growth service, here's what can happen:</p>
<ul>
  <li><strong>The platform can trace the link back to you.</strong> If Instagram sees the same <code>igsh</code> token appearing across hundreds of engagements, they know those engagements came from a shared link — not organic discovery.</li>
  <li><strong>Your account gets flagged.</strong> Social media platforms use these signals as part of their anti-manipulation systems. A tracked link with unnatural engagement patterns is a red flag.</li>
  <li><strong>It defeats the purpose.</strong> You're paying for growth that looks natural. Leaving tracking data in the link makes it look the opposite.</li>
</ul>

<h2>How to Remove Them Manually</h2>
<p>It's simple — just delete everything from the <strong>?</strong> onwards:</p>
<table>
  <thead><tr><th>Before (with tracking)</th><th>After (clean)</th></tr></thead>
  <tbody>
    <tr><td><code>instagram.com/p/ABC123<strong>?igsh=MXJ2...</strong></code></td><td><code>instagram.com/p/ABC123</code></td></tr>
    <tr><td><code>tiktok.com/@user/video/123<strong>?is_from_webapp=1</strong></code></td><td><code>tiktok.com/@user/video/123</code></td></tr>
    <tr><td><code>x.com/user/status/123<strong>?s=20&t=abc</strong></code></td><td><code>x.com/user/status/123</code></td></tr>
    <tr><td><code>facebook.com/page/posts/123<strong>?ref=sharing</strong></code></td><td><code>facebook.com/page/posts/123</code></td></tr>
  </tbody>
</table>

<h2>Common Tracking Parameters by Platform</h2>
<table>
  <thead><tr><th>Platform</th><th>Common trackers</th></tr></thead>
  <tbody>
    <tr><td>Instagram</td><td><code>?igsh=</code>, <code>?igshid=</code>, <code>?utm_source=</code></td></tr>
    <tr><td>TikTok</td><td><code>?is_from_webapp=</code>, <code>?sender_device=</code>, <code>?_t=</code></td></tr>
    <tr><td>Twitter / X</td><td><code>?s=</code>, <code>?t=</code>, <code>?ref_src=</code></td></tr>
    <tr><td>Facebook</td><td><code>?fbclid=</code>, <code>?ref=</code>, <code>?mibextid=</code></td></tr>
    <tr><td>YouTube</td><td><code>?si=</code>, <code>?feature=</code>, <code>?utm_source=</code></td></tr>
  </tbody>
</table>

<h2>Nitro Strips Tracking Parameters Automatically</h2>
<p>Here's the good news: <strong>Nitro already does this for you.</strong> When you paste any social media link, Nitro automatically detects and removes tracking parameters before placing your order. You don't have to clean the link yourself.</p>
<p>This means:</p>
<ul>
  <li>Your orders are placed with clean links every time</li>
  <li>No tracking data is shared with the service provider</li>
  <li>Your account stays safer by default</li>
</ul>
<p>We do this because we believe growth services should protect your account, not put it at risk. It's one of the things that makes Nitro different.</p>

<h2>What About YouTube?</h2>
<p>YouTube links are special — the <code>?v=</code> parameter is the actual video ID, not a tracker. Nitro knows the difference. We keep <code>?v=</code> and <code>?list=</code> (for playlists) but strip everything else like <code>?si=</code> and <code>?feature=</code>.</p>

<h2>Bottom Line</h2>
<p>Tracking parameters in links are a privacy and safety risk. They let platforms trace engagement back to a single source. While Nitro handles this automatically, it's good practice to be aware of it — especially if you use other services that might not clean your links.</p>
<p>When in doubt, delete everything after the <code>?</code> in any social media link. Your account will thank you.</p>`;

await p.blogPost.create({
  data: {
    title: 'Why You Should Never Share Social Media Links With Tracking Parameters',
    slug: 'tracking-parameters-in-social-media-links',
    excerpt: 'When you copy a link from Instagram, TikTok, or Twitter, it often includes hidden tracking data. Here\'s why that matters and how Nitro protects your account.',
    content: safetyContent,
    category: 'Safety',
    showInHowTo: true,
    published: true,
    authorName: 'Nitro Team',
    sortOrder: 2,
  }
});
console.log('Created: tracking-parameters-in-social-media-links');

await p.$disconnect();
