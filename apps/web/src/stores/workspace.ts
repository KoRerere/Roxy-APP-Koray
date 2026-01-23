import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'
import { debounce } from 'es-toolkit'
import { Role, WorkspaceType } from '/@/enums'
import { hidePageLoading, isMainWindow, showPageLoading } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { useToast } from 'primevue/usetoast'

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
  const toast = useToast()

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
    userStore.getUserCards()
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
    // 如果当前路由有角色限制，且当前用户不在限制角色内，则跳转到首页
    if (currentRoute.meta?.roles?.length && !currentRoute.meta.roles.includes(val?.role as Role) && !isPublic) {
      router.replace({ name: 'home' })
    }

    // 空间类型变化
    if ((old && old.workspaceType !== val.workspaceType) || (!old && val.workspaceType === WorkspaceType.Public)) {
      router.replace({ name: isPublic && val.role !== Role.OWNER ? 'shared' : 'home' })
    }

    // 如果当前工作空间有 ID 且是主窗口，则发送消息给主进程
    if (val?.id && isMainWindow) {
      window.electronAPI.send('user:setWorkspaceId', val.id)
      rememberLastWorkspace()
    }
    hidePageLoadingTimeout = setTimeout(() => {
      hidePageLoading()
      electronAPI.send('app:restartAPIServer')
      if (userStore?.userInfo.onboardingTaskStatus?.firstRegisterGuideStatus === false) {
        emitter.emit('showUserGuideDialog')
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
      electronAPI.send('user:setSharedWorkspaceList', data.rows.map(item => ({ workspaceId: item.id!, role: item.role })))
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
      toast.add({
        severity: 'error',
        summary: $t('提示'),
        detail: $t('获取工作空间列表失败，请重新登录'),
        life: 5000,
      })
    }

    const list = [
      ...(result.data.rows || []),
      ...toRaw(sharedWorkspace?.filter(item => item.role !== Role.OWNER) || []) as unknown as Workspace[],
    ]

    workspaceList.value = list
    result.data.rows = list

    if (workspaceList.value.length) {
      window.electronAPI.send('user:setAllWorkspaceId', workspaceList.value.map(item => item.id!).filter(Boolean))
    }

    return result
  }

  function updateCurrentWorkspace(data: UserGetWorkspaceListListData['data']) {
    currentWorkspace.value = data.rows.find((item) => {
      if (currentWorkspace.value) {
        return item.id === currentWorkspace.value?.id
      }
      return item.workspaceDefault
    })

    if (!currentWorkspace.value) {
      currentWorkspace.value = data.rows.find(item => item.workspaceDefault)
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
    electronAPI.send('user:setSharedWorkspaceList', [])
  }

  /** 登录成功后，设置当前工作区 */
  async function setCurrentWorkspace(workspaceId: number) {
    isMainWindow && showPageLoading()

    if (!workspaceList.value.length) {
      await fetchWorkspaceList()
    }
    const targetWorkspace = workspaceList.value.find(item => item.id === workspaceId)
    if (targetWorkspace) {
      currentWorkspace.value = targetWorkspace
    }
    else {
      currentWorkspace.value = defaultWorkspace.value
    }
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
    setCurrentWorkspace(event.data.workspaceId)
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
  }
}, {
  persist: false,
})
