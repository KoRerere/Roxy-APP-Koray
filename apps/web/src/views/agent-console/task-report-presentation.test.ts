import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import type { AgentProcessEvent } from './types'
import { shouldCollapseProcessBeforeTaskReport } from './task-report-presentation'

const reportEvent: AgentProcessEvent = {
  id: 'report-1',
  type: 'task_report',
  sourceReportId: 'tool-report-1',
  report: {
    taskName: '批量养号',
    params: [],
    windows: [{ dirId: 'window-1', success: true, failureReason: '' }],
  },
}

describe('shouldCollapseProcessBeforeTaskReport', () => {
  it('collapses prior work when a completed turn ends with a task report', () => {
    assert.equal(shouldCollapseProcessBeforeTaskReport([
      { id: 'tool-1', type: 'tool_call', toolName: 'browser_navigate' },
      reportEvent,
    ], 'done'), true)
  })

  it('keeps the process open while the report tool or turn is still running', () => {
    assert.equal(shouldCollapseProcessBeforeTaskReport([reportEvent], 'streaming'), false)
  })

  it('does not force collapse when content follows the report', () => {
    assert.equal(shouldCollapseProcessBeforeTaskReport([
      reportEvent,
      { id: 'answer-1', type: 'final_answer', content: '继续输出的信息' },
    ], 'done'), false)
  })
})
