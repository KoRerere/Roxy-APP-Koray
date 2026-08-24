import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import axios, { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'
import { installAxiosGetRetryInterceptor } from './getRetry'

function createResponse(config: InternalAxiosRequestConfig, status: number, data: unknown = {}) {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config,
  } as AxiosResponse
}

function adapterThatFailsOnce(failure: (config: InternalAxiosRequestConfig) => unknown) {
  let calls = 0
  const adapter = async (config: InternalAxiosRequestConfig) => {
    calls++
    if (calls === 1) {
      throw failure(config)
    }
    return createResponse(config, 200, { code: 0, data: 'ok' })
  }
  return {
    adapter,
    get calls() {
      return calls
    },
  }
}

describe('installAxiosGetRetryInterceptor', () => {
  it('retries transient GET network errors and preserves the request config', async () => {
    let retriedConfig: AxiosRequestConfig | undefined
    const state = adapterThatFailsOnce((config) => {
      retriedConfig = config
      return new AxiosError('connection reset', 'ECONNRESET', config)
    })
    const client = axios.create({
      adapter: state.adapter,
      headers: { Authorization: 'Bearer test' },
    })
    installAxiosGetRetryInterceptor(client, { initialDelayMs: 0, jitter: false })

    await expect(client.get('/v1/user/model')).resolves.toMatchObject({ data: { code: 0, data: 'ok' } })
    expect(state.calls).toBe(2)
    expect(retriedConfig?.headers?.Authorization).toBe('Bearer test')
  })

  it('retries retryable HTTP statuses but not permanent client errors', async () => {
    const transient = adapterThatFailsOnce(config => new AxiosError(
      'unavailable',
      'ERR_BAD_RESPONSE',
      config,
      undefined,
      createResponse(config, 503),
    ))
    const transientClient = axios.create({ adapter: transient.adapter })
    installAxiosGetRetryInterceptor(transientClient, { initialDelayMs: 0, jitter: false })
    await expect(transientClient.get('/v1/user/tasks')).resolves.toMatchObject({ status: 200 })
    expect(transient.calls).toBe(2)

    let permanentCalls = 0
    const permanentClient = axios.create({
      adapter: async (config) => {
        permanentCalls++
        throw new AxiosError(
          'not found',
          'ERR_BAD_REQUEST',
          config,
          undefined,
          createResponse(config, 404),
        )
      },
    })
    installAxiosGetRetryInterceptor(permanentClient, { initialDelayMs: 0, jitter: false })
    await expect(permanentClient.get('/v1/user/templates/1')).rejects.toMatchObject({ response: { status: 404 } })
    expect(permanentCalls).toBe(1)
  })

  it('does not retry non-GET requests', async () => {
    let calls = 0
    const client = axios.create({
      adapter: async (config) => {
        calls++
        throw new AxiosError(
          'unavailable',
          'ERR_BAD_RESPONSE',
          config,
          undefined,
          createResponse(config, 503),
        )
      },
    })
    installAxiosGetRetryInterceptor(client, { initialDelayMs: 0, jitter: false })

    await expect(client.post('/v1/user/tasks')).rejects.toMatchObject({ response: { status: 503 } })
    expect(calls).toBe(1)
  })

  it('retries configured transient business responses', async () => {
    let calls = 0
    const client = axios.create({
      adapter: async (config) => {
        calls++
        const data = calls === 1
          ? { code: 'service_unavailable' }
          : { code: 0, data: 'ok' }
        return createResponse(config, 200, data)
      },
    })
    installAxiosGetRetryInterceptor(client, {
      initialDelayMs: 0,
      jitter: false,
      shouldRetryResponse: current => (current.data as { code?: unknown }).code === 'service_unavailable',
    })

    await expect(client.get('/v1/user/model')).resolves.toMatchObject({ data: { code: 0, data: 'ok' } })
    expect(calls).toBe(2)
  })

  it('does not retry an already-aborted GET request', async () => {
    let calls = 0
    const client = axios.create({
      adapter: async (config) => {
        calls++
        return createResponse(config, 200)
      },
    })
    installAxiosGetRetryInterceptor(client, { initialDelayMs: 0, jitter: false })
    const controller = new AbortController()
    controller.abort()

    await expect(client.get('/v1/user/model', { signal: controller.signal })).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    expect(calls).toBe(0)
  })

  it('stops after the configured retry count', async () => {
    let calls = 0
    const client = axios.create({
      adapter: async (config) => {
        calls++
        throw new AxiosError('timeout', 'ETIMEDOUT', config)
      },
    })
    installAxiosGetRetryInterceptor(client, { maxRetries: 2, initialDelayMs: 0, jitter: false })

    await expect(client.get('/v1/user/model')).rejects.toMatchObject({ code: 'ETIMEDOUT' })
    expect(calls).toBe(3)
  })
})
