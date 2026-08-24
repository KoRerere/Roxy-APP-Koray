import type { AgentQueuedPrompt } from './types'

interface CreateQueuedPromptOptions {
  attachments?: AgentQueuedPrompt['attachments']
  draftContent?: string
}

export function createQueuedPrompt(
  conversationId: string,
  content: string,
  now = Date.now(),
  options: CreateQueuedPromptOptions = {},
): AgentQueuedPrompt {
  return {
    id: `queued-prompt-${now}-${Math.random().toString(16).slice(2, 8)}`,
    conversationId,
    content: content.trim(),
    draftContent: options.draftContent,
    attachments: options.attachments,
    createdAt: now,
  }
}

export function queuedPromptDisplayContent(prompt: AgentQueuedPrompt): string {
  return prompt.content || prompt.attachments?.map(attachment => attachment.fileName).join(', ') || ''
}

export function removeQueuedPrompt(queue: AgentQueuedPrompt[], promptId: string): AgentQueuedPrompt | undefined {
  const index = queue.findIndex(item => item.id === promptId)
  if (index < 0) {
    return undefined
  }

  return queue.splice(index, 1)[0]
}

export function reorderQueuedPrompt(queue: AgentQueuedPrompt[], promptId: string, targetIndex: number): boolean {
  const sourceIndex = queue.findIndex(item => item.id === promptId)
  if (sourceIndex < 0) {
    return false
  }

  const [item] = queue.splice(sourceIndex, 1)
  if (!item) {
    return false
  }

  queue.splice(Math.max(0, Math.min(targetIndex, queue.length)), 0, item)
  return true
}
