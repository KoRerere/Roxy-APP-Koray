/**
 * Command-level permission policy for the `exec_command` tool. Patterns are globs
 * matched against the full (trimmed) command string; `*` matches any run of
 * characters including spaces (e.g. `"git status*"`, `"npm test*"`, `"rm *"`).
 *
 * Decision order:
 *  1. `deny` match → `"deny"` — the tool hard-blocks the command in EVERY
 *     HITL mode (including full access), mirroring the path-permission deny list.
 *  2. A compound command is eligible only when every segment is an
 *     allow-listed command and the shell syntax is limited to command
 *     separators/pipes plus `2>/dev/null`.
 *  3. `allow` match → `"allow"` — skips HITL approval in strict AND delegate
 *     modes (an explicit pattern is an explicit user grant).
 *  4. otherwise → `"ask"` — normal HITL flow (tool annotations / rules).
 */

export type CommandDecision = 'allow' | 'ask' | 'deny'

export interface CommandRules {
  /** Glob patterns whose match skips HITL approval. */
  allow?: string[]
  /** Glob patterns whose match blocks execution outright. Wins over allow. */
  deny?: string[]
}

/** Glob→RegExp: escape metacharacters, `*` matches anything (incl. spaces). */
function matchGlob(pattern: string, command: string): boolean {
  const re = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^]*') + '$')
  return re.test(command)
}

/**
 * PowerShell additionally treats grouping, array subexpressions, and script
 * blocks as control syntax. POSIX command substitution/backticks and all
 * unsupported operators remain approval-gated.
 */
const POWERSHELL_CONTROL = /[;&|<>`\n]|\$\(|@\(|[{}()]/

function isPowerShell(shell?: string): boolean {
  if (!shell) {
    return false
  }
  const name = shell.trim().split(/[\\/]/).pop()?.toLowerCase()
  return name === 'pwsh' || name === 'pwsh.exe' || name === 'powershell' || name === 'powershell.exe'
}

type CommandChain = {
  segments: string[]
  operators: string[]
}

/**
 * Split only the small, auditable subset of POSIX shell chaining supported by
 * the read-only policy. Quotes and escaped characters stay inside a segment.
 */
function splitCommandChain(command: string): CommandChain | null {
  const segments: string[] = []
  const operators: string[] = []
  let current = ''
  let quote: "'" | '"' | undefined
  let escaped = false

  const pushSegment = (): boolean => {
    const segment = current.trim()
    if (!segment) {
      return false
    }
    segments.push(segment)
    current = ''
    return true
  }

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index]
    const next = command[index + 1]

    if (escaped) {
      current += char
      escaped = false
      continue
    }
    if (char === '\\' && !quote) {
      current += char
      escaped = true
      continue
    }
    if (quote) {
      current += char
      if (char === quote) {
        quote = undefined
      }
      continue
    }
    if (char === "'" || char === '"') {
      current += char
      quote = char
      continue
    }
    if (char === '`' || (char === '$' && next === '(')) {
      return null
    }

    let operator: string | undefined
    if (char === ';' || char === '\n') {
      operator = char
    } else if (char === '|') {
      operator = next === '|' ? '||' : '|'
      if (next === '|') {
        index += 1
      }
    } else if (char === '&') {
      if (next !== '&') {
        return null
      }
      operator = '&&'
      index += 1
    }

    if (operator) {
      if (!pushSegment()) {
        return null
      }
      operators.push(operator)
      continue
    }
    current += char
  }

  if (quote || !pushSegment() || operators.length !== segments.length - 1) {
    return null
  }
  return { segments, operators }
}

/** Remove only an unquoted `2>/dev/null` redirect; every other redirect asks. */
function normalizeReadOnlySegment(segment: string): string | null {
  let normalized = ''
  let quote: "'" | '"' | undefined
  let escaped = false

  for (let index = 0; index < segment.length; index += 1) {
    const char = segment[index]

    if (escaped) {
      normalized += char
      escaped = false
      continue
    }
    if (char === '\\' && !quote) {
      normalized += char
      escaped = true
      continue
    }
    if (quote) {
      normalized += char
      if (char === quote) {
        quote = undefined
      }
      continue
    }
    if (char === "'" || char === '"') {
      normalized += char
      quote = char
      continue
    }
    if (char === '2') {
      let cursor = index + 1
      while (segment[cursor] === ' ') {
        cursor += 1
      }
      if (segment[cursor] === '>') {
        cursor += 1
        while (segment[cursor] === ' ') {
          cursor += 1
        }
        const target = '/dev/null'
        if (segment.startsWith(target, cursor) && !/[^\s]/.test(segment[cursor + target.length] ?? '')) {
          index = cursor + target.length - 1
          continue
        }
      }
    }
    if (char === '<' || char === '>') {
      return null
    }
    normalized += char
  }

  return quote ? null : normalized.trim()
}

function evaluateReadOnlyChain(command: string, allow: string[], deny: string[]): CommandDecision {
  const chain = splitCommandChain(command)
  if (!chain) {
    return 'ask'
  }
  for (const segment of chain.segments) {
    if (deny.some((p) => matchGlob(p, segment))) {
      return 'deny'
    }
    const normalized = normalizeReadOnlySegment(segment)
    if (!normalized || !allow.some((p) => matchGlob(p, normalized))) {
      return 'ask'
    }
  }
  return 'allow'
}

/**
 * Recognize the narrow POSIX loop form used to inspect a set of files:
 *
 *   [safe chain;] for name in words; do safe chain; done
 *
 * The loop body is checked with the same allow/deny rules as a normal chain.
 * This intentionally does not support nested control flow, substitutions,
 * redirects, or commands after `done`.
 */
function evaluateReadOnlyForLoop(command: string, allow: string[], deny: string[]): CommandDecision | null {
  const match =
    /^(?:(?<prefix>.+?)\s*;\s*)?for\s+(?<variable>[A-Za-z_][A-Za-z0-9_]*)\s+in\s+(?<iteration>[^;]+?)\s*;\s*do\s+(?<body>[\s\S]+?)\s*;\s*done$/.exec(
      command,
    )
  if (!match?.groups) {
    return null
  }

  const iteration = match.groups.iteration
  if (/[|&<>`\n]|\$\(/.test(iteration)) {
    return 'ask'
  }

  const prefix = match.groups.prefix?.trim()
  if (prefix) {
    const prefixDecision = evaluateReadOnlyChain(prefix, allow, deny)
    if (prefixDecision !== 'allow') {
      return prefixDecision
    }
  }

  return evaluateReadOnlyChain(match.groups.body, allow, deny)
}

export class CommandPermissions {
  private readonly allow: string[]
  private readonly deny: string[]

  constructor(rules: CommandRules = {}) {
    this.allow = [...(rules.allow ?? [])]
    this.deny = [...(rules.deny ?? [])]
  }

  evaluate(command: string, shell?: string): CommandDecision {
    const cmd = command.trim()
    if (this.deny.some((p) => matchGlob(p, cmd))) {
      return 'deny'
    }

    if (isPowerShell(shell)) {
      if (POWERSHELL_CONTROL.test(cmd)) {
        return 'ask'
      }
      return this.evaluateSingle(cmd)
    }

    const loopDecision = evaluateReadOnlyForLoop(cmd, this.allow, this.deny)
    if (loopDecision !== null) {
      return loopDecision
    }
    return evaluateReadOnlyChain(cmd, this.allow, this.deny)
  }

  private evaluateSingle(command: string): CommandDecision {
    const normalized = normalizeReadOnlySegment(command)
    if (!normalized) {
      return 'ask'
    }
    if (this.deny.some((p) => matchGlob(p, normalized))) {
      return 'deny'
    }
    return this.allow.some((p) => matchGlob(p, normalized)) ? 'allow' : 'ask'
  }

  /** Dynamically add an allow pattern (e.g. from a "don't ask again" HITL approval). */
  addAllow(pattern: string): void {
    this.allow.push(pattern)
  }
}
