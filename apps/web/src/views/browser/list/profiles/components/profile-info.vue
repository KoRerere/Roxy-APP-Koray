<script lang="ts" setup>
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useContextMenu } from '/@/hooks/useContextMenu'

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emits = defineEmits(['profileOperate'])

const os_image: any = {
  windows: 'platforms/rx_os_windows',
  macos: 'platforms/rx_os_macOS',
  ios: 'platforms/rx_os_iOS',
  android: 'platforms/rx_os_android',
}

const data = computed(() => props.data)
const isProxy = computed(() => data.value.proxyCategory !== 'noproxy')

const list = computed(() => [
  {
    key: 'os',
    svg: os_image[(data.value.os as string).toLocaleLowerCase()],
    tooltip: `System: ${data.value.os} ${data.value.osVersion}\nKernel: Chrome ${data.value.coreVersion}`,
  },
  {
    key: 'proxy',
    classes: isProxy.value ? '' : 'direct',
    svg: isProxy.value ? 'base/rx_ic_earth' : 'base/rx_ic_plus',
    tooltip: isProxy.value ? `Location: ${data.value.lastCountry || '--'}\nLast check: ${data.value.checkTime || '--'}` : undefined,
  },
  {
    key: 'account',
    image: data.value.windowPlatformList?.[0]?.platformIcon,
    svg: 'base/rx_ic_plus',
    classes: data.value.windowPlatformList?.length > 1 ? 'stack' : '',
  },
])

const [show] = useContextMenu()

function onClick(event: Event, key: string) {
  if (props.disabled) {
    return
  }

  switch (key) {
    case 'proxy':
      show(event, { model: getProxyOperation() })
      break
    case 'account':
      show(event, { model: getAccountOperation() })
      break
  }
}

function getProxyOperation() {
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
      label: 'Refresh Url',
      visible: isProxy.value,
      disabled: !data.value.refreshUrl,
      command: () => {
        emits('profileOperate', 'refreshUrl')
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

function getAccountOperation() {
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
  <div class="flex h-full items-center profile" :class="{ 'disabled-mask': disabled }">
    <div class="w-[40px]">
      {{ data.windowSortNum }}
    </div>
    <div class="flex justify-between state" @click.stop>
      <div v-for="item in list" :key="item.key" v-tooltip.top="{ value: item.tooltip, showDelay: 500 }"
        class="state-item">
        <div class="flex-cc cursor-pointer state-icons" :class="item.classes"
          @click.stop="(event: any) => onClick(event, item.key)">
          <img v-if="item.image" :src="item.image" class="state-icons-img">
          <RxSvgIcon v-else :name="item.svg" />
        </div>
      </div>
    </div>
    <div>{{ data.windowName }}</div>
  </div>
</template>

<style lang="scss" scoped>
$box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02),
  0px 1px 1px 0px rgba(0, 0, 0, 0.06);

.disabled-mask {
  filter: grayscale(100%);
}

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
    transition: all 0.5s ease;

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
}
</style>
