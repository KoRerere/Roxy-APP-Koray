<script lang="tsx" setup>
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import RxAvatar from '/@/components/rx-avatar'
import Fuse from 'fuse.js'
import { format } from 'date-fns'
import { useDebounceFn } from '@vueuse/core'
import { deepClone, findInputByName, isEmptyValue, isLikeFunction, setInputFieldByInputKey, setInputValueByFormData, sleep } from '/@/utils'
import { useSimpleDialog } from '/@/components/simplePopup'
import type { SvgNames } from '/@/components/rx-icon/'
import { usePreventMask } from '/@/hooks/usePreventMask'

interface Props {
  filtersMenu?: any[]
}

const { filtersMenu = [] } = defineProps<Props>()
const emit = defineEmits(['filterChange'])

const { showSimpleDialog } = useSimpleDialog()
const { showPreventMask, hidePreventMask } = usePreventMask()

const menuRef = useTemplateRef('tmenu')
const fuse = ref()
const search = ref()
const isChildren = ref(false)
const childrenChanged = ref(false)
const subMenuOptions = ref()
const selectedCategories = ref()

const rawOptions = computed(() => {
  return filtersMenu.map((item) => {
    if (item.type === 'switchGroup' && Array.isArray(item.options) && item.options.length > 0) {
      return item.options.map((it: any) => ({ ...it, parentName: item.name, type: item.type }))
    }
    return item
  }).flat()
})
const menuOptions = computed(() => isChildren.value ? subMenuOptions.value : rawOptions.value)

const labels = computed(() => {
  return filtersMenu.reduce((acc, item) => {
    if (!isEmptyValue(item.value)) {
      const value = !Array.isArray(item.value)
        ? item.value
        : item.type === 'date'
          ? item.value.map((value: Date) => format(new Date(value), 'yyyy-MM-dd')).join(' ~ ')
          : item.value.map((it: any) => it.label).join(', ')
      acc.push({ ...toRaw(item), value, _text: item._text })
    }
    return acc
  }, [])
})

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
  const { type, name, label, value, icon: _, ...props } = deepClone(data)
  showSimpleDialog({
    inputs: [{ type, name, label, value, props }],
    onConfirm: (formData: any) => {
      setInputValueByFormData(filtersMenu, formData)
      onFilterChange()
    },
  })
}

const onSearch = useDebounceFn(() => {
  const list = fuse.value?.search(search.value).map((res: any) => toRaw(res.item))
  subMenuOptions.value = [subMenuOptions.value[0], ...(search.value ? list : fuse.value._docs)]
}, 300)

function onRadioChose(item: any) {
  const menuItem = findInputByName(filtersMenu, item.parentName)
  if (menuItem) {
    Reflect.set(menuItem, 'value', item.value)
    Reflect.set(menuItem, '_text', item.text)
  }
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
    const [options] = await Promise.all([item.getOptions(), sleep(20)])
    item._options = options
    isChildren.value = true
    selectedCategories.value = item.value?.map((it: any) => it.value)

    if (isEmptyValue(options)) {
      subMenuOptions.value = [{ empty: true, text: `${$t('暂无')} ${item.label}` }]
      return
    }

    if (!item.search) {
      subMenuOptions.value = item._options
    }
    else {
      subMenuOptions.value = [{ search: true, placeholder: item.searchPlaceholder }, ...item._options]
      fuse.value = new Fuse(item._options, { threshold: 0.3, keys: item.searchKeys || ['label'] })
    }
    return
  }
  menuRef.value?.hide()
}

function onCheckboxChange(item: any) {
  childrenChanged.value = true
  const list = menuOptions.value.filter((item: any) => selectedCategories.value.includes(item.value)).map((item: any) => toRaw(item))
  filtersMenu.find(input => input.name === item.parentName).value = list
}

function onHide() {
  if (isChildren.value) {
    selectedCategories.value = []
    sleep(20).then(() => {
      isChildren.value = false
      if (childrenChanged.value) {
        onFilterChange()
        childrenChanged.value = false
      }
    })
  }
  hidePreventMask()
}

function deleteFilterItem(item: any) {
  setInputFieldByInputKey(filtersMenu, item.name, 'value', null)
  onFilterChange()
}

function resetFilters() {
  filtersMenu.forEach((item) => {
    item.value = undefined
    if (Array.isArray(item.items)) {
      item.items.forEach((it: any) => it.value = undefined)
    }
  })
  emit('filterChange')
}

function onFilterChange() {
  emit('filterChange')
}
</script>

<template>
  <div class="flex flex-1 justify-between">
    <div class="flex flex-1 items-center flex-wrap mr-2 gap-2">
      <div v-for="(item, index) in labels" :key="index" class="labels-item">
        <SvgIcon class="mr-1 cursor-pointer" :size="14" name="base/rx_ic_delete" @click.stop="deleteFilterItem(item)" />
        <span class="select-none">{{ item.label }}</span>
        <span v-if="item.type !== 'switch'" class="cursor-pointer">: {{ item._text || item.value }}</span>
      </div>
      <RxButton severity="secondary" size="xxs" text icon="base/rx_ic_filter" :label="!labels.length ? $t('筛选条件') : ''" @click="showMenu" />
    </div>
    <div v-show="labels.length" class="flex items-start">
      <div class="labels-actions">
        <RxButton text severity="secondary" size="xxs" :label="$t('重置')" @click="resetFilters" />
        <div>|</div>
      </div>
    </div>
  </div>
  <TieredMenu ref="tmenu" popup :model="menuOptions" :pt="{ root: classes.content, separator: classes.separator, menu: { transition: classes.list } }" @hide="onHide" @show="showPreventMask">
    <template #item="{ item, props }">
      <div v-if="item.empty" class="max-w-60 cursor-pointer text-3.25" :class="classes.item">
        {{ item.text }}
      </div>
      <a v-else v-ripple class="max-w-60 cursor-pointer !p-0" v-bind="props.action">
        <template v-if="isChildren">
          <div v-if="item.search" class="w-full" @click.stop>
            <TsFormInputText v-model="search" class="w-full" :placeholder="item.placeholder" @input="onSearch" />
          </div>
          <label v-else class="cursor-pointer" :class="classes.item" :for="item.value" @click.stop>
            <RxCheckbox v-model="selectedCategories" :name="item.parentName" :input-id="item.value" :value="item.value" @change="onCheckboxChange(item)" />
            <div v-if="item.value.startsWith('u_')" class="flex items-center gap-2">
              <RxAvatar :avatar="item.avatar" :name="(item.label as string)?.slice(0, 2)" :color="item.avatarColor" :size="24" :font-size="12" />
              <span class="text-3.25">{{ item.label }}</span>
            </div>
            <span v-else class="ellipsis-1 text-3.25" :title="(item.label as string)">{{ item.label }}</span>
          </label>
        </template>
        <div v-else :class="classes.item" @click.stop="operationHandler(item)">
          <SvgIcon v-if="item.icon" :name="(item.icon as SvgNames)" />
          <span class="text-3.25">{{ item.label }}</span>
        </div>
      </a>
    </template>
  </TieredMenu>
</template>

<style lang="scss" module="classes">
.content {
  max-height: 500px;
  overflow-y: auto;
  border-width: 0.5px;
}

.list {
  padding: 6px 4px !important;
}

.separator {
  margin: var(--spacing-md, 6px) 0;
}

.item {
  display: flex;
  align-items: center;
  padding: 8px 6px 8px 10px !important;
  gap: 6px !important;
  width: 100%;
}
</style>

<style lang="scss" scoped>
.labels {
  &-item {
    display: flex;
    align-items: center;
    padding: var(--spacing-sm, 4px) 8px var(--spacing-sm, 4px) 10px;
    height: 24px;
    color: var(--colors-text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
    border-radius: var(--radius-full, 9999px);
    border: 0.5px solid var(--colors-border-border-base, #c7cdd1);
  }

  &-actions {
    display: flex;
    align-items: center;
    margin-right: var(--spacing-md, 6px);
    gap: var(--spacing-md, 6px);
    color: var(--colors-border-border-base, #c7cdd1);
  }
}
</style>
