# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and all AI agents when working with code in this repository.

## 语言规范 (Language Requirement)

**所有 AI Agent 在回答问题、编写实施计划、生成文档、编写注释及与用户交互时，必须统一使用中文。**

## 前端 CSS/CSS 框架规范 (CSS Requirement)

**前端 Vue/HTML 页面及组件在编写样式时，应优先并尽量使用 UnoCSS 工具类类名，避免编写不必要的自定义 CSS/SCSS 样式块。**

## Project Overview

RoxyBrowser is an Electron-based **anti-detect / fingerprint browser** with a built-in AI agent that operates browser profiles through MCP. It is a pnpm + Turbo monorepo with **6 apps, 14 top-level packages, and 1 workspace tool**.

## 开始工作前必读

**在开始任何需求或任务之前，请先阅读 `.reports/codemaps/` 目录下的架构文档：**

- `architecture.md` - 系统整体架构、服务边界、数据流
- `backend.md` - Electron 主进程、核心模块、IPC 通信
- `frontend.md` - Vue 3 前端、路由、状态管理
- `data.md` - 数据存储、浏览器配置文件、Cookie 管理
- `dependencies.md` - 外部服务、AI 集成、第三方库

这些 codemaps 是高层地图，可能落后于快速演进的 Agent 代码。包清单、Agent 架构和执行模式以本文件、实际源码和子包文档为准。

处理 Agent 相关代码时还必须阅读：

- `packages/roxy-agent/CLAUDE.md` - 已发布 Agent 应用层的权威说明
- `packages/roxy-agent-runtime/AGENTS.md` - Runtime 强制 TDD 和编码约束
- `packages/roxy-agent-runtime/ARCHITECTURE.md` - Runtime 模块边界和实现状态
- `packages/roxy-agent-runtime/CLAUDE.md` - Runtime 工作指导

## Development Commands

### Initial Setup

```bash
pnpm install                    # Install dependencies and build packages
pnpm genLanguage                # Generate web i18n language files
pnpm openapi                    # Regenerate @roxy/backend-api
pnpm openapi:agent              # Regenerate @roxy/agent-api
```

### Development

```bash
pnpm dev                        # Start Electron + renderer with hot reload
pnpm dev:web                    # Start the web renderer only
pnpm dev:pkg                    # Run package dev scripts where available
pnpm dev:p                      # Turbo parallel dev mode
```

### Building

```bash
pnpm build                      # Build apps/packages through Turbo
pnpm build:pkg                  # Build workspace packages only
pnpm pack:dev                   # Build and package the Electron app (dev)
pnpm pack:prod                  # Build and package the Electron app (prod)
```

### Agent Distribution

```bash
pnpm agent:build                # Build roxy-agent and zip roxy-skills
pnpm publish:agent:dev          # Build and upload Agent artifacts to dev OSS
pnpm publish:agent:prod         # Build and upload Agent artifacts to prod OSS
```

### Linting and Testing

```bash
pnpm lint
pnpm lint:fix

pnpm -F roxy-agent-runtime test
pnpm -F roxy-agent-runtime typecheck
pnpm -F roxy-agent-runtime lint

pnpm -F roxy-agent exec vitest run
pnpm -F roxy-agent exec tsc --noEmit
```

The root `pnpm test` script still points to the missing `scripts/test.ts`, so there is no working repo-wide test command. `roxy-agent-runtime` has a mandatory Red -> Green TDD workflow. `roxy-agent` also has a substantial co-located Vitest suite even though its package does not define a `test` script.

### Utilities

```bash
pnpm clean:cache                # Clear Vite-related caches
pnpm reinstall                  # Remove lockfile and node_modules
pnpm install:electron           # Manually install Electron with proxy enabled
pnpm test:crypto                # Verify @roxy/crypto source and dist behavior
```

## Architecture

### Monorepo Structure

**Apps (6):**

- `apps/electron` (`roxybrowserdev`): Main Electron process, desktop shell, IPC, browser management, Agent lifecycle, updater, and packaging
- `apps/web` (`web`): Vue 3 + PrimeVue renderer SPA and web-published product UI
- `apps/preload` (`@roxy/electron-preload`): Typed IPC bridge exposed as `window.electronAPI`
- `apps/tauri` (`tauri`): Experimental Rust/Tauri launcher for RoxyChrome and RoxyFirefox
- `apps/cloud-browser-gateway` (`@roxy/cloud-browser-gateway`): NestJS cloud-browser control plane for auth, Docker/neko lifecycle, Redis, WebSocket, and proxying
- `apps/cloud-browser-user` (`@roxy/cloud-browser-user`): Vue/neko WebRTC client for remote cloud-browser sessions

**Packages (14):**

*Agent and distribution*

- `packages/roxy-agent` (`roxy-agent`): The shipped Agent application/integration layer. It owns HTTP/WebSocket transport, RoxyBrowser APIs, tasks, IM/RoxyClaw, MCP wiring, persistence, sandbox hosting, and product-specific prompts/tools. It consumes `roxy-agent-runtime` as its engine.
- `packages/roxy-agent-runtime` (`roxy-agent-runtime`): Private, provider-abstracted TypeScript Agent framework used by `roxy-agent` in production. It owns the agent loop, public contracts, providers, tools, HITL, clarification, memory, rollout replay, plugins, MCP adapters, skills primitives, and the named subagent tree.
- `packages/roxy-skills` (`roxy-skills`): Builds distributable Agent skill archives.

*API clients*

- `packages/backend-api` (`@roxy/backend-api`): Generated client for the main product backend; regenerate with `pnpm openapi`
- `packages/agent-api` (`@roxy/agent-api`): Generated client for Agent backend endpoints such as model configuration, templates, tasks, and files; regenerate with `pnpm openapi:agent`

*Shared, native, and security*

- `packages/roxy-shared` (`@roxy/shared`): Cross-app types/utilities. `@roxy/shared/channel` is the Zod source of truth for Agent WebSocket messages; `@roxy/shared/agent-paths` owns the Agent data-directory schema.
- `packages/roxy-crypto` (`@roxy/crypto`): AES-256-GCM implementation backed by WebAssembly, used by Electron, web, and the cloud gateway
- `packages/diskspace-native` (`@roxy/diskspace-native`): napi-rs/Rust Windows disk-space query module
- `packages/node-typesafe-worker-messages` (`@repo/node-typesafe-worker-messages`): Typed Node worker-thread messaging helpers

*Build and localization*

- `packages/gen-primevue-preset` (`gen-primevue-preset`): Figma plugin that generates PrimeVue theme presets
- `packages/vite-plugins` (`@roxy/vite-plugins`): Internal Vite plugins
- `packages/webpack-plugins` (`@roxy/webpack-plugins`): Internal Webpack plugins
- `packages/language-localization` (`@roxy/language-localization`): i18n generation and auto-translation tooling
- `packages/puppeteer-google-translate` (`@roxy/puppeteer-google-translate`): Puppeteer-based Google Translate scraper used by localization tooling

**Workspace tool:**

- `tools/delay-launcher` (`@roxy/delay-launcher`): Builds the platform-specific delayed launcher used by the desktop packaging flow

`@roxybrowser/openapi` and `@roxybrowser/playwright` are now normal npm dependencies of `roxy-agent`; there are no `packages/roxy-openapi` or `packages/roxy-playwright` workspace packages. The former `packages/roxy-sandbox` package was also removed: sandbox capability implementations now live inside `packages/roxy-agent/src/modes/sandbox-api/`.

### Electron Main Process

**Initialization flow** (`apps/electron/src/modules/index.ts`):

1. Create/validate the temp directory and wait for `app.whenReady()`
2. Initialize `@roxy/crypto`, then load local configuration
3. Install a pending app update early when required
4. Start the internal app server and clean stale roxynet/updater processes
5. Initialize store watchers and the desktop app/window/tray layer
6. Start RoxyClaw if configured, check resource updates, and start binary updaters
7. In `finally`, repair binary seeds, start roxynet, trigger the first update check, restore prior windows, and clean old browser instances

**Core modules** (`apps/electron/src/modules/`):

- `app/`: Main window, tray, auto-start, proxy manager
- `browser/`: Puppeteer-based browser/profile lifecycle and fingerprinting
- `ipc/`: IPC receivers and renderer event senders
- `appServer/`: Internal Express service for packaged UI and logs
- `mcp/`: Shipped Agent process lifecycle and Agent Console window integration
- `openapi/`: Local RoxyBrowser control API consumed by MCP
- `roxynet/`: Proxy network service
- `sync-control/`: Profile synchronization
- `updater/`: App, resource, binary, and Agent update flows

### IPC Communication

The preload bridge exposes `window.electronAPI`. IPC types live in `apps/preload/src/types/renderMessage.ts`, renderer methods in `apps/preload/src/ipcRenderer.ts`, and main-process handlers under `apps/electron/src/modules/ipc/receiver/modules/`.

When adding a new renderer-to-main capability:

1. Add the typed channel contract in `renderMessage.ts`
2. Implement/register the main-process handler
3. Expose the renderer API through preload
4. Add a version capability helper in `apps/web/src/utils/app-supports.ts`
5. Guard all new renderer calls because the hot-updated web UI can run against an older Electron binary

### Vue 3 Frontend

- Entry: `apps/web/src/main.ts`; detects Electron versus web mode before mounting
- Router: `apps/web/src/router/`; token, workspace-type, role, and permission guards
- State: Pinia stores under `apps/web/src/stores/`, including user, workspace, permission, locale, theme, agent, proxy, team, project, lock, and network state
- UI: PrimeVue 4 + UnoCSS + Sass, with product components under `apps/web/src/components/`
- Agent Console: communicates with the embedded Agent over HTTP CRUD plus the shared `/api/events` WebSocket protocol

### AI Agent Stack

The current Agent stack has two ownership layers:

```
Electron utilityProcess
  -> roxy-agent (product host/application layer)
       -> roxy-agent-runtime (generic framework/agent loop)
            -> providers + tools + memory + HITL + subagents
       -> RoxyBrowser MCP + tasks + sandbox + IM + persistence + WebSocket
```

#### `packages/roxy-agent`

The old deepagents/LangChain implementation and `src/deepagents/` layout are gone. Current code is organized around:

- `src/runtime/`: Product assembly of `AgentRuntime`, providers, prompts, event publishing, filesystem middleware, file collection, script tools, and browser subagents
- `src/core/`: WebSocket/run events, MCP clients, profile scheduling, storage, registries, task monitor, sandbox internals, and skill metadata
- `src/services/`: Chat, files, tasks, templates, sandbox host/service, metrics, and artifacts
- `src/tasks/`: Backend task synchronization, timers, leases, and script/Agent executors
- `src/im/`: Feishu, Telegram, Discord, and Weixin adapters; RoxyClaw runs in the same main Agent process
- `src/modes/`: Only `agent` and `sandbox`

**Execution modes:**

- `agent` (default): Starts the Express/HTTP server, `/api/events` WebSocket, task scheduler, and optional RoxyClaw adapters
- `sandbox`: Runs the long-lived Sandbox Host used by the main Agent process for run-scoped `node:vm` sessions

There is no standalone `im` mode and no standalone browser `worker` mode. Browser subagents run in-process as isolated `AgentRuntime` children managed by `AgentManager`.

**Conversation execution:**

- `createRuntimeChatAgent()` builds a `ToolRegistry`, root `AgentRuntime`, `AgentManager`, HITL/clarification handlers, in-memory live memory, rollout store, plugins, and MCP tools.
- The currently shipped model path uses `OpenAIResponsesProvider` against `${ROXY_SERVER_URL}/llm-proxy/v1`. Model metadata is fetched at runtime through `agentModelApi.getUserModel()` and cached per user/workspace.
- The root agent has built-in filesystem/shell/todo/clarification tools, Roxy script tools, MCP tools, and `spawn_agent` / `list_agents` / `wait_agent`.
- Browser subagents use the registered `browser_worker` spec. Each child has its own runtime session, memory, browser scope, Playwright MCP client, event `agentPath`, and cleanup lifecycle.
- The old `parallel_dispatch`, `run_worker`, Simple/Orchestrator mode selection, and worker subprocess protocol have been removed.

**Transport:**

- Conversation metadata and files use HTTP CRUD routes.
- User run commands and all live conversation/task/task-monitor events use the bidirectional `/api/events` WebSocket.
- Both Agent and web validate envelopes with Zod schemas from `@roxy/shared/channel`.
- Provider streams are converted inside the Agent to canonical `conversation.run.event` messages; the UI does not consume provider SSE directly.
- Active thinking/content fragments remain in run memory while streaming and are merged into durable rollout records at completion/cancel/failure boundaries.

#### `packages/roxy-agent-runtime`

`roxy-agent-runtime` is no longer merely a planned replacement. It is the framework actually instantiated by `roxy-agent`.

- Public contracts are split under `src/core/contracts/`; `src/core/interfaces.ts` is a compatibility re-export barrel.
- `AgentRuntime.create(AgentDefinition)` is the public composition entry. The host must inject provider, tools, memory, HITL, logger, storage, plugins, and optional `AgentManager`.
- The framework does not read product env, choose models, scan product directories, or know RoxyBrowser HTTP/WebSocket contracts.
- The internal message model is provider-neutral canonical content blocks and transcript items. Providers translate to Anthropic Messages or OpenAI Responses wire formats.
- Built-in providers: `AnthropicProvider`, `DeepseekProvider`, `OpenAIResponsesProvider`, and deterministic `FakeProvider`.
- Built-in framework capabilities include tool validation/execution, filesystem/shell tools, custom `apply_patch`, HITL policies, clarification suspension, memory trimming/compaction, JSONL session replay, plugins/metrics, MCP clients, Skill primitives, and named background subagents.
- `AgentManager` owns a session-level tree rooted at `/root`; `spawn_agent` starts a child asynchronously, `list_agents` snapshots the tree, and `wait_agent` waits for descendant completion.
- The package is private and requires Node >=24. Any feature or bug fix must follow its `AGENTS.md` Red -> Green TDD rules.

### MCP Integration

`packages/roxy-agent/src/core/mcp/mcpManager.ts` combines three sources:

- RoxyBrowser OpenAPI MCP: global shared tools created in-process from `@roxybrowser/openapi` via `InMemoryTransport`
- Playwright MCP: one in-process `@roxybrowser/playwright/mcp` client per root/child browser worker, with isolated browser scope and artifact directories
- User MCP servers: configurable stdio or Streamable HTTP connections through runtime MCP adapters

Current Playwright lifecycle methods are:

```typescript
await mcpManager.createPlaywrightClientForWorker(workerId, conversationId)
const tools = await mcpManager.getToolsForWorker(workerId, true)
await mcpManager.destroyPlaywrightClientForWorker(workerId)
```

Do not reintroduce `OPENAPI_SCRIPT_PATH`, `PLAYWRIGHT_SCRIPT_PATH`, or stdio subprocesses for the built-in OpenAPI/Playwright integrations. They are direct npm dependencies and run in-process.

### Sandbox Execution

Automation scripts execute through a lazily started, recyclable Sandbox Host child process:

- The Host receives versioned IPC requests from `SandboxHostManager`
- Each run gets an isolated `node:vm` context, module cache, timers, virtual process, Chromium connection, logs, permissions, and capability APIs
- Capability implementations are under `src/modes/sandbox-api/`; scripts still use the compatibility `@roxybrowser/sandbox/*` specifiers
- LLM calls are proxied back to the main Agent process; the Sandbox Host does not own model credentials
- Chromium is supported in this path; Firefox is explicitly rejected until the Playwright package supports the required per-run cleanup

### Agent Data Storage

Agent data is rooted at `~/.roxy-agent` in production and `~/.roxy-agent-dev` in development/test. Always obtain paths from `packages/roxy-agent/src/core/storage/agentPaths.ts`, which constructs the schema from `@roxy/shared/agent-paths`.

Key locations:

- `state/legacy/conversations.db`: Legacy-compatible conversation metadata/messages/files
- `state/tasks/tasks.db`: Device-local task execution logs; task definitions remain backend-owned
- `sessions/{conversationId}/rollout.jsonl`: Durable runtime conversation history and frontend replay source
- `sessions/{conversationId}/recording.jsonl`: Browser operation recording
- `sessions/{conversationId}/browser/`: Screenshots, downloads, traces, and snapshots
- `memory/MEMORY.md` + `memory/{memory-name}.md`: Main-Agent-managed cross-session memory index and flat entries
- `library/scripts/`: Reusable scripts and permission sidecars
- `library/skills/{builtin,user,installed}/`: Local Skill sources
- `workdir/{scriptSlug}/`: Persistent sandbox script workspace, outputs, browser files, and logs
- `state/mcp/`: User MCP configuration/state
- `logs/`: Agent, subagent, performance, migration, and execution logs

`src/index.ts` runs the idempotent storage migrator before loading Agent-mode database modules. `CHECKPOINT_DIR`, `AGENT_WORK_DIR`, and `SKILLS_DIR` are transitional compatibility/migration inputs, not the canonical storage model for new code.

### Production Agent Lifecycle

In production the Agent is not a separately installed service. Electron's `apps/electron/src/modules/mcp/index.ts`:

1. Waits for pending Agent downloads and verifies/repairs the downloaded artifact
2. Chooses the dev-built `agent.mjs` or the OSS-downloaded production artifact
3. Allocates a local port (starting from 26580 in production, 26581 in development)
4. Injects auth, backend URL, user/workspace identity, app paths, language, version, and compatibility paths
5. Starts the artifact with `utilityProcess.fork()` and `ROXY_MODE=agent`

The Agent then fetches current model metadata from the Agent backend and sends model traffic through `/llm-proxy/v1`. The Agent bundle and skill archives are distributed through OSS independently of the desktop app update.

### Browser Management

`apps/electron/src/modules/browser/browser-manager/` owns Puppeteer browser instances, isolated user-data directories, fingerprints, cookies, proxy settings, post-launch initialization, and cleanup. The typical launch path is renderer IPC -> Electron handler -> `BrowserManager` -> Puppeteer -> `afterLaunchTask`.

### Build System

- Turbo orchestrates `build`, `compile`, `lint`, and persistent `dev` tasks.
- Electron's Vite build emits main-process ESM to `apps/electron/dist-vite/`; the local Agent entry is bundled into `agent.mjs` from `packages/roxy-agent/src/index.ts`.
- Production Agent publishing uses the package's Vite + Webpack ESM build.
- The web app has separate development/production Vite builds and production Sentry source-map upload.

## Important Patterns

### Web i18n

When adding or changing user-facing text under `apps/web/`, call `$t()` with a string literal only, for example `$t('Browser List')`. The language generator statically scans literal calls; variables, template strings, concatenation, computed values, and helper-returned values are not discoverable.

Run `pnpm genLanguage` to regenerate locale keys. Do not directly add/remove keys under `apps/web/src/locales/langs/`; only translation values may be edited manually.

### Workspace and Permissions

The frontend supports Private and Public workspaces. Router guards also enforce role and permission metadata. Use the permission store/composables for component-level checks rather than duplicating role logic.

### Module Registration

Electron modules expose setup functions and are orchestrated from `apps/electron/src/modules/index.ts`. IPC receivers are registered by the side-effect import `import './ipc/receiver'`.

### Agent Boundary Rules

- Product behavior belongs in `roxy-agent`; reusable framework behavior belongs in `roxy-agent-runtime`.
- Do not make runtime read Electron/product env or import `@roxy/shared/channel`.
- Add runtime public types under the matching `src/core/contracts/` module and re-export them through `src/core/interfaces.ts`/`src/index.ts` as needed.
- Preserve provider abstraction: canonical runtime state must not become OpenAI- or Anthropic-wire-specific.
- Runtime fixes/features require a failing test first and full package test/typecheck verification.
- New conversation events must be added to `@roxy/shared/channel` schemas and validated on both Agent and web boundaries.

## Git Commit Messages

**All commit messages MUST be in Chinese** (per `.cursorrules`).

Format: `类型(范围): 简短描述`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

Example:

```text
feat(browser): 新增cookie机器人功能

添加自动化cookie收集功能，支持批量导入和同步
```

Ignore generated changes to:

- `components.d.ts`
- `src/components/svgicon/svg-icon-types.ts`

## Environment Variables

**Desktop/web development:** `.env.development` files under `apps/electron` and `apps/web` are loaded with `@dotenvx/dotenvx` where configured.

**Key Agent host variables injected by Electron:**

- `ENV_TYPE`: `development | staging | production`; do not use `NODE_ENV` for Agent behavior
- `ROXY_MODE`: `agent` for the main child process; Sandbox Host children use `sandbox`
- `ROXY_SERVER_URL`: Backend root used to build `/llm-proxy` and `/llm-proxy/v1`
- `ROXY_API_KEY`, `ROXY_USER_TOKEN`: Combined as Agent backend/LLM proxy authentication
- `ROXY_API_HOST`: Electron's local RoxyBrowser API endpoint used by built-in MCP
- `ROXY_USER_ID`, `ROXY_WORKSPACE_ID`: Account/workspace scope
- `ROXY_SERVER_PORT`: Embedded Agent HTTP/WebSocket port
- `ROXY_SERVER_HEADERS`: Extra backend headers serialized as JSON
- `SYSTEM_LANGUAGE`: Agent fallback language
- `AGENT_SCRIPT_PATH`: Main Agent artifact path, reused when the Agent forks the Sandbox Host
- Electron app path variables such as `DOWNLOADS_DIR`, `DESKTOP_DIR`, `USER_DATA_DIR`, and `LOGS_DIR`

Model/provider/api key selection is not configured through `LLM_PROVIDER`, `LLM_MODEL`, or `LLM_API_KEY`. The Agent fetches the user's model record at runtime and routes all shipped conversation traffic through the backend LLM proxy.

## Troubleshooting

**Electron install fails:**

```bash
cd apps/electron
ELECTRON_GET_USE_PROXY=true node node_modules/electron/install.js
```

**Build cache issues:**

```bash
pnpm clean:cache
pnpm reinstall
pnpm install
```

**Language files out of sync:**

```bash
pnpm genLanguage
```

**API types out of sync:**

```bash
pnpm openapi
pnpm openapi:agent
```
