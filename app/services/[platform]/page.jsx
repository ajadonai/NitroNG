import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ServicePlatformView from '@/components/service-platform-page';
import { msg } from '@/lib/i18n';

export const revalidate = 300;

const PLATFORM_ORDER = ['instagram', 'tiktok', 'youtube', 'x', 'facebook', 'telegram', 'spotify', 'snapchat', 'linkedin', 'twitch', 'discord', 'whatsapp', 'audiomack', 'boomplay', 'google', 'threads', 'kick', 'soundcloud', 'bluesky', 'deezer'];

export async function generateStaticParams() {
  return PLATFORM_ORDER.map(platform => ({ platform }));
}

const PLATFORM_META = {
  instagram: {
    name: 'Instagram',
    h1: msg('Buy Instagram Followers, Likes and Views in Nigeria'),
    title: 'Buy Instagram Followers in Nigeria | Naira Pricing',
    metaDesc: 'Buy Instagram followers, likes, views, story views and comments in Nigeria. Naira pricing, gradual delivery, refill covered services. Start from ₦1,000.',
    heroDesc: msg('Instagram is where most Nigerian creators, brands and small businesses are judged, and an empty looking profile costs you customers before anyone reads a word. Nitro lets you promote your Instagram account and posts with services priced in Naira, delivered gradually so the growth looks like growth. Fund your wallet from ₦1,000 and order in under a minute.'),
    mainService: 'followers',
    kw: 'buy Instagram followers Nigeria',
    whatYouGet: [
      msg('Followers on your profile'),
      msg('Likes on individual posts'),
      msg('Reel and video views — the cheapest way to test us'),
      msg('Story views to lift the visibility of what you post daily'),
      msg('Comments, including comments from real Nigerian accounts so the engagement looks local'),
      msg('Saves on posts — one of the strongest signals Instagram weighs'),
      msg('Reels engagement bundles for pushing a specific piece of content'),
    ],
    whySection: [
      // Said "around 140 services" and "delivery rate is 91%". Both were typed
      // into a static copy table and both had drifted — the tested catalogue is
      // 269, and the delivery figure is computed live with a floor. The argument
      // never needed either number to land, so it no longer carries one: a
      // figure in prose nobody can recompute is a figure that goes quietly stale.
      msg('We test services before we list them. Most panels connect to a supplier API and mirror thousands of listings without checking a single one. We pull from several suppliers, test, and only list what actually delivers. That is why our tested catalogue runs to a few hundred services instead of fifteen thousand, and why the order you place is one we have already watched deliver.'),
      msg('Gradual delivery is built in. Large Instagram orders can be spread over days instead of dumped at once. A page going from 400 to 40,000 followers overnight is the pattern that attracts attention. A page growing steadily is not. The option is there at checkout and we recommend using it.'),
      msg('Comments from real Nigerian accounts. If you are selling to a Nigerian audience, engagement from foreign accounts looks wrong on your posts and everyone can tell. This is one of the few things on the site you genuinely cannot get from an international panel.'),
    ],
    faq: [
      { q: msg('Do you need my Instagram password?'), a: msg('No. We only need your public profile link or post link. No promotion service needs your password, and if one asks for it, that is a bot tool rather than a promotion service. Never hand it over.') },
      { q: msg('Will buying Instagram followers get my account banned?'), a: msg('A permanent ban purely for buying followers is rare. What is more common is that some of the accounts get removed in an Instagram purge, or that a sudden unnatural spike reduces your reach. You lower that risk by starting small, using gradual delivery, keeping your posting consistent and growing in proportion to your account size. Nobody can promise you zero risk, and any panel that does is telling you something they cannot control.') },
      { q: msg('Why do my Instagram followers drop?'), a: msg('Instagram periodically removes accounts it judges to be fake or inactive, and any of those following you disappear when it does. Some drop is normal on every follower service anywhere. On Nitro, Standard services carry refill for 30 days and Premium carries it for the life of the order, on services marked refill included, so drops within the window get replaced automatically.') },
      { q: msg('How fast does an Instagram order start?'), a: msg('Many Instagram services start within minutes. Some queue at the supplier and take longer. The expected speed is shown on each service before you order, and you can watch progress live in the dashboard.') },
      { q: msg('Do I have to make my Instagram account public?'), a: msg('Yes, at least while the order runs. A private account cannot receive followers or engagement from a promotion service, and orders placed on a private account will fail. Switch it public before ordering and you can change it back afterwards.') },
    ],
  },
  tiktok: {
    name: 'TikTok',
    dbPlatform: 'tiktok',
    h1: msg('Buy TikTok Followers, Views and Likes in Nigeria'),
    title: 'Buy TikTok Followers and Views in Nigeria',
    metaDesc: 'Buy TikTok followers, views, likes, shares and livestream viewers in Nigeria. Naira pricing, gradual delivery, refill covered services. Start from ₦1,000.',
    heroDesc: msg('TikTok is the platform Nigerians actually live on, and it is the one where a single video can change everything overnight. The problem is that the algorithm decides in the first few hours whether a video travels, and a video that starts flat usually stays flat. Nitro lets you put an early push behind your content in Naira, from ₦1,000.'),
    mainService: 'followers',
    kw: 'buy TikTok followers Nigeria',
    whatYouGet: [
      msg('Followers on your profile'),
      msg('Video views — the cheapest entry point and the one that matters most for reach'),
      msg('Likes on individual videos'),
      msg('Shares, which TikTok weighs heavily in distribution'),
      msg('Comments to make a video look like a conversation rather than a broadcast'),
      msg('Livestream viewers for pushing a live session'),
    ],
    whySection: [
      msg('Views early beat views late. TikTok tests a video on a small audience and expands based on how that audience behaves. Engagement that arrives in the first hours is worth far more than the same engagement three days later. Order as soon as you post, not after the video has already stalled.'),
      msg('We list what works. TikTok services degrade faster than almost any other platform because TikTok updates its systems constantly. We test before listing and pull services when their delivery drops, which is the whole reason our catalogue is deliberately small.'),
      msg('Naira, and payment you already use. No dollar conversion, no foreign card required. Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.'),
    ],
    faq: [
      { q: msg('Will buying TikTok views get my account banned?'), a: msg('TikTok bans for buying views are rare. TikTok cares far more about watch time and completion rate than about raw view count, so the realistic risk is not a ban but wasted spend: views on a video people scroll past will not push it further. Start small, keep posting, and put the push behind content that is already holding attention.') },
      { q: msg('Does buying TikTok views actually help a video go viral?'), a: msg('It can help a video get tested by a wider audience, but it cannot make people watch to the end. TikTok expands distribution based on completion rate and rewatches, so a strong hook matters more than the view count. Treat promotion as an accelerator for good content, not a substitute for it.') },
      { q: msg('How soon after posting should I order?'), a: msg('As soon as possible, ideally within the first hour. TikTok decides early whether to widen a video\'s distribution, so engagement arriving in that first window carries the most weight.') },
      { q: msg('Do you need my TikTok password?'), a: msg('No. We only need your public profile or video link. We never ask for passwords and you should never give them to any promotion service.') },
      { q: msg('Can I buy TikTok followers with Opay or PalmPay?'), a: msg('Yes. Payments run through Flutterwave, so Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank transfer or card, and crypto all work. Everything is priced in Naira with no dollar conversion.') },
    ],
  },
  youtube: {
    name: 'YouTube',
    h1: msg('Buy YouTube Subscribers, Views and Watch Hours in Nigeria'),
    title: 'Buy YouTube Subscribers and Watch Hours in Nigeria',
    metaDesc: 'Buy YouTube subscribers, views, watch hours, likes and comments in Nigeria. Naira pricing, gradual delivery, refill covered services.',
    heroDesc: msg('Getting to YouTube monetisation means 1,000 subscribers and 4,000 watch hours, and most Nigerian creators stall somewhere in the middle of that with good videos nobody has found yet. Nitro lets you promote your channel and videos in Naira, with gradual delivery, from ₦1,000.'),
    mainService: 'subscribers',
    kw: 'buy YouTube subscribers Nigeria',
    whatYouGet: [
      msg('Subscribers'),
      msg('Video views'),
      msg('Watch hours — the hardest threshold to reach organically'),
      msg('Likes'),
      msg('Comments to make a video look active'),
    ],
    whySection: [
      msg('YouTube is the strictest platform and we treat it that way. YouTube audits channels around monetisation more seriously than any other platform audits anything. Subscribers and watch hours that do not behave like real viewers can put a monetisation application at risk. We list conservative, higher quality YouTube services rather than the cheapest available, and we would rather sell you less than get your channel flagged.'),
      msg('Gradual delivery matters more here than anywhere. A channel gaining 5,000 subscribers in a day, on videos with 200 views each, is a contradiction that is visible to anyone looking. Spread it out.'),
      msg('Honest advice over a bigger sale. If you are close to monetisation, be conservative. Promote the videos that already hold attention rather than buying subscribers in bulk. Watch hours are worth more to you than subscriber count, and a channel with real retention passes review.'),
    ],
    faq: [
      { q: msg('Can buying subscribers get my channel demonetised?'), a: msg('It can contribute to a failed monetisation review if the growth pattern does not look real. YouTube reviews channels around the monetisation threshold and looks at whether subscribers and watch time behave like genuine viewers. Use gradual delivery, choose higher quality tiers, and keep your promoted growth in proportion to your actual view counts.') },
      { q: msg('Do bought watch hours count toward the 4,000 hour threshold?'), a: msg('Watch hours delivered through promotion register as watch time on your videos, but YouTube evaluates the quality and pattern of that watch time during monetisation review. Treat it as support for genuine viewership rather than a shortcut around it, and keep publishing content people actually finish.') },
      { q: msg('How long do YouTube orders take?'), a: msg('Views and likes usually start within hours. Subscribers and watch hours are delivered more slowly by design, often over several days, because fast delivery on these is exactly what looks wrong. The expected speed is shown on each service before you order.') },
      { q: msg('Do you need access to my YouTube channel?'), a: msg('No. We only need the public channel link or video link. We never ask for your Google account details or channel access.') },
      { q: msg('Which is better to buy, subscribers or watch hours?'), a: msg('Watch hours, in most cases. Watch time is the harder threshold to reach organically and it is a stronger signal of a healthy channel. Subscribers without matching watch time is the combination that draws scrutiny.') },
    ],
  },
  x: {
    name: 'X',
    dbPlatform: 'Twitter/X',
    h1: msg('Buy X (Twitter) Followers, Likes and Views in Nigeria'),
    title: 'Buy Twitter (X) Followers in Nigeria',
    metaDesc: 'Buy X followers, likes, retweets, views and bookmarks in Nigeria. Naira pricing, gradual delivery, refill covered services. Start from ₦1,000.',
    heroDesc: msg('Nigerian Twitter moves faster than any other corner of the platform, and on X your follower count is the first thing anyone checks before deciding whether to take you seriously. Nitro lets you build that base and push individual posts in Naira, from ₦1,000.'),
    mainService: 'followers',
    kw: 'buy X Twitter followers Nigeria',
    whatYouGet: [
      msg('Followers'),
      msg('Likes on individual posts'),
      msg('Post views — the cheapest way to test'),
      msg('Video views'),
      msg('Retweets to push a post into more timelines'),
      msg('Bookmarks, which X counts as a strong quality signal'),
    ],
    whySection: [
      msg('X is the most forgiving of the major platforms. X enforces less aggressively around purchased engagement than Instagram or YouTube, which makes it a reasonable place to build a base. That is an observation about the platform, not a promise from us.'),
      msg('Post views are cheap enough to experiment with. At roughly ₦1,090 per thousand, pushing a single post costs very little. That makes X the best platform on the site for testing what actually resonates before spending real money.'),
      msg('Naira and local payment. No FX, no foreign card. Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.'),
    ],
    faq: [
      { q: msg('Will buying X followers get my account suspended?'), a: msg('Suspension purely for having purchased followers is uncommon on X, which enforces less aggressively here than Instagram or YouTube. The realistic outcomes are some follower drop over time and a follower to engagement ratio that looks off if you buy followers without ever buying engagement. Nobody can promise zero risk on any platform.') },
      { q: msg('Do you need my X password?'), a: msg('No. We only need your public profile link or post link. We never ask for passwords or login codes.') },
      { q: msg('Can I promote a single tweet rather than my whole account?'), a: msg('Yes. Paste the individual post link and buy likes, views, retweets or bookmarks against that post specifically. This is usually a better use of money than buying followers, because it pushes content people can actually respond to.') },
      { q: msg('Why did my X follower count drop after a few days?'), a: msg('X periodically removes accounts it judges to be automated or inactive, and any of those following you disappear when that happens. Some drop is normal on every follower service. Standard services carry refill for 30 days and Premium for the life of the order, on services marked refill included.') },
      { q: msg('How much does it cost to buy 1,000 X followers in Nigeria?'), a: msg('Around ₦5,409 at the time of writing, though prices move with quality tier and exchange rate. The live price is always shown on the service before you order, in Naira, with no dollar conversion.') },
    ],
  },
  facebook: {
    name: 'Facebook',
    h1: msg('Buy Facebook Page Likes, Followers and Views in Nigeria'),
    title: 'Buy Facebook Page Likes and Followers in Nigeria',
    metaDesc: 'Buy Facebook page likes, followers, post likes, video views and group members in Nigeria. Naira pricing, refill covered services. Start from ₦1,000.',
    heroDesc: msg('Facebook is still the largest platform in Nigeria by user count, and for businesses selling to customers outside Lagos it is often the only one that matters. A business page with 40 likes does not close sales. Nitro lets you build that page in Naira, from ₦1,000.'),
    mainService: 'page likes',
    kw: 'buy Facebook page likes Nigeria',
    whatYouGet: [
      msg('Page followers — among the cheapest follower services on the site'),
      msg('Post likes'),
      msg('Video views'),
      msg('Page likes to lift the number people see on your page'),
      msg('Group members for building a community around a business or interest'),
    ],
    whySection: [
      msg('This is where Nigerian buying actually happens. Facebook Marketplace, business pages and groups drive a huge share of real Nigerian commerce, especially outside the major cities. A page that looks established converts better, and Facebook is the cheapest platform on our site to make that happen.'),
      msg('It is the best value on the catalogue. Facebook page followers run at roughly ₦1,549 per thousand against around ₦3,818 for Instagram. If your budget is tight and your customers are on Facebook, this is where the money goes furthest.'),
      msg('Group members for community building. If you are running a business community, a class or a marketplace group, seeded membership makes the group look worth joining. Empty groups stay empty.'),
      msg('Promote posts, not just the page. A page like is a one time number. A promoted post gets in front of people while it is running and can pull real followers behind it. If you only have budget for one thing, put it behind a post that already shows what you sell rather than behind the page count.'),
    ],
    faq: [
      { q: msg('Do you need my Facebook password or admin access?'), a: msg('No. We only need the public link to your page, post or group. We never ask for passwords, admin access or login codes.') },
      { q: msg('Does my Facebook page need to be public?'), a: msg('Yes. The page or post must be publicly visible for an order to deliver. Private or restricted content will cause the order to fail, and in that case the value returns to your Nitro wallet.') },
      { q: msg('Can I buy members for a Facebook group?'), a: msg('Yes, group member services are available. The group needs to be public or set to allow joining without approval, since manual approval will block delivery.') },
      { q: msg('Will buying page likes affect my Facebook ads?'), a: msg('Buying page likes does not directly affect your ad account, but it can affect your results. Ad targeting that uses your page audience will be weaker if that audience does not match your real customers. If you run ads seriously, promote posts and videos rather than stacking page likes.') },
      { q: msg('How much does it cost to buy 1,000 Facebook page followers in Nigeria?'), a: msg('Around ₦1,549 at the time of writing, which makes Facebook one of the cheapest platforms on Nitro. Live prices are shown on each service in Naira before you order.') },
    ],
  },
  telegram: {
    name: 'Telegram',
    h1: msg('Buy Telegram Members, Views and Reactions in Nigeria'),
    title: 'Buy Telegram Channel Members in Nigeria',
    metaDesc: 'Buy Telegram channel members, group members, post views and reactions in Nigeria. Naira pricing from ₦158 per thousand views. Start from ₦1,000.',
    heroDesc: msg('Telegram is where Nigerian crypto, fintech, trading and community groups actually organise, and on Telegram nobody joins a channel with 30 members. Nitro lets you build that base in Naira, and Telegram views are the cheapest service on the entire site.'),
    mainService: 'members',
    kw: 'buy Telegram members Nigeria',
    whatYouGet: [
      msg('Channel members'),
      msg('Group members for communities that run on discussion'),
      msg('Post views — by far the cheapest service we sell'),
      msg('Reactions'),
    ],
    whySection: [
      msg('Member count is the whole first impression on Telegram. There is no bio, no feed and no profile to judge. Someone sent a link, they open it, and they decide based on the member count and whether recent posts have views. A channel that looks dead reads as abandoned even when it is not.'),
      msg('Post views cost almost nothing. At around ₦158 per thousand, Telegram views are the cheapest thing on Nitro by a wide margin. If you want to test how we work before spending anything meaningful, this is the place to do it.'),
      msg('Built for the communities that use it here. Nigerian crypto, forex, betting tips, tech and business communities run on Telegram. If you are launching one, the seeded start is often the difference between it growing and it stalling in week one.'),
      msg('Views on posts do more than members. A channel with 4,000 members where recent posts show 60 views tells the visitor everything. Views on your last few posts are what make a channel look alive, and at ₦158 per thousand they cost almost nothing. If you are choosing between the two, buy views.'),
    ],
    faq: [
      { q: msg('Does my Telegram channel need to be public?'), a: msg('Yes. The channel or group needs a public username or an open invite link for members to be added. Private channels requiring manual approval will block delivery and the order will fail.') },
      { q: msg('Do Telegram members leave after joining?'), a: msg('Some do, which is normal across every provider. On refill included services, Standard covers drops for 30 days and Premium covers them for the life of the order. Post views do not drop at all, since a view is a recorded event rather than an ongoing subscription.') },
      { q: msg('Do you need my Telegram account or bot access?'), a: msg('No. We only need the public link to your channel, group or post. We never ask for account access, phone numbers or login codes.') },
      { q: msg('Can I buy members for a Telegram group as well as a channel?'), a: msg('Yes, both channel members and group members are available. Groups need to allow joining without manual approval for the order to deliver.') },
      { q: msg('How cheap are Telegram post views?'), a: msg('Around ₦158 per thousand at the time of writing, which makes them the cheapest service on Nitro. This is the least expensive way to test whether the platform works for you before spending anything real.') },
    ],
  },
  spotify: {
    name: 'Spotify',
    h1: msg('Spotify Promotion for Nigerian Artists: Plays, Followers and Playlist Adds'),
    title: 'Buy Spotify Plays and Followers in Nigeria',
    metaDesc: 'Spotify promotion for Nigerian artists. Plays, followers, monthly listeners and playlist adds, priced in Naira. Gradual delivery. Start from ₦1,000.',
    heroDesc: msg('Nigerian music travels further than almost anything else the country exports, but a new release with 40 plays does not get picked up by playlists, blogs or the algorithm. Nitro lets you put a first push behind a track in Naira, delivered gradually, from ₦1,000.'),
    mainService: 'plays',
    kw: 'buy Spotify plays Nigeria',
    whatYouGet: [
      msg('Plays on individual tracks'),
      msg('Followers on your artist profile'),
      msg('Monthly listeners — the number A&R people and playlist curators actually look at'),
      msg('Playlist adds to get a track into rotation'),
    ],
    whySection: [
      msg('Monthly listeners is the number that opens doors. Playlist curators, promoters and labels check monthly listeners before they check anything else. An artist sitting at a few hundred rarely gets a reply. It is not fair, but it is how the filtering works, and it is the number worth building deliberately.'),
      msg('Gradual delivery matters a lot on Spotify. Streaming platforms are more sensitive to unnatural play patterns than social platforms are, because plays connect to royalty payments. A track jumping from 50 to 500,000 plays in a day is the pattern that draws scrutiny. Spread it out, keep the volume proportionate to your profile, and treat it as a first push rather than a growth plan.'),
      msg('Priced in Naira for Nigerian artists. No dollar conversion. Fund from Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.'),
      msg('Honest limit: promotion gets a track heard by more people. It does not make them save it, add it to their own playlists or come back. Spotify\'s algorithm weighs saves and repeat listens more than raw play count, so the push works best behind a track that already holds attention.'),
    ],
    faq: [
      { q: msg('Can Spotify detect promoted plays?'), a: msg('Spotify does monitor for unnatural streaming patterns, because plays are tied to royalty payments. The risk is not usually a ban but the removal of plays that do not pass its filters. Gradual delivery and volumes proportionate to your existing profile are the practical way to lower that risk, and no provider can promise you zero risk.') },
      { q: msg('Do you need my Spotify for Artists login?'), a: msg('No. We only need your public track, profile or playlist link. We never ask for login details to any platform.') },
      { q: msg('Will promotion increase my Spotify royalties?'), a: msg('Any plays that register do count toward streams, but promotion should not be treated as a way to generate royalty income. The economics do not work, since the cost per play is higher than what a play pays out. The reason to promote is discovery and credibility, not revenue.') },
      { q: msg('How long do Spotify orders take?'), a: msg('Spotify services are delivered slowly on purpose, usually over several days, because fast delivery on a streaming platform is exactly what looks wrong. The expected speed is shown on each service before you order.') },
      { q: msg('Does this work for Audiomack or Boomplay?'), a: msg('Not currently. Spotify, and where available SoundCloud, are the streaming platforms on the catalogue today. If Audiomack or Boomplay would be useful to you, tell us on WhatsApp, since demand is how we decide what to source next.') },
    ],
  },
  snapchat: {
    name: 'Snapchat',
    h1: msg('Buy Snapchat Followers and Story Views in Nigeria'),
    title: 'Buy Snapchat Followers and Story Views in Nigeria',
    metaDesc: 'Buy Snapchat followers, story views and engagement in Nigeria. Naira pricing, refill covered services. Start from ₦1,000.',
    heroDesc: msg('Snapchat has a smaller Nigerian audience than Instagram or TikTok, but it is a loyal one, and creators who post there daily tend to have unusually engaged followings. Nitro carries Snapchat services priced in Naira, from ₦1,000.'),
    mainService: 'followers',
    kw: 'buy Snapchat followers',
    whatYouGet: [
      msg('Followers on your Snapchat profile'),
      msg('Story views to lift the reach of what you post each day'),
      msg('Likes and video likes on individual posts'),
    ],
    whySection: [
      msg('Fewer providers do Snapchat properly. It is a smaller market, so most panels either do not list it or list whatever their supplier offers without checking. We test before listing, which is why our Snapchat selection is small rather than long.'),
      msg('Be aware of the pricing. Snapchat is the most expensive platform on our catalogue, running several times the cost of Instagram or Facebook for comparable services. That is a supply reality across the whole industry, not a Nitro markup. We would rather tell you upfront than let you find it at checkout. If your budget is tight and your audience is not specifically on Snapchat, Instagram or Facebook will stretch further.'),
    ],
    faq: [
      { q: msg('Do you need my Snapchat login?'), a: msg('No. We only need your public profile or post link. We never ask for passwords or login codes for any platform.') },
      { q: msg('Why is Snapchat more expensive than Instagram?'), a: msg('Snapchat services cost more across the entire industry because the supply is thinner and harder to source. It is not a Nitro specific markup. If cost matters more than the platform, Instagram and Facebook deliver considerably more for the same money.') },
      { q: msg('Does my Snapchat account need to be public?'), a: msg('Yes. Your profile and the content being promoted need to be publicly visible for delivery to work. Private accounts will cause the order to fail, and the value returns to your Nitro wallet.') },
      { q: msg('Do Snapchat followers drop?'), a: msg('Some drop is normal on any follower service. Standard services carry refill for 30 days and Premium for the life of the order, on services marked refill included. Budget carries no refill.') },
    ],
  },
  linkedin: {
    name: 'LinkedIn',
    h1: msg('Buy LinkedIn Followers, Connections and Post Engagement in Nigeria'),
    title: 'Buy LinkedIn Followers and Post Likes in Nigeria',
    metaDesc: 'Buy LinkedIn followers, connections, post likes and endorsements in Nigeria. Naira pricing, gradual delivery. Start from ₦1,000.',
    heroDesc: msg('LinkedIn matters more to Nigerian professionals every year, whether you are consulting, recruiting, selling B2B or building a personal profile that opens doors abroad. A post with three likes reads as ignored. Nitro carries LinkedIn services priced in Naira, from ₦1,000.'),
    mainService: 'followers',
    kw: 'buy LinkedIn followers Nigeria',
    whatYouGet: [
      msg('Followers on a personal profile or company page'),
      msg('Connections to build out your network'),
      msg('Post likes to give a post the early traction that pushes it into feeds'),
      msg('Skill endorsements on your profile'),
    ],
    whySection: [
      msg('Early engagement is what moves a LinkedIn post. LinkedIn\'s feed weighs how a post performs in its first hour heavily. A post that gets early likes reaches connections of connections. A post that starts flat is quietly buried. If you are publishing something that matters, the first hour is where a small push does the most work.'),
      msg('Go gently here. LinkedIn is a professional network where your real name and career are attached. Volumes should stay modest and believable. A consultant with 400 connections and a post carrying 5,000 likes is doing damage, not marketing. Keep it in proportion or skip it.'),
    ],
    faq: [
      { q: msg('Do you need my LinkedIn password?'), a: msg('No. We only need your public profile, company page or post link. We never ask for passwords or login access.') },
      { q: msg('Is it risky to buy LinkedIn engagement?'), a: msg('LinkedIn enforces less visibly than Instagram or YouTube, but it is a professional network where your real identity is attached, so the reputational risk is higher than the platform risk. Keep volumes modest and proportionate to your actual network. A post with engagement wildly out of step with your connection count is noticeable to the humans reading it.') },
      { q: msg('Does my LinkedIn profile need to be public?'), a: msg('Yes. Your profile and any post being promoted need to be publicly visible for delivery to work.') },
      { q: msg('Can I promote a company page as well as a personal profile?'), a: msg('Yes. Company page followers and personal profile followers are both available. Paste whichever link matches what you are promoting.') },
    ],
  },
  twitch: {
    name: 'Twitch',
    h1: msg('Buy Twitch Followers and Viewers in Nigeria'),
    title: 'Buy Twitch Followers and Viewers in Nigeria',
    metaDesc: 'Buy Twitch followers, live viewers and chat engagement in Nigeria. Naira pricing, no foreign card needed. Start from ₦1,000.',
    heroDesc: msg('Nigeria\'s gaming and streaming community is small but growing quickly, and on Twitch the cold start problem is brutal: nobody watches a stream with zero viewers, so it stays at zero viewers. Nitro carries Twitch services priced in Naira, from ₦1,000.'),
    mainService: 'followers',
    kw: 'buy Twitch followers',
    whatYouGet: [
      msg('Followers on your channel'),
      msg('Live viewers during a stream'),
      msg('Chat engagement so a stream does not look empty'),
    ],
    whySection: [
      msg('It solves the cold start, and only the cold start. Twitch\'s discovery pushes streams that already have viewers, which is circular and punishing for anyone new. A base viewer count gets you into the browse listings where real people can find you. That is genuinely useful, and it is the whole benefit.'),
      msg('Be clear on what it does not do. Purchased viewers do not chat, do not subscribe, do not follow your socials and do not come back tomorrow. Twitch Affiliate and Partner requirements are based on real engaged viewership, and inflated numbers do not help you get there. Use this to look alive while you build something worth watching, not as a route to monetisation.'),
      msg('No foreign card needed. Most Twitch services are sold in dollars by foreign providers. Ours are in Naira, paid through Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.'),
    ],
    faq: [
      { q: msg('Will bought viewers count toward Twitch Affiliate?'), a: msg('No, not reliably. Twitch Affiliate and Partner status are based on average concurrent viewers over time alongside other requirements, and Twitch evaluates whether that viewership behaves like real people. Treat purchased viewers as a way to appear in browse listings, not as a route to monetisation.') },
      { q: msg('When should I order live viewers?'), a: msg('Just before or immediately after you go live, since viewers are only useful while the stream is running. Ordering after the stream ends does nothing.') },
      { q: msg('Do you need my Twitch login?'), a: msg('No. We only need your public channel link. We never ask for passwords or account access.') },
      { q: msg('Do Twitch followers drop?'), a: msg('Some drop is normal, as with any platform. Refill applies on services marked refill included, covering 30 days on Standard and the life of the order on Premium.') },
    ],
  },
  discord: {
    name: 'Discord',
    h1: msg('Buy Discord Server Members in Nigeria'),
    title: 'Buy Discord Members in Nigeria | Naira Pricing',
    metaDesc: 'Buy Discord server members and online users in Nigeria. Naira pricing, no foreign card needed. Start from ₦1,000.',
    heroDesc: msg('Discord runs most of the serious community activity in Nigerian gaming, crypto and tech, and a server with eleven members does not convince anyone to join. Nitro carries Discord services priced in Naira, from ₦1,000.'),
    mainService: 'members',
    kw: 'buy Discord members',
    whatYouGet: [
      msg('Server members to build out your member count'),
      msg('Online users so the server looks active rather than abandoned'),
    ],
    whySection: [
      msg('Member count is the join decision. Someone clicks an invite link and sees a number. That number decides whether they join or close the tab. For a new project, a new community or a new game server, the first hundred members are the hardest to get and the most valuable to have.'),
      msg('Online count matters as much as total members. A server with 5,000 members and four people online reads as dead. If you are seeding a server, the online user services do more for how it feels than raw member count does.'),
      msg('Be honest with yourself about what this does. These members do not talk, do not participate and do not build your community for you. They make the room look occupied so real people are willing to walk in. Everything after that is on you.'),
      msg('No foreign card needed. Priced in Naira, paid through Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.'),
    ],
    faq: [
      { q: msg('What kind of Discord invite link do you need?'), a: msg('A permanent invite link with no expiry and no maximum uses. Temporary links or links with a use limit will cause the order to stop partway, and in that case the undelivered value returns to your Nitro wallet.') },
      { q: msg('Will bought Discord members chat or participate?'), a: msg('No. These are member and online counts, not active participants. They make a new server look established so real people are willing to join. Building actual conversation is on you.') },
      { q: msg('Can Discord ban my server for this?'), a: msg('Discord acts against servers involved in spam, scams or automated abuse rather than against member counts specifically, but there is real risk in any inflated growth and nobody can promise you otherwise. Keep the volume proportionate and make sure the server itself is genuinely doing something.') },
      { q: msg('Do you need admin access to my server?'), a: msg('No. We only need a public permanent invite link. We never ask for admin access, bot tokens or your Discord login.') },
    ],
  },
  whatsapp: {
    name: 'WhatsApp',
    h1: msg('Buy WhatsApp Channel Followers and Group Members in Nigeria'),
    title: 'Buy WhatsApp Channel Followers in Nigeria | Naira Pricing',
    metaDesc: 'Buy WhatsApp channel followers, group members and status views in Nigeria. Naira pricing, no foreign card needed. Start from ₦1,000.',
    heroDesc: msg('WhatsApp is where Nigerian business actually happens — the orders, the enquiries, the follow-ups. A channel with nine followers or a group nobody joins does not get used, and the customers who would have bought from you never see the post. Nitro carries WhatsApp channel, group and status services priced in Naira, from ₦1,000.'),
    mainService: 'followers',
    kw: 'buy WhatsApp channel followers Nigeria',
    whatYouGet: [
      msg('Channel followers, so a new channel is worth subscribing to'),
      msg('Group members to fill a room before you invite real people into it'),
      msg('Status and channel post views'),
      msg('Emoji reactions on channel posts'),
    ],
    whySection: [
      msg('A channel with no followers gets no forwards. WhatsApp shows the follower count before anyone reads a single post, and on a platform where sharing happens by forwarding rather than by algorithm, that number decides whether your post leaves the channel at all.'),
      msg('Groups are where Nigerian trade actually runs. Wholesale, resale, logistics, church, school runs — the group is the shop. An empty group reads as a shop nobody visits, and the people you most want in it are the least likely to be the first ones there.'),
      msg('Your link has to be public and open. A channel needs its invite link on, a group needs a link that is not capped or expired. If the link stops working partway, whatever was not delivered returns to your Nitro wallet.'),
      msg('Nobody needs your phone or your login. We work from the public link and nothing else. We never ask for a verification code, and anyone who does is trying to take your account.'),
      msg('No foreign card needed. Priced in Naira, paid through Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.'),
    ],
    faq: [
      { q: msg('What link do you need for a WhatsApp channel?'), a: msg('The public channel link, the one that starts whatsapp.com/channel. Open your channel, tap the name, and copy the invite link. We never need your phone number or your login.') },
      { q: msg('Will WhatsApp ban my number for this?'), a: msg('Followers are added to a channel or group, not to your account, so your number is not doing anything WhatsApp would act on. The real risk on WhatsApp has always been mass messaging strangers, which is a different thing entirely and not something we do.') },
      { q: msg('Do the members talk in the group?'), a: msg('No. These fill the member count so a new group looks worth joining. They do not post, buy or reply. Getting real conversation going is on you, and it is much easier in a room that does not look empty.') },
      { q: msg('Can I order for a group with a joining limit?'), a: msg('Take the limit off first. A capped or expired invite link stops the order partway, and while the undelivered value comes back to your wallet, it is a wasted day. Set the link to no expiry and no maximum before you order.') },
    ],
  },
  audiomack: {
    name: 'Audiomack',
    h1: msg('Buy Audiomack Plays, Followers and Likes in Nigeria'),
    title: 'Buy Audiomack Plays in Nigeria | Naira Pricing',
    metaDesc: 'Buy Audiomack plays, followers, likes and reups in Nigeria. Naira pricing, no foreign card needed. Start from ₦1,000.',
    heroDesc: msg('Audiomack is where a lot of Nigerian music is actually heard first, and a song sitting on 40 plays gets skipped by the people who could have pushed it. Nitro carries Audiomack plays, followers, likes and reups priced in Naira, from ₦1,000.'),
    mainService: 'views',
    kw: 'buy Audiomack plays Nigeria',
    whatYouGet: [
      msg('Plays on a song, an album or a playlist'),
      msg('Followers on your artist profile'),
      msg('Likes and reups on individual songs'),
    ],
    whySection: [
      msg('Play count is the first thing a blog, a DJ or an A&R looks at. Nobody listens to a link cold. They look at the number, decide whether anyone else has bothered, and play it or close it on that basis — which makes the first few thousand plays the hardest and the most useful you will ever get.'),
      msg('Reups travel further than plays do. A reup puts your song on somebody else’s profile, so it reaches their followers rather than sitting on yours waiting to be found. For a new release it is the service that does the most per naira.'),
      msg('Audiomack is not Spotify and does not pay like it. Nobody is monetising plays here, which means nobody is policing them the way a royalty platform does. What you are buying is the look of traction in front of the people who decide what gets pushed.'),
      msg('Release first, then push. Getting plays onto a song that is already up and already shared works. Getting them onto a link nobody has seen builds a number with no story behind it, and people can tell.'),
      msg('No foreign card needed. Priced in Naira, paid through Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.'),
    ],
    faq: [
      { q: msg('What link do you need for Audiomack?'), a: msg('The public song, album or profile URL from audiomack.com. Open the page in a browser and copy what is in the address bar. We never need your Audiomack login.') },
      { q: msg('Do Audiomack plays pay royalties?'), a: msg('Audiomack does pay some creators through its own programmes, and bought plays are not what those programmes are counting. Treat this as visibility in front of blogs, DJs and labels, not as income.') },
      { q: msg('How fast do plays arrive?'), a: msg('It depends on the service you pick, and each one shows its own speed and start time on the row before you order. Gradual is the sensible choice on a new release — a song going from 40 to 90,000 plays overnight is the kind of thing people screenshot.') },
      { q: msg('Can I push a whole album?'), a: msg('Yes. Album and playlist links work the same way a song link does. If you want the plays spread across tracks rather than landing on one, order per song instead.') },
    ],
  },
  boomplay: {
    name: 'Boomplay',
    h1: msg('Buy Boomplay Streams, Followers and Likes in Nigeria'),
    title: 'Buy Boomplay Streams in Nigeria | Naira Pricing',
    metaDesc: 'Buy Boomplay streams, followers, likes and favourites in Nigeria. Naira pricing, no foreign card needed. Start from ₦1,000.',
    heroDesc: msg('Boomplay is the biggest music platform on the continent and the one most Nigerian listeners actually open. A song with no streams does not get picked up by the charts, the playlists or the people who read them. Nitro carries Boomplay streams, followers and likes priced in Naira, from ₦1,000.'),
    mainService: 'views',
    kw: 'buy Boomplay streams Nigeria',
    whatYouGet: [
      msg('Streams on a song or an album'),
      msg('Followers on your artist profile'),
      msg('Likes, favourites and shares'),
      msg('Nigerian streams specifically, where the service offers them'),
    ],
    whySection: [
      msg('Boomplay charts by region, which is the whole opportunity. A song that charts in Nigeria gets in front of Nigerian listeners, and the number that gets you there is smaller than anything you would need on a global platform.'),
      msg('Where the streams come from matters more here than the count. Nigerian streams on a Nigerian artist read as real, and the services that say so are worth the extra over a worldwide figure that looks nothing like your actual audience.'),
      msg('The profile carries the release. Followers on an artist profile mean the next drop lands in front of somebody instead of starting again from nothing, which is why the artists who keep releasing build followers first and streams second.'),
      msg('Boomplay pays out on streams, so keep the volume sane. This is a platform with a royalty programme, and inflated numbers on a monetised account is the one place where being greedy actually costs you something. Push the song, do not farm it.'),
      msg('No foreign card needed. Priced in Naira, paid through Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.'),
    ],
    faq: [
      { q: msg('What link do you need for Boomplay?'), a: msg('The public song, album or artist URL from boomplay.com or the share link from the app. We never need your Boomplay login.') },
      { q: msg('Can this affect my Boomplay royalties?'), a: msg('Boomplay does pay on streams, and any platform that pays on a number also watches that number. Keep the volume proportionate to where you actually are, and do not run it on a song that is already earning — the visibility is the point, not the payout.') },
      { q: msg('Can I get Nigerian streams specifically?'), a: msg('Where a service offers Nigerian streams it says so on the row before you order, and those cost more than worldwide ones. For a Nigerian artist they are usually worth it: the audience matches the music and the regional charts are what you are aiming at.') },
      { q: msg('How long does a Boomplay order take?'), a: msg('Each service shows its own speed and start time on the row. Most start within the hour and deliver over a day or more, which is what you want on a new release.') },
    ],
  },
  google: {
    name: 'Google',
    h1: msg('Buy Google Reviews and Maps Engagement in Nigeria'),
    title: 'Buy Google Reviews in Nigeria | Naira Pricing',
    metaDesc: 'Buy Google reviews, Maps ratings and business profile engagement in Nigeria. Naira pricing, no foreign card needed. Start from ₦1,000.',
    heroDesc: msg('For a Nigerian business, the Google listing is the shopfront. Somebody searches your name, sees two reviews and a 3.1, and never calls. Nitro carries Google review and business profile services priced in Naira, from ₦1,000.'),
    mainService: 'comments',
    kw: 'buy Google reviews Nigeria',
    whatYouGet: [
      msg('Reviews on your Google Business Profile'),
      msg('Ratings on your Maps listing'),
      msg('Custom review text you write yourself'),
    ],
    whySection: [
      msg('Reviews decide the call, not the ranking. Two listings sit next to each other, one has eleven reviews and one has none, and the phone rings at the first. For a business people have not heard of, the review count is the entire reason a stranger picks up the phone.'),
      msg('Write the reviews yourself and they read like your customers. The services that take custom text let you say what people actually say about you — the specific thing you are good at, in the words a Nigerian customer would use. Generic five-star praise reads as bought because it is the one thing every bought review has in common.'),
      msg('This is the riskiest thing we sell, and pretending otherwise would not help you. Google removes reviews it does not believe, and it is better at this than the social platforms are. Reviews can and do disappear. Order small, order slowly, and never all at once.'),
      msg('It works alongside asking real customers, not instead of it. The businesses this goes well for are the ones already getting a few genuine reviews, where bought ones fill the gaps. On a listing with nothing real behind it, a wall of new reviews is exactly the pattern Google looks for.'),
      msg('No foreign card needed. Priced in Naira, paid through Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.'),
    ],
    faq: [
      { q: msg('What do you need to leave a Google review?'), a: msg('The public link to your Google Business Profile or Maps listing. Search your business name on Google Maps, tap Share, and copy the link. We never need access to your Google account.') },
      { q: msg('Will Google remove the reviews?'), a: msg('Some, sometimes. Google filters reviews it does not trust, and no panel anywhere can promise otherwise. Ordering a small number spread over time survives far better than a burst, and a listing with real reviews already on it survives better than one without.') },
      { q: msg('Can I write the review text myself?'), a: msg('Yes, on the services that support custom comments. You send one review per line and each goes out as written. This is the option worth paying for — specific, ordinary language about the thing you actually do is what makes a review believable.') },
      { q: msg('Is this safe for my business listing?'), a: msg('It carries real risk and we would rather say so. Google can filter reviews, and in serious cases it can flag a listing. Keep it small, keep it slow, keep asking real customers, and do not let bought reviews outnumber genuine ones.') },
    ],
  },
  // ── Added 17 Sep 2026. Five more, picked on the same bar as the first four:
  // two or more curated groups behind the page. The other twelve tiles on the
  // "missing" list did not clear it — nine have no curated group at all — so
  // they came off the shelf instead of getting thin pages. ──
  threads: {
    name: 'Threads',
    h1: msg('Buy Threads Followers, Likes and Reposts in Nigeria'),
    title: 'Buy Threads Followers in Nigeria | Naira Pricing',
    metaDesc: 'Buy Threads followers, likes, reposts and comments in Nigeria. Nigerian accounts available. Naira pricing, no foreign card needed. From ₦1,000.',
    heroDesc: msg('Threads runs on your Instagram account, so the people who find you there already know the handle. An empty Threads profile beside a working Instagram reads as abandoned, which is worse than not being on it at all. Nitro carries Threads followers, likes, reposts and comments priced in Naira, from ₦1,000 — including Nigerian accounts.'),
    mainService: 'followers',
    kw: 'buy Threads followers Nigeria',
    whatYouGet: [
      msg('Followers on your Threads profile, in Budget, Standard and Premium'),
      msg('Likes and comments on individual posts'),
      msg('Reposts and reshares, which is how a post travels here'),
      msg('Nigerian followers, likes, comments and reposts, on the groups that carry them'),
    ],
    whySection: [
      msg('Your Threads profile is your Instagram profile. Same handle, same name, same picture, and anyone who taps through from one sees the other. That is the argument for not leaving it empty: it is not a separate account nobody knows about, it is a second room in a house people already visit.'),
      msg('Reposts are the distribution. Threads has no hashtag culture and no share-to-story habit, so a post moves because somebody reposted it into their own followers. That makes reposts worth more per unit here than likes, and it is the one number that decides whether a post leaves your own followers at all.'),
      msg('Nigerian accounts are available on Threads, and on this platform they matter. A Lagos business with ten thousand followers who have never heard of Lagos does not convert, and the replies under your posts are public — a Nigerian comment reads as a Nigerian audience to everyone who scrolls past it.'),
      msg('Your profile has to be public for the order to run. A private Threads profile cannot be followed by the service, and anything not delivered comes back to your wallet.'),
      msg('No foreign card needed. Priced in Naira, paid through Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.'),
    ],
    faq: [
      { q: msg('What link do you need for Threads?'), a: msg('Your public profile URL — threads.net followed by your handle — or the direct link to a post for likes, comments and reposts. We never need your Instagram or Threads login.') },
      { q: msg('Does this touch my Instagram account?'), a: msg('No. Threads and Instagram share a login, but the follower counts are separate and an order here lands on Threads only. Your Instagram numbers do not move.') },
      { q: msg('Can I get Nigerian followers on Threads?'), a: msg('Yes, on the groups that say so — followers, likes, comments and reposts all have a Nigerian option. They cost more than worldwide accounts and for a Nigerian audience they are usually worth it, because the replies are public and the names are visible.') },
      { q: msg('Why did my order not start?'), a: msg('A private profile is the usual reason. Threads has to be public for the whole of the order, and if it goes private partway, whatever was not delivered is refunded to your wallet.') },
    ],
  },
  kick: {
    name: 'Kick',
    h1: msg('Buy Kick Followers and Live Viewers in Nigeria'),
    title: 'Buy Kick Followers and Live Viewers in Nigeria | Naira Pricing',
    metaDesc: 'Buy Kick followers, live viewers, clip views and video views in Nigeria. Naira pricing, no foreign card needed. Start from ₦1,000.',
    heroDesc: msg('Kick sorts its directory by who is being watched right now, so a stream with two viewers sits below one with two hundred and nobody scrolls that far. Nitro carries Kick followers, live viewers, clip views and video views priced in Naira, from ₦1,000.'),
    mainService: 'followers',
    kw: 'buy Kick followers Nigeria',
    whatYouGet: [
      msg('Followers on your Kick channel'),
      msg('Live viewers held on the stream for an hour'),
      msg('Views on clips'),
      msg('Views on uploaded videos and past broadcasts'),
    ],
    whySection: [
      msg('The directory is ranked by live viewers, and that is the whole problem with starting out. Nobody browses to the bottom of a category, so a stream with nothing on the counter is invisible for exactly as long as it has nothing on the counter. Getting onto the first screen is the only way anyone arrives by accident.'),
      msg('Live viewers are timed, not permanent. The one-hour service holds a count on a stream while it is running and then it ends, which is the honest shape of the product — it buys you position during the stream, not a number that stays afterwards. Order it when you are actually going live.'),
      msg('Followers are what survive the stream. They put your channel in somebody’s following list and get them the notification next time, which is the part that compounds. Viewers get you found once; followers get you found again.'),
      msg('Clips are how Kick streamers get discovered off-platform. A clip with views gets picked up and reposted to TikTok and X, and those are the numbers people check before they share something.'),
      msg('No foreign card needed. Priced in Naira, paid through Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.'),
    ],
    faq: [
      { q: msg('What link do you need for Kick?'), a: msg('Your channel URL — kick.com followed by your username — or the direct clip or video link for views. We never need your Kick login.') },
      { q: msg('When should I order live viewers?'), a: msg('Start the stream first, then place the order. The viewers are held for an hour on a stream that is actually running, so ordering them before you go live wastes the window.') },
      { q: msg('Do the live viewers chat?'), a: msg('No. They are viewers on the counter, not participants, and anyone claiming otherwise is selling you bot accounts that get channels banned. The count is what moves you up the directory; the conversation is still yours to start.') },
      { q: msg('Can I get banned for this?'), a: msg('Keep it proportionate to your channel and you are buying visibility, not faking a community. The risk on any platform is a number that makes no sense beside everything else on the account — a thousand viewers on a channel with forty followers is the shape that gets looked at.') },
    ],
  },
  soundcloud: {
    name: 'SoundCloud',
    h1: msg('Buy SoundCloud Plays, Followers and Reposts in Nigeria'),
    title: 'Buy SoundCloud Plays in Nigeria | Naira Pricing',
    metaDesc: 'Buy SoundCloud plays, followers, likes and reposts in Nigeria. Naira pricing, no foreign card needed. Start from ₦1,000.',
    heroDesc: msg('SoundCloud is where the record goes before the DSPs, and where A&Rs and DJs actually go looking. A track with forty plays does not get opened by either. Nitro carries SoundCloud plays, followers, likes and reposts priced in Naira, from ₦1,000.'),
    mainService: 'plays',
    kw: 'buy SoundCloud plays Nigeria',
    whatYouGet: [
      msg('Plays on a track, at Budget pricing'),
      msg('Followers on your artist profile'),
      msg('Likes on individual tracks'),
      msg('Reposts, which is how a track spreads on SoundCloud'),
    ],
    whySection: [
      msg('Reposts are the engine here, not likes. SoundCloud built its feed around the repost — a track lands in somebody’s followers because another account reposted it — so the repost is the only action that actually moves your record to new ears. Likes are a signal; reposts are distribution.'),
      msg('The play count is a gatekeeper before it is a vanity number. DJs, blogs and A&Rs use it as the first filter on whether to open a link at all, and a track sitting under a hundred plays reads as nobody has heard it, whether or not that is true.'),
      msg('It is the platform where unfinished work lives. Snippets, demos, freestyles and loosies go to SoundCloud precisely because they do not belong on Spotify yet, which means the numbers here decide what gets finished and what gets dropped.'),
      msg('Followers carry the next upload. A profile with followers means your next track opens with plays instead of starting at zero, and for an artist releasing regularly that is the difference between building and restarting each time.'),
      msg('No foreign card needed. Priced in Naira, paid through Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.'),
    ],
    faq: [
      { q: msg('What link do you need for SoundCloud?'), a: msg('The public track URL for plays, likes and reposts, or your profile URL for followers. A private or unlisted track cannot be delivered to, so make it public first. We never need your SoundCloud login.') },
      { q: msg('Do plays count towards SoundCloud monetisation?'), a: msg('Do not treat this as a payout strategy. SoundCloud pays on monetised tracks and any platform that pays on a number watches that number closely — run this for visibility on a track you are pushing, not on one that is already earning.') },
      { q: msg('What is the difference between a like and a repost?'), a: msg('A like is a private signal on your track. A repost puts the track into the feed of everybody who follows the account that reposted it, which is why reposts cost more and why they are the ones worth buying if you are choosing.') },
      { q: msg('How fast do SoundCloud orders run?'), a: msg('Each service shows its own start time and speed on the row before you order. Plays usually start quickly and spread over a day, which is what you want on a new upload.') },
    ],
  },
  bluesky: {
    name: 'Bluesky',
    h1: msg('Buy Bluesky Followers, Likes and Reposts in Nigeria'),
    title: 'Buy Bluesky Followers in Nigeria | Naira Pricing',
    metaDesc: 'Buy Bluesky followers, likes, reposts and comments in Nigeria. Naira pricing, no foreign card needed. Start from ₦1,000.',
    heroDesc: msg('Bluesky is small enough that a few hundred followers still puts you in front of people, which is the part that stops being true on every platform eventually. Nitro carries Bluesky followers, likes, reposts and comments priced in Naira, from ₦1,000.'),
    mainService: 'followers',
    kw: 'buy Bluesky followers Nigeria',
    whatYouGet: [
      msg('Followers on your Bluesky handle'),
      msg('Likes on individual posts'),
      msg('Reposts, which carry a post into new feeds'),
      msg('Comments, in Standard and Premium'),
    ],
    whySection: [
      msg('The timeline is chronological and unranked, so nothing is being hidden from you by an algorithm — but nothing is being promoted for you either. On Bluesky reach is almost entirely who follows you and who reposts you, which makes the follower count a more direct lever here than on any platform that ranks a feed.'),
      msg('Being early is the actual asset. Handles, audiences and the habit of checking a platform all get harder to win the longer you wait, and the accounts that carry weight on any network are usually the ones that were there before it was obvious. Bluesky is at the stage where a modest number still reads as established.'),
      msg('Reposts travel further than likes because there is no algorithm doing the travelling. A repost is the entire distribution mechanism: it moves your post into somebody else’s followers and that is the only way it leaves yours.'),
      msg('Comments are visible social proof and they last. On a chronological feed a post with a conversation under it is the one that people stop on, and Premium comments read as people rather than as filler.'),
      msg('No foreign card needed. Priced in Naira, paid through Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.'),
    ],
    faq: [
      { q: msg('What link do you need for Bluesky?'), a: msg('Your handle or profile URL for followers, and the direct post link for likes, reposts and comments. We never need your Bluesky login or an app password.') },
      { q: msg('Do I need to be on a custom domain?'), a: msg('No. A standard bsky.social handle works exactly the same as a custom domain one. If you do move to a custom domain later, place new orders against the new handle.') },
      { q: msg('What is the difference between Standard and Premium comments?'), a: msg('Premium comments come from accounts with more history and post something that reads as a person. Standard is cheaper and shorter. Both are described on the row before you order.') },
      { q: msg('Is Bluesky worth it if my audience is Nigerian?'), a: msg('Honestly, it is smaller here than X or Instagram, so treat it as claiming ground rather than as your main channel. If you are already posting on X, crossposting and building a Bluesky base costs you very little and the handle is worth holding.') },
    ],
  },
  deezer: {
    name: 'Deezer',
    h1: msg('Buy Deezer Followers and Likes in Nigeria'),
    title: 'Buy Deezer Followers in Nigeria | Naira Pricing',
    metaDesc: 'Buy Deezer followers and track likes in Nigeria. Naira pricing, no foreign card needed. Start from ₦1,000.',
    heroDesc: msg('Deezer is where a lot of francophone West Africa actually listens, which makes it the platform Nigerian artists keep forgetting when they plan a release across the region. Nitro carries Deezer followers and likes priced in Naira, from ₦1,000.'),
    mainService: 'followers',
    kw: 'buy Deezer followers Nigeria',
    whatYouGet: [
      msg('Followers on your Deezer artist profile'),
      msg('Likes on individual tracks'),
    ],
    whySection: [
      msg('It is the francophone route. Deezer has real weight in Senegal, Côte d’Ivoire, Cameroon and across French-speaking Africa, so for a Nigerian artist planning a release beyond Lagos it reaches listeners that Spotify and Apple Music do not. The market next door is the cheapest one to grow into.'),
      msg('Followers on an artist profile get your releases in front of the same people twice. Deezer notifies followers of a new release, which means the profile you build on one drop is the audience waiting for the next, rather than a number that sits there looking good.'),
      msg('Track likes are what the editorial side reads. Deezer runs curated playlists the same way every DSP does, and engagement on a track is part of what puts it in front of whoever is building them.'),
      msg('Keep it proportionate on a monetised profile. Deezer pays on streams, so this is a platform where an implausible number is worth avoiding — build the profile, do not farm the payout.'),
      msg('No foreign card needed. Priced in Naira, paid through Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.'),
    ],
    faq: [
      { q: msg('What link do you need for Deezer?'), a: msg('Your artist profile URL for followers, or the track URL for likes. Both are the public deezer.com links or the share link from the app. We never need your Deezer login.') },
      { q: msg('Does Nitro sell Deezer streams?'), a: msg('Not at the moment — the curated Deezer groups are followers and likes. If streams appear on a provider we carry, they show up in the full list, which you can search from the order page.') },
      { q: msg('Is Deezer worth it for a Nigerian artist?'), a: msg('It depends where you want to be heard. For Lagos alone, Boomplay and Audiomack are closer to where people are. For a release meant to travel across West Africa, particularly the French-speaking markets, Deezer is the one that gets skipped and should not be.') },
      { q: msg('How long does a Deezer order take?'), a: msg('Each service shows its own start time and speed on the row. Most start within the hour and deliver over a day or more.') },
    ],
  },
};

export async function generateMetadata({ params }) {
  const { platform } = await params;
  const meta = PLATFORM_META[platform];
  if (!meta) return {};

  const pageTitle = meta.title || `${meta.name} Growth Services`;
  return {
    title: pageTitle,
    description: meta.metaDesc || `Promote your ${meta.name} with Naira pricing. Fast results, refill coverage. Get started in seconds.`,
    alternates: { canonical: `https://nitro.ng/services/${platform}` },
    openGraph: {
      title: `${pageTitle} | The Nitro NG`,
      description: meta.metaDesc || `${meta.kw}. Fastest delivery, Naira pricing, cleanest dashboard.`,
      url: `https://nitro.ng/services/${platform}`,
      type: 'website',
    },
  };
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function getPlatformData(platformName, dbPlatform) {
  const groups = await prisma.serviceGroup.findMany({
    where: { enabled: true, platform: dbPlatform || platformName },
    include: {
      tiers: {
        where: { enabled: true },
        orderBy: { sellPer1k: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  if (!groups.length) return null;

  const prefixes = [escapeRe(platformName)];
  if (dbPlatform && dbPlatform !== platformName) {
    prefixes.push(escapeRe(dbPlatform));
    if (dbPlatform.includes('/')) {
      prefixes.push(escapeRe(dbPlatform.split('/').reverse().join('/')));
    }
  }
  prefixes.sort((a, b) => b.length - a.length);
  const stripRe = new RegExp(`^(?:${prefixes.join('|')})[/\\s]*`, 'i');

  const services = [];
  for (const g of groups) {
    if (!g.tiers.length) continue;
    const type = g.name.replace(stripRe, '').trim() || g.type || g.name;
    if (!services.find(s => s.type === type)) {
      services.push({
        type,
        minPrice: Number(g.tiers[0].sellPer1k) / 100,
        maxPrice: Number(g.tiers[g.tiers.length - 1].sellPer1k) / 100,
        tiers: g.tiers.length,
        refill: g.tiers.some(t => t.refill),
        nigerian: g.nigerian,
      });
    }
  }

  return services;
}

export default async function PlatformPage({ params }) {
  const { platform } = await params;
  const meta = PLATFORM_META[platform];
  if (!meta) notFound();

  let services = [];
  try { services = await getPlatformData(meta.name, meta.dbPlatform) || []; } catch {}
  if (!services.length) notFound();

  const idx = PLATFORM_ORDER.indexOf(platform);
  const nextSlug = PLATFORM_ORDER[(idx + 1) % PLATFORM_ORDER.length];
  const nextMeta = PLATFORM_META[nextSlug];

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://nitro.ng' },
      { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://nitro.ng/services' },
      { '@type': 'ListItem', position: 3, name: meta.name },
    ],
  };

  const faqSchema = meta.faq?.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: meta.faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  } : null;

  const relatedLinks = [
    { href: '/services', label: 'All platforms' },
    { href: '/quality', label: 'How Nitro keeps drop rates low' },
    { href: '/blog/why-smm-followers-drop-how-to-avoid-it', label: 'Why SMM followers drop (and how to avoid it)' },
    { href: '/reviews', label: 'What using Nitro is actually like' },
    { href: '/pricing', label: 'Full pricing across all platforms' },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}
      <ServicePlatformView
        platform={meta.name}
        services={services}
        copy={{ h1: meta.h1, heroDesc: meta.heroDesc, mainService: meta.mainService, whySection: meta.whySection, faq: meta.faq, whatYouGet: meta.whatYouGet }}
        nextPlatform={nextMeta ? { slug: nextSlug, name: nextMeta.name } : null}
        relatedLinks={relatedLinks}
      />
    </>
  );
}
