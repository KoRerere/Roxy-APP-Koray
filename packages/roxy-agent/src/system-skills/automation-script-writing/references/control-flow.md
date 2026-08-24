# Control Flow Patterns

Generic patterns for loops, conditions, branching decisions, and wait ranges
that aren't tied to a specific RPA fixture. For full worked scripts, see the
`examples/` directory.

## Contents

- Sequential vs Mutually-Exclusive branches (CRITICAL pitfall)
- Wait range reference table
- Loop patterns
- Condition patterns

---

## Sequential vs Mutually-Exclusive branches (CRITICAL — common pitfall)

When a user says "N% chance to do X, **otherwise / if not** do Y", two
interpretations are possible:

### Sequential (the DEFAULT — the more common case)

X is an **optional probabilistic action**, Y is a **mandatory navigation /
completion action** that runs every iteration.

```typescript
if (maybe(0.7)) await doX();
await doY();   // always runs
```

### Mutually exclusive (only when signals match)

X and Y push the page into **different terminal branches** (e.g. "open the
post" vs "skip this post entirely") — only one of them should run.

```typescript
if (maybe(0.7)) await doX();
else await doY();
```

### How to decide — check signals in priority order

1. **Look at the skeleton first.** If both X and Y (their selectors or
   action types) appear in the recorded skeleton, the answer is **sequential**.
   The skeleton is ground truth; the source-session agent already executed both
   actions because they both belong to one iteration.

2. **Is Y a navigation/advance action?** (ArrowDown, scroll, next page,
   "跳到下一个", "go to next") → **sequential**. Navigation almost never
   participates in a true XOR with a state-change action.

3. **Is X a state-change** (like / comment / share / save) **and Y a
   navigation**? → **sequential**.

4. **Are X and Y both terminal/branch actions** with no shared follow-up
   (open vs skip, dialog-input vs main-input)? → **mutually exclusive**.
   See `examples/twitter-04-dialog-or-inline-reply.md` for the dialog vs inline
   composer fixture (`count() > 0 ? path1 : path2`).

### Real-world pitfall (fb-01 bug)

User intent: "70% chance to like the current Reel, **if not liked press
ArrowDown to go to the next Reel**, wait 1~6s between steps, loop 5 times".

❌ Wrong (mutual-exclusive interpretation — what fb-01 produced):
```typescript
if (maybe(0.7)) await like();
else await page.keyboard.press('ArrowDown');
// Result: when liking, the loop never advances. The next iteration finds the
// SAME Like button on the SAME Reel and toggles it again. 5 loops never
// move past Reel #1.
```

✅ Correct (sequential — Y is navigation, signal #2 + #3 both apply):
```typescript
if (maybe(0.7)) {
  await like();
  await sleep(500, 1000);
}
await page.keyboard.press('ArrowDown');   // always advance
await sleep(1000, 6000);
```

When in doubt: if Y is "ArrowDown / scroll / next / 翻页 / 下一个", default
to sequential. Mutual exclusion is the rarer case.

---

> **Sandbox constraints** — generated scripts run in a restricted VM. For the
> full list (permission-gated `fetch`, native `fs` constrained to the workdir
> plus declared reads, no `XMLHttpRequest`, `console.debug` no-op under release,
> env/import whitelists), see
> `references/runtime.md`. Helpers like `sleep`/`maybe` and `createHuman(page)` used below
> come from `@roxybrowser/sandbox/utils` and `/human` — **import them, don't
> redefine** (see `references/sandbox-api.d.ts`).

---

## Wait range reference

Replace every `waitForTimeout(N)` with `await sleep(min, max)` per context:

| Context | min (ms) | max (ms) |
|---------|----------|----------|
| After click (no navigation) | 500 | 1500 |
| Between loop iterations | 1000 | 3000 |
| After navigation / search | 3000 | 7000 |
| Watching video / reading | 5000 | 15000 |

For viewport-aware scrolling and probability-driven loops, see
`examples/facebook-02-viewport-aware-like.md`. For backtrack / lazy-load aware scroll,
see `examples/reddit-02-variable-driven-scroll.md`.

---

## Wait for the page to stabilize before acting

Most flaky scripts act too early — on a page whose DOM has arrived but is not
yet interactive or complete. Stabilize first, then act. Wait on a **concrete
signal**, not a bare `sleep` guess.

### Framework-rendered pages (Vue / React / SPA)

The initial HTML is often an empty shell; the real content is rendered by JS
after load, so `goto` resolving does **not** mean the element exists yet. Wait
for a specific element that only appears once the view has rendered, then give
it a short settle margin:

```typescript
await page.goto(url, { waitUntil: 'domcontentloaded' })
await page.locator('[data-testid="app-content"]').first().waitFor({ state: 'visible', timeout: 30000 })
await sleep(1000, 2000)   // small settle margin for late hydration
```

Prefer waiting for a real element over `waitForLoadState('networkidle')` — many
SPAs keep long-poll / websocket traffic open and never go idle.

### Lazy-loaded / infinite-scroll pages

Content that loads on scroll is not in the DOM until it enters (or nears) the
viewport. Before scraping "all" items, scroll to the bottom repeatedly until the
page stops growing, so everything is present:

```typescript
let prevHeight = 0
for (let i = 0; i < 30; i++) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await sleep(1000, 2000)                       // let the next batch load
  const height = await page.evaluate(() => document.body.scrollHeight)
  if (height === prevHeight) break              // no more content
  prevHeight = height
}
```

The essence of both cases is the same: reach a stable page state — rendered,
loaded, settled — and only then locate and act.

---

## Loop patterns

### Fixed-count loop ("N times" / "循环 N 次")

```typescript
for (let i = 0; i < 5; i++) {
  await page.keyboard.press('ArrowDown');
  await page.locator('[data-e2e="like-icon"]').click();
  await sleep(2000, 5000);
}
```

### List-of-keywords loop ("search these keywords" / "遍历关键词列表")

```typescript
const keywords = ['watch', 'flower', 'tools'];
for (const keyword of keywords) {
  await page.locator('input[name="search_query"]').fill(keyword);
  await page.keyboard.press('Enter');
  await sleep(3000, 6000);
}
```

### Loop with break (pagination, stop when no next page)

```typescript
for (let pageIdx = 0; pageIdx < 10; pageIdx++) {
  // ... collect data on current page ...
  const nextBtn = page.locator('.a-last a');
  if (await nextBtn.count() === 0) break;
  await nextBtn.click();
  await sleep(2000, 4000);
}
```

For a complete pagination + per-row CSV write, see
`examples/amazon-03-paginated-scrape.md`.

### Element iteration with index-based branching

For "前 N 条点赞,N+1..M 条转推" patterns, see
`examples/twitter-03-index-segment-action.md`.

---

## Condition patterns

### Element existence check (most common — always guard before acting)

```typescript
if (await page.locator('#login-form').count() > 0) {
  // not logged in — early exit
  console.log('Logout: login form detected');
  await browser.close();
  return;
}
```

For three-tier early-exit (login / sign-up form absent / firstName missing),
see `examples/walmart-01-responsive-multi-exit.md`. For login + network-monitor
combined early-exit, see `examples/facebook-05-network-monitor-csv.md`.

### Language detection

```typescript
const lang = await page.locator('#facebook').first().getAttribute('lang') ?? '';
if (!lang.startsWith('en')) {
  // switch to English (US) flow
  await page.goto('https://www.facebook.com/settings/?tab=language');
  // ...
}
```

For full FB language-switch flow with dialog interactions, see
`examples/facebook-02-viewport-aware-like.md` (`ensureEnglish` helper).

### Probability trigger

```typescript
if (maybe(0.7)) {
  await page.locator('button[aria-label="Like"]').first().click();
}
```

### Nested probability (80% trigger → 70% like / 30% open post)

```typescript
if (maybe(0.8)) {
  if (maybe(0.7)) {
    await likeBtn.click();
  } else {
    await postLink.click();
    await sleep(3000, 6000);
    await page.goBack();
  }
}
```

### Text content threshold

```typescript
const upvotes = parseInt(
  (await page.locator('.vote-count').textContent() ?? '0').replace(/\D/g, ''),
  10,
);
if (upvotes >= 1000) {
  await page.locator('[aria-label="upvote"]').click();
}
```

### Multi-flag detection (skip + continue inside loop)

```typescript
for (let i = 0; i < 14; i++) {
  const isLive = await page.locator('a[style="cursor: pointer;"]').count() > 0;
  const isAd   = await page.locator('[class="account"] path').count() > 0;

  if (!isLive && !isAd) {
    if ([2, 4, 6].includes(i)) await page.keyboard.press('z'); // like
    if ([8, 10].includes(i))   await page.keyboard.press('x'); // share
  }

  await page.keyboard.press('ArrowDown');
  await sleep(2000, 3000);
}
```

### Responsive branch (window.innerWidth)

```typescript
const isLess = await page.evaluate(() => window.innerWidth <= 1024);
if (isLess) {
  // small-screen path
} else {
  // large-screen path
}
```

For complete responsive flow (mobile menu vs desktop popup) with sign-in
form interaction, see `examples/walmart-01-responsive-multi-exit.md`.

### Fallback selector chain

```typescript
async function findFallback(page: Page, selectors: string[]): Promise<string | null> {
  for (const sel of selectors) {
    try {
      await page.locator(sel).first().waitFor({ state: 'visible', timeout: 10000 });
      return sel;
    } catch { /* try next */ }
  }
  return null;
}
```

For a complete fallback + hover sequence + add-to-cart flow, see
`examples/amazon-04-fallback-selector-hover.md`.
