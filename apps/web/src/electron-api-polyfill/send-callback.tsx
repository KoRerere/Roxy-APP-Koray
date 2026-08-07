import axios from 'axios'
import { genRandomFingerprint, genRandomFonts, randomFingerprintFuncMap } from '@roxy/shared'
import { getLocalFonts } from '/@/utils/getLocalFonts'
import { API } from '/@/api'
import { CUSTOM_PROTOCOL, osConfig } from './constants'
import { getCommonRequestHeaders, getVisitorId } from './utils'
import type { UnwrapRowsType, UserGetCoreUpgradeCreateData } from '@roxy/backend-api'
import { useUserStore } from '/@/stores/user'
import { decryptAESGCM, encryptAESGCM } from '/@/utils'
import { useSimpleLocale } from '/@/stores/locale'
import { useDialog } from '/@/hooks/useDialog'
import { OFFICIAL_SITE_INVITE_CODE } from '/@/constants/storage-key'

const CHECK_CHANNEL_URL = 'https://ipcheck.roxybrowser.com/api/query'

/** 统一返回空数组的channel */
const emptyArrayChannels = [
  'app:getCoreList',
  'browser:getOpenedBrowserMessage',
  'app:getNewFeatureTips',
]

/** 统一返回空字符串的 channel */
const emptyStringChannels = [
  'util:getDeviceId',
]

/** 统一显示下载客户端的提示 */
const downloadClientChannels = [
  'browser:createDesktopShortcut',
  'browser:setAsDefaultBrowser',
  'browser:clearCache',
  'browser:batchRelaunch',
  'browser:closeAll',
  'browser:batchClose',
  'browser:batchLaunch',
  'browser:chunkBrowsersByScreen',
  'app:showLogDir',
  'proxy:detect',
  'syncControl:open',
  'extension:getSelectedExtensionInfo',
  'extension:download',
  'extension:uploadExtensionToOSS',
  'extension:showExtensionDir',
  'util:genApiKey',
  'mcp:open',
  'mcp:ensureServer',
]

const availableCoreList: UnwrapRowsType<UserGetCoreUpgradeCreateData> = []

export async function sendCallback(channel: string, ...args: any[]) {
  if (channel === 'proxy:detectNetwork') {
    const result = await axios.get('https://ip234.in/ip.json').catch(() => {
      return axios.post(CHECK_CHANNEL_URL, {
        channel: 'ip-api',
      })
    })
    return result.data
  }

  if (channel === 'app:isMainWindow') {
    return true
  }

  /** 随机生成字体 */
  if (channel === 'util:genRandomFonts') {
    return genRandomFonts(await getLocalFonts())
  }

  /** 生成随机指纹 */
  if (channel === 'util:genRandomFingerprint') {
    const [payload, count] = args
    return genRandomFingerprint({
      payload,
      count,
      API,
      getMacAddress: () => API.window.userGetMacAddrV2List({ count }).then(res => res.data[0]?.macAddr || ''),
      local_fonts: await getLocalFonts(),
    })
  }

  /** 按需调用生成指纹函数 */
  if (channel === 'util:callRandomFingerprintFunc') {
    const [payload] = args
    return Object.entries(payload).reduce((acc, [key, value]) => {
      if (Reflect.has(randomFingerprintFuncMap, key)) {
        const func = Reflect.get(randomFingerprintFuncMap, key)
        Reflect.set(acc, key, func(...value))
      }
      return acc
    }, {})
  }

  /** 获取所有可用的内核列表 */
  if (channel === 'app:getCoreList') {
    if (availableCoreList.length) {
      return availableCoreList
    }
    const { code, data } = await API.base.getCoreUpgradeCreate(osConfig)

    if (code === 0) {
      availableCoreList.push(...data.rows)
    }
    return availableCoreList
  }

  /** 获取公共请求头 */
  if (channel === 'util:getCommonRequestHeaders') {
    return getCommonRequestHeaders()
  }

  /** 是否显示长时间未登录提示 */
  if (channel === 'app:isShowLongTimeNotLoginTips') {
    const userStore = useUserStore()
    // 如果上次登录时间超过 15 天，则清除 token 和 userId
    if (userStore.lastLoginTime && Date.now() - userStore.lastLoginTime > 1000 * 60 * 60 * 24 * 15) {
      const showLongTimeNotLoginTips = Boolean(userStore.token)
      userStore.token = ''
      console.log('Last login time exceeds 15 days, clearing token and userId')
      return showLongTimeNotLoginTips
    }
    return false
  }

  /** AES-GCM 加密 */
  if (channel === 'util:encryptAESGCM') {
    const [msg] = args
    return encryptAESGCM(msg)
  }

  // /** AES-GCM 解密 */
  if (channel === 'util:decryptAESGCM') {
    const [msg] = args
    return decryptAESGCM(msg)
  }

  // 获取邀请码
  if (channel === 'util:getInviteCode') {
    return localStorage.getItem(OFFICIAL_SITE_INVITE_CODE)
  }

  // 清空邀请码
  if (channel === 'util:clearInstallerPath') {
    return localStorage.removeItem(OFFICIAL_SITE_INVITE_CODE)
  }

  // 获取 APP 版本号
  if (channel === 'app:getAppVersion') {
    return import.meta.env.VITE_APP_VERSION
  }

  // 获取设备 ID
  if (channel === 'util:getDeviceId') {
    const visitorId = await getVisitorId()
    return encryptAESGCM(visitorId)
  }

  if (emptyArrayChannels.includes(channel)) {
    return []
  }

  if (emptyStringChannels.includes(channel)) {
    return ''
  }

  if (downloadClientChannels.includes(channel)) {
    const [showModal] = useDialog()
    const { getOfficialWebsite } = useSimpleLocale()

    showModal({
      header: $t('提示'),
      style: {
        width: '420px',
      },
      cancelText: '',
      okText: $t('下载最新客户端'),
      slots: {
        default: () => (
          <>{$t('该功能需要下载客户端使用')}</>
        ),
      },
      handleOk() {
        window.open(getOfficialWebsite('/download'), '_blank')
      },
    })

    try {
      // 如果已经安装 APP，则直接打开
      window.open(CUSTOM_PROTOCOL, '_self')
    }
    catch (error) {
      console.debug(error)
    }

    return Promise.reject(new Error(`${$t('该功能需要下载客户端使用')}：${channel}`))
  }

  return {}
}
