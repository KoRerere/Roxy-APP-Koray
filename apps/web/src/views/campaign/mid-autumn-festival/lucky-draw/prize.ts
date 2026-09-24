import { format } from 'date-fns'
import type { UserMidAutumnLotteryDrawCreateData, UserMidAutumnLotteryPrizesListData } from '@roxy/backend-api'

/** 单次抽奖接口返回的奖品 */
export type LotteryPrize = UserMidAutumnLotteryDrawCreateData['data']

/** 我的奖品列表里的一条已抽记录 */
export type LotteryPrizeRecord = UserMidAutumnLotteryPrizesListData['data']['prizes'][number]

/** 奖品明细。生成类型只声明了 days，实际还会带 windows / points */
export interface LotteryPrizePayload {
  /** 窗口或代理的有效天数 */
  days?: number
  /** 窗口会员数量 */
  windows?: number
  /** AI 积分数 */
  points?: number
}

/** 把接口档位映射成展示用奖项名 */
export function getPrizeTierName(tier?: string): string {
  const names: Record<string, string> = {
    third: $t('三等奖'),
    fourth: $t('四等奖'),
    participate_a: $t('参与奖'),
    participate_b: $t('参与奖'),
  }
  return (tier && names[tier]) || $t('参与奖')
}

/**
 * 按 payload 拼奖品文案。窗口套餐会带上活动承诺的美国原生 IP。
 */
export function formatPrizeDescription(prize: {
  prizeType?: string
  prizePayload?: LotteryPrizePayload
}): string {
  const payload = prize.prizePayload ?? {}
  const parts: string[] = []

  if (payload.windows) {
    parts.push($t('{days} 天 {windows} 窗口会员', { days: payload.days ?? 0, windows: payload.windows }))
  }
  else if (prize.prizeType === 'window' && payload.days) {
    parts.push($t('{days} 天窗口会员', { days: payload.days }))
  }
  else if (prize.prizeType === 'proxy' && payload.days) {
    parts.push($t('{days} 天美国原生 IP', { days: payload.days ?? 0 }))
  }

  if (payload.points || prize.prizeType === 'points') {
    parts.push($t('{points} AI 积分', { points: payload.points ?? 0 }))
  }

  return parts.join(' + ') || '--'
}

/**
 * 抽奖到账时间展示。接口可能给 ISO 字符串，解析失败时回退原文。
 */
export function formatDrawTime(value?: string): string {
  if (!value) {
    return '--'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return format(date, 'yyyy/MM/dd HH:mm:ss')
}
