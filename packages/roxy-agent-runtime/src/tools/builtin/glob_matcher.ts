/**
 * Convert a glob pattern to a RegExp.
 *
 * `*` matches within a single path segment (`[^/]*`); `**` matches across
 * segments (`.*`). Used by the glob tool (against relative paths) and the
 * grep tool (against filenames).
 *
 * Uses a private-use-area sentinel instead of a control character so it stays
 * lint-clean (no no-control-regex) and the `**` substitution happens before `*`.
 */
export function globToRegex(pattern: string): RegExp {
  const SENTINEL = "";
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, SENTINEL)
    .replace(/\*/g, "[^/]*")
    .replace(new RegExp(SENTINEL, "g"), ".*");
  return new RegExp(`^${escaped}$`);
}
