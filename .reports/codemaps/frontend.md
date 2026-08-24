# Frontend Architecture

<!-- Updated: 2026-08-14 | High-level codemap; source code remains authoritative -->

## Entry Points

- `apps/web/src/main.ts`: Main Vue 3 SPA; detects Electron/web mode, initializes i18n and mounts the product UI.
- `apps/web/agent-inspect/main.ts`: Separate Agent rollout inspection app, built from `agent-inspect.html`; it is not a Vue Router route in the main SPA.
- `apps/web/vite.config.mts`: Multi-page Vite inputs and the Agent Inspect development API plugin.

## Page Tree

```text
/ (main product layout)
├── /browser                     Browser profiles and shared windows
├── /projects                    Project list and details
├── /resource                    Proxies, platform accounts, extensions, labs
├── /automation                  Sync control and API/MCP entry points
├── /workspace                   Team/workspace management
├── /subscribe-plan              Subscription selection
├── /upgrade-plan                Subscription upgrade
├── /wallet                      Cost center
└── /tutorial                    Onboarding

/agent-console (dedicated Agent layout; requires Roxy_AI_Agent_All)
├── /                             New chat / Agent home
├── /c/:conversationId            Conversation detail
├── /task-manager                 Manual/scheduled tasks and execution history
├── /templates                    User templates
├── /template-store               Template marketplace
├── /roxyclaw                     IM integration settings
│   ├── /telegram
│   ├── /lark
│   ├── /slack
│   ├── /discord
│   └── /wechat
├── /credits                      Agent usage/cost (also requires Cost_Center_all)
└── /settings                     MCP server settings
```

Routes are defined in `apps/web/src/router/base-routes.ts`. The main router guards still enforce authentication, workspace type/role, permissions, and Electron/web compatibility.

## Agent Console

### Shell and Pages (`apps/web/src/views/agent-console/`)

- `index.vue`: Entry and design-token setup; shows a compatibility guard for Electron versions older than 4.0.2.
- `components/AgentConsoleShell.vue`: Dedicated shell with resizable conversation sidebar, nested `RouterView`, optional resizable Task Monitor, settings layout, and Agent update/restart handling.
- `components/AgentSidebar.vue`: New chat/navigation, template entry points, paginated conversation history, update and feedback actions.
- `pages/AgentChatRoute.vue` + `components/ChatWorkspace.vue`: New/existing conversation workspace.
- `pages/TaskManagerRoute.vue`: Scheduled/manual task definitions, runs, status and artifacts; `TaskLogDetailDrawer.vue` drills into window script logs and related Agent conversations.
- `pages/MyTemplatesRoute.vue` / `TemplateStoreRoute.vue`: User templates and marketplace templates.
- `pages/AgentRoxyClawRoute.vue` + `pages/roxy-claw/*`: Telegram, Lark/Feishu, Slack, Discord and WeChat configuration.
- `pages/AgentSettingsRoute.vue`: User MCP server management.

### Conversation State and Transport

Agent Console does not put its primary conversation state in Pinia. It uses module-scoped reactive composables so the shell, route pages and task monitor share one live Agent channel:

```text
HTTP bootstrap/CRUD ──> useAgentConsole ──> conversation/message/process models ──> Vue UI
                              ▲
/api/events WebSocket ─> useAgentChannel ─> validated events + snapshots
                              │
                              └── commands: run start/stop, approval submit,
                                  execution pause/resume/stop
```

- `composables/useAgentConsole.ts`: Main coordinator for conversation pagination/detail caches, optimistic runs, streaming text, unread state, attachments, HITL/clarification, todos, cancellation/retry and terminal reconciliation.
- `composables/useAgentChannel.ts`: Owns the single `/api/events` WebSocket. It validates both directions with `AgentChannelMessageSchema` from `@roxy/shared/channel`, reconnects with backoff, deduplicates events, detects sequence gaps and buffers execution events until initial snapshots arrive.
- `agent-channel-state.ts`: Reduces task log snapshots/changes, task execution events, task monitor snapshots and execution-center snapshots.
- `api.ts`: Conversation/file/task HTTP APIs, script description, templates and feedback.
- `agentSettingsApi.ts`: `/api/mcp/servers` CRUD, import, enable/disable and connectivity testing.

### Event Rendering and Interaction

- `historyAdapter.ts` maps persisted rollout history and canonical live run events into the same UI process model.
- `conversation-run-state.ts` handles ordering, optimistic/local-stop states and final reconciliation; `streamTextEventBuffer.ts` batches streaming text updates.
- `hitlAdapter.ts` creates approval and clarification controls.
- `AgentProcessTimeline.vue` / `AgentProcessEventList.vue` render thinking, tool calls, retries, compaction, script output, generated files and final responses.
- `AgentLifecycleTree.vue` renders nested named subagent lifecycles using `agentPath`.
- `ChatComposer.vue` and `components/chat-composer/*` handle files/folders, clipboard/drop input, project/browser-window selection, slash commands and template references.
- `TaskMonitorPanel.vue` + `composables/useTaskMonitor.ts` display live multi-window browser task state from `task_monitor.snapshot`.

## Agent Inspect

`apps/web/agent-inspect/` is a standalone local debugging UI for `roxy-agent-runtime` rollout and metrics files. Open `/agent-inspect.html` during web development; legacy `/rollout-viewer.html` redirects to it.

### Local Data Adapter

`server.ts` is registered by `createRolloutViewerDevPlugin()` and exposes development-only GET endpoints:

```text
/__agent-inspect__/sessions                  Discover rollout sessions
/__agent-inspect__/session?key=...           Read and parse one rollout.jsonl
/__agent-inspect__/metrics?conversationId=... Aggregate runtime metrics
```

- Default roots are `~/.roxy-agent-dev/sessions` and `~/.roxy-agent/sessions`; override with `ROLLOUT_VIEWER_ROOTS` or `ROXY_ROLLOUT_ROOT`.
- Session discovery recursively finds `rollout.jsonl`, parses JSONL line by line, and returns event counts, preview, timestamps, size and parse errors.
- Session keys are base64url encoded and checked against their configured root before reading.
- Session metrics come from `metrics/*.json` and include context-window pressure, compaction threshold, input/output/cache tokens and estimated DeepSeek V4 Flash cost.
- The metrics endpoint also aggregates run/tool/error/latency/context statistics and recommendations. `App.vue` currently consumes session-level context/token summaries; the aggregate API is available for further panels.

### Debugging Views

- `App.vue`: Searchable session sidebar, source roots, event counts, file metadata and summary cards for events, compaction, context usage, tokens, cache hit rate and estimated cost.
- Timeline filters: all, user input, assistant turn, tool result, thinking, content, compaction and error.
- Per-line inspectors cover user input, assistant thinking/content, tool calls and inputs, provider raw state, tool results, compaction summaries, `turn_error` phase/cause/stack and raw JSON fallback.
- `toolResult.ts`: Correlates `assistant_turn` tool calls with later `tool_result` events by tool-use ID, deriving tool name, input/output, error state and duration.

## State Management

### Pinia Stores (`apps/web/src/stores/`)

- `user.ts`: Authentication, user/payment state and token.
- `workspace.ts`, `role.ts`, `team.ts`, `permission.ts`: Workspace membership and authorization.
- `project.ts`, `proxy.ts`, `campaign.ts`: Product-domain data.
- `agent.ts`, `roxy-claw.ts`: Agent entry state and IM integration settings; live Agent conversations remain in Agent Console composables.
- `locale.ts`, `theme.ts`, `lock.ts`, `network.ts`, `tutorial.ts`: App-wide UI/runtime state.

Typical product flow: `Component -> Pinia store/API -> reactive UI`. Agent conversations instead use `HTTP + /api/events -> useAgentConsole/useAgentChannel -> process models -> UI`.

## Shared Frontend Infrastructure

- `apps/web/src/layout/`: Main product shell, sidebar and header. Agent Console uses its own shell.
- `apps/web/src/components/`: Shared `rx-*` PrimeVue wrappers, business components and icon system.
- `apps/web/src/api/`: Axios client and version/config/permission synchronization.
- `apps/web/src/electron-api-polyfill/`: `electronAPI` compatibility layer for browser-only development.
- UI stack: Vue 3, Vue Router, Pinia, PrimeVue, UnoCSS, Sass and Motion-v.

## Key Files

- `apps/web/src/router/base-routes.ts`: Main SPA routes, including the Agent Console subtree.
- `apps/web/src/views/agent-console/components/AgentConsoleShell.vue`: Agent product shell.
- `apps/web/src/views/agent-console/composables/useAgentConsole.ts`: Conversation/run state coordinator.
- `apps/web/src/views/agent-console/composables/useAgentChannel.ts`: Typed bidirectional Agent WebSocket.
- `apps/web/src/views/agent-console/agent-channel-state.ts`: Task/execution snapshot reducer.
- `apps/web/agent-inspect/App.vue`: Rollout debugging interface.
- `apps/web/agent-inspect/server.ts`: Local rollout/metrics discovery API.
- `apps/web/vite.config.mts`: Main SPA and Agent Inspect multi-page build wiring.
