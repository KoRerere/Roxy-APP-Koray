#!/usr/bin/env node

/**
 * RoxyBrowser MCP Server
 *
 * Model Context Protocol server for RoxyBrowser automation
 * Provides tools to manage browser instances and get CDP endpoints
 */

import type {
  AccountBatchCreateParams,
  AccountCreateParams,
  AccountDeleteParams,
  AccountListParams,
  AccountModifyParams,
  BrowserCloseToolParams,
  BrowserCreateAdvancedParams,
  BrowserCreateAdvancedResponse,
  BrowserCreateSimpleParams,
  BrowserCreateSimpleResponse,
  BrowserCreateStandardParams,
  BrowserCreateStandardResponse,
  BrowserDeleteToolParams,
  BrowserDeleteToolResponse,
  BrowserListToolParams,
  BrowserOpenToolParams,
  BrowserUpdateParams,
  ProxyBatchCreateParams,
  ProxyCreateParams,
  ProxyDeleteParams,
  ProxyDetectParams,
  ProxyListParams,
  ProxyModifyParams,
  RoxyClientConfig,
} from './types.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { BrowserCreator } from './browser/browser-creator.js'
import { createBrowser, openBrowser, updateBrowser } from './modules/browser.js'
import { ProxyManager } from './proxy/proxy-manager.js'
import { RoxyClient } from './roxy-client.js'
import {
  AccountListResponse,
  BrowserCloseToolResponse,
  BrowserCreationError,
  BrowserListToolResponse,
  BrowserOpenToolResponse,
  ClearLocalCacheParams,
  ClearServerCacheParams,
  ConfigError,
  ConnectionInfoResponse,
  LabelListResponse,
  LATEST_CORE_VERSION,
  RandomFingerprintParams,
  RoxyApiError,
  WorkspaceListToolResponse,
} from './types.js'
import { ErrorAnalyzer } from './utils/error-analyzer.js'
import { proxyList, proxyStore } from './modules/proxy'

// ========== Configuration ==========

function getConfig(): RoxyClientConfig {
  const apiHost = process.env.ROXY_API_HOST || 'http://127.0.0.1:50000'
  const apiKey = process.env.ROXY_API_KEY || ''
  const timeout = process.env.ROXY_TIMEOUT ? Number.parseInt(process.env.ROXY_TIMEOUT) : 30000

  if (!apiKey) {
    throw new ConfigError(
      'ROXY_API_KEY environment variable is required. '
      + 'Get your API key from RoxyBrowser: API -> API配置 -> API Key',
    )
  }

  return { apiHost, apiKey, timeout }
}

// ========== Tool Definitions ==========

const TOOLS = [
  createBrowser.toolSchema,
  openBrowser.toolSchema,
  updateBrowser.toolSchema,
  proxyList.toolSchema,
  proxyStore.toolSchema,
  {
    name: 'roxy_list_workspaces',
    description: 'Get list of all workspaces and their projects from RoxyBrowser',
    inputSchema: {
      type: 'object',
      properties: {
        pageIndex: {
          type: 'number',
          description: 'Page index for pagination (default: 1)',
          default: 1,
        },
        pageSize: {
          type: 'number',
          description: 'Number of items per page (default: 15)',
          default: 15,
        },
      },
    },
  },
  {
    name: 'roxy_list_browsers',
    description: 'Get list of browsers in specified workspace/project',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        projectIds: {
          type: 'string',
          description: 'Comma-separated project IDs (optional)',
        },
        windowName: {
          type: 'string',
          description: 'Filter by browser window name (optional)',
        },
        pageIndex: {
          type: 'number',
          description: 'Page index for pagination (default: 1)',
          default: 1,
        },
        pageSize: {
          type: 'number',
          description: 'Number of items per page (default: 15)',
          default: 15,
        },
      },
      required: ['workspaceId'],
    },
  },
  {
    name: 'roxy_close_browsers',
    description: 'Close multiple browsers by their directory IDs',
    inputSchema: {
      type: 'object',
      properties: {
        dirIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of browser directory IDs to close (required)',
        },
      },
      required: ['dirIds'],
    },
  },
  {
    name: 'roxy_delete_browsers',
    description: 'Delete multiple browsers permanently by their directory IDs',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        dirIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of browser directory IDs to delete (required)',
        },
      },
      required: ['workspaceId', 'dirIds'],
    },
  },
  {
    name: 'roxy_validate_proxy_config',
    description: 'Validate proxy configuration before using it',
    inputSchema: {
      type: 'object',
      properties: {
        proxyInfo: {
          type: 'object',
          description: 'Proxy configuration to validate (required)',
          properties: {
            proxyMethod: { type: 'string', enum: ['custom', 'choose', 'api'] },
            proxyCategory: { type: 'string', enum: ['noproxy', 'HTTP', 'HTTPS', 'SOCKS5', 'SSH'] },
            ipType: { type: 'string', enum: ['IPV4', 'IPV6'] },
            protocol: { type: 'string', enum: ['HTTP', 'HTTPS', 'SOCKS5'] },
            host: { type: 'string' },
            port: { type: 'string' },
            proxyUserName: { type: 'string' },
            proxyPassword: { type: 'string' },
            refreshUrl: { type: 'string' },
            checkChannel: { type: 'string', enum: ['IPRust.io', 'IP-API', 'IP123.in'] },
          },
        },
      },
      required: ['proxyInfo'],
    },
  },
  {
    name: 'roxy_system_diagnostics',
    description: 'Perform comprehensive system diagnostics and health checks',
    inputSchema: {
      type: 'object',
      properties: {
        includeWorkspaceCheck: {
          type: 'boolean',
          description: 'Include workspace connectivity tests (optional, default: true)',
          default: true,
        },
        includeBrowserCheck: {
          type: 'boolean',
          description: 'Include browser availability checks (optional, default: true)',
          default: true,
        },
        verbose: {
          type: 'boolean',
          description: 'Include detailed diagnostic information (optional, default: false)',
          default: false,
        },
      },
    },
  },
  {
    name: 'roxy_list_accounts',
    description: 'Get list of accounts (platform credentials) in specified workspace',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        accountId: {
          type: 'number',
          description: 'Account ID to filter by (optional)',
        },
        pageIndex: {
          type: 'number',
          description: 'Page index for pagination (default: 1)',
          default: 1,
        },
        pageSize: {
          type: 'number',
          description: 'Number of items per page (default: 15)',
          default: 15,
        },
      },
      required: ['workspaceId'],
    },
  },
  {
    name: 'roxy_create_account',
    description: 'Create a new platform account with credentials',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        platformUrl: {
          type: 'string',
          description: 'Business platform URL (required, e.g., https://www.tiktok.com/)',
        },
        platformUserName: {
          type: 'string',
          description: 'Account username (required)',
        },
        platformPassword: {
          type: 'string',
          description: 'Account password (required)',
        },
        platformEfa: {
          type: 'string',
          description: 'Account EFA (optional)',
        },
        platformCookies: {
          type: 'array',
          description: 'Account cookies (optional)',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' },
              domain: { type: 'string' },
            },
            required: ['name', 'value', 'domain'],
          },
        },
        platformName: {
          type: 'string',
          description: 'Platform name (optional)',
        },
        platformRemarks: {
          type: 'string',
          description: 'Platform remarks/notes (optional)',
        },
      },
      required: ['workspaceId', 'platformUrl', 'platformUserName', 'platformPassword'],
    },
  },
  {
    name: 'roxy_batch_create_accounts',
    description: 'Batch create multiple platform accounts',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        accountList: {
          type: 'array',
          description: 'Array of account configurations (required)',
          items: {
            type: 'object',
            properties: {
              platformUrl: { type: 'string' },
              platformUserName: { type: 'string' },
              platformPassword: { type: 'string' },
              platformEfa: { type: 'string' },
              platformCookies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    value: { type: 'string' },
                    domain: { type: 'string' },
                  },
                  required: ['name', 'value', 'domain'],
                },
              },
              platformName: { type: 'string' },
              platformRemarks: { type: 'string' },
            },
            required: ['platformUrl', 'platformUserName', 'platformPassword'],
          },
        },
      },
      required: ['workspaceId', 'accountList'],
    },
  },
  {
    name: 'roxy_modify_account',
    description: 'Modify/update an existing platform account',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        id: {
          type: 'number',
          description: 'Account ID to modify (required)',
        },
        platformUrl: {
          type: 'string',
          description: 'Business platform URL (optional)',
        },
        platformUserName: {
          type: 'string',
          description: 'Account username (optional)',
        },
        platformPassword: {
          type: 'string',
          description: 'Account password (optional)',
        },
        platformEfa: {
          type: 'string',
          description: 'Account EFA (optional)',
        },
        platformCookies: {
          type: 'array',
          description: 'Account cookies (optional)',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' },
              domain: { type: 'string' },
            },
            required: ['name', 'value', 'domain'],
          },
        },
        platformName: {
          type: 'string',
          description: 'Platform name (optional)',
        },
        platformRemarks: {
          type: 'string',
          description: 'Platform remarks/notes (optional)',
        },
      },
      required: ['workspaceId', 'id'],
    },
  },
  {
    name: 'roxy_delete_accounts',
    description: 'Delete one or more platform accounts',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of account IDs to delete (required)',
        },
      },
      required: ['workspaceId', 'ids'],
    },
  },
  {
    name: 'roxy_list_labels',
    description: 'Get list of labels in specified workspace',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
      },
      required: ['workspaceId'],
    },
  },
  {
    name: 'roxy_get_connection_info',
    description: 'Get connection information (CDP endpoints, PIDs) for currently opened browsers',
    inputSchema: {
      type: 'object',
      properties: {
        dirIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of browser directory IDs to query (optional, returns all if not specified)',
        },
      },
    },
  },
  {
    name: 'roxy_get_browser_detail',
    description: 'Get detailed information for a specific browser window',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        dirId: {
          type: 'string',
          description: 'Browser directory ID (required)',
        },
      },
      required: ['workspaceId', 'dirId'],
    },
  },
  {
    name: 'roxy_random_fingerprint',
    description: 'Randomize browser fingerprint for a specific browser',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        dirId: {
          type: 'string',
          description: 'Browser directory ID (required)',
        },
      },
      required: ['workspaceId', 'dirId'],
    },
  },
  {
    name: 'roxy_clear_local_cache',
    description: 'Clear local cache for specified browsers',
    inputSchema: {
      type: 'object',
      properties: {
        dirIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of browser directory IDs (required)',
        },
      },
      required: ['dirIds'],
    },
  },
  {
    name: 'roxy_clear_server_cache',
    description: 'Clear server-side cache for specified browsers',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        dirIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of browser directory IDs (required)',
        },
      },
      required: ['workspaceId', 'dirIds'],
    },
  },
  {
    name: 'roxy_create_proxy',
    description: 'Create a new proxy configuration with automatic IP detection',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        protocol: {
          type: 'string',
          enum: ['HTTP', 'HTTPS', 'SOCKS5', 'SSH'],
          description: 'Proxy protocol type (required)',
        },
        host: {
          type: 'string',
          description: 'Proxy host/IP address (required)',
        },
        port: {
          type: 'string',
          description: 'Proxy port (required)',
        },
        proxyUserName: {
          type: 'string',
          description: 'Proxy username (optional)',
        },
        proxyPassword: {
          type: 'string',
          description: 'Proxy password (optional)',
        },
        ipType: {
          type: 'string',
          enum: ['IPV4', 'IPV6'],
          description: 'IP type (optional, default: IPV4)',
        },
        checkChannel: {
          type: 'string',
          enum: ['IPRust.io', 'IP-API', 'IP123.in'],
          description: 'IP detection channel (optional)',
        },
        refreshUrl: {
          type: 'string',
          description: 'Refresh URL for dynamic proxies (optional)',
        },
        remark: {
          type: 'string',
          description: 'Proxy remark/notes (optional)',
        },
      },
      required: ['workspaceId', 'protocol', 'host', 'port'],
    },
  },
  {
    name: 'roxy_batch_create_proxies',
    description: 'Batch create multiple proxy configurations',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        checkChannel: {
          type: 'string',
          enum: ['IPRust.io', 'IP-API', 'IP123.in'],
          description: 'Default IP detection channel for all proxies (optional)',
        },
        proxyList: {
          type: 'array',
          description: 'Array of proxy configurations (required)',
          items: {
            type: 'object',
            properties: {
              protocol: { type: 'string', enum: ['HTTP', 'HTTPS', 'SOCKS5', 'SSH'] },
              host: { type: 'string' },
              port: { type: 'string' },
              proxyUserName: { type: 'string' },
              proxyPassword: { type: 'string' },
              ipType: { type: 'string', enum: ['IPV4', 'IPV6'] },
              checkChannel: { type: 'string', enum: ['IPRust.io', 'IP-API', 'IP123.in'] },
              refreshUrl: { type: 'string' },
              remark: { type: 'string' },
            },
            required: ['protocol', 'host', 'port'],
          },
        },
      },
      required: ['workspaceId', 'proxyList'],
    },
  },
  {
    name: 'roxy_detect_proxy',
    description: 'Detect/test a proxy configuration and update its IP information',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        id: {
          type: 'number',
          description: 'Proxy ID to detect (required)',
        },
      },
      required: ['workspaceId', 'id'],
    },
  },
  {
    name: 'roxy_modify_proxy',
    description: 'Modify/update an existing proxy configuration',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        id: {
          type: 'number',
          description: 'Proxy ID to modify (required)',
        },
        protocol: {
          type: 'string',
          enum: ['HTTP', 'HTTPS', 'SOCKS5', 'SSH'],
          description: 'Proxy protocol type (optional)',
        },
        host: {
          type: 'string',
          description: 'Proxy host/IP address (optional)',
        },
        port: {
          type: 'string',
          description: 'Proxy port (optional)',
        },
        proxyUserName: {
          type: 'string',
          description: 'Proxy username (optional)',
        },
        proxyPassword: {
          type: 'string',
          description: 'Proxy password (optional)',
        },
        ipType: {
          type: 'string',
          enum: ['IPV4', 'IPV6'],
          description: 'IP type (optional)',
        },
        checkChannel: {
          type: 'string',
          enum: ['IPRust.io', 'IP-API', 'IP123.in'],
          description: 'IP detection channel (optional)',
        },
        refreshUrl: {
          type: 'string',
          description: 'Refresh URL for dynamic proxies (optional)',
        },
        remark: {
          type: 'string',
          description: 'Proxy remark/notes (optional)',
        },
      },
      required: ['workspaceId', 'id'],
    },
  },
  {
    name: 'roxy_delete_proxies',
    description: 'Delete one or more proxy configurations',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of proxy IDs to delete (required)',
        },
      },
      required: ['workspaceId', 'ids'],
    },
  },
  {
    name: 'roxy_get_detect_channels',
    description: 'Get available IP detection channels',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'number',
          description: 'Workspace ID (required)',
        },
      },
      required: ['workspaceId'],
    },
  },
]

// ========== MCP Server ==========

class RoxyBrowserMCPServer {
  private server: Server
  private roxyClient: RoxyClient

  constructor() {
    this.server = new Server(
      {
        name: 'roxy-browser-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    )

    // Initialize RoxyBrowser client
    const config = getConfig()
    this.roxyClient = new RoxyClient(config)

    this.setupHandlers()
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }))

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params

      try {
        switch (name) {
          case createBrowser.name:
            return await createBrowser.handle(args)
          case openBrowser.name:
            return await openBrowser.handle(args)
          case updateBrowser.name:
            return await updateBrowser.handle(args)
          case proxyList.name:
            return await proxyList.handle(args)
          case proxyStore.name:
            return await proxyStore.handle(args)
          case 'roxy_list_workspaces':
            return await this.handleListWorkspaces(args)

          case 'roxy_list_browsers':
            return await this.handleListBrowsers(args)

            // case 'roxy_open_browser':
            //   return await this.handleOpenBrowsersSimple(args)

          case 'roxy_close_browsers':
            return await this.handleCloseBrowsers(args)

          case 'roxy_delete_browsers':
            return await this.handleDeleteBrowsers(args)

          case 'roxy_validate_proxy_config':
            return await this.handleValidateProxyConfig(args)

          case 'roxy_system_diagnostics':
            return await this.handleSystemDiagnostics(args)

          case 'roxy_list_accounts':
            return await this.handleListAccounts(args)

          case 'roxy_create_account':
            return await this.handleCreateAccount(args)

          case 'roxy_batch_create_accounts':
            return await this.handleBatchCreateAccounts(args)

          case 'roxy_modify_account':
            return await this.handleModifyAccount(args)

          case 'roxy_delete_accounts':
            return await this.handleDeleteAccounts(args)

          case 'roxy_list_labels':
            return await this.handleListLabels(args)

          case 'roxy_get_connection_info':
            return await this.handleGetConnectionInfo(args)

          case 'roxy_get_browser_detail':
            return await this.handleGetBrowserDetail(args)

          case 'roxy_random_fingerprint':
            return await this.handleRandomFingerprint(args)

          case 'roxy_clear_local_cache':
            return await this.handleClearLocalCache(args)

          case 'roxy_clear_server_cache':
            return await this.handleClearServerCache(args)

          case 'roxy_create_proxy':
            return await this.handleCreateProxy(args)

          case 'roxy_batch_create_proxies':
            return await this.handleBatchCreateProxies(args)

          case 'roxy_detect_proxy':
            return await this.handleDetectProxy(args)

          case 'roxy_modify_proxy':
            return await this.handleModifyProxy(args)

          case 'roxy_delete_proxies':
            return await this.handleDeleteProxies(args)

          case 'roxy_get_detect_channels':
            return await this.handleGetDetectChannels(args)

          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      }
      catch (error) {
        // Use enhanced error analysis
        const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))

        return {
          content: [
            {
              type: 'text',
              text: formattedError,
            },
          ],
        }
      }
    })
  }

  private async handleCreateBrowserSimple(args: any) {
    const params: BrowserCreateSimpleParams = args

    if (!params.workspaceId) {
      throw new Error('workspaceId is required')
    }

    try {
      // Build configuration from simple parameters
      const config = BrowserCreator.buildSimpleConfig(params)
      const finalConfig = BrowserCreator.applyDefaults(config)

      // Validate configuration
      const validation = BrowserCreator.validateConfig(finalConfig)
      if (!validation.valid) {
        throw new BrowserCreationError(`Configuration validation failed: ${validation.errors.join(', ')}`)
      }

      // Create browser
      const result = await this.roxyClient.createBrowser(finalConfig)

      const response: BrowserCreateSimpleResponse = {
        browser: {
          dirId: result.dirId,
          windowName: finalConfig.windowName || 'Simple Browser',
          workspaceId: params.workspaceId,
          projectId: params.projectId,
          proxyConfigured: !!(params.proxyHost && params.proxyPort),
        },
        message: `Browser created successfully with ID: ${result.dirId}`,
      }

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Simple Browser Created**\n\n`
              + `**Browser ID:** \`${response.browser.dirId}\`\n`
              + `**Name:** ${response.browser.windowName}\n`
              + `**Workspace:** ${response.browser.workspaceId}\n`
              + `${response.browser.projectId ? `**Project:** ${response.browser.projectId}\n` : ''}`
              + `**Proxy:** ${response.browser.proxyConfigured ? '✅ Configured' : '❌ Not configured'}\n\n`
              + `*Use this browser ID with \`roxy_open_browser\` to start the browser and get CDP endpoints for automation.*`,
          },
        ],
      }
    }
    catch (error) {
      // Check for quota error specifically
      if (error instanceof RoxyApiError && error.code === 409
        && error.message.includes('额度不足')) {
        return {
          content: [{
            type: 'text',
            text: `❌ **浏览器创建失败 - 窗口额度不足 / Browser Creation Failed - Insufficient Profiles Quota**\n\n`
              + `**错误信息 / Error:** ${error.message}\n\n`
              + `**解决步骤 / Solution Steps:**\n`
              + `1. 打开 RoxyBrowser 应用 / Open RoxyBrowser app\n`
              + `2. 前往费用中心 / Go to Billing Center\n`
              + `3. 购买或升级窗口套餐 / Purchase or upgrade profiles plan\n`
              + `4. 或者删除不需要的浏览器窗口以释放额度 / Or delete unused browser profiles to free up quota\n`
              + `5. 等待生效后重试创建 / Retry creation after quota is available\n\n`
              + `💡 **重要提示 / Important:** 必须使用 \`roxy_delete_browsers\` 删除浏览器才能释放额度，仅关闭浏览器无法释放额度。\n`
              + `You must use \`roxy_delete_browsers\` to delete profiles to free up quota. Simply closing browsers will NOT free up quota.`,
          }],
        }
      }

      // Use enhanced error analysis for other errors
      const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))

      return {
        content: [{ type: 'text', text: formattedError }],
      }
    }
  }

  private async handleCreateBrowserStandard(args: any) {
    const params: BrowserCreateStandardParams = args

    if (!params.workspaceId) {
      throw new Error('workspaceId is required')
    }

    try {
      // Build configuration from standard parameters
      const config = BrowserCreator.buildStandardConfig(params)
      const finalConfig = BrowserCreator.applyDefaults(config)

      // Validate configuration
      const validation = BrowserCreator.validateConfig(finalConfig)
      if (!validation.valid) {
        throw new BrowserCreationError(`Configuration validation failed: ${validation.errors.join(', ')}`)
      }

      // Create browser
      const result = await this.roxyClient.createBrowser(finalConfig)

      const response: BrowserCreateStandardResponse = {
        browser: {
          dirId: result.dirId,
          windowName: finalConfig.windowName || 'Standard Browser',
          workspaceId: params.workspaceId,
          projectId: params.projectId,
          os: finalConfig.os || 'Windows',
          coreVersion: finalConfig.coreVersion || LATEST_CORE_VERSION,
          proxyInfo: params.proxyInfo,
          windowSize: `${params.openWidth || '1000'}x${params.openHeight || '1000'}`,
        },
        message: `Standard browser created successfully with ID: ${result.dirId}`,
      }

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Standard Browser Created**\n\n`
              + `**Browser ID:** \`${response.browser.dirId}\`\n`
              + `**Name:** ${response.browser.windowName}\n`
              + `**OS:** ${response.browser.os} ${finalConfig.osVersion || ''}\n`
              + `**Core Version:** ${response.browser.coreVersion}\n`
              + `**Window Size:** ${response.browser.windowSize}\n`
              + `**Workspace:** ${response.browser.workspaceId}\n`
              + `${response.browser.projectId ? `**Project:** ${response.browser.projectId}\n` : ''}`
              + `**Proxy:** ${response.browser.proxyInfo ? '✅ Configured' : '❌ Not configured'}\n\n`
              + `*Browser is ready for automation. Use \`roxy_open_browser\` to start it.*`,
          },
        ],
      }
    }
    catch (error) {
      // Check for quota error specifically
      if (error instanceof RoxyApiError && error.code === 409
        && error.message.includes('额度不足')) {
        return {
          content: [{
            type: 'text',
            text: `❌ **浏览器创建失败 - 窗口额度不足 / Browser Creation Failed - Insufficient Profiles Quota**\n\n`
              + `**错误信息 / Error:** ${error.message}\n\n`
              + `**解决步骤 / Solution Steps:**\n`
              + `1. 打开 RoxyBrowser 应用 / Open RoxyBrowser app\n`
              + `2. 前往费用中心 / Go to Billing Center\n`
              + `3. 购买或升级窗口套餐 / Purchase or upgrade profiles plan\n`
              + `4. 或者删除不需要的浏览器窗口以释放额度 / Or delete unused browser profiles to free up quota\n`
              + `5. 等待生效后重试创建 / Retry creation after quota is available\n\n`
              + `💡 **重要提示 / Important:** 必须使用 \`roxy_delete_browsers\` 删除浏览器才能释放额度，仅关闭浏览器无法释放额度。\n`
              + `You must use \`roxy_delete_browsers\` to delete profiles to free up quota. Simply closing browsers will NOT free up quota.`,
          }],
        }
      }

      // Use enhanced error analysis for other errors
      const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))

      return {
        content: [{ type: 'text', text: formattedError }],
      }
    }
  }

  private async handleCreateBrowserAdvanced(args: any) {
    const params: BrowserCreateAdvancedParams = args

    if (!params.workspaceId) {
      throw new Error('workspaceId is required')
    }

    try {
      // Build configuration from advanced parameters
      const config = BrowserCreator.buildAdvancedConfig(params)
      const finalConfig = BrowserCreator.applyDefaults(config)

      // Validate configuration
      const validation = BrowserCreator.validateConfig(finalConfig)
      if (!validation.valid) {
        throw new BrowserCreationError(`Configuration validation failed: ${validation.errors.join(', ')}`)
      }

      // Create browser
      const result = await this.roxyClient.createBrowser(finalConfig)

      const response: BrowserCreateAdvancedResponse = {
        browser: {
          dirId: result.dirId,
          config: finalConfig,
        },
        message: `Advanced browser created successfully with ID: ${result.dirId}`,
      }

      // Create detailed status text
      const configSummary = [
        `**Browser ID:** \`${response.browser.dirId}\``,
        `**Name:** ${finalConfig.windowName || 'Advanced Browser'}`,
        `**OS:** ${finalConfig.os || 'Windows'} ${finalConfig.osVersion || ''}`,
        `**Core Version:** ${finalConfig.coreVersion || LATEST_CORE_VERSION}`,
        finalConfig.userAgent ? `**User Agent:** ${finalConfig.userAgent.substring(0, 50)}...` : '',
        `**Search Engine:** ${finalConfig.searchEngine || 'Google'}`,
        finalConfig.proxyInfo?.proxyCategory !== 'noproxy' ? `**Proxy:** ✅ ${finalConfig.proxyInfo?.proxyCategory} ${finalConfig.proxyInfo?.host}:${finalConfig.proxyInfo?.port}` : '**Proxy:** ❌ No proxy',
        finalConfig.fingerInfo?.randomFingerprint ? '**Fingerprint:** 🎲 Random' : '**Fingerprint:** 🔒 Fixed',
        finalConfig.defaultOpenUrl?.length ? `**Default URLs:** ${finalConfig.defaultOpenUrl.length} URL(s)` : '',
      ].filter(Boolean).join('\n')

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Advanced Browser Created**\n\n${configSummary}\n\n`
              + `*Advanced browser configured with complete control. Use \`roxy_open_browser\` to start it.*`,
          },
        ],
      }
    }
    catch (error) {
      // Check for quota error specifically
      if (error instanceof RoxyApiError && error.code === 409
        && error.message.includes('额度不足')) {
        return {
          content: [{
            type: 'text',
            text: `❌ **浏览器创建失败 - 窗口额度不足 / Browser Creation Failed - Insufficient Profiles Quota**\n\n`
              + `**错误信息 / Error:** ${error.message}\n\n`
              + `**解决步骤 / Solution Steps:**\n`
              + `1. 打开 RoxyBrowser 应用 / Open RoxyBrowser app\n`
              + `2. 前往费用中心 / Go to Billing Center\n`
              + `3. 购买或升级窗口套餐 / Purchase or upgrade profiles plan\n`
              + `4. 或者删除不需要的浏览器窗口以释放额度 / Or delete unused browser profiles to free up quota\n`
              + `5. 等待生效后重试创建 / Retry creation after quota is available\n\n`
              + `💡 **重要提示 / Important:** 必须使用 \`roxy_delete_browsers\` 删除浏览器才能释放额度，仅关闭浏览器无法释放额度。\n`
              + `You must use \`roxy_delete_browsers\` to delete profiles to free up quota. Simply closing browsers will NOT free up quota.`,
          }],
        }
      }

      // Use enhanced error analysis for other errors
      const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))

      return {
        content: [{ type: 'text', text: formattedError }],
      }
    }
  }

  private async handleValidateProxyConfig(args: any) {
    const { proxyInfo } = args

    if (!proxyInfo) {
      throw new Error('proxyInfo is required')
    }

    const validation = ProxyManager.validateProxy(proxyInfo)

    let resultText = ''

    if (validation.valid) {
      resultText = `✅ **Proxy Configuration Valid**\n\n`
        + `**Type:** ${proxyInfo.proxyCategory || 'Not specified'}\n`
        + `**Host:** ${proxyInfo.host || 'Not specified'}\n`
        + `**Port:** ${proxyInfo.port || 'Not specified'}\n`
        + `**Authentication:** ${proxyInfo.proxyUserName ? '✅ Yes' : '❌ No'}\n`
        + `**IP Type:** ${proxyInfo.ipType || 'IPV4'}`
    }
    else {
      resultText = `❌ **Proxy Configuration Invalid**\n\n`
        + `**Errors:**\n${
          validation.errors.map(error => `  • ${error}`).join('\n')}`
    }

    if (validation.warnings.length > 0) {
      resultText += `\n\n**⚠️ Warnings:**\n${
        validation.warnings.map(warning => `  • ${warning}`).join('\n')}`
    }

    return {
      content: [
        {
          type: 'text',
          text: resultText,
        },
      ],
    }
  }

  private async handleListWorkspaces(args: any) {
    const { pageIndex = 1, pageSize = 15 } = args || {}

    const data = await this.roxyClient.getWorkspaces(pageIndex, pageSize)

    return {
      content: [
        {
          type: 'text',
          text: `Found ${data.total} workspaces:\n\n${
            data.rows.map(ws =>
              `**${ws.workspaceName}** (ID: ${ws.id})\n${
                ws.project_details.map(proj =>
                  `  - ${proj.projectName} (ID: ${proj.projectId})`,
                ).join('\n')}`,
            ).join('\n\n')}`,
        },
      ],
    }
  }

  private async handleListBrowsers(args: any) {
    const params: BrowserListToolParams = args

    if (!params.workspaceId) {
      throw new Error('workspaceId is required')
    }

    const data = await this.roxyClient.getBrowsers({
      workspaceId: params.workspaceId,
      projectIds: params.projectIds,
      windowName: params.windowName,
      page_index: params.pageIndex || 1,
      page_size: params.pageSize || 15,
    })

    return {
      content: [
        {
          type: 'text',
          text: `Found ${data.total} browsers in workspace ${params.workspaceId}:\n\n${
            data.rows.map(browser =>
              `**${browser.windowName || 'Unnamed'}** (ID: ${browser.dirId})\n`
              + `  - Project: ${browser.projectId}\n`
              + `  - Sort: ${browser.sortNum}\n`
              + `  - OS: ${browser.os}\n`
              + `  - Status: ${browser.status}`,
            ).join('\n\n')}`,
        },
      ],
    }
  }

  /**
   * @deprecated
   */
  private async handleOpenBrowsers(args: any) {
    const params: BrowserOpenToolParams = args

    if (!params.workspaceId || !params.dirIds || params.dirIds.length === 0) {
      throw new Error('workspaceId and dirIds are required')
    }

    const { successes, failures } = await this.roxyClient.openBrowsers(
      params.workspaceId,
      params.dirIds,
      params.args,
    )

    // Build success message
    let message = ''

    if (successes.length > 0) {
      message += `✅ **Successfully opened ${successes.length} browser(s):**\n\n${
        successes.map(result =>
          `**Browser ${result.dirId || 'Unknown'}** (PID: ${result.pid})\n`
          + `  - CDP WebSocket: \`${result.ws}\`\n`
          + `  - HTTP Endpoint: \`${result.http}\`\n`
          + `  - Core Version: ${result.coreVersion}`,
        ).join('\n\n')
      }\n\n**Use these WebSocket URLs with playwright-mcp:**\n`
      + `\`\`\`bash\n${
        successes.map(result =>
          `npx @playwright/mcp@latest --cdp-endpoint "${result.ws}"`,
        ).join('\n')
      }\n\`\`\``
    }

    // Build failure message with special handling for quota errors
    if (failures.length > 0) {
      if (successes.length > 0) {
        message += '\n\n---\n\n'
      }

      // Check if any failures are quota errors (code 101 or 409)
      const quotaErrors = failures.filter(f => f.errorCode === 101 || (f.errorCode === 409 && f.error.includes('额度不足')))
      const otherErrors = failures.filter(f => !quotaErrors.includes(f))

      if (quotaErrors.length > 0) {
        message += `❌ **Failed to open ${quotaErrors.length} browser(s) - Insufficient Profiles Quota / 窗口额度不足:**\n\n`
        quotaErrors.forEach((failure) => {
          message += `  - Browser ID: \`${failure.dirId}\`\n    Error: ${failure.error}\n`
        })

        message += '\n**解决步骤 / Solution Steps:**\n'
        message += '1. 打开 RoxyBrowser 应用 / Open RoxyBrowser app\n'
        message += '2. 前往费用中心 / Go to Billing Center\n'
        message += '3. 购买或升级窗口套餐 / Purchase or upgrade profiles plan\n'
        message += '4. 或者删除不需要的浏览器窗口以释放额度 / Or delete unused browser profiles to free up quota\n\n'
        message += '💡 **重要提示 / Important:** 必须使用 `roxy_delete_browsers` 删除浏览器才能释放额度，仅关闭浏览器无法释放额度。\n'
        message += 'You must use `roxy_delete_browsers` to delete profiles to free up quota. Simply closing browsers will NOT free up quota.'
      }

      if (otherErrors.length > 0) {
        if (quotaErrors.length > 0) {
          message += '\n\n'
        }
        message += `❌ **Failed to open ${otherErrors.length} browser(s) - Other Errors:**\n\n`
        otherErrors.forEach((failure) => {
          message += `  - Browser ID: \`${failure.dirId}\`\n`
          message += `    Error: ${failure.error}\n`
          message += `    Retryable: ${failure.retryable ? '✅ Yes' : '❌ No'}\n`
        })
      }
    }

    // If all failed
    if (successes.length === 0 && failures.length > 0) {
      message = `❌ **Failed to open all ${failures.length} browser(s)**\n\n${message}`
    }

    return {
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
    }
  }

  private async handleOpenBrowsersSimple(args: any) {
    const params = args
    const result = await this.roxyClient.openBrowsersSimple(params.workspaceId, params.dirId, params.args)
    if (result.code === 0 && result.data) {
      const data = result.data
      return {
        content: {
          type: 'text',
          text: `✅ **Successfully opened browser:**
          **Browser ${data.dirId || 'Unknown'}** (PID:${data.pid})
          - CDP WebSocket: \`${data.ws}\`
          - HTTP Endpoint: \`${data.http}\`
          - Core Version: ${data.coreVersion}
      }`,
        },
      }
    }
    else {
      return {
        content: {
          type: 'text',
          text: `❌ **Failed to open browser:**
          error message: ${result.message || 'Unknown error'}`,
        },
      }
    }
  }

  private async handleCloseBrowsers(args: any) {
    const params: BrowserCloseToolParams = args

    if (!params.dirIds || params.dirIds.length === 0) {
      throw new Error('dirIds are required')
    }

    const results = await this.roxyClient.closeBrowsers(params.dirIds)

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    const successText = successCount > 0
      ? `✅ Successfully closed ${successCount} browsers`
      : ''

    const failureText = failureCount > 0
      ? `❌ Failed to close ${failureCount} browsers:\n${
        results.filter(r => !r.success).map(r =>
          `  - ${r.dirId}: ${r.error}`,
        ).join('\n')}`
      : ''

    return {
      content: [
        {
          type: 'text',
          text: [successText, failureText].filter(Boolean).join('\n\n'),
        },
      ],
    }
  }

  private async handleDeleteBrowsers(args: any) {
    const params: BrowserDeleteToolParams = args

    if (!params.workspaceId || !params.dirIds || params.dirIds.length === 0) {
      throw new Error('workspaceId and dirIds are required')
    }

    try {
      await this.roxyClient.deleteBrowsers(params.workspaceId, params.dirIds)

      const response: BrowserDeleteToolResponse = {
        results: params.dirIds.map(dirId => ({
          dirId,
          success: true,
        })),
        successCount: params.dirIds.length,
        failureCount: 0,
        message: `Successfully deleted ${params.dirIds.length} browser(s)`,
      }

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Browsers Deleted Successfully**\n\n`
              + `**Count:** ${response.successCount} browser(s)\n`
              + `**Workspace:** ${params.workspaceId}\n\n`
              + `**Deleted Browsers:**\n${
                params.dirIds.map((dirId, index) => `  ${index + 1}. \`${dirId}\``).join('\n')
              }`,
          },
        ],
      }
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        content: [
          {
            type: 'text',
            text: `❌ **Browser Deletion Failed**\n\n`
              + `**Error:** ${errorMessage}\n`
              + `**Workspace:** ${params.workspaceId}\n`
              + `**Failed Browsers:** ${params.dirIds.length}\n\n`
              + `**Browser IDs:**\n${
                params.dirIds.map((dirId, index) => `  ${index + 1}. \`${dirId}\``).join('\n')}`,
          },
        ],
      }
    }
  }

  private async handleSystemDiagnostics(args: any) {
    const { includeWorkspaceCheck = true, includeBrowserCheck = true, verbose = false } = args || {}

    // Perform comprehensive diagnostics
    const diagnostics = await this.roxyClient.performDiagnostics()

    let diagnosticText = `## 🔍 系统诊断报告 / System Diagnostics Report\n\n`

    // Basic connectivity
    diagnosticText += `### 🌐 连接状态 / Connectivity Status\n`
    diagnosticText += `- **API连接 / API Connection**: ${diagnostics.connected ? '✅ 已连接' : '❌ 连接失败'}\n`
    diagnosticText += `- **认证状态 / Authentication**: ${diagnostics.authentication ? '✅ 成功' : '❌ 失败'}\n`
    diagnosticText += `- **工作区访问 / Workspace Access**: ${diagnostics.workspaceAccess ? '✅ 正常' : '⚠️ 受限'}\n\n`

    // Additional workspace checks
    if (includeWorkspaceCheck && diagnostics.connected && diagnostics.authentication) {
      try {
        const workspaces = await this.roxyClient.getWorkspaces(1, 5)
        diagnosticText += `### 📁 工作区信息 / Workspace Information\n`
        diagnosticText += `- **可用工作区 / Available Workspaces**: ${workspaces.total}\n`

        if (workspaces.rows.length > 0) {
          diagnosticText += `- **工作区详情 / Workspace Details**:\n`
          workspaces.rows.slice(0, 3).forEach((ws) => {
            const projectCount = ws.project_details.length
            diagnosticText += `  - ${ws.workspaceName} (ID: ${ws.id}) - ${projectCount} projects\n`
          })
          if (workspaces.total > 3) {
            diagnosticText += `  - ... and ${workspaces.total - 3} more\n`
          }
        }
        diagnosticText += '\n'
      }
      catch (error) {
        diagnosticText += `### 📁 工作区信息 / Workspace Information\n`
        diagnosticText += `- **状态**: ❌ 无法获取工作区信息\n`
        diagnosticText += `- **错误**: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`
      }
    }

    // Browser availability checks
    if (includeBrowserCheck && diagnostics.connected && diagnostics.authentication && diagnostics.workspaceAccess) {
      try {
        // Get first workspace and check browsers
        const workspaces = await this.roxyClient.getWorkspaces(1, 1)
        if (workspaces.rows.length > 0) {
          const firstWorkspace = workspaces.rows[0]
          const browsers = await this.roxyClient.getBrowsers({
            workspaceId: firstWorkspace.id,
            page_index: 1,
            page_size: 5,
          })

          diagnosticText += `### 🖥️ 浏览器状态 / Browser Status\n`
          diagnosticText += `- **检查工作区 / Checked Workspace**: ${firstWorkspace.workspaceName} (ID: ${firstWorkspace.id})\n`
          diagnosticText += `- **可用浏览器 / Available Browsers**: ${browsers.total}\n`

          if (browsers.rows.length > 0) {
            diagnosticText += `- **浏览器示例 / Browser Examples**:\n`
            browsers.rows.slice(0, 3).forEach((browser) => {
              diagnosticText += `  - ${browser.windowName || 'Unnamed'} (${browser.os}) - Status: ${browser.status}\n`
            })
          }
          diagnosticText += '\n'
        }
      }
      catch (error) {
        diagnosticText += `### 🖥️ 浏览器状态 / Browser Status\n`
        diagnosticText += `- **状态**: ⚠️ 无法检查浏览器状态\n`
        diagnosticText += `- **原因**: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`
      }
    }

    // Error details
    if (diagnostics.errors.length > 0) {
      diagnosticText += `### ❌ 检测到的问题 / Detected Issues\n`
      diagnostics.errors.forEach((error, index) => {
        diagnosticText += `${index + 1}. ${error}\n`
      })
      diagnosticText += '\n'
    }

    // Recommendations
    if (diagnostics.recommendations.length > 0) {
      diagnosticText += `### 💡 建议操作 / Recommendations\n`
      diagnostics.recommendations.slice(0, 8).forEach((rec, index) => {
        diagnosticText += `${index + 1}. ${rec}\n`
      })
      if (diagnostics.recommendations.length > 8) {
        diagnosticText += `... and ${diagnostics.recommendations.length - 8} more\n`
      }
      diagnosticText += '\n'
    }

    // Verbose information
    if (verbose) {
      diagnosticText += `### 🔧 详细信息 / Detailed Information\n`
      diagnosticText += `- **API主机 / API Host**: ${this.roxyClient.config.apiHost}\n`
      diagnosticText += `- **超时设置 / Timeout**: ${this.roxyClient.config.timeout}ms\n`
      diagnosticText += `- **诊断时间 / Diagnosis Time**: ${new Date().toISOString()}\n\n`
    }

    // Overall status
    const overallStatus = diagnostics.connected && diagnostics.authentication
    diagnosticText += `### 📋 总体状态 / Overall Status\n`
    diagnosticText += `**${overallStatus ? '✅ 系统正常运行' : '❌ 系统存在问题'}** / `
    diagnosticText += `**${overallStatus ? 'System Operating Normally' : 'System Issues Detected'}**\n\n`

    if (overallStatus) {
      diagnosticText += `*系统已准备就绪，可以进行浏览器自动化操作。*\n`
      diagnosticText += `*System ready for browser automation operations.*`
    }
    else {
      diagnosticText += `*请解决上述问题后重新运行诊断。*\n`
      diagnosticText += `*Please resolve the issues above and run diagnostics again.*`
    }

    return {
      content: [
        {
          type: 'text',
          text: diagnosticText,
        },
      ],
    }
  }

  private async handleListAccounts(args: any) {
    const params: AccountListParams = {
      workspaceId: args.workspaceId,
      accountId: args.accountId,
      page_index: args.pageIndex || 1,
      page_size: args.pageSize || 15,
    }

    if (!params.workspaceId) {
      throw new Error('workspaceId is required')
    }

    const data = await this.roxyClient.getAccounts(params)

    return {
      content: [
        {
          type: 'text',
          text: `Found ${data.total} accounts in workspace ${params.workspaceId}:\n\n${
            data.rows.map(account =>
              `**${account.platformName}** (ID: ${account.id})\n`
              + `  - Username: ${account.platformUserName}\n`
              + `  - Platform URL: ${account.platformUrl}\n`
              + `  - Remarks: ${account.platformRemarks || 'N/A'}\n`
              + `  - Created: ${account.createTime}`,
            ).join('\n\n')}`,
        },
      ],
    }
  }

  // ========== Account Management Handlers ==========

  private async handleCreateAccount(args: any) {
    const params: AccountCreateParams = {
      workspaceId: args.workspaceId,
      platformUrl: args.platformUrl,
      platformUserName: args.platformUserName,
      platformPassword: args.platformPassword,
      platformEfa: args.platformEfa,
      platformCookies: args.platformCookies,
      platformName: args.platformName,
      platformRemarks: args.platformRemarks,
    }

    if (!params.workspaceId || !params.platformUrl || !params.platformUserName || !params.platformPassword) {
      throw new Error('workspaceId, platformUrl, platformUserName, and platformPassword are required')
    }

    try {
      await this.roxyClient.createAccount(params)

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Account Created Successfully**

**Platform:** ${params.platformName || params.platformUrl}
**Username:** ${params.platformUserName}
**Platform URL:** ${params.platformUrl}${params.platformRemarks
  ? `
**Remarks:** ${params.platformRemarks}`
  : ''}${params.platformEfa
  ? `
**EFA:** ${params.platformEfa}`
  : ''}${params.platformCookies && params.platformCookies.length > 0
  ? `
**Cookies:** ${params.platformCookies.length} cookie(s)`
  : ''}

*Account has been created successfully.*`,
          },
        ],
      }
    }
    catch (error) {
      const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))
      return {
        content: [{ type: 'text', text: formattedError }],
      }
    }
  }

  private async handleBatchCreateAccounts(args: any) {
    const params: AccountBatchCreateParams = {
      workspaceId: args.workspaceId,
      accountList: args.accountList,
    }

    if (!params.workspaceId || !params.accountList || params.accountList.length === 0) {
      throw new Error('workspaceId and accountList are required')
    }

    try {
      await this.roxyClient.batchCreateAccounts(params)

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Batch Account Creation Successful**

**Count:** ${params.accountList.length} account(s)
**Workspace:** ${params.workspaceId}

*All accounts have been created successfully.*`,
          },
        ],
      }
    }
    catch (error) {
      const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))
      return {
        content: [{ type: 'text', text: formattedError }],
      }
    }
  }

  private async handleModifyAccount(args: any) {
    const params: AccountModifyParams = {
      workspaceId: args.workspaceId,
      id: args.id,
      platformUrl: args.platformUrl,
      platformUserName: args.platformUserName,
      platformPassword: args.platformPassword,
      platformEfa: args.platformEfa,
      platformCookies: args.platformCookies,
      platformName: args.platformName,
      platformRemarks: args.platformRemarks,
    }

    if (!params.workspaceId || !params.id) {
      throw new Error('workspaceId and id are required')
    }

    try {
      await this.roxyClient.modifyAccount(params)

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Account Modified Successfully**

**Account ID:** ${params.id}${params.platformName
  ? `
**Platform:** ${params.platformName}`
  : ''}${params.platformUrl
  ? `
**Platform URL:** ${params.platformUrl}`
  : ''}${params.platformUserName
  ? `
**Username:** ${params.platformUserName}`
  : ''}${params.platformRemarks
  ? `
**Remarks:** ${params.platformRemarks}`
  : ''}

*Account configuration has been updated.*`,
          },
        ],
      }
    }
    catch (error) {
      const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))
      return {
        content: [{ type: 'text', text: formattedError }],
      }
    }
  }

  private async handleDeleteAccounts(args: any) {
    const params: AccountDeleteParams = {
      workspaceId: args.workspaceId,
      ids: args.ids,
    }

    if (!params.workspaceId || !params.ids || params.ids.length === 0) {
      throw new Error('workspaceId and ids are required')
    }

    try {
      await this.roxyClient.deleteAccounts(params)

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Accounts Deleted Successfully**

**Count:** ${params.ids.length} account(s)
**Workspace:** ${params.workspaceId}

**Deleted Account IDs:**
${params.ids.map((id, index) => `  ${index + 1}. ${id}`).join('\n')}

⚠️ **Warning:** Deleted accounts cannot be recovered.`,
          },
        ],
      }
    }
    catch (error) {
      const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))
      return {
        content: [{ type: 'text', text: formattedError }],
      }
    }
  }

  private async handleListLabels(args: any) {
    const { workspaceId } = args

    if (!workspaceId) {
      throw new Error('workspaceId is required')
    }

    const labels = await this.roxyClient.getLabels(workspaceId)

    return {
      content: [
        {
          type: 'text',
          text: `Found ${labels.length} labels in workspace ${workspaceId}:\n\n${
            labels.map(label =>
              `**${label.name}** (ID: ${label.id})\n`
              + `  - Color: ${label.color}`,
            ).join('\n\n')}`,
        },
      ],
    }
  }

  // ========== Proxy Management Handlers ==========

  private async handleListProxies(args: any) {
    const params: ProxyListParams = {
      workspaceId: args.workspaceId,
      id: args.id,
      page_index: args.pageIndex || 1,
      page_size: args.pageSize || 15,
    }

    if (!params.workspaceId) {
      throw new Error('workspaceId is required')
    }

    try {
      const data = await this.roxyClient.getProxies(params)

      const proxyListText = data.rows.length > 0
        ? data.rows.map((proxy, index) => {
            const statusEmoji = proxy.checkStatus === 1 ? '✅' : proxy.checkStatus === 2 ? '❌' : '⏳'
            const statusText = proxy.checkStatus === 1 ? '检测成功' : proxy.checkStatus === 2 ? '检测失败' : '未检测'
            const location = proxy.lastCountry
              ? `${proxy.lastCity || ''}${proxy.lastCity && proxy.lastCountry ? ', ' : ''}${proxy.lastCountry || ''}`
              : ''
            return `${index + 1}. **${proxy.remark || `Proxy ${proxy.id}`}** (ID: ${proxy.id})
   ${statusEmoji} Status: ${statusText}
   Protocol: ${proxy.protocol || 'N/A'}
   Host: ${proxy.host || 'N/A'}:${proxy.port || 'N/A'}${proxy.lastIp
      ? `
   Last IP: ${proxy.lastIp}`
      : ''}${location
      ? `
   Location: ${location}`
      : ''}${proxy.checkTime
      ? `
   Check Time: ${proxy.checkTime}`
      : ''}${proxy.error
      ? `
   Error: ${JSON.stringify(proxy.error)}`
      : ''}`
          }).join('\n')
        : 'No proxies found'

      return {
        content: [
          {
            type: 'text',
            text: `📋 **Proxy List** (Total: ${data.total})\n\n${proxyListText}`,
          },
        ],
      }
    }
    catch (error) {
      const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))
      return {
        content: [{ type: 'text', text: formattedError }],
      }
    }
  }

  private async handleCreateProxy(args: any) {
    const params: ProxyCreateParams = {
      workspaceId: args.workspaceId,
      protocol: args.protocol,
      host: args.host,
      port: args.port,
      proxyUserName: args.proxyUserName,
      proxyPassword: args.proxyPassword,
      ipType: args.ipType || 'IPV4',
      checkChannel: args.checkChannel,
      refreshUrl: args.refreshUrl,
      remark: args.remark,
      proxyCategory: args.protocol,
    }

    if (!params.workspaceId || !params.protocol || !params.host || !params.port) {
      throw new Error('workspaceId, protocol, host, and port are required')
    }

    try {
      await this.roxyClient.createProxy(params)

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Proxy Created Successfully**

**Protocol:** ${params.protocol}
**Host:** ${params.host}:${params.port}${params.proxyUserName
  ? `
**Username:** ${params.proxyUserName}`
  : ''}${params.remark
  ? `
**Remark:** ${params.remark}`
  : ''}${params.checkChannel
  ? `
**Check Channel:** ${params.checkChannel}`
  : ''}

*Proxy configuration created. IP detection will be performed automatically.*`,
          },
        ],
      }
    }
    catch (error) {
      const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))
      return {
        content: [{ type: 'text', text: formattedError }],
      }
    }
  }

  private async handleBatchCreateProxies(args: any) {
    const params: ProxyBatchCreateParams = {
      workspaceId: args.workspaceId,
      checkChannel: args.checkChannel,
      proxyList: args.proxyList,
    }

    if (!params.workspaceId || !params.proxyList || params.proxyList.length === 0) {
      throw new Error('workspaceId and proxyList are required')
    }

    try {
      await this.roxyClient.batchCreateProxies(params)

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Batch Proxy Creation Successful**

**Count:** ${params.proxyList.length} proxy/proxies
**Workspace:** ${params.workspaceId}${params.checkChannel
  ? `
**Default Check Channel:** ${params.checkChannel}`
  : ''}

*All proxies have been created. IP detection will be performed automatically.*`,
          },
        ],
      }
    }
    catch (error) {
      const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))
      return {
        content: [{ type: 'text', text: formattedError }],
      }
    }
  }

  private async handleDetectProxy(args: any) {
    const params: ProxyDetectParams = {
      workspaceId: args.workspaceId,
      id: args.id,
    }

    if (!params.workspaceId || !params.id) {
      throw new Error('workspaceId and id are required')
    }

    try {
      await this.roxyClient.detectProxy(params)

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Proxy Detection Started**\n\n`
              + `**Proxy ID:** ${params.id}\n`
              + `**Workspace:** ${params.workspaceId}\n\n`
              + `*Proxy detection is in progress. This may take a few seconds. Use \`${proxyList.name}\` | \`${proxyStore.name}\` to check the updated status.*`,
          },
        ],
      }
    }
    catch (error) {
      const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))
      return {
        content: [{ type: 'text', text: formattedError }],
      }
    }
  }

  private async handleModifyProxy(args: any) {
    const params: ProxyModifyParams = {
      workspaceId: args.workspaceId,
      id: args.id,
      protocol: args.protocol,
      host: args.host,
      port: args.port,
      proxyUserName: args.proxyUserName,
      proxyPassword: args.proxyPassword,
      ipType: args.ipType,
      checkChannel: args.checkChannel,
      refreshUrl: args.refreshUrl,
      remark: args.remark,
      proxyCategory: args.protocol,
    }

    if (!params.workspaceId || !params.id) {
      throw new Error('workspaceId and id are required')
    }

    try {
      await this.roxyClient.modifyProxy(params)

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Proxy Modified Successfully**

**Proxy ID:** ${params.id}${params.protocol
  ? `
**Protocol:** ${params.protocol}`
  : ''}${params.host
  ? `
**Host:** ${params.host}${params.port ? `:${params.port}` : ''}`
  : ''}${params.remark
  ? `
**Remark:** ${params.remark}`
  : ''}

*Proxy configuration has been updated. Use \`roxy_detect_proxy\` to test the new configuration.*`,
          },
        ],
      }
    }
    catch (error) {
      const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))
      return {
        content: [{ type: 'text', text: formattedError }],
      }
    }
  }

  private async handleDeleteProxies(args: any) {
    const params: ProxyDeleteParams = {
      workspaceId: args.workspaceId,
      ids: args.ids,
    }

    if (!params.workspaceId || !params.ids || params.ids.length === 0) {
      throw new Error('workspaceId and ids are required')
    }

    try {
      await this.roxyClient.deleteProxies(params)

      return {
        content: [
          {
            type: 'text',
            text: `✅ **Proxies Deleted Successfully**\n\n`
              + `**Count:** ${params.ids.length} proxy/proxies\n`
              + `**Workspace:** ${params.workspaceId}\n\n`
              + `**Deleted Proxy IDs:**\n${
                params.ids.map((id, index) => `  ${index + 1}. ${id}`).join('\n')
              }\n\n⚠️ **Warning:** Deleted proxies cannot be recovered.`,
          },
        ],
      }
    }
    catch (error) {
      const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))
      return {
        content: [{ type: 'text', text: formattedError }],
      }
    }
  }

  private async handleGetBoughtProxies(args: any) {
    const params = {
      workspaceId: args.workspaceId,
      pageIndex: args.pageIndex || 1,
      pageSize: args.pageSize || 15,
      type: args.type || 0,
    }
    const data = await this.roxyClient.getBoughtProxies(params)
    return {
      content: [
        { type: 'text', text: `Found ${data.length} bought proxies:\n\n${
          data.map((proxy, index) => `${index + 1}. **${proxy.remark || `Proxy ${proxy.id}`}** (ID: ${proxy.id})`).join('\n\n')}` },
      ],
    }
  }

  private async handleGetDetectChannels(args: any) {
    const { workspaceId } = args

    if (!workspaceId) {
      throw new Error('workspaceId is required')
    }

    try {
      const data = await this.roxyClient.getDetectChannels(workspaceId)

      const channelsText = data.checkChannel && data.checkChannel.length > 0
        ? data.checkChannel.map(channel => `- **${channel.label}** (${channel.value})`).join('\n')
        : 'No detect channels available'

      return {
        content: [
          {
            type: 'text',
            text: `📡 **Available IP Detection Channels**\n\n${channelsText}\n\n*These channels are used to detect proxy IP information (location, ISP, etc.).*`,
          },
        ],
      }
    }
    catch (error) {
      const formattedError = ErrorAnalyzer.formatErrorForDisplay(error instanceof Error ? error : new Error('Unknown error'))
      return {
        content: [{ type: 'text', text: formattedError }],
      }
    }
  }

  private async handleGetConnectionInfo(args: any) {
    const { dirIds } = args

    const connections = await this.roxyClient.getConnectionInfo(dirIds)

    if (connections.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: '⚠️ No opened browsers found.\n\nUse `roxy_open_browser` to open browsers first.',
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Found ${connections.length} opened browser(s):\n\n${
            connections.map(conn =>
              `**${conn.windowName || 'Unnamed'}** (${conn.dirId})\n`
              + `  - PID: ${conn.pid}\n`
              + `  - CDP WebSocket: \`${conn.ws}\`\n`
              + `  - HTTP Endpoint: \`${conn.http}\`\n`
              + `  - Core Version: ${conn.coreVersion}\n`
              + `  - Driver: ${conn.driver}`,
            ).join('\n\n')}`,
        },
      ],
    }
  }

  private async handleGetBrowserDetail(args: any) {
    const { workspaceId, dirId } = args

    if (!workspaceId || !dirId) {
      throw new Error('workspaceId and dirId are required')
    }

    const detail = await this.roxyClient.getBrowserDetail(workspaceId, dirId)

    // Save cookie count before removing cookies to save tokens
    const cookieCount = detail.cookie?.length || 0

    // Create a copy without cookies (cookies can be very large)
    const { cookie: _cookie, ...detailWithoutCookies } = detail

    // Create summary
    const summary = `**Browser Details Summary**\n\n`
      + `**ID:** \`${detail.dirId}\`\n`
      + `**Name:** ${detail.windowName}\n`
      + `**Sort Number:** ${detail.windowSortNum}\n`
      + `**Project:** ${detail.projectName} (ID: ${detail.projectId})\n`
      + `**OS:** ${detail.os} ${detail.osVersion}\n`
      + `**Core Version:** ${detail.coreVersion}\n`
      + `**Search Engine:** ${detail.searchEngine}\n`
      + `**Open Status:** ${detail.openStatus ? '✅ Opened' : '❌ Closed'}\n`
      + `**Cookies:** ${cookieCount} stored (excluded from response to save tokens)\n\n`
      + `**Full Details (JSON):**\n`
      + `\`\`\`json\n${
        JSON.stringify(detailWithoutCookies, null, 2)
      }\n\`\`\``

    return {
      content: [
        {
          type: 'text',
          text: summary,
        },
      ],
    }
  }

  private async handleUpdateBrowser(args: any) {
    const params: BrowserUpdateParams = args as BrowserUpdateParams

    if (!params.workspaceId || !params.dirId) {
      throw new Error('workspaceId and dirId are required')
    }

    await this.roxyClient.updateBrowser(params)

    return {
      content: [
        {
          type: 'text',
          text: `✅ **Browser Updated Successfully**\n\n`
            + `**Browser ID:** \`${params.dirId}\`\n`
            + `**Workspace:** ${params.workspaceId}\n\n`
            + `*Browser configuration has been updated.*`,
        },
      ],
    }
  }

  private async handleRandomFingerprint(args: any) {
    const { workspaceId, dirId } = args

    if (!workspaceId || !dirId) {
      throw new Error('workspaceId and dirId are required')
    }

    await this.roxyClient.randomBrowserFingerprint(workspaceId, dirId)

    return {
      content: [
        {
          type: 'text',
          text: `✅ **Browser Fingerprint Randomized**\n\n`
            + `**Browser ID:** \`${dirId}\`\n`
            + `**Workspace:** ${workspaceId}\n\n`
            + `*Browser fingerprint has been randomized. Restart the browser to apply changes.*`,
        },
      ],
    }
  }

  private async handleClearLocalCache(args: any) {
    const { dirIds } = args

    if (!dirIds || dirIds.length === 0) {
      throw new Error('dirIds are required')
    }

    await this.roxyClient.clearBrowserLocalCache(dirIds)

    return {
      content: [
        {
          type: 'text',
          text: `✅ **Local Cache Cleared**\n\n`
            + `**Browser Count:** ${dirIds.length}\n\n`
            + `**Browser IDs:**\n${
              dirIds.map((id: string, index: number) => `  ${index + 1}. \`${id}\``).join('\n')}`,
        },
      ],
    }
  }

  private async handleClearServerCache(args: any) {
    const { workspaceId, dirIds } = args

    if (!workspaceId || !dirIds || dirIds.length === 0) {
      throw new Error('workspaceId and dirIds are required')
    }

    await this.roxyClient.clearBrowserServerCache(workspaceId, dirIds)

    return {
      content: [
        {
          type: 'text',
          text: `✅ **Server Cache Cleared**\n\n`
            + `**Workspace:** ${workspaceId}\n`
            + `**Browser Count:** ${dirIds.length}\n\n`
            + `**Browser IDs:**\n${
              dirIds.map((id: string, index: number) => `  ${index + 1}. \`${id}\``).join('\n')}`,
        },
      ],
    }
  }

  async run() {
    // Enhanced connection testing with diagnostics
    console.error('🔗 Performing RoxyBrowser API diagnostics...')
    const diagnostics = await this.roxyClient.performDiagnostics()

    if (!diagnostics.connected) {
      console.error('❌ Failed to connect to RoxyBrowser API')
      console.error('\n📋 Diagnostic Results:')
      diagnostics.errors.forEach(error => console.error(`   ❌ ${error}`))

      if (diagnostics.recommendations.length > 0) {
        console.error('\n💡 Recommendations:')
        diagnostics.recommendations.slice(0, 5).forEach((rec, index) => {
          console.error(`   ${index + 1}. ${rec}`)
        })
      }
      process.exit(1)
    }

    if (!diagnostics.authentication) {
      console.error('❌ Authentication failed')
      console.error('\n📋 Diagnostic Results:')
      diagnostics.errors.forEach(error => console.error(`   ❌ ${error}`))

      if (diagnostics.recommendations.length > 0) {
        console.error('\n💡 Recommendations:')
        diagnostics.recommendations.slice(0, 5).forEach((rec, index) => {
          console.error(`   ${index + 1}. ${rec}`)
        })
      }
      process.exit(1)
    }

    console.error('✅ API Diagnostics Passed:')
    console.error('   ✓ Connection established')
    console.error('   ✓ Authentication successful')
    console.error(`   ✓ Workspace access: ${diagnostics.workspaceAccess ? 'Yes' : 'Limited'}`)

    console.error('🚀 Starting RoxyBrowser MCP Server...')

    const transport = new StdioServerTransport()
    await this.server.connect(transport)

    console.error('✅ RoxyBrowser MCP Server is running')
  }
}

// ========== Main ==========

async function main() {
  try {
    const server = new RoxyBrowserMCPServer()
    await server.run()
  }
  catch (error) {
    if (error instanceof ConfigError) {
      console.error(`❌ Configuration Error: ${error.message}`)
      process.exit(1)
    }

    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('\n👋 Shutting down RoxyBrowser MCP Server...')
  process.exit(0)
})

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
