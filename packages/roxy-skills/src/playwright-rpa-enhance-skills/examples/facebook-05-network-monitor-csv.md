# fb-05 — Network monitor (graphql) + JSON extract → CSV with login early-exit

**Source fixture**: `output/RPA/fb-05.json`
**Capability clusters**: C6 (数据采集 + 持久化) + C7 (状态早退) + C15 (网络监听)
**User intent keywords**: "监听 graphql" / "page.on response" / "网络监听" / "account_user" / "导出 CSV/Excel" / "登录态早退" / "Logout 关闭浏览器"

## Distinctive techniques

- **`page.on('response', ...)` registered BEFORE the navigation that triggers it**. Order matters — registering after `goto()` misses early responses.
- **Stream-aware payload parsing**: FB graphql sometimes concatenates multiple JSON objects per response separated by newlines; split on `/\n/` and `JSON.parse` each part defensively (skip non-JSON parts).
- **Two-phase polling**: 50 × 50ms quick poll first (handles fast cache hits), then extend to 30 × 1s longer waits (network-bound). Avoids burning CPU on fast path while still tolerating slow responses.
- **Login form detection ≡ "logged out" signal**: `[action^="/login"]` is the FB-canonical login form. Its presence on the homepage means session is invalid → log "Logout" + close + return (early exit pattern).
- **Defensive JSON path traversal**: every property access does `?? undefined` cast through `Record<string, unknown>` then `String(... ?? '')` for CSV. Wrapped in try/catch with raw-JSON dump + full-page screenshot on parse failure (debugging artifact).
- **Manual CSV writing instead of xlsx dep**: `csvEscape` handles `,`, `"`, newlines per RFC 4180. Excel/Numbers/Sheets all open the result.

## Canonical implementation

```typescript
// Generated from output/RPA/fb-05.json — RPA fixture fb-05
// Task: Goto FB → 检测登录表单 → 存在则 'Logout' 早退
//       → page.on('response') 监听 api/graphql → Goto accountquality
//       → 轮询 50 次直到响应含 account_user → 解析 JSON 提取 6 字段
//       → 写 CSV;失败则 raw JSON + 全页截图
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
const shotPath = (id: string, tag = '') => path.join(ARTIFACTS_DIR, `${id}-${tag}-${Date.now()}.png`)
const CSV_PATH = path.join(ARTIFACTS_DIR, 'accountQuality.csv')
const RAW_JSON_PATH = path.join(ARTIFACTS_DIR, 'accountQuality.raw.json')

interface AccountRow {
  accountUserId: string
  accountUserName: string
  isRestricted: string
  adBusinessesId: string
  adBusinessesName: string
  adBusinessesIsRestricted: string
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '').replace(/\r?\n/g, ' ')
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function writeAccountCsv(row: AccountRow): void {
  const header = 'accountUserId,accountUserName,isRestricted,adBusinessesId,adBusinessesName,adBusinessesIsRestricted\n'
  const line = `${[
    row.accountUserId,
    row.accountUserName,
    row.isRestricted,
    row.adBusinessesId,
    row.adBusinessesName,
    row.adBusinessesIsRestricted,
  ].map(csvEscape).join(',')}\n`
  fs.writeFileSync(CSV_PATH, header + line, 'utf-8')
}

function findFirstAccountUser(payloads: unknown[]): unknown {
  for (const p of payloads) {
    if (!p || typeof p !== 'object')
      continue
    const data = (p as Record<string, unknown>).data as Record<string, unknown> | undefined
    const viewer = data?.viewer as Record<string, unknown> | undefined
    if (viewer && viewer.account_user)
      return p
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

  await page.goto('https://www.facebook.com/', { timeout: 30000 })
  await sleep(5000, 5000)

  // Login detection — early exit
  const loginForm = page.locator('[action^="/login"]').first()
  if (await loginForm.count() > 0) {
    console.log('Logout: login form detected at FB homepage')
    console.error('[logged_out]')
    await browser.close()
    return
  }

  // Network listener — collect graphql responses
  const responsePayloads: unknown[] = []
  page.on('response', async (resp) => {
    if (!resp.url().includes('api/graphql'))
      return
    try {
      const text = await resp.text()
      // FB graphql streams concatenate multiple JSONs separated by newlines sometimes
      const parts = text.split(/\n/).map(s => s.trim()).filter(Boolean)
      for (const part of parts) {
        try {
          responsePayloads.push(JSON.parse(part))
        }
        catch { /* not JSON */ }
      }
    }
    catch { /* ignore */ }
  })

  await page.goto('https://www.facebook.com/accountquality/?landing_page=overview', { timeout: 30000 })

  // Poll up to 50 iterations × 50ms = 2.5s, then extend to ~30s with longer waits
  let target: unknown = null
  for (let i = 0; i < 50; i++) {
    target = findFirstAccountUser(responsePayloads)
    if (target)
      break
    await sleep(50, 50)
  }
  if (!target) {
    // Extend wait — page may not have fired yet
    console.log('Initial 2.5s poll did not find account_user, extending to 30s')
    for (let i = 0; i < 30; i++) {
      target = findFirstAccountUser(responsePayloads)
      if (target)
        break
      await sleep(1000, 1000)
    }
  }

  if (!target) {
    console.log('Did not capture account_user in graphql responses')
    fs.writeFileSync(RAW_JSON_PATH, JSON.stringify(responsePayloads, null, 2), 'utf-8')
    await page.screenshot({ path: shotPath('fb-05', 'no-account-user'), fullPage: true })
    await browser.close()
    return
  }

  // Extract fields with safe accessors
  try {
    const data = (target as Record<string, unknown>).data as Record<string, unknown>
    const viewer = data.viewer as Record<string, unknown>
    const accountUser = viewer.account_user as Record<string, unknown>
    const accountUserId = String(accountUser.id ?? '')
    const accountUserName = String(accountUser.name ?? '')
    const restrictionInfo = accountUser.advertising_restriction_info as Record<string, unknown> | undefined
    const isRestricted = String(restrictionInfo?.is_restricted ?? '')

    const adBusinesses = viewer.ad_businesses as Record<string, unknown> | undefined
    const nodes = adBusinesses?.nodes as unknown[] | undefined
    const node0 = (nodes && nodes[0]) as Record<string, unknown> | undefined
    const adBusinessesId = String(node0?.id ?? '')
    const adBusinessesName = String(node0?.name ?? '')
    const adBusinessesAr = node0?.advertising_restriction_info as Record<string, unknown> | undefined
    const adBusinessesIsRestricted = String(adBusinessesAr?.is_restricted ?? '')

    writeAccountCsv({
      accountUserId,
      accountUserName,
      isRestricted,
      adBusinessesId,
      adBusinessesName,
      adBusinessesIsRestricted,
    })
    console.log(`CSV written: ${CSV_PATH}`)
  }
  catch (err) {
    console.log('Field extraction failed, saving raw + screenshot:', (err as Error).message)
    fs.writeFileSync(RAW_JSON_PATH, JSON.stringify(target, null, 2), 'utf-8')
    await page.screenshot({ path: shotPath('fb-05', 'parse-fail'), fullPage: true })
  }

  console.log('[closing_browser]')
  await browser.close()
}

```
