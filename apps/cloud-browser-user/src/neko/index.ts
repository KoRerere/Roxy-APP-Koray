import type { BaseEvents } from './base'
import type {
  AdminLockMessage,
  AdminLockResource,
  AdminTargetPayload,
  ControlClipboardPayload,
  ControlPayload,
  ControlTargetPayload,
  MemberDisconnectPayload,
  MemberListPayload,
  MemberPayload,
  ScreenConfigurationsPayload,
  ScreenResolutionPayload,
  SystemInitPayload,
  SystemMessagePayload,
} from './messages'
import type { Member } from './types'
import type EventEmitter from 'eventemitter3'
import { http } from '~/plugins/axios'
import { t } from '~/plugins/i18n'
import { openStatusDialog } from '~/runtime/status-dialog'
import { remoteStore, sessionStore, userStore, videoStore } from '~/store'
import { BaseClient } from './base'
import { EVENT } from './events'

const HTTP_PROTOCOL_REGEX = /^http/
const WS_PROTOCOL_REGEX = /^ws/
const TRAILING_SLASH_REGEX = /\/$/
const WS_SUFFIX_REGEX = /\/ws$/
const GATEWAY_SESSION_INVALID_MESSAGE = '会话无效或已过期'
const GATEWAY_USAGE_EXHAUSTED_MESSAGE = '云浏览器使用时长已耗尽'
const APP_DOWNLOAD_URL = 'https://roxybrowser.com/download'
const PEER_RECOVERY_TIMEOUT_MS = 3000
const RECONNECT_BASE_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 8000
const APP_PROMOTION_FEATURE_KEYS = [
  'connection.app_benefit_multi_account_isolation',
  'connection.app_benefit_residential_ip',
  'connection.app_benefit_full_access',
]

interface NekoEvents extends BaseEvents {}

interface HeartbeatResponse {
  success: boolean
  lastSeenAt: number
  expiresAt: number
  usageExpiresAt: number
}

function getSessionIdFromUrl(): string | null {
  const searchParams = new URLSearchParams(window.location.search)
  return searchParams.get('sessionId')
}

function redirectToAppDownload() {
  window.location.replace(APP_DOWNLOAD_URL)
}

export class NekoClient extends BaseClient implements EventEmitter<NekoEvents> {
  private url!: string
  private reconnectTimer?: number
  private peerRecoveryTimer?: number
  private reconnectAttempt = 0
  private reconnectInFlight = false
  private reconnectMode = false
  private terminalDisconnect = false
  private connectivityListenersInstalled = false
  private clipboardCapabilityWarningShown = false

  private readonly handleBrowserOnline = () => {
    this.emit('info', 'browser network restored, trying to reconnect cloud browser session')
    if (!this.connected) {
      this.scheduleReconnect(0)
    }
  }

  private readonly handleBrowserOffline = () => {
    this.emit('warn', 'browser network offline, waiting for connectivity before reconnecting')

    if (this.canAutoReconnect()) {
      sessionStore().setReconnecting()
    }
  }

  private tryLegacyClipboardWrite(text: string): boolean {
    if (typeof document === 'undefined' || !document.body || typeof document.execCommand !== 'function') {
      return false
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '0'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'

    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)

    try {
      return document.execCommand('copy')
    }
    catch {
      return false
    }
    finally {
      textarea.remove()
    }
  }

  private async syncRemoteClipboardToLocal(text: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        return
      }
      catch (error) {
        this.emit('warn', 'failed to sync remote clipboard to local device via Clipboard API', error)
      }
    }

    if (this.tryLegacyClipboardWrite(text)) {
      return
    }

    if (!this.clipboardCapabilityWarningShown) {
      this.clipboardCapabilityWarningShown = true
      this.emit('warn', 'browser clipboard write is unavailable, skip syncing clipboard to local device')
    }
  }

  private classifyGatewaySessionError(error: unknown): {
    message: string | null
    type: 'invalid-session' | 'usage-expired' | 'unknown'
  } {
    const message = this.extractGatewayErrorMessage(error)

    if (message === GATEWAY_SESSION_INVALID_MESSAGE) {
      return { message, type: 'invalid-session' }
    }

    if (message === GATEWAY_USAGE_EXHAUSTED_MESSAGE) {
      return { message, type: 'usage-expired' }
    }

    return { message, type: 'unknown' }
  }

  private async syncGatewaySessionState(sessionId: string): Promise<HeartbeatResponse> {
    const { data } = await http.post<HeartbeatResponse>('/api/auth/heartbeat', { sessionId })
    sessionStore().setUsageExpiresAt(data.usageExpiresAt)
    return data
  }

  private async showAppDownloadPrompt() {
    await openStatusDialog({
      title: t('connection.download_app_title'),
      description: t('connection.download_app_text'),
      features: APP_PROMOTION_FEATURE_KEYS.map(key => t(key)),
      primaryText: t('connection.button_download_app'),
      onPrimary: () => {
        redirectToAppDownload()
      },
    })
  }

  private async showNoticePrompt(title: string, description?: string) {
    await openStatusDialog({
      title,
      description,
      primaryText: t('connection.button_confirm'),
      variant: 'notice',
    })
  }

  /**
   * 网关心跳和 Neko WebSocket 是两条链路；这里优先提取业务错误文案，避免前端只拿到 401 文本。
   */
  private extractGatewayErrorMessage(error: unknown): string | null {
    const responseMessage = (error as {
      response?: {
        data?: {
          message?: string | string[]
        }
      }
    })?.response?.data?.message

    if (Array.isArray(responseMessage)) {
      return typeof responseMessage[0] === 'string' ? responseMessage[0] : null
    }

    if (typeof responseMessage === 'string') {
      return responseMessage
    }

    if (error instanceof Error) {
      return error.message
    }

    return null
  }

  init() {
    const url = import.meta.env.DEV
      ? `ws://${location.host.split(':')[0]}:${import.meta.env.VITE_SERVER_PORT ?? '8080'}/ws`
      : `${location.protocol.replace(HTTP_PROTOCOL_REGEX, 'ws')}//${location.host}${location.pathname.replace(
        TRAILING_SLASH_REGEX,
        '',
      )}/ws`

    this.initWithURL(url)
  }

  initWithURL(url: string) {
    this.url = url
    http.defaults.baseURL = url.replace(WS_PROTOCOL_REGEX, 'http').replace(WS_SUFFIX_REGEX, '')

    if (!this.connectivityListenersInstalled) {
      window.addEventListener('online', this.handleBrowserOnline)
      window.addEventListener('offline', this.handleBrowserOffline)
      this.connectivityListenersInstalled = true
    }
  }

  private cleanup() {
    sessionStore().setConnected(false)
    remoteStore().reset()
    userStore().reset()
    videoStore().reset()
  }

  login(password: string, displayname: string) {
    this.terminalDisconnect = false
    this.reconnectMode = false
    this.reconnectInFlight = false
    this.reconnectAttempt = 0
    this.clearReconnectTimer()
    this.clearPeerRecoveryTimer()
    this.connect(this.url, password, displayname)
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
  }

  private clearPeerRecoveryTimer() {
    if (this.peerRecoveryTimer) {
      clearTimeout(this.peerRecoveryTimer)
      this.peerRecoveryTimer = undefined
    }
  }

  private getReconnectDelayMs() {
    return Math.min(RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_DELAY_MS)
  }

  private canAutoReconnect(reason?: Error): boolean {
    if (this.terminalDisconnect) {
      return false
    }

    const session = sessionStore()
    if (!session.password || !session.displayname) {
      return false
    }

    const message = reason?.message
    return message !== GATEWAY_SESSION_INVALID_MESSAGE
      && message !== GATEWAY_USAGE_EXHAUSTED_MESSAGE
      && message !== t('connection.kicked')
  }

  private scheduleReconnect(delayMs = this.getReconnectDelayMs()) {
    if (!this.canAutoReconnect()) {
      return
    }

    if (this.reconnectTimer || this.reconnectInFlight || this.connected) {
      return
    }

    sessionStore().setReconnecting()

    if (!navigator.onLine) {
      this.emit('warn', 'browser is offline, skip reconnect until online event arrives')
      return
    }

    this.emit('info', `scheduling reconnect attempt ${this.reconnectAttempt + 1} in ${delayMs}ms`)
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined
      void this.reconnect()
    }, delayMs)
  }

  private async reconnect() {
    if (!this.canAutoReconnect() || this.connected || this.reconnectInFlight) {
      return
    }

    if (!navigator.onLine) {
      this.emit('warn', 'browser is still offline, postpone reconnect')
      return
    }

    const session = sessionStore()
    this.reconnectInFlight = true
    this.reconnectMode = true
    this.reconnectAttempt += 1

    try {
      const canConnect = await this.ensureSessionAvailable()
      if (!canConnect) {
        this.terminalDisconnect = true
        return
      }

      this.connect(this.url, session.password, session.displayname)
    }
    catch (error) {
      this.emit('warn', `reconnect attempt ${this.reconnectAttempt} failed`, error)
      this.reconnectInFlight = false
      this.scheduleReconnect()
    }
  }

  /**
   * 连接前先用网关校验 sessionId 是否仍然有效，避免用户只看到 websocket closed/timeout。
   */
  async ensureSessionAvailable(): Promise<boolean> {
    const sessionId = getSessionIdFromUrl()
    if (!sessionId) {
      return true
    }

    try {
      await this.syncGatewaySessionState(sessionId)
      return true
    }
    catch (error: unknown) {
      const { message, type } = this.classifyGatewaySessionError(error)

      if (type === 'invalid-session') {
        this.terminalDisconnect = true
        this.cleanup()
        await this.showAppDownloadPrompt()
        return false
      }

      if (type === 'usage-expired') {
        this.terminalDisconnect = true
        this.cleanup()
        await this.showAppDownloadPrompt()
        return false
      }

      this.emit('warn', `failed to precheck gateway session: ${message || error}`)
      return true
    }
  }

  async sendHeartbeat() {
    this.sendMessage(EVENT.CLIENT.HEARTBEAT)
    const sessionId = getSessionIdFromUrl()
    if (!sessionId) {
      return
    }

    try {
      await this.syncGatewaySessionState(sessionId)
    }
    catch (error: unknown) {
      const { message, type } = this.classifyGatewaySessionError(error)

      if (type === 'invalid-session') {
        this.terminalDisconnect = true
        this.onDisconnected(new Error(message || GATEWAY_SESSION_INVALID_MESSAGE))
        await this.showAppDownloadPrompt()
        return
      }

      if (type === 'usage-expired') {
        this.terminalDisconnect = true
        this.onDisconnected(new Error(message || GATEWAY_USAGE_EXHAUSTED_MESSAGE))
        await this.showAppDownloadPrompt()
        return
      }

      this.emit('warn', `failed to sync gateway heartbeat: ${message || error}`)
    }
  }

  logout() {
    this.terminalDisconnect = true
    this.reconnectMode = false
    this.reconnectInFlight = false
    this.clearReconnectTimer()
    this.clearPeerRecoveryTimer()
    this.disconnect()
    this.cleanup()
    void this.showNoticePrompt(t('connection.logged_out'))
  }

  /////////////////////////////
  /**
   * Internal Events
   */
  protected [EVENT.RECONNECTING]() {
    if (!this.canAutoReconnect()) {
      return
    }

    sessionStore().setReconnecting()
    this.clearPeerRecoveryTimer()
    this.peerRecoveryTimer = window.setTimeout(() => {
      this.peerRecoveryTimer = undefined

      if (this.connected) {
        return
      }

      this.emit('warn', 'peer connection did not recover in time, rebuilding cloud browser connection')
      this.onDisconnected(new Error('peer disconnected'))
    }, PEER_RECOVERY_TIMEOUT_MS)
  }

  protected [EVENT.CONNECTING]() {
    this.clearPeerRecoveryTimer()
    if (this.reconnectMode) {
      sessionStore().setReconnecting()
      return
    }

    sessionStore().setConnecting()
  }

  protected [EVENT.CONNECTED]() {
    this.clearReconnectTimer()
    this.clearPeerRecoveryTimer()
    this.reconnectInFlight = false
    this.reconnectMode = false
    this.reconnectAttempt = 0
    this.terminalDisconnect = false
    userStore().setMember(this.id)
    sessionStore().setConnected(true)
    void this.sendHeartbeat()
    // 连接建立后立即请求控制权（等同隐式托管下首次点击），免手动抢控
    remoteStore().request()
  }

  protected [EVENT.DISCONNECTED](reason?: Error) {
    const shouldReconnect = this.canAutoReconnect(reason)

    this.clearPeerRecoveryTimer()
    this.reconnectInFlight = false
    this.cleanup()

    if (shouldReconnect) {
      this.scheduleReconnect()
      return
    }

    this.reconnectMode = false
    this.clearReconnectTimer()
  }

  protected [EVENT.TRACK](event: RTCTrackEvent) {
    const { track, streams } = event
    if (track.kind === 'audio') {
      return
    }

    videoStore().addTrack([track, streams[0]])
    videoStore().setStream(0)
  }

  protected [EVENT.DATA]() {}

  /////////////////////////////
  /**
   * System Events
   */
  protected [EVENT.SYSTEM.INIT]({ implicit_hosting, locks, heartbeat_interval }: SystemInitPayload) {
    remoteStore().setImplicitHosting(implicit_hosting)

    for (const resource in locks) {
      this[EVENT.ADMIN.LOCK]({
        event: EVENT.ADMIN.LOCK,
        resource: resource as AdminLockResource,
        id: locks[resource],
      })
    }

    if (heartbeat_interval > 0) {
      if (this._ws_heartbeat) {
        clearInterval(this._ws_heartbeat)
      }
      this._ws_heartbeat = window.setInterval(() => {
        void this.sendHeartbeat()
      }, heartbeat_interval * 1000)
    }
  }

  protected [EVENT.SYSTEM.DISCONNECT]({ message }: SystemMessagePayload) {
    if (message === 'kicked') {
      this.terminalDisconnect = true
      sessionStore().logout()
      message = t('connection.kicked')
      this.onDisconnected(new Error(message))

      void this.showNoticePrompt(t('connection.disconnected'), message)
      return
    }

    this.terminalDisconnect = true
    this.onDisconnected(new Error(message))
    void this.showAppDownloadPrompt()
  }

  protected [EVENT.SYSTEM.ERROR]({ title, message }: SystemMessagePayload) {
    void this.showNoticePrompt(title, message)
  }

  /////////////////////////////
  /**
   * Member Events
   */
  protected [EVENT.MEMBER.LIST]({ members }: MemberListPayload) {
    userStore().setMembers(members)
  }

  protected [EVENT.MEMBER.CONNECTED](member: MemberPayload) {
    userStore().addMember(member)
  }

  protected [EVENT.MEMBER.DISCONNECTED]({ id }: MemberDisconnectPayload) {
    const member = this.member(id)
    if (!member) {
      return
    }

    userStore().delMember(id)
  }

  /////////////////////////////
  /**
   * Control Events
   */
  protected [EVENT.CONTROL.LOCKED]({ id }: ControlPayload) {
    remoteStore().setHost(id)
    remoteStore().changeKeyboard()
  }

  protected [EVENT.CONTROL.RELEASE]({ id: _id }: ControlPayload) {
    remoteStore().reset()
  }

  protected [EVENT.CONTROL.REQUEST](_payload: ControlPayload) {}

  protected [EVENT.CONTROL.REQUESTING](_payload: ControlPayload) {}

  protected [EVENT.CONTROL.GIVE]({ id: _id, target }: ControlTargetPayload) {
    const member = this.member(target)
    if (!member) {
      return
    }

    remoteStore().setHost(member)
    remoteStore().changeKeyboard()
  }

  protected [EVENT.CONTROL.CLIPBOARD]({ text }: ControlClipboardPayload) {
    remoteStore().setClipboard(text)
    void this.syncRemoteClipboardToLocal(text)
  }

  /////////////////////////////
  /**
   * Chat Events
   */
  protected [EVENT.CHAT.MESSAGE]() {}

  protected [EVENT.CHAT.EMOTE]() {}

  /////////////////////////////
  /**
   * File Transfer Events
   */
  protected [EVENT.FILETRANSFER.LIST]() {}

  /////////////////////////////
  /**
   * Screen Events
   */
  protected [EVENT.SCREEN.CONFIGURATIONS]({ configurations }: ScreenConfigurationsPayload) {
    videoStore().setConfigurations(configurations)
  }

  protected [EVENT.SCREEN.RESOLUTION]({ id: _id, width, height, rate }: ScreenResolutionPayload) {
    videoStore().setResolution({ width, height, rate })
  }

  /////////////////////////////
  /**
   * Broadcast Events
   */
  protected [EVENT.BROADCAST.STATUS]() {}

  /////////////////////////////
  /**
   * Admin Events
   */
  protected [EVENT.ADMIN.BAN](_payload: AdminTargetPayload) {}

  protected [EVENT.ADMIN.KICK](_payload: AdminTargetPayload) {}

  protected [EVENT.ADMIN.MUTE]({ id: _id, target }: AdminTargetPayload) {
    if (!target) {
      return
    }

    userStore().setMuted({ id: target, muted: true })
  }

  protected [EVENT.ADMIN.UNMUTE]({ id: _id, target }: AdminTargetPayload) {
    if (!target) {
      return
    }

    userStore().setMuted({ id: target, muted: false })
  }

  protected [EVENT.ADMIN.LOCK]({ id: _id, resource }: AdminLockMessage) {
    sessionStore().setLocked(resource)
  }

  protected [EVENT.ADMIN.UNLOCK]({ id: _id, resource }: AdminLockMessage) {
    sessionStore().setUnlocked(resource)
  }

  protected [EVENT.ADMIN.CONTROL]({ id, target: _target }: AdminTargetPayload) {
    remoteStore().setHost(id)
    remoteStore().changeKeyboard()
  }

  protected [EVENT.ADMIN.RELEASE]({ id: _id, target: _target }: AdminTargetPayload) {
    remoteStore().reset()
  }

  protected [EVENT.ADMIN.GIVE]({ id: _id, target }: AdminTargetPayload) {
    if (!target) {
      return
    }

    const member = this.member(target)
    if (!member) {
      return
    }

    remoteStore().setHost(member)
    remoteStore().changeKeyboard()
  }

  /**
   * Utilities
   */
  protected member(id: string): Member | undefined {
    return userStore().members[id]
  }
}
