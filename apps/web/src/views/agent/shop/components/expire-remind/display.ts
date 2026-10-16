import currency from 'currency.js'
import { differenceInCalendarDays } from 'date-fns'
import type { ProxyExpireRemindRow } from './types'

/** 到期色块。plain 只展示文字；error / warning 对应设计里的红、橙色块 */
export interface ExpireBadge {
  text: string
  tone: 'plain' | 'error' | 'warning'
}

/**
 * checkOnly 的 hasBoundProfile 类型是布尔，响应里也可能是 0/1。
 * 缺字段不能当成 false，否则没绑窗口的黄色标题会被当成红色风险标题。
 */
export function readHasBoundProfile(value: unknown) {
  if (value === true || value === 1 || value === '1' || value === 'true') {
    return true
  }
  if (value === false || value === 0 || value === '0' || value === 'false') {
    return false
  }
  return undefined
}

/** 当前页没有单独汇总数时，用每行已关联窗口数相加 */
export function countPageAffectedProfiles(rows: ProxyExpireRemindRow[]) {
  return rows.reduce((sum, row) => sum + (row.profiles?.length ?? 0), 0)
}

/** 出口位置沿用「国家码/城市」；没有城市时不补斜杠 */
export function buildLocationText(row: Pick<ProxyExpireRemindRow, 'lastCountry' | 'lastCity'>) {
  const country = row.lastCountry || '--'
  return row.lastCity ? `${country}/${row.lastCity}` : country
}

/**
 * 剩余天数优先用接口的 remainDays，避免客户端时区把「第 7 天」算偏。
 * 2 天及以内用红色；更长的临期（含接口说明的 4～7 天）用黄色。
 */
export function buildExpireBadge(row: Pick<ProxyExpireRemindRow, 'expireDate' | 'remainDays'>, now = new Date()): ExpireBadge {
  const days = resolveRemainDays(row, now)
  if (days == null) {
    return { text: row.expireDate || '--', tone: 'plain' }
  }
  if (days < 0) {
    return { text: $t('已过期'), tone: 'error' }
  }
  if (days === 0) {
    return { text: $t('今天到期'), tone: 'error' }
  }
  return {
    text: $t('{day} 天后到期', { day: days }),
    tone: days <= 3 ? 'error' : 'warning',
  }
}

/** 接口直接给折后月单价；没有单价时不展示金额 */
export function buildRenewalPriceText(row: Pick<ProxyExpireRemindRow, 'renewalPrice'>) {
  if (typeof row.renewalPrice !== 'number' || Number.isNaN(row.renewalPrice)) {
    return ''
  }
  return currency(row.renewalPrice).format()
}

/** remainDays 为 0 表示今天到期，不能当成缺失 */
function resolveRemainDays(row: Pick<ProxyExpireRemindRow, 'expireDate' | 'remainDays'>, now: Date) {
  if (typeof row.remainDays === 'number' && !Number.isNaN(row.remainDays)) {
    return row.remainDays
  }
  if (!row.expireDate) {
    return null
  }
  const days = differenceInCalendarDays(new Date(row.expireDate), now)
  return Number.isNaN(days) ? null : days
}
