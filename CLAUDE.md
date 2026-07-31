# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Roxy Browser is an Electron-based browser automation platform with AI agent capabilities. The project is a pnpm monorepo with 4 apps and 12 packages, using Turbo for build orchestration.

## 开始工作前必读

**在开始任何需求或任务之前，请先阅读 `.reports/codemaps/` 目录下的架构文档：**

- `architecture.md` - 系统整体架构、服务边界、数据流
- `backend.md` - Electron 主进程、核心模块、IPC 通信
- `frontend.md` - Vue 3 前端、路由、状态管理
- `data.md` - 数据存储、浏览器配置文件、Cookie 管理
- `dependencies.md` - 外部服务、AI 集成、第三方库

这些 codemaps 提供了项目的高层架构概览，帮助你快速理解代码库的组织结构和关键组件之间的关系。每个文件都经过优化，适合 AI 上下文消费（约 700-900 tokens）。

## Development Commands

### Initial Setup
```bash
pnpm install                    # Install dependencies and build packages
pnpm genLanguage                # Generate i18n language files
pnpm openapi                    # Generate API client from OpenAPI spec
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
pnpm lint                       # Run ESLint across all packages
pnpm lint:fix                   # Auto-fix ESLint issues
pnpm test                       # Run test script
```

### Utilities
```bash
pnpm clean:cache                # Clear Vite cache
pnpm reinstall                  # Clean reinstall (removes lock + node_modules)
pnpm install:electron           # Manually install Electron (with proxy)
```

## Architecture

### Monorepo Structure

**Apps:**
- `apps/electron` (roxybrowserdev): Main Electron process
- `apps/web`: Vue 3 renderer UI
- `apps/preload`: IPC bridge between main and renderer
- `apps/tauri`: Alternative native wrapper (experimental)

**Key Packages:**
- `packages/roxy-agent`: AI agent orchestrator using LangGraph
- `packages/roxybrowser-playwright-mcp`: Playwright MCP server
- `packages/roxybrowser-mcp-server`: OpenAPI MCP server
- `packages/backend-api`: Auto-generated OpenAPI client
- `packages/roxy-shared`: Shared types and utilities

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

### AI Agent System (packages/roxy-agent/)

**Dual-Mode Architecture:**

1. **Simple Mode** (`src/agent/simple/`): Single agent with iterative tool calling
2. **Orchestrator Mode** (`src/agent/orchestrator/`): Multi-agent with planning, parallel execution, and synthesis

**Orchestrator Workflow:**
- **Planning Phase**: Orchestrator generates JSON task plan
- **Execution Phase**: Parallel workers execute tasks with isolated MCP clients
- **Synthesis Phase**: Orchestrator combines results into final answer

**MCP Integration** (`src/mcpManager.ts`):
- Each worker gets isolated MCP client to prevent resource conflicts
- Two MCP servers per worker:
  1. OpenAPI MCP (roxybrowser_openapi): RoxyBrowser API tools
  2. Playwright MCP (roxybrowser_playwright_{workerId}): Browser automation

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
- `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`: AI agent config
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
