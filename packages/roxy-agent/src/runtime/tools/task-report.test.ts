import type { ToolContext } from 'roxy-agent-runtime'
import { describe, expect, it } from 'vitest'
import { createTaskReportTool } from './task-report'
import { createTaskReportWindowTracker } from './task-report-window-tracker'

const context: ToolContext = {
  agentId: 'root',
  traceId: 'trace-1',
  signal: new AbortController().signal,
}

const validReport = {
  taskName: '批量养号',
  params: [{
    key: 'browseDuration',
    name: '每个窗口的浏览时长',
    value: 15,
  }],
  windows: [{ dirId: 'profile-1', success: true, failureReason: '' }],
}

describe('roxy_task_report', () => {
  it('accepts a valid report and asks the runtime to end the turn directly', async () => {
    const tool = createTaskReportTool()

    const result = await tool.handler(validReport, context)

    expect(tool.descriptor.returnDirect).toBe(true)
    expect(tool.descriptor.description).toContain('user\'s system language')
    expect(tool.descriptor.description).toContain('brief user-facing name')
    expect(tool.descriptor.description).toContain('Keep parameter keys and values concise')
    expect(tool.descriptor.description).toContain('current turn')
    expect(tool.descriptor.description).toContain('regenerate')
    expect(tool.descriptor.description).toContain('status=unused')
    expect(result).toEqual({
      content: '## Task report result\n\n- status: accepted',
      isError: false,
    })
  })

  it('returns actionable Markdown for invalid report fields without exposing values', async () => {
    const tool = createTaskReportTool()
    const result = await tool.handler({
      ...validReport,
      params: [{ ...validReport.params[0], value: { nested: true } }],
      windows: [{ ...validReport.windows[0], failureReason: 'unexpected failure' }],
    }, context)

    expect(result.isError).toBe(true)
    expect(result.errorKind).toBe('input_invalid')
    expect(result.content).toContain('## Task report validation failed')
    expect(result.content).toContain('params[0].value')
    expect(result.content).toContain('windows[0].failureReason')
    expect(result.content).toContain('### Expected shape')
    expect(result.content).toContain('params[].key')
    expect(result.content).toContain('params[].name')
    expect(result.content).not.toContain('params[].description')
    expect(result.content).not.toContain('nested')
  })

  it('accepts a report containing only the started window', async () => {
    const tracker = createTaskReportWindowTracker()
    tracker.beginTurn(['profile-1', 'profile-2'])
    tracker.record(['profile-1'])
    const tool = createTaskReportTool({ windowTracker: tracker })

    const result = await tool.handler(validReport, context)

    expect(result).toEqual({
      content: '## Task report result\n\n- status: accepted',
      isError: false,
    })
  })

  it('accepts explicitly unused admitted windows', async () => {
    const tracker = createTaskReportWindowTracker()
    tracker.beginTurn(['profile-1', 'profile-2'])
    tracker.record(['profile-1'])
    const tool = createTaskReportTool({ windowTracker: tracker })

    const result = await tool.handler({
      ...validReport,
      windows: [
        { dirId: 'profile-1', success: true, failureReason: '' },
        { dirId: 'profile-2', success: false, status: 'unused', failureReason: '' },
      ],
    }, context)

    expect(result).toEqual({
      content: '## Task report result\n\n- status: accepted',
      isError: false,
    })
  })

  it('rejects non-unused outcomes for an admitted but unstarted window', async () => {
    const tracker = createTaskReportWindowTracker()
    tracker.beginTurn(['profile-1', 'profile-2'])
    tracker.record(['profile-1'])
    const tool = createTaskReportTool({ windowTracker: tracker })

    const result = await tool.handler({
      ...validReport,
      windows: [
        { dirId: 'profile-1', success: true, failureReason: '' },
        { dirId: 'profile-2', success: false, failureReason: '未启动' },
      ],
    }, context)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('Unused windows must be omitted or use status=unused: profile-2')
  })

  it('rejects an unused status for a started window', async () => {
    const tracker = createTaskReportWindowTracker()
    tracker.beginTurn(['profile-1'])
    tracker.record(['profile-1'])
    const tool = createTaskReportTool({ windowTracker: tracker })

    const result = await tool.handler({
      ...validReport,
      windows: [{ dirId: 'profile-1', success: false, status: 'unused', failureReason: '' }],
    }, context)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('Started windows cannot use status=unused: profile-1')
  })

  it('rejects a report that adds a window outside the report scope', async () => {
    const tracker = createTaskReportWindowTracker()
    tracker.beginTurn(['profile-1'])
    tracker.record(['profile-1'])
    const tool = createTaskReportTool({ windowTracker: tracker })

    const result = await tool.handler({
      ...validReport,
      windows: [
        { dirId: 'profile-1', success: true, failureReason: '' },
        { dirId: 'profile-3', success: false, failureReason: '未执行' },
      ],
    }, context)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('Windows outside the report scope: profile-3')
  })

  it('regenerates a previous report without new profile references or launches', async () => {
    const tracker = createTaskReportWindowTracker()
    tracker.beginTurn(['profile-1', 'never-started'])
    tracker.record(['profile-1'])
    tracker.beginTurn()
    const tool = createTaskReportTool({ windowTracker: tracker })

    expect((await tool.handler(validReport, context)).isError).toBe(false)
    expect((await tool.handler({
      ...validReport,
      windows: [{ dirId: 'never-started', success: false, status: 'unused', failureReason: '' }],
    }, context)).isError).toBe(true)
  })

  it('allows a requested historical subset without requiring all session or current windows', async () => {
    const tracker = createTaskReportWindowTracker()
    tracker.record(['profile-1', 'old-other'])
    tracker.beginTurn(['current'])
    tracker.record(['current'])
    const tool = createTaskReportTool({ windowTracker: tracker })

    expect((await tool.handler(validReport, context)).isError).toBe(false)
  })

  it('accepts a window actually launched without a current profile reference', async () => {
    const tracker = createTaskReportWindowTracker()
    tracker.beginTurn()
    tracker.record(['profile-1'])

    expect((await createTaskReportTool({ windowTracker: tracker }).handler(validReport, context)).isError).toBe(false)
  })
})
