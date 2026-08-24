import { realpathSync } from 'node:fs'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import type { IHITLHandler, ToolContext, ToolHandlerResult } from '../../core/interfaces.ts'

/**
 * Default deny list of sensitive file patterns. Applied in ALL HITL modes
 * (full does not bypass it). Patterns are glob-style (`*` = within a segment,
 * `**` = any depth), matched against the canonical path relative to a root,
 * and against the full absolute path.
 */
export const DEFAULT_DENY_PATTERNS: string[] = [
  '.env',
  '.env.*',
  '**/.ssh/**',
  '**/*.pem',
  '**/*.key',
  '**/id_rsa*',
  '**/.aws/credentials',
  '**/.npmrc',
]

export type PathVerdict = 'allow' | 'ask' | 'deny'

/** Convert a glob pattern to a RegExp. Handles `*` (within segment) and `**`. */
function globToRegex(pattern: string): RegExp {
  // Private-use sentinel so `**` is processed before `*` without a control char.
  const SENTINEL = ''
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, SENTINEL)
    .replace(/\*/g, '[^/]*')
    .replace(new RegExp(SENTINEL, 'g'), '.*')
  return new RegExp(`(^|/)${escaped}$`)
}

export interface PathPermissionsOptions {
  allowRoots?: string[]
  extraAllowRoots?: string[]
  extraDeny?: string[]
  /** Omit the {@link DEFAULT_DENY_PATTERNS} (only apply `extraDeny`). */
  disableDefaultDeny?: boolean
}

/**
 * Pure value object deciding whether a filesystem path may be read. Built once
 * per agent (see AgentRuntime.create / buildTestAgent) and closed over by the read
 * tools (read_file/ls/glob/grep).
 *
 * Inheritance from {@link SkillRegistry.readFileInSkill}: the
 * `resolve` + `relative` + `..`-segment rejection is generalized from a single
 * skill dir to a set of allow roots, plus a deny list of sensitive patterns.
 *
 * - `checkPath` is binary (allow/deny) — used by ls/glob/grep to gate the
 *   search root and by read_file for the fast allow path.
 * - `classify` adds `ask` (outside roots, not denied) which the read handler
 *   routes to HITL in strict/delegate modes.
 *
 * Existing roots and targets are canonicalized with `realpathSync`, preventing
 * a symlink inside an allowed skill/workspace root from escaping that root.
 * Non-existent targets retain lexical resolution and will subsequently fail
 * in the read tool. `allowRoots: []` = unrestricted mode (any path allowed
 * except deny matches), preserving backward compatibility when no permissions
 * are configured.
 */
export class PathPermissions {
  private readonly declaredAllowRoots: string[]
  private readonly allowRoots: string[]
  private readonly deny: RegExp[]

  constructor(opts: PathPermissionsOptions = {}) {
    this.declaredAllowRoots = [...(opts.allowRoots ?? []), ...(opts.extraAllowRoots ?? [])].map((root) => resolve(root))
    this.allowRoots = this.declaredAllowRoots.map(canonicalizeExistingPath)
    const patterns = [...(opts.disableDefaultDeny ? [] : DEFAULT_DENY_PATTERNS), ...(opts.extraDeny ?? [])]
    this.deny = patterns.map(globToRegex)
  }

  /** Is `path` inside any allow root? Empty allowRoots ⇒ unrestricted (true). */
  private insideAnyRoot(absPath: string): boolean {
    if (this.allowRoots.length === 0) {
      return true
    }
    return this.allowRoots.some((root) => insideRoot(root, absPath))
  }

  private matchesDeny(absPath: string): boolean {
    return this.deny.some((re) => re.test(absPath))
  }

  private escapesDeclaredRoot(lexicalPath: string, canonicalPath: string): boolean {
    const matchingRoots = this.declaredAllowRoots
      .map((root, index) => ({ root, canonicalRoot: this.allowRoots[index]! }))
      .filter(({ root }) => insideRoot(root, lexicalPath))
    return (
      matchingRoots.length > 0 && !matchingRoots.some(({ canonicalRoot }) => insideRoot(canonicalRoot, canonicalPath))
    )
  }

  /** Binary verdict: a path is readable iff inside a root and not denied. */
  checkPath(absPath: string): PathVerdict {
    const lexical = resolve(absPath)
    const canonical = canonicalizeExistingPath(absPath)
    if (this.matchesDeny(lexical) || this.matchesDeny(canonical)) {
      return 'deny'
    }
    if (this.escapesDeclaredRoot(lexical, canonical)) {
      return 'deny'
    }
    if (this.insideAnyRoot(canonical)) {
      return 'allow'
    }
    return 'deny'
  }

  /**
   * Three-way verdict for read_file: `allow` (read), `deny` (hard stop), or
   * `ask` (outside roots but not a deny hit → route to HITL approval).
   * Unrestricted mode (no roots) never returns `ask` — everything non-denied
   * is `allow`.
   */
  classify(absPath: string): PathVerdict {
    const lexical = resolve(absPath)
    const canonical = canonicalizeExistingPath(absPath)
    if (this.matchesDeny(lexical) || this.matchesDeny(canonical)) {
      return 'deny'
    }
    if (this.escapesDeclaredRoot(lexical, canonical)) {
      return 'deny'
    }
    if (this.insideAnyRoot(canonical)) {
      return 'allow'
    }
    // Outside all roots and not denied.
    return this.allowRoots.length === 0 ? 'allow' : 'ask'
  }
}

function insideRoot(root: string, path: string): boolean {
  if (path === root) {
    return true
  }
  const rel = relative(root, path)
  return rel !== '' && !rel.startsWith('..') && !rel.split(sep).includes('..')
}

function canonicalizeExistingPath(path: string): string {
  const resolved = resolve(path)
  const suffix: string[] = []
  let candidate = resolved
  while (true) {
    try {
      return resolve(realpathSync.native(candidate), ...suffix)
    } catch {
      const parent = dirname(candidate)
      if (parent === candidate) {
        return resolved
      }
      suffix.unshift(basename(candidate))
      candidate = parent
    }
  }
}

export interface PermissionDeps {
  permissions?: PathPermissions
  hitl?: IHITLHandler
}

/**
 * Shared read-path guard. Returns a `ToolHandlerResult` to short-circuit with
 * (deny error, or rejected-approval feedback), or `null` to proceed with the
 * read. Used by read_file/ls/glob/grep.
 *
 * - No `permissions` dep ⇒ unrestricted (null) — back-compat.
 * - `classify` allow ⇒ proceed (null).
 * - deny ⇒ isError result naming the tool + path.
 * - ask (outside roots) ⇒ in strict/delegate modes call `hitl.requestApproval`
 *   synchronously: approve ⇒ proceed, reject ⇒ isError with the feedback. In
 *   full mode (no hitl, or full-mode handler) ask is treated as allow.
 *
 * Never throws — mirrors the never-reject tool convention.
 */
export async function readPermissionGuard(
  deps: PermissionDeps,
  path: string,
  toolName: string,
  ctx: ToolContext,
): Promise<ToolHandlerResult | null> {
  if (!deps.permissions) {
    return null
  } // unrestricted
  const verdict = deps.permissions.classify(path)
  if (verdict === 'allow') {
    return null
  }
  if (verdict === 'deny') {
    return { content: `${toolName}: path not allowed: ${path}`, isError: true }
  }
  // ask — route to HITL if present (strict/delegate). Full-mode handler
  // (FullAccessHandler) and absent hitl both resolve approve, so full mode
  // auto-allows.
  if (!deps.hitl) {
    return null
  }
  const decision = await deps.hitl.requestApproval({
    toolName,
    input: { path },
    reason: `read outside allowed roots: ${path}`,
    traceId: ctx.traceId,
  })
  if (decision.decision === 'approve') {
    return null
  }
  const feedback = decision.feedback ?? `${toolName}: read of ${path} was rejected by HITL`
  return { content: feedback, isError: true }
}
