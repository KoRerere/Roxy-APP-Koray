<script setup lang="tsx">
import { debounce } from 'es-toolkit';
import AnimationBorder from '/@/components/animation-border.vue'
import { toUpgradePlan, switchWorkspaceAndToUpgradePlan } from '/@/hooks/useResponseToast/handleBusinessCode';
import { $t } from '/@/locales';
import { useSimpleLocale } from '/@/stores/locale';
import { type MittEvents, type PayWallType, emitter } from '/@/utils/eventBus'
import { I18nT } from "vue-i18n"
import { useRoleStore } from "/@/stores/role"
import { showToast } from "/@/hooks/useResponseToast/handleBusinessCode";

const { isOwner } = storeToRefs(useRoleStore())
const { getOfficialFaqWebsite } = useSimpleLocale()
const popoverRef = useTemplateRef('popover')
const currentType = ref<PayWallType | null>(null)
const isImageLoaded = ref(false)
const showPayWallOptions = ref<MittEvents['showPayWall']>()

type TextMap = {
  title: string;
  description: string;
  image: string;
  about: string;
  document: string;
}
const textMap = computed<Record<PayWallType, TextMap>>(() => {
  return {
    synchronizer: {
      title: $t('使用窗口同步器提高多任务处理效率'),
      description: () => {
        return <I18nT scope="global" keypath={$t('通过升级至 {member} 解锁窗口同步器功能\n\n窗口同步器模块同时包括{bold}等细分功能', { member: '{member}', bold: '{bold}' })} >
          {{
            member: () => <span class="font-bold">{$t('Roxy 会员')}</span>,
            bold: () => <span class="font-bold">{$t('窗口自动布局、同步窗口标签页、模拟键盘鼠标输入')}</span>
          }}
        </I18nT>
      },
      image: '/images/payments/pay-wall-synchronizer.png',
      about: $t('关于同步器'),
      document: getOfficialFaqWebsite('guide/9-Synchronizer')
    },
    createProfileTemplates: {
      title: $t('使用窗口模板快速新建环境'),
      description: () => {
        return <I18nT scope="global" keypath={$t('通过升级 {member} 解锁窗口模板功能\n\n窗口模板功能支持保存配置环境的{bold}中的各种参数', { member: '{member}', bold: '{bold}' })} >
          {{
            member: () => <span class="font-bold">{$t('Roxy 会员')}</span>,
            bold: () => <span class="font-bold">{$t('系统、内核、UA、基础设置、高级指纹设置及偏好设置')}</span>
          }}
        </I18nT>
      },
      about: $t('关于窗口模板'),
      document: getOfficialFaqWebsite('guide/2-Basic-Settings#template')
    },
    transfer: {
      title: $t('使用窗口投送提升资源分享效率'),
      description: () => {
        return <I18nT scope="global" keypath={$t('窗口投送功能允许您向任意的工作空间投送窗口。{bold}', { bold: '{bold}' })} >
          {{
            bold: () => <span class="font-bold">{$t('窗口投送不仅支持同步窗口云端数据，还包括代理设置、平台账号、Cookies 和指纹参数等相关信息')}</span>
          }}
        </I18nT>
      },
      image: '/images/payments/pay-wall-transfer.png',
      // about: $t('关于窗口投送'),
      // document: getOfficialFaqWebsite('guide/2-Basic-Settings#template')
    }
  }
})

const currentText = computed(() => {
  return textMap.value[currentType.value!]
})

const reCalculatePosition = debounce(() => {
  if (isImageLoaded.value) {
    if (showPayWallOptions.value?.params.type === 'synchronizer') {
      handleSynchronizerClick(showPayWallOptions.value.event)
    } else {
      popoverRef.value?.getRef()?.alignOverlay()
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
  popoverRef.value?.getRef()?.show(event, event.target)
})



function handleSynchronizerClick(event: Event) {
  const a = event.target?.closest('a')
  if (a) {
    const { left, top } = a.getBoundingClientRect()
    const popoverLeft = left + a.clientWidth
    setTimeout(() => {
      const container = popoverRef.value?.getRef()?.container
      if (container) {
        container.style.top = `${top - container.offsetHeight / 2}px`
        container.style.left = `${popoverLeft}px`
      }
    })
  }
}

function toUpgrade(event: Event) {
  popoverRef.value?.getRef()?.toggle(event)
  isOwner.value ? toUpgradePlan() : switchWorkspaceAndToUpgradePlan()
}

function toDocument(event: Event) {
  popoverRef.value?.getRef()?.toggle(event)
  window.open(currentText.value.document, '_blank')
}

function handleImageLoad() {
  isImageLoaded.value = true
  console.log('handleImageLoad')
}
</script>

<template>
  <RyPopover ref="popover">
    <AnimationBorder bgColor="var(--colors-background-bg-overlay)">
      <div class="pay-wall-content">
        <div class="badge">
          {{ $t('Roxy 会员') }}
        </div>
        <div class="title">
          {{ currentText.title }}
        </div>
        <div v-if="currentText.image" class="image">
          <img :src="currentText.image" class="w-full rounded-lg" @load="handleImageLoad" />
        </div>
        <div class="whitespace-pre-line description">
          <!-- {{ currentText.description }} -->
          <component :is="currentText.description"></component>
        </div>
        <div class="pay-wall-footer">
          <RxButton v-if="currentText.about" class="pay-wall-footer-button" severity="secondary" outlined @click="toDocument($event)">
            {{ currentText.about }}
          </RxButton>
          <RxButton class="pay-wall-footer-button" @click="toUpgrade($event)">
            {{ $t('立即升级') }}
          </RxButton>
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
  background: linear-gradient(90deg, #8780FE 0%, #C491F1 100%);
  color: #FFF;
  font-family: "DingTalk JinBuTi", Inter, sans-serif;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}

.title {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
}

.description {
  color: var(--colors-text-text-secondary, #B2B6B8);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 20px;
}

.pay-wall-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
}
</style>
