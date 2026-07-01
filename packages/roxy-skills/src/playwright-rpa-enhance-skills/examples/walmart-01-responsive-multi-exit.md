# wm-01 — Walmart responsive sign-in / sign-up with three early-exit branches

**Source fixture**: `output/RPA/wm-01.json`
**Capability clusters**: C7 (状态早退) + C8 (响应式分支) + C16 (变量注入 env)
**User intent keywords**: "屏幕宽度 > 1024" / "viewportSize" / "responsive" / "登录态早退" / "邮箱已注册" / "Email is Registered" / "用变量传入邮箱密码"

## Distinctive techniques

- **Three independent early-exit gates**:
  1. Already signed in (`loginLink.count() === 0`) → log "Signed in" → close
  2. Sign-up form never appears (timeout) → screenshot + close (flow diverged: 2FA / direct-login)
  3. firstName field missing (`count() === 0`) → log "Email is Registered" → close
- **Responsive branch via `page.evaluate(() => window.innerWidth <= 1024)`** — runs in browser context, captures live width. Matches what users see, avoids assuming default Playwright viewport.
- **Two completely different selectors per branch**: small uses `button[aria-label="Menu"]` then `nav a[link-identifier="walmartLogo"]+button`; large uses `[href^="/account/login"]` then `[data-testid="account-flyout"] button`. Same intent (open login UI), different DOM scope.
- **Pre-filled email check** (`getAttribute('value')`): skip the fill step if Walmart auto-populated. Avoids duplicate text in the field.
- **Required `options` enforced at script start**: `options.email` always required (process.exit), `options.password` only required when entering sign-up branch (deferred check). Matches the "fast fail vs lazy fail" distinction. Business inputs come through `main(options)` (declared via `WalmartOptions`), not `process.env` — the sandbox env whitelist only exposes `BROWSER_URL`/`CDP_URL`/`BROWSER_TYPE`.
- **`waitForResponse` matched on URL substring** for the orchestra graphql call after submit — confirms server-side acceptance, not just client-side click.

## Canonical implementation

```typescript
// Generated from output/RPA/wm-01.json — RPA fixture wm-01
// Task: Goto Walmart → 等 form → 检测响应式 + 登录链接 → 分支:
//       已登录: console.log('Signed in')
//       需登录: 大屏/小屏不同入口 → 等 sign-in-form → 填邮箱 → 提交
//         → 等 sign-up-form → firstName 不存在 → console.log('Email is Registered') 早退
//         → 否则填 firstName/lastName/password → 提交 → 等 graphql 响应 → 截图
// Input: options.email (邮箱必填), options.password (注册分支必填)
// Runtime: roxy-agent sandbox injects BROWSER_URL/CDP_URL; email/password come via main(options).

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

interface WalmartOptions {
  /** 登录邮箱（必填）。 */
  email: string
  /** 注册分支用密码（进入注册分支时必填）。 */
  password?: string
}

function sleep(min: number, max: number): Promise<void> {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min))
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const ARTIFACTS_DIR = path.resolve(process.cwd(), 'output/RPA/artifacts')
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
const shotPath = (id: string, tag = '') => path.join(ARTIFACTS_DIR, `${id}-${tag}-${Date.now()}.png`)

const FIRST_NAMES = ['Lee', 'Have', 'Feil']
const LAST_NAMES = ['Peter', 'Tom', 'Apple']

export async function main(options: WalmartOptions): Promise<void> {
  const USER_NAME = options.email
  const PASSWORD = options.password ?? ''
  if (!USER_NAME) {
    console.error('options.email is required before running this script.')
    console.error('[missing_user_name]')
    process.exit(1)
  }
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

  await page.goto('https://www.walmart.com/', { timeout: 30000 })
  await page.locator('form[action="/search"]').first().waitFor({ state: 'visible', timeout: 30000 })
  await sleep(2000, 2500)

  // Responsive branch
  const isLess = await page.evaluate(() => window.innerWidth <= 1024)
  console.log(`Viewport ${isLess ? 'small (≤1024)' : 'large (>1024)'}`)

  // Login state check
  const loginLink = page.locator('[href^="/account/login"]').first()
  const needLogin = await loginLink.count() > 0

  if (!needLogin) {
    console.log('Signed in')
    await browser.close()
    return
  }

  console.log('Need login — entering login flow')

  if (isLess) {
    // Small screen: open menu first
    await page.locator('button[aria-label="Menu"]').click()
    await sleep(800, 1200)
    await page.locator('nav a[link-identifier="walmartLogo"]+button').click()
  }
  else {
    // Large screen: click login link → wait for popup → click sign-in inside
    await loginLink.click()
    await sleep(600, 800)
    await page.locator('[data-testid="account-flyout"] button').first().click()
  }

  await page.locator('#sign-in-form').first().waitFor({ state: 'visible', timeout: 30000 })
  await sleep(3000, 3500)

  // If email already filled, skip; else input USER_NAME
  const emailInput = page.locator('[type="email"]').first()
  const currentEmail = await emailInput.getAttribute('value').catch(() => null)
  if (!currentEmail) {
    await emailInput.fill(USER_NAME)
    console.log(`Filled email: ${USER_NAME}`)
  }
  else {
    console.log(`Email pre-filled: ${currentEmail}`)
  }

  await page.locator('#sign-in-form button').first().click()

  // Wait for sign-up form to appear (means email is unregistered or new password required)
  try {
    await page.locator('#sign-up-form [name="newPassword"]').first().waitFor({ state: 'visible', timeout: 30000 })
  }
  catch {
    console.log('Sign-up form did not appear within 30s — flow diverged (maybe direct login or 2FA)')
    await page.screenshot({ path: shotPath('wm-01', 'no-signup-form'), fullPage: false })
    await browser.close()
    return
  }
  await sleep(1000, 1500)

  // Critical early-exit: firstName field missing → email already registered
  const firstNameInput = page.locator('#sign-up-form [name="firstName"]').first()
  if (await firstNameInput.count() === 0) {
    console.log('Email is Registered')
    console.log('[email_registered]')
    await browser.close()
    return
  }

  if (!PASSWORD) {
    console.error('options.password required for sign-up flow but not provided')
    console.error('[password_missing]')
    await browser.close()
    return
  }

  await firstNameInput.fill(pick(FIRST_NAMES))
  await page.locator('#sign-up-form [name="lastName"]').fill(pick(LAST_NAMES))
  await page.locator('#sign-up-form [name="newPassword"]').fill(PASSWORD)
  console.log('Filled signup form')

  // Submit + wait for orchestra response
  const responsePromise = page.waitForResponse(r => r.url().includes('/orchestra/home/graphql'), { timeout: 30000 })
  await page.locator('#sign-up-form [type="submit"]').first().click()

  try {
    await responsePromise
    await sleep(1000, 1500)
    console.log('Register successfully')
  }
  catch {
    console.log('Did not receive orchestra response in time — registration may have failed')
  }

  // Click "no thanks" promo dismissal if present
  const noThanks = page.locator('[role="radiogroup"]+div+div button').first()
  if (await noThanks.count() > 0) {
    await noThanks.click().catch(() => { /* ignore */ })
  }

  await page.screenshot({ path: shotPath('wm-01', 'signup'), fullPage: false })
  console.log('[closing_browser]')
  await browser.close()
}

```
