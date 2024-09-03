<script setup lang="ts">
import { API } from '/@/api'

const tabs = ref([
  { label: '所有窗口', icon: 'mdi mdi-google-downasaur', id: '1000', routeName: 'browser-list' },
  { label: '回收站', icon: 'mdi mdi-delete-empty-outline', id: '1001', routeName: 'browser-recycle' },
])
const activeTab = ref()

provide('activeTab', activeTab)

async function getFilterList() {
  const { data } = await API.window.userGetWindowFilterNameListList()
  const list = data.map((item, index) => ({ ...item, label: item.filter_name, icon: '', id: `${index}`, routeName: 'browser-list' }))

  if (tabs.value.length > 2) {
    tabs.value.splice(1, tabs.value.length - 2)
  }
  tabs.value.splice(1, 0, ...list)
}

function handleTabChange(id: string | number) {
  activeTab.value = tabs.value.find(item => item.id === id)
}

onMounted(() => {
  getFilterList()
})
</script>

<template>
  <div class="h-full">
    <Tabs :value="tabs[0].id" scrollable @update:value="handleTabChange">
      <TabList>
        <Tab v-for="item in tabs" :key="item.label" :value="item.id">
          <router-link v-if="item.routeName" v-slot="{ href, navigate }" :to="{ name: item.routeName }" custom>
            <a :href="href" class="flex items-center text-inherit decoration-none" @click="navigate">
              <span :class="item.icon" />
              <span>{{ item.label }}</span>
            </a>
          </router-link>
        </Tab>
      </TabList>
    </Tabs>
    <div class="browser-content">
      <router-view @update-filter-tabs="getFilterList" />
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
