import type { AgentResponse } from "./agent.ts";

// ---------------------------------------------------------------------------
// SubAgent
// ---------------------------------------------------------------------------

export type SubAgentMode = "sequential" | "parallel";

/**
 * Options for {@link ISubAgentManager.delegate} and {@link Agent.delegate}.
 *
 * - `parallel`: fan-out `count` concurrent subagents; all run the same task
 *   independently and their responses are aggregated. `count` is required and
 *   must be ≥ 1.
 * - `sequential`: pipeline each subagent's response as the next subagent's
 *   input. No `count` — the number of pipeline stages is implicit in the task
 *   description (or driven by the graph). Useful for "refine until done"
 *   chains.
 */
export type SubAgentOptions = { mode: "parallel"; count: number } | { mode: "sequential" };

export interface ISubAgentManager {
  /**
   * Delegate a task to subagents per the given options. Each subagent owns
   * an isolated {@link IMemoryProvider} and tool set. Returns all responses
   * ordered by completion (parallel) or pipeline position (sequential).
   */
  delegate(task: string, options: SubAgentOptions): Promise<AgentResponse[]>;
}

/**
 * A named subagent definition. The main agent dispatches to one of these by
 * `name` via the built-in `task` tool. Each subagent runs as an isolated child
 * {@link Agent} with its own message history and (optionally) its own model
 * vendor — this is how multiple LLMs collaborate on one task.
 *
 * `tools` omitted means the host decides the child tool set; when present, it
 * is a name allowlist understood by the host-owned child builder. The `task`
 * tool itself is normally withheld from children (delegation depth is a host
 * policy rather than runtime config).
 */
export interface SubAgentSpec {
  /** Dispatch key + advertised name (unique within a config). */
  name: string;
  /** When-to-use blurb advertised to the parent model in the `task` tool. */
  description: string;
  systemPrompt: string;
  /** Tool-name allowlist. Omit to inherit the parent's non-`task` tools. */
  tools?: string[];
  /** Override maxTokens for this subagent's model calls. */
  maxTokens?: number;
}

/**
 * Named-dispatch counterpart to {@link ISubAgentManager} (which fans out to
 * anonymous clones). `run` looks up a {@link SubAgentSpec} by name, builds/reuses
 * its isolated child {@link Agent}, invokes it with `task`, and returns the
 * child's response. Reusing the same child across calls within a conversation is
 * what lets a subagent (e.g. a coding subagent) iterate with full context.
 */
export interface ISubAgentDispatcher {
  run(name: string, task: string, signal?: AbortSignal): Promise<AgentResponse>;
}
