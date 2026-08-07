import type { Message, SystemBlock } from "./provider.ts";
import type { SessionId } from "./memory.ts";

// ---------------------------------------------------------------------------
// Context Contributors (inject SystemBlocks before each model call)
// ---------------------------------------------------------------------------

/**
 * Context available to a contributor when it is asked to inject blocks.
 * `recentMessages` is a bounded window of the session history (newest-last)
 * provided by the runtime — enough for semantic retrieval without shipping
 * the full history across every contributor call.
 */
export interface ContributorContext {
  agentId: string;
  sessionId: SessionId;
  traceId: string;
  /**
   * The most recent messages from the session history (oldest-first, bounded
   * window — default last 10). Use for semantic search: "what is the user
   * working on right now?". Not the full history — callers that need more
   * should query their own store.
   */
  recentMessages: Message[];
}

/**
 * Injects additional {@link SystemBlock}s into the system prompt immediately
 * before each LLM API call.
 *
 * Distinct from {@link AgentLifecycleHooks} (fire-and-forget observers):
 * contributors are on the REQUEST PATH — they can inject arbitrary context
 * (retrieved memories, relevant docs, dynamic rules) synchronously to the
 * model call assembly.
 *
 * Multiple contributors are chained in registration order; their blocks are
 * appended AFTER the built-in blocks (base + skill-catalog + summary). Each
 * contributor is awaited in sequence so async retrieval (vector DB, HTTP) is
 * fully supported — but keep latency in mind since this runs on every model
 * call.
 *
 * Registered either standalone via {@link AgentGraphDeps.contributors} or
 * through a {@link RoxyPlugin} via {@link PluginAPI.addContextContributor}.
 *
 * MUST resolve — never reject. On error, log and return `[]` so a failing
 * contributor never crashes the model call.
 *
 * @example
 * // Standalone — inject a static disclaimer block
 * const contributor: IContextContributor = {
 *   async contribute() {
 *     return [{ type: "text", text: "Always cite sources." }];
 *   },
 * };
 *
 * @example
 * // Inside a plugin — RAG retrieval
 * api.addContextContributor({
 *   async contribute({ recentMessages }) {
 *     const hits = await vectorDb.search(recentMessages);
 *     return hits.map(h => ({ type: "text", text: `[memory] ${h.text}` }));
 *   },
 * });
 */
export interface IContextContributor {
  contribute(ctx: ContributorContext): Promise<SystemBlock[]>;
}
