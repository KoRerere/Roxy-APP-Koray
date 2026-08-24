# x-02 — Retweet first N posts (hover+click+dropdown confirm), then compose

**Pattern**: 信息流批量转推(hover→click→下拉确认)+ 拟人输入发推

## Distinctive techniques

- **Three-step retweet sequence**: `hover` → `click outer button` → wait → `click [data-testid="Dropdown"] [role="menuitem"]` confirm. Skipping the hover causes the dropdown to never render at replay time.
- **Bounded loop with `Math.min(2, total)`**: count first, retweet only the smaller of "2" and "available" — avoids out-of-range when feed shows < 2 non-retweeted posts.
- **Filter via attribute selector**: `[data-testid="retweet"][aria-expanded="false"]` excludes already-retweeted posts at locator time, no extra branching needed.
- **Explicit `human.type({...})` timing** for the tweet body — focus motion, click hold, total typing duration, and cumulative character curve are all visible at the call site.
- **Single `pick(options.tweets ?? TWEET_TEXTS)`** for compose content; the caller may override the default copy array via `options.tweets`, otherwise the built-in `TWEET_TEXTS` is used.
- **`human.scroll`** from `@roxybrowser/sandbox/human` for the feed scroll — create one actor per page and reuse it.

## Canonical implementation

```typescript
// Task: scroll 8645px → find non-retweeted tweets → first 2: hover+click+dropdown confirm
//       → scroll back to top → compose + post → assert posted
// Runtime: roxy-agent sandbox injects BROWSER_URL/BROWSER_TYPE.

import { chromium, firefox } from 'playwright'
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
import { sleep, pick } from '@roxybrowser/sandbox/utils'
import { createHuman } from '@roxybrowser/sandbox/human'

defineMetadata({ name: 'Twitter retweet + compose', description: 'Retweet the first N non-retweeted posts (hover→click→dropdown confirm), then compose and post a tweet.', version: '1.0.0' })
defineParams({ type: 'object', properties: { tweets: { type: 'array', items: { type: 'string' }, description: 'Optional: override the default tweet-copy list.' } } })

const TWEET_TEXTS = [
  'Hello,World! I am so happy today~',
  'Hi, I love you so much!',
  'Well, everything is ok~',
]

interface TweetOptions {
  /** Optional: override the default tweet-copy list. */
  tweets?: string[]
}

export async function main(options: TweetOptions = {}): Promise<void> {
  const BROWSER_URL = process.env.BROWSER_URL ?? ''
  const BROWSER_TYPE = process.env.BROWSER_TYPE ?? 'chromium'
  const browser = BROWSER_TYPE === 'firefox' ? await firefox.connect(BROWSER_URL) : await chromium.connect(BROWSER_URL)
  const context = browser.contexts()[0] ?? await browser.newContext()
  const page = context.pages()[0] ?? await context.newPage()
  const human = createHuman(page)
  const pointerMotion = { duration: 300, curve: 'ease-out', path: { type: 'bezier', curvature: 34 } } as const
  const stationaryMotion = { duration: 0, curve: 'linear', path: 'linear' } as const
  console.log('[start]')

  await page.goto('https://twitter.com/home', { timeout: 30000 })
  await sleep(5500, 6100)

  await human.scroll({ distance: 8645, axis: 'vertical', duration: 3500, curve: 'ease-in-out' })
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
    await human.hover({ target: btn, ensureVisible: true, motion: pointerMotion, dwellDuration: 0 })
    await sleep(1000, 1200)
    await human.click({ target: btn, motion: stationaryMotion, settleDuration: 0, holdDuration: 60 })
    await sleep(2500, 3000)

    const menuItem = page.locator('[data-testid="Dropdown"] [role="menuitem"]').first()
    await menuItem.waitFor({ state: 'visible', timeout: 10000 })
    await human.click({ target: menuItem, ensureVisible: true, motion: pointerMotion, settleDuration: 70, holdDuration: 60 })
    console.log(`Retweeted post ${i + 1}/${targetCount}`)
    await sleep(2300, 3100)
  }

  // Scroll back to top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(1500, 2500)

  // Compose new tweet
  const textbox = page.locator('[role="textbox"][tabindex="0"]').first()
  const tweetText = pick(options.tweets ?? TWEET_TEXTS)
  await human.type({
    target: textbox,
    text: tweetText,
    mode: 'replace',
    duration: Math.max(700, tweetText.length * 85),
    curve: 'ease-in-out',
    focus: {
      ensureVisible: true,
      motion: pointerMotion,
      settleDuration: 80,
      holdDuration: 65,
    },
  })
  await sleep(2100, 2200)

  await human.click({
    target: page.locator('[data-testid="tweetButtonInline"]'),
    ensureVisible: true,
    motion: pointerMotion,
    settleDuration: 70,
    holdDuration: 60,
  })

  // Assert the composer cleared (tweet sent) rather than screenshotting
  const posted = await textbox.waitFor({ state: 'hidden', timeout: 15000 }).then(() => true).catch(() => false)
  console.log(posted ? `Posted tweet: "${tweetText}"` : 'Composer still present — post may not have gone through')

  console.log('[closing_browser]')
  await browser.close()
}

```
