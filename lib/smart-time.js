// Smart time conversion: raw value + unit → human readable
// 90 mins → "~1 hour 30 minutes"
// 25 hours → "~1 day 1 hour"  
// 7 days → "~1 week"
// 365 days → "~1 year"

export function smartTime(val, unit) {
  if (!val || val <= 0) return null;
  let mins = unit === 'm' ? val : unit === 'h' ? val * 60 : val * 1440;
  const parts = [];
  
  const y = Math.floor(mins / 525600);
  if (y) parts.push(y + (y === 1 ? ' year' : ' years'));
  mins %= 525600;
  
  const mo = Math.floor(mins / 43200);
  if (mo) parts.push(mo + (mo === 1 ? ' month' : ' months'));
  mins %= 43200;
  
  const w = Math.floor(mins / 10080);
  if (w) parts.push(w + (w === 1 ? ' week' : ' weeks'));
  mins %= 10080;
  
  const d = Math.floor(mins / 1440);
  if (d) parts.push(d + (d === 1 ? ' day' : ' days'));
  mins %= 1440;
  
  const h = Math.floor(mins / 60);
  if (h) parts.push(h + (h === 1 ? ' hour' : ' hours'));
  mins %= 60;
  
  const m = Math.round(mins);
  if (m) parts.push(m + (m === 1 ? ' minute' : ' minutes'));
  
  return parts.length ? '~' + parts.join(' ') : null;
}
