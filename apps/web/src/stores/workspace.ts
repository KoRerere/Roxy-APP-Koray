import type { UnwrapRowsType, UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'
import { debounce } from 'es-toolkit'
import { useUserStore } from '/@/stores/user'
import { Role } from '/@/enums'

export const useWorkspaceStore = defineStore('workspace', () => {
  const router = useRouter()
  const userStore = useUserStore()

  const currentWorkspace = ref<UnwrapRowType<UserGetWorkspaceListListData>>()
  const workspaceList = ref<UnwrapRowsType<UserGetWorkspaceListListData>>([])
  const maxCreateWindowCount = computed(() => {
    return workspaceList.value.reduce((acc, cur) => {
      if (currentWorkspace.value?.id !== cur.id && cur.role === Role.OWNER) {
        acc -= cur.maxWindowCount
      }
      return acc
    }, userStore.userInfo.maxWindowCount)
  })

  watch(currentWorkspace, (val) => {
    const currentRoute = router.currentRoute.value
    // 如果当前路由是项目详情页，则跳转到项目列表页
    if (currentRoute.name === 'project-item') {
      router.replace({ name: 'project-list' })
    }
    // 如果当前路由有角色限制，且当前用户不在限制角色内，则跳转到首页
    if (currentRoute.meta?.roles?.length && !currentRoute.meta.roles.includes(val?.role)) {
      router.replace({ path: '/' })
    }

    if (val?.id) {
      window.electronAPI.send('user:setWorkspaceId', val.id)
      rememberLastWorkspace()
    }
  })

  /** 记住用户最后一次使用的工作空间 */
  const rememberLastWorkspace = debounce(() => {
    API.base.userSetUserConfigCreate({})
  }, 1000)

  async function fetchWorkspaceList() {
    const result = await API.limit.userGetWorkspaceListList()
    workspaceList.value = result.data.rows
    return result
  }

  async function getWorkspaceList() {
    const { data } = await fetchWorkspaceList()
    currentWorkspace.value = data.rows.find((item) => {
      if (currentWorkspace.value) {
        return item.id === currentWorkspace.value?.id
      }
      return item.workspaceDefault
    })

    if (!currentWorkspace.value) {
      currentWorkspace.value = data.rows.find(item => item.workspaceDefault)
    }

    return data.rows
  }

  function resetWorkspace() {
    currentWorkspace.value = undefined
    workspaceList.value = []
  }

  /** 登录成功后，设置当前工作区 */
  function setCurrentWorkspace(workspaceId: number) {
    const targetWorkspace = workspaceList.value.find(item => item.id === workspaceId)
    if (targetWorkspace) {
      currentWorkspace.value = targetWorkspace
    }
  }

  return {
    workspaceList,
    maxCreateWindowCount,
    currentWorkspace, resetWorkspace, getWorkspaceList, setCurrentWorkspace, fetchWorkspaceList
  }
}, {
  persist: false,
})
