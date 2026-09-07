import os from 'node:os'
import path from 'node:path'

/**
 * agent 数据目录 schema 版本。迁移器据此决定是否升级目录结构。
 * 设计见 docs/agent-data-directory-design.md。
 */
export const STORAGE_SCHEMA_VERSION = 4

/**
 * ~/.roxy-agent(-dev)
 */
export function resolveAgentHome(isProd?: boolean): string {
  const suffix = !isProd ? '-dev' : ''
  return path.join(os.homedir(), `.roxy-agent${suffix}`)
}

/** 文件系统安全 ID（兼容旧 conversationId 中的 / \ 空格等非法字符）。 */
export function sanitizeId(id: string): string {
  return id.replace(/[^\w-]/g, '_')
}

/** 从时间推导 {yyyy}/{mm} 分片。用于 sessions 的按月分目录。 */
export function monthShard(date: Date = new Date()): string {
  return path.join(String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, '0'))
}

/** 本地日期串 yyyy-mm-dd，用于按天滚动的日志文件名。 */
function dayStamp(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 运行日志按天分片的相对目录 {yyyy}/{mm-dd}。
 * 主 agent 与 worker 的运行日志、性能监控日志统一落在此目录下，以文件名区分来源。
 */
function runtimeLogShard(date: Date = new Date()): string {
  const y = String(date.getFullYear())
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return path.join(y, `${m}-${d}`)
}

function runtimeLogShardFromStamp(stamp: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(stamp)
  if (!match) {
    return runtimeLogShard()
  }
  return path.join(match[1], `${match[2]}-${match[3]}`)
}

/**
 * agent 全部磁盘路径的单一出口。
 * 所有 getter 只计算路径、不创建目录；写入方自行 ensureDir。
 *
 * 关于 session 分片：设计终态是 sessions/{yyyy}/{mm}/{id}（见设计文档 §2）。
 * 已有 session 的稳定定位依赖 index.db 记录的 rel_path；index.db 尚未落地前，
 * 不传 createdAt 的兼容调用仍走扁平布局 sessions/{id}。新代码创建 session 时应传 createdAt，
 * 查询已有 session 时应先读 index.db 的 rel_path。
 */
export interface AgentPaths {
  readonly home: string
  /** {home}/exit_state */
  readonly exitStateFile: string
  /** {home}/.version */
  readonly versionFile: string
  /** 多进程迁移锁 {home}/.migrate.lock */
  readonly migrateLockFile: string

  /**
   * ── state（配置与全局状态，需备份，永不自动删）
   */
  readonly stateDir: string
  readonly settingsFile: string
  readonly codexOauthConfigFile: string
  readonly mcpServersFile: string
  readonly mcpStateFile: string
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
  /** @deprecated 仅供 v1 存储迁移识别旧会话事件。 */
  sessionTurnSse: (sessionId: string, messageId: string, createdAt?: Date) => string
  sessionTurnEvents: (sessionId: string, messageId: string, createdAt?: Date) => string
  /** 仅历史会话兼容路径使用 */
  sessionCheckpointDb: (sessionId: string, createdAt?: Date) => string
  /** 历史遗留；runtime 只引用上传文件的绝对路径。 */
  sessionUploadsDir: (sessionId: string, createdAt?: Date) => string
  /** @deprecated 兼容旧录制工作区；新代码直接使用 sessionDir。 */
  sessionArtifactsDir: (sessionId: string, createdAt?: Date) => string
  /** @deprecated 兼容旧录制工作区；新代码直接使用 sessionDir。 */
  sessionRecordingDir: (sessionId: string, createdAt?: Date) => string
  sessionBrowserDir: (sessionId: string, createdAt?: Date) => string
  sessionBrowserScreenshotsDir: (sessionId: string, createdAt?: Date) => string
  sessionBrowserDownloadsDir: (sessionId: string, createdAt?: Date) => string
  sessionBrowserTracesDir: (sessionId: string, createdAt?: Date) => string
  sessionBrowserSnapshotsDir: (sessionId: string, createdAt?: Date) => string
  /** 会话级浏览器操作录制流（环境级捕获，先于任何脚本工作台存在）：sessions/{id}/recording.jsonl */
  sessionRecordingLog: (sessionId: string, createdAt?: Date) => string
  /** 无法归属 sessionId 的孤儿上传落点 */
  readonly orphanedUploadsDir: string

  /**
   * ── memory（跨会话长期记忆，由 Agent 通过文件工具维护）
   */
  readonly memoryDir: string
  readonly memoryIndexFile: string
  memoryFile: (name: string) => string

  /**
   * ── library（跨会话资产库，长期保存）
   */
  /** 脚本库根：library/scripts */
  readonly scriptsRoot: string
  /** library/scripts/{slug}.ts —— 自描述单文件脚本，文件名 slug 即身份，唯一真身 */
  scriptFile: (slug: string) => string
  /** library/scripts/{slug}.permissions.json —— host 读取的脚本权限清单 */
  scriptPermissionsFile: (slug: string) => string
  /** workdir/{slug} —— sandbox cwd 与脚本长期产物目录 */
  workdir: (slug: string) => string
  /** workdir/{slug}/browser/{yyyy-mm-dd} */
  workdirBrowserDir: (slug: string, date?: Date) => string
  /** workdir/{slug}/logs/{yyyy-mm-dd}/{runId}.log */
  workdirRunLogFile: (slug: string, runId: string, date?: Date) => string
  readonly skillsBuiltinDir: string
  readonly skillsInstalledDir: string
  readonly skillsUserDir: string

  /**
   * ── runs（兼容期遗留；新脚本数据统一走 workdir）
   */
  /** @deprecated 新代码不要再写 runs；脚本数据使用 workdir。 */
  runDir: (runId: string, createdAt?: Date) => string
  /** @deprecated 新代码使用 workdirRunLogFile(slug, runId)。 */
  runLogFile: (runId: string, createdAt?: Date) => string
  /** @deprecated 新代码使用 workdir(slug)。 */
  runWorkspaceDir: (runId: string, createdAt?: Date) => string

  /** @deprecated 仅供既有存储迁移器识别旧 browser 根目录。 */
  readonly browserDir: string

  /**
   * ── logs（可清空，按天滚动）
   *
   * 运行日志统一落 logs/{yyyy}/{mm-dd}/，按文件名区分：
   * agent.log / {workerId}.log。
   * 旧 logs/agent、logs/worker 布局不做迁移，由 retention 自然清理。
   */
  readonly logsDir: string
  runtimeLogDir: (date?: Date) => string
  agentLogFile: (date?: Date) => string
  workerLogFile: (workerId: string, date?: Date) => string
  executionLogsDir: (scope: 'agent' | 'worker') => string
  agentExecutionLogFile: (date?: Date) => string
  workerExecutionLogFile: (pid: number, date?: Date) => string
  migrationLogFile: (stamp: string) => string

  /**
   * ── cache / tmp（可再生 / 启动清空）
   */
  readonly sseCacheDir: string
  readonly tmpDir: string
  tmpScratch: (prefix: string, token: string) => string
}

export function createAgentPaths(home: string = resolveAgentHome()): AgentPaths {
  const root = path.resolve(home)
  const pathJoin = (...p: string[]): string => path.join(root, ...p)

  const sessionsRoot = (sessionId: string, _createdAt?: Date): string =>
    _createdAt
      ? pathJoin('sessions', monthShard(_createdAt), sanitizeId(sessionId))
      : pathJoin('sessions', sanitizeId(sessionId))
  const runsRoot = (runId: string, _createdAt?: Date): string =>
    pathJoin('runs', sanitizeId(runId))
  return {
    home: root,
    exitStateFile: pathJoin('exit_state'),
    versionFile: pathJoin('.version'),
    migrateLockFile: pathJoin('.migrate.lock'),

    stateDir: pathJoin('state'),
    settingsFile: pathJoin('state', 'settings.json'),
    codexOauthConfigFile: pathJoin('state', 'codex-oauth.json'),
    mcpServersFile: pathJoin('state', 'mcp', 'servers.json'),
    mcpStateFile: pathJoin('state', 'mcp', 'state.json'),
    mcpAuthDir: pathJoin('state', 'mcp', 'auth'),
    imThreadsFile: pathJoin('state', 'im', 'threads.json'),
    tasksDir: pathJoin('state', 'tasks'),
    tasksDb: pathJoin('state', 'tasks', 'tasks.db'),
    legacyDir: pathJoin('state', 'legacy'),
    legacyConversationsDb: pathJoin('state', 'legacy', 'conversations.db'),
    indexDb: pathJoin('state', 'index.db'),

    sessionDir: (id, at) => sessionsRoot(id, at),
    sessionRollout: (id, at) => path.join(sessionsRoot(id, at), 'rollout.jsonl'),
    sessionMetadata: (id, at) => path.join(sessionsRoot(id, at), 'metadata.json'),
    sessionTurnSse: (id, messageId, at) => path.join(sessionsRoot(id, at), 'turns', `${sanitizeId(messageId)}.sse`),
    sessionTurnEvents: (id, messageId, at) => path.join(sessionsRoot(id, at), 'turns', `${sanitizeId(messageId)}.jsonl`),
    sessionCheckpointDb: (id, at) => path.join(sessionsRoot(id, at), 'checkpoint.db'),
    sessionUploadsDir: (id, at) => path.join(sessionsRoot(id, at), 'uploads'),
    sessionArtifactsDir: (id, at) => path.join(sessionsRoot(id, at), 'artifacts'),
    sessionRecordingDir: (id, at) => path.join(sessionsRoot(id, at), 'recording'),
    sessionBrowserDir: (id, at) => path.join(sessionsRoot(id, at), 'browser'),
    sessionBrowserScreenshotsDir: (id, at) => path.join(sessionsRoot(id, at), 'browser', 'screenshots'),
    sessionBrowserDownloadsDir: (id, at) => path.join(sessionsRoot(id, at), 'browser', 'downloads'),
    sessionBrowserTracesDir: (id, at) => path.join(sessionsRoot(id, at), 'browser', 'traces'),
    sessionBrowserSnapshotsDir: (id, at) => path.join(sessionsRoot(id, at), 'browser', 'snapshots'),
    sessionRecordingLog: (id, at) => path.join(sessionsRoot(id, at), 'recording.jsonl'),
    orphanedUploadsDir: pathJoin('sessions', '_orphaned', 'uploads'),

    memoryDir: pathJoin('memory'),
    memoryIndexFile: pathJoin('memory', 'MEMORY.md'),
    memoryFile: name => pathJoin('memory', `${sanitizeId(name)}.md`),

    scriptsRoot: pathJoin('library', 'scripts'),
    scriptFile: slug => pathJoin('library', 'scripts', `${sanitizeId(slug)}.ts`),
    scriptPermissionsFile: slug => pathJoin('library', 'scripts', `${sanitizeId(slug)}.permissions.json`),
    workdir: slug => pathJoin('workdir', sanitizeId(slug)),
    workdirBrowserDir: (slug, date) => pathJoin('workdir', sanitizeId(slug), 'browser', dayStamp(date)),
    workdirRunLogFile: (slug, runId, date) => pathJoin('workdir', sanitizeId(slug), 'logs', dayStamp(date), `${sanitizeId(runId)}.log`),
    skillsBuiltinDir: pathJoin('library', 'skills', 'builtin'),
    skillsInstalledDir: pathJoin('library', 'skills', 'installed'),
    skillsUserDir: pathJoin('library', 'skills', 'user'),

    runDir: (id, at) => runsRoot(id, at),
    runLogFile: (id, at) => path.join(runsRoot(id, at), 'run.log'),
    runWorkspaceDir: (id, at) => path.join(runsRoot(id, at), 'workspace'),

    browserDir: pathJoin('browser'),

    executionLogsDir: scope => pathJoin('logs', runtimeLogShard(), scope),
    agentExecutionLogFile: date => pathJoin('logs', runtimeLogShard(date), 'agent.jsonl'),
    workerExecutionLogFile: (pid, date) => pathJoin('logs', runtimeLogShard(date), `worker-${pid}.jsonl`),
    runtimeLogDir: date => pathJoin('logs', runtimeLogShard(date)),
    agentLogFile: date => pathJoin('logs', runtimeLogShard(date), 'agent.log'),
    workerLogFile: (workerId, date) => pathJoin('logs', runtimeLogShard(date), `${sanitizeId(workerId)}.log`),
    migrationLogFile: stamp => pathJoin('logs', runtimeLogShardFromStamp(stamp), `migration-${stamp}.log`),
    logsDir: pathJoin('logs'),

    sseCacheDir: pathJoin('cache', 'sse'),
    tmpDir: pathJoin('tmp'),
    tmpScratch: (prefix, token) => pathJoin('tmp', `${prefix}-${token}`),
  }
}

/** shared 只暴露纯路径工厂；各项目按自己的运行环境创建单例。 */
// export const agentPaths: AgentPaths = createAgentPaths()
