---
name: automation-script-writing
description: Create, edit, inspect, run, and debug reusable RoxyBrowser Playwright automation scripts, whether authored directly, derived from recorded browser operations, loaded from official slugs, or supplied as local files. Use for the self-describing script contract, params JSON Schema, sandbox APIs and runtime boundaries, filesystem and fetch permissions, Playwright screenshots and artifacts, locator stabilization, and script troubleshooting.
---

# Automation Script Writing

Use this skill to create or maintain reusable Playwright scripts for the RoxyBrowser sandbox runtime.

## Read Order

1. Read this `SKILL.md` completely.
2. Read `references/sandbox-api.d.ts` when you need exact signatures for `@roxybrowser/sandbox/*`.
3. Read only the relevant reference file when the script needs advanced control flow, debugging, or runtime details.
4. Read at most one closely matching example first. Read another only when it provides a distinct pattern you still need.

## Core Contract

Every automation script is a single self-describing TypeScript file:

- Authored library path: `library/scripts/<slug>.ts`
- Optional permission sidecar: `library/scripts/<runtime-slug>.permissions.json`
- Runnable source: an official script slug or a readable absolute local path
- Entry: exported async `main`
- Metadata: inline `defineMetadata({...})`
- Inputs: inline `defineParams({...})` JSON Schema
- Browser: connect to the provided browser from inside `main`
- Runtime: strict VM sandbox, not normal Node

`defineMetadata.slug` optionally overrides the runtime workdir name. The default is the script filename without its extension. This does not change the library script identity.

## Required Script Shape

```typescript
import { chromium, firefox } from 'playwright'
import { defineMetadata, defineParams } from '@roxybrowser/sandbox'
import { sleep } from '@roxybrowser/sandbox/utils'

interface ScriptParams {
  keyword: string
}

defineMetadata({
  name: 'My script',
  description: 'What it does',
  version: '1.0.0',
  slug: 'my-script-assets',
})

defineParams({
  type: 'object',
  properties: {
    keyword: {
      type: 'string',
      description: 'Keyword to search for'
    }
  },
  required: ['keyword']
})

export async function main(params: ScriptParams): Promise<void> {
  const BROWSER_URL = process.env.BROWSER_URL ?? ''
  const BROWSER_TYPE = process.env.BROWSER_TYPE ?? 'chromium'
  const browser = BROWSER_TYPE === 'firefox'
    ? await firefox.connect(BROWSER_URL)
    : await chromium.connect(BROWSER_URL)

  const context = browser.contexts()[0] ?? await browser.newContext()
  const page = context.pages()[0] ?? await context.newPage()

  // Business logic. Read runtime values from `params`.
  await sleep(500)

  await browser.close()
}
```

`name` and `description` (and each parameter `description`) also accept a localized `{ zh, us, ru }` form for multi-language self-description — see `references/localization.md`.

## Pre-Run Checks And Authoring Rules

`roxy_script_describe` and `roxy_script_run` perform these source checks before execution:

- The source must parse as TypeScript.
- `defineMetadata({...})` and `defineParams({...})` must be top-level calls with static object literals. Variables, spreads, computed values, and helper calls are invalid inside these literals.
- The module must export `main`.

Also follow these authoring requirements even though they are not all statically checked:

- Import `defineMetadata` and `defineParams` from `@roxybrowser/sandbox`.
- Export an async `main`: either `export async function main(` or `export const main = async`.
- Read `process.env.BROWSER_URL` inside `main` and connect with `chromium.connect(...)` or `firefox.connect(...)`.
- Do not call `main` yourself; the sandbox invokes `main(params)`.

## Authoring Workflow

### Create Script

Use the current session's browser-operation records and user requirements to create the reusable script.

1. Understand the recorded intent and the user's requested behavior.
2. Identify runtime values that must become `params`.
3. Generate a descriptive slug from the script behavior.
4. Write the complete script to `library/scripts/<slug>.ts`.
5. If the script reads outside its workdir or calls `fetch`, write `library/scripts/<runtime-slug>.permissions.json`, using `defineMetadata.slug` when present and otherwise the script filename.
6. Inspect it with `roxy_script_describe`.
7. Run and debug the script with `roxy_script_run`.

### Edit Script

1. Read the existing script and understand its logic, metadata, params schema, outputs, and failure behavior.
2. Map the user's request to the smallest necessary change while preserving the script contract and sandbox boundaries.
3. Use `read_file`, `write_file`, or `edit_file` on the absolute library path; 
4. Inspect the updated script with `roxy_script_describe`.
5. Run and debug the updated script when possible.

### Run Existing Script Source

When the user provides an official script slug or an existing local script path, do not assume params from the user wording alone.

1. Keep an official slug unchanged, or resolve a local script to an absolute path.
2. Call `roxy_script_describe({ scriptPath })`.
3. Use the returned `metadata` to understand intent and the returned `paramsSchema` to build `params`.
4. Choose the correct browser `dirIds`; do not create a new browser unless the user asked for that.
5. Call `roxy_script_run({ scripts: [{ scriptPath, dirIds, params, debug }] })`. Each array item is an independent run specification; items run in parallel, while one item's `dirIds` still runs the same script and params in every listed window.

Both tools accept the same `scriptPath` forms:

- an official script slug supplied by the product
- a `ScriptFile` absolute path returned by `list_scripts`
- another readable absolute local path

### Stabilize Recorded Locators

Recorded operations often contain unstable placeholders. Replace every `aria-ref=`, `REPLACE_ME`, `UNSTABLE`, and `// FAILED:` marker with a stable locator.

Locator priority:

1. `data-testid` or other stable, non-localized attribute
2. role + accessible name
3. scoped visible text
4. stable CSS selector

Visible text and accessible names (priorities 2–3, and many `aria-label`s) are
**language-dependent** — most sites are multi-language, so a text-anchored
locator breaks under another language. Prefer language-independent anchors, or
pin the page to a known language after load before matching text. See
`references/debugging.md` → "Beware language-dependent anchors (i18n)".

## Inputs And Parameters

Pass every runtime-supplied value through the single `params` argument on `main`; do not hard-code per-run values such as URLs, keywords, counts, captions, ranges, or probabilities.

- Define a TypeScript interface for `params`.
- Declare the matching JSON Schema inline with `defineParams({...})`.
- The schema must be a static literal with `type: 'object'`, `properties`, useful `description` fields, and `required` when needed.
- A no-input script still needs `defineParams({ type: 'object', properties: {} })`.
- A no-input script may omit the `main` parameter: `export async function main(): Promise<void>`.

## Runtime Boundaries

The script runs in a VM sandbox. See `references/runtime.md` for full details.

### Forbidden

- No `XMLHttpRequest`, `net`, `http`, `https`, `dgram`, or other raw network modules.
- No arbitrary imports: imports are runtime-whitelisted.
- No arbitrary environment variables: only the listed `process.env` keys are available.

Use Playwright for page traffic. The following permissions govern filesystem access and `fetch`.

### Filesystem And Fetch Permissions

The sandbox injects the native Node `fs`, `node:fs`, `fs/promises`, and
`node:fs/promises` modules without rewriting methods. Node process permissions
are the filesystem boundary:

- `workdir/{slug}` is always readable and writable. Prefer relative paths based on `process.cwd()`.
- Every external read path must appear in `fs.read`; each value is passed directly as one `--allow-fs-read=<value>` argument.
- External writes are denied. Do not add `fs.write`; it is not supported.
- `fetch` is deny-by-default. `fetch.allow` accepts exact hostnames and `*.suffix` rules. A wildcard matches subdomains, not the suffix apex.
- Automatic fetch redirects are disabled. Handle a redirect only after confirming its destination hostname is also authorized.
- A missing sidecar is equivalent to empty `fs.read` and `fetch.allow` lists.

#### Permission Denial Signal

Treat the exact error `Access to this API has been restricted.` as a sandbox
permission denial. Inspect the failing operation before changing script logic:

- For file reads, confirm the path is inside the script workdir or covered by the sidecar's `fs.read` list.
- For file writes, keep the destination inside the script workdir; external writes cannot be authorized.
- For `fetch`, confirm the request hostname and every redirect destination are covered by `fetch.allow`.

Correct the path or permission sidecar, then rerun the script.

```jsonc
// library/scripts/<runtime-slug>.permissions.json
{
  "version": 1,
  "fs": {
    "read": [
      "/Users/foo/data/",
      "/abs/path/to/"
    ]
  },
  "fetch": {
    "allow": [
      "api.example.com",
      "*.googleapis.com"
    ]
  }
}
```

The sidecar is host-managed policy, not a script output; do not access it from inside `main`.

### Allowed Imports

Runtime-whitelisted imports:

- `playwright`
- `fs`, `node:fs`, `fs/promises`, `node:fs/promises`
- `path`, `url`, `crypto`, `buffer`, `stream` and their `node:` forms
- `@roxybrowser/sandbox`
- `@roxybrowser/sandbox/*` packages listed below

Any other import throws `Module not allowed`.

### Allowed Environment

`process.env` is limited to:

- `BROWSER_URL`
- `BROWSER_TYPE`
- `SANDBOX_DEBUG`

Any other key is not exposed and evaluates to `undefined`. Do not enumerate or depend on host environment variables.

## Built-In Capability Packages

Prefer sandbox packages over hand-rolled helpers. Full signatures are in `references/sandbox-api.d.ts`.

| Import | Tier | Gives you |
|--------|------|-----------|
| `@roxybrowser/sandbox/utils` | pure | `sleep`, `randomBetween`, `pick`, `maybe`, `chunk`, `retry` |
| `@roxybrowser/sandbox/human` | pure | `createHuman(page)` for explicit time-based interaction; motion uses duration + curve, pointer movement also uses a path; no action focuses, scrolls, or randomizes implicitly |
| `@roxybrowser/sandbox/2fa` | pure | `parse2FA`, `totp` for base32 2FA secrets |
| `@roxybrowser/sandbox/llm` | host | `ask` for text, `json` for structured output via JSON Schema |
| `@roxybrowser/sandbox/table` | host | `Table` CSV row store. Create a bucket with `new Table(name)`, then call instance methods: `append`, `all`, `find`, `clear` |
| `@roxybrowser/sandbox/kv` | host | `KV` JSON key-value store. Create a bucket with `new KV(name)`, then call instance methods: `get`, `set`, `has`, `delete`, and more |
| `@roxybrowser/sandbox/debug` | host | `getPageHtml` returns sanitized body HTML; `capturePageSnapshot` saves HTML and logs its absolute path under debug profile |

After creating a Human actor, keep pointer movement inside that actor. Mixing
direct `page.mouse` or Locator `hover`/`click` calls makes its tracked pointer
position stale; use explicit `human.move`/`hover`/`click` instead.

### Table And KV Buckets

`Table` and `KV` are classes. One instance is one persisted data bucket backed by one file in the script workdir:

- `new Table('likes')` creates or opens `likes.csv`.
- `new KV('youtube-state')` creates or opens `youtube-state.kv.json`.
- A script may own many buckets; instantiate each bucket when you need it.
- Call methods on the instance and `await` them.

Correct:

```typescript
import { Table } from '@roxybrowser/sandbox/table'
import { KV } from '@roxybrowser/sandbox/kv'

const records = new Table('youtube-actions')
await records.append({ videoId, action: 'like', at: Date.now() })

const state = new KV('youtube-state')
if (await state.has(videoId)) {
  console.log('video already processed')
}
await state.set(videoId, { liked: true, at: Date.now() })
```

Wrong:

```typescript
await Table.append({ videoId })
await KV.has(videoId)
```

## Output And Diagnostics

Use standard `console` methods. The sandbox routes them to the host run log.

- `console.log` / `console.info`: progress and important output you always want.
- `console.debug`: verbose diagnostics. It is a no-op under release.
- `console.error`: fatal failures. Include enough detail for the LLM to diagnose and fix the issue.
- `page.screenshot({ path: 'name.png' })`: optional visual artifact; keep the path relative so Playwright routes it to the browser artifact directory.

### Observability vs Persistence

- Logs, progress, and failure diagnostics go to `console`.
- Deliverable rows go to `Table`.
- Cross-run state goes to `KV`.

Before a `state.set(...)` or `records.append(...)`, ask: "Will something read this value later for its own sake?" If not, it belongs in `console`.

## When To Read More

| Read | When |
|------|------|
| `references/sandbox-api.d.ts` | You need exact signatures for `@roxybrowser/sandbox/*` packages |
| `references/runtime.md` | You need full globals, process, filesystem, env, import, or validator details |
| `references/control-flow.md` | You need loops, conditionals, wait ranges, human simulation, or branching patterns |
| `references/debugging.md` | A run fails or flakes, or you need instrumentation, snapshots, segmented runs, or live browser tools |
| `references/localization.md` | You need multi-language script self-description (`{ zh, us, ru }` metadata) |

## Example Index

Use examples as pattern references, not as copy-paste targets.

| Example | Pattern |
|---------|---------|
| `examples/amazon-03-paginated-scrape.md` | Paginated scraping into `Table`, breaking when the next page is missing |
| `examples/amazon-04-fallback-selector-hover.md` | Fallback selector chains, hover sequences, add-to-cart flow |
| `examples/facebook-02-viewport-aware-like.md` | Viewport-aware interaction with probability-based actions |
| `examples/facebook-03-language-and-groups-search.md` | Language detection/change plus keyword search and join flow |
| `examples/facebook-05-network-monitor-csv.md` | Network response monitoring, JSON extraction, CSV output |
| `examples/reddit-02-variable-driven-scroll.md` | Variable-driven scroll, backtrack behavior, viewport-based selection |
| `examples/twitter-02-retweet-with-confirm.md` | Hover, dropdown action, confirmation flow, compose follow-up |
| `examples/twitter-03-index-segment-action.md` | Index-segmented action decisions over feed items |
| `examples/twitter-04-dialog-or-inline-reply.md` | Branching between dialog and inline reply composers |
| `examples/walmart-01-responsive-multi-exit.md` | Responsive sign-in/sign-up flow with multiple early exits |
