import type {
  IMemoryProvider,
  ISessionStore,
  Message,
  RolloutEvent,
  SessionId,
  ToolResultBlock,
  ToolUseBlock,
} from '../core/interfaces.ts'
import { assistantItemsToMessage } from '../transcript/items.ts'

export interface ReplayResult {
  /** Number of rollout events replayed into memory. */
  eventCount: number
  /** True when the session had no rollout (never seen before). */
  isNew: boolean
  /** Number of messages compacted (skipped) on replay. */
  compactedCount?: number
}

const INTERRUPTED_TOOL_RESULT_CONTENT =
  'Tool execution state is unknown because the result was not captured. Re-check the external state before deciding whether any further action is needed.'

function toolUseBlocks(message: Message): ToolUseBlock[] {
  if (!Array.isArray(message.content)) {
    return []
  }
  return message.content.filter((block): block is ToolUseBlock => block.type === 'tool_use')
}

function interruptedToolResult(block: ToolUseBlock): ToolResultBlock {
  return {
    type: 'tool_result',
    tool_use_id: block.id,
    content: `${INTERRUPTED_TOOL_RESULT_CONTENT} Tool: ${block.name}.`,
    is_error: true,
  }
}

function createMessageReplayer(append: (message: Message) => Promise<void>) {
  let pendingToolResults: ToolResultBlock[] = []
  const pendingToolUses = new Map<string, ToolUseBlock>()

  const flushBoundary = async () => {
    if (pendingToolUses.size > 0) {
      pendingToolResults.push(...[...pendingToolUses.values()].map(interruptedToolResult))
      pendingToolUses.clear()
    }
    if (pendingToolResults.length > 0) {
      await append({ role: 'user', content: pendingToolResults })
      pendingToolResults = []
    }
  }

  return {
    async appendUser(message: Message) {
      await flushBoundary()
      await append(message)
    },
    async appendAssistant(message: Message) {
      await flushBoundary()
      await append(message)
      for (const block of toolUseBlocks(message)) {
        pendingToolUses.set(block.id, block)
      }
    },
    appendToolResult(result: ToolResultBlock) {
      pendingToolUses.delete(result.tool_use_id)
      pendingToolResults.push(result)
    },
    flushBoundary,
  }
}

async function messagesFromEvents(
  memory: IMemoryProvider,
  sessionId: SessionId,
  events: RolloutEvent[],
): Promise<Message[]> {
  const scratch = `__replay_snapshot_${sessionId}`
  await memory.clear(scratch)
  const replayer = createMessageReplayer((message) => memory.append(scratch, message))
  for (const event of events) {
    if (event.type === 'user_input') {
      await replayer.appendUser(event.message)
    } else if (event.type === 'assistant_turn') {
      await replayer.appendAssistant(assistantItemsToMessage(event.items))
    } else if (event.type === 'tool_result') {
      replayer.appendToolResult(event.result)
    }
  }
  await replayer.flushBoundary()
  const result = await memory.getAll(scratch)
  await memory.clear(scratch)
  return result
}

/**
 * Replay a session's durable rollout back into an {@link IMemoryProvider}, so a
 * resumed session's in-memory history is identical to the original run.
 *
 * Compaction-aware: if the rollout contains a `compaction` event, all messages
 * before it are skipped and replaced by a single summary developer message. This
 * mirrors the live loop's behaviour — summarization replaces old context.
 *
 * - `session_start` is metadata only.
 * - `compaction` builds a summary developer message and skips preceding events.
 * - `user_input` appends its message; `assistant_turn` derives a message from
 *   Roxy transcript items.
 * - `tool_result` reconstructs a `user` message wrapping the result block(s).
 */
export async function replayIntoMemory(
  store: ISessionStore,
  memory: IMemoryProvider,
  sessionId: SessionId,
): Promise<ReplayResult> {
  const events = await store.read(sessionId)
  let replayed = 0
  let compactedCount: number | undefined
  const replayer = createMessageReplayer((message) => memory.append(sessionId, message))

  // Find the last compaction event — resume from there.
  let replayFrom = 0
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]!.type === 'compaction') {
      const comp = events[i]! as Extract<(typeof events)[number], { type: 'compaction' }>
      // Build summary message from the compaction event.
      await memory.append(sessionId, {
        role: 'developer',
        content: `Previous conversation summary:\n<summary>\n${comp.summary}\n</summary>`,
        visible: false,
      })
      // Newer compaction events carry the retained tail explicitly. Without
      // this snapshot, replay would discard not only the archived prefix but
      // also the completed messages that were intentionally kept in memory.
      const keptMessages = comp.keptMessages ?? (await messagesFromEvents(memory, sessionId, events.slice(0, i)))
      const legacyKeptMessages = comp.keptMessages ? keptMessages : keptMessages.slice(comp.compactedCount)
      for (const message of legacyKeptMessages) {
        await memory.append(sessionId, message)
      }
      compactedCount = comp.compactedCount
      replayFrom = i + 1
      replayed++
      break
    }
  }

  for (let i = replayFrom; i < events.length; i++) {
    const event = events[i]!
    switch (event.type) {
      case 'session_start':
      case 'compaction':
        break
      case 'user_input':
        await replayer.appendUser(event.message)
        replayed++
        break
      case 'assistant_turn':
        await replayer.appendAssistant(assistantItemsToMessage(event.items))
        replayed++
        break
      case 'tool_result':
        // Coalesce consecutive tool_result events into one user message
        // (mirror how the live loop batches multiple result blocks).
        replayer.appendToolResult(event.result)
        replayed++
        break
      case 'turn_completed':
      case 'turn_aborted':
      case 'turn_failed':
      case 'turn_error':
      case 'hitl_decision':
      case 'subagent_delegated':
        // Metadata/link only — not part of the parent message history.
        break
    }
  }
  await replayer.flushBoundary()

  return {
    eventCount: events.length,
    isNew: events.length === 0,
    ...(compactedCount !== undefined ? { compactedCount } : {}),
  }
}
