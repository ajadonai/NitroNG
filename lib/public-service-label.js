export const PUBLIC_SERVICE_LABEL_MAX_LENGTH = 72;

const MAX_SOURCE_LENGTH = 4_096;
const CONTROL_OR_FORMAT = /[\p{Cc}\p{Cf}\p{Cs}]/gu;
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}\uFE0E\uFE0F\u20E3]/gu;

const PLATFORMS = [
  { label: 'Instagram', patterns: [/\binstagram\b/i, /\binsta\b/i, /\big\b/i] },
  { label: 'TikTok', patterns: [/\btik\s*tok\b/i] },
  { label: 'YouTube', patterns: [/\byou\s*tube\b/i, /\byt\b/i] },
  { label: 'Facebook', patterns: [/\bfacebook\b/i, /\bfb\b/i] },
  {
    label: 'X',
    patterns: [
      /\btwitter\b/i,
      /^x(?:\s|$)/i,
      /\bx\s*\/\s*twitter\b/i,
      /\btwitter\s*(?:\/|\[)\s*x\b/i,
    ],
  },
  { label: 'Telegram', patterns: [/\btelegram\b/i] },
  { label: 'Spotify', patterns: [/\bspotify\b/i] },
  { label: 'Snapchat', patterns: [/\bsnap\s*chat\b/i] },
  { label: 'LinkedIn', patterns: [/\blinked\s*in\b/i] },
  { label: 'Pinterest', patterns: [/\bpinterest\b/i] },
  { label: 'Twitch', patterns: [/\btwitch\b/i] },
  { label: 'Discord', patterns: [/\bdiscord\b/i] },
  { label: 'Threads', patterns: [/\bthreads?\b/i] },
  { label: 'Audiomack', patterns: [/\baudio\s*mack\b/i] },
  { label: 'Boomplay', patterns: [/\bboom\s*play\b/i] },
  { label: 'Apple Music', patterns: [/\bapple\s+music\b/i] },
  { label: 'WhatsApp', patterns: [/\bwhats\s*app\b/i] },
  { label: 'SoundCloud', patterns: [/\bsound\s*cloud\b/i] },
  { label: 'Reddit', patterns: [/\breddit\b/i] },
  { label: 'Quora', patterns: [/\bquora\b/i] },
  { label: 'Kick', patterns: [/\bkick\b/i] },
  { label: 'Bluesky', patterns: [/\bblue\s*sky\b/i] },
  { label: 'Tumblr', patterns: [/\btumblr\b/i] },
  { label: 'Vimeo', patterns: [/\bvimeo\b/i] },
  { label: 'Deezer', patterns: [/\bdeezer\b/i] },
  { label: 'Tidal', patterns: [/\btidal\b/i] },
  { label: 'Shazam', patterns: [/\bshazam\b/i] },
];

const AUDIENCES = [
  { label: 'Nigerian', pattern: /\bnigeri(?:a|an)\b/i },
  { label: 'USA', pattern: /\b(?:usa|united\s+states|american)\b/i },
  { label: 'UK', pattern: /\b(?:uk|united\s+kingdom|british)\b/i },
  { label: 'Canadian', pattern: /\b(?:canada|canadian)\b/i },
  { label: 'European', pattern: /\b(?:eu|europe|european)\b/i },
  { label: 'Turkish', pattern: /\b(?:turkey|turkish)\b/i },
  { label: 'UAE', pattern: /\b(?:uae|united\s+arab\s+emirates)\b/i },
  { label: 'Indian', pattern: /\b(?:india|indian)\b/i },
  { label: 'Brazilian', pattern: /\b(?:brazil|brazilian)\b/i },
  { label: 'Worldwide', pattern: /\b(?:worldwide|global)\b/i },
];

const GENDERS = [
  { label: 'Female', pattern: /\bfemale\b/i },
  { label: 'Male', pattern: /\bmale\b/i },
];

// Longest, most descriptive phrases come first. The formatter returns only
// these labels; provider text itself is never copied into the result.
const SERVICE_PHRASES = [
  { label: 'Live Stream Views', pattern: /\blive\s*streams?\s*(?:views?|viewers?)\b/i },
  { label: 'Live Stream Likes', pattern: /\blive\s*streams?\s*likes?\b/i },
  { label: 'Watch Time', pattern: /\bwatch\s*(?:time|hours?)(?:\s+views?)?\b/i },
  { label: 'SEO Views', pattern: /\bseo\s+views?\b/i },
  { label: 'Monetizable Views', pattern: /\bmoneti[sz]able\s+views?\b/i },
  { label: 'Unique Views', pattern: /\bunique\s+views?\b/i },
  { label: 'Native Views', pattern: /\bnative\s+views?\b/i },
  { label: 'Story Views', pattern: /\bstor(?:y|ies)\s+views?\b/i },
  { label: 'Reel Views', pattern: /\breels?\s+views?\b/i },
  { label: 'Shorts Views', pattern: /\bshorts?\s+views?\b/i },
  { label: 'Photo Views', pattern: /\bphotos?\s+views?\b/i },
  { label: 'Video Views', pattern: /\bvideos?\s+views?\b/i },
  { label: 'Tweet Views', pattern: /\btweets?\s+views?\b/i },
  { label: 'Post Views', pattern: /\bposts?\s+views?\b/i },
  { label: 'Profile Views', pattern: /\bprofiles?\s+views?\b/i },
  { label: 'Page Views', pattern: /\bpages?\s+views?\b/i },
  { label: 'Profile Visits', pattern: /\bprofiles?\s+visits?\b/i },
  { label: 'Story Likes', pattern: /\bstor(?:y|ies)\s+likes?\b/i },
  { label: 'Reel Likes', pattern: /\breels?\s+likes?\b/i },
  { label: 'Video Likes', pattern: /\bvideos?\s+likes?\b/i },
  { label: 'Post Likes', pattern: /\bposts?\s+likes?\b/i },
  { label: 'Page Likes', pattern: /\bpages?\s+likes?\b/i },
  { label: 'Comment Likes', pattern: /\bcomments?\s+likes?\b/i },
  { label: 'Random Emoji Comments', pattern: /\brandom\s+emoji\s+comments?\b/i },
  { label: 'Custom Comments', pattern: /\bcustom\s+(?:video\s+|tweet\s+)?comments?\b/i },
  { label: 'Random Comments', pattern: /\brandom\s+(?:video\s+)?comments?\b/i },
  { label: 'Verified Comments', pattern: /\bverified\s+comments?\b/i },
  { label: 'Video Comments', pattern: /\bvideos?\s+comments?\b/i },
  { label: 'Tweet Comments', pattern: /\btweets?\s+comments?\b/i },
  { label: 'Story Shares', pattern: /\bshares?\s+to\s+(?:your\s+)?stor(?:y|ies)\b/i },
  { label: 'Channel Members', pattern: /\bchannels?\s+members?\b/i },
  { label: 'Group Members', pattern: /\bgroups?\s+members?\b/i },
  { label: 'Server Members', pattern: /\bservers?\s+members?\b/i },
  { label: 'Page Reviews', pattern: /\bpages?\s+reviews?\b/i },
  { label: 'Poll Votes', pattern: /\bpolls?\s+votes?\b/i },
  { label: 'Monthly Listeners', pattern: /\bmonthly\s+listeners?\b/i },
  { label: 'Playlist Adds', pattern: /\bplaylists?\s+adds?\b/i },
  { label: 'Event Interest', pattern: /\bevents?\s+interests?\b/i },
  { label: 'PK Battle Points', pattern: /\bpk\s+battles?\s+points?\b/i },
  { label: 'Sound Uses', pattern: /\b(?:use\s+sounds?|sounds?\s+uses?)\b/i },
  { label: 'Website Traffic', pattern: /\bwebsite\s+traffic\b/i },
  { label: 'App Installs', pattern: /\bapp\s+installs?\b/i },
  { label: 'Post Reactions', pattern: /\bposts?\s+reactions?\b/i },
  { label: 'Comment Reactions', pattern: /\bcomments?\s+reactions?\b/i },
  { label: 'Post Engagement', pattern: /\bposts?\s+engagement\b/i },
  { label: 'Subscribers', pattern: /\bsubscribers?\b/i },
  { label: 'Followers', pattern: /\bfollowers?\b/i },
  { label: 'Likes', pattern: /\blikes?\b/i },
  { label: 'Views', pattern: /\b(?:views?|viewers?)\b/i },
  { label: 'Comments', pattern: /\bcomments?\b/i },
  { label: 'Shares', pattern: /\bshares?\b/i },
  { label: 'Saves', pattern: /\bsaves?\b/i },
  { label: 'Reposts', pattern: /\breposts?\b/i },
  { label: 'Retweets', pattern: /\bretweets?\b/i },
  { label: 'Bookmarks', pattern: /\bbookmarks?\b/i },
  { label: 'Impressions', pattern: /\bimpressions?\b/i },
  { label: 'Reach', pattern: /\breach\b/i },
  { label: 'Engagement', pattern: /\bengagement\b/i },
  { label: 'Reactions', pattern: /\breactions?\b/i },
  { label: 'Votes', pattern: /\bvotes?\b/i },
  { label: 'Members', pattern: /\bmembers?\b/i },
  { label: 'Plays', pattern: /\bplays?\b/i },
  { label: 'Streams', pattern: /\bstreams?\b/i },
  { label: 'Listeners', pattern: /\blisteners?\b/i },
  { label: 'Connections', pattern: /\bconnections?\b/i },
  { label: 'Reviews', pattern: /\breviews?\b/i },
  { label: 'Favorites', pattern: /\bfavou?rites?\b/i },
  { label: 'Duets', pattern: /\bduets?\b/i },
  { label: 'Downloads', pattern: /\bdownloads?\b/i },
  { label: 'Installs', pattern: /\binstalls?\b/i },
];

function normalizeSource(value) {
  if (value == null) return '';

  let source;
  try {
    source = String(value);
  } catch {
    return '';
  }

  return source
    .slice(0, MAX_SOURCE_LENGTH)
    .normalize('NFKC')
    .slice(0, MAX_SOURCE_LENGTH)
    .replace(CONTROL_OR_FORMAT, ' ')
    .replace(EMOJI, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findPlatforms(source) {
  if (!source) return [];
  return PLATFORMS
    .filter(({ patterns }) => patterns.some(pattern => pattern.test(source)))
    .map(({ label }) => label);
}

function firstCanonicalMatch(source, definitions) {
  const matches = definitions.flatMap(definition => {
    const match = source.match(definition.pattern);
    return match ? [{ label: definition.label, index: match.index ?? 0 }] : [];
  });
  matches.sort((a, b) => a.index - b.index);
  return matches[0]?.label || null;
}

function findServicePhrases(source) {
  const matches = SERVICE_PHRASES.flatMap(definition => {
    const match = source.match(definition.pattern);
    if (!match) return [];
    const start = match.index ?? 0;
    return [{ label: definition.label, start, end: start + match[0].length }];
  });

  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  const selected = [];
  for (const match of matches) {
    if (selected.some(item => item.label === match.label)) continue;
    if (selected.some(item => match.start < item.end && match.end > item.start)) continue;
    selected.push(match);
  }

  return selected
    .sort((a, b) => a.start - b.start)
    .slice(0, 3)
    .map(match => match.label);
}

function boundedLabel(platform, audience, gender, phrases) {
  const qualifiers = [audience, gender].filter(Boolean);
  const selectedPhrases = [...phrases];

  const build = () => [platform, ...qualifiers, selectedPhrases.join(' + ')]
    .filter(Boolean)
    .join(' ');

  let label = build();
  while (label.length > PUBLIC_SERVICE_LABEL_MAX_LENGTH && selectedPhrases.length > 1) {
    selectedPhrases.pop();
    label = build();
  }
  while (label.length > PUBLIC_SERVICE_LABEL_MAX_LENGTH && qualifiers.length > 0) {
    qualifiers.pop();
    label = build();
  }

  return label.length <= PUBLIC_SERVICE_LABEL_MAX_LENGTH
    ? label
    : `${platform} Service`;
}

/**
 * Produce a customer-safe service label from untrusted provider text.
 *
 * `fallbackContext` should be the known category/platform. The result is built
 * entirely from canonical allowlists, so provider metadata is never echoed.
 */
export function getPublicServiceLabel(rawName, fallbackContext) {
  const raw = normalizeSource(rawName);
  const context = normalizeSource(fallbackContext);
  const contextPlatforms = findPlatforms(context);
  const rawPlatforms = findPlatforms(raw);

  if (contextPlatforms.length > 1) return 'Social Media Service';

  if (contextPlatforms.length === 1) {
    const platform = contextPlatforms[0];
    if (rawPlatforms.some(rawPlatform => rawPlatform !== platform)) {
      return `${platform} Service`;
    }

    const phrases = findServicePhrases(raw);
    if (phrases.length === 0) return `${platform} Service`;
    return boundedLabel(
      platform,
      firstCanonicalMatch(raw, AUDIENCES),
      firstCanonicalMatch(raw, GENDERS),
      phrases,
    );
  }

  if (rawPlatforms.length !== 1) return 'Social Media Service';

  const platform = rawPlatforms[0];
  const phrases = findServicePhrases(raw);
  if (phrases.length === 0) return `${platform} Service`;

  return boundedLabel(
    platform,
    firstCanonicalMatch(raw, AUDIENCES),
    firstCanonicalMatch(raw, GENDERS),
    phrases,
  );
}
