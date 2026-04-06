import { runServer } from '@roxybrowser/openapi'

runServer().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
