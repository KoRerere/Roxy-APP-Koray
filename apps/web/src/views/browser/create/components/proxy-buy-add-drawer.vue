<script setup lang="ts">
import Drawer from 'primevue/drawer'
import { useWindowSize } from '@vueuse/core'
import ChooseModal from '/@/views/agent/shop/components/choose-modal.vue'
import SingleProxies from '/@/views/agent/create/components/single-proxies.vue'
import { RxBreathingLight } from '/@/components/rx-breathing-light'
import { createProxyCreateLabels } from '/@/views/agent/create/proxy-create-mode'
import { BuyEntryType } from '/@/enums/proxy'
import { PROXY_PURCHASE_FORCE_WIDE_KEY } from '/@/views/agent/shop/components/provider-buy/utils'

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
const proxyCreateLabels = createProxyCreateLabels('proxy')
/** 左侧购买区呼吸光，由右侧广告「立即购买」触发 */
const buyBreathingRef = useTemplateRef<InstanceType<typeof RxBreathingLight>>('buyBreathing')

const DRAWER_INSET = 'var(--spacing-xl, 12px)'
const DRAWER_GAP = '12px'
const DRAWER_AVAILABLE_WIDTH = `calc(100vw - ${DRAWER_INSET} * 2)`
const DRAWER_CONTENT_WIDTH = `calc(${DRAWER_AVAILABLE_WIDTH} - ${DRAWER_GAP})`
const DRAWER_HEIGHT = `calc(100vh - ${DRAWER_INSET} * 2)`

/**
 * 窗口太窄时（左侧购买区不足约 640px，内容已看不清）直接隐藏左侧购买抽屉，只保留右侧添加代理。
 * 宽度恢复后自动重新显示。只用样式隐藏、不销毁抽屉：
 * 若销毁后重建，购买抽屉的遮罩会叠到添加代理抽屉上方，导致右侧变暗；同时也能保留已选的购买选项。
 */
const HIDE_BUY_MAX_WINDOW_WIDTH = 1000
const { width: windowWidth } = useWindowSize()
const buyVisible = computed(() => showBuy && !(showAdd && windowWidth.value < HIDE_BUY_MAX_WINDOW_WIDTH))

const isDual = computed(() => buyVisible.value && showAdd)
/** 购买区与添加代理并排时，购买页用左右布局（左侧选项、右侧账单），窗口过窄时才回退为上下布局 */
provide(PROXY_PURCHASE_FORCE_WIDE_KEY, isDual)

const buyWidth = computed(() => {
  if (!buyVisible.value)
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
  if (buyVisible.value && !showAdd)
    classes.push('proxy-dual-drawer-buy-only-mask')
  return classes.join(' ')
})

const buyDrawerPt = computed(() => ({
  mask: { class: buyMaskClass.value },
  root: {
    class: `proxy-dual-drawer-root proxy-dual-drawer-buy-root ${showAdd ? '' : '!w-100vw !max-w-300'} ${buyVisible.value ? '' : '!hidden'}`,
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

/** 聚焦左侧购买区：播放一次贴边呼吸光，引导用户注意下单面板 */
function focusBuyPanel() {
  if (!buyVisible.value)
    return
  buyBreathingRef.value?.trigger()
}

watch(visible, (val, oldVal) => {
  if (!val && oldVal) {
    buyBreathingRef.value?.stop()
    emit('close')
  }
})
</script>

<template>
  <Drawer v-if="showBuy" v-model:visible="visible" position="left" :modal="true" :show-close-icon="false" :pt="buyDrawerPt">
    <template #container>
      <div class="drawer-buy-shell">
        <div class="drawer-panel drawer-buy-panel">
          <ChooseModal v-if="provider" :provider="provider" :entry-type="BuyEntryType.Immediate" @close="closeDrawer()" @success="$emit('buySuccess', $event)" />
        </div>
        <!-- overlay 贴抽屉外壳，offset>0 让光带落在边框外侧，接近 demo 包住卡片的效果 -->
        <RxBreathingLight
          ref="buyBreathing"
          overlay
          radius="var(--radius-lg, 8px)"
          color="#11A3FD"
          :thickness="2"
          :glow="28"
          :offset="3"
          :duration="2600"
        />
      </div>
    </template>
  </Drawer>

  <Drawer v-if="showAdd" v-model:visible="visible" position="right" :modal="!showBuy" :dismissable="false" :show-close-icon="false" :pt="addDrawerPt">
    <template #container>
      <div class="drawer-panel drawer-add-panel flex flex-col">
        <div class="drawer-header flex justify-between items-center self-stretch gap-3 py-2 pl-4 pr-3 shrink-0">
          <div class="drawer-title">
            {{ proxyCreateLabels.pageTitle }}
          </div>
          <RxButton text severity="secondary" size="xxs" icon="base/rx_ic_delete" @click="closeDrawer()" />
        </div>
        <div class="drawer-add-body">
          <SingleProxies mode="proxy" show-advertise :on-confirm="(formData) => $emit('addConfirm', formData)" @buy="focusBuyPanel" />
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

/* 购买抽屉常驻放开裁切：内容圆角由内层 panel 负责，根节点留给外扩呼吸光 */
:global(.proxy-dual-drawer-buy-root.p-drawer) {
  overflow: visible;
}

.drawer-buy-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: visible;
}

.drawer-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.drawer-buy-panel {
  /* 内容圆角裁切下沉到内层，根节点留给外扩呼吸光 */
  overflow: auto;
  border-radius: var(--radius-lg, 8px);

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
  overflow: hidden;
  display: flex;
  flex-direction: column;

  :deep(> div) {
    width: 100%;
    min-width: 0 !important;
    flex: 1;
    min-height: 0;
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
