# Architecture Overview

<!-- Generated: 2026-03-26 | Last refreshed: 2026-07-08 | Token estimate: ~950 -->

## Project Type
Electron + Vue 3 monorepo (pnpm workspaces + Turbo). Product: **RoxyBrowser**, an anti-detect / fingerprint browser with a built-in AI agent. **6 apps, 16 packages.**

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        RoxyBrowser                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐         ┌──────────────┐                   │
│  │   Electron   │◄────────┤   Preload    │                   │
│  │   Main       │  IPC    │(@roxy/electron-preload)          │
│  │   Process    │─────────►              │                   │
│  └──────┬───────┘         └──────┬───────┘                   │
│         │                        ▼                            │
│         │              ┌──────────────────┐                  │
│         │              │  Vue 3 Web App   │ (renderer/SPA)   │
│         │              │  PrimeVue + Pinia│                  │
│         │              └──────────────────┘                  │
│         ▼                                                     │
│  ┌─────────────────────────────────────────┐                │
│  │  Browser Manager (Puppeteer Core)        │                │
│  │  profiles · cookies · fingerprints       │                │
│  └─────────────────────────────────────────┘                │
│         │ utilityProcess.fork() (port from 26580)            │
│         ▼                                                     │
│  ┌─────────────────────────────────────────┐                │
│  │  Roxy Agent (packages/roxy-agent)        │                │
│  │  modes: agent · im · worker · sandbox    │                │
│  │  engine: deepagents / LangChain          │                │
│  └───────────┬─────────────────────────────┘                │
│              │ MCP (InMemory + stdio)                        │
│      ┌───────┴────────┐                                      │
│      ▼                ▼                                       │
│  OpenAPI MCP      Playwright MCP (per worker, over CDP)      │
│ (@roxybrowser/    (@roxybrowser/playwright)                  │
│  openapi)                                                     │
└─────────────────────────────────────────────────────────────┘

Separate feature (own services): Cloud Browser
  cloud-browser-gateway (NestJS + Docker + neko + Redis)
    └─ cloud-browser-user (Vue neko WebRTC streaming client)
```

## Service Boundaries

### Apps (6)
- **electron** (`roxybrowserdev`, v3.0.0): Main process — IPC, browser management, agent fork, updater
- **web** (`web`): Vue 3 + PrimeVue renderer SPA (all product UI; also published as web source)
- **preload** (`@roxy/electron-preload`): Bridge between main and renderer
- **tauri** (`tauri`): Experimental Rust/Tauri launcher — RoxyChrome & RoxyFirefox variants
- **cloud-browser-gateway** (`@roxy/cloud-browser-gateway`): NEW — NestJS control plane for cloud browser (auth + Docker/neko lifecycle + Redis + WS/proxy)
- **cloud-browser-user** (`@roxy/cloud-browser-user`): NEW — Vue neko WebRTC client for the remote cloud browser

### Packages (16)
- **roxy-agent**: Shipped AI agent (deepagents/LangChain); `src/deepagents/`, 4 modes
- **roxy-agent-runtime**: From-scratch Anthropic-native agent rewrite — heavy WIP (own CLAUDE.md/AGENTS.md)
- **roxy-openapi** (`@roxybrowser/openapi`): Vendored prebuilt control-plane MCP SDK (src repo: sibling roxybrowser-mcp-server)
- **roxy-playwright** (`@roxybrowser/playwright`): Vendored prebuilt Playwright-over-CDP MCP SDK (src repo: sibling roxybrowser-playwright-mcp)
- **roxy-sandbox** (`@roxy/sandbox`): Capability modules (utils/human/llm/table/kv/debug) injected into the agent sandbox VM
- **roxy-skills**: Zips agent skill bundles for OSS
- **backend-api** (`@roxy/backend-api`): Main-backend API client (`pnpm openapi`)
- **agent-api** (`@roxy/agent-api`): NEW — LLM-proxy/agent backend API client (`pnpm openapi:agent`)
- **roxy-shared** (`@roxy/shared`): Shared types & utilities; `@roxy/shared/channel` owns the Zod-validated Agent WebSocket protocol
- **diskspace-native** (`@roxy/diskspace-native`): NEW — napi-rs/Rust native (Windows disk space)
- **node-typesafe-worker-messages** (`@repo/...`): Type-safe worker-thread messaging
- **gen-primevue-preset**: Figma plugin → PrimeVue theme presets
- **vite-plugins** / **webpack-plugins**: Internal build plugins (obfuscation, zip/upload)
- **language-localization** / **puppeteer-google-translate**: i18n tooling + Google-Translate scraper

## Data Flow

```
User Input → Vue Router → Pinia Store → ElectronAPI (IPC)
  → Main Process → Browser Manager → Puppeteer → Chrome/Firefox
Conversation commands: Web → shared Zod validation → agent WebSocket `/api/events` → shared Zod validation → deepagents → MCP → browser (CDP)
Conversation events: upstream LLM SSE → canonical run events → agent WebSocket → Web; thinking/content fragments stay in active-run memory and are merged into JSONL only at completion boundaries
Conversation metadata/files: Web → agent HTTP CRUD
Local task state: agent WebSocket → Web（task logs + task execution + task monitor）
Cross-client task state: Web → roxy-agent-server HTTP（cached definitions + live Redis lease）
```

## Key Technologies
- Electron 40.10.5
- Vue 3.5.25 + Vue Router 5 + Pinia 3
- PrimeVue 4.5.4 (UI) + UnoCSS
- Puppeteer Core 24.36.1
- TypeScript 6 + Vite 8 + Webpack 5
- Turbo (build orchestration), pnpm 10.18.3, Node ≥ 22.20
- Agent: deepagents / LangChain, MCP (@modelcontextprotocol/sdk)
```
