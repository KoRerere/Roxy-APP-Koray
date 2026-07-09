import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'
import { usePermission } from '/@/hooks/usePermission'
import { debounce } from 'es-toolkit'
import type { WorkspaceType } from '/@/enums'
import { Role } from '/@/enums'
import { hidePageLoading, isMainWindow, showPageLoading } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { usePermissionStore } from '/@/stores/permission'
import { SWITCH_WORKSPACE_CHANNEL_NAME } from '/@/constants/channel'
import { getCurrentRoute, navigateToLogin, replaceOnWorkspaceSwitch, replaceToLanding } from '/@/router/navigation'
import { emitter } from '/@/utils/eventBus'
import { useListCacheStore } from '/@/stores/listCache'
import type { UnwrapRowsType, UnwrapRowType, UserGetPublicWorkspaceListListData, UserGetUserPayInfoListData, UserGetWorkspaceListListData } from '@roxy/backend-api'

type Workspace = UnwrapRowType<UserGetWorkspaceListListData>
type SharedWorkspace = UnwrapRowsType<UserGetPublicWorkspaceListListData>

const workspaceChangeChannel = new BroadcastChannel(SWITCH_WORKSPACE_CHANNEL_NAME)

let hidePageLoadingTimeout: any
let workspaceSwitchTask: Promise<void> = Promise.resolve()

function getUserStore() {
  return useUserStore()
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const permissionStore = usePermissionStore()
  const { check } = usePermission()
  const [_, onlyErrorToast] = useResponseToast()

  const currentWorkspace = ref<Workspace>()
  const workspaceList = ref<Workspace[]>([])
  const sharedWorkspaceList = ref<SharedWorkspace>()
  const isSwitchingWorkspace = ref(false)
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

  watch(currentWorkspace, (val, old) => {
    if (val && old && val.id !== old.id) {
      // 空间切换
      getUserStore().mixpanelTrack('workspace_switch')
    }
    if (!val || val?.id === old?.id) {
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

    // 如果当前团队有 ID 且是主窗口，则发送消息给主进程
    if (val?.id && isMainWindow) {
      globalThis.electronAPI.send('user:setWorkspaceId', val.id)
      rememberLastWorkspace()
    }
    hidePageLoadingTimeout = setTimeout(() => {
      hidePageLoading()
      globalThis.electronAPI.send('app:restartAPIServer')

      if (val.role === Role.OWNER) {
        if (globalThis.isElectron) {
          if (getUserStore().userInfo.onboardingTaskStatus?.firstRegisterGuideStatus === false) {
            emitter.emit('showUserGuideDialog')
          }
        }
        else {
          if (getUserStore().userInfo.onboardingTaskStatus?.firstWebRegisterGuideStatus === false) {
            emitter.emit('showUserGuideDialog')
          }
        }
      }
    }, 1200)
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
    const [result, sharedWorkspace] = await Promise.all([
      API.limit.userGetWorkspaceListList(),
      fetchSharedWorkspaceList(),
    ])

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
    globalThis.electronAPI.send('user:setSharedWorkspaceList', [])
  }

  async function getPermissionByWorkspace(
    workspaceId: number,
    options?: { pendingSwitch?: boolean },
  ) {
    const { code, data, msg } = await API.team.userGetTeamPermissionsList({ workspaceId: workspaceId.toString() })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return

    // 切换前预拉目标空间权限时 currentWorkspace 仍是旧值，需允许写入
    if (!options?.pendingSwitch && workspaceId !== currentWorkspace.value?.id)
      return

    permissionStore.setPermissions(data.rows)
  }

  async function setCurrentWorkspace(workspaceId: number) {
    const run = async () => {
      isSwitchingWorkspace.value = true
      try {
        const previousWorkspaceId = currentWorkspace.value?.id
        if (previousWorkspaceId !== undefined && previousWorkspaceId !== workspaceId)
          useListCacheStore().clearAll()

        isMainWindow && showPageLoading()

        if (!workspaceList.value.length)
          await fetchWorkspaceList()

        const targetWorkspace = workspaceList.value.find(item => item.id === workspaceId)
        const nextWorkspace = targetWorkspace || defaultWorkspace.value
        if (!nextWorkspace?.id)
          return

        await getPermissionByWorkspace(nextWorkspace.id, { pendingSwitch: true })
        currentWorkspace.value = nextWorkspace

        if (isMainWindow) {
          workspaceChangeChannel.postMessage({
            workspaceId: nextWorkspace.id,
            workspaceName: nextWorkspace.workspaceName,
          })
        }
      }
      finally {
        isSwitchingWorkspace.value = false
      }
    }

    const next = workspaceSwitchTask.then(run, run)
    workspaceSwitchTask = next.catch(() => { })
    return next
  }

  /**
   * 监听主窗口发来的消息
   */
  workspaceChangeChannel.onmessage = (event) => {
    console.log('Received message:', event.data)
    if (event.data.workspaceId !== currentWorkspace.value?.id) {
      setCurrentWorkspace(event.data.workspaceId)
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
   * TODO!: 后端 workspaceType 更新接口尚未提供，当前为本地状态切换
   */
  async function switchWorkspaceType(targetType: WorkspaceType) {
    if (!currentWorkspace.value || currentWorkspace.value.workspaceType === targetType)
      return

    const workspaceId = currentWorkspace.value.id
    const previousType = currentWorkspace.value.workspaceType

    // TODO!: 接口就绪后对接，例如：
    // const { code, msg } = await API.limit.userUpdateWorkspaceTypeCreate({ workspaceId, workspaceType: targetType })
    // onlyErrorToast(code, msg)
    // if (code !== 0) return

    currentWorkspace.value = {
      ...currentWorkspace.value,
      workspaceType: targetType,
    }

    getUserStore().mixpanelTrack('workspace_type_switch', {
      workspaceId,
      from: previousType,
      to: targetType,
    })

    replaceToLanding(targetType, currentWorkspace.value.role)
  }

  return {
    defaultWorkspace,
    workspaceList,
    sharedWorkspaceList,
    currentWorkspace,
    isSwitchingWorkspace,
    maxCreateWindowCount,
    resetWorkspace,
    getWorkspaceList,
    setCurrentWorkspace,
    fetchWorkspaceList,
    getPermissionByWorkspace,
    switchDefaultWorkspace,
    switchWorkspaceType,
  }
}, {
  persist: false,
})
