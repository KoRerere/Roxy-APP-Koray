<script setup lang="ts">
import rxCard from '/@/components/rx-card'
import ryButton from '/@/components/ry-button'
import proxyList from '/@/views/browser/components/drawers/proxy-list.vue'
import proxyCreate from '/@/views/browser/components/drawers/proxy-create.vue'
import { useVModel } from '@vueuse/core'

const props = defineProps({
  modelValue: {
    type: Object as PropType<any>,
    default: () => ({}),
  },
})
const emits = defineEmits(['update:modelValue'])

const proxyValue = useVModel(props, 'modelValue', emits)

const proxyState = reactive({
  region: 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png',
  state: 'success',
  isTestProxy: false,
  isRefresh: false,
  loading: 'mdi mdi-selection-ellipse',
  ipIcon: 'mdi mdi-refresh',
  proxyIcon: 'mdi mdi-wifi-refresh',
  help: 'Enter your username to reset your password.',
  helpIcon: 'mdi mdi-web',
})

const _proxyValue = computed(() => {
  return {
    visible: Object.values(proxyValue.value).some(v => v),
    name: 'my-proxy',
    value: `${proxyValue.value.protocol}://${proxyValue.value.ip}:${proxyValue.value.port}`,
  }
})

const icons = computed(() => {
  return {
    ip: proxyState.isRefresh ? proxyState.loading : proxyState.ipIcon,
    proxy: proxyState.isTestProxy ? proxyState.loading : proxyState.proxyIcon,
    help: proxyState.helpIcon,
  }
})

const drawer = reactive({
  visible: false,
  type: 'create',
})

function toggleDrawer(type: 'create' | 'list') {
  drawer.visible = true
  drawer.type = type
}

function deleteProxy() {
  Object.keys(proxyValue.value).forEach((key) => {
    proxyValue.value[key] = null
  })
}

function confirm(data: any) {
  proxyValue.value = data
}

function testProxy() {
  proxyState.isTestProxy = true

  setTimeout(() => {
    proxyState.isTestProxy = false
  }, 2000)
}

function refreshIp() {
  proxyState.isRefresh = true

  setTimeout(() => {
    proxyState.isRefresh = false
  }, 2000)
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

    <div v-if="_proxyValue.visible">
      <rx-card class="proxy" @close="deleteProxy">
        <img class="proxy-img" :src="proxyState.region">
        <div class="flex justify-between proxy-nation ">
          <span :class="proxyState.state">{{ _proxyValue.name }}</span>
          <span class="cursor-pointer" :class="icons.proxy" @click="testProxy" />
        </div>
        <div class="flex justify-between proxy-time">
          <span>{{ _proxyValue.value }}</span>
          <span class="cursor-pointer" :class="icons.ip" @click="refreshIp" />
        </div>
      </rx-card>
      <small class="proxy-help">
        <span :class="icons.help" />
        <span>{{ proxyState.help }}</span>
      </small>
    </div>

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
