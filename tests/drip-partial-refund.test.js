import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/**
 * A drip order that ends Partial owes the customer for what never arrived.
 *
 * It did not pay. lib/drip-completion.js set the status to Partial and awarded
 * loyalty points, and stopped there — no refund, no refundedAt, no transaction.
 * The polling cron in app/api/cron/orders/route.js had always done it properly,
 * so the two paths disagreed and only one of them was ever read.
 *
 * NTR-8339: charged ₦23,895 for 500 YouTube subscribers, 23 delivered, 477
 * never arrived, nothing refunded. Found because the customer asked, which is
 * the worst way to find it. Two other orders were in the same state.
 */
describe("a drip order that ends Partial refunds the undelivered part", () => {
  const drip = read("lib/drip-completion.js");

  it("issues the refund at all", () => {
    const block = drip.slice(drip.indexOf("if (upd.status === 'Partial')"));
    expect(block, "the Partial branch does not credit the wallet").toMatch(/UPDATE users SET balance = balance \+/);
    expect(block, "no refund transaction is written").toMatch(/type: 'refund'/);
    expect(block, "refundedAt is never stamped, so it looks unrefunded forever").toMatch(/refundedAt: new Date\(\)/);
  });

  it("uses the same arithmetic as the polling cron", () => {
    // Pro-rata on what is left, floored to whole naira. If these two ever
    // disagree, the same order refunds a different amount depending on which
    // path happened to finish it.
    const formula = /Math\.floor\(\(remains \/ \w+\.quantity\) \* \w+\.charge \/ 100\) \* 100/;
    expect(drip, "drip uses a different formula").toMatch(formula);
    expect(read("app/api/cron/orders/route.js"), "the cron formula moved").toMatch(formula);
  });

  it("cannot pay twice if it runs again", () => {
    // getTotalRefundedKobo nets off anything already refunded. Without it a
    // re-run of the completion pass would credit the wallet a second time.
    const block = drip.slice(drip.indexOf("if (upd.status === 'Partial')"));
    expect(block).toMatch(/getTotalRefundedKobo/);
    expect(block).toMatch(/Math\.max\(0, want - already\)/);
  });

  it("reads the columns the refund needs", () => {
    // The parent row was selected with four columns and the refund needs the
    // charge, the quantity and the public order id. Losing any of them makes
    // the amount NaN rather than throwing, which would refund nothing quietly.
    const q = drip.slice(drip.indexOf('SELECT "id", "userId"'), drip.indexOf("FOR UPDATE"));
    for (const col of ['"orderId"', '"charge"', '"quantity"', '"nitroPointsRedeemedKobo"']) {
      expect(q, `parent query is missing ${col}`).toContain(col);
    }
  });

  it("splits between wallet and points like every other refund", () => {
    const block = drip.slice(drip.indexOf("if (upd.status === 'Partial')"));
    expect(block).toMatch(/computeRefundSplit/);
    expect(block).toMatch(/reverseOrderPoints/);
  });
});
