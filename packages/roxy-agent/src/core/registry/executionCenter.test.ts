import { describe, expect, it, vi } from 'vitest'
import { ExecutionCenter } from './executionCenter'

describe('executionCenter', () => {
  it('tracks independent executions from different sources', () => {
    const center = new ExecutionCenter()
    center.register({ id: 'run-chat', source: 'conversation', conversationId: 'conv-a', title: 'Chat' })
    center.register({ id: 'run-task', source: 'scheduled_task', title: 'Cron task' })

    center.start('run-chat')
    center.setStatus('run-task', 'waiting')

    expect(center.list()).toMatchObject([
      { id: 'run-chat', source: 'conversation', status: 'running' },
      { id: 'run-task', source: 'scheduled_task', status: 'waiting' },
    ])
  })

  it('binds a background execution to its conversation after creation', async () => {
    const center = new ExecutionCenter()
    const cancel = vi.fn(() => true)
    center.register({ id: 'run-task', source: 'scheduled_task', cancel })
    center.start('run-task')

    center.register({
      id: 'run-task',
      source: 'scheduled_task',
      conversationId: 'task-conversation',
    })

    expect(center.get('run-task')?.conversationId).toBe('task-conversation')
    await expect(center.cancelByConversation('task-conversation')).resolves.toBe(1)
  })

  it('cancels through the registered owner and does not invoke it twice', async () => {
    const center = new ExecutionCenter()
    const cancel = vi.fn(() => true)
    center.register({ id: 'run-1', source: 'im', cancel })

    await expect(center.cancel('run-1', 'user')).resolves.toBe(true)
    await expect(center.cancel('run-1', 'user')).resolves.toBe(false)
    expect(cancel).toHaveBeenCalledOnce()
    expect(center.get('run-1')?.status).toBe('cancelling')

    center.finish('run-1', 'cancelled')
    expect(center.get('run-1')?.status).toBe('cancelled')
  })

  it('supports pausing queued work and emits immutable snapshots', () => {
    const center = new ExecutionCenter()
    const snapshots: string[] = []
    const unsubscribe = center.subscribe(snapshot => snapshots.push(snapshot.entries.map(entry => entry.status).join(',')))
    center.register({ id: 'queued', source: 'scheduled_task' })
    expect(center.pause('queued')).toBe(true)
    expect(center.resume('queued')).toBe(true)
    unsubscribe()

    expect(center.get('queued')?.status).toBe('queued')
    expect(snapshots.length).toBeGreaterThanOrEqual(3)
  })

  it('cancels every non-terminal execution during shutdown', async () => {
    const center = new ExecutionCenter()
    const first = vi.fn(() => true)
    const second = vi.fn(() => true)
    center.register({ id: 'a', source: 'conversation', cancel: first })
    center.register({ id: 'b', source: 'worker', cancel: second })
    center.finish('b', 'completed')

    await center.cancelAll('client_shutdown')
    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
    expect(center.get('a')?.status).toBe('cancelling')
  })
})
