const YT_KEEP = new Set(['v', 'list']);

export function cleanLink(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  const s = raw.trim();
  if (!s.includes('://')) return s;

  try {
    const url = new URL(s);
    const host = url.hostname.replace(/^www\./, '');

    const isSocial = /instagram\.com|tiktok\.com|twitter\.com|x\.com|facebook\.com|fb\.com|youtube\.com|youtu\.be|threads\.net|snapchat\.com|linkedin\.com|pinterest\.com|reddit\.com|twitch\.tv|spotify\.com|discord\.com|t\.me|telegram\.me|whatsapp\.com/.test(host);
    if (!isSocial) return s;

    const isYT = /youtube\.com|youtu\.be/.test(host);
    const params = new URLSearchParams();
    if (isYT) {
      for (const [k, v] of url.searchParams) {
        if (YT_KEEP.has(k)) params.set(k, v);
      }
    }

    url.search = params.toString() ? `?${params}` : '';
    url.hash = '';
    return url.toString();
  } catch {
    return s;
  }
}
