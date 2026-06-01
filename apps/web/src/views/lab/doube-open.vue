<script setup lang="ts">
import Drawer from 'primevue/drawer'
import ChooseModal from '/@/views/agent/shop/components/choose-modal.vue'
import ProxyCreate from '/@/views/agent/create/quick.vue'
import { useProxyStore } from '/@/stores/proxy'
import { BuyEntryType } from '/@/enums/proxy'

const DRAWER_INSET = 'var(--spacing-xl, 12px)'
const DRAWER_GAP = '24px'
const DRAWER_AVAILABLE_WIDTH = `calc(100vw - ${DRAWER_INSET} * 2)`
const DRAWER_CONTENT_WIDTH = `calc(${DRAWER_AVAILABLE_WIDTH} - ${DRAWER_GAP})`
const DRAWER_HEIGHT = `calc(100vh - ${DRAWER_INSET} * 2)`

const visible = ref(false)
const proxyProvider = ref<Record<string, any>>()
const { getProxyVendors } = useProxyStore()

const providerProps = computed(() => {
  if (!proxyProvider.value)
    return undefined

  return {
    proxyProviderId: proxyProvider.value.id,
    proxyProviderWebsite: proxyProvider.value.vendorWebsite,
    proxyProviderIcon: proxyProvider.value.vendorIcon,
    proxyProviderName: proxyProvider.value.vendorName,
  }
})

const buyDrawerPt = {
  mask: { class: 'drawer-mask' },
  root: {
    class: 'drawer-root drawer-buy-root',
    style: {
      width: `calc(${DRAWER_CONTENT_WIDTH} * 2 / 3)`,
      maxWidth: `calc(${DRAWER_CONTENT_WIDTH} * 2 / 3)`,
      height: DRAWER_HEIGHT,
    },
  },
}

const addDrawerPt = {
  mask: { class: 'drawer-mask drawer-add-mask' },
  root: {
    class: 'drawer-root drawer-add-root',
    style: {
      width: `calc(${DRAWER_CONTENT_WIDTH} * 1 / 3)`,
      maxWidth: `calc(${DRAWER_CONTENT_WIDTH} * 1 / 3)`,
      height: DRAWER_HEIGHT,
    },
  },
}

onBeforeMount(async () => {
  const data = await getProxyVendors()
  if (data)
    proxyProvider.value = data.find((item: any) => item.isOfficial)
})

function openDualDrawer() {
  visible.value = true
}

function closeDualDrawer() {
  visible.value = false
}

function onBuySuccess(orderInfo: any) {
  console.log('[doube-open] buy success', orderInfo)
  closeDualDrawer()
}

function onAddConfirm(formData: Record<string, any>) {
  console.log('[doube-open] add confirm', formData)
  closeDualDrawer()
}
</script>

<template>
  <div>
    <div class="card flex justify-center">
      <RxButton size="xxs" text severity="secondary" icon="base/rx_ic_cart" :label="$t('购买 / 添加')" @click="openDualDrawer" />

      <!-- 左侧：购买 2/3 -->
      <Drawer v-model:visible="visible" position="left" :modal="true" :show-close-icon="false" :pt="buyDrawerPt">
        <template #container>
          <div class="drawer-panel drawer-buy-panel">
            <ChooseModal v-if="providerProps" :provider="providerProps" :entry-type="BuyEntryType.Immediate" @close="closeDualDrawer" @success="onBuySuccess" />
          </div>
        </template>
      </Drawer>

      <!-- 右侧：添加 1/3 -->
      <Drawer v-model:visible="visible" position="right" :modal="false" :dismissable="false" :show-close-icon="false" :pt="addDrawerPt">
        <template #container>
          <div class="drawer-panel drawer-add-panel flex flex-col">
            <div class="drawer-header flex justify-between items-center self-stretch gap-3 py-2 pl-4 pr-3 shrink-0">
              <div class="drawer-title">
                {{ $t('添加代理 IP') }}
              </div>
              <RxButton text severity="secondary" size="xxs" icon="base/rx_ic_delete" @click="closeDualDrawer" />
            </div>
            <div class="drawer-add-body">
              <ProxyCreate :on-confirm="onAddConfirm" />
            </div>
          </div>
        </template>
      </Drawer>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:global(.drawer-mask) {
  padding: var(--spacing-xl, 12px);
}

:global(.drawer-add-mask) {
  pointer-events: none;
}

:global(.drawer-root.p-drawer) {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg, 8px);
  border-width: 0.5px;
  box-shadow:
    0px 1px 1px 0px rgba(0, 0, 0, 0.04),
    0px 2px 8px 0px rgba(0, 0, 0, 0.04),
    0px 3px 17px 0px rgba(0, 0, 0, 0.04),
    0px 4px 30px 0px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.drawer-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.drawer-buy-panel {
  overflow: auto;

  :deep(.popup) {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    height: 100%;
    overflow: visible;
  }

  :deep(.provider) {
    width: 100% !important;
    max-width: 100% !important;
    flex: 1;
    min-height: 0;
  }

  :deep(.content) {
    min-height: 0;
  }
}

.drawer-add-body {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;

  :deep(> div) {
    width: 100%;
    min-width: 0 !important;
    height: auto;
    min-height: 100%;
  }
}

.drawer-header {
  border-bottom: 0.5px solid var(--colors-border-divider);
}

.drawer-title {
  color: var(--colors-text-text-primary, #fafafa);
  font-size: 14px;
  font-weight: 600;
  line-height: var(--Line-Height-text-sm, 18px);
}
</style>
