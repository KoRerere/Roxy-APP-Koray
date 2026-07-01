# x-03 — Index-segmented Like / Retweet on a feed

**Source fixture**: `output/RPA/x-03.json`
**Capability clusters**: C4 (信息流批量互动 / index-segment action)
**User intent keywords**: "遍历推文" / "前 N 条点赞" / "第 N-M 条转推" / "iterate articles" / "by index range"

## Distinctive techniques

- **Single iteration loop, multi-branch by index**: one `for` loop over `article[data-testid="tweet"]`, with `if (i < 3) { like } else if (i < 6) { retweet } else { screenshot+break }`.
- **Hover before click on every interaction button** (`scrollIntoViewIfNeeded` → `hover` → `click`) — replay reliability requires the hover even if recording could click directly.
- **Two-step retweet** with `[data-testid="retweet"][aria-expanded="false"]` outer button → wait → `[data-testid="Dropdown"] [data-testid="retweetConfirm"]` confirm.
- **`.first()` on per-article locator** — the article scope (`articles.nth(i).locator(...)`) is what stabilizes selection, not viewport heuristics.
- **Skip-on-missing**: each interaction guards with `count() === 0 → continue`, so a missing like/retweet button on one tweet doesn't kill the loop.

## Canonical implementation

```typescript
// Generated from output/RPA/x-03.json — RPA fixture x-03
// Task: 滚 8514px → 回顶部 → 遍历推文,前 3 条点赞,4-6 转推+确认,>=6 截图 break
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

export async function main(): Promise<void> {
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
  await sleep(5512, 6541)

  await humanScroll(page, 8514, 'down')
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(1500, 2500)

  const articles = page.locator('article[data-testid="tweet"]')
  const total = await articles.count()
  console.log(`Found ${total} tweets`)

  for (let i = 0; i < total; i++) {
    if (i >= 6) {
      await page.screenshot({ path: shotPath('x-03'), fullPage: true })
      console.log('Reached tweet 6, screenshot taken, breaking')
      break
    }

    const article = articles.nth(i)

    if (i < 3) {
      const likeBtn = article.locator('[data-testid="like"]').first()
      if (await likeBtn.count() === 0) {
        console.log(`Tweet ${i}: like btn missing, skip`)
        continue
      }
      await likeBtn.scrollIntoViewIfNeeded()
      await likeBtn.hover()
      await sleep(1124, 1541)
      await likeBtn.click()
      console.log(`Liked tweet ${i}`)
    }
    else {
      const retweetBtn = article.locator('[data-testid="retweet"][aria-expanded="false"]').first()
      if (await retweetBtn.count() === 0) {
        console.log(`Tweet ${i}: retweet btn missing or already retweeted, skip`)
        continue
      }
      await retweetBtn.scrollIntoViewIfNeeded()
      await retweetBtn.hover()
      await sleep(1124, 1541)
      await retweetBtn.click()
      await sleep(2687, 3214)
      const confirm = page.locator('[data-testid="Dropdown"] [data-testid="retweetConfirm"]')
      await confirm.waitFor({ state: 'visible', timeout: 10000 })
      await confirm.click()
      console.log(`Retweeted tweet ${i}`)
    }
    await sleep(1000, 2000)
  }

  console.log('[closing_browser]')
  await browser.close()
}

```
