import type { HandleLLMNewTokenCallbackFields, NewTokenIndices } from '@langchain/core/callbacks/base'
import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import { streamAdapter } from '../../server/streamAdapter'

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

  // TODO: 暂时没有见过有这种格式，先注释掉。
  // if (usage.input_tokens !== undefined || usage.output_tokens !== undefined) {
  //   return {
  //     input_tokens: usage.input_tokens ?? 0,
  //     output_tokens: usage.output_tokens ?? 0,
  //     total_tokens: usage.total_tokens ?? (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
  //   };
  // }

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

// export class UsageAggregator extends BaseCallbackHandler {
//   name = 'usage_aggregator'
//   usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
//   private writer?: (data: string) => void

//   constructor(writer?: (data: string) => void) {
//     super()
//     this.writer = writer
//   }

//   handleLLMEnd(output: any) {
//     // 尝试从多个可能的位置获取 token usage 信息
//     // 1. llmOutput.tokenUsage (LangChain 标准格式)
//     // 2. llmOutput.usage (某些 provider)
//     // 3. llmOutput.usage_metadata (某些 provider)
//     // 4. response_metadata.usage (OpenAI/OpenRouter 格式，在 chunk 中)
//     // 5. 直接从 output 对象查找
//     const rawUsage = output?.llmOutput?.tokenUsage

//     const normalizedUsage = normalizeUsage(rawUsage)

//     if (normalizedUsage) {
//       const previousUsage = { ...this.usage }
//       this.usage = addUsage(this.usage, normalizedUsage)

//       // 实时推送 token usage 更新
//       if (this.writer) {
//         this.writer(streamAdapter.tokenUsage({
//           current: this.usage,
//           delta: {
//             input_tokens: this.usage.input_tokens - previousUsage.input_tokens,
//             output_tokens: this.usage.output_tokens - previousUsage.output_tokens,
//             total_tokens: this.usage.total_tokens - previousUsage.total_tokens,
//           },
//         }))
//       }
//     }
//   }

//   /**
//    * 处理流式 chunk 中的 token usage 信息
//    * 某些 provider 会在每个 chunk 的 response_metadata 中包含 usage
//    */
//   handleLLMNewToken(token: any) {
//     // 检查 chunk 中是否包含 usage 信息
//     const rawUsage = token?.response_metadata?.usage
//     const normalizedUsage = normalizeUsage(rawUsage)

//     if (normalizedUsage) {
//       const previousUsage = { ...this.usage }
//       this.usage = addUsage(this.usage, normalizedUsage)

//       // 实时推送 token usage 更新
//       if (this.writer) {
//         this.writer(streamAdapter.tokenUsage({
//           current: this.usage,
//           delta: {
//             input_tokens: this.usage.input_tokens - previousUsage.input_tokens,
//             output_tokens: this.usage.output_tokens - previousUsage.output_tokens,
//             total_tokens: this.usage.total_tokens - previousUsage.total_tokens,
//           },
//         }))
//       }
//     }
//   }

//   getUsage(): TokenUsage {
//     return { ...this.usage }
//   }

//   reset() {
//     this.usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
//   }
// }

export class TokenUsageChange extends BaseCallbackHandler {
  name = 'TokenUsageChange'
  constructor() {
    super()
  }

  handleLLMEnd(output: any) {
    if (!output?.llmOutput) {
      return
    }

    const rawUsage = output?.llmOutput?.tokenUsage

    const normalizedUsage = normalizeUsage(rawUsage)

    if (normalizedUsage) {
      process.parentPort?.postMessage({ event: 'token_usage_change', data: normalizedUsage })
    }
  }
}
