import Anthropic from "@anthropic-ai/sdk";
import { NoRetryError } from "./retry.ts";

// Claude wrapper that handles structured-JSON responses + web search tool.
//
// Usage:
//   const client = makeClient();
//   const json = await callClaudeForJson(client, {
//     systemPrompt: fs.readFileSync("prompts/digest-learn.md", "utf8"),
//     userPrompt: "Generate this week's digest.",
//     enableWebSearch: true,
//   });
//
// JSON parsing is the caller's responsibility; this returns the raw text
// from Claude's content blocks. The caller validates with zod.

const MODEL = "claude-sonnet-4-6";

// Hard cap on output. Sonnet supports 64K, but realistic digest output is
// well under 32K. Cap protects against runaway generation.
const MAX_TOKENS = 16_000;

export function makeClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Auth failure is not retryable — bail fast.
    throw new NoRetryError(
      "ANTHROPIC_API_KEY env var is not set. Configure as a GitHub Actions secret in ainews-content.",
    );
  }
  return new Anthropic({ apiKey });
}

export interface CallClaudeOptions {
  systemPrompt: string;
  userPrompt: string;
  enableWebSearch?: boolean;
  /**
   * Optional override for the model. Defaults to claude-sonnet-4-6.
   */
  model?: string;
}

export async function callClaudeForJson(
  client: Anthropic,
  opts: CallClaudeOptions,
): Promise<string> {
  // Anthropic's server-side `web_search_20250305` tool does NOT take an
  // input_schema (the server runs the tool, not the model), but the SDK's
  // ToolUnion type currently requires one. Cast to bypass — runtime API
  // accepts this exact shape. Re-evaluate on SDK upgrade.
  const tools = opts.enableWebSearch
    ? ([
        {
          type: "web_search_20250305",
          name: "web_search",
        },
      ] as unknown as Anthropic.Messages.ToolUnion[])
    : undefined;

  const response = await client.messages.create({
    model: opts.model ?? MODEL,
    max_tokens: MAX_TOKENS,
    system: opts.systemPrompt,
    messages: [{ role: "user", content: opts.userPrompt }],
    tools,
  });

  // Concatenate all text content blocks. Web search tool calls produce
  // additional content blocks but the FINAL response should still end
  // with a text block containing the JSON.
  const textBlocks = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text);

  if (textBlocks.length === 0) {
    throw new Error(
      "Claude returned no text content blocks (only tool_use). Check the prompt — model probably tried to use a tool but didn't finish.",
    );
  }

  // Use the LAST text block — that's the final answer after any tool use.
  const lastText = textBlocks[textBlocks.length - 1].trim();

  // Strip any accidental code-fence wrapping. Defensive only — the prompt
  // explicitly forbids fences, but Claude occasionally adds them anyway.
  return stripCodeFence(lastText);
}

function stripCodeFence(s: string): string {
  // Matches ```json ... ``` or ``` ... ``` at the boundaries.
  const fenceMatch = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch) return fenceMatch[1].trim();
  return s;
}
