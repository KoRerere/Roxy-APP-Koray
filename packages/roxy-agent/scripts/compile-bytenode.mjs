import bytenode from 'bytenode'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const agentRoot = path.resolve(__dirname, '..')

await bytenode.compileFile({
  filename: path.join(agentRoot, 'dist/index.cjs'),
  output: path.join(agentRoot, 'dist/agent-worker.jsc'),
})

process.exit(0)
