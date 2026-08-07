# Dependencies & Integrations

<!-- Generated: 2026-03-26 | Files scanned: 60+ | Token estimate: ~800 -->

## External Services

### Backend API

- Host: Configured via ROXY_API_HOST env var
- Authentication: Bearer token (stored in electron-store)
- OpenAPI spec: packages/backend-api/

### Cloud Browser (NEW)

- `apps/cloud-browser-gateway`: NestJS + dockerode + ioredis + ws — per-user neko container lifecycle & WS/proxy gateway
- `apps/cloud-browser-user`: Vue neko (m1k1o/neko) WebRTC streaming client
- WebRTC media goes direct (UDP); only signaling is proxied

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

- Engine: deepagents / LangChain (code under `src/deepagents/`)
- Execution modes: `agent` (HTTP CRUD + bidirectional WebSocket) · `im` · `worker` · `sandbox`
- Conversation transport: Web sends start/stop/approval commands through `/api/events`; Agent broadcasts `conversation.run.event` fragments immediately, keeps unfinished thinking/content in active-run memory, and writes merged JSONL records at completion boundaries. Parallel worker events carry `workerId`
- WebSocket contract: client/server envelopes, task messages and canonical conversation events live in `@roxy/shared/channel`; Zod schemas drive both runtime boundary validation and inferred TypeScript types
- SSE boundary: provider streams from `/llm-proxy` are consumed inside the Agent and converted to canonical WebSocket events; Agent conversations, conversation scripts, and task scripts expose no SSE endpoint
- LLM: all traffic routed through roxy-agent-server (`/llm-proxy`); model info fetched per-run from the backend (`agentModelApi.getUserModel()`), no client-side provider enum. Currently DeepSeek via its official Anthropic-compatible API; standardizing on the Anthropic API format going forward
- Context management with auto-summarization; sandbox VM runs user scripts (`@roxy/sandbox`)
- `roxy-agent-runtime`: from-scratch Anthropic-native rewrite (WIP), separate package

### MCP Servers

**Playwright MCP (packages/roxy-playwright/)** — NEW wrapper

- Browser automation via Playwright
- Tools: navigate, click, fill, snapshot, extract

**OpenAPI MCP (packages/roxy-openapi/)** — vendored prebuilt SDK

- Bundles @roxybrowser/openapi (dist only)
- RoxyBrowser control-plane API integration

> Both `roxy-playwright` / `roxy-openapi` are vendored prebuilt bundles (no in-repo
> source). Their source repos are the sibling `roxybrowser-playwright-mcp` /
> `roxybrowser-mcp-server` projects, published to npm as `@roxybrowser/*`.

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
- `@roxy/shared/channel`: Zod schemas and inferred types shared by Agent and Web for every `/api/events` WebSocket message

**@roxy/backend-api**

- Auto-generated OpenAPI client (main product backend)
- Type-safe API calls

**@roxy/agent-api** (NEW)

- Auto-generated client for the LLM-proxy / agent backend
- Regenerate via `pnpm openapi:agent`

**@roxy/sandbox** (NEW)

- Capability modules (utils/human/llm/table/kv/debug) for the agent sandbox VM

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

- Vue Router 5.0.6
- Pinia 3.0.4
- pinia-plugin-persistedstate: State persistence

### Utilities

- es-toolkit: Lodash alternative
- date-fns: Date manipulation
- axios: HTTP client
- zod: Schema validation
- fuse.js: Fuzzy search

### Development

- TypeScript 6.x
- Vite 8.x
- Webpack 5.105.x
- Turbo: Monorepo build orchestration
- ESLint: Linting
- tsx: TypeScript execution

## Key Configuration Files

- pnpm-workspace.yaml: Monorepo workspace definition
- turbo.json: Build pipeline configuration
- package.json: Root dependencies and scripts
- tsconfig.json: TypeScript configuration
