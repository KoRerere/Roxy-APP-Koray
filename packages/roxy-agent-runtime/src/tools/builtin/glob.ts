import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { BuiltinTool } from "./index.ts";
import type { PermissionDeps } from "./permissions.ts";
import { readPermissionGuard } from "./permissions.ts";
import { globToRegex } from "./glob_matcher.ts";
import { DEFAULT_GLOB_PAGE, MAX_GLOB_RESULTS } from "./limits.ts";

async function walkDir(dir: string, base: string, re: RegExp): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const rel = relative(base, join(dir, entry.name));
    if (entry.isDirectory()) {
      results.push(...(await walkDir(join(dir, entry.name), base, re)));
    } else if (re.test(rel)) {
      results.push(rel);
    }
  }
  return results;
}

/** Find files matching a glob pattern. Supports max_results + offset pagination. */
export function globTool(deps: PermissionDeps = {}): BuiltinTool {
  return {
    descriptor: {
      name: "glob",
      description:
        "Find files matching a glob pattern. Supports * and ** wildcards. " +
        "Use max_results (default 50) and offset to paginate when there are many results.",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Glob pattern, e.g. '**/*.ts'." },
          cwd: { type: "string", description: "Base directory to search from (default: process.cwd())." },
          max_results: {
            type: "number",
            description: `Maximum number of results to return per call (default ${DEFAULT_GLOB_PAGE}). Use with offset to paginate.`,
          },
          offset: {
            type: "number",
            description: "Number of results to skip (default 0). Use to fetch the next page.",
          },
        },
        required: ["pattern"],
      },
      source: "builtin",
      metadata: { sensitive: false },
    },
    handler: async (input, _ctx) => {
      const raw = input as Record<string, unknown>;
      if (typeof raw?.pattern !== "string" || raw.pattern.length === 0) {
        return { content: "glob: 'pattern' is required", isError: true };
      }
      const cwd = typeof raw.cwd === "string" ? raw.cwd : process.cwd();
      const guard = await readPermissionGuard(deps, cwd, "glob", _ctx);
      if (guard) return guard;

      const maxResults =
        typeof raw.max_results === "number" && raw.max_results > 0
          ? Math.min(raw.max_results, MAX_GLOB_RESULTS)
          : DEFAULT_GLOB_PAGE;
      const offset = typeof raw.offset === "number" && raw.offset >= 0 ? Math.floor(raw.offset) : 0;

      try {
        const re = globToRegex(raw.pattern);
        const all = await walkDir(cwd, cwd, re);
        all.sort();

        // Cap total collection to avoid memory blow-up on huge trees
        const hardCapped = all.length > MAX_GLOB_RESULTS;
        const total = hardCapped ? MAX_GLOB_RESULTS : all.length;
        const page = all.slice(offset, offset + maxResults);

        const lines = page.length > 0 ? page.join("\n") : "";
        const parts: string[] = [];
        if (lines) parts.push(lines);

        const shown = offset + page.length;
        // Always show footer when total > page size OR when offset was beyond total
        const needFooter = shown < total || hardCapped || (page.length === 0 && offset > 0);
        if (needFooter) {
          const nextOffset = offset + maxResults;
          const cap = hardCapped ? `${MAX_GLOB_RESULTS}+` : `${total}`;
          const rangeStart = page.length > 0 ? offset + 1 : "-";
          const rangeEnd = page.length > 0 ? shown : "-";
          parts.push(
            `(Showing ${rangeStart}–${rangeEnd} of ${cap} results` +
              (shown < total ? `; use offset=${nextOffset} for next page` : "") +
              (hardCapped ? `; search capped at ${MAX_GLOB_RESULTS}, use a more specific pattern` : "") +
              ")",
          );
        }

        return { content: parts.join("\n"), isError: false };
      } catch (err) {
        return {
          content: String(err instanceof Error ? err.message : String(err)),
          isError: true,
        };
      }
    },
  };
}
