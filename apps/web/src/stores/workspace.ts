import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useWorkspaceStore = defineStore('workspace', () => {
  const workspaceID = ref<number>()

  function setWorkspaceID(id: number) {
    workspaceID.value = id
  }

  return { workspaceID, setWorkspaceID }
}, {
  persist: true,
})
