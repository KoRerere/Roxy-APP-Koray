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

const confirm = useConfirm()
const dialog = useDialog()
const role = useRoleStore()
const [showToast, onlyErrorToast] = useResponseToast()

const rawTabs = [
  { label: $t('全部窗口'), id: '1000', name: 'profiles' },
  { label: $t('收藏'), id: '1002', name: 'favorite', _params: { isOften: true }, disabledFilter: true },
  { label: $t('已打开'), id: '1003', name: 'opened', _params: { openStatus: true }, disabledFilter: true },
]
const trash = { label: $t('回收站'), icon: 'base/rx_ic_bin_2', id: '1001', name: 'trash' }

const tabs = ref(rawTabs)

const sortTabs = computed({
  get() {
    return tabs.value.length > rawTabs.length ? tabs.value.slice(rawTabs.length) : []
  },
  set(value: any) {
    tabs.value.splice(rawTabs.length, tabs.value.length - rawTabs.length, ...value)
  },
})

const active = ref(tabs.value[0].id)
const isRecycle = computed(() => active.value === trash.id)
const currentFilter = computed(() => tabs.value.find((tab: any) => tab.id === active.value))

async function getFilterList() {
  const { code, data, msg } = await API.window.userGetWindowFilterNameListList()
  if (code === 0) {
    const list = data.map((item, index) => ({
      ...item,
      id: `${index}`,
      name: item.filter_name,
      label: item.filter_name,
    }))
    tabs.value = [...rawTabs, ...list]
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
        const isActive = currentFilter.value?.label === item.label
        if (isActive) {
          updateFilterTabs()
        }
        else {
          tabs.value = tabs.value.filter((tab: any) => tab.label !== item.label)
        }
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

const popRef = ref()
const hasSort = ref(false)
function showPopover(event: Event) {
  popRef.value.getRef().show(event)
}

function sortChange() {
  hasSort.value = true
}

async function hidePopover() {
  if (hasSort.value) {
    hasSort.value = false
    const sort_data = tabs.value.slice(rawTabs.length).map((item: any, index) => ({ name: item.label, sort: index }))
    const { code, msg } = await API.window.userUpdateWindowFilterSortCreate({ sort_data })
    onlyErrorToast(code, msg)
  }
}

onBeforeMount(() => {
  getFilterList()
})
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <ViewsHeader :title="($route.meta.title as string)">
      <RxButton v-if="!role.isViewer" size="xxs" text severity="secondary" icon="base/rx_ic_group" :label="$t('标签管理')" @click="openManageCategory" />
    </ViewsHeader>
    <div class="flex items-center justify-between filter-tabs">
      <Tabs v-model:value="active" class="overflow-hidden" scrollable>
        <TabList>
          <Tab v-for="item in tabs" :key="item.label" :value="item.id">
            <div class="flex items-center text-inherit">
              {{ item.label }}
            </div>
          </Tab>
        </TabList>
      </Tabs>
      <div class="inline-flex justify-start flex-1">
        <div class="flex items-center cursor-pointer filter-tabs-trash" :class="{ active: isRecycle }" @click="active = trash.id">
          <RxSvgIcon name="base/rx_ic_bin_2" />
          <span>{{ $t('回收站') }}</span>
        </div>
      </div>
      <div class="cursor-pointer filter-tabs-settings" @click="showPopover">
        <RxSvgIcon name="base/rx_ic_gear" />
      </div>
    </div>
    <div class="flex flex-1 overflow-hidden">
      <recycle v-if="isRecycle" />
      <div v-show="!isRecycle" class="flex-1 overflow-hidden">
        <profiles :current-filter="currentFilter" @update-filter-tabs="updateFilterTabs" />
      </div>
    </div>
  </div>

  <RyPopover ref="popRef" @hide="hidePopover">
    <div v-for="item in rawTabs" :key="item.name" class="sort-item">
      <RxSvgIcon name="base/rx_ic_dots" class="invisible" />
      <span>{{ item.label }}</span>
    </div>
    <VueDraggable v-model="sortTabs" :animation="150" @change="sortChange">
      <div v-for="item in sortTabs" :key="item.id" class="sort-item">
        <RxSvgIcon name="base/rx_ic_dots" class="cursor-grab handle" />
        <span class="flex-auto">{{ item.label }}</span>
        <RxSvgIcon name="base/rx_ic_edit" class="cursor-pointer" @click="onEditFilter(item)" />
        <RxSvgIcon name="base/rx_ic_bin_1" class="cursor-pointer" @click="deleteFilterItem(item)" />
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
  font-family: Inter;
  font-size: 13px;
  line-height: normal;
}

.filter-tabs {
  padding: 0px var(--spacing-4xl, 24px);
  border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);

  :deep(.p-tablist-tab-list) {
    gap: var(--spacing-2xl, 16px);
    border-color: transparent;

    .p-tab {
      padding: var(--spacing-md, 6px) var(--spacing-lg, 8px);
      color: var(--Colors-Text-text-secondary, #575d61);
      font-family: Inter;
      font-size: var(--Font-Size-text-sm, 12px);
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
      border-color: transparent;

      &:not(.p-tab-active):not(.p-disabled):hover {
        border-color: transparent;
      }
    }

    .p-tab-active {
      color: var(--Colors-Text-text-brand, #12a3fc);
    }

    .p-tablist-active-bar {
      height: 2px;
    }
  }

  &-trash {
    margin: 0 var(--spacing-2xl, 16px);
    padding: var(--spacing-md, 6px) var(--spacing-lg, 8px);
    gap: var(--spacing-md, 6px);
    color: var(--Colors-Text-text-secondary, #575d61);
    font-family: Inter;
    font-size: var(--Font-Size-text-sm, 12px);
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);

    &.active {
      position: relative;
      color: var(--p-tabs-tab-active-color);

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

  &-settings {
    display: flex;
    padding: var(--spacing-sm, 4px);
    border-radius: 4px;
    background: var(--Component-Colors-Buttons-Secondary-bg, #fff);
    color: var(--Colors-Text-text-secondary, #575d61);
  }
}
</style>
