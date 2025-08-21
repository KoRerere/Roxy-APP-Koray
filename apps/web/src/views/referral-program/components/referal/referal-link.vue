<script setup lang="tsx">
import type { UserGetBannerPictureListListData, UserGetPromotionInfoListData, UserGetPromotionInfoByTypeListData } from '@roxy/backend-api';
import { API } from '/@/api';
import { RxAlert } from '/@/components/rx-alert/'
import { RxCopyContent } from '/@/components/rx-copy';
import { RxSvgIcon } from '/@/components/rx-icon';
import { $t } from '/@/locales';
import currency from 'currency.js';
import RxTooltip from '/@/components/rx-tooltip/index.vue';

const { promotionInfo } = defineProps<{
  promotionInfo: UserGetPromotionInfoListData['data']
}>()


const activeMenu = ref(promotionInfo.promotionLinkList[0])
const bannerList = ref<UserGetBannerPictureListListData['data'][number]['images']>([])
const selectBannerSize = ref('')

const referralLink = computed(() => {
  return activeMenu.value.promotionLink
})

const currentBannerImage = computed(() => {
  return bannerList.value.find(item => item.size === selectBannerSize.value) || {}
})


const bannerImagePreviewHtmlCode = computed(() => {
  const { image_1x, image_2x } = currentBannerImage.value
  const srcset = `${image_1x} 1x, ${image_2x} 2x`
  return `<a href="${referralLink.value}" target="_blank"> <img src="${image_1x}" alt="${referralLink.value}" srcset="${srcset}"> </a>`
})

const benefitList = computed(() => {
  const targetMenu = promotionInfo.promotionLinkList.find(item => item.linkType === activeMenu.value.linkType)
  return [
    {
      title: $t('您将获取的推广奖励: {ratio} 名下用户消费金额', { ratio: '{ratio}' }),
      ratio: targetMenu?.promotionDiscount,
    },
    {
      title: $t('您邀请的用户将获取: {ratio} 永久账号消费优惠', { ratio: '{ratio}' }),
      ratio: targetMenu?.userDiscount,
    },
  ]
})

watch(activeMenu, getBannerPictureList, { immediate: true })

async function getBannerPictureList() {
  const { code, data } = await API.base.userGetBannerPictureListV2List({ linkType: activeMenu.value.linkType?.replace(' ', '_') })
  if (code === 0) {
    bannerList.value = data
    selectBannerSize.value = bannerList.value[0].size
  }
}

function isLocked(linkStatus: number) {
  return linkStatus === 0
}

const dataPreformanceValue = ref<UserGetPromotionInfoByTypeListData['data']>()
const maxNumber = 999999
const dataPreformance = computed(() => ([
  {
    title: $t('链接点击次数'),
    total: dataPreformanceValue.value?.promotionClickCount || 0,
    todayCount: dataPreformanceValue.value?.todayPromotionClickCount || 0,
  },
  {
    title: $t('名下用户'),
    total: dataPreformanceValue.value?.registeredUserNum || 0,
    todayCount: dataPreformanceValue.value?.todayRegisteredUserNum || 0,
  },
  {
    title: $t('充值用户'),
    total: dataPreformanceValue.value?.purchaseUserNum || 0,
    todayCount: dataPreformanceValue.value?.todayPurchaseUserNum || 0,
  },
  {
    title: $t('近 30 天名下用户消费金额'),
    total: Math.min(dataPreformanceValue.value?.purchaseUserTotalAmount || 0, maxNumber),
    todayCount: 0,
    format(val: number) {
      return currency(val).format()
    }
  },
  {
    title: $t('审核中'),
    total: dataPreformanceValue.value?.pendingAmount || 0,
    todayCount: 0,
    tootip: $t('消费后 7 天内完成审核'),
    format(val: number) {
      return currency(val).format()
    }
  },
  {
    title: $t('已审核奖励'),
    total: Math.min(maxNumber, dataPreformanceValue.value?.awardsReviewed || 0),
    todayCount: dataPreformanceValue.value?.todayAwardsReviewed || 0,
    style: {
      color: '#12A3FC',
    },
    format(val: number) {
      return currency(val).format()
    }
  },
]))

const DataPreformance = (props: any) => {
  return <div class="flex justify-between items-center px-3 py-2.5 rounded-1 bg-[var(--colors-background-bg-page)] gap-2">
    <RxTooltip class="ellipsis-1">
      {{
        default: () => <span class="text-14px text-[var(--colors-text-text-tertiary)] text-3.5 font-500 ellipsis-1">
          {props.title}:
        </span>, content: () => <span class="text-white">{props.title}</span>
      }}
    </RxTooltip>
    <span class="flex items-center gap-2.5">
      {props.todayCount > 0 ? <span class="text-[var(--colors-text-text-success)] text-3 font-500">
        +{props.format ? props.format(props.todayCount) : props.todayCount}</span> : <></>}
      <span class="text-[var(--colors-text-text-primary)] text-4 font-700" style={props.style}>
        {props.format ? props.format(props.total) : props.total}
      </span>
    </span>
  </div>
}

watch(activeMenu, (val) => {
  API.base.userGetPromotionInfoByTypeList({
    linkType: activeMenu.value.linkType?.replace(' ', '_')
  }).then(({ code, data }) => {
    if (code === 0) {
      dataPreformanceValue.value = data
    }
  })
}, { immediate: true })

</script>

<template>
  <div class="referal-link-container">
    <aside>
      <div class="title">{{ $t('选择推广链接') }}</div>
      <div class="menu">
        <template v-for="menu in promotionInfo.promotionLinkList" :key="menu.linkType">
          <div class="menu-item" :class="{ active: activeMenu.linkType === menu.linkType }" @click="activeMenu = menu">
            {{ menu.linkType }}
            <template v-if="isLocked(menu.linkStatus)">
              <RxSvgIcon name="base/rx_ic_lock" />
            </template>
          </div>
        </template>
      </div>
    </aside>
    <div class="content">
      <div class="row">
        <RxAlert v-if="isLocked(activeMenu.linkStatus)" type="warn"
          :title="$t('近 30 天名下用户消费金额达到${amount}时永久解锁', { amount: activeMenu.purchaseTotalAmount })" :closable="false"
          class="w-full" />
        <div class="title">{{ $t('推广链接') }}</div>
        <RxCopyContent :text="referralLink" :mask="isLocked(activeMenu.linkStatus)" />
        <div class="benefit">
          <template v-for="benefit in benefitList" :key="benefit">
            <div class="benefit-item">
              <RxSvgIcon name="base/rx_ic_check_fill" color="#1CC94D" />
              <div>
                <i18n-t :keypath="benefit.title" scope="global">
                  <template #ratio>
                    <span class="ratio">{{ benefit.ratio }}%</span>
                  </template>
                </i18n-t>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div class="row">
        <div class="title">{{ $t('数据统计') }}</div>
        <div class="grid grid-cols-10 gap-3 w-full">
          <div
            class="flex flex-col gap-2.5 bg-[var(--colors-background-bg-block)] rounded-1.5 col-span-10 p-2 lg:col-span-4">
            <DataPreformance v-for="i in 3" v-bind="dataPreformance[i - 1]" />
          </div>
          <div
            class="flex flex-col gap-2.5 bg-[var(--colors-background-bg-block)] rounded-1.5 col-span-10 p-2 lg:col-span-6">
            <DataPreformance v-for="i in 3" v-bind="dataPreformance[i + 2]" />
          </div>
        </div>
      </div>

      <div class="row">
        <div class="title">
          {{ $t('推广宣传图（建站用户专用）') }}
        </div>
        <div class="banner-sizes">
          <div v-for="item in bannerList" :key="item.size" class="banner-size-item">
            <RadioButton v-model="selectBannerSize" :inputId="item.size" name="dynamic" :value="item.size" />
            <label :for="item.size" class="banner-size-label">{{ item.size }}</label>
          </div>
        </div>
        <div class="banner-preview-container">
          <div class="banner-preview">
            <RxImage :src="currentBannerImage.image_1x" :download-link="currentBannerImage.image_2x" class="p-3">
              <template #original>
                <img :src="currentBannerImage.image_1x"
                  :srcset="`${currentBannerImage.image_1x} 1x, ${currentBannerImage.image_2x} 2x`" alt="preview" />
              </template>
            </RxImage>
          </div>
          <RxCopyContent :text="bannerImagePreviewHtmlCode" :mask="isLocked(activeMenu.linkStatus)" class="flex-1" />
        </div>
      </div>
    </div>
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

    .title {
      color: var(--colors-text-text-primary, #FAFAFA);
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 600;
      line-height: 20px;
    }

    .menu {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      align-self: stretch;

      .menu-item {
        display: flex;
        padding: 8px 12px;
        gap: var(--spacing-xl, 12px);
        align-items: center;
        align-self: stretch;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;

        &:is(:hover, .active) {
          color: var(--pattern-sidenav-text-active, #3FB6FD);
          background: var(--pattern-sidenav-bg-active, #013D65);
        }
      }
    }
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
        color: var(--colors-text-text-primary, #FAFAFA);
        font-family: Inter;
        font-size: 14px;
        font-style: normal;
        font-weight: 600;
        line-height: 20px;
        margin-bottom: 4px;
      }
    }


  }


  .benefit {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;

    .benefit-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-lg, 8px);
      align-self: stretch;
      color: var(--colors-text-text-secondary, #B2B6B8);
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: 20px;

      .ratio {
        color: var(--primitives-yellow-500, #FC9D12);
        font-family: Inter;
        font-size: 14px;
        font-style: normal;
        font-weight: 600;
        line-height: 20px;
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
</style>
