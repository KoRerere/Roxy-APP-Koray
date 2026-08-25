import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearRuntimeModelCache, getRuntimeModel } from './provider'

const getUserModel = vi.hoisted(() => vi.fn())

vi.mock('@/api/agentApiClient', () => ({
  agentModelApi: { getUserModel },
}))

const modelResponse = {
  text_model: {
    model: 'deepseek-v4-flash',
    api_format: 'openai',
  },
}

afterEach(() => {
  clearRuntimeModelCache()
  getUserModel.mockReset()
})

describe('runtime model cache', () => {
  it('caches a successful model lookup while rebuilding tracing headers per call', async () => {
    // Regression: every runtime provider initialization fetched the same model
    // configuration, adding an unnecessary request for each title/worker call.
    // Fixed by: caching the successful model data while keeping call-local headers.
    getUserModel.mockResolvedValue(modelResponse)

    const first = await getRuntimeModel({ conversationId: 'conversation-1', turnId: 'turn-1' })
    const second = await getRuntimeModel({ conversationId: 'conversation-2', turnId: 'turn-2' })

    expect(getUserModel).toHaveBeenCalledTimes(1)
    expect(first.model).toBe('deepseek-v4-flash')
    expect(first.modelType).toBe('text_model')
    expect(second.model).toBe('deepseek-v4-flash')
    expect(first.headers).toMatchObject({ 'Conversation-Id': 'conversation-1', 'Turn-Id': 'turn-1' })
    expect(second.headers).toMatchObject({ 'Conversation-Id': 'conversation-2', 'Turn-Id': 'turn-2' })
  })

  it('prefers the configured vision model when one is available', async () => {
    getUserModel.mockResolvedValue({
      ...modelResponse,
      vlm_model: {
        model: 'deepseek-v4-flash-vision-exp',
        api_format: 'openai',
      },
    })

    await expect(getRuntimeModel()).resolves.toMatchObject({
      model: 'deepseek-v4-flash-vision-exp',
      modelType: 'vlm_model',
      modelInfo: { model: 'deepseek-v4-flash-vision-exp' },
    })
  })

  it('shares an in-flight lookup between concurrent callers', async () => {
    let resolve!: (value: typeof modelResponse) => void
    getUserModel.mockImplementation(() => new Promise((res) => {
      resolve = res
    }))

    const firstPromise = getRuntimeModel({ conversationId: 'conversation-1' })
    const secondPromise = getRuntimeModel({ conversationId: 'conversation-2' })
    expect(getUserModel).toHaveBeenCalledTimes(1)

    resolve(modelResponse)
    await expect(firstPromise).resolves.toMatchObject({ model: 'deepseek-v4-flash' })
    await expect(secondPromise).resolves.toMatchObject({ model: 'deepseek-v4-flash' })
  })

  it('does not cache a failed lookup', async () => {
    // Regression: caching a transient failure would make all later turns fail
    // until the agent process restarted.
    // Fixed by: only storing the model after a successful request.
    getUserModel
      .mockRejectedValueOnce(Object.assign(new Error('temporary failure'), { status: 400 }))
      .mockResolvedValueOnce(modelResponse)

    await expect(getRuntimeModel()).rejects.toThrow('temporary failure')
    await expect(getRuntimeModel()).resolves.toMatchObject({ model: 'deepseek-v4-flash' })
    expect(getUserModel).toHaveBeenCalledTimes(2)
  })

  it('allows the cache to be explicitly cleared', async () => {
    getUserModel.mockResolvedValue(modelResponse)

    await getRuntimeModel()
    clearRuntimeModelCache()
    await getRuntimeModel()

    expect(getUserModel).toHaveBeenCalledTimes(2)
  })
})
