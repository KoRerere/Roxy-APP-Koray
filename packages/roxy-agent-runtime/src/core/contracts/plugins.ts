import type { IContextContributor } from "./context.ts";
import type { AgentLifecycleHooks } from "./lifecycle.ts";
import type { ILogger } from "./logging.ts";
import type { SessionId } from "./memory.ts";
import type { Message, StopReason, ToolResultBlock } from "./provider.ts";
import type { ToolDescriptor, ToolHandler, ToolResult, ToolSource } from "./tools.ts";

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

/**
 * Shared context threaded through both legs of a {@link ToolMiddleware}
 * (before/after). Carries correlation ids and tool identity for logging,
 * metrics, and conditional routing.
 */
export interface ToolMiddlewareContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  toolName: string;
  toolSource: ToolSource;
  toolUseId: string;
  /** 0-based index of this tool call within the current invoke. */
  callIndex: number;
}

/**
 * Interceptor applied to tool inputs and/or results. Distinct from
 * {@link AgentLifecycleHooks} (which observe but cannot mutate):
 * middleware transforms data and can abort execution.
 *
 * Execution model — onion layers:
 *  - `before` runs in registration order (first-registered = outermost).
 *  - `after`  runs in REVERSE order (outermost last), mirroring middleware
 *    conventions (Express, Koa, etc.).
 *  - The `match` filter is evaluated against the resolved `toolName` before
 *    either function is called; non-matching middleware is skipped.
 *
 * `before` may:
 *  - Return the (possibly modified) input to continue execution.
 *  - Throw an Error to ABORT the tool call — the executor records
 *    `{ isError: true, content: err.message, errorKind: "aborted" }` without
 *    running the handler. Useful for input validation or rate limiting.
 *
 * `after` may:
 *  - Return a (possibly modified) {@link ToolResult}. Cannot abort.
 *    Use for truncation, secret redaction, or appending metadata.
 *
 * @example
 * // Redact secrets from all tool results
 * api.addToolMiddleware({
 *   after(result) {
 *     return { ...result, content: redact(result.content) };
 *   },
 * });
 *
 * @example
 * // Block shell tools when running in read-only mode
 * api.addToolMiddleware({
 *   match: /^(execute|shell|run_)/,
 *   before(_input, ctx) {
 *     throw new Error(`tool '${ctx.toolName}' blocked in read-only mode`);
 *   },
 * });
 */
export interface ToolMiddleware {
  /**
   * Filter by tool name. Accepts an exact string, a glob pattern
   * (e.g. `"write_*"`, `"mcp_*"`), or a RegExp. When absent all tools match.
   */
  match?: string | RegExp;
  before?(input: unknown, ctx: ToolMiddlewareContext): unknown | Promise<unknown>;
  after?(result: ToolResult, ctx: ToolMiddlewareContext): ToolResult | Promise<ToolResult>;
}

/**
 * Rich, awaited lifecycle for external memory systems.
 *
 * This is intentionally distinct from {@link AgentLifecycleHooks}: hooks are
 * synchronous observation points for metrics, while memory lifecycle callbacks
 * are on the persistence path and receive the message payloads needed for
 * long-term memory ingestion. The runtime awaits each callback in registration
 * order and logs failures without crashing the agent loop.
 */
export interface MemoryLifecycle {
  /**
   * Called after one invoke()/stream() turn has completed and all produced
   * messages have been appended to session working memory.
   */
  onTurnEnd?(ctx: MemoryTurnEndContext): void | Promise<void>;
  /**
   * Called when trim + summarization compacts messages out of the working
   * context. This is the natural time to persist facts that are leaving the
   * short-term window.
   */
  onCompaction?(ctx: MemoryCompactionContext): void | Promise<void>;
}

export interface MemoryTurnEndContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  input: import("./agent.ts").AgentInput;
  userMessage: Message;
  producedMessages: Message[];
  stopReason: StopReason;
  totalModelCalls: number;
  totalToolCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  durationMs: number;
  aborted: boolean;
}

export interface MemoryCompactionContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  archivedText: string;
  archivedMessages: Message[];
  removedCount: number;
  summary: string;
  ts: number;
}

/**
 * Describes an interactive OAuth authorization request. Surfaced to the user
 * by the runtime (via {@link IClarificationHandler} under the hood) as a
 * "please authorize X" prompt.
 */
export interface AuthRequest {
  /** Short service identifier for logging and UI labelling (e.g. `"figma"`, `"notion"`). */
  service: string;
  /** The OAuth authorization URL to open in the user's browser. */
  authUrl: string;
  /** Requested scopes, displayed to the user for informed consent. */
  scopes?: string[];
  /** Human-readable description surfaced in the auth UI (e.g. "Needs access to your design files."). */
  description?: string;
}

/**
 * Resolved OAuth token returned by {@link PluginAPI.requestAuth}.
 * The plugin is responsible for storing/refreshing the token as needed.
 */
export interface AuthToken {
  accessToken: string;
  /** e.g. `"Bearer"`. Absent when implied by the service protocol. */
  tokenType?: string;
  /** Unix epoch ms — absent if the token does not expire. */
  expiresAt?: number;
  /** Refresh token for offline re-authorization, if issued by the provider. */
  refreshToken?: string;
  /** Provider-specific additional fields. */
  extra?: Record<string, unknown>;
}

/**
 * Read-only view of the runtime environment, injected into
 * {@link PluginAPI.ctx} at setup time.
 */
export interface PluginSetupContext {
  /** Scoped logger, child-scoped to the plugin name. */
  readonly logger: ILogger;
}

/**
 * The full API surface a plugin receives in its {@link RoxyPlugin.setup}
 * callback. Each `register*` / `add*` call appends to the corresponding
 * pipeline — calling the same method twice is additive, not replacing.
 *
 * All registrations are collected before the first `invoke()` and are
 * immutable after setup completes. Calling `registerTools` or
 * `addContextContributor` after the agent is running is a no-op with a
 * warning logged.
 */
export interface PluginAPI {
  /** Runtime context available during setup. */
  readonly ctx: PluginSetupContext;

  /**
   * Register one or more tools. Each `{ descriptor, handler }` pair follows
   * the same semantics as {@link IToolRegistry.add}: name collisions replace
   * the previous entry with a warning. Plugin tools are fully equivalent to
   * builtin tools at runtime — they appear in {@link IToolRegistry.all()} and
   * are exposed to the model in the tool list.
   *
   * @example
   * api.registerTools([{
   *   descriptor: { name: "search_memory", description: "...", inputSchema: {...}, source: "builtin" },
   *   handler: async (input, ctx) => ({ content: await db.search(input), isError: false }),
   * }]);
   */
  registerTools(tools: Array<{ descriptor: ToolDescriptor; handler: ToolHandler }>): void;

  /**
   * Add a context contributor. Called before each LLM API call to inject
   * additional {@link SystemBlock}s after the built-in system blocks (base +
   * skill-catalog + summary). Multiple contributors are chained in registration
   * order and each is awaited, so async retrieval (vector DB, HTTP) is fully
   * supported — but keep latency in mind since this runs every model call.
   *
   * @example
   * api.addContextContributor({
   *   async contribute({ recentMessages }) {
   *     const hits = await vectorDb.search(recentMessages);
   *     return hits.map(h => ({ type: "text", text: `[memory] ${h.text}` }));
   *   },
   * });
   */
  addContextContributor(contributor: IContextContributor): void;

  /**
   * Register lifecycle hooks. Multiple plugins can register hooks; the
   * runtime multi-casts each event to ALL registered listeners (plugins +
   * standalone hooks from {@link AgentDefinition.hooks}). All hooks remain
   * synchronous and fire-and-forget — see {@link AgentLifecycleHooks}.
   *
   * @example
   * api.addHooks({
   *   invoke: { after: ({ totalOutputTokens }) => metrics.inc("tokens", totalOutputTokens) },
   * });
   */
  addHooks(hooks: AgentLifecycleHooks): void;

  /**
   * Add a tool middleware interceptor. See {@link ToolMiddleware} for the
   * onion-layer execution model and abort semantics.
   *
   * @example
   * api.addToolMiddleware({
   *   match: "execute_*",
   *   after(result) { return { ...result, content: redact(result.content) }; },
   * });
   */
  addToolMiddleware(middleware: ToolMiddleware): void;

  /**
   * Register a long-term memory lifecycle. Use this for the write side of a
   * memory plugin: turn-end ingestion, compaction ingestion, background
   * summarization queues, etc. Pair it with {@link addContextContributor} for
   * the read side that injects retrieved memories into model context.
   */
  addMemoryLifecycle(lifecycle: MemoryLifecycle): void;

  /**
   * Initiate an interactive OAuth authorization flow. The runtime suspends
   * the current context and surfaces an {@link AuthRequest} to the user (via
   * {@link IClarificationHandler} under the hood). Resolves with the OAuth
   * access token once the user completes the flow.
   *
   * May be called:
   *  - From {@link RoxyPlugin.setup} to pre-authorize before any invoke().
   *  - From inside a tool handler to lazy-authorize on first use.
   *
   * Rejects on failure (user cancelled, timeout, OAuth error). The plugin
   * MUST catch and surface a meaningful error — an uncaught rejection in
   * setup aborts agent creation; in a handler it becomes an `isError` result.
   *
   * @example
   * async setup(api) {
   *   const token = await api.requestAuth({
   *     service: "figma",
   *     authUrl: "https://www.figma.com/oauth?...",
   *     scopes: ["files:read"],
   *     description: "Needs access to your Figma files.",
   *   });
   *   this.figmaClient = new FigmaClient(token.accessToken);
   * }
   */
  requestAuth(req: AuthRequest): Promise<AuthToken>;

  /**
   * Register a teardown callback. All registered callbacks are called (in
   * reverse registration order) when {@link Agent.dispose()} is invoked.
   * Each callback is awaited before the next runs.
   *
   * Use to close DB connections, flush write buffers, cancel background
   * tasks, etc.
   *
   * @example
   * const db = await VectorDB.connect(opts.dbUrl);
   * api.onDispose(() => db.close());
   */
  onDispose(fn: () => void | Promise<void>): void;
}

/**
 * A roxy-agent plugin — a named, self-contained capability package that
 * registers tools, context contributors, hooks, and/or middleware through a
 * single {@link setup} call.
 *
 * **Lifecycle**: Plugins passed in {@link AgentDefinition.plugins} are set up
 * once, in declaration order, during {@link AgentRuntime.create} — before the first
 * `invoke()`. The assembler awaits each `setup()` in sequence so async
 * initialization (DB connections, remote config) is fully supported. Teardown
 * callbacks (registered via {@link PluginAPI.onDispose}) are called in reverse
 * order on {@link Agent.dispose()}.
 *
 * **Design principle**: a plugin is a **named bundle of existing extension
 * points** — not a new abstraction. Every capability available through a plugin
 * is also available standalone:
 *  - Tools       → {@link IToolRegistry}
 *  - Hooks       → {@link AgentDefinition.hooks}
 *  - Context     → {@link AgentGraphDeps.contributors}
 *  - Middleware  → {@link AgentGraphDeps.middleware}
 *  - Memory      → {@link AgentGraphDeps.memoryLifecycles}
 *
 * The plugin's value is **cohesion** (related read/write sides of a feature
 * share state), **distribution** (publishable as an npm package), and
 * **lifecycle management** (setup/dispose handled by the framework).
 *
 * **Conflict detection**: two plugins with the same `name` in the same config
 * cause `AgentRuntime.create` to throw. Pin `version` for diagnostic logging.
 *
 * @example
 * // Long-term memory — read side (context injection) + write side (storage)
 * export const longTermMemory = (opts: { dbUrl: string }): RoxyPlugin => ({
 *   name: "long-term-memory",
 *   version: "1.0.0",
 *   async setup(api) {
 *     const db = await VectorDB.connect(opts.dbUrl);
 *     api.onDispose(() => db.close());
 *
 *     api.addContextContributor({
 *       async contribute({ recentMessages }) {
 *         const hits = await db.search(recentMessages);
 *         return hits.map(h => ({ type: "text", text: `[memory] ${h.text}` }));
 *       },
 *     });
 *
 *     api.addHooks({
 *       invoke: {
 *         after: ({ sessionId }) => { api.ctx.logger.debug("turn observed", { sessionId }); },
 *       },
 *     });
 *
 *     api.addMemoryLifecycle({
 *       async onTurnEnd({ sessionId, producedMessages }) {
 *         await db.ingestTurn(sessionId, producedMessages);
 *       },
 *       async onCompaction({ sessionId, archivedMessages, summary }) {
 *         await db.ingestCompaction(sessionId, archivedMessages, summary);
 *       },
 *     });
 *   },
 * });
 *
 * @example
 * // Security sanitizer — strip secrets from tool results
 * export const sanitizer = (): RoxyPlugin => ({
 *   name: "sanitizer",
 *   setup(api) {
 *     api.addToolMiddleware({
 *       match: /^(execute|shell|run_)/,
 *       before(input) { return stripSensitiveEnvVars(input); },
 *       after(result) { return { ...result, content: redactSecrets(result.content) }; },
 *     });
 *   },
 * });
 *
 * @example
 * // Third-party service with lazy OAuth
 * export const notionPlugin = (opts: { clientId: string }): RoxyPlugin => ({
 *   name: "notion",
 *   async setup(api) {
 *     const token = await api.requestAuth({
 *       service: "notion",
 *       authUrl: `https://api.notion.com/v1/oauth/authorize?client_id=${opts.clientId}`,
 *       scopes: ["read_content", "update_content"],
 *     });
 *     const client = new NotionClient({ auth: token.accessToken });
 *     api.registerTools(buildNotionTools(client));
 *   },
 * });
 *
 * const agent = await AgentRuntime.create({
 *   // ...runtime components,
 *   plugins: [longTermMemory({ dbUrl: "postgres://..." }), sanitizer()],
 * });
 */
export interface RoxyPlugin {
  /**
   * Unique plugin name. Used for logging, conflict detection, and dispose
   * ordering. Convention: kebab-case (e.g. `"long-term-memory"`).
   * Two plugins with the same name in the same {@link AgentDefinition} cause
   * `AgentRuntime.create` to throw.
   */
  name: string;
  /** Semantic version string (e.g. `"1.2.3"`). Logged at setup; optional. */
  version?: string;
  /**
   * Plugin entry point. Called once during {@link AgentRuntime.create}, in
   * declaration order, before the first `invoke()`. The assembler awaits each
   * plugin's setup sequentially so plugins can rely on earlier-declared
   * plugins' registrations being complete.
   *
   * - Register capabilities via the provided {@link PluginAPI}.
   * - Async is fully supported (DB connections, remote config, OAuth).
   * - Throw to abort `AgentRuntime.create` with a descriptive error.
   */
  setup(api: PluginAPI): void | Promise<void>;
}
