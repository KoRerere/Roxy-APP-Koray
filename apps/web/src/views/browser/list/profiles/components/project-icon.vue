<script setup lang="tsx">
import { useRoleStore } from '/@/stores/role'
import { isEmptyValue } from '/@/utils'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
import { usePopupMenu } from '/@/hooks/usePopupMenu';

const props = defineProps({
  labelIds: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
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
          emit('update', { projectId: Number(projectId), labelIds: deleteMembers() })
        }
      }
    }
  })
}

/**
 * 切换项目删除人员标签
 */
function deleteMembers() {
  return props.labelIds.filter((id: any) => !`${id}`.startsWith('u_'))
}
</script>

<template>
  <RxTag class="cursor-pointer" icon="base/rx_ic_stack" :label="projectName" @click.stop="openMenu" />
</template>

<style scoped></style>
