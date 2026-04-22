import type { AdminLockResource } from '~/neko/messages'
import { defineStore } from 'pinia'
import { getClient } from '~/runtime/client'
import { get, set } from '~/utils/localstorage'
import { pinia } from './pinia'
import { useSettingsStore } from './settings'

interface LoginPayload {
  displayname: string
  password: string
}

export const useSessionStore = defineStore('session', {
  state: () => ({
    displayname: get<string>('displayname', ''),
    password: get<string>('password', ''),
    connecting: false,
    reconnecting: false,
    connected: false,
    /**
     * 云浏览器总使用时长的硬截止时间。
     * 前端用它做纯展示倒计时，不参与服务端鉴权判断。
     */
    usageExpiresAt: 0,
    locked: {} as Record<string, boolean>,
  }),
  getters: {
    isLocked: state => (resource: AdminLockResource) => resource in state.locked && state.locked[resource],
  },
  actions: {
    async initialize() {
      await useSettingsStore(pinia).initialize()
      await this.autoLogin()
    },
    setLogin({ displayname, password }: LoginPayload) {
      this.displayname = displayname
      this.password = password
    },
    setLocked(resource: string) {
      this.locked = {
        ...this.locked,
        [resource]: true,
      }
    },
    setUnlocked(resource: string) {
      this.locked = {
        ...this.locked,
        [resource]: false,
      }
    },
    setConnecting() {
      this.connected = false
      this.connecting = true
      this.reconnecting = false
      this.usageExpiresAt = 0
    },
    setReconnecting() {
      this.connected = false
      this.connecting = false
      this.reconnecting = true
    },
    setConnected(connected: boolean) {
      this.connected = connected
      this.connecting = false
      this.reconnecting = false

      if (!connected) {
        this.usageExpiresAt = 0
      }

      if (connected) {
        set('displayname', this.displayname)
        set('password', this.password)
      }
    },
    setUsageExpiresAt(usageExpiresAt: number) {
      this.usageExpiresAt = usageExpiresAt
    },
    async login({ displayname, password }: LoginPayload) {
      this.setLogin({ displayname, password })
      const client = getClient()
      const canConnect = await client.ensureSessionAvailable()
      if (!canConnect) {
        return
      }

      client.login(password, displayname)
    },
    async autoLogin() {
      if (this.connected || this.connecting || this.reconnecting || !getClient().supported) {
        return
      }

      const searchParams = new URLSearchParams(window.location.search)
      const pwd = searchParams.get('pwd') || searchParams.get('sessionId')
      if (!pwd) {
        return
      }

      await this.login({
        displayname: pwd,
        password: pwd,
      })
    },
    logout() {
      this.setLogin({ displayname: '', password: '' })
      set('displayname', '')
      set('password', '')
      getClient().logout()
    },
  },
})
