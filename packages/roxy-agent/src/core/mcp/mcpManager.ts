/**
 * MCP facade.
 *
 * Playwright MCP and user-configured MCP have different lifecycles and are
 * implemented in separate managers. This class only combines their tools with
 * the global built-in MCP tools and preserves the existing public API.
 */

import type { CreateProfileBindingOptions } from './playwrightMcp'
import type { RuntimeMcpTool } from './runtimeMcpTool'
import type { McpTestResult, UserMcpEntry, UserMcpServerConfig } from './userMcp'
import type { ProfileConnection } from '@/core/profiles/profileRuntimeManager'
import type { McpServerConfig } from 'roxy-agent-runtime'
import path from 'node:path'
import { profileLeaseRegistry } from '@/core/profiles/profileLeaseRegistry'
import { extractDirIds, withWindowScopeGuard } from '@/core/profiles/profileScheduler'
import { agentPaths } from '@/core/storage/agentPaths'
import { getGlobalMcpTools } from './globalMcpClients'
import {
  PlaywrightMcpManager,
} from './playwrightMcp'
import {
  UserMcpManager,
} from './userMcp'

export type { McpTestResult, UserMcpEntry, UserMcpServerConfig } from './userMcp'

const SERIAL_OPENAPI_PROFILE_TOOLS = [
  'roxy_profile_open',
  'roxy_profile_close',
]

function withProfileOperationQueue(tool: RuntimeMcpTool): RuntimeMcpTool {
  const matches = SERIAL_OPENAPI_PROFILE_TOOLS.some(name =>
    tool.descriptor.name === name || tool.descriptor.name.endsWith(`__${name}`))
  if (!matches) {
    return tool
  }
  return {
    ...tool,
    handler: async (input, ctx) => {
      const dirIds = [...new Set(extractDirIds(input))].sort()
      const releases: Array<() => void> = []
      try {
        for (const dirId of dirIds) {
          releases.push(await profileLeaseRegistry.acquireOperation(dirId))
        }
        return await tool.handler(input, ctx)
      }
      finally {
        releases.reverse().forEach(release => release())
      }
    },
  }
}

export class McpManager {
  readonly playwright = new PlaywrightMcpManager()
  readonly user = new UserMcpManager({
    serversFilePath: agentPaths.mcpServersFile,
    stateFilePath: path.join(path.dirname(agentPaths.mcpServersFile), 'state.json'),
  })

  get count(): number {
    return this.playwright.count
  }

  async checkPlaywrightMcpReadiness(): Promise<{ ready: boolean, reason?: string }> {
    return this.playwright.checkReadiness()
  }

  async createPlaywrightClientForWorker(
    workerId: string,
    sessionId: string,
    options: { ephemeral?: boolean } = {},
  ): Promise<void> {
    return this.playwright.createClientForWorker(workerId, sessionId, options)
  }

  async createProfileBinding(options: CreateProfileBindingOptions): Promise<void> {
    return this.playwright.createProfileBinding(options)
  }

  releaseProfileBinding(bindingId: string): void {
    this.playwright.releaseProfileBinding(bindingId)
  }

  forgetConversation(conversationId: string): void {
    this.playwright.forgetConversation(conversationId)
  }

  releaseExecution(executionId: string): Promise<string[]> {
    return this.playwright.releaseExecution(executionId)
  }

  invalidateProfile(dirId: string): Promise<void> {
    return this.playwright.invalidateProfile(dirId)
  }

  listOpenProfiles(): Promise<ProfileConnection[]> {
    return this.playwright.listConnections()
  }

  reconcileOpenProfiles(connections: readonly ProfileConnection[]): Promise<void> {
    return this.playwright.reconcileConnections(connections)
  }

  async destroyPlaywrightClientForWorker(workerId: string): Promise<void> {
    return this.playwright.destroyClientForWorker(workerId)
  }

  async getToolsForWorker(
    workerId: string,
    needPlaywright = true,
    options: { includeFaq?: boolean } = {},
  ): Promise<RuntimeMcpTool[]> {
    const globalTools = await getGlobalMcpTools(options)
    const playwrightTools = needPlaywright ? this.playwright.getToolsForWorker(workerId) : []
    const userTools = this.user.getEnabledTools()
    return [...globalTools.map(withProfileOperationQueue), ...playwrightTools, ...userTools]
      .map(tool => withWindowScopeGuard(tool, () => new Set(this.playwright.getAllowedDirIds(workerId))))
  }

  async getToolsForBinding(
    bindingId: string,
    needPlaywright = true,
    options: { includeFaq?: boolean } = {},
  ): Promise<RuntimeMcpTool[]> {
    const globalTools = await getGlobalMcpTools(options)
    const playwrightTools = needPlaywright ? this.playwright.getBindingTools(bindingId) : []
    const userTools = this.user.getEnabledTools()
    return [...globalTools.map(withProfileOperationQueue), ...playwrightTools, ...userTools]
      .map(tool => withWindowScopeGuard(tool, () => new Set(this.playwright.getAllowedDirIds(bindingId))))
  }

  async getPlaywrightToolsForBinding(bindingId: string): Promise<RuntimeMcpTool[]> {
    return this.playwright.getBindingTools(bindingId)
      .map(tool => withWindowScopeGuard(tool, () => new Set(this.playwright.getAllowedDirIds(bindingId))))
  }

  async getPlaywrightToolsForWorker(workerId: string): Promise<RuntimeMcpTool[]> {
    return this.playwright.getToolsForWorker(workerId)
      .map(tool => withWindowScopeGuard(tool, () => new Set(this.playwright.getAllowedDirIds(workerId))))
  }

  setWorkerAllowedDirIds(workerId: string, dirIds: string[]): void {
    this.playwright.setAllowedDirIds(workerId, dirIds)
  }

  getWorkerAllowedDirIds(workerId: string): string[] {
    return this.playwright.getAllowedDirIds(workerId)
  }

  clearWorkerAllowedDirIds(workerId: string): void {
    this.playwright.clearAllowedDirIds(workerId)
  }

  listUserMcpServers(): UserMcpEntry[] {
    return this.user.listServers()
  }

  async upsertUserMcpServer(name: string, config: UserMcpServerConfig, enabled?: boolean): Promise<void> {
    return this.user.upsertServer(name, config, enabled)
  }

  async renameUserMcpServer(oldName: string, newName: string, config: UserMcpServerConfig): Promise<void> {
    return this.user.renameServer(oldName, newName, config)
  }

  async removeUserMcpServer(name: string): Promise<void> {
    return this.user.removeServer(name)
  }

  async enableUserMcpServer(name: string): Promise<McpTestResult> {
    return this.user.enableServer(name)
  }

  async disableUserMcpServer(name: string): Promise<void> {
    return this.user.disableServer(name)
  }

  async testUserMcpServer(name: string): Promise<McpTestResult> {
    return this.user.testServer(name)
  }

  async testUserMcpServerConfig(name: string, config: UserMcpServerConfig): Promise<McpTestResult> {
    return this.user.testConfig(name, config)
  }

  /** Backwards-compatible access for the existing transport unit test. */
  _buildConnection(name: string, config: UserMcpServerConfig): McpServerConfig {
    return this.user.buildConnection(name, config)
  }

  async shutdown(): Promise<void> {
    await Promise.all([
      this.playwright.shutdown(),
      this.user.shutdown(),
    ])
    console.log('[MCP] All connections closed')
  }
}

export const mcpManager = new McpManager()
