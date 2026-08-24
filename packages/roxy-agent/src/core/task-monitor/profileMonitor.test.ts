import { describe, expect, it, vi } from 'vitest'
import { profileMonitor } from './profileMonitor'

const mocks = vi.hoisted(() => ({
  attach: vi.fn(),
  event: vi.fn(),
  finish: vi.fn(),
}))

vi.mock('./transport', () => ({
  publishTaskMonitorBrowserAttached: mocks.attach,
  publishTaskMonitorBrowserEvent: mocks.event,
  publishTaskMonitorBrowserFinished: mocks.finish,
}))

describe('profileMonitor', () => {
  it('bridges profile lifecycle operations to the frontend monitor transport', () => {
    const attach = { taskId: 'task-1', browserId: 'profile-1', dirId: 'profile-1' }
    const event = { taskId: 'task-1', browserId: 'profile-1', dirId: 'profile-1', stage: 'start' as const, toolName: 'browser_snapshot', success: true }
    const finish = { taskId: 'task-1', browserId: 'profile-1', dirId: 'profile-1' }

    profileMonitor.attach(attach)
    profileMonitor.event(event)
    profileMonitor.finish(finish)

    expect(mocks.attach).toHaveBeenCalledWith(attach)
    expect(mocks.event).toHaveBeenCalledWith(event)
    expect(mocks.finish).toHaveBeenCalledWith(finish)
  })
})
