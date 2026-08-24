# Debugging Scripts

A guide for the script agent to diagnose a script that fails or behaves
flakily under `roxy_script_run` (debug profile). Read this when a debug run logs
`WARN` / `ERROR`, when an operation is unstable, when the script clicks or
types the **wrong element**, or when a full run can no longer tell you what
state the page is in.

**Locator problems are the single most common failure class**, and **permission
denials** (blocked `fetch` / filesystem access) are the most common *non-page*
failure — both have dedicated problem-first sections below. Start there before
reaching for the heavier tools.

The numbered sections below are ordered by cost — reach for the cheapest that
answers your question: (1) `console.debug` instrumentation, (2) `capturePageSnapshot`
body-HTML snapshots, (3) segmented runs, (4) read-only browser tools. They
compose into one loop: log → localize → snapshot → (if still unclear) segment →
cross-check live → fix → full regression.

## Contents

- Diagnose and fix locator problems
- Diagnose permission denials (fetch / filesystem)
- Instrument with `console.debug`
- Inspect DOM state and rendered screenshots
- Split failures into segmented runs
- Cross-check with read-only browser tools
- Run the complete debug loop

---

## Diagnose and fix locator problems

Most "the script did the wrong thing" bugs are locator bugs: the selector
matched the wrong element, matched several, matched a non-interactive wrapper,
or matched nothing yet. This section is problem-first — identify which failure
you're hitting, confirm it with the tools in the numbered sections below, then
apply the fix. For the locator-priority ladder used when replacing a bad
selector, see **Stabilize Recorded Locators** in `SKILL.md`.

### Symptoms → this is a locator problem

| Symptom | What it usually means |
|---|---|
| Liked/clicked the **wrong** post, filled the wrong field | Selector too broad; `.first()` silently took the wrong match |
| `Error: strict mode violation: locator resolved to N elements` | Selector matches many; Playwright refuses to guess |
| Timeout on an element you can **see** on the page | Wrong frame/shadow root, not-yet-rendered, or hidden/covered |
| Click "succeeds" but nothing happens | Targeted a wrapper `div`/`span` with no handler, not the real control |
| Works sometimes, fails sometimes | Position/order-dependent selector; feed re-orders or lazy-loads |
| `aria-ref=`, `REPLACE_ME`, `UNSTABLE`, `// FAILED:` in the script | Unreplaced recorder placeholder |

### Step 1 — count before you act

`await locator.count()` is the cheapest and highest-value locator check. Rule of
thumb: if you are about to `.click()` / `.fill()` and `count()` is not `1`, you
have an ambiguity bug. `.first()` does not fix it — it hides it by silently
taking index 0.

```typescript
const like = page.locator('[aria-label="Like"]')
console.debug(`loc: like | count=${await like.count()}`)   // 30 → you'll like the wrong post
```

### Step 2 — see *what* matched, not just how many

A count tells you there's ambiguity; these tell you *which* elements matched so
you can pick the discriminator.

```typescript
// Dump a short signature of every match (index + tag + trimmed text)
const sig = await page.locator('[aria-label="Like"]').evaluateAll(
  els => els.map((e, i) => `${i}: <${e.tagName.toLowerCase()}> "${(e.textContent || '').trim().slice(0, 30)}"`),
)
console.debug('matches:\n' + sig.join('\n'))
```

- Screenshot a specific match to confirm visually: `await page.locator(sel).nth(2).screenshot({ path: 'match-2.png' })`.
- Use `browser_snapshot` (read-only a11y tree, section 4) to see the roles and
  accessible names — that is exactly what `getByRole` resolves against.
- Use `browser_evaluate` (section 4) to read the final value/attribute of the
  element you *think* you targeted, confirming it's the right one.

### Step 3 — match the fix to the failure mode

| Failure mode | Fix |
|---|---|
| **Too broad — matches many** ("like the wrong post") | Scope to the target container first, then locate inside it (see below). Don't paper over it with `.first()`. |
| **Wrapper vs. interactive element** — click lands on a non-clickable `div` | Target the actual `button`/`a`/`[role=button]`. The selector that *finds* a card and the one that *clicks* its control are often different. |
| **Rotating / obfuscated class names** (`.x1lliihq`, hashed CSS) | Switch to `getByRole` + name, `aria-label`, `data-testid`, or scoped visible text. Never anchor on classes that rotate. |
| **Right selector, wrong instance in a feed** | Deliberately choose the instance: `.filter({ hasText })`, `.filter({ has })`, or a considered `.nth(i)` — not an accidental `.first()`. |
| **Off-screen or covered** (click intercepted, timeout) | `await loc.scrollIntoViewIfNeeded()`; dismiss the intercepting overlay/cookie banner; or use viewport-aware selection (see `examples/facebook-02-viewport-aware-like.md`). |
| **Inside an iframe** | `page.frameLocator('iframe#x').getByRole(...)` — a page-level locator never pierces a frame. |
| **Inside shadow DOM** | Playwright CSS pierces open shadow roots automatically; if you dropped to `evaluate`, traverse `.shadowRoot` explicitly (see `examples/reddit-02-variable-driven-scroll.md`). |
| **Acting before render** (stale/detached, intermittent) | `await loc.waitFor({ state: 'visible' })` before acting; don't sleep-and-hope. |
| **Recorder placeholder** (`aria-ref=`, `REPLACE_ME`) | Replace with a stable locator per the `SKILL.md` ladder before running at all. |

### The core fix: scope, don't broaden

The "liked the wrong post" bug and most too-broad bugs share one fix: **locate
the container that uniquely identifies your target first, then chain a locator
scoped inside it.** A scoped locator that resolves to exactly one element is the
goal — widening the page-level selector is the wrong direction.

```typescript
// ❌ Broad — likes whatever post is first in the DOM, not the one you mean
await page.locator('[aria-label="Like"]').first().click()

// ✅ Scope to the target post, then find its Like button
const post = page
  .locator('[data-testid="post"]')
  .filter({ hasText: 'the unique text of the target post' })
console.debug(`loc: target post | count=${await post.count()}`)  // want exactly 1
await post.getByRole('button', { name: 'Like' }).click()
```

If several posts legitimately share text, discriminate on a stronger signal —
author handle, permalink `href`, a timestamp — or select by deliberate index
when the position itself is the intent ("the first 3 posts").

### Prefer semantic locators over raw CSS

Reach for Playwright's built-in locators before CSS/XPath — they target the
element the way a user (and the accessibility tree) sees it, and they survive
class churn:

- `getByRole('button', { name: 'Like' })` — the default choice for controls.
- `getByLabel(...)`, `getByPlaceholder(...)` — form fields.
- `getByTestId(...)` — when the page exposes stable `data-testid`.
- `getByText(...)` / `.filter({ hasText })` — scoping and content anchors.

Drop to CSS/XPath only when no semantic handle exists (see the FB/XPath cases in
`examples/facebook-03-language-and-groups-search.md`).

### Beware language-dependent anchors (i18n)

Visible text, accessible names, and many `aria-label`s are **translated**, so a
locator anchored on them (`getByText('Like')`, `getByRole('button', { name: 'Like' })`,
`.filter({ hasText: '关注' })`) breaks the moment the account or profile runs in
another language. Most target sites are multi-language, so treat any
human-readable string in a selector as fragile.

Prefer **language-independent** anchors:

- `data-testid` and other stable custom attributes
- stable structural attributes / ids / roles *without* a name
- attribute values that are not localized (icon class hooks, `href` fragments)

When you must key on text — or you're reusing recorded text selectors — **pin
the page to a known language after load** (e.g. navigate to language settings
and switch, as `examples/facebook-02-viewport-aware-like.md` and
`facebook-03-language-and-groups-search.md` do), so the text you match is
deterministic. Then the text anchor is safe because you control the language.

### Verify the fix

A locator fix isn't done until you've confirmed it resolves to the *intended*
element, not just *an* element:

1. `count()` on the **scoped** locator is `1` (or the exact number you intend).
2. Screenshot the resolved element, or read it back with `browser_evaluate`, to
   confirm identity.
3. Pair a `capturePageSnapshot` before/after the action (section 2) to prove the
   right thing changed.

---

## Diagnose permission denials (fetch / filesystem)

The sandbox denies network and external-file access by default. When a script
reaches outside its allowlist, the operation throws the exact string:

`Access to this API has been restricted.`

Treat this as a **permission problem, not a logic bug** — do not start rewriting
your script flow. It comes from one of two boundaries, both governed by the
sidecar `library/scripts/<runtime-slug>.permissions.json` (schema and rules in
`SKILL.md` → Filesystem And Fetch Permissions):

- **`fetch`** to a host not in `fetch.allow`.
- **`fs`** read of a path outside the workdir and not in `fs.read`. External
  *writes* can never be authorized — keep everything you write inside the
  workdir.

### Worked example — downloading an image off the page with `fetch`

A common trigger: you scrape an image URL from the DOM and `fetch` it to save
the bytes, but the image is served from a CDN host that isn't allowlisted, so
the `fetch` throws the restriction error. Diagnose and fix:

1. **Log the exact URL you're about to fetch**, then read its host.
   ```typescript
   const src = await img.getAttribute('src') ?? ''
   console.debug(`fetch: image src=${src} host=${new URL(src).host}`)
   ```
2. **Add that host to `fetch.allow`** in the sidecar. Exact hostnames and
   `*.suffix` wildcards are supported; a wildcard matches subdomains, not the
   suffix apex (`*.cdn.com` covers `img.cdn.com`, not `cdn.com`).
   ```jsonc
   { "version": 1, "fetch": { "allow": ["img.cdn.example.com", "*.cdninstagram.com"] } }
   ```
3. **Check for redirects.** Automatic redirects are disabled (`redirect: 'manual'`),
   so if the image URL 3xx-redirects to a *different* host, the fetch fails even
   though the first host is allowed. Inspect the response and follow it
   explicitly only after allowlisting the destination host too:
   ```typescript
   const res = await fetch(src, { redirect: 'manual' })
   if (res.status >= 300 && res.status < 400) {
     const next = res.headers.get('location') ?? ''
     console.debug(`fetch: redirect → ${new URL(next, src).host}`)  // allowlist this host, then refetch
   }
   ```
4. **Re-run.** If it still throws, the failing host is one you haven't
   allowlisted yet — repeat from step 1 with the new host the log reveals.

### Reading an external input file

Same signal, `fs` side: reading a path outside `workdir/{slug}` throws the same
restriction error until the directory is listed in `fs.read`. Log the absolute
path you're opening, confirm the sidecar covers it, and prefer relative paths
under `process.cwd()` for anything the script itself produces.

### Prefer page traffic over out-of-band `fetch`

When the data already flows through the page, capturing it via Playwright
(`page.on('response', …)`, see `examples/facebook-05-network-monitor-csv.md`)
needs no `fetch.allow` entry — the browser, not the sandbox, makes that request.
Reserve `fetch` for genuinely out-of-band downloads and allowlist deliberately.

---

## 1. Instrument with `console.debug`

Your localization instruments, cheapest first: **`console.log`** for always-on
progress you want even under release; **`console.debug`** for verbose,
debug-only diagnostics; and the **`@roxybrowser/sandbox/debug`** package
(`getPageHtml` / `capturePageSnapshot`, section 2) for when the log tells you
*where* it failed but not *what* the page became. This section covers the first
two; section 2 covers the package.

`console.debug` is a **no-op under the release profile** (the default) and only
emits under the debug profile. That makes it free to leave in production: it
lights up exactly when you debug and stays silent otherwise. Prefer it over
`console.log` for verbose diagnostic detail so the release log stays clean.

Place `console.debug` calls at the points where you would otherwise be
guessing. Each should answer a specific question about *why* this stage might
fail.

### Where to instrument

| Location | What to log | Why |
|---|---|---|
| Stage entry | `'stage: <name> | url=… | title=…'` | Confirms navigation landed before any action |
| After a locator resolves | `'loc: <desc> | count=<n> | visible=<bool>'` (use `await locator.count()` / `await locator.isVisible()`) | Catches "element not found" before it becomes a vague timeout |
| Loop body, each iteration | `'iter i=<i>/<N> | acc=<running total or count>'` | Reveals which iteration diverges; flaky pages often fail on iteration N |
| Before/after `waitForLoadState` / `waitForSelector` | `'wait: <what> | before'` / `'wait: <what> | ok'` | Distinguishes "never settled" from "settled then broke" |
| `try/catch` block | `catch (e) { console.debug('err: ' + e.message + ' | url=' + page.url()); throw e }` | Captures the page URL at failure time, not just the stack |
| Before/after a state-changing action (click/fill/submit) | `'act: <op> | before'` / `'act: <op> | after | url=…'` | Detects silent navigation or redirect right after the action |

Keep each line one greppable line carrying what would *explain* a failure: a
stage label (`stage: login`, `act: submit`), `url`/`title`, the loop counter or
a parsed value, and a locator's `count()`. Don't dump large objects — for the
body DOM use `getPageHtml` / `capturePageSnapshot`, not the log.

### Log before/after **state** around each action — prefer it over screenshots

The most reliable way to know whether an operation did what you intended is to
`console.debug` a concrete **data snapshot before the action and again after**,
then compare the two lines. Pick values that *define* success for that step —
they are exact and machine-checkable:

- URL / title (`page.url()`, `await page.title()`)
- the target's count / visibility / `textContent` / a key attribute
- a cart badge number, a toggle's `aria-pressed`, an input's `.inputValue()`
- a running counter or the specific field you just wrote

```typescript
const likeBtn = post.getByRole('button', { name: 'Like' })
console.debug(`act: like | before | pressed=${await likeBtn.getAttribute('aria-pressed')}`)
await likeBtn.click()
console.debug(`act: like | after  | pressed=${await likeBtn.getAttribute('aria-pressed')}`)
// before=false / after=true proves the like landed — no image interpretation needed
```

**Prefer this data-state comparison over a screenshot.** A screenshot only
becomes a verdict once a multimodal model reads it, and that read can be wrong —
it may misidentify which button is highlighted, miss a subtle state change, or
"see" success that isn't there. A logged `aria-pressed=true`, a count, or a
`textContent` is unambiguous. Reserve screenshots for genuinely *visual*
problems (overlay, canvas, clipping, layout) where there is no DOM value to
read — see **Rendered screenshots** in section 2.

---

## 2. Inspect or capture page state

`console.debug` tells you *where* it failed. `getPageHtml` returns the current
body DOM in memory, while `capturePageSnapshot` persists it for before/after
comparison. Both remove `script`, `style`, and comments by default, mask live
form values, and preserve SVG markup.

"Current body DOM" means the main frame's light DOM. Child iframe documents and
shadow roots are not folded into the HTML. Keep the default masked form values;
use `formValues: 'include'` only when the value itself is essential to the
diagnosis and safe to persist.

Import the two operations from `@roxybrowser/sandbox/debug`:

```typescript
import { capturePageSnapshot, getPageHtml } from '@roxybrowser/sandbox/debug'
```

Use `getPageHtml` when the script needs to inspect the cleaned HTML immediately:

```typescript
const current = await getPageHtml(page)
console.debug(`page html bytes=${current.stats.bytes} url=${current.url}`)
```

Use `capturePageSnapshot` around a suspect operation. It writes only under the
debug profile and returns `{ status: 'disabled' }` under release:

```typescript
await capturePageSnapshot(page, { label: 'before-submit' })
await page.getByRole('button', { name: 'Submit' }).click()
await capturePageSnapshot(page, { label: 'after-submit' })
```

Each capture writes `workdir/{slug}/logs/{yyyy-mm-dd}/{random}-{label}.html` and
emits its absolute path through `console.debug`, so the agent can read the file
without reconstructing the path. The returned `htmlPath` contains the same
absolute path. For arbitrary JSON or text, write directly under `process.cwd()`
with the injected native Node `fs`.

### When to pair snapshots

Pair a **before** and **after** around any operation whose effect you can't
predict from the log: state-changing actions (submit/login/delete/toggle — did
it land, get blocked, or redirect?); flaky operations (compare the *before*
snapshots of a passing and a failing run — a different starting page is the real
cause, not the action); and navigation/wait boundaries (the after-snapshot shows
what actually rendered when a `waitForLoadState` returned too early).

### Label convention

Use short, kebab-case, stage-specific labels so `read_file` paths and log lines
stay greppable: `before-submit`, `after-submit`, `after-login`, `page-3-loaded`.
For looped operations, suffix the index: `before-click-i-2`, `after-click-i-2`.

### Diffing

Read both snapshots and compare structurally — don't diff the raw strings by
eye (snapshot HTML is large). Focus on: did the URL change? Did the target element
appear/disappear/change text? Is there now an error banner or dialog that
wasn't before? That delta is the diagnosis.

### Safety

Snapshots of authenticated pages may embed in-page tokens or session data.
Treat them as workspace-local diagnostics — read them, fix the script, then
they are disposable. Never exfiltrate snapshot contents.

### Rendered screenshots

Use a Playwright screenshot when the problem is visual rather than structural,
such as an overlay, canvas, clipping, or responsive layout. Keep the filename
relative so the host routes it to the script's dated browser directory:

```typescript
await page.screenshot({ path: 'after-submit.png', fullPage: true })
```

Do not prefix the path with `process.cwd()` and do not read host-only directory
environment variables. A screenshot complements assertions and logs; it does
not replace them as the success signal. Judging a screenshot requires a
multimodal read that can misidentify state, so when a DOM value can answer the
question, prefer the before/after `console.debug` state comparison in section 1
— it is exact.

---

## 3. Segmented runs — when the whole script can't tell you the state

Two situations call for this:

- **The full run can't be judged.** The script crashes partway, or after some
  stage the page state is unknowable from the log alone, and you can't tell
  whether the failure is in stage 2 or stage 4.
- **The script can't run at all.** The connection fails, or the script errors
  out before any useful state is reached, so a full `roxy_script_run` gives you
  nothing to diagnose.

In both cases, stop trying to reason about one giant script. **Split it into
small standalone snippets and run each one in isolation.**

### How to split

Each snippet is itself a **complete sandbox script** — it must pass the same
source checks as any local script, so it needs the full structure (`export async function main(options?)`,
the `BROWSER_URL` connection block; the sandbox calls `main(options)`
itself — do not add `export const __main = main()`). You are not writing
fragments; you are writing several tiny scripts that each do one stage. A
debug snippet with no real input can be a parameterless `export async function main(): Promise<void>`.

Name them by stage and keep them in the workspace, e.g.:

```
debug-step1-login.ts
debug-step2-search.ts
debug-step3-scrape.ts
```

Each snippet:

1. Connects to the browser (the standard connection block — unchanged).
2. Performs **one** stage's worth of work.
3. Ends with a `capturePageSnapshot` and a `console.debug` summary of what it
   achieved, so the run's log + snapshot fully describe the outcome of that
   stage.

Run each with `roxy_script_run` (`scriptPath: "<absolute debug-step1-login.ts path>"`,
`debug: true`, plus the target `dirIds`). Because each is independent, a failure
in step 3 does not mask step 1 — you see exactly which stage breaks.

### Important: state does not carry between snippets

Each `roxy_script_run` opens a fresh connection to the browser profile, but **page
state from one snippet does not automatically carry to the next** — a new
`roxy_script_run` reconnects and may land on a different page. So a snippet must
either:

- re-navigate to where the previous stage left off (include the `page.goto` /
  navigation that gets it there), **or**
- assume the page is already in the expected state (e.g. you ran step 1
  manually just before, and the browser profile still shows the logged-in
  page).

This is why each snippet should `capturePageSnapshot` at its **start** too: it
records the page state it inherited, so you can tell whether the snippet failed
because of its own logic or because it started on the wrong page.

### Cross-check with live browser tools

Between snippets, use the read-only browser tools (section 4) to observe the
live page directly — they work even when `roxy_script_run` can't execute, which is
your only window into the "script can't run at all" case.

### Resolve and fold back

Once a stage's failure is located and fixed in its snippet, **fold the fix back
into the candidate script**, delete the temporary `debug-step*.ts` snippets,
and run the full candidate script once more in debug to confirm the integrated
script now passes end to end. The snippets are scaffolding; the deliverable is
always the single library script.

---

## 4. Read-only browser tools

Use these MCP tools to observe the live page without mutating it. They work
**independent of any `roxy_script_run`** — useful both before a run (to see the
starting state) and after a failed run (to see what state the script left the page in).

| Tool | What it shows | When to use |
|---|---|---|
| `browser_snapshot` | Accessibility tree of the current page | The primary tool — see what elements exist and their names/roles, like the agent does during the source task |
| `browser_take_screenshot` | A rendered image of the viewport | When the a11y tree doesn't capture visual state (overlays, canvas, layout issues) |
| `browser_console_messages` | Page's JS console output | Catch client-side errors the script triggered (e.g. a React error boundary, a 401 logged by the SPA) |
| `browser_network_requests` | Network requests/responses | See if an XHR/fetch the script triggered returned an error or unexpected payload |
| `browser_tabs` | Open tabs/windows | Confirm which tab the script is actually operating on (scripts that open popups can land on the wrong tab) |
| `browser_wait_for` | Wait for a condition on the live page | Probe whether an element/text will appear given the current state, without running a script |
| `browser_evaluate` | The exact value of an element or the page (text, attribute, computed style, `localStorage`/`sessionStorage`, a selector's match count) | When `browser_snapshot`/`browser_take_screenshot` confirm an element exists but not its precise value — e.g. did an input end up with the right final value, did a flag get set |

These tools connect to the browser profile the script agent opened. Use them
before a run (check the starting state), after a failed run (see what state the
script left), or instead of a run (when `roxy_script_run` can't execute at all).
They are strictly read-only — never click, type, or navigate with them; mutation
goes through `roxy_script_run`.

### `browser_evaluate` is the one exception that needs a rule

Unlike the other tools, `browser_evaluate` runs arbitrary JS, so nothing at the
tool level stops it mutating the page — that boundary is on you. Only pass
expressions that **read and return a value**, never one with a side effect:

```typescript
// OK — reads a value, no side effect
() => document.querySelector('input[name="email"]')?.value
() => localStorage.getItem('feature_flag_x')
() => document.querySelectorAll('.result-card').length

// NOT OK — mutates the page; this belongs in the script, not here
() => document.querySelector('button.submit')?.click()
() => { document.querySelector('input').value = 'x' }
```

Use it to confirm a script's write landed (read back a field's `.value` /
`textContent`) or to check a flag/counter (a `localStorage` key, a selector's
match count) without re-running. If you want to *write* an expression, that
check belongs inside the candidate script instead.

---

## 5. The debug loop

Bring the tools together into one workflow:

1. **Run the full candidate script in debug.** Read the returned log file
   (relative path in the workspace).
2. **Scan the `console.debug` trail.** The last good stage and the first failed
   one localize the problem. If a `try/catch` logged `err: … | url=…`, you have
   the failure point and the page URL at failure. If the failure is a wrong,
   ambiguous, or missing element (strict-mode violation, acted on the wrong
   item, timeout on a visible element), go straight to **Diagnose and fix
   locator problems** above.
3. **If the log localizes but doesn't explain** — read the
   HTML paths emitted by `capturePageSnapshot` around that stage. The before/after diff shows
   what the page actually did. If no snapshot exists there yet, add
   `capturePageSnapshot` before/after the suspect operation and rerun.
4. **If the full run can't be judged or can't run at all** — split into
   `debug-step*.ts` snippets (each a complete sandbox script), run them one
   stage at a time, and `capturePageSnapshot` at each snippet's start and end.
   Cross-check with the read-only browser tools between snippets.
5. **Fix.** Apply the fix in the snippet (or directly in the candidate script
   if the diagnosis was clear).
6. **Fold back and regress.** Merge any snippet fix into the candidate script,
   delete the `debug-step*.ts` snippets, and run the full
   candidate script once more in debug to confirm the end-to-end pass. For a
   library script, the final write to `library/scripts/<slug>.ts` is the save;
   inspect it with `roxy_script_describe` before the regression run.

The loop narrows the failure at each step: the whole script → a stage → a
before/after page diff → a single isolated operation. Stop as soon as the cause
is clear — don't segment if a snapshot already explains it, and don't snapshot
if the log already does.
