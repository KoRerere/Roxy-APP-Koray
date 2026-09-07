import { describe, expect, it, vi } from 'vitest'
import { BrowserAutomationControlManager } from './automationControlManager'

function createManager() {
  const surface = {
    acquire: vi.fn(async () => ({ overlayVisible: false as const })),
    release: vi.fn(async () => {}),
    dispose: vi.fn(async () => {}),
  }
  const manager = new BrowserAutomationControlManager({
    isBrowserOpen: async dirId => dirId !== 'closed',
    surface,
  })
  return { manager, surface }
}

describe('browserAutomationControlManager', () => {
  it('acquires once for duplicate requests and updates a changed label', async () => {
    const { manager, surface } = createManager()

    await expect(manager.acquire({ dirId: ' profile-1 ', executionId: ' run-1 ' })).resolves.toMatchObject({
      acquired: true,
      replaced: false,
      label: 'AI',
      overlayVisible: false,
    })
    await expect(manager.acquire({ dirId: 'profile-1', executionId: 'run-1' })).resolves.toMatchObject({
      acquired: true,
      replaced: false,
    })
    await manager.acquire({ dirId: 'profile-1', executionId: 'run-1', label: 'Agent' })

    expect(surface.acquire).toHaveBeenCalledTimes(2)
    expect(surface.acquire.mock.calls[1]?.[0]).toMatchObject({ label: 'Agent', replacing: false })
  })

  it('replaces an abandoned execution without releasing the current tab group first', async () => {
    const { manager, surface } = createManager()
    await manager.acquire({ dirId: 'profile-1', executionId: 'run-old' })

    await expect(manager.acquire({ dirId: 'profile-1', executionId: 'run-new' })).resolves.toMatchObject({
      acquired: true,
      replaced: true,
      executionId: 'run-new',
    })

    expect(surface.release).not.toHaveBeenCalled()
    expect(surface.acquire.mock.calls[1]?.[0]).toMatchObject({ replacing: true })
  })

  it('reapplies the requested target for every sync, including an unchanged target', async () => {
    const { manager, surface } = createManager()

    await manager.sync({ dirId: 'profile-1', executionId: 'run-1', targetId: 'target-1' })
    await manager.sync({ dirId: 'profile-1', executionId: 'run-1', targetId: 'target-1' })
    await manager.sync({ dirId: 'profile-1', executionId: 'run-1', targetId: 'target-2' })

    expect(surface.acquire).toHaveBeenCalledTimes(3)
    expect(surface.acquire.mock.calls.map(([input]) => input.targetId)).toEqual([
      'target-1',
      'target-1',
      'target-2',
    ])
    expect(manager.getState('profile-1')).toMatchObject({ targetId: 'target-2' })
  })

  it('does not let an old execution release the current owner', async () => {
    const { manager, surface } = createManager()
    await manager.acquire({ dirId: 'profile-1', executionId: 'run-new' })

    await expect(manager.release({ dirId: 'profile-1', executionId: 'run-old' })).resolves.toEqual({
      dirId: 'profile-1',
      executionId: 'run-old',
      released: false,
      reason: 'not_owner',
    })
    expect(surface.release).not.toHaveBeenCalled()
    expect(manager.getState('profile-1')?.executionId).toBe('run-new')
  })

  it('releases idempotently and clears state when a browser closes', async () => {
    const { manager, surface } = createManager()
    await manager.acquire({ dirId: 'profile-1', executionId: 'run-1' })

    await expect(manager.release({ dirId: 'profile-1', executionId: 'run-1' })).resolves.toMatchObject({
      released: true,
      overlayVisible: false,
    })
    await expect(manager.release({ dirId: 'profile-1', executionId: 'run-1' })).resolves.toMatchObject({
      released: false,
      reason: 'not_found',
    })

    await manager.acquire({ dirId: 'profile-2', executionId: 'run-2' })
    await manager.handleBrowserClosed('profile-2')
    expect(manager.getState('profile-2')).toBeUndefined()
    expect(surface.dispose).toHaveBeenCalledWith('profile-2')
  })

  it('rejects closed browsers without storing state', async () => {
    const { manager, surface } = createManager()
    await expect(manager.acquire({ dirId: 'closed', executionId: 'run-1' })).rejects.toThrow(
      'browser window is not open',
    )
    expect(manager.getState('profile-1')).toBeUndefined()
  })
})
