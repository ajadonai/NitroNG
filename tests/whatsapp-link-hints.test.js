import { describe, expect, it } from "vitest";
import { getLinkPlaceholder } from "@/lib/order-form-core";

/**
 * Everything Nitro sells on WhatsApp lives inside a channel, and every
 * completed WhatsApp order has used a whatsapp.com/channel link — channel
 * members, post reactions and emoji reactions alike. The examples said
 * otherwise: `post` was wa.me/phonenumber, so a poll-vote customer was asked
 * for a phone number, and there was no `channel` entry at all, so channel
 * members were pointed at a group invite link.
 */
describe("WhatsApp link hints point at the channel", () => {
  it("never asks a poll-vote customer for a phone number", () => {
    const hint = getLinkPlaceholder("whatsapp", "WhatsApp Poll Votes (Option B)");
    expect(hint).not.toMatch(/wa\.me/);
    expect(hint).not.toMatch(/phonenumber/i);
    expect(hint).toMatch(/whatsapp\.com\/channel\//);
  });

  it("points post-level services at a post inside the channel", () => {
    for (const name of [
      "WhatsApp Poll Votes (Option A)",
      "Whatsapp Channel Post Emoji Reactions [ Worldwide ]",
      "Whatsapp Channel Post Reaction [👍] [Worldwide]",
      "WhatsApp Post Likes 🇳🇬",
    ]) {
      expect(getLinkPlaceholder("whatsapp", name), name).toBe("whatsapp.com/channel/0029Va.../123");
    }
  });

  it("points channel membership at the channel itself", () => {
    for (const name of [
      "Whatsapp Channel Members [HQ Profile] [Refill: No]",
      "🔵 WhatsApp Organic Channel Members | Speed: 1K/Day",
    ]) {
      expect(getLinkPlaceholder("whatsapp", name), name).toBe("whatsapp.com/channel/0029Va...");
    }
  });

  // Group services are the one case a chat.whatsapp.com invite is still right.
  it("leaves group joins on the invite link", () => {
    expect(getLinkPlaceholder("whatsapp", "WhatsApp Group Members 🇳🇬")).toMatch(/chat\.whatsapp\.com/);
  });
});
