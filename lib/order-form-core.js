export const LINK_HINTS = {
  instagram: "instagram.com/username",
  tiktok: "tiktok.com/@username",
  youtube: "youtube.com/@username",
  facebook: "facebook.com/username",
  twitter: "x.com/username",
  telegram: "t.me/username",
  threads: "threads.net/@username",
  snapchat: "snapchat.com/username",
  linkedin: "linkedin.com/in/username",
  pinterest: "pinterest.com/username",
  reddit: "reddit.com/r/community",
  discord: "discord.gg/invite",
  whatsapp: "chat.whatsapp.com/invite",
  twitch: "twitch.tv/username",
  kick: "kick.com/username",
  spotify: "open.spotify.com/track/...",
  audiomack: "audiomack.com/username",
  boomplay: "boomplay.com/songs/...",
  applemusic: "music.apple.com/album/...",
  soundcloud: "soundcloud.com/username",
  deezer: "deezer.com/track/...",
  tidal: "tidal.com/track/...",
  google: "google.com/maps/place/...",
  trustpilot: "trustpilot.com/review/...",
  webtraffic: "yourwebsite.com",
  appstore: "apps.apple.com/app/...",
  playstore: "play.google.com/store/apps/...",
};

export const LINK_EXAMPLES = {
  instagram: { profile: ["instagram.com/username"], channel: ["instagram.com/channel/ABC123"], post: ["instagram.com/p/ABC123", "instagram.com/reel/ABC123", "ig.me/abc123"] },
  tiktok: { profile: ["tiktok.com/@username", "@username"], post: ["tiktok.com/@user/video/123...", "vm.tiktok.com/ABC123"] },
  twitter: { profile: ["x.com/username", "twitter.com/username"], post: ["x.com/username/status/123...", "t.co/abc123"] },
  youtube: { profile: ["youtube.com/@channel", "youtube.com/c/name"], post: ["youtube.com/watch?v=ABC123", "youtu.be/ABC123", "youtube.com/shorts/ABC123"], commentLike: ["youtube.com/watch?v=VIDEO_ID&lc=COMMENT_ID"] },
  facebook: { profile: ["facebook.com/pagename", "fb.com/pagename"], channel: ["facebook.com/groups/groupname"], post: ["facebook.com/share/r/ABC123", "facebook.com/user/posts/123...", "fb.watch/abc123"], commentLike: ["facebook.com/comment/permalink/COMMENT_ID"] },
  threads: { profile: ["threads.net/@username"], post: ["threads.net/@username/post/ABC123"] },
  telegram: { profile: ["t.me/channelname"], post: ["t.me/channelname/123"] },
  linkedin: { profile: ["linkedin.com/in/username", "linkedin.com/company/name"], post: ["linkedin.com/posts/user_title-123..."] },
  snapchat: { profile: ["snapchat.com/add/username"], post: ["snapchat.com/spotlight/ABC123"] },
  pinterest: { profile: ["pinterest.com/username"], post: ["pinterest.com/pin/123..."] },
  reddit: { profile: ["reddit.com/r/community"], post: ["reddit.com/r/community/comments/..."] },
  twitch: { profile: ["twitch.tv/username"], post: ["twitch.tv/videos/123..."] },
  kick: { profile: ["kick.com/username"], post: ["kick.com/username/clips/..."] },
  spotify: { profile: ["open.spotify.com/artist/..."], post: ["open.spotify.com/track/...", "open.spotify.com/album/...", "open.spotify.com/playlist/..."] },
  soundcloud: { profile: ["soundcloud.com/artist"], post: ["soundcloud.com/artist/track-name"] },
  applemusic: { profile: ["music.apple.com/artist/..."], post: ["music.apple.com/album/.../song"] },
  audiomack: { profile: ["audiomack.com/artist"], post: ["audiomack.com/artist/song/track"] },
  boomplay: { profile: ["boomplay.com/artists/..."], post: ["boomplay.com/songs/..."] },
  deezer: { profile: ["deezer.com/artist/..."], post: ["deezer.com/track/..."] },
  shazam: { profile: ["shazam.com/artist/..."], post: ["shazam.com/track/..."] },
  mixcloud: { profile: ["mixcloud.com/username"], post: ["mixcloud.com/username/mix-name"] },
  discord: { profile: ["discord.gg/invite-code"], post: ["discord.com/channels/..."] },
  whatsapp: { profile: ["chat.whatsapp.com/invite-code"], post: ["wa.me/phonenumber"] },
  tumblr: { profile: ["tumblr.com/username"], post: ["tumblr.com/username/post/123..."] },
  quora: { profile: ["quora.com/profile/username"], post: ["quora.com/.../answer/username"] },
  vimeo: { profile: ["vimeo.com/username"], post: ["vimeo.com/123456789"] },
  google: { profile: ["maps.google.com/place/..."], post: ["g.co/kgs/..."] },
  trustpilot: { profile: ["trustpilot.com/review/domain.com"], post: ["trustpilot.com/review/domain.com"] },
  onlyfans: { profile: ["onlyfans.com/username"], post: ["onlyfans.com/username"] },
  clubhouse: { profile: ["clubhouse.com/@username"], post: ["clubhouse.com/room/..."] },
  kwai: { profile: ["kwai.com/@username"], post: ["kwai.com/video/..."] },
};

const POST_LINK_PATTERNS = {
  twitter: /\/(status|i\/status)\//i,
  instagram: /\/(p|reel|reels|stories|tv|share)\//i,
  tiktok: /\/(video|photo|v|t)\//i,
  youtube: /\/(watch|shorts|live)\b|youtu\.be\//i,
  facebook: /\/(posts|videos|watch|photos|photo|reel|share\/[rpv]|story\.php|permalink\.php)\b/i,
  threads: /\/post\//i,
  linkedin: /\/(posts|pulse|feed\/update)\//i,
  snapchat: /\/spotlight\//i,
  pinterest: /\/pin\//i,
  reddit: /\/comments\//i,
  twitch: /\/videos\//i,
  kick: /\/clips\//i,
  telegram: /\/\d+\s*$/,
  spotify: /\/(track|album|playlist|episode)\//i,
  bluesky: /\/post\//i,
  tumblr: /\/post\/\d/i,
  vimeo: /\/\d{5,}/,
  quora: /\/(answer|unanswered)\//i,
  deezer: /\/(track|album|playlist)\//i,
  tidal: /\/(track|album|playlist)\//i,
  audiomack: /\/(song|album|playlist)\//i,
  boomplay: /\/(songs|albums|playlists)\//i,
  applemusic: /\/(album|song|music-video)\//i,
  shazam: /\/(track|song)\//i,
};

const SHORT_POST_DOMAINS = /^(vt|vm)\.tiktok\.com$|^t\.co$|^(fb\.watch|fb\.me)$|^ig\.me$|^youtu\.be$/i;

export function isValidLink(link) {
  const value = String(link || "").trim();
  if (value.length < 3 || value.length > 500) return false;
  if (value.includes("://")) return /^https?:\/\/[^\s/]+\.[^\s/]+/.test(value);
  if (value.includes(".")) return /^[^\s/]+\.[^\s/]+/.test(value);
  return /^@?[a-zA-Z0-9._]{1,100}$/.test(value);
}

export function validateOrderLink(value, { platform, isProfileService = false, isPostService = false } = {}) {
  const cleaned = String(value || "").replace(/^https?:\/\//i, "");
  if (!cleaned.trim()) return { cleaned, error: "" };
  if (!isValidLink(cleaned)) return { cleaned, error: "Enter a valid link" };

  const pattern = POST_LINK_PATTERNS[platform];
  if (pattern && cleaned.includes(".")) {
    let host = "";
    try { host = new URL(`https://${cleaned}`).hostname; } catch {}
    const looksLikePost = SHORT_POST_DOMAINS.test(host) || pattern.test(cleaned);
    if (isProfileService && looksLikePost) {
      return { cleaned, error: "This service needs your profile link, not a post link" };
    }
    if (isPostService && !looksLikePost) {
      return { cleaned, error: "This service needs a link to a specific post, not your profile" };
    }
  }

  return { cleaned, error: "" };
}

export function calculateOrderPrice({
  quantity,
  tier,
  loyaltyDiscount = 0,
  activePromotion = null,
  pointsRedeemable = false,
  pointsBalance = 0,
  redeemPoints = false,
}) {
  const quantityNumber = Number(quantity) || 0;
  const basePrice = tier
    ? Math.round((quantityNumber / 1000) * (tier.pricePer1k || tier.price))
    : 0;
  const discountAmount = loyaltyDiscount > 0
    ? Math.round(basePrice * (loyaltyDiscount / 100))
    : 0;
  const afterLoyalty = Math.max(0, basePrice - discountAmount);
  const promoDiscountAmount = activePromotion
    ? Math.round(afterLoyalty * (activePromotion.discountPercent / 100))
    : 0;
  const cappedPromoDiscount = activePromotion?.maxDiscountPerOrder
    ? Math.min(promoDiscountAmount, activePromotion.maxDiscountPerOrder / 100)
    : promoDiscountAmount;
  const priceBeforePoints = Math.max(0, afterLoyalty - cappedPromoDiscount);
  const pointsDiscount = redeemPoints && pointsRedeemable
    ? Math.min(pointsBalance, priceBeforePoints)
    : 0;

  return {
    basePrice,
    discountAmount,
    promoDiscountAmount,
    cappedPromoDiscount,
    priceBeforePoints,
    pointsDiscount,
    price: Math.max(0, priceBeforePoints - pointsDiscount),
  };
}

export const MULTIDAY_THRESHOLD = 3000;

const DAILY_CAP = {
  followers: 5000,
  likes: 10000,
  views: 75000,
  plays: 75000,
  comments: 1000,
  reviews: 100,
  engagement: 15000,
};
const DEFAULT_DAILY_CAP = 15000;
const MIN_DAYS_FLOOR = {
  followers: 3,
  views: 1,
  plays: 1,
  likes: 2,
  comments: 3,
  reviews: 3,
  engagement: 2,
};

export function getDripSchedule(quantity, type, requestedDays = 3) {
  const dailyCap = DAILY_CAP[String(type || "").toLowerCase()] || DEFAULT_DAILY_CAP;
  const quantityNumber = Number(quantity) || 0;
  const daysMax = quantityNumber <= 5000
    ? 5
    : quantityNumber <= 10000
      ? 7
      : quantityNumber <= 25000
        ? 12
        : quantityNumber <= 50000
          ? 18
          : quantityNumber <= 100000
            ? 25
            : 30;
  const floor = MIN_DAYS_FLOOR[String(type || "").toLowerCase()] || 3;
  const daysMin = Math.min(Math.max(floor, Math.ceil(quantityNumber / dailyCap)), daysMax);
  const days = Math.max(daysMin, Math.min(requestedDays, daysMax));
  const perDay = days > 0 ? Math.floor(quantityNumber / days) : quantityNumber;

  return {
    daysMin,
    daysMax,
    days,
    perDay,
    remainder: days > 0 ? quantityNumber % days : 0,
    dailyCap,
    zone: perDay <= dailyCap * 0.5 ? "safe" : perDay <= dailyCap ? "moderate" : "hot",
  };
}

export function formatOrderQuantity(quantity) {
  return quantity >= 1_000_000
    ? `${quantity / 1_000_000}M`
    : quantity >= 1000
      ? `${quantity / 1000}K`
      : quantity;
}
