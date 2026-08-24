import type { RuntimeMcpTool } from './runtimeMcpTool'
import type { ProfileBinding, ProfileBindingOptions, ProfileConnection, ProfilePlaywrightResource } from '@/core/profiles/profileRuntimeManager'
import type { CreateRoxyBrowserMcpServerOptions, RoxyBrowserLaunchConfig } from '@roxybrowser/playwright/mcp'
import type { ToolDescriptor, ToolHandler, ToolResult } from 'roxy-agent-runtime'
import { createRoxyBrowserMcpInMemory } from '@roxybrowser/playwright/mcp'
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { mcpToolName } from 'roxy-agent-runtime'
import { env } from '@/config'
import { RoxyProfileConnectionSource } from '@/core/profiles/profileConnections'
import { ProfileRuntimeManager } from '@/core/profiles/profileRuntimeManager'
import { agentPaths } from '@/core/storage/agentPaths'
import { profileMonitorHub } from '@/core/task-monitor'
import { createRuntimeMcpToolBundle } from './runtimeMcpTool'

export interface CloseableMcpClient {
  close: () => Promise<void>
}

interface PlaywrightMcpClientBundle {
  client: CloseableMcpClient
  tools: RuntimeMcpTool[]
}

interface BindingRecord {
  binding: ProfileBinding
  tools: RuntimeMcpTool[]
  allowedDirIds: string[]
}

export interface CreateProfileBindingOptions extends ProfileBindingOptions {}

export function playwrightMcpServerName(bindingId: string): string {
  return `roxybrowser_playwright_${bindingId}`
}

function createRoxyBrowserLaunchConfig(): RoxyBrowserLaunchConfig | undefined {
  const workspaceId = Number(env.ROXY_WORKSPACE_ID)
  if (!Number.isFinite(workspaceId) || !env.ROXY_API_KEY || !env.ROXY_API_HOST) {
    console.warn('[MCP] roxy_browser_launch disabled: missing ROXY_WORKSPACE_ID, ROXY_API_KEY, or ROXY_API_HOST')
    return undefined
  }

  try {
    const apiUrl = new URL(env.ROXY_API_HOST)
    return {
      workspaceId,
      apiToken: env.ROXY_API_KEY,
      host: apiUrl.hostname,
      apiPort: apiUrl.port || (apiUrl.protocol === 'https:' ? 443 : 80),
    }
  }
  catch (err: any) {
    console.warn('[MCP] roxy_browser_launch disabled: invalid ROXY_API_HOST:', err.message)
    return undefined
  }
}

function serverOptions(serverName: string, artifactRoot: string): CreateRoxyBrowserMcpServerOptions {
  const artifactsDir = path.join(artifactRoot, 'browser')
  const downloadsDir = path.join(artifactsDir, 'downloads')
  const screenshotsDir = path.join(artifactsDir, 'screenshots')
  const snapshotsDir = path.join(artifactsDir, 'snapshots')
  const tracesDir = path.join(artifactsDir, 'traces')
  for (const dir of [artifactsDir, downloadsDir, screenshotsDir, snapshotsDir, tracesDir]) {
    mkdirSync(dir, { recursive: true })
  }
  return {
    artifactsDir,
    downloadsDir,
    screenshotsDir,
    snapshotsDir,
    tracesDir,
    videosDir: tracesDir,
    tempDir: snapshotsDir,
    serverInfo: { name: serverName, version: '1.0.0' },
    roxyBrowserLaunch: createRoxyBrowserLaunchConfig(),
  } as CreateRoxyBrowserMcpServerOptions & { roxyBrowserLaunch?: RoxyBrowserLaunchConfig }
}

async function createInProcessPlaywrightMcpClient(
  serverName: string,
  options: CreateRoxyBrowserMcpServerOptions,
): Promise<PlaywrightMcpClientBundle> {
  const inMemoryBundle = await createRoxyBrowserMcpInMemory(options)
  try {
    const bundle = await createRuntimeMcpToolBundle(serverName, inMemoryBundle.clientTransport)
    return {
      client: {
        close: async () => bundle.client.disconnect().finally(() => inMemoryBundle.close()),
      },
      tools: bundle.tools,
    }
  }
  catch (err) {
    await inMemoryBundle.close().catch(() => {})
    throw err
  }
}

function originalToolName(name: string): string {
  const marker = name.lastIndexOf('__')
  return marker >= 0 ? name.slice(marker + 2) : name
}

function inputRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {}
}

function launchResult(connection: ProfileConnection, toolUseId: string): ToolResult {
  const payload = {
    browsers: [{
      dirId: connection.dirId,
      endpoint: connection.endpoint,
      connected: true,
      browserType: connection.browserType === 'firefox' ? 'firefox' : 'chrome',
    }],
  }
  return { content: JSON.stringify(payload, null, 2), isError: false, toolUseId }
}

export class PlaywrightMcpManager {
  private readonly bindings = new Map<string, BindingRecord>()
  private readonly runtime: ProfileRuntimeManager
  private descriptorTemplates?: Promise<ToolDescriptor[]>

  constructor(options: {
    runtime?: ProfileRuntimeManager
  } = {}) {
    this.runtime = options.runtime ?? new ProfileRuntimeManager({
      connections: new RoxyProfileConnectionSource(),
      createResource: connection => this.createProfileResource(connection),
      onRunning: (dirId, binding, connection) => {
        const taskId = binding.owner?.taskId
        if (!taskId) {
          return
        }
        profileMonitorHub.attachBrowser({
          taskId,
          browserId: `${binding.bindingId}:${dirId}`,
          dirId,
          label: connection.windowName ?? dirId,
          ws: connection.endpoint,
          browserType: connection.browserType,
          workerId: binding.bindingId,
          conversationId: binding.conversationId,
        })
      },
      onIdle: dirId => profileMonitorHub.markIdle(dirId),
      onRemoved: dirId => profileMonitorHub.removeProfile(dirId),
    })
  }

  get count(): number {
    return this.bindings.size
  }

  async checkReadiness(): Promise<{ ready: boolean, reason?: string }> {
    return typeof createRoxyBrowserMcpInMemory === 'function'
      ? { ready: true }
      : { ready: false, reason: '@roxybrowser/playwright/mcp createRoxyBrowserMcpInMemory is unavailable' }
  }

  async createProfileBinding(options: CreateProfileBindingOptions): Promise<void> {
    if (this.bindings.has(options.bindingId)) {
      return
    }
    const binding = this.runtime.createBinding(options)
    const descriptors = await this.getDescriptorTemplates()
    const serverName = playwrightMcpServerName(options.bindingId)
    const tools = descriptors.map((descriptor): RuntimeMcpTool => {
      const rawName = originalToolName(descriptor.name)
      return {
        descriptor: { ...descriptor, name: mcpToolName(serverName, rawName) },
        handler: this.createFacadeHandler(binding, rawName),
      }
    })
    this.bindings.set(options.bindingId, {
      binding,
      tools,
      allowedDirIds: [...(options.allowedDirIds ?? [])],
    })
  }

  getBindingTools(bindingId: string): RuntimeMcpTool[] {
    return this.bindings.get(bindingId)?.tools ?? []
  }

  getAllowedDirIds(bindingId: string): string[] {
    return [...(this.bindings.get(bindingId)?.allowedDirIds ?? [])]
  }

  releaseProfileBinding(bindingId: string): void {
    this.runtime.releaseBinding(bindingId)
    this.bindings.delete(bindingId)
  }

  forgetConversation(conversationId: string): void {
    this.runtime.forgetConversation(conversationId)
  }

  releaseExecution(executionId: string): Promise<string[]> {
    return this.runtime.releaseExecution(executionId)
  }

  invalidateProfile(dirId: string): Promise<void> {
    return this.runtime.invalidate(dirId)
  }

  listConnections(): Promise<ProfileConnection[]> {
    return this.runtime.listConnections()
  }

  reconcileConnections(connections: readonly ProfileConnection[]): Promise<void> {
    return this.runtime.reconcileConnections(connections)
  }

  async shutdown(): Promise<void> {
    this.bindings.clear()
    await this.runtime.shutdown()
  }

  private createFacadeHandler(binding: ProfileBinding, rawName: string): ToolHandler {
    if (rawName === 'roxy_browser_launch') {
      return async (input, ctx) => {
        const record = inputRecord(input)
        const dirId = typeof record.dirId === 'string' ? record.dirId : ''
        if (!dirId) {
          throw new Error('roxy_browser_launch requires dirId')
        }
        const browserType = record.browser === 'firefox' ? 'firefox' : 'chromium'
        const resource = await binding.activate(dirId, browserType)
        const connection = resource.connection
        if (!connection) {
          throw new Error(`Browser ${dirId} did not provide a usable connection.`)
        }
        return launchResult(connection, ctx.toolUseId ?? 'roxy_browser_launch')
      }
    }
    if (rawName === 'browser_close') {
      return async (input, ctx) => {
        const dirId = binding.getActiveDirId()
        const result = await binding.run(async (resource) => {
          const tool = resource.tools.get(rawName)
          if (!tool) {
            throw new Error(`Playwright profile resource does not expose ${rawName}`)
          }
          return tool.handler(input, ctx)
        })
        if (dirId) {
          await this.runtime.disconnectResource(dirId)
        }
        return result
      }
    }
    if (rawName === 'roxy_browser_connect') {
      return async (input, ctx) => {
        const record = inputRecord(input)
        const endpoint = typeof record.endpoint === 'string' ? record.endpoint : ''
        if (!endpoint) {
          throw new Error('roxy_browser_connect requires endpoint')
        }
        const connection = await this.runtime.findConnectionByEndpoint(endpoint)
        if (!connection) {
          throw new Error('Unable to uniquely match the endpoint to an open RoxyBrowser profile; connections outside profile management are not allowed.')
        }
        await binding.activate(connection.dirId, connection.browserType)
        return launchResult(connection, ctx.toolUseId ?? 'roxy_browser_connect')
      }
    }
    return async (input, ctx) => binding.run(async (resource) => {
      const tool = resource.tools.get(rawName)
      if (!tool) {
        throw new Error(`Playwright profile resource does not expose ${rawName}`)
      }
      return tool.handler(input, ctx)
    })
  }

  private async getDescriptorTemplates(): Promise<ToolDescriptor[]> {
    if (!this.descriptorTemplates) {
      this.descriptorTemplates = (async () => {
        const artifactRoot = path.join(agentPaths.tmpDir, 'playwright-profiles', '_descriptor-template')
        const bundle = await createInProcessPlaywrightMcpClient(
          'roxybrowser_playwright_template',
          serverOptions('roxybrowser_playwright_template', artifactRoot),
        )
        try {
          return bundle.tools.map(tool => ({ ...tool.descriptor }))
        }
        finally {
          await bundle.client.close().catch(() => {})
          rmSync(artifactRoot, { recursive: true, force: true })
        }
      })()
    }
    return this.descriptorTemplates
  }

  private async createProfileResource(connection: ProfileConnection): Promise<ProfilePlaywrightResource> {
    const generation = createHash('sha256')
      .update(connection.endpoint)
      .update('\0')
      .update(connection.protocol)
      .digest('hex')
      .slice(0, 16)
    const artifactRoot = path.join(agentPaths.tmpDir, 'playwright-profiles', connection.dirId, generation)
    const serverName = `roxybrowser_playwright_profile_${generation}`
    const bundle = await createInProcessPlaywrightMcpClient(serverName, serverOptions(serverName, artifactRoot))
    const tools = new Map(bundle.tools.map(tool => [originalToolName(tool.descriptor.name), tool]))
    const connect = tools.get('roxy_browser_connect')
    if (!connect) {
      await bundle.client.close().catch(() => {})
      throw new Error('Playwright MCP does not expose roxy_browser_connect')
    }
    try {
      await connect.handler({
        endpoint: connection.endpoint,
        browser: connection.browserType === 'firefox' ? 'firefox' : 'chrome',
      }, {
        toolUseId: `profile-connect-${connection.dirId}-${generation}`,
      } as Parameters<ToolHandler>[1])
    }
    catch (error) {
      await bundle.client.close().catch(() => {})
      throw error
    }
    return {
      tools,
      artifactRoot: path.join(artifactRoot, 'browser'),
      connection,
      close: () => bundle.client.close(),
      cleanupArtifacts: () => rmSync(artifactRoot, { recursive: true, force: true }),
    }
  }

  /** @deprecated Transitional worker API. */
  createClientForWorker(workerId: string, sessionId: string, _options: { ephemeral?: boolean } = {}): Promise<void> {
    return this.createProfileBinding({ bindingId: workerId, executionId: workerId, conversationId: sessionId })
  }

  /** @deprecated Transitional worker API. */
  destroyClientForWorker(workerId: string): Promise<void> {
    this.releaseProfileBinding(workerId)
    return Promise.resolve()
  }

  /** @deprecated Transitional worker API. */
  getToolsForWorker(workerId: string): RuntimeMcpTool[] {
    return this.getBindingTools(workerId)
  }

  /** @deprecated Transitional worker API. */
  setAllowedDirIds(workerId: string, dirIds: string[]): void {
    const existing = this.bindings.get(workerId)
    if (existing) {
      existing.allowedDirIds = [...dirIds]
    }
  }

  clearAllowedDirIds(workerId: string): void {
    const existing = this.bindings.get(workerId)
    if (existing) {
      existing.allowedDirIds = []
    }
  }

  /** Test-only compatibility. Profile artifacts are created lazily on first activation. */
  getArtifactDir(_workerId: string): string | undefined {
    return undefined
  }
}
