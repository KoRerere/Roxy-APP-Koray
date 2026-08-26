/**
 * Centralised size/pagination limits for the builtin filesystem tools.
 *
 * Value-only module (no behaviour) so every tool can import freely without
 * import cycles. Edit in one place when tuning the context-budget vs.
 * usefulness trade-off.
 */

/** Tool-result eviction threshold (≈7.5k tokens @ 4 chars/token). Results
 *  whose `content` exceeds this are saved to a scratch file and replaced with
 *  a head/tail preview. */
export const MAX_TOOL_RESULT_CHARS = 30_000

/** read_file default and maximum `limit` (lines per call). */
export const READ_LIMIT = 2_000

/** Maximum characters returned for a single read_file line. */
export const READ_MAX_LINE_LENGTH = 2_000

/** Maximum bytes returned for selected read_file lines. */
export const READ_MAX_BYTES = 50 * 1024

/** Files at or above this size stream instead of reading whole into memory. */
export const READ_STREAM_MIN_SIZE = 10 * 1024 * 1024

/** Back-compat aliases for modules that still import the old constant names. */
export const MAX_READ_LINES_DEFAULT = READ_LIMIT
export const MAX_READ_LINES_CEILING = READ_LIMIT
export const MAX_LINE_LENGTH = READ_MAX_LINE_LENGTH
export const MAX_READ_BYTES = READ_MAX_BYTES

/** Hard cap on grep matches before a "narrow your search" footer is appended. */
export const MAX_GREP_MATCHES = 1_000

/** Default page size for grep in content mode (max_results default). */
export const DEFAULT_GREP_PAGE = 50

/** Default page size for grep files_with_matches mode (max_results default). */
export const DEFAULT_GREP_FILES_PAGE = 100

/** Head/tail line count in an evicted tool-result preview. */
export const EVICTION_HEAD_LINES = 5
export const EVICTION_TAIL_LINES = 5
