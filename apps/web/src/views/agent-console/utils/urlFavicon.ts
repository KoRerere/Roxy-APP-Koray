const FAVICON_ATTRIBUTE = 'data-agent-favicon-url'
export const DEFAULT_FAVICON_ICON_NAME = 'base/rx_ic_internet'
const DEFAULT_FAVICON_ICON_URL = new URL(
  '../../../assets/icons/base/rx_ic_internet.svg',
  import.meta.url,
).toString()

function createFallbackFaviconCss() {
  return `a[${FAVICON_ATTRIBUTE}] { --agent-favicon-fallback-image: url(${JSON.stringify(DEFAULT_FAVICON_ICON_URL)}); }`
}

function createLoadedFaviconCss(faviconUrl: string) {
  const selector = `a[${FAVICON_ATTRIBUTE}=${JSON.stringify(faviconUrl)}]`
  return `${selector} {
  --agent-favicon-image: url(${JSON.stringify(faviconUrl)});
  --agent-favicon-fallback-opacity: 0;
  --agent-favicon-fallback-scale: 0.85;
  --agent-favicon-opacity: 1;
  --agent-favicon-scale: 1;
}`
}

export function getUrlFaviconUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined
  }

  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined
    }

    return new URL('/favicon.ico', url.origin).toString()
  }
  catch {
    return undefined
  }
}

export function observeUrlFavicons(root: HTMLElement | null): () => void {
  if (!root || typeof MutationObserver === 'undefined' || typeof globalThis.Image === 'undefined') {
    return () => {}
  }

  const styleElement = root.ownerDocument.createElement('style')
  const faviconStates = new Map<string, 'loading' | 'loaded' | 'failed'>()
  const loadingImages = new Map<string, HTMLImageElement>()
  let disposed = false

  // Keep visual state outside contenteditable DOM so ProseMirror never reparses it as user input.
  styleElement.textContent = createFallbackFaviconCss()
  root.ownerDocument.head.append(styleElement)

  function loadFavicon(link: HTMLAnchorElement) {
    const faviconUrl = link.dataset.agentFaviconUrl
    if (!faviconUrl || faviconStates.has(faviconUrl)) {
      return
    }

    faviconStates.set(faviconUrl, 'loading')
    const image = new globalThis.Image()
    image.decoding = 'async'
    image.referrerPolicy = 'no-referrer'
    loadingImages.set(faviconUrl, image)

    const finish = (state: 'loaded' | 'failed') => {
      if (disposed || loadingImages.get(faviconUrl) !== image) {
        return
      }

      loadingImages.delete(faviconUrl)
      faviconStates.set(faviconUrl, state)

      if (state === 'loaded') {
        styleElement.textContent += `\n${createLoadedFaviconCss(faviconUrl)}`
      }
    }

    image.addEventListener('load', () => finish('loaded'), { once: true })
    image.addEventListener('error', () => finish('failed'), { once: true })
    image.src = faviconUrl
  }

  function loadVisibleFavicons() {
    root?.querySelectorAll<HTMLAnchorElement>(`a[${FAVICON_ATTRIBUTE}]`).forEach(loadFavicon)
  }

  loadVisibleFavicons()

  const observer = new MutationObserver(loadVisibleFavicons)
  observer.observe(root, {
    attributes: true,
    attributeFilter: [FAVICON_ATTRIBUTE],
    childList: true,
    subtree: true,
  })

  return () => {
    disposed = true
    observer.disconnect()
    loadingImages.clear()
    styleElement.remove()
  }
}
