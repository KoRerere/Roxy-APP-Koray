import type {
  ApprovalRequest,
  ApprovalResult,
  HitlMode,
  IHITLHandler,
  HitlRule,
  ToolDescriptor,
} from "../core/interfaces.ts";
import type { CommandPermissions } from "../tools/builtin/command_permissions.ts";

type HandlerOpts = {
  resolver?: (req: ApprovalRequest) => ApprovalResult;
  results?: ApprovalResult[];
  /**
   * Command-level policy for the `execute` tool. An `allow` match skips
   * approval (an explicit pattern is an explicit user grant — honored in
   * strict AND delegate modes); a `deny` match also skips approval because
   * the tool hard-blocks the command itself (no point asking). Compound
   * commands (shell operators) always evaluate to `ask` and fall through to
   * the mode's normal gate.
   */
  commandPermissions?: CommandPermissions;
  /**
   * Called whenever a rule is dynamically added via {@link DelegateHitlHandler.addRule}.
   * Use this hook to persist the rule (e.g. write to a JSON config file) so
   * it survives restarts. The CLI passes `undefined` (in-memory only).
   */
  onRuleAdded?: (rule: HitlRule, commandPattern?: string) => void;
};

/**
 * Input-aware pre-check shared by strict/delegate modes. Returns the approval
 * answer when command permissions decide it, or null to fall through to the
 * mode's own logic.
 */
function commandPrecheck(
  commandPermissions: CommandPermissions | undefined,
  tool: ToolDescriptor,
  input: unknown,
): boolean | null {
  if (!commandPermissions || tool.name !== "execute") return null;
  const command = (input as { command?: unknown } | undefined)?.command;
  if (typeof command !== "string") return null;
  const decision = commandPermissions.evaluate(command);
  if (decision === "allow") return false;
  if (decision === "deny") return false; // hard-blocked by the tool itself
  return null;
}

/** Glob-style pattern match: `*` matches within a single name segment. */
function matchGlob(pattern: string, name: string): boolean {
  // Escape regex metacharacters except `*`, then replace `*` with `[^]*`
  const re = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^]*") + "$");
  return re.test(name);
}

function resolveApproval(req: ApprovalRequest, opts: HandlerOpts, queue: ApprovalResult[]): ApprovalResult {
  if (opts.resolver) return opts.resolver(req);
  return queue.shift() ?? { decision: "approve" };
}

/** Mode A — approves every (or sensitive-only) tool call. */
export class StrictHitlHandler implements IHITLHandler {
  readonly mode: HitlMode = "strict";
  private readonly sensitiveOnly: boolean;
  private readonly opts: HandlerOpts;
  private readonly queue: ApprovalResult[];

  constructor(sensitiveOnly: boolean = false, opts: HandlerOpts = {}) {
    this.sensitiveOnly = sensitiveOnly;
    this.opts = opts;
    this.queue = [...(opts.results ?? [])];
  }

  needsApproval(tool: ToolDescriptor, input?: unknown): boolean {
    const pre = commandPrecheck(this.opts.commandPermissions, tool, input);
    if (pre !== null) return pre;
    if (!this.sensitiveOnly) return true;
    return tool.metadata?.sensitive === true;
  }

  requestApproval(req: ApprovalRequest): Promise<ApprovalResult> {
    return Promise.resolve(resolveApproval(req, this.opts, this.queue));
  }
}

/** Mode B — rule-based: sensitive metadata or matching glob rules trigger approval. */
export class DelegateHitlHandler implements IHITLHandler {
  readonly mode: HitlMode = "delegate";
  private readonly rules: HitlRule[];
  private readonly opts: HandlerOpts;
  private readonly queue: ApprovalResult[];

  constructor(rules: HitlRule[] = [], opts: HandlerOpts = {}) {
    // Copy so dynamic additions don't mutate the caller's array
    this.rules = [...rules];
    this.opts = opts;
    this.queue = [...(opts.results ?? [])];
  }

  needsApproval(tool: ToolDescriptor, input?: unknown): boolean {
    const pre = commandPrecheck(this.opts.commandPermissions, tool, input);
    if (pre !== null) return pre;
    // Check rules first — a matching rule overrides metadata
    for (const rule of this.rules) {
      if (matchGlob(rule.match, tool.name)) {
        return rule.sensitive;
      }
    }
    // No rule matched — fall back to metadata
    return tool.metadata?.sensitive === true;
  }

  requestApproval(req: ApprovalRequest): Promise<ApprovalResult> {
    return Promise.resolve(resolveApproval(req, this.opts, this.queue));
  }

  /**
   * Dynamically prepend a rule (highest priority). If `commandPattern` is
   * provided and the handler was constructed with a `CommandPermissions`
   * instance, also registers the pattern as an `allow` entry so the execute
   * tool itself bypasses approval.
   */
  addRule(rule: HitlRule, commandPattern?: string): void {
    // Prepend so dynamic rules always win over static ones
    this.rules.unshift(rule);
    if (commandPattern && this.opts.commandPermissions) {
      this.opts.commandPermissions.addAllow(commandPattern);
    }
    this.opts.onRuleAdded?.(rule, commandPattern);
  }
}

/** Mode C — full access, never intercepts. */
export class FullAccessHandler implements IHITLHandler {
  readonly mode: HitlMode = "full";

  needsApproval(_tool?: ToolDescriptor, _input?: unknown): boolean {
    return false;
  }

  requestApproval(_req: ApprovalRequest): Promise<ApprovalResult> {
    return Promise.resolve({ decision: "approve" });
  }
}
