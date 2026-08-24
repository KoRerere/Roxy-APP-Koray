/**
 * `@roxybrowser/sandbox/llm` — 调用大模型。
 *
 * 两个函数：`ask`（文本）+ `json` 后门（显式 JSON Schema → 结构化对象）。
 *
 * ```ts
 * import { ask, json } from '@roxybrowser/sandbox/llm'
 *
 * const reply = await ask('给这条评论写一句友好回复：' + comment)   // string
 *
 * // 需要结构化时，传完整 JSON Schema
 * const data = await json<{ price: number }>(prompt, {
 *   type: 'object', properties: { price: { type: 'number' } }, required: ['price'],
 * })
 * ```
 *
 * 宿主为每次 sandbox run 创建一个闭包 API，并在闭包内实现 transport 调用。
 * provider/model/apiKey 始终留在宿主进程，不暴露给脚本。
 */

/** 单次调用可带的参数。 */
export interface LlmCallOptions {
  /** 模型标识；缺省用宿主默认模型。 */
  model?: string
  /** 采样温度（0~2）。结构化任务建议低温度。 */
  temperature?: number
  /** 最大生成 token 数。 */
  maxTokens?: number
  /** 中止信号——脚本被 abort 时应一并取消本次调用。 */
  signal?: AbortSignal
}

/**
 * 规整后的请求描述：`ask` / `json` 的调用都归一成它，**原样转发**给宿主。
 * - 只有 `prompt` → 文本补全；
 * - `prompt` + `schema` → 结构化（返回符合 JSON Schema 的对象）。
 */
export interface AskRequest {
  /** 指令 / 问题。 */
  prompt: string
  /** 结构化输出的完整 JSON Schema（`json()` 后门传入）。 */
  schema?: Record<string, unknown>
  /** 调用参数。 */
  options?: LlmCallOptions
}

/**
 * 宿主注入的传输契约——**唯一需要宿主实现的东西**。宿主用已配置的 LLM client 解释
 * `AskRequest` 并返回结果（文本时为 string，带 schema 时为符合该 schema 的对象）。
 */
export interface LlmTransport {
  ask: (req: AskRequest) => Promise<unknown>
}

export interface SandboxLlmApi {
  ask: (prompt: string, opts?: LlmCallOptions) => Promise<string>
  json: <T = unknown>(prompt: string, schema: Record<string, unknown>, opts?: LlmCallOptions) => Promise<T>
}

/** Create the script-facing LLM API for one sandbox run. */
export function createLlmApi(transport: LlmTransport): SandboxLlmApi {
  return {
    ask: async (prompt, options) => {
      const value = await transport.ask({ prompt, options })
      if (typeof value !== 'string') {
        throw new Error('@roxybrowser/sandbox/llm.ask returned a non-text result')
      }
      return value
    },
    json: async <T = unknown>(prompt: string, schema: Record<string, unknown>, options?: LlmCallOptions) =>
      transport.ask({ prompt, schema, options }) as Promise<T>,
  }
}
