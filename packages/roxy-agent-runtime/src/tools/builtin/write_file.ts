import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { BuiltinTool } from "./index.ts";
import { computeUnifiedDiff } from "./diff_utils.ts";

/** Write/create a file. Mutates state — sensitive (requires HITL approval). */
export function write_fileTool(): BuiltinTool {
  return {
    descriptor: {
      name: "write_file",
      description: "Write content to a file, creating parent directories as needed.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute or relative path to write." },
          content: { type: "string", description: "Text content to write." },
        },
        required: ["path", "content"],
      },
      source: "builtin",
      metadata: { sensitive: true },
      previewFn: async (input) => {
        const raw = input as Record<string, unknown>;
        if (typeof raw?.path !== "string" || typeof raw?.content !== "string") return undefined;
        const existing = await readFile(raw.path, "utf8").catch(() => "");
        return computeUnifiedDiff(existing, raw.content, raw.path) || undefined;
      },
    },
    handler: async (input, _ctx) => {
      const raw = input as Record<string, unknown>;
      if (typeof raw?.path !== "string" || raw.path.length === 0) {
        return { content: "write_file: 'path' is required", isError: true };
      }
      if (typeof raw?.content !== "string") {
        return { content: "write_file: 'content' must be a string", isError: true };
      }
      try {
        await mkdir(dirname(raw.path), { recursive: true });
        await writeFile(raw.path, raw.content, "utf8");
        return { content: `Written ${raw.content.length} chars to ${raw.path}`, isError: false };
      } catch (err) {
        return {
          content: String(err instanceof Error ? err.message : String(err)),
          isError: true,
        };
      }
    },
  };
}
