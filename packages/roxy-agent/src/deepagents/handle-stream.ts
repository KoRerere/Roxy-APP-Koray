import type { StreamEvent } from '@/core/sse/streamAdapter'
import type { AIMessageChunk } from '@langchain/core/messages'
import { streamAdapter } from '@/core/sse/streamAdapter'
import { resolveSkillNameFromPath } from './tools/skill'

/**
 * 工具入参可能是 JSON 字符串或对象，统一解析为对象（失败返回空对象）。
 */
function safeParseInput(input: any): any {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input)
    }
    catch {
      return {}
    }
  }
  return input ?? {}
}

type StreamEventResult = StreamEvent | StreamEvent[] | undefined

export class StreamState {
  arr: { type: 'text', id: string }[] = []
  map: Record<string, string> = {}

  getRandomId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 15)
  }

  setChunkContent(type: 'text', content: string, id: string) {
    if (!this.map[id]) {
      this.arr.push({ type, id })
    }
    this.map[id] += content
  }

  getChunkContent() {
    return this.arr.map((item) => {
      return `[assistant]: ${this.map[item.id]}\n`
    }).join('\n')
  }

  getLastChunkContent() {
    const lastChunk = this.arr.at(-1)
    if (lastChunk && lastChunk.type === 'text') {
      return this.map[lastChunk.id] ?? ''
    }
    return ''
  }

  taskId: string = ''
  setTaskId(id: string) {
    this.taskId = id
  }

  theLastMessageIsThinking() {}
}

function handleMessage(chunk: AIMessageChunk, state: StreamState): StreamEventResult {
  // ToolMessage(type: tool) 不透传
  if ((chunk as any)?.type === 'tool') {
    return
  }

  if (chunk.content) {
    if (Array.isArray(chunk.content)) {
      return chunk.content.map((item: any) => {
        if (item.type === 'text' && item.text) {
          const contentId = `content:${chunk.id}`
          state.setChunkContent('text', item.text as string, contentId)
          return streamAdapter.contentEvent(item.text as string, contentId, state.taskId)
        } else if (item.type === 'thinking' && item.thinking) {
          const thinkingId = `thinking:${chunk.id}`
          state.setChunkContent('text', item.thinking as string, thinkingId)
          return streamAdapter.thinkingEvent(item.thinking as string, thinkingId, state.taskId)
        }
        return undefined
      }).filter((event): event is StreamEvent => Boolean(event))
    }
    else if (typeof chunk.content === 'string') {
      const contentId = `content:${chunk.id}`
      state.setChunkContent('text', chunk.content, contentId)
      return streamAdapter.contentEvent(chunk.content, contentId, state.taskId)
    }
  }

  const reasoningContent = chunk?.additional_kwargs?.reasoning_content || chunk.lc_kwargs?.additional_kwargs?.reasoning_content || ''
  if (reasoningContent) {
    const thinkingId = `thinking:${chunk.id}`
    return streamAdapter.thinkingEvent(reasoningContent as string, thinkingId, state.taskId)
  }
}

function handleTool(chunk: any, state: StreamState): StreamEventResult {
  // 特殊处理todo工具调用
  if (chunk.name === 'write_todos') {
    if (chunk.event === 'on_tool_start') {
      const todos = JSON.parse(chunk.input)
      if (state.taskId) {
        return streamAdapter.workerTodoEvent(state.taskId, todos)
      }
      return streamAdapter.todoEvent(todos)
    }
    return
  }

  if (chunk.event === 'on_tool_start') {
    const data: { toolName: string, args: any, toolId: string, taskId: string, assignmentsCount?: number, skillName?: string } = {
      toolName: chunk.name,
      args: chunk.input,
      toolId: chunk.toolCallId,
      taskId: state.taskId,
    }

    // 为特定工具注入前端展示所需的标量字段（args 是 JSON 字符串，前端不可靠解析，故由后端解析后下发）
    if (chunk.name === 'parallel_dispatch') {
      const parsed = safeParseInput(chunk.input)
      if (Array.isArray(parsed.assignments)) {
        data.assignmentsCount = parsed.assignments.length
      }
    }
    else if (chunk.name === 'load_skill_file') {
      const parsed = safeParseInput(chunk.input)
      data.skillName = resolveSkillNameFromPath(parsed.path)
    }

    return streamAdapter.toolCallEvent(data)
  }

  if (chunk.event === 'on_tool_end') {
    return streamAdapter.toolResultEvent({
      toolName: chunk.name,
      result: chunk.output.content,
      toolId: chunk.toolCallId,
      status: 'success',
      taskId: state.taskId,
    })
  }

  if (chunk.event === 'on_tool_error') {
    return streamAdapter.toolResultEvent({
      toolName: chunk.name,
      result: chunk.output?.content || chunk.error.message,
      toolId: chunk.toolCallId,
      status: 'failed',
      taskId: state.taskId,
    })
  }
}

function asStreamEventArray(result: StreamEventResult): StreamEvent[] {
  if (!result)
    return []
  return Array.isArray(result) ? result : [result]
}

export function handleStreamEvents(rawChunk: any, state: StreamState): StreamEventResult {
  const [namespace, chunk] = rawChunk
  if (namespace === 'messages') {
    return handleMessage(chunk[0], state)
  }
  else if (namespace === 'tools') {
    return handleTool(chunk, state)
  }
  // custom 也不透传，避免 thinking/tool 的衍生噪音
}

export function handleStream(rawChunk: any, state: StreamState): string | string[] | undefined {
  const events = asStreamEventArray(handleStreamEvents(rawChunk, state))
  if (events.length === 0) {
    return
  }

  const formatted = events.map(event => streamAdapter.formatSSE(event))
  return formatted.length === 1 ? formatted[0] : formatted
}

export function handleWorkerStream(rawChunk: any, state: StreamState): StreamEvent[] {
  return asStreamEventArray(handleStreamEvents(rawChunk, state))
}
