import { $t } from "/@/locales"
import { validateEmail } from "/@/utils/basic"

/**
 * 验证 USDT TRC20 地址
 * @param {string} address 要验证的 TRC20 地址
 * @returns {object} 包含验证结果和消息的对象
 */
export function validateTRC20Address(address: string) {
  // 检查地址是否以 'T' 开头
  if (!address.startsWith('T')) {
    return { isValid: false, message: $t('地址必须以T开头') }
  }

  // 检查地址长度是否为 34 个字符
  if (address.length !== 34) {
    return { isValid: false, message: $t('地址长度应为 34 个字符') }
  }

  // 检查地址是否只包含 Base58 字符集中的字符
  const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/
  if (!base58Regex.test(address)) {
    return { isValid: false, message: $t('地址包含非法字符') }
  }

  return { isValid: true, message: '地址有效' }
}

export function validatePayPalAddress(address: string) {
  if (!validateEmail(address)) {
    return { isValid: false, message: $t('请输入正确的邮箱地址') }
  }

  return { isValid: true, message: '地址有效' }
}

const PROMOTION_CODE_OFFICIAL_KEYWORDS = ['official', 'support', 'help', 'admin', 'team'] as const
export const PROMOTION_CODE_MIN_LENGTH = 6
export const PROMOTION_CODE_MAX_LENGTH = 16

export function validatePromotionCode(code: string) {
  const trimmed = code.trim()

  if (/[^a-zA-Z0-9]/.test(trimmed)) {
    return { isValid: false, message: $t('邀请码只能包含字母和数字，长度为 6-16 位') }
  }

  if (!/^[a-zA-Z0-9]{6,16}$/.test(trimmed)) {
    return { isValid: false, message: $t('邀请码只能包含字母和数字，长度为 6-16 位') }
  }

  const lower = trimmed.toLowerCase()

  if (lower === 'roxy' || lower === 'roxybrowser') {
    return { isValid: false, message: $t('邀请码不可使用 roxy 或 roxybrowser 相关保留词') }
  }

  if (lower.includes('roxybrowser')) {
    return { isValid: false, message: $t('邀请码不可包含 roxybrowser') }
  }

  if (lower.includes('roxy') && PROMOTION_CODE_OFFICIAL_KEYWORDS.some(keyword => lower.includes(keyword))) {
    return { isValid: false, message: $t('邀请码不可包含 roxy 与官方关键词的组合') }
  }

  return { isValid: true, message: '' }
}
