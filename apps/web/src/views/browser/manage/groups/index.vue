<script setup lang="ts">
import { API } from '/@/api'
import relatedProfiles from '/@/views/agent/list/components/related-profiles.vue'

const columns = ref([
  {
    title: 'group',
    key: 'name',
  },
  {
    title: 'Related Profiles',
    key: 'relatedProfiles',
    slot: 'related',
  },
])

function tableRequest(params: any) {
  return API.window.userGetGroupInfoList(params)
}
</script>

<template>
  <div class="flex-ovh-1">
    <ryTable :columns="columns" :table-request="tableRequest">
      <template #related="{ data }">
        <relatedProfiles :list="data.bindList" />
      </template>
    </ryTable>
  </div>
</template>

<style scoped></style>
