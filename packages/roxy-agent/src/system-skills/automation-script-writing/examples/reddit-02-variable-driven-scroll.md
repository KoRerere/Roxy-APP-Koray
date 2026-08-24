# rd-02 — Reddit variable-driven scroll curve + viewport-max-comment post

**Pattern**: `options` 驱动的滚动轮询（`human.scroll` 自定义位移曲线）+ 视口最大评论帖点击

## Distinctive techniques

- **Custom cumulative displacement curve** for `human.scroll`: the curve reaches 108% of the requested distance, then returns to 100%, creating a short glance-back while preserving the final displacement.
- **Shadow DOM traversal in inline JS**: Reddit uses shadow DOM for `shreddit-post`; comment count lives in `postElement.shadowRoot.querySelectorAll('faceplate-number')`. Standard DOM APIs without shadow descent return 0 — a targeting problem no capability package covers, so this block stays inline.
- **Viewport visibility ≥ 1% threshold** in `FIND_MAX_COMMENT_JS`: anything peeking into the viewport counts. Stricter thresholds (e.g., 50%) miss posts that are scrolling in.
- **5-event mouse sequence for click** (`mouseover`, `mousemove`, `mousedown`, `mouseup`, `click`) with 30ms delays — synthetic but sequenced like real user interaction. Necessary because `link.click()` alone may be filtered by Reddit's anti-bot.
- **Two-tier loop**: outer `for round in 0..options.rounds` (configurable via `options`), inner `for attempt in 0..8` retries scroll-and-search until a qualifying post appears. `goBack()` between rounds returns to feed.
- **`options` defaults with NaN guards**: `options.commentThreshold` / `options.rounds` provide sensible defaults but the script rejects non-numbers via `Number.isNaN` before proceeding. Runtime tuning comes through the `options` argument (declared via `RedditOptions`), not `process.env`; the sandbox env contains only runtime connection and output metadata.

## Canonical implementation

```typescript
// Task: parse options → goto Reddit → wait shreddit-feed → loop options.rounds×:
//       smooth scroll (with backtrack) → find viewport-max-comment post → >= threshold ? click + break
// Input: options.commentThreshold (comment-count threshold, default 100), options.rounds (browse rounds, default 3)
// Runtime: roxy-agent sandbox injects BROWSER_URL/BROWSER_TYPE; thresholds come via main(options).

import { chromium, firefox } from 'playwright'
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
import { sleep, randomBetween } from '@roxybrowser/sandbox/utils'
import { createHuman, scrollCurves } from '@roxybrowser/sandbox/human'

defineMetadata({ name: 'Reddit variable-driven scroll', description: 'Browse the Reddit feed for a number of rounds, scrolling to the viewport-max-comment post and opening it once the comment count meets a threshold.', version: '1.0.0' })
defineParams({ type: 'object', properties: { commentThreshold: { type: 'number', description: 'Comment-count threshold; clicking the post once met. Default 100.' }, rounds: { type: 'number', description: 'Number of browse rounds (outer loop). Default 3.' } } })

interface RedditOptions {
  /** Comment-count threshold; clicking the post once met. Default 100. */
  commentThreshold?: number
  /** Number of browse rounds (outer loop). Default 3. */
  rounds?: number
}

const GLANCE_BACK_CURVE = (progress: number): number => {
  if (progress <= 0.82) {
    return scrollCurves.easeOutCubic(progress / 0.82) * 1.08
  }
  return 1.08 - scrollCurves.easeInOutCubic((progress - 0.82) / 0.18) * 0.08
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

// Scroll to a target shreddit-post by index, then click its first link via a 5-event mouse sequence.
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
  const BROWSER_URL = process.env.BROWSER_URL ?? ''
  const BROWSER_TYPE = process.env.BROWSER_TYPE ?? 'chromium'
  const RD_COMMENTS = Number(options.commentThreshold ?? 100)
  const RD_POSTS = Number(options.rounds ?? 3)
  if (Number.isNaN(RD_COMMENTS) || Number.isNaN(RD_POSTS)) {
    console.error('options.commentThreshold and options.rounds must be numbers')
    console.error('[invalid_parameters]')
    process.exit(1)
  }
  console.log(`RD_COMMENTS threshold: ${RD_COMMENTS}, RD_POSTS rounds: ${RD_POSTS}`)

  const browser = BROWSER_TYPE === 'firefox' ? await firefox.connect(BROWSER_URL) : await chromium.connect(BROWSER_URL)
  const context = browser.contexts()[0] ?? await browser.newContext()
  const page = context.pages()[0] ?? await context.newPage()
  const human = createHuman(page)
  console.log('[start]')

  // waitForResponse on initial Reddit load
  const responsePromise = page.waitForResponse(
    r => r.url().startsWith('https://www.reddit.com/') && r.status() < 400,
    { timeout: 30000 }
  )
  await page.goto('https://www.reddit.com', { timeout: 30000 })
  await responsePromise.catch(() => console.log('initial response wait timed out (continuing)'))
  await sleep(7000, 9000)

  const feed = page.locator('shreddit-feed').first()
  if (await feed.count() === 0) {
    console.log('No shreddit-feed found — page may have failed to load')
    console.error('[feed_missing]')
    await browser.close()
    return
  }

  await sleep(3500, 5300)

  for (let round = 0; round < RD_POSTS; round++) {
    console.log(`[Round ${round + 1}/${RD_POSTS}]`)

    // Initial scroll on first round with a short glance-back at the end
    if (round === 0) {
      await human.scroll({
        distance: randomBetween(1000, 1500),
        axis: 'vertical',
        duration: 900,
        curve: GLANCE_BACK_CURVE,
      })
    }

    // Inner loop: scroll until find a post with >= threshold comments, or timeout
    let clicked = false
    for (let attempt = 0; attempt < 8; attempt++) {
      await sleep(2500, 3300)
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
      await human.scroll({
        distance: randomBetween(1000, 1500),
        axis: 'vertical',
        duration: 900,
        curve: 'ease-out',
      })
    }

    if (clicked) {
      // Stay on the post a moment then go back for next round
      await sleep(3000, 5000)
      await page.goBack({ timeout: 15000 }).catch(() => console.log('  goBack failed'))
      await sleep(3000, 4000)
    }
    else {
      console.log(`  Round ${round + 1}: no qualifying post found within 8 attempts`)
    }
  }

  console.log('[closing_browser]')
  await browser.close()
}

```
