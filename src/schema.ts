import { z } from "zod";

// Date format contract (locked via /plan-eng-review on 2026-04-27):
// Strict UTC ISO-8601, NO fractional seconds, always ends with Z.
// Pattern: yyyy-MM-ddTHH:mm:ssZ — e.g. "2026-04-20T06:00:00Z".
// iOS side uses a custom DateFormatter pinned to this exact format.
const utcIso8601 = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
    "must be strict UTC ISO-8601 with no fractional seconds (e.g., 2026-04-20T06:00:00Z)",
  );

export const Category = z.enum([
  "anthropic",
  "openai",
  "google",
  "otherLLM",
  "tooling",
  "founderLens",
  "other",
]);
export type Category = z.infer<typeof Category>;

export const ReportBullet = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  category: Category,
  sourceURL: z.string().url(),
  // Significance score (0-10) used by the daily TL;DR refresh to detect
  // breaking-news escalation. >= 8 triggers Learn synthesis re-run.
  significance: z.number().int().min(0).max(10),
});
export type ReportBullet = z.infer<typeof ReportBullet>;

export const LearnDetail = z.object({
  whatItDoes: z.string().min(1),
  whoItsFor: z.string().min(1),
  pros: z.array(z.string().min(1)).min(1),
  cons: z.array(z.string().min(1)).min(1),
  setupGuideMarkdown: z.string().min(1),
  sourceURL: z.string().url(),
});
export type LearnDetail = z.infer<typeof LearnDetail>;

export const LearnItem = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: Category,
  oneLineDescription: z.string().min(1),
  estimatedSetupMinutes: z.number().int().positive().nullable(),
  detail: LearnDetail,
});
export type LearnItem = z.infer<typeof LearnItem>;

export const Digest = z.object({
  schemaVersion: z.literal(1),
  weekOf: utcIso8601,
  reportGeneratedAt: utcIso8601,
  learnGeneratedAt: utcIso8601,
  report: z.array(ReportBullet).min(1),
  learn: z.array(LearnItem).min(1),
});
export type Digest = z.infer<typeof Digest>;

export const SCHEMA_VERSION = 1 as const;

// Just the report-only update produced by the daily TL;DR refresh.
// The daily workflow reads the existing digest, replaces report[] +
// reportGeneratedAt, keeps everything else.
export const DailyReportUpdate = z.object({
  reportGeneratedAt: utcIso8601,
  report: z.array(ReportBullet).min(1),
});
export type DailyReportUpdate = z.infer<typeof DailyReportUpdate>;

// ── Curriculum (v2) ───────────────────────────────────────────────────────
// Hand-curated lesson library, parallel artifact to Digest. Lives at
// gh-pages/curriculum.json. Independent schemaVersion from Digest.

export const StepType = z.enum(["read", "runCommand", "verify"]);
export type StepType = z.infer<typeof StepType>;

// Step IDs are no-zero-pad: "step-1", "step-2", ..., "step-12".
const stepId = z
  .string()
  .regex(/^step-[1-9]\d*$/, "must match 'step-N' with no zero-pad (step-1, step-2, ...)");

export const LessonStep = z.object({
  id: stepId,
  title: z.string().min(1),
  body: z.string().min(1), // markdown
  stepType: StepType,
  validationHint: z.string().min(1).nullable(),
});
export type LessonStep = z.infer<typeof LessonStep>;

export const Lesson = z.object({
  id: z.string().min(1), // stable kebab id, e.g. "setup-claude-code"
  trackId: z.string().min(1),
  title: z.string().min(1),
  oneLineDescription: z.string().min(1),
  estimatedMinutes: z.number().int().positive(),
  category: Category,
  prerequisites: z.array(z.string().min(1)),
  youtubeURL: z.string().url().nullable(),
  steps: z.array(LessonStep).min(1),
  isProContent: z.boolean(), // ships false in v2; v2.1 will toggle
});
export type Lesson = z.infer<typeof Lesson>;

export const CurriculumTrack = z.object({
  id: z.string().min(1), // "beginner" | "intermediate" | "advanced"
  title: z.string().min(1),
  description: z.string().min(1),
  order: z.number().int().min(0),
  lessons: z.array(Lesson),
});
export type CurriculumTrack = z.infer<typeof CurriculumTrack>;

export const Curriculum = z.object({
  schemaVersion: z.literal(1),
  updatedAt: utcIso8601,
  tracks: z.array(CurriculumTrack).min(1),
});
export type Curriculum = z.infer<typeof Curriculum>;

export const CURRICULUM_SCHEMA_VERSION = 1 as const;
