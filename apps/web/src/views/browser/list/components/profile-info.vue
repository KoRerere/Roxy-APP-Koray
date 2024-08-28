<script lang="ts" setup>
import { useContextMenu } from '/@/hooks/useContextMenu'
import { getImage } from '/@/utils'

const _props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})

const emits = defineEmits(['profileOperate'])

if (_props.data.windowSortNum === 27) {
  console.log('🚀 ~ data:', _props.data)
}

const [show] = useContextMenu()

const os_image = {
  Windows: getImage('os/windows.svg'),
  IOS: getImage('os/iOS.svg'),
  macOS: getImage('os/macOS.svg'),
  Android: getImage('os/android.svg'),
}

const isProxy = _props.data.proxyCategory !== 'noproxy'

const list = ref([
  {
    image: os_image[_props.data.os],
    classes: '',
    tooltip: `System: ${_props.data.os} ${_props.data.osVersion}\nKernel: Chrome ${_props.data.coreVersion}`,
  },
  {
    classes: isProxy.value ? '' : 'direct',
    image: isProxy.value ? getImage('proxy.svg') : getImage('plus.svg'),
    tooltip: isProxy.value ? `Location: ${_props.data.lastCountry || '--'}\nLast check: ${_props.data.checkTime || '--'}` : undefined,
    onClick: (event: Event) => {
      show(event, {
        model: getProxyOperation(_props.data),
      })
    },
  },
  {
    image: _props.data.windowPlatformList[0]?.platformIcon || getImage('plus.svg'),
    classes: _props.data.windowPlatformList.length > 1 ? 'stack' : '',
    tooltip: '',
    onClick: (event: Event) => {
      show(event, {
        model: getAccountOperation(_props.data),
      })
    },
  },
])

function getProxyOperation(_data: any) {
  return [
    {
      label: 'Add proxy',
      visible: !isProxy.value,
      command: () => {
        emits('profileOperate', 'addProxy')
      },
    },
    {
      label: 'Select proxy',
      visible: !isProxy.value,
      command: () => {
        emits('profileOperate', 'selectProxy')
      },
    },
    {
      label: 'Test proxy',
      visible: isProxy.value,
      command: () => {
        emits('profileOperate', 'testProxy')
      },
    },
    {
      label: 'Refresh IP',
      visible: isProxy.value,
      command: () => {
        emits('profileOperate', 'refreshIp')
      },
    },
    {
      visible: isProxy.value,
      separator: true,
    },
    {
      label: 'Edit proxy',
      visible: isProxy.value,
      command: () => {
        emits('profileOperate', 'editProxy')
      },
    },
    {
      label: 'Change proxy',
      visible: isProxy.value,
      command: () => {
        emits('profileOperate', 'selectProxy')
      },
    },
    {
      visible: isProxy.value,
      separator: true,
    },
    {
      label: 'Delete',
      visible: isProxy.value,
      command: () => {
        emits('profileOperate', 'deleteProxy')
      },
    },
  ]
}

function getAccountOperation(_data: any) {
  return [
    {
      label: 'Add account',
      command: () => {
        emits('profileOperate', 'addAccount')
      },
    },
    {
      label: 'Select account',
      command: () => {
        emits('profileOperate', 'selectAccount')
      },
    },
  ]
}
</script>

<template>
  <div class="flex h-full items-center profile">
    <div class="w-[40px]">
      {{ data.windowSortNum }}
    </div>
    <div class="flex justify-between state">
      <div v-for="(item, index) in list" :key="index" v-tooltip.top="item.tooltip" class="state-item">
        <div class="flex-cc cursor-pointer state-icons" :class="item.classes"
          @click.stop="(event) => item.onClick?.(event)">
          <img class="state-icons-img" :src="item.image">
        </div>
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

  &-item {
    width: 24px;
    height: 24px;

    &:hover {
      .direct {
        transform: scale(0.7);
        opacity: 1;
      }
    }
  }

  &-icons {
    position: relative;
    padding: 3px;
    width: 100%;
    height: 100%;
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
  transform: scale(0);
  transition: all 0.5s ease;
}
</style>
