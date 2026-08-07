import { readFile, stat } from "node:fs/promises";
import type { BuiltinTool } from "./index.ts";
import { readPermissionGuard } from "./permissions.ts";
import { splitOverlongLine } from "./truncate.ts";
import { MAX_LINE_LENGTH, MAX_READ_BYTES, MAX_READ_LINES_CEILING, MAX_READ_LINES_DEFAULT } from "./limits.ts";

export interface ReadFileToolDeps {
  permissions?: import("./permissions.ts").PathPermissions;
  hitl?: import("../../core/interfaces.ts").IHITLHandler;
}

/**
 * Read a file's contents with pagination, line numbers, and binary detection.
 *
 * - `offset` (0-indexed) + `limit` (default 100, clamped to 1000) paginate
 *   large files instead of loading them whole.
 * - Output is `cat -n` style (`N\t<line>`); lines longer than ~2000 chars split
 *   into `N.1`/`N.2` continuations.
 * - Whole-file reads above {@link MAX_READ_BYTES} are refused unless the caller
 *   asks for an explicit offset+limit window.
 * - Binary files (NUL byte) are reported by size/mime but NOT inlined (content
 *   is a string; image blocks aren't supported here).
 * - A tail footer teaches the model how to continue (`offset=N`).
 *
 * Path access is gated by the optional {@link PathPermissions} layer (skill
 * roots + workdir auto-allowed; sensitive paths denied everywhere; outside-root
 * reads `ask` HITL in strict/delegate). No `permissions` dep ⇒ unrestricted.
 */
export function read_fileTool(deps: ReadFileToolDeps = {}): BuiltinTool {
  return {
    descriptor: {
      name: "read_file",
      description:
        "Read a file's contents, paginated with line numbers. By default returns the first 100 lines (cat -n format). For large files use offset+limit to page through; overlong lines are split as N.1/N.2. Binary files are reported but not inlined. Skill/workspace paths are allowed; sensitive files (.env, keys) are blocked.",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute or relative path to the file." },
          offset: {
            type: "integer",
            description: "0-indexed line to start reading from (default 0).",
          },
          limit: {
            type: "integer",
            description: "Max lines to return (default 100).",
          },
          line_numbers: {
            type: "boolean",
            description: "Prefix each line with its number, cat -n style (default true).",
          },
        },
        required: ["path"],
      },
      source: "builtin",
      metadata: { sensitive: false },
    },
    handler: async (input, ctx) => {
      const raw = input as Record<string, unknown>;
      if (typeof raw?.path !== "string" || raw.path.length === 0) {
        return { content: "read_file: 'path' is required", isError: true };
      }
      const offset = clampInt(raw.offset, 0, 0);
      const requestedLimit = raw.limit === undefined ? undefined : clampInt(raw.limit, 1, 1);
      const limit = Math.min(requestedLimit ?? MAX_READ_LINES_DEFAULT, MAX_READ_LINES_CEILING);
      const lineNumbers = raw.line_numbers === undefined ? true : Boolean(raw.line_numbers);

      const guard = await readPermissionGuard(deps, raw.path, "read_file", ctx);
      if (guard) return guard;

      try {
        const info = await stat(raw.path);
        if (info.size > MAX_READ_BYTES && requestedLimit === undefined) {
          return {
            content: `read_file: ${raw.path} is ${info.size} bytes (cap ${MAX_READ_BYTES}). Re-call with offset and limit to read a window.`,
            isError: true,
          };
        }

        const buf = await readFile(raw.path);
        if (buf.includes(0)) {
          const mime = mimeFromExt(raw.path);
          return {
            content: `read_file: ${raw.path} is a binary file (${info.size} bytes${mime ? `, ${mime}` : ""}). Not inlined.`,
            isError: true,
          };
        }
        const text = buf.toString("utf8");
        const allLines = text.split("\n");
        const total = allLines.length;
        const slice = allLines.slice(offset, offset + limit);

        const rendered: string[] = [];
        for (let i = 0; i < slice.length; i++) {
          const line = slice[i]!;
          const lineNo = offset + i + 1;
          if (lineNumbers) {
            rendered.push(...splitOverlongLine(line, MAX_LINE_LENGTH, lineNo));
          } else {
            rendered.push(line);
          }
        }
        let out = rendered.join("\n");

        const lastShown = offset + slice.length;
        if (lineNumbers && lastShown < total) {
          out += `\n(showing lines ${offset + 1}-${lastShown} of ${total}; call read_file again with offset=${lastShown} to continue)`;
        } else if (lineNumbers && offset > 0 && slice.length === 0) {
          out = `(offset ${offset} is past end of file; ${total} lines total)`;
        }
        return { content: out, isError: false };
      } catch (err) {
        return {
          content: String(err instanceof Error ? err.message : String(err)),
          isError: true,
        };
      }
    },
  };
}

function clampInt(v: unknown, min: number, _default: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return _default;
  return Math.max(min, Math.floor(v));
}

function mimeFromExt(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    zip: "application/zip",
    gz: "application/gzip",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
  };
  return map[ext] ?? "";
}
