# Architecture Overview

<!-- Updated: 2026-08-14 | High-level codemap; source code and package docs remain authoritative -->

## Project Shape

RoxyBrowser is an Electron anti-detect/fingerprint browser with an embedded AI Agent. It is a pnpm + Turbo monorepo with **6 apps, 14 packages, and 1 workspace tool**.

```text
Vue product UI
  <-> typed preload IPC
Electron main process
  ├── browser/profile lifecycle (Puppeteer + Chrome/Firefox)
  ├── local App Server + RoxyBrowser OpenAPI server
  ├── roxynet/sync/updater/native integrations
  └── utilityProcess.fork(roxy-agent)
         ├── HTTP CRUD + /api/events WebSocket + tasks + RoxyClaw
         ├── product tools, persistence, sandbox host and MCP assembly
         └── roxy-agent-runtime
                ├── provider-neutral agent loop
                ├── tools, memory, compaction, HITL and clarification
                └── plugins, MCP adapters, skills and named subagent tree

Separate deployable feature:
cloud-browser-user -> cloud-browser-gateway -> Docker/neko -> RoxyChrome
```

## Workspace Boundaries

### Apps (6)

- `apps/electron` (`roxybrowserdev`): Desktop main process, browser lifecycle, IPC, local services, Agent lifecycle, updates and packaging.
- `apps/web` (`web`): Vue 3 product SPA plus standalone multi-page tools such as Agent Inspect.
- `apps/preload` (`@roxy/electron-preload`): Typed bridge exposed as `window.electronAPI`.
- `apps/tauri` (`tauri`): Experimental Rust/Tauri launcher for RoxyChrome and RoxyFirefox.
- `apps/cloud-browser-gateway` (`@roxy/cloud-browser-gateway`): NestJS service that authenticates users, prepares profiles, provisions Docker/neko containers, tracks sessions in Redis and connects to the browser over Puppeteer/CDP.
- `apps/cloud-browser-user` (`@roxy/cloud-browser-user`): Vue/neko client that renders and controls the remote browser over WebRTC.

### Packages (14)

**Agent and distribution**

- `roxy-agent`: Shipped product host. Owns HTTP/WebSocket transport, RoxyBrowser APIs, tasks, persistence, MCP assembly, browser subagents, sandbox hosting and RoxyClaw/IM integrations.
- `roxy-agent-runtime`: Private generic Agent framework used by `roxy-agent` in production. Owns the agent loop, public contracts, providers, tools, memory, HITL, clarification, plugins, replay and subagent tree.
- `roxy-skills`: Builds distributable Agent skill archives.

**Generated clients**

- `@roxy/backend-api`: Main product backend client; regenerate with `pnpm openapi`.
- `@roxy/agent-api`: Agent backend client for model metadata, templates, tasks, files and related APIs; regenerate with `pnpm openapi:agent`.

**Shared, native and security**

- `@roxy/shared`: Cross-app types/utilities. `@roxy/shared/channel` owns Agent WebSocket Zod schemas; `@roxy/shared/agent-paths` owns the Agent data-directory schema.
- `@roxy/crypto`: AES-256-GCM WebAssembly implementation used by Electron, web and cloud gateway.
- `@roxy/diskspace-native`: napi-rs/Rust Windows disk-space module.
- `@repo/node-typesafe-worker-messages`: Typed Node worker-thread messaging.

**Build and localization**

- `gen-primevue-preset`: Figma plugin that generates PrimeVue presets.
- `@roxy/vite-plugins` / `@roxy/webpack-plugins`: Internal build plugins.
- `@roxy/language-localization`: Locale generation and auto-translation tooling.
- `@roxy/puppeteer-google-translate`: Translation scraper used by localization tooling.

**Workspace tool**

- `tools/delay-launcher` (`@roxy/delay-launcher`): Platform-specific delayed launcher used by desktop packaging/default-browser flows.

`@roxybrowser/openapi` and `@roxybrowser/playwright` are npm dependencies of `roxy-agent`, not workspace packages. Sandbox capability implementations now live in `roxy-agent/src/modes/sandbox-api/`; there is no `packages/roxy-sandbox`.

## Agent Architecture

### Ownership Split

`roxy-agent-runtime` is the engine, not a future replacement. `roxy-agent` injects all product-specific dependencies into it:

```text
roxy-agent
  constructs provider + ToolRegistry + memory + rollout store + plugins
  registers product/MCP/script/subagent tools
  creates AgentManager and browser_worker spec
  -> AgentRuntime.create(AgentDefinition)
```

- Runtime never reads product env, selects RoxyBrowser models, scans product directories or knows HTTP/WebSocket DTOs.
- Product host converts runtime events into canonical `conversation.run.event` messages and persists frontend replay data.
- Root and browser child agents run in the same Agent process. Children have isolated runtime sessions, memory, Playwright MCP clients, browser scopes and `agentPath` lifecycle events.
- Current modes are only `agent` and `sandbox`. RoxyClaw runs inside `agent`; browser workers are runtime subagents, not subprocess modes.

### MCP and Model Flow

- RoxyBrowser OpenAPI MCP: shared in-process server/client using `InMemoryTransport`.
- Playwright MCP: in-process client per root/child browser worker, with isolated artifact and browser scope.
- User MCP: configurable stdio or Streamable HTTP connections through runtime adapters.
- Model metadata comes from the Agent backend; shipped conversations use `OpenAIResponsesProvider` against `/llm-proxy/v1`.

## Main Data Flows

```text
Product operation:
Vue -> preload IPC -> Electron handler -> BrowserManager -> Puppeteer -> Chrome/Firefox

Agent conversation:
Vue HTTP CRUD -------------------------------> roxy-agent services/storage
Vue /api/events command -> shared Zod schema -> roxy-agent -> AgentRuntime
provider stream -> runtime events -> canonical run events -> /api/events -> Vue
browser tool -> AgentManager child -> per-worker Playwright MCP -> browser profile

Cloud browser:
web client -> gateway connect/heartbeat -> backend auth + Redis session
           -> Docker/neko container -> WebRTC remote browser client
```

## Version Baseline

- Root: pnpm >= 10.18.3, Node >= 22.20, Turbo 2.10, TypeScript 6.0, Vite 8.1.
- Desktop: Electron 40.10, Puppeteer Core 24.36.
- Web: Vue 3.5, Vue Router 5.2, Pinia 4, PrimeVue 4.5, UnoCSS 66.
- Runtime package: Node >= 24, provider/MCP SDKs, Vitest + mandatory TDD.

## Authoritative Detail

- Frontend: `.reports/codemaps/frontend.md`
- Electron/embedded services: `.reports/codemaps/backend.md`
- Storage: `.reports/codemaps/data.md`
- Integrations/dependencies: `.reports/codemaps/dependencies.md`
- Shipped Agent host: `packages/roxy-agent/CLAUDE.md`
- Generic runtime: `packages/roxy-agent-runtime/ARCHITECTURE.md` and `AGENTS.md`
