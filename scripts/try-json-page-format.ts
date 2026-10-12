// Browser-safe formatting of consecutive file pages, including oversized values:
//   node --import tsx scripts/try-json-page-format.ts
import assert from "node:assert/strict";
import { formatJsonPage, initialJsonFormatState, type JsonFormatState } from "../lib/json-page-format";

function pages(chunks: string[]): { text: string; state: JsonFormatState } {
  let state = initialJsonFormatState();
  const output: string[] = [];
  for (const chunk of chunks) {
    const before = JSON.stringify(state);
    const result = formatJsonPage(chunk, Object.freeze(state));
    assert.equal(JSON.stringify(state), before, "the input cursor is not mutated");
    // File viewers can cache cursors for previous/next navigation.
    state = JSON.parse(JSON.stringify(result.state));
    output.push(result.text);
  }
  return { text: output.join(""), state };
}

const values = [
  null, true, false, 42, -2.5e30, "a string", "", [], {},
  { title: 'Quotes " and slashes \\ and braces {[,]}; emoji: 🍊', array: [false, null, { empty: {}, nested: [1, 2, 3] }] },
  ["\t\n\r", "\\\"", "\\\\", { "a:b,c": "Unicode\u0000" }],
];

for (const value of values) {
  for (const input of [JSON.stringify(value), JSON.stringify(value, null, 4)]) {
    const whole = pages([input]);
    assert.deepEqual(JSON.parse(whole.text), value, "formatting preserves JSON values");
    for (let cut = 0; cut <= input.length; cut++) {
      const split = pages([input.slice(0, cut), "", input.slice(cut)]);
      assert.equal(split.text, whole.text, `formatting is independent of a page boundary at ${cut}`);
      assert.deepEqual(split.state, whole.state);
      assert.deepEqual(JSON.parse(split.text), value);
    }
    assert.equal(pages([...input]).text, whole.text, "single-character pages retain strings and escape sequences");
  }
}

assert.equal(pages([' { "a" : [ 1 , 2 ], "b" : {} } ']).text, '{\n  "a": [\n    1,\n    2\n  ],\n  "b": {}\n}');

// One value can span several 256 KiB pages, and an escape can straddle each cut.
const longValue = { message: 'text \\" with { syntax }, [ ] and 🍊\n'.repeat(150_000), done: true };
const longInput = JSON.stringify(longValue);
assert.ok(Buffer.byteLength(longInput) > 4 * 1024 * 1024, "the fixture exceeds the normal whole-file display limit");
const chunks: string[] = [];
for (let offset = 0; offset < longInput.length; offset += 256 * 1024) chunks.push(longInput.slice(offset, offset + 256 * 1024));
const longResult = pages(chunks);
assert.deepEqual(JSON.parse(longResult.text), longValue);
assert.equal(longResult.text, pages([longInput]).text);
assert.equal(longResult.state.depth, 0);
assert.equal(longResult.state.inString, false);
assert.ok(JSON.stringify(longResult.state).length < 150, "cursor does not retain document contents");

const records = [{ event: "started", data: [1, 2] }, { event: "finished" }, 17, true, "value", []];
const jsonl = records.map((value) => JSON.stringify(value)).join("\r\n");
const expectedJsonl = records.map((value) => JSON.stringify(value, null, 2)).join("\n");
for (let cut = 0; cut <= jsonl.length; cut++) {
  assert.equal(pages([jsonl.slice(0, cut), jsonl.slice(cut)]).text, expectedJsonl, "JSONL record boundaries survive every page split");
}
assert.equal(pages(["1\n", "2\n", "3"]).text, "1\n2\n3", "primitive JSONL records do not merge into a different number");

const malformed = ']} {nope:\u0000,broken:[ true false, "literal\nnewlines and \\"quotes" tail → <script>\u00a0';
const malformedResult = pages([...malformed]).text;
const withoutJsonWhitespace = (text: string) => text.replace(/[ \t\r\n]/g, "");
assert.equal(withoutJsonWhitespace(malformedResult), withoutJsonWhitespace(malformed), "malformed non-whitespace characters are never discarded or interpreted as HTML");
assert.ok(malformedResult.includes('"literal\nnewlines'), "even invalid literal whitespace inside strings remains verbatim");

const depth = 10_000;
const nested = "[".repeat(depth) + "0" + "]".repeat(depth);
const deepResult = pages([nested.slice(0, depth), nested.slice(depth)]);
assert.equal(deepResult.state.depth, 0, "capped visual indentation does not cap or corrupt the nesting cursor");
assert.ok(deepResult.text.length < nested.length * 51, "deep nesting has a bounded display expansion");
for (const line of deepResult.text.split("\n")) assert.ok(line.length - line.trimStart().length <= 48);
assert.equal(withoutJsonWhitespace(deepResult.text), nested);

console.log("JSON page formatting checks passed.");
