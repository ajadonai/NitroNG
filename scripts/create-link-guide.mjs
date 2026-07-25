import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const content = `<h2>Why the Right Link Matters</h2>
<p>Every service on Nitro needs a specific type of link. Using the wrong one means your order can't be fulfilled — and nobody wants that. This quick guide shows you exactly which link to use for every platform and service type.</p>

<h2>Profile Link vs. Post Link</h2>
<p>There are two main link types on social media:</p>
<ul>
  <li><strong>Profile link</strong> — points to your account/page. Used for <strong>followers</strong> and <strong>subscribers</strong>.</li>
  <li><strong>Post link</strong> — points to a specific photo, video, reel, or tweet. Used for <strong>likes, views, comments, shares,</strong> and <strong>engagement</strong>.</li>
</ul>

<h2>Instagram</h2>
<h3>Profile link (for followers)</h3>
<p><code>https://instagram.com/yourpage</code></p>
<p>Go to your profile, tap the URL bar, and copy. It should look like <code>instagram.com/yourpage</code> with no extra path.</p>

<h3>Post link (for likes, views, comments)</h3>
<p><code>https://instagram.com/p/ABC123xyz</code><br/>
<code>https://instagram.com/reel/ABC123xyz</code></p>
<p>Open the post, tap the three dots, then "Copy link". Reels have <code>/reel/</code> in the URL, photos have <code>/p/</code>.</p>

<h2>TikTok</h2>
<h3>Profile link (for followers)</h3>
<p><code>https://tiktok.com/@yourpage</code></p>
<p>Go to your profile and copy the URL from the browser. It should be <code>tiktok.com/@yourpage</code>.</p>

<h3>Post link (for likes, views)</h3>
<p><code>https://tiktok.com/@yourpage/video/1234567890</code></p>
<p>Open the video, tap Share, then "Copy link". It will have <code>/video/</code> in the URL.</p>

<h2>Twitter / X</h2>
<h3>Profile link (for followers)</h3>
<p><code>https://x.com/yourhandle</code></p>

<h3>Post link (for likes, retweets, views)</h3>
<p><code>https://x.com/yourhandle/status/1234567890</code></p>
<p>Open the tweet, tap Share, then "Copy link". It will have <code>/status/</code> in the URL.</p>

<h2>YouTube</h2>
<h3>Channel link (for subscribers)</h3>
<p><code>https://youtube.com/@yourchannel</code></p>

<h3>Video link (for views, likes)</h3>
<p><code>https://youtube.com/watch?v=ABC123</code><br/>
<code>https://youtube.com/shorts/ABC123</code></p>
<p>Open the video, tap Share, then "Copy link". Regular videos have <code>/watch?v=</code>, Shorts have <code>/shorts/</code>.</p>

<h2>Facebook</h2>
<h3>Page link (for followers)</h3>
<p><code>https://facebook.com/yourpage</code></p>

<h3>Post link (for likes, comments, shares)</h3>
<p><code>https://facebook.com/yourpage/posts/1234567</code></p>
<p>Open the post, click the timestamp, and copy the URL from your browser.</p>

<h2>Threads</h2>
<h3>Profile link (for followers)</h3>
<p><code>https://threads.net/@yourpage</code></p>

<h3>Post link (for likes)</h3>
<p><code>https://threads.net/@yourpage/post/ABC123</code></p>

<h2>Spotify</h2>
<h3>Artist/playlist link (for followers)</h3>
<p><code>https://open.spotify.com/artist/ABC123</code></p>

<h3>Track link (for plays)</h3>
<p><code>https://open.spotify.com/track/ABC123</code></p>
<p>Open the song or artist, tap Share, then "Copy link".</p>

<h2>Quick Rule of Thumb</h2>
<table>
  <thead><tr><th>Service</th><th>Link type</th><th>What it looks like</th></tr></thead>
  <tbody>
    <tr><td>Followers / Subscribers</td><td>Profile link</td><td>Just the page URL, no extra path</td></tr>
    <tr><td>Likes / Views / Comments</td><td>Post link</td><td>URL with /p/, /video/, /status/, /watch, etc.</td></tr>
  </tbody>
</table>

<h2>Still Unsure?</h2>
<p>When you place an order on Nitro, there's a tip below the link field that tells you exactly which link type is needed. If you're still stuck, open a support ticket and we'll sort it out for you.</p>`;

const post = await p.blogPost.create({
  data: {
    title: 'How to Find the Right Link for Your Order',
    slug: 'how-to-find-the-right-link',
    excerpt: 'Not sure whether to use a profile link or a post link? This guide shows you exactly which link to use for every platform and service type.',
    content,
    category: 'Tutorials',
    showInHowTo: true,
    published: true,
    authorName: 'Nitro Team',
    sortOrder: 1,
  }
});
console.log('Created:', post.slug);
await p.$disconnect();
