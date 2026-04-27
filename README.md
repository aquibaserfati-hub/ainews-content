# ainews-content

Content pipeline for **AINews Weekly**, an iOS app shipping a weekly AI digest. This repo runs the GitHub Actions that generate `digest.json` and publish it to GitHub Pages, where the iOS app fetches it.

The iOS app lives at [aquibaserfati-hub/ainews-app](https://github.com/aquibaserfati-hub/ainews-app).

## Cadence

Locked via [/plan-eng-review on 2026-04-27](https://github.com/aquibaserfati-hub/ainews-content/blob/main/README.md#cadence):

- **Daily 06:00 UTC** (`digest-daily.yml`) — refreshes `report[]` only. Cheap.
- **Mon + Thu 06:00 UTC** (`digest-learn.yml`) — full synthesis: report + 3-5 Learn items with full setup guides.
- **`workflow_dispatch`** — both workflows can be fired manually from the Actions tab or `gh workflow run digest-learn.yml`.
- **Breaking-news escalation** — when the daily refresh sees an item with `significance >= 8`, it dispatches `digest-learn` via `repository_dispatch`. Loop-guarded to one re-run per UTC day.

Total cost ceiling: ~$140-560/yr.

## Local development

```bash
npm install
npm test                             # contract + retry + utc tests
ANTHROPIC_API_KEY=sk-ant-... \
  npm run generate:learn             # local dry run, writes build/digest.json
npx tsx src/verify-digest.ts build/digest.json
```

You'll need an Anthropic API key with the org verified for `claude-sonnet-4-6`. Set a soft spend cap on this key (recommended: $20/mo) since it's used unattended in CI.

## Repo layout

```
ainews-content/
├── .github/workflows/
│   ├── digest-daily.yml      # daily TL;DR refresh + breaking-news dispatch
│   └── digest-learn.yml      # Mon/Thu Learn synthesis
├── prompts/
│   ├── digest-daily.md       # prompt for daily TL;DR refresh
│   ├── digest-learn.md       # prompt for full synthesis
│   └── digest-rubric.md      # significance scoring rubric (0-10)
├── src/
│   ├── schema.ts             # zod schema (single source of truth — see test below)
│   ├── retry.ts              # withRetries(fn, max=3) — backoff 5s/30s/90s
│   ├── anthropic.ts          # Claude wrapper (web_search tool enabled)
│   ├── utc.ts                # strict UTC ISO-8601 helpers
│   ├── generate-daily.ts     # daily refresh entry point
│   ├── generate-learn.ts     # Learn synthesis entry point
│   └── verify-digest.ts      # standalone schema verifier (used in CI)
├── tests/
│   ├── schema.test.ts        # CONTRACT TEST — fixture must pass zod
│   ├── retry.test.ts
│   └── utc.test.ts
├── test-fixtures/
│   └── digest-v1.json        # canonical example digest, contract test
└── package.json
```

## Cross-repo contract

`test-fixtures/digest-v1.json` is the **canonical example digest**. Two tests validate it:

1. `tests/schema.test.ts` (this repo) — backend zod accepts the fixture.
2. `Tests/ModelsTests.swift` (in `ainews-app`) — iOS Codable decodes the fixture.

If either test fails, the JSON contract has drifted between backend and iOS. **Treat schema changes with the same rigor as database migrations** — see the regression rule in the [design doc](https://github.com/aquibaserfati-hub/ainews-content/issues/1).

When changing the schema:

1. Update `src/schema.ts` here.
2. Update `Models.swift` in `ainews-app`.
3. Update `test-fixtures/digest-v1.json` in BOTH repos.
4. Re-run `npm test` here AND `xcodebuild test` in `ainews-app`. Both must pass before merging either change.

## Date format

Strict UTC ISO-8601 with no fractional seconds: `yyyy-MM-ddTHH:mm:ssZ`. E.g. `2026-04-20T06:00:00Z`. Bare Swift `.iso8601` is too permissive — both sides use a custom formatter pinned to this exact format.

## Failure mode

If any workflow fails (Claude API error, validation failure, rate limit, etc.), the workflow exits non-zero. **The previous good `digest.json` is NOT overwritten.** The iOS app keeps showing the last published content with a "Last updated N days ago" indicator. GitHub Actions sends a failure-notification email to the repo owner.

The retry helper (`src/retry.ts`) wraps every Claude call with 3 attempts and 5s/30s/90s backoff. Most transient failures (web search timeouts, occasional model blips) are caught here.

## Pre-App-Store-submission checklist

Before submitting `ainews-app` for App Store review:

```bash
gh workflow run digest-learn.yml --repo aquibaserfati-hub/ainews-content
```

This fires the Learn synthesis manually so `gh-pages` has a fresh `digest.json` before Apple reviewers test the iOS app. Without this, the first reviewer install might hit an empty `gh-pages` branch and bounce the submission for "no content."

## License

MIT.
