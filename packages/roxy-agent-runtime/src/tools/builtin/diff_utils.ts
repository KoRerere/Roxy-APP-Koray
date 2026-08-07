/**
 * Minimal unified-diff generator (no external deps).
 *
 * Uses an O(N·M) LCS DP for files up to 300 lines each; falls back to a
 * simple before/after block diff for larger files.  Output is a subset of
 * the unified-diff format understood by `patch(1)` and rendered with colour
 * in the CLI's HitlConfirm component.
 */

const CONTEXT = 3;
const MAX_LINES = 300; // DP cap — larger files get the fast-path
const MAX_OUTPUT_LINES = 200; // truncate rendered diff

type Op = { type: "eq" | "del" | "ins"; line: string };

// ---------------------------------------------------------------------------
// LCS-based line diff
// ---------------------------------------------------------------------------

function lcsDiff(a: string[], b: string[]): Op[] {
  const n = a.length,
    m = b.length;

  // Build DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0) as number[]);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
    }
  }

  // Backtrack
  const ops: Op[] = [];
  let i = n,
    j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({ type: "eq", line: a[i - 1]! });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      ops.unshift({ type: "ins", line: b[j - 1]! });
      j--;
    } else {
      ops.unshift({ type: "del", line: a[i - 1]! });
      i--;
    }
  }
  return ops;
}

// Simple fallback for large files: show full old as deletions + full new as insertions
function blockDiff(a: string[], b: string[]): Op[] {
  return [...a.map((line): Op => ({ type: "del", line })), ...b.map((line): Op => ({ type: "ins", line }))];
}

// ---------------------------------------------------------------------------
// Hunk builder
// ---------------------------------------------------------------------------

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[]; // prefixed with " " / "-" / "+"
}

function buildHunks(ops: Op[]): Hunk[] {
  // Assign line numbers and locate change positions
  const annotated: Array<{ op: Op; oldN: number; newN: number }> = [];
  let oldN = 1,
    newN = 1;
  for (const op of ops) {
    annotated.push({ op, oldN, newN });
    if (op.type !== "ins") oldN++;
    if (op.type !== "del") newN++;
  }

  // Identify change indices
  const changeIdx = new Set<number>();
  for (let k = 0; k < annotated.length; k++) {
    if (annotated[k]!.op.type !== "eq") {
      for (let c = Math.max(0, k - CONTEXT); c <= Math.min(annotated.length - 1, k + CONTEXT); c++) {
        changeIdx.add(c);
      }
    }
  }

  if (changeIdx.size === 0) return [];

  // Slice into contiguous runs of change indices
  const sorted = [...changeIdx].sort((a, b) => a - b);
  const runs: number[][] = [];
  let run: number[] = [];
  for (const idx of sorted) {
    if (run.length === 0 || idx === run[run.length - 1]! + 1) {
      run.push(idx);
    } else {
      runs.push(run);
      run = [idx];
    }
  }
  runs.push(run);

  return runs.map((r) => {
    const first = annotated[r[0]!]!;
    const last = annotated[r[r.length - 1]!]!;
    const hunkLines: string[] = [];
    let oldCount = 0,
      newCount = 0;
    for (const idx of r) {
      const { op } = annotated[idx]!;
      if (op.type === "eq") {
        hunkLines.push(` ${op.line}`);
        oldCount++;
        newCount++;
      } else if (op.type === "del") {
        hunkLines.push(`-${op.line}`);
        oldCount++;
      } else {
        hunkLines.push(`+${op.line}`);
        newCount++;
      }
    }
    return {
      oldStart: first.oldN,
      oldCount,
      newStart: first.newN,
      newCount,
      lines: hunkLines,
    };
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a unified-diff string between `oldText` and `newText`.
 * Returns `""` when the texts are identical.
 */
export function computeUnifiedDiff(oldText: string, newText: string, filePath: string): string {
  if (oldText === newText) return "";

  const a =
    oldText === ""
      ? []
      : oldText
          .split("\n")
          .map((l, i, arr) => (i === arr.length - 1 && l === "" ? null : l))
          .filter((l): l is string => l !== null);

  const b =
    newText === ""
      ? []
      : newText
          .split("\n")
          .map((l, i, arr) => (i === arr.length - 1 && l === "" ? null : l))
          .filter((l): l is string => l !== null);

  const ops = a.length <= MAX_LINES && b.length <= MAX_LINES ? lcsDiff(a, b) : blockDiff(a, b);

  const hunks = buildHunks(ops);
  if (hunks.length === 0) return "";

  const header = `--- ${filePath}\n+++ ${filePath}`;
  const parts: string[] = [header];
  let outputLines = 0;
  let truncated = false;

  for (const h of hunks) {
    if (truncated) break;
    const hunkHeader = `@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@`;
    parts.push(hunkHeader);
    for (const line of h.lines) {
      if (outputLines >= MAX_OUTPUT_LINES) {
        truncated = true;
        break;
      }
      parts.push(line);
      outputLines++;
    }
  }

  if (truncated) parts.push("... (diff truncated)");
  return parts.join("\n");
}
