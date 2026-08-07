# x-04 — Like + reply with dialog-vs-inline composer branching

**Pattern**: 二选一分支(对话框 vs 内联输入框)+ 拟人回复

## Distinctive techniques

- **Dialog-existence binary branch**: `count() > 0 && isVisible()` decides between two textareas. **Don't `await isVisible()` directly on missing elements** — it throws if the element isn't attached, which is why we guard with `count()` first.
- **Different scope per branch** — dialog branch clicks into `[role="dialog"] [data-contents="true"]`, inline branch clicks into `[role="main"] [data-contents="true"]`. Same intent, different DOM scope. Same `replyText` selected once via `pick(REPLIES)` so the branches stay parallel.
- **Select the branch, then call explicit `human.type({...})`** — the branch chooses a Locator while focus motion, clearing mode, duration, and typing curve stay visible.
- **Multiple hover→click on the same selector via `.nth(N)`** — not a generic `[data-testid="like"].first()` repeated; `nth(0)` for post 1, `nth(2)` for post 3 to act on different cards.
- **Confirm the send by assertion, not screenshot**: assert the composer closed (the tweet button detaches) and `console.log` the verdict — a saved screenshot isn't the observable signal. Use `capturePageSnapshot` under the debug profile for a DOM snapshot (`references/debugging.md`).

## Canonical implementation

```typescript
// Task: scroll 6543 → back to top → hover+click 1st like → hover+click 3rd like → hover+click 3rd reply
//       → dialog present ? type in dialog : type in main → post → assert sent
// Runtime: roxy-agent sandbox injects BROWSER_URL/BROWSER_TYPE.

import { chromium, firefox } from 'playwright'
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
import { sleep, pick } from '@roxybrowser/sandbox/utils'
import { createHuman } from '@roxybrowser/sandbox/human'

defineMetadata({ name: 'Twitter dialog-or-inline reply', description: 'Scroll the timeline, like a couple of posts, then reply — typing into the reply dialog if present, otherwise inline — and post.', version: '1.0.0' })

interface TwitterReplyParams {
  replies?: string[]
}

defineParams({
  type: 'object',
  properties: {
    replies: { type: 'array', items: { type: 'string' }, minItems: 1, description: 'Candidate reply texts. A built-in list is used when omitted.' },
  },
})

const DEFAULT_REPLIES = ['Good Luck!', 'Have a nice day~']

export async function main(params: TwitterReplyParams = {}): Promise<void> {
  const BROWSER_URL = process.env.BROWSER_URL ?? ''
  const BROWSER_TYPE = process.env.BROWSER_TYPE ?? 'chromium'
  const browser = BROWSER_TYPE === 'firefox' ? await firefox.connect(BROWSER_URL) : await chromium.connect(BROWSER_URL)
  const context = browser.contexts()[0] ?? await browser.newContext()
  const page = context.pages()[0] ?? await context.newPage()
  const human = createHuman(page)
  const pointerMotion = { duration: 300, curve: 'ease-out', path: { type: 'bezier', curvature: 32 } } as const
  const stationaryMotion = { duration: 0, curve: 'linear', path: 'linear' } as const
  console.log('[start]')

  await page.goto('https://twitter.com/', { timeout: 30000 })
  await page.locator('[role="button"][data-testid="like"]').first().waitFor({ state: 'visible', timeout: 30000 })
  await sleep(5500, 7500)

  await human.scroll({ distance: 6543, axis: 'vertical', duration: 2800, curve: 'ease-in-out' })
  await sleep(800, 1500)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(1500, 2500)

  // Like the 1st post (index 0)
  const like1 = page.locator('[role="button"][data-testid="like"]').nth(0)
  await human.hover({ target: like1, ensureVisible: true, motion: pointerMotion, dwellDuration: 0 })
  await sleep(2400, 4300)
  await human.click({ target: like1, motion: stationaryMotion, settleDuration: 0, holdDuration: 60 })
  console.log('Liked post 1')
  await sleep(2100, 3100)

  // Like the 3rd post (index 2)
  const like3 = page.locator('[role="button"][data-testid="like"]').nth(2)
  await human.hover({ target: like3, ensureVisible: true, motion: pointerMotion, dwellDuration: 0 })
  await sleep(1100, 1200)
  await human.click({ target: like3, motion: stationaryMotion, settleDuration: 0, holdDuration: 60 })
  console.log('Liked post 3')
  await sleep(1200, 2100)

  // Reply on the 3rd post
  const reply3 = page.locator('[data-testid="reply"]').nth(2)
  await human.hover({ target: reply3, ensureVisible: true, motion: pointerMotion, dwellDuration: 0 })
  await sleep(1200, 1300)
  await human.click({ target: reply3, motion: stationaryMotion, settleDuration: 0, holdDuration: 60 })
  await sleep(2400, 4300)

  // Branch: dialog vs main page composer
  const dialogTextarea = page.locator('[role="dialog"] [data-contents="true"]').first()
  const mainTextarea = page.locator('[role="main"] [data-contents="true"]').first()
  const replies = params.replies?.map(value => value.trim()).filter(Boolean)
  const replyText = pick(replies?.length ? replies : DEFAULT_REPLIES)

  const composer = await dialogTextarea.count() > 0 && await dialogTextarea.isVisible()
    ? dialogTextarea
    : mainTextarea
  console.log(composer === dialogTextarea ? 'Dialog branch: typing in dialog composer' : 'Inline branch: typing in main page composer')
  await human.type({
    target: composer,
    text: replyText,
    mode: 'replace',
    duration: Math.max(650, replyText.length * 90),
    curve: 'ease-in-out',
    focus: {
      ensureVisible: true,
      motion: pointerMotion,
      settleDuration: 75,
      holdDuration: 60,
    },
  })
  await sleep(3400, 4300)

  // Submit reply
  const tweetBtn = page.locator('[data-testid="tweetButton"]').first()
  await human.hover({ target: tweetBtn, ensureVisible: true, motion: pointerMotion, dwellDuration: 0 })
  await sleep(1100, 1200)
  await human.click({ target: tweetBtn, motion: stationaryMotion, settleDuration: 0, holdDuration: 60 })

  // Assert the composer closed (reply sent) rather than screenshotting
  const sent = await tweetBtn.waitFor({ state: 'hidden', timeout: 15000 }).then(() => true).catch(() => false)
  console.log(sent ? `Posted reply: "${replyText}"` : 'Reply button still present — send may not have gone through')

  console.log('[closing_browser]')
  await browser.close()
}

```
