# Dependencies & Integrations

<!-- Generated: 2026-03-09 | Files scanned: 60+ | Token estimate: ~800 -->

## External Services

### Backend API
- Host: Configured via ROXY_API_HOST env var
- Authentication: Bearer token (stored in electron-store)
- OpenAPI spec: packages/backend-api/

### Payment Integration
- Stripe: @stripe/stripe-js
- Payment flow: apps/web/src/views/pay/

### Analytics
- Mixpanel: mixpanel-browser
- Sentry: @sentry/electron, @sentry/vue
- Event tracking in web app

### Live Chat
- LiveChat: @livechat/widget-vue
- Customer support widget

## AI & Automation

### Roxy Agent (packages/roxy-agent/)
- LangGraph-based orchestrator
- Two modes: Simple (single agent), Orchestrator (multi-agent)
- LLM providers: SiliconFlow, DashScope, OpenRouter, custom
- Context management with auto-summarization

### MCP Servers

**Playwright MCP (packages/roxybrowser-playwright-mcp/)**
- Browser automation via Playwright
- Tools: navigate, click, fill, snapshot, extract
- Multiple browser modes: persistent, isolated, CDP, remote

**OpenAPI MCP (packages/roxybrowser-mcp-server/)**
- RoxyBrowser API integration
- Profile management, browser control

### MCP Integration Flow
```
Roxy Agent → McpManager → Playwright MCP → Browser
                       → OpenAPI MCP → Backend API
```

## Browser Automation

### Puppeteer Core
- Version: 24.36.1
- Chrome/Chromium control
- CDP (Chrome DevTools Protocol) integration

### Chrome Remote Interface
- chrome-remote-interface: CDP client
- Low-level browser control

## Shared Libraries

### Internal Packages

**@roxy/shared**
- Shared TypeScript types
- Utility functions
- Constants

**@roxy/backend-api**
- Auto-generated OpenAPI client
- Type-safe API calls

**@roxy/diskspace-native**
- Native Node.js addon (NAPI-RS)
- Disk space monitoring

**@roxy/puppeteer-google-translate**
- Translation utilities for Puppeteer

**@roxy/language-localization**
- i18n tooling
- Language file generation

### Build Tools

**@roxy/vite-plugins**
- Custom Vite plugins for web app

**@roxy/webpack-plugins**
- Custom Webpack plugins for Electron

## Third-Party Libraries

### UI & Styling
- PrimeVue 4.5.4: Component library
- UnoCSS: Utility-first CSS
- PrimeIcons: Icon set
- Motion-v: Animation library

### State & Routing
- Vue Router 5.0.3
- Pinia 3.0.4
- pinia-plugin-persistedstate: State persistence

### Utilities
- es-toolkit: Lodash alternative
- date-fns: Date manipulation
- axios: HTTP client
- zod: Schema validation
- fuse.js: Fuzzy search

### Development
- TypeScript 5.9.3
- Vite 7.3.1
- Webpack 5.104.1
- Turbo: Monorepo build orchestration
- ESLint: Linting
- tsx: TypeScript execution

## Key Configuration Files
- pnpm-workspace.yaml: Monorepo workspace definition
- turbo.json: Build pipeline configuration
- package.json: Root dependencies and scripts
- tsconfig.json: TypeScript configuration
