import type { BrowserOpEvent, RecordingEvent, RecordingSession } from './types'
import { RECORDING_PROMPT } from '@/deepagents/prompt/recording'
import { createLLM } from '@/llm'

export interface RefineResult {
  refinedScript: string
  modified: boolean
  summary: string
}

const REF_TOOLS = [
  'browser_click',
  'browser_type',
  'browser_select_option',
  'browser_hover',
  'browser_drag',
  'browser_fill_form',
]

function isRefTool(toolName: string): boolean {
  const normalized = toolName
    .replace(/^roxybrowser_playwright__/, '')
    .replace(/^roxybrowser_playwright_/, '')
  return REF_TOOLS.some(t => normalized.includes(t))
}

interface OpWithContext {
  seq: number
  toolName: string
  domContext: BrowserOpEvent['domContext']
}

function extractOpsWithDOM(events: RecordingEvent[]): OpWithContext[] {
  const results: OpWithContext[] = []
  for (const event of events) {
    if (
      event.type === 'browser_op'
      && isRefTool(event.toolName)
      && event.domContext
    ) {
      results.push({
        seq: event.seq,
        toolName: event.toolName.replace(/^roxybrowser_playwright__/, '').replace(/^roxybrowser_playwright_/, ''),
        domContext: event.domContext,
      })
    }
  }
  return results
}

function extractLLMResponse(response: any): string {
  if (typeof response === 'string') {
    return response
  }

  const content = response?.content
  if (!content) {
    return ''
  }

  if (typeof content === 'string') {
    return content
  }
  return Array.isArray(content) ? content.filter(item => item?.type === 'text')[0].text : ''
}

function formatDomContext(ctx: BrowserOpEvent['domContext']): string {
  if (!ctx)
    return RECORDING_PROMPT.refine.noDomContext

  const parts: string[] = []
  if (ctx.rawLocator)
    parts.push(`${RECORDING_PROMPT.refine.originalRef}: ${ctx.rawLocator}`)
  if (ctx.ariaLabel)
    parts.push(`${RECORDING_PROMPT.refine.ariaLabel}: "${ctx.ariaLabel}"`)
  if (ctx.testAttrs && Object.keys(ctx.testAttrs).length > 0)
    parts.push(`${RECORDING_PROMPT.refine.testAttrs}: ${JSON.stringify(ctx.testAttrs)}`)
  if (ctx.ancestorChain && ctx.ancestorChain.length > 0) {
    const chain = ctx.ancestorChain.map(a => `${a.role || '?'}[${a.name || '?'}]`).join(' > ')
    parts.push(`${RECORDING_PROMPT.refine.ancestorChain}: ${chain}`)
  }
  if (ctx.outerHtmlSnippet)
    parts.push(`${RECORDING_PROMPT.refine.htmlSnippet}: ${ctx.outerHtmlSnippet.substring(0, 200)}`)

  return parts.join('\n  ')
}

function updateStatusComment(script: string): string {
  return script.replace(
    /(\*\s*状态:\s*)待 Refine（locator 稳定化）/,
    '$1已 Refine（locator 已稳定化）',
  )
}

export async function refineScript(
  rawScript: string,
  events: RecordingEvent[],
  session: RecordingSession,
  conversationId?: string,
  signal?: AbortSignal,
): Promise<RefineResult> {
  const opsWithDOM = extractOpsWithDOM(events)

  if (opsWithDOM.length === 0) {
    return {
      refinedScript: updateStatusComment(rawScript),
      modified: false,
      summary: RECORDING_PROMPT.refine.noOpsSummary,
    }
  }

  if (signal?.aborted) {
    return {
      refinedScript: rawScript,
      modified: false,
      summary: 'Cancelled before LLM call',
    }
  }

  const contextSections = opsWithDOM.map((op, i) => `
${RECORDING_PROMPT.refine.operationTitle(i + 1, op.seq, op.toolName)}
  ${formatDomContext(op.domContext)}
`).join('\n')

  const userPrompt = RECORDING_PROMPT.refine.userPrompt(rawScript, contextSections)
  console.debug(`[Recording] DEBUG: Refine user prompt: ${userPrompt}`)

  try {
    const llm = await createLLM({
      enableThinking: true,
      conversationId,
      turnId: `rec_${session.id}_refine`,
    })

    const response = await (llm as any).invoke([
      { role: 'system', content: RECORDING_PROMPT.refineSystem },
      { role: 'user', content: userPrompt },
    ], { signal })

    const responseText = extractLLMResponse(response)
    console.debug(`[Recording] Refiner response: ${responseText}`)

    const scriptMatch = responseText.match(/```typescript\n?([\s\S]*?)\n?```/)
    if (!scriptMatch) {
      console.warn('[Recording] Refine: LLM did not return a code block, using raw skeleton')
      console.debug(`[Recording] Refine: Unmatched response: ${responseText}`)

      return {
        refinedScript: rawScript,
        modified: false,
        summary: RECORDING_PROMPT.refine.noCodeBlockSummary,
      }
    }

    const refinedScript = scriptMatch[1].trim()
    const afterCode = responseText.slice(responseText.indexOf('```', scriptMatch.index! + 3) + 3).trim()
    const summary = afterCode.split('\n')[0]?.trim() || RECORDING_PROMPT.refine.defaultSummary

    return { refinedScript: updateStatusComment(refinedScript), modified: refinedScript !== rawScript, summary }
  }
  catch (err: any) {
    console.error('[Recording] Refine failed:', err.message)
    return {
      refinedScript: rawScript,
      modified: false,
      summary: RECORDING_PROMPT.refine.failedSummary(err?.message ?? String(err)),
    }
  }
}
