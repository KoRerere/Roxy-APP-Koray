import { isDev } from '/@/utils'
import { API } from '/@/api'
import { useSimpleLocale } from '/@/stores/locale'
import { OAUTH2_CALLBACK_CHANNEL_NAME } from '/@/constants/channel'
import type { LoginGoogleV2CreateData } from '@roxy/backend-api'

function getRedirectUrl(source: string) {
  const [devUrl, prodUrl] = useSimpleLocale().isZh
    ? ['test.roxybrowser.cn', 'roxybrowser.cn']
    : ['gatetest.roxybrowser.co', 'roxybrowser.com']

  if (source === 'vk') {
    return `https://${isDev ? devUrl : prodUrl}/auth/app_${source}`
  }
  return `https://${isDev ? devUrl : prodUrl}/auth?source=${source}`
}

/**
 * Uint8Array -> base64url
 */
function uint8ToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * base64url -> Uint8Array
 */
// function base64UrlToUint8(str: string) {
//   const base64 = str
//     .replace(/-/g, '+')
//     .replace(/_/g, '/')
//     .padEnd(str.length + (4 - (str.length % 4)) % 4, '=')

//   const binary = atob(base64)
//   const bytes = new Uint8Array(binary.length)

//   for (let i = 0; i < binary.length; i++) {
//     bytes[i] = binary.charCodeAt(i)
//   }

//   return bytes
// }

/**
 * JSON -> base64url
 */
function encodeState(obj: any) {
  const json = JSON.stringify(obj)
  const bytes = new TextEncoder().encode(json)
  return uint8ToBase64Url(bytes)
}

/**
 * base64url -> JSON
 */
// function decodeState(str: string) {
//   const bytes = base64UrlToUint8(str)
//   const json = new TextDecoder().decode(bytes)
//   return JSON.parse(json)
// }

function generateState(meta: Record<string, any> = {}) {
  Object.assign(meta, { isElectron: globalThis.isElectron })

  const payload = {
    csrf: crypto.randomUUID(), // 防 CSRF
    meta, // 自定义数据
    ts: Date.now(), // 可选：防重放
  }

  const encoded = encodeState(payload)

  localStorage.setItem('vk_oauth_state', encoded)

  return encoded
}

function openWindow(url: string, title: string, features?: string) {
  console.log('openWindow', url, title)
  const width = 800
  const height = 600
  const left = (screen.width - width) / 2
  const top = (screen.height - height) / 2
  window.open(url, title, `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes${features ? `,${features}` : ''}`)
}

function toAuth(url: string, title: string, features?: string) {
  if (globalThis.isElectron) {
    window.open(url)
  }
  else {
    openWindow(url, title, features)
  }
}

function openGoogleAuth2Login() {
  const paramsObj = {
    client_id: '122184636659-onkerhuo2qe3vjjllg0gnqgp8pcujtci.apps.googleusercontent.com',
    redirect_uri: getRedirectUrl('google'),
    scope: 'https://www.googleapis.com/auth/userinfo.email',
    response_type: 'code',
    state: generateState(),
  }
  const params = new URLSearchParams(paramsObj)
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  toAuth(url, 'Google Auth')
}

function openGithubAuth2Login() {
  const [devClientId, prodClientId] = useSimpleLocale().isZh
    ? ['Ov23liuYcjr4arWQTaJW', 'Ov23liuYcjr4arWQTaJW']
    : ['Ov23lidZHwoteYPc2Bbv', 'Ov23li2tP2jopYhz3S0A']

  const paramsObj = {
    client_id: isDev ? devClientId : prodClientId,
    redirect_uri: getRedirectUrl('github'),
    scope: 'user:email',
    state: generateState(),
  }
  const params = new URLSearchParams(paramsObj)
  const url = `https://github.com/login/oauth/authorize?${params.toString()}`

  toAuth(url, 'Github Auth')
}

function openFacebookAuth2Login() {
  const paramsObj = {
    client_id: '775285631405762',
    redirect_uri: getRedirectUrl('facebook'),
    scope: 'email,public_profile',
    state: generateState(),
  }
  const params = new URLSearchParams(paramsObj)
  const url = `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`

  toAuth(url, 'Facebook Auth')
}

// ... existing code ...

/**
 * 生成符合要求的随机字符串
 */
function generateCodeVerifier(length = 43) {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map(x => characters[x % characters.length])
    .join('')
}

/**
 * 生成 code_challenge
 */
async function generateCodeChallenge(codeVerifier: string) {
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const base64String = btoa(String.fromCharCode.apply(null, hashArray))
  return base64String
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

const VK_OAUTH_CODE_VERIFIER_KEY = 'vk_oauth_code_verifier'
let codeVerifier = localStorage.getItem(VK_OAUTH_CODE_VERIFIER_KEY) || ''
async function openVkAuth2Login() {
  // 生成 code_verifier
  codeVerifier = generateCodeVerifier(43)
  // 生成 code_challenge
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  const paramsObj = {
    response_type: 'code',
    client_id: '54588305',
    scope: 'email',
    redirect_uri: getRedirectUrl('vk'),
    state: generateState(),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }

  const params = new URLSearchParams(paramsObj)
  const url = `https://id.vk.com/authorize?${params.toString()}`

  localStorage.setItem(VK_OAUTH_CODE_VERIFIER_KEY, codeVerifier)

  toAuth(url, 'Vk Auth', 'noreferrer')

  return codeVerifier
}

export const oauth2LoginMap = {
  google: openGoogleAuth2Login,
  github: openGithubAuth2Login,
  facebook: openFacebookAuth2Login,
  vk: openVkAuth2Login,
} as const

export type OauthLoginType = keyof typeof oauth2LoginMap

interface Oauth2CallbackParams {
  oauthCode: string
  source: OauthLoginType
  searchParams: URLSearchParams
  api: () => Promise<LoginGoogleV2CreateData>
}

/**
 * 处理第三方账号登录
 * @param callback 回调函数
 */
export function useOauth2Callback(callback: (params: Oauth2CallbackParams) => void) {
  const channel = new BroadcastChannel(OAUTH2_CALLBACK_CHANNEL_NAME)
  const searchParams = new URLSearchParams(window.location.search)

  const handleSearchStr = (searchStr: string) => {
    console.log('oauth2:google-callback', searchStr)
    const searchParams = new URLSearchParams(searchStr)
    const oauthCode = searchParams.get('code')!
    const source = searchParams.get('source') as OauthLoginType

    const commonParams = {
      oauthHost: useSimpleLocale().isZh ? 'cn' : 'com',
    }

    const oauth2LoginAPIMap = {
      google: () => API.base.loginGoogleV2Create({ googleToken: oauthCode, ...commonParams }),
      github: () => API.base.loginGithubCreate({ githubToken: oauthCode, ...commonParams }),
      facebook: () => API.base.loginFacebookCreate({ facebookToken: oauthCode, ...commonParams }),
      vk: () => API.base.loginVkCreate({
        vkToken: oauthCode,
        code_verifier: codeVerifier,
        device_id: searchParams.get('device_id')!,
        state: searchParams.get('state')!,
        ...commonParams,
      }),
    } as const

    callback({
      oauthCode,
      source,
      searchParams,
      api: oauth2LoginAPIMap[source as OauthLoginType],
    })
  }

  const cancelCallback = globalThis.electronAPI.on('oauth2:google-callback', handleSearchStr)

  channel.onmessage = (event) => {
    console.log('channel.onmessage oauth2:callback', event)
    const { data } = event
    handleSearchStr(data)
    channel.postMessage('close') // 通知其他窗口关闭
  }

  if (searchParams.get('oauth2callback')) {
    handleSearchStr(decodeURIComponent(searchParams.get('oauth2callback')!))
  }

  onBeforeUnmount(() => {
    localStorage.removeItem(VK_OAUTH_CODE_VERIFIER_KEY)
    cancelCallback?.()
    channel.close()
  })
}
