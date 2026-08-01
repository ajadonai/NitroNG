# NitroNG drip recheck — commit `0c4b66c2`

Date: 30 July 2026  
Review range: `b8d49536..0c4b66c2`  
Equivalent rebased commit on `main`: `497b438e`

## Verdict

Not approved yet.

The commit improves the clean path: reset is now transactional, failed-row verification has an owner token, delivery accounting reads more child states, and cancellation moves provider work before the wallet refund.

However, the five reported high-risk areas are not fully closed. Eight blocking correctness risks remain. The most serious are:

- the legacy reset compatibility code does not match the legacy data;
- provider cancellation still refunds when cancellation or verification is unconfirmed;
- some cancellations never install the `Cancelling` fence;
- ambiguous provider requests can still be dispatched, reset, or refunded;
- provider-query ownership covers failed rows only, leaving processing-row ABA races.

The same relevant patterns are still present on current `main` at `aac33777`.

## Blocking findings

### H1 — Legacy reset rows are not recognized

The old reset implementation created the replacement row with:

```text
lastError = reset:#<source batch>
```

It did not mark the source row.

The new compatibility code instead looks for:

```text
replaced:#<new batch>
```

Evidence:

- Old writer: parent snapshot `app/api/admin/orders/route.js:1108-1116`
- New filter: `lib/drip-completion.js:31-37`
- New delivery fallback: `lib/drip-completion.js:62-66`

Reproduction:

1. Legacy source: quantity 100, status `partial`, remains 80.
2. Legacy replacement: quantity 80, status `completed`, remains 0, `lastError=reset:#1`.
3. `computeDripRollup()` returns `Partial` with 80 remaining.
4. The correct result is `Completed` with 0 remaining.

This was reproduced against the exact commit in an isolated test.

Impact:

- old reset orders can remain Partial after the replacement fully delivers;
- parent remains can be overstated;
- reporting, points, and later admin decisions use incorrect order state.

Required correction:

- add durable replacement lineage, preferably `replacesDispatchId`;
- audit existing `reset:#N` rows;
- automatically repair only provable one-to-one pairs;
- send ambiguous legacy orders to manual reconciliation.

Matching `reset:#N` by batch number alone is unsafe because batch numbers repeat across days and the old endpoint allowed arbitrary reset quantities.

### H2 — Ambiguous provider requests are not a shared blocked state

Reset blocks only `[TIMEOUT]` and `[VERIFY_STALE]`:

- `app/api/admin/orders/route.js:1279-1282`

Other placement paths write an ordinary `failed` status even though the provider outcome may be unknown:

- cron provider exception: `app/api/cron/drip/route.js:266-303`
- admin manual dispatch exception: `app/api/admin/orders/route.js:806-848`
- user first-batch exception: `app/api/orders/route.js:960-993`
- missing order ID: `no_order_id` or `Provider returned no order ID`

The cron’s own issue message says to check the provider dashboard before redispatching, but the database state does not enforce that instruction.

The markers also do not block all other writers:

- the drip cron can dispatch a pending sibling after a row becomes `[TIMEOUT]` or `[VERIFY_STALE]`;
- admin manual dispatch selects `pending` or `failed` without checking `lastError`;
- bulk cancellation allows ambiguous failed children and can refund them.

Impact:

- the same quantity can be submitted twice;
- a later batch can start while the prior provider order may still be active;
- a customer can be refunded while untracked provider delivery continues.

Required correction:

- introduce one durable disposition such as `providerOutcome = definitive_failure | ambiguous | confirmed`;
- treat every transport failure after request submission as ambiguous unless the provider explicitly confirms rejection;
- block dispatch, reset, cancellation settlement, rollup, and same-link release while any child is ambiguous;
- reconcile ambiguous rows through a shared provider-query workflow.

### H3 — Provider cancellation still fails open

For drip orders, the route:

1. catches and ignores `cancelOrder()` failures;
2. catches and ignores `checkOrder()` failures;
3. ignores the returned provider status;
4. records remains when available;
5. proceeds to terminal status and refund regardless.

Evidence:

- provider calls: `app/api/admin/orders/route.js:270-280`
- terminal settlement and refund: `app/api/admin/orders/route.js:282-370`

Example:

1. Child quantity is 1,000; local remains is 800.
2. Provider rejects cancellation.
3. Re-query returns `Processing`, remains 800.
4. Nitro refunds 80% and marks the child cancelled.
5. The provider continues delivering the remaining 800.

If the re-query fails or returns no remains, `computeChildDelivery()` treats unknown delivery as zero for a non-completed row. That can produce a full refund from unconfirmed state.

Direct orders are also fail-open:

- cancellation runs before any database claim;
- cancellation failure is swallowed;
- there is no provider re-query;
- settlement uses stale parent remains.

Evidence: `app/api/admin/orders/route.js:215-219`.

Required correction:

- keep the order in `Cancelling` until every provider-backed row has a validated terminal disposition;
- reject or defer settlement when provider configuration is unavailable;
- persist cancellation attempts and errors;
- retry with bounded backoff;
- use the same state machine for direct and drip orders;
- validate provider remains as a finite integer from 0 through child quantity.

### H4 — The `Cancelling` fence is conditional

Phase 1 installs `Cancelling/cancelling` only when:

```text
children.length > 0 && childProviderIds.length > 0
```

Evidence: `app/api/admin/orders/route.js:252-263`.

The following remain unfenced:

- a drip order with pending children and no provider IDs;
- a child currently inside `placeOrder()` but with no recorded provider ID yet;
- direct orders;
- direct orders during the initial provider cancellation call.

Race:

1. Admin starts cancelling an all-pending drip order.
2. Phase 1 finds no provider IDs and leaves the parent Pending.
3. Cron claims a pending child and calls the provider.
4. Phase 2 refunds and marks the order terminal.
5. The provider returns an order ID after settlement.
6. Nitro records a ghost issue, but provider delivery can continue.

Required correction:

- claim every cancellation as `Cancelling` before any provider I/O, regardless of provider IDs;
- lock parent, classify every child, and persist an explicit cancellation work item;
- make all dispatch paths reject `Cancelling`;
- keep `Cancelling` in same-link blocker logic until provider disposition is final.

### H5 — A previous admin refund can permanently break cancellation

Cancellation subtracts existing refunds, then attempts to create another transaction using:

```text
ADM-REF-<order id>
```

Evidence:

- previous-refund calculation: `app/api/admin/orders/route.js:350-351`
- new transaction reference: `app/api/admin/orders/route.js:357-364`
- global uniqueness: `prisma/schema.prisma:373`

If an admin already issued a partial refund, the reference already exists.

Result:

1. provider cancellation may succeed;
2. phase 2 hits the unique constraint;
3. the database transaction rolls back;
4. the order remains `Cancelling`;
5. every retry fails on the same reference.

Required correction:

- use a distinct, idempotent cancellation-refund key;
- update refund aggregation to recognize the new reference;
- preferably associate refund ledger entries directly with the order instead of inferring order identity from one globally unique display reference.

### H6 — Cron sibling fencing still has a TOCTOU race

The cron:

1. reads whether a sibling is in flight;
2. later claims the pending child;
3. does not hold the parent lock across both operations;
4. does not repeat the sibling predicate in the claim.

Evidence:

- separate in-flight read: `app/api/cron/drip/route.js:175-178`
- later claim: `app/api/cron/drip/route.js:180-189`

A failed-row verifier can acquire the parent lock and move another child to `verifying` between those two operations. The cron still claims and submits the pending child.

Required correction:

- use one shared transaction: lock parent, inspect siblings, claim child, commit;
- make every competing writer use the same parent-lock protocol;
- add a concurrency test that pauses between sibling inspection and claim.

The current test only supplies an already-visible blocker; it does not exercise the interleaving.

### H7 — Provider-query ownership covers failed rows only

The UUID owner token correctly fences:

```text
failed -> verifying -> provider query -> token-fenced apply
```

But rows already in `processing` are still queried concurrently by:

- user check;
- admin check;
- admin sync;
- drip cron.

Their write fence is only:

```text
id + status=processing + apiOrderId
```

That permits ABA:

1. Worker A reads `processing` and waits on a slow provider response.
2. Worker B changes the row to `failed`.
3. Worker C owns failed recovery and restores it to `processing`.
4. Worker A’s old response again matches `processing + apiOrderId`.
5. Worker A overwrites newer state.

Even without ABA, two processing queries can write remains out of order and regress delivery progress.

Required correction:

- use an owner token or monotonic version for every provider query, not failed rows only;
- route all four entry points through one reconciliation helper;
- fence progress-only writes with that version;
- add stale-owner, new-owner, processing-ABA, and out-of-order remains tests.

### H8 — Unknown provider status is converted into confirmed failure

`normalizeProviderStatus()` returns `null` for an unknown or missing status.

The failed-recovery loops then use:

```text
normalizeProviderStatus(response.status) || originalStatus
```

For a row that started failed, the fallback is `failed`. Because the current status is `verifying`, the code writes `failed`, clears the ambiguity marker, and allows rollup to treat the row as terminal.

Evidence:

- normalization: `lib/drip-completion.js:5-13`
- user recovery: `app/api/orders/route.js:228-245`
- admin recovery: `app/api/admin/orders/route.js:530-547`

A successful HTTP response with a missing or newly introduced provider status is not proof of provider failure.

Required correction:

- keep unknown status retryable and non-terminal;
- preserve the owner token until a typed disposition is stored;
- validate status, remains, and start count before applying the response.

## Medium findings

### M1 — Exact partial reset is broken in the admin UI

The admin query omits child `remains`, but the serializer emits it:

- query: `app/api/admin/orders/route.js:53-58`
- serializer: `app/api/admin/orders/route.js:168-169`

The UI therefore defaults a partial reset to the original quantity:

- `components/admin-orders.jsx:145`
- `components/admin-orders.jsx:163-175`

The API now requires the exact remains. A 100-unit partial with 80 remaining is sent as 100 and rejected.

Add `remains` to the query and make the reset quantity read-only.

### M2 — `orderId` and `dispatchId` are not bound together

The service minimum comes from the request’s `orderId`, while reset operates on `dispatch.orderId`.

Evidence:

- request order/service: `app/api/admin/orders/route.js:205-208`
- provider minimum: `app/api/admin/orders/route.js:1249`
- actual reset parent: `app/api/admin/orders/route.js:1245-1268`

A mismatched request can reset one order using another service’s minimum.

### M3 — Provider remains is not range-validated

Reset and cancellation accept provider-derived remains without enforcing:

```text
finite integer
0 <= remains <= child quantity
```

Negative remains can force the fully-delivered path. Oversized remains can create an oversized reset. `NaN` can strand settlement.

### M4 — Reset replacement scheduling bypasses cadence and windows

The replacement is scheduled at the last timestamp plus one minute:

- `app/api/admin/orders/route.js:1292-1301`

It does not use the service interval, timezone, or delivery window.

### M5 — `Cancelling` is not treated consistently as open/protected

- same-link order status list omits `Cancelling`: `lib/order-queue.js:1,59`
- admin retry can change `Cancelling` to Pending: `app/api/admin/orders/route.js:626-634`
- the dispatch-blocker branch can rewrite it: `app/api/admin/orders/route.js:663-670`

This can release a later same-link order while the provider cancellation is unresolved.

### M6 — Stale verification and cancellation recovery is manual

The cron changes stale verification to `[VERIFY_STALE]`, but does not query the provider. It only creates an issue for stale cancellation:

- `app/api/cron/drip/route.js:70-88`

Without a user or admin pressing Check, the order can remain unresolved indefinitely. Stale-cancellation issues are also created repeatedly without a dedupe fence.

### M7 — Account deletion does not handle drip child provider orders

Account deletion cancels only parent `apiOrderId` values and marks only pending children cancelled:

- `app/api/auth/delete-account/route.js:34-43`
- `app/api/auth/delete-account/route.js:58-70`

Drip provider IDs live on children. Processing, dispatching, verifying, and cancelling children can continue at the provider after the parent and account are terminalized.

## What is correct in this pass

- Source superseding and replacement creation are atomic for new reset rows.
- Repeating a successful new reset is durably rejected because the source is `superseded`.
- Null-remains partial reset is rejected.
- The reset requires the full known undelivered amount.
- Parent-first locking in `applyDripRollup()` is correct.
- Fresh child rows are re-read under lock before terminal rollup.
- Known delivery is counted from more child states and capped at parent quantity.
- Fully delivered cancellation finalizes as Completed with no refund.
- The failed-row verification token includes UUID ownership, status, token, and provider order ID.
- `verifying` and `cancelling` were added to several important in-flight filters.

## Test and validation results

Independent checks against the exact commit:

- changed test files: 123 passed, 0 failed;
- full suite: 1,535 passed, 10 failed, 3 skipped;
- all 10 full-suite failures are in the known bonus/deposit baseline, not drip code;
- lint: 0 errors, 170 existing warnings;
- `git diff-tree --check`: passed;
- targeted legacy reset regression: failed as expected, returning `Partial / 80 remains` instead of `Completed / 0 remains`.

Coverage gap:

No changed test covers:

- `reset_drip`;
- `superseded`, `replaced:#`, or real legacy `reset:#` rows;
- `computeChildDelivery`;
- provider cancellation rejection or non-terminal re-query;
- prior partial refund followed by cancellation;
- UUID stale-owner/new-owner behavior;
- processing-row ABA;
- unknown provider status;
- account deletion with child provider IDs.

## Minimum correction order

1. Make cancellation fail closed and install `Cancelling` universally.
2. Establish one durable ambiguous-provider state across every writer.
3. Extend provider-query ownership to all provider reads.
4. Repair current reset/UI safety and add durable replacement lineage.
5. Audit and reconcile legacy `reset:#N` rows.
6. Add the missing state-machine and concurrency tests before approval.
