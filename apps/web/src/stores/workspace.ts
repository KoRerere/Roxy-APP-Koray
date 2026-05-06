import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'
import { usePermission } from '/@/hooks/usePermission'
import { debounce } from 'es-toolkit'
import { Role, WorkspaceType } from '/@/enums'
import { hidePageLoading, isMainWindow, showPageLoading } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { usePermissionStore } from '/@/stores/permission'
import { SWITCH_WORKSPACE_CHANNEL_NAME } from '/@/constants/channel'
import { emitter } from '/@/utils/eventBus'
import type { UnwrapRowsType, UnwrapRowType, UserGetPublicWorkspaceListListData, UserGetUserPayInfoListData, UserGetWorkspaceListListData } from '@roxy/backend-api'

type Workspace = UnwrapRowType<UserGetWorkspaceListListData>
type SharedWorkspace = UnwrapRowsType<UserGetPublicWorkspaceListListData>

const workspaceChangeChannel = new BroadcastChannel(SWITCH_WORKSPACE_CHANNEL_NAME)

let hidePageLoadingTimeout: any

export const useWorkspaceStore = defineStore('workspace', () => {
  const router = useRouter()
  const userStore = useUserStore()
  const permissionStore = usePermissionStore()
  const { check } = usePermission()
  const [_, onlyErrorToast] = useResponseToast()

  const currentWorkspace = ref<Workspace>()
  const workspaceList = ref<Workspace[]>([])
  const sharedWorkspaceList = ref<SharedWorkspace>()
  const defaultWorkspace = computed(() => workspaceList.value.find(item => item.workspaceDefault && item.role === Role.OWNER))

  const maxCreateWindowCount = computed(() => {
    return (defaultWorkspace.value?.maxWindowCount || 0) - (defaultWorkspace.value?.useWindowCount || 0)
  })

  const debounceGetPayInfo = debounce(() => {
    userStore.userPayInfo = {} as UserGetUserPayInfoListData['data']
    userStore.getUserPayInfo()
    userStore.getUserCards(true)
  }, 50)

  /** 记住用户最后一次使用的工作空间 */
  const rememberLastWorkspace = debounce(() => {
    API.base.userSetUserConfigCreate({})
  }, 1000)

  watch(currentWorkspace, (val, old) => {
    if (val && old && val.id !== old.id) {
      // 空间切换
      userStore.mixpanelTrack('workspace_switch')
    }
    if (!val || val?.id === old?.id) {
      val?.id && hidePageLoading()
      return
    }
    clearTimeout(hidePageLoadingTimeout)

    debounceGetPayInfo()
    const currentRoute = router.currentRoute.value
    const isPublic = val.workspaceType === WorkspaceType.Public

    // 如果当前路由是项目详情页，则跳转到项目列表页
    if (currentRoute.name === 'project-item') {
      router.replace({ name: 'project-list' })
    }
    // 如果当前路由有权限限制，且当前用户无权限，则跳转到首页
    if (Array.isArray(currentRoute.meta?.permissions) && !check(currentRoute.meta?.permissions, currentRoute.meta?.permissionMode) && !isPublic) {
      router.replace({ name: 'home' })
    }

    // 空间类型变化
    if ((old && old.workspaceType !== val.workspaceType) || (!old && val.workspaceType === WorkspaceType.Public)) {
      router.replace({ name: isPublic && val.role !== Role.OWNER ? 'shared' : 'home' })
    }

    // 如果当前工作空间有 ID 且是主窗口，则发送消息给主进程
    if (val?.id && isMainWindow) {
      globalThis.electronAPI.send('user:setWorkspaceId', val.id)
      rememberLastWorkspace()
    }
    hidePageLoadingTimeout = setTimeout(() => {
      hidePageLoading()
      globalThis.electronAPI.send('app:restartAPIServer')

      if (val.role === Role.OWNER) {
        if (globalThis.isElectron) {
          if (userStore?.userInfo.onboardingTaskStatus?.firstRegisterGuideStatus === false) {
            emitter.emit('showUserGuideDialog')
          }
        }
        else {
          if (userStore?.userInfo.onboardingTaskStatus?.firstWebRegisterGuideStatus === false) {
            emitter.emit('showUserGuideDialog')
          }
        }
      }
    }, 1200)
  }, { flush: 'post' })

  async function fetchSharedWorkspaceList(force = false) {
    if (!sharedWorkspaceList.value?.length || force) {
      const { code, data } = await API.limit.userGetPublicWorkspaceListList()
      if (code !== 0)
        return
      sharedWorkspaceList.value = data.rows
      // 设置公共空间列表
      globalThis.electronAPI.send('user:setSharedWorkspaceList', data.rows.map(item => ({ workspaceId: item.id!, role: item.role })))
    }
    return sharedWorkspaceList.value
  }

  async function fetchWorkspaceList() {
    const [result, sharedWorkspace] = await Promise.all([
      API.limit.userGetWorkspaceListList(),
      fetchSharedWorkspaceList(),
    ])

    // 如果获取工作空间列表失败，则清除用户信息
    if (result.code !== 0 || !result.data?.rows?.length) {
      userStore.clearUserInfo()
      router.push({ name: 'login' })
      onlyErrorToast(-1, $t('获取工作空间列表失败，请重新登录'), { summary: $t('提示'), life: 5000 })
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
      await getPermissionByWorkspace(workspaceDefault!.id)
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

  async function getPermissionByWorkspace(workspaceId: number) {
    const { code, data, msg } = await API.team.userGetTeamPermissionsList({ workspaceId: workspaceId.toString() })
    onlyErrorToast(code, msg)
    if (code !== 0)
      return

    permissionStore.setPermissions(data.rows)
  }

  /** 登录成功后，设置当前工作区 */
  async function setCurrentWorkspace(workspaceId: number) {
    isMainWindow && showPageLoading()

    if (!workspaceList.value.length) {
      await fetchWorkspaceList()
    }
    const targetWorkspace = workspaceList.value.find(item => item.id === workspaceId)

    const _currentWorkspace = targetWorkspace || defaultWorkspace.value
    await getPermissionByWorkspace(_currentWorkspace!.id)

    currentWorkspace.value = _currentWorkspace

    if (isMainWindow) {
      workspaceChangeChannel.postMessage({
        workspaceId,
        workspaceName: currentWorkspace.value?.workspaceName,
      })
    }
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

  return {
    defaultWorkspace,
    workspaceList,
    sharedWorkspaceList,
    currentWorkspace,
    maxCreateWindowCount,
    resetWorkspace,
    getWorkspaceList,
    setCurrentWorkspace,
    fetchWorkspaceList,
    getPermissionByWorkspace,
    switchDefaultWorkspace,
  }
}, {
  persist: false,
})
