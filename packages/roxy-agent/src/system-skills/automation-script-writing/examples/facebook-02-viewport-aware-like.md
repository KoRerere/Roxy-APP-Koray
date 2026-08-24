# fb-02 — Reels viewport-aware Like with 70% probability

**Pattern**: 视口内最近 Like 定位(内联 JS)+ 70% 概率点赞 + 平滑滚动循环

## Distinctive techniques

- **Three inline JS blocks** kept verbatim because the Playwright locator API can't replicate them: `HUMAN_SCROLL_JS` (mouse + wheel + easing), `FIND_CLOSEST_LIKE_JS` (`getBoundingClientRect` viewport distance), `SCROLL_TO_TARGET_JS` (smooth scroll target Like to 30-70% block). These solve a targeting problem no capability package covers — unlike `sleep`/`maybe`, which come from `@roxybrowser/sandbox/utils` and must **not** be hand-rolled.
- **JS returns index, then Playwright `.nth(index).click()`**: the JS heuristic decides _which_ element, but the actual click goes through Playwright (so it's a real input event, not a synthetic one). Critical for FB anti-bot.
- **Two distinct selectors**: `[data-visualcompletion="ignore-dynamic"] div[aria-label="Like"]` for _finding_ (more inclusive) vs `div[class="x1lliihq"] [class="x1a2a7pz"] [aria-label="Like"]` for _clicking_ (the actual interactive button).
- **Language detection guard**: read `#facebook[lang]` attribute and only enter the switch flow if not English. Don't unconditionally goto language settings.
- **70% probability via `maybe(0.7)`** with explicit "no like this iteration" branch that just scrolls again — keeps cadence even on skipped iterations.
- **Progress goes to `console`, not a screenshot**: each successful like is logged. A saved screenshot can't serve as a run record — the log is the observable signal (see `SKILL.md` Output And Diagnostics). For a DOM capture while debugging, use `capturePageSnapshot` under the debug profile (`references/debugging.md`).

## Canonical implementation

```typescript
// Task: goto FB → if lang != en, switch to English → loop 5×: smooth scroll + find viewport-closest Like
//       → 70% like (scroll target to center + click) / 30% skip and scroll again
// Runtime: roxy-agent sandbox injects BROWSER_URL/BROWSER_TYPE.

import type { Page } from 'playwright'
import { chromium, firefox } from 'playwright'
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
import { sleep, maybe } from '@roxybrowser/sandbox/utils'

defineMetadata({ name: 'Facebook viewport-aware like', description: 'Switch Facebook to English if needed, then smooth-scroll the feed and probabilistically like the viewport-closest post.', version: '1.0.0' })

interface FacebookLikeParams {
  iterations?: number
  likeProbability?: number
}

defineParams({
  type: 'object',
  properties: {
    iterations: { type: 'integer', minimum: 1, maximum: 100, default: 5, description: 'Number of feed iterations.' },
    likeProbability: { type: 'number', minimum: 0, maximum: 1, default: 0.7, description: 'Probability of liking the selected post in each iteration.' },
  },
})

// Inline JS: smooth human-like scroll with mouse + wheel events (locator API can't replicate)
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

// Inline JS: find viewport-closest Like button index
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

// Inline JS: scroll a target Like button to vertical 30-70% of viewport
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
  await sleep(5000, 6500)
  await page.goto('https://www.facebook.com/', { timeout: 30000 })
}

export async function main(params: FacebookLikeParams = {}): Promise<void> {
  const BROWSER_URL = process.env.BROWSER_URL ?? ''
  const BROWSER_TYPE = process.env.BROWSER_TYPE ?? 'chromium'
  const browser = BROWSER_TYPE === 'firefox' ? await firefox.connect(BROWSER_URL) : await chromium.connect(BROWSER_URL)
  
  const context = browser.contexts()[0] ?? await browser.newContext()
  const page = context.pages()[0] ?? await context.newPage()
  const iterations = Math.max(1, Math.min(100, Math.floor(params.iterations ?? 5)))
  const likeProbability = Math.max(0, Math.min(1, params.likeProbability ?? 0.7))
  console.log('[start]')

  await page.goto('https://www.facebook.com/', { timeout: 30000 })
  await sleep(5000, 9000)
  await ensureEnglish(page)
  await sleep(8000, 12000)

  for (let iter = 0; iter < iterations; iter++) {
    console.log(`[Iteration ${iter + 1}/${iterations}]`)

    // Smooth human scroll
    await page.evaluate(HUMAN_SCROLL_JS)
    await sleep(5000, 6500)

    // Find viewport-closest Like button
    const postIndex = (await page.evaluate(FIND_CLOSEST_LIKE_JS)) as number
    console.log(`  Closest Like index: ${postIndex}`)
    await sleep(1300, 2200)

    if (postIndex < 0) {
      console.log('  No Like button found, scrolling more')
      await page.evaluate(HUMAN_SCROLL_JS)
      continue
    }

    if (maybe(likeProbability)) {
      console.log('  → Liking')
      const scrolled = await page.evaluate(SCROLL_TO_TARGET_JS, postIndex)
      if (!scrolled) {
        console.log('  Scroll-to-target failed, skipping')
        continue
      }
      await sleep(1300, 2200)

      const likeBtn = page
        .locator('div[class="x1lliihq"] [class="x1a2a7pz"] [aria-label="Like"]')
        .nth(postIndex)
      if ((await likeBtn.count()) > 0) {
        await likeBtn.click().catch(err => console.log('  Click failed:', err.message))
        console.log(`  Liked post at index ${postIndex}`)
      }
    }
    else {
      console.log('  → No like this iteration, scrolling again')
      await page.evaluate(HUMAN_SCROLL_JS)
    }
    await sleep(5000, 6500)
  }

  console.log('[closing_browser]')
  await browser.close()
}

```
