<script setup>
import { ref } from 'vue'

const route = useRoute()
const router = useRouter()

const items = ref([
  { route: '/workspace/settings/profile', label: '个人信息', icon: 'pi pi-home' },
  { route: '/workspace/settings/soft-config', label: '软件设置', icon: 'pi pi-chart-line' },
])

function handleTabsChange(value) {
  console.log(value)
  router.push(value)
}
</script>

<template>
  <div class="card">
    <Tabs :value="route.path" @update:value="handleTabsChange">
      <TabList>
        <Tab v-for="tab in items" :key="tab.label" :value="tab.route">
          {{ tab.label }}
        </Tab>
      </TabList>
    </Tabs>
    <RouterView />
  </div>
</template>
