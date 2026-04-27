// Daily TL;DR refresh entry point. Runs daily 06:00 UTC, plus on-demand.
//
// What it does:
// 1. Reads the existing digest.json from gh-pages (or local seed).
// 2. Calls Claude with the daily-refresh prompt.
// 3. Validates the partial output (DailyReportUpdate schema).
// 4. Replaces ONLY report[] + reportGeneratedAt in the existing digest.
// 5. Writes the merged digest.json to disk.
// 6. Detects breaking-news escalation: if max(report.significance) >= 8,
//    writes a "trigger-learn" sentinel file the workflow checks.
//
// The CI workflow handles publishing to gh-pages and (optionally) firing
// the Learn workflow via the GitHub API when the sentinel is set.
//
// Local dry-run:
//   ANTHROPIC_API_KEY=sk-ant-... npm run generate:daily

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DailyReportUpdate,
  Digest,
  type Digest as DigestType,
} from "./schema.ts";
import { withRetries, RetryExhaustedError } from "./retry.ts";
import { callClaudeForJson, makeClient } from "./anthropic.ts";
import { nowUtcIso8601 } from "./utc.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PROMPT_PATH = join(REPO_ROOT, "prompts", "digest-daily.md");
const RUBRIC_PATH = join(REPO_ROOT, "prompts", "digest-rubric.md");
const EXISTING_DIGEST_PATH = join(REPO_ROOT, "build", "digest.json");
const FIXTURE_FALLBACK_PATH = join(
  REPO_ROOT,
  "test-fixtures",
  "digest-v1.json",
);
const OUTPUT_PATH = join(REPO_ROOT, "build", "digest.json");
const TRIGGER_LEARN_SENTINEL = join(REPO_ROOT, "build", "trigger-learn.flag");

const SIGNIFICANCE_THRESHOLD = 8;

async function main() {
  const existingDigest = loadExistingDigest();

  const systemPrompt = [
    readFileSync(PROMPT_PATH, "utf8"),
    "",
    "## Significance scoring rubric (loaded from digest-rubric.md)",
    "",
    readFileSync(RUBRIC_PATH, "utf8"),
  ].join("\n");

  const client = makeClient();

  console.log("[generate-daily] starting TL;DR refresh...");
  const startedAt = Date.now();

  const update = await withRetries(
    async () => {
      const rawJson = await callClaudeForJson(client, {
        systemPrompt,
        userPrompt:
          "Refresh today's TL;DR for AINews Weekly. Use web_search to find what shipped in the last 24 hours. Return JSON only.",
        enableWebSearch: true,
      });
      return parseAndValidate(rawJson);
    },
    {
      max: 3,
      log: (msg) => console.warn(`[generate-daily] ${msg}`),
    },
  );

  const merged: DigestType = {
    ...existingDigest,
    reportGeneratedAt: nowUtcIso8601(),
    report: update.report,
  };
  // Re-validate the merged result with the full schema before writing.
  const finalCheck = Digest.safeParse(merged);
  if (!finalCheck.success) {
    throw new Error(
      `Merged digest failed full schema validation: ${JSON.stringify(finalCheck.error.issues, null, 2)}`,
    );
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(finalCheck.data, null, 2) + "\n",
    "utf8",
  );

  // Breaking-news escalation: if any item scores >= threshold, signal the
  // workflow to fire the Learn synthesis. The workflow uses the presence
  // of the sentinel file as the trigger condition.
  const maxScore = Math.max(...update.report.map((r) => r.significance));
  if (maxScore >= SIGNIFICANCE_THRESHOLD) {
    writeFileSync(
      TRIGGER_LEARN_SENTINEL,
      JSON.stringify(
        {
          reason: "significance_threshold_exceeded",
          threshold: SIGNIFICANCE_THRESHOLD,
          maxScore,
          triggerItem: update.report.find(
            (r) => r.significance === maxScore,
          ),
          createdAt: nowUtcIso8601(),
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
    console.log(
      `[generate-daily] BREAKING NEWS detected (max significance ${maxScore}). ` +
        `Sentinel written to ${TRIGGER_LEARN_SENTINEL}.`,
    );
  } else {
    console.log(
      `[generate-daily] No breaking news (max significance ${maxScore}). No Learn re-trigger.`,
    );
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[generate-daily] success in ${elapsed}s. Wrote ${OUTPUT_PATH} ` +
      `(${update.report.length} report items, learn[] preserved unchanged).`,
  );
}

function loadExistingDigest(): DigestType {
  // Try the freshly-built digest first (GH Pages snapshot brought into the
  // workflow workspace), fall back to the committed test fixture if no
  // existing digest is present yet (first-ever daily run).
  const path = existsSync(EXISTING_DIGEST_PATH)
    ? EXISTING_DIGEST_PATH
    : FIXTURE_FALLBACK_PATH;
  console.log(`[generate-daily] loading existing digest from ${path}`);
  const raw = readFileSync(path, "utf8");
  const result = Digest.safeParse(JSON.parse(raw));
  if (!result.success) {
    throw new Error(
      `Existing digest at ${path} is invalid: ${JSON.stringify(result.error.issues, null, 2)}`,
    );
  }
  return result.data;
}

function parseAndValidate(rawJson: string): DailyReportUpdate {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    const preview = rawJson.slice(0, 500);
    throw new Error(
      `JSON.parse failed: ${err instanceof Error ? err.message : String(err)}\n` +
        `First 500 chars of response:\n${preview}`,
    );
  }
  const result = DailyReportUpdate.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 10)
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`DailyReportUpdate schema validation failed:\n${issues}`);
  }
  return result.data;
}

main().catch((err) => {
  if (err instanceof RetryExhaustedError) {
    console.error(`[generate-daily] FAILED after retries: ${err.message}`);
  } else {
    console.error(
      `[generate-daily] FAILED (no retry): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  process.exit(1);
});
