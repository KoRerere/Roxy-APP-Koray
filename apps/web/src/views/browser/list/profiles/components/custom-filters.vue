<!-- eslint-disable ts/ban-ts-comment -->
<script lang="ts" setup>
import { useDialog } from 'primevue/usedialog'
import RxAvatar from '/@/components/rx-avatar.vue'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import simplePopup from '/@/components/simplePopup'
import { deepClone, isEmptyValue, isLikeFunction, setInputFieldByInputKey, sleep } from '/@/utils'

const _props = defineProps({
  currentFilter: {
    type: Object as PropType<any>,
    default: undefined,
  },
  filtersMenu: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  enabledFilterSave: {
    type: Boolean,
    default: true,
  },
  saveFilters: {
    type: Function as PropType<(params: any) => void>,
    default: () => { },
  },
})

const emit = defineEmits(['filterChange'])
const dialog = useDialog()

const isAllProfiles = ref(true)
const isChanged = ref(false)

watch(() => _props.currentFilter?.id, (value) => {
  isChanged.value = false
  isAllProfiles.value = value === '1000'
})

const rawOptions = computed(() => {
  return _props.filtersMenu
    .map((item) => {
      if (item.type === 'switchGroup' && Array.isArray(item.options) && item.options.length > 0) {
        return item.options.map((it: any) => ({ ...it, parentName: item.name, type: item.type }))
      }
      return item
    })
    .flat()
})

const filterTagList = computed(() => {
  return _props.filtersMenu.reduce((acc, item) => {
    if (!isEmptyValue(item.value)) {
      const value = !Array.isArray(item.value)
        ? item.value
        : item._options?.filter((option: any) => item.value.includes(option.value)).map((option: any) => option.label).join(', ')
      acc.push({ ...toRaw(item), value })
    }
    return acc
  }, [])
})

const splitButtonItems = [
  {
    label: 'Save As',
    command: () => {
      saveFilters()
    },
  },
]
const menuRef = useTemplateRef('tmenu')
const isChildren = ref(false)
const subMenuOptions = ref()
const menuOptions = computed(() => isChildren.value ? subMenuOptions.value : rawOptions.value)
const selectedCategories = ref([])

function showMenu(event: any) {
  menuRef.value?.show(event)
}

function operationHandler(item: any) {
  switch (item.type) {
    case 'text':
    case 'number':
    case 'textarea':
    case 'date':
      inputPopup(item)
      break
    case 'switch':
      onSwitch(item)
      break
    case 'switchGroup':
      onRadioChose(item)
      break
    case 'Checkbox':
      openCheckbox(item)
      break
  }
}

function inputPopup(data: any) {
  menuRef.value?.hide()
  dialog.open(simplePopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        inputs: [deepClone(data)],
      },
      onConfirm: async (formData: any) => {
        if (data.type === 'date') {
          const value = Object.values(formData).join('~')
          setInputFieldByInputKey(_props.filtersMenu, data.name, 'value', value)// 用于筛选标签展示
        }
        Object.entries(formData).forEach(([name, value]) => {
          setInputFieldByInputKey(_props.filtersMenu, name, 'value', value)
        })
        onFilterChange()
      },
    },
  })
}

function onRadioChose(item: any) {
  setInputFieldByInputKey(_props.filtersMenu, item.parentName, 'value', item.value)
  menuRef.value?.hide()
  onFilterChange()
}

function onSwitch(item: any, value: any = true) {
  item.value = value
  menuRef.value?.hide()
  onFilterChange()
}

async function openCheckbox(item: any) {
  if (isLikeFunction(item.getOptions)) {
    // 20ms 延迟非异步 getOptions()
    const [options] = await Promise.all([item.getOptions(), sleep(20)])
    item._options = options
    isChildren.value = true
    subMenuOptions.value = item._options
    selectedCategories.value = item.value
    return
  }
  menuRef.value?.hide()
}

function onHide() {
  if (isChildren.value) { // 二级 checkbox 菜单隐藏触发
    selectedCategories.value = []
    sleep(20).then(() => {
      isChildren.value = false
      onFilterChange()
    })
  }
}

function onChange(item: any) {
  _props.filtersMenu.find(input => input.name === item.parentName).value = toRaw(selectedCategories.value)
}

function deleteFilterItem(item: any) {
  const names = item.type !== 'date' ? item.name : [item.name, item.items.map((it: any) => it.name)].flat()
  setInputFieldByInputKey(_props.filtersMenu, names, 'value', null)
  onFilterChange()
}

function resetFilters() {
  const condition = _props.currentFilter.filter_condition || {}
  const params = {
    ...condition,
    createTime: condition.startDate && condition.endDate ? [condition.startDate, condition.endDate].join('~') : undefined,
  }

  _props.filtersMenu.forEach((item) => {
    item.value = params[item.name]
    if (Array.isArray(item.items)) {
      item.items.forEach((it: any) => it.value = params[item.name])
    }
  })
  isChanged.value = false
  emit('filterChange')
}

function onFilterChange() {
  if (isAllProfiles.value) {
    isChanged.value = filterTagList.value.length > 0
  }
  else {
    isChanged.value = true
  }

  emit('filterChange')
}

function saveFilters() {
  dialog.open(simplePopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        title: 'Save filter',
        inputs: [
          {
            type: 'text',
            placeholder: 'filter name...',
            name: 'filter_name',
            required: true,
          },
        ],
      },
      onConfirm: (formData: any) => {
        _props.saveFilters(formData)
      },
    },
  })
}

async function modifyFilter() {
  await _props.saveFilters(_props.currentFilter)
  isChanged.value = false
}
</script>

<template>
  <div class="flex flex-1 justify-between filter">
    <div class="flex flex-1 filter-list">
      <div v-for="(item, index) in filterTagList" :key="index" class="filter-list-item">
        <RxSvgIcon class="cursor-pointer" :size="14" name="base/rx_ic_delete" @click.stop="deleteFilterItem(item)" />
        <span class="select-none">{{ item.label }}:</span>
        <span class="cursor-pointer">{{ item.value }}</span>
      </div>
      <RxButton class="filter-list-button" text @click="showMenu">
        <RxSvgIcon name="base/rx_ic_filter" />
        <span v-if="!filterTagList.length">Add filters</span>
      </RxButton>
    </div>
    <div v-show="enabledFilterSave && isChanged" class="filter-actions">
      <RxButton text severity="secondary" size="sm" label="Reset" @click="resetFilters" />
      <template v-if="filterTagList.length">
        <RxButton v-if="isAllProfiles" severity="info" size="sm" label="Save" @click="saveFilters" />
        <SplitButton v-else severity="info" size="small" label="Save" :model="splitButtonItems" @click="modifyFilter" />
      </template>
      <div>|</div>
    </div>
  </div>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <TieredMenu ref="tmenu" :model="menuOptions" popup :pt="{ root: classes.content, separator: classes.separator, menu: { transition: classes.list } }" @hide="onHide">
    <template #item="{ item, props }">
      <a v-ripple class="cursor-pointer !p-0" v-bind="props.action">
        <label v-if="isChildren" class="cursor-pointer" :class="classes.item" :for="item.value" @click.stop>
          <Checkbox v-model="selectedCategories" :name="item.parentName" :input-id="item.value" :value="item.value" @change="onChange(item)" />
          <RxAvatar v-if="item.value.startsWith('u_')" :avatar="item.avatar" :name="(item.label as string)?.slice(0, 2)" :color="item.avatarColor" :size="24" :font-size="12" />
          <span v-else>{{ item.label }}</span>
        </label>
        <div v-else :class="classes.item" @click.stop="operationHandler(item)">
          <RxSvgIcon v-if="item.icon" :name="(item.icon as SvgNames)" />
          <span>{{ item.label }}</span>
        </div>
      </a>
    </template>
  </TieredMenu>
</template>

<style lang="scss" module="classes">
.content {
  max-height: 500px;
  overflow-y: auto;
}

.list {
  padding: var(--spacing-md, 6px) var(--spacing-sm, 4px) !important;
}

.separator {
  margin: var(--spacing-md, 6px) 0;
}

.item {
  display: flex;
  align-items: center;
  padding: 8px var(--spacing-md, 6px) 8px 10px !important;
  gap: var(--spacing-md, 6px) !important;
  width: 100%;
}
</style>

<style lang="scss" scoped>
.filter {
  &-list {
    display: flex;
    align-items: center;
    margin-right: var(--spacing-lg, 8px);
    gap: var(--spacing-lg, 8px);

    &-item {
      display: flex;
      align-items: center;
      padding: var(--spacing-sm, 4px) 8px var(--spacing-sm, 4px) 10px;
      gap: var(--spacing-sm, 4px);
      height: 24px;
      color: var(--Colors-Text-text-action-secondary, #171c1f);
      font-family: Inter;
      font-size: 12px;
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
      border-radius: var(--radius-full, 9999px);
      border: 0.5px solid var(--Colors-Border-border-action-secondary, #c7cdd1);
    }

    &-button {
      padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
      gap: var(--spacing-sm, 4px);
      color: var(--Component-Colors-Buttons-Secondary-text-hover, #0e1214);
      font-family: Inter;
      font-size: var(--Font-Size-text-sm, 12px);
      font-style: normal;
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
    }
  }

  &-actions {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-right: var(--spacing-md, 6px);
    gap: var(--spacing-md, 6px);
    color: var(--Colors-Border-border-container, #c7cdd1);
  }
}
</style>
