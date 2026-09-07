/**
 * Sandbox 的宿主侧 LLM transport 实现。
 *
 * 它把脚本侧规整出的 `AskRequest`（text / json）翻译成 runtime provider 调用，
 * 密钥只存在宿主进程，不会进入沙箱。
 *
 * 每次 sandbox run 创建一个独立 transport，并由 modes/sandbox.ts 注入脚本 API。
 */

import type { AskRequest, LlmTransport } from './llm'
import type { Message } from 'roxy-agent-runtime'
import { OpenAIResponsesProvider } from 'roxy-agent-runtime'
import { aiAgentResponsesUrl, aiAgentToken } from '@/config'
import { getRuntimeModel } from '@/runtime/provider'

export const SANDBOX_LLM_TIMEOUT_MS = 60_000

function abortReasonToError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason
  }
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

function extractTextContent(content: Message['content']): string {
  if (typeof content === 'string') {
    if (!content.trim()) {
      throw new Error('Sandbox LLM ask returned no text content')
    }
    return content
  }

  const text = content
    .filter((block): block is Extract<(typeof content)[number], { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')

  if (!text.trim()) {
    throw new Error('Sandbox LLM ask returned no text content')
  }
  return text
}

export function buildLlmTransport(runId: string): LlmTransport {
  return {
    async ask(req: AskRequest): Promise<unknown> {
      const { model, headers } = await getRuntimeModel({ turnId: runId })
      const provider = new OpenAIResponsesProvider({
        model: req.options?.model ?? model,
        apiKey: aiAgentToken,
        baseURL: aiAgentResponsesUrl,
        defaultHeaders: headers,
        reasoning: { effort: 'none' },
      })

      // 带 schema：使用 Responses API 的强制 function call，同时保留脚本传入的
      // 原始 JSON Schema，避免 JSON 文本模式下出现数字被序列化为字符串的问题。
      if (req.schema) {
        const extract = provider.withJsonSchemaOutput(req.schema, {
          name: 'json',
          method: 'functionCalling',
          ...(req.options?.temperature !== undefined ? { temperature: req.options.temperature } : {}),
          ...(req.options?.maxTokens !== undefined ? { maxTokens: req.options.maxTokens } : {}),
        })
        return await invokeWithTimeout(
          signal => extract(req.prompt, signal),
          req.options?.signal,
        )
      }

      // 纯文本
      const res = await invokeWithTimeout(
        signal => provider.invoke({
          model: req.options?.model ?? model,
          messages: [{ role: 'user', content: req.prompt }],
          maxTokens: req.options?.maxTokens ?? 16384,
          ...(req.options?.temperature !== undefined ? { temperature: req.options.temperature } : {}),
        }, signal),
        req.options?.signal,
      )
      return extractTextContent(res.message.content)
    },
  }
}
