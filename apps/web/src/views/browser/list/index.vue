<script setup lang="ts">
import Tags from '/@/views/browser/list/tags'
import Profiles from '/@/views/browser/list/profiles'
import Recycle from '/@/views/browser/list/recycle'
import Transfer from '/@/views/browser/list/transfer'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import { I18nT } from "vue-i18n"
import { debounce } from 'es-toolkit'

import { API } from '/@/api'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from '/@/hooks/useDialog'
import { VueDraggable } from 'vue-draggable-plus'
import { useSimpleDialog } from '/@/components/simplePopup'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { switchWorkspaceAndToUpgradePlan } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useRoleStore } from '/@/stores/role'
import { sleep, safeParseJSON } from '/@/utils'
import { emitter } from '/@/utils/eventBus'

const confirm = useConfirm()
const [showDialog] = useDialog()
const route = useRoute()
const workspaceStore = useWorkspaceStore()
const role = useRoleStore()
const [_, onlyErrorToast] = useResponseToast()
const { showSimpleDialog } = useSimpleDialog()

type TabType = {
  id: string
  label: string
  name: string
  isLocal?: boolean
  [key: string]: any
}

const pinTabs: TabType[] = [
  { id: 'rx_1000', label: $t('全部窗口'), name: 'profiles' },
] as const

const rawTabs: TabType[] = [
  { id: 'rx_1002', label: $t('收藏'), name: 'favorite', _params: { isOften: true } },
  { id: 'rx_1003', label: $t('已打开'), name: 'opened', _params: { openStatus: true } },
] as const

const suffixTabs = computed(() => [
  { id: 'rx_1004', label: $t('投送中'), icon: 'base/rx_ic_transfer_solid', name: 'transfer', component: markRaw(Transfer), power: role.isOwner || role.isManager },
  { id: 'rx_1001', label: $t('回收站'), icon: 'base/rx_ic_bin_2', name: 'trash', component: markRaw(Recycle) },
].filter(item => item.power !== false))

const tabIdLangMap = {
  rx_1002: $t('收藏'),
  rx_1003: $t('已打开'),
} as Record<string, string>

const localTabKey = `localTabs_${workspaceStore.currentWorkspace?.id}`
const localTabs: TabType[] = safeParseJSON(localStorage.getItem(localTabKey)) || rawTabs.map(item => ({ ...item, sort: -1, isLocal: true, disabledFilter: true }))

localTabs.forEach(item => {
  if (tabIdLangMap[item.id]) {
    item.label = tabIdLangMap[item.id]!
  }
})

const tabListRef = useTemplateRef('tabList')
const configRef = useTemplateRef('config')
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
const active = ref(tabs.value[0]!.id)
const currentSuffixTab = computed(() => {
  const component = suffixTabs.value.find(item => item.id === active.value)?.component
  return { component, visible: !!component }
})
const currentFilter = computed(() => tabs.value.find((tab: any) => tab.id === active.value))

const updateInkBar = debounce(() => {
  // @ts-ignore - updateInkBar 方法存在但类型定义中缺失
  tabListRef.value?.updateInkBar()
}, 100)

watch(tabs, updateInkBar)

onBeforeMount(() => {
  // 提前跳转 suffixTabs 以解决切回全部窗口时，虚拟列表异常问题
  switchActiveTabByQuery(suffixTabs.value)
  nextTick(() => {
    getFilterTabs()
  })
})

async function getFilterTabs() {
  const { code, data, msg } = await API.window.userGetWindowFilterNameListList()
  if (code === 0) {
    const list = data.map((item, index) => ({
      ...item,
      id: `${index}`,
      name: item.filter_name,
      label: item.filter_name,
    })).concat(localTabs as any).sort((a, b) => a.sort - b.sort)
    tabs.value = [...pinTabs, ...list]
    switchActiveTabByQuery(tabs.value)

    setTimeout(() => {
      // TODO 等官方修复 https://github.com/primefaces/primevue/issues/6310
      // @ts-ignore - updateInkBar 方法存在但类型定义中缺失
      tabListRef.value?.updateInkBar()
    }, 1000)
  }
  onlyErrorToast(code, msg)
}

function switchActiveTabByQuery(list: TabType[]) {
  const routeActiveTab = list.find(tab => tab.id === route.query.activeTabId)
  if (routeActiveTab) {
    active.value = routeActiveTab.id
  }
}

async function switchTab(tabId: string, event?: Event) {
  if (tabId === 'rx_1004') {
    const { code } = await API.pay.userCheckTeamUserRightsList()
    if (code !== 0) {
      if (!role.isOwner) {
        emitter.emit('showToast', {
          severity: 'warn',
          summary: $t('窗口投送不可用'),
          detail: h(I18nT, {
            keypath: $t('窗口投送不可用，请联系空间的拥有者进行升级，或{link}以激活该跨空间功能。', { link: '{link}' }),
          }, {
            link: () => h('a', {
              class: 'cursor-pointer',
              onClick: switchWorkspaceAndToUpgradePlan,
            }, $t('前往升级您的权益'))
          }),
          life: 5000
        })
      } else {
        emitter.emit('showPayWall', {
          event: event as Event,
          params: {
            type: 'transfer',
          },
        })
      }
      return
    }
  }
  active.value = tabId
}

async function updateFilterTabs(isEdit: boolean = false) {
  await getFilterTabs()

  if (!isEdit) {
    active.value = tabs.value[tabs.value.length - 1]!.id
  }
}

async function onEditFilter(item: any) {

  showSimpleDialog({
    title: $t('编辑筛选器名称'),
    inputs: [
      {
        type: 'text',
        name: 'filter_name',
        value: item.label,
        props: {
          placeholder: $t('请输入筛选器名称'),
        },
        resolver: (z: any) => z.string({
          invalid_type_error: $t('请输入筛选器名称'),
        }).min(1, $t('请输入筛选器名称'))
      },
    ],
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
        onlyErrorToast(code, msg)
        if (code !== 0) return

        if (currentFilter.value?.label === item.label) {
          active.value = tabs.value[tabs.value.length - 2]!.id
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
  showDialog({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: ({ hideModal }) => h(Tags, {
        onClose: hideModal,
      }),
    }
  })
}

function showPopover(event: Event) {
  configRef.value?.show(event)
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
            <div class="flex items-center text-inherit font-[Inter]">{{ item.label }}</div>
          </Tab>
          <Tab class="!pa-0 opacity-0" v-for="suffixItem in suffixTabs" :key="suffixItem.id" :value="suffixItem.id">
          </Tab>
        </TabList>
      </Tabs>
      <div class="inline-flex justify-start flex-1 suffix">
        <div class="flex items-center cursor-pointer break-keep suffix-tab" v-for="suffixItem in suffixTabs" :key="suffixItem.id" :class="{ active: suffixItem.id === active }"
          @click="switchTab(suffixItem.id, $event)">
          <RxSvgIcon :name="(suffixItem.icon as SvgNames)" color="var(--colors-icon-icon-note)" />
          <span>{{ suffixItem.label }}</span>
        </div>
      </div>
      <RxButton text severity="secondary" size="xs" icon="base/rx_ic_gear" @click="showPopover"></RxButton>
      <div v-if="!role.isViewer">
        <Divider layout="vertical" class="!mx-[4px] h-[16px]" />
      </div>
      <RxButton v-if="!role.isViewer" v-tooltip.top="{ value: $t('标签管理') }" text severity="secondary" size="xs" icon="base/rx_ic_tag" @click="openManageCategory"></RxButton>
    </div>
    <div class="flex flex-1 overflow-hidden">
      <component v-if="currentSuffixTab.visible" :is="currentSuffixTab.component" />
      <div v-show="!currentSuffixTab.visible" class="flex-1 overflow-hidden">
        <Profiles :current-filter="currentFilter" @update-filter-tabs="updateFilterTabs" @switch-tab="switchTab" />
      </div>
    </div>
  </div>

  <RyPopover ref="config" @hide="hidePopover">
    <div v-for="item in pinTabs" :key="item.name" class="sort-item">
      <RxSvgIcon name="base/rx_ic_dots_drag" class="invisible" />
      <span>{{ item.label }}</span>
    </div>
    <VueDraggable v-model="sortTabs" :animation="150" @change="sortChange">
      <div v-for="item in sortTabs" :key="item.id" class="sort-item">
        <RxSvgIcon name="base/rx_ic_dots_drag" class="cursor-grab handle" />
        <span class="flex-auto">{{ item.label }}</span>
        <template v-if="!item.isLocal">
          <RxSvgIcon name="base/rx_ic_edit" class="cursor-pointer" @click="onEditFilter(item)" />
          <RxSvgIcon name="base/rx_ic_bin_1" class="cursor-pointer" @click="deleteFilterItem(item)" />
        </template>
      </div>
    </VueDraggable>
    <div class="sort-item" v-for="suffixItem in suffixTabs" :key="suffixItem.id">
      <RxSvgIcon name="base/rx_ic_dots_drag" class="invisible" />
      <span>{{ suffixItem.label }}</span>
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
  color: var(--colors-text-text-primary);
  font-size: 13px;
  line-height: normal;
}

.tabs {
  --tab-padding: 14px 8px;
  --tab-font-size: 12px;

  padding: 0px var(--spacing-4xl, 24px);
  border-bottom: 0.5px solid var(--colors-border-divider);

  :deep(.p-tablist-tab-list) {
    gap: var(--spacing-2xl, 16px);
    border-color: transparent;

    .p-tab {
      padding: var(--tab-padding);
      color: var(--colors-text-text-secondary, #b2b6b8);
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
      color: var(--colors-text-text-primary, #FAFAFA);
    }

    .p-tablist-active-bar {
      height: 2px;
    }
  }

  &:not(:has(.p-tablist-nav-button)) {
    .suffix {
      margin-left: -16px;
      z-index: 1;

      &:has(.suffix-tab + .suffix-tab) {
        .suffix-tab:first-of-type {
          padding-left: 0;
        }
      }
    }
  }
}

.suffix {
  gap: 16px;
  margin-right: 16px;

  &-tab {
    padding: var(--tab-padding);
    gap: var(--spacing-md, 6px);
    color: var(--colors-text-text-secondary, #b2b6b8);
    font-size: var(--tab-font-size);
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);

    &.active {
      position: relative;
      font-weight: 700;
      font-size: 14px;
      color: var(--colors-text-text-primary, #FAFAFA);

      &::before {
        content: '';
        position: absolute;
        left: 0;
        bottom: var(--tabs-active-bar-bottom);
        width: 100%;
        height: 2px;
        background: var(--tabs-active-bar-background);
        transition: 250ms cubic-bezier(0.35, 0, 0.25, 1);
        z-index: 1;
      }
    }
  }
}
</style>
