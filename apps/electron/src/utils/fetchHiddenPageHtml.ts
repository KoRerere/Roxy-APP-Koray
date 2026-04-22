import type { WebContents } from 'electron'
import { BrowserWindow, WebContentsView } from 'electron'
import crypto from 'node:crypto'

export interface FetchHiddenPageHtmlOptions {
  timeoutMs?: number
  settleTimeMs?: number
  userAgent?: string
  partition?: string
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_SETTLE_TIME_MS = 1_500
const DEFAULT_VIEW_WIDTH = 1440
const DEFAULT_VIEW_HEIGHT = 960
const DEFAULT_ACCEPT_LANGUAGE = 'en-US,en;q=0.9'
const CHALLENGE_TEXT_MARKERS = [
  'verifying your connection',
  'please wait while we verify your browser',
  'checking if the site connection is secure',
  'please stand by, while we are checking your browser',
  'cf-challenge',
  'challenge-platform',
]
const CHALLENGE_SELECTORS = [
  '#challenge-running',
  '.challenge-running',
  '.cf-browser-verification',
  '[data-translate="challenge_headline"]',
  '[data-translate="challenge_running"]',
  '[action*="/cdn-cgi/challenge-platform/"]',
]

/**
 * 在不可见的 WebContentsView 中加载页面，并在 DOM 稳定后返回 body 内部的 HTML。
 */
export async function fetchHiddenPageHtml(
  targetUrl: string,
  options: FetchHiddenPageHtmlOptions = {},
) {
  const normalizedUrl = normalizeHttpUrl(targetUrl)
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const settleTimeMs = options.settleTimeMs ?? DEFAULT_SETTLE_TIME_MS
  const deadline = Date.now() + timeoutMs
  const userAgent = options.userAgent ?? buildChromeLikeUserAgent()

  const hostWindow = new BrowserWindow({
    width: DEFAULT_VIEW_WIDTH,
    height: DEFAULT_VIEW_HEIGHT,
    show: false,
    frame: false,
    focusable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    roundedCorners: false,
    webPreferences: {
      backgroundThrottling: false,
      sandbox: false,
    },
  })

  const webContentsView = new WebContentsView({
    webPreferences: {
      backgroundThrottling: false,
      partition: options.partition ?? createInMemoryPartition(),
      sandbox: false,
    },
  })

  hostWindow.contentView.addChildView(webContentsView)
  webContentsView.setBounds({
    x: 0,
    y: 0,
    width: DEFAULT_VIEW_WIDTH,
    height: DEFAULT_VIEW_HEIGHT,
  })

  await applyBrowserIdentity(webContentsView.webContents, userAgent)

  try {
    await withTimeout(
      webContentsView.webContents.loadURL(normalizedUrl),
      getRemainingTime(deadline, 'loading page'),
      `Timed out while loading page: ${normalizedUrl}`,
    )

    const html = await withTimeout(
      waitForSettledHtml(webContentsView.webContents, settleTimeMs),
      getRemainingTime(deadline, 'waiting for page body'),
      `Timed out while waiting for page body: ${normalizedUrl}`,
    )

    return html
  }
  finally {
    if (!hostWindow.isDestroyed()) {
      hostWindow.destroy()
    }
  }
}

function normalizeHttpUrl(targetUrl: string) {
  const url = new URL(targetUrl)

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Unsupported protocol: ${url.protocol}`)
  }

  return url.toString()
}

function createInMemoryPartition() {
  return `hidden-html-${crypto.randomUUID()}`
}

function buildChromeLikeUserAgent() {
  const chromeVersion = process.versions.chrome || '140.0.0.0'

  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
}

async function applyBrowserIdentity(webContents: WebContents, userAgent: string) {
  webContents.setUserAgent(userAgent)

  let shouldDetachDebugger = false

  try {
    if (!webContents.debugger.isAttached()) {
      webContents.debugger.attach('1.3')
      shouldDetachDebugger = true
    }

    await webContents.debugger.sendCommand('Emulation.setUserAgentOverride', {
      userAgent,
      acceptLanguage: DEFAULT_ACCEPT_LANGUAGE,
      platform: 'Windows',
      userAgentMetadata: createUserAgentMetadata(),
    })
  }
  catch (error) {
    console.warn('Failed to override hidden page user agent', error)
  }
  finally {
    if (shouldDetachDebugger && webContents.debugger.isAttached()) {
      webContents.debugger.detach()
    }
  }
}

function createUserAgentMetadata() {
  const chromeVersion = process.versions.chrome || '140.0.0.0'
  const chromeMajorVersion = chromeVersion.split('.')[0]
  const brands = [
    { brand: 'Chromium', version: chromeMajorVersion },
    { brand: 'Google Chrome', version: chromeMajorVersion },
    { brand: 'Not/A)Brand', version: '24' },
  ]

  return {
    brands,
    fullVersionList: brands.map(brand => ({
      ...brand,
      version: brand.brand === 'Not/A)Brand' ? '24.0.0.0' : chromeVersion,
    })),
    platform: 'Windows',
    platformVersion: '10.0.0',
    architecture: 'x86',
    model: '',
    mobile: false,
    bitness: '64',
    wow64: false,
  }
}

function getRemainingTime(deadline: number, step: string) {
  const remainingTime = deadline - Date.now()

  if (remainingTime <= 0) {
    throw new Error(`Timed out while ${step}`)
  }

  return remainingTime
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)

    promise
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

function waitForSettledHtml(webContents: WebContents, settleTimeMs: number) {
  const serializedSettleTimeMs = JSON.stringify(settleTimeMs)
  const serializedChallengeTextMarkers = JSON.stringify(CHALLENGE_TEXT_MARKERS)
  const serializedChallengeSelectors = JSON.stringify(CHALLENGE_SELECTORS)

  return webContents.executeJavaScript(`
    new Promise((resolve) => {
      const settleTimeMs = ${serializedSettleTimeMs};
      const challengeTextMarkers = ${serializedChallengeTextMarkers};
      const challengeSelectors = ${serializedChallengeSelectors};
      const root = document.documentElement;

      if (!root) {
        resolve('');
        return;
      }

      const serializeDocument = () => {
        return document.body?.innerHTML ?? '';
      };

      const isChallengePage = () => {
        const body = document.body;
        const combinedText = [
          document.title,
          body?.innerText ?? '',
          body?.innerHTML ?? '',
        ].join('\n').toLowerCase();

        return challengeTextMarkers.some(marker => combinedText.includes(marker))
          || challengeSelectors.some(selector => Boolean(document.querySelector(selector)));
      };

      let observer;
      let timer;

      const scheduleFinish = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(finish, settleTimeMs);
      };

      const cleanup = () => {
        observer?.disconnect();
        window.clearTimeout(timer);
        window.removeEventListener('load', scheduleFinish);
      };

      const finish = () => {
        const html = serializeDocument();

        if (!html.trim() || isChallengePage()) {
          scheduleFinish();
          return;
        }

        cleanup();
        resolve(html);
      };

      // 不只等 did-finish-load，额外等待一段没有 DOM 变更的空闲时间，降低抓到骨架屏的概率。
      timer = window.setTimeout(finish, settleTimeMs);
      observer = new MutationObserver(() => {
        scheduleFinish();
      });

      observer.observe(root, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });

      if (document.readyState !== 'complete') {
        window.addEventListener('load', scheduleFinish);
      }
    })
  `)
}