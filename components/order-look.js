import { msg } from "../lib/i18n";

/* How an order's status and tier look, shared by History and the home page so
   the two lists cannot drift apart. Kept in components/ rather than lib/ on
   purpose: the i18n scanner reads components/ and app/, and the msg() calls
   below are what make it demand a translation for every status. */

/* ── Status helpers (unified) ── */
export function sClr(s, dk) { return s === "Completed" ? (dk ? "#6ee7b7" : "#059669") : s === "Processing" ? (dk ? "#a5b4fc" : "#4f46e5") : s === "Pending" ? (dk ? "#fcd34d" : "#d97706") : s === "Queued" ? (dk ? "#a5b4fc" : "#4f46e5") : s === "Partial" ? (dk ? "#fdba74" : "#ea580c") : (s === "Failed" || s === "Rejected") ? (dk ? "#fca5a5" : "#dc2626") : s === "Cancelled" ? (dk ? "#a1a1aa" : "#71717a") : (dk ? "#555250" : "#8a8785"); }

/* Every status the Badge can be handed, registered with msg() so the report
   demands a translation for each. Badge is given a raw value off the order
   record and the scanner cannot follow a variable, so without this the status
   pill would translate only for as long as someone remembered to keep the
   dictionaries in step by hand. msg() returns its argument, so these stay
   usable as the identity values sClr compares against. */
const STATUS_LABEL = {
  Pending: msg("Pending"),   Processing: msg("Processing"), Completed: msg("Completed"),
  Partial: msg("Partial"),   Cancelled: msg("Cancelled"),   Failed: msg("Failed"),
  Rejected: msg("Rejected"), Queued: msg("Queued"),
};

/* What the row calls a status. Processing and Pending are the record's words;
   the customer reads where the order is, so the chip says Delivering and
   Waiting to start. Registered with msg() for the same reason as above. */
export const STATUS_SHOWN = { ...STATUS_LABEL, Processing: msg("Delivering"), Pending: msg("Waiting to start") };
export const TIER_LOOK = { Budget: ["shield", "#b45309", "#e0a458"], Standard: ["bolt", "#1d5fa5", "#7aa2f7"], Premium: ["crown", "#6d28d9", "#a78bfa"] };
