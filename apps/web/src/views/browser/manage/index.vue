<script setup lang="ts">
import groups from './groups'
import tags from './tags'

const tabs = ref([
  { title: 'Groups', value: 'groups' },
  { title: 'Tags', value: 'tags' },
])
const tabsValue = ref('tags')
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-hidden">
    <Tabs v-model:value="tabsValue">
      <TabList>
        <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
          {{ tab.title }}
        </Tab>
      </TabList>
    </Tabs>
    <div class="flex-ovh-1 w-full">
      <groups v-show="tabsValue === 'groups'" />
      <tags v-show="tabsValue === 'tags'" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
