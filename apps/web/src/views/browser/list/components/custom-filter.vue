<script setup>
import { sleep } from '/@/utils/'

const _props = defineProps({
  filter: {
    type: Array,
    default: () => [
      {
        key: 'search',
        label: 'Search',
        icon: 'mdi mdi-earth',
      },
      {
        key: 'search2',
        label: 'Search2',
        icon: 'mdi mdi-earth',
        chindren: [
          {
            type: 'listBox',
            options: [
              {
                key: 'chindren1',
                label: 'chindren1',
                icon: 'mdi mdi-earth',
              },
              {
                key: 'chindren2',
                label: 'chindren2',
                icon: 'mdi mdi-earth',
              },
            ],
          },
        ],
      },
      {
        separator: true,
      },
      {
        key: 'h2o',
        label: 'H2o',
        icon: 'mdi mdi-earth',
      },
      {
        separator: true,
      },
      {
        key: 'scc',
        label: 'scc',
        icon: 'mdi mdi-earth',
      },
    ],
  },
})
const menuRef = ref()
const meun = reactive({
  targetEvent: null,
  isChidren: false,
  list: _props.filter,
})

function show(event) {
  meun.targetEvent = event
  menuRef.value.show(event)
}

function onClick(item) {
  if (item.chindren) {
    sleep(20).then(() => {
      meun.isChidren = true
      meun.list = item.chindren
    })
    return
  }

  if (meun.isChidren) {
    sleep(20).then(() => {
      meun.isChidren = false
      meun.list = _props.filter
    })
  }
  console.log('🚀 ~ onClick ~ item:', item)
  menuRef.value.hide()
}
</script>

<template>
  <div class="cursor-pointer add-filter" @click="show($event)">
    <span class="mdi mdi-account-alert" />
    <span>Add filters</span>
  </div>

  <TieredMenu id="overlay_tmenu" ref="menuRef" :model="meun.list" popup
              :pt="{ separator: 'browser-separator', menu: { transition: 'browser-menu-transition' } }"
  >
    <template #item="{ item, props }">
      <a v-ripple class="cursor-pointer browser-filter-item" v-bind="props.action" @click.stop="onClick(item)">
        <span :class="item.icon" />
        <span>{{ item.label }}</span>
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
.add-filter {
  display: flex;
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm, 4px);
  border-radius: var(--radius-sm, 4px);
  background: var(--Component-Colors-Buttons-Secondary-bg-inactive, #f0f3f5);

  color: var(--Component-Colors-Buttons-Secondary-text-hover, #0e1214);
  text-align: center;
  font-family: Inter;
  font-size: var(--Font-Size-text-sm, 12px);
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
