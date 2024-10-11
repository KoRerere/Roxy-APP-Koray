<script lang="ts" setup>
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useContextMenu } from '/@/hooks/useContextMenu'
import { useRoleStore } from '/@/stores/role'

const props = defineProps({
  data: {
    type: Object as PropType<any>,
    default: () => ({}),
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})
const emits = defineEmits(['profileOperate'])

const role = useRoleStore()
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
    svg: isProxy.value ? `country-code/${data.value.lastCountry}` : 'base/rx_ic_plus',
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
      visible: !isProxy.value && !role.isViewer,
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
      visible: isProxy.value && !role.isViewer,
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
      visible: isProxy.value && !role.isViewer,
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
      visible: !role.isViewer,
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
  <div class="position-relative flex h-full items-center profile" :class="{ 'disabled-mask': disabled }">
    <div class="w-[40px]">
      {{ data.windowSortNum }}
    </div>
    <div class="position-relative flex justify-between state" @click.stop>
      <div v-for="item in list" :key="item.key" v-tooltip.top="{ value: item.tooltip, showDelay: 500 }"
        class="state-item">
        <div class="flex-cc cursor-pointer state-icons" :class="item.classes" @click.stop="onClick($event, item.key)">
          <img v-if="item.image" :src="item.image" class="state-icons-img">
          <RxSvgIcon v-else :name="item.svg" fallback="base/rx_ic_earth" />
        </div>
      </div>
      <div class="state-line">
        <svg xmlns="http://www.w3.org/2000/svg" width="60" height="5" viewBox="0 0 60 5" fill="none">
          <g>
            <path
              d="M0 2.5C1 0.5 2 0.5 3 2.5C4 4.5 5 4.5 6 2.5C7 0.5 8 0.5 9 2.5C10 4.5 11 4.5 12 2.5C13 0.5 14 0.5 15 2.5C16 4.5 17 4.5 18 2.5C19 0.5 20 0.5 21 2.5C22 4.5 23 4.5 24 2.5C25 0.5 26 0.5 27 2.5C28 4.5 29 4.5 30 2.5C31 0.5 32 0.5 33 2.5C34 4.5 35 4.5 36 2.5C37 0.5 38 0.5 39 2.5C40 4.5 41 4.5 42 2.5C43 0.5 44 0.5 45 2.5C46 4.5 47 4.5 48 2.5C49 0.5 50 0.5 51 2.5C52 4.5 53 4.5 54 2.5C55 0.5 56 0.5 57 2.5C58 4.5 59 4.5 60 2.5"
              stroke="#12A3FC" />
          </g>
        </svg>
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
  z-index: 0;

  &-line {
    z-index: -1;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
  }

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
