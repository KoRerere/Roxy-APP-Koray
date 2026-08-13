import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'
import { usePermission } from '/@/hooks/usePermission'
import { debounce } from 'es-toolkit'
import type { WorkspaceType } from '/@/enums'
import { Role } from '/@/enums'
import { hidePageLoading, isMainWindow, showPageLoading } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { useCommonStore } from '/@/stores/common'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { usePermissionStore } from '/@/stores/permission'
import { SWITCH_WORKSPACE_CHANNEL_NAME } from '/@/constants/channel'
import { getCurrentRoute, navigateToLogin, replaceOnWorkspaceSwitch, replaceOnWorkspaceTypeSwitch } from '/@/router/navigation'
import { emitter } from '/@/utils/eventBus'
import { useListCacheStore } from '/@/stores/listCache'
import { useProxyStore } from '/@/stores/proxy'
import { createPerfTimer } from '/@/utils/perf-log'
import type { UnwrapRowsType, UnwrapRowType, UserGetPublicWorkspaceListListData, UserGetUserPayInfoListData, UserGetWorkspaceListListData } from '@roxy/backend-api'

type Workspace = UnwrapRowType<UserGetWorkspaceListListData>
type SharedWorkspace = UnwrapRowsType<UserGetPublicWorkspaceListListData>

const workspaceChangeChannel = new BroadcastChannel(SWITCH_WORKSPACE_CHANNEL_NAME)
const LEGACY_WORKSPACE_LIST_CACHE_KEY = 'workspace:fetchWorkspaceList:cache'
const LEGACY_WORKSPACE_PERMISSION_CACHE_KEY = 'workspace:getPermissionByWorkspace:cache'
const WORKSPACE_LIST_CACHE_KEY_PREFIX = 'workspace:fetchWorkspaceList:cache:v2'
const WORKSPACE_PERMISSION_CACHE_KEY_PREFIX = 'workspace:getPermissionByWorkspace:cache:v2'

let hidePageLoadingTimeout: any
let workspaceSwitchTask: Promise<void> = Promise.resolve()

function getUserStore() {
  return useUserStore()
}

function getProxyStore() {
  return useProxyStore()
}

function getCommonStore() {
  return useCommonStore()
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const permissionStore = usePermissionStore()
  const { check } = usePermission()
  const [_, onlyErrorToast] = useResponseToast()

  const currentWorkspace = ref<Workspace>()
  const workspaceList = ref<Workspace[]>([])
  const sharedWorkspaceList = ref<SharedWorkspace>()
  const isSwitchingWorkspace = ref(false)
  /** before-enter 等场景：已设置 workspace 上下文但不触发进空间副作用 */
  const workspaceEntrySilent = ref(false)
  const defaultWorkspace = computed(() => workspaceList.value.find(item => item.workspaceDefault && item.role === Role.OWNER))

  const maxCreateWindowCount = computed(() => {
    return (defaultWorkspace.value?.maxWindowCount || 0) - (defaultWorkspace.value?.useWindowCount || 0)
  })

  const debounceGetPayInfo = debounce(() => {
    const userStore = getUserStore()
    userStore.userPayInfo = {} as UserGetUserPayInfoListData['data']
    userStore.getUserPayInfo()
    userStore.getUserCards(true)
  }, 50)

  /** 记住用户最后一次使用的团队 */
  const rememberLastWorkspace = debounce(() => {
    API.base.userSetUserConfigCreate({})
  }, 1000)

  function clearWorkspaceCache() {
    localStorage.removeItem(LEGACY_WORKSPACE_LIST_CACHE_KEY)
    localStorage.removeItem(LEGACY_WORKSPACE_PERMISSION_CACHE_KEY)

    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (
        key?.startsWith(`${WORKSPACE_LIST_CACHE_KEY_PREFIX}:`)
        || key?.startsWith(`${WORKSPACE_PERMISSION_CACHE_KEY_PREFIX}:`)
      ) {
        localStorage.removeItem(key)
      }
    }
  }

  function syncElectronWorkspaceId(workspaceId: number, workspaceType?: number) {
    if (isMainWindow)
      globalThis.electronAPI.send('user:setWorkspaceId', workspaceId, workspaceType)
  }

  function runPostWorkspaceEntryEffects(workspace: Workspace) {
    clearTimeout(hidePageLoadingTimeout)

    debounceGetPayInfo()
    // 正式进空间后 header 已有 workspaceId，按普通/电商模式拉取公告
    void getCommonStore().refreshAnntList()

    hidePageLoadingTimeout = setTimeout(() => {
      hidePageLoading()
      globalThis.electronAPI.send('app:restartAPIServer')

      if (workspace.role === Role.OWNER) {
        if (globalThis.isElectron) {
          if (getUserStore().userInfo.onboardingTaskStatus?.firstRegisterGuideStatus === false)
            emitter.emit('showUserGuideDialog')
        }
        else {
          if (getUserStore().userInfo.onboardingTaskStatus?.firstWebRegisterGuideStatus === false)
            emitter.emit('showUserGuideDialog')
        }
      }
    }, 1200)
  }

  watch(currentWorkspace, (val, old) => {
    // silent 阶段仅同步 workspaceId，供 API 拦截器写入 header；公告等正式进空间再拉
    if (workspaceEntrySilent.value) {
      val?.id && syncElectronWorkspaceId(val.id, val.workspaceType)
      return
    }

    if (val && old && val.id !== old.id) {
      // 空间切换
      getUserStore().mixpanelTrack('workspace_switch')
    }
    if (!val || val?.id === old?.id) {
      // 同 workspace 仅业务模式变化：等 UI 更新后再做等价路由跳转（如 create/edit）
      if (val && old && val.workspaceType !== old.workspaceType) {
        getProxyStore().clearProxyVendors()
        replaceOnWorkspaceTypeSwitch(val.workspaceType, val.role)
        syncElectronWorkspaceId(val.id, val.workspaceType)
        // 普通 ↔ 电商切换后公告集可能变化
        void getCommonStore().refreshAnntList()
      }

      val?.id && hidePageLoading()
      return
    }
    clearTimeout(hidePageLoadingTimeout)

    debounceGetPayInfo()

    // 首屏赋值由 home.redirect + workspaceTypeGuard 处理；仅 workspace 切换时做路由纠偏
    if (old) {
      const currentRoute = getCurrentRoute()
      replaceOnWorkspaceSwitch({
        oldWorkspace: old,
        newWorkspace: val,
        hasCurrentRoutePermission: Array.isArray(currentRoute.meta?.permissions)
          ? check(currentRoute.meta.permissions, currentRoute.meta?.permissionMode)
          : true,
      })
    }

    if (val?.id && isMainWindow) {
      syncElectronWorkspaceId(val.id, val.workspaceType)
      rememberLastWorkspace()
    }
    runPostWorkspaceEntryEffects(val)
  }, { flush: 'post' })

  async function fetchSharedWorkspaceList() {
    // if (!sharedWorkspaceList.value?.length || force) {
    //   const { code, data } = await API.limit.userGetPublicWorkspaceListList()
    //   if (code !== 0)
    //     return
    //   sharedWorkspaceList.value = data.rows
    //   // 设置公共空间列表
    //   globalThis.electronAPI.send('user:setSharedWorkspaceList', data.rows.map(item => ({ workspaceId: item.id!, role: item.role })))
    // }
    return sharedWorkspaceList.value
  }

  async function fetchWorkspaceList() {
    const endFetchWorkspaceList = createPerfTimer('workspace:fetchWorkspaceList')

    const [result, sharedWorkspace] = await Promise.all([
      API.limit.userGetWorkspaceListList(),
      fetchSharedWorkspaceList(),
    ])
    endFetchWorkspaceList({
      rows: result.data?.rows?.length ?? 0,
      sharedRows: sharedWorkspace?.length ?? 0,
      code: result.code,
    })

    // 如果获取团队列表失败，则清除用户信息
    if (result.code !== 0 || !result.data?.rows?.length) {
      getUserStore().clearUserInfo()
      navigateToLogin()
      onlyErrorToast(-1, $t('获取团队列表失败，请重新登录'), { summary: $t('提示'), life: 5000 })
    }

    const list = [
      ...(result.data.rows || []),
      ...toRaw(sharedWorkspace?.filter(item => item.role !== Role.OWNER) || []) as unknown as Workspace[],
    ]

    workspaceList.value = list
    result.data.rows = list

    if (workspaceList.value.length) {
      globalThis.electronAPI.send('user:setAllWorkspaceId', workspaceList.value.map(item => item.id!).filter(Boolean))
    }

    return result
  }

  async function updateCurrentWorkspace(data: UserGetWorkspaceListListData['data']) {
    currentWorkspace.value = data.rows.find((item) => {
      if (currentWorkspace.value) {
        return item.id === currentWorkspace.value?.id
      }
      return item.workspaceDefault
    })

    if (!currentWorkspace.value) {
      const workspaceDefault = data.rows.find(item => item.workspaceDefault)
      await getPermissionByWorkspace(workspaceDefault!.id, { pendingSwitch: true })
      currentWorkspace.value = workspaceDefault
    }
  }

  async function getWorkspaceList() {
    const { data } = await fetchWorkspaceList()
    updateCurrentWorkspace(data)
    return data.rows
  }

  function resetWorkspace() {
    currentWorkspace.value = undefined
    workspaceList.value = []
    sharedWorkspaceList.value = []
    workspaceEntrySilent.value = false
    clearWorkspaceCache()
    getProxyStore().clearProxyVendors()
    getCommonStore().clearAnntList()
    globalThis.electronAPI.send('user:setSharedWorkspaceList', [])
  }

  async function getPermissionByWorkspace(
    workspaceId: number,
    options?: { pendingSwitch?: boolean },
  ) {
    const endGetPermission = createPerfTimer('workspace:getPermissionByWorkspace', {
      workspaceId,
      pendingSwitch: Boolean(options?.pendingSwitch),
    })
    const { code, data, msg } = await API.team.userGetTeamPermissionsList({ workspaceId: workspaceId.toString() })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return
    endGetPermission({
      permissionCount: data.rows.length,
      code,
    })

    // 切换前预拉目标空间权限时 currentWorkspace 仍是旧值，需允许写入
    if (!options?.pendingSwitch && workspaceId !== currentWorkspace.value?.id)
      return

    permissionStore.setPermissions(data.rows)
  }

  async function setCurrentWorkspace(
    workspaceId: number,
    options?: { silent?: boolean, force?: boolean },
  ) {
    const endSetCurrentWorkspace = createPerfTimer('workspace:setCurrentWorkspace', {
      workspaceId,
      silent: Boolean(options?.silent),
      force: Boolean(options?.force),
    })
    const run = async () => {
      isSwitchingWorkspace.value = true
      try {
        const previousWorkspaceId = currentWorkspace.value?.id
        if (previousWorkspaceId !== undefined && previousWorkspaceId !== workspaceId) {
          useListCacheStore().clearAll()
          getProxyStore().clearProxyVendors()
        }

        workspaceEntrySilent.value = options?.silent ?? false
        if (!workspaceEntrySilent.value)
          isMainWindow && showPageLoading()

        if (!workspaceList.value.length || options?.force)
          await fetchWorkspaceList()

        const targetWorkspace = workspaceList.value.find(item => item.id === workspaceId)
        const nextWorkspace = targetWorkspace || defaultWorkspace.value
        if (!nextWorkspace?.id)
          return

        await getPermissionByWorkspace(nextWorkspace.id, { pendingSwitch: true })
        currentWorkspace.value = nextWorkspace

        if (isMainWindow) {
          if (globalThis.isElectron && !workspaceEntrySilent.value) {
            workspaceChangeChannel.postMessage({
              workspaceId: nextWorkspace.id,
              workspaceName: nextWorkspace.workspaceName,
            })
          }
          else if (document.visibilityState === 'visible') {
            const userStore = getUserStore()

            workspaceChangeChannel.postMessage({
              workspaceId: nextWorkspace.id,
              workspaceName: nextWorkspace.workspaceName,
              token: userStore.token,
            })
          }
        }
      }
      finally {
        isSwitchingWorkspace.value = false
        endSetCurrentWorkspace({
          currentWorkspaceId: currentWorkspace.value?.id,
        })
      }
    }

    const next = workspaceSwitchTask.then(run, run)
    workspaceSwitchTask = next.catch(() => { })
    return next
  }

  /** 静默准备 workspace 上下文（默认 silent），不触发全局 loading 与进空间副作用 */
  async function prepareWorkspace(
    workspaceId: number,
    options?: { silent?: boolean, force?: boolean },
  ) {
    return setCurrentWorkspace(workspaceId, {
      silent: options?.silent ?? true,
      force: options?.force,
    })
  }

  /** 正式进空间：关闭 silent 并触发 loading + 进空间副作用 */
  async function enterWorkspace(workspaceId?: number) {
    workspaceEntrySilent.value = false

    isMainWindow && showPageLoading()

    const targetId = workspaceId ?? currentWorkspace.value?.id
    if (!targetId)
      return

    if (!currentWorkspace.value?.id) {
      await setCurrentWorkspace(targetId)
      return
    }

    if (currentWorkspace.value.id === targetId) {
      if (isMainWindow) {
        syncElectronWorkspaceId(targetId, currentWorkspace.value.workspaceType)
        rememberLastWorkspace()
      }
      runPostWorkspaceEntryEffects(currentWorkspace.value)
      return
    }

    await setCurrentWorkspace(targetId)
  }

  /**
   * 监听主窗口发来的消息
   */
  workspaceChangeChannel.onmessage = (event) => {
    console.log('Received message:', event.data)
    if (event.data.workspaceId !== currentWorkspace.value?.id) {
      setCurrentWorkspace(event.data.workspaceId)
    }
    if (event.data.token) {
      getUserStore().setToken(event.data.token)
    }
  }

  /**
   * 切换到默认空间
   */
  function switchDefaultWorkspace() {
    if (defaultWorkspace.value?.id)
      setCurrentWorkspace(defaultWorkspace.value?.id)
  }

  /**
   * 切换工作区业务模式（Private ↔ ECommerce）
   * 模式切换后权限集可能变化，需在更新本地 type 前重拉，避免路由跳转时仍用旧权限
   */
  async function switchWorkspaceType(targetType: WorkspaceType) {
    if (!currentWorkspace.value || currentWorkspace.value.workspaceType === targetType)
      return

    const workspaceId = currentWorkspace.value.id
    const previousType = currentWorkspace.value.workspaceType

    const { code, msg } = await API.team.userMdfWorkspaceTypeCreate({
      id: workspaceId!,
      workspaceType: targetType,
    })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return

    // 后端按新模式返回权限；先刷新再改 type，保证 watch 跳路由时权限已就绪
    await getPermissionByWorkspace(workspaceId!)

    currentWorkspace.value = {
      ...currentWorkspace.value,
      workspaceType: targetType,
    }

    const workspaceIndex = workspaceList.value.findIndex(item => item.id === workspaceId)
    if (workspaceIndex >= 0) {
      workspaceList.value[workspaceIndex] = {
        ...workspaceList.value[workspaceIndex],
        workspaceType: targetType,
      }
    }

    getUserStore().mixpanelTrack('workspace_type_switch', {
      workspaceId,
      from: previousType,
      to: targetType,
    })
  }

  return {
    defaultWorkspace,
    workspaceList,
    sharedWorkspaceList,
    currentWorkspace,
    isSwitchingWorkspace,
    workspaceEntrySilent,
    maxCreateWindowCount,
    resetWorkspace,
    clearWorkspaceCache,
    getWorkspaceList,
    setCurrentWorkspace,
    prepareWorkspace,
    enterWorkspace,
    fetchWorkspaceList,
    getPermissionByWorkspace,
    switchDefaultWorkspace,
    switchWorkspaceType,
  }
}, {
  persist: false,
})
