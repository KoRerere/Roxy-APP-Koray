import type { TaskPlanType } from './task-manager'

export type TaskScheduleFrequency = 'daily' | 'hourly' | 'monthly' | 'once' | 'weekly'

export interface TaskScheduleSource {
  planType?: TaskPlanType
  cron?: string | null
  executeAt?: string | null
  nextExecuteAt?: string | null
  enabled?: boolean
}

export interface TaskScheduleDraft {
  frequency: TaskScheduleFrequency
  hourlyMinute: number
  scheduleDate: Date | null
  scheduleTime: Date | null
  monthlyDay: number
  weekday: number
  enabled: boolean
}

export interface TaskSchedulePlan {
  planType: TaskPlanType
  cron: string | null
  timezone: string | null
  executeAt: string | null
  enabled: boolean
}

function validDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

function defaultScheduleDate() {
  const value = new Date()
  value.setSeconds(0, 0)
  return value
}

function parseInteger(value: string, minimum: number, maximum: number) {
  if (!/^\d+$/.test(value))
    return undefined

  const parsed = Number(value)
  return parsed >= minimum && parsed <= maximum ? parsed : undefined
}

function applyCron(draft: TaskScheduleDraft, cron?: string | null, nextExecuteAt?: Date) {
  if (!cron)
    return

  const fields = cron.trim().split(/\s+/)
  if (fields.length !== 5)
    return

  const [minuteField, hourField, dayField, monthField, weekdayField] = fields
  const minute = parseInteger(minuteField, 0, 59)
  if (minute === undefined) {
    return
  }

  if (hourField === '*' && dayField === '*' && monthField === '*' && weekdayField === '*') {
    draft.frequency = 'hourly'
    draft.hourlyMinute = minute
    return
  }

  const hour = parseInteger(hourField, 0, 23)
  if (hour === undefined) {
    return
  }

  const scheduleTime = new Date(nextExecuteAt ?? draft.scheduleTime ?? defaultScheduleDate())
  if (!nextExecuteAt)
    scheduleTime.setHours(hour, minute, 0, 0)
  draft.scheduleTime = scheduleTime

  if (dayField === '*' && monthField === '*' && weekdayField === '*') {
    draft.frequency = 'daily'
    return
  }

  const weekday = parseInteger(weekdayField, 0, 6)
  if (dayField === '*' && monthField === '*' && weekday !== undefined) {
    draft.frequency = 'weekly'
    draft.weekday = nextExecuteAt?.getDay() ?? weekday
    return
  }

  const monthlyDay = parseInteger(dayField, 1, 31)
  if (monthlyDay !== undefined && monthField === '*' && weekdayField === '*') {
    draft.frequency = 'monthly'
    draft.monthlyDay = nextExecuteAt?.getDate() ?? monthlyDay
    return
  }
}

export function getLocalTaskTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  }
  catch {
    return 'UTC'
  }
}

export function createTaskScheduleDraft(
  source: TaskScheduleSource = {},
  defaultFrequency: TaskScheduleFrequency = 'daily',
): TaskScheduleDraft {
  const fallbackDate = defaultScheduleDate()
  const draft: TaskScheduleDraft = {
    frequency: defaultFrequency,
    hourlyMinute: fallbackDate.getMinutes(),
    scheduleDate: new Date(fallbackDate),
    scheduleTime: new Date(fallbackDate),
    monthlyDay: 1,
    weekday: 1,
    enabled: source.enabled ?? true,
  }

  if (source.planType === 'once') {
    const executeAt = new Date(source.nextExecuteAt ?? source.executeAt ?? '')
    draft.frequency = 'once'
    if (validDate(executeAt)) {
      draft.scheduleDate = new Date(executeAt)
      draft.scheduleTime = new Date(executeAt)
    }
  }
  else if (source.planType === 'cron') {
    const nextExecuteAt = new Date(source.nextExecuteAt ?? '')
    applyCron(draft, source.cron, validDate(nextExecuteAt) ? nextExecuteAt : undefined)
  }

  return draft
}

function buildCron(draft: TaskScheduleDraft) {
  if (draft.frequency === 'hourly') {
    if (!Number.isInteger(draft.hourlyMinute) || draft.hourlyMinute < 0 || draft.hourlyMinute > 59) {
      return null
    }
    return `${draft.hourlyMinute} * * * *`
  }

  if (!validDate(draft.scheduleTime))
    return null

  const minute = draft.scheduleTime.getMinutes()
  const hour = draft.scheduleTime.getHours()
  if (draft.frequency === 'weekly')
    return `${minute} ${hour} * * ${draft.weekday}`
  if (draft.frequency === 'monthly')
    return `${minute} ${hour} ${draft.monthlyDay} * *`
  return `${minute} ${hour} * * *`
}

function buildExecuteAt(draft: TaskScheduleDraft) {
  if (!validDate(draft.scheduleDate) || !validDate(draft.scheduleTime))
    return null

  const executeAt = new Date(draft.scheduleDate)
  executeAt.setHours(
    draft.scheduleTime.getHours(),
    draft.scheduleTime.getMinutes(),
    0,
    0,
  )
  return executeAt.toISOString()
}

export function buildTaskSchedulePlan(
  draft: TaskScheduleDraft,
  scheduleEnabled = true,
): TaskSchedulePlan {
  if (!scheduleEnabled) {
    return {
      planType: 'manual',
      cron: null,
      timezone: null,
      executeAt: null,
      enabled: true,
    }
  }

  if (draft.frequency === 'once') {
    return {
      planType: 'once',
      cron: null,
      timezone: null,
      executeAt: buildExecuteAt(draft),
      enabled: draft.enabled,
    }
  }

  return {
    planType: 'cron',
    cron: buildCron(draft),
    timezone: getLocalTaskTimezone(),
    executeAt: null,
    enabled: draft.enabled,
  }
}

export function isValidTaskCron(value: string) {
  const fields = value.trim().split(/\s+/)
  if (fields.length !== 5) {
    return false
  }

  const [minuteField, hourField, dayField, monthField, weekdayField] = fields
  if (parseInteger(minuteField, 0, 59) === undefined) {
    return false
  }

  const hourly = hourField === '*' && dayField === '*' && monthField === '*' && weekdayField === '*'
  if (hourly) {
    return true
  }
  if (parseInteger(hourField, 0, 23) === undefined) {
    return false
  }

  const daily = dayField === '*' && monthField === '*' && weekdayField === '*'
  const weekly = dayField === '*' && monthField === '*' && parseInteger(weekdayField, 0, 6) !== undefined
  const monthly = parseInteger(dayField, 1, 31) !== undefined && monthField === '*' && weekdayField === '*'
  return daily || weekly || monthly
}
