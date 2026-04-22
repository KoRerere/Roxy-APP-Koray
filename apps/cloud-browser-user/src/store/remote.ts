import { defineStore } from 'pinia'
import type { Member } from '~/neko/types'
import { EVENT } from '~/neko/events'
import { getClient } from '~/runtime/client'
import { pinia } from './pinia'
import { useSessionStore } from './session'
import { useSettingsStore } from './settings'
import { useUserStore } from './user'

const keyboardModifierState = (capsLock: boolean, numLock: boolean, scrollLock: boolean) =>
  Number(capsLock) + 2 * Number(numLock) + 4 * Number(scrollLock)

export const useRemoteStore = defineStore('remote', {
  state: () => ({
    id: '',
    locked: false,
    implicitHosting: true,
    clipboard: '',
    keyboardModifierState: -1,
  }),
  getters: {
    controlling: (state) => useUserStore(pinia).id === state.id,
    hosting: (state) => useUserStore(pinia).id === state.id || state.implicitHosting,
    hosted: (state) => state.id !== '' || state.implicitHosting,
    host: (state) => useUserStore(pinia).members[state.id] || (state.implicitHosting && useUserStore(pinia).id) || null,
  },
  actions: {
    setHost(host: string | Member) {
      this.id = typeof host === 'string' ? host : host.id
    },
    setKeyboardModifierState({ capsLock, numLock, scrollLock }: { capsLock: boolean; numLock: boolean; scrollLock: boolean }) {
      this.keyboardModifierState = keyboardModifierState(capsLock, numLock, scrollLock)
    },
    setLocked(locked: boolean) {
      this.locked = locked
    },
    setImplicitHosting(val: boolean) {
      this.implicitHosting = val
    },
    setClipboard(clipboard: string) {
      this.clipboard = clipboard
    },
    reset() {
      this.id = ''
      this.locked = false
      this.clipboard = ''
    },
    toggle() {
      const session = useSessionStore(pinia)
      if (!session.connected) {
        return
      }

      if (!this.hosting) {
        getClient().sendMessage(EVENT.CONTROL.REQUEST)
      } else {
        getClient().sendMessage(EVENT.CONTROL.RELEASE)
      }
    },
    request() {
      const session = useSessionStore(pinia)
      if (!session.connected || this.controlling) {
        return
      }

      getClient().sendMessage(EVENT.CONTROL.REQUEST)
    },
    release() {
      const session = useSessionStore(pinia)
      if (!session.connected || !this.hosting) {
        return
      }

      getClient().sendMessage(EVENT.CONTROL.RELEASE)
    },
    give(member: string | Member) {
      const session = useSessionStore(pinia)
      const user = useUserStore(pinia)
      if (!session.connected || !this.hosting) {
        return
      }

      const targetMember = typeof member === 'string' ? user.members[member] : member
      if (!targetMember) {
        return
      }

      getClient().sendMessage(EVENT.CONTROL.GIVE, { id: targetMember.id })
    },
    changeKeyboard() {
      const session = useSessionStore(pinia)
      const settings = useSettingsStore(pinia)
      if (!session.connected || !this.hosting) {
        return
      }

      getClient().sendMessage(EVENT.CONTROL.KEYBOARD, { layout: settings.keyboard_layout })
    },
    syncClipboard(clipboard: string) {
      const session = useSessionStore(pinia)
      if (!session.connected || !this.hosting || this.clipboard === clipboard) {
        return
      }

      this.setClipboard(clipboard)
      getClient().sendMessage(EVENT.CONTROL.CLIPBOARD, { text: clipboard })
    },
    syncKeyboardModifierState({ capsLock, numLock, scrollLock }: { capsLock: boolean; numLock: boolean; scrollLock: boolean }) {
      if (this.keyboardModifierState === keyboardModifierState(capsLock, numLock, scrollLock)) {
        return
      }

      this.setKeyboardModifierState({ capsLock, numLock, scrollLock })
      getClient().sendMessage(EVENT.CONTROL.KEYBOARD, { capsLock, numLock, scrollLock })
    },
  },
})
