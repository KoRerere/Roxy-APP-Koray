<script setup lang="ts">
import { DeleteOutlined } from '@ant-design/icons-vue'

const activeKey = ref('1')

const tabs = ref([
  {
    key: '1',
    tab: 'All Profiles',
  },
  {
    key: '2',
    tab: 'Favs Profiles',
  },
  {
    key: '3',
    tab: 'Open Profiles',
  },
  {
    key: '4',
    tab: 'Trash',
  },
])
</script>

<template>
  <div class="flex flex-col h-full">
    <a-tabs v-model:activeKey="activeKey" destroy-inactive-tab-pane>
      <a-tab-pane v-for="item in tabs" :key="item.key">
        <template #tab>
          <DeleteOutlined />
          {{ item.tab }}
        </template>
      </a-tab-pane>
    </a-tabs>
    <div style="background-color: gray;" class="flex-auto">
      <router-view />
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.ant-tabs-nav) {
  margin-bottom: 0;
}
</style>
