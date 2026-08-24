import type { Message } from './provider.ts'
import type { SessionId } from './memory.ts'

// ---------------------------------------------------------------------------
// Context Contributors (persist internal developer context at turn start)
// ---------------------------------------------------------------------------

/** One named context fragment rendered by the runtime inside an XML envelope. */
export interface ContextContribution {
  name: string
  content: string
}

/**
 * Context available to a contributor when it is asked to inject blocks.
 * `recentMessages` is a bounded window of the session history (newest-last)
 * provided by the runtime — enough for semantic retrieval without shipping
 * the full history across every contributor call.
 */
export interface ContributorContext {
  agentId: string
  sessionId: SessionId
  traceId: string
  /**
   * The most recent messages from the session history (oldest-first, bounded
   * window — default last 10). Use for semantic search: "what is the user
   * working on right now?". Not the full history — callers that need more
   * should query their own store.
   */
  recentMessages: Message[]
}

/**
 * Supplies additional internal context at the start of a turn.
 * The runtime XML-escapes each contribution and inserts it as a developer-role
 * message before the current real user request. Contributor output is appended
 * to memory and the durable rollout with `visible: false`, allowing
 * exact replay while presentation layers omit it from user-facing history.
 *
 * Distinct from {@link AgentLifecycleHooks} (fire-and-forget observers):
 * contributors are on the REQUEST PATH — they can inject arbitrary context
 * (retrieved memories, relevant docs, dynamic rules) synchronously to the
 * model call assembly.
 *
 * Multiple contributors are chained in registration order. Each contributor
 * is awaited in sequence so async retrieval (vector DB, HTTP) is fully
 * supported — keep latency in mind since this runs once per turn.
 *
 * Registered either standalone via {@link AgentGraphDeps.contributors} or
 * through a {@link RoxyPlugin} via {@link PluginAPI.addContextContributor}.
 *
 * MUST resolve — never reject. On error, log and return `[]` so a failing
 * contributor never crashes the model call.
 *
 * @example
 * // Standalone — inject retrieved context
 * const contributor: IContextContributor = {
 *   async contribute() {
 *     return [{ name: "retrieved_memory", content: "Prior verified fact." }];
 *   },
 * };
 *
 * @example
 * // Inside a plugin — RAG retrieval
 * api.addContextContributor({
 *   async contribute({ recentMessages }) {
 *     const hits = await vectorDb.search(recentMessages);
 *     return hits.map(h => ({ name: "retrieved_memory", content: h.text }));
 *   },
 * });
 */
export interface IContextContributor {
  contribute(ctx: ContributorContext): Promise<ContextContribution[]>
}
