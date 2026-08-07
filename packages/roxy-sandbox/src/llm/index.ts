/**
 * `@roxybrowser/sandbox/llm` — 调用大模型。**只做定义 + 转发**。
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
 * 设计边界（重要）：
 * - **本模块不实现任何模型调用**。它只定义脚本侧的 API，并把每次调用规整成一个
 *   `AskRequest` **原样转发**给宿主注入的 `LlmTransport`。prompt 构造、模型调用、
 *   结构化输出与解析——**全部由宿主实现**（宿主已配置 provider/model/apiKey，
 *   密钥永不进脚本）。
 * - 未注入 transport 时调用会抛出清晰错误（而非静默失败）。
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
  schema?: object
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

// ── 宿主注入的传输实现（模块私有）──
let hostTransport: LlmTransport | undefined

/**
 * 宿主专用：注入真实 LLM 传输实现。**不是给脚本调用的**——脚本用 `ask` / `json`。
 */
export function __setLlmTransport(impl: LlmTransport): void {
  hostTransport = impl
}

function requireTransport(): LlmTransport {
  if (!hostTransport) {
    throw new Error(
      '[@roxybrowser/sandbox/llm] LLM 能力不可用：宿主未注入传输实现。'
      + '（该模块需由 sandbox 运行时装配，无法脱离宿主直接运行。）',
    )
  }
  return hostTransport
}

/** 文本：给定 prompt，返回模型生成的纯文本。 */
export function ask(prompt: string, opts?: LlmCallOptions): Promise<string> {
  return requireTransport().ask({ prompt, options: opts }) as Promise<string>
}

/**
 * 后门：给定 prompt 与完整 JSON Schema，返回符合 schema 的对象。
 */
export function json<T = unknown>(prompt: string, schema: object, opts?: LlmCallOptions): Promise<T> {
  return requireTransport().ask({ prompt, schema, options: opts }) as Promise<T>
}
