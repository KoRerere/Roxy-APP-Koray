# Sandbox Runtime Environment

The generated script runs inside a **VM sandbox** (`vm.SourceTextModule`) that
imposes strict constraints. A script that violates any error-level constraint
will be rejected by the validator or fail at runtime. Read this document
carefully before generating — it is the single source of truth for all sandbox
constraints.

## Mandatory script structure

Every script **must** follow this exact skeleton — the validator checks each
piece and will reject the script if any error-level item is missing:

```typescript
import { chromium, firefox } from 'playwright'
// …other allowed imports…

// ── Utility functions (only those you use) ────────────────────────────
function sleep(min: number, max: number): Promise<void> { /* … */ }
// …

// ── Browser connection (DO NOT MODIFY this block) ─────────────────────
const BROWSER_URL = process.env.BROWSER_URL ?? ''
const CDP_URL = process.env.CDP_URL ?? ''                       // legacy fallback
const BROWSER_TYPE = process.env.BROWSER_TYPE ?? 'chromium'
if (!BROWSER_URL && !CDP_URL) {
  console.error('Set BROWSER_URL or CDP_URL before running this script.')
  process.exit(1)
}

// ── Script input type (optional but recommended) ─────────────────────
// Declare the shape of `options` so the body gets type checking. Lift every
// runtime-supplied value (URLs, counts, file paths, captions, ranges…) into
// `options` and read it from there instead of hard-coding it into `config`.
interface ScriptOptions {
  // …your input fields, e.g. videoPath: string; count: number…
}

export async function main(options: ScriptOptions): Promise<void> {  // ← MUST be exported "main"; options is optional (omit only when the script takes no input)
  let browser
  if (BROWSER_URL) {
    browser = BROWSER_TYPE === 'firefox'
      ? await firefox.connect(BROWSER_URL)
      : await chromium.connect(BROWSER_URL)     // ← MUST call connectOverCDP( or .connect(
  }
  else {
    browser = await chromium.connectOverCDP(CDP_URL)   // legacy CDP path (chromium-only)
  }
  const context = browser.contexts()[0] ?? await browser.newContext()
  const page = context.pages()[0] ?? await context.newPage()

  // … business logic; read runtime values from `options` …

  console.log('[done]')                          // ← stage-boundary log
  await browser.close()
}
```

The sandbox calls `main(options)` itself after evaluating the module — **do not**
call `main()` yourself, and **do not** write `export const __main = main()` (the
legacy self-start contract is no longer supported). Likewise **do not** call
`process.exit()` inside `main` or at the top level — exit is managed solely by
the sandbox once `main` resolves/rejects.

| Constraint | Level | What the validator checks |
|---|---|---|
| `export async function main(` or `export const main = async` | **error** | `structure-main` |
| `connectOverCDP(` or `.connect(` somewhere | **error** | `structure-connect` |
| `process.env.BROWSER_URL` or `process.env.CDP_URL` | **error** | `structure-cdp-url` |

## Script input (`options`)

`main` receives a single `options` argument that carries every value the script
needs at runtime. The sandbox parses it from the `SANDBOX_OPTIONS` env var
injected by the runner and passes the parsed object to `main(options)` — the
script itself **never** reads `process.env.SANDBOX_OPTIONS`.

- **Declare `options` when the script takes input.** If the script needs any
  caller-supplied value, declare it: `export async function main(options: ScriptOptions): Promise<void>`.
  Only when the script is fully self-contained (no external input whatsoever)
  may you drop the parameter: `export async function main(): Promise<void>`.
  The validator accepts both forms.
- **Lift runtime-supplied values into `options`**, not into the top-level
  `config` block. `config` is for stable, script-internal constants (derived
  from the recording); `options` is for data the caller supplies per run —
  video path, title, caption, hashtags, publish URL, watch count, dwell-time
  range, etc.
- **Declare the shape** with a `interface`/`type` so the body is type-checked,
  e.g. `interface ScriptOptions { videoPath: string; title: string; count: number }`.
- **The matching JSON Schema** is authored by the enhance agent and persisted
  alongside the script (see SKILL.md → *Script input*). The runner uses it only
  to advertise the input shape via `list_scripts`; the script does not validate
  `options` itself at runtime.

## Running scripts authored in a skill

`run_script` can also run a script file authored inside an installed skill —
pass its absolute path as `scriptName`. The runner guards this the same way
`load_skill_file` does: only files inside the configured skills directory are
allowed; anything outside is refused. The script MUST still follow every
constraint in this document (exported `main`, connection block, import/env
whitelists, no `__main`, no top-level `process.exit`) — the runner does not
pre-validate, so a contract violation surfaces as a sandbox runtime error. This
lets a skill ship reusable scripts (e.g. a TikTok upload script bundled with
the skill) that the agent runs directly by path, with `options` carrying the
per-run data.

## Injected globals (no import needed)

These are available in the sandbox context without any import statement:

- **`console`** — standard API, routed to the host process. One sandbox-specific
  behaviour: `debug` is a **no-op under the release profile** (the default).
- **`process`** — a curated, safe subset of the real `process`. `cwd()` returns
  the **virtual root `/`** (the script never sees the host workspace path);
  `platform`/`arch`/`version`/`versions`/`pid`/`argv0`/`stdout`/`stderr`/`stdin`/
  `nextTick`/`hrtime`/`memoryUsage`/`cpuUsage`/`uptime`/`emitWarning` and the
  signal-event API (`on`/`once`/`off`/`emit`/…) are available. `env` is limited
  to the whitelisted keys below (no `SANDBOX_OUTPUT_DIR` — use `process.cwd()`);
  `exit(code)` flushes artifacts before exiting. See **Sandbox `process`
  capabilities & pitfalls** for the full list and what to avoid.
- **Timers** — `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`
- **Built-ins** — `Buffer`, `URL`, `URLSearchParams`, `TextEncoder`,
  `TextDecoder`, `Error`, `TypeError`, `RangeError`, `Promise`, `JSON`, `Math`,
  `Date`, `parseInt`, `parseFloat`, `isNaN`, `isFinite`, `encodeURIComponent`,
  `decodeURIComponent`, `encodeURI`, `decodeURI`, `Object`, `Array`, `Map`,
  `Set`, `WeakMap`, `WeakSet`, `Symbol`, `RegExp`, `Uint8Array`, `Uint16Array`,
  `Uint32Array`, `Int8Array`, `Int16Array`, `Int32Array`, `Float32Array`,
  `Float64Array`, `ArrayBuffer`, `SharedArrayBuffer`, `DataView`

## Allowed import modules (whitelist)

Only these modules can be imported. Any other specifier will cause a runtime
`Module not allowed` error:

| Module | Also available as |
|---|---|
| `playwright` | — |
| `path` | `node:path` |
| `fs` | `node:fs` |
| `fs/promises` | `node:fs/promises` |
| `url` | `node:url` |
| `crypto` | `node:crypto` |
| `buffer` | `node:buffer` |
| `stream` | `node:stream` |

**Forbidden imports** (will fail validation): `child_process`, `worker_threads`,
`net`, `http`, `https`, `os`, `vm`, `dgram` (and their `node:` prefixed forms).

## Environment variables

Only these `process.env` keys are available inside the sandbox:

| Key | Description |
|---|---|
| `BROWSER_URL` | WebSocket endpoint of the browser to connect to (preferred; universal — works for chromium and firefox) |
| `BROWSER_TYPE` | Browser kind: `'chromium'` (default) or `'firefox'`. Only consulted when connecting via `BROWSER_URL`/`.connect()`. When falling back to `CDP_URL` the type is always `chromium` (firefox dropped CDP). |
| `CDP_URL` | Legacy CDP WebSocket endpoint. Used as a fallback when `BROWSER_URL` is unset (chromium-only). |
| `SANDBOX_RUN_ID` | Unique run identifier |
| `SANDBOX_DIR_ID` | Directory identifier for the recording session |

> The workspace root is **not** exposed as an env var. Use `process.cwd()`
> (which returns `/`) to build file paths. Accessing any other `process.env.*`
> key (including `SANDBOX_OUTPUT_DIR`) will trigger a validation error
> (`process-env` rule).
>
> `SANDBOX_OPTIONS` is also **not** in the whitelist — the sandbox parses it
> internally and passes the result to `main(options)`. Read input from the
> `options` parameter, never from `process.env.SANDBOX_OPTIONS`.

## Network restrictions

`fetch` and `XMLHttpRequest` are **set to `undefined`** in the sandbox context.
Do not use them — the validator will flag both (`network-call` rule). If you
need data from a web API, navigate to the page with Playwright and scrape the
DOM instead.

## File system access

The script's `fs` is a **guarded thin wrapper over the real host filesystem**,
not a confined virtual root. `process.cwd()` returns the real per-run workspace
directory (an isolated run dir, **not** the enhance agent's workspace). Relative
paths resolve from there; absolute paths and `~/...` (tilde-expanded) access
real host locations.

- **Allowed**: reading user-supplied external files (e.g.
  `fs.readFileSync('/Users/me/Downloads/data.csv')`) and writing artifacts to
  user-chosen locations (e.g. `~/Desktop/report.xlsx`). The script workspace's
  own artifacts use relative paths (e.g. `output/result.csv`).
- **Blocked — sensitive path blacklist**: reads/writes of OS directories
  (`/etc`, `/sys`, `/proc`, `/usr`, `C:\Windows`, …) and user credential/key
  directories (`~/.ssh`, `~/.aws`, `~/.gnupg`, …) throw `EACCES`. The script may
  `try/catch` to sense the refusal. Do not attempt these paths.
- **Writes are tracked**: every successful write's resolved path is reported to
  the host (for artifact collection). Only files written **inside the run
  workspace** are collected as downloadable artifacts; external writes are
  tracked but not collected.
- Sub-directories still need to be created explicitly with
  `fs.mkdirSync(dir, { recursive: true })`.

> ⚠️ Do not write secrets (tokens, cookies, passwords) to any file. The
> `sensitive-leak` validator rule flags hardcoded credentials in the script
> source.

Use `process.cwd()` as the base for workspace-relative paths; use absolute or
`~/` paths for external user files. There is no env var for the workspace root.

## Sandbox `process` capabilities & pitfalls

The injected `process` is a **curated subset**, not the real one. Treat it as
the single source of truth; do not probe for undocumented internals.

**Available (safe passthrough):**
- `cwd()` → returns the **real per-run workspace directory** (an isolated run
  dir, not the enhance agent's workspace and not `/`). Use it as the base for
  workspace-relative `path.join(...)`; use absolute or `~/` paths for external
  user files.
- Standard metadata: `platform`, `arch`, `machine`, `version`, `versions`,
  `release`, `title`, `argv0`, `pid`, `ppid`.
- Streams: `stdout`, `stderr`, `stdin`.
- Timers/diagnostics: `nextTick`, `hrtime`, `hrtime.bigint`, `memoryUsage`,
  `cpuUsage`, `resourceUsage`, `uptime`, `emitWarning`, `umask`.
- Signal/event API: `on`, `once`, `off`, `addListener`, `removeListener`,
  `removeAllListeners`, `emit`, `listeners`, `listenerCount`, `rawListeners`,
  `eventNames`.
- `env` — only the whitelisted keys (see *Environment variables*); no
  `SANDBOX_OUTPUT_DIR`, no `SANDBOX_OPTIONS` (read input from the `options`
  argument, not env).
- `exit(code)` — flushes artifacts, then exits.
- `argv`, `execPath`, `execArgv` — **scrubbed** to avoid leaking host paths:
  `argv === ['node', 'sandbox', '<script basename>']`, `execPath === 'node'`,
  `execArgv === []`. Do not rely on them containing real node/script paths.

**Avoid — no-op / disabled (do not depend on them):**
- `process.binding(...)`, `process._linkedBinding(...)`, `process.dlopen(...)`,
  `process._rawDebug(...)` → no-op (returns `undefined`). Cannot load native
  modules or reach private Node internals.
- `process.send(...)` → returns `false` (no IPC channel to the host). Do not
  build logic on IPC replies.
- `process.kill(...)` → returns `true` but sends **no** signal. Cannot kill
  processes.
- `process.disconnect()` → no-op.
- `process.mainModule` → `undefined`; `process.moduleLoadList` → `[]`;
  `process.channel` → `null`; `process.connected` → `false`. These mimic
  "not a forked IPC child" — feature detection that branches on them is safe.
- `process.chdir(...)` → no-op. `process.cwd()` always returns the run
  workspace regardless.
- Any other undocumented internal (e.g. `_events`, `_maxListeners`, `domain`)
  → `undefined`. Unknown `process.*` properties are **not visible**.

**Pitfalls to keep in mind when writing scripts:**
1. Workspace artifacts use relative paths (resolve from `process.cwd()`); user
   external files use absolute or `~/` paths. Sensitive OS/credential paths
   throw `EACCES` — do not target them.
2. Don't gate behavior on `process.send`/`process.connected` expecting IPC; use
   `console.info(...)` to communicate progress.
3. Don't try to escape via `process.binding('spawn_sync')` or `require`-from-
  `mainModule` — both are neutralized and will silently do nothing.

## Validator rules quick reference

| Rule | Level | What it catches |
|---|---|---|
| `syntax` | error | TypeScript/syntax errors |
| `failed-marker` | error | `// FAILED:` comments (unresolved recording failures) |
| `forbidden-import` | error | Imports from the blacklist modules |
| `network-call` | error | `fetch()` or `new XMLHttpRequest()` |
| `process-env` | error | Accessing env vars outside the whitelist |
| `legacy-browser-global` | error | Old MCP global functions (`browser_navigate`, etc.) |
| `unsupported-runtime-global` | error | `log.info`, `trace.`, `files.`, `runtime.` |
| `empty-locator` | error | `locator('')`, `getByRole('')`, etc. |
| `unstable-ref` | error | AXTree refs (`aria-ref=e12`) or `UNSTABLE: AXTree ref` |
| `sensitive-leak` | error | Hardcoded auth tokens / API keys / cookies |
| `structure-main` | error | Missing an exported `async function main(` / `const main = async` |
| `structure-connect` | error | Missing `connectOverCDP(` or `.connect(` |
| `structure-cdp-url` | error | Missing `process.env.BROWSER_URL` or `process.env.CDP_URL` |
