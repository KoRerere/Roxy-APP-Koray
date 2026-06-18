/**
 * MCP 管理 API 路由
 *
 * GET    /api/mcp/servers              — 获取所有用户自定义 MCP 列表
 * POST   /api/mcp/servers              — 新增 / 更新 MCP 配置（不自动启用）
 * DELETE /api/mcp/servers/:name        — 删除 MCP 配置
 * POST   /api/mcp/servers/:name/enable  — 启用并测试连通性
 * POST   /api/mcp/servers/:name/disable — 禁用
 * POST   /api/mcp/servers/:name/test    — 仅测试连通性，不改变 enabled 状态
 * POST   /api/mcp/servers/import        — 从 Claude Desktop JSON 格式批量导入（同名覆盖）
 */

import type { UserMcpServerConfig } from '@/core/mcp/mcpManager'
import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { mcpManager } from '@/core/mcp/mcpManager'

const router: Router = Router()

// config 结构由 mcpManager 内部按 transport 类型细校验，这里仅约束顶层形状
const UpsertServerSchema = z.object({
  name: z.string({ error: 'name is required' }).min(1, 'name is required'),
  config: z.record(z.string(), z.any()),
  oldName: z.string().optional(),
})

const ImportSchema = z.object({
  mcpServers: z.record(z.string(), z.any(), { error: 'mcpServers is required' }),
})

/**
 * GET /api/mcp/servers
 * 返回所有用户自定义 MCP 配置及状态
 */
router.get('/servers', (_req: Request, res: Response) => {
  try {
    const servers = mcpManager.listAllMcpServers()
    res.json({ code: 0, data: servers })
  }
  catch (err: any) {
    res.json({ code: 1, msg: err.message })
  }
})

/**
 * POST /api/mcp/servers
 * Body: { name: string, config: UserMcpServerConfig }
 * 新增或更新单个 MCP 配置（不自动启用）
 *
 * config 字段说明：
 *   stdio 类型：{ command: string, args?: string[], env?: Record<string,string> }
 *   http 类型：{ url: string, headers?: Record<string,string>, type?: 'http' }
 */
router.post('/servers', async (req: Request, res: Response) => {
  const parsed = UpsertServerSchema.safeParse(req.body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const msg = issue?.path?.[0] === 'config' ? 'config is required' : 'name is required'
    return res.json({ code: 1, msg })
  }
  try {
    const { name, config, oldName } = parsed.data
    if (oldName && oldName !== name) {
      await mcpManager.renameUserMcpServer(oldName, name, config as UserMcpServerConfig)
    }
    else {
      await mcpManager.upsertUserMcpServer(name, config as UserMcpServerConfig, true)
    }
    res.json({ code: 0, msg: 'MCP server saved' })
  }
  catch (err: any) {
    res.json({ code: 1, msg: err.message })
  }
})

/**
 * POST /api/mcp/servers/import
 * 从 Claude Desktop 标准 JSON 格式批量导入，同名覆盖，自动启用
 *
 * Body: {
 *   mcpServers: {
 *     [name: string]: {
 *       command?: string, args?: string[], env?: Record<string,string>,  // stdio
 *       url?: string, headers?: Record<string,string>,                   // http
 *       type?: 'stdio' | 'http'
 *     }
 *   }
 * }
 *
 * 返回导入结果：{ imported: string[], skipped: string[], errors: {name, reason}[] }
 */
router.post('/servers/import', async (req: Request, res: Response) => {
  const parsed = ImportSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.json({ code: 1, msg: 'mcpServers is required' })
  }
  try {
    const { mcpServers } = parsed.data
    const imported: string[] = []
    const errors: { name: string, reason: string }[] = []

    for (const [name, rawConfig] of Object.entries(mcpServers)) {
      if (!name || typeof name !== 'string') {
        continue
      }
      if (!rawConfig || typeof rawConfig !== 'object') {
        errors.push({ name, reason: 'invalid config' })
        continue
      }

      const config = rawConfig as UserMcpServerConfig

      // 基本校验：stdio 需要 command，http/sse 需要 url
      const type = config.type ?? (config.command ? 'stdio' : config.url ? 'sse' : undefined)
      if (!type) {
        errors.push({ name, reason: 'cannot determine transport type: provide command (stdio) or url (http/sse)' })
        continue
      }
      if (type === 'stdio' && !config.command) {
        errors.push({ name, reason: 'stdio transport requires "command"' })
        continue
      }
      if ((type === 'sse' || type === 'http') && !config.url) {
        errors.push({ name, reason: `${type} transport requires "url"` })
        continue
      }

      try {
        await mcpManager.upsertUserMcpServer(name, config, true)
        imported.push(name)
      }
      catch (err: any) {
        errors.push({ name, reason: err.message })
      }
    }

    res.json({
      code: errors.length > 0 && imported.length === 0 ? 1 : 0,
      msg: `Imported ${imported.length} server(s)${errors.length > 0 ? `, ${errors.length} error(s)` : ''}`,
      data: { imported, errors },
    })
  }
  catch (err: any) {
    res.json({ code: 1, msg: err.message })
  }
})

/**
 * DELETE /api/mcp/servers/:name
 * 删除 MCP 配置（同时断开连接）
 */
router.delete('/servers/:name', async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string
    await mcpManager.removeUserMcpServer(name)
    res.json({ code: 0, msg: 'MCP server removed' })
  }
  catch (err: any) {
    res.json({ code: 1, msg: err.message })
  }
})

/**
 * POST /api/mcp/servers/:name/enable
 * 启用 MCP：尝试连接并获取工具，返回连接结果
 * 连接成功才标记为 enabled
 */
router.post('/servers/:name/enable', async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string
    const result = await mcpManager.enableUserMcpServer(name)
    res.json({
      code: result.success ? 0 : 1,
      msg: result.success ? 'MCP server enabled' : result.error,
      data: result,
    })
  }
  catch (err: any) {
    res.json({ code: 1, msg: err.message })
  }
})

/**
 * POST /api/mcp/servers/:name/disable
 * 禁用 MCP，断开连接
 */
router.post('/servers/:name/disable', async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string
    await mcpManager.disableUserMcpServer(name)
    res.json({ code: 0, msg: 'MCP server disabled' })
  }
  catch (err: any) {
    res.json({ code: 1, msg: err.message })
  }
})

/**
 * POST /api/mcp/servers/:name/test
 * 测试 MCP 连通性（不改变 enabled 状态，测试完立即关闭临时连接）
 *
 * Body (可选): { config: UserMcpServerConfig }
 * - 如果传了 config，直接测试该配置
 * - 如果没传 config，测试已保存的配置
 */
router.post('/servers/:name/test', async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string
    const { config } = req.body

    let result
    if (config) {
      // 直接测试传入的配置
      result = await mcpManager.testUserMcpServerConfig(name, config)
    }
    else {
      // 测试已保存的配置
      result = await mcpManager.testUserMcpServer(name)
    }

    res.json({
      code: result.success ? 0 : 1,
      msg: result.success ? 'Connection successful' : result.error,
      data: result,
    })
  }
  catch (err: any) {
    res.json({ code: 1, msg: err.message })
  }
})

export default router
