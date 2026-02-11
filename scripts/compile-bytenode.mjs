import bytenode from 'bytenode'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const root = path.resolve(__dirname, '..')

await bytenode.compileFile({
  filename: path.join(root, 'packages/roxy-agent/dist/index.cjs'),
  output: path.join(root, 'packages/roxy-agent/dist/agent-worker.jsc'),
})

console.log('roxy-agent compiled')

await bytenode.compileFile({
  filename: path.join(root, 'packages/roxybrowser-playwright-mcp/dist/index.cjs'),
  output: path.join(root, 'packages/roxybrowser-playwright-mcp/dist/roxybrowser-playwright-mcp.jsc'),
})

console.log('roxybrowser-playwright-mcp compiled')

await bytenode.compileFile({
  filename: path.join(root, 'packages/roxybrowser-mcp-server/dist/index.cjs'),
  output: path.join(root, 'packages/roxybrowser-mcp-server/dist/roxybrowser-openapi-mcp.jsc'),
})

console.log('roxybrowser-openapi-mcp compiled')

process.exit(0)
