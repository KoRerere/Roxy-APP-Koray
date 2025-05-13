<script setup lang="tsx">
import { useRoleStore } from '/@/stores/role'
import { isEmptyValue } from '/@/utils'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
import { usePopupMenu } from '/@/hooks/usePopupMenu';

interface Props {
  labels: any[]
  projectId?: number
  projectName?: string
}

const props = defineProps<Props>()

const emit = defineEmits(['update'])
const { getProjects } = useMateGroup()
const role = useRoleStore()
const { showMenu: showPopupMenu } = usePopupMenu()

async function openMenu(event: any) {
  if (!(role.isOwner || role.isManager))
    return

  const operation = await getProjects()
  const value = props.projectId?.toString()

  showPopupMenu(event, {
    mode: {
      type: 'single',
      value,
      options: operation,
      field: 'value',
    },
    menuProps: {
      onHide: ({ value: projectId }: any) => {
        if (!isEmptyValue(projectId) && projectId !== value) {
          emit('update', {
            projectName: operation.find(item => item.value === projectId)!.label,
            projectId: Number(projectId),
            ...deleteMembers()
          })
        }
      }
    }
  })
}

/**
 * 切换项目删除人员标签
 */
function deleteMembers() {
  const labelInfo = props.labels.filter(item => !`${item.labelId}`.startsWith('u_'))
  const labelIds = labelInfo.map(item => item.labelId)
  return { labelInfo, labelIds }
}
</script>

<template>
  <RxTag class="cursor-pointer" icon="base/rx_ic_stack" :label="projectName" @click.stop="openMenu" />
</template>

<style scoped></style>
