import { readFile, writeFile } from "node:fs/promises";
import type { BuiltinTool } from "./index.ts";
import { computeUnifiedDiff } from "./diff_utils.ts";

interface Edit {
  old_str: string;
  new_str: string;
  replace_all: boolean;
}

/**
 * Parse the input into a normalized edit list. Two modes:
 * - single: top-level `old_str`/`new_str` (+ `replace_all`);
 * - multi: an `edits` array, mutually exclusive with the top-level pair.
 * Returns an error string on invalid input.
 */
function parseEdits(raw: Record<string, unknown>): { edits: Edit[]; multi: boolean } | string {
  if (raw.edits !== undefined) {
    if (typeof raw.old_str === "string" || typeof raw.new_str === "string")
      return "edit_file: provide either 'edits' or top-level 'old_str'/'new_str', not both";
    if (!Array.isArray(raw.edits) || raw.edits.length === 0) return "edit_file: 'edits' must be a non-empty array";
    const edits: Edit[] = [];
    for (let i = 0; i < raw.edits.length; i++) {
      const e = raw.edits[i] as Record<string, unknown> | null;
      if (typeof e?.old_str !== "string" || typeof e?.new_str !== "string")
        return `edit_file: edit #${i + 1}: 'old_str' and 'new_str' must be strings`;
      edits.push({ old_str: e.old_str, new_str: e.new_str, replace_all: e.replace_all === true });
    }
    return { edits, multi: true };
  }
  if (typeof raw.old_str !== "string") return "edit_file: 'old_str' must be a string";
  if (typeof raw.new_str !== "string") return "edit_file: 'new_str' must be a string";
  return {
    edits: [{ old_str: raw.old_str, new_str: raw.new_str, replace_all: raw.replace_all === true }],
    multi: false,
  };
}

/** Edit a file via exact old→new string replacement. Sensitive — requires HITL approval. */
export function edit_fileTool(): BuiltinTool {
  return {
    descriptor: {
      name: "edit_file",
      description:
        "Replace exact occurrences of old_str with new_str. By default old_str must be unique; set replace_all:true to replace every occurrence. For several changes to ONE file, pass `edits` (an array of {old_str,new_str,replace_all?}) instead of the top-level pair: edits apply sequentially (each sees the previous edit's output) and atomically (any failure leaves the file untouched) — one call instead of N. You should read_file the relevant lines before editing so old_str is copied verbatim.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file to edit." },
          old_str: {
            type: "string",
            description:
              "Exact text to find (must be unique unless replace_all). Single-edit mode; mutually exclusive with edits.",
          },
          new_str: {
            type: "string",
            description: "Replacement text. Single-edit mode; mutually exclusive with edits.",
          },
          replace_all: { type: "boolean", description: "Replace every occurrence (default false)." },
          edits: {
            type: "array",
            description:
              "Multi-edit mode: edits applied in order, each operating on the previous edit's result; all-or-nothing (a failing edit writes nothing). Mutually exclusive with old_str/new_str.",
            items: {
              type: "object",
              properties: {
                old_str: { type: "string", description: "Exact text to find (must be unique unless replace_all)." },
                new_str: { type: "string", description: "Replacement text." },
                replace_all: { type: "boolean", description: "Replace every occurrence (default false)." },
              },
              required: ["old_str", "new_str"],
            },
          },
        },
        required: ["path"],
      },
      source: "builtin",
      metadata: { sensitive: true },
      previewFn: async (input) => {
        const raw = input as Record<string, unknown>;
        if (typeof raw?.path !== "string") return undefined;
        const parsed = parseEdits(raw);
        if (typeof parsed === "string") return undefined;
        try {
          const original = await readFile(raw.path, "utf8");
          let text = original;
          for (const e of parsed.edits) {
            const count = e.old_str.length === 0 ? 0 : text.split(e.old_str).length - 1;
            if (count === 0 || (!e.replace_all && count > 1)) return undefined;
            text = e.replace_all ? text.split(e.old_str).join(e.new_str) : text.replace(e.old_str, e.new_str);
          }
          return computeUnifiedDiff(original, text, raw.path) || undefined;
        } catch {
          return undefined;
        }
      },
    },
    handler: async (input, _ctx) => {
      const raw = input as Record<string, unknown>;
      if (typeof raw?.path !== "string" || raw.path.length === 0)
        return { content: "edit_file: 'path' is required", isError: true };
      const parsed = parseEdits(raw);
      if (typeof parsed === "string") return { content: parsed, isError: true };
      const { edits, multi } = parsed;

      try {
        const original = await readFile(raw.path, "utf8");
        // Apply every edit in memory first — the file is only written when
        // ALL edits validated, so a mid-list failure changes nothing on disk.
        let text = original;
        let replacements = 0;
        for (let i = 0; i < edits.length; i++) {
          const e = edits[i]!;
          const label = multi ? `edit #${i + 1}: ` : "";
          const count = e.old_str.length === 0 ? 0 : text.split(e.old_str).length - 1;
          if (count === 0) {
            return { content: `edit_file: ${label}old_str not found in ${raw.path}`, isError: true };
          }
          if (!e.replace_all && count > 1) {
            return {
              content: `edit_file: ${label}old_str is not unique — found ${count} occurrences in ${raw.path} (set replace_all:true to replace all)`,
              isError: true,
            };
          }
          text = e.replace_all ? text.split(e.old_str).join(e.new_str) : text.replace(e.old_str, e.new_str);
          replacements += e.replace_all ? count : 1;
        }
        await writeFile(raw.path, text, "utf8");
        return {
          content: multi
            ? `Applied ${edits.length} edits to ${raw.path} (${replacements} replacement${replacements === 1 ? "" : "s"})`
            : `Replaced ${replacements} occurrence${replacements === 1 ? "" : "s"} in ${raw.path}`,
          isError: false,
        };
      } catch (err) {
        return {
          content: String(err instanceof Error ? err.message : String(err)),
          isError: true,
        };
      }
    },
  };
}
