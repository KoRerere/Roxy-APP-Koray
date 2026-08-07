import type {
  AgentLifecycleHooks,
  IContextContributor,
  IClarificationHandler,
  IHITLHandler,
  ILogger,
  IMemoryProvider,
  IModelProvider,
  ISessionStore,
  IToolRegistry,
  ITrajectoryRecorder,
  MemoryLifecycle,
  SkillManifest,
  Summarizer,
  ToolMiddleware,
  TrimPolicy,
} from "../core/interfaces.ts";

/**
 * Opaque handle to the compiled agent state machine. Internal to the runtime.
 * The nominal brand prevents accidental assignment from `unknown` or a different
 * graph version.
 */
export type AgentGraph = { readonly __agentGraph: unique symbol };

/**
 * All dependencies needed to run the agent loop. Passed to both
 * `buildAgentGraph` (which packages them as an opaque handle) and forwarded
 * to the internal `AgentImpl`, which extracts them at construction time.
 */
export interface AgentGraphDeps {
  /** Model identifier forwarded to ChatRequest.model. */
  model: string;
  /** Token budget forwarded to ChatRequest.maxTokens. */
  maxTokens: number;
  /** Base system prompt (assembled with summary + skills before each call). */
  systemPrompt?: string;
  provider: IModelProvider;
  tools: IToolRegistry;
  memory: IMemoryProvider;
  hitl: IHITLHandler;
  recorder: ITrajectoryRecorder;
  logger: ILogger;
  clarification?: IClarificationHandler;
  hooks?: AgentLifecycleHooks;
  contributors?: IContextContributor[];
  middleware?: ToolMiddleware[];
  /** Awaited write-side lifecycle for external memory systems. */
  memoryLifecycles?: MemoryLifecycle[];
  /** When set, trim history at the start of each turn and optionally summarize. */
  trimPolicy?: TrimPolicy;
  /** Summarizer called with archived text when trimming removes messages. */
  summarizer?: Summarizer;
  /** Model context window size (tokens). Triggers trim when last call used ≥80%. */
  contextWindowTokens?: number;
  /** Absolute token threshold at which summarization triggers (default 150000). */
  triggerTokens?: number;
  /** Fraction of contextWindowTokens at which summarization triggers (default 0.8). */
  /**
   * Durable rollout store. When set, the agent loop appends a `RolloutEvent`
   * beside each `memory.append`, so the conversation survives process exits
   * and replays back into memory on resume. Optional — omitted in ephemeral /
   * test runs (pure in-memory).
   */
  sessionStore?: ISessionStore;
  /**
   * Skill manifests advertised in the bounded XML skill catalog. Implicitly
   * selected bodies/resources load via `read_file`; explicit `name + path`
   * selections become transient user-role `<skill>` messages for one turn.
   */
  skills?: SkillManifest[];
}

/** Package deps into the opaque AgentGraph handle. */
export function buildAgentGraph(deps: AgentGraphDeps): AgentGraph {
  return deps as unknown as AgentGraph;
}

/** Extract deps from the opaque handle — only for internal runtime use. */
export function extractDeps(graph: AgentGraph): AgentGraphDeps {
  return graph as unknown as AgentGraphDeps;
}
