<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon';
import { $t } from '/@/locales';
import { useUserStore } from '/@/stores/user';
import { RxAlert } from '/@/components/rx-alert/'
import type { MittEvents } from '/@/utils/eventBus';
import { toUpgradePlan } from '/@/hooks/useResponseToast/handleBusinessCode';
import { API } from '/@/api';
import { getAdvancedFeature } from '/@/constants/advanced-feature';

const props = defineProps<{
  hideFn: () => void,
  alertType?: MittEvents['showUpgradePlanDialog']
}>()

const router = useRouter()
const { userPayInfo } = storeToRefs(useUserStore())
const features = getAdvancedFeature()

const alertTextMap = {
  'subscriptionExpired': {
    type: 'warn',
    content: $t('您已达到最大窗口创建限制'),
  },
  'windowLimitReached': {
    type: 'warn',
    content: $t('您已达到最大窗口创建限制'),
  },
}

const alertInfo = computed(() => {
  return alertTextMap[props.alertType!]
})

const images = ref([
  {
    itemImageSrc: '/images/payments/paywall_banners/theme=template.png',
    title: $t('窗口模板'),
    description: $t('窗口模板功能支持保存配置环境的系统、内核、UA、基础设置、高级指纹设置及偏好设置中的各种参数'),
  },
  {
    itemImageSrc: '/images/payments/paywall_banners/theme=synchronizer.png',
    title: $t('窗口同步器'),
    description: $t('窗口同步器模块包括窗口自动布局、同步窗口标签页、模拟键盘鼠标输入等细分功能'),
  },
  {
    itemImageSrc: '/images/payments/paywall_banners/theme=api.png',
    title: $t('更多 API 请求频率'),
    description: $t('API 功能可以配合 Selenium、Puppeteer 和 Playwright 等工具实现浏览器操作的自动化'),
  },
]);

const currentImage = ref(images.value[0])

function toUpgrade() {
  toUpgradePlan()
  hideDialog()
}

function toFreeTrial() {
  router.push({ name: 'trial-plan' })
  hideDialog()
}

function hideDialog() {
  props.hideFn()
  if (userPayInfo.value.showPayWallDlg) {
    API.pay.userUpdatePayTipsList({
      source: 'Wall'
    })
  }
}

let timer: any

function onIndicatorClick(index: number) {
  currentImage.value = images.value[index]
  clearInterval(timer)
  timer = setInterval(() => {
    index = index === images.value.length - 1 ? 0 : index + 1
    currentImage.value = images.value[index]
  }, 3500)
}

onIndicatorClick(0)

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <div class="upgrade-pay-plan">
    <div class="left">
      <div class="upgrade-pay-plan-header">
        {{ $t('升级到') }} <span class="upgrade-pay-plan-header-plus">{{ $t('Roxy 会员') }}</span>
      </div>
      <RxAlert v-if="alertInfo" class="w-full" :type="(alertInfo.type as any)" :content="alertInfo.content" :closable="false">
      </RxAlert>
      <div class="upgrade-pay-plan-content">
        <div class="description">
          <span>{{ $t('升级套餐以解锁更多') }}</span> <br />
          <span>{{ $t('付费计划还包含以下高级功能：') }}</span>
        </div>

      </div>
      <div class="features">
        <template v-for="feature in features" :key="feature">
          <div class="feature-item">
            <RxSvgIcon name="base/rx_ic_check" color="#1CC94D" />
            <span>{{ feature }}</span>
          </div>
        </template>
      </div>
      <div class="upgrade-pay-plan-btn-group">
        <RxButton :label="$t('升级')" class="w-full" @click="toUpgrade" :size="userPayInfo.isTrial === 0 ? 'md' : 'lg'" />
        <RxButton v-if="userPayInfo.isTrial === 0" severity="secondary" size="md" outlined class="w-full" @click="toFreeTrial">
          🎁 {{ $t('7 天免费试用') }}
        </RxButton>
      </div>
    </div>

    <div class="right">
      <div class="upgrade-pay-plan-right-content">
        <div class="upgrade-pay-plan-right-header">
          <span class="title">{{ currentImage.title }}</span>
          <div class="close-btn" @click="hideDialog">
            <RxSvgIcon name="base/rx_ic_delete" size="24" />
          </div>
        </div>
        <div class="description">
          {{ currentImage.description }}
        </div>
      </div>
      <div class="indicator-list">
        <template v-for="(image, index) in images" :key="image.itemImageSrc">
          <div class="indicator-item" :class="{ active: image.itemImageSrc === currentImage.itemImageSrc }" @click="onIndicatorClick(index)"></div>
        </template>
      </div>
      <div class="picture-item">
        <Transition name="slide-up" mode="out-in">
          <img :src="currentImage.itemImageSrc" :key="currentImage.itemImageSrc" />
        </Transition>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.upgrade-pay-plan {
  display: flex;
  gap: 29px;
  overflow: hidden;
  border-radius: var(--p-dialog-border-radius);
  overflow: hidden;

  .left {
    display: flex;
    width: 450px;
    padding: 24px 32px 32px 32px;
    flex-direction: column;
    align-items: flex-start;
    gap: 22px;

    .upgrade-pay-plan-header {
      color: var(--colors-text-text-primary, #FAFAFA);
      font-family: Archivo, Inter, sans-serif;
      font-size: 24px;
      font-style: normal;
      font-weight: 700;
      line-height: normal;

      .upgrade-pay-plan-header-plus {
        background: linear-gradient(270deg, #C481FA 0%, #12A3FC 100%);
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
    }

    .upgrade-pay-plan-title {
      font-family: Archivo;
      font-size: 24px;
      font-style: normal;
      font-weight: 700;
      line-height: normal;
      background: linear-gradient(270deg, #C481FA 0%, #12A3FC 100%);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .description {
      color: var(--colors-text-text-primary, #FAFAFA);
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: 22.4px;
    }

    .features {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 9px;

      .feature-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-xl, 12px);
        align-self: stretch;
        color: var(--colors-text-text-primary, #FAFAFA);
        font-family: Inter;
        font-size: 14px;
        font-style: normal;
        font-weight: 500;
        line-height: 20px;
      }
    }

    .upgrade-pay-plan-btn-group {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      align-self: stretch;
      margin-top: auto;
    }
  }

  .right {
    width: 464px;
    padding: 24px 32px 32px 32px;
    background-image: url('/images/payments/sirio.svg');
    background-position: center;
    background-color: #fff;

    .upgrade-pay-plan-right-content {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .upgrade-pay-plan-right-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      align-self: stretch;

      .close-btn {
        width: 40px;
        height: 40px;
        padding: 8px;
        border-radius: 50%;
        cursor: pointer;
        transition: background 0.15s;
        color: #575D60;

        &:hover {
          background: #e3dcdc;
        }
      }
    }

    .title {
      color: #111213;
      font-family: Inter;
      font-size: 16px;
      font-style: normal;
      font-weight: 600;
      line-height: 20px;
    }

    .description {
      color: #575D60;
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: 22px;
      white-space: pre-line;
    }

    .picture {
      width: 100%;
      position: relative;
      overflow: hidden;
    }

    .indicator-list {
      display: flex;
      width: 180px;
      align-items: center;
      gap: 4px;
      margin: 16px 0 20px 0;

      .indicator-item {
        height: 4px;
        flex: 1 0 0;
        border-radius: 4px;
        background: var(--Colors-Alpha-alpha-black-10, rgba(0, 0, 0, 0.10));
        cursor: pointer;

        &.active {
          background-color: #fff;
        }
      }
    }


    img {
      height: 333px;
      user-select: none;
      -webkit-user-drag: none;
    }

    :deep(.p-galleria) {
      border: none;

      .p-galleria-indicator-list {
        background-color: transparent;

        .p-galleria-indicator-button {
          width: 30px;
          height: 4px;
          border-radius: 4px;
        }
      }
    }
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.25s ease-out;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}
</style>
