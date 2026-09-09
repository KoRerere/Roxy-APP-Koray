import type { RoxyRolloutStore } from '../rollout'
import type { RootContent } from 'mdast'
import type { RoxyToolCallItem } from 'roxy-agent-runtime'
import { TaskReportInputSchema } from '@roxy/shared'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { z } from 'zod'

const LaunchResultSchema = z.object({
  browsers: z.array(z.object({ dirId: z.string().trim().min(1), connected: z.literal(true) })),
})
const ScriptInputSchema = z.object({
  scripts: z.array(z.object({ dirIds: z.array(z.string()) })),
})
const EXECUTED_SCRIPT_STATUSES = new Set(['success', 'failed', 'timeout', 'login_required', 'killed'])

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content)
  }
  catch {
    return undefined
  }
}

/** 旧脚本结果是 Markdown；只恢复明确进入执行阶段的窗口。 */
function scriptUsedWindows(content: string, input: unknown): string[] {
  const nodes = fromMarkdown(content).children
  const hasWindowSections = nodes.some(isWindowHeading)
  const parsedInput = ScriptInputSchema.safeParse(input)
  const inputDirIds = parsedInput.success ? parsedInput.data.scripts.flatMap(script => script.dirIds) : []
  let dirId = !hasWindowSections && inputDirIds.length === 1 ? inputDirIds[0] : undefined
  const used = new Set<string>()

  for (const node of nodes) {
    if (isWindowHeading(node) && node.type === 'heading') {
      dirId = node.children.find(child => child.type === 'inlineCode')?.value
    }
    if (!dirId || node.type !== 'list') {
      continue
    }
    for (const item of node.children) {
      const paragraph = item.children[0]
      if (paragraph?.type !== 'paragraph') {
        continue
      }
      const [label, value] = paragraph.children
      if (label?.type === 'text' && label.value === 'status: '
        && value?.type === 'inlineCode' && EXECUTED_SCRIPT_STATUSES.has(value.value)) {
        used.add(dirId)
      }
    }
  }
  return [...used]
}

function isWindowHeading(node: RootContent): boolean {
  return node.type === 'heading' && node.depth === 3
    && node.children[0]?.type === 'text' && node.children[0].value === 'Window '
}

/** 从宿主启动记录恢复会话使用集合，并兼容旧会话中可验证的工具结果。 */
export async function readTaskReportUsedWindows(store: RoxyRolloutStore, sessionId: string): Promise<string[]> {
  const used = new Set<string>()
  const visited = new Set<string>()
  const readSession = async (id: string): Promise<void> => {
    if (visited.has(id)) {
      return
    }
    visited.add(id)
    const calls = new Map<string, RoxyToolCallItem>()
    for (const event of await store.readEvents(id)) {
      if (event.type === 'roxy_window_used') {
        used.add(event.dirId)
      }
      else if (event.type === 'subagent_delegated') {
        await readSession(event.childSessionId)
      }
      else if (event.type === 'assistant_turn') {
        for (const item of event.items) {
          if (item.type === 'tool_call') {
            calls.set(item.callId, item)
          }
        }
      }
      else if (event.type === 'tool_result' && !event.result.is_error) {
        const call = calls.get(event.result.tool_use_id)
        const content = typeof event.result.content === 'string'
          ? event.result.content
          : event.result.content.map(block => block.text).join('\n')
        let dirIds: string[] = []
        if (call?.name.endsWith('__roxy_browser_launch')) {
          const result = LaunchResultSchema.safeParse(parseJson(content))
          dirIds = result.success ? result.data.browsers.map(browser => browser.dirId) : []
        }
        else if (call?.name === 'roxy_task_report') {
          const report = TaskReportInputSchema.safeParse(call.arguments)
          dirIds = report.success ? report.data.windows.filter(window => window.status !== 'unused').map(window => window.dirId) : []
        }
        else if (call?.name === 'roxy_script_run') {
          dirIds = scriptUsedWindows(content, call.arguments)
        }
        for (const dirId of dirIds) {
          used.add(dirId)
        }
      }
    }
  }
  await readSession(sessionId)
  return [...used]
}
