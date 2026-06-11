import { createConnection } from '@roxybrowser/playwright-mcp'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'

function writeErrorLog(tag: string, err: unknown): void {
  const dir = process.env.CHECKPOINT_DIR || process.env.ROXY_PLAYWRIGHT_OUTPUT_DIR || '.'
  const msg = `[${new Date().toISOString()}] [playwright-mcp] ${tag}: ${
    err instanceof Error ? err.stack : String(err)
  }\n`
  try {
    appendFileSync(join(dir, 'playwright-mcp-crash.log'), msg)
  }
  catch { /* ignore */ }
  process.stderr.write(msg)
}

process.on('uncaughtException', (err) => {
  writeErrorLog('uncaughtException', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  writeErrorLog('unhandledRejection', reason)
  process.exit(1)
})

;(async () => {
  try {
    await createConnection({
      allowUnrestrictedFileAccess: true,
      outputDir: process.env.ROXY_PLAYWRIGHT_OUTPUT_DIR,
    })
  }
  catch (err) {
    writeErrorLog('createConnection failed', err)
    process.exit(1)
  }
})()
