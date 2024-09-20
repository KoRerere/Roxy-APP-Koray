<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { VueDraggable } from 'vue-draggable-plus'
import profiles from './profiles'
import recycle from './recycle'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'

const confirm = useConfirm()
const toast = useToast()

const tabs = ref([
  { label: '所有窗口', id: '1000', name: 'profiles' },
  { label: '回收站', icon: 'base/rx_ic_bin_2', id: '1001', name: 'recycle' },
])

const sortTabs = computed({
  get() {
    return tabs.value.length > 2 ? tabs.value.slice(1, -1) : []
  },
  set(value: any) {
    tabs.value.splice(1, tabs.value.length - 2, ...value)
  },
})

const active = ref(tabs.value[0].id)
const isRecycle = computed(() => active.value === '1001')
const currentFilter = computed(() => tabs.value.find((tab: any) => tab.id === active.value))

async function getFilterList() {
  const { data } = await API.window.userGetWindowFilterNameListList()
  const list = data.map((item, index: number) => ({ ...item, label: item.filter_name, icon: '', id: `${index}`, name: item.filter_name }))

  if (tabs.value.length > 2) {
    tabs.value = tabs.value.filter((tab: any) => ['1000', '1001'].includes(tab.id))
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
              <RxSvgIcon v-if="item.icon" :name="item.icon" />
              <span>{{ item.label }}</span>
            </div>
          </Tab>
        </TabList>
      </Tabs>
      <div @click="showPopover">
        <RxSvgIcon name="base/rx_ic_gear" class="cursor-pointer" />
      </div>
    </div>
    <div class="flex flex-1 overflow-hidden">
      <recycle v-if="isRecycle" />
      <div v-show="!isRecycle" class="flex-1 overflow-hidden">
        <profiles :current-filter="currentFilter" @update-filter-tabs="updateFilterTabs" />
      </div>
    </div>
  </div>

  <ryPopover ref="popRef" @hide="hidePopover">
    <!-- <div class="scvr-item">
      <RxSvgIcon name="base/rx_ic_dots" class="invisible" />
      <span>所有窗口</span>
    </div> -->
    <VueDraggable v-model="sortTabs" :animation="150">
      <div v-for="item in sortTabs" :key="item.id" class="scvr-item">
        <RxSvgIcon name="base/rx_ic_dots" class="cursor-grab handle" />
        <span class="flex-auto">{{ item.label }}</span>
        <RxSvgIcon name="base/rx_ic_edit" class="cursor-pointer" />
        <RxSvgIcon name="base/rx_ic_bin_1" class="cursor-pointer" @click="deleteFilterItem(item.label)" />
      </div>
    </VueDraggable>
    <!-- <div class="scvr-item">
      <RxSvgIcon name="base/rx_ic_dots" class="invisible" />
      <span>回收站</span>
    </div> -->
    <template #footer>
      <div class="reset">
        Reset to default
      </div>
    </template>
  </ryPopover>
</template>

<style scoped lang="scss">
.scvr-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-lg, 8px) var(--spacing-md, 6px);
  gap: var(--spacing-lg, 8px);
  min-width: 260px;
  color: var(--Color-neutrals-900, #171c1f);
  font-family: Inter;
  font-size: 13px;
  line-height: normal;
}

.reset {
  width: 100%;
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  color: var(--Component-Colors-Buttons-Secondary-text, #171c1f);
  text-align: right;
  font-family: Inter;
  font-size: var(--Font-Size-text-sm, 12px);
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
