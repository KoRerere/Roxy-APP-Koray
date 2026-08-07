import { createHmac } from 'node:crypto'

/**
 * `@roxybrowser/sandbox/2fa` — 2FA/TOTP 解析工具。
 *
 * 支持常见的 base32 secret，以及 Google Authenticator / Authy 等导出的
 * `otpauth://totp/...` URI。纯本地计算，不访问网络、不持久化密钥。
 */

export type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512'

export interface TwoFactorOptions {
  /** 指定计算时间。默认当前时间；传 number 时单位为毫秒时间戳。 */
  time?: number | Date
  /** TOTP 周期秒数。默认 30；`otpauth://` URI 中的 period 会覆盖默认值。 */
  period?: number
  /** 验证码位数。默认 6；`otpauth://` URI 中的 digits 会覆盖默认值。 */
  digits?: number
  /** HMAC 算法。默认 SHA1；`otpauth://` URI 中的 algorithm 会覆盖默认值。 */
  algorithm?: TotpAlgorithm
}

export interface TwoFactorCode {
  /** 当前 2FA 验证码，保留前导 0。 */
  code: string
  /** 距离当前验证码过期还剩多少秒。 */
  secondsRemaining: number
  /** 当前验证码过期时间，毫秒时间戳。 */
  expiresAt: number
  /** TOTP 周期秒数。 */
  period: number
  /** 验证码位数。 */
  digits: number
  /** HMAC 算法。 */
  algorithm: TotpAlgorithm
  /** otpauth URI 中的 issuer（如果有）。 */
  issuer?: string
  /** otpauth URI 中的账号标签（如果有）。 */
  account?: string
}

interface ParsedInput {
  secret: string
  period?: number
  digits?: number
  algorithm?: TotpAlgorithm
  issuer?: string
  account?: string
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function decodeBase32(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/[\s=-]/g, '')
  if (!normalized) {
    throw new Error('[@roxybrowser/sandbox/2fa] 2FA secret 不能为空')
  }

  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const char of normalized) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) {
      throw new Error(`[@roxybrowser/sandbox/2fa] 非法 base32 字符：${char}`)
    }

    value = (value << 5) | idx
    bits += 5

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xFF)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

function normalizeAlgorithm(value: string | undefined, fallback: TotpAlgorithm): TotpAlgorithm {
  const algorithm = (value ?? fallback).toUpperCase()
  if (algorithm === 'SHA1' || algorithm === 'SHA256' || algorithm === 'SHA512')
    return algorithm
  throw new Error(`[@roxybrowser/sandbox/2fa] 不支持的 TOTP algorithm：${value}`)
}

function normalizePositiveInteger(value: number | undefined, fallback: number, name: string): number {
  const n = value ?? fallback
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`[@roxybrowser/sandbox/2fa] ${name} 必须是正整数`)
  }
  return n
}

function parseUriLabel(label: string, issuerParam?: string): Pick<ParsedInput, 'issuer' | 'account'> {
  const decoded = decodeURIComponent(label.replace(/^\//, ''))
  if (!decoded)
    return issuerParam ? { issuer: issuerParam } : {}

  const sep = decoded.indexOf(':')
  if (sep === -1)
    return { issuer: issuerParam, account: decoded }

  const issuer = issuerParam || decoded.slice(0, sep) || undefined
  const account = decoded.slice(sep + 1) || undefined
  return { issuer, account }
}

function parseInput(input: string): ParsedInput {
  const raw = input.trim()
  if (!raw) {
    throw new Error('[@roxybrowser/sandbox/2fa] 2FA 内容不能为空')
  }

  if (!/^otpauth:\/\//i.test(raw)) {
    return { secret: raw }
  }

  const url = new URL(raw)
  if (url.hostname.toLowerCase() !== 'totp') {
    throw new Error(`[@roxybrowser/sandbox/2fa] 仅支持 otpauth://totp，当前类型：${url.hostname}`)
  }

  const secret = url.searchParams.get('secret')
  if (!secret) {
    throw new Error('[@roxybrowser/sandbox/2fa] otpauth URI 缺少 secret 参数')
  }

  const issuerParam = url.searchParams.get('issuer') ?? undefined
  const label = parseUriLabel(url.pathname, issuerParam)
  const digits = url.searchParams.has('digits') ? Number(url.searchParams.get('digits')) : undefined
  const period = url.searchParams.has('period') ? Number(url.searchParams.get('period')) : undefined
  const algorithm = url.searchParams.get('algorithm') ?? undefined

  return {
    secret,
    digits,
    period,
    algorithm: algorithm ? normalizeAlgorithm(algorithm, 'SHA1') : undefined,
    ...label,
  }
}

function normalizeTime(time: number | Date | undefined): number {
  if (time instanceof Date)
    return time.getTime()
  if (typeof time === 'number')
    return time
  return Date.now()
}

function generateCode(secret: string, counter: number, digits: number, algorithm: TotpAlgorithm): string {
  const key = decodeBase32(secret)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  const digest = createHmac(algorithm.toLowerCase(), key).update(counterBuffer).digest()
  const offset = digest[digest.length - 1] & 0x0F
  const binary = (
    ((digest[offset] & 0x7F) << 24)
    | ((digest[offset + 1] & 0xFF) << 16)
    | ((digest[offset + 2] & 0xFF) << 8)
    | (digest[offset + 3] & 0xFF)
  )
  const modulo = 10 ** digits
  return String(binary % modulo).padStart(digits, '0')
}

/**
 * 解析 2FA secret 或 `otpauth://totp/...` URI，返回当前 TOTP 验证码。
 *
 * @example
 * import { parse2FA } from '@roxybrowser/sandbox/2fa'
 * const { code, secondsRemaining } = parse2FA('JBSWY3DPEHPK3PXP')
 */
export function parse2FA(input: string, options: TwoFactorOptions = {}): TwoFactorCode {
  const parsed = parseInput(input)
  const period = normalizePositiveInteger(options.period ?? parsed.period, 30, 'period')
  const digits = normalizePositiveInteger(options.digits ?? parsed.digits, 6, 'digits')
  if (digits > 10) {
    throw new Error('[@roxybrowser/sandbox/2fa] digits 不能大于 10')
  }
  const algorithm = normalizeAlgorithm(options.algorithm ?? parsed.algorithm, 'SHA1')
  const timeMs = normalizeTime(options.time)
  const timeSeconds = Math.floor(timeMs / 1000)
  const counter = Math.floor(timeSeconds / period)
  if (counter < 0) {
    throw new Error('[@roxybrowser/sandbox/2fa] time 不能早于 Unix epoch')
  }

  const expiresAtSeconds = (counter + 1) * period
  return {
    code: generateCode(parsed.secret, counter, digits, algorithm),
    secondsRemaining: Math.max(0, expiresAtSeconds - timeSeconds),
    expiresAt: expiresAtSeconds * 1000,
    period,
    digits,
    algorithm,
    issuer: parsed.issuer,
    account: parsed.account,
  }
}

/** 只返回当前验证码的便捷函数。 */
export function totp(input: string, options?: TwoFactorOptions): string {
  return parse2FA(input, options).code
}
