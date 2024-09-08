import type { UserAddWindowInfoCreatePayload, UserGetUaWebglListParams } from '@roxy/backend-api'
import { fontArray, voices } from './constants/'
import { API } from '/@/api/'

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
/**
 * 生成随机字体
 */
function getRandomFonts(number = 20) {
  const selectedFonts: string[] = []

  // 从字体列表中随机选择20个字体
  for (let i = 0; i < number; i++) {
    const randomIndex = Math.floor(Math.random() * fontArray.length)
    selectedFonts.push(fontArray[randomIndex])
  }

  // 将选择的字体用逗号分隔，保存到字符串 str 中
  const str = selectedFonts.join(';')
  return str
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

/** 生成随机指纹 */
export async function randomFingerprint(payload: UserAddWindowInfoCreatePayload) {
  const { os, osVersion, browserVersion, coreVersion, webGLManufacturer } = payload

  // 并行请求
  const [uaWebglResponse, deviceNameResponse, macAddrResponse] = await Promise.all([
    API.window.userGetUaWebglList({
      os,
      osVersion,
      browserVersion,
      coreVersion,
      webGLManufacturer,
    }),
    API.window.userGetDeviceNameList({ os }),
    API.window.userGetMacAddrV2List({ count: 1 }),
  ])

  // 处理 userGetUaWebglList 响应
  if (uaWebglResponse.code === 0) {
    payload.userAgent = uaWebglResponse.data.userAgent
    payload.webGLManufacturer = uaWebglResponse.data.webGLManufacturer
    payload.webGLRender = uaWebglResponse.data.webGLRender
  }

  // 处理 userGetDeviceNameList 响应
  if (deviceNameResponse.code === 0) {
    payload.deviceName = deviceNameResponse.data.deviceName
  }

  // 处理 userGetMacAddrV2List 响应
  if (macAddrResponse.code === 0) {
    payload.macAddr = macAddrResponse.data.at(0)?.macAddr || ''
  }

  payload.fontType && (payload.font = getRandomFonts())
  payload.canvas && (payload.canvasValue = getCanvasContextNoiseValue())
  payload.webGL && (payload.webGLValue = getCanvasContextNoiseValue())

  if (payload.audioContext) {
    const ranValue = Math.random()
    payload.audioContextValue = String(ranValue)
  }
  if (payload.speechVoices) {
    payload.speechVoicesValue = {
      enable: payload.speechVoices,
      voices: getSpeechSynthesis(),
    }
  }
  if (payload.clientRects) {
    payload.clientRectsValue = {
      enable: true,
      ...getClientRectsValue(),
    }
  }
  return payload
}
