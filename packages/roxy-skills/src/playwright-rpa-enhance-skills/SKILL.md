---
name: playwright-rpa-enhance-skills
description: Enhances linear Playwright scripts with RPA patterns — loops, conditionals, randomization, human simulation, and data operations. Use when converting a recorded skeleton script or refined script into a fully functional Playwright browser automation script.
---

# Playwright RPA Enhance Skills

Enhance a refined (Playwright locators stablized) automation script into a fully functional browser automation script, capable of operating browser automatically, with loops, conditionals, randomization, human simulations and file operations.

## Quick Decision Matrix

When user intent matches a capability cluster, **read the indicated example file
with read_file** before generating the script.

For ambiguous / multi-cluster intents, **read `examples/INDEX.md` first** — it
has 3 routing tables (intent keyword / capability cluster / fixture id) plus
a "routing precedence" guide.

| Capability cluster | Example file |
|--------------------|------------|
| C1 Viewport-aware interaction (closest visible) | `examples/facebook-02-viewport-aware-like.md` |
| C2 Probabilistic scroll loop / backstep | `examples/reddit-02-variable-driven-scroll.md` |
| C3 Search-engine flow (keyword input + select) | `examples/amazon-04-fallback-selector-hover.md` |
| C4 Feed batch interaction (by index range) | `examples/twitter-03-index-segment-action.md` |
| C5 Compose post / reply (textbox + submit) | `examples/twitter-02-retweet-with-confirm.md` |
| C6 Data scrape + persist (CSV) | `examples/amazon-03-paginated-scrape.md` |
| C7 State-based early exit (logged-out / email-registered) | `examples/walmart-01-responsive-multi-exit.md` |
| C8 Responsive branch (viewportSize / fallback selector) | `examples/walmart-01-responsive-multi-exit.md` |
| C9 Either-or / race (dialog vs inline) | `examples/twitter-04-dialog-or-inline-reply.md` |
| C11 Language switch | `examples/facebook-03-language-and-groups-search.md` |
| C12 Hover sequence (dropdown / multi-image) | `examples/twitter-02-retweet-with-confirm.md` |
| C14 Pagination accumulation | `examples/amazon-03-paginated-scrape.md` |
| C15 Network response listener (graphql / api) | `examples/facebook-05-network-monitor-csv.md` |
| C16 Variable injection (env) | `examples/walmart-01-responsive-multi-exit.md` |
| C17 Deliverable screenshot | `examples/facebook-02-viewport-aware-like.md` |

For generic loop / condition / wait-range patterns that don't match a specific
fixture, see `guides/control-flow.md` (includes Sequential-vs-Mutex pitfall +
wait range table + branching forms).

C10 (retry) / C13 (multi-tab) / C18 (goBack) have no canonical fixture yet —
use generic patterns from `guides/control-flow.md` instead.

## Enhancement Rules

1. **Preserve all selectors** — every `locator()` / `getByRole()` in the skeleton
   came from a real DOM and has been stabilized by refine. Never rewrite them.

2. **Inject loops from intent** — if the user said "N times" or "repeat", wrap the
   skeleton body in a `for (let i = 0; i < N; i++)` loop. The skeleton shows one
   iteration; you add the loop around it.

3. **Add conditions from intent** — element-existence checks, login detection,
   language detection, probability triggers. Check before acting, skip gracefully.

4. **Replace all fixed waits** — every `waitForTimeout(N)` becomes
   `await sleep(min, max)` with a randomized range appropriate to the action type.

5. **Prepend utility functions** — place `sleep`, `pick`, `maybe`, `humanScroll`,
   etc. at the top of the script (after imports). Use the exact implementations
   from `references/utility-functions.md` (read with read_file when generating).
   Only prepend the utilities you actually use.

6. **Don't scroll-then-click** — Playwright's `.click()` already calls
   `scrollIntoViewIfNeeded` automatically. Never wrap a click in
   `humanScroll(...) → click()` to "make the element visible first" — this is
   redundant and brittle.

   `humanScroll` is for **deliberate browsing intent** only:
   - Feed scrolling (TikTok, Reddit, Twitter timeline browsing)
   - Anti-bot simulation when the user explicitly says "慢慢滚 / 模拟人类浏览"
   - Multi-iteration loops where each iteration scrolls before reading content

   If the recorded skeleton has a single scroll-then-click sequence and the
   user intent doesn't mention browsing/feed/scroll, **drop the scroll** and
   let `.click()` auto-scroll. If the intent does mention scrolling, keep
   `humanScroll` but with `backstepChance: 0` unless the user said
   "模拟人类 / human-like / 自然滚动".

7. **Use native `console` for all output** — use the standard `console` API
   as you normally would. The sandbox wires it to the host process so all
   output reaches the user. One sandbox-specific rule: `console.debug` is a
   **no-op under the release profile** (the default) — use it only for
   verbose diagnostics you want in debug runs; prefer `console.log` /
   `console.info` for output you always want visible.

8. **Capture page state at debug-critical points** — `run_script` only hands
   the enhance agent the log file plus files inside the workspace; the page
   itself is invisible after the run. When a stage misbehaves, the fastest way
   to see what the page actually became is to snapshot its full HTML with
   `page.content()`. Use the `capturePageState(page, label)` helper from
   `references/utility-functions.md` (read it with `load_skill_file` when
   generating): it writes the complete HTML to `html-snapshots/<label>.html`
   and logs a one-line summary, so you can both skim the log trail and read
   the snapshot back to inspect the real DOM.

   - **Proactive instrumentation** — at major stage boundaries (after
     navigation, after login, after a key state transition), call
     `capturePageState(page, 'after-<stage>')`. This gives a baseline page-state
     trail that reveals where the page diverged from expectations.
   - **Reactive diagnosis** — when a `run_script` debug log shows `WARN` /
     `ERROR`, or an operation is flaky, insert `capturePageState` **immediately
     before and after** the suspect operation (e.g. `before-submit` /
     `after-submit`), rerun in debug, then read both snapshots to diff what the
     page looked like on either side. This pinpoints whether the action landed,
     was blocked, redirected, or rendered something unexpected.
   - **Reading snapshots back** — after a debug run, read
     `html-snapshots/<label>.html` with `read_file` (relative path, no `..`).
     Compare before/after pairs to localize the failure. Snapshots of
     authenticated pages may embed in-page tokens — keep them workspace-local,
     never exfiltrate.
   - **Write location is fixed** — the helper resolves
     `<workspace>/html-snapshots/` by walking up two levels from the per-run
     `script-run/<runId>/` cwd, so the read path is stable across reruns. Only
     ever write page-state snapshots to `html-snapshots/`; do not invent other
     output locations for them.

## Sandbox Runtime

The generated script runs inside a strict VM sandbox. You **must** read
`references/sandbox-runtime.md` before generating — it contains the mandatory
script structure (`export async function main(options?)` — exported `main`,
called by the sandbox, with an optional `options` parameter for scripts that
take input), the list of injected
globals, the import whitelist/blacklist, the env-var whitelist, the network and
filesystem restrictions, and the full validator rules table.

## Script input (`options`)

Every script takes its runtime input through a single `options` argument on
`main`:

```typescript
interface ScriptOptions {
  videoPath: string
  title: string
  hashtags: string[]
  publishUrl: string
}

export async function main(options: ScriptOptions): Promise<void> {
  // …read options.videoPath, options.title, etc. instead of hard-coding them…
}
```

- **Design `options` from user intent.** Identify values the caller must supply
  per run (video path, title, caption, hashtags, publish URL, watch count,
  dwell-time range, …) and model them as fields on `options`. Declare the shape
  with a `interface`/`type` so the body is type-checked.
- **Declare `options` when the script takes input.** If the script needs any
  caller-supplied value, declare it: `export async function main(options: ScriptOptions): Promise<void>`.
  Only when the script is fully self-contained (no external input whatsoever)
  may you drop the parameter: `export async function main(): Promise<void>`.
  The validator accepts both forms — there is no `structure-options-param` rule.
- **`options` vs `config`.** `config` (top-level `const config = {}`) holds
  stable, script-internal constants derived from the recording (target URL,
  dirId, fixed timeouts). `options` holds per-run input supplied by the caller.
  Lift runtime-supplied values into `options`, not `config`.
- **Author the JSON Schema.** Write the matching JSON Schema (type=object +
  properties + required + field descriptions) to the workspace file
  `script_schema.json` with `write_file` — it is the single source of truth you
  read back when building a test `options` for `run_script`. Even an empty
  schema `{}` is required for no-input scripts.
- **Test with a real `options`.** Before saving, `read_file` `script_schema.json`
  and build a valid `options` (reasonable example values) to pass to
  `run_script`'s `options` argument. Do not test with `options` omitted when the
  script declares input.
- **Persist via `save_script`.** When saving, pass the same schema as the
  `optionsSchema` argument to `save_script` (object or JSON string; `{}` for
  no-input scripts). `optionsSchema` is the authoritative source for
  persistence — **you must pass it explicitly**; `save_script` does not read
  `script_schema.json` for you. `list_scripts` later returns each script's
  schema so callers know how to build `options`.

## Debugging

When a `run_script` debug run fails, logs `WARN`/`ERROR`, behaves flakily, or
can't be run/judged as a whole, read `references/debugging.md` — it covers
`console.debug` instrumentation, `capturePageState` before/after pairing,
segmented (split-script) runs, the read-only browser tools, and the end-to-end
debug loop.
