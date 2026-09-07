import { z } from 'zod'

export const MAX_TASK_REPORT_PARAMS = 20
export const MAX_TASK_REPORT_WINDOWS = 100
export const MAX_TASK_REPORT_TITLE_LENGTH = 80
export const MAX_TASK_REPORT_PARAMETER_KEY_LENGTH = 64
export const MAX_TASK_REPORT_PARAMETER_NAME_LENGTH = 80
export const MAX_TASK_REPORT_PARAMETER_VALUE_LENGTH = 256

const SENSITIVE_TEXT_PATTERN = /password|passcode|cookie|token|api[\s_-]?key|secret|authorization|credential|密码|口令|令牌|密钥|凭证/i

const TaskReportTitleSchema = z.string().trim().min(1).max(MAX_TASK_REPORT_TITLE_LENGTH)
const TaskReportParameterKeySchema = z.string().trim().min(1).max(MAX_TASK_REPORT_PARAMETER_KEY_LENGTH)
const TaskReportParameterNameSchema = z.string().trim().min(1).max(MAX_TASK_REPORT_PARAMETER_NAME_LENGTH)

export const TaskReportParameterValueSchema = z.union([
  z.string().trim().max(MAX_TASK_REPORT_PARAMETER_VALUE_LENGTH),
  z.number().finite(),
  z.boolean(),
  z.null(),
])

export const TaskReportParameterSchema = z.strictObject({
  key: TaskReportParameterKeySchema,
  name: TaskReportParameterNameSchema,
  value: TaskReportParameterValueSchema,
})

export const TaskReportWindowSchema = z.strictObject({
  dirId: z.string().trim().min(1).max(256).describe('Browser directory id used in this conversation, or a current user profile reference for an unused entry.'),
  success: z.boolean().describe('Whether the started browser window completed the requested work.'),
  status: z.literal('unused').optional().describe('Use exactly for an admitted window that was never started; pair with success=false and failureReason="".'),
  failureReason: z.string().max(2_000).describe('Empty when success=true or status=unused; concise and non-empty when a started window failed.'),
})

export const TaskReportInputSchema = z.strictObject({
  taskName: TaskReportTitleSchema,
  params: z.array(TaskReportParameterSchema).max(MAX_TASK_REPORT_PARAMS),
  windows: z.array(TaskReportWindowSchema).min(1).max(MAX_TASK_REPORT_WINDOWS),
}).superRefine((report, ctx) => {
  if (containsSensitiveTaskReportText(report.taskName)) {
    ctx.addIssue({
      code: 'custom',
      path: ['taskName'],
      message: 'taskName must not contain sensitive data',
    })
  }

  const seenDirIds = new Set<string>()
  for (const [index, window] of report.windows.entries()) {
    if (seenDirIds.has(window.dirId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['windows', index, 'dirId'],
        message: 'dirId must be unique within a task report',
      })
    }
    seenDirIds.add(window.dirId)

    if (window.status === 'unused' && window.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['windows', index, 'success'],
        message: 'expected success=false because status=unused',
      })
    }
    if (window.status === 'unused' && window.failureReason !== '') {
      ctx.addIssue({
        code: 'custom',
        path: ['windows', index, 'failureReason'],
        message: 'expected an empty string because status=unused',
      })
    }
    if (!window.status && window.success && window.failureReason !== '') {
      ctx.addIssue({
        code: 'custom',
        path: ['windows', index, 'failureReason'],
        message: 'expected an empty string because success=true',
      })
    }
    if (!window.status && !window.success && !window.failureReason.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['windows', index, 'failureReason'],
        message: 'expected a non-empty string because success=false',
      })
    }
    if (containsSensitiveTaskReportText(window.failureReason)) {
      ctx.addIssue({
        code: 'custom',
        path: ['windows', index, 'failureReason'],
        message: 'failureReason must not contain sensitive data',
      })
    }
  }

  for (const [index, parameter] of report.params.entries()) {
    if (containsSensitiveTaskReportText(parameter.key)) {
      ctx.addIssue({
        code: 'custom',
        path: ['params', index, 'key'],
        message: 'parameter keys must not contain sensitive data',
      })
    }

    if (containsSensitiveTaskReportText(parameter.name)) {
      ctx.addIssue({
        code: 'custom',
        path: ['params', index, 'name'],
        message: 'parameter names must not contain sensitive data',
      })
    }

    if (typeof parameter.value === 'string' && containsSensitiveTaskReportText(parameter.value)) {
      ctx.addIssue({
        code: 'custom',
        path: ['params', index, 'value'],
        message: 'parameter values must not contain sensitive data',
      })
    }
  }
})

export type TaskReportInput = z.infer<typeof TaskReportInputSchema>

export const TaskReportTemplateContextSchema = z.strictObject({
  sourceReportId: z.string().trim().min(1).max(256),
  report: TaskReportInputSchema,
})

export type TaskReportTemplateContext = z.infer<typeof TaskReportTemplateContextSchema>

export function containsSensitiveTaskReportText(value: string): boolean {
  return SENSITIVE_TEXT_PATTERN.test(value)
}

function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((result, segment) => {
    if (typeof segment === 'number') {
      return `${result}[${String(segment)}]`
    }
    return result ? `${result}.${String(segment)}` : String(segment)
  }, '')
}

function valueAtPath(input: unknown, path: readonly PropertyKey[]): unknown {
  let value = input
  for (const segment of path) {
    if (value === null || typeof value !== 'object') {
      return undefined
    }
    value = (value as Record<PropertyKey, unknown>)[segment]
  }
  return value
}

function valueKind(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return 'an array'
  }
  if (value === undefined) {
    return 'missing'
  }
  if (typeof value === 'object') {
    return 'an object'
  }
  return `a ${typeof value}`
}

function expectedForPath(path: string, fallback: string): string {
  if (path.endsWith('.value')) {
    return 'a primitive string, number, boolean, or null'
  }
  if (path.endsWith('.key')) {
    return `a concise parameter key up to ${MAX_TASK_REPORT_PARAMETER_KEY_LENGTH} characters`
  }
  if (path.endsWith('.name')) {
    return `a brief user-facing name up to ${MAX_TASK_REPORT_PARAMETER_NAME_LENGTH} characters`
  }
  if (path.endsWith('.status')) {
    return 'omit for a started window, or use exactly "unused" for an admitted window that was never started'
  }
  if (path.endsWith('.failureReason')) {
    if (fallback.includes('status=unused')) {
      return 'an empty string because status=unused'
    }
    if (fallback.includes('success=true')) {
      return 'an empty string because success=true'
    }
    if (fallback.includes('success=false')) {
      return 'a non-empty string because success=false'
    }
    return 'a failure reason consistent with success'
  }
  return fallback || 'a value matching the report schema'
}

/** Formats strict Zod validation failures without echoing potentially sensitive values. */
export function formatTaskReportValidationError(input: unknown, error: z.ZodError): string {
  const reportedPaths = new Set<string>()
  const errors = error.issues.map((issue) => {
    const path = formatPath(issue.path)
    reportedPaths.add(path)
    const received = valueKind(valueAtPath(input, issue.path))
    const expected = expectedForPath(path, issue.message)
    return `- ${path || 'report'}: expected ${expected}. Received ${received}.`
  })

  const rawReport = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : undefined
  const rawWindows = Array.isArray(rawReport?.windows) ? rawReport.windows : []
  for (const [index, rawWindow] of rawWindows.entries()) {
    if (!rawWindow || typeof rawWindow !== 'object' || Array.isArray(rawWindow)) {
      continue
    }
    const window = rawWindow as Record<string, unknown>
    const path = `windows[${index}].failureReason`
    if (reportedPaths.has(path) || typeof window.success !== 'boolean' || typeof window.failureReason !== 'string') {
      continue
    }
    if (window.status === 'unused') {
      continue
    }
    if (window.success && window.failureReason !== '') {
      errors.push(`- ${path}: expected an empty string because success=true. Received a non-empty string.`)
      continue
    }
    if (!window.success && !window.failureReason.trim()) {
      errors.push(`- ${path}: expected a non-empty string because success=false. Received an empty string.`)
    }
  }

  return [
    '## Task report validation failed',
    '',
    'The report was not accepted. Fix the input and call roxy_task_report again.',
    '',
    '### Errors',
    '',
    ...errors,
    '',
    '### Expected shape',
    '',
    `- taskName: a short title in the user's system language, up to ${MAX_TASK_REPORT_TITLE_LENGTH} characters`,
    `- params[].key: concise parameter key, up to ${MAX_TASK_REPORT_PARAMETER_KEY_LENGTH} characters`,
    `- params[].name: brief user-facing name, up to ${MAX_TASK_REPORT_PARAMETER_NAME_LENGTH} characters`,
    `- params[].value: concise primitive string (up to ${MAX_TASK_REPORT_PARAMETER_VALUE_LENGTH} characters), number, boolean, or null`,
    '- windows[].dirId: browser directory id',
    '- windows[].success: boolean',
    '- windows[].status: omit for a started window; otherwise use exactly "unused" for an admitted window that was not started',
    '- windows[].failureReason: empty on success and non-empty on failure',
    '- For status="unused", use success=false and an empty failureReason.',
  ].join('\n')
}
