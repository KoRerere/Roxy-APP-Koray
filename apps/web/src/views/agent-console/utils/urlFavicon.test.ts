import assert from 'node:assert/strict'
// eslint-disable-next-line test/no-import-node-test
import { describe, it } from 'node:test'
import { getUrlFaviconUrl, observeUrlFavicons } from './urlFavicon'

class FakeImage {
  static instances: FakeImage[] = []

  decoding = ''
  referrerPolicy = ''
  src = ''
  private readonly listeners = new Map<string, Array<() => void>>()

  constructor() {
    FakeImage.instances.push(this)
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const callback = typeof listener === 'function'
      ? () => listener({} as Event)
      : () => listener.handleEvent({} as Event)
    const listeners = this.listeners.get(type) ?? []
    listeners.push(callback)
    this.listeners.set(type, listeners)
  }

  emit(type: 'load' | 'error') {
    this.listeners.get(type)?.forEach(listener => listener())
  }
}

function replaceGlobal(name: 'Image' | 'MutationObserver', value: unknown) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  })

  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor)
    }
    else {
      Reflect.deleteProperty(globalThis, name)
    }
  }
}

describe('url favicon helpers', () => {
  it('derives the favicon URL from an HTTP origin', () => {
    assert.equal(
      getUrlFaviconUrl('https://example.com/docs?source=agent'),
      'https://example.com/favicon.ico',
    )
    assert.equal(getUrlFaviconUrl('http://example.com:8080/path'), 'http://example.com:8080/favicon.ico')
  })

  it('ignores invalid and non-web URLs', () => {
    assert.equal(getUrlFaviconUrl('about:blank'), undefined)
    assert.equal(getUrlFaviconUrl('file:///tmp/report.md'), undefined)
    assert.equal(getUrlFaviconUrl('not a URL'), undefined)
    assert.equal(getUrlFaviconUrl(''), undefined)
  })

  it('loads duplicate favicon URLs without mutating observed links', () => {
    const faviconUrl = 'https://www.tiktok.com/favicon.ico'
    const frozenDataset = Object.freeze({ agentFaviconUrl: faviconUrl })
    const links = [
      Object.freeze({ dataset: frozenDataset }),
      Object.freeze({ dataset: frozenDataset }),
    ] as unknown as HTMLAnchorElement[]
    const styleElement = {
      removed: false,
      textContent: '',
      remove() {
        this.removed = true
      },
    }
    let appendedStyle: typeof styleElement | undefined
    let disconnected = false
    let notifyMutation = () => {}
    const root = {
      ownerDocument: {
        createElement: () => styleElement,
        head: {
          append(element: typeof styleElement) {
            appendedStyle = element
          },
        },
      },
      querySelectorAll: () => links,
    } as unknown as HTMLElement
    class FakeMutationObserver {
      constructor(callback: MutationCallback) {
        notifyMutation = () => callback([], this as unknown as MutationObserver)
      }

      disconnect() {
        disconnected = true
      }

      observe() {}
    }
    const restoreImage = replaceGlobal('Image', FakeImage)
    const restoreMutationObserver = replaceGlobal('MutationObserver', FakeMutationObserver)
    FakeImage.instances = []

    try {
      const stop = observeUrlFavicons(root)

      assert.equal(appendedStyle, styleElement)
      assert.equal(FakeImage.instances.length, 1)
      assert.deepEqual(frozenDataset, { agentFaviconUrl: faviconUrl })
      assert.match(styleElement.textContent, /--agent-favicon-fallback-image:/)

      FakeImage.instances[0]?.emit('load')
      assert.match(styleElement.textContent, /--agent-favicon-image: url\("https:\/\/www\.tiktok\.com\/favicon\.ico"\)/)
      assert.match(styleElement.textContent, /--agent-favicon-opacity: 1/)

      notifyMutation()
      assert.equal(FakeImage.instances.length, 1)

      stop()
      assert.equal(disconnected, true)
      assert.equal(styleElement.removed, true)
    }
    finally {
      restoreMutationObserver()
      restoreImage()
    }
  })
})
