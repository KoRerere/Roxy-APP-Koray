/**
 * sandbox 的 LLM transport 实现 —— `@roxy/sandbox/llm` 只做定义，真正的模型调用在此。
 *
 * 它把脚本侧规整出的 `AskRequest`（text / json）翻译成 LangChain 调用：文本走 `invoke`，
 * 带 schema 走 `withStructuredOutput(schema)`。模型由 `createLLM()` 用宿主已配置的
 * provider/model/apiKey 创建，密钥不进沙箱。
 *
 * 注入见 modes/sandbox.ts：`sbLlm.__setLlmTransport(buildLlmTransport(runId))`。
 */

import type { AskRequest, LlmTransport } from '@roxy/sandbox/llm'
import { HumanMessage } from '@langchain/core/messages'
import { createLLM } from '@/llm'

export const SANDBOX_LLM_TIMEOUT_MS = 60_000

function abortReasonToError(reason: unknown): Error {
  if (reason instanceof Error)
    return reason
  return new Error(typeof reason === 'string' ? reason : 'Sandbox LLM request aborted')
}

async function invokeWithTimeout<T>(
  invoke: (signal: AbortSignal) => Promise<T>,
  externalSignal?: AbortSignal,
): Promise<T> {
  const timeoutError = new Error(`Sandbox LLM request timed out after ${SANDBOX_LLM_TIMEOUT_MS}ms`)
  const timeoutController = new AbortController()
  const timeoutHandle = setTimeout(() => timeoutController.abort(timeoutError), SANDBOX_LLM_TIMEOUT_MS)
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutController.signal])
    : timeoutController.signal

  const aborted = new Promise<never>((_resolve, reject) => {
    if (signal.aborted) {
      reject(abortReasonToError(signal.reason))
      return
    }
    signal.addEventListener('abort', () => reject(abortReasonToError(signal.reason)), { once: true })
  })

  try {
    return await Promise.race([invoke(signal), aborted])
  }
  finally {
    clearTimeout(timeoutHandle)
  }
}

export function buildLlmTransport(runId: string): LlmTransport {
  return {
    async ask(req: AskRequest): Promise<unknown> {
      const llm = await createLLM({ enableThinking: false, turnId: runId })

      // 带 schema：结构化输出（json 后门）。withStructuredOutput 可直接吃 JSON Schema。
      if (req.schema) {
        const structured = (llm as any).withStructuredOutput(req.schema, { name: 'json' })
        return await invokeWithTimeout(
          signal => structured.invoke([new HumanMessage(req.prompt)], { signal }),
          req.options?.signal,
        )
      }

      // 纯文本
      const res = await invokeWithTimeout(
        signal => llm.invoke([new HumanMessage(req.prompt)], { signal }),
        req.options?.signal,
      )
      return typeof res.content === 'string' ? res.content : JSON.stringify(res.content)
    },
  }
}
