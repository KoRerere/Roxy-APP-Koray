import pLimit from 'p-limit'

/**
 * @napi-rs/canvas（Skia 原生模块）非线程安全。
 * 批量开窗口时并发 loadImage / encode 会在 macOS libuv-worker 线程中触发 SIGSEGV。
 */
const canvasOperationLimit = pLimit(1)

export function withCanvasLock<T>(operation: () => Promise<T>): Promise<T> {
  return canvasOperationLimit(operation)
}
