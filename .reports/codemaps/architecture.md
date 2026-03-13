# Architecture Overview

<!-- Generated: 2026-03-09 | Files scanned: 150+ | Token estimate: ~900 -->

## Project Type
Electron + Vue 3 monorepo with pnpm workspaces

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Roxy Browser                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │   Electron   │◄────────┤   Preload    │                  │
│  │   Main       │  IPC    │   Scripts    │                  │
│  │   Process    │─────────►              │                  │
│  └──────┬───────┘         └──────┬───────┘                  │
│         │                        │                           │
│         │                        ▼                           │
│         │              ┌──────────────────┐                  │
│         │              │   Vue 3 Web App  │                  │
│         │              │   (Renderer)     │                  │
│         │              └──────────────────┘                  │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────┐                │
│  │  Browser Manager (Puppeteer Core)       │                │
│  │  - Profile Management                   │                │
│  │  - Cookie Management                    │                │
│  │  - Fingerprint Handling                 │                │
│  └─────────────────────────────────────────┘                │
│                                                               │
│  ┌─────────────────────────────────────────┐                │
│  │  MCP Server (Model Context Protocol)    │                │
│  │  - Playwright MCP                       │                │
│  │  - OpenAPI MCP                          │                │
│  └─────────────────────────────────────────┘                │
│                                                               │
│  ┌─────────────────────────────────────────┐                │
│  │  Roxy Agent (AI Orchestrator)           │                │
│  │  - Simple Mode (single agent)           │                │
│  │  - Orchestrator Mode (multi-agent)      │                │
│  └─────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

## Service Boundaries

### Apps
- **electron** (roxybrowserdev): Main process, IPC handlers, browser management
- **web**: Vue 3 renderer UI, state management (Pinia), routing
- **preload**: Bridge between main and renderer processes
- **tauri**: Alternative native wrapper (experimental)

### Packages
- **roxy-agent**: AI agent orchestrator with LangGraph
- **roxybrowser-playwright-mcp**: Playwright MCP server for browser automation
- **roxybrowser-mcp-server**: OpenAPI MCP server
- **backend-api**: OpenAPI client generation
- **roxy-shared**: Shared types and utilities
- **diskspace-native**: Native disk space monitoring
- **puppeteer-google-translate**: Translation utilities
- **language-localization**: i18n tooling

## Data Flow

```
User Input → Vue Router → Pinia Store → ElectronAPI (IPC)
  → Main Process → Browser Manager → Puppeteer → Chrome/Firefox
```

## Key Technologies
- Electron 40.8.0
- Vue 3.5.25 + Vue Router + Pinia
- Puppeteer Core 24.36.1
- TypeScript 5.9.3
- Vite 7.3.1 + Webpack 5.104.1
- PrimeVue 4.5.4 (UI components)
- LangGraph (AI agent orchestration)
