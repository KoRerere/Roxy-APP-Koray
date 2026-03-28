import { BaseCallbackHandler } from '@langchain/core/callbacks/base'

interface TokenUsage {
  input_tokens: number
  output_tokens: number
  total_tokens: number
}

function addUsage(a: TokenUsage, b?: Partial<TokenUsage>) {
  if (!b)
    return a
  return {
    input_tokens: a.input_tokens + (b.input_tokens ?? 0),
    output_tokens: a.output_tokens + (b.output_tokens ?? 0),
    total_tokens: a.total_tokens + (b.total_tokens ?? 0),
  }
}

/**
 * 标准化 token usage 数据，处理不同 provider 的字段名差异
 * 支持 prompt_tokens/completion_tokens 和 input_tokens/output_tokens 两种格式
 */
function normalizeUsage(usage: any): Partial<TokenUsage> | null {
  if (!usage)
    return null

  if (usage.input_tokens !== undefined || usage.output_tokens !== undefined) {
    return {
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      total_tokens: usage.total_tokens ?? (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
    }
  }

  // 处理 OpenAI/OpenRouter 格式 (prompt_tokens/completion_tokens)
  if (usage.promptTokens !== undefined || usage.completionTokens !== undefined) {
    return {
      input_tokens: usage.promptTokens ?? 0,
      output_tokens: usage.completionTokens ?? 0,
      total_tokens: usage.totalTokens ?? (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0),
    }
  }

  return null
}

/**
 * 全局统计器注册表
 * 用于在 TokenUsageChange 中通知活跃的统计器
 */
const activeAggregators = new Map<string, RequestTokenUsageAggregator>()

/**
 * 单次请求的 token 使用量统计器
 * 用于统计从用户发起请求到 AI 完成本次请求过程中消耗的 token
 */
export class RequestTokenUsageAggregator {
  private usage: TokenUsage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 }

  constructor(private threadId: string) {
    // 注册到全局统计器注册表
    activeAggregators.set(threadId, this)
  }

  /**
   * 添加 token 使用量（由 TokenUsageChange 调用）
   */
  addUsage(usage: Partial<TokenUsage>) {
    this.usage = addUsage(this.usage, usage)
  }

  /**
   * 获取当前累计的 token 使用量
   */
  getUsage(): TokenUsage {
    return { ...this.usage }
  }

  /**
   * 重置统计
   */
  reset() {
    this.usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
  }

  /**
   * 清理资源，从全局注册表中移除
   */
  dispose() {
    activeAggregators.delete(this.threadId)
  }
}

/**
 * 获取指定 thread_id 的统计器
 */
export function getAggregator(threadId: string): RequestTokenUsageAggregator | undefined {
  return activeAggregators.get(threadId)
}

export class TokenUsageChange extends BaseCallbackHandler {
  name = 'TokenUsageChange'
  private threadId?: string

  constructor(threadId?: string) {
    super()
    this.threadId = threadId
  }

  handleLLMEnd(output: any) {
    if (!output?.llmOutput && !output.generations) {
      return
    }

    const message = output.generations?.[0]?.[0]?.message
    let rawUsage = null
    if (message) {
      rawUsage = message?.usage_metadata ?? message?.kwargs?.usage_metadata ?? message?.lc_kwargs?.usage_metadata
    }
    else {
      rawUsage = output?.llmOutput?.tokenUsage
    }

    if (!rawUsage) {
      console.log('no rawUsage', output)
      return
    }

    const normalizedUsage = normalizeUsage(rawUsage)

    if (normalizedUsage) {
      // 发送给主进程用于扣钱
      (process as any).parentPort?.postMessage({ event: 'token_usage_change', data: normalizedUsage })

      // 如果提供了 threadId，通知对应的统计器
      if (this.threadId) {
        const aggregator = getAggregator(this.threadId)
        if (aggregator) {
          aggregator.addUsage(normalizedUsage)
        }
      }
    }
  }
}
