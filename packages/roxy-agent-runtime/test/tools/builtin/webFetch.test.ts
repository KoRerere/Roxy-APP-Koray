import { describe, expect, it, vi } from 'vitest'
import type { ToolContext } from '../../../src/core/interfaces.ts'
import { web_fetchTool } from '../../../src/tools/builtin/web_fetch.ts'

const ctx: ToolContext = {
  agentId: 'test-agent',
  traceId: 'test-trace',
  signal: new AbortController().signal,
}

/** Build a Response-like object for the injected fetch. */
function fakeResponse(opts: { status?: number; contentType?: string; body?: string }): Response {
  return new Response(opts.body ?? '', {
    status: opts.status ?? 200,
    headers: { 'content-type': opts.contentType ?? 'text/plain' },
  })
}

function makeTool(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const fetchImpl = vi.fn(impl)
  const tool = web_fetchTool({ _fetch: fetchImpl as unknown as typeof fetch })
  return { ...tool, fetchImpl }
}

describe('web_fetch', () => {
  it('returns plain text content with status line', async () => {
    const { handler } = makeTool(() => Promise.resolve(fakeResponse({ body: 'hello from the web' })))
    const result = await handler({ url: 'https://example.com/a.txt' }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content).toContain('hello from the web')
    expect(result.content).toContain('200')
  })

  it('strips HTML to readable text (scripts/styles/tags removed, entities decoded)', async () => {
    const html = `<html><head><style>body{color:red}</style>
			<script>alert("evil")</script></head>
			<body><h1>Title</h1><p>Hello &amp; welcome &lt;here&gt;</p></body></html>`
    const { handler } = makeTool(() => Promise.resolve(fakeResponse({ contentType: 'text/html', body: html })))
    const result = await handler({ url: 'https://example.com' }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content).toContain('Title')
    expect(result.content).toContain('Hello & welcome <here>')
    expect(result.content).not.toContain('alert')
    expect(result.content).not.toContain('color:red')
    expect(result.content).not.toContain('<p>')
  })

  it('accepts JSON responses', async () => {
    const { handler } = makeTool(() =>
      Promise.resolve(fakeResponse({ contentType: 'application/json', body: '{"ok":true}' })),
    )
    const result = await handler({ url: 'https://api.example.com/x' }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content).toContain('{"ok":true}')
  })

  it('rejects non-http(s) URLs without fetching', async () => {
    const { handler, fetchImpl } = makeTool(() => Promise.resolve(fakeResponse({})))
    for (const url of ['file:///etc/passwd', 'ftp://x/y', 'javascript:alert(1)']) {
      const result = await handler({ url }, ctx)
      expect(result.isError).toBe(true)
    }
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects an invalid URL', async () => {
    const { handler } = makeTool(() => Promise.resolve(fakeResponse({})))
    const result = await handler({ url: 'not a url' }, ctx)
    expect(result.isError).toBe(true)
  })

  it('reports HTTP error statuses as tool errors', async () => {
    const { handler } = makeTool(() => Promise.resolve(fakeResponse({ status: 404, body: 'nope' })))
    const result = await handler({ url: 'https://example.com/missing' }, ctx)
    expect(result.isError).toBe(true)
    expect(result.content).toContain('404')
  })

  it('rejects unsupported content types (binary)', async () => {
    const { handler } = makeTool(() => Promise.resolve(fakeResponse({ contentType: 'image/png', body: 'PNG' })))
    const result = await handler({ url: 'https://example.com/pic.png' }, ctx)
    expect(result.isError).toBe(true)
    expect(result.content).toContain('image/png')
  })

  it('truncates oversized bodies with a notice', async () => {
    const { handler } = makeTool(() => Promise.resolve(fakeResponse({ body: 'x'.repeat(120_000) })))
    const result = await handler({ url: 'https://example.com/big' }, ctx)
    expect(result.isError).toBe(false)
    expect(result.content.length).toBeLessThan(60_000)
    expect(result.content).toContain('truncated')
  })

  it('surfaces network failures as tool errors (never rejects)', async () => {
    const { handler } = makeTool(() => Promise.reject(new Error('ECONNREFUSED')))
    const result = await handler({ url: 'https://down.example.com' }, ctx)
    expect(result.isError).toBe(true)
    expect(result.content).toContain('ECONNREFUSED')
  })

  it('requires a url', async () => {
    const { handler } = makeTool(() => Promise.resolve(fakeResponse({})))
    const result = await handler({}, ctx)
    expect(result.isError).toBe(true)
  })

  it('is open-world (outbound network — HITL-gated in strict/delegate)', () => {
    const { descriptor } = web_fetchTool()
    expect(descriptor.annotations).toEqual({ readOnlyHint: true, openWorldHint: true })
  })
})
