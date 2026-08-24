import type { RuntimeRetryEvent } from './retrying-provider'
import type { AiAgentModelConfig } from '@/api/agentApiClient'
import type { IModelProvider } from 'roxy-agent-runtime'
import { OpenAIResponsesProvider } from 'roxy-agent-runtime'
import { agentModelApi } from '@/api/agentApiClient'
import { aiAgentResponsesUrl, aiAgentToken, env } from '@/config'
import { retryRuntimeOperation, withRuntimeNetworkRetry } from './retrying-provider'

interface CachedRuntimeModel {
  model: string
  modelInfo: AiAgentModelConfig
}

interface RuntimeModelOptions {
  conversationId?: string
  turnId?: string
  signal?: AbortSignal
  onRetry?: (event: RuntimeRetryEvent) => void
}

const runtimeModelCache = new Map<string, CachedRuntimeModel>()
const runtimeModelPending = new Map<string, Promise<CachedRuntimeModel>>()
let runtimeModelCacheGeneration = 0

function runtimeModelCacheKey(): string {
  return `${env.ROXY_USER_ID ?? ''}:${env.ROXY_WORKSPACE_ID ?? ''}`
}

function createModelRequestHeaders(options: {
  conversationId?: string
  turnId?: string
}): Record<string, string> {
  return {
    ...(options.conversationId ? { 'Conversation-Id': options.conversationId } : {}),
    ...(options.turnId ? { 'Turn-Id': options.turnId } : {}),
    'ai-agent-version': env.AI_AGENT_VERSION,
  }
}

/** Clears the process-local model cache, primarily for account/model changes and tests. */
export function clearRuntimeModelCache(): void {
  runtimeModelCacheGeneration++
  runtimeModelCache.clear()
  runtimeModelPending.clear()
}

export async function getRuntimeModel(options: RuntimeModelOptions = {}) {
  const headers = createModelRequestHeaders(options)
  const cacheKey = runtimeModelCacheKey()
  const cached = runtimeModelCache.get(cacheKey)
  if (cached) {
    return { ...cached, headers }
  }

  let pending = runtimeModelPending.get(cacheKey)
  if (!pending) {
    const requestGeneration = runtimeModelCacheGeneration
    pending = retryRuntimeOperation(
      () => agentModelApi.getUserModel({ headers, signal: options.signal }),
      { onRetry: options.onRetry },
      options.signal,
    ).then((modelInfo) => {
      const info = modelInfo.vlm_model ?? modelInfo.text_model
      const model = info?.model
      if (!info || !model) {
        throw new Error('获取模型信息失败')
      }

      const resolved: CachedRuntimeModel = { model, modelInfo: info }
      if (runtimeModelCacheGeneration === requestGeneration) {
        runtimeModelCache.set(cacheKey, resolved)
      }
      return resolved
    })
    runtimeModelPending.set(cacheKey, pending)
    pending.then(
      () => {
        if (runtimeModelPending.get(cacheKey) === pending) {
          runtimeModelPending.delete(cacheKey)
        }
      },
      () => {
        if (runtimeModelPending.get(cacheKey) === pending) {
          runtimeModelPending.delete(cacheKey)
        }
      },
    )
  }

  const resolved = await pending
  return { ...resolved, headers }
}

/** Starts model configuration loading without requiring a conversation context. */
export function preloadRuntimeModel(options: Pick<RuntimeModelOptions, 'onRetry' | 'signal'> = {}) {
  return getRuntimeModel(options)
}

export async function createRuntimeProvider(options: RuntimeModelOptions) {
  const { model, headers } = await getRuntimeModel(options)
  const provider: IModelProvider = new OpenAIResponsesProvider({
    model,
    apiKey: aiAgentToken,
    baseURL: aiAgentResponsesUrl,
    defaultHeaders: headers,
    customToolNames: ['apply_patch'],
  })
  return withRuntimeNetworkRetry(provider, { onRetry: options.onRetry })
}
