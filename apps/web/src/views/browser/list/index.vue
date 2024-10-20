<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { VueDraggable } from 'vue-draggable-plus'
import { API } from '/@/api'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
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

const allProfiles = { label: $t('All Profiles'), id: '1000', name: 'profiles' }
const trash = { label: $t('Trash'), icon: 'base/rx_ic_bin_2', id: '1001', name: 'trash' }

const tabs = ref([allProfiles])

const sortTabs = computed({
  get() {
    return tabs.value.length > 1 ? tabs.value.slice(1) : []
  },
  set(value: any) {
    tabs.value.splice(1, tabs.value.length - 1, ...value)
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
    tabs.value = [allProfiles, ...list]
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
        title: 'Edit filter',
        inputs: [
          {
            type: 'text',
            placeholder: 'filter name...',
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
    header: $t('Are you sure to delete the views you selected?'),
    message: $t('Don\'t worry, your profiles won\'t be delete.'),
    rejectProps: {
      label: $t('Cancel'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('Confirm'),
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
      header: $t('Manage Category'),
      modal: true,
      style: { width: '70vw', height: '50vh' },
    },
  })
}

const popRef = ref()
function showPopover(event: Event) {
  popRef.value.getRef().show(event)
}

async function hidePopover() {
  const sort_data = tabs.value.slice(1).map((item: any, index) => ({ name: item.label, sort: index }))
  const { code, msg } = await API.window.userUpdateWindowFilterSortCreate({ sort_data })
  onlyErrorToast(code, msg)
}

onBeforeMount(() => {
  getFilterList()
})
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <div class="profile-header">
      <div>{{ $t('All Profiles') }}</div>
      <div v-if="!role.isViewer" v-ripple class="cursor-pointer profile-header-manage" @click="openManageCategory">
        <RxSvgIcon name="base/rx_ic_group" />
        <div> {{ $t('Manage Category') }}</div>
      </div>
    </div>
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
      <div class="cursor-pointer filter-tabs-trash" :class="{ active: isRecycle }" @click="active = trash.id">
        <RxSvgIcon name="base/rx_ic_bin_2" />
        <span>{{ $t('Trash') }}</span>
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
    <div class="sort-item">
      <RxSvgIcon name="base/rx_ic_dots" class="invisible" />
      <span>{{ allProfiles.label }}</span>
    </div>
    <VueDraggable v-model="sortTabs" :animation="150">
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
.profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);

  color: #000;
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: var(--Line-Height-text-xl, 24px);

  &-manage {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
    gap: var(--spacing-sm, 4px);

    color: var(--Component-Colors-Buttons-Secondary-text, #171c1f);
    font-size: var(--Font-Size-text-sm, 12px);
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

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
  }

  &-trash {
    display: flex;
    align-items: center;
    flex: 1;
    margin: 0 var(--spacing-2xl, 16px);
    padding: var(--spacing-md, 6px) var(--spacing-lg, 8px);
    gap: var(--spacing-md, 6px);
    color: var(--Colors-Text-text-secondary, #575d61);
    font-family: Inter;
    font-size: var(--Font-Size-text-sm, 12px);
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);

    &.active {
      color: var(--p-tabs-tab-active-color);
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
