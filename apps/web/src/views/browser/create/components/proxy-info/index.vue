<script setup lang="ts">
import NoproxyPanel from './noproxy-panel.vue'
import CustomPanel from './custom-panel.vue'
import ChoosePanel from './choose-panel.vue'
import ApiPanel from './api-panel.vue'
import InputLabel from '/@/components/ry-form/input-label.vue'
import RxSelectButton from '/@/components/rx-select-button'
import { useTableContext } from '../../hooks/useContext'
import { usePurchaseOfficialProxy } from '/@/views/browser/list/profiles/hooks/useProfileProxy'
import type { ProxyInfoItem, ProxyInfoMode } from './types'

defineOptions({ inheritAttrs: false })

/** 可缓存草稿的 tab（直连无表单状态） */
type DraftMode = Exclude<ProxyInfoMode, 'noproxy'>

const proxyList = defineModel<any[]>('modelValue', { default: () => [] })

const { presetTemplate, pauseCreateGuide, continueCreateGuideAfterBuy } = useTableContext()
const { purchaseImmediateOfficialProxy } = usePurchaseOfficialProxy()

const mode = ref<ProxyInfoMode>('noproxy')
/** 避免用户手动切 tab 后被 watch 再次 hydrate 抢回 */
const hydrated = ref(false)

/** 各 tab 独立草稿：切走不丢，提交只取当前 mode 对应项 */
const drafts = reactive<Record<DraftMode, ProxyInfoItem | null>>({
  custom: null,
  choose: null,
  api: null,
})

const modeOptions = computed(() => [
  { label: $t('不使用'), value: 'noproxy' as ProxyInfoMode },
  { label: $t('添加代理 IP'), value: 'custom' as ProxyInfoMode },
  { label: $t('选择代理 IP'), value: 'choose' as ProxyInfoMode },
  // 下期上线：API 提取边界情况较多，本期先隐藏入口
  // { label: $t('API 提取'), value: 'api' as ProxyInfoMode },
])

const customDraft = createDraftModel('custom')
const chooseDraft = createDraftModel('choose')
const apiDraft = createDraftModel('api')

// 快速创建：父级 async onBeforeMount 不阻塞子树挂载，proxyList 可能晚到；等有数据再 hydrate
watch(
  () => proxyList.value?.[0],
  (item) => {
    if (hydrated.value) {
      return
    }
    if (!item && mode.value === 'noproxy') {
      return
    }
    hydrateFromModel()
  },
  { immediate: true, deep: true },
)

/** 把当前 tab 草稿同步到外层表单字段 proxyInfoList（UI 容器；单窗提交前会摊平为扁平字段） */
function syncProxyListFromActiveTab() {
  clearPresetTemplate()
  if (mode.value === 'noproxy') {
    proxyList.value = []
    return
  }
  const item = drafts[mode.value]
  proxyList.value = item ? [item] : []
}

/** 各面板独立 v-model，仅当前 tab 写回 proxyInfoList */
function createDraftModel(key: DraftMode) {
  return computed({
    get: () => drafts[key],
    set: (item: ProxyInfoItem | null) => {
      drafts[key] = item
      if (mode.value === key) {
        syncProxyListFromActiveTab()
      }
    },
  })
}

function clearPresetTemplate() {
  if (presetTemplate) {
    presetTemplate.value = undefined
  }
}

/** 是否为有效的已有代理 id（0 / 空视为无） */
function hasChooseId(item: ProxyInfoItem | null | undefined) {
  const id = item?.id
  return id !== undefined && id !== null && id !== '' && Number(id) !== 0
}

/** 根据已有 proxyInfoList 推断初始 tab，并种子对应草稿 */
function inferMode(item: ProxyInfoItem | null | undefined): ProxyInfoMode {
  if (!item) {
    return 'noproxy'
  }

  const category = String(item.proxyCategory || item.protocol || '').toLowerCase()
  if (category === 'noproxy') {
    return 'noproxy'
  }

  // 优先信 proxyMethod；API 入口隐藏时有连接信息则降级 custom，避免误显直连后保存冲掉数据
  if (item.proxyMethod === 'api') {
    return (item.host || item.extraUrl) ? 'custom' : 'noproxy'
  }
  if (item.proxyMethod === 'choose' || hasChooseId(item)) {
    return 'choose'
  }
  if (item.proxyMethod === 'custom' || item.host) {
    return 'custom'
  }

  return 'noproxy'
}

function hydrateFromModel() {
  const item = proxyList.value?.[0] ?? null
  const inferred = inferMode(item)
  mode.value = inferred
  if (inferred !== 'noproxy' && item) {
    drafts[inferred] = { ...toRaw(item) }
  }
  hydrated.value = true
}

function onModeChange() {
  hydrated.value = true
  syncProxyListFromActiveTab()
}

/** 已有代理下拉「创建代理」：切到自定义 tab，沿用该 tab 独立草稿 */
function switchToCustom() {
  mode.value = 'custom'
  onModeChange()
}

/** 打开官方代理购买弹窗；即时订单成功后写入「已有代理」草稿并切换 */
async function openBuyProxy() {
  // 引导中点击购买：先关引导，弹窗关闭后再聚焦「创建窗口」
  const fromGuide = pauseCreateGuide?.() ?? false
  try {
    const proxy = await purchaseImmediateOfficialProxy()
    if (!proxy) {
      return
    }
    drafts.choose = toRaw(proxy)
    mode.value = 'choose'
    hydrated.value = true
    syncProxyListFromActiveTab()
  }
  finally {
    if (fromGuide) {
      await continueCreateGuideAfterBuy?.()
    }
  }
}
</script>

<template>
  <div class="w-full flex items-start proxy-info">
    <InputLabel class="shrink-0 max-w-25 !min-w-25 text-right" :label="$t('代理 IP')" :tooltip="$t('代理是使用特定 IP 地址进行网络访问的方式，平台会获取您的 IP 地址来追踪您，强烈建议配置此项！')" />
    <div class="min-w-0 flex-1 flex flex-col gap-4">
      <div class="flex flex-col items-start gap-4">
        <span class="guide1 inline-flex rounded-2 overflow-hidden">
          <AnimationBorder class="overflow-hidden select-none cursor-pointer" :border-radius="8" :gradient="['#3990F8', '#13DD8D']" :animation="false" :deg="94">
            <div class="flex items-center gap-2 py-2 pa-3 btn" @click="openBuyProxy">
              <SvgIcon name="base/rx_ic_cart" color="#3598ED" />
              <div class="text-3.75 font-[DingTalk_JinBuTi] text">
                {{ $t('购买纯净真人住宅 IP') }}
              </div>
            </div>
          </AnimationBorder>
        </span>
        <RxSelectButton v-model="mode" :options="modeOptions" size="lg" option-label="label" option-value="value" data-key="value" @change="onModeChange" />
      </div>

      <div class="pa-4 rounded-2 panel">
        <KeepAlive>
          <NoproxyPanel v-if="mode === 'noproxy'" key="noproxy" />
          <CustomPanel v-else-if="mode === 'custom'" key="custom" v-model="customDraft" />
          <ChoosePanel v-else-if="mode === 'choose'" key="choose" v-model="chooseDraft" @create="switchToCustom" />
          <ApiPanel v-else-if="mode === 'api'" key="api" v-model="apiDraft" />
        </KeepAlive>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.btn {
  background: var(--colors-background-bg-overlay);
}

.text {
  background: linear-gradient(94deg, #3990f8 -1.41%, #13dd8d 99.64%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.panel {
  background: var(--colors-background-bg-block);
  box-shadow: 0 1px 2px 0 rgba(16, 24, 40, 0.05);
}
</style>
