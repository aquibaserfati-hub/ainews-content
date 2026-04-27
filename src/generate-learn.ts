// Learn synthesis entry point. Runs Mon/Thu 06:00 UTC, plus on-demand
// (workflow_dispatch), plus on breaking-news escalation from the daily
// refresh.
//
// What it does:
// 1. Loads prompts/digest-learn.md and prompts/digest-rubric.md.
// 2. Calls Claude (claude-sonnet-4-6) with web_search enabled.
// 3. Validates the JSON output against the Digest schema.
// 4. Wraps the call in withRetries (5s/30s/90s backoff).
// 5. Writes the final digest.json to disk.
//
// The CI workflow handles publishing to gh-pages after this script writes
// the file. This script does NOT push to git directly.
//
// Local dry-run:
//   ANTHROPIC_API_KEY=sk-ant-... npm run generate:learn

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Digest, type Digest as DigestType } from "./schema.ts";
import { withRetries, RetryExhaustedError } from "./retry.ts";
import { callClaudeForJson, makeClient } from "./anthropic.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const PROMPT_PATH = join(REPO_ROOT, "prompts", "digest-learn.md");
const RUBRIC_PATH = join(REPO_ROOT, "prompts", "digest-rubric.md");
const OUTPUT_PATH = join(REPO_ROOT, "build", "digest.json");

async function main() {
  const systemPrompt = [
    readFileSync(PROMPT_PATH, "utf8"),
    "",
    "## Significance scoring rubric (loaded from digest-rubric.md)",
    "",
    readFileSync(RUBRIC_PATH, "utf8"),
  ].join("\n");

  const client = makeClient();

  console.log("[generate-learn] starting full digest synthesis...");
  const startedAt = Date.now();

  const validatedDigest = await withRetries(
    async () => {
      const rawJson = await callClaudeForJson(client, {
        systemPrompt,
        userPrompt:
          "Generate this week's full AINews Weekly digest now. Use web_search aggressively to find what shipped this week. Return JSON only.",
        enableWebSearch: true,
      });
      return parseAndValidate(rawJson);
    },
    {
      max: 3,
      log: (msg) => console.warn(`[generate-learn] ${msg}`),
    },
  );

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(validatedDigest, null, 2) + "\n", "utf8");

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[generate-learn] success in ${elapsed}s. Wrote ${OUTPUT_PATH} ` +
      `(${validatedDigest.report.length} report items, ${validatedDigest.learn.length} learn items).`,
  );
}

function parseAndValidate(rawJson: string): DigestType {
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
  const result = Digest.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 10)
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Digest schema validation failed:\n${issues}`);
  }
  return result.data;
}

main().catch((err) => {
  if (err instanceof RetryExhaustedError) {
    console.error(`[generate-learn] FAILED after retries: ${err.message}`);
  } else {
    console.error(
      `[generate-learn] FAILED (no retry): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  process.exit(1);
});
