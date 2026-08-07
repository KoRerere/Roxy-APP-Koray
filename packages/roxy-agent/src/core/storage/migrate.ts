import { agentPaths } from '@/core/storage/agentPaths'
import type { AgentConversationRunEventDTO, AgentRunEvent } from '@roxy/shared/channel'
import { sanitizeId, STORAGE_SCHEMA_VERSION } from '@roxy/shared/agent-paths'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { decodeLegacySse } from '@/core/agent-events/sseDecoder'

/**
 * 存储结构迁移器：把旧的 CHECKPOINT_DIR / AGENT_WORK_DIR / SKILLS_DIR / DOWNLOADS_DIR 布局
 * 一次性归位到 ROXY_AGENT_HOME 的新结构（见 docs/agent-data-directory-design.md）。
 *
 * 设计（v3，两阶段 + 进度可观测）：
 * - **以 conversations.db 为唯一真相**：枚举库中现存的每条会话及其引用的附属文件（SSE、上传附件、
 *   生成资产、checkpoint），只搬这些。日志与脚本草稿不迁移，迁移时直接清理。
 * - **SQLite 一律用 `VACUUM INTO` 固化复制**：以读写方式打开源库、回放 WAL、写出不含 -wal/-shm 的
 *   干净单文件。杜绝旧版"主文件与 -wal 被拆开搬、数据留在半路"的丢数据缺陷。
 * - **两阶段，避免大件迁移阻塞服务启动**：
 *   · 阶段 1（同步，必须在 conversations/schedules DB 模块打开前完成）：建骨架 + 固化这两个
 *     **在 import 期就被打开**的小库 + 枚举会话清单算出总进度。毫秒级，几乎不感知。
 *   · 阶段 2（后台异步，setImmediate 排队）：搬大 checkpoint 库（懒加载，可数百 MB）、SSE、上传、
 *     全局域、删源。每个重活之间让出事件循环，使 HTTP/WebSocket server 能继续处理已有连接；
 *     统一信道会等迁移完成后再发送初始快照和 `channel.ready`。单个大库固化是同步的，期间会短暂占用事件循环。
 * - **复制而非移动 + 校验后删源**：迁移全程源目录完整；固化完成并校验目标库行数（≥ 源且 > 0）后才删源。
 * - 幂等：由 {home}/.version 守卫（阶段 2 完成后才写版本号）；目标文件已存在则跳过。
 * - 不抛出：任何单步失败都记入迁移日志并继续，绝不阻断 agent 启动。
 */

// ==================== 迁移状态（供启动流程与统一信道读取）====================

export type MigrationState = 'idle' | 'running' | 'done' | 'error' | 'skipped'

export interface MigrationStatus {
  /** 总体状态。统一信道会等待 running 结束后再发送初始快照。 */
  state: MigrationState
  /** 当前阶段：phase1（同步小库）/ phase2（后台大件搬迁）/ events（会话事件转换）。 */
  phase: 'phase1' | 'phase2' | 'events' | null
  /** 阶段 2 待处理工作单元总数（会话 + SSE + 上传文件 + 全局项）。 */
  total: number
  /** 已完成工作单元数。 */
  done: number
  /** 当前正在处理的项（人类可读，用于文案展示）。 */
  currentLabel: string
  startedAt: number | null
  finishedAt: number | null
  error?: string
}

const status: MigrationStatus = {
  state: 'idle',
  phase: null,
  total: 0,
  done: 0,
  currentLabel: '',
  startedAt: null,
  finishedAt: null,
}

/** 迁移状态只读快照（返回拷贝，防止调用方改到内部状态）。 */
export function getMigrationStatus(): MigrationStatus {
  return { ...status }
}

// ==================== 日志 & 基础工具 ====================

function log(lines: string[], msg: string): void {
  lines.push(`[${new Date().toISOString()}] ${msg}`)
  console.log(`[storage-migrate] ${msg}`)
}

/** 确保目录存在。 */
function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

/** 让出事件循环一拍，使 HTTP/WebSocket server 有机会处理已有连接。 */
function yieldTick(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}

/** 复制单个文件；源不存在或目标已存在则跳过（保护先到的数据）。 */
function copyFile(src: string, dest: string, lines: string[]): boolean {
  try {
    if (!fs.existsSync(src))
      return false
    if (fs.existsSync(dest))
      return false
    ensureDir(path.dirname(dest))
    fs.copyFileSync(src, dest)
    return true
  }
  catch (err) {
    log(lines, `复制文件失败 ${src} → ${dest}：${(err as Error).message}`)
    return false
  }
}

/** 删除旧布局里明确无需迁移的数据；不存在则跳过。 */
function removePath(target: string, lines: string[], label: string): boolean {
  try {
    if (!fs.existsSync(target))
      return false
    const resolved = path.resolve(target)
    if (resolved === path.parse(resolved).root || resolved === agentPaths.home) {
      log(lines, `删除跳过（路径不安全）：${resolved}`)
      return false
    }
    fs.rmSync(resolved, { recursive: true, force: true })
    log(lines, `已删除${label}：${resolved}`)
    return true
  }
  catch (err) {
    log(lines, `删除${label}失败（忽略）：${target}：${(err as Error).message}`)
    return false
  }
}

function isSameOrChild(target: string, parent: string): boolean {
  const resolvedTarget = path.resolve(target)
  const resolvedParent = path.resolve(parent)
  return resolvedTarget === resolvedParent || resolvedTarget.startsWith(resolvedParent + path.sep)
}

/**
 * 检查路径是否为用户的敏感系统目录，防止误删用户数据。
 */
function isDangerousUserDirectory(dir: string): boolean {
  const resolved = path.resolve(dir)
  const homeDir = process.env.HOME || process.env.USERPROFILE

  if (!homeDir)
    return false

  // 危险的用户目录列表
  const dangerousDirs = [
    path.join(homeDir, 'Downloads'),
    path.join(homeDir, 'Documents'),
    path.join(homeDir, 'Desktop'),
    path.join(homeDir, 'Pictures'),
    path.join(homeDir, 'Music'),
    path.join(homeDir, 'Videos'),
    path.join(homeDir, 'Library'),
    homeDir, // 用户主目录本身
  ]

  // 检查是否是危险目录本身或其父目录
  for (const dangerousDir of dangerousDirs) {
    const resolvedDangerous = path.resolve(dangerousDir)
    if (resolved === resolvedDangerous || isSameOrChild(resolvedDangerous, resolved))
      return true
  }

  return false
}

/**
 * Electron 现在会把 AGENT_WORK_DIR / SKILLS_DIR 兼容变量指向 agent-bin 包目录。
 * 迁移清理旧布局时只保留启动必需文件，其他旧数据仍要删除。
 */
function isAgentPackageDir(dir: string): boolean {
  const agentScriptPath = process.env.AGENT_SCRIPT_PATH
  return Boolean(agentScriptPath && isSameOrChild(agentScriptPath, dir))
}

function cleanupAgentPackageDir(dir: string, lines: string[]): void {
  const keepFiles = new Set(['roxy-agent.mjs', 'version'])
  for (const name of fs.readdirSync(dir)) {
    if (keepFiles.has(name))
      continue

    const target = path.join(dir, name)
    try {
      fs.rmSync(target, { recursive: true, force: true })
      log(lines, `已删除 agent 包目录旧项：${target}`)
    }
    catch (err) {
      log(lines, `删除 agent 包目录旧项失败（忽略）：${target}：${(err as Error).message}`)
    }
  }
}

/** 递归复制整个目录（目标已存在则跳过整树，避免半迁状态互相覆盖）。 */
function copyDir(src: string, dest: string, lines: string[]): boolean {
  try {
    if (!fs.existsSync(src) || !fs.statSync(src).isDirectory())
      return false
    if (fs.existsSync(dest))
      return false
    ensureDir(path.dirname(dest))
    fs.cpSync(src, dest, { recursive: true })
    return true
  }
  catch (err) {
    log(lines, `复制目录失败 ${src} → ${dest}：${(err as Error).message}`)
    return false
  }
}

/**
 * 用 `VACUUM INTO` 把一个 SQLite 库固化复制到 destDb。
 * VACUUM INTO 以读写方式打开源库、回放尚未 checkpoint 的 -wal，写出**不含 sidecar 的完整单文件**，
 * 源库不被修改。因此无论源处于何种 WAL 状态都不会丢数据。源不存在或目标已存在则跳过。
 */
function consolidateSqlite(srcDb: string, destDb: string, lines: string[]): boolean {
  if (!fs.existsSync(srcDb))
    return false
  if (fs.existsSync(destDb)) {
    log(lines, `跳过（目标已存在）：${destDb}`)
    return false
  }
  ensureDir(path.dirname(destDb))
  let db: DatabaseSync | undefined
  try {
    db = new DatabaseSync(srcDb)
    // VACUUM INTO 的目标路径必须是字面量，不能参数绑定；转义单引号。
    db.exec(`VACUUM INTO '${destDb.replace(/'/g, '\'\'')}'`)
    log(lines, `固化复制 DB ${srcDb} → ${destDb}`)
    return true
  }
  catch (err) {
    log(lines, `固化复制 DB 失败 ${srcDb} → ${destDb}：${(err as Error).message}`)
    // 失败不留半成品，避免下次误判"目标已存在"而跳过。
    try {
      fs.rmSync(destDb, { force: true })
    }
    catch {}
    return false
  }
  finally {
    try {
      db?.close()
    }
    catch {}
  }
}

/** 读取某表行数（读写打开以回放 WAL；表不存在/打开失败视为 0）。用于删源前的完整性校验。 */
function rowCount(dbPath: string, table: string): number {
  if (!fs.existsSync(dbPath))
    return 0
  let db: DatabaseSync | undefined
  try {
    db = new DatabaseSync(dbPath)
    const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number } | undefined
    return row ? Number(row.n) : 0
  }
  catch {
    return 0
  }
  finally {
    try {
      db?.close()
    }
    catch {}
  }
}

/** 从一条 message.metadata 里提取用户上传附件的 fileId 列表（结构容错）。 */
function attachmentFileIds(metadata: string | null): string[] {
  if (!metadata)
    return []
  try {
    const atts = JSON.parse(metadata)?.attachments
    if (!Array.isArray(atts))
      return []
    const ids: string[] = []
    for (const a of atts) {
      const fid = a?.fileId ?? a?.file_id
      if (typeof fid === 'string' && fid)
        ids.push(fid)
    }
    return ids
  }
  catch {
    return []
  }
}

// ==================== 会话清单 ====================

interface MigrationPlan {
  oldCheckpoint: string
  /** 库中现存会话 id（原始，未 sanitize）。 */
  sessionIds: string[]
  /** SSE 原文件 basename（cache/sse/{basename}）。 */
  sseBasenames: string[]
  /** 上传/资产文件 id（sessions/_orphaned/uploads/{fileId}）。 */
  fileIds: string[]
}

/**
 * 从已固化的 legacy conversations.db 枚举会话与所有被引用的附属文件，产出阶段 2 的搬迁清单。
 * 读固化后的副本（已回放 WAL 的干净单文件），而非源库。任一步失败返回空清单（阶段 2 无事可做）。
 */
function collectPlan(oldCheckpoint: string, lines: string[]): MigrationPlan {
  const plan: MigrationPlan = { oldCheckpoint, sessionIds: [], sseBasenames: [], fileIds: [] }
  const legacy = agentPaths.legacyConversationsDb
  if (!fs.existsSync(legacy))
    return plan

  const sse = new Set<string>()
  const files = new Set<string>()
  let db: DatabaseSync | undefined
  try {
    db = new DatabaseSync(legacy)
    for (const row of db.prepare('SELECT id FROM conversations').all() as Array<{ id: string }>) {
      if (row.id)
        plan.sessionIds.push(row.id)
    }
    for (const row of db.prepare('SELECT file_path, storage_type, metadata FROM messages').all() as Array<{ file_path: string | null, storage_type: string | null, metadata: string | null }>) {
      if (row.storage_type === 'file' && row.file_path)
        sse.add(path.basename(row.file_path))
      for (const fid of attachmentFileIds(row.metadata))
        files.add(fid)
    }
    for (const row of db.prepare('SELECT file_id FROM assets WHERE file_id IS NOT NULL').all() as Array<{ file_id: string }>)
      files.add(row.file_id)
  }
  catch (err) {
    log(lines, `枚举会话清单失败（阶段 2 将只搬全局域）：${(err as Error).message}`)
  }
  finally {
    try {
      db?.close()
    }
    catch {}
  }

  plan.sseBasenames = [...sse]
  plan.fileIds = [...files]
  return plan
}

interface LegacyMessageRow {
  row_id: number
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string | null
  storage_type: string | null
  file_path: string | null
  metadata: string | null
  created_at: string | null
}

interface EventMigrationItem {
  messageId: string
  sourcePath?: string
  targetPath: string
  metadata: string
}

function eventTimestamp(value: string | null | undefined): number {
  if (!value)
    return Date.now()
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const timestamp = Date.parse(normalized)
  return Number.isFinite(timestamp) ? timestamp : Date.now()
}

function parseMetadata(value: string | null): Record<string, unknown> {
  try {
    const parsed = value ? JSON.parse(value) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  }
  catch {
    return {}
  }
}

function attachmentDtos(metadata: string | null): any[] {
  const attachments = parseMetadata(metadata).attachments
  return Array.isArray(attachments) ? attachments : []
}

function validateJsonl(filePath: string): boolean {
  try {
    const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/).filter(Boolean)
    if (lines.length < 2)
      return false
    let previous = 0
    for (const line of lines) {
      const item = JSON.parse(line) as AgentConversationRunEventDTO
      if (!item.conversationId || !item.runId || !item.turnId || !item.assistantMessageId)
        return false
      if (!Number.isInteger(item.sequence) || item.sequence !== previous + 1 || !item.event?.type)
        return false
      previous = item.sequence
    }
    return true
  }
  catch {
    return false
  }
}

function resolveLegacySsePath(filePath: string): string | undefined {
  const candidates = [filePath, path.join(agentPaths.sseCacheDir, path.basename(filePath))]
  return candidates.find(candidate => fs.existsSync(candidate))
}

function buildLegacyRunEvents(
  assistant: LegacyMessageRow,
  user: LegacyMessageRow | undefined,
  source: string,
): AgentConversationRunEventDTO[] {
  const assistantMessageId = assistant.id
  const turnId = user?.id ?? `legacy-turn-${assistantMessageId}`
  const runId = `legacy-run-${assistantMessageId}`
  const startedAt = eventTimestamp(user?.created_at ?? assistant.created_at)
  const identity = {
    conversationId: assistant.conversation_id,
    runId,
    turnId,
    assistantMessageId,
  }
  const events: Array<{ event: AgentRunEvent, timestamp: number }> = [
    {
      event: {
        type: 'run_started',
        data: {
          source: 'user',
          assistantMessageId,
          startedAt,
        },
      },
      timestamp: startedAt,
    },
    {
      event: {
        type: 'user_message',
        data: {
          messageId: turnId,
          content: user?.content ?? '',
          attachments: attachmentDtos(user?.metadata ?? null),
          createdAt: startedAt,
        },
      },
      timestamp: startedAt,
    },
  ]

  for (const decoded of decodeLegacySse(source)) {
    if (decoded.event.type === 'run_started' || decoded.event.type === 'user_message')
      continue
    events.push({ event: decoded.event, timestamp: decoded.timestamp ?? startedAt })
  }
  if (!events.some(item => item.event.type === 'run_completed' || item.event.type === 'run_failed' || item.event.type === 'run_cancelled')) {
    events.push({ event: { type: 'run_completed', data: {} }, timestamp: eventTimestamp(assistant.created_at) })
  }

  return events.map((item, index) => ({
    ...identity,
    sequence: index + 1,
    timestamp: item.timestamp,
    event: item.event,
  }))
}

/**
 * 将 conversations.db 中仍引用 .sse 的 assistant 消息迁移为 canonical JSONL。
 * 文件先全部写入并校验，再原子 rename，最后用一个 SQLite 事务切换引用；崩溃后可幂等续跑。
 */
export function migrateLegacyConversationEvents(lines: string[] = []): number {
  const dbPath = agentPaths.legacyConversationsDb
  if (!fs.existsSync(dbPath))
    return 0

  let db: DatabaseSync | undefined
  const items: EventMigrationItem[] = []
  try {
    db = new DatabaseSync(dbPath)
    const rows = db.prepare(`
      SELECT rowid AS row_id, id, conversation_id, role, content, storage_type,
             file_path, metadata, created_at
      FROM messages
      ORDER BY conversation_id, created_at, rowid
    `).all() as unknown as LegacyMessageRow[]
    const previousUser = new Map<string, LegacyMessageRow>()

    for (const row of rows) {
      if (row.role === 'user') {
        previousUser.set(row.conversation_id, row)
        continue
      }
      if (row.role !== 'assistant' || row.storage_type !== 'file' || !row.file_path)
        continue

      const targetPath = agentPaths.sessionTurnEvents(row.conversation_id, row.id)
      const targetValid = fs.existsSync(targetPath) && validateJsonl(targetPath)
      if (path.resolve(row.file_path) === path.resolve(targetPath) && targetValid)
        continue

      const sourcePath = resolveLegacySsePath(row.file_path)
      if (!targetValid) {
        if (!sourcePath)
          throw new Error(`会话事件源文件缺失：${row.file_path}`)
        const source = fs.readFileSync(sourcePath, 'utf-8')
        const events = buildLegacyRunEvents(row, previousUser.get(row.conversation_id), source)
        const tempPath = `${targetPath}.tmp`
        ensureDir(path.dirname(targetPath))
        fs.writeFileSync(tempPath, `${events.map(event => JSON.stringify(event)).join('\n')}\n`, 'utf-8')
        if (!validateJsonl(tempPath)) {
          fs.rmSync(tempPath, { force: true })
          throw new Error(`会话事件 JSONL 校验失败：${targetPath}`)
        }
      }

      const metadata = JSON.stringify({
        ...parseMetadata(row.metadata),
        source: 'conversation_run',
        format: 'jsonl',
      })
      items.push({ messageId: row.id, sourcePath, targetPath, metadata })
    }

    for (const item of items) {
      const tempPath = `${item.targetPath}.tmp`
      if (fs.existsSync(tempPath))
        fs.renameSync(tempPath, item.targetPath)
      if (!validateJsonl(item.targetPath))
        throw new Error(`会话事件 JSONL 最终校验失败：${item.targetPath}`)
    }

    db.exec('BEGIN IMMEDIATE')
    try {
      const update = db.prepare(`
        UPDATE messages
        SET file_path = ?, content = '', content_type = 'file', storage_type = 'file', metadata = ?
        WHERE id = ?
      `)
      for (const item of items)
        update.run(item.targetPath, item.metadata, item.messageId)
      db.exec('COMMIT')
    }
    catch (error) {
      db.exec('ROLLBACK')
      throw error
    }

    for (const item of items) {
      if (item.sourcePath && path.resolve(item.sourcePath) !== path.resolve(item.targetPath))
        fs.rmSync(item.sourcePath, { force: true })
    }
    if (fs.existsSync(agentPaths.sseCacheDir)) {
      for (const name of fs.readdirSync(agentPaths.sseCacheDir)) {
        if (name.endsWith('.sse'))
          fs.rmSync(path.join(agentPaths.sseCacheDir, name), { force: true })
      }
    }
    if (items.length > 0)
      log(lines, `已将历史 SSE 会话记录转换为 JSONL ${items.length} 条`)
    return items.length
  }
  finally {
    try {
      db?.close()
    }
    catch {}
  }
}

/** 脚本草稿不迁移：清空旧 conversations.workspace_path，避免后续工具读到已删除的旧草稿目录。 */
function clearLegacyScriptDraftWorkspaceRefs(oldCheckpoint: string, lines: string[]): void {
  const legacy = agentPaths.legacyConversationsDb
  if (!fs.existsSync(legacy))
    return

  const oldDraftRoot = path.resolve(oldCheckpoint, 'agent-workspaces')
  let db: DatabaseSync | undefined
  try {
    db = new DatabaseSync(legacy)
    const columns = db.prepare('PRAGMA table_info(conversations)').all() as Array<{ name: string }>
    if (!columns.some(col => col.name === 'workspace_path'))
      return

    const rows = db.prepare('SELECT id, workspace_path FROM conversations WHERE workspace_path IS NOT NULL').all() as Array<{ id: string, workspace_path: string }>
    const update = db.prepare('UPDATE conversations SET workspace_path = NULL WHERE id = ?')
    let cleared = 0
    for (const row of rows) {
      const workspacePath = path.resolve(row.workspace_path)
      if (workspacePath === oldDraftRoot || workspacePath.startsWith(oldDraftRoot + path.sep)) {
        update.run(row.id)
        cleared += 1
      }
    }
    if (cleared > 0)
      log(lines, `已清空旧脚本草稿 workspace_path ${cleared} 条`)
  }
  catch (err) {
    log(lines, `清空旧脚本草稿引用失败（忽略）：${(err as Error).message}`)
  }
  finally {
    try {
      db?.close()
    }
    catch {}
  }
}

// ==================== 全局域（不在 conversations.db 里的独立数据）====================

/** 合并旧的 mcp_servers.json + mcp_state.json 到 state/mcp/（复制，仅改位置与文件名）。 */
function migrateMcpConfig(oldCheckpoint: string, lines: string[]): void {
  const destDir = path.dirname(agentPaths.mcpServersFile)
  ensureDir(destDir)
  copyFile(path.join(oldCheckpoint, 'mcp_servers.json'), agentPaths.mcpServersFile, lines)
  copyFile(path.join(oldCheckpoint, 'mcp_state.json'), path.join(destDir, 'state.json'), lines)
}

/**
 * 旧布局的内置技能（随 agent 官方下发）名单。与 SkillManager 的 builtinSkills 保持一致。
 * 迁移时据此把内置技能从旧 skills/ 分流到 library/skills/builtin。
 */
const CURRENT_BUILTIN_SKILL_NAMES = new Set([
  'roxybrowser-control',
  'roxybrowser-automation',
  'automation-script-writing',
])

const BUILTIN_SKILL_NAMES = new Set([
  ...CURRENT_BUILTIN_SKILL_NAMES,
])

/** 读取技能目录的 .skill_meta.json，取其 source（'user' | 'store'）。 */
function readSkillSource(skillDir: string): string | undefined {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(skillDir, '.skill_meta.json'), 'utf-8'))
    return typeof meta?.source === 'string' ? meta.source : undefined
  }
  catch {
    return undefined
  }
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory()
  }
  catch {
    return false
  }
}

/**
 * 技能迁移（复制）：旧 skills/ 是内置 + 用户导入 + 遗留商店技能的混合目录，按类别分流到三桶：
 * - 名列内置名单 → library/skills/builtin
 * - .skill_meta.json 的 source === 'store' → library/skills/installed
 * - 其余 → library/skills/user
 * 旧的 store-skills/ 全部为商店安装 → library/skills/installed。
 */
function migrateSkills(oldSkills: string, lines: string[]): void {
  const oldUserDir = path.join(oldSkills, 'skills')
  if (fs.existsSync(oldUserDir)) {
    for (const name of fs.readdirSync(oldUserDir)) {
      const src = path.join(oldUserDir, name)
      if (name.startsWith('.') || !isDirectory(src))
        continue
      let destRoot: string
      if (BUILTIN_SKILL_NAMES.has(name))
        destRoot = agentPaths.skillsBuiltinDir
      else if (readSkillSource(src) === 'store')
        destRoot = agentPaths.skillsInstalledDir
      else
        destRoot = agentPaths.skillsUserDir
      copyDir(src, path.join(destRoot, name), lines)
    }
  }

  const oldStoreDir = path.join(oldSkills, 'store-skills')
  if (fs.existsSync(oldStoreDir)) {
    for (const name of fs.readdirSync(oldStoreDir)) {
      const src = path.join(oldStoreDir, name)
      if (name.startsWith('.') || !isDirectory(src))
        continue
      copyDir(src, path.join(agentPaths.skillsInstalledDir, name), lines)
    }
  }
}

// ==================== 删源 ====================

/**
 * 删源：固化迁移完成且**校验通过**后，物理删除旧布局目录，回收空间（checkpoint 库常达数百 MB）。
 * 校验以目标 legacyConversationsDb 的会话行数为准：必须存在、> 0、且 ≥ 源库行数，才认为会话域已完整迁入。
 * 任一条件不满足则保留全部源（保守，宁可占空间不丢数据），下次启动因目标已存在会幂等跳过、仅补删。
 */
function cleanupSource(expectedConvCount: number, lines: string[]): void {
  const destN = rowCount(agentPaths.legacyConversationsDb, 'conversations')
  if (destN <= 0 || destN < expectedConvCount) {
    log(lines, `删源校验未通过（目标会话 ${destN} < 源 ${expectedConvCount}），保留全部源目录`)
    return
  }
  log(lines, `删源校验通过（目标会话 ${destN} ≥ 源 ${expectedConvCount}），开始删除旧目录`)

  for (const dir of [
    process.env.CHECKPOINT_DIR,
    process.env.AGENT_WORK_DIR,
    process.env.SKILLS_DIR,
  ]) {
    if (!dir || !fs.existsSync(dir))
      continue
    // 目标数据全部落在 agentPaths.home 下；绝不删到 home 内部（防止误配 CHECKPOINT_DIR=home 时自删）。
    const resolved = path.resolve(dir)
    if (resolved === agentPaths.home || resolved.startsWith(agentPaths.home + path.sep)) {
      log(lines, `删源跳过（位于 home 内，防自删）：${resolved}`)
      continue
    }
    // ⚠️ 安全检查：防止删除用户的 Downloads、Documents 等系统目录
    if (isDangerousUserDirectory(resolved)) {
      log(lines, `删源跳过（检测到用户系统目录，拒绝删除）：${resolved}`)
      continue
    }
    if (isAgentPackageDir(resolved)) {
      log(lines, `清理 agent 包目录（保留 roxy-agent.mjs 与 version）：${resolved}`)
      cleanupAgentPackageDir(resolved, lines)
      continue
    }
    try {
      fs.rmSync(resolved, { recursive: true, force: true })
      log(lines, `已删除旧目录：${resolved}`)
    }
    catch (err) {
      log(lines, `删除旧目录失败（忽略）：${resolved}：${(err as Error).message}`)
    }
  }
}

// ==================== 骨架 ====================

/** 建立标准骨架目录。 */
function ensureSkeleton(): void {
  for (const dir of [
    agentPaths.stateDir,
    agentPaths.tasksDir,
    agentPaths.legacyDir,
    path.dirname(agentPaths.mcpServersFile),
    path.join(agentPaths.home, 'sessions'),
    agentPaths.orphanedUploadsDir,
    path.join(agentPaths.home, 'library'),
    path.join(agentPaths.home, 'runs'),
    agentPaths.browserDir,
    agentPaths.logsDir,
    agentPaths.sseCacheDir,
    path.join(agentPaths.home, 'cache'),
    agentPaths.tmpDir,
  ]) {
    ensureDir(dir)
  }
}

// ==================== 两阶段迁移 ====================

/**
 * 阶段 1（同步）：建骨架 + 固化在 import 期就被打开的 conversations 小库，
 * 保证 DB 模块随后打开的是完整库（4 条不丢）。再枚举会话清单算出阶段 2 总进度。
 * @returns 阶段 2 计划；返回 null 表示无源（全新安装），无阶段 2。
 */
function runPhase1(lines: string[]): MigrationPlan | null {
  ensureSkeleton()

  const oldCheckpoint = process.env.CHECKPOINT_DIR
  if (!oldCheckpoint || !fs.existsSync(oldCheckpoint)) {
    log(lines, '无旧 CHECKPOINT_DIR，视为全新安装，仅创建骨架')
    return null
  }

  // import 期即打开的小库，必须同步固化到位（毫秒级）。
  consolidateSqlite(path.join(oldCheckpoint, 'conversations.db'), agentPaths.legacyConversationsDb, lines)
  clearLegacyScriptDraftWorkspaceRefs(oldCheckpoint, lines)

  const plan = collectPlan(oldCheckpoint, lines)
  const total = plan.sessionIds.length + plan.sseBasenames.length + plan.fileIds.length + 1 /* 全局域整体算 1 单元 */
  status.total = total
  status.done = 0
  log(lines, `阶段 1 完成：会话 ${plan.sessionIds.length}、SSE ${plan.sseBasenames.length}、上传/资产 ${plan.fileIds.length}`)
  return plan
}

/**
 * 阶段 2（后台异步）：搬大 checkpoint 库、SSE、上传、全局域，最后校验删源。
 * 每个工作单元之间让出事件循环，使 HTTP 服务器在迁移中仍可应答。
 */
async function runPhase2(plan: MigrationPlan, lines: string[]): Promise<void> {
  const { oldCheckpoint } = plan
  status.phase = 'phase2'

  const bump = (label: string): void => {
    status.done += 1
    status.currentLabel = label
  }

  // 1) 每条会话：checkpoint 库（懒加载，可数百 MB）。旧脚本草稿目录不迁移。
  for (const id of plan.sessionIds) {
    const sid = sanitizeId(id)
    consolidateSqlite(path.join(oldCheckpoint, `checkpoint_${id}.db`), agentPaths.sessionCheckpointDb(sid), lines)
    bump(`会话 ${id}`)
    await yieldTick()
  }

  // 2) SSE 原文件
  let i = 0
  for (const base of plan.sseBasenames) {
    copyFile(path.join(oldCheckpoint, 'sse', base), path.join(agentPaths.sseCacheDir, base), lines)
    bump('聊天记录')
    if (++i % 32 === 0)
      await yieldTick()
  }
  await yieldTick()

  // 3) 上传 / 资产文件（按 fileId 落非归属上传桶）
  i = 0
  for (const fid of plan.fileIds) {
    copyFile(path.join(oldCheckpoint, 'uploads', fid), path.join(agentPaths.orphanedUploadsDir, fid), lines)
    bump('附件')
    if (++i % 32 === 0)
      await yieldTick()
  }
  await yieldTick()

  // 4) 全局域（DB 之外仍需的独立数据）
  status.currentLabel = '配置与技能'
  const oldWork = process.env.AGENT_WORK_DIR
  const oldSkills = process.env.SKILLS_DIR
  const oldDownloads = process.env.DOWNLOADS_DIR
  consolidateSqlite(path.join(oldCheckpoint, 'checkpoint.db'), path.join(agentPaths.legacyDir, 'checkpoint.db'), lines)
  migrateMcpConfig(oldCheckpoint, lines)
  copyDir(path.join(oldCheckpoint, 'static'), agentPaths.staticCacheDir, lines)
  if (oldDownloads)
    copyFile(path.join(oldDownloads, 'im-threads.json'), agentPaths.imThreadsFile, lines)
  if (oldSkills)
    migrateSkills(oldSkills, lines)

  // 日志与脚本草稿/运行记录不做迁移，明确清理旧布局里的这些可丢弃数据。
  removePath(path.join(oldCheckpoint, 'agent-workspaces'), lines, '旧脚本草稿')
  removePath(path.join(oldCheckpoint, 'script-runs'), lines, '旧脚本运行记录')
  const checkpointLogs = path.join(oldCheckpoint, 'logs')
  if (path.resolve(checkpointLogs) !== agentPaths.logsDir)
    removePath(checkpointLogs, lines, '旧日志')
  if (oldWork) {
    const oldWorkLogs = path.join(oldWork, 'logs')
    if (path.resolve(oldWorkLogs) !== agentPaths.logsDir)
      removePath(oldWorkLogs, lines, '旧日志')
  }
  bump('配置与技能')
  await yieldTick()

  // 5) 校验通过后删源，回收空间
  cleanupSource(plan.sessionIds.length, lines)
}

// ==================== 版本 & 锁 & 入口 ====================

/** 读取当前 schema 版本（.version 缺失或损坏视为 0）。 */
function readVersion(): number {
  try {
    return Number.parseInt(fs.readFileSync(agentPaths.versionFile, 'utf-8').trim(), 10) || 0
  }
  catch {
    return 0
  }
}

/**
 * 抢占迁移锁。返回 lockFd；返回 undefined 表示放弃（另一活进程正在迁移）。
 * 兼容硬杀残留锁：若锁文件里的 pid 已不存在，视为陈旧锁并夺锁（否则残留锁会永久阻断迁移）。
 */
function acquireLock(): number | undefined {
  const lockFile = agentPaths.migrateLockFile
  try {
    const fd = fs.openSync(lockFile, 'wx')
    fs.writeSync(fd, String(process.pid))
    return fd
  }
  catch {
    // 锁已存在：判断持有者是否仍存活
    let holderPid = 0
    try {
      holderPid = Number.parseInt(fs.readFileSync(lockFile, 'utf-8').trim(), 10) || 0
    }
    catch {}
    if (holderPid > 0) {
      try {
        process.kill(holderPid, 0) // 未抛错 → 进程存活 → 让位
        return undefined
      }
      catch {
        // ESRCH：持有者已死，锁陈旧，夺锁
      }
    }
    try {
      fs.rmSync(lockFile, { force: true })
      const fd = fs.openSync(lockFile, 'wx')
      fs.writeSync(fd, String(process.pid))
      return fd
    }
    catch {
      return undefined
    }
  }
}

/** 收尾：仅在全部阶段成功后写版本号；无论成功与否都落日志并释放锁。 */
function finalizeMigration(lockFd: number | undefined, lines: string[], completed: boolean): void {
  if (completed) {
    try {
      fs.writeFileSync(agentPaths.versionFile, String(STORAGE_SCHEMA_VERSION), 'utf-8')
    }
    catch (err) {
      log(lines, `写入版本号失败：${(err as Error).message}`)
    }
  }
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const logFile = agentPaths.migrationLogFile(stamp)
    ensureDir(path.dirname(logFile))
    fs.writeFileSync(logFile, `${lines.join('\n')}\n`, 'utf-8')
  }
  catch {
    // 忽略日志写入失败
  }
  try {
    if (lockFd !== undefined)
      fs.closeSync(lockFd)
    fs.rmSync(agentPaths.migrateLockFile, { force: true })
  }
  catch {
    // 忽略锁清理失败
  }
}

let migrated = false

/**
 * 执行存储迁移（阶段 1 同步、阶段 2 后台异步、幂等、不抛出）。仅在主模式（agent/im）执行；
 * worker/sandbox 子进程跳过（父进程已完成，且并发迁移无意义）。
 *
 * 同步返回时保证：骨架已建、conversations/schedules 库已固化到位 —— 满足随后 DB 模块 import 期打开的前提。
 * 大件搬迁在阶段 2 后台进行，进度经 getMigrationStatus() 暴露给前端。
 */
export function runStorageMigration(): void {
  if (migrated)
    return
  migrated = true

  const argMode = process.argv[2]
  const mode = argMode || process.env.ROXY_MODE || 'agent'
  if (mode === 'worker' || mode === 'sandbox')
    return

  const fromVersion = readVersion()
  if (fromVersion >= STORAGE_SCHEMA_VERSION) {
    status.state = 'done'
    return
  }

  ensureDir(agentPaths.home)
  const lockFd = acquireLock()
  if (lockFd === undefined)
    return // 另一活进程正在迁移，本进程跳过

  const lines: string[] = []
  status.state = 'running'
  status.phase = 'phase1'
  status.startedAt = Date.now()

  let plan: MigrationPlan | null = null
  try {
    log(lines, `开始从 schema v${fromVersion} 迁移到 v${STORAGE_SCHEMA_VERSION}（home=${agentPaths.home}）`)
    if (fromVersion < 1)
      plan = runPhase1(lines)
    else
      ensureSkeleton()
  }
  catch (err) {
    log(lines, `阶段 1 异常（不阻断启动）：${(err as Error).message}`)
    status.state = 'error'
    status.error = (err as Error).message
    status.finishedAt = Date.now()
    finalizeMigration(lockFd, lines, false)
    return
  }

  // 大件目录迁移（v0）完成后，再统一转换 legacy SSE；v1 用户直接进入转换阶段。
  const finishMigration = async () => {
    if (plan)
      await runPhase2(plan, lines)
    status.phase = 'events'
    status.currentLabel = '会话记录'
    await yieldTick()
    migrateLegacyConversationEvents(lines)
  }

  let completed = false
  finishMigration()
    .then(() => {
      log(lines, '迁移完成')
      status.state = 'done'
      status.currentLabel = ''
      completed = true
    })
    .catch((err) => {
      log(lines, `阶段 2 异常（不阻断启动）：${(err as Error).message}`)
      status.state = 'error'
      status.error = (err as Error).message
    })
    .finally(() => {
      status.finishedAt = Date.now()
      finalizeMigration(lockFd, lines, completed)
    })
}
