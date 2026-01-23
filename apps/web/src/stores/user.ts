import type { UnwrapRowsType, UserGetBindCardListListData, UserGetUserConfigListData, UserGetUserInfoListData, UserGetUserPayInfoListData } from '@roxy/backend-api'
import mixpanel from 'mixpanel-browser'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'

import { useSimpleLocale } from '/@/stores/locale'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useTutorialStore } from '/@/stores/tutorial'
import * as Sentry from '@sentry/vue'
import { emitter } from '/@/utils/eventBus'
import { useRoleStore } from '/@/stores/role'
import { useToast } from 'primevue/usetoast'
import { PayIdentity, SubLevelEnum } from '/@/enums/pay'
import { encryptAESGCM, hidePageLoading, isMainWindow, isWindows } from '/@/utils'
import type { OauthLoginType } from '/@/utils'
import type { ProxyDetectionResult } from '#roxybrowser/utils'

type UserInfo = Partial<UserGetUserInfoListData['data']>
type UserConfig = Partial<UserGetUserConfigListData['data']>
type UserCards = UnwrapRowsType<UserGetBindCardListListData>
type UserPayInfo = UserGetUserPayInfoListData['data']
type LoginWay = 'password' | 'phone' | OauthLoginType

export const useUserStore = defineStore(
  'user',
  () => {
    const router = useRouter()
    const toast = useToast()
    const locale = useSimpleLocale()
    const workspaceStore = useWorkspaceStore()
    const tutorialStore = useTutorialStore()
    const roleStore = useRoleStore()

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

    async function getUserInfo() {
      const { code, data } = await fetchUserInfo()

      if (code === 0) {
        setUserInfo(data)
        workspaceStore.setCurrentWorkspace(data.workspaceId)
        setTimeout(() => {
          hidePageLoading()
        }, 10000)
      }
      else {
        // 如果获取用户信息失败，则清除用户信息
        clearUserInfo()
        router.push({ name: 'login' })
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
        userInfo.value = result.data
        checkShowAccountSetupDialog()
      }
      return result
    }

    async function setUserInfo(info: UserInfo) {
      userInfo.value = info
      const appSoftConfig = await window.electronAPI.send('app:getSoftConfig')

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
          window.electronAPI.send('user:setUserInfo', {
            token: token.value,
            userId: userInfo.value.id!,
            workspaceId: userInfo.value.workspaceId!,
            userName: userInfo.value.userName!,
            email: userInfo.value.email!,
          })
          const openPageUrl = sessionStorage.getItem('openPageUrl')
          if (openPageUrl) {
            sessionStorage.removeItem('openPageUrl')
            router.push(openPageUrl)
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

          localNetwork.value = await window.electronAPI.send('proxy:detectNetwork', 'local')

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

    async function clearUserInfo() {
      const logoutPromise = electronAPI.send('user:logout')
      if (loginWay.value === 'password') {
        userInfo.value = {
          email: userInfo.value.email,
        }
      }
      else {
        userInfo.value = {}
        password.value = ''
      }
      userCards.value = undefined
      token.value = ''
      mixpanel.reset()
      workspaceStore.resetWorkspace()
      tutorialStore.resetVideoMaps()
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

    /** 获取用户付费详情 */
    async function getUserPayInfo() {
      const { code, data } = await API.pay.userGetUserPayInfoList()

      if (code === 0) {
        userPayInfo.value = data
        if (roleStore.isOwner) {
          // 如果用户付费信息过期，则显示弹窗
          if (data.showSubExpiredDlg) {
            emitter.emit('showSubscriptionExpiredDialog')
          }
          // 旧用户首次登录，显示升级套餐弹窗
          if (data.showPayWallDlg) {
            emitter.emit('showUpgradePlanDialog')
          }
        }

        electronAPI.send('app:saveSoftConfig', { subLevel: data.subLevel })

        if (isWindows) {
          const { code } = await API.pay.userCheckTeamUserRightsList()
          if (code !== 0) {
            // 免费用户或者过期用户，关闭窗口同步器
            console.log('can use syncControl:', [SubLevelEnum.Free, SubLevelEnum.Expired].includes(data.subLevel as SubLevelEnum), data.subLevel)
            if ([SubLevelEnum.Free, SubLevelEnum.Expired].includes(data.subLevel as SubLevelEnum)) {
              electronAPI.send('syncControl:close')
              setTimeout(() => {
                electronAPI.send('syncControl:stop', false)
              }, 500)
            }
          }
        }
      }
    }

    async function getUserCards(force = false) {
      if (!roleStore.isOwner)
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
    }

    /** 记住我的时候需要保存密码 */
    async function setPassword(pwd: string) {
      password.value = await encryptAESGCM(pwd)
    }

    const initUserInfo = async () => {
      if (token.value) {
        await getUserInfo()
        getUserConfig(true)
      }
    }

    scheduler.postTask(initUserInfo, { priority: 'background' })

    requestIdleCallback(async () => {
      const version = await electronAPI.send('app:getAppVersion')
      appVersion.value = version
    })

    function clearRememberMe() {
      rememberMe.value = false
      password.value = ''
    }

    function setLoginWay(way: LoginWay) {
      loginWay.value = way
    }

    return {
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
      setPassword,
      clearUserInfo,
      setToken,
      getUserInfo,
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
    }
  },
  {
    persist: {
      pick: ['token', 'rememberMe', 'password', 'userInfo.email', 'loginWay'],
    },
  },
)
