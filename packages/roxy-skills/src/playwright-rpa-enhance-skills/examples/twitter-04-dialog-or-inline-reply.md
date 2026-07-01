# x-04 — Like + reply with dialog-vs-inline composer branching

**Source fixture**: `output/RPA/x-04.json`
**Capability clusters**: C5 (UGC 评论) + C9 (二选一 / dialog-existence) + C12 (hover 序列)
**User intent keywords**: "回复对话框" / "对话框是否弹出" / "二选一" / "either dialog or inline" / "dialog.count() > 0" / "if-else composer"

## Distinctive techniques

- **Dialog-existence binary branch**: `count() > 0 && isVisible()` decides between two textareas. **Don't `await isVisible()` directly on missing elements** — it throws if the element isn't attached, which is why we guard with `count()` first.
- **Different scope per branch** — dialog branch types into `[role="dialog"] [data-contents="true"]`, inline branch types into `[role="main"] [data-contents="true"]`. Same intent, different DOM scope. Same `replyText` selected once via `pick(REPLIES)` so the branches stay parallel.
- **`page.keyboard.type` not `locator.type`** in both branches — after `.click()` focuses the contenteditable, keyboard events go to the focused element regardless of which selector won.
- **Multiple hover→click on the same selector via `.nth(N)`** — not a generic `[data-testid="like"].first()` repeated; `nth(0)` for post 1, `nth(2)` for post 3 to act on different cards.
- **Tail screenshot after submit** captures the posted state; not a verification screenshot (which would be forbidden by recording-mode rule 6) — it's the deliverable artifact.

## Canonical implementation

```typescript
// Generated from output/RPA/x-04.json — RPA fixture x-04
// Task: 滚 6543 → 回顶 → hover+click 第 1 like → hover+click 第 3 like → hover+click 第 3 reply
//       → 检测对话框存在 ? 在 dialog 输入 : 在 main 输入 → 发推 → 截图
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

const REPLIES = ['Good Luck!', 'Have a nice day~']

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

  await page.goto('https://twitter.com/', { timeout: 30000 })
  await page.locator('[role="button"][data-testid="like"]').first().waitFor({ state: 'visible', timeout: 30000 })
  await sleep(5678, 7654)

  await humanScroll(page, 6543, 'down')
  await sleep(800, 1500)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(1500, 2500)

  // Like the 1st post (index 0)
  const like1 = page.locator('[role="button"][data-testid="like"]').nth(0)
  await like1.scrollIntoViewIfNeeded()
  await like1.hover()
  await sleep(2413, 4322)
  await like1.click()
  console.log('Liked post 1')
  await sleep(2121, 3121)

  // Like the 3rd post (index 2 since serial 3 means 3rd in 1-based)
  const like3 = page.locator('[role="button"][data-testid="like"]').nth(2)
  await like3.scrollIntoViewIfNeeded()
  await like3.hover()
  await sleep(1112, 1212)
  await like3.click()
  console.log('Liked post 3')
  await sleep(1212, 2123)

  // Reply on the 3rd post
  const reply3 = page.locator('[data-testid="reply"]').nth(2)
  await reply3.scrollIntoViewIfNeeded()
  await reply3.hover()
  await sleep(1212, 1312)
  await reply3.click()
  await sleep(2455, 4342)

  // Branch: dialog vs main page composer
  const dialogTextarea = page.locator('[role="dialog"] [data-contents="true"]').first()
  const mainTextarea = page.locator('[role="main"] [data-contents="true"]').first()
  const replyText = pick(REPLIES)

  if (await dialogTextarea.count() > 0 && await dialogTextarea.isVisible()) {
    console.log('Dialog branch: typing in dialog composer')
    await dialogTextarea.click()
    await sleep(300, 600)
    await page.keyboard.type(replyText, { delay: 100 })
  }
  else {
    console.log('Inline branch: typing in main page composer')
    await mainTextarea.click()
    await sleep(300, 600)
    await page.keyboard.type(replyText, { delay: 100 })
  }
  await sleep(3451, 4324)

  // Submit reply
  const tweetBtn = page.locator('[data-testid="tweetButton"]').first()
  await tweetBtn.hover()
  await sleep(1121, 1212)
  await tweetBtn.click()
  await sleep(2124, 3212)

  await page.screenshot({ path: shotPath('x-04'), fullPage: false })
  console.log(`Posted reply: "${replyText}"`)

  console.log('[closing_browser]')
  await browser.close()
}

```
