import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  settingFindMany: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    setting: { findMany: (...a) => mocks.settingFindMany(...a) },
    user: { findUnique: (...a) => mocks.userFindUnique(...a) },
  },
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: (...a) => mocks.getCurrentUser(...a) }));
vi.mock("@/lib/logger", () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const ALL = ["flutterwave", "alatpay", "monnify", "korapay", "crypto", "manual"];
const enabled = ids => ids.map(id => ({ key: `gateway_${id}`, value: JSON.stringify({ enabled: true }) }));

/**
 * Signup accepts five countries, and five of the six payment methods can only
 * work from Nigeria. Before this, a customer in London met all six and found
 * out which ones worked by failing. The list is now cut by the country on the
 * account, and the route says how many it cut, so the wallet can say why.
 */
describe("payment methods follow the customer's country", () => {
  beforeEach(() => {
    mocks.settingFindMany.mockResolvedValue(enabled(ALL));
    mocks.getCurrentUser.mockResolvedValue({ id: "u1" });
  });

  const load = async () => {
    const { GET } = await import("@/app/api/payments/gateways/route");
    return (await GET()).json();
  };

  it("shows a Nigerian everything, as it always did", async () => {
    mocks.userFindUnique.mockResolvedValue({ country: "NG" });
    const r = await load();
    expect(r.gateways.map(g => g.id)).toEqual(ALL);
    expect(r.hiddenNigeriaOnly).toBe(0);
  });

  it("shows a customer abroad only what can actually take their money", async () => {
    for (const country of ["US", "GB", "GH", "KE"]) {
      mocks.userFindUnique.mockResolvedValue({ country });
      const r = await load();
      // Flutterwave stays: an international card pays an NGN charge, the
      // cardholder's bank does the conversion. The Nigerian bank rails go.
      expect(r.gateways.map(g => g.id), country).toEqual(["flutterwave", "crypto"]);
      expect(r.hiddenNigeriaOnly, country).toBe(4);
      expect(r.country).toBe(country);
    }
  });

  it("describes Flutterwave by what actually works abroad", async () => {
    mocks.userFindUnique.mockResolvedValue({ country: "GB" });
    const abroad = (await load()).gateways.find(g => g.id === "flutterwave");
    expect(abroad.desc).toBe("Card payment");

    mocks.userFindUnique.mockResolvedValue({ country: "NG" });
    const home = (await load()).gateways.find(g => g.id === "flutterwave");
    expect(home.desc).toBe("Cards, Bank Transfer, Mobile Money");
  });

  it("treats a gateway it does not recognise as Nigerian — every rail so far has been", async () => {
    mocks.settingFindMany.mockResolvedValue(enabled([...ALL, "newbank"]));
    mocks.userFindUnique.mockResolvedValue({ country: "GB" });
    const r = await load();
    expect(r.gateways.map(g => g.id)).toEqual(["flutterwave", "crypto"]);
    expect(r.hiddenNigeriaOnly).toBe(5);
  });

  it("falls back to the Nigerian list with no session or no country on file", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    expect((await load()).gateways).toHaveLength(6);

    mocks.getCurrentUser.mockResolvedValue({ id: "u1" });
    mocks.userFindUnique.mockResolvedValue({ country: null });
    expect((await load()).gateways).toHaveLength(6);
  });

  it("still answers if the session lookup itself throws", async () => {
    mocks.getCurrentUser.mockRejectedValue(new Error("cookies unavailable"));
    const r = await load();
    expect(r.gateways).toHaveLength(6);
    expect(r.hiddenNigeriaOnly).toBe(0);
  });
});
