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
export const MAX_TOOL_RESULT_CHARS = 30_000;

/** read_file default `limit` (lines per call). */
export const MAX_READ_LINES_DEFAULT = 100;

/** Hard upper bound a caller may request in a single read_file `limit`. */
export const MAX_READ_LINES_CEILING = 1_000;

/** Lines longer than this are split as `N.1`/`N.2` continuation lines so a
 *  single minified/long line can't blow out the context. */
export const MAX_LINE_LENGTH = 2_000;

/** Refuse a whole-file read above this size (unless the caller asks for an
 *  explicit offset+limit window). */
export const MAX_READ_BYTES = 5_000_000;

/** Hard cap on grep matches before a "narrow your search" footer is appended. */
export const MAX_GREP_MATCHES = 1_000;

/** Cap on ls entries before a footer is appended. */
export const MAX_LS_ENTRIES = 200;

/** Cap on glob results before a footer is appended. */
export const MAX_GLOB_RESULTS = 1_000;

/** Default page size for glob (max_results default when not specified). */
export const DEFAULT_GLOB_PAGE = 50;

/** Default page size for grep in content mode (max_results default). */
export const DEFAULT_GREP_PAGE = 50;

/** Default page size for grep files_with_matches mode (max_results default). */
export const DEFAULT_GREP_FILES_PAGE = 100;

/** Head/tail line count in an evicted tool-result preview. */
export const EVICTION_HEAD_LINES = 5;
export const EVICTION_TAIL_LINES = 5;
