import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  COUNTRIES,
  COUNTRY_CODES,
  DEFAULT_COUNTRY,
  getCountry,
  isSupportedCountry,
  normalizeLocal,
  validatePhone,
  toE164,
  splitE164,
  normalizeAnyPhone,
} from "../lib/phone-countries.js";

describe("phone countries", () => {
  describe("the stored shape — what every wa.me link depends on", () => {
    it("always stores + country code + local digits", () => {
      expect(toE164("NG", "8012345678")).toBe("+2348012345678");
      expect(toE164("GB", "7911123456")).toBe("+447911123456");
      expect(toE164("US", "4155552671")).toBe("+14155552671");
      expect(toE164("GH", "241234567")).toBe("+233241234567");
      expect(toE164("KE", "712345678")).toBe("+254712345678");
    });

    it("never stores a bare local number — a message to a stranger", () => {
      for (const c of COUNTRIES) {
        const stored = toE164(c.code, c.example);
        expect(stored.startsWith(`+${c.dial}`)).toBe(true);
      }
    });

    it("round-trips through splitE164, so admin can edit without retyping", () => {
      for (const c of COUNTRIES) {
        const stored = toE164(c.code, c.example);
        expect(splitE164(stored)).toEqual({ country: c.code, local: c.example });
      }
    });
  });

  describe("what people actually type", () => {
    it("drops the leading zero people use at home", () => {
      expect(toE164("NG", "08012345678")).toBe("+2348012345678");
      expect(toE164("GB", "07911123456")).toBe("+447911123456");
    });

    it("tolerates a pasted full international number", () => {
      expect(toE164("NG", "2348012345678")).toBe("+2348012345678");
      expect(toE164("NG", "+234 801 234 5678")).toBe("+2348012345678");
      expect(toE164("GB", "+44 7911 123456")).toBe("+447911123456");
    });

    it("does not eat real digits from a local number that starts with its own dial code", () => {
      // A Ghanaian local number beginning 233… must survive: stripping the dial
      // code unconditionally would silently remove three real digits.
      expect(normalizeLocal("GH", "233456789")).toBe("233456789");
      expect(toE164("GH", "233456789")).toBe("+233233456789");
    });

    it("strips spaces, dashes and brackets", () => {
      expect(toE164("NG", "0801-234-5678")).toBe("+2348012345678");
      expect(toE164("US", "(415) 555-2671")).toBe("+14155552671");
    });
  });

  describe("per-country rules, as approved", () => {
    it("Nigeria stays strict: 10 digits starting 7, 8 or 9", () => {
      expect(validatePhone("NG", "8012345678").ok).toBe(true);
      expect(validatePhone("NG", "7012345678").ok).toBe(true);
      expect(validatePhone("NG", "9012345678").ok).toBe(true);
      expect(validatePhone("NG", "6012345678").ok).toBe(false);
      expect(validatePhone("NG", "801234567").ok).toBe(false);
    });

    it("UK is mobile-only, because WhatsApp needs a mobile", () => {
      expect(validatePhone("GB", "7911123456").ok).toBe(true);
      expect(validatePhone("GB", "2079460958").ok).toBe(false); // a London landline
    });

    it("US, Ghana and Kenya are length checks", () => {
      expect(validatePhone("US", "4155552671").ok).toBe(true);
      expect(validatePhone("US", "415555267").ok).toBe(false);
      expect(validatePhone("GH", "241234567").ok).toBe(true);
      expect(validatePhone("KE", "712345678").ok).toBe(true);
      expect(validatePhone("KE", "71234567").ok).toBe(false);
    });
  });

  describe("error copy reads as English", () => {
    it("uses the adjective, not the country name", () => {
      expect(validatePhone("NG", "123").error).toBe("Enter a valid Nigerian number (e.g. 8012345678)");
      expect(validatePhone("GH", "123").error).toBe("Enter a valid Ghanaian number (e.g. 241234567)");
      expect(validatePhone("GB", "123").error).toContain("valid UK number");
    });

    it("asks for a number when the field is empty", () => {
      expect(validatePhone("NG", "").error).toBe("Enter your WhatsApp number");
    });

    it("rejects an unsupported country rather than guessing one", () => {
      expect(validatePhone("FR", "612345678").ok).toBe(false);
      expect(toE164("FR", "612345678")).toBeNull();
    });
  });

  describe("splitE164 on values it cannot place", () => {
    it("returns bare digits rather than mislabelling the country", () => {
      expect(splitE164("+33612345678")).toEqual({ country: null, local: "33612345678" });
      expect(splitE164("")).toEqual({ country: null, local: "" });
      expect(splitE164(null)).toEqual({ country: null, local: "" });
    });

    it("reads +234 as Nigeria, never as US +2…", () => {
      expect(splitE164("+2348012345678").country).toBe("NG");
      expect(splitE164("+14155552671").country).toBe("US");
    });
  });

  it("the offered set and default are the agreed ones", () => {
    expect(COUNTRY_CODES).toEqual(["NG", "US", "GB", "GH", "KE"]);
    expect(DEFAULT_COUNTRY).toBe("NG");
    expect(isSupportedCountry("NG")).toBe(true);
    expect(isSupportedCountry("FR")).toBe(false);
    expect(getCountry("GB").dial).toBe("44");
  });
});

describe("normalizeAnyPhone — the crew portal, where there is no country picker", () => {
  it("turns a locally-typed Nigerian number into something wa.me can dial", () => {
    // The bug this fixes: stored raw, "08012345678" produced wa.me/08012345678,
    // which is not an address, so the admin's WhatsApp button went nowhere.
    expect(normalizeAnyPhone("08012345678")).toBe("+2348012345678");
    expect(normalizeAnyPhone("8012345678")).toBe("+2348012345678");
  });

  it("keeps a number that already carries a supported country code", () => {
    expect(normalizeAnyPhone("447911123456")).toBe("+447911123456");
    expect(normalizeAnyPhone("+44 7911 123456")).toBe("+447911123456");
    expect(normalizeAnyPhone("+2348012345678")).toBe("+2348012345678");
  });

  it("returns null rather than storing something undialable", () => {
    for (const bad of ["", null, "123", "abc", "+33612345678"]) {
      expect(normalizeAnyPhone(bad), String(bad)).toBeNull();
    }
  });
});

/**
 * The input cap in components/phone-field.jsx, kept honest here.
 *
 * The field asks for a WhatsApp number, so people copy it out of WhatsApp,
 * where it reads +234 801 234 5678. Browser autofill supplies the same shape.
 * The cap used to be maxLocal + 1, which is shorter than that form in every
 * country whose dial code is longer than one digit, so the last digits were
 * silently dropped and a correctly typed number was rejected as invalid.
 *
 * This duplicates one expression from the component on purpose: it is the one
 * line that decides whether a real number survives being typed, and a unit test
 * can reach it where a JSX onChange handler cannot.
 */
const fieldCap = (c) => c.dial.length + c.maxLocal + 1;
const typeInto = (c, typed) => String(typed).replace(/\D/g, "").slice(0, fieldCap(c));

describe("the phone field's input cap fits what people actually paste", () => {
  it("keeps a full international number intact for every country", () => {
    for (const c of COUNTRIES) {
      const pasted = `+${c.dial} ${c.example}`;
      const survived = validatePhone(c.code, typeInto(c, pasted));
      expect(survived.ok, `${c.code} ${pasted}`).toBe(true);
      expect(survived.e164, `${c.code} ${pasted}`).toBe(`+${c.dial}${c.example}`);
    }
  });

  it("still accepts the local forms it always did", () => {
    for (const c of COUNTRIES) {
      expect(validatePhone(c.code, typeInto(c, c.example)).ok, c.code).toBe(true);
      expect(validatePhone(c.code, typeInto(c, `0${c.example}`)).ok, c.code).toBe(true);
    }
  });

  it("survives the country code followed by a leading zero", () => {
    // +234 0801 234 5678 — people keep the zero they are used to dialling.
    for (const c of COUNTRIES) {
      expect(validatePhone(c.code, typeInto(c, `+${c.dial}0${c.example}`)).ok, c.code).toBe(true);
    }
  });

  // The regression itself: the old cap, asserted to fail, so nobody can quietly
  // restore it and still see this file pass.
  it("would reject the same pasted numbers at the old maxLocal + 1 cap", () => {
    const oldCap = (c, typed) => String(typed).replace(/\D/g, "").slice(0, c.maxLocal + 1);
    const broken = COUNTRIES.filter(
      (c) => !validatePhone(c.code, oldCap(c, `+${c.dial} ${c.example}`)).ok,
    );
    // Four of five: US escaped only because +1 is a single digit.
    expect(broken.map((c) => c.code)).toEqual(["NG", "GB", "GH", "KE"]);
  });

  // Everything above reasons about a copy of the cap. This is the line that
  // ties that copy to the component, so changing the component without changing
  // this file fails here rather than silently in front of a customer.
  it("is the cap the component actually applies", () => {
    const source = readFileSync("components/phone-field.jsx", "utf8");
    expect(source).toContain("slice(0, cc.dial.length + cc.maxLocal + 1)");
    expect(source).not.toContain("slice(0, cc.maxLocal + 1)");
  });

  it("is still a bound, so the field cannot take an essay", () => {
    for (const c of COUNTRIES) {
      expect(typeInto(c, "9".repeat(80)).length, c.code).toBe(fieldCap(c));
      expect(fieldCap(c)).toBeLessThanOrEqual(16);
    }
  });
});
