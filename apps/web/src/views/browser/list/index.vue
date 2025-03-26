<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { VueDraggable } from 'vue-draggable-plus'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import simplePopup from '/@/components/simplePopup'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import tags from '/@/views/browser/list/tags'
import profiles from './profiles'
import recycle from './recycle'
import { useWorkspaceStore } from '/@/stores/workspace'
import { sleep } from '/@/utils'
import { debounce } from 'es-toolkit'

const confirm = useConfirm()
const dialog = useDialog()
const route = useRoute()
const role = useRoleStore()
const workspaceStore = useWorkspaceStore()
const [showToast, onlyErrorToast] = useResponseToast()

type TabType = {
  id: string
  label: string
  name: string
  isLocal?: boolean
  [key: string]: any
}

const trash = { id: 'rx_1001', label: $t('回收站'), icon: 'base/rx_ic_bin_2', name: 'trash' }
const pinTabs = [
  { id: 'rx_1000', label: $t('全部窗口'), name: 'profiles' },
]

const tabIdLangMap = {
  rx_1002: $t('收藏'),
  rx_1003: $t('已打开'),
} as Record<string, string>

const rawTabs = [
  { id: 'rx_1002', label: $t('收藏'), name: 'favorite', _params: { isOften: true } },
  { id: 'rx_1003', label: $t('已打开'), name: 'opened', _params: { openStatus: true } },
]

const localTabKey = `localTabs_${workspaceStore.currentWorkspace?.id}`
const localTabs: TabType[] = JSON.parse(localStorage.getItem(localTabKey) || 'null') || rawTabs.map(item => ({ ...item, sort: -1, isLocal: true, disabledFilter: true }))

localTabs.forEach(item => {
  if (tabIdLangMap[item.id]) {
    item.label = tabIdLangMap[item.id]
  }
})

const tabListRef = useTemplateRef('tabList')
const popRef = useTemplateRef('popop')
const tabs = ref<TabType[]>(pinTabs)
const sortTabs = computed({
  get() {
    return tabs.value.length > pinTabs.length ? tabs.value.slice(pinTabs.length) : []
  },
  set(value: any) {
    tabs.value.splice(pinTabs.length, tabs.value.length - pinTabs.length, ...value)
  },
})
const hasSort = ref(false)
const active = ref(tabs.value[0].id)
const isRecycle = computed(() => active.value === trash.id)
const currentFilter = computed(() => tabs.value.find((tab: any) => tab.id === active.value))

const updateInkBar = debounce(() => {
  tabListRef.value?.updateInkBar()
}, 100)

watch(tabs, updateInkBar)

onBeforeMount(() => {
  getFilterList()
})

async function getFilterList() {
  const { code, data, msg } = await API.window.userGetWindowFilterNameListList()
  if (code === 0) {
    const list = data.map((item, index) => ({
      ...item,
      id: `${index}`,
      name: item.filter_name,
      label: item.filter_name,
    })).concat(localTabs as any).sort((a, b) => a.sort - b.sort)
    tabs.value = [...pinTabs, ...list]
    const routeActiveTab = tabs.value.find(tab => tab.id === route.query.activeTabId)

    if (routeActiveTab) {
      active.value = routeActiveTab.id
    }

    setTimeout(() => {
      // TODO 等官方修复 https://github.com/primefaces/primevue/issues/6310
      tabListRef.value?.updateInkBar()
    }, 1000)
  }
  onlyErrorToast(code, msg)
}

async function updateFilterTabs(isEdit: boolean = false) {
  await getFilterList()

  if (!isEdit) {
    active.value = tabs.value[tabs.value.length - 1].id
  }
}

async function onEditFilter(item: any) {
  dialog.open(simplePopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        title: $t('编辑筛选器名称'),
        inputs: [
          {
            type: 'text',
            placeholder: $t('请输入筛选器名称'),
            name: 'filter_name',
            required: true,
            value: item.label,
          },
        ],
      },
      onConfirm: async (formData: any) => {
        const { code, msg } = await API.window.userUpdateWindowFilterNameCreate({
          ...item,
          old_filter_name: item.filter_name,
          new_filter_name: formData.filter_name,
        })
        if (code === 0) {
          item.name = formData.filter_name
          item.label = formData.filter_name
        }
        onlyErrorToast(code, msg)
      },
    },
  })
}

async function deleteFilterItem(item: any) {
  confirm.require({
    header: $t('删除筛选器'),
    message: $t('您确认要删除所选筛选器吗？'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: async () => {
      try {
        const { code, msg } = await API.window.userDeleteWindowFilterNameCreate({ filter_name: item.label })
        showToast(code, msg)

        if (currentFilter.value?.label === item.label) {
          active.value = tabs.value[tabs.value.length - 2].id
          await sleep(300)// 等待 tab 切换动画执行完毕以解决塌陷问题
        }
        tabs.value = tabs.value.filter((tab: any) => tab.label !== item.label)
      }
      catch (error) {
        onlyErrorToast(-1, error as string)
      }
    },
  })
}

async function openManageCategory() {
  dialog.open(tags, {
    props: {
      header: $t('标签管理'),
      modal: true,
      style: { width: '70vw', height: '50vh' },
      pt: { content: 'flex-1' },
    },
  })
}

function showPopover(event: Event) {
  popRef.value?.getRef().show(event)
}

function sortChange() {
  hasSort.value = true
}

async function hidePopover() {
  if (hasSort.value) {
    hasSort.value = false
    const { locals, sort_data } = tabs.value.slice(pinTabs.length).reduce((acc, item, index) => {
      if (item.isLocal) {
        acc.locals.push({ ...item, sort: index })
      } else {
        acc.sort_data.push({ name: item.label, sort: index })
      }
      return acc
    }, { locals: [], sort_data: [] } as any)
    localStorage.setItem(localTabKey, JSON.stringify(locals))
    const { code, msg } = await API.window.userUpdateWindowFilterSortCreate({ sort_data })
    onlyErrorToast(code, msg)
  }
}
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex items-center justify-between tabs">
      <Tabs v-model:value="active" class="overflow-hidden" scrollable>
        <TabList ref="tabList">
          <Tab v-for="item in tabs" :key="item.id || item.label" :value="item.id">
            <div class="flex items-center text-inherit">
              {{ item.label }}
            </div>
          </Tab>
          <Tab class="!pa-0 opacity-0" :value="trash.id"></Tab>
        </TabList>
      </Tabs>
      <div class="inline-flex justify-start flex-1">
        <div class="flex items-center cursor-pointer break-keep tabs-trash" :class="{ active: isRecycle }" @click="active = trash.id">
          <RxSvgIcon name="base/rx_ic_bin_2" />
          <span>{{ $t('回收站') }}</span>
        </div>
      </div>
      <RxButton text severity="secondary" size="xs" icon="base/rx_ic_gear" @click="showPopover"></RxButton>
      <div v-if="!role.isViewer">
        <Divider layout="vertical" class="!mx-[4px] h-[16px]" />
      </div>
      <RxButton v-if="!role.isViewer" v-tooltip.top="{ value: $t('标签管理') }" text severity="secondary" size="xs" icon="base/rx_ic_tag" @click="openManageCategory"></RxButton>
    </div>
    <div class="flex flex-1 overflow-hidden">
      <recycle v-if="isRecycle" />
      <div v-show="!isRecycle" class="flex-1 overflow-hidden">
        <profiles :current-filter="currentFilter" @update-filter-tabs="updateFilterTabs" />
      </div>
    </div>
  </div>

  <RyPopover ref="popop" @hide="hidePopover">
    <div v-for="item in pinTabs" :key="item.name" class="sort-item">
      <RxSvgIcon name="base/rx_ic_dots" class="invisible" />
      <span>{{ item.label }}</span>
    </div>
    <VueDraggable v-model="sortTabs" :animation="150" @change="sortChange">
      <div v-for="item in sortTabs" :key="item.id" class="sort-item">
        <RxSvgIcon name="base/rx_ic_dots" class="cursor-grab handle" />
        <span class="flex-auto">{{ item.label }}</span>
        <template v-if="!item.isLocal">
          <RxSvgIcon name="base/rx_ic_edit" class="cursor-pointer" @click="onEditFilter(item)" />
          <RxSvgIcon name="base/rx_ic_bin_1" class="cursor-pointer" @click="deleteFilterItem(item)" />
        </template>
      </div>
    </VueDraggable>
    <div class="sort-item">
      <RxSvgIcon name="base/rx_ic_dots" class="invisible" />
      <span>{{ trash.label }}</span>
    </div>
  </RyPopover>
</template>

<style scoped lang="scss">
.sort-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-lg, 8px) var(--spacing-md, 6px);
  gap: var(--spacing-lg, 8px);
  min-width: 260px;
  color: var(--Color-neutrals-900, #171c1f);
  font-size: 13px;
  line-height: normal;
}

.tabs {
  --tab-padding: 14px 8px;
  --tab-font-size: 12px;

  padding: 0px var(--spacing-4xl, 24px);
  border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);

  :deep(.p-tablist-tab-list) {
    gap: var(--spacing-2xl, 16px);
    border-color: transparent;

    .p-tab {
      padding: var(--tab-padding);
      color: var(--Colors-Text-text-secondary, #575d61);
      font-size: var(--tab-font-size);
      font-weight: 400;
      line-height: var(--Line-Height-text-xs, 16px);
      border-color: transparent;

      &:not(.p-tab-active):not(.p-disabled):hover {
        border-color: transparent;
      }
    }

    .p-tab-active {
      font-weight: 700;
      font-size: 14px;
      color: var(--Colors-Text-text-primary, #171C1F);
    }

    .p-tablist-active-bar {
      height: 2px;
    }
  }

  &-trash {
    margin-right: 16px;
    padding: var(--tab-padding);
    gap: var(--spacing-md, 6px);
    color: var(--Colors-Text-text-secondary, #575d61);
    font-size: var(--tab-font-size);
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);

    svg {
      color: #C7CDD1;
    }

    &.active {
      position: relative;
      font-weight: 700;
      font-size: 14px;
      color: var(--Colors-Text-text-primary, #171C1F);

      &::before {
        content: '';
        position: absolute;
        left: 0;
        bottom: var(--p-tabs-active-bar-bottom);
        width: 100%;
        height: 2px;
        background: var(--p-tabs-active-bar-background);
        transition: 250ms cubic-bezier(0.35, 0, 0.25, 1);
        z-index: 1;
      }
    }
  }
}
</style>
