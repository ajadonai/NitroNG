import { describe, expect, it } from "vitest";
import { getLinkPlaceholder } from "@/lib/order-form-core";

/**
 * A Use Sound order acts on the sound, so it needs the sound's own page. The
 * field used to fall through to the platform hint, tiktok.com/@username, which
 * is the one link that cannot work — it was telling people to paste a profile.
 */
describe("TikTok sound services ask for the sound's link", () => {
  const sound = [
    "TikTok Use Sound [Nigerian 🇳🇬] [HQ Real Profile] [Refill: No] [Instant Start]",
    "Tiktok Nigerian Premium Use Sound 🇳🇬 [HQ Profiles] [Instant Start]",
    "Tiktok Organic Premium Use Sound [Worldwide] [HQ Profiles] [Instant Start]",
    "🔵 TikTok Add Sound Library to Favorites | Real User Guarantee | Speed: 50-500/Day",
    "🔵 TikTok Share Sound [On Random Social Media Platforms] | Real User Guarantee",
  ];

  it.each(sound)("points %s at the sound page", (name) => {
    expect(getLinkPlaceholder("tiktok", name)).toBe("tiktok.com/music/Original-Sound-123...");
  });

  it("never sends a sound service to a profile or a video", () => {
    for (const name of sound) {
      const hint = getLinkPlaceholder("tiktok", name);
      expect(hint, name).not.toMatch(/@username/);
      expect(hint, name).not.toMatch(/\/video\//);
    }
  });

  // These begin by watching one specific video, so the sound page is the wrong
  // target and the word "sound" in their name must not drag them into the sound
  // rule. They each need the video link.
  //
  // "Video Watch" used to match neither test and fall through to the profile
  // hint, because the post rule reads "watch time" but not a bare "watch".
  it("sends the video-view combinations to the video link", () => {
    for (const name of [
      "🔵 TikTok 5-Minute Video View and Use Sound and Share | Real User Guarantee",
      "🔵 TikTok 3 Minutes Video Watch and Add Sound to Favorites | Real User Guarantee",
      "🔵 TikTok 1-Minute Video View and Add Sound to Favorites | Real User Guarantee",
    ]) {
      expect(getLinkPlaceholder("tiktok", name), name).toMatch(/\/video\//);
      expect(getLinkPlaceholder("tiktok", name), name).not.toMatch(/@username/);
    }
  });

  // dao#7568 is the only Instagram sound service. Its one completed order,
  // NTR-13665, used the reels audio page — so that is the link, not a post.
  it("points the Instagram reels sound service at the audio page", () => {
    const name = "Instagram Organic Reels Sound Use [Nigerian 🇳🇬] [HQ Real Profile] [Refill: No]";
    expect(getLinkPlaceholder("instagram", name)).toBe("instagram.com/reels/audio/123...");
  });

  it("leaves ordinary TikTok services untouched", () => {
    expect(getLinkPlaceholder("tiktok", "TikTok Followers [HQ]")).toBe("tiktok.com/@username");
    expect(getLinkPlaceholder("tiktok", "TikTok Video Likes [Fast]")).toMatch(/\/video\//);
  });
});
