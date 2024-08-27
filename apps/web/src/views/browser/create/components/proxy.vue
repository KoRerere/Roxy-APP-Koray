<script setup lang="ts">
import rxCard from '/@/components/rx-card'
import ryButton from '/@/components/ry-button'
import proxyList from '/@/views/browser/components/drawers/proxy-list.vue'
import proxyCreate from '/@/views/browser/components/drawers/proxy-create.vue'

const proxyConfig = reactive<any>({
  value: null,
  state: {
    state: 'success',
    isTestProxy: false,
    isRefresh: false,
    loading: 'mdi mdi-selection-ellipse',
    proxyIcon: 'mdi mdi-wifi-refresh',
    ipIcon: 'mdi mdi-refresh',
    help: 'Enter your username to reset your password.',
    helpIcon: 'mdi mdi-web',
  },
})

const proxyData = computed(() => {
  const { value, state } = proxyConfig
  return value
    ? {
      ...value,
      proxyValue: `${value.ipType} ${value.protocol}://${value.host || ''}:${value.port || ''}`,
      help: state.help,
      helpIcon: state.helpIcon,
      proxyIcon: state.isTestProxy ? state.loading : state.proxyIcon,
      ipIcon: state.isRefresh ? state.loading : state.ipIcon,
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

function confirm(data: any) {
  console.log('🚀 ~ confirm ~ data:', data)
  proxyConfig.value = data
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
      <rx-card class="proxy" @close="deleteProxy">
        <img class="proxy-img" :src="proxyData.area">
        <div class="flex justify-between proxy-nation ">
          <span :class="proxyData.state">{{ proxyData.proxyName || '--' }}</span>
          <span class="cursor-pointer" :class="proxyData.proxyIcon" @click="testProxy" />
        </div>
        <div class="flex justify-between proxy-time">
          <span>{{ proxyData.proxyValue }}</span>
          <span class="cursor-pointer" :class="proxyData.ipIcon" @click="refreshIp" />
        </div>
      </rx-card>
      <small class="proxy-help">
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

.proxy {
  display: grid;
  grid-template-columns: 16px 1fr;
  grid-column-gap: var(--spacing-lg, 8px);
  grid-row-gap: var(--spacing-xs, 4px);
  margin-top: 10px;

  &-img {
    width: 16px;
    height: 16px;
    grid-row-start: span 2;
  }

  &-nation {
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  &-time {
    color: var(--Colors-Text-text-inactive, #a3a9ad);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
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
