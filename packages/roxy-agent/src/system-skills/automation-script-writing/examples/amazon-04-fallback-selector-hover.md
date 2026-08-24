# amz-04 — Fallback selector chain + multi-image hover sequence + add to cart

**Pattern**: fallback selector 链 + 多图依次 hover + 加购,结果用断言而非截图确认

## Distinctive techniques

- **`findFallback(selectors[], timeoutMs)` helper**: walks selector list in order, splits the timeout budget evenly, returns the first one that becomes visible. Cleaner than nested try/catch, and budget-aware so a long initial wait doesn't starve the fallback path.
- **Hover loop without click**: `for (i in 0..3) hover(altImages.nth(i))` — multi-image carousel preview is a distinct pattern from "hover-then-click" (x-02 / x-04). No interaction beyond the hover; the page reacts visually.
- **Stop hover sequence on missing element**: `count() === 0 → break`, don't iterate over phantom indices.
- **Browse-scroll via `human.scroll`** from `@roxybrowser/sandbox/human` — create one actor per page and reuse it instead of hand-rolling wheel loops.
- **Confirm the cart-add by assertion, not screenshot**: a saved screenshot can't be the run deliverable (the log is the observable signal — see `SKILL.md` Output And Diagnostics). Instead assert the observable result — the cart-added confirmation panel (`#sw-atc-confirmation`, or the `i.a-icon-alert` warning) — and `console.log` the verdict. For a DOM capture while debugging, run under the **debug** profile with `capturePageSnapshot` (see `references/debugging.md`).
- **`Math.min(randomBetween(2,7), productCount-1)`** for product selection: random 1-based "3-8" mapped to 0-based 2-7, capped at actual length to avoid out-of-range.

## Canonical implementation

```typescript
// Task: goto Amazon → fallback selector (#nav-bb-search or #twotabsearchtextbox)
//       → type random keyword + Enter → scroll → click random product (3-8) → wait main image
//       → hover 3 thumbnails in order → scroll bottom → scroll top → add to cart → assert result
// Runtime: roxy-agent sandbox injects BROWSER_URL/BROWSER_TYPE.

import type { Page } from 'playwright'
import { chromium, firefox } from 'playwright'
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
import { sleep, randomBetween, pick } from '@roxybrowser/sandbox/utils'
import { createHuman } from '@roxybrowser/sandbox/human'

defineMetadata({ 
  name: 'Amazon fallback-selector + hover', 
  description: 'Search Amazon via a fallback selector, open a random product, hover thumbnails, then add to cart.', 
  version: '1.0.0' 
})

interface AmazonBrowseParams {
  keyword?: string
  hoverCount?: number
}

defineParams({
  type: 'object',
  properties: {
    keyword: { type: 'string', description: 'Search keyword. A built-in sample is chosen when omitted.' },
    hoverCount: { type: 'integer', minimum: 0, maximum: 20, default: 3, description: 'Maximum number of product thumbnails to hover.' },
  },
})

const DEFAULT_KEYWORDS = ['books', 'tools', 'pillows', 'keyboards']

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

export async function main(params: AmazonBrowseParams = {}): Promise<void> {
  const BROWSER_URL = process.env.BROWSER_URL ?? ''
  const BROWSER_TYPE = process.env.BROWSER_TYPE ?? 'chromium'
  const browser = BROWSER_TYPE === 'firefox' ? await firefox.connect(BROWSER_URL) : await chromium.connect(BROWSER_URL)
  
  const context = browser.contexts()[0] ?? await browser.newContext()
  const page = context.pages()[0] ?? await context.newPage()
  const human = createHuman(page)
  const pointerMotion = { duration: 300, curve: 'ease-out', path: { type: 'bezier', curvature: 34 } } as const
  const hoverCount = Math.max(0, Math.min(20, Math.floor(params.hoverCount ?? 3)))
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
  await sleep(5000, 6500)

  const keyword = params.keyword?.trim() || pick(DEFAULT_KEYWORDS)
  await human.type({
    target: page.locator(searchSel).first(),
    text: keyword,
    mode: 'replace',
    duration: Math.max(600, keyword.length * 85),
    curve: 'ease-in-out',
    focus: {
      ensureVisible: true,
      motion: pointerMotion,
      settleDuration: 70,
      holdDuration: 60,
    },
  })
  await sleep(1200, 1400)
  await human.press({ key: 'Enter', holdDuration: 60 })

  // Wait for results
  await page.locator('div[data-asin] .a-link-normal .s-image').first().waitFor({ state: 'visible', timeout: 30000 })
  await sleep(4500, 5500)

  // Scroll: middle then a short human-like nudge
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' }))
  await sleep(800, 1500)
  await human.scroll({ distance: 200, axis: 'vertical', duration: 300, curve: 'ease-out' })
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
  const targetIdx = Math.min(randomBetween(2, 7), productCount - 1) // 0-based; "3-8" in 1-based
  console.log(`Clicking product index ${targetIdx}`)
  await human.click({
    target: productImages.nth(targetIdx),
    ensureVisible: true,
    motion: pointerMotion,
    settleDuration: 70,
    holdDuration: 60,
  })

  // Wait for product detail main image
  await page.locator('#imgTagWrapperId').first().waitFor({ state: 'visible', timeout: 30000 })
  await sleep(5000, 6000)

  // Hover through the requested number of alt images
  for (let i = 0; i < hoverCount; i++) {
    const alt = page.locator('#altImages .item').nth(i)
    if (await alt.count() === 0) {
      console.log(`Alt image ${i + 1} missing, stopping hover sequence`)
      break
    }
    await human.hover({ target: alt, ensureVisible: true, motion: pointerMotion, dwellDuration: 0 })
    console.log(`Hovered alt image ${i + 1}`)
    await sleep(500, 800)
  }

  // Scroll to bottom then back to top
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }))
  await sleep(1000, 1500)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(2000, 2400)

  // Add to cart
  const addToCart = page.locator('.a-button-stack #add-to-cart-button').first()
  if (await addToCart.count() === 0) {
    console.log('Add-to-cart button missing (maybe out of stock or login required)')
    await browser.close()
    return
  }
  await human.click({
    target: addToCart,
    ensureVisible: true,
    motion: pointerMotion,
    settleDuration: 70,
    holdDuration: 60,
  })

  // Confirm by assertion, not screenshot: either the added-confirmation panel or the alert warning.
  const confirmed = page.locator('#sw-atc-confirmation, #huc-v2-order-row-confirm-text').first()
  const alert = page.locator('i.a-icon-alert').first()
  const added = await confirmed.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false)
  if (added) {
    console.log('Add to cart confirmed')
  }
  else if (await alert.count() > 0) {
    console.log('Add to cart blocked — alert shown (e.g. must choose a variant / sign in)')
  }
  else {
    console.log('No explicit confirmation or alert — result inconclusive from the DOM')
  }

  console.log('[closing_browser]')
  await browser.close()
}

```
