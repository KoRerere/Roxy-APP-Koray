<script setup lang="tsx">
// import { RxSvgIcon } from '/@/components/rx-icon/'
// import { $t } from '/@/locales'
// import { useProjectActions } from '/@/views/projects/hooks/useProject'
import { useRoleStore } from '/@/stores/role'
import { isEmptyValue } from '/@/utils'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
import { usePopoverMenu } from './popover-menu'

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
// const [projectDialog] = useProjectActions({ toast: false })
const [showMenu] = usePopoverMenu()
const { getProjects } = useMateGroup()
const role = useRoleStore()

async function openMenu(event: any) {
  if (!(role.isOwner || role.isManager))
    return

  const operation = await getProjects()
  const value = props.projectId?.toString()

  showMenu(event, {
    type: 'radio',
    value,
    operation,
    onHide: (projectId: string) => {
      if (!isEmptyValue(projectId) && projectId !== value) {
        emit('update', { projectId: Number(projectId), labelIds: deleteMembers() })
      }
    },
    // afterCmp: () => {
    //   return (
    //     <div class="flex items-center gap-1.5 py-3 px-3.5 cursor-pointer border-0 border-t-1 border-solid border-gray-200" onClick={addProject}>
    //       <RxSvgIcon name="base/rx_ic_plus"></RxSvgIcon>
    //       <div>{$t('创建项目')}</div>
    //     </div>
    //   )
    // },
  })
}

// function addProject() {
//   projectDialog({
//     confirmNext: ({ res }: any) => {
//       emit('update', { projectId: res.data.projectId, labelIds: deleteMembers() })
//     },
//   })
// }

/**
 * 切换项目删除人员标签
 */
function deleteMembers() {
  return props.labelIds.filter((id: any) => !`${id}`.startsWith('u_'))
}
</script>

<template>
  <RxTag class="cursor-pointer" icon="base/rx_ic_stack" :label="projectName" @click="openMenu" />
</template>

<style scoped></style>
