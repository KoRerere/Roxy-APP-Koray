<script setup lang="ts">
import type { UnwrapRowType, UserGetLabelInfoListData, UserGetProjectInfoByWorkspaceListData } from '@roxy/backend-api'
import { API } from '/@/api'
import remarkIcon from '/@/components/remark-icon'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { useWorkspaceStore } from '/@/stores/workspace'
import { SimpleCache } from '/@/utils/cache'

type Tag = UnwrapRowType<UserGetLabelInfoListData>
type Project = UnwrapRowType<UserGetProjectInfoByWorkspaceListData>

const workspaceStore = useWorkspaceStore()
const [show] = useContextMenu()
const cache = SimpleCache.getInstance()

// const selectedCategories = ref([])

async function selectProject(event: Event) {
  const { data } = await API.limit.userGetProjectInfoByWorkspaceList({ role: workspaceStore.workspaceInfo?.role })
  const operation = data.rows.map((item: Project) => ({ label: item.projectName, value: `${item.project_id}` }))

  show(event, {
    type: 'checkbox',
    operation,
  })
}

async function selectTags(event: Event) {
  const { data } = await cache.fetch(API.window.userGetLabelInfoList, { page_index: '1', page_size: '999' })
  const operation = data.rows.map((item: Tag) => ({ label: item.name, value: `${item.id}` }))

  show(event, {
    type: 'checkbox',
    operation,
  })
}
</script>

<template>
  <div class="flex items-center gap-2">
    <ryButton outlined severity="secondary" size="small" icon="base/rx_ic_stack" label="No project"
      @click="selectProject" />
    <ryButton outlined severity="secondary" size="small" icon="base/rx_ic_tag" @click="selectTags" />
    <remarkIcon mode="button" />
  </div>
</template>

<style lang="scss"></style>
