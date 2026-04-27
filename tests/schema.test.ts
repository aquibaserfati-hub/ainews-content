// CRITICAL: cross-repo contract test (per /plan-eng-review Issue 1).
// The same digest-v1.json fixture is read by ainews-app's iOS Codable
// decoder. If this test passes here AND the iOS test passes there, the
// JSON contract is in sync. If either side breaks, its own test fails first.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Digest, DailyReportUpdate, ReportBullet, LearnItem } from "../src/schema.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "..", "test-fixtures", "digest-v1.json");

describe("Digest schema (contract test)", () => {
  it("accepts the canonical fixture digest-v1.json", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const result = Digest.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        "Fixture failed contract test:\n" +
          JSON.stringify(result.error.issues, null, 2),
      );
    }
    expect(result.success).toBe(true);
  });

  it("rejects a digest missing report[]", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    delete parsed.report;
    const result = Digest.safeParse(parsed);
    expect(result.success).toBe(false);
  });

  it("rejects a digest with a Date that has fractional seconds", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    parsed.weekOf = "2026-04-20T00:00:00.123Z"; // millis NOT allowed
    const result = Digest.safeParse(parsed);
    expect(result.success).toBe(false);
  });

  it("rejects a digest with a Date in non-UTC timezone format", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    parsed.weekOf = "2026-04-20T00:00:00+01:00"; // offset NOT allowed
    const result = Digest.safeParse(parsed);
    expect(result.success).toBe(false);
  });

  it("rejects a digest with significance > 10", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    parsed.report[0].significance = 11;
    const result = Digest.safeParse(parsed);
    expect(result.success).toBe(false);
  });

  it("rejects a digest with an unknown category", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    parsed.report[0].category = "deepmind"; // not in enum
    const result = Digest.safeParse(parsed);
    expect(result.success).toBe(false);
  });

  it("rejects a digest with schemaVersion != 1", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    parsed.schemaVersion = 2;
    const result = Digest.safeParse(parsed);
    expect(result.success).toBe(false);
  });
});

describe("DailyReportUpdate schema", () => {
  it("accepts a partial update with only report[] and reportGeneratedAt", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const partial = {
      reportGeneratedAt: parsed.reportGeneratedAt,
      report: parsed.report,
    };
    const result = DailyReportUpdate.safeParse(partial);
    expect(result.success).toBe(true);
  });

  it("rejects an update missing report[]", () => {
    const partial = { reportGeneratedAt: "2026-04-27T06:00:00Z" };
    const result = DailyReportUpdate.safeParse(partial);
    expect(result.success).toBe(false);
  });
});
