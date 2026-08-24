import type { AgentResponse, AgentStreamEvent } from './agent.ts'
import type { SubAgentSpec } from './subagent.ts'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// AgentManager - named, hierarchical subagent tree
// ---------------------------------------------------------------------------

/**
 * Logical identity of a node in the agent tree. `/root` is the fixed root;
 * every other path is `parentPath + "/" + name`. AgentPath is a logical id
 * only - never use it directly as a filesystem path or external resource key
 * (encode/hash it first).
 */
export type AgentPath = string

/** Fixed path of the root node registered by the runtime. */
export const ROOT_AGENT_PATH: AgentPath = '/root'

/**
 * snake_case name for an agent node. Must start with a lowercase letter and
 * contain only lowercase letters, digits, and single-underscore separators
 * between non-empty segments. No leading/trailing/adjacent underscores, no
 * hyphens, no path separators.
 */
export const agentNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/)

/**
 * Absolute agent path: either `/root` or `/root` followed by valid snake_case
 * segments separated by `/`.
 */
export const agentPathSchema = z.string().regex(/^\/root(?:\/[a-z][a-z0-9]*(?:_[a-z0-9]+)*)*$/)

export type AgentNodeStatus = 'starting' | 'running' | 'completed' | 'failed' | 'cancelled'

/** Immutable view of a node at a point in time. Terminal snapshots are retained. */
export interface AgentNodeSnapshot {
  path: AgentPath
  parentPath?: AgentPath
  name: string
  agentType: string
  status: AgentNodeStatus
  startedAt: number
  finishedAt?: number
  report?: string
  error?: string
  /** False while child resources still occupy a concurrency slot. Omitted on root. */
  cleanupSettled?: boolean
  /** Cleanup failures do not overwrite the child business status. */
  cleanupError?: string
}

export type AgentManagerErrorCode =
  | 'agent_already_exists'
  | 'agent_concurrency_limit_reached'
  | 'agent_manager_disposed'
  | 'agent_parent_terminal'

export interface AgentManagerErrorShape {
  code: AgentManagerErrorCode
  message: string
  active?: number
  limit?: number
}

/**
 * Lifecycle event emitted by {@link IAgentManager} for host instrumentation.
 * Never carries the original spawn `message`.
 */
export interface AgentLifecycleEvent {
  type: 'agent_registered' | 'agent_started' | 'agent_completed' | 'agent_failed' | 'agent_cancelled'
  agentPath: AgentPath
  parentAgentPath?: AgentPath
  agentName: string
  agentType: string
  status: AgentNodeStatus
  startedAt?: number
  finishedAt?: number
  report?: string
  error?: string
}

/**
 * Build inputs handed to a {@link ManagedAgentBuilder}. The builder wires a
 * full child Agent against the parent's manager and the manager-assigned path.
 */
export interface ManagedAgentBuildOptions {
  manager: IAgentManager
  path: AgentPath
  parentPath: AgentPath
  name: string
  agentType: string
  message: string
  /** Browser profile ids requested by the spawning agent. Empty means no narrower child scope. */
  dirIds: string[]
  /** AbortSignal cascaded from the root stop; cancelled when the subtree stops. */
  signal: AbortSignal
}

/**
 * Live handle to a built agent node. `invoke` runs one turn with the given
 * user message; `dispose` releases the agent's own resources (NOT the manager
 * tree - the manager retains the terminal snapshot).
 */
export interface ManagedAgentHandle {
  invoke(message: string, signal?: AbortSignal): Promise<AgentResponse>
  /** Optional streaming execution used by UI hosts to mirror child progress. */
  stream?(message: string, signal?: AbortSignal): AsyncIterable<AgentStreamEvent>
  dispose(): Promise<void>
}

/** Host-supplied factory that builds an isolated child agent for a spec + path. */
export type ManagedAgentBuilder = (spec: SubAgentSpec, options: ManagedAgentBuildOptions) => Promise<ManagedAgentHandle>

export interface SpawnAgentRequest {
  parentPath: AgentPath
  agentType: string
  name: string
  message: string
  /** Optional browser profile scope forwarded to the host builder. */
  dirIds?: string[]
  /** Caller's cooperative-cancellation signal; aborting it does NOT cancel the child. */
  callerSignal: AbortSignal
}

export interface SpawnAgentReceipt {
  path: AgentPath
  name: string
  agentType: string
  status: 'starting'
}

export interface WaitAgentResult {
  timedOut: boolean
  /** Terminal descendants of the caller subtree, plus the caller's own snapshot. */
  agents: AgentNodeSnapshot[]
  /** Non-terminal paths still running when the wait returned. */
  runningPaths: AgentPath[]
}

/**
 * Owns the named agent tree for one root session: registers `/root`, spawns
 * background children, records immutable snapshots, waits for subtrees to
 * settle, and cascades cancellation/disposal.
 *
 * The contract allows any registered node to spawn children; whether a node
 * actually has the `spawn_agent` tool is a host tool-registry decision, not a
 * manager-enforced depth limit.
 */
export interface IAgentManager {
  /** Register the root handle. Called once by the runtime after root creation. */
  registerRoot(agent: ManagedAgentHandle): void
  /**
   * Atomically reserve a child path under `parentPath`, build the child in the
   * background, and return a `starting` receipt immediately. Resolves before
   * the child finishes; never throws for a duplicate name - it rejects with an
   * `agent_already_exists` error the caller maps to an `isError` tool result.
   */
  spawn(request: SpawnAgentRequest): Promise<SpawnAgentReceipt>
  /** Stable snapshot of all nodes at/under `pathPrefix` (default `/root`). */
  list(pathPrefix?: AgentPath): AgentNodeSnapshot[]
  /**
   * Wait until no node in the caller's subtree is `starting`/`running`,
   * accounting for descendants created during the wait. `timeoutMs` only
   * bounds this call - it never cancels agents.
   */
  wait(callerPath: AgentPath, timeoutMs?: number, signal?: AbortSignal): Promise<WaitAgentResult>
  /** Cancel every non-terminal node at/under `path`. Idempotent. */
  cancelSubtree(path: AgentPath, reason?: unknown): void
  /** Cancel and dispose the whole tree. Idempotent. Safe to call on a disposed manager. */
  dispose(): Promise<void>
}

/** Construction options for the default {@link AgentManager} implementation. */
export interface AgentManagerOptions {
  /** SubAgentSpec lookup by `agentType` (the model-facing `agent_type`). */
  specs: Map<string, SubAgentSpec>
  builder: ManagedAgentBuilder
  /** Defaults to 10; deterministic test overrides must stay within 1..10. */
  maxConcurrentSubagents?: number
  /** Optional lifecycle callback for host instrumentation/events. */
  onEvent?: (event: AgentLifecycleEvent) => void
  /** Receives child stream events without changing manager lifecycle ownership. */
  onStream?: (agentPath: AgentPath, event: AgentStreamEvent) => void
}
