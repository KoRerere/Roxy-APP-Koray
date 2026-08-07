/**
 * 管理 HITL interrupt 的决策等待
 * 当 agent stream 遇到 __interrupt__ 时，注册一个 Promise 并等待
 * 前端调用 resume 端点后，resolve Promise 继续执行
 */

export interface InterruptDecision {
  decisions: Array<{
    type: 'approve' | 'reject' | 'edit'
    reason?: string
    editedAction?: {
      name: string
      args: any
    }
  }>
}

interface PendingInterrupt {
  resolve: (decision: InterruptDecision) => void
  reject: (error: Error) => void
}

const registry = new Map<string, PendingInterrupt>()

/**
 * 创建一个等待用户决策的 Promise
 */
export function createInterruptGate(conversationId: string): Promise<InterruptDecision> {
  return new Promise((resolve, reject) => {
    registry.set(conversationId, { resolve, reject })
  })
}

/**
 * 用户提交决策后，resolve 对应的 Promise
 */
export function resolveInterrupt(conversationId: string, decision: InterruptDecision): boolean {
  const pending = registry.get(conversationId)
  if (!pending)
    return false
  registry.delete(conversationId)
  pending.resolve(decision)
  return true
}

/**
 * 检查是否有等待中的 interrupt
 */
export function hasPendingInterrupt(conversationId: string): boolean {
  return registry.has(conversationId)
}

/**
 * 取消等待（例如连接断开时）
 */
export function cancelInterrupt(conversationId: string): void {
  const pending = registry.get(conversationId)
  if (!pending) {
    return
  }

  registry.delete(conversationId)
  pending.reject(new Error('User cancelled'))
}
