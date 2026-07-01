# amz-03 — Amazon reviews paginated scrape → CSV (10 pages, break on missing next)

**Source fixture**: `output/RPA/amz-03.json`
**Capability clusters**: C3 (搜索引擎流) + C6 (数据采集 + 持久化) + C14 (翻页累积)
**User intent keywords**: "翻页累积" / "下一页" / "评论采集" / "导出 CSV" / "Loop 10 次提取" / ".a-last 下一页"

## Distinctive techniques

- **Two-tier write pattern**: header info (product title / rating count / reviews header) goes to a `.txt` once; per-card rows append to `.csv` continuously. Don't conflate metadata and rows in one file.
- **`safeText(parent, child, idx)` helper** — wraps `page.locator(parent).nth(idx).locator(child).first().innerText()` with `count() === 0 → ''` guard. Replaces 6 try/catch blocks with one helper, avoids per-field crashes on missing data.
- **Pagination break on missing `.a-last a`**: `count() === 0 → break`. The "next" link disappears on the last page; that's the natural stop signal — don't try to count pages forward.
- **CSV initialized with header row before loop, then `appendFileSync` per card**: cheap incremental writes, file usable even if script crashes mid-loop (partial data preserved).
- **`.replace(/\r?\n/g, ' ')` in csvEscape**: review bodies contain newlines that would break CSV row counting; collapse to spaces before escape.

## Canonical implementation

```typescript
// Generated from output/RPA/amz-03.json — RPA fixture amz-03
// Task: Goto AirPods reviews → 提取标题 / 评分总数 / header → 写文件 header
//       → Loop 10 次:遍历 review-card 提取 6 字段 → 追加 CSV → 翻页;无下一页则 break
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

const ARTIFACTS_DIR = path.resolve(process.cwd(), 'output/RPA/artifacts')
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })

const REVIEWS_URL
  = 'https://www.amazon.com/Apple-AirPods-Charging-Latest-Model/product-reviews/B07PXGQC1Q/'
    + 'ref=cm_cr_arp_d_paging_btm_next_2?ie=UTF8&reviewerType=all_reviews'

const CSV_PATH = path.join(ARTIFACTS_DIR, 'airpod-reviews.csv')
const TXT_PATH = path.join(ARTIFACTS_DIR, 'airpod-reviews.header.txt')

function csvEscape(v: unknown): string {
  const s = String(v ?? '').replace(/\r?\n/g, ' ')
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function safeText(page: Page, parentSel: string, childSel: string, idx: number): Promise<string> {
  try {
    const loc = page.locator(parentSel).nth(idx).locator(childSel).first()
    if (await loc.count() === 0)
      return ''
    return (await loc.innerText()).trim()
  }
  catch { return '' }
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

  await page.goto(REVIEWS_URL, { timeout: 30000 })

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

  fs.writeFileSync(
    TXT_PATH,
    `${productTitle}\n---------\n${ratingCount}\n---------\n${reviewsHeader}\n---------\n`,
    'utf-8'
  )
  console.log(`Header saved: ${TXT_PATH}`)

  // Initialize CSV with header row
  fs.writeFileSync(
    CSV_PATH,
    'profile_name,star_rating,title,date,body,helpful\n',
    'utf-8'
  )
  console.log(`CSV initialized: ${CSV_PATH}`)

  for (let pageIdx = 0; pageIdx < 10; pageIdx++) {
    console.log(`[Page ${pageIdx + 1}/10]`)
    await page.locator('#cm_cr-review_list').first().waitFor({ state: 'visible', timeout: 30000 })
    await sleep(1000, 1500)

    const cards = page.locator('[id*="-review-card"]')
    const cardCount = await cards.count()
    console.log(`  Found ${cardCount} review cards`)

    for (let i = 0; i < cardCount; i++) {
      const profileName = await safeText(page, '[id*="-review-card"]', '.a-profile-name', i)
      const starRating = await safeText(page, '[id*="-review-card"]', '[data-hook="review-star-rating"]', i)
      const title = await safeText(page, '[id*="-review-card"]', '[data-hook="review-title"]', i)
      const date = await safeText(page, '[id*="-review-card"]', '[data-hook="review-date"]', i)
      const body = await safeText(page, '[id*="-review-card"]', '[data-hook="review-body"]', i)
      const helpful = await safeText(page, '[id*="-review-card"]', '[data-hook="helpful-vote-statement"]', i)

      const row = `${[profileName, starRating, title, date, body, helpful].map(csvEscape).join(',')}\n`
      fs.appendFileSync(CSV_PATH, row, 'utf-8')
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

  console.log(`Done. CSV at ${CSV_PATH}`)
  console.log('[closing_browser]')
  await browser.close()
}

```
