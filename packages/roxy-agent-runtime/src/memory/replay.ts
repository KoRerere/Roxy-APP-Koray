import type { IMemoryProvider, ISessionStore, Message, SessionId, ToolResultBlock } from "../core/interfaces.ts";

export interface ReplayResult {
  /** Number of rollout events replayed into memory. */
  eventCount: number;
  /** True when the session had no rollout (never seen before). */
  isNew: boolean;
  /** Number of messages compacted (skipped) on replay. */
  compactedCount?: number;
}

/**
 * Replay a session's durable rollout back into an {@link IMemoryProvider}, so a
 * resumed session's in-memory history is identical to the original run.
 *
 * Compaction-aware: if the rollout contains a `compaction` event, all messages
 * before it are skipped and replaced by a single summary user message. This
 * mirrors the live loop's behaviour — summarization replaces old context.
 *
 * - `session_start` is metadata only.
 * - `compaction` builds a summary user message and skips preceding events.
 * - `user_input` / `assistant_turn` append their message verbatim.
 * - `tool_result` reconstructs a `user` message wrapping the result block(s).
 */
export async function replayIntoMemory(
  store: ISessionStore,
  memory: IMemoryProvider,
  sessionId: SessionId,
): Promise<ReplayResult> {
  const events = await store.read(sessionId);
  let pendingToolResults: ToolResultBlock[] = [];
  let replayed = 0;
  let compactedCount: number | undefined;

  const flushToolResults = async () => {
    if (pendingToolResults.length > 0) {
      const msg: Message = { role: "user", content: pendingToolResults };
      await memory.append(sessionId, msg);
      pendingToolResults = [];
    }
  };

  // Find the last compaction event — resume from there.
  let replayFrom = 0;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]!.type === "compaction") {
      const comp = events[i]! as Extract<(typeof events)[number], { type: "compaction" }>;
      // Build summary message from the compaction event.
      await memory.append(sessionId, {
        role: "user",
        content: `Previous conversation summary:\n<summary>\n${comp.summary}\n</summary>`,
      });
      compactedCount = comp.compactedCount;
      replayFrom = i + 1;
      replayed++;
      break;
    }
  }

  for (let i = replayFrom; i < events.length; i++) {
    const event = events[i]!;
    switch (event.type) {
      case "session_start":
      case "compaction":
        break;
      case "user_input":
        await flushToolResults();
        await memory.append(sessionId, event.message);
        replayed++;
        break;
      case "assistant_turn":
        await flushToolResults();
        await memory.append(sessionId, event.message);
        replayed++;
        break;
      case "tool_result":
        // Coalesce consecutive tool_result events into one user message
        // (mirror how the live loop batches multiple result blocks).
        pendingToolResults.push(event.result);
        replayed++;
        break;
      case "hitl_decision":
      case "subagent_delegated":
        // Metadata/link only — not part of the parent message history.
        break;
    }
  }
  await flushToolResults();

  return {
    eventCount: events.length,
    isNew: events.length === 0,
    ...(compactedCount !== undefined ? { compactedCount } : {}),
  };
}
