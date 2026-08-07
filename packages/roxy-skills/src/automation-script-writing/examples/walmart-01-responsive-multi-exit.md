# wm-01 — Walmart responsive sign-in / sign-up with three early-exit branches

**Pattern**: 响应式分支 + 三重状态早退 + `options` 注入邮箱/密码

## Distinctive techniques

- **Three independent early-exit gates**:
  1. Already signed in (`loginLink.count() === 0`) → log "Signed in" → close
  2. Sign-up form never appears (timeout) → log + close (flow diverged: 2FA / direct-login)
  3. firstName field missing (`count() === 0`) → log "Email is Registered" → close
- **Responsive branch via `page.evaluate(() => window.innerWidth <= 1024)`** — runs in browser context, captures live width. Matches what users see, avoids assuming default Playwright viewport.
- **Two completely different selectors per branch**: small uses `button[aria-label="Menu"]` then `nav a[link-identifier="walmartLogo"]+button`; large uses `[href^="/account/login"]` then `[data-testid="account-flyout"] button`. Same intent (open login UI), different DOM scope.
- **Pre-filled email check** (`getAttribute('value')`): skip the fill step if Walmart auto-populated. Avoids duplicate text in the field.
- **Required `options` enforced at script start**: `options.email` always required (process.exit), `options.password` only required when entering sign-up branch (deferred check). Matches the "fast fail vs lazy fail" distinction. Business inputs come through `main(options)` (declared via `WalmartOptions`), not `process.env`; the sandbox env contains only runtime connection and output metadata.
- **`waitForResponse` matched on URL substring** for the orchestra graphql call after submit — confirms server-side acceptance, not just client-side click.
- **Diagnostics via `console`, not screenshots**: the divergence/outcome branches log their verdict — a saved screenshot isn't the observable signal. For the DOM on a diverged flow, run under the debug profile with `capturePageSnapshot` (`references/debugging.md`).

## Canonical implementation

```typescript
// Task: goto Walmart → wait form → detect responsive + login link → branch:
//       signed in: console.log('Signed in')
//       need login: large/small distinct entry → wait sign-in-form → fill email → submit
//         → wait sign-up-form → firstName absent → console.log('Email is Registered') early-exit
//         → else fill firstName/lastName/password → submit → wait graphql response → log
// Input: options.email (required), options.password (required in sign-up branch)
// Runtime: roxy-agent sandbox injects BROWSER_URL/BROWSER_TYPE; email/password via main(options).

import { chromium, firefox } from 'playwright'
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
import { sleep, pick } from '@roxybrowser/sandbox/utils'

defineMetadata({ name: 'Walmart responsive multi-exit sign-up', description: 'Open Walmart, detect the responsive login state, and drive the sign-in/sign-up branch with multiple early exits.', version: '1.0.0' })
defineParams({ 
  type: 'object', 
  properties: { 
    email: { type: 'string', description: 'Login email (required).' }, 
    password: { type: 'string', description: 'Password for the sign-up branch (required when that branch is entered).' } 
  }, 
  required: ['email'] 
})

interface WalmartOptions {
  /** Login email (required). */
  email: string
  /** Password for the sign-up branch (required when that branch is entered). */
  password?: string
}

const FIRST_NAMES = ['Lee', 'Have', 'Feil']
const LAST_NAMES = ['Peter', 'Tom', 'Apple']

export async function main(options: WalmartOptions): Promise<void> {
  const BROWSER_URL = process.env.BROWSER_URL ?? ''
  const BROWSER_TYPE = process.env.BROWSER_TYPE ?? 'chromium'
  const USER_NAME = options.email
  const PASSWORD = options.password ?? ''
  if (!USER_NAME) {
    console.error('options.email is required before running this script.')
    console.error('[missing_user_name]')
    process.exit(1)
  }
  const browser = BROWSER_TYPE === 'firefox' ? await firefox.connect(BROWSER_URL) : await chromium.connect(BROWSER_URL)
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

  console.log('[closing_browser]')
  await browser.close()
}

```
