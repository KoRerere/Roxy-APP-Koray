/**
 * Command-level permission policy for the `execute` tool. Patterns are globs
 * matched against the full (trimmed) command string; `*` matches any run of
 * characters including spaces (e.g. `"git status*"`, `"npm test*"`, `"rm *"`).
 *
 * Decision order:
 *  1. `deny` match → `"deny"` — the tool hard-blocks the command in EVERY
 *     HITL mode (including full access), mirroring the path-permission deny list.
 *  2. shell control operators present → `"ask"` — a compound command must
 *     never ride an allow pattern past the gate (`git status && rm -rf /`
 *     matches `git status*` as a glob, but is NOT the command the user allowed).
 *  3. `allow` match → `"allow"` — skips HITL approval in strict AND delegate
 *     modes (an explicit pattern is an explicit user grant).
 *  4. otherwise → `"ask"` — normal HITL flow (sensitive metadata / rules).
 */

export type CommandDecision = "allow" | "ask" | "deny";

export interface CommandRules {
  /** Glob patterns whose match skips HITL approval. */
  allow?: string[];
  /** Glob patterns whose match blocks execution outright. Wins over allow. */
  deny?: string[];
}

/** Glob→RegExp: escape metacharacters, `*` matches anything (incl. spaces). */
function matchGlob(pattern: string, command: string): boolean {
  const re = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^]*") + "$");
  return re.test(command);
}

/**
 * Shell control operators that can chain/substitute a second command or
 * redirect output: `&&`, `||`, `;`, `|`, `&`, newline, `$(…)`, backtick,
 * `>`/`<` redirection.
 */
const SHELL_CONTROL = /[;&|<>`\n]|\$\(/;

export class CommandPermissions {
  private readonly allow: string[];
  private readonly deny: string[];

  constructor(rules: CommandRules = {}) {
    this.allow = [...(rules.allow ?? [])];
    this.deny = [...(rules.deny ?? [])];
  }

  evaluate(command: string): CommandDecision {
    const cmd = command.trim();
    if (this.deny.some((p) => matchGlob(p, cmd))) return "deny";
    if (SHELL_CONTROL.test(cmd)) return "ask";
    if (this.allow.some((p) => matchGlob(p, cmd))) return "allow";
    return "ask";
  }

  /** Dynamically add an allow pattern (e.g. from a "don't ask again" HITL approval). */
  addAllow(pattern: string): void {
    this.allow.push(pattern);
  }
}
