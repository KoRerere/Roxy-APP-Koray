import type { UnwrapRowsType, UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'

export const useWorkspaceStore = defineStore('workspace', () => {
  const router = useRouter()

  const currentWorkspace = ref<UnwrapRowType<UserGetWorkspaceListListData>>()
  const workspaceList = ref<UnwrapRowsType<UserGetWorkspaceListListData>>([])

  watch(currentWorkspace, () => {
    if (router.currentRoute.value.name === 'project-item') {
      router.replace({ name: 'project-list' })
    }
  })

  function setWorkspaceInfo(info: UnwrapRowType<UserGetWorkspaceListListData>) {
    currentWorkspace.value = info
  }

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
  }

  return { workspaceList, currentWorkspace, setWorkspaceInfo, getWorkspaceList }
}, {
  persist: true,
})
