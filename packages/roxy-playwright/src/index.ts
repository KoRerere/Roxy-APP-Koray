import { createConnection } from '@roxybrowser/playwright-mcp'

createConnection({
  allowUnrestrictedFileAccess: true,
  outputDir: process.env.ROXY_PLAYWRIGHT_OUTPUT_DIR,
})
