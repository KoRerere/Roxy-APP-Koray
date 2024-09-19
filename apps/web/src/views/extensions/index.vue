<script setup lang="ts">
import { useTemplateRef } from 'vue'
import hub from './hub/index.vue'
import list from './install/index.vue'

const tabs = ref([
  { title: 'Intalled', value: 'intalled' },
  { title: 'Extension Hub', value: 'hub' },
])

const tabsValue = ref('intalled')

const listRef = useTemplateRef('listref')
const hubRef = useTemplateRef('hubref')

function onChange(value: any) {
  if (value === 'intalled') {
    listRef.value?.refresh()
  }
  else if (value === 'hub') {
    hubRef.value?.refresh()
  }
}
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <div class="extensions-header">
      Extensions
    </div>
    <Tabs class="flex-1 overflow-hidden" :value="tabsValue" @update:value="onChange">
      <TabList>
        <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
          {{ tab.title }}
        </Tab>
      </TabList>
      <TabPanels class="flex flex-1 !pa-0 overflow-hidden">
        <TabPanel class="flex-1" value="intalled">
          <!-- eslint-disable-next-line vue/no-unused-refs -->
          <list ref="listref" />
        </TabPanel>
        <TabPanel class="flex flex-1" value="hub">
          <!-- eslint-disable-next-line vue/no-unused-refs -->
          <hub ref="hubref" />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style lang="scss" scoped>
.extensions-header {
  padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
  gap: 10px;
  height: 48px;
  color: #000;
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 600;
  line-height: var(--Line-Height-text-xl, 24px);
  border-bottom: none;
}
</style>
