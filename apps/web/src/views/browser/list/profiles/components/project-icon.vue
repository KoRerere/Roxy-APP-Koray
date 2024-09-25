<script setup lang="ts">
import type { UnwrapRowType, UserGetProjectInfoByWorkspaceListData } from '@roxy/backend-api'
import { API } from '/@/api'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { useWorkspaceStore } from '/@/stores/workspace'

type Project = UnwrapRowType<UserGetProjectInfoByWorkspaceListData>

defineProps({
  labels: {
    type: Array as PropType<any[]>,
    default: () => ([]),
  },
})

defineEmits(['update'])

const workspaceStore = useWorkspaceStore()

const [show] = useContextMenu()

async function openMenu(event: any) {
  const operation = await getGroups()

  show(event, {
    type: 'radio',
    operation,
    onHide: (projectId: string) => {
      // metaData.value.projectId = projectId
    },
  })
}

async function getGroups() {
  const { data } = await API.limit.userGetProjectInfoByWorkspaceList({ role: workspaceStore.currentWorkspace?.role })
  return data.rows.map((item: Project) => ({ label: item.projectName, value: `${item.project_id}` }))
}
</script>

<template>
  <ryButton severity="secondary" size="small" icon="base/rx_ic_stack" :label="labels[0]?.labelName" @click="openMenu" />
</template>

<style scoped></style>
