<script setup lang="ts">
import Drawer from 'primevue/drawer'
import ChooseModal from '/@/views/agent/shop/components/choose-modal.vue'
import ProxyCreate from '/@/views/agent/create/quick.vue'
import { BuyEntryType } from '/@/enums/proxy'

const { showBuy = true, showAdd = true, provider } = defineProps<{
  showBuy?: boolean
  showAdd?: boolean
  provider?: Record<string, any>
}>()

const emit = defineEmits<{
  close: []
  buySuccess: [orderInfo: any]
  addConfirm: [formData: Record<string, any>]
}>()

const visible = defineModel<boolean>('visible', { default: false })

const DRAWER_INSET = 'var(--spacing-xl, 12px)'
const DRAWER_GAP = '12px'
const DRAWER_AVAILABLE_WIDTH = `calc(100vw - ${DRAWER_INSET} * 2)`
const DRAWER_CONTENT_WIDTH = `calc(${DRAWER_AVAILABLE_WIDTH} - ${DRAWER_GAP})`
const DRAWER_HEIGHT = `calc(100vh - ${DRAWER_INSET} * 2)`

const isDual = computed(() => showBuy && showAdd)

const buyWidth = computed(() => {
  if (!showBuy)
    return undefined
  if (isDual.value)
    return `calc(${DRAWER_CONTENT_WIDTH} * 2 / 3)`
  return `calc(${DRAWER_AVAILABLE_WIDTH} * 2 / 3)`
})

const addWidth = computed(() => {
  if (!showAdd)
    return undefined
  if (isDual.value)
    return `calc(${DRAWER_CONTENT_WIDTH} * 1 / 3)`
  return `calc(${DRAWER_AVAILABLE_WIDTH} * 1 / 3)`
})

const buyMaskClass = computed(() => {
  const classes = ['proxy-dual-drawer-mask']
  if (showBuy && !showAdd)
    classes.push('proxy-dual-drawer-buy-only-mask')
  return classes.join(' ')
})

const buyDrawerPt = computed(() => ({
  mask: { class: buyMaskClass.value },
  root: {
    class: `proxy-dual-drawer-root proxy-dual-drawer-buy-root ${showAdd ? '' : '!w-100vw !max-w-300'}`,
    style: showAdd
      ? {
          width: buyWidth.value,
          maxWidth: buyWidth.value,
          height: DRAWER_HEIGHT,
        }
      : undefined,
  },
}))

const addMaskClass = computed(() => {
  const classes = ['proxy-dual-drawer-mask']
  if (showBuy)
    classes.push('proxy-dual-drawer-add-mask')
  return classes.join(' ')
})

const addDrawerPt = computed(() => ({
  mask: { class: addMaskClass.value },
  root: {
    class: 'proxy-dual-drawer-root proxy-dual-drawer-add-root',
    style: {
      width: addWidth.value,
      maxWidth: addWidth.value,
      height: DRAWER_HEIGHT,
    },
  },
}))

function closeDrawer() {
  visible.value = false
}

watch(visible, (val, oldVal) => {
  if (!val && oldVal)
    emit('close')
})
</script>

<template>
  <Drawer
    v-if="showBuy"
    v-model:visible="visible"
    position="left"
    :modal="true"
    :show-close-icon="false"
    :pt="buyDrawerPt"
  >
    <template #container>
      <div class="drawer-panel drawer-buy-panel">
        <ChooseModal
          v-if="provider"
          :provider="provider"
          :entry-type="BuyEntryType.Immediate"
          @close="closeDrawer()"
          @success="$emit('buySuccess', $event)"
        />
      </div>
    </template>
  </Drawer>

  <Drawer
    v-if="showAdd"
    v-model:visible="visible"
    position="right"
    :modal="!showBuy"
    :dismissable="false"
    :show-close-icon="false"
    :pt="addDrawerPt"
  >
    <template #container>
      <div class="drawer-panel drawer-add-panel flex flex-col">
        <div class="drawer-header flex justify-between items-center self-stretch gap-3 py-2 pl-4 pr-3 shrink-0">
          <div class="drawer-title">
            {{ $t('添加代理 IP') }}
          </div>
          <RxButton text severity="secondary" size="xxs" icon="base/rx_ic_delete" @click="closeDrawer()" />
        </div>
        <div class="drawer-add-body">
          <ProxyCreate :on-confirm="(formData) => $emit('addConfirm', formData)" />
        </div>
      </div>
    </template>
  </Drawer>
</template>

<style lang="scss" scoped>
:global(.proxy-dual-drawer-mask) {
  padding: var(--spacing-xl, 12px);
}

:global(.proxy-dual-drawer-buy-only-mask) {
  justify-content: center !important;
}

:global(.proxy-dual-drawer-add-mask) {
  pointer-events: none;
}

:global(.proxy-dual-drawer-root.p-drawer) {
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
