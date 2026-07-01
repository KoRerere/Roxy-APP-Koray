import type { RecordingEvent, RecordingSession } from './types'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { mcpManager } from '@/core/mcp/mcpManager'
import { ChatContextAPI } from '@/database/conversations'

export interface EnhanceWorkspace {
  workspaceDir: string
  refinedScriptPath: string
  mcpReadiness: { ready: boolean, reason?: string }
}

function parseSseEvents(content: string | undefined): unknown[] {
  if (!content)
    return []

  return content
    .split(/\n{2,}/)
    .map((block) => {
      let event: string | undefined
      let id: string | undefined
      let data: string | undefined
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) {
          event = line.slice('event:'.length).trim()
        }
        else if (line.startsWith('id:')) {
          id = line.slice('id:'.length).trim()
        }
        else if (line.startsWith('data:')) {
          data = line.slice('data:'.length).trim()
        }
      }
      if (!event && !data)
        return null
      let parsedData: unknown = data
      if (data) {
        try {
          parsedData = JSON.parse(data)
        }
        catch {}
      }
      return { event, id, data: parsedData }
    })
    .filter(Boolean)
}

interface LogicalRecord {
  seq: number
  role: string
  kind: string
  text?: string
  toolName?: string
  toolId?: string
  args?: unknown
  result?: unknown
  status?: string
  todos?: unknown[]
}

function reorganizeAssistantTurn(content: string | undefined, seqStart: number): LogicalRecord[] {
  const sseItems = parseSseEvents(content) as Array<{ event?: string, id?: string, data?: unknown }>

  // 降级：无法解析 SSE 时输出单条 text 记录
  if (sseItems.length === 0) {
    return content?.trim()
      ? [{ seq: seqStart, role: 'assistant', kind: 'text', text: content }]
      : []
  }

  // 稳定排序：id(timestamp) 升序，同 id 用原始下标 tiebreaker
  const indexed = sseItems.map((item, idx) => ({ item, idx }))
  indexed.sort((a, b) => {
    const idA = String(a.item.id ?? '')
    const idB = String(b.item.id ?? '')
    if (idA < idB)
      return -1
    if (idA > idB)
      return 1
    return a.idx - b.idx
  })

  // 按 xxxId 合并各类型增量
  const thinkingMap = new Map<string, string[]>()
  const contentMap = new Map<string, string[]>()
  const toolCallMap = new Map<string, { toolName: string, argsChunks: string[] }>()
  const toolResultMap = new Map<string, { toolName: string, result: unknown, status: string }>()
  let lastTodos: unknown[] | undefined

  // 记录首次出现 order（用于最终输出排序）
  const thinkingOrder = new Map<string, number>()
  const contentOrder = new Map<string, number>()
  const toolCallOrder = new Map<string, number>()
  const toolResultOrder = new Map<string, number>()
  let orderCounter = 0

  for (const { item } of indexed) {
    const payload = (item.data as any)?.data
    if (!payload)
      continue
    const type: string = (item.data as any)?.type ?? ''

    if (type === 'thinking') {
      const { thinkingId, text } = payload as { thinkingId?: string, text?: string }
      if (!thinkingId)
        continue
      if (!thinkingMap.has(thinkingId)) {
        thinkingMap.set(thinkingId, [])
        thinkingOrder.set(thinkingId, orderCounter++)
      }
      if (text)
        thinkingMap.get(thinkingId)!.push(text)
    }
    else if (type === 'content') {
      const { contentId, text } = payload as { contentId?: string, text?: string }
      if (!contentId)
        continue
      if (!contentMap.has(contentId)) {
        contentMap.set(contentId, [])
        contentOrder.set(contentId, orderCounter++)
      }
      if (text)
        contentMap.get(contentId)!.push(text)
    }
    else if (type === 'tool_call') {
      const { toolId, toolName, args } = payload as { toolId?: string, toolName?: string, args?: string }
      if (!toolId)
        continue
      if (!toolCallMap.has(toolId)) {
        toolCallMap.set(toolId, { toolName: toolName ?? '', argsChunks: [] })
        toolCallOrder.set(toolId, orderCounter++)
      }
      if (args)
        toolCallMap.get(toolId)!.argsChunks.push(args)
      if (toolName)
        toolCallMap.get(toolId)!.toolName = toolName
    }
    else if (type === 'tool_result') {
      const { toolId, toolName, result, status } = payload as { toolId?: string, toolName?: string, result?: unknown, status?: string }
      if (!toolId)
        continue
      if (!toolResultMap.has(toolId)) {
        toolResultOrder.set(toolId, orderCounter++)
      }
      toolResultMap.set(toolId, { toolName: toolName ?? '', result, status: status ?? '' })
    }
    else if (type === 'todo') {
      const { todos } = payload as { todos?: unknown[] }
      if (todos)
        lastTodos = todos
    }
  }

  // 构造有序输出列表，按首次出现 order 排序
  type OrderedEntry
    = | { kind: 'thinking', order: number, id: string }
      | { kind: 'content', order: number, id: string }
      | { kind: 'tool_call', order: number, id: string }
      | { kind: 'tool_result', order: number, id: string }

  const entries: OrderedEntry[] = [
    ...[...thinkingOrder.entries()].map(([id, order]) => ({ kind: 'thinking' as const, order, id })),
    ...[...contentOrder.entries()].map(([id, order]) => ({ kind: 'content' as const, order, id })),
    ...[...toolCallOrder.entries()].map(([id, order]) => ({ kind: 'tool_call' as const, order, id })),
    ...[...toolResultOrder.entries()].map(([id, order]) => ({ kind: 'tool_result' as const, order, id })),
  ]
  entries.sort((a, b) => a.order - b.order)

  const records: LogicalRecord[] = []
  let seq = seqStart

  for (const entry of entries) {
    if (entry.kind === 'thinking') {
      records.push({ seq: seq++, role: 'assistant', kind: 'thinking', text: thinkingMap.get(entry.id)!.join('') })
    }
    else if (entry.kind === 'content') {
      records.push({ seq: seq++, role: 'assistant', kind: 'text', text: contentMap.get(entry.id)!.join('') })
    }
    else if (entry.kind === 'tool_call') {
      const { toolName, argsChunks } = toolCallMap.get(entry.id)!
      let args: unknown
      const argsStr = argsChunks.join('')
      try {
        args = JSON.parse(argsStr)
      }
      catch {
        args = argsStr
      }
      records.push({ seq: seq++, role: 'assistant', kind: 'tool_call', toolName, toolId: entry.id, args })
    }
    else if (entry.kind === 'tool_result') {
      const { toolName, result, status } = toolResultMap.get(entry.id)!
      records.push({ seq: seq++, role: 'tool', kind: 'tool_result', toolName, toolId: entry.id, result, status })
    }
  }

  if (lastTodos !== undefined) {
    records.push({ seq: seq++, role: 'assistant', kind: 'todo', todos: lastTodos })
  }

  return records
}

function buildConversationJsonl(conversationId: string): string {
  const messages = ChatContextAPI.getMessagesByConversation(conversationId)
  const lines: string[] = []

  lines.push(JSON.stringify({ record: 'meta', conversationId, messageCount: messages.length }))

  let globalSeq = 1
  for (const message of messages) {
    if (message.role === 'assistant') {
      const records = reorganizeAssistantTurn(message.content, globalSeq)
      for (const r of records) {
        lines.push(JSON.stringify(r))
      }
      globalSeq += records.length
    }
    else {
      lines.push(JSON.stringify({ seq: globalSeq++, role: message.role, content: message.content ?? '' }))
    }
  }

  return lines.join('\n')
}

function escapeAttr(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function cdata(value: unknown): string {
  return String(value ?? '').replace(/\]\]>/g, ']]]]><![CDATA[>')
}

function buildRecordingSummaryMarkdown(session: RecordingSession, events: RecordingEvent[]): string {
  const userMessages = events
    .filter(e => e.type === 'user_message')
    .map(e => (e as Extract<RecordingEvent, { type: 'user_message' }>))
  const browserOps = events.filter((e): e is Extract<RecordingEvent, { type: 'browser_op' }> => e.type === 'browser_op')
  const dirIds = Array.from(new Set(browserOps.map(op => op.dirId).filter(Boolean)))

  const lines: string[] = [
    '# Recording Summary',
    '',
    '<recording>',
    `  <id>${escapeAttr(session.id)}</id>`,
    `  <conversation_id>${escapeAttr(session.conversationId)}</conversation_id>`,
    `  <primary_dir_id>${escapeAttr(session.primaryDirId ?? '')}</primary_dir_id>`,
    `  <created_at>${new Date(session.createdAt).toISOString()}</created_at>`,
    `  <stopped_at>${session.stoppedAt ? new Date(session.stoppedAt).toISOString() : ''}</stopped_at>`,
    '  <counts>',
    `    <total_events>${events.length}</total_events>`,
    `    <browser_operations>${browserOps.length}</browser_operations>`,
    `    <user_messages>${userMessages.length}</user_messages>`,
    `    <failed_operations>${browserOps.filter(op => !op.success).length}</failed_operations>`,
    '  </counts>',
    `  <dir_ids>${dirIds.map(dirId => `<dir_id>${escapeAttr(dirId)}</dir_id>`).join('')}</dir_ids>`,
    '</recording>',
    '',
    '## User Turns',
    '',
  ]

  if (userMessages.length === 0) {
    lines.push('(none)', '')
  }
  else {
    for (const message of userMessages) {
      lines.push(`<user_message seq="${message.seq}" timestamp="${escapeAttr(message.timestamp)}"><![CDATA[${cdata(message.content)}]]></user_message>`, '')
    }
  }

  lines.push('## Browser Operations', '')

  for (const op of browserOps) {
    lines.push(
      `<operation seq="${op.seq}" tool="${escapeAttr(op.toolName)}" success="${op.success}" duration_ms="${op.durationMs}" dir_id="${escapeAttr(op.dirId ?? '')}" worker_id="${escapeAttr(op.workerId ?? '')}">`,
      `  <timestamp>${escapeAttr(op.timestamp)}</timestamp>`,
      `  <input><![CDATA[${cdata(JSON.stringify(op.input, null, 2))}]]></input>`,
      `  <result><![CDATA[${cdata(op.result)}]]></result>`,
      op.errorMessage ? `  <error><![CDATA[${cdata(op.errorMessage)}]]></error>` : '  <error />',
      op.domContext ? `  <dom_context><![CDATA[${cdata(JSON.stringify(op.domContext, null, 2))}]]></dom_context>` : '  <dom_context />',
      '</operation>',
      '',
    )
  }

  return `${lines.join('\n')}\n`
}

export async function prepareEnhanceWorkspace(
  session: RecordingSession,
  events: RecordingEvent[],
  refinedScript: string,
): Promise<EnhanceWorkspace> {
  const workspaceDir = session.workDir
  await fsPromises.mkdir(workspaceDir, { recursive: true })

  const refinedScriptPath = path.join(workspaceDir, 'refined_script.ts')
  const refinedExists = await fsPromises.stat(refinedScriptPath).then(() => true).catch(() => false)
  if (!refinedExists)
    await fsPromises.writeFile(refinedScriptPath, refinedScript, 'utf-8')

  await fsPromises.writeFile(
    path.join(workspaceDir, 'conversation.jsonl'),
    `${buildConversationJsonl(session.conversationId)}\n`,
    'utf-8',
  )

  await fsPromises.writeFile(
    path.join(workspaceDir, 'recording_summary.md'),
    buildRecordingSummaryMarkdown(session, events),
    'utf-8',
  )

  let mcpReadiness: { ready: boolean, reason?: string }
  try {
    mcpReadiness = await mcpManager.checkPlaywrightMcpReadiness()
  }
  catch (err: any) {
    mcpReadiness = { ready: false, reason: err?.message ?? String(err) }
  }

  if (!mcpReadiness.ready) {
    console.warn(`[Recording] Enhance workspace MCP not ready: ${mcpReadiness.reason}`)
  }

  console.log(`[Recording] Enhance workspace prepared (in session.workDir): ${workspaceDir}`)

  return {
    workspaceDir,
    refinedScriptPath,
    mcpReadiness,
  }
}
