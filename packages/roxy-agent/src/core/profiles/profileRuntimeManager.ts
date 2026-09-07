import type { ProfileLeaseOwner, ProfileLeaseRegistry } from './profileLeaseRegistry'
import type { RuntimeMcpTool } from '@/core/mcp/runtimeMcpTool'
import type { RuntimeFileCollector } from '@/runtime/file-collector'
import { profileLeaseRegistry } from './profileLeaseRegistry'

export type ProfileProtocol = 'cdp' | 'bidi'
export type ProfileBrowserType = 'chromium' | 'firefox'

export interface ProfileConnection {
  dirId: string
  endpoint: string
  protocol: ProfileProtocol
  browserType: ProfileBrowserType
  connectedAt: number
  pid?: number
  windowName?: string
  windowSortNum?: number
}

export interface ProfileConnectionSource {
  get: (dirId: string, browserType?: ProfileBrowserType) => Promise<ProfileConnection | undefined>
  list: () => Promise<ProfileConnection[]>
  open: (dirId: string, browserType?: ProfileBrowserType) => Promise<ProfileConnection>
}

export interface ProfilePlaywrightResource {
  tools: Map<string, RuntimeMcpTool>
  close: () => Promise<void>
  artifactRoot: string
  connection?: ProfileConnection
  cleanupArtifacts?: () => void | Promise<void>
  getActiveTargetId?: () => Promise<string | undefined>
}

export interface ProfileBindingOptions {
  bindingId: string
  executionId: string
  conversationId?: string
  allowedDirIds?: readonly string[]
  collector?: RuntimeFileCollector
  owner?: Omit<ProfileLeaseOwner, 'executionId' | 'conversationId'>
  onBrowserLaunched?: (dirId: string) => void
}

export interface ProfileBinding {
  readonly bindingId: string
  readonly executionId: string
  getActiveDirId: () => string | undefined
  activate: (dirId: string, browserType?: ProfileBrowserType) => Promise<ProfilePlaywrightResource>
  ensureActive: () => Promise<ProfilePlaywrightResource>
  run: <T>(
    operation: (resource: ProfilePlaywrightResource) => Promise<T>,
    options?: { automation?: 'sync-before' | 'sync-before-and-after' },
  ) => Promise<T>
}

interface ResourceRecord extends ProfilePlaywrightResource {
  connection: ProfileConnection
}

export interface ProfileRuntimeManagerOptions {
  connections: ProfileConnectionSource
  createResource: (connection: ProfileConnection) => Promise<ProfilePlaywrightResource>
  leases?: ProfileLeaseRegistry
  onRunning?: (dirId: string, binding: ProfileBindingOptions, connection: ProfileConnection) => void
  onIdle?: (dirId: string) => void
  onRemoved?: (dirId: string) => void
  onAutomationSync?: (dirId: string, executionId: string, targetId: string) => boolean | Promise<boolean>
  onAutomationRelease?: (dirId: string, executionId: string) => void | Promise<void>
}

export class ProfileRuntimeManager {
  private readonly leases: ProfileLeaseRegistry
  private readonly resources = new Map<string, ResourceRecord>()
  private readonly resourceCreations = new Map<string, { endpoint: string, promise: Promise<ResourceRecord> }>()
  private readonly knownConnections = new Map<string, ProfileConnection>()
  private readonly executionArtifactRoots = new Map<string, Set<string>>()
  private readonly retiredResources = new Map<string, ProfilePlaywrightResource>()
  private readonly bindings = new Map<string, ProfileBindingOptions & { activeDirId?: string }>()
  private readonly lastActiveByConversation = new Map<string, string>()
  private readonly automationByBinding = new Map<string, { dirId: string, executionId: string }>()
  private readonly automationBindingsByProfile = new Map<string, Set<string>>()

  constructor(private readonly options: ProfileRuntimeManagerOptions) {
    this.leases = options.leases ?? profileLeaseRegistry
  }

  createBinding(options: ProfileBindingOptions): ProfileBinding {
    const allowed = options.allowedDirIds?.length ? new Set(options.allowedDirIds) : undefined
    const remembered = options.conversationId ? this.lastActiveByConversation.get(options.conversationId) : undefined
    const singleAllowed = allowed?.size === 1 ? [...allowed][0] : undefined
    const binding = {
      ...options,
      activeDirId: remembered && (!allowed || allowed.has(remembered)) ? remembered : singleAllowed,
    }
    this.bindings.set(options.bindingId, binding)

    return {
      bindingId: options.bindingId,
      executionId: options.executionId,
      getActiveDirId: () => binding.activeDirId,
      activate: async (dirId, browserType = 'chromium') => {
        if (allowed && !allowed.has(dirId)) {
          throw new Error(`dirId ${dirId} 不在本次任务授权的窗口范围内。`)
        }
        this.acquire(dirId, options)
        const release = await this.leases.acquireOperation(dirId)
        try {
          const connection = await this.options.connections.get(dirId, browserType)
            ?? await this.options.connections.open(dirId, browserType)
          const resource = await this.ensureResource(connection)
          if (binding.activeDirId && binding.activeDirId !== dirId) {
            await this.releaseBindingAutomation(options.bindingId)
          }
          binding.activeDirId = dirId
          if (options.conversationId) {
            this.lastActiveByConversation.set(options.conversationId, dirId)
          }
          this.registerArtifactRoot(options, resource)
          this.options.onRunning?.(dirId, options, connection)
          return resource
        }
        finally {
          release()
        }
      },
      ensureActive: async () => {
        if (!binding.activeDirId) {
          throw new Error('当前没有已绑定的浏览器，请先调用 roxy_browser_launch。')
        }
        this.acquire(binding.activeDirId, options)
        const connection = await this.options.connections.get(binding.activeDirId)
        if (!connection) {
          await this.invalidate(binding.activeDirId)
          throw new Error(`浏览器 ${binding.activeDirId} 已关闭，请重新打开后再试。`)
        }
        const resource = await this.ensureResource(connection)
        this.registerArtifactRoot(options, resource)
        this.options.onRunning?.(binding.activeDirId, options, connection)
        return resource
      },
      run: async <T>(
        operation: (resource: ProfilePlaywrightResource) => Promise<T>,
        runOptions: { automation?: 'sync-before' | 'sync-before-and-after' } = {},
      ): Promise<T> => {
        const dirId = this.bindings.get(options.bindingId)?.activeDirId
        if (!dirId) {
          throw new Error('当前没有已绑定的浏览器，请先调用 roxy_browser_launch。')
        }
        const release = await this.leases.acquireOperation(dirId)
        try {
          const resource = await this.ensureBindingResource(options.bindingId)
          if (runOptions.automation) {
            await this.syncBindingAutomation(options.bindingId, resource)
          }
          const result = await operation(resource)
          if (runOptions.automation === 'sync-before-and-after') {
            await this.syncBindingAutomation(options.bindingId, resource)
          }
          return result
        }
        finally {
          release()
        }
      },
    }
  }

  async releaseBinding(bindingId: string): Promise<void> {
    await this.releaseBindingAutomation(bindingId)
    this.bindings.delete(bindingId)
  }

  forgetConversation(conversationId: string): void {
    this.lastActiveByConversation.delete(conversationId)
  }

  async listConnections(): Promise<ProfileConnection[]> {
    return this.options.connections.list()
  }

  async reconcileConnections(connections: readonly ProfileConnection[]): Promise<void> {
    const current = new Map(connections.map(connection => [connection.dirId, connection]))
    for (const dirId of [...this.knownConnections.keys()]) {
      if (!current.has(dirId)) {
        await this.invalidate(dirId)
      }
    }
    for (const [dirId, connection] of current) {
      const previous = this.knownConnections.get(dirId)
      const pending = this.resourceCreations.get(dirId)
      if (pending && pending.endpoint !== connection.endpoint) {
        await pending.promise.catch(() => {})
        await this.disconnectResource(dirId)
      }
      if (previous && (previous.endpoint !== connection.endpoint || previous.protocol !== connection.protocol)) {
        await this.disconnectResource(dirId)
      }
      this.knownConnections.set(dirId, connection)
      const resource = this.resources.get(dirId)
      if (!resource) {
        continue
      }
      if (resource.connection.endpoint !== connection.endpoint || resource.connection.protocol !== connection.protocol) {
        await this.disconnectResource(dirId)
      }
    }
  }

  async findConnectionByEndpoint(endpoint: string): Promise<ProfileConnection | undefined> {
    const normalized = normalizeEndpoint(endpoint)
    const matches = (await this.options.connections.list())
      .filter(connection => normalizeEndpoint(connection.endpoint) === normalized)
    return matches.length === 1 ? matches[0] : undefined
  }

  async releaseExecution(executionId: string): Promise<string[]> {
    const automationBindings = [...this.automationByBinding]
      .filter(([, state]) => state.executionId === executionId)
      .map(([bindingId]) => bindingId)
    await Promise.allSettled(automationBindings.map(bindingId => this.releaseBindingAutomation(bindingId)))
    const dirIds = this.leases.release(executionId)

    let open: Set<string> | undefined
    try {
      open = new Set((await this.options.connections.list()).map(item => item.dirId))
    }
    catch (error) {
      console.warn('[profiles] Failed to reconcile released profiles:', error instanceof Error ? error.message : String(error))
    }
    for (const dirId of dirIds) {
      if (!open || open.has(dirId)) {
        this.options.onIdle?.(dirId)
      }
      else {
        await this.invalidate(dirId)
      }
    }
    this.executionArtifactRoots.delete(executionId)
    await this.sweepRetiredResources()
    return dirIds
  }

  async invalidate(dirId: string): Promise<void> {
    const pending = this.resourceCreations.get(dirId)
    if (pending) {
      await pending.promise.catch(() => {})
    }
    const resource = this.resources.get(dirId)
    this.resources.delete(dirId)
    this.knownConnections.delete(dirId)
    this.clearProfileAutomation(dirId)
    this.leases.releaseProfile(dirId)
    for (const binding of this.bindings.values()) {
      if (binding.activeDirId === dirId) {
        binding.activeDirId = undefined
      }
    }
    for (const [conversationId, activeDirId] of this.lastActiveByConversation) {
      if (activeDirId === dirId) {
        this.lastActiveByConversation.delete(conversationId)
      }
    }
    if (resource) {
      await this.retireResource(resource)
    }
    this.options.onRemoved?.(dirId)
  }

  async disconnectResource(dirId: string): Promise<void> {
    const pending = this.resourceCreations.get(dirId)
    if (pending) {
      await pending.promise.catch(() => {})
    }
    const resource = this.resources.get(dirId)
    this.resources.delete(dirId)
    if (resource) {
      await this.retireResource(resource)
    }
  }

  async shutdown(): Promise<void> {
    await Promise.allSettled([...this.resourceCreations.values()].map(item => item.promise))
    const resources = [...this.resources.values()]
    this.resources.clear()
    this.resourceCreations.clear()
    this.knownConnections.clear()
    this.executionArtifactRoots.clear()
    this.leases.clear()
    this.bindings.clear()
    this.lastActiveByConversation.clear()
    this.automationByBinding.clear()
    this.automationBindingsByProfile.clear()
    await Promise.all(resources.map(resource => resource.close().catch(() => {})))
    const cleanupByRoot = new Map<string, ProfilePlaywrightResource>()
    for (const resource of [...resources, ...this.retiredResources.values()]) {
      cleanupByRoot.set(resource.artifactRoot, resource)
    }
    await Promise.all([...cleanupByRoot.values()].map(async (resource) => {
      await resource.cleanupArtifacts?.()
    }))
    this.retiredResources.clear()
  }

  private acquire(dirId: string, owner: ProfileBindingOptions): void {
    this.leases.acquire({
      executionId: owner.executionId,
      ...(owner.conversationId ? { conversationId: owner.conversationId } : {}),
      ...owner.owner,
    }, [dirId])
  }

  private async ensureBindingResource(bindingId: string): Promise<ResourceRecord> {
    const binding = this.bindings.get(bindingId)
    if (!binding?.activeDirId) {
      throw new Error('当前没有已绑定的浏览器，请先调用 roxy_browser_launch。')
    }
    this.acquire(binding.activeDirId, binding)
    const connection = await this.options.connections.get(binding.activeDirId)
    if (!connection) {
      await this.invalidate(binding.activeDirId)
      throw new Error(`浏览器 ${binding.activeDirId} 已关闭，请重新打开后再试。`)
    }
    const resource = await this.ensureResource(connection)
    this.registerArtifactRoot(binding, resource)
    this.options.onRunning?.(binding.activeDirId, binding, connection)
    return resource
  }

  private async ensureResource(connection: ProfileConnection): Promise<ResourceRecord> {
    this.knownConnections.set(connection.dirId, connection)
    const existing = this.resources.get(connection.dirId)
    if (existing?.connection.endpoint === connection.endpoint && existing.connection.protocol === connection.protocol) {
      existing.connection = connection
      return existing
    }
    if (existing) {
      this.resources.delete(connection.dirId)
      await this.retireResource(existing)
    }
    const pending = this.resourceCreations.get(connection.dirId)
    if (pending) {
      if (pending.endpoint === connection.endpoint) {
        return pending.promise
      }
      await pending.promise.catch(() => {})
      return this.ensureResource(connection)
    }
    const promise = this.options.createResource(connection).then((created) => {
      const record: ResourceRecord = { ...created, connection }
      this.resources.set(connection.dirId, record)
      return record
    }).finally(() => {
      if (this.resourceCreations.get(connection.dirId)?.promise === promise) {
        this.resourceCreations.delete(connection.dirId)
      }
    })
    this.resourceCreations.set(connection.dirId, { endpoint: connection.endpoint, promise })
    return promise
  }

  private async syncBindingAutomation(bindingId: string, resource: ProfilePlaywrightResource): Promise<boolean> {
    const binding = this.bindings.get(bindingId)
    const dirId = binding?.activeDirId
    if (!binding || !dirId || !resource.getActiveTargetId) {
      return false
    }
    const targetId = await resource.getActiveTargetId()
    if (!targetId) {
      return false
    }
    const current = this.automationByBinding.get(bindingId)
    if (current && (current.dirId !== dirId || current.executionId !== binding.executionId)) {
      await this.releaseBindingAutomation(bindingId)
    }
    const synced = await this.options.onAutomationSync?.(dirId, binding.executionId, targetId)
    if (!synced) {
      return false
    }
    this.automationByBinding.set(bindingId, { dirId, executionId: binding.executionId })
    let bindings = this.automationBindingsByProfile.get(dirId)
    if (!bindings) {
      bindings = new Set()
      this.automationBindingsByProfile.set(dirId, bindings)
    }
    bindings.add(bindingId)
    return true
  }

  private async releaseBindingAutomation(bindingId: string): Promise<void> {
    const state = this.automationByBinding.get(bindingId)
    if (!state) {
      return
    }
    this.automationByBinding.delete(bindingId)
    const bindings = this.automationBindingsByProfile.get(state.dirId)
    bindings?.delete(bindingId)
    if (bindings?.size) {
      return
    }
    this.automationBindingsByProfile.delete(state.dirId)
    await this.options.onAutomationRelease?.(state.dirId, state.executionId)
  }

  private clearProfileAutomation(dirId: string): void {
    const bindings = this.automationBindingsByProfile.get(dirId)
    if (!bindings) {
      return
    }
    for (const bindingId of bindings) {
      this.automationByBinding.delete(bindingId)
    }
    this.automationBindingsByProfile.delete(dirId)
  }

  private registerArtifactRoot(binding: ProfileBindingOptions, resource: ProfilePlaywrightResource): void {
    binding.collector?.addArtifactRoot(resource.artifactRoot, `profiles/${resource.connection?.dirId ?? 'browser'}`)
    let roots = this.executionArtifactRoots.get(binding.executionId)
    if (!roots) {
      roots = new Set()
      this.executionArtifactRoots.set(binding.executionId, roots)
    }
    roots.add(resource.artifactRoot)
  }

  private async retireResource(resource: ProfilePlaywrightResource): Promise<void> {
    await resource.close().catch(() => {})
    const referenced = [...this.executionArtifactRoots.values()].some(roots => roots.has(resource.artifactRoot))
    if (referenced) {
      this.retiredResources.set(resource.artifactRoot, resource)
    }
    else {
      await resource.cleanupArtifacts?.()
    }
  }

  private async sweepRetiredResources(): Promise<void> {
    for (const [artifactRoot, resource] of [...this.retiredResources]) {
      const referenced = [...this.executionArtifactRoots.values()].some(roots => roots.has(artifactRoot))
      if (referenced) {
        continue
      }
      this.retiredResources.delete(artifactRoot)
      await resource.cleanupArtifacts?.()
    }
  }
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/$/, '')
}
