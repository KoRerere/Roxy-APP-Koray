import type { UnwrapRowsType, UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'
import { debounce } from 'es-toolkit'
import { Role } from '/@/enums'
import { hidePageLoading, isMainWindow, showPageLoading } from '/@/utils'
import { useUserStore } from '/@/stores/user'
import { useToast } from 'primevue/usetoast'
import { $t } from '/@/locales'

let hidePageLoadingTimeout: any

export const useWorkspaceStore = defineStore('workspace', () => {
  const router = useRouter()
  const userStore = useUserStore()
  const toast = useToast()

  const currentWorkspace = ref<UnwrapRowType<UserGetWorkspaceListListData>>()
  const workspaceList = ref<UnwrapRowsType<UserGetWorkspaceListListData>>([])
  const defaultWorkspace = computed(() => workspaceList.value.find(item => item.workspaceDefault && item.role === Role.OWNER))

  const maxCreateWindowCount = computed(() => {
    return defaultWorkspace.value?.maxWindowCount! - defaultWorkspace.value?.useWindowCount!
  })

  const debounceGetPayInfo = debounce(() => {
    userStore.getUserPayInfo()
  }, 50)

  watch(currentWorkspace, (val, old) => {
    if (!val || val?.id === old?.id) {
      val?.id && hidePageLoading()
      return
    }
    clearTimeout(hidePageLoadingTimeout)

    debounceGetPayInfo()
    const currentRoute = router.currentRoute.value
    // 如果当前路由是项目详情页，则跳转到项目列表页
    if (currentRoute.name === 'project-item') {
      router.replace({ name: 'project-list' })
    }
    // 如果当前路由有角色限制，且当前用户不在限制角色内，则跳转到首页
    if (currentRoute.meta?.roles?.length && !currentRoute.meta.roles.includes(val?.role!)) {
      router.replace({ path: '/' })
    }

    // 如果当前工作空间有 ID 且是主窗口，则发送消息给主进程
    if (val?.id && isMainWindow) {
      window.electronAPI.send('user:setWorkspaceId', val.id)
      rememberLastWorkspace()
    }
    hidePageLoadingTimeout = setTimeout(() => {
      hidePageLoading()
    }, 1200)
  }, { flush: 'post' })

  /** 记住用户最后一次使用的工作空间 */
  const rememberLastWorkspace = debounce(() => {
    API.base.userSetUserConfigCreate({})
  }, 1000)

  async function fetchWorkspaceList() {
    const result = await API.limit.userGetWorkspaceListList()
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
    workspaceList.value = result.data?.rows || []
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
  }

  /** 登录成功后，设置当前工作区 */
  async function setCurrentWorkspace(workspaceId: number) {
    showPageLoading()
    if (!workspaceList.value.length) {
      await fetchWorkspaceList()
    }
    const targetWorkspace = workspaceList.value.find(item => item.id === workspaceId)
    if (targetWorkspace) {
      currentWorkspace.value = targetWorkspace
    } else {
      currentWorkspace.value = defaultWorkspace.value
    }
  }

  return {
    defaultWorkspace,
    workspaceList,
    currentWorkspace,
    maxCreateWindowCount,
    resetWorkspace,
    getWorkspaceList,
    setCurrentWorkspace,
    fetchWorkspaceList
  }
}, {
  persist: false,
})
