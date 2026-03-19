import { API } from '/@/api'
import { decryptAESGCM, encryptAESGCM, getRandomIntByRange, safeParseJSON } from '/@/utils'

export function useTrack() {
  const trackMap = ref()

  async function saveLocalTrack(key?: string) {
    if (!key || key === '_t')
      return

    if (!trackMap.value) {
      const sentryStr = safeParseJSON(localStorage.getItem('$localTK'))
      trackMap.value = sentryStr ? await decryptAESGCM(sentryStr) : { _t: genRandomTime() }
    }
    trackMap.value[key] ??= 0
    trackMap.value[key] += 1

    const sentryStr = await encryptAESGCM(JSON.stringify(trackMap.value))
    localStorage.setItem('$localTK', sentryStr)

    if (Date.now() > trackMap.value._t) {
      sendLocalTrack(sentryStr)
    }
  }

  async function sendLocalTrack(sentryStr: string) {
    const { code } = await API.base.userSentryClientCreate({ sentryStr })
    if (code !== 0)
      return
    trackMap.value = undefined
    localStorage.removeItem('$localTK')
  }

  function genRandomTime() {
    // const DAY1 = 1000 * 60 * 60 * 24
    const DAY1 = 1000 * 60
    return Date.now() + getRandomIntByRange(DAY1 * 0.75, DAY1 * 1.25)
  }

  return {
    trackMap,
    saveLocalTrack,
  }
}
