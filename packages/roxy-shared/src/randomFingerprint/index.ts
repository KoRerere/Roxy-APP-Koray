import type { UserAddWindowInfoV2CreatePayload } from '@roxy/backend-api'
import { sampleSize } from 'es-toolkit'
import { genRandomFonts } from '../fonts'
import { chromeVoices, firefoxVoices, fontList } from './constants/'

/**
 * 获取canvas随机值,从0123456789ABCDEF里面随机取32位
 */
export function getCanvasContextNoiseValue() {
  const randStr = '0123456789ABCDEF'
  return Array.from({ length: 32 }, () => {
    return randStr[getRandomInt(0, randStr.length - 1)]
  }).join('')
}

/** 字体选择随机的时候，就从 font.json 文件里面随机选择100-500个，传给allowFontList ，用; 分割 */
export function getAllowFontList() {
  return sampleSize(fontList, Math.floor(Math.random() * 400) + 100).join(';')
}

export function getwebGLNoiseValue(coreType: 'Chrome' | 'Firefox' = 'Chrome') {
  if (isFirefox(coreType)) {
    return Math.random()
  }

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

function isFirefox(coreType: 'Chrome' | 'Firefox' = 'Chrome') {
  return coreType === 'Firefox'
}

function getClientRectsValue() {
  return {
    clientRectsNoiseFactorX: (2 * Math.random() - 1), // x 轴
    clientRectsNoiseFactorY: (2 * Math.random() - 1), // y轴
  }
}

export function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 获取speechVoices随机值
// 生成不同的系统中可用的语音列表,语言列表有很多。
// 以下是随机举例，按照参考list 一般是18-20个。
// 其中isLocalService代表是否是local，如果不是就自动设成了 remote 属性 ，
/**
 * 一般isLocalService 会有3个true
 */
function getSpeechSynthesis(os: string, coreType: 'Chrome' | 'Firefox' = 'Chrome') {
  const newVoices = [...(isFirefox(coreType) ? firefoxVoices : chromeVoices)]
  console.log('coreType', coreType)
  console.log('newVoices', newVoices)
  for (let i = 0; i < Math.floor(Math.random() * 2); i++) {
    newVoices.splice(Math.floor(Math.random() * (newVoices.length - 1)), 1)
  }

  const newArray = []
  for (let i = 0; i < 3; i++) {
    const index = Math.floor(Math.random() * (newVoices.length - 1))
    const [obj] = newVoices.splice(index, 1)
    // console.log(`index`, index, `obj`, obj)
    newArray.push({
      ...obj,
      isLocalService: true,
    })
  }

  // Firefox 基础列表本身就是 Windows SAPI 系统语音，无需额外追加；
  // Chrome 基础列表是 Google TTS 远程语音，Windows 下需要叠加本地 SAPI 语音。
  let windowsVoices: any[] = []
  if (!isFirefox(coreType) && (os === 'Windows' || !os)) {
    windowsVoices = [
      {
        name: 'Microsoft David - English (United States)',
        isLocalService: true,
        lang: 'en-US',
      },
      {
        name: 'Microsoft Mark - English (United States)',
        isLocalService: true,
        lang: 'en-US',
      },
      {
        name: 'Microsoft Zira - English (United States)',
        isLocalService: true,
        lang: 'en-US',
      },
    ]
  }

  return [...windowsVoices, ...newArray, ...newVoices]
}

/** speechSynthesis 单条语音 */
export interface SpeechVoice {
  name: string
  lang: string
  isLocalService: boolean
}

/**
 * 保证 voices[0].lang === acceptLang，且该项为本地语音。
 * 随机生成可能删掉唯一匹配项，故以完整 chromeVoices / firefoxVoices 目录补齐；
 * 目录没有该 locale（如 en-CA）时无法伪造，保持原列表。
 * 返回新数组并浅拷贝每一项，避免改 isLocalService 时写回指纹源对象。
 */
export function pinAcceptLangVoice(
  voices: SpeechVoice[] | undefined,
  acceptLang: string | undefined,
  coreType: 'Chrome' | 'Firefox' = 'Chrome',
): SpeechVoice[] | undefined {
  if (!acceptLang) {
    return voices
  }

  const list = Array.isArray(voices) ? voices : []
  const catalog = isFirefox(coreType) ? firefoxVoices : chromeVoices
  const picked = list.find(voice => voice.lang === acceptLang)
    ?? catalog.find(voice => voice.lang === acceptLang)

  if (!picked) {
    return voices
  }

  const next = [
    { ...picked, isLocalService: true },
    ...list
      .filter(voice => !(voice.name === picked.name && voice.lang === picked.lang))
      .map(voice => ({ ...voice })),
  ]

  // 内核侧约定本地语音约 3 条；第一项占用 1 个名额，其余最多再留 2 个 true
  let localCount = 0
  return next.map((voice) => {
    if (!voice.isLocalService) {
      return voice
    }
    localCount += 1
    if (localCount <= 3) {
      return voice
    }
    return { ...voice, isLocalService: false }
  })
}

export type RandomFingerprint = ReturnType<typeof genRandomFingerprint>

export interface GenRandomFingerprintOptions {
  payload: UserAddWindowInfoV2CreatePayload
  count: number
  genType?: 'app' | 'api'
  API: any
  getMacAddress: () => Promise<string>
  local_fonts: string[]
}

/** 生成随机指纹 */
export async function genRandomFingerprint(options: GenRandomFingerprintOptions): Promise<any[]> {
  const { payload, count = 1, genType, API, getMacAddress, local_fonts } = options
  const { fontType, canvas, webGL, audioContext, speechVoices, clientRects, macInfo, os, osVersion, coreVersion, coreType } = payload
  const headers = genType === 'api' ? { source: 'api' } : {}

  console.log('genRandomFingerprint options', options)

  const result = await Promise.all([
    API.window.userGetUaWebglV2List({ os, osVersion, coreVersion, coreType, count }, { headers }),
    API.window.userGetDeviceNameV2List({ os, coreType, count }, { headers }),
    macInfo
      ? API.window.userGetMacAddrV2List({ count, coreType }, { headers })
      : { code: 0, data: [{ macAddr: await getMacAddress() }] },
  ]).catch((error) => {
    console.error('genRandomFingerprint error', error)
    return Promise.reject(error)
  })
  console.log('genRandomFingerprint result', result)
  const unSuccessItem = result.find(n => n.code !== 0)
  if (unSuccessItem) {
    console.error('unSuccessItem', unSuccessItem)
    return Promise.reject(new Error(unSuccessItem.msg))
  }

  const [{ data: uaWebgls }, { data: deviceNames }, { data: macAddrs }] = result

  const fingerDetail = Array.from({ length: count }).map((_, index) => {
    return {
      ...uaWebgls[index],
      ...deviceNames[index],
      ...macAddrs[index],
      mediaDevice: false, // 【页面不显示】，媒体设备，默认0，需要前端生成，布尔值，必传
      mediaDeviceList: [
        {
          deviceType: 'audioinput',
          deviceId: '',
          label: '',
          groupId: '',
        },
      ], // 【页面不显示】，媒体设备列表，指纹会用到，需要前端生成，List格式，必传
      font: fontType ? genRandomFonts(local_fonts).join(';') : undefined,
      allowFontList: fontType ? getAllowFontList() : undefined,
      canvasValue: canvas ? getCanvasContextNoiseValue() : undefined,
      canvasValueV2: isFirefox(coreType) ? Math.random() : getRandomInt(1000, 99999), // 1000-99999 之间的随机整数
      webGLValue: webGL ? getwebGLNoiseValue(coreType) : undefined,
      audioContextValue: audioContext ? Math.random() : undefined,
      speechVoicesValue: { enable: speechVoices, voices: getSpeechSynthesis(os, coreType) },
      clientRectsValue: { enable: clientRects, ...getClientRectsValue() },
    }
  })

  // 将 undefined 的属性过滤掉
  return JSON.parse(JSON.stringify(fingerDetail))
}

/** 随机生成指纹函数 map */
export const randomFingerprintFuncMap = {
  genRandomFonts,
  getCanvasContextNoiseValue,
  getRandomInt,
  getSpeechSynthesis,
  getClientRectsValue,
  getwebGLNoiseValue,
  getAllowFontList,
}

export type RandomFingerprintFuncMap = keyof typeof randomFingerprintFuncMap

export type RandomFingerprintFuncParameters = {
  [K in RandomFingerprintFuncMap]: Parameters<typeof randomFingerprintFuncMap[K]>
}

export type RandomFingerprintFuncReturnTypes = {
  [K in RandomFingerprintFuncMap]: ReturnType<typeof randomFingerprintFuncMap[K]>
}
