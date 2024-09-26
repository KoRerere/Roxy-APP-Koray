import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { Role } from '/@/enums'
import { useWorkspaceStore } from '/@/stores/workspace'

export const useRoleStore = defineStore('role', () => {
  const workspaceStore = useWorkspaceStore()

  /** 空间查看者 */
  const isViewer = computed(() => {
    return workspaceStore.currentWorkspace?.role === Role.VIEWER
  })

  /** 空间编辑者 */
  const isEditor = computed(() => {
    return workspaceStore.currentWorkspace?.role === Role.EDITOR
  })

  /** 空间管理者 */
  const isManager = computed(() => {
    return workspaceStore.currentWorkspace?.role === Role.MANAGER
  })

  /** 空间拥有者 */
  const isOwner = computed(() => {
    return workspaceStore.currentWorkspace?.role === Role.OWNER
  })

  return { isViewer, isEditor, isManager, isOwner }
})
