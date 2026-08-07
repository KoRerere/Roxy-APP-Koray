import assert from 'node:assert/strict'
import { afterEach, it, vi } from 'vitest'
import { startWeixinAdapter } from './adapter'

const inboundMessage = {
  from_user_id: 'user-1@im.wechat',
  to_user_id: 'bot-1@im.bot',
  message_type: 1,
  message_state: 2,
  context_token: 'ctx-1',
  msg_id: 'msg-1',
  item_list: [
    {
      type: 1,
      text_item: {
        text: 'hello',
      },
    },
  ],
}

afterEach(() => {
  vi.restoreAllMocks()
})

it('sends and cancels Weixin typing while processing an inbound message', async () => {
  const calls: Array<{ endpoint: string, body: any }> = []
  const done = deferred<void>()
  let stop: (() => void) | undefined

  vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
    const endpoint = String(url).split('/ilink/bot/')[1] ?? ''
    const body = JSON.parse(String(init?.body ?? '{}'))
    calls.push({ endpoint, body })

    if (endpoint === 'getupdates') {
      return jsonResponse({
        ret: 0,
        msgs: [inboundMessage],
        get_updates_buf: 'cursor-1',
      })
    }

    if (endpoint === 'getconfig') {
      return jsonResponse({
        ret: 0,
        typing_ticket: 'typing-ticket-1',
      })
    }

    if (endpoint === 'sendtyping' && body.status === 2) {
      stop?.()
      done.resolve()
    }

    return jsonResponse({ ret: 0 })
  }))

  const bridge = {
    clearSession: vi.fn(),
    getSessionLength: vi.fn(() => 0),
    isBusy: vi.fn(() => false),
    handleMessage: vi.fn(async () => 'reply from agent'),
  }

  stop = await startWeixinAdapter(bridge as any, {
    botToken: 'bot-token-1',
    baseUrl: 'https://ilinkai.weixin.qq.com/',
  })

  await done.promise
  stop()

  assert.deepEqual(
    calls.map(call => call.endpoint),
    ['getupdates', 'getconfig', 'sendtyping', 'sendmessage', 'sendtyping'],
  )
  assert.equal(calls[1].body.ilink_user_id, inboundMessage.from_user_id)
  assert.equal(calls[1].body.context_token, inboundMessage.context_token)
  assert.equal(calls[2].body.typing_ticket, 'typing-ticket-1')
  assert.equal(calls[2].body.status, 1)
  assert.equal(calls[3].body.msg.to_user_id, inboundMessage.from_user_id)
  assert.equal(calls[3].body.msg.context_token, inboundMessage.context_token)
  assert.equal(calls[4].body.status, 2)
})

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function deferred<T>(): { promise: Promise<T>, resolve: (value: T | PromiseLike<T>) => void } {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}
