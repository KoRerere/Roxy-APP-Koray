import type { UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaceID = ref<number>()
  const workspaceInfo = ref<UnwrapRowType<UserGetWorkspaceListListData>>()

  function setWorkspaceID(id: number) {
    workspaceID.value = id
  }

  function setWorkspaceInfo(info: UnwrapRowType<UserGetWorkspaceListListData>) {
    workspaceInfo.value = info
  }

  return { workspaceID, setWorkspaceID, workspaceInfo, setWorkspaceInfo }
}, {
  persist: true,
})
