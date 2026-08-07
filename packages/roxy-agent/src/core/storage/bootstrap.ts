// 存储迁移引导：必须在任何会在模块加载期打开文件的模块（logger / conversations DB /
// schedules DB / mcpManager 等）之前执行，因此本模块被 index.ts 作为首个 import 引入，
// 在其 top-level 同步触发一次性迁移。
import { runStorageMigration } from './migrate'

// sandbox 模式运行在受限文件系统权限下（仅可写自身 output/logs 目录），不触碰共享存储，
// 迁移对它既无意义又会因 mkdir agent 数据根目录而触发 ERR_ACCESS_DENIED。故跳过。
// 迁移仍由 agent/worker 模式（父进程侧）负责执行。
if (process.env.ROXY_MODE !== 'sandbox')
  runStorageMigration()
