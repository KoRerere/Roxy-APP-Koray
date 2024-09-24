<script setup lang="ts">
import testtable from './components/test-table.vue'
import { API } from '/@/api'

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

const selection = ref({ id: 226 })
</script>

<template>
  <div class="flex-ovh-1">
    <testtable v-model:selection="selection" :columns="columns" :table-request="tableRequest">
      <template #related="{ data }">
        <relatedInfo :list="data.bindList" />
      </template>
    </testtable>
  </div>
</template>

<style scoped></style>
