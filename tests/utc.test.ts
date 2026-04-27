import { describe, expect, it } from "vitest";
import { formatUtcIso8601, currentWeekOfUtcIso8601, nowUtcIso8601 } from "../src/utc.ts";

describe("formatUtcIso8601", () => {
  it("strips fractional seconds", () => {
    const d = new Date("2026-04-27T15:09:37.123Z");
    expect(formatUtcIso8601(d)).toBe("2026-04-27T15:09:37Z");
  });

  it("preserves UTC marker (always Z, never +00:00)", () => {
    const d = new Date("2026-01-01T00:00:00.000Z");
    expect(formatUtcIso8601(d)).toBe("2026-01-01T00:00:00Z");
  });

  it("matches the contract regex from schema.ts", () => {
    const contract = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    expect(formatUtcIso8601(new Date("2026-04-27T15:09:37.999Z"))).toMatch(
      contract,
    );
    expect(nowUtcIso8601()).toMatch(contract);
  });
});

describe("currentWeekOfUtcIso8601", () => {
  it("returns Monday 00:00:00Z when today is Wednesday", () => {
    // 2026-04-22 is a Wednesday.
    const wed = new Date("2026-04-22T15:09:37Z");
    expect(currentWeekOfUtcIso8601(wed)).toBe("2026-04-20T00:00:00Z");
  });

  it("returns Monday 00:00:00Z when today is Monday", () => {
    const mon = new Date("2026-04-20T06:00:00Z");
    expect(currentWeekOfUtcIso8601(mon)).toBe("2026-04-20T00:00:00Z");
  });

  it("returns previous Monday when today is Sunday", () => {
    // 2026-04-26 is a Sunday.
    const sun = new Date("2026-04-26T23:59:59Z");
    expect(currentWeekOfUtcIso8601(sun)).toBe("2026-04-20T00:00:00Z");
  });

  it("returns Monday 00:00:00Z when today is Saturday", () => {
    // 2026-04-25 is a Saturday.
    const sat = new Date("2026-04-25T12:00:00Z");
    expect(currentWeekOfUtcIso8601(sat)).toBe("2026-04-20T00:00:00Z");
  });
});
