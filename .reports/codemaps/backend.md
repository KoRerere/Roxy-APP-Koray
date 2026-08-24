# Backend Architecture

<!-- Updated: 2026-08-14 | Covers Electron-local services, embedded Agent and cloud-browser gateway -->

## Electron Main Process

### Entry and Startup

- `apps/electron/src/index.ts`: Single-instance/uninstall mode handling, then `setupModules()`.
- `apps/electron/src/modules/index.ts`: Main initialization order.

```text
app.whenReady
  -> initialize @roxy/crypto
  -> load encrypted local config
  -> install pending desktop update if required
  -> start internal App Server
  -> clean stale roxynet/updater processes
  -> fetch/store user config and initialize app/window/tray
  -> start configured RoxyClaw, resource and binary updaters
finally
  -> repair binary seeds -> start roxynet -> trigger update checks
  -> restore browser windows -> auto-clean old profiles
```

### Core Modules (`apps/electron/src/modules/`)

- `app/`: Main/launch windows, tray, auto-start, proxy and desktop behavior.
- `browser/`: `BrowserManager`, Chrome/Firefox launch adapters, fingerprint generation, cookies, bookmarks, extensions, profile sync and cleanup.
- `ipc/`: Typed renderer request receivers and main-to-renderer event senders.
- `appServer/`: Internal Express dashboard/roxynet endpoints and app WebSocket; proxies Vite WebSocket in development.
- `openapi/`: Local RoxyBrowser control API for browser/project/proxy/account/team operations.
- `mcp/`: Embedded `roxy-agent` process lifecycle and Agent Console window integration. The name is historical; built-in MCP clients live inside `roxy-agent`.
- `roxynet/`: Local proxy network service and binary lifecycle.
- `sync-control/`: Multi-window synchronization and native helper integration.
- `updater/`: Desktop, web/resource, Agent, roxynet and roxysync update flows.
- `extension/`, `fileOperations/`, `shortcut-manager/`, `log/`: Supporting desktop services.

## Typed IPC

The preload bridge exposes one logical API over the `IPC-bridge` channel:

```text
Renderer window.electronAPI.send(name, payload)
  -> preload IPCRenderer.send()
  -> ipcRenderer.invoke('IPC-bridge', envelope)
  -> main receiver dispatches typed handler
  -> serialized success/error result

Main ipcSender event
  -> webContents.send('IPC-bridge', envelope)
  -> preload listener registry
  -> renderer callback
```

- Request contracts: `apps/preload/src/types/renderMessage.ts`.
- Background event contracts: `apps/preload/src/types/mainMessage.ts`.
- Main handlers: `apps/electron/src/modules/ipc/receiver/modules/` grouped by app, browser, extension, MCP, proxy, sync-control and user.
- New renderer calls must be guarded with `apps/web/src/utils/app-supports.ts` because web assets can update ahead of the Electron binary.

## Browser Lifecycle

```text
renderer request
  -> browser IPC handler
  -> BrowserManager / BrowserItem
  -> beforeLaunchTask: profile files, proxy, fingerprint, extensions, args
  -> Chrome via Puppeteer/CDP OR Firefox wrapper/BiDi bootstrap
  -> afterLaunchTask: cookies, tabs, sync hooks and runtime monitoring
  -> disconnect: persist cookies/state and release resources
```

- Each `dirId` maps to `join(store.browserCacheRootDir, dirId)`.
- Chrome and Firefox share the high-level `BrowserItem` lifecycle but use different profile formats and connection adapters.
- Firefox cookie persistence reads `cookies.sqlite` after the browser releases its DB lock; bookmark/history operations use `places.sqlite`.

## Local HTTP Services

### App Server

`apps/electron/src/modules/appServer/index.ts` binds an available port starting from `store.appPort`. It serves dashboard APIs, receives roxynet messages and hosts the app-level WebSocket. It is separate from the Agent server.

### RoxyBrowser OpenAPI

`apps/electron/src/modules/openapi/index.ts` starts only when enabled by backend user settings. It selects a free port, stores `apiPort/apiKey`, and exposes local control routes consumed by external clients and the in-process OpenAPI MCP integration.

## Embedded Agent Service

Electron starts `roxy-agent` through `utilityProcess.fork()` from `apps/electron/src/modules/mcp/index.ts`:

1. Wait for pending Agent downloads and verify/repair the OSS artifact.
2. Use development `agent.mjs` or the downloaded production bundle.
3. Allocate a local port from 26581 (dev) or 26580 (production).
4. Inject backend/auth/workspace/local-API/app-path variables and `ROXY_MODE=agent`.
5. Start and monitor the utility process; RoxyClaw is enabled inside the same process.

`roxy-agent` is an Express application with business logic separated into `routes/` and `services/`:

- Conversation/file metadata: HTTP CRUD.
- MCP settings: `/api/mcp/servers` CRUD/import/test/enable/disable.
- Tasks: backend sync, immediate execution, local logs, replay/stop/delete.
- RoxyClaw: start/stop, IM connection tests and Weixin QR flow.
- `/api/events`: single bidirectional WebSocket for run commands, approvals, task logs, execution center, task monitor and canonical conversation events.

The application layer constructs `roxy-agent-runtime`; runtime itself has no Express/Electron knowledge.

## Sandbox Host

Automation scripts do not execute in the main Agent VM. `SandboxHostManager` lazily forks the same Agent artifact with `ROXY_MODE=sandbox` and sends versioned IPC requests. Each run owns a separate `node:vm` context, module cache, virtual process, timers, Chromium connection, permissions, logs and capability APIs. The host is recycled by heartbeat, RSS, idle and maximum-run policies.

## Cloud Browser Gateway

`apps/cloud-browser-gateway` is a separate NestJS deployment, not part of Electron:

- `AuthModule`: `POST /api/auth/connect` validates product token/workspace and remaining usage; `POST /api/auth/heartbeat` refreshes idle expiry without extending the total usage limit.
- `BrowserModule`: Prepares profile/fingerprint/extensions, connects with Puppeteer/CDP, performs after-launch work and persists cookies on shutdown.
- `ContainerModule`: Allocates HTTP/UDP ports, starts Docker/neko with host networking, mounts persistent profile data and optional extensions, enforces CPU/GPU/usage/idle limits, and removes stale/orphan containers.
- `RedisModule`: Session/container mappings and allocated port sets.
- Startup initializes crypto, Swagger and DTO validation, then reconciles Docker containers against Redis.

The gateway returns a session ID, direct neko connect URL and WebRTC UDP port. `cloud-browser-user` handles the neko/WebRTC client UI.

## Key Files

- `apps/electron/src/modules/index.ts`: Desktop startup.
- `apps/preload/src/ipcRenderer.ts`: Renderer bridge implementation.
- `apps/electron/src/modules/browser/browser-manager/`: Browser lifecycle.
- `apps/electron/src/modules/mcp/index.ts`: Agent utility-process host.
- `packages/roxy-agent/src/app.ts`: Embedded Agent HTTP/WebSocket registration.
- `packages/roxy-agent/src/runtime/chat-agent.ts`: Product runtime composition.
- `apps/cloud-browser-gateway/src/auth/auth.service.ts`: Cloud session orchestration.
- `apps/cloud-browser-gateway/src/container/container.service.ts`: Docker/neko lifecycle.
