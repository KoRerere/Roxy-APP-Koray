<script setup lang="ts">
import rxCard from '/@/components/rx-card'
import ryButton from '/@/components/ry-button'
import proxyList from '/@/views/browser/components/drawers/proxy-list.vue'
import proxyCreate from '/@/views/browser/components/drawers/proxy-create.vue'

const proxyConfig = reactive<any>({
  value: {
    id: 1,
    area: 'mdi mdi-web',
    proxyName: 'HK/HongKong',
    proxyIcon: 'mdi mdi-wifi-refresh',
    type: 'IPv4',
    ip: 'socks5://gate3.rola.info:2189',
    ipIcon: 'mdi mdi-refresh',
    help: 'Enter your username to reset your password.',
    helpIcon: 'mdi mdi-web',
  },
  state: {
    state: 'success',
    isTestProxy: false,
    isRefresh: false,
    loading: 'mdi mdi-selection-ellipse',
  },
})

const proxyData = computed(() => {
  const { value, state } = proxyConfig

  return value
    ? {
      ...value,
      proxyIcon: state.isTestProxy ? state.loading : value.proxyIcon,
      ipIcon: state.isRefresh ? state.loading : value.ipIcon,
    }
    : null
})

const drawer = reactive({
  visible: false,
  type: 'create',
})

function toggleDrawer(type: 'create' | 'list') {
  drawer.visible = true
  drawer.type = type
}

function testProxy() {
  proxyConfig.state.isTestProxy = true

  setTimeout(() => {
    proxyConfig.state.isTestProxy = false
  }, 2000)
}
function refreshIp() {
  proxyConfig.state.isRefresh = true

  setTimeout(() => {
    proxyConfig.state.isRefresh = false
  }, 2000)
}

function deleteProxy() {
  proxyConfig.value = null
}

function confirm(_data: any) {
  console.log('🚀 ~ confirm ~ _data:', _data)
  proxyConfig.value = {
    id: new Date().getTime(),
    area: 'mdi mdi-web',
    proxyName: `HK/HongKong${Math.random()}`,
    proxyIcon: 'mdi mdi-wifi-refresh',
    type: 'IPv4',
    ip: 'socks5://gate3.rola.info:2189',
    ipIcon: 'mdi mdi-refresh',
    help: 'Enter your username to reset your password.',
    helpIcon: 'mdi mdi-web',
  }
}
</script>

<template>
  <div>
    <div class="button-group">
      <ry-button size="small" severity="secondary" icon="mdi mdi-swap-horizontal" label="Select"
        @click="toggleDrawer('list')" />
      <ry-button size="small" severity="secondary" icon="mdi mdi-plus" label="Add proxy"
        @click="toggleDrawer('create')" />
    </div>

    <template v-if="proxyData">
      <rx-card class="card-list-item" @close="deleteProxy">
        <div class="card-list-item-nation">
          <span :class="proxyData.area" />
        </div>
        <div class="card-list-item-info">
          <div class="flex justify-between">
            <span :class="proxyData.state">{{ proxyData.proxyName }}</span>
            <span class="cursor-pointer" :class="proxyData.proxyIcon" @click="testProxy" />
          </div>
          <div class="flex justify-between">
            <span>{{ proxyData.type }} {{ proxyData.ip }}</span>
            <span class="cursor-pointer" :class="proxyData.ipIcon" @click="refreshIp" />
          </div>
        </div>
      </rx-card>
      <small class="card-list-help">
        <span :class="proxyData.helpIcon" />
        <span>{{ proxyData.help }}</span>
      </small>
    </template>

    <Drawer v-model:visible="drawer.visible" position="right" class="browser-drawer-content !w-[auto]"
      :pt="{ mask: 'browser-drawer' }">
      <template #container="{ closeCallback }">
        <proxyList v-if="drawer.type === 'list'" @close="() => closeCallback()"
          @confirm="(data: any) => { closeCallback(); confirm(data) }" />
        <proxyCreate v-if="drawer.type === 'create'" @close="() => closeCallback()"
          @confirm="(data: any) => { closeCallback(); confirm(data) }" />
      </template>
    </Drawer>
  </div>
</template>

<style lang="scss" scoped>
.button-group {
  display: flex;
  padding: var(--spacing-sm, 4px) var(--spacing-none, 0px);
  align-items: center;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
}

.card-list {
  &-item {
    display: flex;
    gap: 8px;

    &-nation {
      width: 20px;
      height: 20px;
      font-size: 20px;
      line-height: 1;
    }

    &-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      gap: 8px;
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 500;
      line-height: 20px;

      .success {
        color: var(--Color-green-300, #1cc94d);
      }

      .error {
        color: var(--Color-red-300, #f53838);
      }
    }
  }

  &-help {
    display: flex;
    margin-top: var(--spacing-sm, 4px);
    gap: var(--spacing-sm, 4px);
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 10px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
