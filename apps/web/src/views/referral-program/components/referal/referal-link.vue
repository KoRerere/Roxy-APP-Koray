<script setup lang="tsx">
import RxTooltip from '/@/components/rx-tooltip/index.vue'
import { RxCopyContent } from '/@/components/rx-copy'
import { RxSvgIcon } from '/@/components/rx-icon'
import { useUserStore } from '/@/stores/user'
import { useResponseToast } from '/@/hooks/useResponseToast'
import currency from 'currency.js'
import { API } from '/@/api'
import type { UserGetBannerPictureListV2ListData, UserGetPromotionInfoListData } from '@roxy/backend-api'

const { promotionInfo } = defineProps<{
  promotionInfo: UserGetPromotionInfoListData['data']
}>()

const { mixpanelTrack } = useUserStore()
const [_, onlyErrorToast] = useResponseToast()

const activeMenu = ref(promotionInfo.promotionLinkList[0]!)
const bannerList = ref<UserGetBannerPictureListV2ListData['data']>()
const selectBannerSize = ref('')
const dataPreformanceValue = ref()
const maxNumber = 999999

const detailPopover = useTemplateRef('detail')

const dataPreformance = computed(() => {
  return [
    {
      title: $t('链接点击次数'),
      total: dataPreformanceValue.value?.promotionClickCount || 0,
      // todayCount: dataPreformanceValue.value?.todayPromotionClickCount || 0,
    },
    {
      title: $t('名下用户'),
      total: dataPreformanceValue.value?.registeredUserNum || 0,
      // todayCount: dataPreformanceValue.value?.todayRegisteredUserNum || 0,
    },
    {
      title: $t('充值用户'),
      total: dataPreformanceValue.value?.purchaseUserNum || 0,
      // todayCount: dataPreformanceValue.value?.todayPurchaseUserNum || 0,
    },
    {
      title: $t('近 30 天名下用户消费金额'),
      total: Math.min(dataPreformanceValue.value?.purchaseUserTotalAmount || 0, maxNumber),
      /**
       * todayCount: 0,
       */
      format(val: number) {
        return currency(val).format()
      },
    },
    {
      title: $t('审核中'),
      total: dataPreformanceValue.value?.pendingAmount || 0,
      // todayCount: 0,
      tootip: $t('消费后 7 天内完成审核'),
      format(val: number) {
        return currency(val).format()
      },
    },
    {
      title: $t('已审核奖励'),
      total: Math.min(maxNumber, dataPreformanceValue.value?.awardsReviewed || 0),
      // todayCount: dataPreformanceValue.value?.todayAwardsReviewed || 0,
      style: {
        color: '#12A3FC',
      },
      format(val: number) {
        return currency(val).format()
      },
    },
  ]
})
const referralLink = computed(() => {
  return activeMenu.value.promotionLink
})
const currentBannerImage = computed(() => {
  return bannerList.value?.find(item => item.size === selectBannerSize.value)
})
const bannerImagePreviewHtmlCode = computed(() => {
  const { image_1x, image_2x } = currentBannerImage.value || {}
  const srcset = `${image_1x} 1x, ${image_2x} 2x`
  return `<a href="${referralLink.value}" target="_blank"> <img src="${image_1x}" alt="${referralLink.value}" srcset="${srcset}"> </a>`
})
const bonusList = computed(() => {
  const targetMenu = promotionInfo.promotionLinkList.find(item => item.linkType === activeMenu.value.linkType)
  return [
    {
      icon: 'referral-program/rx_referral_coin',
      title: $t('您将获得'),
      desc: $t('{ratio} 消费金额', { ratio: '{ratio}' }),
      ratio: targetMenu?.promotionDiscount,
      class: 'get',
    },
    {
      icon: 'referral-program/rx_referral_discount',
      title: $t('他们得到'),
      desc: $t('{ratio} 消费优惠', { ratio: '{ratio}' }),
      ratio: targetMenu?.userDiscount,
      class: 'give',
    },
  ]
})

watch(activeMenu, () => {
  getBannerPictureList()
  getPromotionInfoByTypeList()
}, { immediate: true })

function DataPreformance(props: any) {
  return (
    <div class="flex justify-between items-center px-3 py-2.5 rounded-1 bg-[var(--colors-background-bg-page)] gap-2">
      <RxTooltip class="ellipsis-1">
        {{
          default: () => (
            <span class="text-14px text-[var(--colors-text-text-tertiary)] text-3.5 font-500 ellipsis-1">
              {props.title}
              :
            </span>
          ),
          content: () => <span class="text-white">{props.title}</span>,
        }}
      </RxTooltip>
      <span class="flex items-center gap-2.5">
        {props.todayCount > 0
          ? (
              <span class="text-[var(--colors-text-text-success)] text-3 font-500">
                +
                {props.format ? props.format(props.todayCount) : props.todayCount}
              </span>
            )
          : <></>}
        <span class="text-[var(--colors-text-text-primary)] text-4 font-700" style={props.style}>
          {props.format ? props.format(props.total) : props.total}
        </span>
      </span>
    </div>
  )
}

async function getBannerPictureList() {
  const { code, data } = await API.base.userGetBannerPictureListV2List({ linkType: activeMenu.value.linkType?.replace(' ', '_') })
  if (code === 0) {
    bannerList.value = data
    selectBannerSize.value = bannerList.value[0]?.size || ''
  }
}

async function getPromotionInfoByTypeList() {
  const { code, data } = await API.base.userGetPromotionInfoByTypeList({
    linkType: activeMenu.value.linkType?.replace(' ', '_'),
  })
  if (code === 0) {
    dataPreformanceValue.value = data
  }
}

async function toggleInviteDetail() {
  const { code, msg } = await API.base.userSetPromotionLinkShowCreate({
    promotionCode: activeMenu.value.promotionCode,
    isShow: activeMenu.value.isShow === 1 ? 0 : 1,
  })
  onlyErrorToast(code, msg)
  return code === 0
}

function showDetail(event: Event) {
  detailPopover.value?.instance?.toggle(event)
}

function isLocked(linkStatus: number) {
  return linkStatus === 0
}
</script>

<template>
  <div class="referal-link-container">
    <aside>
      <div class="referal-title">
        {{ $t('选择推广链接') }}
      </div>
      <div class="flex flex-col items-start self-stretch gap-3">
        <div v-for="menu in promotionInfo.promotionLinkList" :key="menu.linkType" class="flex items-center self-stretch py-2 px-3 gap-3 rounded cursor-pointer menu-item"
             :class="{ active: activeMenu.linkType === menu.linkType }" @click="activeMenu = menu"
        >
          <RxSvgIcon :class="{ invisible: !isLocked(menu.linkStatus!) }" name="base/rx_ic_lock" color="var(--colors-icon-icon-note)" />
          <div class="flex-1">
            {{ menu.linkType }}
          </div>
          <CircleProgress v-if="isLocked(menu.linkStatus!)" :value="(menu.completed_count! / menu.total_count!) * 100" size="20" stroke-width="4" />
        </div>
      </div>
    </aside>
    <div class="content">
      <div class="row">
        <div class="self-stretch flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="referal-title">{{ activeMenu.linkType }}</span>
            <span v-if="isLocked(activeMenu.linkStatus!)" class="referal-unlocked">({{ $t('邀请 {count} 人订阅后解锁', { count: activeMenu.total_count }) }})</span>
          </div>
          <div v-if="!isLocked(activeMenu.linkStatus!)" class="inline-flex items-center gap-2">
            <RxToggleSwitch v-model="activeMenu.isShow" :true-value="1" :false-value="0" :before-change="toggleInviteDetail" />
            <div class="detail-invite">
              {{ $t('显示邀请详情') }}
            </div>
            <span class="flex items-center justify-center cursor-pointer" @click="showDetail">
              <SvgIcon class="pointer-events-none" name="base/rx_ic_info" color="var(--colors-icon-icon-tertiary)" />
            </span>
          </div>
        </div>
        <div v-if="isLocked(activeMenu.linkStatus!)" class="w-full flex items-center gap-3">
          <div class="referal-desc">
            {{ $t('用户邀请数据:') }}
          </div>
          <Usage class="flex-1 gap-1.5 referal-progress" :ratio="(activeMenu.completed_count! / activeMenu.total_count!)" :block-count="Math.min(10, activeMenu.total_count!)"
                 default-color="var(--colors-border-border-inactive)"
                 :color-level="{ normal: 'var(--component-alert-announcement-border-success)', weak: 'var(--component-alert-announcement-border-success)' }"
          />
          <div class="flex items-baseline gap-1">
            <span class="referal-value">{{ activeMenu.completed_count }}</span>
            <span class="referal-need">/{{ activeMenu.total_count }}</span>
          </div>
        </div>
        <RxCopyContent :text="referralLink!" :mask="isLocked(activeMenu.linkStatus!)" @copy-success="mixpanelTrack('promotion_link_copy')" />
        <div class="desc">
          {{ $t('受邀用户消费时:') }}
        </div>
        <div class="w-full flex gap-2.5">
          <div v-for="item in bonusList" :key="item.title" class="relative flex-1 h-22 flex flex-col justify-center py-3 px-4 rounded-md bonus" :class="item.class">
            <SvgIcon class="absolute right-0 top-0" :name="(item.icon as any)" size="88" />
            <div class="bonus-title">
              {{ item.title }}
            </div>
            <i18n-t class="bonus-desc" tag="div" scope="global" :keypath="item.desc">
              <template #ratio>
                <span class="bonus-ratio">{{ item.ratio }}%</span>
              </template>
            </i18n-t>
          </div>
        </div>
        <div class="tips">
          {{ $t('受邀用户购买代理 IP 不参与消费金额奖励') }}
        </div>
      </div>
      <template v-if="!isLocked(activeMenu.linkStatus!)">
        <div class="row">
          <div class="title">
            {{ $t('数据统计') }}
          </div>
          <div class="grid grid-cols-10 gap-3 w-full">
            <div class="flex flex-col gap-2.5 bg-[var(--colors-background-bg-block)] rounded-1.5 col-span-10 p-2 lg:col-span-4">
              <DataPreformance v-for="i in 3" :key="i" v-bind="dataPreformance[i - 1]" />
            </div>
            <div class="flex flex-col gap-2.5 bg-[var(--colors-background-bg-block)] rounded-1.5 col-span-10 p-2 lg:col-span-6">
              <DataPreformance v-for="i in 3" :key="i" v-bind="dataPreformance[i + 2]" />
            </div>
          </div>
        </div>

        <div class="row">
          <div class="title">
            {{ $t('推广宣传图（建站用户专用）') }}
          </div>
          <div class="banner-sizes">
            <div v-for="item in bannerList" :key="item.size" class="banner-size-item">
              <RadioButton v-model="selectBannerSize" :input-id="item.size" name="dynamic" :value="item.size" />
              <label :for="item.size" class="banner-size-label">{{ item.size }}</label>
            </div>
          </div>
          <div class="banner-preview-container">
            <div v-if="currentBannerImage" class="banner-preview">
              <RxImage :src="currentBannerImage.image_1x" :download-link="currentBannerImage.image_2x" class="p-3">
                <template #original>
                  <img :src="currentBannerImage.image_1x" :srcset="`${currentBannerImage.image_1x} 1x, ${currentBannerImage.image_2x} 2x`" alt="preview">
                </template>
              </RxImage>
            </div>
            <RxCopyContent :text="bannerImagePreviewHtmlCode" :mask="isLocked(activeMenu.linkStatus!)" class="flex-1" />
          </div>
        </div>
      </template>
    </div>

    <RyPopover ref="detail">
      <div class="w-120 flex flex-col gap-1 pa-3">
        <div class="detail-title">
          {{ $t('邀请详情') }}
        </div>
        <div class="detail-desc">
          {{ $t('在注册或登录页面上显示邀请者和适用的折扣。') }}
        </div>
        <video class="block w-full mt-1 rounded-md" autoplay muted loop playsinline>
          <source src="/video/invite_tips_guide.mp4" type="video/webm">
        </video>
      </div>
    </RyPopover>
  </div>
</template>

<style lang="scss" scoped>
.referal-link-container {
  display: flex;
  align-items: flex-start;

  aside {
    display: flex;
    width: 224px;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding-right: 27px;
  }

  .content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 36px;
    align-self: stretch;
    flex: 3;
    padding-left: 27px;
    border-left: 1px solid var(--colors-border-border-inactive, #293038);

    .row {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      align-self: stretch;

      .title {
        color: var(--colors-text-text-primary, #fafafa);
        font-family: Inter;
        font-size: 14px;
        font-style: normal;
        font-weight: 600;
        line-height: 20px;
        margin-bottom: 4px;
      }
    }
  }

  .banner-sizes {
    width: 100%;
    display: grid;
    gap: var(--spacing-md, 6px);
    grid-template-columns: repeat(4, 1fr);

    @media (max-width: 1090px) {
      grid-template-columns: repeat(4, 1fr);
    }

    .banner-size-item {
      width: 45%;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 2px 4px 2px 6px;
    }

    .banner-size-label {
      color: var(--colors-text-text-primary, #111213);
      font-family: Inter;
      font-size: 13px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-xs, 16px);
      cursor: pointer;
    }
  }

  .banner-preview-container {
    display: flex;
    gap: 12px;
    height: 192px;

    .banner-preview {
      flex: 1;
      height: 100%;
      border-radius: 4px;
      background: var(--colors-background-bg-block, #293038);

      :deep(.p-image) {
        width: 100%;
        height: 100%;
        padding: 12px;

        img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: 50% 50%;

          &:not([src]) {
            visibility: hidden;
          }
        }
      }
    }
  }
}

.menu {
  &-item {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    transition: all 0.2s ease;

    &:is(:hover, .active) {
      color: var(--pattern-sidenav-text-active);
      font-weight: 600;
      background: var(--pattern-sidenav-bg-active);
    }
  }
}

.referal {
  &-title {
    color: var(--colors-text-text-primary);
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
  }

  &-unlocked {
    color: var(--colors-text-text-secondary);
    font-size: 16px;
    line-height: 24px;
  }

  &-desc {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }

  &-progress {
    :deep(.color-block) {
      height: 6px;
      border-radius: 100px;
    }
  }

  &-value {
    color: var(--colors-text-text-primary);
    font-size: 18px;
    font-weight: 500;
    line-height: 24px;
  }

  &-need {
    color: var(--colors-text-text-inactive);
    font-size: 14px;
    font-weight: 500;
    line-height: 22px;
  }
}

.detail {
  &-invite {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
  }

  &-desc {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    line-height: 20px;
  }
}

.desc {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
}

.tips {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 18px;
}

.bonus {
  &.get {
    border: 1px solid var(--pattern-dashboard-card-border-card-referral);
    background: linear-gradient(
      90deg,
      var(--pattern-dashboard-card-bg-card-referral-1) 0%,
      var(--pattern-dashboard-card-bg-card-referral-2) 100%
    );
  }

  &.give {
    border: 1px solid var(--pattern-dashboard-card-border-card-bonus);
    background: linear-gradient(
      90deg,
      var(--pattern-dashboard-card-bg-card-bonust-1) 0%,
      var(--pattern-dashboard-card-bg-card-bonus-2) 100%
    );
  }

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }

  &-desc {
    color: var(--colors-text-text-inactive);
    font-size: 14px;
    line-height: 24px;
  }

  &-ratio {
    color: var(--colors-text-text-warning);
    font-size: 24px;
    font-weight: 700;
    line-height: 32px;
  }
}
</style>
