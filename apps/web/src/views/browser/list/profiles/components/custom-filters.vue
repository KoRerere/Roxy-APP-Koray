<!-- eslint-disable ts/ban-ts-comment -->
<script lang="ts" setup>
import { format } from 'date-fns'
import { useDialog } from 'primevue/usedialog'
import RxAvatar from '/@/components/rx-avatar'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import simplePopup from '/@/components/simplePopup'
import { $t } from '/@/locales'
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

const labels = computed(() => {
  return _props.filtersMenu.reduce((acc, item) => {
    if (!isEmptyValue(item.value)) {
      const value = !Array.isArray(item.value)
        ? item.value
        : item.type === 'date'
          ? item.value.map((value: Date) => format(new Date(value), 'yyyy-MM-dd')).join(' ~ ')
          : item.value.map((it: any) => it.label).join(', ')
      acc.push({ ...toRaw(item), value })
    }
    return acc
  }, [])
})

const splitButtonItems = [
  {
    label: $t('保存为新筛选器'),
    command: () => {
      saveFilters()
    },
  },
]
const menuRef = useTemplateRef('tmenu')
const isChildren = ref(false)
const childrenChanged = ref(false)
const subMenuOptions = ref()
const menuOptions = computed(() => isChildren.value ? subMenuOptions.value : rawOptions.value)
const selectedCategories = ref()

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
        inputs: [deepClone({ ...data, icon: undefined })],
      },
      onConfirm: async (formData: any) => {
        Object.entries(formData).forEach(([name, value]) => {
          if (data.type === 'date' && Array.isArray(value) && !value[1]) {
            value = [value[0], new Date()]
          }
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
    selectedCategories.value = item.value.map((it: any) => it.value)
    return
  }
  menuRef.value?.hide()
}

function onCheckboxChange(item: any) {
  childrenChanged.value = true
  const list = menuOptions.value.filter((item: any) => selectedCategories.value.includes(item.value)).map((item: any) => toRaw(item))
  _props.filtersMenu.find(input => input.name === item.parentName).value = list
}

function onHide() {
  if (isChildren.value) { // 二级 checkbox 菜单隐藏触发
    selectedCategories.value = []
    sleep(20).then(() => {
      isChildren.value = false
      if (childrenChanged.value) {
        onFilterChange()
        childrenChanged.value = false
      }
    })
  }
}

function deleteFilterItem(item: any) {
  setInputFieldByInputKey(_props.filtersMenu, item.name, 'value', null)
  onFilterChange()
}

function resetFilters() {
  const condition = _props.currentFilter?.filter_condition || {}
  const params = {
    ...condition,
    createTime: condition.startDate && condition.endDate ? [condition.startDate, condition.endDate].join('~') : undefined,
    updateDate: condition.startUpdateDate && condition.endUpdateDate ? [condition.startUpdateDate, condition.endUpdateDate].join('~') : undefined,
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
    isChanged.value = labels.value.length > 0
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
        title: $t('保存筛选器'),
        inputs: [
          {
            type: 'text',
            placeholder: $t('请输入筛选器名称'),
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
  <div class="flex flex-1 justify-between">
    <div class="flex flex-1 items-center flex-wrap mr-2 gap-2">
      <div v-for="(item, index) in labels" :key="index" class="labels-item">
        <RxSvgIcon class="cursor-pointer" :size="14" name="base/rx_ic_delete" @click.stop="deleteFilterItem(item)" />
        <span class="select-none">{{ item.label }}:</span>
        <span class="cursor-pointer">{{ item.value }}</span>
      </div>
      <RxButton severity="secondary" size="xxs" :disabled="currentFilter?.disabledFilter" text @click="showMenu">
        <RxSvgIcon name="base/rx_ic_filter" />
        <span v-if="!labels.length">{{ $t('筛选条件') }}</span>
      </RxButton>
    </div>
    <div v-show="enabledFilterSave && isChanged" class="labels-actions">
      <RxButton text severity="secondary" size="xxs" :label="$t('重置')" @click="resetFilters" />
      <template v-if="labels.length">
        <RxButton v-if="isAllProfiles" severity="info" size="xxs" :label="$t('保存')" @click="saveFilters" />
        <SplitButton v-else severity="info" :label="$t('保存')" :model="splitButtonItems" @click="modifyFilter" />
      </template>
      <div>|</div>
    </div>
  </div>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <TieredMenu ref="tmenu" :model="menuOptions" popup :pt="{ root: classes.content, separator: classes.separator, menu: { transition: classes.list } }" @hide="onHide">
    <template #item="{ item, props }">
      <a v-ripple class="cursor-pointer !p-0" v-bind="props.action">
        <label v-if="isChildren" class="cursor-pointer" :class="classes.item" :for="item.value" @click.stop>
          <Checkbox v-model="selectedCategories" :name="item.parentName" :input-id="item.value" :value="item.value" @change="onCheckboxChange(item)" />
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
.labels {
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

  &-actions {
    display: flex;
    justify-content: center;
    align-items: start;
    margin-right: var(--spacing-md, 6px);
    gap: var(--spacing-md, 6px);
    color: var(--Colors-Border-border-container, #c7cdd1);
  }
}

:deep(.p-splitbutton) {
  .p-button {
    padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
    font-size: var(--Font-Size-text-sm, 12px);
    line-height: var(--Line-Height-text-xs, 16px);
    border-width: 0.5px;

    &:not(:disabled):hover {
      border-width: 0.5px;
    }
  }

  .p-splitbutton-button {
    border-top-left-radius: var(--radius-sm, 4px);
    border-bottom-left-radius: var(--radius-sm, 4px);
  }

  .p-splitbutton-dropdown {
    border-top-right-radius: var(--radius-sm, 4px);
    border-bottom-right-radius: var(--radius-sm, 4px);
  }
}
</style>
