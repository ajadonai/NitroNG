import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ServicePlatformView from '@/components/service-platform-page';

export const revalidate = 300;

const PLATFORM_ORDER = ['instagram', 'tiktok', 'youtube', 'x', 'facebook', 'telegram', 'spotify', 'snapchat', 'linkedin', 'twitch', 'discord'];

export async function generateStaticParams() {
  return PLATFORM_ORDER.map(platform => ({ platform }));
}

const PLATFORM_META = {
  instagram: {
    name: 'Instagram',
    h1: 'Buy Instagram Followers, Likes and Views in Nigeria',
    title: 'Buy Instagram Followers in Nigeria | Naira Pricing',
    metaDesc: 'Buy Instagram followers, likes, views, story views and comments in Nigeria. Naira pricing, gradual delivery, refill covered services. Start from ₦1,000.',
    heroDesc: 'Instagram is where most Nigerian creators, brands and small businesses are judged, and an empty looking profile costs you customers before anyone reads a word. Nitro lets you promote your Instagram account and posts with services priced in Naira, delivered gradually so the growth looks like growth. Fund your wallet from ₦1,000 and order in under a minute.',
    mainService: 'followers',
    kw: 'buy Instagram followers Nigeria',
    whatYouGet: [
      'Followers on your profile',
      'Likes on individual posts',
      'Reel and video views — the cheapest way to test us',
      'Story views to lift the visibility of what you post daily',
      'Comments, including comments from real Nigerian accounts so the engagement looks local',
      'Saves on posts — one of the strongest signals Instagram weighs',
      'Reels engagement bundles for pushing a specific piece of content',
    ],
    whySection: [
      'We test services before we list them. Most panels connect to a supplier API and mirror thousands of listings without checking a single one. We pull from several suppliers, test, and only list what actually delivers. That is why our catalogue sits around 140 services instead of fifteen thousand, and why our delivery rate is 91%.',
      'Gradual delivery is built in. Large Instagram orders can be spread over days instead of dumped at once. A page going from 400 to 40,000 followers overnight is the pattern that attracts attention. A page growing steadily is not. The option is there at checkout and we recommend using it.',
      'Comments from real Nigerian accounts. If you are selling to a Nigerian audience, engagement from foreign accounts looks wrong on your posts and everyone can tell. This is one of the few things on the site you genuinely cannot get from an international panel.',
    ],
    faq: [
      { q: 'Do you need my Instagram password?', a: 'No. We only need your public profile link or post link. No promotion service needs your password, and if one asks for it, that is a bot tool rather than a promotion service. Never hand it over.' },
      { q: 'Will buying Instagram followers get my account banned?', a: 'A permanent ban purely for buying followers is rare. What is more common is that some of the accounts get removed in an Instagram purge, or that a sudden unnatural spike reduces your reach. You lower that risk by starting small, using gradual delivery, keeping your posting consistent and growing in proportion to your account size. Nobody can promise you zero risk, and any panel that does is telling you something they cannot control.' },
      { q: 'Why do my Instagram followers drop?', a: 'Instagram periodically removes accounts it judges to be fake or inactive, and any of those following you disappear when it does. Some drop is normal on every follower service anywhere. On Nitro, Standard services carry refill for 30 days and Premium carries it for the life of the order, on services marked refill included, so drops within the window get replaced automatically.' },
      { q: 'How fast does an Instagram order start?', a: 'Many Instagram services start within minutes. Some queue at the supplier and take longer. The expected speed is shown on each service before you order, and you can watch progress live in the dashboard.' },
      { q: 'Do I have to make my Instagram account public?', a: 'Yes, at least while the order runs. A private account cannot receive followers or engagement from a promotion service, and orders placed on a private account will fail. Switch it public before ordering and you can change it back afterwards.' },
    ],
  },
  tiktok: {
    name: 'TikTok',
    dbPlatform: 'tiktok',
    h1: 'Buy TikTok Followers, Views and Likes in Nigeria',
    title: 'Buy TikTok Followers and Views in Nigeria',
    metaDesc: 'Buy TikTok followers, views, likes, shares and livestream viewers in Nigeria. Naira pricing, gradual delivery, refill covered services. Start from ₦1,000.',
    heroDesc: 'TikTok is the platform Nigerians actually live on, and it is the one where a single video can change everything overnight. The problem is that the algorithm decides in the first few hours whether a video travels, and a video that starts flat usually stays flat. Nitro lets you put an early push behind your content in Naira, from ₦1,000.',
    mainService: 'followers',
    kw: 'buy TikTok followers Nigeria',
    whatYouGet: [
      'Followers on your profile',
      'Video views — the cheapest entry point and the one that matters most for reach',
      'Likes on individual videos',
      'Shares, which TikTok weighs heavily in distribution',
      'Comments to make a video look like a conversation rather than a broadcast',
      'Livestream viewers for pushing a live session',
    ],
    whySection: [
      'Views early beat views late. TikTok tests a video on a small audience and expands based on how that audience behaves. Engagement that arrives in the first hours is worth far more than the same engagement three days later. Order as soon as you post, not after the video has already stalled.',
      'We list what works. TikTok services degrade faster than almost any other platform because TikTok updates its systems constantly. We test before listing and pull services when their delivery drops, which is the whole reason our catalogue is deliberately small.',
      'Naira, and payment you already use. No dollar conversion, no foreign card required. Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.',
    ],
    faq: [
      { q: 'Will buying TikTok views get my account banned?', a: 'TikTok bans for buying views are rare. TikTok cares far more about watch time and completion rate than about raw view count, so the realistic risk is not a ban but wasted spend: views on a video people scroll past will not push it further. Start small, keep posting, and put the push behind content that is already holding attention.' },
      { q: 'Does buying TikTok views actually help a video go viral?', a: 'It can help a video get tested by a wider audience, but it cannot make people watch to the end. TikTok expands distribution based on completion rate and rewatches, so a strong hook matters more than the view count. Treat promotion as an accelerator for good content, not a substitute for it.' },
      { q: 'How soon after posting should I order?', a: 'As soon as possible, ideally within the first hour. TikTok decides early whether to widen a video\'s distribution, so engagement arriving in that first window carries the most weight.' },
      { q: 'Do you need my TikTok password?', a: 'No. We only need your public profile or video link. We never ask for passwords and you should never give them to any promotion service.' },
      { q: 'Can I buy TikTok followers with Opay or PalmPay?', a: 'Yes. Payments run through Flutterwave, so Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank transfer or card, and crypto all work. Everything is priced in Naira with no dollar conversion.' },
    ],
  },
  youtube: {
    name: 'YouTube',
    h1: 'Buy YouTube Subscribers, Views and Watch Hours in Nigeria',
    title: 'Buy YouTube Subscribers and Watch Hours in Nigeria',
    metaDesc: 'Buy YouTube subscribers, views, watch hours, likes and comments in Nigeria. Naira pricing, gradual delivery, refill covered services.',
    heroDesc: 'Getting to YouTube monetisation means 1,000 subscribers and 4,000 watch hours, and most Nigerian creators stall somewhere in the middle of that with good videos nobody has found yet. Nitro lets you promote your channel and videos in Naira, with gradual delivery, from ₦1,000.',
    mainService: 'subscribers',
    kw: 'buy YouTube subscribers Nigeria',
    whatYouGet: [
      'Subscribers',
      'Video views',
      'Watch hours — the hardest threshold to reach organically',
      'Likes',
      'Comments to make a video look active',
    ],
    whySection: [
      'YouTube is the strictest platform and we treat it that way. YouTube audits channels around monetisation more seriously than any other platform audits anything. Subscribers and watch hours that do not behave like real viewers can put a monetisation application at risk. We list conservative, higher quality YouTube services rather than the cheapest available, and we would rather sell you less than get your channel flagged.',
      'Gradual delivery matters more here than anywhere. A channel gaining 5,000 subscribers in a day, on videos with 200 views each, is a contradiction that is visible to anyone looking. Spread it out.',
      'Honest advice over a bigger sale. If you are close to monetisation, be conservative. Promote the videos that already hold attention rather than buying subscribers in bulk. Watch hours are worth more to you than subscriber count, and a channel with real retention passes review.',
    ],
    faq: [
      { q: 'Can buying subscribers get my channel demonetised?', a: 'It can contribute to a failed monetisation review if the growth pattern does not look real. YouTube reviews channels around the monetisation threshold and looks at whether subscribers and watch time behave like genuine viewers. Use gradual delivery, choose higher quality tiers, and keep your promoted growth in proportion to your actual view counts.' },
      { q: 'Do bought watch hours count toward the 4,000 hour threshold?', a: 'Watch hours delivered through promotion register as watch time on your videos, but YouTube evaluates the quality and pattern of that watch time during monetisation review. Treat it as support for genuine viewership rather than a shortcut around it, and keep publishing content people actually finish.' },
      { q: 'How long do YouTube orders take?', a: 'Views and likes usually start within hours. Subscribers and watch hours are delivered more slowly by design, often over several days, because fast delivery on these is exactly what looks wrong. The expected speed is shown on each service before you order.' },
      { q: 'Do you need access to my YouTube channel?', a: 'No. We only need the public channel link or video link. We never ask for your Google account details or channel access.' },
      { q: 'Which is better to buy, subscribers or watch hours?', a: 'Watch hours, in most cases. Watch time is the harder threshold to reach organically and it is a stronger signal of a healthy channel. Subscribers without matching watch time is the combination that draws scrutiny.' },
    ],
  },
  x: {
    name: 'X',
    dbPlatform: 'Twitter/X',
    h1: 'Buy X (Twitter) Followers, Likes and Views in Nigeria',
    title: 'Buy Twitter (X) Followers in Nigeria',
    metaDesc: 'Buy X followers, likes, retweets, views and bookmarks in Nigeria. Naira pricing, gradual delivery, refill covered services. Start from ₦1,000.',
    heroDesc: 'Nigerian Twitter moves faster than any other corner of the platform, and on X your follower count is the first thing anyone checks before deciding whether to take you seriously. Nitro lets you build that base and push individual posts in Naira, from ₦1,000.',
    mainService: 'followers',
    kw: 'buy X Twitter followers Nigeria',
    whatYouGet: [
      'Followers',
      'Likes on individual posts',
      'Post views — the cheapest way to test',
      'Video views',
      'Retweets to push a post into more timelines',
      'Bookmarks, which X counts as a strong quality signal',
    ],
    whySection: [
      'X is the most forgiving of the major platforms. X enforces less aggressively around purchased engagement than Instagram or YouTube, which makes it a reasonable place to build a base. That is an observation about the platform, not a promise from us.',
      'Post views are cheap enough to experiment with. At roughly ₦1,090 per thousand, pushing a single post costs very little. That makes X the best platform on the site for testing what actually resonates before spending real money.',
      'Naira and local payment. No FX, no foreign card. Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.',
    ],
    faq: [
      { q: 'Will buying X followers get my account suspended?', a: 'Suspension purely for having purchased followers is uncommon on X, which enforces less aggressively here than Instagram or YouTube. The realistic outcomes are some follower drop over time and a follower to engagement ratio that looks off if you buy followers without ever buying engagement. Nobody can promise zero risk on any platform.' },
      { q: 'Do you need my X password?', a: 'No. We only need your public profile link or post link. We never ask for passwords or login codes.' },
      { q: 'Can I promote a single tweet rather than my whole account?', a: 'Yes. Paste the individual post link and buy likes, views, retweets or bookmarks against that post specifically. This is usually a better use of money than buying followers, because it pushes content people can actually respond to.' },
      { q: 'Why did my X follower count drop after a few days?', a: 'X periodically removes accounts it judges to be automated or inactive, and any of those following you disappear when that happens. Some drop is normal on every follower service. Standard services carry refill for 30 days and Premium for the life of the order, on services marked refill included.' },
      { q: 'How much does it cost to buy 1,000 X followers in Nigeria?', a: 'Around ₦5,409 at the time of writing, though prices move with quality tier and exchange rate. The live price is always shown on the service before you order, in Naira, with no dollar conversion.' },
    ],
  },
  facebook: {
    name: 'Facebook',
    h1: 'Buy Facebook Page Likes, Followers and Views in Nigeria',
    title: 'Buy Facebook Page Likes and Followers in Nigeria',
    metaDesc: 'Buy Facebook page likes, followers, post likes, video views and group members in Nigeria. Naira pricing, refill covered services. Start from ₦1,000.',
    heroDesc: 'Facebook is still the largest platform in Nigeria by user count, and for businesses selling to customers outside Lagos it is often the only one that matters. A business page with 40 likes does not close sales. Nitro lets you build that page in Naira, from ₦1,000.',
    mainService: 'page likes',
    kw: 'buy Facebook page likes Nigeria',
    whatYouGet: [
      'Page followers — among the cheapest follower services on the site',
      'Post likes',
      'Video views',
      'Page likes to lift the number people see on your page',
      'Group members for building a community around a business or interest',
    ],
    whySection: [
      'This is where Nigerian buying actually happens. Facebook Marketplace, business pages and groups drive a huge share of real Nigerian commerce, especially outside the major cities. A page that looks established converts better, and Facebook is the cheapest platform on our site to make that happen.',
      'It is the best value on the catalogue. Facebook page followers run at roughly ₦1,549 per thousand against around ₦3,818 for Instagram. If your budget is tight and your customers are on Facebook, this is where the money goes furthest.',
      'Group members for community building. If you are running a business community, a class or a marketplace group, seeded membership makes the group look worth joining. Empty groups stay empty.',
      'Promote posts, not just the page. A page like is a one time number. A promoted post gets in front of people while it is running and can pull real followers behind it. If you only have budget for one thing, put it behind a post that already shows what you sell rather than behind the page count.',
    ],
    faq: [
      { q: 'Do you need my Facebook password or admin access?', a: 'No. We only need the public link to your page, post or group. We never ask for passwords, admin access or login codes.' },
      { q: 'Does my Facebook page need to be public?', a: 'Yes. The page or post must be publicly visible for an order to deliver. Private or restricted content will cause the order to fail, and in that case the value returns to your Nitro wallet.' },
      { q: 'Can I buy members for a Facebook group?', a: 'Yes, group member services are available. The group needs to be public or set to allow joining without approval, since manual approval will block delivery.' },
      { q: 'Will buying page likes affect my Facebook ads?', a: 'Buying page likes does not directly affect your ad account, but it can affect your results. Ad targeting that uses your page audience will be weaker if that audience does not match your real customers. If you run ads seriously, promote posts and videos rather than stacking page likes.' },
      { q: 'How much does it cost to buy 1,000 Facebook page followers in Nigeria?', a: 'Around ₦1,549 at the time of writing, which makes Facebook one of the cheapest platforms on Nitro. Live prices are shown on each service in Naira before you order.' },
    ],
  },
  telegram: {
    name: 'Telegram',
    h1: 'Buy Telegram Members, Views and Reactions in Nigeria',
    title: 'Buy Telegram Channel Members in Nigeria',
    metaDesc: 'Buy Telegram channel members, group members, post views and reactions in Nigeria. Naira pricing from ₦158 per thousand views. Start from ₦1,000.',
    heroDesc: 'Telegram is where Nigerian crypto, fintech, trading and community groups actually organise, and on Telegram nobody joins a channel with 30 members. Nitro lets you build that base in Naira, and Telegram views are the cheapest service on the entire site.',
    mainService: 'members',
    kw: 'buy Telegram members Nigeria',
    whatYouGet: [
      'Channel members',
      'Group members for communities that run on discussion',
      'Post views — by far the cheapest service we sell',
      'Reactions',
    ],
    whySection: [
      'Member count is the whole first impression on Telegram. There is no bio, no feed and no profile to judge. Someone sent a link, they open it, and they decide based on the member count and whether recent posts have views. A channel that looks dead reads as abandoned even when it is not.',
      'Post views cost almost nothing. At around ₦158 per thousand, Telegram views are the cheapest thing on Nitro by a wide margin. If you want to test how we work before spending anything meaningful, this is the place to do it.',
      'Built for the communities that use it here. Nigerian crypto, forex, betting tips, tech and business communities run on Telegram. If you are launching one, the seeded start is often the difference between it growing and it stalling in week one.',
      'Views on posts do more than members. A channel with 4,000 members where recent posts show 60 views tells the visitor everything. Views on your last few posts are what make a channel look alive, and at ₦158 per thousand they cost almost nothing. If you are choosing between the two, buy views.',
    ],
    faq: [
      { q: 'Does my Telegram channel need to be public?', a: 'Yes. The channel or group needs a public username or an open invite link for members to be added. Private channels requiring manual approval will block delivery and the order will fail.' },
      { q: 'Do Telegram members leave after joining?', a: 'Some do, which is normal across every provider. On refill included services, Standard covers drops for 30 days and Premium covers them for the life of the order. Post views do not drop at all, since a view is a recorded event rather than an ongoing subscription.' },
      { q: 'Do you need my Telegram account or bot access?', a: 'No. We only need the public link to your channel, group or post. We never ask for account access, phone numbers or login codes.' },
      { q: 'Can I buy members for a Telegram group as well as a channel?', a: 'Yes, both channel members and group members are available. Groups need to allow joining without manual approval for the order to deliver.' },
      { q: 'How cheap are Telegram post views?', a: 'Around ₦158 per thousand at the time of writing, which makes them the cheapest service on Nitro. This is the least expensive way to test whether the platform works for you before spending anything real.' },
    ],
  },
  spotify: {
    name: 'Spotify',
    h1: 'Spotify Promotion for Nigerian Artists: Plays, Followers and Playlist Adds',
    title: 'Buy Spotify Plays and Followers in Nigeria',
    metaDesc: 'Spotify promotion for Nigerian artists. Plays, followers, monthly listeners and playlist adds, priced in Naira. Gradual delivery. Start from ₦1,000.',
    heroDesc: 'Nigerian music travels further than almost anything else the country exports, but a new release with 40 plays does not get picked up by playlists, blogs or the algorithm. Nitro lets you put a first push behind a track in Naira, delivered gradually, from ₦1,000.',
    mainService: 'plays',
    kw: 'buy Spotify plays Nigeria',
    whatYouGet: [
      'Plays on individual tracks',
      'Followers on your artist profile',
      'Monthly listeners — the number A&R people and playlist curators actually look at',
      'Playlist adds to get a track into rotation',
    ],
    whySection: [
      'Monthly listeners is the number that opens doors. Playlist curators, promoters and labels check monthly listeners before they check anything else. An artist sitting at a few hundred rarely gets a reply. It is not fair, but it is how the filtering works, and it is the number worth building deliberately.',
      'Gradual delivery matters a lot on Spotify. Streaming platforms are more sensitive to unnatural play patterns than social platforms are, because plays connect to royalty payments. A track jumping from 50 to 500,000 plays in a day is the pattern that draws scrutiny. Spread it out, keep the volume proportionate to your profile, and treat it as a first push rather than a growth plan.',
      'Priced in Naira for Nigerian artists. No dollar conversion. Fund from Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.',
      'Honest limit: promotion gets a track heard by more people. It does not make them save it, add it to their own playlists or come back. Spotify\'s algorithm weighs saves and repeat listens more than raw play count, so the push works best behind a track that already holds attention.',
    ],
    faq: [
      { q: 'Can Spotify detect promoted plays?', a: 'Spotify does monitor for unnatural streaming patterns, because plays are tied to royalty payments. The risk is not usually a ban but the removal of plays that do not pass its filters. Gradual delivery and volumes proportionate to your existing profile are the practical way to lower that risk, and no provider can promise you zero risk.' },
      { q: 'Do you need my Spotify for Artists login?', a: 'No. We only need your public track, profile or playlist link. We never ask for login details to any platform.' },
      { q: 'Will promotion increase my Spotify royalties?', a: 'Any plays that register do count toward streams, but promotion should not be treated as a way to generate royalty income. The economics do not work, since the cost per play is higher than what a play pays out. The reason to promote is discovery and credibility, not revenue.' },
      { q: 'How long do Spotify orders take?', a: 'Spotify services are delivered slowly on purpose, usually over several days, because fast delivery on a streaming platform is exactly what looks wrong. The expected speed is shown on each service before you order.' },
      { q: 'Does this work for Audiomack or Boomplay?', a: 'Not currently. Spotify, and where available SoundCloud, are the streaming platforms on the catalogue today. If Audiomack or Boomplay would be useful to you, tell us on WhatsApp, since demand is how we decide what to source next.' },
    ],
  },
  snapchat: {
    name: 'Snapchat',
    h1: 'Buy Snapchat Followers and Story Views in Nigeria',
    title: 'Buy Snapchat Followers and Story Views in Nigeria',
    metaDesc: 'Buy Snapchat followers, story views and engagement in Nigeria. Naira pricing, refill covered services. Start from ₦1,000.',
    heroDesc: 'Snapchat has a smaller Nigerian audience than Instagram or TikTok, but it is a loyal one, and creators who post there daily tend to have unusually engaged followings. Nitro carries Snapchat services priced in Naira, from ₦1,000.',
    mainService: 'followers',
    kw: 'buy Snapchat followers',
    whatYouGet: [
      'Followers on your Snapchat profile',
      'Story views to lift the reach of what you post each day',
      'Likes and video likes on individual posts',
    ],
    whySection: [
      'Fewer providers do Snapchat properly. It is a smaller market, so most panels either do not list it or list whatever their supplier offers without checking. We test before listing, which is why our Snapchat selection is small rather than long.',
      'Be aware of the pricing. Snapchat is the most expensive platform on our catalogue, running several times the cost of Instagram or Facebook for comparable services. That is a supply reality across the whole industry, not a Nitro markup. We would rather tell you upfront than let you find it at checkout. If your budget is tight and your audience is not specifically on Snapchat, Instagram or Facebook will stretch further.',
    ],
    faq: [
      { q: 'Do you need my Snapchat login?', a: 'No. We only need your public profile or post link. We never ask for passwords or login codes for any platform.' },
      { q: 'Why is Snapchat more expensive than Instagram?', a: 'Snapchat services cost more across the entire industry because the supply is thinner and harder to source. It is not a Nitro specific markup. If cost matters more than the platform, Instagram and Facebook deliver considerably more for the same money.' },
      { q: 'Does my Snapchat account need to be public?', a: 'Yes. Your profile and the content being promoted need to be publicly visible for delivery to work. Private accounts will cause the order to fail, and the value returns to your Nitro wallet.' },
      { q: 'Do Snapchat followers drop?', a: 'Some drop is normal on any follower service. Standard services carry refill for 30 days and Premium for the life of the order, on services marked refill included. Budget carries no refill.' },
    ],
  },
  linkedin: {
    name: 'LinkedIn',
    h1: 'Buy LinkedIn Followers, Connections and Post Engagement in Nigeria',
    title: 'Buy LinkedIn Followers and Post Likes in Nigeria',
    metaDesc: 'Buy LinkedIn followers, connections, post likes and endorsements in Nigeria. Naira pricing, gradual delivery. Start from ₦1,000.',
    heroDesc: 'LinkedIn matters more to Nigerian professionals every year, whether you are consulting, recruiting, selling B2B or building a personal profile that opens doors abroad. A post with three likes reads as ignored. Nitro carries LinkedIn services priced in Naira, from ₦1,000.',
    mainService: 'followers',
    kw: 'buy LinkedIn followers Nigeria',
    whatYouGet: [
      'Followers on a personal profile or company page',
      'Connections to build out your network',
      'Post likes to give a post the early traction that pushes it into feeds',
      'Skill endorsements on your profile',
    ],
    whySection: [
      'Early engagement is what moves a LinkedIn post. LinkedIn\'s feed weighs how a post performs in its first hour heavily. A post that gets early likes reaches connections of connections. A post that starts flat is quietly buried. If you are publishing something that matters, the first hour is where a small push does the most work.',
      'Go gently here. LinkedIn is a professional network where your real name and career are attached. Volumes should stay modest and believable. A consultant with 400 connections and a post carrying 5,000 likes is doing damage, not marketing. Keep it in proportion or skip it.',
    ],
    faq: [
      { q: 'Do you need my LinkedIn password?', a: 'No. We only need your public profile, company page or post link. We never ask for passwords or login access.' },
      { q: 'Is it risky to buy LinkedIn engagement?', a: 'LinkedIn enforces less visibly than Instagram or YouTube, but it is a professional network where your real identity is attached, so the reputational risk is higher than the platform risk. Keep volumes modest and proportionate to your actual network. A post with engagement wildly out of step with your connection count is noticeable to the humans reading it.' },
      { q: 'Does my LinkedIn profile need to be public?', a: 'Yes. Your profile and any post being promoted need to be publicly visible for delivery to work.' },
      { q: 'Can I promote a company page as well as a personal profile?', a: 'Yes. Company page followers and personal profile followers are both available. Paste whichever link matches what you are promoting.' },
    ],
  },
  twitch: {
    name: 'Twitch',
    h1: 'Buy Twitch Followers and Viewers in Nigeria',
    title: 'Buy Twitch Followers and Viewers in Nigeria',
    metaDesc: 'Buy Twitch followers, live viewers and chat engagement in Nigeria. Naira pricing, no foreign card needed. Start from ₦1,000.',
    heroDesc: 'Nigeria\'s gaming and streaming community is small but growing quickly, and on Twitch the cold start problem is brutal: nobody watches a stream with zero viewers, so it stays at zero viewers. Nitro carries Twitch services priced in Naira, from ₦1,000.',
    mainService: 'followers',
    kw: 'buy Twitch followers',
    whatYouGet: [
      'Followers on your channel',
      'Live viewers during a stream',
      'Chat engagement so a stream does not look empty',
    ],
    whySection: [
      'It solves the cold start, and only the cold start. Twitch\'s discovery pushes streams that already have viewers, which is circular and punishing for anyone new. A base viewer count gets you into the browse listings where real people can find you. That is genuinely useful, and it is the whole benefit.',
      'Be clear on what it does not do. Purchased viewers do not chat, do not subscribe, do not follow your socials and do not come back tomorrow. Twitch Affiliate and Partner requirements are based on real engaged viewership, and inflated numbers do not help you get there. Use this to look alive while you build something worth watching, not as a route to monetisation.',
      'No foreign card needed. Most Twitch services are sold in dollars by foreign providers. Ours are in Naira, paid through Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.',
    ],
    faq: [
      { q: 'Will bought viewers count toward Twitch Affiliate?', a: 'No, not reliably. Twitch Affiliate and Partner status are based on average concurrent viewers over time alongside other requirements, and Twitch evaluates whether that viewership behaves like real people. Treat purchased viewers as a way to appear in browse listings, not as a route to monetisation.' },
      { q: 'When should I order live viewers?', a: 'Just before or immediately after you go live, since viewers are only useful while the stream is running. Ordering after the stream ends does nothing.' },
      { q: 'Do you need my Twitch login?', a: 'No. We only need your public channel link. We never ask for passwords or account access.' },
      { q: 'Do Twitch followers drop?', a: 'Some drop is normal, as with any platform. Refill applies on services marked refill included, covering 30 days on Standard and the life of the order on Premium.' },
    ],
  },
  discord: {
    name: 'Discord',
    h1: 'Buy Discord Server Members in Nigeria',
    title: 'Buy Discord Members in Nigeria | Naira Pricing',
    metaDesc: 'Buy Discord server members and online users in Nigeria. Naira pricing, no foreign card needed. Start from ₦1,000.',
    heroDesc: 'Discord runs most of the serious community activity in Nigerian gaming, crypto and tech, and a server with eleven members does not convince anyone to join. Nitro carries Discord services priced in Naira, from ₦1,000.',
    mainService: 'members',
    kw: 'buy Discord members',
    whatYouGet: [
      'Server members to build out your member count',
      'Online users so the server looks active rather than abandoned',
    ],
    whySection: [
      'Member count is the join decision. Someone clicks an invite link and sees a number. That number decides whether they join or close the tab. For a new project, a new community or a new game server, the first hundred members are the hardest to get and the most valuable to have.',
      'Online count matters as much as total members. A server with 5,000 members and four people online reads as dead. If you are seeding a server, the online user services do more for how it feels than raw member count does.',
      'Be honest with yourself about what this does. These members do not talk, do not participate and do not build your community for you. They make the room look occupied so real people are willing to walk in. Everything after that is on you.',
      'No foreign card needed. Priced in Naira, paid through Opay, PalmPay, Kuda, Moniepoint, any Nigerian bank, card or crypto.',
    ],
    faq: [
      { q: 'What kind of Discord invite link do you need?', a: 'A permanent invite link with no expiry and no maximum uses. Temporary links or links with a use limit will cause the order to stop partway, and in that case the undelivered value returns to your Nitro wallet.' },
      { q: 'Will bought Discord members chat or participate?', a: 'No. These are member and online counts, not active participants. They make a new server look established so real people are willing to join. Building actual conversation is on you.' },
      { q: 'Can Discord ban my server for this?', a: 'Discord acts against servers involved in spam, scams or automated abuse rather than against member counts specifically, but there is real risk in any inflated growth and nobody can promise you otherwise. Keep the volume proportionate and make sure the server itself is genuinely doing something.' },
      { q: 'Do you need admin access to my server?', a: 'No. We only need a public permanent invite link. We never ask for admin access, bot tokens or your Discord login.' },
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
