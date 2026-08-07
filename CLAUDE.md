# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RoxyBrowser is an Electron-based **anti-detect / fingerprint browser** with a built-in AI agent that drives the browser via MCP. The project is a pnpm + Turbo monorepo with **6 apps and 16 packages**.

## 开始工作前必读

**在开始任何需求或任务之前，请先阅读 `.reports/codemaps/` 目录下的架构文档：**

- `architecture.md` - 系统整体架构、服务边界、数据流
- `backend.md` - Electron 主进程、核心模块、IPC 通信
- `frontend.md` - Vue 3 前端、路由、状态管理
- `data.md` - 数据存储、浏览器配置文件、Cookie 管理
- `dependencies.md` - 外部服务、AI 集成、第三方库

这些 codemaps 提供了项目的高层架构概览，帮助你快速理解代码库的组织结构和关键组件之间的关系。每个文件都经过优化，适合 AI 上下文消费（约 700-900 tokens）。

> ⚠️ codemaps 是高层地图，部分内容可能偏旧（例如包名仍可能沿用 `roxybrowser-*-mcp`）。包清单、agent 架构、执行模式**以本 CLAUDE.md 与各子包 CLAUDE.md 为准**。

## Development Commands

### Initial Setup
```bash
pnpm install                    # Install dependencies and build packages
pnpm genLanguage                # Generate i18n language files
pnpm openapi                    # Regenerate @roxy/backend-api client (main product backend spec)
pnpm openapi:agent              # Regenerate @roxy/agent-api client (LLM-proxy / agent backend spec)
```

### Development
```bash
pnpm dev                        # Start Electron app with hot reload
pnpm dev:web                    # Start web app only (for browser testing)
pnpm dev:pkg                    # Watch mode for all packages
pnpm dev:p                      # Parallel dev mode (Turbo)
```

### Building
```bash
pnpm build                      # Build all packages (Turbo orchestrated)
pnpm build:pkg                  # Build packages only
pnpm pack:dev                   # Full build + package Electron app (dev)
pnpm pack:prod                  # Full build + package Electron app (prod)
```

### Agent & MCP
```bash
pnpm agent:build                # Build roxy-agent + MCP servers
pnpm agent:compile              # Build + compile to bytenode
pnpm publish:agent:dev          # Compile + upload to OSS (dev)
pnpm publish:agent:prod         # Compile + upload to OSS (prod)
```

### Linting & Testing
```bash
pnpm lint                       # Run ESLint across all packages (turbo run lint)
pnpm lint:fix                   # Auto-fix ESLint issues
pnpm test                       # ⚠️ points at scripts/test.ts, which does NOT exist — no formal test framework
```
> No repo-wide test suite. `packages/roxy-agent-runtime` is the exception: it uses vitest + a mandatory TDD workflow (see its `AGENTS.md`). To hand-verify agent logic use `tsx packages/roxy-agent/src/cli.ts`.

### Utilities
```bash
pnpm clean:cache                # Clear Vite cache
pnpm reinstall                  # Clean reinstall (removes lock + node_modules)
pnpm install:electron           # Manually install Electron (with proxy)
```

## Architecture

### Monorepo Structure

**Apps (6):**
- `apps/electron` (`roxybrowserdev`): Main Electron process — desktop shell, IPC, browser management; packaged/notarized as the RoxyBrowser installer
- `apps/web` (`web`): Vue 3 + PrimeVue renderer SPA — all product UI (also published as web source to OSS)
- `apps/preload` (`@roxy/electron-preload`): IPC bridge between main and renderer
- `apps/tauri` (`tauri`): **Experimental** Rust/Tauri launcher shipping two variants — RoxyChrome & RoxyFirefox (not the main app)
- `apps/cloud-browser-gateway` (`@roxy/cloud-browser-gateway`): **NEW** NestJS control plane for the cloud-browser feature — token auth + per-user Docker/neko container lifecycle + Redis + WS/proxy gateway (see its `PLAN.md`)
- `apps/cloud-browser-user` (`@roxy/cloud-browser-user`): **NEW** Vue 3 cloud-browser client — a neko (m1k1o/neko) WebRTC streaming UI to view/control the remote browser

**Packages (16):**

*Agent / MCP*
- `packages/roxy-agent` (`roxy-agent`): **Currently shipped** AI agent (deepagents/LangChain engine); built & pushed to OSS via `agent:build`/`publish:agent`. Has its own authoritative `CLAUDE.md`.
- `packages/roxy-agent-runtime` (`roxy-agent-runtime`): From-scratch, Anthropic-native agent framework rewrite intended to supersede `roxy-agent` — **under heavy active development**; has its own `CLAUDE.md`/`AGENTS.md`.
- `packages/roxy-openapi` (`@roxybrowser/openapi`, **vendored prebuilt `dist/` only**): RoxyBrowser control-plane MCP SDK; consumed by `roxy-agent`. Source repo is the sibling `roxybrowser-mcp-server`.
- `packages/roxy-playwright` (`@roxybrowser/playwright`, **vendored prebuilt `dist/` only**): Playwright-over-CDP automation MCP SDK; consumed by `roxy-agent`. Source repo is the sibling `roxybrowser-playwright-mcp`.
- `packages/roxy-sandbox` (`@roxy/sandbox`): Capability modules (utils/human/llm/table/kv/debug) injected into the agent's sandbox VM for user scripts. Has its own `CLAUDE.md`.
- `packages/roxy-skills` (`roxy-skills`): Zips agent "skill" bundles for OSS distribution.

*API clients (swagger-typescript-api → axios)*
- `packages/backend-api` (`@roxy/backend-api`): Client for the **main product backend** (Apifox spec); regen via `pnpm openapi`.
- `packages/agent-api` (`@roxy/agent-api`): **NEW** client for the **LLM-proxy / agent backend** (`.../llm-proxy/openapi.json`); regen via `pnpm openapi:agent`.

*Shared / native / build*
- `packages/roxy-shared` (`@roxy/shared`): Shared types & utilities (web + electron + gateway); bidirectional Agent WebSocket schemas are published from `@roxy/shared/channel` and use Zod as the runtime/type source of truth
- `packages/diskspace-native` (`@roxy/diskspace-native`): **NEW** napi-rs/Rust native module — Windows disk-space query for the main process
- `packages/node-typesafe-worker-messages` (`@repo/node-typesafe-worker-messages`): Type-safe Node worker-thread messaging (used by electron main)
- `packages/gen-primevue-preset` (`gen-primevue-preset`): Figma plugin that generates PrimeVue theme presets
- `packages/vite-plugins` (`@roxy/vite-plugins`) / `packages/webpack-plugins` (`@roxy/webpack-plugins`): Internal build plugins (JS obfuscation, zip/upload)
- `packages/language-localization` (`@roxy/language-localization`): i18n tooling — CLI behind `web genLanguage` + auto-translate Vite plugin
- `packages/puppeteer-google-translate` (`@roxy/puppeteer-google-translate`): Headless-Chrome Google Translate scraper (translation engine behind language-localization)

### Electron Main Process Architecture

**Module Initialization Flow** (`apps/electron/src/modules/index.ts`):
1. `app.whenReady()` - Wait for Electron ready
2. `initLocalConfig()` - Load persistent config from electron-store
3. `setupAppServer()` - Start internal Express server (for packaged app)
4. `intoLaunchPage()` - Show launch window
5. `setupStore()` - Initialize store watchers
6. `setupApp()` - Setup tray, auto-start, main window
7. `startRoxynet()` - Start proxy network service
8. `browserManager.autoClearByTimestamp()` - Cleanup old browser instances

**Core Modules** (`apps/electron/src/modules/`):
- `app/`: Main window, tray, auto-start, proxy manager
- `browser/`: Puppeteer-based browser management with fingerprinting
- `ipc/`: IPC handlers organized by domain (browser, app, user, etc.)
- `appServer/`: Internal Express server for serving web UI in packaged app
- `mcp/`: MCP server lifecycle management
- `roxynet/`: Network proxy service
- `sync-control/`: Profile synchronization
- `updater/`: Auto-update handling

### IPC Communication Pattern

**Preload Bridge** (`apps/preload/src/`):
- Exposes `window.electronAPI` to renderer
- Type-safe IPC via `apps/preload/src/types/renderMessage.ts`
- Organized by domain: app, browser, extension, mcp, proxy, syncControl, user

**IPC Handlers** (`apps/electron/src/modules/ipc/receiver/modules/`):
- Each domain has its own handler file (browser.ts, app.ts, etc.)
- Handlers registered via `ipcMain.handle(channel, handler)`
- Return values automatically serialized

**Example Flow:**
```
Renderer: window.electronAPI.invoke('browser:launch', config)
  → Preload: ipcRenderer.invoke('browser:launch', config)
  → Main: ipcMain.handle('browser:launch', async (event, config) => {...})
  → BrowserManager.createBrowser(config)
  → Return browserInstance
```

### Vue 3 Frontend Architecture

**Entry Point** (`apps/web/src/main.ts`):
- Detects Electron vs web mode via `globalThis.electronAPI`
- Initializes i18n before mounting app
- Loads user token and language from config

**Router** (`apps/web/src/router/`):
- Vue Router with navigation guards
- Token-based authentication check
- Role-based access control (workspace roles)
- Workspace type routing (Private vs Public)

**State Management** (Pinia stores in `apps/web/src/stores/`):
- `user.ts`: Authentication, token, user info
- `workspace.ts`: Current workspace, role, type
- `locale.ts`: i18n language selection
- `theme.ts`: Dark/light theme
- `browser.ts`: Browser instance state
- Persisted to localStorage via pinia-plugin-persistedstate

**Views** (`apps/web/src/views/`):
- Organized by feature: browser, agent, mcp, projects, extensions, etc.
- Each view is a route in the router

### AI Agent System (`packages/roxy-agent/`)

> The agent code lives under `src/deepagents/` (not `src/agent/`). For anything beyond this overview, read **`packages/roxy-agent/CLAUDE.md`** — it is authoritative on structure, the Electron env contract, modes, MCP, skills, and scripts.

**Execution modes** (selected by `ROXY_MODE` env or the first CLI arg): `agent` (Express HTTP server, default), `im` (IM adapters: Feishu/Telegram/Slack/Discord/WeChat), `worker` (orchestrator subprocess, forked over IPC), `sandbox` (isolated `node:vm` runtime executing user automation scripts).

**Agent conversation model**: The frontend does not select Simple, Orchestrator, or image modes. Every turn uses the same conversation agent; multi-window work is dispatched through `parallel_dispatch` / `run_worker`, with each worker using an isolated MCP client. User messages and run events use the bidirectional `/api/events` WebSocket; both directions validate the shared Zod protocol from `@roxy/shared/channel`. Conversation metadata and files remain HTTP CRUD.

**MCP integration** (`src/core/mcp/mcpManager.ts`): OpenAPI MCP (`roxybrowser_openapi`, shared, InMemoryTransport) + one Playwright MCP per worker (`roxybrowser_playwright_{workerId}`, stdio subprocess) + optional user-configured MCP servers. Skills are lazy-loaded (`load_skills`) and inject the corresponding MCP tools on demand.

**In production the agent is NOT a standalone process** — the Electron main process (`apps/electron/src/modules/mcp/index.ts`) forks it via `utilityProcess.fork()` on a dynamically-allocated port (from 26580) with **all env injected by Electron**. Only local dev (`tsx src/cli.ts`) reads `.env`. The agent + MCP bundle + skills ship over OSS independently of app auto-update.

### Browser Management

**BrowserManager** (`apps/electron/src/modules/browser/browser-manager/`):
- Manages Puppeteer browser instances
- Profile-based isolation (separate Chrome user data dirs)
- Fingerprint configuration (canvas, WebGL, fonts, etc.)
- Cookie management with sync to backend
- Auto-cleanup of old instances

**Launch Flow:**
1. User clicks "Launch Browser" in UI
2. IPC call to `browser:launch` with profile config
3. BrowserManager creates Puppeteer browser with custom args
4. `afterLaunchTask` runs post-launch initialization
5. Browser instance returned to renderer

### Build System

**Turbo Pipeline** (`turbo.json`):
- `build`: Builds all packages with dependency graph
- `compile`: Builds + compiles (for bytenode)
- `dev`: Persistent watch mode
- Outputs cached in `dist/` directories

**Electron Build:**
- Vite builds main process → `dist-vite/`
- Webpack bundles for production → `dist/`
- electron-builder packages final app

**Web Build:**
- Vite builds Vue app
- Separate dev/prod builds with different env files
- Sentry source maps uploaded in prod

## Important Patterns

### Type Safety Across IPC

All IPC messages are typed via `apps/preload/src/types/renderMessage.ts`. When adding new IPC handlers:
1. Add type definition in renderMessage.ts
2. Implement handler in `apps/electron/src/modules/ipc/receiver/modules/`
3. Expose in preload via `apps/preload/src/ipcRenderer.ts`
4. **Renderer low-version compat**: Add `supportsAppX_Y_Z()` in `apps/web/src/utils/app-supports.ts` (with JSDoc listing IPC channels/events), and guard all renderer `send`/`on` calls. Web UI can hot-update ahead of the Electron client; never call new IPC without a version gate and fallback.

### Workspace Types

The app supports two workspace types (defined in `apps/web/src/enums`):
- **Private**: Personal workspace, default routes
- **Public**: Shared/team workspace, redirects to `/shared`

Router guards enforce workspace-specific routing and role-based access.

### Module Registration

Electron modules follow a registration pattern:
1. Module exports setup function (e.g., `setupApp()`)
2. Registered in `apps/electron/src/modules/index.ts`
3. IPC handlers auto-registered via `import './ipc/receiver'`

### MCP Server Lifecycle

MCP servers are managed per-worker:
- Created: `mcpManager.createPlaywrightClient(workerId)`
- Used: `mcpManager.getToolsForWorker(workerId)`
- Destroyed: `mcpManager.destroyWorkerClient(workerId)`

Environment variables required:
- `OPENAPI_SCRIPT_PATH`, `PLAYWRIGHT_SCRIPT_PATH`
- `ROXY_API_KEY`, `ROXY_API_HOST`
- `PLAYWRIGHT_MCP_SNAPSHOT_MODE=optimized`
- `PLAYWRIGHT_MCP_ROXY_MODE=true`

## Git Commit Messages

**All commit messages MUST be in Chinese** (per .cursorrules):

Format: `类型(范围): 简短描述`

Types:
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

Example:
```
feat(browser): 新增cookie机器人功能

添加自动化cookie收集功能，支持批量导入和同步
```

Ignore changes to:
- `components.d.ts`
- `src/components/svgicon/svg-icon-types.ts`

## Environment Variables

**Development:**
- `.env.development` files in apps/electron and apps/web
- Loaded via `@dotenvx/dotenvx`

**Key Variables:**
- `VITE_SENTRY_DSN`: Sentry error tracking
- `ROXY_API_HOST`: Backend API endpoint
- Agent LLM config is fetched at runtime from the backend `/llm-proxy` (no `LLM_PROVIDER`/`LLM_MODEL`/`LLM_API_KEY`); traffic authenticates with `ROXY_SERVER_URL` + `ROXY_API_KEY:ROXY_USER_TOKEN`. See `packages/roxy-agent/CLAUDE.md`.
- `CHECKPOINT_DIR`: Agent conversation storage
- `ROXY_SERVER_PORT`: Agent server port (default 3000)

## Troubleshooting

**Electron Install Fails:**
```bash
# Enable proxy and manually install
cd apps/electron
ELECTRON_GET_USE_PROXY=true node node_modules/electron/install.js
```

**Build Cache Issues:**
```bash
pnpm clean:cache
pnpm reinstall
```

**Language Files Out of Sync:**
```bash
pnpm genLanguage
```

**API Types Out of Sync:**
```bash
pnpm openapi
```
