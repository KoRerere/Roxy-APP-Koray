import type { Agent, AgentResponse, ISubAgentDispatcher, SubAgentSpec } from "../core/interfaces.ts";
import type { SubAgentRegistry } from "./registry.ts";

/**
 * Builds an isolated child {@link Agent} for a spec + its derived session id.
 * Supplied by the `AgentRuntime` assembler, which knows how to wire a full
 * agent with an overridden provider / restricted tools / isolated memory.
 */
export type SubAgentBuilder = (spec: SubAgentSpec, childSessionId: string) => Promise<Agent>;

/**
 * Named-dispatch subagent manager. Looks a spec up by name, builds its child
 * agent ONCE, then reuses that same live instance for every subsequent `run`
 * with the same name — so a subagent naturally continues with full context
 * across iterations within a conversation (the coding-subagent refine loop).
 *
 * The child session id is derived deterministically from the parent session +
 * subagent name, so when durable sessions are enabled the child's rollout is
 * stable and resumable across process restarts too.
 *
 * Errors from an unknown name or a child build/invoke propagate to the caller
 * (the `task` tool), which converts them into an `isError` tool result — the
 * never-reject boundary lives there, not here.
 */
export interface SubAgentDispatcherOptions {
  /**
   * Invoked once, the first time a given subagent name is built — carries the
   * derived child session id so the caller can record a parent→child link
   * (e.g. a `subagent_delegated` rollout event). Failures are swallowed by the
   * caller's implementation; the dispatcher awaits it before invoking.
   */
  onDelegate?: (name: string, childSessionId: string) => void | Promise<void>;
}

export class SubAgentDispatcher implements ISubAgentDispatcher {
  private readonly children = new Map<string, Agent>();
  private readonly onDelegate?: SubAgentDispatcherOptions["onDelegate"];

  constructor(
    private readonly registry: SubAgentRegistry,
    private readonly builder: SubAgentBuilder,
    private readonly parentSessionId: string,
    opts: SubAgentDispatcherOptions = {},
  ) {
    this.onDelegate = opts.onDelegate;
  }

  /** The stable child session id for a subagent name. */
  childSessionId(name: string): string {
    return `${this.parentSessionId}:sub:${name}`;
  }

  async run(name: string, task: string, signal?: AbortSignal): Promise<AgentResponse> {
    const spec = this.registry.get(name);
    if (!spec) {
      throw new Error(`unknown subagent '${name}'`);
    }
    let child = this.children.get(name);
    if (!child) {
      const childSessionId = this.childSessionId(name);
      child = await this.builder(spec, childSessionId);
      this.children.set(name, child);
      await this.onDelegate?.(name, childSessionId);
    }
    return child.invoke(task, signal);
  }

  /** Dispose every child built so far (called when the parent disposes). */
  async disposeAll(): Promise<void> {
    for (const child of this.children.values()) {
      await child.dispose();
    }
    this.children.clear();
  }
}
