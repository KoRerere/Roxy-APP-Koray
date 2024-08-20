<script setup lang="ts">
const items = ref([
  { label: 'Dashboard', icon: 'mdi mdi-google-downasaur' },
  { label: 'Transactions', icon: 'mdi mdi-unicorn' },
  { label: 'Products', icon: 'mdi mdi-duck' },
  { label: 'Messages', icon: 'mdi mdi-elephant' },
])
</script>

<template>
  <div class="h-full">
    <Tabs value="Dashboard">
      <TabList>
        <Tab v-for="tab in items" :key="tab.label" :value="tab.label">
          <i :class="tab.icon" />
          <span>{{ tab.label }}</span>
        </Tab>
      </TabList>
    </Tabs>
    <div class="browser-content">
      <router-view />
    </div>
  </div>
</template>

<style scoped lang="scss">
.browser {
  &-content {
    height: calc(100% - 48px);
  }
}
</style>
