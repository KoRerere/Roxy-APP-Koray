# CLAUDE.md

Guidance for Claude Code when working in `packages/roxy-sandbox` (`@roxy/sandbox`).

> **`README.md` is the API-surface reference** (per-subpath manifest, cost tiers,
> usage sketch, host-wiring notes). This file covers what the README does not:
> build/verify, the current wiring state, and the cross-package contract. Read
> both.

## What it is

Agent-friendly **capability modules** exposed to RoxyBrowser automation scripts
that run inside the agent's sandbox VM. One namespace: a **root** self-describing
macro export plus eight cost-tiered capability subpaths:

| Subpath | Tier | Exports |
|---|---|---|
| `.` (root) | macro | `defineMetadata`, `defineOptions` — inline self-describing macros (identity at runtime; host extracts their args to build script metadata + options JSON Schema) |
| `/utils` | pure | `sleep`, `randomBetween`, `pick`, `maybe`, `chunk`, `retry` |
| `/human` | pure | `createHuman` (stateful explicit motion actor: duration + curve, pointer path where applicable); deprecated wrappers |
| `/2fa` | pure | `parse2FA`, `totp` — parse a base32 2FA secret into current TOTP |
| `/llm`   | host | `ask` (text), `json` (JSON-Schema structured) — **definition + forward only**, host implements `LlmTransport` |
| `/table` | host | `Table` class (CSV-backed, in-memory + async write-through) |
| `/kv`    | host | `KV` class (JSON-backed, in-memory + async write-through) |
| `/debug` | host | `getPageHtml`, `capturePageSnapshot` (sanitized body-DOM inspection + debug-only HTML persistence/path logging) |
| `/download` | deprecated | `saveResource`, `saveResources`, `saveDownload` — compatibility only; use browser APIs + Node `fs` |

This package holds the **public API surface + types** only; the real host-backed
impls (`/table` `/kv` `/debug` `/download` file I/O and `/llm` transport) run **host-side** in the
agent process, so their `node:fs` is the real fs — that is what lets scripts persist
independently from the VM module linker.

## Build & verify

```bash
pnpm build      # vite lib build → dist/{index,utils,human,2fa,llm,table,kv,debug,download}/... index.{mjs,js} + .d.ts
pnpm dev        # vite build --watch
```

- Vite lib mode, **9 entries × 2 formats** (es `.mjs` + cjs `.js`): the root `index`
  plus one per subpath (see `vite.config.ts`). Each maps to a `package.json` `exports` entry.
- `node`, all `node:*` builtins, and `playwright` are **externalized** — this package
  is effectively zero-dependency. `/human` types a minimal structural `HumanPage`
  instead of importing Playwright.
- No test framework here; correctness is by types + the consuming agent.

## Gotchas

- **Two names, deliberately.** The workspace package is `@roxy/sandbox`, but scripts
  import from **`@roxybrowser/sandbox/*`**. That public specifier is not resolved by
  node — the sandbox linker in `roxy-agent/src/modes/sandbox.ts` maps it to a
  host-injected `vm.SyntheticModule` whose value comes from `@roxy/sandbox/*`. Keep
  both prefixes aligned when adding/renaming subpaths.
- **Already wired into roxy-agent.** `roxy-agent` depends on `@roxy/sandbox`
  (`workspace:*`) and `modes/sandbox.ts` imports & injects all subpaths. (The
  README's "not wired in yet / Host wiring later" note is historical — ignore it;
  wiring is done.)
- **`__`-prefixed exports are host-only.** `__setStorageDir` (`/table`, `/kv`),
  `__setLlmTransport` (`/llm`) and `__configureDebug` (`/debug`) are
  called by the host during sandbox setup and stripped from the script-visible
  surface via `publicExports()`. Never document them as script APIs.
- **Node `fs` is injected directly.** The VM receives `fs`, `node:fs`, `fs/promises`,
  and `node:fs/promises` without method rewriting. The sandbox child process enforces
  read/write access through Node's `--permission` flags. `/download` is deprecated.
- **Constructors load async.** `new Table(name)` / `new KV(name)` return immediately;
  the first method call awaits a ready latch. Every method is async.

## Cross-package contract (adding/changing a subpath)

Adding a capability means touching **four** places, in order:

1. `src/<name>/index.ts` — implement; keep the surface tiny and idiomatic; any
   host-injected state goes behind a `__set*` setter excluded from `publicExports()`.
2. `package.json` `exports` + `vite.config.ts` `lib.entry` — register the subpath.
3. `roxy-agent/src/modes/sandbox.ts` — import `@roxy/sandbox/<name>`, do host assembly
  (`__set*`), inject under the `@roxybrowser/sandbox/<name>` specifier.
4. If the local tree has sandbox globals or script import allow-lists, update them
   so the writing agent and validator accept the new import.

Rebuild the package (and re-run `pnpm agent:build` in roxy-agent) after changes.
