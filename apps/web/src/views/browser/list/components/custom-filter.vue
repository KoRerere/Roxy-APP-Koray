<script setup>
import { sleep } from '/@/utils/'

defineProps({
  options: {
    type: Array,
    default: () => [
      {
        key: 'scvr',
        name: '多选',
        icon: 'mdi mdi-earth',
        chindren: [
          {
            prentKey: 'scvr',
            type: 'Checkbox',
            key: 'multi1',
            name: '子项1',
            icon: 'mdi mdi-earth',
          },
          {
            prentKey: 'scvr',
            type: 'Checkbox',
            key: 'multi2',
            name: '子项2',
            icon: 'mdi mdi-earth',
          },
        ],
      },
      {
        key: 'search2',
        name: '单选',
        icon: 'mdi mdi-earth',
        chindren: [
          {
            prentKey: 'search2',
            type: 'RadioButton',
            key: 'one1',
            name: '儿子1',
            icon: 'mdi mdi-earth',
          },
          {
            prentKey: 'search2',
            type: 'RadioButton',
            key: 'one2',
            name: '儿子2',
            icon: 'mdi mdi-earth',
          },
        ],
      },
      {
        separator: true,
      },
      {
        key: 'h2o',
        name: '水',
        icon: 'mdi mdi-earth',
      },
      {
        separator: true,
      },
      {
        key: 'scc',
        name: '啊啊啊',
        icon: 'mdi mdi-earth',
      },
    ],
  },
  list: {
    type: Array,
    default: () => [],
  },
})

const options = [
  {
    name: 'windowName',
    label: '#@窗口名称(文本输入弹窗)',
    icon: 'mdi mdi-ab-testing',
  },
  {
    name: 'id',
    label: '#@窗口ID(数字输入弹窗)',
    icon: 'mdi mdi-abacus',
  },
  {
    separator: true,
  },
  {
    name: 'osList',
    label: '#@操作系统(多选)',
    icon: 'mdi mdi-abjad-arabic',
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
    name: 'openStatus',
    label: '#@窗口状态(单选)',
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
    label: '#@窗口收藏(true/false)',
    icon: 'mdi mdi-bookmark-music-outline',
  },
  {
    name: 'windowRemark',
    label: '#@窗口备注(文本输入弹窗)',
    icon: 'mdi mdi-clipboard-list-outline',
  },
  {
    separator: true,
  },
  {
    name: 'proxyProtocoList',
    label: '#@代理协议(多选)',
    icon: 'mdi mdi-alarm-check',
  },
  {
    name: 'proxyTestStatus',
    label: '#@检测成功的代理(1)', // 一个字段，需要单独处理
    icon: 'mdi mdi-clipboard-edit-outline',
  },
  {
    name: 'proxyTestStatus',
    label: '#@检测失败的代理(2)',
    icon: 'mdi mdi-account-card-outline',
  },
  {
    separator: true,
  },
  {
    name: 'createTime', // startDate endDate
    label: '#@窗口创建时间(时间范围弹窗)', // 时间范围弹窗
    icon: 'mdi mdi-delete-empty-outline',
  },
]

const menuRef = ref()
const meun = reactive({
  targetEvent: null,
  isChidren: false,
  options,
  rowOptions: options,
  selectedCategories: [],
})

const filterList = ref([])

function show (event) {
  meun.targetEvent = event
  menuRef.value.show(event)
}

function onClick (item) {
  if (item.chindren) {
    sleep(20).then(() => {
      meun.isChidren = true
      meun.options = item.chindren
    })
    return
  }
  filterList.value.push(item)
  menuRef.value.hide()
}

function onHide () {
  if (meun.isChidren) {
    const selected = [].concat(meun.selectedCategories)[0]
    if (selected) {
      const { type, prentKey } = selected
      const item = type === 'RadioButton'
        ? selected
        : meun.rowOptions.find(item => item.key === prentKey)
      filterList.value.push(item)
    }
    meun.selectedCategories = []

    sleep(20).then(() => {
      meun.isChidren = false
      meun.options = options
    })
  }
}
</script>

<template>
  <div class="flex gap-2 filter-list">
    <div v-for="item in filterList" :key="item.key" class="flex items-center cursor-pointer">
      <span />
      <span>{{ item.name }}</span>
    </div>
    <Button class="create-filter" text @click="show($event)">
      <span class="mdi mdi-filter-variant" />
      <span v-if="!filterList.length">Add filters</span>
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
          <div class="w-full flex items-center browser-gap" @click.stop="onClick(item)">
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
.create-filter {
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
