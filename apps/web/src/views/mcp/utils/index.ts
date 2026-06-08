export { fetchSSE, withTimeout } from './fetch'
export { markedParse } from './markdown'
export {
  MessageViewer,
  parseHistoryImageSSE,
  parseHistorySSE2,
} from './message-viewer'
export {
  createSSEProcessContext,
  finalizeMessageBlocks,
  finalizeWorkerTasks,
  isHiddenToolEvent,
  markPendingAsFailed,
  normalizeWorkerStatus,
  parseHistorySSE,
  parseSSEBlock,
  parseSSEContentString,
  processSSEEvent,
  type SSEParsedEvent,
  type SSEProcessContext,
} from './sse'

/**
 * 将 6 位 Hex 颜色转换为带透明度的 8 位 Hex 颜色
 * @param {string} hex - 6位的十六进制颜色值 (例如: '#1DC94D' 或 'FC9D12')
 * @param {number} alpha - 透明度，支持 0~1 的小数 或 0~100 的百分比数字
 * @returns {string} 8位的十六进制颜色值 (例如: '#1DC94D26')
 */
export function getHexWithAlpha(hex: string, alpha: number): string {
  // 1. 清理输入的 hex 字符串，去掉开头的 # 并转为大写
  const cleanHex = hex.replace(/^#/, '').toUpperCase()

  // 如果输入的不是标准的 6 位 Hex，直接返回原值或抛出错误
  if (cleanHex.length !== 6) {
    console.warn('输入的 Hex 颜色格式不正确，请输入 6 位字符。')
    return hex
  }

  // 2. 处理透明度：如果传入的是大于 1 的数（比如 15），则认为是百分比，自动除以 100
  let parsedAlpha = alpha > 1 ? alpha / 100 : alpha

  // 限制透明度范围在 0 到 1 之间
  parsedAlpha = Math.max(0, Math.min(1, parsedAlpha))

  // 3. 计算十进制对应的 Alpha 值 (0-255)，并进行四舍五入
  const alphaDecimal = Math.round(parsedAlpha * 255)

  // 4. 转换为十六进制字符串
  let alphaHex = alphaDecimal.toString(16).toUpperCase()

  // 如果生成的是个位数（比如 0~15 转换为 hex 后是 0~F），前面需要补个 0
  if (alphaHex.length === 1) {
    alphaHex = `0${alphaHex}`
  }

  // 5. 拼接并返回最终的 8 位 Hex
  return `#${cleanHex}${alphaHex}`
}
