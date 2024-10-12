<script setup lang="tsx">
import type { UnwrapRowType, UserGetProjectInfoByWorkspaceListData } from '@roxy/backend-api'
import { API } from '/@/api'
import { Role } from '/@/enums'
import { useWorkspaceStore } from '/@/stores/workspace'
import { isEmptyValue } from '/@/utils'
import { usePopoverMenu } from './popover-menu'

const props = defineProps({
  projectId: {
    type: [Number, String],
    default: undefined,
  },
  projectName: {
    type: String,
    default: undefined,
  },
})
const emit = defineEmits(['update'])
type Project = UnwrapRowType<UserGetProjectInfoByWorkspaceListData>
const workspaceStore = useWorkspaceStore()

const [showMenu] = usePopoverMenu()

const isViewer = workspaceStore.currentWorkspace?.role === Role.VIEWER

async function openMenu(event: any) {
  const { data } = await API.limit.userGetProjectInfoByWorkspaceList()
  const operation = data.rows.map((item: Project) => ({ label: item.projectName, value: `${item.project_id}` }))
  const value = props.projectId?.toString()

  showMenu(event, {
    type: 'radio',
    value,
    operation,
    onHide: (projectId: string) => {
      if (!isEmptyValue(projectId) && projectId !== value) {
        emit('update', { projectId: Number(projectId) })
      }
    },
  })
}
</script>

<template>
  <ryButton :disabled="isViewer" severity="secondary" size="small" icon="base/rx_ic_stack" :label="projectName"
    @click="openMenu" />
</template>

<style scoped></style>
