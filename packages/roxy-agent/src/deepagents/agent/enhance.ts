import type { EnhanceToolContext } from '../tools/enhance_workspace'
import { createDeepAgent, FilesystemBackend } from 'deepagents'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { mcpManager } from '@/core/mcp/mcpManager'
import { openBrowserForDirId } from '@/services/sandboxService'
import { env } from '../../config'
import { createLLM } from '../../llm'
import {
  createDisableSubagentMiddleware,
  createParallelToolCallLimitMiddleware,
  createRoxySkillsMiddleware,
} from '../middlewares/index'
import { RECORDING_PROMPT } from '../prompt/recording'
import { SqliteSaver } from '../sqlite-checkpointer'
import { createEnhanceTools } from '../tools/enhance_workspace'
import { loadSkillFileTools } from '../tools/skill'

const SESSION_LOG = 'enhance_session.jsonl'
const ENHANCE_READONLY_BROWSER_TOOLS = new Set([
  'browser_snapshot',
  'browser_take_screenshot',
  'browser_console_messages',
  'browser_network_requests',
  'browser_tab_list',
  'browser_wait_for',
])

export interface EnhanceResult {
  ok: boolean
  enhancedScript?: string
  optionsSchema?: string
  source?: 'save_script'
  errorMessage?: string
  summary?: string
}

function matchesToolName(toolName: string, targetName: string): boolean {
  return toolName === targetName || toolName.endsWith(`__${targetName}`) || toolName.endsWith(`_${targetName}`)
}

function isEnhanceReadOnlyBrowserTool(toolName: string): boolean {
  return Array.from(ENHANCE_READONLY_BROWSER_TOOLS).some(name => matchesToolName(toolName, name))
}

async function prepareReadOnlyBrowserTools(recordingId: string, defaultDirId?: string, conversationId?: string): Promise<{
  tools: any[]
  destroy: () => Promise<void>
}> {
  if (!defaultDirId)
    return { tools: [], destroy: async () => {} }

  const workerId = `enhance_${recordingId}_${Date.now()}`
  let created = false
  try {
    await mcpManager.createPlaywrightClientForWorker(workerId)
    created = true
    const tools = await mcpManager.getToolsForWorker(workerId, true, conversationId)
    const connectTool = tools.find(t => matchesToolName(t.name, 'browser_connect_roxy'))
    if (!connectTool) {
      throw new Error('browser_connect_roxy tool is not available')
    }

    const cdpEndpoint = (await openBrowserForDirId(defaultDirId)).ws
    await connectTool.invoke({ cdpEndpoint })

    return {
      tools: tools.filter(t => isEnhanceReadOnlyBrowserTool(t.name)),
      destroy: async () => {
        await mcpManager.destroyPlaywrightClientForWorker(workerId)
      },
    }
  }
  catch (err: any) {
    console.warn('[Recording] Failed to prepare enhance readonly browser tools:', err?.message ?? err)
    if (created) {
      await mcpManager.destroyPlaywrightClientForWorker(workerId).catch((destroyErr: any) => {
        console.warn('[Recording] Failed to destroy enhance readonly browser client:', destroyErr?.message ?? destroyErr)
      })
    }
    return { tools: [], destroy: async () => {} }
  }
}

export async function runEnhanceAgent(
  workspaceDir: string,
  recordingId: string,
  conversationId?: string,
  defaultDirId?: string,
  signal?: AbortSignal,
): Promise<EnhanceResult> {
  let savedScript: string | undefined
  let savedSchema: string | undefined
  const ctx: EnhanceToolContext = {
    workspaceDir,
    defaultDirId,
    onSaved: (script, optionsSchema) => {
      savedScript = script
      savedSchema = optionsSchema
    },
  }

  const model = await createLLM({
    conversationId,
    modelType: 'text_model',
    isStreaming: true,
  })

  const checkpointId = `rec_${recordingId}_enhance`
  const checkpointPath = path.join(env.CHECKPOINT_DIR, `checkpoint_${checkpointId}.db`)
  const checkpointer = SqliteSaver.fromConnString(checkpointPath)

  const backend = new FilesystemBackend({ rootDir: workspaceDir, virtualMode: false })
  const readOnlyBrowser = await prepareReadOnlyBrowserTools(recordingId, defaultDirId, conversationId)
  const tools = [...createEnhanceTools(ctx), ...readOnlyBrowser.tools, ...loadSkillFileTools]

  const agent = createDeepAgent({
    model,
    tools,
    systemPrompt: RECORDING_PROMPT.enhanceSystem,
    backend,
    checkpointer,
    name: 'enhance_agent',
    subagents: [],
    middleware: [
      createRoxySkillsMiddleware(),
      createDisableSubagentMiddleware(),
      createParallelToolCallLimitMiddleware('save_script'),
    ],
  })

  const initialMessage = RECORDING_PROMPT.enhanceInitialMessage

  let summary: string | undefined
  const startedAt = Date.now()
  let sessionMessages: any[] = []
  let runError: string | undefined

  try {
    try {
      const result = await (agent as any).invoke(
        {
          messages: [{ role: 'user', content: initialMessage }],
        },
        {
          configurable: {
            thread_id: checkpointId,
          },
          ...(signal ? { signal } : {}),
        },
      )

      const msgs: any[] = result?.messages ?? []
      sessionMessages = msgs
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i]
        const kind = typeof m?.getType === 'function' ? m.getType() : (m?.type ?? m?.role)
        if (kind === 'ai' || kind === 'assistant') {
          const c = Array.isArray(m.content) ? m.content : [m.content]
          const text = c
            .filter((b: any) => typeof b === 'string' || b?.type === 'text')
            .map((b: any) => (typeof b === 'string' ? b : b?.text ?? ''))
            .join('')
          if (text.trim()) {
            summary = text.substring(0, 500)
            break
          }
        }
      }
    }
    catch (err: any) {
      runError = err?.message ?? String(err)

      // If aborted, try to read partial messages from agent state before cleanup
      if (signal?.aborted || err?.name === 'AbortError') {
        try {
          const state = await (agent as any).getState({
            configurable: { thread_id: checkpointId },
          })
          const partialMsgs: any[] = state?.values?.messages ?? []
          if (partialMsgs.length > 0) {
            sessionMessages = partialMsgs
          }
        }
        catch (stateErr: any) {
          console.warn('[Recording] Failed to read partial state after abort:', stateErr?.message)
        }
      }

      // enhance 抛错即视为失败：不保存任何产物，由上层标记 failed。
      // （save_script 工具本身不落盘，故无需担心孤儿产物。）
      return {
        ok: false,
        errorMessage: `Enhance agent failed: ${runError}`,
        summary,
      }
    }

    // 仅当 agent 调用了 save_script（提交了最终脚本）才视为成功。
    // 不再回退读 enhanced_script.ts——任何未显式 save_script 的情况都视为失败，不留产物。
    if (savedScript) {
      return {
        ok: true,
        enhancedScript: savedScript,
        optionsSchema: savedSchema ?? '{}',
        source: 'save_script',
        summary,
      }
    }

    return {
      ok: false,
      errorMessage: 'Enhance agent did not call save_script; no final script was produced.',
      summary,
    }
  }
  finally {
    await writeEnhanceSessionJsonl(workspaceDir, RECORDING_PROMPT.enhanceSystem, sessionMessages, {
      recordingId,
      conversationId,
      modelType: 'text_model',
      startedAt,
      finishedAt: Date.now(),
      messageCount: sessionMessages.length,
      ok: !runError,
      savedViaSaveScript: Boolean(savedScript),
      optionsSchema: savedSchema,
      errorMessage: runError,
    })
    await cleanupCheckpoint(checkpointPath)
    await readOnlyBrowser.destroy()
  }
}

interface EnhanceSessionMeta {
  recordingId: string
  conversationId?: string
  modelType: string
  startedAt: number
  finishedAt: number
  messageCount: number
  ok: boolean
  savedViaSaveScript: boolean
  optionsSchema?: string
  errorMessage?: string
}

function serializeMessage(m: any, seq: number): Record<string, unknown> {
  const type = typeof m?.getType === 'function' ? m.getType() : (m?.type ?? m?.role ?? 'unknown')
  const ak = m?.additional_kwargs ?? {}
  return {
    record: 'message',
    seq,
    type,
    id: m?.id ?? undefined,
    name: m?.name ?? undefined,
    content: m?.content,
    toolCalls: Array.isArray(m?.tool_calls) && m.tool_calls.length ? m.tool_calls : undefined,
    invalidToolCalls: Array.isArray(m?.invalid_tool_calls) && m.invalid_tool_calls.length ? m.invalid_tool_calls : undefined,
    toolCallId: m?.tool_call_id ?? undefined,
    reasoning: ak?.reasoning ?? ak?.reasoning_content ?? undefined,
    usageMetadata: m?.usage_metadata ?? undefined,
    responseMetadata: m?.response_metadata ?? undefined,
  }
}

/**
 * 将整段 enhance agent 会话（终态 messages）落盘为 JSONL，便于事后分析 agent 行为。
 * 第 1 行 meta、第 2 行 system prompt，其后每行一条 message；写失败仅告警，不影响主流程。
 */
async function writeEnhanceSessionJsonl(
  workspaceDir: string,
  systemPrompt: string,
  messages: any[],
  meta: EnhanceSessionMeta,
): Promise<void> {
  try {
    const lines: string[] = []
    lines.push(JSON.stringify({ record: 'meta', ...meta }))
    lines.push(JSON.stringify({ record: 'system', content: systemPrompt }))
    messages.forEach((m, i) => {
      try {
        lines.push(JSON.stringify(serializeMessage(m, i + 1)))
      }
      catch (err: any) {
        lines.push(JSON.stringify({ record: 'message', seq: i + 1, serializeError: err?.message ?? String(err) }))
      }
    })

    const filePath = path.join(workspaceDir, SESSION_LOG)
    await fsPromises.writeFile(filePath, `${lines.join('\n')}\n`, 'utf-8')
    console.log(`[Recording] Enhance session log written: ${filePath} (${messages.length} messages)`)
  }
  catch (err: any) {
    console.warn(`[Recording] Failed to write enhance session log:`, err?.message ?? err)
  }
}

async function cleanupCheckpoint(checkpointPath: string): Promise<void> {
  try {
    const instance = (SqliteSaver as any).instances?.get(checkpointPath)
    if (instance?.db && typeof instance.db.close === 'function') {
      instance.db.close()
    }
    ;(SqliteSaver as any).instances?.delete(checkpointPath)
  }
  catch (err: any) {
    console.warn(`[Recording] Failed to close enhance checkpoint DB:`, err?.message ?? err)
  }

  for (const suffix of ['', '-wal', '-shm']) {
    try {
      await fsPromises.unlink(`${checkpointPath}${suffix}`)
    }
    catch {}
  }
}
