export { startServer } from './server'

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
