import { describe, expect, it } from 'vitest'
import {
  formatTaskReportValidationError,
  TaskReportInputSchema,
  TaskReportTemplateContextSchema,
} from './task-report'

const validReport = {
  taskName: '批量养号',
  params: [{
    key: 'browseDuration',
    name: '每个窗口的浏览时长',
    value: 15,
  }],
  windows: [{
    dirId: 'profile-1',
    success: true,
    failureReason: '',
  }],
}

describe('task report input schema', () => {
  it('accepts a primitive-parameter report for one browser window', () => {
    expect(TaskReportInputSchema.safeParse(validReport).success).toBe(true)
  })

  it('accepts an explicitly unused window without a failure reason', () => {
    expect(TaskReportInputSchema.safeParse({
      ...validReport,
      windows: [{ dirId: 'profile-2', success: false, status: 'unused', failureReason: '' }],
    }).success).toBe(true)
  })

  it('rejects non-unused outcomes for an unused window shape', () => {
    const invalid = {
      ...validReport,
      windows: [{ dirId: 'profile-2', success: false, status: 'unused', failureReason: '未启动' }],
    }
    const parsed = TaskReportInputSchema.safeParse(invalid)
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(formatTaskReportValidationError(invalid, parsed.error)).toContain('an empty string because status=unused')
    }
    expect(TaskReportInputSchema.safeParse({
      ...validReport,
      windows: [{ dirId: 'profile-2', success: true, status: 'unused', failureReason: '' }],
    }).success).toBe(false)

    const invalidStatus = {
      ...validReport,
      windows: [{ dirId: 'profile-2', success: true, status: 'skipped', failureReason: '' }],
    }
    const parsedStatus = TaskReportInputSchema.safeParse(invalidStatus)
    expect(parsedStatus.success).toBe(false)
    if (!parsedStatus.success) {
      expect(formatTaskReportValidationError(invalidStatus, parsedStatus.error)).toContain('omit for a started window')
    }
  })

  it('rejects object parameter values, invalid success reasons, and sensitive fields', () => {
    expect(TaskReportInputSchema.safeParse({
      ...validReport,
      params: [{ ...validReport.params[0], value: { nested: true } }],
    }).success).toBe(false)
    expect(TaskReportInputSchema.safeParse({
      ...validReport,
      windows: [{ ...validReport.windows[0], failureReason: 'unexpected failure' }],
    }).success).toBe(false)
    expect(TaskReportInputSchema.safeParse({
      ...validReport,
      params: [{ ...validReport.params[0], key: 'apiToken', value: 'secret' }],
    }).success).toBe(false)
  })

  it('rejects legacy i18n descriptions and overlong report fields', () => {
    expect(TaskReportInputSchema.safeParse({
      ...validReport,
      params: [{
        ...validReport.params[0],
        description: { 'zh-CN': '每个窗口的浏览时长' },
      }],
    }).success).toBe(false)
    expect(TaskReportInputSchema.safeParse({ ...validReport, taskName: '标'.repeat(81) }).success).toBe(false)
    expect(TaskReportInputSchema.safeParse({
      ...validReport,
      params: [{ ...validReport.params[0], key: 'k'.repeat(65) }],
    }).success).toBe(false)
    expect(TaskReportInputSchema.safeParse({
      ...validReport,
      params: [{ ...validReport.params[0], name: '说明'.repeat(41) }],
    }).success).toBe(false)
    expect(TaskReportInputSchema.safeParse({
      ...validReport,
      params: [{ ...validReport.params[0], value: 'v'.repeat(257) }],
    }).success).toBe(false)
  })

  it('accepts report fields at their configured length limits', () => {
    expect(TaskReportInputSchema.safeParse({
      ...validReport,
      taskName: '标'.repeat(80),
      params: [{
        key: 'k'.repeat(64),
        name: '说明'.repeat(40),
        value: 'v'.repeat(256),
      }],
    }).success).toBe(true)
  })

  it('carries the validated report in a strict template context', () => {
    const context = {
      sourceReportId: 'tool-use-1',
      report: validReport,
    }

    expect(TaskReportTemplateContextSchema.safeParse(context).success).toBe(true)
    expect(TaskReportTemplateContextSchema.safeParse({ ...context, extra: true }).success).toBe(false)
  })
})
