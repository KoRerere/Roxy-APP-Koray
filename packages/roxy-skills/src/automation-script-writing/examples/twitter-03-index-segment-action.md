# x-03 — Index-segmented Like / Retweet on a feed

**Pattern**: 单循环按索引分段动作(前 N 点赞 / 次 M 转推 / 到界 break)

## Distinctive techniques

- **Single iteration loop, multi-branch by index**: one `for` loop over `article[data-testid="tweet"]`, with `if (i < 3) { like } else if (i < 6) { retweet } else { break }`.
- **Hover before click on every interaction button** (`scrollIntoViewIfNeeded` → `hover` → `click`) — replay reliability requires the hover even if operation-time click succeeded directly.
- **Two-step retweet** with `[data-testid="retweet"][aria-expanded="false"]` outer button → wait → `[data-testid="Dropdown"] [data-testid="retweetConfirm"]` confirm.
- **`.first()` on per-article locator** — the article scope (`articles.nth(i).locator(...)`) is what stabilizes selection, not viewport heuristics.
- **Skip-on-missing**: each interaction guards with `count() === 0 → continue`, so a missing like/retweet button on one tweet doesn't kill the loop.
- **Terminate at index 6 with a log, not a screenshot**: the original recorded a screenshot at the boundary, but a saved screenshot isn't the observable signal. The `i >= 6` break is the real terminal signal; log it. Use `capturePageSnapshot` under the debug profile if a DOM snapshot is needed (`references/debugging.md`).

## Canonical implementation

```typescript
// Task: scroll 8514px → back to top → iterate tweets: first 3 like, 4-6 retweet+confirm, >=6 break
// Runtime: roxy-agent sandbox injects BROWSER_URL/BROWSER_TYPE.

import { chromium, firefox } from 'playwright'
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
import { sleep } from '@roxybrowser/sandbox/utils'
import { createHuman } from '@roxybrowser/sandbox/human'

defineMetadata({ name: 'Twitter index-segmented actions', description: 'Scroll the timeline then act by index: like the first 3 tweets, retweet+confirm 4-6, stop at 6.', version: '1.0.0' })

interface TwitterSegmentParams {
  likeCount?: number
  retweetCount?: number
}

defineParams({
  type: 'object',
  properties: {
    likeCount: { type: 'integer', minimum: 0, maximum: 50, default: 3, description: 'Number of leading tweets to like.' },
    retweetCount: { type: 'integer', minimum: 0, maximum: 50, default: 3, description: 'Number of following tweets to retweet.' },
  },
})

export async function main(params: TwitterSegmentParams = {}): Promise<void> {
  const BROWSER_URL = process.env.BROWSER_URL ?? ''
  const BROWSER_TYPE = process.env.BROWSER_TYPE ?? 'chromium'
  const browser = BROWSER_TYPE === 'firefox' ? await firefox.connect(BROWSER_URL) : await chromium.connect(BROWSER_URL)
  const context = browser.contexts()[0] ?? await browser.newContext()
  const page = context.pages()[0] ?? await context.newPage()
  const human = createHuman(page)
  const pointerMotion = { duration: 300, curve: 'ease-out', path: { type: 'bezier', curvature: 34 } } as const
  const stationaryMotion = { duration: 0, curve: 'linear', path: 'linear' } as const
  const likeCount = Math.max(0, Math.min(50, Math.floor(params.likeCount ?? 3)))
  const retweetCount = Math.max(0, Math.min(50, Math.floor(params.retweetCount ?? 3)))
  const maxActions = likeCount + retweetCount
  console.log('[start]')

  await page.goto('https://twitter.com/home', { timeout: 30000 })
  await sleep(5500, 6500)

  await human.scroll({ distance: 8514, axis: 'vertical', duration: 3500, curve: 'ease-in-out' })
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(1500, 2500)

  const articles = page.locator('article[data-testid="tweet"]')
  const total = await articles.count()
  console.log(`Found ${total} tweets`)

  for (let i = 0; i < total; i++) {
    if (i >= maxActions) {
      console.log(`Reached configured action limit ${maxActions}, breaking`)
      break
    }

    const article = articles.nth(i)

    if (i < likeCount) {
      const likeBtn = article.locator('[data-testid="like"]').first()
      if (await likeBtn.count() === 0) {
        console.log(`Tweet ${i}: like btn missing, skip`)
        continue
      }
      await human.hover({ target: likeBtn, ensureVisible: true, motion: pointerMotion, dwellDuration: 0 })
      await sleep(1100, 1500)
      await human.click({ target: likeBtn, motion: stationaryMotion, settleDuration: 0, holdDuration: 60 })
      console.log(`Liked tweet ${i}`)
    }
    else {
      const retweetBtn = article.locator('[data-testid="retweet"][aria-expanded="false"]').first()
      if (await retweetBtn.count() === 0) {
        console.log(`Tweet ${i}: retweet btn missing or already retweeted, skip`)
        continue
      }
      await human.hover({ target: retweetBtn, ensureVisible: true, motion: pointerMotion, dwellDuration: 0 })
      await sleep(1100, 1500)
      await human.click({ target: retweetBtn, motion: stationaryMotion, settleDuration: 0, holdDuration: 60 })
      await sleep(2600, 3200)
      const confirm = page.locator('[data-testid="Dropdown"] [data-testid="retweetConfirm"]')
      await confirm.waitFor({ state: 'visible', timeout: 10000 })
      await human.click({ target: confirm, ensureVisible: true, motion: pointerMotion, settleDuration: 70, holdDuration: 60 })
      console.log(`Retweeted tweet ${i}`)
    }
    await sleep(1000, 2000)
  }

  console.log('[closing_browser]')
  await browser.close()
}

```
