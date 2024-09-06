<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import ryPopover from '/@/components/ry-popover'
import profiles from './profiles'
import recycle from './recycle'
import { API } from '/@/api'

const confirm = useConfirm()
const toast = useToast()

const tabs = ref([
  { label: '所有窗口', icon: 'mdi mdi-google-downasaur', id: '1000', name: 'profiles' },
  { label: '回收站', icon: 'mdi mdi-delete-empty-outline', id: '1001', name: 'recycle' },
])

const sortTabs = computed({
  get() {
    return tabs.value.length > 2 ? tabs.value.slice(1, -1) : []
  },
  set(value) {
    tabs.value.splice(1, tabs.value.length - 2, ...value)
  },
})

const active = ref(tabs.value[0].id)
const isRecycle = computed(() => active.value === '1001')
const currentFilter = computed(() => tabs.value.find(tab => tab.id === active.value))

async function getFilterList() {
  const { data } = await API.window.userGetWindowFilterNameListList()
  const list = data.map((item, index: number) => ({ ...item, label: item.filter_name, icon: '', id: `${index}`, name: item.filter_name }))

  if (tabs.value.length > 2) {
    tabs.value = tabs.value.filter(tab => ['1000', '1001'].includes(tab.id))
  }
  tabs.value.splice(1, 0, ...list)
}

async function updateFilterTabs() {
  await getFilterList()
  const last = tabs.value.length - 2
  active.value = tabs.value[last].id
}

async function deleteFilterItem(filter_name: string) {
  confirm.require({
    header: '警告',
    message: '确认删除此筛选组？',
    rejectProps: {
      label: '取消',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: '确定',
      severity: 'danger',
    },
    accept: async () => {
      try {
        const { msg } = await API.window.userDeleteWindowFilterNameCreate({ filter_name })
        toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
        getFilterList()
      }
      catch (error) {
        console.log('🚀 ~ accept: ~ error:', error)
      }
    },
  })
}

const popRef = ref()
function showPopover(event: Event) {
  popRef.value.getRef().show(event)
}

function hidePopover() {
  console.log('🚀 ~ hidePopover ~ hidePopover:')
}

window.electronAPI.on('browser:on-close', (dirId) => {
  console.log('browser:on-close', dirId)
})

onMounted(() => {
  getFilterList()
})
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex items-center justify-between">
      <Tabs v-model:value="active" class="flex-1 overflow-hidden" scrollable>
        <TabList>
          <Tab v-for="item in tabs" :key="item.label" :value="item.id">
            <div class="flex items-center text-inherit">
              <span :class="item.icon" />
              <span>{{ item.label }}</span>
            </div>
          </Tab>
        </TabList>
      </Tabs>
      <ryTag class="cursor-pointer mdi mdi-cog" @click="showPopover" />
    </div>
    <div class="flex flex-1 overflow-hidden">
      <recycle v-if="isRecycle" />
      <div v-show="!isRecycle" class="flex-1 overflow-hidden">
        <profiles :current-filter="currentFilter" @update-filter-tabs="updateFilterTabs" />
      </div>
    </div>
  </div>

  <ry-popover ref="popRef" class="table-popover" @hide="hidePopover">
    <div class="table-popover-column">
      所有窗口
    </div>
    <!-- handle=".handle" -->
    <VueDraggable v-model="sortTabs" :animation="150">
      <div v-for="item in sortTabs" :key="item.id" class="flex items-center table-popover-column">
        <span class="cursor-grab mdi mdi-drag handle" />
        <span class="flex-auto">{{ item.label }}</span>
        <span class="cursor-pointer mdi mdi-pencil-outline" />
        <span class="cursor-pointer mdi mdi-delete-empty-outline" @click="deleteFilterItem(item.label)" />
      </div>
    </VueDraggable>
    <div class="table-popover-column">
      回收站
    </div>
  </ry-popover>
</template>

<style scoped lang="scss"></style>
