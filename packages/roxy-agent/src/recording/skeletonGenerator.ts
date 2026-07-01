import type { BrowserOpEvent, RecordingEvent, RecordingSession } from './types'

/** 需要转换为脚本步骤的工具名（标准化后） */
const SCRIPTABLE_TOOLS = new Set([
  'browser_navigate',
  'browser_click',
  'browser_type',
  'browser_fill_form',
  'browser_press_key',
  'browser_select_option',
  'browser_wait_for',
  'browser_scroll',
  'browser_drag',
  'browser_hover',
])

function normalizeToolName(toolName: string): string {
  return toolName
    .replace(/^roxybrowser_playwright__/, '')
    .replace(/^roxybrowser_playwright_/, '')
    .replace(/^browser_playwright__/, '')
}

function isScriptableTool(toolName: string): boolean {
  return SCRIPTABLE_TOOLS.has(normalizeToolName(toolName))
}

function indent(level: number): string {
  return '  '.repeat(level)
}

interface LocatorBuild {
  /** Playwright locator 表达式，如 `page.getByRole('button', { name: 'Search' })` */
  expr: string
  /** 是否为 AXTree 临时 ref（需要 Refine 替换为稳定 locator） */
  unstable: boolean
  /** 当 unstable 时，附加在 locator 行上方的 UNSTABLE 注释（供 Refine 与 validator 识别） */
  comment?: string
}

/**
 * 把录制事件的定位信息转换为原生 Playwright locator 表达式。
 * 稳定来源（selector / role+name / text）直接生成可回放的 locator；
 * AXTree ref（如 "e11"）是页面快照的临时 ID，仅作占位并标记 UNSTABLE，由 Refine 阶段替换。
 */
function buildLocator(input: Record<string, any>): LocatorBuild {
  if (input.selector) {
    return { expr: `page.locator(${JSON.stringify(input.selector)})`, unstable: false }
  }
  if (input.role && input.name) {
    return {
      expr: `page.getByRole(${JSON.stringify(input.role)}, { name: ${JSON.stringify(input.name)} })`,
      unstable: false,
    }
  }
  if (input.ref) {
    const elementHint = input.element ? ` element: ${JSON.stringify(input.element)}.` : ''
    return {
      expr: `page.locator(${JSON.stringify(`aria-ref=${input.ref}`)})`,
      unstable: true,
      comment: `UNSTABLE: AXTree ref ${JSON.stringify(input.ref)}.${elementHint} Refine will replace with a stable locator.`,
    }
  }
  if (input.element) {
    return {
      expr: `page.getByText(${JSON.stringify(input.element)})`,
      unstable: true,
      comment: `UNSTABLE: AXTree ref (element ${JSON.stringify(input.element)}). Refine will replace with a stable locator.`,
    }
  }
  if (input.text) {
    return { expr: `page.getByText(${JSON.stringify(input.text)})`, unstable: false }
  }
  return {
    expr: `page.locator('REPLACE_ME')`,
    unstable: true,
    comment: `UNSTABLE: AXTree ref unavailable. Refine must supply a stable locator.`,
  }
}

/** 把一个 locator 调用（含可选 UNSTABLE 注释）渲染为脚本行 */
function renderLocatorCall(ind: string, locator: LocatorBuild, callSuffix: string): string[] {
  const lines: string[] = []
  if (locator.unstable && locator.comment) {
    lines.push(`${ind}// ${locator.comment}`)
  }
  lines.push(`${ind}await ${locator.expr}.${callSuffix}`)
  return lines
}

function generateOpCode(event: BrowserOpEvent, indentLevel = 2): string | null {
  const toolName = normalizeToolName(event.toolName)
  const ind = indent(indentLevel)

  if (!isScriptableTool(event.toolName))
    return null

  const { input } = event
  const lines: string[] = []

  if (!event.success) {
    lines.push(`${ind}// FAILED: ${event.toolName} - ${event.errorMessage || 'unknown error'}`)
    lines.push(`${ind}// ${toolName}(${JSON.stringify(input)})`)
    return lines.join('\n')
  }

  switch (toolName) {
    case 'browser_navigate': {
      const url = input.url || input.URL || ''
      lines.push(`${ind}await page.goto(${JSON.stringify(url)})`)
      break
    }

    case 'browser_click': {
      lines.push(...renderLocatorCall(ind, buildLocator(input), 'click()'))
      break
    }

    case 'browser_type': {
      const text = input.text || input.value || ''
      if (input.ref || input.element || input.selector || (input.role && input.name)) {
        lines.push(...renderLocatorCall(ind, buildLocator(input), `fill(${JSON.stringify(text)})`))
      }
      else {
        lines.push(`${ind}await page.keyboard.type(${JSON.stringify(text)})`)
      }
      break
    }

    case 'browser_fill_form': {
      const fields = Array.isArray(input.fields) ? input.fields : []
      if (fields.length > 0) {
        for (const field of fields) {
          const value = field.value ?? field.text ?? ''
          lines.push(...renderLocatorCall(ind, buildLocator(field), `fill(${JSON.stringify(value)})`))
        }
      }
      else {
        lines.push(`${ind}// TODO: browser_fill_form recorded without field details: ${JSON.stringify(input)}`)
      }
      break
    }

    case 'browser_press_key': {
      const key = input.key || input.keyCode || ''
      lines.push(`${ind}await page.keyboard.press(${JSON.stringify(key)})`)
      break
    }

    case 'browser_select_option': {
      const values = input.values ?? input.value
      const valueArg = values !== undefined ? JSON.stringify(values) : `''`
      if (input.ref || input.element || input.selector || (input.role && input.name)) {
        lines.push(...renderLocatorCall(ind, buildLocator(input), `selectOption(${valueArg})`))
      }
      else {
        lines.push(`${ind}// TODO: browser_select_option recorded without a locator: ${JSON.stringify(input)}`)
      }
      break
    }

    case 'browser_wait_for': {
      if (input.state) {
        const state = input.state === 'networkidle' || input.state === 'load' || input.state === 'domcontentloaded'
          ? input.state
          : 'networkidle'
        lines.push(`${ind}await page.waitForLoadState(${JSON.stringify(state)})`)
      }
      else if (input.selector) {
        lines.push(`${ind}await page.waitForSelector(${JSON.stringify(input.selector)}, { timeout: ${input.timeoutMs || 5000} })`)
      }
      else if (input.ms) {
        lines.push(`${ind}await page.waitForTimeout(${input.ms})`)
      }
      else {
        lines.push(`${ind}await page.waitForLoadState('networkidle')`)
      }
      break
    }

    case 'browser_hover': {
      if (input.ref || input.element || input.selector || (input.role && input.name)) {
        lines.push(...renderLocatorCall(ind, buildLocator(input), 'hover()'))
      }
      else {
        lines.push(`${ind}// TODO: browser_hover recorded without a locator: ${JSON.stringify(input)}`)
      }
      break
    }

    case 'browser_scroll': {
      const dx = Number(input.deltaX ?? input.dx ?? 0) || 0
      const dy = Number(input.deltaY ?? input.dy ?? (input.direction === 'up' ? -600 : 600)) || 600
      lines.push(`${ind}await page.mouse.wheel(${dx}, ${dy})`)
      break
    }

    case 'browser_drag': {
      lines.push(`${ind}// TODO: browser_drag is not auto-converted; translate to page.dragAndDrop or mouse moves manually: ${JSON.stringify(input)}`)
      break
    }

    default:
      lines.push(`${ind}// TODO: ${toolName} not auto-converted: ${JSON.stringify(input)}`)
  }

  return lines.join('\n')
}

export interface SkeletonGenerateResult {
  script: string
  operationCount: number
  warnings: string[]
}

export function generateRawSkeleton(
  events: RecordingEvent[],
  session: RecordingSession,
): SkeletonGenerateResult {
  const warnings: string[] = []
  const orderedEvents = events.slice().sort((a, b) => a.seq - b.seq)
  const browserOps = orderedEvents.filter((e): e is BrowserOpEvent => e.type === 'browser_op')

  const configValues: Record<string, any> = {}
  for (const op of browserOps) {
    if (normalizeToolName(op.toolName) === 'browser_navigate' && op.input.url) {
      configValues.targetUrl ??= op.input.url
    }
  }
  if (session.primaryDirId) {
    configValues.dirId = session.primaryDirId
  }

  const opLines: string[] = []
  let operationCount = 0
  let turnIndex = 0
  let pendingUserMessages: string[] = []

  for (const event of orderedEvents) {
    if (event.type === 'user_message') {
      pendingUserMessages.push(event.content)
      continue
    }

    const code = generateOpCode(event, 2)
    if (code) {
      if (pendingUserMessages.length > 0) {
        turnIndex++
        opLines.push(`${indent(2)}// Turn ${turnIndex} user message(s):`)
        for (const message of pendingUserMessages) {
          opLines.push(`${indent(2)}// - ${message.replace(/\s+/g, ' ').trim()}`)
        }
        pendingUserMessages = []
      }
      opLines.push(code)
      if (!code.trimStart().startsWith('//')) {
        operationCount++
      }
    }
  }

  if (operationCount === 0 && browserOps.length > 0) {
    warnings.push('没有可转换的操作（所有操作均为失败状态）')
  }

  const configStr = Object.keys(configValues).length > 0
    ? `const config = ${JSON.stringify(configValues, null, 2)}\n\n`
    : ''

  const bodyLines = [
    `${indent(1)}let browser`,
    `${indent(1)}if (BROWSER_URL) {`,
    `${indent(2)}browser = BROWSER_TYPE === 'firefox'`,
    `${indent(3)}? await firefox.connect(BROWSER_URL)`,
    `${indent(3)}: await chromium.connect(BROWSER_URL)`,
    `${indent(1)}}`,
    `${indent(1)}else {`,
    `${indent(2)}browser = await chromium.connectOverCDP(CDP_URL)`,
    `${indent(1)}}`,
    `${indent(1)}const context = browser.contexts()[0] ?? await browser.newContext()`,
    `${indent(1)}const page = context.pages()[0] ?? await context.newPage()`,
    ``,
    ...opLines,
    ``,
    `${indent(1)}console.log('[done] steps=${operationCount} recordingId=${JSON.stringify(session.id)}')`,
    `${indent(1)}await browser.close()`,
  ]

  const scriptParts = [
    `/**`,
    ` * 自动化脚本（raw skeleton）`,
    ` * 录制 ID: ${session.id}`,
    ` * 录制时间: ${new Date(session.createdAt).toISOString()}`,
    ` * 目标窗口 dirId: ${session.primaryDirId || '(未检测到)'}`,
    ` * 状态: 待 Refine（locator 稳定化）`,
    ` */`,
    ``,
    `import { chromium, firefox } from 'playwright'`,
  ]

  scriptParts.push(
    '',
    `${configStr}const BROWSER_URL = process.env.BROWSER_URL ?? ''`,
    `const CDP_URL = process.env.CDP_URL ?? ''`,
    `const BROWSER_TYPE = process.env.BROWSER_TYPE ?? 'chromium'`,
    `if (!BROWSER_URL && !CDP_URL) {`,
    `${indent(1)}console.error('Set BROWSER_URL or CDP_URL before running this script.')`,
    `${indent(1)}process.exit(1)`,
    `}`,
    '',
    `export async function main(options: Record<string, unknown> = {}): Promise<void> {`,
    ...bodyLines,
    `}`,
  )

  const script = scriptParts.join('\n')

  return { script, operationCount, warnings }
}
