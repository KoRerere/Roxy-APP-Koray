# Utility Functions

Copy these verbatim to the top of the generated script (after imports) selectively if needed.
Only copy the functions you actually use.

## Sandbox-Injected Globals

The following is **injected by the sandbox runtime** — do NOT define or import
it in your script. It is available as a global identifier inside the VM context.

### `console`

Use the standard `console` API as normal — the sandbox routes all output to
the host process. One sandbox-specific behaviour: `console.debug` is a
**no-op under the release profile** (the default). Use it only for verbose
diagnostics you want in debug runs; use `console.log` / `console.info` for
output you always want visible.

---

## Utility Functions (copy into script)

```typescript
// ── Utility functions ────────────────────────────────────────────────────────

function sleep(min: number, max: number): Promise<void> {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function maybe(probability: number): boolean {
  return Math.random() < probability;
}

interface ScrollConfig {
  distance: number;
  direction?: 'down' | 'up';
  stepMin?: number;
  stepMax?: number;
  delayMin?: number;
  delayMax?: number;
  backstepChance?: number;
  backstepRatio?: number;
}

async function humanScroll(page: import('playwright').Page, cfg: ScrollConfig): Promise<void> {
  const { distance, direction = 'down', stepMin = 50, stepMax = 150,
          delayMin = 30, delayMax = 80, backstepChance = 0, backstepRatio = 0.3 } = cfg;
  const sign = direction === 'down' ? 1 : -1;
  let scrolled = 0;
  while (scrolled < distance) {
    const step = Math.min(randomBetween(stepMin, stepMax), distance - scrolled);
    // page.mouse.wheel dispatches a real WheelEvent — required for SPAs
    // (Google/Twitter/Reddit) that ignore programmatic window.scrollBy.
    await page.mouse.wheel(0, step * sign);
    scrolled += step;
    // Skip backstep on the final iteration so we don't end up scrolled short.
    if (backstepChance > 0 && scrolled < distance && maybe(backstepChance)) {
      const back = Math.floor(step * backstepRatio);
      await page.mouse.wheel(0, back * sign * -1);
    }
    await sleep(delayMin, delayMax);
  }
}

function readKeywords(filePath: string): string[] {
  // Requires: import * as fs from 'fs' at the top of the script
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf-8').split('\n').map((l: string) => l.trim()).filter(Boolean);
}

function appendToFile(filePath: string, data: string): void {
  // Requires: import * as fs from 'fs' at the top of the script
  fs.appendFileSync(filePath, data);
}

// ── Page-state capture (debug instrumentation) ──────────────────────────────
// Captures the full page HTML at a key stage so the enhance agent can inspect
// what the page actually looked like. Requires these top-level ESM imports:
//   import * as fs from 'fs'
//   import * as path from 'path'
//   import { type Page } from 'playwright'
//
// run_script executes the script with cwd() = <workspace>/script-run/<runId>/
// (a different per-run subdirectory), while the run log file lands directly in
// <workspace>/. To give the agent a stable, run-agnostic read path that sits
// alongside the log, snapshots resolve the shared <workspace>/html-snapshots/
// dir by walking up two levels. The sandbox fs guard allows '..' (it only
// blocks sensitive paths), so this writes a fixed <workspace>/html-snapshots/<label>.html.
const SNAP_DIR = path.resolve(process.cwd(), '..', '..', 'html-snapshots')

async function capturePageState(page: Page, label: string): Promise<void> {
  const content = await page.content()          // full serialized page HTML
  const url = page.url()
  let title = ''
  try {
    title = await page.title()
  } catch {}
  fs.mkdirSync(SNAP_DIR, { recursive: true })
  fs.writeFileSync(path.join(SNAP_DIR, `${label}.html`), content, 'utf-8')
  console.debug(
    `[snapshot] ${label} | url=${url} | title=${title} | htmlLen=${content.length} -> html-snapshots/${label}.html`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
```

## Usage Notes

- `sleep(min, max)` — replaces every `waitForTimeout`. Pick ranges from the
  wait-range table in `guides/control-flow.md`.
- `randomBetween(min, max)` — integer in `[min, max]`. Use for scroll distances,
  indices.
- `pick(arr)` — uniform random element. Use for keywords, comments, usernames.
- `maybe(p)` — returns `true` with probability `p ∈ [0, 1]`. Use for optional
  actions.
- `humanScroll(page, cfg)` — smooth multi-step scroll. Always use the **object
  config** form (`ScrollConfig`) — it is clearer than positional arguments when
  many optional parameters are involved. `page` type is inferred from the
  `playwright` import.
- `readKeywords(path)` — reads a newline-delimited text file; returns `[]` if
  missing. **Requires** `import * as fs from 'fs'` at the top of the script.
- `appendToFile(path, data)` — appends string to file; creates file if not
  exists. **Requires** `import * as fs from 'fs'` at the top of the script.
- `capturePageState(page, label)` — snapshots the full page HTML to
  `<workspace>/html-snapshots/<label>.html` and logs a one-line summary
  (`[snapshot] label | url=… | title=… | htmlLen=… -> html-snapshots/label.html`).
  **Requires** `import * as fs from 'fs'`, `import * as path from 'path'`, and
  `import { type Page } from 'playwright'` at the top of the script. Use it to
  instrument debug runs: the enhance agent reads `html-snapshots/<label>.html`
  back (with `read_file`, using the relative path) to inspect the page state at
  a stage boundary, or to diff before/after a flaky operation. Keep `label`
  short, kebab-case, and stage-specific (e.g. `after-login`, `before-submit`,
  `page-3-loaded`). Snapshots of authenticated pages may embed in-page tokens —
  treat them as workspace-local diagnostics, never exfiltrate.

## File Path Notes

The script sees a **virtual root `/`** (== `process.cwd()`); the host workspace
path is never exposed. Every `fs` read and write is transparently mapped between
this virtual root and the host workspace. Build all paths from `process.cwd()`
(e.g. `path.join(process.cwd(), 'output', 'result.csv')`) — there is **no**
`SANDBOX_OUTPUT_DIR` env var; reading `process.env.SANDBOX_OUTPUT_DIR` triggers a
`process-env` validation error. Sub-directories still need
`fs.mkdirSync(dir, { recursive: true })` to be created. See
`references/sandbox-runtime.md` for the full filesystem confinement rules.
