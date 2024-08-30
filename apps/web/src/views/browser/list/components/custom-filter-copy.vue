<script setup>
import { sleep } from '/@/utils/'

const _props = defineProps({
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
    default: () => [
      {

      },
    ],
  },
})
const menuRef = ref()
const meun = reactive({
  targetEvent: null,
  isChidren: false,
  rowOptions: _props.options,
  options: _props.options,
  selectedCategories: [],
})

const _list = ref([
  // {
  //   type: 'Checkbox',
  //   key: 'chindren1',
  //   name: '选择1',
  //   icon: 'mdi mdi-earth',
  // },
  // {
  //   type: 'Checkbox',
  //   key: 'chindren2',
  //   name: '选择2',
  //   icon: 'mdi mdi-earth',
  // },
])

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
  _list.value.push(item)
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
      _list.value.push(item)
    }
    meun.selectedCategories = []

    sleep(20).then(() => {
      meun.isChidren = false
      meun.options = _props.options
    })
  }
}
</script>

<template>
  <div class="flex gap-2 filter-list">
    <div v-for="item in _list" :key="item.key" class="flex items-center cursor-pointer">
      <span />
      <span>{{ item.name }}</span>
    </div>
    <Button class="create-filter" text @click="show($event)">
      <span class="mdi mdi-filter-variant" />
      <span v-if="!_list.length">Add filters</span>
    </Button>
  </div>
  <TieredMenu id="overlay_tmenu" ref="menuRef" :model="meun.options" popup
    :pt="{ separator: 'browser-separator', menu: { transition: 'browser-menu-transition' } }" @hide="onHide">
    <template #item="{ item, props }">
      <a v-ripple class="cursor-pointer browser-filter-item" v-bind="props.action">
        <template v-if="item.type">

          <RadioButton v-if="item.type === 'RadioButton'" v-model="meun.selectedCategories" :input-id="item.key"
            :name="item.prentKey" :value="item" @click.stop />
          <Checkbox v-if="item.type === 'Checkbox'" v-model="meun.selectedCategories" :name="item.prentKey"
            :input-id="item.key" :value="item" @click.stop />
          <label class="w-full" :for="item.key" @click.stop>{{ item.name }}</label>

        </template>
        <template v-else>
          <div class="w-full" @click.stop="onClick(item)">
            <span :class="item.icon" />
            <span>{{ item.name }}</span>
          </div>
        </template>
      </a>
    </template>
  </TieredMenu>
</template>

<style lang="scss">
.browser {
  &-menu-transition {
    padding: var(--spacing-md, 6px) var(--spacing-sm, 4px) !important;
  }

  &-separator {
    margin: var(--spacing-md, 6px) 0;
  }

  &-filter-item {
    padding: 8px var(--spacing-md, 6px) 8px 10px !important;
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
