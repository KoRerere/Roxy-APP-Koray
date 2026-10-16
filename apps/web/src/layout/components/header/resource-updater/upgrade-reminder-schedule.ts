import { differenceInCalendarDays } from 'date-fns'
import { compare, validate } from 'compare-versions'

/** 强提醒从首次进入该档起，允许按小时间隔再弹的窗口 */
export const STRONG_REMIND_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

/** 强提醒两次正式弹出的最小间隔；错过的间隔不回放 */
export const STRONG_REMIND_INTERVAL_MS = 8 * 60 * 60 * 1000

/** 提醒档位。落后 0 个版本不提醒 */
export type VersionRemindLevel = 'none' | 'normal' | 'strong'

/** 本次弹出原因。补弹不改写正式周期锚点 */
export type VersionRemindReason = 'scheduled' | 'launch' | 'slot' | 'supplement'

/** 接口里按语言拆开的标题或正文 */
export interface RemindLocalizedText {
  zh?: string
  en?: string
  ru?: string
}

/** 普通或强提醒的可展示文案 */
export interface RemindCopySource {
  title?: RemindLocalizedText
  content?: RemindLocalizedText
}

/** 决定是否到点所需的配置，不含文案 */
export interface VersionRemindScheduleConfig {
  /** 后台是否已写入配置 */
  exists: boolean
  /** 配置是否启用 */
  enabled: boolean
  /** 各端已发布版本的最大值 */
  latestVersion: string
  /** 提醒开始，yyyy-MM-dd HH:mm */
  startTime: string
  /** 提醒结束。长期有效时为空 */
  endTime: string
  /** 长期有效时忽略结束时间 */
  longTerm: boolean
  /** 落后满该档数走强提醒 */
  behindVersions: number
  /** 普通提醒每 N 天一个提醒日 */
  cycleDays: number
  /** 每个提醒日最多几个时刻 */
  dailyTimes: number
  /** 逗号分隔的 HH:mm */
  remindTime: string
}

/** 跨重启保留的提醒进度，按 latestVersion 分开存 */
export interface VersionRemindPersistedState {
  /** 这组进度对应的最新版本 */
  latestVersion: string
  /** 首次判定为强提醒的时刻，避免 3 天窗口每次启动被重置 */
  strongStartAt?: number
  /** 上次强提醒正式弹出时刻。补弹不写这个字段 */
  lastOfficialShownAt?: number
  /** 已经弹出过的普通提醒档位 */
  shownNormalSlots: string[]
  /** 用户关掉后，下次进入客户端要补的那一档 */
  pendingSupplementSlotId?: string
  /** 已经补过的档位，避免关掉补弹后再连环补 */
  consumedSupplementSlotIds: string[]
}

/** 一次应弹出的提醒 */
export interface VersionRemindDecision {
  /** 普通或强提醒 */
  level: Exclude<VersionRemindLevel, 'none'>
  /** 正式档、启动档、小时间隔或补弹 */
  reason: VersionRemindReason
  /** 正式档位标识。补弹沿用被关掉的那一档 */
  slotId: string
}

/** 纯判定入参，调用方负责读写存储 */
export interface VersionRemindDecisionInput {
  /** 提醒配置 */
  config: VersionRemindScheduleConfig
  /** 当前系统已发布版本中，严格新于本地且不超过 latestVersion 的个数 */
  behindCount: number
  /** 判定使用的当前时间 */
  now: Date
  /** 已持久化的进度 */
  state: VersionRemindPersistedState
  /** 本进程会话是否已弹过强提醒启动档 */
  strongLaunchShown: boolean
  /** 本会话刚关掉的档位，同一会话内不再补弹 */
  supplementBlockedSlotId?: string
}

/** 提醒弹窗顶部要展示的标题和正文 */
export interface RemindCopy {
  /** 标题，可为空 */
  title: string
  /** 正文，可为空 */
  content: string
}

/** 新建一份尚未弹过的进度 */
export function createEmptyRemindState(latestVersion: string): VersionRemindPersistedState {
  return {
    latestVersion,
    shownNormalSlots: [],
    consumedSupplementSlotIds: [],
  }
}

/**
 * 把 yyyy-MM-dd HH:mm 解析成本地时间。
 * 不用 Date.parse，避免把没有时区的字符串当成 UTC。
 */
export function parseRemindDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?$/.exec(value.trim())
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const hour = match[4] ? Number(match[4]) : 0
  const minute = match[5] ? Number(match[5]) : 0
  const date = new Date(year, month, day, hour, minute, 0, 0)
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null
  }
  return date
}

/** 配置启用且当前时间落在提醒窗口内 */
export function isRemindConfigActive(config: VersionRemindScheduleConfig, now: Date): boolean {
  if (!config.exists || !config.enabled) {
    return false
  }

  const start = parseRemindDateTime(config.startTime)
  if (!start || now.getTime() < start.getTime()) {
    return false
  }
  if (config.longTerm) {
    return true
  }

  const end = parseRemindDateTime(config.endTime)
  return Boolean(end && now.getTime() <= end.getTime())
}

/** 按落后档数划分不提醒、普通提醒和强提醒 */
export function resolveRemindLevel(behindCount: number, behindVersions: number): VersionRemindLevel {
  if (behindCount <= 0) {
    return 'none'
  }

  const threshold = behindVersions >= 1 ? behindVersions : 3
  return behindCount >= threshold ? 'strong' : 'normal'
}

/**
 * 统计落后档数。本地版本已经不低于 latestVersion 时为 0。
 * 版本号无法比较时返回 null，调用方应放弃本次弹出。
 */
export function countVersionsBehind(localVersion: string, latestVersion: string, publishedVersions: string[]): number | null {
  if (!validate(localVersion) || !validate(latestVersion)) {
    return null
  }
  if (compare(localVersion, latestVersion, '>=')) {
    return 0
  }

  const seen = new Set<string>()
  let count = 0
  for (const version of publishedVersions) {
    if (!version || seen.has(version) || !validate(version)) {
      continue
    }
    seen.add(version)
    if (compare(version, localVersion, '>') && compare(version, latestVersion, '<=')) {
      count += 1
    }
  }
  return count
}

/** 按界面语言取文案。中文归到 zh，其余先英文再中文 */
export function pickRemindCopy(source: RemindCopySource | undefined, locale: string): RemindCopy | null {
  const preferred = remindLanguage(locale)
  const order = preferred ? [preferred, 'en', 'zh'] as const : ['en', 'zh'] as const
  const seen = new Set<string>()

  for (const language of order) {
    if (seen.has(language)) {
      continue
    }
    seen.add(language)
    const title = source?.title?.[language]?.trim() ?? ''
    const content = source?.content?.[language]?.trim() ?? ''
    if (title || content) {
      return { title, content }
    }
  }
  return null
}

/**
 * 强提醒的 3 天窗口从第一次判定为强提醒起算。
 * 必须在弹出之前写入，否则每次启动都会把窗口重置成现在。
 */
export function ensureStrongRemindStart(state: VersionRemindPersistedState, nowMs: number): VersionRemindPersistedState {
  if (state.strongStartAt != null) {
    return state
  }
  return {
    ...state,
    strongStartAt: nowMs,
  }
}

/**
 * 记下一次正式弹出或一次补弹。补弹不改强提醒的 8 小时锚点。
 * 普通补弹要写入已展示档，否则下一次启动还会把同一档再补出来。
 */
export function applyRemindShown(
  state: VersionRemindPersistedState,
  decision: VersionRemindDecision,
  nowMs: number,
): VersionRemindPersistedState {
  if (decision.reason === 'supplement') {
    return {
      ...state,
      pendingSupplementSlotId: undefined,
      consumedSupplementSlotIds: uniqueIds(state.consumedSupplementSlotIds, decision.slotId),
      shownNormalSlots: decision.level === 'normal'
        ? uniqueIds(state.shownNormalSlots, decision.slotId)
        : state.shownNormalSlots,
    }
  }

  // 同一档再次作为正式提醒出现时只清掉待补弹，不能记成已补过，否则强提醒启动档无法再次补弹
  const pending = state.pendingSupplementSlotId
  const consumedSupplementSlotIds = pending && pending !== decision.slotId
    ? uniqueIds(state.consumedSupplementSlotIds, pending)
    : state.consumedSupplementSlotIds

  if (decision.level === 'normal') {
    return {
      ...state,
      shownNormalSlots: uniqueIds(state.shownNormalSlots, decision.slotId),
      pendingSupplementSlotId: undefined,
      consumedSupplementSlotIds,
    }
  }

  return {
    ...state,
    strongStartAt: state.strongStartAt ?? nowMs,
    lastOfficialShownAt: nowMs,
    pendingSupplementSlotId: undefined,
    consumedSupplementSlotIds,
  }
}

/**
 * 强提醒被关掉后，留给下一次进入客户端补一次。
 * 普通提醒关掉只表示这一档已经展示过，不能再登记补弹，否则非提醒日的下一次启动会把周期打成每天。
 */
export function armRemindSupplement(state: VersionRemindPersistedState, slotId: string): VersionRemindPersistedState {
  if (!slotId || state.consumedSupplementSlotIds.includes(slotId) || state.pendingSupplementSlotId === slotId) {
    return state
  }
  return {
    ...state,
    pendingSupplementSlotId: slotId,
  }
}

/** 用户选择升级后不再补弹 */
export function clearRemindSupplement(state: VersionRemindPersistedState): VersionRemindPersistedState {
  if (!state.pendingSupplementSlotId) {
    return state
  }
  return {
    ...state,
    pendingSupplementSlotId: undefined,
  }
}

/**
 * 正式档优先于补弹，避免同一时刻弹两次。
 * 强提醒每个新会话的启动档会盖住待补弹，因此不会在同一次进入里再叠加第二次。
 */
export function resolveVersionRemindDecision(input: VersionRemindDecisionInput): VersionRemindDecision | null {
  if (!isRemindConfigActive(input.config, input.now)) {
    return null
  }

  const level = resolveRemindLevel(input.behindCount, input.config.behindVersions)
  if (level === 'none') {
    return null
  }

  const official = level === 'normal'
    ? resolveNormalSlot(input)
    : resolveStrongSlot(input)
  if (official) {
    return official
  }
  if (level === 'normal') {
    const missed = resolveMissedNormalSlot(input)
    if (missed) {
      return missed
    }
  }
  return resolveSupplement(input, level)
}

/** 界面语言映射到接口的 zh / en / ru */
function remindLanguage(locale: string): 'zh' | 'en' | 'ru' | null {
  const lower = locale.toLowerCase()
  if (lower.startsWith('zh')) {
    return 'zh'
  }
  if (lower.startsWith('ru')) {
    return 'ru'
  }
  if (lower.startsWith('en')) {
    return 'en'
  }
  return null
}

/** 提醒日里已经到点、且还没弹过的最早一档 */
function resolveNormalSlot(input: VersionRemindDecisionInput): VersionRemindDecision | null {
  const start = parseRemindDateTime(input.config.startTime)
  if (!start || input.config.cycleDays < 1 || input.config.dailyTimes < 1) {
    return null
  }

  const days = differenceInCalendarDays(input.now, start)
  if (days < 0 || days % input.config.cycleDays !== 0) {
    return null
  }

  const times = parseRemindClockTimes(input.config.remindTime, input.config.dailyTimes)
  for (const time of times) {
    const slotAt = new Date(
      input.now.getFullYear(),
      input.now.getMonth(),
      input.now.getDate(),
      time.hour,
      time.minute,
      0,
      0,
    )
    if (input.now.getTime() < slotAt.getTime()) {
      continue
    }

    const slotId = formatSlotId(input.now, time.hour, time.minute)
    if (input.state.shownNormalSlots.includes(slotId)) {
      continue
    }
    return {
      level: 'normal',
      reason: 'scheduled',
      slotId,
    }
  }
  return null
}

/**
 * 强提醒不解析接口里的「系统默认」字符串。
 * 新会话先弹启动档；之后 3 天内距上次正式弹出满 8 小时再弹，错过的点不补齐。
 */
function resolveStrongSlot(input: VersionRemindDecisionInput): VersionRemindDecision | null {
  if (!input.strongLaunchShown) {
    return {
      level: 'strong',
      reason: 'launch',
      slotId: `strong-launch:${input.config.latestVersion || 'unknown'}`,
    }
  }

  const startAt = input.state.strongStartAt
  const lastShownAt = input.state.lastOfficialShownAt
  if (startAt == null || lastShownAt == null) {
    return null
  }

  const nowMs = input.now.getTime()
  const elapsed = nowMs - startAt
  if (elapsed < 0 || elapsed >= STRONG_REMIND_WINDOW_MS) {
    return null
  }
  if (nowMs - lastShownAt < STRONG_REMIND_INTERVAL_MS) {
    return null
  }
  return {
    level: 'strong',
    reason: 'slot',
    slotId: `strong-slot:${lastShownAt}`,
  }
}

/**
 * 已经展示过的普通档不再补。
 * 关掉弹窗只代表用户看到了这一档；若再按「下次启动」重放，2 天周期会在间隔日多弹一次。
 */
function resolveSupplement(
  input: VersionRemindDecisionInput,
  level: Exclude<VersionRemindLevel, 'none'>,
): VersionRemindDecision | null {
  const slotId = input.state.pendingSupplementSlotId
  if (!slotId || input.state.consumedSupplementSlotIds.includes(slotId)) {
    return null
  }
  if (level === 'normal' && input.state.shownNormalSlots.includes(slotId)) {
    return null
  }
  if (input.supplementBlockedSlotId === slotId) {
    return null
  }
  return {
    level,
    reason: 'supplement',
    slotId,
  }
}

/**
 * 最近一个已经到点、但用户当时不在客户端所以没看过的普通档，下次进入时补一次。
 * 只看最近一档：更早错过的不回放，也不挪动按 startTime 对齐的后续周期。
 */
function resolveMissedNormalSlot(input: VersionRemindDecisionInput): VersionRemindDecision | null {
  const due = findLatestDueNormalSlot(input)
  if (!due || differenceInCalendarDays(input.now, due.at) === 0) {
    return null
  }
  if (input.state.shownNormalSlots.includes(due.slotId) || input.state.consumedSupplementSlotIds.includes(due.slotId)) {
    return null
  }
  if (input.supplementBlockedSlotId === due.slotId) {
    return null
  }
  return {
    level: 'normal',
    reason: 'supplement',
    slotId: due.slotId,
  }
}

/** 不晚于现在的最近一个普通提醒钟点。当天尚未到点时退回上一周期 */
function findLatestDueNormalSlot(input: VersionRemindDecisionInput): { slotId: string, at: Date } | null {
  const start = parseRemindDateTime(input.config.startTime)
  if (!start || input.config.cycleDays < 1 || input.config.dailyTimes < 1) {
    return null
  }

  const days = differenceInCalendarDays(input.now, start)
  if (days < 0) {
    return null
  }

  const times = parseRemindClockTimes(input.config.remindTime, input.config.dailyTimes)
  if (!times.length) {
    return null
  }

  const nowMs = input.now.getTime()
  for (let offset = days - (days % input.config.cycleDays); offset >= 0; offset -= input.config.cycleDays) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset)
    let best: { slotId: string, at: Date } | null = null
    for (const time of times) {
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.hour, time.minute, 0, 0)
      if (at.getTime() > nowMs) {
        continue
      }
      if (!best || at.getTime() > best.at.getTime()) {
        best = { slotId: formatSlotId(day, time.hour, time.minute), at }
      }
    }
    if (best) {
      return best
    }
  }
  return null
}

/** 取前 dailyTimes 个合法时刻，保持配置里的先后顺序 */
function parseRemindClockTimes(remindTime: string, dailyTimes: number): Array<{ hour: number, minute: number }> {
  const times: Array<{ hour: number, minute: number }> = []
  for (const part of remindTime.split(',')) {
    if (times.length >= dailyTimes) {
      break
    }
    const match = /^(\d{1,2}):(\d{2})$/.exec(part.trim())
    if (!match) {
      continue
    }
    const hour = Number(match[1])
    const minute = Number(match[2])
    if (hour > 23 || minute > 59) {
      continue
    }
    times.push({ hour, minute })
  }
  return times
}

/** 普通提醒档位按本地日历日和时刻标识，避免时区把同一天拆开 */
function formatSlotId(day: Date, hour: number, minute: number): string {
  const year = day.getFullYear()
  const month = String(day.getMonth() + 1).padStart(2, '0')
  const date = String(day.getDate()).padStart(2, '0')
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return `${year}-${month}-${date}T${hh}:${mm}`
}

/** 追加一个标识并去重，保持原有顺序 */
function uniqueIds(ids: string[], id: string): string[] {
  if (ids.includes(id)) {
    return ids
  }
  return [...ids, id]
}
