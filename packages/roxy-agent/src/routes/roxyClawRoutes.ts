import type { Request, Response } from 'express'
import * as lark from '@larksuiteoapi/node-sdk'
import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { startIMServiceIfEnabled, stopIMService } from '@/im'

const router: Router = Router()
const WEIXIN_BOT_BASE_URL = 'https://ilinkai.weixin.qq.com'

type LarkScanStatus = 'waiting' | 'polling' | 'slow_down' | 'domain_switched' | 'connected' | 'expired' | 'cancelled' | 'error'

interface LarkScanInstallResult {
  appId: string
  appSecret: string
  environment: 'lark' | 'feishu'
  installerOpenId?: string
}

interface LarkScanInstallSession {
  installId: string
  controller: AbortController
  status: LarkScanStatus
  qrUrl?: string
  expireIn?: number
  interval?: number
  result?: LarkScanInstallResult
  error?: string
  createdAt: number
}

const larkScanInstallSessions = new Map<string, LarkScanInstallSession>()

function ok<T>(res: Response, data?: T, message?: string) {
  return res.json({ code: 0, success: true, data, message })
}

function fail(res: Response, message: string) {
  return res.json({ code: 1, success: false, message })
}

function normalizeLarkInstallError(error: any): { status: LarkScanStatus, message: string } {
  const code = error?.code || error?.name
  const description = error?.description || error?.message || String(error)
  if (code === 'expired_token') {
    return { status: 'expired', message: description || '二维码已过期' }
  }
  if (code === 'abort' || code === 'AbortError') {
    return { status: 'cancelled', message: description || '扫码接入已取消' }
  }
  return { status: 'error', message: description || '扫码接入失败' }
}

function scheduleLarkInstallCleanup(installId: string, delay = 5 * 60 * 1000) {
  setTimeout(() => {
    larkScanInstallSessions.delete(installId)
  }, delay).unref?.()
}

function createLarkRegisterAddons() {
  return {
    scopes: {
      tenant: [
        'im:message',
        'im:message.p2p_msg:readonly',
        'im:message.group_at_msg:readonly',
        'im:message:send_as_bot',
        'im:message:update',
      ],
    },
    events: {
      items: {
        tenant: ['im.message.receive_v1'],
      },
    },
  }
}

const TokenSchema = z.object({ token: z.string().min(1) })
const BotTokenSchema = z.object({ botToken: z.string().min(1) })
const LarkTestSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().min(1),
  environment: z.enum(['lark', 'feishu']).default('feishu'),
})
const InstallIdSchema = z.object({ installId: z.string().min(1) })
const QrcodeSchema = z.object({ qrcode: z.string().min(1) })

router.post('/start', async (_req: Request, res: Response) => {
  try {
    const started = await startIMServiceIfEnabled()
    if (!started) {
      return fail(res, 'RoxyClaw 未启用或未配置可启动的平台')
    }

    return ok(res, { message: 'RoxyClaw started successfully' }, 'RoxyClaw started successfully')
  }
  catch (error) {
    console.error('[RoxyClaw] Failed to start:', error)
    return fail(res, error instanceof Error ? error.message : 'Failed to start RoxyClaw')
  }
})

router.post('/stop', async (_req: Request, res: Response) => {
  try {
    await stopIMService()
    return ok(res, null, 'RoxyClaw stopped successfully')
  }
  catch (error) {
    console.error('[RoxyClaw] Failed to stop:', error)
    return fail(res, error instanceof Error ? error.message : 'Failed to stop RoxyClaw')
  }
})

router.post('/test/telegram', async (req: Request, res: Response) => {
  const parsed = TokenSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return fail(res, 'Telegram bot token is required')
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${parsed.data.token}/getMe`)
    const data: any = await response.json()

    if (data.ok && data.result && data.result.is_bot) {
      return ok(res, null, 'Telegram bot token 有效')
    }

    return fail(res, 'Telegram bot token 无效')
  }
  catch (error) {
    console.error('[RoxyClaw] Telegram test failed:', error)
    return fail(res, '网络错误')
  }
})

router.post('/test/lark', async (req: Request, res: Response) => {
  const parsed = LarkTestSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return fail(res, 'app credentials is required')
  }

  try {
    const domain = parsed.data.environment === 'lark' ? 'open.larksuite.com' : 'open.feishu.cn'
    const response = await fetch(`https://${domain}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: parsed.data.appId,
        app_secret: parsed.data.appSecret,
      }),
    })
    const data: any = await response.json()

    if (data.code === 0 && data.tenant_access_token) {
      return ok(res, null, 'Lark / 飞书 app credentials 有效!')
    }

    return fail(res, 'app credentials 无效')
  }
  catch (error) {
    console.error('[RoxyClaw] Lark test failed:', error)
    return fail(res, '网络错误')
  }
})

router.post('/lark/scan-install', async (_req: Request, res: Response) => {
  const installId = randomUUID()
  const controller = new AbortController()
  const session: LarkScanInstallSession = {
    installId,
    controller,
    status: 'waiting',
    createdAt: Date.now(),
  }
  larkScanInstallSessions.set(installId, session)

  let resolveQrReady!: (value: { installId: string, qrUrl: string, expireIn: number }) => void
  let rejectQrReady!: (reason?: unknown) => void
  const qrReady = new Promise<{ installId: string, qrUrl: string, expireIn: number }>((resolve, reject) => {
    resolveQrReady = resolve
    rejectQrReady = reject
  })

  const installTask = (lark as any).registerApp({
    source: 'roxy-browser',
    createOnly: true,
    signal: controller.signal,
    appPreset: {
      name: 'RoxyClaw',
      desc: 'RoxyBrowser AI assistant for Lark / Feishu',
    },
    addons: createLarkRegisterAddons(),
    onQRCodeReady(info: { url: string, expireIn: number }) {
      session.qrUrl = info.url
      session.expireIn = info.expireIn
      session.status = 'waiting'
      resolveQrReady({
        installId,
        qrUrl: info.url,
        expireIn: info.expireIn,
      })
    },
    onStatusChange(info: { status: LarkScanStatus, interval?: number }) {
      if (info.status) {
        session.status = info.status
      }
      if (info.interval) {
        session.interval = info.interval
      }
    },
  }).then((result: any) => {
    const appId = result?.client_id
    const appSecret = result?.client_secret
    if (!appId || !appSecret) {
      throw new Error('扫码授权成功但未返回 App ID 或 App Secret')
    }

    const environment = result?.user_info?.tenant_brand === 'lark' ? 'lark' : 'feishu'
    session.status = 'connected'
    session.result = {
      appId,
      appSecret,
      environment,
      installerOpenId: result?.user_info?.open_id,
    }
    scheduleLarkInstallCleanup(installId)
  }).catch((error: any) => {
    const normalized = normalizeLarkInstallError(error)
    session.status = normalized.status
    session.error = normalized.message
    rejectQrReady(error)
    scheduleLarkInstallCleanup(installId)
  })

  try {
    const data = await Promise.race([
      qrReady,
      installTask.then(() => {
        throw new Error(session.error || '扫码接入未返回二维码')
      }),
    ])
    return ok(res, data)
  }
  catch (error) {
    const normalized = normalizeLarkInstallError(error)
    session.status = normalized.status
    session.error = normalized.message
    return fail(res, normalized.message)
  }
})

router.get('/lark/scan-install/:installId', async (req: Request, res: Response) => {
  const parsed = InstallIdSchema.safeParse(req.params)
  if (!parsed.success) {
    return fail(res, 'installId is required')
  }

  const session = larkScanInstallSessions.get(parsed.data.installId)
  if (!session) {
    return fail(res, '扫码接入会话不存在或已过期')
  }

  return ok(res, {
    status: session.status,
    interval: session.interval,
    result: session.result,
    error: session.error,
  })
})

router.delete('/lark/scan-install/:installId', async (req: Request, res: Response) => {
  const parsed = InstallIdSchema.safeParse(req.params)
  if (!parsed.success) {
    return ok(res, null)
  }

  const session = larkScanInstallSessions.get(parsed.data.installId)
  if (!session) {
    return ok(res, null)
  }

  session.status = 'cancelled'
  session.controller.abort()
  larkScanInstallSessions.delete(parsed.data.installId)
  return ok(res, null)
})

router.post('/test/slack', async (req: Request, res: Response) => {
  const parsed = BotTokenSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return fail(res, 'Slack bot token is required')
  }

  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${parsed.data.botToken}`,
      },
    })
    const data: any = await response.json()

    if (data.ok) {
      return ok(res, null, 'Slack bot token 有效!')
    }

    return fail(res, data.error || 'Slack bot token 无效')
  }
  catch (error) {
    console.error('[RoxyClaw] Slack test failed:', error)
    return fail(res, '网络错误')
  }
})

router.post('/test/discord', async (req: Request, res: Response) => {
  const parsed = BotTokenSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return fail(res, 'Discord bot token is required')
  }

  try {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${parsed.data.botToken}` },
    })

    if (response.ok) {
      return ok(res, null, 'Discord bot token 有效!')
    }

    const data: any = await response.json().catch(() => null)
    return fail(res, data?.message || 'Discord bot token 无效')
  }
  catch (error) {
    console.error('[RoxyClaw] Discord test failed:', error)
    return fail(res, 'Network error')
  }
})

router.get('/weixin/qrcode', async (_req: Request, res: Response) => {
  try {
    const response = await fetch(`${WEIXIN_BOT_BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=3`)
    const data: any = await response.json()

    if (!response.ok || !data?.qrcode) {
      return fail(res, data?.errmsg || data?.msg || 'Failed to get Weixin QR code')
    }

    return ok(res, {
      qrcode: data.qrcode || '',
      url: data.url || '',
      qrcodeImgContent: data.qrcode_img_content || '',
    })
  }
  catch (error) {
    console.error('[RoxyClaw] Weixin QR code request failed:', error)
    return fail(res, 'Network error')
  }
})

router.get('/weixin/qrcode-status', async (req: Request, res: Response) => {
  const parsed = QrcodeSchema.safeParse(req.query)
  if (!parsed.success) {
    return fail(res, 'qrcode is required')
  }

  try {
    const response = await fetch(`${WEIXIN_BOT_BASE_URL}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(parsed.data.qrcode)}`)
    const data: any = await response.json()

    if (!response.ok) {
      return fail(res, data?.errmsg || data?.msg || 'Failed to get Weixin QR status')
    }

    return ok(res, {
      status: data?.status || '',
      botToken: data?.bot_token || '',
      baseUrl: data?.baseurl || WEIXIN_BOT_BASE_URL,
    })
  }
  catch (error) {
    console.error('[RoxyClaw] Weixin QR status request failed:', error)
    return fail(res, 'Network error')
  }
})

export default router
