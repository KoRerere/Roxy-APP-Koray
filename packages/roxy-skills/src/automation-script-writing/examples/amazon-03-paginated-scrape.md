# amz-03 — Amazon reviews paginated scrape → Table (10 pages, break on missing next)

**Pattern**: 翻页累积采集(`.a-last a` 断页)→ `Table` 逐行持久化 + 一次性 header 表

## Distinctive techniques

- **Two-table write pattern**: header info (product title / rating count / reviews header) goes to `Table('airpod-reviews-header')` once; per-card rows append to `Table('airpod-reviews')` continuously. Don't conflate metadata and rows in one table.
- **`safeText(parent, child, idx)` helper** — wraps `page.locator(parent).nth(idx).locator(child).first().innerText()` with `count() === 0 → ''` guard. Replaces 6 try/catch blocks with one helper, avoids per-field crashes on missing data.
- **Pagination break on missing `.a-last a`**: `count() === 0 → break`. The "next" link disappears on the last page; that's the natural stop signal — don't try to count pages forward.
- **Prefer `Table` over hand-written CSV**: `Table.append(row)` derives the CSV header from the record keys and escapes fields itself, so this structured-row use case does not need manual `appendFileSync` or `csvEscape`. Native `fs` is available for arbitrary files, but `Table` is the safer abstraction here. Newlines in review bodies are field data and need no manual `\n` collapsing.

## Canonical implementation

```typescript
// Task: goto AirPods reviews → extract title / rating count / header → header Table
//       → loop 10×: iterate review cards, extract 6 fields → append rows Table → next page; break when no next
// Persistence: header → Table('airpod-reviews-header'); rows → Table('airpod-reviews') (both CSV, release-safe).
// Runtime: roxy-agent sandbox injects BROWSER_URL/BROWSER_TYPE.

import type { Page } from 'playwright'
import { chromium, firefox } from 'playwright'
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
import { sleep } from '@roxybrowser/sandbox/utils'
import { Table } from '@roxybrowser/sandbox/table'

defineMetadata({ 
  name: 'Amazon reviews paginated scrape', 
  description: 'Scrape AirPods product-review pages (title/rating/header + per-card fields) across up to 10 pages into CSV tables.', 
  version: '1.0.0' 
})

interface AmazonReviewParams {
  reviewsUrl?: string
  maxPages?: number
}

defineParams({ 
  type: 'object',
  properties: {
    reviewsUrl: { type: 'string', description: 'Amazon product reviews URL.' },
    maxPages: { type: 'integer', minimum: 1, maximum: 100, default: 10, description: 'Maximum review pages to scrape.' },
  },
})

const DEFAULT_REVIEWS_URL
  = 'https://www.amazon.com/Apple-AirPods-Charging-Latest-Model/product-reviews/B07PXGQC1Q/'
    + 'ref=cm_cr_arp_d_paging_btm_next_2?ie=UTF8&reviewerType=all_reviews'

async function safeText(page: Page, parentSel: string, childSel: string, idx: number): Promise<string> {
  try {
    const loc = page.locator(parentSel).nth(idx).locator(childSel).first()
    if (await loc.count() === 0)
      return ''
    return (await loc.innerText()).trim()
  }
  catch { return '' }
}

export async function main(params: AmazonReviewParams = {}): Promise<void> {
  const BROWSER_URL = process.env.BROWSER_URL ?? ''
  const BROWSER_TYPE = process.env.BROWSER_TYPE ?? 'chromium'
  const browser = BROWSER_TYPE === 'firefox' ? await firefox.connect(BROWSER_URL) : await chromium.connect(BROWSER_URL)

  const context = browser.contexts()[0] ?? await browser.newContext()
  const page = context.pages()[0] ?? await context.newPage()
  const reviewsUrl = params.reviewsUrl?.trim() || DEFAULT_REVIEWS_URL
  const maxPages = Math.max(1, Math.min(100, Math.floor(params.maxPages ?? 10)))
  console.log('[start]')

  await page.goto(reviewsUrl, { timeout: 30000 })
  await page.locator('.product-title').first().waitFor({ state: 'visible', timeout: 30000 })

  const productTitle = await page.locator('.product-title h1 a').first().innerText().catch(() => '')
  const ratingCount = await page
    .locator('[data-hook="cr-filter-info-review-rating-count"]')
    .first()
    .innerText()
    .catch(() => '')
  const reviewsHeader = await page
    .locator('#cm_cr-review_list [data-hook="arp-local-reviews-header"]')
    .first()
    .innerText()
    .catch(() => '')

  const headerTable = new Table('airpod-reviews-header')
  await headerTable.append({ productTitle, ratingCount, reviewsHeader })
  console.log('Header row saved to Table(airpod-reviews-header)')

  const reviewsTable = new Table('airpod-reviews')
  let rowCount = 0

  for (let pageIdx = 0; pageIdx < maxPages; pageIdx++) {
    console.log(`[Page ${pageIdx + 1}/${maxPages}]`)
    await page.locator('#cm_cr-review_list').first().waitFor({ state: 'visible', timeout: 30000 })
    await sleep(1000, 1500)

    const cards = page.locator('[id*="-review-card"]')
    const cardCount = await cards.count()
    console.log(`  Found ${cardCount} review cards`)

    for (let i = 0; i < cardCount; i++) {
      await reviewsTable.append({
        profile_name: await safeText(page, '[id*="-review-card"]', '.a-profile-name', i),
        star_rating: await safeText(page, '[id*="-review-card"]', '[data-hook="review-star-rating"]', i),
        title: await safeText(page, '[id*="-review-card"]', '[data-hook="review-title"]', i),
        date: await safeText(page, '[id*="-review-card"]', '[data-hook="review-date"]', i),
        body: await safeText(page, '[id*="-review-card"]', '[data-hook="review-body"]', i),
        helpful: await safeText(page, '[id*="-review-card"]', '[data-hook="helpful-vote-statement"]', i),
      })
      rowCount++
    }

    // Try to click "next page"
    const nextLink = page.locator('.a-last a').first()
    if (await nextLink.count() === 0) {
      console.log('  No next page, stopping')
      break
    }
    await nextLink.click()
    await sleep(2000, 3000)
  }

  console.log(`Done. ${rowCount} rows in Table(airpod-reviews)`)
  console.log('[closing_browser]')
  await browser.close()
}

```
