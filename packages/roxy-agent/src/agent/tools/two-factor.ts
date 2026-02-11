import { DynamicStructuredTool } from '@langchain/core/tools'
import { createGuardrails, generate } from 'otplib'
import { z } from 'zod'

/** 自定义 TOTP Step（默认 30 秒） */
const TOTP_STEP = 30

/** 创建宽松的 guardrails，允许更短的 secret（兼容性处理） */
const relaxedGuardrails = createGuardrails({
  MIN_SECRET_BYTES: 10, // 允许至少 10 字节的 secret，兼容一些较短的 secret
})

/** 存储每个 secret 的最后生成的 token，避免重复 */
const lastTokenMap = new Map<string, string>()

/** 等待指定毫秒数 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })
}

/**
 * 获取 TOTP 剩余时间（秒）
 */
function timeRemaining(): number {
  const epoch = Math.round(Date.now() / 1000.0)
  return TOTP_STEP - (epoch % TOTP_STEP)
}

/**
 * 生成唯一新鲜 TOTP 验证码
 * @param secret TOTP secret
 * @param minRemaining 最小剩余时间（秒），默认 3 秒
 * @returns TOTP 验证码
 */
async function generateSafeUniqueToken(secret: string, minRemaining = 3): Promise<string> {
  let remaining = timeRemaining()

  // 等待避免使用临界值 token
  if (remaining < minRemaining) {
    const waitTime = (remaining + 1) * 1000
    console.log(`🕒 Token 即将过期（剩余 ${remaining}s），等待 ${waitTime / 1000}s 到下一个周期...`)
    await sleep(waitTime)
    remaining = timeRemaining()
  }

  // 生成初始 token - 使用 generate 函数，传入 secret 和宽松的 guardrails
  let token = await generate({ secret, guardrails: relaxedGuardrails })

  // 检查是否重复
  if (token === lastTokenMap.get(secret)) {
    const wait = (remaining + 1) * 1000
    console.log(`🕒 重复 token，等待 ${wait / 1000}s...`)
    await sleep(wait)
    token = await generate({ secret, guardrails: relaxedGuardrails })
  }

  lastTokenMap.set(secret, token)
  return token
}

export const twoFactorTools = [
  new DynamicStructuredTool({
    name: 'roxy_get_two_factor_code',
    description: 'Generate a safe and unique two-factor authentication (2FA/TOTP) code for a given secret. This tool automatically handles edge cases like tokens about to expire and duplicate tokens. Works with all standard TOTP implementations (Google Authenticator, Microsoft Authenticator, Authy, etc.).',
    schema: z.object({
      secret: z.string().describe('The TOTP secret to generate the 2FA code for'),
    }),
    func: async ({ secret }: { secret: string }) => {
      try {
        const code = await generateSafeUniqueToken(secret)
        return `✅ Generated 2FA code: ${code}\n\nSecret: ${secret}\nNote: This code is valid for the current 30-second window and has been generated safely to avoid expiration issues.`
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('Error generating 2FA code:', error)
        return `❌ Error generating 2FA code: ${errorMessage}\n\nSecret: ${secret}\n\nPlease check if the secret is valid.`
      }
    },
  }),
  // new DynamicStructuredTool({
  //   name: 'roxy_verify_two_factor_code',
  //   description: 'verify the two factor code for a given secret',
  //   schema: z.object({
  //     secret: z.string().describe('The secret to verify the two factor code for'),
  //     code: z.string().describe('The code to verify'),
  //   }),
  //   func: async ({ secret, code }: { secret: string, code: string }) => {
  //     const result = await verify({ token: code, secret });
  //     return `${code} is ${result.valid ? 'valid' : 'invalid'}`;
  //   },
  // }),
]
