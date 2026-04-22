/** Format number as Nigerian Naira */
export const fN = (a) => `₦${Math.abs(a).toLocaleString("en-NG")}`;

/** Format date — short (for orders, activity). Pass true for dateOnly (no time) */
export const fD = (d, dateOnly) => new Date(d).toLocaleDateString("en-NG", dateOnly ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** Format date — with year (for blog, referrals) */
export const fDY = (d) => new Date(d).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
