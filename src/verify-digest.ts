// Standalone schema verifier. Used in CI after generate-learn / generate-daily
// to confirm the produced digest.json passes the contract before we publish.
//
//   npx tsx src/verify-digest.ts build/digest.json

import { readFileSync } from "node:fs";
import { Digest } from "./schema.ts";

const path = process.argv[2];
if (!path) {
  console.error("Usage: tsx src/verify-digest.ts <path-to-digest.json>");
  process.exit(2);
}

const raw = readFileSync(path, "utf8");
let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error(
    `[verify] JSON.parse failed: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
}

const result = Digest.safeParse(parsed);
if (!result.success) {
  console.error("[verify] schema validation failed:");
  for (const issue of result.error.issues.slice(0, 10)) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

console.log(
  `[verify] OK — ${result.data.report.length} report items, ${result.data.learn.length} learn items.`,
);
