import assert from 'node:assert/strict'
import test from 'node:test'
import { getMcpConfigErrorMessage, getMcpErrorMessage, isValidMcpHttpUrl } from './mcpErrorMessage'

(globalThis as typeof globalThis & { $t: (key: string) => string }).$t = key => key

test('maps structured Zod URL errors to a controlled message', () => {
  const error = `[
    {
      "validation": "url",
      "code": "invalid_string",
      "message": "Invalid url",
      "path": ["mcpServers", "测试服务", "url"]
    }
  ]`

  assert.equal(
    getMcpErrorMessage(error),
    'URL格式有误，必须以 http:// 或 https:// 开头',
  )
})

test('maps common HTTP MCP failures without exposing raw errors', () => {
  assert.equal(
    getMcpErrorMessage('Request failed with status code 401'),
    'MCP 身份验证失败，请检查 HTTP 请求头中的认证信息',
  )
  assert.equal(
    getMcpErrorMessage('connect ECONNREFUSED 127.0.0.1:3000'),
    'MCP 服务无法访问，请检查 URL 和网络连接',
  )
  assert.equal(
    getMcpErrorMessage('Request timed out after 30 seconds'),
    'MCP 服务连接超时，请稍后重试',
  )
  assert.equal(
    getMcpErrorMessage('sensitive unclassified internal detail'),
    'MCP 服务操作失败，请稍后重试',
  )
})

test('uses transport-specific fallback messages for save and validation', () => {
  assert.equal(
    getMcpConfigErrorMessage('unknown error', 'stdio', 'validate'),
    'MCP 服务验证失败，请检查名称、命令和环境变量后重试',
  )
  assert.equal(
    getMcpConfigErrorMessage('unknown error', 'http', 'validate'),
    'MCP 服务验证失败，请检查名称、URL 和 HTTP 请求头后重试',
  )
  assert.equal(
    getMcpConfigErrorMessage('unknown error', 'stdio', 'save'),
    'MCP 服务保存失败，请检查名称、命令和环境变量后重试',
  )
  assert.equal(
    getMcpConfigErrorMessage('unknown error', 'http', 'save'),
    'MCP 服务保存失败，请检查名称、URL 和 HTTP 请求头后重试',
  )
})

test('accepts only complete HTTP or HTTPS URLs', () => {
  assert.equal(isValidMcpHttpUrl('https://mcp.example.com/api'), true)
  assert.equal(isValidMcpHttpUrl(' http://127.0.0.1:3000/mcp '), true)
  assert.equal(isValidMcpHttpUrl('啊啊啊'), false)
  assert.equal(isValidMcpHttpUrl('ftp://example.com'), false)
})
