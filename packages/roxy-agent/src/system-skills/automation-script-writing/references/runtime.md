# Runtime Environment (deep reference)

The script runs inside a `vm.SourceTextModule` sandbox — a curated subset of
Node, not the real thing. The Runtime Boundaries section in `SKILL.md` has the
red lines; this file is the full detail and runtime source of truth.

## Contents

- Script sources and pre-run checks
- Injected globals and the curated `process`
- Environment and import whitelists
- Filesystem, fetch, and browser artifact paths
- Runtime enforcement boundaries

## Script sources before runtime

`roxy_script_describe` and `roxy_script_run` accept the same source forms:

- an official script slug
- a readable absolute local path

For an official slug, `roxy_script_describe` reads metadata and the
params schema from the backend detail API. `roxy_script_run` resolves the same slug,
verifies the official script, and executes its local copy.

For a local path, the pre-run source check requires static top-level
`defineMetadata({...})`, static top-level `defineParams({...})`, and an exported
`main(params)` entry point. Official downloads receive the same source checks
before execution.

## Injected globals (no import)

- **`console`** — standard API, routed to the host. `console.debug` is a **no-op
  under the release profile** (default); it emits only under `debug`.
- **`process`** — a curated subset (see below).
- **Timers** — `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`.
- **Built-ins** — `Buffer`, `URL`, `URLSearchParams`, `TextEncoder`,
  `TextDecoder`, `Error`/`TypeError`/`RangeError`, `Promise`, `JSON`, `Math`,
  `Date`, `parseInt`, `parseFloat`, `isNaN`, `isFinite`, the `encode*/decode*`
  URI fns, `Object`, `Array`, `Map`, `Set`, `WeakMap`, `WeakSet`, `Symbol`,
  `RegExp`, the typed arrays, `ArrayBuffer`, `SharedArrayBuffer`, `DataView`.
- **`fetch`** — available with hostname checks from the script permission sidecar; automatic redirects are disabled.
- **Disabled**: `XMLHttpRequest` is `undefined`.

## `process` subset

- `cwd()` → the real script work directory: `workdir/{slug}/` (not `/`, not the
  agent's workspace). `slug` comes from `defineMetadata.slug` when non-empty and
  otherwise falls back to the script filename without its extension. Base for
  relative paths.
- `exit(code)` → safe: flushes collected artifacts, then exits.
- `env` → only the whitelisted keys (below); reading anything else returns
  `undefined`.
- Everything else is either a safe read-only passthrough (`platform`, `arch`,
  `version(s)`, `hrtime`, `stdout`/`stderr`, the event API, …) or a neutralized
  no-op (`kill`, `send`, `chdir`, `binding`, …). Do not rely on process control.

## Environment variables (whitelist)

| Key | Meaning |
|-----|---------|
| `BROWSER_URL` | preferred WS endpoint (chromium & firefox via `.connect()`) |
| `BROWSER_TYPE` | `'chromium'` (default) or `'firefox'` |
| `SANDBOX_DEBUG` | `'1'` under debug profile, otherwise `'0'` |


## Imports (whitelist — runtime-enforced)

Allowed: `playwright`; `fs`, `fs/promises` and their `node:` forms; `path`, `url`, `crypto`, `buffer`,
`stream` (each also as `node:` form); the root `@roxybrowser/sandbox`
(the `defineMetadata`/`defineParams` self-describing macros); and the capability
packages `@roxybrowser/sandbox/{utils,human,2fa,llm,table,kv,debug}`
(signatures in `sandbox-api.d.ts`). Any other specifier throws `Module not allowed`
at runtime.

`@roxybrowser/sandbox/download` is still whitelisted for legacy scripts but is
deprecated and intentionally omitted from the current API reference.

Blocked: `child_process`, `worker_threads`, `net`, `http`, `https`, `os`, `vm`, `dgram`.
The import whitelist is enforced by the module linker, **not** the static validator.

## Filesystem and fetch permissions

The linker exposes native Node `fs` modules. Their methods are not wrapped;
filesystem access is enforced by the sandbox child process's Node permission
flags. `workdir/{slug}` is always readable and writable. Paths outside it are
deny-by-default and may only be read when listed in
`library/scripts/{runtime-slug}.permissions.json` under `fs.read`. The runtime
slug is `defineMetadata.slug` when present, otherwise the script filename.
External writes are
not supported.

The same sidecar contains `fetch.allow`. Exact hostnames and `*.suffix` rules
are supported. The injected `fetch` rejects unlisted hosts and non-HTTP(S)
protocols, and uses `redirect: 'manual'` so an allowed host cannot redirect to
an unlisted one.

`Table` and `KV` remain preferred for structured persistent data because they
handle CSV/JSON serialization. For arbitrary bytes and file formats, use native
`fs` under `process.cwd()`.

Playwright owns browser artifact paths. In particular,
`page.screenshot({ path: 'result.png' })` uses the host-configured screenshot
root and lands under `workdir/{slug}/browser/{yyyy-mm-dd}/`. Keep the path
relative. Do not build it from `process.cwd()` and do not try to read the
host-only Playwright directory environment variables.

Example sidecar:

```json
{
  "version": 1,
  "fs": { "read": ["/absolute/input/directory/"] },
  "fetch": { "allow": ["api.example.com", "*.googleapis.com"] }
}
```

## Runtime enforcement

The pre-run source checks (parseable TypeScript, static top-level
`defineMetadata`/`defineParams`, exported `main`) are covered in `SKILL.md`. At
runtime, the sandbox linker rejects imports outside the whitelist, Node
permission flags reject unauthorized filesystem access, and the injected
`fetch` rejects unauthorized hosts and redirects. Locator quality, connection
style, and other authoring rules are not a separate validator pass; inspect
them while editing and confirm behavior with a debug run.
