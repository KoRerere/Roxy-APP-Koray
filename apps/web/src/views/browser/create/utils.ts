import { getRandomInt } from '/@/utils'

/**
 * 获取canvas随机值,从0123456789ABCDEF里面随机取32位
 */
export function getCanvasContextNoiseValue() {
  const randStr = '0123456789ABCDEF'
  return Array.from({ length: 32 }, () => {
    return randStr[getRandomInt(0, randStr.length - 1)]
  }).join('')
}

export function getwebGLNoiseValue() {
  const randStr = 'ABCDEFGHIJKLMNOPQISTUVWXYZ0123456789'
  // 0-9随机数，原生js
  const n1 = Math.floor(Math.random() * 10)
  // 0-9随机数，原生js
  const n2 = Math.floor(Math.random() * 10)
  // n3从randStr随机取14个字符
  let n3 = ''
  for (let i = 0; i < 14; i++) {
    const randNum = Math.floor(Math.random() * randStr.length)
    n3 += randStr[randNum]
  }

  return `${n1}${n2}${n3}`
}

export function getClientRectsValue() {
  return {
    clientRectsNoiseFactorX: (2 * Math.random() - 1), // x 轴
    clientRectsNoiseFactorY: (2 * Math.random() - 1), // y轴
  }
}

/**
 * 生成随机字体
 */
export async function getRandomFonts() {
  return (await electronAPI.send('util:genRandomFonts')).join(';')
}
// 获取speechVoices随机值
// 生成不同的系统中可用的语音列表,语言列表有很多。
// 以下是随机举例，按照参考list 一般是18-20个。
// 其中isLocalService代表是否是local，如果不是就自动设成了 remote 属性 ，
/**
 * 一般isLocalService 会有3个true
 */
export function getSpeechSynthesis() {
  const voices = [
    {
      name: 'Google Bahasa Indonesia',
      lang: 'id-ID',
      isLocalService: false,
    },
    {
      name: 'Google Deutsch',
      lang: 'de-DE',
      isLocalService: false,
    },
    {
      name: 'Google español',
      lang: 'es-ES',
      isLocalService: false,
    },
    {
      name: 'Google español de Estados Unidos',
      lang: 'es-US',
      isLocalService: false,
    },
    {
      name: 'Google français',
      lang: 'fr-FR',
      isLocalService: false,
    },
    {
      name: 'Google italiano',
      lang: 'it-IT',
      isLocalService: false,
    },
    {
      name: 'Google Nederlands',
      lang: 'nl-NL',
      isLocalService: false,
    },
    {
      name: 'Google polski',
      lang: 'pl-PL',
      isLocalService: false,
    },
    {
      name: 'Google português do Brasil',
      lang: 'pt-BR',
      isLocalService: false,
    },
    {
      name: 'Google UK English Female',
      lang: 'en-GB',
      isLocalService: false,
    },
    {
      name: 'Google UK English Male',
      lang: 'en-GB',
      isLocalService: false,
    },
    {
      name: 'Google US English',
      lang: 'en-US',
      isLocalService: false,
    },
    {
      name: 'Google русский',
      lang: 'ru-RU',
      isLocalService: false,
    },
    {
      name: 'Google हिन्दी',
      lang: 'hi-IN',
      isLocalService: false,
    },
    {
      name: 'Google 國語（臺灣）',
      lang: 'zh-TW',
      isLocalService: false,
    },
    {
      name: 'Google 日本語',
      lang: 'ja-JP',
      isLocalService: false,
    },
    {
      name: 'Google 한국의',
      lang: 'ko-KR',
      isLocalService: false,
    },
    {
      name: 'Google 普通话（中国大陆）',
      lang: 'zh-CN',
      isLocalService: false,
    },
    {
      name: 'Google 粤語（香港）',
      lang: 'zh-HK',
      isLocalService: false,
    },
  ]

  for (let i = 0; i < Math.floor(Math.random() * 2); i++) {
    voices.splice(Math.floor(Math.random() * (voices.length - 1)), 1)
  }

  const newArray = []
  for (let i = 0; i < 3; i++) {
    const index = Math.floor(Math.random() * (voices.length - 1))
    const [obj] = voices.splice(index, 1)
    // console.log(`index`, index, `obj`, obj)
    newArray.push({
      ...obj,
      isLocalService: true,
    })
  }
  return [...newArray, ...voices]
}

export function getDefaultTemplate() {
  return {
    os: 'Windows',
    osVersion: '11',
    coreVersion: '125',
    isLanguageBaseIp: true,
    isDisplayLanguageBaseIp: true,
    isTimeZone: true,
    position: 1,
    isPositionBaseIp: true,
    forbidAudio: true,
    forbidImage: true,
    forbidMedia: true,
    openWidth: 1000,
    openHeight: 1000,
    resolutionType: false,
    fontType: false,
    webRTC: 2,
    webGL: true,
    webGLInfo: true,
    webGpu: 'webgl',
    canvas: true,
    audioContext: true,
    speechVoices: true,
    doNotTrack: true,
    clientRects: true,
    deviceInfo: true,
    deviceNameSwitch: true,
    macInfo: true,
    hardwareConcurrent: '4',
    deviceMemory: '8',
    disableSsl: false,
    portScanProtect: true,
    portScanList: '',
    useGpu: true,
    sandboxPermission: false,
    startupParam: '',
    isDisplayName: false,
    syncBookmark: false,
    syncHistory: false,
    syncTab: true,
    syncCookie: true,
    syncExtensions: false,
    syncPassword: true,
    syncIndexedDb: false,
    syncLocalStorage: false,
    clearCacheFile: false,
    clearCookie: false,
    clearLocalStorage: false,
    randomFingerprint: false,
    forbidSavePassword: true,
    stopOpenNet: false,
    stopOpenIP: false,
    stopOpenPosition: false,
  }
}
