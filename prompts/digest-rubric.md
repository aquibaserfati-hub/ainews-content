# Significance Scoring Rubric

Each TL;DR item gets a `significance` score from 0 to 10. The daily TL;DR
refresh uses the maximum score in the report to decide whether to fire the
Learn synthesis off-schedule (breaking-news escalation).

**Threshold:** if `max(report[].significance) >= 8`, fire the Learn workflow.
Loop guard: at most one Learn re-run per UTC day from the daily refresh.

## Scoring guide

**10 — Civilization-scale event.** New foundation model that meaningfully
changes what's possible (e.g., the original GPT-4 launch, the original Claude
Opus launch). Once-a-year events.

**9 — Major flagship release from a frontier lab.** New model with stated
benchmark gains, public availability, real changes for builders. Examples:
"Claude 5 ships" / "GPT-5 released" / "Gemini 3 Ultra public" / new Anthropic
SDK with breaking changes / OpenAI deprecates a major model. Triggers the
re-run.

**8 — Big new product or significant API change.** Examples: "Anthropic
ships persistent memory API" / "OpenAI launches o-series price cut" /
"Cursor 2.0 released with new agentic mode" / a major framework hits 1.0.
Triggers the re-run.

**7 — Notable shipped product or paper that builders will care about.**
Examples: "DeepMind's AlphaLearning paper" / "DSPy 3.0" / "vLLM hits 1.0".
Strong signal but doesn't justify a mid-week re-synthesis on its own.

**6 — Solid weekly news.** Standard "this happened, builders should know"
content. Most TL;DR items will be in the 5-7 range.

**5 — Minor but worth mentioning.** A new feature on an existing product, an
incremental research paper, a useful blog post. Filler-quality content.

**3-4 — Marketing-only or rumor.** Fundraise announcements with no product.
Twitter speculation. Press releases without shipped product. Avoid these
unless the week is genuinely quiet.

**0-2 — Don't include.** If you'd score it 0-2, drop it from the report
entirely.

## Anti-patterns to avoid

- **Inflating scores to justify a re-run.** Don't game the threshold. If
  nothing genuinely scores >= 8, leave the system idle until the scheduled
  Mon/Thu run.
- **Conflating excitement with significance.** A demo video can be exciting
  but if no one can use the thing yet, it's a 6 not a 9.
- **Following hype.** "AI agents" hype does not raise a vendor's score.
  Score on what *shipped*, not what was *announced*.

## Voice when writing each item

The `summary` field should be:
- **One or two sentences max.** If it doesn't fit, pick a different angle.
- **Active voice.** "Anthropic ships memory API" not "memory API has been shipped by Anthropic."
- **Skeptical of marketing-only releases.** If the announcement is a teaser
  with no public access, say so: "Announced — no public availability yet."
- **Builder-flavored.** Mention what changes for someone shipping product.
  "Drop-in for agent-style apps" beats "enables new use cases."
