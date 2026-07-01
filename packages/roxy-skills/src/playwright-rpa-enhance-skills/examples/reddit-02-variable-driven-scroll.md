# rd-02 — Reddit variable-driven scroll with backstep + viewport-max-comment post

**Source fixture**: `output/RPA/rd-02.json`
**Capability clusters**: C2 (滚动+概率循环 / backstep) + C16 (变量注入 env)
**User intent keywords**: "变量 comments/likes/posts" / "JSON 变量解析" / "backstep" / "往回滚一小段" / "视口最大评论帖" / "shreddit-feed"

## Distinctive techniques

- **`humanScroll` with backstep semantics**: keeps `lastStep` state — when `maybe(backstepChance)` fires, scrolls _back_ by `lastStep * backstepRatio` (typically 30% of the prior forward step). Without `lastStep`, backstep would either over-correct or under-correct.
- **Shadow DOM traversal in inline JS**: Reddit uses shadow DOM for `shreddit-post`; comment count lives in `postElement.shadowRoot.querySelectorAll('faceplate-number')`. Standard DOM APIs without shadow descent return 0.
- **Viewport visibility ≥ 1% threshold** in `FIND_MAX_COMMENT_JS`: anything peeking into the viewport counts. Stricter thresholds (e.g., 50%) miss posts that are scrolling in.
- **5-event mouse sequence for click** (`mouseover`, `mousemove`, `mousedown`, `mouseup`, `click`) with 30ms delays — synthetic but sequenced like real user interaction. Necessary because `link.click()` alone may be filtered by Reddit's anti-bot.
- **Two-tier loop**: outer `for round in 0..options.rounds` (configurable via `options`), inner `for attempt in 0..8` retries scroll-and-search until a qualifying post appears. `goBack()` between rounds returns to feed.
- **`options` defaults with NaN guards**: `options.commentThreshold` / `options.rounds` provide sensible defaults but the script rejects non-numbers via `Number.isNaN` before proceeding. Runtime tuning comes through the `options` argument (declared via `RedditOptions`), not `process.env` — the sandbox env whitelist only exposes `BROWSER_URL`/`CDP_URL`/`BROWSER_TYPE`.

## Canonical implementation

```typescript
// Generated from output/RPA/rd-02.json — RPA fixture rd-02
// 注:rd-02 JSON 含完整 likes / posts 内部 maybe 点赞 / 切详情逻辑;本脚本只实现核心
//   "评论数阈值 + 视口最大评论帖" 主路径 (Phase 1 阻断点)。完整逻辑见 rd-02.json。
// Task: Parse options → Goto Reddit → 等 shreddit-feed → Loop options.rounds 次:
//       平滑滚动(支持 backstep) → 找视口最大评论帖 → >= 阈值则点击 + break
// Input: options.commentThreshold (评论数阈值, 默认 100), options.rounds (帖子浏览次数, 默认 3)
// Runtime: roxy-agent sandbox injects BROWSER_URL/CDP_URL; commentThreshold/rounds come via main(options).

import type { Page } from 'playwright'
import { chromium, firefox } from 'playwright'

const BROWSER_URL = process.env.BROWSER_URL ?? ''
const CDP_URL = process.env.CDP_URL ?? ''
const BROWSER_TYPE = process.env.BROWSER_TYPE ?? 'chromium'
if (!BROWSER_URL && !CDP_URL) {
  console.error('Set BROWSER_URL or CDP_URL before running this script.')
  console.error('[missing_browser_url]')
  process.exit(1)
}

interface RedditOptions {
  /** 评论数阈值，命中即点击该帖。默认 100。 */
  commentThreshold?: number
  /** 帖子浏览轮数（外层循环次数）。默认 3。 */
  rounds?: number
}

function sleep(min: number, max: number): Promise<void> {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min))
}
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function maybe(probability: number): boolean {
  return Math.random() < probability
}

async function humanScroll(page: Page, distance: number, opts: {
  stepMin?: number
  stepMax?: number
  delayMin?: number
  delayMax?: number
  backstepChance?: number
  backstepRatio?: number
} = {}): Promise<void> {
  const { stepMin = 100, stepMax = 500, delayMin = 500, delayMax = 1200, backstepChance = 0.2, backstepRatio = 0.3 } = opts
  let scrolled = 0
  let lastStep = 0
  while (scrolled < distance) {
    if (backstepChance > 0 && Math.abs(lastStep) > 0 && maybe(backstepChance)) {
      await page.mouse.wheel(0, -Math.floor(lastStep * backstepRatio))
    }
    else {
      const step = Math.min(randomBetween(stepMin, stepMax), distance - scrolled)
      await page.mouse.wheel(0, step)
      scrolled += step
      lastStep = step
    }
    await sleep(delayMin, delayMax)
  }
}

// Find max-comment-count post visible in viewport (>=1% visible).
// Returns { maxCommentCount, index } or { maxCommentCount: 0, index: -1 }.
const FIND_MAX_COMMENT_JS = `(() => {
  const visibilityThreshold = 1;
  const selector = 'shreddit-feed[navigation-session-id] shreddit-post';
  function parseCommentCount(text) {
    if (!text) return 0;
    const numericText = text.replace(/[^0-9]/g, '');
    return numericText ? parseInt(numericText, 10) : 0;
  }
  function getCommentCount(postElement) {
    try {
      if (!postElement.shadowRoot) return 0;
      const faceplateNumbers = postElement.shadowRoot.querySelectorAll('faceplate-number');
      if (faceplateNumbers.length > 0) {
        const commentNumberEl = faceplateNumbers[1] || faceplateNumbers[0];
        if (commentNumberEl) {
          const numberAttr = commentNumberEl.getAttribute('number');
          if (numberAttr) return parseCommentCount(numberAttr);
          const numberText = commentNumberEl.shadowRoot
            ? commentNumberEl.shadowRoot.textContent.trim()
            : commentNumberEl.textContent.trim();
          return parseCommentCount(numberText);
        }
      }
      const actionRow = postElement.shadowRoot.querySelector('[data-testid="action-row"]');
      if (actionRow) {
        const commentText = Array.from(actionRow.querySelectorAll('*'))
          .find(el => el.textContent.toLowerCase().includes('comment'))?.textContent;
        if (commentText) return parseCommentCount(commentText);
      }
      return 0;
    } catch { return 0; }
  }
  const elements = Array.from(document.querySelectorAll(selector));
  if (elements.length === 0) return { maxCommentCount: 0, index: -1 };
  const wH = window.innerHeight;
  const wW = window.innerWidth;
  let max = 0, maxIdx = -1;
  elements.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    const vL = Math.max(0, r.left), vT = Math.max(0, r.top);
    const vR = Math.min(r.right, wW), vB = Math.min(r.bottom, wH);
    const vis = (vR - vL) * (vB - vT);
    const pct = area > 0 ? Math.round((vis / area) * 10000) / 100 : 0;
    if (pct >= visibilityThreshold) {
      const cnt = getCommentCount(el);
      if (cnt > max) { max = cnt; maxIdx = i; }
    }
  });
  return { maxCommentCount: max, index: maxIdx };
})();`

// Scroll to a target shreddit-post by index, then click its first link.
const CLICK_POST_JS = `async (index) => {
  const elements = document.querySelectorAll('shreddit-feed[navigation-session-id] shreddit-post');
  const target = elements[index];
  if (!target) return false;
  const link = target.querySelector('a[data-ks-id]') || target.querySelector('a[href]') || target;
  link.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(r => setTimeout(r, 600));
  const rect = link.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (const type of ['mouseover', 'mousemove', 'mousedown', 'mouseup', 'click']) {
    link.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0 }));
    await new Promise(r => setTimeout(r, 30));
  }
  return true;
}`

export async function main(options: RedditOptions = {}): Promise<void> {
  const RD_COMMENTS = Number(options.commentThreshold ?? 100)
  const RD_POSTS = Number(options.rounds ?? 3)
  if (Number.isNaN(RD_COMMENTS) || Number.isNaN(RD_POSTS)) {
    console.error('options.commentThreshold and options.rounds must be numbers')
    console.error('[invalid_parameters]')
    process.exit(1)
  }
  console.log(`RD_COMMENTS threshold: ${RD_COMMENTS}, RD_POSTS rounds: ${RD_POSTS}`)

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

  // waitForResponse on initial Reddit load
  const responsePromise = page.waitForResponse(
    r => r.url().startsWith('https://www.reddit.com/') && r.status() < 400,
    { timeout: 30000 }
  )
  await page.goto('https://www.reddit.com', { timeout: 30000 })
  await responsePromise.catch(() => console.log('initial response wait timed out (continuing)'))
  await sleep(7232, 9323)

  const feed = page.locator('shreddit-feed').first()
  if (await feed.count() === 0) {
    console.log('No shreddit-feed found — page may have failed to load')
    console.error('[feed_missing]')
    await browser.close()
    return
  }

  await sleep(3532, 5313)

  for (let round = 0; round < RD_POSTS; round++) {
    console.log(`[Round ${round + 1}/${RD_POSTS}]`)

    // Initial scroll on first round (with backstep)
    if (round === 0) {
      await humanScroll(page, randomBetween(1000, 1500), { backstepChance: 0.3 })
    }

    // Inner loop: scroll until find a post with >= threshold comments, or timeout
    let clicked = false
    for (let attempt = 0; attempt < 8; attempt++) {
      await sleep(2532, 3313)
      const result = await page.evaluate(FIND_MAX_COMMENT_JS) as { maxCommentCount: number, index: number }
      console.log(`  Attempt ${attempt + 1}: maxCommentCount=${result.maxCommentCount}, index=${result.index}`)
      if (result.maxCommentCount >= RD_COMMENTS && result.index >= 0) {
        const ok = await page.evaluate(CLICK_POST_JS, result.index)
        if (ok) {
          console.log(`  Clicked post at index ${result.index} (comments=${result.maxCommentCount})`)
          clicked = true
          break
        }
      }
      // Continue scrolling
      await humanScroll(page, randomBetween(1000, 1500), { backstepChance: 0.2 })
    }

    if (clicked) {
      // Stay on the post a moment then go back for next round
      await sleep(3000, 5000)
      await page.goBack({ timeout: 15000 }).catch(() => console.log('  goBack failed'))
      await sleep(3000, 4000)
    }
    else {
      console.log(`  Round ${round + 1}: no qualifying post found within ${8} attempts`)
    }
  }

  console.log('[closing_browser]')
  await browser.close()
}

```
