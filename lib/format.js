/** Format number as Nigerian Naira */
export const fN = (a) => `₦${Math.abs(a).toLocaleString("en-NG")}`;

const TZ = "Africa/Lagos";

/** Format date — short (for orders, activity). Pass true for dateOnly (no time) */
export const fD = (d, dateOnly) => { const dt = new Date(d), yr = dt.getFullYear() !== new Date().getFullYear(); const opts = { timeZone: TZ, month: "short", day: "numeric", ...(yr && { year: "numeric" }), ...(!dateOnly && { hour: "2-digit", minute: "2-digit" }) }; return dt.toLocaleDateString("en-NG", opts); };

/** Format date — with year (for blog, referrals) */
export const fDY = (d) => new Date(d).toLocaleDateString("en-NG", { timeZone: TZ, month: "short", day: "numeric", year: "numeric" });

/** Format date — relative (for conversation lists) */
export const fRel = (d) => {
  const now = new Date(), dt = new Date(d);
  const watNow = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  const watDt = new Date(dt.toLocaleString("en-US", { timeZone: TZ }));
  const startOfToday = new Date(watNow.getFullYear(), watNow.getMonth(), watNow.getDate());
  const diff = startOfToday - new Date(watDt.getFullYear(), watDt.getMonth(), watDt.getDate());
  const days = Math.round(diff / 86400000);
  if (days <= 0) return dt.toLocaleTimeString("en-NG", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return dt.toLocaleDateString("en-NG", { timeZone: TZ, day: "numeric", month: "short", year: "2-digit" });
};
