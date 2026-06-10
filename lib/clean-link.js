const YT_KEEP = new Set(['v', 'list']);
const FB_KEEP = new Set(['id', 'story_fbid', 'set']);

export function cleanLink(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  const s = raw.trim();
  if (!s.includes('://')) return s;

  try {
    const url = new URL(s);
    const host = url.hostname.replace(/^www\./, '').replace(/^web\./, '');

    const isSocial = /instagram\.com|ig\.me|tiktok\.com|twitter\.com|x\.com|t\.co|facebook\.com|fb\.com|fb\.me|fb\.watch|youtube\.com|youtu\.be|threads\.net|snapchat\.com|linkedin\.com|pinterest\.com|reddit\.com|twitch\.tv|spotify\.com|discord\.com|t\.me|telegram\.me|whatsapp\.com/.test(host);
    if (!isSocial) return s;

    const isYT = /youtube\.com|youtu\.be/.test(host);
    const isFB = /facebook\.com|fb\.com/.test(host);
    const keep = isYT ? YT_KEEP : isFB ? FB_KEEP : null;

    const params = new URLSearchParams();
    if (keep) {
      for (const [k, v] of url.searchParams) {
        if (keep.has(k)) params.set(k, v);
      }
    }

    url.search = params.toString() ? `?${params}` : '';
    url.hash = '';

    // TikTok profile links need @ prefix — auto-fix if missing (skip short domains like vt.tiktok.com)
    if (/^(www\.)?tiktok\.com$/.test(host)) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length === 1 && !parts[0].startsWith('@') && !/^(video|photo|v|embed|tag|music|sound|discover|foryou)$/i.test(parts[0])) {
        url.pathname = `/@${parts[0]}`;
      }
    }

    return url.toString();
  } catch {
    return s;
  }
}
