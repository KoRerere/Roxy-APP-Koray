import type { UnwrapRowsType, UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'

export const useWorkspaceStore = defineStore('workspace', () => {
  const router = useRouter()

  const currentWorkspace = ref<UnwrapRowType<UserGetWorkspaceListListData>>()
  const workspaceList = ref<UnwrapRowsType<UserGetWorkspaceListListData>>([])

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
    }
  }, { immediate: true })

  async function getWorkspaceList() {
    const { data } = await API.limit.userGetWorkspaceListList()
    workspaceList.value = data.rows
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

  return { workspaceList, currentWorkspace, resetWorkspace, getWorkspaceList, setCurrentWorkspace }
}, {
  persist: false,
})
