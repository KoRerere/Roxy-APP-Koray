import type {
  ContentBlock,
  Message,
  RoxyAssistantItem,
  RoxyMessageItem,
  RoxyReasoningItem,
  RoxyToolCallItem,
  ThinkingBlock,
  ToolUseBlock,
} from '../core/interfaces.ts'

function textItem(id: string, text: string): RoxyMessageItem {
  return {
    type: 'message',
    id,
    role: 'assistant',
    content: [{ type: 'output_text', text }],
  }
}

function reasoningItem(block: ThinkingBlock): RoxyReasoningItem {
  return {
    type: 'reasoning',
    id: block.signature,
    text: block.thinking,
    visibility: 'full',
  }
}

function toolCallItem(block: ToolUseBlock): RoxyToolCallItem {
  return {
    type: 'tool_call',
    id: block.id,
    callId: block.id,
    name: block.name,
    arguments: block.input,
    toolKind: 'function',
  }
}

export function assistantMessageToItems(message: Message): RoxyAssistantItem[] {
  if (message.transcriptItems) {
    return message.transcriptItems
  }
  if (message.role !== 'assistant') {
    return []
  }
  if (typeof message.content === 'string') {
    return message.content ? [textItem('msg_0', message.content)] : []
  }

  const items: RoxyAssistantItem[] = []
  let textIndex = 0
  for (const block of message.content) {
    if (block.type === 'thinking') {
      items.push(reasoningItem(block))
    } else if (block.type === 'text') {
      if (block.text) {
        items.push(textItem(`msg_${textIndex++}`, block.text))
      }
    } else if (block.type === 'tool_use') {
      items.push(toolCallItem(block))
    }
  }
  return items
}

export function assistantItemsToContent(items: RoxyAssistantItem[]): ContentBlock[] {
  const content: ContentBlock[] = []
  for (const item of items) {
    if (item.type === 'reasoning') {
      content.push({
        type: 'thinking',
        thinking: item.text ?? item.summary?.join('\n') ?? '',
        signature: item.id,
      })
    } else if (item.type === 'message') {
      const text = item.content.map((block) => block.text).join('')
      if (text) {
        content.push({ type: 'text', text })
      }
    } else if (item.type === 'tool_call') {
      content.push({
        type: 'tool_use',
        id: item.callId,
        name: item.name,
        input: item.arguments,
      })
    }
  }
  return content
}

export function assistantItemsToMessage(items: RoxyAssistantItem[]): Message {
  return {
    role: 'assistant',
    content: assistantItemsToContent(items),
    transcriptItems: items,
  }
}
