// CRITICAL: cross-repo contract test (v2, parallel to schema.test.ts).
// The same curriculum-v1.json fixture is read by ainews-app's iOS Codable
// decoder. If this test passes here AND CurriculumModelsTests passes there,
// the JSON contract is in sync.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Curriculum } from "../src/schema.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, "..", "test-fixtures", "curriculum-v1.json");

describe("Curriculum schema (contract test)", () => {
  it("accepts the canonical fixture curriculum-v1.json", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const result = Curriculum.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        "Fixture failed contract test:\n" +
          JSON.stringify(result.error.issues, null, 2),
      );
    }
    expect(result.success).toBe(true);
  });

  it("fixture has all three tracks in order 0/1/2", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    const parsed = Curriculum.parse(JSON.parse(raw));
    const orders = parsed.tracks.map((t) => t.order);
    expect(orders).toEqual([0, 1, 2]);
    const ids = parsed.tracks.map((t) => t.id);
    expect(ids).toEqual(["beginner", "intermediate", "advanced"]);
  });

  it("the first lesson has at least one runCommand step (the curriculum's whole point)", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    const parsed = Curriculum.parse(JSON.parse(raw));
    const firstLesson = parsed.tracks[0]?.lessons[0];
    expect(firstLesson).toBeDefined();
    const hasRunCommand = firstLesson!.steps.some(
      (s) => s.stepType === "runCommand",
    );
    expect(hasRunCommand).toBe(true);
  });

  it("every lesson references a trackId that exists", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    const parsed = Curriculum.parse(JSON.parse(raw));
    const trackIds = new Set(parsed.tracks.map((t) => t.id));
    for (const track of parsed.tracks) {
      for (const lesson of track.lessons) {
        expect(trackIds.has(lesson.trackId)).toBe(true);
      }
    }
  });

  it("every lesson ships with isProContent=false in v2 (deferred to v2.1)", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    const parsed = Curriculum.parse(JSON.parse(raw));
    for (const track of parsed.tracks) {
      for (const lesson of track.lessons) {
        expect(lesson.isProContent).toBe(false);
      }
    }
  });

  it("every prerequisite refers to a lesson that exists somewhere in the curriculum", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    const parsed = Curriculum.parse(JSON.parse(raw));
    const allLessonIds = new Set(
      parsed.tracks.flatMap((t) => t.lessons.map((l) => l.id)),
    );
    for (const track of parsed.tracks) {
      for (const lesson of track.lessons) {
        for (const prereqId of lesson.prerequisites) {
          expect(allLessonIds.has(prereqId)).toBe(true);
        }
      }
    }
  });
});
