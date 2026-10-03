/**
 * The one pixel identifier, shared by both halves of TikTok tracking.
 *
 * This is the `sdkid` the browser passes to ttq.load() AND the
 * `event_source_id` the Events API takes for a web event. They are the same
 * string, which is the opposite of what the build spec said: it listed a
 * numeric "Pixel ID" (7692263347735117831) for the server and this code for
 * the browser, and the server half was built that way.
 *
 * Verified against the live API on 3 Oct, because that assumption cost a day.
 * An empty-batch probe distinguishes the two failure modes cleanly — a wrong
 * or unauthorised identifier is rejected before the payload is read:
 *
 *   numeric id  -> 40001 "No permission to operate event source id: ..."
 *   pixel code  -> 40002 "Number of events must be between 1 and 1000."
 *
 * The second is a validation error, which means auth and permission both
 * passed. So the code is the correct identifier and the numeric id is not
 * usable here at all.
 *
 * Lives in its own module with no node builtins so the client component and
 * the server library can share it. Both must send the same pixel or the
 * browser event and its server twin never collapse into one conversion —
 * which is exactly the bug this file exists to prevent: the site was loading
 * DB06VT3C77U2INVDM2MG in the browser while the token was issued for this one.
 */
export const TIKTOK_PIXEL_CODE = 'DB08LFRC77UFPOQ9MKMG';
