import { closeDatabase as closeConversationsDatabase } from './database/conversations'
import { closeDatabase } from './database/summary'

export { startServer } from './server'

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  closeDatabase()
  closeConversationsDatabase()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...')
  closeDatabase()
  closeConversationsDatabase()
  process.exit(0)
})

// // 全局异常处理 - 除了手动关闭外的各种异常情况都不让进程退出
// process.on('uncaughtException', (error) => {
//   console.error('❌ Uncaught Exception:', error);
//   // 不退出进程，只打印错误
// });

// process.on('unhandledRejection', (reason, promise) => {
//   console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
//   // 不退出进程，只打印错误
// });

// // 处理其他可能的异步错误
// process.on('warning', (warning) => {
//   console.warn('⚠️  Warning:', warning);
// });
