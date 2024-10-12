<script setup lang="ts">
import type { UnwrapRowType, UserGetLabelInfoListData, UserGetProjectInfoByWorkspaceListData } from '@roxy/backend-api'
import { API } from '/@/api'
import RemarkIcon from '/@/components/remark-icon'
import { Role } from '/@/enums'
import { useWorkspaceStore } from '/@/stores/workspace'
import { isEmptyValue } from '/@/utils'
import { usePopoverMenu } from '/@/views/browser/list/profiles/components/popover-menu'
import type { MetaData } from './type.ts'

type Tag = UnwrapRowType<UserGetLabelInfoListData>
type Project = UnwrapRowType<UserGetProjectInfoByWorkspaceListData>

const [showMenu] = usePopoverMenu()
const workspaceStore = useWorkspaceStore()

const metaData = defineModel<MetaData>('modelValue', {
  default: {
    projectName: 'No project',
    projectId: undefined,
    labelIds: [],
    windowRemark: '',
  },
})

const isOwner = computed(() => workspaceStore.currentWorkspace?.role === Role.OWNER)

async function selectProject(event: Event) {
  const { data } = await API.limit.userGetProjectInfoByWorkspaceList()
  const operation = data.rows.map((item: Project) => ({ label: item.projectName, value: `${item.project_id}` }))
  const value = metaData.value.projectId?.toString() ?? (!isOwner.value ? operation[0]?.value : undefined)

  showMenu(event, {
    type: 'radio',
    value,
    operation,
    onHide: (projectId: string) => {
      if (!isEmptyValue(projectId) && projectId !== value) {
        metaData.value.projectId = Number(projectId)
        metaData.value.projectName = operation.find((item: any) => item.value === projectId)?.label || 'No project'
      }
    },
  })
}

async function selectTags(event: Event) {
  const { data } = await API.window.userGetLabelInfoList({ page_index: '1', page_size: '999' })
  const operation = data.rows.map((item: Tag) => ({ label: item.name, value: `${item.id}` }))
  const value = metaData.value.labelIds.map((item: any) => `${item}`)

  showMenu(event, {
    type: 'checkbox',
    value,
    operation,
    onHide: (labelIds: string[]) => {
      if (!isEq(value, toRaw(labelIds))) {
        metaData.value.labelIds = labelIds.map(Number)
      }
    },
  })
}

function isEq(oldIds: any, newIds: any) {
  return oldIds.slice().sort().join(',') === newIds.slice().sort().join(',')
}

function onConfirm(windowRemark: string) {
  metaData.value.windowRemark = windowRemark
}
</script>

<template>
  <div class="flex items-center gap-2">
    <RyButton outlined severity="secondary" size="small" icon="base/rx_ic_stack" :label="metaData.projectName"
      @click="selectProject" />
    <RyButton outlined severity="secondary" size="small" icon="base/rx_ic_tag" @click="selectTags" />
    <RemarkIcon mode="button" :value="metaData.windowRemark" :on-confirm="onConfirm" />
  </div>
</template>

<style lang="scss"></style>
