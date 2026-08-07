# RoxyAgent 数据目录设计

> 状态：设计稿 v1 ｜ 2026-07-08
> 范围：`packages/roxy-agent`（现役 deepagents 引擎）与 `packages/roxy-agent-runtime`（未来替代引擎）共用的统一数据存储结构。

---

## 1. 根目录的确定

`~/.roxy-agent`（dev 构建用 `~/.roxy-agent-dev`）；

## 2. 目录结构

```
$ROXY_AGENT_HOME/
├── .version                               # 存储 schema 版本号（如 "1"），启动时做迁移
│
├── state/                                 # ── 配置与全局状态（小、关键、可备份）
│   ├── settings.json                      # agent 全局设置
│   ├── mcp/
│   │   ├── servers.json                   # 合并现 mcp_servers.json + mcp_state.json
│   │   └── auth/                          # 未来 MCP OAuth token 等（文件权限 0600）
│   ├── im/
│   │   └── threads.json                   # IM 线程映射（原在系统下载目录）
│   ├── tasks/
│   │   └── tasks.db                       # 当前设备任务执行日志（task_logs）
│   ├── legacy/
│   │   └── conversations.db               # deepagents 消息正文（退役后随代码清理）
│   └── index.db                           # 全局索引库：sessions / scripts / runs 元数据
│                                          #   （替代 conversations.db 的索引职责，正文不进库）
│
├── sessions/                              # ── 对话记录（session 为中心）
│   └── {yyyy}/{mm}/{sessionId}/           # 按月分片，避免单目录万级子目录
│       ├── rollout.jsonl                  # (仅 runtime) 事件流，格式 = runtime RolloutEvent
│       ├── metadata.json                  # engine、workspaceId、标题、模式、模型、统计、时间
│       ├── checkpoint.db                  # (仅 deepagents) LangGraph checkpoint，随目录删
│       ├── uploads/                       # ⚠️ deepagents 遗留：用户上传附件。新引擎只引用文件绝对路径，
│       │                                  #   不再复制进工作目录；deepagents 退役后删除
│       ├── browser/                       # 会话级浏览器 MCP 输出（随会话目录一起删）
│       │   ├── screenshots/*              # 截图
│       │   ├── downloads/*                # 浏览器触发下载的落地区（不再写系统 Downloads）
│       │   ├── traces/*                   # trace / har / video
│       │   └── snapshots/[n].html         # html-snapshots（debug 用）
│       ├── recording.jsonl                # 浏览器操作录制流（环境级捕获，先于脚本工作台）
│       ├── operation_summary.md           # 录制事实 + DOM 上下文（record 时）
│
├── library/                               # ── 用户资产库（跨会话、长期保存）
│   ├── scripts/                           # 脚本库
│   │       ├── [slug].ts                  # 脚本正文（并且自带描述，params 入参信息 和 meta 脚本基础信息）
│   │       └── [slug].permissions.json    # 权限清单：fs 读白名单 + fetch 域名白名单（见「脚本权限模型」）。
│   │                                      #   与正文并列、在 sandbox cwd 之外，脚本运行期无写权、改不了自己的门禁
│   └── skills/
│       ├── builtin/                       # agent 内置 skills 存放位置
│       ├── installed/                     # 用户在 skills store 里安装的 skills
│       └── user/                          # 用户自己上传的 skills
│
├── workdir/                               # ── 脚本运行时工作区（cwd = workdir/[slug]）
│   └── [slug]                             # 脚本的 slug，sandbox 中 process.cwd() = workdir/[slug]
│       ├── kv.json                        # 产物：sandbox kv JSON（持久，有价值不可删）
│       ├── table.csv                      # 产物：sandbox table CSV（持久，有价值不可删）
│       ├── browser/{yyyy-mm-dd}/          # 脚本执行期 playwright 产物（截图/下载/trace），按天分片可轮转
│       ├── logs/{yyyy-mm-dd}/{runId}.log  # 脚本运行日志（含 sandbox 输出），按天分片，随脚本受控于此
│       └── ...                            # 可能会有其他的
│
├── logs/                                  # ── 运行日志（可随时清空）
│   ├── agent/{yyyy-mm-dd}.log             # 按天滚动，替代 {mode}.log + {mode}.2.log；im 模式已并入 agent
│   └── worker/{yyyy-mm-dd}/{pid}.log      # orchestrator 子进程，带日期便于统一清理超过 7 天的日志
│                                          #   （脚本日志见 assets/[slug]/logs/，与脚本一同受文件权限管控）
│
├── cache/                                 # ── 可再生数据（删除无损）
│   ├── sse/                               # SSE 断线续传持久化（原 sse/）
│   └── static/                            # 静态资源缓存（原 static/）
│
└── tmp/                                   # ── 临时区（启动时清空）
    └── skill-extract-*/                   # zip 解压校验等
```

## `agent-paths.ts` API 草案

落点：`packages/roxy-shared/src/agent-paths.ts` 暴露纯工厂；各项目在自己的边界内用 `createAgentPaths(resolveAgentHome(isProd))` 创建单例。

```ts
import os from 'node:os'
// packages/roxy-shared/src/agent-paths.ts
import path from 'node:path'

export const STORAGE_SCHEMA_VERSION = 1

/** 解析数据根：生产 ~/.roxy-agent，非生产 ~/.roxy-agent-dev。 */
export function resolveAgentHome(isProd?: boolean): string {
  const suffix = !isProd ? '-dev' : ''
  return path.join(os.homedir(), `.roxy-agent${suffix}`)
}

/** 文件系统安全 ID（兼容旧 conversationId 中的 / \ 等） */
export function sanitizeId(id: string): string {
  return id.replace(/[^\w-]/g, '_')
}

/** 从 ULID/时间戳推导 {yyyy}/{mm} 分片；无法推导时用当前时间 */
export function monthShard(date: Date = new Date()): string {
  return path.join(String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, '0'))
}

export interface AgentPaths {
  readonly home: string
  /** {home}/.version */
  readonly versionFile: string
  /** 多进程迁移锁 {home}/.migrate.lock */
  readonly migrateLockFile: string

  /**
   * ── state（配置与全局状态，需备份，永不自动删）
   */
  readonly stateDir: string
  readonly settingsFile: string
  readonly mcpServersFile: string
  readonly mcpAuthDir: string
  readonly imThreadsFile: string
  readonly tasksDir: string
  readonly tasksDb: string
  readonly legacyDir: string
  readonly legacyConversationsDb: string
  readonly indexDb: string

  /**
   * ── sessions（对话记录，session 为中心）
   */
  sessionDir: (sessionId: string, createdAt?: Date) => string
  sessionRollout: (sessionId: string, createdAt?: Date) => string
  sessionMetadata: (sessionId: string, createdAt?: Date) => string
  /** 仅 deepagents 会话使用 */
  sessionCheckpointDb: (sessionId: string, createdAt?: Date) => string
  /** ⚠️ deepagents 遗留：上传附件目录。新引擎只引用绝对路径，退役后删除 */
  sessionUploadsDir: (sessionId: string, createdAt?: Date) => string
  sessionArtifactsDir: (sessionId: string, createdAt?: Date) => string
  /** 会话级浏览器 MCP 输出根：sessions/{id}/browser（随会话目录删） */
  sessionBrowserDir: (sessionId: string, createdAt?: Date) => string
  sessionBrowserScreenshotsDir: (sessionId: string, createdAt?: Date) => string
  sessionBrowserDownloadsDir: (sessionId: string, createdAt?: Date) => string
  sessionBrowserTracesDir: (sessionId: string, createdAt?: Date) => string
  sessionBrowserSnapshotsDir: (sessionId: string, createdAt?: Date) => string
  sessionRecordingDir: (sessionId: string, createdAt?: Date) => string
  /** 会话级浏览器操作录制流（环境级捕获，先于任何脚本工作台存在）：sessions/{id}/recording.jsonl */
  sessionRecordingLog: (sessionId: string, createdAt?: Date) => string
  /** record_script 生成的录制事实（只读，供 agent 读）：sessions/{id}/recording-summary.md */
  sessionRecordingSummary: (sessionId: string, createdAt?: Date) => string
  /** record_script 最近为该会话生成的库脚本 slug 标记：sessions/{id}/recorded-slug.txt */
  sessionRecordedSlug: (sessionId: string, createdAt?: Date) => string
  /** 无法归属 sessionId 的孤儿上传落点（⚠️ deepagents 遗留，退役后删除） */
  readonly orphanedUploadsDir: string

  /**
   * ── library（跨会话资产库，长期保存）
   */
  /** 脚本库根：library/scripts */
  readonly scriptsRoot: string
  /** library/scripts/{slug}.ts —— 自描述单文件脚本，文件名 slug 即身份，唯一真身 */
  scriptFile: (slug: string) => string
  /** library/scripts/{slug}.permissions.json —— 脚本权限清单，runner 在 fork sandbox 前读入 host 内存 */
  scriptPermissionsFile: (slug: string) => string
  /** 脚本工作区根：workdir/{slug}（sandbox cwd，脚本文件读写权限即锚定于此） */
  workdir: (slug: string) => string
  /** 脚本执行期 playwright 产物：workdir/{slug}/browser/{yyyy-mm-dd}（按天分片，可轮转清理） */
  workdirBrowserDir: (slug: string, date?: Date) => string
  /** 脚本运行日志：workdir/{slug}/logs/{yyyy-mm-dd}/{runId}.log（含 sandbox 输出，受工作区权限管控） */
  workdirRunLogFile: (slug: string, runId: string, date?: Date) => string
  readonly skillsBuiltinDir: string
  readonly skillsInstalledDir: string
  readonly skillsUserDir: string

  /**
   * ── runs（脚本执行记录，按保留期滚动）
   */
  runDir: (runId: string, createdAt?: Date) => string
  runLogFile: (runId: string, createdAt?: Date) => string
  runWorkspaceDir: (runId: string, createdAt?: Date) => string

  /**
   * ── logs（可清空，按天滚动）
   */
  readonly logsDir: string
  /** 按天滚动日志；im 模式已并入 agent */
  logFile: (scope: 'agent', date?: Date) => string
  /** orchestrator 子进程日志（脚本/sandbox 日志改走 workdir/{slug}/logs/{yyyy-mm-dd}/{runId}.log） */
  pidLogFile: (scope: 'worker', pid: number) => string
  migrationLogFile: (stamp: string) => string

  /**
   * ── cache / tmp（可再生 / 启动清空）
   */
  readonly sseCacheDir: string
  readonly staticCacheDir: string
  readonly tmpDir: string
  tmpScratch: (prefix: string, token: string) => string
}

export function createAgentPaths(home = resolveAgentHome()): AgentPaths { /* ... */ }

/** 进程级单例（agent 各 mode 直接用） */
export const agentPaths: AgentPaths = createAgentPaths()
```

使用约定：

- 业务代码 **禁止** 手写 `path.join(env.CHECKPOINT_DIR, ...)`，一律 `agentPaths.xxx`；
- 所有 getter 只算路径不建目录；写入方用统一的 `ensureDir(agentPaths.xxx)`；
- 查询已存在的 session/run：先查 `index.db` 中记录的相对路径（`sessions/2026/07/abc`），再 join `home` —— 避免"创建时间推导分片"在跨月边界出错。

### index.db 表草案

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, engine TEXT NOT NULL,       -- 'deepagents' | 'runtime'，续聊路由依据
  workspace_id TEXT NOT NULL,      -- Roxy workspace 隔离：前端切换 workspace 后按此过滤
  title TEXT, mode TEXT, model TEXT,
  locked INTEGER DEFAULT 0,        -- deepagents 退役期置 1 = 只读
  rel_path TEXT NOT NULL,          -- 'sessions/2026/07/{id}'
  created_at INTEGER, updated_at INTEGER, message_count INTEGER
);
CREATE INDEX idx_sessions_ws ON sessions(workspace_id, updated_at);
CREATE TABLE scripts (
  id TEXT PRIMARY KEY, name TEXT, dir_id TEXT, remote_id TEXT,
  workspace_id TEXT NOT NULL,
  rel_path TEXT NOT NULL,          -- 'library/scripts/{id}'
  source_session_id TEXT, created_at INTEGER, updated_at INTEGER
);
CREATE TABLE runs (
  id TEXT PRIMARY KEY, script_id TEXT, status TEXT, exit_code INTEGER,
  workspace_id TEXT NOT NULL,
  rel_path TEXT NOT NULL,          -- 'runs/2026/07/{id}'
  started_at INTEGER, finished_at INTEGER
);
```

> 注：
>
> - `rel_path` 永远相对 `home` 存储，保证整个数据目录可搬迁（换机器/改 userData 路径不失效）。
> - `workspace_id` 同时冗余写入各自的 `metadata.json` —— index.db 必须可以通过扫描目录 + 读 metadata.json 完整重建，列过滤不是唯一真相。

### workspace 隔离（视图级）

Roxy workspace 隔离采用**逻辑过滤而非物理分目录**：sessions / scripts / runs / task_logs 均带 `workspace_id`，前端切换 workspace 后所有列表查询按此过滤，只能看到当前 workspace 的数据。任务定义保存在后端，`tasks.db` 只保存当前设备的运行记录；`skills`、MCP 配置、`settings` 为全局共享，不做隔离。

这满足"同机同登录用户下多 workspace 互不干扰"的需求；物理分目录（`workspaces/{wsId}/`）仅在未来需要**按 workspace 独立导出/删除/加密**时再考虑，`createAgentPaths(home)` 保留该改造点。

---

## 脚本权限模型

sandbox 需要放开一定能力（读某些文件、fetch 某些域名），但脚本自身**不能**篡改或绕过这道门禁。

### 清单文件 `library/scripts/{slug}.permissions.json`

```jsonc
{
  "version": 1,
  "fs": {
    // 启动sandbox的时候，--allow-fs-read 传进去的值
    "read": [
      "/Users/foo/data/",
      "/abs/path/to/"
    ]
    // 注：workdir/{slug} 自身默认可读写，不必登记；write 暂不开放（后续需要再加 "write" 组）
  },
  "fetch": {
    // 允许 fetch 请求的域名白名单（精确域名或前缀通配 *.example.com）
    // Node 24 尚不支持 --allow-net，当前由 sandbox 注入的 fetch 强制校验
    "allow": [
      "api.example.com",
      "*.googleapis.com"
    ]
  }
}
```

### 强制机制

- runner 在 fork sandbox 前读取 `permissions.json`；脚本无法写这个位于 `library/scripts/` 的清单。
- sandbox 注入原生 Node `fs` / `fs/promises`，不重写 `readFile` 等 API。
- runner 使用 Node `--permission` 启动子进程，将 `workdir/{slug}` 和 `fs.read[]` 逐项加入 `--allow-fs-read`；只将工作目录与当前日志加入 `--allow-fs-write`。
- 脚本没有 `require`，也不注入 `net` / `http` / `https`。`fetch.allow[]` 当前由注入 VM 的 `fetch` 闭包校验；Node 提供网络权限参数后再迁移到进程参数。

### 授权来源
- 清单由**用户在 UI 授权**或脚本安装/录制时生成写入（host 侧写，脚本无写权）。
- fetch 白名单与 fs read 白名单均**默认空**（deny-by-default）；未授权即拒。

---
