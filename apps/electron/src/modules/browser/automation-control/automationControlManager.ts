export interface BrowserAutomationControlState {
  dirId: string
  executionId: string
  label: string
  targetId?: string
  acquiredAt: number
  overlayVisible: boolean
}

export interface AutomationControlSurfaceAcquireInput {
  dirId: string
  executionId: string
  label: string
  targetId?: string
  replacing: boolean
  previous?: BrowserAutomationControlState
}

export interface AutomationControlSurface {
  acquire: (input: AutomationControlSurfaceAcquireInput) => Promise<{ overlayVisible: boolean }>
  release: (state: BrowserAutomationControlState) => Promise<void>
  dispose: (dirId: string) => Promise<void>
}

export interface AutomationControlAcquireResult extends BrowserAutomationControlState {
  acquired: true
  replaced: boolean
}

export interface AutomationControlReleaseResult {
  dirId: string
  executionId: string
  released: boolean
  overlayVisible?: false
  reason?: 'not_found' | 'not_owner'
}

interface BrowserAutomationControlManagerOptions {
  isBrowserOpen: (dirId: string) => boolean | Promise<boolean>
  surface: AutomationControlSurface
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required`)
  }
  return value.trim()
}

export class BrowserAutomationControlManager {
  private readonly states = new Map<string, BrowserAutomationControlState>()
  private readonly operationTails = new Map<string, Promise<void>>()

  constructor(private readonly options: BrowserAutomationControlManagerOptions) {}

  acquire(input: { dirId: string, executionId: string, label?: string }): Promise<AutomationControlAcquireResult> {
    return this.upsert(input, false)
  }

  sync(input: { dirId: string, executionId: string, targetId: string, label?: string }): Promise<AutomationControlAcquireResult> {
    requiredString(input.targetId, 'targetId')
    return this.upsert(input, true)
  }

  private upsert(
    input: { dirId: string, executionId: string, label?: string, targetId?: string },
    forceSurfaceSync: boolean,
  ): Promise<AutomationControlAcquireResult> {
    const dirId = requiredString(input.dirId, 'dirId')
    const executionId = requiredString(input.executionId, 'executionId')
    const label = input.label === undefined ? 'AI' : requiredString(input.label, 'label')
    const targetId = input.targetId === undefined ? undefined : requiredString(input.targetId, 'targetId')

    return this.runExclusive(dirId, async () => {
      if (!(await this.options.isBrowserOpen(dirId))) {
        throw new Error(`browser window is not open: ${dirId}`)
      }

      const current = this.states.get(dirId)
      const replaced = Boolean(current && current.executionId !== executionId)
      if (!forceSurfaceSync && current?.executionId === executionId && current.label === label) {
        return { ...current, acquired: true, replaced: false }
      }

      const surface = await this.options.surface.acquire({
        dirId,
        executionId,
        label,
        ...(targetId ? { targetId } : {}),
        replacing: replaced,
        ...(current ? { previous: { ...current } } : {}),
      })
      const state: BrowserAutomationControlState = {
        dirId,
        executionId,
        label,
        ...(targetId ? { targetId } : {}),
        acquiredAt: current?.executionId === executionId ? current.acquiredAt : Date.now(),
        overlayVisible: surface.overlayVisible,
      }
      this.states.set(dirId, state)
      return { ...state, acquired: true, replaced }
    })
  }

  release(input: { dirId: string, executionId: string }): Promise<AutomationControlReleaseResult> {
    const dirId = requiredString(input.dirId, 'dirId')
    const executionId = requiredString(input.executionId, 'executionId')

    return this.runExclusive(dirId, async () => {
      const current = this.states.get(dirId)
      if (!current) {
        return { dirId, executionId, released: false, reason: 'not_found' }
      }
      if (current.executionId !== executionId) {
        return { dirId, executionId, released: false, reason: 'not_owner' }
      }

      try {
        await this.options.surface.release(current)
      }
      finally {
        this.states.delete(dirId)
      }
      return { dirId, executionId, released: true, overlayVisible: false }
    })
  }

  handleBrowserClosed(dirId: string): Promise<void> {
    return this.runExclusive(dirId, async () => {
      this.states.delete(dirId)
      await this.options.surface.dispose(dirId)
    })
  }

  getState(dirId: string): BrowserAutomationControlState | undefined {
    const state = this.states.get(dirId)
    return state ? { ...state } : undefined
  }

  private async runExclusive<T>(dirId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.operationTails.get(dirId) ?? Promise.resolve()
    const result = previous.catch(() => {}).then(operation)
    const tail = result.then(
      () => {},
      () => {},
    )
    this.operationTails.set(dirId, tail)
    try {
      return await result
    }
    finally {
      if (this.operationTails.get(dirId) === tail) {
        this.operationTails.delete(dirId)
      }
    }
  }
}
