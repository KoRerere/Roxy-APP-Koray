import { $t } from "/@/locales"

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
  const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

  if (!emailRegex.test(address)) {
    return { isValid: false, message: $t('请输入正确的邮箱地址') }
  }

  return { isValid: true, message: '地址有效' }
}
