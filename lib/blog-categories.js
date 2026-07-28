const BLOG_CATEGORIES = {
  instagram: {
    label: 'Instagram',
    h1: 'Instagram guides for Nigerian creators',
    metaDesc: 'Guides on growing, monetising and promoting your Instagram in Nigeria. From the Nitro team.',
    match: slug => slug.includes('instagram'),
  },
  tiktok: {
    label: 'TikTok',
    h1: 'TikTok guides for Nigerian creators',
    metaDesc: 'How to grow, get paid and promote on TikTok in Nigeria.',
    match: slug => slug.includes('tiktok'),
    intro: 'TikTok is the platform Nigerians use most for discovery, and the audience growth you can get here is faster than anywhere else. The honest position on monetisation is that Nigeria is not currently in the TikTok Creator Rewards Programme, but that does not mean there is no money in it. Brand deals, affiliate marketing and driving traffic to other platforms all pay Nigerian creators right now. <a href="/blog/how-to-get-tiktok-views-followers">How to Get More TikTok Views and Followers</a> covers growth strategies that work in the Nigerian market. <a href="/blog/does-tiktok-pay-nigerian-creators">Does TikTok Pay Nigerian Creators?</a> gives the honest answer on monetisation. And <a href="/blog/make-money-tiktok-nigeria-without-creator-fund">How to Make Money on TikTok Without the Creator Fund</a> covers every route that actually puts money in your account today.',
  },
  youtube: {
    label: 'YouTube',
    h1: 'YouTube guides for Nigerian creators',
    metaDesc: 'YouTube monetisation, subscribers and growth guides for Nigerian creators.',
    match: slug => slug.includes('youtube'),
    intro: 'YouTube remains the highest paying platform for Nigerian creators who can clear the monetisation thresholds, but the path to Partner status takes longer than most guides admit. Nigerian ad rates sit well below US or UK rates, Shorts monetisation follows different rules, and the 4,000 watch hour requirement means you need a real audience before the platform pays you anything. <a href="/blog/youtube-monetization-nigeria-requirements">YouTube Monetization in Nigeria</a> walks through the real requirements and the timeline most Nigerian channels should expect. <a href="/blog/youtube-shorts-monetisation-nigeria">Do YouTube Shorts Pay Nigerian Creators?</a> explains how Shorts revenue actually works. And <a href="/blog/how-to-buy-youtube-subscribers-nigeria">How to Buy YouTube Subscribers in Nigeria</a> covers where subscribers fit into a growth strategy and what they will and will not do for your channel.',
  },
  facebook: {
    label: 'Facebook',
    h1: 'Facebook guides for Nigerian businesses',
    metaDesc: 'How to use Facebook pages for business in Nigeria. Monetisation, followers and promotion.',
    match: slug => slug.includes('facebook'),
    intro: 'Facebook still has the largest active audience of any social platform in Nigeria, and for businesses it remains the strongest channel for reaching customers over 25. Organic reach has dropped over the years, but a well run business page combined with targeted promotion still converts better than most alternatives, especially in cities like Lagos, Abuja and Port Harcourt. <a href="/blog/does-facebook-business-page-work-nigeria">Does a Facebook Business Page Still Work in Nigeria?</a> looks at whether a business page is still worth the effort in 2026. And <a href="/blog/monetize-facebook-page-nigeria">How to Monetize a Facebook Page in Nigeria</a> covers every monetisation route available to Nigerian page owners, from in stream ads to affiliate selling.',
  },
  music: {
    label: 'Music Promotion',
    h1: 'Music promotion guides for Nigerian artists',
    metaDesc: 'How to promote music on Spotify, Audiomack, Boomplay and more in Nigeria.',
    match: slug => ['musician', 'artists', 'spotify', 'audiomack', 'boomplay', 'music'].some(k => slug.includes(k)),
    intro: 'Nigeria has more streaming platforms competing for listener attention than almost any other African market. Audiomack, Boomplay and Spotify each pay differently, surface artists differently and reach different audiences, so understanding where your promotion budget goes furthest matters more than simply spending more. <a href="/blog/where-nigerian-artists-should-promote-music">Where Nigerian Artists Should Actually Promote</a> compares what each platform offers and where promotion money lands best. <a href="/blog/how-nigerian-musicians-get-paid">How Nigerian Musicians Get Paid</a> breaks down actual payout structures on Audiomack, Boomplay and Spotify, including what Nigerian streams are really worth. And if you are starting out with a small budget, <a href="/blog/smm-for-nigerian-musicians-first-5000">Where to Spend Your First ₦5,000</a> walks through the cheapest way to get real numbers on a new release.',
  },
  trust: {
    label: 'Trust & Safety',
    h1: 'Is it safe? Honest answers about SMM panels',
    metaDesc: 'Honest guides on SMM panel safety, scams, bans and how to protect yourself in Nigeria.',
    match: slug => ['is-nitro-ng-legit', 'smm-panel-scams', 'how-to-test-an-smm', 'will-instagram-ban', 'nigerian-vs-international'].some(k => slug.includes(k)),
  },
  smm: {
    label: 'SMM Guides',
    h1: 'SMM panel guides and comparisons',
    metaDesc: 'Everything about SMM panels in Nigeria: how they work, what to look for, and how to get the best value.',
    match: slug => slug.includes('smm'),
  },
  comparisons: {
    label: 'Comparisons',
    h1: 'Nitro vs other SMM panels: honest comparisons',
    metaDesc: 'Side-by-side comparisons of Nitro NG versus other Nigerian and international SMM panels. Pricing, platforms and payment methods compared honestly.',
    match: slug => slug.startsWith('nitro-vs-'),
  },
};

export function getTopicsForSlug(slug) {
  return Object.entries(BLOG_CATEGORIES)
    .filter(([, cat]) => cat.match(slug))
    .map(([key]) => key);
}

export default BLOG_CATEGORIES;
