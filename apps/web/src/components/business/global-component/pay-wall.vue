<script setup lang="tsx">
import { getImage } from '/@/utils/basic'
import { debounce } from 'es-toolkit'
import AnimationBorder from '/@/components/animation-border.vue'
import { switchWorkspaceAndToUpgradePlan } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useSimpleLocale } from '/@/stores/locale'
import { emitter } from '/@/utils/eventBus'
import type { MittEvents, PayWallType } from '/@/utils/eventBus'
import { I18nT } from 'vue-i18n'
import { useUserStore } from '/@/stores/user'

const { userPayInfo } = storeToRefs(useUserStore())
const { getOfficialFaqWebsite } = useSimpleLocale()
const popoverRef = useTemplateRef('popover')
const currentType = ref<PayWallType | null>(null)
const isImageLoaded = ref(false)
const showPayWallOptions = ref<MittEvents['showPayWall']>()

interface TextMap {
  title: string
  description: string
  image: string
  about: string
  document: string
}
const textMap = computed<Record<PayWallType, TextMap>>(() => {
  return {
    synchronizer: {
      title: $t('使用窗口同步器提高多任务处理效率'),
      description: () => {
        return (
          <I18nT scope="global" keypath={$t('通过升级至 {member} 解锁窗口同步器功能\n\n窗口同步器模块同时包括{bold}等细分功能', { member: '{member}', bold: '{bold}' })}>
            {{
              member: () => <span class="font-bold">{$t('Roxy 会员')}</span>,
              bold: () => <span class="font-bold">{$t('窗口自动布局、同步窗口标签页、模拟键盘鼠标输入')}</span>,
            }}
          </I18nT>
        )
      },
      image: getImage('payments/pay-wall-synchronizer.png'),
      about: $t('关于同步器'),
      document: getOfficialFaqWebsite('/features/synchronizer'),
    },
    createProfileTemplates: {
      title: $t('使用窗口模板快速新建环境'),
      description: () => {
        return (
          <I18nT scope="global" keypath={$t('通过升级 {member} 解锁窗口模板功能\n\n窗口模板功能支持保存配置环境的{bold}中的各种参数', { member: '{member}', bold: '{bold}' })}>
            {{
              member: () => <span class="font-bold">{$t('Roxy 会员')}</span>,
              bold: () => <span class="font-bold">{$t('系统、内核、UA、基础设置、高级指纹设置及偏好设置')}</span>,
            }}
          </I18nT>
        )
      },
      about: $t('关于窗口模板'),
      document: getOfficialFaqWebsite('/features/profile-configuration#template'),
    },
    transfer: {
      title: $t('使用窗口转移提升资源分享效率'),
      description: () => {
        return (
          <I18nT scope="global" keypath={$t('窗口转移功能允许您向任意的工作空间转移窗口。{bold}', { bold: '{bold}' })}>
            {{
              bold: () => <span class="font-bold">{$t('窗口转移不仅支持同步窗口云端数据，还包括代理 IP 设置、平台账号、Cookies 和指纹参数等相关信息')}</span>,
            }}
          </I18nT>
        )
      },
      image: getImage('payments/pay-wall-transfer.png'),
      about: $t('关于窗口转移'),
      document: getOfficialFaqWebsite('/features/transfer-profile'),
    },
  }
})

const currentText = computed(() => {
  return textMap.value[currentType.value!]
})

const reCalculatePosition = debounce(() => {
  if (isImageLoaded.value) {
    if (showPayWallOptions.value?.params.type === 'synchronizer') {
      handleSynchronizerClick(showPayWallOptions.value.event)
    }
    else {
      popoverRef.value?.instance?.alignOverlay()
    }
  }
}, 0)

watch(isImageLoaded, reCalculatePosition, { immediate: true })

emitter.on('showPayWall', (options) => {
  showPayWallOptions.value = options
  const { event, params } = options
  currentType.value = params.type
  reCalculatePosition()
  console.log('event', event)
  popoverRef.value?.instance?.show(event, event.target)
})

function handleSynchronizerClick(event: Event) {
  const a = event.target?.closest('a')
  if (a) {
    const { left, top } = a.getBoundingClientRect()
    const popoverLeft = left + a.clientWidth
    setTimeout(() => {
      const container = popoverRef.value?.instance?.container
      if (container) {
        container.style.top = `${top - container.offsetHeight / 2}px`
        container.style.left = `${popoverLeft}px`
      }
    })
  }
}

function toUpgrade(event: Event) {
  popoverRef.value?.instance?.toggle(event)
  switchWorkspaceAndToUpgradePlan()
}

function toDocument(event: Event) {
  popoverRef.value?.instance?.toggle(event)
  window.open(currentText.value.document, '_blank')
}

function handleImageLoad() {
  isImageLoaded.value = true
  console.log('handleImageLoad')
}
</script>

<template>
  <RyPopover ref="popover">
    <AnimationBorder bg-color="var(--colors-background-bg-overlay)">
      <div class="pay-wall-content">
        <div class="badge">
          {{ $t('Roxy 会员') }}
        </div>
        <div class="title">
          {{ currentText.title }}
        </div>
        <div v-if="currentText.image" class="image">
          <img :src="currentText.image" class="w-full rounded-lg" @load="handleImageLoad">
        </div>
        <div class="whitespace-pre-line description">
          <component :is="currentText.description" />
        </div>
        <div class="flex gap-2 self-stretch" :class="[userPayInfo.discount ? 'flex-col' : 'flex-row-reverse']">
          <div class="relative">
            <div v-if="userPayInfo.discount" class="absolute top-0 right-3 -translate-y-1/2 px-3 py-1 rounded-full z-1 discount">
              {{ $t('{discount}% Off', { discount: userPayInfo.discount }) }}
            </div>
            <RxButton class="w-full" :label="$t('立即升级')" @click="toUpgrade" />
          </div>
          <RxButton v-if="currentText.about" severity="secondary" outlined :label="currentText.about" @click="toDocument" />
        </div>
      </div>
    </AnimationBorder>
  </RyPopover>
</template>

<style lang="scss" scoped>
.pay-wall-content {
  display: flex;
  width: 345px;
  padding: 16px;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.badge {
  display: flex;
  padding: 2px 8px;
  justify-content: center;
  align-items: center;
  gap: 10px;
  border-radius: var(--radius-full, 9999px);
  background: linear-gradient(90deg, #8780fe 0%, #c491f1 100%);
  color: #fff;
  font-family: 'DingTalk JinBuTi', Inter, sans-serif;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}

.title {
  color: var(--colors-text-text-primary, #fafafa);
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
}

.description {
  color: var(--colors-text-text-secondary, #b2b6b8);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 20px;
}

.discount {
  background: #fc9d12;
  color: #fff;
  font-family: 'DingTalk JinBuTi', sans-serif;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
}
</style>
