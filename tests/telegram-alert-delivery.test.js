import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = rel => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

/**
 * A refund on NTR-8722 credited the wallet and told nobody. The alert was
 * fired, but nothing waited for it: a serverless handler that returns straight
 * after can be frozen before the request to Telegram flushes, and the failure
 * had nowhere to appear because send() ended in an empty catch.
 */
describe("watchtower alerts actually leave the building", () => {
  const tg = read("lib/telegram.js");

  it("hands every alert's promise back, so a caller can wait for it", () => {
    // A helper that drops its promise cannot be awaited even by a caller that
    // wants to. tgRefundAlert was one of them.
    const bare = tg.split("\n").filter(l => /^\s+send\(/.test(l));
    expect(bare).toEqual([]);
    expect(tg).toContain("export function tgFlush()");
  });

  it("says so when Telegram refuses, instead of swallowing it", () => {
    expect(tg).toContain("alert rejected:");
    expect(tg).toContain("alert failed:");
    // Only the alert path is asserted here. The webhook's own fetch helpers
    // (answerCallback, editMessage) still swallow theirs — a different concern,
    // and a button that silently does nothing, not an alert that vanishes.
    const sendBody = tg.slice(tg.indexOf("function send(topic"), tg.indexOf("export function tgFlush"));
    expect(sendBody).not.toContain("catch(() => {})");
  });

  it("stays out of the browser — it is reachable from the dashboard", () => {
    // welcome-bonus.js imports this file for tgBonusWithheld, and the dashboard
    // imports welcome-bonus for its tier tables. Anything server-only in here
    // ends up in the client bundle, which is how the dashboard broke once.
    expect(tg).not.toMatch(/from\s+['"]next\/server['"]/);
    expect(tg).not.toMatch(/from\s+['"][^'"]*prisma/);
  });

  it("makes every cron wait for its alerts before answering", () => {
    const dir = path.join(process.cwd(), "app/api/cron");
    const alerting = fs.readdirSync(dir)
      .map(d => path.join("app/api/cron", d, "route.js"))
      .filter(f => fs.existsSync(path.join(process.cwd(), f)))
      .filter(f => read(f).includes("lib/telegram"));

    expect(alerting.length).toBeGreaterThan(5);
    for (const f of alerting) {
      const src = read(f);
      expect(src, f).toContain("tgFlush");
      // Every response the handler returns is preceded by the wait.
      const returns = src.split("\n").filter(l => /^\s*return Response\.json\(/.test(l));
      const guarded = src.split("\n").filter(l => /^\s*await tgFlush\(\);/.test(l));
      expect(guarded.length, `${f}: ${guarded.length} flushes for ${returns.length} returns`)
        .toBeGreaterThanOrEqual(returns.length);
    }
  });
});
