<!-- eslint-disable ts/ban-ts-comment -->
<script lang="ts" setup>
// @ts-ignore
import ryButton from '/@/components/ry-button'
import simplePopup from './inputs-popup.vue'
import { useDialog } from 'primevue/usedialog'
import { format } from 'date-fns'
import { sleep } from '/@/utils'

interface FilterItem {
  label: string
  name: string
  value: string | string[]
  original: any
}

const _props = defineProps({
  ctmFilters: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
})

const emit = defineEmits(['update:list', 'filterChange', 'saveFilters'])

const filterList = defineModel<FilterItem[]>('list')

const dialog = useDialog()

const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')

const options = ref([
  {
    name: 'windowName',
    label: '窗口名称',
    icon: 'mdi mdi-ab-testing',
  },
  {
    label: '窗口序号',
    name: 'sortNums',
    icon: 'mdi mdi-abacus',
  },
  {
    separator: true,
  },
  {
    label: '操作系统',
    name: 'osList',
    icon: 'mdi mdi-abjad-arabic',
    children: ($dict_map.os || []).map((item: any) => ({
      parentLabel: '操作系统',
      parentName: 'osList',
      type: 'Checkbox',
      value: item.value,
      label: item.label,
    })),
  },
  {
    name: 'platformUrlIds',
    label: '#@账号平台(多选)',
    icon: 'mdi mdi-abjad-hebrew',
  },
  {
    separator: true,
  },
  {
    aliasName: 'statusOpen',
    name: 'openStatus',
    label: '窗口打开',
    icon: 'mdi mdi-home-group',
  },
  {
    aliasName: 'statusClose',
    name: 'openStatus',
    label: '窗口关闭',
    icon: 'mdi mdi-home-group',
  },
  {
    separator: true,
  },
  {
    name: 'groupIds',
    label: '#@窗口分组(多选)',
    icon: 'mdi mdi-access-point-check',
  },
  {
    name: 'labelIds',
    label: '#@窗口标签(多选)',
    icon: 'mdi mdi-tag-heart-outline',
  },
  {
    separator: true,
  },
  {
    name: 'isOften',
    label: '窗口收藏',
    icon: 'mdi mdi-bookmark-music-outline',
  },
  {
    label: '窗口备注',
    name: 'windowRemark',
    icon: 'mdi mdi-clipboard-list-outline',
  },
  {
    separator: true,
  },
  {
    name: 'proxyProtocoList',
    label: '代理协议',
    icon: 'mdi mdi-alarm-check',
    children: ($dict_map.protocol || []).map((item: any) => ({
      parentLabel: '代理协议',
      parentName: 'proxyProtocoList',
      type: 'Checkbox',
      value: item.value,
      label: item.label,
    })),
  },
  {
    aliasName: 'statusSuccess',
    name: 'proxyTestStatus',
    label: '检测成功的代理',
    icon: 'mdi mdi-clipboard-edit-outline',
  },
  {
    aliasName: 'statusFailure',
    name: 'proxyTestStatus',
    label: '检测失败的代理',
    icon: 'mdi mdi-account-card-outline',
  },
  {
    separator: true,
  },
  {
    name: 'createTime',
    label: '窗口创建时间',
    icon: 'mdi mdi-delete-empty-outline',
  },
])

const menuRef = ref()
const isChildren = ref(false)
const menuOptions = ref(options.value)
const selectedCategories = ref<string[]>([])

function operationHandler(item: any) {
  const name = item.aliasName || item.name

  switch (name) {
    case 'windowName':
      inputPopup({
        title: '窗口名称',
        inputs: [
          {
            type: 'text',
            placeholder: '请输入窗口名称',
            name: 'windowName',
            value: '',
            required: true,
          },
        ],
      })
      break
    case 'sortNums':
      inputPopup({
        title: '窗口序号',
        inputs: [
          {
            type: 'text',
            placeholder: '请输入窗口序号',
            name: 'sortNums',
            value: '',
            required: true,
          },
        ],
      })
      break
    case 'osList':
      openChild(item)
      break
    case 'platformUrlIds':
      openChild(item)
      break
    case 'statusOpen':
      onSwitch(item, true)
      break
    case 'statusClose':
      onSwitch(item, false)
      break
    case 'groupIds':
      break
    case 'labelIds':
      break
    case 'isOften':
      onSwitch(item)
      break
    case 'windowRemark':
      inputPopup({
        title: '窗口备注',
        inputs: [
          {
            type: 'textarea',
            placeholder: '请输入窗口备注',
            name: 'windowRemark',
            value: '',
            required: true,
          },
        ],
      })
      break
    case 'proxyProtocoList':
      openChild(item)
      break
    case 'statusSuccess':
      onSwitch(item, 1)
      break
    case 'statusFailure':
      onSwitch(item, 2)
      break
    case 'createTime':
      inputPopup({
        title: '窗口创建时间',
        inputs: [
          {
            type: 'date',
            items: [
              {
                placeholder: '请选择开始时间',
                name: 'startDate',
                required: true,
                formatValue: (self: any) => {
                  return format(self.value, 'yyyy-MM-dd')
                },
              },
              {
                placeholder: '请选择结束时间',
                name: 'endDate',
                required: true,
                formatValue: (self: any) => {
                  return format(self.value, 'yyyy-MM-dd')
                },
              },
            ],
          },
        ],
        formatValue(formData: any) {
          return Object.values(formData).join('~')
        },
      })
      break
  }
}

function show(event: any) {
  menuRef.value.show(event)
}

function inputPopup(data: any) {
  menuRef.value.hide()
  dialog.open(simplePopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data,
    emits: {
      onSave: ([formData, close]: [any, () => void]) => {
        const [[name, value]] = Object.entries(formData)
        deleteFilterByName(name)
        filterList.value!.push({
          label: data.title,
          name,
          value: data.formatValue ? data.formatValue(formData) : value,
          original: formData,
        })
        emit('filterChange')
        close()
      },
    },
  })
}

function onSwitch(item: any, value: any = true) {
  deleteFilterByName(item.name)
  filterList.value!.push({
    label: item.label,
    name: item.name,
    value,
    original: { [item.name]: value },
  })
  menuRef.value.hide()
  emit('filterChange')
}

function openChild(item: any) {
  if (item.children) {
    sleep(20).then(() => {
      isChildren.value = true
      menuOptions.value = item.children

      const selected = filterList.value!.find(it => it.name === item.name)
      selectedCategories.value = Array.isArray(selected?.value) ? selected.value : []
    })
    return
  }
  menuRef.value.hide()
}

function onHide() {
  if (isChildren.value) {
    selectedCategories.value = []
    sleep(20).then(() => {
      isChildren.value = false
      menuOptions.value = options.value
      emit('filterChange')
    })
  }
}

function onChange(item: any) {
  deleteFilterByName(item.parentName)

  if (selectedCategories.value.length > 0) {
    filterList.value!.push({
      label: item.parentLabel,
      name: item.parentName,
      value: selectedCategories.value,
      original: { [item.parentName]: selectedCategories.value },
    })
  }
}

function deleteFilterByName(name: string) {
  const index = filterList.value!.findIndex((item: any) => item.name === name)
  if (index >= 0) {
    filterList.value!.splice(index, 1)
  }
}

function deleteFilter(index: number) {
  filterList.value!.splice(index, 1)
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
      title: 'save filter',
      inputs: [
        {
          type: 'text',
          placeholder: 'filter name...',
          name: 'filter_name',
          required: true,
        },
      ],
    },
    emits: {
      onSave: ([formData, close]: [any, () => void]) => {
        emit('saveFilters', formData)
        close()
      },
    },
  })
}
</script>

<template>
  <div class="flex gap-2 filter-list">
    <div v-for="(item, index) in filterList" :key="index" class="filter-item">
      <span class="mdi mdi-close cursor-pointer filter-item-icon" @click="deleteFilter(index)" />
      <span class="select-none">{{ item.label }}:</span>
      <span class="cursor-pointer">{{ item.value }}</span>
    </div>

    <ryButton class="filter-button" text @click="show($event)">
      <span class="mdi mdi-filter-variant" />
      <span v-if="!filterList!.length">Add filters</span>
    </ryButton>
    <ryButton>clear</ryButton>
    <ryButton @click="saveFilters">
      save filter
    </ryButton>
  </div>
  <TieredMenu ref="menuRef" :model="menuOptions" popup
    :pt="{ separator: 'browser-separator', menu: { transition: 'browser-content' } }" @hide="onHide">
    <template #item="{ item, props }">
      <a v-ripple class="cursor-pointer !p-0" v-bind="props.action">
        <label v-if="item.type" class="cursor-pointer browser-item" :for="item.value" @click.stop>
          <!-- <RadioButton v-if="item.type === 'RadioButton'" v-model="selectedCategories.value" :input-id="item.name"
            :name="item.parentName" :value="item" @click.stop @change="change" /> -->
          <Checkbox v-if="item.type === 'Checkbox'" v-model="selectedCategories" :name="item.parentName"
            :input-id="item.value" :value="item.value" @click.stop @change="() => onChange(item)" />
          <span>{{ item.label }}</span>
        </label>
        <div v-else class="browser-item" @click.stop="operationHandler(item)">
          <span :class="item.icon" />
          <span>{{ item.label }}</span>
        </div>
      </a>
    </template>
  </TieredMenu>
</template>

<style lang="scss">
.browser {
  &-content {
    padding: var(--spacing-md, 6px) var(--spacing-sm, 4px) !important;
  }

  &-separator {
    margin: var(--spacing-md, 6px) 0;
  }

  &-item {
    display: flex;
    align-items: center;
    padding: 8px var(--spacing-md, 6px) 8px 10px !important;
    gap: var(--spacing-md, 6px) !important;
    width: 100%;
  }
}
</style>

<style lang="scss" scoped>
.filter-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm, 4px) 8px var(--spacing-sm, 4px) 10px;
  gap: var(--spacing-sm, 4px);
  border-radius: var(--radius-full, 9999px);
  border: 0.5px solid var(--Colors-Border-border-action-secondary, #c7cdd1);
  background: var(--Colors-Background-bg-body-hover, #f0f3f5);

  color: var(--Colors-Text-text-action-secondary, #171c1f);
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);

  &-icon {
    font-size: 14px;
  }
}

.filter-button {
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  gap: var(--spacing-sm, 4px);
  color: var(--Component-Colors-Buttons-Secondary-text-hover, #0e1214);
  font-family: Inter;
  font-size: var(--Font-Size-text-sm, 12px);
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
