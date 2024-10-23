<script setup lang="tsx">
import { Role } from '/@/enums'
import { useWorkspaceStore } from '/@/stores/workspace'
import { isEmptyValue } from '/@/utils'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
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
const workspaceStore = useWorkspaceStore()

const [showMenu] = usePopoverMenu()
const { getProjects } = useMateGroup()

const isViewer = workspaceStore.currentWorkspace?.role === Role.VIEWER

async function openMenu(event: any) {
  const operation = await getProjects()
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
  <RxButton :disabled="isViewer" severity="secondary" size="xxs" icon="base/rx_ic_stack" :icon-size="14" :label="projectName" @click="openMenu" />
</template>

<style scoped></style>
