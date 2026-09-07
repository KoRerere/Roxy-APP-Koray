import type { TaskReportInput } from '@roxy/shared'

export interface TaskReportMarkdownWindow {
  window: string
  country: string
  account: string
  result: string
  failureReason: string
}

export interface TaskReportMarkdownMeta {
  total: string
  used?: string
  succeeded: string
  unused?: string
  successRate: string
}

export interface TaskReportMarkdownLabels {
  title: string
  taskName: string
  reportStatus: string
  completed: string
  parameters: string
  noParameters: string
  parameterKey: string
  parameterName: string
  parameterValue: string
  windows: string
  window: string
  country: string
  account: string
  result: string
  failureReason: string
  summary: string
  total: string
  used?: string
  succeeded: string
  unused?: string
  successRate: string
}

function markdownText(value: unknown): string {
  return String(value ?? '')
    .replace(/\r?\n/g, '<br>')
    .replace(/\|/g, '\\|')
}

function markdownCell(value: unknown): string {
  const text = markdownText(value)
  return text || '-'
}

export function buildTaskReportMarkdown(
  report: TaskReportInput,
  windows: readonly TaskReportMarkdownWindow[],
  meta: TaskReportMarkdownMeta,
  labels: TaskReportMarkdownLabels,
): string {
  const parameters = report.params.length
    ? report.params
        .map(parameter => `| ${markdownCell(parameter.name)} | ${markdownCell(parameter.key)} | ${markdownCell(parameter.value)} |`)
        .join('\n')
    : `| ${markdownCell(labels.noParameters)} | - | - |`

  const windowRows = windows.length
    ? windows
        .map(window => `| ${markdownCell(window.window)} | ${markdownCell(window.country)} | ${markdownCell(window.account)} | ${markdownCell(window.result)} | ${markdownCell(window.failureReason)} |`)
        .join('\n')
    : `| ${markdownCell(labels.noParameters)} | - | - | - | - |`

  const usedLabel = labels.used ?? ''
  const unusedLabel = labels.unused ?? ''
  const hasUsageBreakdown = meta.used !== undefined
    && meta.unused !== undefined
    && Boolean(usedLabel && unusedLabel)
  const summaryHeader = hasUsageBreakdown
    ? `| ${markdownText(labels.total)} | ${markdownText(usedLabel)} | ${markdownText(labels.succeeded)} | ${markdownText(unusedLabel)} | ${markdownText(labels.successRate)} |`
    : `| ${markdownText(labels.total)} | ${markdownText(labels.succeeded)} | ${markdownText(labels.successRate)} |`
  const summaryDivider = hasUsageBreakdown
    ? '| ---: | ---: | ---: | ---: | ---: |'
    : '| ---: | ---: | ---: |'
  const summaryValues = hasUsageBreakdown
    ? `| ${markdownCell(meta.total)} | ${markdownCell(meta.used)} | ${markdownCell(meta.succeeded)} | ${markdownCell(meta.unused)} | ${markdownCell(meta.successRate)} |`
    : `| ${markdownCell(meta.total)} | ${markdownCell(meta.succeeded)} | ${markdownCell(meta.successRate)} |`

  return `\uFEFF# ${markdownText(labels.title)}

## ${markdownText(labels.taskName)}

${markdownText(report.taskName)}

| ${markdownText(labels.reportStatus)} |
| --- |
| ${markdownText(labels.completed)} |

## ${markdownText(labels.parameters)}

| ${markdownText(labels.parameterName)} | ${markdownText(labels.parameterKey)} | ${markdownText(labels.parameterValue)} |
| --- | --- | --- |
${parameters}

## ${markdownText(labels.windows)}

| ${markdownText(labels.window)} | ${markdownText(labels.country)} | ${markdownText(labels.account)} | ${markdownText(labels.result)} | ${markdownText(labels.failureReason)} |
| --- | --- | --- | --- | --- |
${windowRows}

## ${markdownText(labels.summary)}

${summaryHeader}
${summaryDivider}
${summaryValues}
`
}

export function taskReportFileName(taskName: string): string {
  const safeName = [...taskName.trim()]
    .map(character => /[<>:"/\\|?*]/.test(character) || character.charCodeAt(0) < 32 ? '_' : character)
    .join('')
    .replace(/\s+/g, '_')
    .slice(0, 80)

  return `${safeName || 'task-report'}.md`
}
