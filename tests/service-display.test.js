import { describe, it, expect } from "vitest";
import { serviceDisplay, serviceLine } from "../lib/service-display";

describe("serviceDisplay", () => {
  it("reads MoreThanPanel's pipe style", () => {
    const d = serviceDisplay("🟢 Instagram Followers | 30 Day Refill | Speed: 10-20K/Day | Max 3M | Low Drop | NEW! |");
    expect(d.title).toBe("Instagram Followers");
    expect(d.facts).toEqual(["Refill 30d", "Speed 10–20K/day", "Max 3M", "Low drop"]);
  });
  it("reads DaoSMM's bracket style and lifts the flag into a fact", () => {
    const d = serviceDisplay("Instagram Organic Followers [Nigerian 🇳🇬] [HQ Real Profile] [Refill: No] [Instant Start]");
    expect(d.title).toBe("Instagram Organic Followers");
    expect(d.facts).toEqual(["NG", "HQ profiles", "No refill", "Instant start"]);
  });
  it("reads JAP's start time and speed", () => {
    const d = serviceDisplay("Spotify Saves [Track/Album/Episode] [Refill: 30D] [Max: 1M] [Start Time: 1-12 Hours] [Speed: 50K/Day]");
    expect(d.title).toBe("Spotify Saves");
    expect(d.facts).toEqual(["Track/Album/Episode", "Refill 30d", "Max 1M", "Start 1–12 h", "Speed 50K/day"]);
  });
  it("fixes casing, drops noise, and pulls a trailing speed out of the title", () => {
    expect(serviceDisplay("🔵 Tiktok Real Likes | Speed: 10-20K/Day | Max 1M | Low Drop |").title).toBe("TikTok Real Likes");
    const d = serviceDisplay("Instagram Custom Comments [Max 100K] [HQ Profile] [Refill:No] [Instant Start] 50K/Day");
    expect(d.title).toBe("Instagram Custom Comments");
    expect(d.facts).toContain("Speed 50K/day");
    expect(serviceDisplay("Discord Members [Offline] [HQ Profiles] [Refill: 30D] [Add Bot] [Read Description]").facts).not.toContain("Read Description");
  });
  it("keeps a plain name as it is and never returns an empty title", () => {
    expect(serviceDisplay("Instagram Followers")).toEqual({ title: "Instagram Followers", facts: [] });
    expect(serviceDisplay("🟢").title).toBe("🟢");
    expect(serviceLine("YouTube Likes | No Refill | Max 5K")).toBe("YouTube Likes · No refill · Max 5K");
  });
});
