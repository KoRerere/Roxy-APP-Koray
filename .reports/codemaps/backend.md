# Backend Architecture

<!-- Generated: 2026-03-09 | Files scanned: 80+ | Token estimate: ~850 -->

## Electron Main Process

### Entry Point
apps/electron/src/index.ts (67 lines)
- Single instance lock enforcement
- Uninstall feedback mode detection
- Module initialization via setupModules()

### Core Modules (apps/electron/src/modules/)

**app/**
- mainWindow.ts: Main window lifecycle
- tray.ts: System tray integration
- auto-start.ts: Launch on startup
- proxy-manager.ts: Proxy configuration
- uninstallFeedback.ts: Uninstall survey

**browser/**
- browser-manager/: Puppeteer browser lifecycle
  - browserItem.ts: Individual browser instance management
  - afterLaunchTask.ts: Post-launch initialization
- Profile and cookie management
- Fingerprint configuration

**ipc/**
- receiver/modules/browser.ts: Browser IPC handlers
- sender/: IPC message senders to renderer

**appServer/**
- dashboard.ts: Internal web server for packaged app
- logs/: Log file serving

**mcp/**
- MCP server integration
- Playwright and OpenAPI MCP coordination

**roxynet/**
- Network proxy management

**sync-control/**
- Profile synchronization

**updater/**
- Auto-update handling (electron-updater)

## IPC Communication

### Main → Renderer
```typescript
electronAPI.send('app:getSoftConfig') → { language, token }
electronAPI.send('browser:launch') → browserInstance
```

### Renderer → Main
```typescript
window.electronAPI.invoke('browser:create', config)
window.electronAPI.invoke('cookie:edit', cookieData)
```

## Browser Management Flow

```
User clicks "Launch Browser"
  → IPC: browser:launch
  → BrowserManager.createBrowser(profile)
  → Puppeteer.launch(chromeArgs)
  → afterLaunchTask(browserInstance)
  → Return browserInstance to renderer
```

## Key Files
- apps/electron/src/modules/browser/browser-manager/browserItem.ts (~200 lines)
- apps/electron/src/modules/ipc/receiver/modules/browser.ts (~150 lines)
- apps/electron/src/modules/store/index.ts: Persistent config storage

## Dependencies
- electron-log: Logging
- electron-updater: Auto-updates
- puppeteer-core: Browser automation
- express: Internal web server
- ws: WebSocket server
