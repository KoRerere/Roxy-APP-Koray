# Data and Storage

<!-- Updated: 2026-08-14 | Storage paths must be obtained from their owning path/config modules -->

## Desktop Configuration

RoxyBrowser does not use `electron-store`. Desktop state is a typed in-memory object (`apps/electron/src/modules/store/`) persisted by custom file logic.

- Canonical runtime/session config: `appConfig.configFile` -> Electron `sessionData/config.json`.
- The file contains AES-256-CBC encrypted JSON, is written through a temporary file + atomic rename, and falls back to defaults when absent/corrupt.
- Persisted values include auth/workspace identity, language, network/proxy mode, ports/API key, browser cache root, update preferences, window restore state and UI/runtime settings.
- Remote user config is fetched after local load, but machine-local settings such as browser cache root and desktop auto-update behavior are protected from remote overwrite.
- Minimal launcher/default-browser config: `~/.roxybrowser/config.json` in production or `~/.roxybrowser-dev/config.json` in development. It stores local API/default-browser ports and identifiers, not the full encrypted store.

Path definitions live in `apps/electron/src/constants/appConfig.ts`.

## Browser Profile Data

`store.browserCacheRootDir` defaults to `<Electron sessionData>/browser-cache` and can be moved by the user. Each browser profile uses:

```text
{browserCacheRootDir}/{dirId}/
```

- `BrowserItem.userDataDir` is the profile root for both Chrome and Firefox.
- Chrome uses `Default/Preferences`, `Default/Bookmarks`, Chromium storage/cookie files and `Local State`.
- Firefox uses `cookies.sqlite`, `places.sqlite`, sessionstore and Firefox-specific storage directories.
- Roxy-specific files include `lumi.conf`, `roxy_tabs`, `close_timestamp`, icon caches, OSS session metadata and fingerprint/runtime assets.
- Profile business metadata is backend-owned; Electron downloads/prepares local files at launch and uploads/synchronizes selected cookies/profile data as required.
- Extensions are cached under `{browserCacheRootDir}/RoxyExtensions/w_{workspaceId}`.

Do not hardcode an OS-specific profile path; use `getUserDataDirPath(dirId)` and the current store cache root.

## Web Persistence

Pinia persistence is selective, not global:

- `user.ts`: Persists selected authentication/user fields.
- `locale.ts`: Persists current language state.
- `theme.ts`: Persists theme state.
- Workspace, permission, proxy, campaign, RoxyClaw and most Agent state are refreshed or held in memory (`persist: false`).
- Agent Console conversation/run state is primarily module-scoped reactive state fed by HTTP and `/api/events`, not a persisted Pinia store.
- Agent Console also uses scoped localStorage caches for UI choices such as access mode, template catalog/home cache and composer project selection.

## Agent Data Directory (Schema v4)

Agent data is rooted at `~/.roxy-agent` in production and `~/.roxy-agent-dev` in development/test. `@roxy/shared/agent-paths` is the schema source of truth; `roxy-agent/src/core/storage/agentPaths.ts` creates the product singleton.

```text
~/.roxy-agent[-dev]/
├── .version / .migrate.lock / exit_state
├── state/
│   ├── settings.json
│   ├── index.db                         reserved session path index
│   ├── legacy/conversations.db          conversation/message/file compatibility DB
│   ├── tasks/tasks.db                   device-local task execution logs
│   ├── mcp/{servers.json,state.json,auth/}
│   └── im/threads.json
├── sessions/{id}/ or sessions/{yyyy}/{mm}/{id}/
│   ├── metadata.json
│   ├── rollout.jsonl                    durable runtime/frontend replay source
│   ├── recording.jsonl                  browser-operation recording
│   ├── checkpoint.db                    legacy-compatible per-session checkpoint
│   ├── uploads/                          historical compatibility path
│   └── browser/{screenshots,downloads,traces,snapshots}/
├── sessions/_orphaned/uploads/          uploads not yet assigned to a session
├── memory/
│   ├── MEMORY.md                        agent-maintained bounded startup index
│   └── {memory-name}.md                  flat durable memory entries
├── library/
│   ├── scripts/{slug}.ts
│   ├── scripts/{slug}.permissions.json
│   └── skills/{builtin,user,installed}/
├── workdir/{scriptSlug}/
│   ├── browser/{yyyy-mm-dd}/
│   └── logs/{yyyy-mm-dd}/{runId}.log
├── logs/{yyyy}/{mm-dd}/                  agent/subagent logs
├── cache/sse/                            migration cache only
└── tmp/
```

### SQLite Ownership

- `state/legacy/conversations.db`: `conversations`, `messages`, `files`. It remains the metadata/message compatibility store while `rollout.jsonl` is the durable runtime history and frontend replay source.
- `state/tasks/tasks.db`: `task_logs` for this device. Task definitions and schedules remain backend-owned.
- Old `checkpoint.db`, `checkpoint_{conversationId}.db`, SSE files and removed mode/image columns are migration inputs or compatibility artifacts, not the new write model.

### Runtime Persistence Rules

- Active runtime memory is in process; completed/cancelled/failed run fragments are reconciled into `rollout.jsonl`.
- Long-term memory is machine-local under `memory/`. The main Agent owns both entry files and `MEMORY.md`; the host loads only the first 200 index entries or 25 KiB for a new session, wraps them in one hidden `<memory-md>` message, and restores that snapshot after compaction without regenerating the index.
- New conversations no longer write per-turn `turns/*.jsonl`; those files are read only for legacy migration/compatibility.
- Browser artifacts under a session are deleted with that session; reusable script workspaces are keyed by script slug and survive individual runs.
- Skills have three distinct sources: shipped `builtin`, local/manual `user`, and remotely installed template `installed`.
- `src/index.ts` runs the idempotent storage migrator before Agent-mode DB modules load. `CHECKPOINT_DIR`, `AGENT_WORK_DIR` and `SKILLS_DIR` are compatibility/migration inputs, not canonical locations for new code.

## Agent Inspect Inputs

`apps/web/agent-inspect/server.ts` searches the production/development Agent roots for `rollout.jsonl` and session `metrics/*.json`, parses them read-only and exposes local Vite development endpoints. It does not mutate Agent sessions.

## Cloud Browser State

The gateway separates ephemeral coordination from persistent browser profiles:

- Redis `user_container:{userId}:{dirId}` maps a product profile to its active container/session.
- Redis `session_container:{sessionId}` stores container ports, expiry, usage deadline and auth context.
- Redis sets `allocated_ports:http` and `allocated_ports:udp` coordinate host-network port allocation.
- In-process snapshots/timers are recovery aids; Redis remains the primary live session record.
- Persistent browser data is mounted from `${DATA_DIR}/{userId}/{dirId}` into `NEKO_BROWSER_DATA_PATH` inside the container.
- Extensions and generated neko/supervisor configuration are stored beneath configured gateway data roots and mounted read-only where appropriate.
- Containers are disposable; profile volumes persist across container recreation. Startup reconciliation removes Docker containers that no longer have valid Redis session state.

## Backend-Owned Data

- Main product backend: users, workspaces, browser/profile metadata, proxies, extensions, subscriptions and cloud-browser entitlement.
- Agent backend: model metadata, templates, task definitions/schedules, remote files and LLM proxy traffic.
- Local clients cache or materialize data needed for execution, but should not redefine backend-owned records as local facts.

## Key Files

- `apps/electron/src/constants/appConfig.ts`: Desktop paths.
- `apps/electron/src/modules/store/util.ts`: Encrypted local config load/save.
- `apps/electron/src/modules/browser/browser-manager/browserItem.ts`: Profile paths/lifecycle.
- `packages/roxy-shared/src/agent-paths.ts`: Agent directory schema.
- `packages/roxy-agent/src/core/storage/migrate.ts`: Legacy storage migration.
- `packages/roxy-agent/src/database/`: Conversation and task SQLite access.
- `apps/cloud-browser-gateway/src/session/session-state.ts`: Cloud session record.
