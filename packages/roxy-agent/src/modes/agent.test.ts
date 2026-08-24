import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runAgentMode } from './agent'

const mocks = vi.hoisted(() => ({
  abortAll: vi.fn(),
  closeConversationsDatabase: vi.fn(),
  closeTasksDatabase: vi.fn(),
  installConversationRunStatePersistence: vi.fn(),
  installProcessFaultGuards: vi.fn(),
  initializeConversationsDatabase: vi.fn(),
  initializeTasksDatabase: vi.fn(),
  markExited: vi.fn(),
  markStarted: vi.fn(),
  mcpManagerShutdown: vi.fn(),
  recoverInterruptedConversationRuns: vi.fn(),
  startIMServiceIfEnabled: vi.fn(),
  startServer: vi.fn(),
  stopIMService: vi.fn(),
  uninstallProcessFaultGuards: vi.fn(),
  stopRunStatePersistence: vi.fn(),
  stopServer: vi.fn(),
  taskLogStoreRecoverInterrupted: vi.fn(),
  taskSchedulerStart: vi.fn(),
  taskSchedulerStop: vi.fn(),
}))

vi.mock('@/core/agent-events/conversationRunState', () => ({
  installConversationRunStatePersistence: mocks.installConversationRunStatePersistence,
  recoverInterruptedConversationRuns: mocks.recoverInterruptedConversationRuns,
}))

vi.mock('@/core/exitState', () => ({
  markExited: mocks.markExited,
  markStarted: mocks.markStarted,
}))

vi.mock('@/core/processFaultGuard', () => ({
  installProcessFaultGuards: mocks.installProcessFaultGuards,
}))

vi.mock('@/core/registry/abortRegistry', () => ({
  abortAll: mocks.abortAll,
}))

vi.mock('@/core/mcp/mcpManager', () => ({
  mcpManager: {
    shutdown: mocks.mcpManagerShutdown,
  },
}))

vi.mock('@/database/tasks', () => ({
  closeTasksDatabase: mocks.closeTasksDatabase,
  initializeTasksDatabase: mocks.initializeTasksDatabase,
  taskLogStore: {
    recoverInterrupted: mocks.taskLogStoreRecoverInterrupted,
  },
}))

vi.mock('@/tasks/scheduler', () => ({
  taskScheduler: {
    start: mocks.taskSchedulerStart,
    stop: mocks.taskSchedulerStop,
  },
}))

vi.mock('../app', () => ({
  startServer: mocks.startServer,
  stopServer: mocks.stopServer,
}))

vi.mock('../database/conversations', () => ({
  closeDatabase: mocks.closeConversationsDatabase,
  initializeDatabase: mocks.initializeConversationsDatabase,
}))

vi.mock('../im', () => ({
  startIMServiceIfEnabled: mocks.startIMServiceIfEnabled,
  stopIMService: mocks.stopIMService,
}))

describe('agent mode exit state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.installConversationRunStatePersistence.mockReturnValue(mocks.stopRunStatePersistence)
    mocks.installProcessFaultGuards.mockReturnValue(mocks.uninstallProcessFaultGuards)
    mocks.recoverInterruptedConversationRuns.mockReturnValue(0)
    mocks.taskLogStoreRecoverInterrupted.mockReturnValue(0)
    mocks.startServer.mockResolvedValue(undefined)
    mocks.startIMServiceIfEnabled.mockResolvedValue(undefined)
    mocks.taskSchedulerStart.mockResolvedValue(undefined)
    mocks.taskSchedulerStop.mockResolvedValue(undefined)
    mocks.stopServer.mockResolvedValue(undefined)
    mocks.stopIMService.mockResolvedValue(undefined)
    mocks.mcpManagerShutdown.mockResolvedValue(undefined)
    mocks.initializeConversationsDatabase.mockImplementation(() => {})
    mocks.initializeTasksDatabase.mockImplementation(() => {})
  })

  it('writes the clean exit state only after shutdown resources close', async () => {
    const shutdown = await runAgentMode()

    expect(mocks.initializeConversationsDatabase).toHaveBeenCalledOnce()
    expect(mocks.initializeTasksDatabase).toHaveBeenCalledOnce()
    expect(mocks.markStarted).toHaveBeenCalledOnce()
    expect(mocks.installProcessFaultGuards).toHaveBeenCalledWith({ label: 'agent' })
    expect(mocks.markExited).not.toHaveBeenCalled()

    await shutdown()

    expect(mocks.mcpManagerShutdown).toHaveBeenCalledOnce()
    expect(mocks.uninstallProcessFaultGuards).toHaveBeenCalledOnce()
    expect(mocks.markExited).toHaveBeenCalledOnce()
    expect(mocks.markExited.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.closeTasksDatabase.mock.invocationCallOrder[0]!,
    )
  })

  it('keeps the running state when startup fails', async () => {
    mocks.startServer.mockRejectedValue(new Error('listen failed'))

    await expect(runAgentMode()).rejects.toThrow('listen failed')

    expect(mocks.markStarted).toHaveBeenCalledOnce()
    expect(mocks.uninstallProcessFaultGuards).toHaveBeenCalledOnce()
    expect(mocks.markExited).not.toHaveBeenCalled()
  })
})
