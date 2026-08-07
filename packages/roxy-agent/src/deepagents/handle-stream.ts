import type { StreamEvent } from '@/core/agent-events/streamEvents'
import type { AIMessageChunk } from '@langchain/core/messages'
import { streamEvents } from '@/core/agent-events/streamEvents'
import { LibraryStore } from '@/script/libraryStore'
import { resolveSkillDisplay } from './tools/skill'

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

/**
 * 取路径的文件名/目录名（不含目录层级）：先 `\`→`/` 归一，再取最后一段；空串返回 ''。
 * 仅用于前端工具卡片展示，与 chatService 的 getDisplayFileName 行为一致。
 */
function basenameOf(p: string | undefined | null): string {
  if (typeof p !== 'string' || !p)
    return ''
  const normalized = p.replace(/\\/g, '/')
  const segs = normalized.split('/')
  return segs[segs.length - 1] ?? ''
}

function resolveScriptDisplayLabel(raw: string): string {
  if (typeof raw !== 'string' || !raw)
    return ''
  // 本地库脚本以 slug（文件名）为身份：尝试解析出展示名。
  if (!raw.includes('/') && !/^https?:/i.test(raw)) {
    try {
      return LibraryStore.get(raw)?.name ?? raw
    }
    catch {
      return raw
    }
  }
  return raw
}

type StreamEventResult = StreamEvent | StreamEvent[] | undefined

export interface ThinkingCompletePayload {
  thinkingId: string
  startTimestamp: number
  endTimestamp: number
  durationMs: number
  taskId?: string
}

export class StreamState {
  arr: { type: 'text', id: string }[] = []
  map: Record<string, string> = {}
  private currentThinking: { id: string, taskId: string, startAt: number } | null = null

  setChunkContent(type: 'text', content: string, id: string) {
    if (!this.map[id]) {
      this.arr.push({ type, id })
      this.map[id] = ''
    }
    this.map[id] += content
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

  noteThinking(thinkingId: string, taskId: string, nowTs: number): ThinkingCompletePayload | null {
    if (this.currentThinking && this.currentThinking.id === thinkingId) {
      return null
    }
    const finishedPrev = this.currentThinking ? this.buildThinkingComplete(nowTs) : null
    this.currentThinking = { id: thinkingId, taskId, startAt: nowTs }
    return finishedPrev
  }

  finishThinking(nowTs: number): ThinkingCompletePayload | null {
    if (!this.currentThinking) {
      return null
    }
    return this.buildThinkingComplete(nowTs)
  }

  private buildThinkingComplete(endTs: number): ThinkingCompletePayload {
    const { id, taskId, startAt } = this.currentThinking!
    this.currentThinking = null
    return {
      thinkingId: id,
      taskId: taskId || undefined,
      startTimestamp: startAt,
      endTimestamp: endTs,
      durationMs: Math.max(0, endTs - startAt),
    }
  }
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
          return streamEvents.contentEvent(item.text as string, contentId, state.taskId)
        }
        else if (item.type === 'thinking' && item.thinking) {
          const thinkingId = `thinking:${chunk.id}`
          state.setChunkContent('text', item.thinking as string, thinkingId)
          return streamEvents.thinkingEvent(item.thinking as string, thinkingId, state.taskId)
        }
        return undefined
      }).filter((event): event is StreamEvent => Boolean(event))
    }
    else if (typeof chunk.content === 'string') {
      const contentId = `content:${chunk.id}`
      state.setChunkContent('text', chunk.content, contentId)
      return streamEvents.contentEvent(chunk.content, contentId, state.taskId)
    }
  }

  const reasoningContent = chunk?.additional_kwargs?.reasoning_content || chunk.lc_kwargs?.additional_kwargs?.reasoning_content || ''
  if (reasoningContent) {
    const thinkingId = `thinking:${chunk.id}`
    return streamEvents.thinkingEvent(reasoningContent as string, thinkingId, state.taskId)
  }
}

function handleTool(chunk: any, state: StreamState): StreamEventResult {
  // 特殊处理todo工具调用
  if (chunk.name === 'write_todos') {
    if (chunk.event === 'on_tool_start') {
      const todos = JSON.parse(chunk.input)
      if (state.taskId) {
        return streamEvents.workerTodoEvent(state.taskId, todos)
      }
      return streamEvents.todoEvent(todos)
    }
    return
  }

  if (chunk.event === 'on_tool_start') {
    const data: { toolName: string, args: any, toolId: string, taskId?: string, assignmentsCount?: number, skillName?: string, skillFilePath?: string, target?: string } = {
      toolName: chunk.name,
      args: chunk.input,
      toolId: chunk.toolCallId,
    }
    if (state.taskId)
      data.taskId = state.taskId

    // 为特定工具注入前端展示所需的标量字段（args 是 JSON 字符串，前端不可靠解析，故由后端解析后下发）
    // - parallel_dispatch：并行任务数
    // - load_skill_file：Skill name/ref 与相对文件路径
    // - read_file/write_file/edit_file：文件名（file_path 的 basename）
    // - ls：目录名（path 的 basename，根目录/当前目录不注入）
    // - glob/grep：匹配模式（pattern 原样，可能含通配符）
    // - run_script：脚本名（script.scriptName）
    // - execute：命令内容（command 参数，前端 ellipsis-1 单行截断）
    if (chunk.name === 'parallel_dispatch') {
      const parsed = safeParseInput(chunk.input)
      if (Array.isArray(parsed.assignments)) {
        data.assignmentsCount = parsed.assignments.length
      }
    }
    else if (chunk.name === 'load_skill_file') {
      const parsed = safeParseInput(chunk.input)
      // skillFilePath 含 skill 名 + 文件相对路径（如 tiktok-matrix-upload/references/harness.md），
      // 优先用于前端展示；skillName 仅作老前端兼容回退
      if (typeof parsed.name === 'string' || typeof parsed.ref === 'string') {
        const display = resolveSkillDisplay({
          ...(typeof parsed.name === 'string' ? { name: parsed.name } : {}),
          ...(typeof parsed.ref === 'string' ? { ref: parsed.ref } : {}),
          ...(typeof parsed.file === 'string' ? { file: parsed.file } : {}),
        })
        data.skillFilePath = display.skillFilePath
        data.skillName = display.skillName
      }
    }
    else if (chunk.name === 'read_file' || chunk.name === 'write_file' || chunk.name === 'edit_file') {
      const parsed = safeParseInput(chunk.input)
      data.target = basenameOf(parsed.file_path)
    }
    else if (chunk.name === 'ls') {
      const parsed = safeParseInput(chunk.input)
      // 默认值 '/'、当前目录 '.' 或空，不附加目录名（展示纯文案即可）
      const dir = basenameOf(parsed.path)
      if (dir && dir !== '/' && dir !== '.')
        data.target = dir
    }
    else if (chunk.name === 'glob' || chunk.name === 'grep') {
      const parsed = safeParseInput(chunk.input)
      if (typeof parsed.pattern === 'string' && parsed.pattern)
        data.target = parsed.pattern
    }
    else if (chunk.name === 'run_script') {
      const parsed = safeParseInput(chunk.input)
      data.target = resolveScriptDisplayLabel(parsed.script?.scriptName ?? '')
    }
    else if (chunk.name === 'execute') {
      const parsed = safeParseInput(chunk.input)
      // command 可能很长或含换行；前端 ellipsis-1 单行截断展示
      data.target = typeof parsed.command === 'string' ? parsed.command : ''
    }

    return streamEvents.toolCallEvent(data)
  }

  if (chunk.event === 'on_tool_end') {
    return streamEvents.toolResultEvent({
      toolName: chunk.name,
      result: chunk.output.content,
      toolId: chunk.toolCallId,
      status: 'success',
      ...(state.taskId ? { taskId: state.taskId } : {}),
    })
  }

  if (chunk.event === 'on_tool_error') {
    const errorContent = chunk.output?.content || chunk.error?.message

    return streamEvents.toolResultEvent({
      toolName: chunk.name,
      result: errorContent,
      toolId: chunk.toolCallId,
      status: 'failed',
      ...(state.taskId ? { taskId: state.taskId } : {}),
    })
  }
}

function asStreamEventArray(result: StreamEventResult): StreamEvent[] {
  if (!result)
    return []
  return Array.isArray(result) ? result : [result]
}

function getThinkingMeta(event: StreamEvent): { thinkingId: string, taskId: string } | null {
  if (event.type === 'thinking_delta' && event.data.thinkingId) {
    return { thinkingId: event.data.thinkingId, taskId: event.data.workerId ?? '' }
  }
  return null
}

function withThinkingTiming(result: StreamEventResult, state: StreamState): StreamEvent[] {
  const events = asStreamEventArray(result)
  if (events.length === 0) {
    return events
  }

  const out: StreamEvent[] = []
  for (const event of events) {
    const ts = event.timestamp ?? Date.now()
    const meta = getThinkingMeta(event)
    if (meta) {
      const finishedPrev = state.noteThinking(meta.thinkingId, meta.taskId, ts)
      if (finishedPrev) {
        out.push(streamEvents.thinkingCompleteEvent(finishedPrev))
      }
      out.push(event)
    }
    else {
      const finished = state.finishThinking(ts)
      if (finished) {
        out.push(streamEvents.thinkingCompleteEvent(finished))
      }
      out.push(event)
    }
  }
  return out
}

export function handleStreamEvents(rawChunk: any, state: StreamState): StreamEventResult {
  const [namespace, chunk] = rawChunk
  if (namespace === 'messages') {
    return withThinkingTiming(handleMessage(chunk[0], state), state)
  }
  else if (namespace === 'tools') {
    return withThinkingTiming(handleTool(chunk, state), state)
  }
  // custom 也不透传，避免 thinking/tool 的衍生噪音
}

export function handleWorkerStream(rawChunk: any, state: StreamState): StreamEvent[] {
  return asStreamEventArray(handleStreamEvents(rawChunk, state))
}
