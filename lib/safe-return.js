/**
 * The destination a signed-out person is sent back to, filtered.
 *
 * When a session ends mid-task the dashboard puts the current path on the
 * redirect so signing in can return the person to it. That parameter is in a
 * URL, which means anybody can write one and mail it to a customer — so what
 * comes back out of here has to be a path on this site and nothing else.
 *
 * The rejections, and why each is not paranoia:
 *
 *   "//evil.com"    a protocol-relative URL. Browsers read it as another
 *                   origin, so allowing it turns a nitro.ng link into a
 *                   redirect onto somebody's copy of our login page. This is
 *                   the classic open-redirect hole and it looks harmless.
 *   "/\evil.com"    some browsers normalise a backslash to a slash before
 *                   deciding the origin, which makes this the same attack
 *                   wearing a different character.
 *   "https://…"     an absolute URL, off-site by definition.
 *   "dashboard"     relative, so it would resolve against whatever page is
 *                   showing. Never what was meant.
 *
 * Anything rejected returns "", and the caller falls back to /dashboard.
 */
export function safeReturnTo(raw) {
  if (!raw || typeof raw !== "string") return "";
  if (raw.includes("\\")) return "";
  if (raw[0] !== "/") return "";
  if (raw[1] === "/") return "";
  return raw;
}
