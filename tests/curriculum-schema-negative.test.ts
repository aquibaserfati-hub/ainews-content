// Negative cases for the Curriculum schema. Confirms zod rejects
// malformed payloads that would otherwise crash the iOS decoder or
// hand wrong content to the tutor Worker.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Curriculum, LessonStep } from "../src/schema.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "..", "test-fixtures", "curriculum-v1.json");

function loadFixture(): unknown {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
}

describe("Curriculum schema (negative cases)", () => {
  it("rejects schemaVersion != 1", () => {
    const parsed = loadFixture() as { schemaVersion: number };
    parsed.schemaVersion = 2;
    expect(Curriculum.safeParse(parsed).success).toBe(false);
  });

  it("rejects updatedAt with fractional seconds", () => {
    const parsed = loadFixture() as { updatedAt: string };
    parsed.updatedAt = "2026-04-30T12:00:00.123Z";
    expect(Curriculum.safeParse(parsed).success).toBe(false);
  });

  it("rejects updatedAt with non-UTC offset", () => {
    const parsed = loadFixture() as { updatedAt: string };
    parsed.updatedAt = "2026-04-30T12:00:00+01:00";
    expect(Curriculum.safeParse(parsed).success).toBe(false);
  });

  it("rejects an unknown StepType", () => {
    const parsed = loadFixture() as {
      tracks: Array<{ lessons: Array<{ steps: Array<{ stepType: string }> }> }>;
    };
    parsed.tracks[0]!.lessons[0]!.steps[0]!.stepType = "watchVideo";
    expect(Curriculum.safeParse(parsed).success).toBe(false);
  });

  it("rejects a lesson with an unknown category", () => {
    const parsed = loadFixture() as {
      tracks: Array<{ lessons: Array<{ category: string }> }>;
    };
    parsed.tracks[0]!.lessons[0]!.category = "midjourney";
    expect(Curriculum.safeParse(parsed).success).toBe(false);
  });

  it("rejects a lesson missing the title", () => {
    const parsed = loadFixture() as {
      tracks: Array<{ lessons: Array<Partial<{ title: string }>> }>;
    };
    delete parsed.tracks[0]!.lessons[0]!.title;
    expect(Curriculum.safeParse(parsed).success).toBe(false);
  });

  it("rejects a lesson with empty steps[]", () => {
    const parsed = loadFixture() as {
      tracks: Array<{ lessons: Array<{ steps: unknown[] }> }>;
    };
    parsed.tracks[0]!.lessons[0]!.steps = [];
    expect(Curriculum.safeParse(parsed).success).toBe(false);
  });

  it("rejects a lesson with estimatedMinutes <= 0", () => {
    const parsed = loadFixture() as {
      tracks: Array<{ lessons: Array<{ estimatedMinutes: number }> }>;
    };
    parsed.tracks[0]!.lessons[0]!.estimatedMinutes = 0;
    expect(Curriculum.safeParse(parsed).success).toBe(false);
  });

  it("rejects a step with zero-padded id like 'step-01'", () => {
    expect(
      LessonStep.safeParse({
        id: "step-01",
        title: "Bad",
        body: "x",
        stepType: "read",
        validationHint: null,
      }).success,
    ).toBe(false);
  });

  it("rejects a step id with non-numeric suffix", () => {
    expect(
      LessonStep.safeParse({
        id: "step-one",
        title: "Bad",
        body: "x",
        stepType: "read",
        validationHint: null,
      }).success,
    ).toBe(false);
  });

  it("rejects an empty tracks[] array", () => {
    const parsed = loadFixture() as { tracks: unknown[] };
    parsed.tracks = [];
    expect(Curriculum.safeParse(parsed).success).toBe(false);
  });

  it("rejects a non-URL youtubeURL", () => {
    const parsed = loadFixture() as {
      tracks: Array<{ lessons: Array<{ youtubeURL: string | null }> }>;
    };
    parsed.tracks[0]!.lessons[0]!.youtubeURL = "not a url";
    expect(Curriculum.safeParse(parsed).success).toBe(false);
  });
});
