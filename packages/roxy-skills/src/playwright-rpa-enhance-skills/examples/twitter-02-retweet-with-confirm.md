# x-02 — Retweet first N posts (hover+click+dropdown confirm), then compose

**Source fixture**: `output/RPA/x-02.json`
**Capability clusters**: C4 (信息流批量互动) + C5 (UGC 发帖) + C12 (hover 序列)
**User intent keywords**: "转推前 N 条" / "retweet" / "下拉菜单确认" / "hover before click" / "发推" / "compose tweet"

## Distinctive techniques

- **Three-step retweet sequence**: `hover` → `click outer button` → wait → `click [data-testid="Dropdown"] [role="menuitem"]` confirm. Skipping the hover causes the dropdown to never render at replay time.
- **Bounded loop with `Math.min(2, total)`**: count first, retweet only the smaller of "2" and "available" — avoids out-of-range when feed shows < 2 non-retweeted posts.
- **Filter via attribute selector**: `[data-testid="retweet"][aria-expanded="false"]` excludes already-retweeted posts at locator time, no extra branching needed.
- **`type` with `delay: 100`** for the tweet body — typing-rate humanization, more reliable than `fill` on rich-text composers.
- **Single `pick(options.tweets ?? TWEET_TEXTS)`** for compose content; the caller may override the default copy array via `options.tweets`, otherwise the built-in `TWEET_TEXTS` is used.

## Canonical implementation

```typescript
// Generated from output/RPA/x-02.json — RPA fixture x-02
// Task: 滚 8645px → 找未转推的 tweet → 前 2 条 hover+click+下拉确认 → 滚回顶 → 发推 → 截图
// Runtime: roxy-agent sandbox injects BROWSER_URL/CDP_URL.

import type { Page } from 'playwright'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { chromium, firefox } from 'playwright'

const BROWSER_URL = process.env.BROWSER_URL ?? ''
const CDP_URL = process.env.CDP_URL ?? ''
const BROWSER_TYPE = process.env.BROWSER_TYPE ?? 'chromium'
if (!BROWSER_URL && !CDP_URL) {
  console.error('Set BROWSER_URL or CDP_URL before running this script.')
  console.error('[missing_browser_url]')
  process.exit(1)
}

function sleep(min: number, max: number): Promise<void> {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min))
}
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function humanScroll(page: Page, distance: number, direction: 'down' | 'up' = 'down'): Promise<void> {
  const sign = direction === 'down' ? 1 : -1
  let scrolled = 0
  while (scrolled < distance) {
    const step = Math.min(randomBetween(80, 200), distance - scrolled)
    await page.mouse.wheel(0, step * sign)
    scrolled += step
    await sleep(100, 300)
  }
}

const ARTIFACTS_DIR = path.resolve(process.cwd(), 'output/RPA/artifacts')
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
const shotPath = (id: string) => path.join(ARTIFACTS_DIR, `${id}-${Date.now()}.png`)

const TWEET_TEXTS = [
  'Hello,World! I am so happy today~',
  'Hi, I love you so much!',
  'Well, everything is ok~',
]

interface TweetOptions {
  /** 可选：覆盖默认推文文案列表。 */
  tweets?: string[]
}

export async function main(options: TweetOptions = {}): Promise<void> {
  let browser
  if (BROWSER_URL) {
    browser = BROWSER_TYPE === 'firefox'
      ? await firefox.connect(BROWSER_URL)
      : await chromium.connect(BROWSER_URL)
  }
  else {
    browser = await chromium.connectOverCDP(CDP_URL)
  }
  const context = browser.contexts()[0] ?? await browser.newContext()
  const page = context.pages()[0] ?? await context.newPage()
  console.log('[start]')

  await page.goto('https://twitter.com/home', { timeout: 30000 })
  await sleep(5545, 6145)

  await humanScroll(page, 8645, 'down')
  await sleep(1000, 2000)

  // Retweet first 2 non-retweeted posts
  const retweetSelector = 'article [role="group"] [data-testid="retweet"][aria-expanded="false"]'
  const retweetButtons = page.locator(retweetSelector)
  const total = await retweetButtons.count()
  console.log(`Found ${total} non-retweeted posts`)

  const targetCount = Math.min(2, total)
  for (let i = 0; i < targetCount; i++) {
    const btn = retweetButtons.nth(i)
    if (await btn.count() === 0)
      break
    await btn.scrollIntoViewIfNeeded()
    await btn.hover()
    await sleep(1000, 1212)
    await btn.click()
    await sleep(2545, 3000)

    const menuItem = page.locator('[data-testid="Dropdown"] [role="menuitem"]').first()
    await menuItem.waitFor({ state: 'visible', timeout: 10000 })
    await menuItem.click()
    console.log(`Retweeted post ${i + 1}/${targetCount}`)
    await sleep(2323, 3141)
  }

  // Scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(1500, 2500)

  // Compose new tweet
  const textbox = page.locator('[role="textbox"][tabindex="0"]').first()
  await textbox.click()
  await sleep(500, 1000)
  const tweetText = pick(options.tweets ?? TWEET_TEXTS)
  await textbox.type(tweetText, { delay: 100 })
  await sleep(2121, 2222)

  await page.locator('[data-testid="tweetButtonInline"]').click()
  await sleep(3121, 3333)

  await page.screenshot({ path: shotPath('x-02'), fullPage: false })
  console.log(`Posted tweet: "${tweetText}"`)

  console.log('[closing_browser]')
  await browser.close()
}

```
