/**
 * Two facts about whoever an admin is looking at:
 *   Reseller — the account is approved for wholesale (an enabled reseller profile)
 *   API      — the order came through /api/v2, or the person orders through it
 * Reseller wins where both are true, so a row never carries two chips.
 */
export function AccountTag({ reseller, api, dark, className = "" }) {
  if (!reseller && !api) return null;
  const style = reseller
    ? { background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", color: dark ? "#e8b4c0" : "#a05468" }
    : { background: dark ? "rgba(122,162,247,.18)" : "rgba(122,162,247,.14)", color: dark ? "#a5b4fc" : "#4c62c4" };
  return (
    <span className={`text-[9.5px] font-bold uppercase tracking-[.5px] py-[1px] px-1.5 rounded-md align-middle shrink-0 ${className}`} style={style}>
      {reseller ? "Reseller" : "API"}
    </span>
  );
}
export default AccountTag;
