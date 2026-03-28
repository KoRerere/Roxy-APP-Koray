import type { AIMessageChunk } from '@langchain/core/messages'
import { streamAdapter } from '../server/streamAdapter'

export class StreamState {
  arr: { type: 'thinking' | 'text', id: string }[] = []
  map: Record<string, string> = {}

  getRandomId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 15)
  }

  setChunkContent(type: 'thinking' | 'text', content: string, id: string) {
    if (!this.map[id]) {
      this.arr.push({ type, id })
    }
    this.map[id] += content
  }

  getChunkContent() {
    return this.arr.map((item) => {
      if (item.type === 'thinking') {
        return `[thinking]: ${this.map[item.id]}\n`
      }
      return `[assistant]: ${this.map[item.id]}\n`
    }).join('\n')
  }

  getLastChunkContent() {
    const lastChunk = this.arr[this.arr.length - 1]
    if (lastChunk && (lastChunk.type === 'text' || lastChunk.type === 'thinking')) {
      return this.map[lastChunk.id] ?? ''
    }
    return ''
  }

  taskId: string = ''
  setTaskId(id: string) {
    this.taskId = id
  }

  theLastMessageIsThinking() {
    const lastMessage = this.arr[this.arr.length - 1]
    if (lastMessage && lastMessage.type === 'thinking') {
      return this.map[lastMessage.id]
    }
  }
}

function handleMessage(chunk: AIMessageChunk, state: StreamState) {
  // ToolMessage(type: tool) 不透传给前端，避免无效 SSE 噪音
  if ((chunk as any)?.type === 'tool') {
    return
  }

  if (chunk.content) {
    if (Array.isArray(chunk.content)) {
      return chunk.content.map((item: any) => {
        if (item.type === 'thinking' && item.thinking) {
          const thinkingId = `thinking:${chunk.id}`
          state.setChunkContent('thinking', item.thinking as string, thinkingId)
          return streamAdapter.thinking(item.thinking as string, thinkingId, state.taskId)
        }
        else if (item.type === 'text' && item.text) {
          const contentId = `content:${chunk.id}`
          state.setChunkContent('text', item.text as string, contentId)
          return streamAdapter.content(item.text as string, contentId, state.taskId)
        }
        return undefined
      }).filter(Boolean)
    }
    else if (typeof chunk.content === 'string') {
      const contentId = `content:${chunk.id}`
      state.setChunkContent('text', chunk.content, contentId)
      return streamAdapter.content(chunk.content, contentId, state.taskId)
    }
  }
  else if (typeof chunk.additional_kwargs.reasoning_content === 'string') {
    const thinkingId = `thinking:${chunk.id}`
    state.setChunkContent('thinking', chunk.additional_kwargs.reasoning_content, thinkingId)
    return streamAdapter.thinking(chunk.additional_kwargs.reasoning_content, thinkingId, state.taskId)
  }
}

function handleTool(chunk: any, state: StreamState) {
  // 特殊处理todo工具调用
  if (chunk.name === 'write_todos') {
    if (chunk.event === 'on_tool_start') {
      return streamAdapter.todo(JSON.parse(chunk.input))
    }
    return
  }

  if (chunk.event === 'on_tool_start') {
    return streamAdapter.toolCall({
      toolName: chunk.name,
      args: chunk.input,
      toolId: chunk.toolCallId,
      taskId: state.taskId,
    })
  }

  if (chunk.event === 'on_tool_end') {
    return streamAdapter.toolResult({
      toolName: chunk.name,
      result: chunk.output.content,
      toolId: chunk.toolCallId,
      status: 'success',
      taskId: state.taskId,
    })
  }

  if (chunk.event === 'on_tool_error') {
    return streamAdapter.toolResult({
      toolName: chunk.name,
      result: chunk.output?.content || chunk.error.message,
      toolId: chunk.toolCallId,
      status: 'failed',
      taskId: state.taskId,
    })
  }
}

export function handleStream(rawChunk: any, state: StreamState) {
  const [namespace, chunk] = rawChunk
  if (namespace === 'messages') {
    return handleMessage(chunk[0], state)
  }
  else if (namespace === 'tools') {
    return handleTool(chunk, state)
  }
  else if (namespace === 'custom') {
    return chunk
  }
}
