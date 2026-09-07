import { describe, expect, it } from 'vitest'
import { createTaskReportWindowTracker } from './task-report-window-tracker'

describe('task report window tracker', () => {
  it('deduplicates and normalizes admitted and used windows', () => {
    const tracker = createTaskReportWindowTracker()

    tracker.beginTurn([' admitted-1 ', 'admitted-2', 'admitted-1'])
    tracker.record([' dir-1 ', 'dir-2', 'dir-1', ''])

    expect(tracker.snapshot()).toEqual(['dir-1', 'dir-2'])
    expect(tracker.admittedSnapshot()).toEqual(['admitted-1', 'admitted-2'])
  })

  it('clears the previous turn before collecting the next one', () => {
    const tracker = createTaskReportWindowTracker()
    tracker.beginTurn(['dir-1', 'dir-2'])
    tracker.record(['dir-1'])

    tracker.beginTurn(['dir-2'])
    tracker.record(['dir-2'])

    expect(tracker.snapshot()).toEqual(['dir-2'])
    expect(tracker.admittedSnapshot()).toEqual(['dir-2'])
  })

  it('records only windows reported by a successful launch callback', () => {
    const tracker = createTaskReportWindowTracker()
    tracker.beginTurn(['dir-1', 'dir-2', 'dir-3'])
    tracker.record(['dir-1'])

    expect(tracker.snapshot()).toEqual(['dir-1'])
  })
})
