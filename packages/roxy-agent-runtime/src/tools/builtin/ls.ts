import { readdir } from "node:fs/promises";
import type { BuiltinTool } from "./index.ts";
import type { PermissionDeps } from "./permissions.ts";
import { readPermissionGuard } from "./permissions.ts";
import { capEntries } from "./truncate.ts";
import { MAX_LS_ENTRIES } from "./limits.ts";

/** List a directory's entries. Read-only, not sensitive; path-gated; cap-bounded. */
export function lsTool(deps: PermissionDeps = {}): BuiltinTool {
  return {
    descriptor: {
      name: "ls",
      description: "List files and subdirectories at a path (capped; use glob for finer control).",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path to list." },
        },
        required: ["path"],
      },
      source: "builtin",
      metadata: { sensitive: false },
    },
    handler: async (input, ctx) => {
      const raw = input as Record<string, unknown>;
      if (typeof raw?.path !== "string" || raw.path.length === 0) {
        return { content: "ls: 'path' is required", isError: true };
      }
      const guard = await readPermissionGuard(deps, raw.path, "ls", ctx);
      if (guard) return guard;
      try {
        const entries = await readdir(raw.path, { withFileTypes: true });
        const lines = entries.map((e) => {
          const type = e.isDirectory() ? "dir" : e.isSymbolicLink() ? "symlink" : "file";
          return `${e.name}\t${type}`;
        });
        lines.sort();
        const capped = capEntries(
          lines,
          MAX_LS_ENTRIES,
          `(... showing ${MAX_LS_ENTRIES} of ${lines.length}; use glob for finer control)`,
        );
        return { content: capped.join("\n"), isError: false };
      } catch (err) {
        return {
          content: String(err instanceof Error ? err.message : String(err)),
          isError: true,
        };
      }
    },
  };
}
