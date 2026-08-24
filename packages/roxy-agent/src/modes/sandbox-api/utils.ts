/**
 * `@roxybrowser/sandbox/utils` — 纯确定性工具（无网络、无密钥、免费）。
 *
 * 分层归类：**内置纯函数**。脚本里可随意调用，不计费、不阻塞宿主。
 * 设计约定：零配置、具名导入、命名贴合 JS 先验（sleep / pick / retry …）。
 */

/**
 * 随机等待 `[min, max]` 毫秒（含端点）。用于替代固定 `waitForTimeout`，制造拟人节奏。
 * @example await sleep(500, 1500)
 */
export function sleep(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** 返回 `[min, max]` 内的随机整数（含端点）。用于滚动距离、索引、次数等。 */
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** 从数组中等概率随机取一个元素。用于关键词、评论、用户名等。 */
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** 以概率 `probability ∈ [0, 1]` 返回 `true`。用于可选动作（如 70% 概率点赞）。 */
export function maybe(probability: number): boolean {
  return Math.random() < probability
}

/** 把数组按固定长度切分成若干块。用于分页 / 分批处理。 */
export function chunk<T>(arr: readonly T[], size: number): T[][] {
  if (size <= 0) {
    throw new RangeError('chunk size must be > 0')
  }
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size))
  }
  return out
}

export interface RetryOptions {
  /** 最大尝试次数（含首次）。默认 3。 */
  attempts?: number
  /** 首次重试前的基础延迟（ms）。默认 500。 */
  baseDelay?: number
  /** 退避因子：第 n 次重试延迟 = baseDelay * factor^(n-1)。默认 2（指数退避）。 */
  factor?: number
  /** 每次失败后的回调（可用于日志）。 */
  onRetry?: (error: unknown, attempt: number) => void
}

/**
 * 带指数退避的重试。适合偶发网络/渲染抖动的操作（如 waitForSelector、点击）。
 * 所有尝试都失败时抛出最后一次的错误。
 * @example const el = await retry(() => page.waitForSelector('#x', { timeout: 5000 }))
 */
export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { attempts = 3, baseDelay = 500, factor = 2, onRetry } = opts
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    }
    catch (err) {
      lastError = err
      if (attempt < attempts) {
        onRetry?.(err, attempt)
        const delay = baseDelay * factor ** (attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}
