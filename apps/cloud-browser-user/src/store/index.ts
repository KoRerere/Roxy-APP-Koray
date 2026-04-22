import { pinia } from './pinia'
import { useRemoteStore } from './remote'
import { useSessionStore } from './session'
import { useSettingsStore } from './settings'
import { useUserStore } from './user'
import { useVideoStore } from './video'

export { pinia }
export { useRemoteStore } from './remote'
export { useSessionStore } from './session'
export { useSettingsStore } from './settings'
export { useUserStore } from './user'
export { useVideoStore } from './video'

export const sessionStore = () => useSessionStore(pinia)
export const userStore = () => useUserStore(pinia)
export const remoteStore = () => useRemoteStore(pinia)
export const settingsStore = () => useSettingsStore(pinia)
export const videoStore = () => useVideoStore(pinia)

export async function initializeStores() {
  await sessionStore().initialize()
}
