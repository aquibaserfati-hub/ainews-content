// Regression tests for the JSON-extraction quirks Claude has surfaced in
// real production runs. The prompt asks for raw JSON only; the model
// occasionally adds preamble or fences anyway. extractJson must handle
// all three cases without losing data.

import { describe, expect, it } from "vitest";
import { extractJson } from "../src/anthropic.ts";

describe("extractJson", () => {
  it("returns pure JSON unchanged", () => {
    const json = '{"foo": 1, "bar": "hello"}';
    expect(extractJson(json)).toBe(json);
  });

  it("trims whitespace around pure JSON", () => {
    const json = '{"foo": 1}';
    expect(extractJson(`\n\n  ${json}  \n`)).toBe(json);
  });

  it("extracts a JSON-fenced block from a response with preamble", () => {
    // This is the EXACT shape of the production failure on first run:
    // Claude prepended "Now I have all the data..." then wrapped JSON in fences.
    const response =
      "Now I have all the data I need to construct the full digest. Let me compile it into the required JSON format.\n\n" +
      "```json\n" +
      '{\n  "schemaVersion": 1,\n  "weekOf": "2026-04-20T00:00:00Z"\n}\n' +
      "```";
    const extracted = extractJson(response);
    expect(JSON.parse(extracted)).toEqual({
      schemaVersion: 1,
      weekOf: "2026-04-20T00:00:00Z",
    });
  });

  it("extracts a bare ``` block (no json language tag)", () => {
    const response = "Here is the result:\n\n```\n{\"x\": 1}\n```";
    expect(JSON.parse(extractJson(response))).toEqual({ x: 1 });
  });

  it("extracts JSON when there's preamble but no fences", () => {
    const response = "Here is the result:\n\n{\"x\": 1, \"y\": [2, 3]}";
    expect(JSON.parse(extractJson(response))).toEqual({ x: 1, y: [2, 3] });
  });

  it("handles trailing text after JSON (uses last `}`)", () => {
    const response = '{"x": 1}\n\nThat\'s the full digest.';
    expect(JSON.parse(extractJson(response))).toEqual({ x: 1 });
  });

  it("throws on response with no recognizable JSON", () => {
    expect(() => extractJson("This response has no JSON at all.")).toThrow(
      /Could not extract JSON/,
    );
  });
});
