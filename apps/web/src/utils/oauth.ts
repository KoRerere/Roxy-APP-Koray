import { useToast } from 'primevue/usetoast'
import { isDev } from '/@/utils'
import { API } from '/@/api'
import type { LoginGoogleV2CreateData } from '@roxy/backend-api'
import { OAUTH2_CALLBACK_CHANNEL_NAME } from '/@/constants/channel'

function getRedirectUrl(source: string) {
  if (source === 'vk') {
    return `https://${isDev ? 'gatetest.roxybrowser.co' : 'roxybrowser.com'}/auth/app_${source}`
  }
  return `https://${isDev ? 'gatetest.roxybrowser.co' : 'roxybrowser.com'}/auth?source=${source}`
}

function openWindow(url: string, title: string) {
  console.log('openWindow', url, title)
  const width = 800
  const height = 600
  const left = (screen.width - width) / 2
  const top = (screen.height - height) / 2
  window.open(url, title, `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`)
}

function toAuth(url: string, title: string) {
  if (globalThis.isElectron) {
    window.open(url)
  }
  else {
    openWindow(url, title)
  }
}

function openGoogleAuth2Login() {
  const paramsObj = {
    client_id: '663574245714-elgschngb873e831n3d7ul9b6s4a8cvq.apps.googleusercontent.com',
    redirect_uri: getRedirectUrl('google'),
    scope: 'https://www.googleapis.com/auth/userinfo.email',
    response_type: 'code',
  }
  const params = new URLSearchParams(paramsObj)
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  toAuth(url, 'Google Auth')
}

function openGithubAuth2Login() {
  const paramsObj = {
    client_id: isDev ? 'Ov23lidZHwoteYPc2Bbv' : 'Ov23li2tP2jopYhz3S0A',
    redirect_uri: getRedirectUrl('github'),
    scope: 'user:email',
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

let codeVerifier = ''
async function openVkAuth2Login() {
  // 生成 code_verifier
  codeVerifier = generateCodeVerifier(43)
  // 生成 code_challenge
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  const paramsObj = {
    response_type: 'code',
    client_id: '53496485',
    scope: 'email',
    redirect_uri: getRedirectUrl('vk'),
    state: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  }

  const params = new URLSearchParams(paramsObj)
  const url = `https://id.vk.com/authorize?${params.toString()}`

  toAuth(url, 'Vk Auth')

  return codeVerifier
}

export const oauth2LoginMap = {
  google: openGoogleAuth2Login,
  github: openGithubAuth2Login,
  facebook: openFacebookAuth2Login,
  vk: openVkAuth2Login,
} as const

export type OauthLoginType = keyof typeof oauth2LoginMap

export function openOAuth2Login(type: OauthLoginType) {
  return oauth2LoginMap[type]()
}

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

  const handleSearchStr = (searchStr: string) => {
    console.log('oauth2:google-callback', searchStr)
    const searchParams = new URLSearchParams(searchStr)
    const oauthCode = searchParams.get('code')!
    const source = searchParams.get('source') as OauthLoginType

    const oauth2LoginAPIMap = {
      google: () => API.base.loginGoogleV2Create({ googleToken: oauthCode }),
      github: () => API.base.loginGithubCreate({ githubToken: oauthCode }),
      facebook: () => API.base.loginFacebookCreate({ facebookToken: oauthCode }),
      vk: () => API.base.loginVkCreate({
        vkToken: oauthCode,
        code_verifier: codeVerifier,
        device_id: searchParams.get('device_id')!,
        state: searchParams.get('state')!,
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
  }

  onBeforeUnmount(() => {
    cancelCallback?.()
    channel.close()
  })
}
