# fb-03 — Language switch + Facebook Groups keyword search and Join

**Source fixture**: `output/RPA/fb-03.json`
**Capability clusters**: C3 (搜索引擎流) + C11 (语言切换)
**User intent keywords**: "Facebook Groups" / "搜索群组" / "语言切换" / "lang attribute" / "Join 按钮" / "随机加入"

## Distinctive techniques

- **Language detection guard pattern (shared with fb-02)**: read `#facebook[lang]`, only execute the 4-step language switch flow if lang is non-en. Cheap header read, expensive flow gated.
- **XPath for FB-specific scoped containers**: `//div[@role="navigation"]//label/input` (search box) and `//div[@role="feed"]/div//span[text()="Join"]` — these targets are easier to express in XPath than complex CSS, and FB's class names rotate too quickly for class-based CSS to be stable.
- **Random index from `[0, min(total-1, 9)]`**: cap at top-10 even if more results exist (the Source fixture had `serial: 1..10 random`); avoids picking deeply ranked matches.
- **Empty-result early exit**: `total === 0` ⇒ log + close + return, instead of throwing. Gracefully handles "user already in all matching groups".
- **Two-stage navigation**: hit homepage first to detect lang, _then_ goto `/groups/feed`. Avoids the lang switch interrupting groups search session.

## Canonical implementation

```typescript
// Generated from output/RPA/fb-03.json — RPA fixture fb-03
// 注意: JSON 实际行为是 Facebook Groups 搜索关键词 + Join,与 README markdown 描述
// "Reels 增强版"不一致。本脚本忠于 JSON。
// Task: Goto FB → 检测语言非 en 切英文 → Goto groups/feed → 输入随机关键词搜索
//       → 等 feed → 点随机一个 Join 按钮
// Runtime: roxy-agent sandbox injects BROWSER_URL/CDP_URL.

import type { Page } from 'playwright'
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

const KEYWORDS = ['DuoPlus', 'AdsPower']

async function ensureEnglish(page: Page): Promise<void> {
  const lang = await page.locator('#facebook').first().getAttribute('lang').catch(() => null)
  if (lang === 'en' || lang?.startsWith('en')) {
    console.log(`Lang already English (${lang})`)
    return
  }
  console.log(`Lang is "${lang}", switching to English (US)`)
  await page.goto('https://www.facebook.com/settings/?tab=language', { timeout: 30000 })
  await sleep(5343, 6242)
  await page.locator('div[role="main"] div[style*="border-radius"] [role="button"]').first().click()
  await sleep(5343, 6242)
  await page.locator('//div[@role="dialog"]//label/input').first().fill('US')
  await sleep(5343, 6242)
  await page.locator('//*[@role="dialog"]//*[@role="radio"]').first().click()
}

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

  await page.goto('https://www.facebook.com/', { timeout: 30000 })
  await sleep(2000, 3000)
  await ensureEnglish(page)

  await page.goto('https://www.facebook.com/groups/feed', { timeout: 30000 })
  await sleep(5343, 6242)

  const searchBox = page.locator('//div[@role="navigation"]//label/input').first()
  await searchBox.waitFor({ state: 'visible', timeout: 30000 })

  const keyword = pick(KEYWORDS)
  await searchBox.fill(keyword)
  console.log(`Searched groups for "${keyword}"`)
  await sleep(2343, 4242)
  await page.keyboard.press('Enter')
  await sleep(5343, 6242)

  const feed = page.locator('//div[@role="feed"]').first()
  await feed.waitFor({ state: 'visible', timeout: 30000 })
  await sleep(5343, 6242)

  // Click a random "Join" button (1..10 in JSON serial; we treat as random of available)
  const joinBtns = page.locator('//div[@role="feed"]/div//span[text()="Join"]')
  const total = await joinBtns.count()
  console.log(`Found ${total} Join buttons`)
  if (total === 0) {
    console.log('No Join button — already member of all matching groups, or no results')
    await browser.close()
    return
  }

  const idx = randomBetween(0, Math.min(total - 1, 9))
  console.log(`Clicking Join button at index ${idx}`)
  await joinBtns.nth(idx).click()
  await sleep(2000, 3000)

  console.log('[closing_browser]')
  await browser.close()
}

```
