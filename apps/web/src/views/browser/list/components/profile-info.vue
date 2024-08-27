<script setup>
import { useContextMenu } from '/@/hooks/useContextMenu'

const _props = defineProps({
  platformInfo: {
    type: Array,
    default: () => [],
  },
  data: {
    type: Object,
    default: () => ({}),
  },
})
// icon: new URL(`/@/assets/image/hk.svg`, import.meta.url).href,

// const menuRef = ref(null)
const [show] = useContextMenu()

const proxyOperation = computed(() => {
  const isDirect = _props.data.proxyCategory === 'noproxy'

  return [
    {
      label: 'Add proxy',
      hide: !isDirect,
      command: () => {

      },
    },
    {
      label: 'Select proxy',
      hide: !isDirect,
      command: () => {

      },
    },
    {
      label: 'Test proxy',
      hide: isDirect,
      command: () => {

      },
    },
    {
      label: 'Refresh IP',
      hide: isDirect,
      command: () => {

      },
    },
    {
      hide: isDirect,
      separator: true,
    },
    {
      label: 'Edit proxy',
      hide: isDirect,
      command: () => {

      },
    },
    {
      label: 'Change proxy',
      hide: isDirect,
      command: () => {

      },
    },
    {
      hide: isDirect,
      separator: true,
    },
    {
      label: 'Delete',
      hide: isDirect,
      command: () => {

      },
    },
  ].filter(item => !item.hide)
})

const accountOperation = computed(() => {
  // const isDirect = _props.data.proxyCategory === 'noproxy'
  return [
    {
      label: 'Add account',
      command: () => {

      },
    },
    {
      label: 'Select account',
      command: () => {

      },
    },
    {
      separator: true,
    },
    {
      label: 'Delete',
      command: () => {

      },
    },
  ].filter(item => !item.hide)
})

const links = ref([
  {
    icon: _props.data.platformIcon,
    classes: '',
    tooltip: `System: ${_props.data.os} ${_props.data.osVersion}\nKernel: Chrome ${_props.data.coreVersion}`,
  },
  {
    icon: _props.data.platformIcon,
    classes: 'direct',
    create: true,
    tooltip: `Location: ${_props.data.lastCountry}\nIP: ${_props.data.lastIp}\nLast time: ${_props.data.updateTime}`,
    onClick: (event) => {
      show(event, {
        model: proxyOperation.value,
      })
    },
  },
  {
    icon: _props.data.platformIcon,
    classes: 'stack',
    tooltip: '',
    onClick: (event) => {
      show(event, {
        model: accountOperation.value,
      })
    },
  },
])
</script>

<template>
  <div class="flex h-full items-center profile">
    <div>{{ data.windowSortNum }}</div>
    <div class="flex justify-between state">
      <div v-for="(item, index) in links" :key="index" v-tooltip.top="item.tooltip"
        class="flex-cc cursor-pointer state-icons" :class="item.classes" @click="item.onClick">
        <img class="state-icons-img" :src="item.icon">
      </div>
    </div>
    <div>{{ data.windowName }}</div>
  </div>
</template>

<style lang="scss" scoped>
$box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02),
  0px 1px 1px 0px rgba(0, 0, 0, 0.06);

.profile {
  gap: var(--spacing-xl, 12px);
}

.state {
  width: 104px;

  &-icons {
    position: relative;
    padding: 3px;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 0.5px solid var(--Colors-Border-border-action-secondary, #c7cdd1);
    background: var(--Colors-Background-bg-action-secondary, #fff);
    box-shadow: $box-shadow;

    &-img {
      width: 100%;
      height: 100%;
    }
  }
}

.stack {
  position: relative;
  width: 20px;
  height: 20px;
  transform-style: preserve-3d;

  &::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 100%;
    height: 100%;
    border-radius: 4px;
    border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
    background: var(--Colors-Background-bg-inactive, #fafbfc);
    box-shadow: $box-shadow;
    transform: translateZ(-1px);
  }
}

.direct {
  transform: scale(0.7);
}
</style>
