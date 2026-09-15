import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeElement {
  id = ''
  src = ''
  async = false
  className = ''
  textContent = ''
  onload: ((event: Event) => unknown) | null = null
  onerror: ((event: Event) => unknown) | null = null
  classList = {
    add: vi.fn(),
    remove: vi.fn(),
  }

  appendChild = vi.fn((element: FakeElement) => element)
  setAttribute = vi.fn()

  constructor(private readonly removeElement: (element: FakeElement) => void) {}

  remove() {
    this.removeElement(this)
  }
}

class FakeDocument {
  private readonly elements = new Map<string, FakeElement>()
  documentElement = {
    lang: 'zh-CN',
    getAttribute: vi.fn(() => null),
  }

  head = {
    appendChild: vi.fn((element: FakeElement) => {
      this.elements.set(element.id, element)
      return element
    }),
  }

  body = {
    appendChild: vi.fn((element: FakeElement) => {
      this.elements.set(element.id, element)
      return element
    }),
  }

  createElement = vi.fn(() => new FakeElement(element => this.remove(element)))
  querySelectorAll = vi.fn(() => [] as FakeElement[])

  getElementById(id: string) {
    return this.elements.get(id) ?? null
  }

  addArtifact(id: string) {
    const element = this.createElement()
    element.id = id
    this.elements.set(id, element)
    return element
  }

  private remove(element: FakeElement) {
    if (this.elements.get(element.id) === element) {
      this.elements.delete(element.id)
    }
  }
}

function createWidget(hasLoaded: boolean, toggle = vi.fn()): ChatwootWidget {
  return {
    hasLoaded,
    toggle,
    toggleBubbleVisibility: vi.fn(),
    setUser: vi.fn(),
    setCustomAttributes: vi.fn(),
    deleteCustomAttribute: vi.fn(),
    setLocale: vi.fn(),
    reset: vi.fn(),
    popoutChatWindow: vi.fn(),
  }
}

describe('chatwoot loader fallback', () => {
  let fakeDocument: FakeDocument
  let events: EventTarget

  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    fakeDocument = new FakeDocument()
    events = new EventTarget()
    vi.stubGlobal('document', fakeDocument as unknown as Document)
    vi.stubGlobal('addEventListener', events.addEventListener.bind(events))
    vi.stubGlobal('removeEventListener', events.removeEventListener.bind(events))
    globalThis.$chatwoot = undefined
    globalThis.chatwootSDK = undefined
    globalThis.chatwootSettings = undefined
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    globalThis.$chatwoot = undefined
    globalThis.chatwootSDK = undefined
    globalThis.chatwootSettings = undefined
  })

  it('does not treat an SDK-created but unloaded widget as ready', async () => {
    globalThis.$chatwoot = createWidget(false)
    const { isChatwootReady } = await import('./chatwoot')

    expect(isChatwootReady()).toBe(false)
    globalThis.$chatwoot.hasLoaded = true
    expect(isChatwootReady()).toBe(true)
  })

  it('hides the incomplete widget after the ready timeout and allows retrying', async () => {
    const toggle = vi.fn()
    globalThis.chatwootSDK = {
      run: () => {
        globalThis.$chatwoot = createWidget(false, toggle)
        fakeDocument.addArtifact('cw-widget-holder')
        fakeDocument.addArtifact('cw-bubble-holder')
        fakeDocument.addArtifact('cw-widget-styles')
        const iframe = fakeDocument.addArtifact('chatwoot_live_chat_widget')
        iframe.src = 'https://cloudunk.com/widget'
      },
    }
    const { loadChatwoot } = await import('./chatwoot')
    const loading = loadChatwoot()
    const firstScript = fakeDocument.getElementById('chatwoot-sdk-script')!
    firstScript.onload?.(new Event('load'))
    const rejection = expect(loading).rejects.toThrow('was not ready within 10000ms')

    await vi.advanceTimersByTimeAsync(10_000)
    await rejection

    expect(toggle).toHaveBeenCalledWith('close')
    expect(fakeDocument.getElementById('cw-widget-holder')?.classList.add).toHaveBeenCalledWith('woot--hide')
    expect(fakeDocument.getElementById('cw-bubble-holder')?.classList.add).toHaveBeenCalledWith('woot--hide')
    expect(globalThis.$chatwoot?.hasLoaded).toBe(false)

    const retry = loadChatwoot()
    expect(fakeDocument.getElementById('chatwoot-sdk-script')).toBe(firstScript)
    globalThis.$chatwoot!.hasLoaded = true
    events.dispatchEvent(new Event('chatwoot:ready'))
    await expect(retry).resolves.toBeUndefined()
  })

  it('fully resets state when the SDK script cannot be downloaded', async () => {
    const { loadChatwoot } = await import('./chatwoot')
    const loading = loadChatwoot()
    const script = fakeDocument.getElementById('chatwoot-sdk-script')!
    const rejection = expect(loading).rejects.toThrow('failed to load Chatwoot SDK')

    script.onerror?.(new Event('error'))
    await rejection

    expect(fakeDocument.getElementById('chatwoot-sdk-script')).toBeNull()
    expect(globalThis.$chatwoot).toBeUndefined()
    expect(globalThis.chatwootSDK).toBeUndefined()
  })

  it('resolves only after chatwoot:ready and keeps the usable widget', async () => {
    globalThis.chatwootSDK = {
      run: () => {
        globalThis.$chatwoot = createWidget(false)
      },
    }
    const { loadChatwoot } = await import('./chatwoot')
    const loading = loadChatwoot()
    const script = fakeDocument.getElementById('chatwoot-sdk-script')!
    script.onload?.(new Event('load'))

    globalThis.$chatwoot!.hasLoaded = true
    events.dispatchEvent(new Event('chatwoot:ready'))

    await expect(loading).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
    expect(fakeDocument.getElementById('chatwoot-sdk-script')).toBe(script)
  })

  it('shows a loading placeholder for a user-triggered open until the widget is ready', async () => {
    const toggle = vi.fn()
    globalThis.chatwootSDK = {
      run: () => {
        globalThis.$chatwoot = createWidget(false, toggle)
      },
    }
    const { openChatwoot } = await import('./chatwoot')
    const opening = openChatwoot()

    expect(fakeDocument.getElementById('roxy-chatwoot-loading')).not.toBeNull()
    const script = fakeDocument.getElementById('chatwoot-sdk-script')!
    script.onload?.(new Event('load'))
    globalThis.$chatwoot!.hasLoaded = true
    events.dispatchEvent(new Event('chatwoot:ready'))

    await expect(opening).resolves.toBe(true)
    expect(toggle).toHaveBeenCalledWith('open')
    expect(fakeDocument.getElementById('roxy-chatwoot-loading')).toBeNull()
  })

  it('removes the loading placeholder and does not open the widget after timeout', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const toggle = vi.fn()
    globalThis.chatwootSDK = {
      run: () => {
        globalThis.$chatwoot = createWidget(false, toggle)
      },
    }
    const { openChatwoot } = await import('./chatwoot')
    const opening = openChatwoot()
    const script = fakeDocument.getElementById('chatwoot-sdk-script')!
    script.onload?.(new Event('load'))

    expect(fakeDocument.getElementById('roxy-chatwoot-loading')).not.toBeNull()
    await vi.advanceTimersByTimeAsync(10_000)
    await expect(opening).resolves.toBe(false)
    expect(fakeDocument.getElementById('roxy-chatwoot-loading')).toBeNull()
    expect(fakeDocument.getElementById('roxy-chatwoot-loading-styles')).toBeNull()
    expect(toggle).not.toHaveBeenCalledWith('open')
  })

  it('coalesces duplicate identity updates and skips unchanged payloads', async () => {
    const widget = createWidget(true)
    globalThis.$chatwoot = widget
    const { applyChatwootIdentity } = await import('./chatwoot')
    const identity = {
      identifier: '42',
      name: '[Roxy]-tester',
      email: 'tester@example.com',
      customAttributes: {
        username: '[Roxy]-tester',
        Account_ID: '42',
      },
    }

    applyChatwootIdentity(identity)
    applyChatwootIdentity(identity)

    expect(widget.setUser).not.toHaveBeenCalled()
    expect(widget.setCustomAttributes).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(500)
    expect(widget.setUser).toHaveBeenCalledTimes(1)
    expect(widget.setCustomAttributes).toHaveBeenCalledTimes(1)

    applyChatwootIdentity(identity)
    await vi.advanceTimersByTimeAsync(500)
    expect(widget.setUser).toHaveBeenCalledTimes(1)
    expect(widget.setCustomAttributes).toHaveBeenCalledTimes(1)
  })
})
