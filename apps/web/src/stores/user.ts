import type { UnwrapRowsType, UserGetBindCardListListData, UserGetUserConfigListData, UserGetUserInfoListData, UserGetUserPayInfoListData } from '@roxy/backend-api'
import mixpanel from 'mixpanel-browser'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'
import { usePermission } from '/@/hooks/usePermission'
import { useSimpleLocale } from '/@/stores/locale'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useTutorialStore } from '/@/stores/tutorial'
import * as Sentry from '@sentry/vue'
import { emitter } from '/@/utils/eventBus'
import { useRoleStore } from '/@/stores/role'
import { useToast } from 'primevue/usetoast'
import { PayIdentity, SubLevelEnum } from '/@/enums/pay'
import { encryptAESGCMLocal, getCookie, hidePageLoading, initCrypto, isDev, isMainWindow, isMobile, isWindows, removeCookie, sleep } from '/@/utils'
import type { OauthLoginType } from '/@/utils'
import type { ProxyDetectionResult } from '#roxybrowser/utils'
import { clearSessionLost, markSessionLost } from '/@/utils/sessionLost'
import { clearLastRoute } from '/@/utils/lastRoute'
import { isLoginRoute, navigateToLogin, pushToLocation } from '/@/router/navigation'
import { useListCacheStore } from '/@/stores/listCache'
import {
  isBeforeEnterSessionActive,
  markBeforeEnterSession,
  needsBeforeEnterResume,
} from '/@/domain/before-enter'
import { isCurrentEcommerceWorkspace } from '/@/utils/workspace-mode'

type UserInfo = Partial<UserGetUserInfoListData['data']>
type UserConfig = Partial<UserGetUserConfigListData['data']>
type UserCards = UnwrapRowsType<UserGetBindCardListListData>
type UserPayInfo = UserGetUserPayInfoListData['data']
type LoginWay = 'password' | 'phone' | OauthLoginType

function getWorkspaceStore() {
  return useWorkspaceStore()
}

export const useUserStore = defineStore(
  'user',
  () => {
    const toast = useToast()
    const locale = useSimpleLocale()
    const tutorialStore = useTutorialStore()
    const roleStore = useRoleStore()
    const { check } = usePermission()

    /* 是否调用过初始化用户的方法 */
    const hasCallInitUserInfo = Promise.withResolvers<void>()

    const lastLoginTime = ref<number>(0)
    // 登录方式
    const loginWay = ref<LoginWay | undefined>()
    /** 用户信息 */
    const userInfo = ref<UserInfo>({})
    /** 用户付费详情 */
    const userPayInfo = ref<UserPayInfo>({} as UserPayInfo)
    const userCards = ref<UserCards>()

    const userConfig = ref<UserConfig>({})
    const token = ref('')
    const appVersion = ref('')
    const localNetwork = ref<ProxyDetectionResult>({} as ProxyDetectionResult)
    const rememberMe = ref(false)
    /** rememberMe 为 true 的时候有值 */
    const password = ref('')
    const userContact = ref<{ email?: string, phone?: string }>()

    /** 是否为过期用户 */
    const isExpiredUser = computed(() => {
      return userPayInfo.value.subEndDate && Date.now() > userPayInfo.value.subEndDate
    })

    /** 是否为未付费用户 */
    const isNoPayUser = computed(() => {
      return [SubLevelEnum.Free, SubLevelEnum.Expired].includes(userPayInfo.value.subLevel as SubLevelEnum)
    })

    /** 用户身份 */
    const identityInfo = computed<{
      identity: PayIdentity
      text: string
      color: string
      icon?: string
      iconSmall?: string
    }>(() => {
      const identity = userInfo.value.identity as PayIdentity
      const identityMap = {
        [PayIdentity.new]: {
          text: $t('普通用户'),
          color: 'var(--colors-text-text-primary)',
        },
        [PayIdentity.invited]: {
          text: $t('特邀用户'),
          icon: 'referral-program/diamond',
          iconSmall: 'referral-program/diamond-small',
          color: '#7B88C2',
        },
        [PayIdentity.old]: {
          text: $t('创始用户'),
          icon: 'referral-program/golden',
          iconSmall: 'referral-program/golden-small',
          color: '#DFAB65',
        },
        [PayIdentity.premium]: {
          text: $t('尊享会员'),
          icon: 'referral-program/premium',
          iconSmall: 'referral-program/premium-small',
          color: 'var(--colors-text-text-primary)',
        },
        [PayIdentity.partner]: {
          text: $t('合作伙伴'),
          icon: 'referral-program/partner',
          iconSmall: 'referral-program/partner-small',
          color: 'var(--colors-text-text-primary)',
        },
        [PayIdentity.agent]: {
          text: $t('高级合作伙伴'),
          icon: 'referral-program/agent',
          iconSmall: 'referral-program/agent-small',
          color: 'var(--colors-text-text-primary)',
        },
      }
      return { identity, ...identityMap[identity] }
    })

    type GetUserInfoOptions = {
      /** 默认 true：拉取用户信息后正式进空间；false 时仅更新 userInfo */
      enterWorkspace?: boolean
    }

    async function enterWorkspace(workspaceId?: number) {
      const workspaceStore = getWorkspaceStore()
      const resolvedId = workspaceId ?? workspaceStore.currentWorkspace?.id ?? userInfo.value.workspaceId
      if (!resolvedId)
        return
      await workspaceStore.enterWorkspace(resolvedId)
    }

    async function getUserInfo(intoWorkspaceId?: number, options?: GetUserInfoOptions) {
      const { code, data } = await fetchUserInfo()

      if (code === 0) {
        lastLoginTime.value = Date.now()
        // 登录成功，取消待触发的掉登录态强制升级
        clearSessionLost()

        setUserInfo(data)

        if (options?.enterWorkspace !== false)
          await enterWorkspace(intoWorkspaceId ?? data.workspaceId)

        setTimeout(() => {
          hidePageLoading()
        }, 10000)

        if (!globalThis.isElectron && isMobile()) {
          location.replace(locale.getOfficialWebsite(`/login-success?login-from-app`))
          await new Promise(resolve => setTimeout(resolve, 10 * 1000))
        }

        checkShowAccountSetupDialog()
      }
      else {
        // 如果获取用户信息失败，则清除用户信息
        clearUserInfo()
        navigateToLogin()
        toast.add({
          severity: 'error',
          summary: $t('提示'),
          detail: $t('获取用户信息失败，请重新登录'),
          life: 5000,
        })
      }
    }

    /** 检查是否显示账号设置弹窗 */
    function checkShowAccountSetupDialog() {
      if (userInfo.value.isBindEmail === false && !userInfo.value.phone) {
        emitter.emit('showAccountSetupDialog')
      }
    }

    async function fetchUserInfo() {
      const result = await API.base.userGetUserInfoList().catch(() => API.base.userGetUserInfoList())

      if (result.code === 0) {
        setUserInfo(result.data)
      }
      return result
    }

    async function setUserInfo(info: UserInfo) {
      userInfo.value = info
      const appSoftConfig = await globalThis.electronAPI.send('app:getSoftConfig')

      const isNewUser = !appSoftConfig.hasLoggedIn && userInfo.value.createTime && new Date(userInfo.value.createTime).getTime() > Date.now() - 5 * 60 * 1000

      // 如果是 5 分钟内的新用户，则记录新用户事件
      if (isNewUser && appSoftConfig.visitorId) {
        API.appTrackingEvent.appTrackingEventCreate({
          uuid: appSoftConfig.visitorId,
          userId: userInfo.value.id,
          eventType: 'registration_complete',
        })
      }

      // 如果不是新用户，则取消记录用户事件
      if (!isNewUser && appSoftConfig.visitorId) {
        API.appTrackingEvent.appTrackingEventDelete({
          uuid: appSoftConfig.visitorId,
        })
      }

      if (isMainWindow) {
        // 这里是为了避免频繁切换语言的时候，频繁的进程通信导致页面卡顿
        setTimeout(() => {
          globalThis.electronAPI.send('user:setUserInfo', {
            token: token.value,
            userId: userInfo.value.id!,
            lastUserId: userInfo.value.id!,
            workspaceId: userInfo.value.workspaceId!,
            userName: userInfo.value.userName!,
            email: userInfo.value.email!,
          })
          const openPageUrl = sessionStorage.getItem('openPageUrl')
          if (openPageUrl) {
            sessionStorage.removeItem('openPageUrl')
            pushToLocation(openPageUrl)
          }
        })

        requestIdleCallback(async () => {
          const scope = Sentry.getCurrentScope()
          scope.setUser({
            id: userInfo.value.id,
            email: userInfo.value.email,
            username: userInfo.value.userName,
          })
          scope.setTag('process', 'renderer')

          mixpanel.identify(String(userInfo.value.id))

          localNetwork.value = await globalThis.electronAPI.send('proxy:detectNetwork', 'local')

          mixpanel.people.set({
            screen_resolution: `${screen.width}x${screen.height}`,
            country_code: localNetwork.value.country_code,
            $name: userInfo.value.userName,
            $email: userInfo.value.email,
            $language: locale.currentLocale,
            $city: localNetwork.value.city,
            $region: localNetwork.value.region,
            $country_code: localNetwork.value.country_code,
            $timezone: localNetwork.value.timezone,
            $localNetwork: localNetwork,
            $appVersion: appVersion.value,
          })
        })
      }
    }

    function mixpanelTrack(event_name: string, data?: Record<string, any>) {
      mixpanel.track(event_name, {
        event_name,
        time: Date.now(),
        screen_resolution: `${screen.width}x${screen.height}`,
        country_code: localNetwork.value.country_code,
        $user_id: userInfo.value.id,
        $city: localNetwork.value.city,
        $region: localNetwork.value.region,
        $country_code: localNetwork.value.country_code,
        $timezone: localNetwork.value.timezone,
        $app_language: locale.currentLocale,
        $appVersion: appVersion.value,
        ...data,
      })
    }

    // 收集来自 electron 的埋点事件
    globalThis.electronAPI.on('mixpanel:track', (event_name: string, data?: Record<string, any>) => {
      mixpanelTrack(event_name, data)
    })

    async function clearUserInfo(options?: { skipServerSync?: boolean }) {
      // skipServerSync: 调用方(如主动退出登录)已自行 await `user:logout` 完成窗口数据同步,
      // 这里只做本地登录态清理, 避免重复触发同步/二次关闭浏览器.
      const logoutPromise = options?.skipServerSync
        ? Promise.resolve()
        : globalThis.electronAPI.send('user:logout')
      if (loginWay.value === 'password') {
        userInfo.value = {
          email: userInfo.value.email,
        }
      }
      else {
        userInfo.value = {}
        password.value = ''
      }
      markSessionLost()
      removeCookie('roxy_token', '/', location.hostname.split('.').slice(-2).join('.'))
      userCards.value = undefined
      token.value = ''
      mixpanel.reset()
      useListCacheStore().clearAll()
      getWorkspaceStore().resetWorkspace()
      tutorialStore.resetVideoMaps()
      clearLastRoute()
      await logoutPromise
    }

    async function getUserConfig(force = false) {
      if (!force && Object.keys(userConfig.value).length > 0) {
        return userConfig.value
      }
      return updateUserConfig()
    }

    async function updateUserConfig() {
      const { code, data } = await API.base.userGetUserConfigList()
      if (code === 0) {
        userConfig.value = data
      }
      return userConfig.value
    }

    async function setUserConfig(config: UserConfig) {
      const { code } = await API.base.userSetUserConfigCreate(config)
      if (code !== 0)
        return
      updateUserConfig()
    }

    /** 付费详情请求世代：新调用会作废仍在退避重试的旧请求，避免切空间后写回脏数据 */
    let payInfoRequestId = 0
    /** 付费详情最大尝试次数（含首次） */
    const PAY_INFO_MAX_ATTEMPTS = 5
    /** 付费详情重试基础间隔（毫秒），按 attempt 线性退避 */
    const PAY_INFO_RETRY_BASE_DELAY_MS = 1000

    /** 获取用户付费详情（失败自动重试；layout 依赖 subLevel 解除 loading） */
    async function getUserPayInfo() {
      const requestId = ++payInfoRequestId
      let lastResult: Awaited<ReturnType<typeof API.pay.userGetUserPayInfoList>> | undefined

      for (let attempt = 1; attempt <= PAY_INFO_MAX_ATTEMPTS; attempt++) {
        if (requestId !== payInfoRequestId)
          return lastResult

        try {
          const result = await API.pay.userGetUserPayInfoList()
          if (requestId !== payInfoRequestId)
            return result

          lastResult = result
          const { code, data } = result
          if (code === 0) {
            userPayInfo.value = data
            // 电商模式无窗口套餐/额度语义，跳过订阅到期与升级套餐弹窗
            if (roleStore.isOwner && !isCurrentEcommerceWorkspace()) {
              // 如果用户付费信息过期，则显示弹窗
              if (data.showSubExpiredDlg) {
                emitter.emit('showSubscriptionExpiredDialog')
              }
              // 旧用户首次登录，显示升级套餐弹窗
              if (data.showPayWallDlg) {
                emitter.emit('showUpgradePlanDialog')
              }
            }

            globalThis.electronAPI.send('app:saveSoftConfig', { subLevel: data.subLevel })

            if (isWindows) {
              const { code: rightsCode } = await API.pay.userCheckTeamUserRightsList()
              if (rightsCode !== 0) {
                // 免费用户或者过期用户，关闭窗口同步器
                console.log('can use syncControl:', [SubLevelEnum.Free, SubLevelEnum.Expired].includes(data.subLevel as SubLevelEnum), data.subLevel)
                if ([SubLevelEnum.Free, SubLevelEnum.Expired].includes(data.subLevel as SubLevelEnum)) {
                  globalThis.electronAPI.send('syncControl:close')
                  setTimeout(() => {
                    globalThis.electronAPI.send('syncControl:stop', false)
                  }, 500)
                }
              }
            }
            return result
          }

          console.warn(`[UserStore] getUserPayInfo failed, code=${code}, attempt=${attempt}/${PAY_INFO_MAX_ATTEMPTS}`)
        }
        catch (error) {
          console.warn(`[UserStore] getUserPayInfo error, attempt=${attempt}/${PAY_INFO_MAX_ATTEMPTS}`, error)
          if (attempt >= PAY_INFO_MAX_ATTEMPTS) {
            if (requestId === payInfoRequestId)
              throw error
            return lastResult
          }
        }

        if (attempt < PAY_INFO_MAX_ATTEMPTS) {
          await sleep(PAY_INFO_RETRY_BASE_DELAY_MS * attempt)
        }
      }

      return lastResult
    }

    async function getUserCards(force = false) {
      if (!check('Cost_Center_all'))
        return
      if (!force && userCards.value)
        return userCards.value
      const { code, data } = await API.pay.userGetBindCardListList({})
      if (code === 0) {
        userCards.value = data.rows
      }
      return userCards.value
    }

    function setToken(_token: string) {
      token.value = _token

      if (!globalThis.isElectron) {
        const domain = location.hostname.split('.').slice(-2).join('.')
        document.cookie = `roxy_token=${_token}; domain=${domain}; path=/`
      }
    }

    /** 记住我的时候需要保存密码 */
    async function setPassword(pwd: string) {
      const sessionMaterial = userInfo.value.email || userInfo.value.phone || String(userInfo.value.userId ?? '')
      password.value = sessionMaterial
        ? await encryptAESGCMLocal(pwd, sessionMaterial)
        : await encryptAESGCMLocal(pwd, 'roxy-default')
    }

    const initUserInfo = async (intoWorkspaceId?: number, options?: GetUserInfoOptions) => {
      try {
        // 如果 web 端官网退出登陆了，则清空 token 并跳转至登录页
        console.log('initUserInfo checkCookie')
        await checkCookie()

        console.log('initUserInfo token.value', token.value)

        if (token.value) {
          setToken(token.value)
          await getUserInfo(intoWorkspaceId, { enterWorkspace: false })

          // 页内刷新：session 仍活跃，静默准备 workspace，保持 before-enter 路由
          if (isBeforeEnterSessionActive()) {
            const workspaceId = intoWorkspaceId ?? userInfo.value.workspaceId
            if (workspaceId)
              await getWorkspaceStore().prepareWorkspace(workspaceId, { silent: true })
            getUserConfig(true)
            return
          }

          // App 重启后仍有本地步骤进度：恢复 before-enter，勿 enterWorkspace（避免 WelcomeModal）
          if (needsBeforeEnterResume(userInfo.value, intoWorkspaceId)) {
            const workspaceId = intoWorkspaceId ?? userInfo.value.workspaceId
            if (workspaceId)
              await getWorkspaceStore().prepareWorkspace(workspaceId, { silent: true })
            markBeforeEnterSession()
            getUserConfig(true)
            return
          }

          // App 重启或无活跃 session：正常进空间（未完成且无进度视为 skip）
          if (options?.enterWorkspace !== false)
            await enterWorkspace(intoWorkspaceId ?? userInfo.value.workspaceId)

          getUserConfig(true)
        }
      }
      finally {
        hasCallInitUserInfo.resolve()
      }
    }

    requestIdleCallback(async () => {
      const version = await globalThis.electronAPI.send('app:getAppVersion')
      appVersion.value = version
    })

    function clearRememberMe() {
      rememberMe.value = false
      password.value = ''
    }

    function setLoginWay(way: LoginWay) {
      loginWay.value = way
    }

    async function getUserContact(force = false) {
      if (!force && userContact.value)
        return userContact.value

      const { email, phone } = userInfo.value
      userContact.value = { email, phone }
      if (phone?.includes('*')) {
        const { code, data } = await API.base.userGetPhoneList()
        if (code === 0) {
          userContact.value.phone = data.phone
        }
      }
      return userContact.value
    }

    async function checkCookie() {
      // 如果 web 端官网退出登陆了，则清空 token 并跳转至登录页
      if (!globalThis.isElectron && !import.meta.hot && !isLoginRoute()) {
        const roxyToken = await getCookie('roxy_token')

        if (!roxyToken) {
          if (!userInfo.value.id) {
            console.log('未登录状态')
            return Promise.resolve()
          }

          if (document.hidden || !document.hasFocus()) {
            console.log('当前标签页未聚焦，跳过 cookie 登出清理')
            return Promise.resolve()
          }
          console.log('cookie expired', document.cookie.split(';'))

          token.value = ''
          clearUserInfo()
          navigateToLogin()
          return Promise.reject(new Error('cookie expired'))
        }
        else {
          token.value = roxyToken
          // router.push('/')
        }
      }
      return Promise.resolve()
    }

    if (!globalThis.isElectron) {
      // setInterval(checkCookie, 3 * 1000)
    }

    return {
      hasCallInitUserInfo,
      token,
      loginWay,
      rememberMe,
      userInfo,
      userConfig,
      userPayInfo,
      userCards,
      password,
      appVersion,
      identityInfo,
      isExpiredUser,
      isNoPayUser,
      lastLoginTime,
      setPassword,
      clearUserInfo,
      setToken,
      getUserInfo,
      enterWorkspace,
      setUserConfig,
      getUserConfig,
      updateUserConfig,
      fetchUserInfo,
      getUserPayInfo,
      getUserCards,
      initUserInfo,
      clearRememberMe,
      setLoginWay,
      mixpanelTrack,
      getUserContact,
    }
  },
  {
    persist: {
      pick: ['token', 'rememberMe', 'password', 'userInfo.email', 'loginWay', 'userInfo.onboardingTaskStatus'],
    },
  },
)
