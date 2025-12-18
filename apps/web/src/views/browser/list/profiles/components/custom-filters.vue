<script lang="tsx" setup>
import GuideModal from '/@/views/tutorial/components/guide-modal.vue'
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import RxAvatar from '/@/components/rx-avatar'
import Fuse from 'fuse.js'
import { format } from 'date-fns'
import { useDebounceFn } from '@vueuse/core'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'
import { useDialog } from '/@/hooks/useDialog'
import { deepClone, findInputByName, isEmptyValue, isLikeFunction, setInputFieldByInputKey, setInputValueByFormData, sleep } from '/@/utils'
import { useSimpleDialog } from '/@/components/simplePopup'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'
import type { SvgNames } from '/@/components/rx-icon/'
import { usePreventMask } from '/@/hooks/usePreventMask'

interface Props {
  currentFilter?: Record<string, any>
  filtersMenu?: any[]
  enabledFilterSave?: boolean
  videoUrl?: string
  saveFilters?: (params: any) => Promise<void> | void
}

const { currentFilter, filtersMenu = [], enabledFilterSave, videoUrl, saveFilters } = defineProps<Props>()
const emit = defineEmits(['filterChange'])

const [showModal] = useDialog()
const { showSimpleDialog } = useSimpleDialog()
const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()
const { userPayInfo } = storeToRefs(useUserStore())
const { showPreventMask, hidePreventMask } = usePreventMask()

const menuRef = useTemplateRef('tmenu')
const fuse = ref()
const search = ref()
const isAllProfiles = ref(true)
const isChanged = ref(false)
const isChildren = ref(false)
const childrenChanged = ref(false)
const subMenuOptions = ref()
const selectedCategories = ref()
const splitButtonItems = [
  {
    label: $t('保存为新筛选器'),
    command: () => {
      onSaveFilters()
    },
  },
]

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

watch(() => currentFilter?.id, (value) => {
  isChanged.value = false
  isAllProfiles.value = value === 'rx_1000'
})

function showMenu(event: any) {
  if (videoUrl && userPayInfo.value.onboardingTaskStatus?.saveFilterGuideStatus === false) {
    onShowGuideModal()
    return
  }

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
  const { type, name, label, value, icon, ...props } = deepClone(data)
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
    // 20ms 延迟非异步 getOptions()
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
  hidePreventMask()
}

function deleteFilterItem(item: any) {
  setInputFieldByInputKey(filtersMenu, item.name, 'value', null)
  onFilterChange()
}

function resetFilters() {
  const condition = currentFilter?.filter_condition || {}
  const params = {
    ...condition,
    createTime: Array.isArray(condition.createTime) ? [new Date(condition.createTime[0]), new Date(condition.createTime[1])] : undefined,
    modfiyTime: Array.isArray(condition.modfiyTime) ? [new Date(condition.modfiyTime[0]), new Date(condition.modfiyTime[1])] : undefined,
  }

  filtersMenu.forEach((item) => {
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

function onShowGuideModal() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    handleCancel: () => updateOnboardingTaskStatus({ saveFilterGuideStatus: true }),
    slots: {
      container: ({ hideModal }) => (
        <GuideModal
          title={$t('高级筛选')}
          desc={({ class: className }) => {
            return (
              <div class={className}>
                {$t('希望快速通过条件定位相应窗口？试试"高级筛选"功能，其亦可被保存为常驻"分组"！')}
                {' '}
              </div>
            )
          }}
          video={videoUrl}
          onClose={hideModal}
          onConfirm={hideModal}
        >
        </GuideModal>
      ),
    },
  })
}

function onSaveFilters() {
  showSimpleDialog({
    title: $t('保存筛选器'),
    inputs: [
      {
        type: 'text',
        name: 'filter_name',
        props: {
          placeholder: $t('请输入筛选器名称'),
        },
        resolver: (z: any) => z.string({
          invalid_type_error: $t('请输入筛选器名称'),
        }).min(1, $t('请输入筛选器名称')),
      },
    ],
    onConfirm: (formData: any) => {
      saveFilters?.(formData)
    },
  })
}

async function modifyFilter() {
  await saveFilters?.(currentFilter)
  isChanged.value = false
}
</script>

<template>
  <div class="flex flex-1 justify-between">
    <div class="flex flex-1 items-center flex-wrap mr-2 gap-2">
      <div v-for="(item, index) in labels" :key="index" class="labels-item">
        <SvgIcon class="cursor-pointer" :size="14" name="base/rx_ic_delete" @click.stop="deleteFilterItem(item)" />
        <span class="select-none">{{ item.label }}:</span>
        <span class="cursor-pointer">{{ item._text || item.value }}</span>
      </div>
      <RxButton severity="secondary" size="xxs" text icon="base/rx_ic_filter" :label="!labels.length ? $t('筛选条件') : ''" :disabled="currentFilter?.disabledFilter" @click="showMenu" />
    </div>
    <div v-show="enabledFilterSave && isChanged" class="flex items-start">
      <div class="labels-actions">
        <RxButton text severity="secondary" size="xxs" :label="$t('重置')" @click="resetFilters" />
        <template v-if="labels.length">
          <RxButton v-if="isAllProfiles" size="xxs" :label="$t('保存')" @click="onSaveFilters" />
          <SplitButton v-else :label="$t('保存')" :model="splitButtonItems" @click="modifyFilter" />
        </template>
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
    gap: var(--spacing-sm, 4px);
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
