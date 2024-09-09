<script setup lang="ts">
const tabs = ref([
  { title: '单个代理', value: 'single' },
  { title: '批量代理', value: 'batch' },
])
const tabsValue = ref('single')
</script>

<template>
  <div>
    <Tabs v-model:value="tabsValue">
      <TabList>
        <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
          {{ tab.title }}
        </Tab>
      </TabList>
    </Tabs>
  </div>
</template>

<style scoped></style>
