/**
 * Error thrown by stub implementations during the skeleton phase.
 *
 * During the skeleton phase every module exposes its interfaces plus thin stubs
 * that throw `NotImplementedError`. This makes it trivial to `grep` for
 * unfinished work and gives a clear signal at runtime when a code path reaches
 * an unimplemented branch.
 *
 * Implementation phases replace these stubs one by one.
 */
export class NotImplementedError extends Error {
  readonly feature: string;

  constructor(feature: string) {
    super(`Not implemented yet: ${feature}`);
    this.name = "NotImplementedError";
    this.feature = feature;
  }
}
