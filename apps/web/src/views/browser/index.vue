<script setup>
import { ref } from 'vue'

const items = ref([
  { label: 'Dashboard', icon: 'mdi mdi-google-downasaur' },
  { label: 'Transactions', icon: 'mdi mdi-unicorn' },
  { label: 'Products', icon: 'mdi mdi-duck' },
  { label: 'Messages', icon: 'mdi mdi-elephant' },
])
</script>

<template>
  <div class="card flex flex-col h-full">
    <Tabs value="Dashboard">
      <TabList>
        <Tab v-for="tab in items" :key="tab.label" :value="tab.label">
          <i :class="tab.icon" />
          <span>{{ tab.label }}</span>
        </Tab>
      </TabList>
    </Tabs>
    <div style="background-color: gray;" class="flex flex-col flex-auto">
      <router-view />
    </div>
  </div>
</template>
