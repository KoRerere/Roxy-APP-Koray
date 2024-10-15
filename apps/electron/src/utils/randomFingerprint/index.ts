import type { UserAddWindowInfoCreatePayload } from '@roxy/backend-api'
import { API } from '/@/api/'
import { genRandomFonts, getMacAddress } from '/@/utils'
import { voices } from './constants/'

/**
 * 获取canvas随机值
 */
function getCanvasContextNoiseValue() {
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
function getSpeechSynthesis() {
  const newVoices = [...voices]
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
  return [...newArray, ...newVoices]
}

export type RandomFingerprint = ReturnType<typeof genRandomFingerprint>

/** 生成随机指纹 */
export async function genRandomFingerprint(payload: UserAddWindowInfoCreatePayload, count = 1) {
  const { fontType, canvas, webGL, audioContext, speechVoices, clientRects, macInfo, os, osVersion, coreVersion } = payload

  const [{ data: uaWebgls }, { data: deviceNames }, { data: macAddrs }] = await Promise.all([
    API.window.userGetUaWebglV2List({ os, osVersion, coreVersion, count }),
    API.window.userGetDeviceNameV2List({ os, count }),
    macInfo
      ? { data: [{ macAddr: getMacAddress() }] }
      : API.window.userGetMacAddrV2List({ count }),
  ])

  const promiseArr = Array.from({ length: count }).map(async (_, index) => {
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
      font: fontType ? await genRandomFonts() : undefined,
      canvasValue: canvas ? getCanvasContextNoiseValue() : undefined,
      canvasContextNoiseValueV2: getRandomInt(1000, 99999), // 1000-99999 之间的随机整数
      webGLValue: webGL ? getCanvasContextNoiseValue() : undefined,
      audioContextValue: audioContext ? getCanvasContextNoiseValue() : undefined,
      speechVoicesValue: speechVoices ? { enable: true, voices: getSpeechSynthesis() } : undefined,
      clientRectsValue: clientRects ? { enable: true, ...getClientRectsValue() } : undefined,
    } // 跟随老版本逻辑过滤没有值的属性
  })

  // 将 undefined 的属性过滤掉
  return JSON.parse(JSON.stringify(await Promise.all(promiseArr)))
}
