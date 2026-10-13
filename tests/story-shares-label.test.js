import { describe, expect, it } from "vitest";
import { getPublicServiceLabel } from "@/lib/public-service-label";

/**
 * NTR-14694: a customer ordered what the full list called "Shares", linked an
 * Instagram post, and had bought story shares. It delivered partially. Thirteen
 * of the sixteen story-share services in the catalogue read as plain "Shares"
 * at the time, because the only story pattern matched "share TO story" and the
 * provider names mostly say "Story Share".
 */
describe("story shares are not just Shares", () => {
  const story = [
    "Instagram Organic Story Shares [Nigerian 🇳🇬] [HQ Real Profile] [Refill: No] [Instant Start]",
    "Instagram Story Share [Refill: No] [HQ Worldwide Profile] [Instant Start]",
    "Instagram Story Sharing [ Verified Accounts ] [ 6 Share ]",
    "🔵 Instagram Share Post on Story | Real User Guarantee | Speed: 100-1.000/Day",
    "Instagram Nigerian Share to Story 🇳🇬 [HQ Profiles] [Instant Start]",
    "Instagram Organic Share to Story [HQ Worldwide Profile] [Refill: No] [Instant Start]",
  ];

  it.each(story)("names the story in %s", (raw) => {
    const label = getPublicServiceLabel(raw, "Instagram");
    expect(label, raw).toMatch(/Story Shares/);
  });

  it("leaves an ordinary share service alone", () => {
    for (const raw of [
      "Instagram Shares [Max 100K] [Instant Start]",
      "Instagram Post Shares [Real] [Fast]",
    ]) {
      const label = getPublicServiceLabel(raw, "Instagram");
      expect(label, raw).toMatch(/Shares/);
      expect(label, raw).not.toMatch(/Story/);
    }
  });

  // An engagement bundle that happens to include one story share is not a
  // story-share service. It is protected by the matcher taking the earliest
  // phrase in the name rather than by an exclusion rule, so it is asserted here
  // in case that ordering ever changes.
  it("does not relabel a bundle that merely contains a story share", () => {
    const bundle = "Instagram Verified Accounts [ 1 Follow + 1 Comment + 1 Like + 1 Save + 1 Story Share + 1 Repost ] [HQ Worldwide Profiles] [Refill: No] [Instant Start]";
    expect(getPublicServiceLabel(bundle, "Instagram")).not.toMatch(/Story Shares/);
  });
});
