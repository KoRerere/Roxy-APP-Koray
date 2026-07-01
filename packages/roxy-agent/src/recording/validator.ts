import module from 'node:module'
import vm from 'node:vm'
import { RECORDING_PROMPT } from '@/deepagents/prompt/recording'

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  rule: string
  severity: ValidationSeverity
  message: string
  line?: number
  snippet?: string
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

/**
 * 脚本允许读取的 process.env 白名单（sandbox 注入的运行时变量）。
 *  注意：SANDBOX_OUTPUT_DIR 不再暴露给脚本——脚本以 process.cwd() === '/' 为虚拟根，
 *  workspace 真实路径不泄露。宿主进程侧仍通过 OS env 注入 SANDBOX_OUTPUT_DIR 供 sandbox.ts 内部使用。
 *
 *  浏览器连接相关：
 *  - BROWSER_URL（首选）/ BROWSER_TYPE（'chromium' | 'firefox'）：通用 WebSocket 连接，
 *    经 `chromium.connect` / `firefox.connect` 接入，兼容 firefox（firefox 已弃用 CDP）。
 *  - CDP_URL（legacy fallback）：仅在 BROWSER_URL 缺省时经 `chromium.connectOverCDP` 使用，仅 chromium 可用。
 */
const ALLOWED_ENV_VARS = new Set([
  'BROWSER_URL',
  'BROWSER_TYPE',
  'CDP_URL',
  'SANDBOX_RUN_ID',
  'SANDBOX_DIR_ID',
])

/** 旧 sandbox 注入的全局浏览器函数，最终脚本不得再调用（应改用原生 Playwright） */
const LEGACY_BROWSER_GLOBALS = [
  'browser_navigate',
  'browser_click',
  'browser_type',
  'browser_fill_form',
  'browser_press_key',
  'browser_select_option',
  'browser_wait_for',
  'browser_hover',
  'browser_scroll',
  'browser_drag',
  'browser_snapshot',
  'browser_console_messages',
  'browser_network_requests',
  'browser_take_screenshot',
]

const SENSITIVE_TOKEN_HINTS = [
  /\bauthorization\s*[:=]\s*['"`]/i,
  /\bcookie\s*[:=]\s*['"`][^'"`]{8,}/i,
  /\bbearer\s+[\w.-]{12,}/i,
  /\bsk-[a-z0-9]{16,}/i,
]

function toLines(script: string): Array<{ n: number, text: string }> {
  return script.split(/\r?\n/).map((text, i) => ({ n: i + 1, text }))
}

/**
 * 剥离顶层 ESM import / export 语句，使剩余主体可用 vm.compileFunction 做语法检查。
 * vm.compileFunction 把代码当函数体编译，不接受顶层 import/export；而 SourceTextModule 需要
 * --experimental-vm-modules（agent 主进程未开启）。import 的合法性另由 forbidden-import 规则覆盖。
 */
function stripModuleSyntax(src: string): string {
  return src
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trimStart()
      // 顶层 import 声明（`import x from`/`import { a }`/`import * as a`/`import 'm'`），
      // 但排除动态 import() 表达式
      if (/^import[\s{*'"]/.test(trimmed) && !trimmed.startsWith('import('))
        return ''
      // 去掉 export 前缀：`export const` / `export function` / `export default`
      return line.replace(/^(\s+)?export\s+(default\s+)?/, '$1')
    })
    .join('\n')
}

function checkSyntax(script: string): ValidationIssue[] {
  try {
    const stripped = module.stripTypeScriptTypes(script, { mode: 'strip' })
    vm.compileFunction(stripModuleSyntax(stripped), [], {})
    return []
  }
  catch (err: any) {
    return [{
      rule: 'syntax',
      severity: 'error',
      message: RECORDING_PROMPT.validation.syntax(err?.message ?? String(err)),
    }]
  }
}

function checkFailedMarkers(lines: Array<{ n: number, text: string }>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const { n, text } of lines) {
    if (/\/\/\s*FAILED:/.test(text)) {
      issues.push({
        rule: 'failed-marker',
        severity: 'error',
        message: RECORDING_PROMPT.validation.failedMarker,
        line: n,
        snippet: text.trim(),
      })
    }
  }
  return issues
}

function checkNetworkCalls(lines: Array<{ n: number, text: string }>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const { n, text } of lines) {
    if (/\bfetch\s*\(/.test(text) && !/\/\//.test(text.slice(0, text.indexOf('fetch')))) {
      issues.push({
        rule: 'network-call',
        severity: 'error',
        message: RECORDING_PROMPT.validation.fetch,
        line: n,
        snippet: text.trim(),
      })
    }
    if (/\bnew\s+XMLHttpRequest\b/.test(text)) {
      issues.push({
        rule: 'network-call',
        severity: 'error',
        message: RECORDING_PROMPT.validation.xhr,
        line: n,
        snippet: text.trim(),
      })
    }
  }
  return issues
}

function checkProcessAccess(lines: Array<{ n: number, text: string }>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const envRe = /\bprocess\.env\.([A-Z_]\w*)\b/gi
  const envBracketRe = /\bprocess\.env\s*\[\s*['"`]([^'"`]+)['"`]\s*\]/g
  for (const { n, text } of lines) {
    const commentIndex = text.indexOf('//')
    const code = commentIndex >= 0 ? text.slice(0, commentIndex) : text

    for (const m of code.matchAll(envRe)) {
      const name = m[1]
      if (!ALLOWED_ENV_VARS.has(name)) {
        issues.push({
          rule: 'process-env',
          severity: 'error',
          message: RECORDING_PROMPT.validation.processEnv(name),
          line: n,
          snippet: text.trim(),
        })
      }
    }
    for (const m of code.matchAll(envBracketRe)) {
      const name = m[1]
      if (!ALLOWED_ENV_VARS.has(name)) {
        issues.push({
          rule: 'process-env',
          severity: 'error',
          message: RECORDING_PROMPT.validation.processEnv(name),
          line: n,
          snippet: text.trim(),
        })
      }
    }
    // 裸 process.env（无具体字段名，可能枚举/解构整个环境）一律禁止
    if (/\bprocess\.env\b(?!\s*(?:\.[A-Z_]|\[\s*['"`]))/i.test(code)) {
      issues.push({
        rule: 'process-env',
        severity: 'error',
        message: RECORDING_PROMPT.validation.processEnv('*'),
        line: n,
        snippet: text.trim(),
      })
    }

    if (/\bchild_process\b|\bworker_threads\b/.test(code)) {
      issues.push({
        rule: 'forbidden-api',
        severity: 'error',
        message: RECORDING_PROMPT.validation.forbiddenApi,
        line: n,
        snippet: text.trim(),
      })
    }
  }
  return issues
}

function checkLegacyBrowserGlobals(lines: Array<{ n: number, text: string }>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const { n, text } of lines) {
    const commentIndex = text.indexOf('//')
    const code = commentIndex >= 0 ? text.slice(0, commentIndex) : text
    for (const fn of LEGACY_BROWSER_GLOBALS) {
      const re = new RegExp(`(?<![\\w.])${fn}\\s*\\(`)
      if (re.test(code)) {
        issues.push({
          rule: 'legacy-browser-global',
          severity: 'error',
          message: RECORDING_PROMPT.validation.legacyBrowserGlobal(fn),
          line: n,
          snippet: text.trim(),
        })
      }
    }
  }
  return issues
}

function checkUnsupportedRuntimeGlobals(lines: Array<{ n: number, text: string }>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const patterns = [
    /\blog\.(?:info|warn|error|debug|trace)\s*\(/,
    /\btrace\./,
    /\bfiles\./,
    /\bruntime\./,
    /(?<![\w.])report\s*\(/,
  ]

  for (const { n, text } of lines) {
    const commentIndex = text.indexOf('//')
    const code = commentIndex >= 0 ? text.slice(0, commentIndex) : text
    if (patterns.some(re => re.test(code))) {
      issues.push({
        rule: 'unsupported-runtime-global',
        severity: 'error',
        message: RECORDING_PROMPT.validation.unsupportedRuntimeGlobal,
        line: n,
        snippet: text.trim(),
      })
    }
  }
  return issues
}

function checkEmptyLocators(lines: Array<{ n: number, text: string }>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const emptyLocatorPatterns = [
    /getBy\w+\(\s*['"`]\s*['"`]\s*\)/,
    /\blocator\(\s*['"`]\s*['"`]\s*\)/,
    /\bselector\s*:\s*['"`]\s*['"`]/,
    /\brole\s*:\s*['"`]\s*['"`]/,
  ]
  for (const { n, text } of lines) {
    if (emptyLocatorPatterns.some(re => re.test(text))) {
      issues.push({
        rule: 'empty-locator',
        severity: 'error',
        message: RECORDING_PROMPT.validation.emptyLocator,
        line: n,
        snippet: text.trim(),
      })
    }
  }
  return issues
}

function checkUnstableRefs(lines: Array<{ n: number, text: string }>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const { n, text } of lines) {
    if (/UNSTABLE:\s*AXTree ref/.test(text)) {
      issues.push({
        rule: 'unstable-ref',
        severity: 'error',
        message: RECORDING_PROMPT.validation.unstableRefComment,
        line: n,
        snippet: text.trim(),
      })
    }
    // 原生 Playwright 形态的临时 ref：page.locator('aria-ref=e12')
    if (/['"`]aria-ref=e\d+['"`]/.test(text)) {
      issues.push({
        rule: 'unstable-ref',
        severity: 'error',
        message: RECORDING_PROMPT.validation.unstableRefBare,
        line: n,
        snippet: text.trim(),
      })
    }
  }
  return issues
}

function checkSensitiveLeak(lines: Array<{ n: number, text: string }>): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const { n, text } of lines) {
    if (SENSITIVE_TOKEN_HINTS.some(re => re.test(text))) {
      issues.push({
        rule: 'sensitive-leak',
        severity: 'error',
        message: RECORDING_PROMPT.validation.sensitiveLeak,
        line: n,
        snippet: RECORDING_PROMPT.validation.hiddenSnippet,
      })
    }
  }
  return issues
}

function checkStructure(script: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const hasExportedMain = /export\s+async\s+function\s+main\s*\(/.test(script)
    || /export\s+const\s+main\s*=\s*async/.test(script)
  if (!hasExportedMain) {
    issues.push({
      rule: 'structure-main',
      severity: 'error',
      message: RECORDING_PROMPT.validation.missingMain,
    })
  }
  // main 的 options 形参可选：仅当脚本完全无需外部入参时才可省略（`export async function main()`）；
  // 需要入参的脚本应声明 options 形参并由 run_script 的 options 参数注入。此处不强制。

  // 连接调用：connectOverCDP（chromium CDP legacy）或 .connect（chromium/firefox 通用 WebSocket）。
  if (!/\bconnectOverCDP\s*\(/.test(script) && !/\.connect\s*\(/.test(script)) {
    issues.push({
      rule: 'structure-connect',
      severity: 'error',
      message: RECORDING_PROMPT.validation.missingConnectOverCDP,
    })
  }
  // 连接端点：优先 BROWSER_URL，兼容 legacy CDP_URL（脚本至少引用其一）。
  if (!/\bprocess\.env\.BROWSER_URL\b/.test(script) && !/\bprocess\.env\.CDP_URL\b/.test(script)) {
    issues.push({
      rule: 'structure-cdp-url',
      severity: 'error',
      message: RECORDING_PROMPT.validation.missingCdpUrlEnv,
    })
  }
  return issues
}

export function validateScript(script: string): ValidationResult {
  const lines = toLines(script)

  const issues: ValidationIssue[] = [
    ...checkSyntax(script),
    ...checkFailedMarkers(lines),
    ...checkNetworkCalls(lines),
    ...checkProcessAccess(lines),
    ...checkLegacyBrowserGlobals(lines),
    ...checkUnsupportedRuntimeGlobals(lines),
    ...checkEmptyLocators(lines),
    ...checkUnstableRefs(lines),
    ...checkSensitiveLeak(lines),
    ...checkStructure(script),
  ]

  const valid = !issues.some(i => i.severity === 'error')
  return { valid, issues }
}

export function formatValidationReport(result: ValidationResult): string {
  if (result.issues.length === 0) {
    return RECORDING_PROMPT.validation.ok
  }

  const errors = result.issues.filter(i => i.severity === 'error')
  const warnings = result.issues.filter(i => i.severity === 'warning')

  const lines: string[] = []
  lines.push(result.valid
    ? RECORDING_PROMPT.validation.okWithWarnings
    : RECORDING_PROMPT.validation.failed(errors.length, warnings.length))

  if (errors.length > 0) {
    lines.push('', RECORDING_PROMPT.validation.errorsTitle)
    for (const issue of errors) {
      const loc = issue.line ? RECORDING_PROMPT.validation.line(issue.line) : ''
      lines.push(`- [${issue.rule}]${loc} ${issue.message}`)
      if (issue.snippet)
        lines.push(`    ${issue.snippet}`)
    }
  }

  if (warnings.length > 0) {
    lines.push('', RECORDING_PROMPT.validation.warningsTitle)
    for (const issue of warnings) {
      const loc = issue.line ? RECORDING_PROMPT.validation.line(issue.line) : ''
      lines.push(`- [${issue.rule}]${loc} ${issue.message}`)
    }
  }

  return lines.join('\n')
}
