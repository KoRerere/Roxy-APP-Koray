import { ToolMessage } from '@langchain/core/messages'
import { createMiddleware } from 'langchain'

interface ToolCallRef {
  id: string
  name?: string
}

function messageType(message: any): string {
  if (!message)
    return ''
  if (typeof message._getType === 'function') {
    try {
      return String(message._getType())
    }
    catch {}
  }
  if (typeof message.type === 'string')
    return message.type
  return message.constructor?.name === 'AIMessage'
    ? 'ai'
    : message.constructor?.name === 'ToolMessage'
      ? 'tool'
      : ''
}

function extractToolCalls(message: any): ToolCallRef[] {
  const calls: ToolCallRef[] = []
  const seen = new Set<string>()
  const add = (id: unknown, name?: unknown) => {
    if (typeof id !== 'string' || !id || seen.has(id))
      return
    seen.add(id)
    calls.push({ id, name: typeof name === 'string' ? name : undefined })
  }

  for (const call of message?.tool_calls ?? message?.toolCalls ?? [])
    add(call?.id, call?.name)

  for (const call of message?.additional_kwargs?.tool_calls ?? [])
    add(call?.id, call?.function?.name ?? call?.name)

  if (Array.isArray(message?.content)) {
    for (const block of message.content) {
      if (block?.type === 'tool_use')
        add(block.id, block.name)
    }
  }

  return calls
}

function extractToolResultId(message: any): string | undefined {
  const id = message?.tool_call_id
    ?? message?.toolCallId
    ?? message?.lc_kwargs?.tool_call_id
    ?? message?.additional_kwargs?.tool_call_id
  return typeof id === 'string' && id ? id : undefined
}

function createSyntheticToolResult(call: ToolCallRef): ToolMessage {
  return new ToolMessage({
    content: [
      'Tool call did not complete in the previous run, likely because the run was stopped, interrupted, or the client disconnected.',
      'Treat this tool result as failed and continue from the user\'s latest instruction.',
    ].join(' '),
    status: 'error',
    name: call.name,
    tool_call_id: call.id,
  })
}

export function repairOrphanToolUseMessages(messages: any[]): { messages: any[], repairedCount: number } {
  if (!Array.isArray(messages) || messages.length === 0)
    return { messages, repairedCount: 0 }

  const repaired: any[] = []
  let repairedCount = 0
  let i = 0

  while (i < messages.length) {
    const message = messages[i]
    repaired.push(message)
    i += 1

    if (messageType(message) !== 'ai')
      continue

    const calls = extractToolCalls(message)
    if (calls.length === 0)
      continue

    const fulfilled = new Set<string>()
    while (i < messages.length && messageType(messages[i]) === 'tool') {
      const toolResult = messages[i]
      const id = extractToolResultId(toolResult)
      if (id)
        fulfilled.add(id)
      repaired.push(toolResult)
      i += 1
    }

    const missing = calls.filter(call => !fulfilled.has(call.id))
    if (missing.length === 0)
      continue

    repairedCount += missing.length
    repaired.push(...missing.map(createSyntheticToolResult))
  }

  return repairedCount > 0 ? { messages: repaired, repairedCount } : { messages, repairedCount: 0 }
}

/**
 * Anthropic requires every assistant tool_use to be followed immediately by its
 * matching tool_result. A stopped/interrupted run can leave a checkpoint after
 * the assistant tool_use but before LangGraph writes the ToolMessage. Repair the
 * outbound model request so the user can continue the conversation.
 */
export function createOrphanToolResultsMiddleware() {
  return createMiddleware({
    name: 'OrphanToolResultsMiddleware',
    wrapModelCall: async (request: any, handler: any) => {
      const result = repairOrphanToolUseMessages(request.messages)
      if (result.repairedCount === 0)
        return handler(request)

      return handler({
        ...request,
        messages: result.messages,
      })
    },
  })
}
