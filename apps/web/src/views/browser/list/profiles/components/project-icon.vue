<script setup lang="tsx">
import { isEmptyValue } from '/@/utils'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { ProfileReqType } from '/@/enums'

interface Props {
  labels: any[]
  /** 列表接口常把 ID 序列化成字符串，与 OpenAPI number 不一致，需同时兼容 */
  projectId?: number | string
  projectName?: string
  disabled?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits(['update'])
const { getProjects } = useMateGroup()
const { showMenu: showPopupMenu } = usePopupMenu()

async function openMenu(event: any) {
  if (props.disabled)
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
            requestType: ProfileReqType.MoveProject,
            ...deleteMembers(),
          })
        }
      },
    },
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
