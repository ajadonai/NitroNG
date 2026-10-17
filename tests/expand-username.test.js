import { describe, expect, it } from "vitest";
import { expandUsername, wantsProfileLink } from "../lib/order-form-core";

describe("a bare username becomes the profile link", () => {
  it("builds each platform's own profile address", () => {
    expect(expandUsername("tobi_styles", "instagram")).toBe("instagram.com/tobi_styles");
    expect(expandUsername("@tobi", "tiktok")).toBe("tiktok.com/@tobi");
    expect(expandUsername("tobi", "twitter")).toBe("x.com/tobi");
    expect(expandUsername("tobi", "Twitter/X")).toBe("x.com/tobi");
    expect(expandUsername("tobi", "youtube")).toBe("youtube.com/@tobi");
    expect(expandUsername("tobi", "TikTok")).toBe("tiktok.com/@tobi");
  });

  it("takes a dotted handle only when it starts with @", () => {
    expect(expandUsername("@tobi.styles", "instagram")).toBe("instagram.com/tobi.styles");
    expect(expandUsername("tobi.styles", "instagram")).toBe("tobi.styles");
  });

  it("leaves links, partial links and unknown platforms alone", () => {
    expect(expandUsername("instagram.com/tobi", "instagram")).toBe("instagram.com/tobi");
    expect(expandUsername("https://x.com/tobi", "twitter")).toBe("https://x.com/tobi");
    expect(expandUsername("tobi/reels", "instagram")).toBe("tobi/reels");
    expect(expandUsername("tobi", "spotify")).toBe("tobi");
    expect(expandUsername("", "instagram")).toBe("");
    expect(expandUsername("two words", "instagram")).toBe("two words");
  });
});

describe("which services want a profile", () => {
  it("reads followers and subscribers as profile services, posts and channels as not", () => {
    expect(wantsProfileLink("Instagram Followers")).toBe(true);
    expect(wantsProfileLink("YouTube Subscribers")).toBe(true);
    expect(wantsProfileLink("Instagram Likes")).toBe(false);
    expect(wantsProfileLink("Telegram Channel Members")).toBe(false);
    expect(wantsProfileLink("TikTok Use Sound")).toBe(false);
  });
});
