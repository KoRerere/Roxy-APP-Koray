import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { BuiltinTool } from "./index.ts";
import type { PermissionDeps } from "./permissions.ts";
import { readPermissionGuard } from "./permissions.ts";
import { globToRegex } from "./glob_matcher.ts";
import { MAX_GREP_MATCHES, DEFAULT_GREP_PAGE, DEFAULT_GREP_FILES_PAGE } from "./limits.ts";

interface MatchRecord {
  filePath: string;
  lineNo: number;
  line: string;
}

interface GrepState {
  matches: MatchRecord[];
  filesWithMatch: string[];
  capped: boolean;
}

async function searchFile(
  filePath: string,
  displayPath: string,
  needle: string,
  caseInsensitive: boolean,
  state: GrepState,
): Promise<void> {
  if (state.capped) return;
  const text = await readFile(filePath, "utf8");
  const lines = text.split("\n");
  const fold = caseInsensitive;
  const n = fold ? needle.toLowerCase() : needle;
  let startedFile = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const matched = fold ? line.toLowerCase().includes(n) : line.includes(n);
    if (!matched) continue;
    if (!startedFile) {
      state.filesWithMatch.push(displayPath);
      startedFile = true;
    }
    state.matches.push({ filePath: displayPath, lineNo: i + 1, line });
    if (state.matches.length >= MAX_GREP_MATCHES) {
      state.capped = true;
      return;
    }
  }
}

async function searchDir(
  dir: string,
  base: string,
  needle: string,
  caseInsensitive: boolean,
  globFilter: RegExp | null,
  state: GrepState,
): Promise<void> {
  if (state.capped) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (state.capped) return;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await searchDir(full, base, needle, caseInsensitive, globFilter, state);
    } else if (entry.isFile()) {
      if (globFilter && !globFilter.test(entry.name)) continue;
      await searchFile(full, relative(base, full), needle, caseInsensitive, state);
    }
  }
}

/** Render content-mode matches grouped by file. */
function renderContentPage(page: MatchRecord[]): string {
  const parts: string[] = [];
  let lastFile = "";
  for (const m of page) {
    if (m.filePath !== lastFile) {
      parts.push(m.filePath);
      lastFile = m.filePath;
    }
    parts.push(`  ${m.lineNo}: ${m.line}`);
  }
  return parts.join("\n");
}

/** Search file contents by LITERAL substring. Supports max_results + offset pagination. */
export function grepTool(deps: PermissionDeps = {}): BuiltinTool {
  return {
    descriptor: {
      name: "grep",
      description:
        "Search file contents for a LITERAL substring (NOT a regex — special characters like ( ) | . * are matched as-is). Groups results by file as `path:` then `  lineNo: line`. Use case_insensitive for case-fold, glob to filter filenames. Use max_results and offset to paginate when there are many results.",
      inputSchema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Literal substring to search for (not a regular expression)." },
          path: { type: "string", description: "File or directory to search." },
          glob: { type: "string", description: "Optional filename filter, e.g. '*.ts'." },
          case_insensitive: { type: "boolean", description: "Case-insensitive match (default false)." },
          output_mode: {
            type: "string",
            enum: ["content", "files_with_matches"],
            description: "'content' (default) shows matching lines; 'files_with_matches' lists only file paths.",
          },
          max_results: {
            type: "number",
            description: `Maximum number of results per call (default ${DEFAULT_GREP_PAGE} for content, ${DEFAULT_GREP_FILES_PAGE} for files_with_matches). Use with offset to paginate.`,
          },
          offset: {
            type: "number",
            description: "Number of results to skip (default 0). Use to fetch the next page.",
          },
        },
        required: ["pattern", "path"],
      },
      source: "builtin",
      metadata: { sensitive: false },
    },
    handler: async (input, _ctx) => {
      const raw = input as Record<string, unknown>;
      if (typeof raw?.pattern !== "string" || raw.pattern.length === 0) {
        return { content: "grep: 'pattern' is required", isError: true };
      }
      if (typeof raw?.path !== "string" || raw.path.length === 0) {
        return { content: "grep: 'path' is required", isError: true };
      }
      const caseInsensitive = raw.case_insensitive === true;
      const filesMode = (raw.output_mode ?? "content") === "files_with_matches";
      const globFilter = typeof raw.glob === "string" && raw.glob.length > 0 ? globToRegex(raw.glob) : null;

      const defaultPage = filesMode ? DEFAULT_GREP_FILES_PAGE : DEFAULT_GREP_PAGE;
      const maxResults =
        typeof raw.max_results === "number" && raw.max_results > 0
          ? Math.min(raw.max_results, MAX_GREP_MATCHES)
          : defaultPage;
      const offset = typeof raw.offset === "number" && raw.offset >= 0 ? Math.floor(raw.offset) : 0;

      const guard = await readPermissionGuard(deps, raw.path, "grep", _ctx);
      if (guard) return guard;

      try {
        const info = await stat(raw.path);
        const state: GrepState = { matches: [], filesWithMatch: [], capped: false };
        if (info.isFile()) {
          await searchFile(raw.path, raw.path, raw.pattern, caseInsensitive, state);
        } else {
          await searchDir(raw.path, raw.path, raw.pattern, caseInsensitive, globFilter, state);
        }

        const parts: string[] = [];

        if (filesMode) {
          const allFiles = state.filesWithMatch;
          const total = allFiles.length;
          const page = allFiles.slice(offset, offset + maxResults);
          if (page.length > 0) parts.push(page.join("\n"));
          const shown = offset + page.length;
          if (shown < total || state.capped) {
            const cap = state.capped ? `${MAX_GREP_MATCHES}+` : `${total}`;
            parts.push(
              `(Showing ${offset + 1}–${shown} of ${cap} files` +
                (shown < total ? `; use offset=${shown} for next page` : "") +
                (state.capped ? `; search capped at ${MAX_GREP_MATCHES} matches` : "") +
                ")",
            );
          }
        } else {
          // content mode: paginate over individual match records
          const allMatches = state.matches;
          const total = allMatches.length;
          const page = allMatches.slice(offset, offset + maxResults);
          const rendered = renderContentPage(page);
          if (rendered) parts.push(rendered);
          const shown = offset + page.length;
          if (shown < total || state.capped) {
            const cap = state.capped ? `${MAX_GREP_MATCHES}+` : `${total}`;
            parts.push(
              `(Showing matches ${offset + 1}–${shown} of ${cap}` +
                (shown < total ? `; use offset=${shown} for next page` : "") +
                (state.capped ? `; search capped at ${MAX_GREP_MATCHES} matches, narrow your search` : "") +
                ")",
            );
          }
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
