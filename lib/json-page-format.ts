/** The small, serializable cursor carried between consecutive decoded file pages. */
export type JsonFormatState = {
  depth: number;
  inString: boolean;
  escaped: boolean;
  lastToken: string;
  whitespace: "" | "space" | "newline";
};

export function initialJsonFormatState(): JsonFormatState {
  return { depth: 0, inString: false, escaped: false, lastToken: "", whitespace: "" };
}

// Indentation is visual only. Keep the actual depth so later pages can unwind it,
// but prevent deeply nested input from creating unbounded runs of spaces.
const INDENTS = Array.from({ length: 25 }, (_, depth) => "  ".repeat(depth));

/**
 * Pretty-print one consecutive decoded JSON or JSONL page without parsing or
 * buffering the document. Concatenate returned text across pages for a complete
 * display; carry the returned state even when a page ends inside a string.
 *
 * This is presentation, not validation: every non-whitespace character survives,
 * including malformed content. Strings are copied verbatim and source newlines
 * between top-level JSONL values are retained. No HTML is produced.
 */
export function formatJsonPage(text: string, previous: JsonFormatState): { text: string; state: JsonFormatState } {
  const state = { ...previous };
  const output: string[] = [];
  const newline = () => "\n" + INDENTS[Math.min(state.depth, INDENTS.length - 1)];

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (state.inString) {
      output.push(char);
      if (state.escaped) state.escaped = false;
      else if (char === "\\") state.escaped = true;
      else if (char === '"') state.inString = false;
      continue;
    }

    // Only JSON whitespace is normalized. Unknown bytes/characters remain visible.
    if (char === " " || char === "\t" || char === "\r" || char === "\n") {
      if (char === "\n" || char === "\r") state.whitespace = "newline";
      else if (!state.whitespace) state.whitespace = "space";
      continue;
    }

    if (char === "}" || char === "]") {
      state.depth = Math.max(0, state.depth - 1);
      if (state.lastToken && state.lastToken !== "{" && state.lastToken !== "[") output.push(newline());
    } else if (char !== ":" && char !== ",") {
      if (state.lastToken === "{" || state.lastToken === "[" || state.lastToken === ",") output.push(newline());
      else if (state.lastToken === ":") output.push(" ");
      else if (state.lastToken && state.whitespace === "newline") output.push(newline());
      else if (state.lastToken && state.whitespace === "space") output.push(" ");
    }

    output.push(char);
    state.whitespace = "";
    state.lastToken = char;
    if (char === "{" || char === "[") state.depth++;
    else if (char === '"') state.inString = true;
  }

  return { text: output.join(""), state };
}
