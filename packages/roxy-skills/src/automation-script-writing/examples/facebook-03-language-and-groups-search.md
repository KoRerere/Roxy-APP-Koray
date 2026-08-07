# fb-03 — Language switch + Facebook Groups keyword search and Join

**Pattern**: 语言切换守卫 + Facebook Groups 关键词搜索 + 随机 Join

## Distinctive techniques

- **Language detection guard pattern (shared with fb-02)**: read `#facebook[lang]`, only execute the 4-step language switch flow if lang is non-en. Cheap header read, expensive flow gated.
- **XPath for FB-specific scoped containers**: `//div[@role="navigation"]//label/input` (search box) and `//div[@role="feed"]/div//span[text()="Join"]` — these targets are easier to express in XPath than complex CSS, and FB's class names rotate too quickly for class-based CSS to be stable.
- **Random index from `[0, min(total-1, 9)]`**: cap at top-10 even if more results exist; avoids picking deeply ranked matches.
- **Empty-result early exit**: `total === 0` ⇒ log + close + return, instead of throwing. Gracefully handles "user already in all matching groups".
- **Two-stage navigation**: hit homepage first to detect lang, _then_ goto `/groups/feed`. Avoids the lang switch interrupting the groups search session.

## Canonical implementation

```typescript
// Task: goto FB → if lang != en, switch to English → goto groups/feed → type random keyword + search
//       → wait feed → click a random Join button
// Runtime: roxy-agent sandbox injects BROWSER_URL/BROWSER_TYPE.

import type { Page } from 'playwright'
import { chromium, firefox } from 'playwright'
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
import { sleep, randomBetween, pick } from '@roxybrowser/sandbox/utils'

defineMetadata({ name: 'Facebook language switch + groups search', description: 'Ensure Facebook is in English, search Groups for a random keyword, and join a random group.', version: '1.0.0' })

interface FacebookGroupParams {
  keyword?: string
}

defineParams({
  type: 'object',
  properties: {
    keyword: { type: 'string', description: 'Group search keyword. A built-in sample is chosen when omitted.' },
  },
})

const DEFAULT_KEYWORDS = ['DuoPlus', 'AdsPower']

async function ensureEnglish(page: Page): Promise<void> {
  const lang = await page.locator('#facebook').first().getAttribute('lang').catch(() => null)
  if (lang === 'en' || lang?.startsWith('en')) {
    console.log(`Lang already English (${lang})`)
    return
  }
  console.log(`Lang is "${lang}", switching to English (US)`)
  await page.goto('https://www.facebook.com/settings/?tab=language', { timeout: 30000 })
  await sleep(5000, 6500)
  await page.locator('div[role="main"] div[style*="border-radius"] [role="button"]').first().click()
  await sleep(5000, 6500)
  await page.locator('//div[@role="dialog"]//label/input').first().fill('US')
  await sleep(5000, 6500)
  await page.locator('//*[@role="dialog"]//*[@role="radio"]').first().click()
}

export async function main(params: FacebookGroupParams = {}): Promise<void> {
  const BROWSER_URL = process.env.BROWSER_URL ?? ''
  const BROWSER_TYPE = process.env.BROWSER_TYPE ?? 'chromium'
  const browser = BROWSER_TYPE === 'firefox' ? await firefox.connect(BROWSER_URL) : await chromium.connect(BROWSER_URL)
  const context = browser.contexts()[0] ?? await browser.newContext()
  const page = context.pages()[0] ?? await context.newPage()
  console.log('[start]')

  await page.goto('https://www.facebook.com/', { timeout: 30000 })
  await sleep(2000, 3000)
  await ensureEnglish(page)

  await page.goto('https://www.facebook.com/groups/feed', { timeout: 30000 })
  await sleep(5000, 6500)

  const searchBox = page.locator('//div[@role="navigation"]//label/input').first()
  await searchBox.waitFor({ state: 'visible', timeout: 30000 })

  const keyword = params.keyword?.trim() || pick(DEFAULT_KEYWORDS)
  await searchBox.fill(keyword)
  console.log(`Searched groups for "${keyword}"`)
  await sleep(2000, 4000)
  await page.keyboard.press('Enter')
  await sleep(5000, 6500)

  const feed = page.locator('//div[@role="feed"]').first()
  await feed.waitFor({ state: 'visible', timeout: 30000 })
  await sleep(5000, 6500)

  // Click a random "Join" button (cap at top-10 available)
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
