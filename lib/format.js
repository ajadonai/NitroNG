/** Format number as Nigerian Naira */
export const fN = (a) => `₦${Math.abs(a).toLocaleString("en-NG")}`;

/** Format date — short (for orders, activity). Pass true for dateOnly (no time) */
export const fD = (d, dateOnly) => { const dt = new Date(d), yr = dt.getFullYear() !== new Date().getFullYear(); const opts = dateOnly ? { month: "short", day: "numeric", ...(yr && { year: "numeric" }) } : { month: "short", day: "numeric", ...(yr && { year: "numeric" }), hour: "2-digit", minute: "2-digit" }; return dt.toLocaleDateString("en-NG", opts); };

/** Format date — with year (for blog, referrals) */
export const fDY = (d) => new Date(d).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });

/** Format date — relative (for conversation lists) */
export const fRel = (d) => {
  const now = new Date(), dt = new Date(d);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = startOfToday - new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const days = Math.round(diff / 86400000);
  if (days <= 0) return dt.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${dt.getDate()} ${dt.toLocaleString("en-NG", { month: "short" })} ${String(dt.getFullYear()).slice(-2)}`;
};
