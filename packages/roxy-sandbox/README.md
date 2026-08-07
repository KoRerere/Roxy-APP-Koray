# @roxybrowser/sandbox

Agent-friendly capability modules exposed to RoxyBrowser automation scripts that
run inside the sandbox VM.

> ⚠️ These are **not** ordinary npm packages the script bundles. At runtime the
> sandbox linker resolves each subpath specifier to a host-injected module (see
> `roxy-agent/src/modes/sandbox.ts` → `sandboxApis`). This package holds the
> **public API surface + types** so the writing agent and the runtime agree.
> It **is** wired into roxy-agent via that linker — `roxy-agent` depends on
> `@roxy/sandbox` (`workspace:*`) and injects every subpath at sandbox setup.

## Design principles (why it's shaped this way)

1. **One namespace, many subpaths.** Everything the sandbox provides lives under
   `@roxybrowser/sandbox/*`. A single stable prefix keeps the LLM's cognitive
   load flat no matter how many capabilities are added.
2. **Subpaths are tiered by cost**, so the LLM can judge a call at a glance:
   - **pure** (`/utils`, `/human`) — no network, no secrets, free, sync-ish.
   - **host-backed** (`/llm`, later `/excel`, `/storage`) — async, may be slow or
     billed; the real impl is injected by the host, secrets never reach the script.
   - **third-party** (future `/apps/*`) — external integrations, need auth (held
     host-side), rate-limited, must be `try/catch`ed.
3. **Tiny, consistent surfaces.** Capability names are singular, lowercase,
   idiomatic (`sleep`, `pick`, `retry`, `complete`). Same-tier modules share a
   shape so learning one teaches the rest.
4. **Zero config.** Every export is usable directly — no `new X()`, no cwd.
5. **Types are the source of truth.** Keep the skill's prose to a manifest + one
   example; the LLM pulls detailed signatures from these `.d.ts` on demand.

## Available subpaths (manifest)

| Subpath | Tier | Exports | Notes |
|---|---|---|---|
| `@roxybrowser/sandbox` | macro | `defineMetadata`, `defineParams` | self-description macros; optional `metadata.slug` overrides the runtime `workdir/{slug}` directory |
| `@roxybrowser/sandbox/utils` | pure | `sleep`, `randomBetween`, `pick`, `maybe`, `chunk`, `retry` | deterministic helpers |
| `@roxybrowser/sandbox/human` | pure | `createHuman` | explicit time-based move, click, hover, type, press, scroll, and pause on a Playwright `Page`; legacy wrappers are deprecated |
| `@roxybrowser/sandbox/llm`   | host | `ask` (text), `json` (structured, JSON Schema) | **definition + forward only**, host implements `LlmTransport`; secrets stay host-side |
| `@roxybrowser/sandbox/table` | host | `Table` (class; async `.append`, `.all`, `.find`, `.clear`) | `new Table(name)`; **in-memory + async write-through**, CSV-backed; loads on construct |
| `@roxybrowser/sandbox/kv` | host | `KV` (class; async `.get`, `.set`, `.has`, `.delete`, `.keys`, `.all`, `.clear`) | `new KV(name)`; **in-memory + async write-through**, JSON-backed; loads on construct |
| `@roxybrowser/sandbox/debug` | host | `getPageHtml`, `capturePageSnapshot` | Sanitized body-DOM inspection; debug-profile HTML persistence with path logging |
| `@roxybrowser/sandbox/download` | deprecated | `saveResource`, `saveResources`, `saveDownload` | Compatibility only; use browser APIs plus Node `fs` |
| `@roxybrowser/sandbox/2fa` | pure | `parse2FA`, `totp` | Parse a base32 2FA secret like `6R3K4AMJ4CCO64HTYAYCCCIU7FNV7I74` into the current TOTP code |

Planned (not implemented): `/excel`, `/apps/*` (third-party).

`defineMetadata.slug` is optional. A non-empty value makes the script runtime
directory `workdir/{slug}/`; otherwise the filename without its extension is
used. This only controls runtime assets—the library script identity remains its
filename.

> **On `fs`:** the sandbox linker exposes the native Node `fs`, `node:fs`,
> `fs/promises`, and `node:fs/promises` modules without rewriting their methods.
> The child process is started with Node's `--permission`, `--allow-fs-read`, and
> `--allow-fs-write` flags; those process-level rules are the filesystem boundary.
> The global sandbox `fetch` uses the same manifest and disables automatic
> redirects so a permitted host cannot redirect into an unlisted host.

## Usage sketch (inside a sandbox script)

```ts
import { chromium } from 'playwright'
import { pick, sleep } from '@roxybrowser/sandbox/utils'
import { createHuman } from '@roxybrowser/sandbox/human'
import { json } from '@roxybrowser/sandbox/llm'

export async function main(): Promise<void> {
  const browser = await chromium.connect(process.env.BROWSER_URL!)
  const page = browser.contexts()[0].pages()[0]
  const human = createHuman(page)

  await human.scroll({
    distance: 2000,
    axis: 'vertical',
    duration: 1000,
    curve: 'ease-in-out',
  })
  await sleep(1000, 3000)

  const title = await page.title()
  const { sentiment } = await json<{ sentiment: string }>(
    `Classify the sentiment of this title: "${title}"`,
    { type: 'object', properties: { sentiment: { type: 'string' } }, required: ['sentiment'] },
  )
  console.log(pick(['done', 'ok', 'finished']), sentiment)
  await browser.close()
}
```

`scroll.curve` accepts `linear`, `ease-in`, `ease-out`, `ease-in-out`, or a custom
function. A custom curve receives normalized time from `0` to `1` and returns
cumulative displacement. It must satisfy `curve(0) === 0` and `curve(1) === 1`;
intermediate values may overshoot or reverse when the motion needs that shape.

## Human interaction model

Every action describes physical intent explicitly. `move`, `scroll`, and `type`
share the same named time curves; pointer movement additionally separates the
geometric `path` from its timing `curve`.

```ts
const submit = page.getByRole('button', { name: 'Submit' })

await human.move({
  target: submit,
  ensureVisible: true,
  motion: {
    duration: 320,
    curve: 'ease-out',
    path: { type: 'bezier', curvature: 36 },
  },
})

await human.click({
  target: submit,
  motion: { duration: 0, curve: 'linear', path: 'linear' },
  settleDuration: 80,
  holdDuration: 65,
})

await human.type({
  target: page.getByRole('textbox'),
  text: 'hello',
  mode: 'replace',
  duration: 500,
  curve: 'ease-in-out',
  focus: {
    ensureVisible: true,
    motion: { duration: 260, curve: 'ease-out', path: 'linear' },
    settleDuration: 60,
    holdDuration: 55,
  },
})

await human.press({ key: 'Enter', holdDuration: 60 })
await human.pause({ duration: 500 })
```

`click` is exactly `move → settle → mouse down → hold → mouse up`; `hover` is
`move → dwell`. `press` never focuses or clicks implicitly. `type.focus` must be
configured explicitly or set to `false` when the target is already focused.
Once an actor is created, route pointer movement through it; direct
`page.mouse`/Locator `hover`/`click` calls would make its tracked pointer stale.

## Host wiring (done — in `roxy-agent/src/modes/sandbox.ts`)

The agent host wires every subpath into the sandbox VM; the mechanics:

- Each subpath is a key in `sandboxApis`, exposed via a `vm.SyntheticModule` under
  the `@roxybrowser/sandbox/*` specifier. These modules are **loaded host-side**
  (agent process), so their `node:fs` is the real fs. Scripts additionally receive
  the native Node `fs` modules, constrained by the sandbox process permission flags.
- `/llm`: host calls `__setLlmTransport(hostTransport)` at setup. The package only
  forwards a normalized `AskRequest`; the host's `LlmTransport.ask` does all real
  work (interpret labels/shape/schema, build prompt, call the model, parse), with
  the API key never entering the sandbox.
- `/table` and `/kv`: host calls `__setStorageDir(outputDir)` — all file I/O
  (CSV/JSON, read/write, path-traversal guard) lives inside the package.
- `/download` (deprecated): host calls `__setOutputDir(outputDir)` for compatibility — resource requests go
  through the supplied Playwright page first, with a Playwright request fallback
  for CORS-blocked resources; the host only writes the returned bytes inside the
  output dir after filename/path and size checks.
- `/debug`: host calls `__configureDebug({ debug })`; the module reads `SANDBOX_DEBUG` and `SANDBOX_LOGS_DIR`, writes HTML beside the daily run log, and emits its absolute path through `console.debug`.
- The `__`-prefixed host setters are stripped from the script surface via
  `publicExports()`. Keep the validator's import allow-list and
  `sandbox-globals.d.ts` in sync when adding subpaths.
