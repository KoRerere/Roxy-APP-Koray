<script setup lang="ts">
import ProviderList from '/@/views/agent/shop/components/provider-list.vue'
import ProviderDetail from '/@/views/agent/shop/components/provider-detail.vue'
import { useThemeStore } from '/@/stores/theme'
import { useUserStore } from '/@/stores/user'

defineOptions({
  inheritAttrs: false,
})

defineEmits(['close', 'success'])

const { mixpanelTrack } = useUserStore()
const themeStore = useThemeStore()
const currentProvider = ref()

const bgSrc = computed(() => {
  return themeStore.realTheme === 'light' ? 'url("/images/proxy/shop_dialog_bg.svg")' : 'url("/images/proxy/shop_dialog_bg_dark.svg")'
})

onMounted(() => {
  mixpanelTrack('click_enter_proxy_ip_store')
})
</script>

<template>
  <div class="flex flex-col rounded-lg popup">
    <ProviderList v-show="!currentProvider" v-model="currentProvider" @close="$emit('close')" @success="$emit('success', $event)" />
    <ProviderDetail v-if="currentProvider" :data="currentProvider" @back="currentProvider = undefined" @close="$emit('close')" @success="$emit('success', $event)" />
  </div>
</template>

<style lang="scss" scoped>
.popup {
  position: relative;
  overflow: hidden;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--colors-background-bg-page);
  }

  &::before {
    background-image: v-bind(bgSrc);
    background-size: 100% auto;
    background-repeat: no-repeat;
    background-position: 0 0;
    z-index: -1;
  }

  &::after {
    z-index: -2;
  }
}
</style>
