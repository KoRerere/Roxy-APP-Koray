<script lang="ts" setup>
import { useDialog } from 'primevue/usedialog'
import { format } from 'date-fns'
import { useVModel } from '@vueuse/core'
import simplePopup from './inputs-popup.vue'

const props = defineProps({
  options: {
    type: Array,
    default: () => [],
  },
  list: {
    type: Array,
    default: () => [],
  },
})

const emits = defineEmits(['update:list'])
const scvrlist: any = useVModel(props, 'list', emits)

const dialog = useDialog()

const options = ref([
  {
    name: 'windowName',
    label: '窗口名称',
    icon: 'mdi mdi-ab-testing',
    command: () => {
      inputPopup({
        title: '窗口名称',
        multiple: true,
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
    },
  },
  {
    label: '窗口ID',
    name: 'windowIds',
    icon: 'mdi mdi-abacus',
    command: () => {
      inputPopup({
        title: '窗口ID',
        multiple: true,
        inputs: [
          {
            type: 'text',
            placeholder: '请输入窗口ID',
            name: 'windowIds',
            value: '',
            required: true,
          },
        ],
      })
    },
  },
  {
    separator: true,
  },
  {
    name: 'osList',
    label: '#@操作系统(多选)',
    icon: 'mdi mdi-abjad-arabic',
    command: () => {
      console.log('🚀 ~ commond:')
    },
  },
  {
    name: 'platformUrlIds',
    label: '#@账号平台(多选)',
    icon: 'mdi mdi-abjad-hebrew',
    command: () => {
      console.log('🚀 ~ commond:')
    },
  },
  {
    separator: true,
  },
  {
    name: 'openStatus',
    label: '#@窗口状态(单选)',
    icon: 'mdi mdi-home-group',
    command: () => {
      console.log('🚀 ~ commond:')
    },
  },
  {
    separator: true,
  },
  {
    name: 'groupIds',
    label: '#@窗口分组(多选)',
    icon: 'mdi mdi-access-point-check',
    command: () => {
      console.log('🚀 ~ commond:')
    },
  },
  {
    name: 'labelIds',
    label: '#@窗口标签(多选)',
    icon: 'mdi mdi-tag-heart-outline',
    command: () => {
      console.log('🚀 ~ commond:')
    },
  },
  {
    separator: true,
  },
  {
    name: 'isOften',
    label: '#@窗口收藏(true/false)',
    icon: 'mdi mdi-bookmark-music-outline',
    command: () => {
      console.log('🚀 ~ commond:')
    },
  },
  {
    label: '窗口备注',
    name: 'windowRemark',
    icon: 'mdi mdi-clipboard-list-outline',
    command: () => {
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
    },
  },
  {
    separator: true,
  },
  {
    name: 'proxyProtocoList',
    label: '#@代理协议(多选)',
    icon: 'mdi mdi-alarm-check',
    command: () => {
      console.log('🚀 ~ commond:')
    },
  },
  {
    name: 'proxyTestStatus',
    label: '#@检测成功的代理(1)', // 一个字段，需要单独处理
    icon: 'mdi mdi-clipboard-edit-outline',
    command: () => {
      console.log('🚀 ~ commond:')
    },
  },
  {
    name: 'proxyTestStatus',
    label: '#@检测失败的代理(2)',
    icon: 'mdi mdi-account-card-outline',
    command: () => {
      console.log('🚀 ~ commond:')
    },
  },
  {
    separator: true,
  },
  {
    name: 'createTime',
    label: '窗口创建时间',
    icon: 'mdi mdi-delete-empty-outline',
    command: () => {
      inputPopup({
        title: '窗口创建时间',
        inputs: [
          {
            type: 'date',
            items: [
              {
                placeholder: '请选择开始时间',
                name: 'startDate',
                value: null,
                formatValue: (self: any) => {
                  return format(self.value, 'yyyy-MM-dd')
                },
              },
              {
                placeholder: '请选择结束时间',
                name: 'endDate',
                value: null,
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
    },
  },
])

const menuRef = ref()
const meun = reactive({
  targetEvent: null,
  isChidren: false,
  options: options.value,
  rowOptions: options.value,
  selectedCategories: [],
})

function show(event: any) {
  meun.targetEvent = event
  menuRef.value.show(event)
}

function inputPopup(data: any) {
  dialog.open(simplePopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data,
    emits: {
      onSave: ([formData, close]: [string, () => void]) => {
        const [[name, value]] = Object.entries(formData)
        if (!data.multiple) {
          deleteFilterByName(name)
        }

        scvrlist.value.push({
          multiple: !!data.multiple,
          label: data.title,
          name,
          value: data.formatValue ? data.formatValue(formData) : value,
          original: formData,
        })
        close()
      },
    },
  })
}

// function onClick (item) {
//   if (item.chindren) {
//     sleep(20).then(() => {
//       meun.isChidren = true
//       meun.options = item.chindren
//     })
//     return
//   }
//   scvrlist.value.push(item)
//   menuRef.value.hide()
// }

function onHide() {
  // if (meun.isChidren) {
  //   const selected = [].concat(meun.selectedCategories)[0]
  //   if (selected) {
  //     const { type, prentKey } = selected
  //     const item = type === 'RadioButton'
  //       ? selected
  //       : meun.rowOptions.find(item => item.key === prentKey)
  //     scvrlist.value.push(item)
  //   }
  //   meun.selectedCategories = []

  //   sleep(20).then(() => {
  //     meun.isChidren = false
  //     meun.options = options
  //   })
  // }
}

function deleteFilterByName(name: string) {
  const index = scvrlist.value.findIndex((item: any) => item.name === name)
  if (index >= 0) {
    deleteFilter(index)
  }
}

function deleteFilter(index: number) {
  scvrlist.value.splice(index, 1)
}
</script>

<template>
  <div class="flex gap-2 filter-list">
    <div v-for="(item, index) in scvrlist" :key="index" class="filter-item">
      <span class="mdi mdi-close cursor-pointer filter-item-icon" @click="deleteFilter(index)" />
      <span class="select-none">{{ item.label }}:</span>
      <span class="cursor-pointer">{{ item.value }}</span>
    </div>

    <Button class="filter-button" text @click="show($event)">
      <span class="mdi mdi-filter-variant" />
      <span v-if="!scvrlist.length">Add filters</span>
    </Button>
  </div>
  <TieredMenu id="overlay_tmenu" ref="menuRef" :model="meun.options" popup
    :pt="{ separator: 'browser-separator', menu: { transition: 'browser-content' } }" @hide="onHide">
    <template #item="{ item, props }">
      <a v-ripple class="cursor-pointer browser-item" v-bind="props.action">
        <template v-if="item.type">
          <RadioButton v-if="item.type === 'RadioButton'" v-model="meun.selectedCategories" :input-id="item.key"
            :name="item.prentKey" :value="item" @click.stop />
          <Checkbox v-if="item.type === 'Checkbox'" v-model="meun.selectedCategories" :name="item.prentKey"
            :input-id="item.key" :value="item" @click.stop />
          <label class="w-full" :for="item.key" @click.stop>{{ item.label }}</label>
        </template>
        <template v-else>
          <div class="w-full flex items-center browser-gap">
            <span :class="item.icon" />
            <span>{{ item.label }}</span>
          </div>
        </template>
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
    padding: 8px var(--spacing-md, 6px) 8px 10px !important;
    gap: var(--spacing-md, 6px) !important;
  }

  &-gap {
    gap: var(--spacing-md, 6px) !important;
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

<!-- "filter_name": "test1",      # 标签页名称
"filter_condition": [        # 标签页查询条件
    {
      "platform": "macOS2222222"
    },
    {
      "windowIds": [1,2,3,4]
    },
    {
      "windowName":'asdads'
    },
    {
      "startTime": "2022-01-01"
    },
    {
      "endTime": "2022-06-01"
    }
],
"sort": 1000    # 标签页排序字段
} -->
