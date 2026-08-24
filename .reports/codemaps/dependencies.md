# Dependencies and Integrations

<!-- Updated: 2026-08-14 | Focuses on architectural dependencies rather than exhaustive package.json contents -->

## Product Backends

### Main Backend (`@roxy/backend-api`)

- Generated axios client for users, workspaces, browser profiles, proxies, extensions, subscription/payment and cloud-browser product APIs.
- Desktop/web requests use the current gateway/base URL and product token/workspace headers.
- Regenerate with `pnpm openapi`.

### Agent Backend (`@roxy/agent-api`)

- Generated client used by `roxy-agent` and Agent Console for model metadata, templates, tasks, files and Agent-specific product APIs.
- `roxy-agent/src/api/agentApiClient.ts` adds Agent authentication, workspace, language and version headers.
- Regenerate with `pnpm openapi:agent`.

### LLM Proxy

- Shipped conversation traffic goes through `${ROXY_SERVER_URL}/llm-proxy/v1`; model/provider metadata is fetched at runtime, not configured by `LLM_PROVIDER/LLM_MODEL/LLM_API_KEY` env variables.
- Current product composition uses `roxy-agent-runtime`'s `OpenAIResponsesProvider`. The runtime also provides Anthropic, DeepSeek-compatible and deterministic fake providers for other hosts/tests.
- Provider streams terminate inside `roxy-agent`, which emits provider-neutral canonical WebSocket events to the web UI.

## Agent Framework Integration

`roxy-agent` depends on `roxy-agent-runtime` as its production engine:

- Runtime contracts: provider, canonical transcript/content blocks, tools, memory, HITL, clarification, plugins, session store and subagent manager.
- Product host supplies Roxy prompts, backend/model resolution, filesystem policy, browser scope, event publishing, metrics, persistence and product tools.
- Runtime core does not depend on LangChain. The former deepagents/LangChain implementation is no longer the current architecture.

### Runtime Libraries

- `openai`: OpenAI/DeepSeek Responses provider.
- `@anthropic-ai/sdk`: Anthropic Messages provider and token APIs.
- `@modelcontextprotocol/sdk`: MCP stdio/StreamableHTTP and in-memory transports.
- `zod`: Tool inputs, shared boundary schemas and adapter validation.
- `js-yaml`: SKILL.md frontmatter and private CLI configuration.
- Node 24 built-ins: filesystem/process primitives and `node:sqlite` where needed.

`roxy-agent-runtime` enforces Vitest Red -> Green TDD and uses oxlint/oxfmt. It explicitly forbids pino, winston and reflect-metadata inside the framework package.

## MCP Integrations

### Built-in RoxyBrowser OpenAPI MCP

- Dependency: `@roxybrowser/openapi` from npm.
- Runs in-process inside `roxy-agent` with a linked `InMemoryTransport` pair.
- Calls Electron's local RoxyBrowser OpenAPI using `ROXY_API_HOST` and `ROXY_API_KEY`.
- Provides product/profile/control-plane tools.

### Built-in Playwright MCP

- Dependency: `@roxybrowser/playwright` from npm.
- Runs in-process; one client is created per root/child browser worker.
- Each client receives an isolated browser scope, worker ID and session artifact directory.
- No `PLAYWRIGHT_SCRIPT_PATH`, `OPENAPI_SCRIPT_PATH` or built-in MCP stdio subprocess is required.

### User MCP Servers

- Configured through Agent Console and stored under Agent `state/mcp/`.
- Runtime adapters support stdio and Streamable HTTP servers, with enable/disable/test/import flows exposed by `roxy-agent` HTTP routes.

```text
Agent ToolRegistry
  ├── runtime built-ins
  ├── product/script/subagent tools
  ├── shared OpenAPI MCP tools
  ├── per-worker Playwright MCP tools
  └── enabled user MCP tools
```

## Sandbox and Skills

- Sandbox scripts run in a recyclable child-process host with per-run `node:vm` isolation.
- Compatibility imports use `@roxybrowser/sandbox/*`, but implementations are internal to `roxy-agent/src/modes/sandbox-api/`; there is no workspace `@roxy/sandbox` package.
- LLM capability calls are proxied to the main Agent process so the sandbox host does not own model credentials.
- Skill archives are built by `roxy-skills`; runtime `SkillRegistry` handles SKILL.md scanning/catalog/selection primitives while `roxy-agent` owns product directories and remote template installation.

## Desktop and Browser Integrations

- Electron 40.10 + electron-builder/electron-updater: desktop runtime, packaging and updates.
- Puppeteer Core 24.36: Chrome control in Electron; Firefox uses the repository's BiDi/process wrapper for bootstrap and profile work.
- `chrome-remote-interface` and WebDriver BiDi protocol types: lower-level browser connections.
- `roxynet` / `roxysync`: separately updated native binaries with bundled seed repair and background update flows.
- `@roxy/diskspace-native`: Windows disk-space queries.
- `@roxy/crypto`: shared WebAssembly AES-256-GCM initialization for desktop/web/gateway security flows.

## Cloud Browser

### Gateway

- NestJS 11 + Swagger + class-validator: API and validation.
- Dockerode: lifecycle of per-user/per-profile neko containers.
- ioredis: session/container mappings and port allocation.
- Puppeteer Core 24.40: connects to the containerized RoxyChrome instance for profile/cookie lifecycle.
- neko + WebRTC: remote display/input transport; containers use host networking with dedicated HTTP/UDP ports.
- Optional NVIDIA device mounting/NVENC; CPU admission and per-container limits are configuration driven.

The current gateway returns direct neko connection information. The old planned `proxy/` module and gateway-proxied `/ws` design are not present in the current source tree.

### Client

- Vue 3 + Pinia + neko protocol client.
- Renders remote video/audio, sends keyboard/mouse/control events and mirrors neko heartbeat to the gateway session heartbeat endpoint.

## Web Integrations

- Vue 3.5, Vue Router 5.2, Pinia 4 and PrimeVue 4.5.
- UnoCSS 66, Sass, Motion-v and CodeMirror/Tiptap for UI/editor surfaces.
- Axios for HTTP; Zod for Agent channel runtime validation.
- Sentry for error reporting, Mixpanel for analytics, Stripe for payment and LiveChat for support.
- `@roxy/crypto` is also consumed by web flows that need shared encryption behavior.

## Build and Distribution

- pnpm workspaces + Turbo orchestrate build/lint/dev dependencies.
- Vite 8 builds web, Electron ESM and runtime packages; Webpack produces the distributed/obfuscated Agent and Electron bundles where configured.
- Agent artifact and skill archives are uploaded to OSS independently of desktop app updates.
- `@roxy/vite-plugins` and `@roxy/webpack-plugins` own internal transforms/upload packaging behavior.
- `tools/delay-launcher` participates in platform-specific desktop launcher packaging.

## Version Baseline

- pnpm >= 10.18.3; root Node >= 22.20; runtime Node >= 24.
- TypeScript 6.0.3, Vite 8.1, Turbo 2.10, Webpack 5.
- Electron 40.10, Vue 3.5, PrimeVue 4.5, Puppeteer 24.x.

## Key Configuration

- `pnpm-workspace.yaml`: Workspace/package and catalog definitions.
- `turbo.json`: Task graph and cache outputs.
- `apps/electron/src/modules/mcp/index.ts`: Agent environment/lifecycle.
- `packages/roxy-agent/src/runtime/provider.ts`: Product model/provider construction.
- `packages/roxy-agent/src/core/mcp/`: Built-in and user MCP assembly.
- `apps/cloud-browser-gateway/src/config/configuration.ts`: Required gateway/container/WebRTC settings.
