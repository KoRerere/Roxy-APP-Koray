/**
 * Worker 模式：作为子 worker 被主 orchestrator 调用。
 * 需求尚未明确，当前为占位存根，保留架构位置。
 *
 * Future: 通过 parentPort / stdin 接收任务，执行后返回结果
 */
export async function runWorkerMode(): Promise<() => Promise<void>> {
  console.log('[mode:worker] Worker mode is not yet implemented.')
  // process.parentPort?.on('message', handleWorkOrder)

  return async function shutdown() {
    console.log('[mode:worker] Shutting down worker...')
  }
}
