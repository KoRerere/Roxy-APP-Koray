# fb-02 — Reels viewport-aware Like with 70% probability + screenshot

**Source fixture**: `output/RPA/fb-02.json`
**Capability clusters**: C1 (viewport-aware) + C2 (滚动+概率循环) + C5 (UGC) + C11 (语言切换) + C17 (业务留痕截图)
**User intent keywords**: "视口内最近的 Like" / "viewport-closest" / "70% 概率点赞" / "Reels 浏览" / "平滑滚动" / "截图记录"

## Distinctive techniques

- **Three inline JS blocks** kept verbatim from JSON because Playwright locator API can't replicate them: `HUMAN_SCROLL_JS` (mouse + wheel + easing), `FIND_CLOSEST_LIKE_JS` (`getBoundingClientRect` viewport distance), `SCROLL_TO_TARGET_JS` (smooth scroll target Like to 30-70% block).
- **JS returns index, then Playwright `.nth(index).click()`**: the JS heuristic decides _which_ element, but the actual click goes through Playwright (so it's a real input event, not a synthetic one). Critical for FB anti-bot.
- **Two distinct selectors**: `[data-visualcompletion="ignore-dynamic"] div[aria-label="Like"]` for _finding_ (more inclusive) vs `div[class="x1lliihq"] [class="x1a2a7pz"] [aria-label="Like"]` for _clicking_ (the actual interactive button).
- **Language detection guard**: read `#facebook[lang]` attribute and only enter the switch flow if not English. Don't unconditionally goto language settings.
- **70% probability via `maybe(0.7)`** with explicit "no like this iteration" branch that just scrolls again — keeps cadence even on skipped iterations.
- **Screenshot is deliverable**, not verification: takes after a successful click as user-requested artifact (recording rule 6 "business logging" allowance).

## Canonical implementation

```typescript
// Generated from output/RPA/fb-02.json — RPA fixture fb-02
// Task: Goto FB → 检测语言非 en 切英文 → Loop 5 次:平滑滚 + viewport 内最近 Like
//       → 70% 概率点赞(滚到中心+点击+截图) / 30% 跳过再滚
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
  return new Promise(r =>
    setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min),
  )
}
function maybe(probability: number): boolean {
  return Math.random() < probability
}

const ARTIFACTS_DIR = path.resolve(process.cwd(), 'output/RPA/artifacts')
fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
function shotPath(id: string, tag = '') {
  return path.join(ARTIFACTS_DIR, `${id}-${tag}-${Date.now()}.png`)
}

// Inline JS: smooth human-like scroll with mouse + wheel events (from JSON)
const HUMAN_SCROLL_JS = `(async () => {
  const rand = (a, b) => Math.random() * (b - a) + a;
  const randint = (a, b) => Math.floor(rand(a, b + 1));
  const pick = ([a, b], isInt = false) => isInt ? randint(a, b) : rand(a, b);

  const distance = pick([1800, 2500], true);
  const scrollingEl = document.scrollingElement || document.documentElement || document.body;
  const nowScroll = () => scrollingEl.scrollTop || window.scrollY || 0;
  const maxScrollTop = () => Math.max(0, scrollingEl.scrollHeight - window.innerHeight);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 + 4 * (t - 1) ** 3);

  function dispatchWheel(deltaY) {
    try { scrollingEl.dispatchEvent(new WheelEvent("wheel", { deltaY, bubbles: true })); } catch {}
  }
  function dispatchMouseMove() {
    try {
      const x = Math.floor(window.innerWidth * (0.3 + Math.random() * 0.4));
      const y = Math.floor(window.innerHeight * (0.3 + Math.random() * 0.4));
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true }));
    } catch {}
  }
  function animateTo(targetTop, duration) {
    return new Promise(resolve => {
      const start = performance.now();
      const from = nowScroll();
      const to = clamp(targetTop, 0, maxScrollTop());
      const delta = to - from;
      if (Math.abs(delta) < 1) return resolve();
      function frame(ts) {
        const t = Math.min((ts - start) / duration, 1);
        const eased = easeInOutCubic(t);
        window.scrollTo({ top: Math.round(from + delta * eased) });
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  let moved = 0;
  while (moved < distance) {
    const step = Math.min(distance - moved, pick([100, 150], true));
    const target = clamp(nowScroll() + step, 0, maxScrollTop());
    if (Math.random() < 0.6) { dispatchMouseMove(); dispatchWheel(step * 0.3); }
    await animateTo(target, pick([160, 300], true));
    moved += step;
    await new Promise(r => setTimeout(r, pick([200, 300], true)));
  }
})();`

// Inline JS: find viewport-closest Like button index (from JSON)
const FIND_CLOSEST_LIKE_JS = `(() => {
  const selector = '[data-visualcompletion="ignore-dynamic"] div[aria-label="Like"]';
  const elements = document.querySelectorAll(selector);
  if (elements.length === 0) return -1;
  const vH = window.innerHeight, vW = window.innerWidth;
  let closest = -1, minDist = Infinity;
  for (let i = 0; i < elements.length; i++) {
    const r = elements[i].getBoundingClientRect();
    const inView = r.top < vH && r.bottom > 0 && r.left < vW && r.right > 0;
    if (inView) return i;
    const hD = Math.max(0, r.left - vW, -r.right);
    const vD = Math.max(0, r.top - vH, -r.bottom);
    const dist = (hD > 0 && vD > 0) ? Math.min(hD, vD) : (hD > 0 ? hD : vD);
    if (dist < minDist) { minDist = dist; closest = i; }
  }
  return closest;
})();`

// Scroll a target Like button to vertical 30-70% of viewport (from JSON)
const SCROLL_TO_TARGET_JS = `async (postIndex) => {
  const likeButtons = document.querySelectorAll('div[class="x1lliihq"] [class="x1a2a7pz"] [aria-label="Like"]');
  if (!likeButtons.length || postIndex < 0 || postIndex >= likeButtons.length) return false;
  const target = likeButtons[postIndex];
  const blockPos = 0.3 + Math.random() * 0.4;
  const scrollingEl = document.scrollingElement || document.documentElement || document.body;
  const start = scrollingEl.scrollTop;
  const rect = target.getBoundingClientRect();
  const targetTop = start + rect.top - window.innerHeight * blockPos;
  const duration = 600 + Math.random() * 200;
  const ease = t => t < 0.5 ? 4*t*t*t : 1 + 4*(t-1)**3;
  await new Promise(resolve => {
    const t0 = performance.now();
    const animate = (time) => {
      const t = Math.min((time - t0) / duration, 1);
      scrollingEl.scrollTo(0, start + (targetTop - start) * ease(t));
      if (t < 1) requestAnimationFrame(animate);
      else resolve();
    };
    requestAnimationFrame(animate);
  });
  await new Promise(r => setTimeout(r, 1000));
  return true;
}`

async function ensureEnglish(page: Page): Promise<void> {
  const lang = await page
    .locator('#facebook')
    .first()
    .getAttribute('lang')
    .catch(() => null)
  if (lang === 'en' || lang?.startsWith('en')) {
    console.log(`Lang already English (${lang})`)
    return
  }
  console.log(`Lang is "${lang}", switching to English (US)`)
  await page.goto('https://www.facebook.com/settings/?tab=language', {
    timeout: 30000,
  })
  await sleep(5343, 6242)
  await page
    .locator('div[role="main"] div[style*="border-radius"] [role="button"]')
    .first()
    .click()
  await sleep(5343, 6242)
  await page.locator('//div[@role="dialog"]//label/input').first().fill('US')
  await sleep(5343, 6242)
  await page.locator('//*[@role="dialog"]//*[@role="radio"]').first().click()
  await sleep(5343, 6242)
  await page.goto('https://www.facebook.com/', { timeout: 30000 })
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
  const context = browser.contexts()[0] ?? (await browser.newContext())
  const page = context.pages()[0] ?? (await context.newPage())
  console.log('[start]')

  await page.goto('https://www.facebook.com/', { timeout: 30000 })
  await sleep(5343, 9242)
  await ensureEnglish(page)
  await sleep(8343, 12242)

  for (let iter = 0; iter < 5; iter++) {
    console.log(`[Iteration ${iter + 1}/5]`)

    // Smooth human scroll
    await page.evaluate(HUMAN_SCROLL_JS)
    await sleep(5343, 6242)

    // Find viewport-closest Like button
    const postIndex = (await page.evaluate(FIND_CLOSEST_LIKE_JS)) as number
    console.log(`  Closest Like index: ${postIndex}`)
    await sleep(1343, 2242)

    if (postIndex < 0) {
      console.log('  No Like button found, scrolling more')
      await page.evaluate(HUMAN_SCROLL_JS)
      continue
    }

    if (maybe(0.7)) {
      console.log('  → Liking')
      const scrolled = await page.evaluate(SCROLL_TO_TARGET_JS, postIndex)
      if (!scrolled) {
        console.log('  Scroll-to-target failed, skipping')
        continue
      }
      await sleep(1343, 2242)

      const likeBtn = page
        .locator('div[class="x1lliihq"] [class="x1a2a7pz"] [aria-label="Like"]')
        .nth(postIndex)
      if ((await likeBtn.count()) > 0) {
        await likeBtn
          .click()
          .catch(err => console.log('  Click failed:', err.message))
        await page.screenshot({
          path: shotPath('fb-02', `iter${iter + 1}`),
          fullPage: true,
        })
      }
    }
    else {
      console.log('  → No like this iteration, scrolling again')
      await page.evaluate(HUMAN_SCROLL_JS)
    }
    await sleep(5343, 6242)
  }

  console.log('[closing_browser]')
  await browser.close()
}

```
