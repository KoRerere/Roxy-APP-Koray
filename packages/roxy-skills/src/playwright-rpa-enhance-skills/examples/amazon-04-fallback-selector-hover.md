# amz-04 — Fallback selector chain + multi-image hover sequence + add to cart

**Source fixture**: `output/RPA/amz-04.json`
**Capability clusters**: C3 (搜索引擎流) + C8 (响应式分支 / fallback) + C12 (hover 序列)
**User intent keywords**: "优先 #X 不存在则 #Y" / "fallback selector" / "依次悬停 N 张图" / "悬停浏览图片" / "加入购物车"

## Distinctive techniques

- **`findFallback(selectors[], timeoutMs)` helper**: walks selector list in order, splits the timeout budget evenly, returns the first one that becomes visible. Cleaner than nested try/catch, and budget-aware so a long initial wait doesn't starve the fallback path.
- **Hover loop without click**: `for (i in 0..3) hover(altImages.nth(i))` — multi-image carousel preview is a distinct pattern from "hover-then-click" (x-02 / x-04). No interaction beyond the hover; the page reacts visually.
- **Stop hover sequence on missing element**: `count() === 0 → break`, don't iterate over phantom indices.
- **Two-stage scroll** (`scrollTo(scrollHeight)` then `scrollTo(0)`): browse-bottom-then-return is a human-like signal that "I read everything" without committing to any specific item.
- **Tolerant cart-add result wait**: `i.a-icon-alert` may or may not appear; use `.catch(() => log)` to avoid throwing on silent success. Always screenshot regardless of outcome.
- **`Math.min(randomBetween(2,7), productCount-1)`** for product selection: random 1-based "3-8" mapped to 0-based 2-7, capped at actual length to avoid out-of-range.

## Canonical implementation

```typescript
// Generated from output/RPA/amz-04.json — RPA fixture amz-04
// Task: Goto Amazon → fallback selector (#nav-bb-search 或 #twotabsearchtextbox)
//       → 输入随机关键词 + Enter → 滚动 → 随机点 3-8 商品 → 等主图
//       → 依次 hover 3 张缩略图 → 滚 bottom → 滚 top → 加购物车 → 等结果 → 截图
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
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

async function humanScroll(page: Page, distance: number, direction: 'down' | 'up' = 'down'): Promise<void> {
  const sign = direction === 'down' ? 1 : -1
  let scrolled = 0
  while (scrolled < distance) {
    const step = Math.min(randomBetween(80, 200), distance - scrolled)
    await page.mouse.wheel(0, step * sign)
    scrolled += step
    await sleep(80, 200)
  }
}

const ARTIFACTS_DIR = path.resolve(process.cwd(), 'output/RPA/artifacts')
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
const shotPath = (id: string) => path.join(ARTIFACTS_DIR, `${id}-${Date.now()}.png`)

const KEYWORDS = ['books', 'tools', 'pillows', 'keyboards']

async function findFallback(page: Page, selectors: string[], timeoutMs = 30000): Promise<string | null> {
  for (const sel of selectors) {
    try {
      await page.locator(sel).first().waitFor({ state: 'visible', timeout: timeoutMs / selectors.length })
      return sel
    }
    catch { /* try next */ }
  }
  return null
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

  await page.goto('https://www.amazon.com/', { timeout: 30000 })

  const searchSel = await findFallback(page, ['#nav-bb-search', '#twotabsearchtextbox'])
  if (!searchSel) {
    console.error('No search box found (neither #nav-bb-search nor #twotabsearchtextbox)')
    console.error('[search_box_missing]')
    await browser.close()
    return
  }
  console.log(`Using search selector: ${searchSel}`)
  await sleep(5656, 6543)

  const keyword = pick(KEYWORDS)
  await page.locator(searchSel).first().fill(keyword)
  await sleep(1200, 1342)
  await page.keyboard.press('Enter')

  // Wait for results
  await page.locator('div[data-asin] .a-link-normal .s-image').first().waitFor({ state: 'visible', timeout: 30000 })
  await sleep(4545, 5432)

  // Scroll: middle then +200px
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' }))
  await sleep(800, 1500)
  await humanScroll(page, 200, 'down')
  await sleep(800, 1500)

  // Click random product (index 3..8)
  const productImages = page.locator('div[data-asin] .a-link-normal .s-image')
  const productCount = await productImages.count()
  console.log(`Found ${productCount} product images`)
  if (productCount === 0) {
    console.error('No products')
    console.error('[no_products]')
    await browser.close()
    return
  }
  /**
   * 0-based; "3-8" in 1-based
   */
  const targetIdx = Math.min(randomBetween(2, 7), productCount - 1)
  console.log(`Clicking product index ${targetIdx}`)
  await productImages.nth(targetIdx).click()

  // Wait for product detail main image
  await page.locator('#imgTagWrapperId').first().waitFor({ state: 'visible', timeout: 30000 })
  await sleep(5454, 6123)

  // Hover through 3 alt images
  for (let i = 0; i < 3; i++) {
    const alt = page.locator('#altImages .item').nth(i)
    if (await alt.count() === 0) {
      console.log(`Alt image ${i + 1} missing, stopping hover sequence`)
      break
    }
    await alt.hover()
    console.log(`Hovered alt image ${i + 1}`)
    await sleep(500, 800)
  }

  // Scroll to bottom then back to top
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
  await sleep(1000, 1500)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(2234, 2354)

  // Add to cart
  const addToCart = page.locator('.a-button-stack #add-to-cart-button').first()
  if (await addToCart.count() === 0) {
    console.log('Add-to-cart button missing (maybe out of stock or login required)')
    await page.screenshot({ path: shotPath('amz-04'), fullPage: false })
    await browser.close()
    return
  }
  await addToCart.click()

  // Wait for either success indicator or alert (race-ish — JSON only awaits alert; we keep that semantics)
  const alertSel = page.locator('i.a-icon-alert').first()
  await alertSel.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {
    console.log('Did not see i.a-icon-alert (might have succeeded silently)')
  })
  await sleep(2000, 2500)

  await page.screenshot({ path: shotPath('amz-04'), fullPage: false })
  console.log('Done — screenshot saved')

  console.log('[closing_browser]')
  await browser.close()
}

```
