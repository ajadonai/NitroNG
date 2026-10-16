import { useT } from "./locale";

/**
 * Three facts about whoever an admin is looking at:
 *   Guest    — the order came through guest checkout, on the shared guest
 *              account or attached to an existing one by the email given
 *   Reseller — the account is approved for wholesale (an enabled reseller profile)
 *   API      — the order came through /api/v2, or the person orders through it
 * Guest wins, then Reseller, so a row never carries two chips.
 */
export function AccountTag({ reseller, api, guest, dark, className = "" }) {
  const tr = useT();
  if (!reseller && !api && !guest) return null;
  const style = guest
    ? { background: dark ? "rgba(224,164,88,.18)" : "rgba(217,119,6,.12)", color: dark ? "#fbbf24" : "#9a5208" }
    : reseller
      ? { background: dark ? "rgba(196,125,142,.18)" : "rgba(196,125,142,.12)", color: dark ? "#e8b4c0" : "#a05468" }
      : { background: dark ? "rgba(122,162,247,.18)" : "rgba(122,162,247,.14)", color: dark ? "#a5b4fc" : "#4c62c4" };
  return (
    <span className={`text-[9.5px] font-bold uppercase tracking-[.5px] py-[1px] px-1.5 rounded-md align-middle shrink-0 ${className}`} style={style}>
      {guest ? tr("Guest") : reseller ? "Reseller" : "API"}
    </span>
  );
}
export default AccountTag;
