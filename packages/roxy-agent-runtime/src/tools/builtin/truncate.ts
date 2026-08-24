/**
 * Shared formatting helpers for the builtin filesystem tools:
 *  - head/tail preview for evicted tool results,
 *  - entry capping for ls/glob.
 *
 * Pure functions, no I/O.
 */

/**
 * Legacy helper for splitting a single long line into continuation chunks.
 * The first chunk carries the base line number; continuations are `N.1`,
 * `N.2`, … Each body ≤ `max` chars.
 * Returns the chunks WITH the line-number prefix (`N\t…`) already applied.
 */
export function splitOverlongLine(line: string, max: number, lineNo: number): string[] {
  if (line.length <= max) {
    return [`${lineNo}\t${line}`]
  }
  const chunks: string[] = []
  let i = 0
  let sub = 0
  while (i < line.length) {
    const body = line.slice(i, i + max)
    const prefix = sub === 0 ? `${lineNo}` : `${lineNo}.${sub}`
    chunks.push(`${prefix}\t${body}`)
    i += max
    sub++
  }
  return chunks
}

/**
 * Build a numbered head/tail preview of `content` (multi-line). Returns the
 * preview string plus the count of elided middle lines (0 when nothing cut).
 */
export function createContentPreview(
  content: string,
  headLines: number,
  tailLines: number,
): { preview: string; omitted: number } {
  const lines = content.split('\n')
  if (lines.length <= headLines + tailLines) {
    return {
      preview: lines.map((l, i) => `${i + 1}\t${l}`).join('\n'),
      omitted: 0,
    }
  }
  const head = lines.slice(0, headLines).map((l, i) => `${i + 1}\t${l}`)
  const tail = lines.slice(-tailLines).map((l, i) => `${lines.length - tailLines + i + 1}\t${l}`)
  const omitted = lines.length - headLines - tailLines
  return {
    preview: head.join('\n') + `\n... [${omitted} lines truncated] ...\n` + tail.join('\n'),
    omitted,
  }
}

/**
 * Cap an entry list to `max`, appending `footer` when truncation happened.
 * Returns the original array when under the cap.
 */
export function capEntries<T>(entries: T[], max: number, footer: T): T[] {
  if (entries.length <= max) {
    return entries
  }
  return [...entries.slice(0, max), footer]
}
