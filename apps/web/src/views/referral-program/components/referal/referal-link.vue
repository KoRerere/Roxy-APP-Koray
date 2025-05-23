<script setup lang="ts">
import type { UserGetBannerPictureListListData, UserGetPromotionInfoListData } from '@roxy/backend-api';
import { API } from '/@/api';
import { RxAlert } from '/@/components/rx-alert/'
import { RxCopyContent } from '/@/components/rx-copy';
import { RxSvgIcon } from '/@/components/rx-icon';
import { $t } from '/@/locales';

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
        <RxAlert v-if="isLocked(activeMenu.linkStatus)" type="warn" :title="$t('近 30 天名下用户消费金额达到${amount}时永久解锁', { amount: activeMenu.purchaseTotalAmount })" :closable="false" class="w-full" />
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
            <Image :src="currentBannerImage.image_1x" alt="Image" preview :pt="{ toolbar: { class: '!hidden' }, previewMask: { class: 'rounded-[4px]' } }">
              <template #original="slotProps">
                <img :src="currentBannerImage.image_1x" :srcset="`${currentBannerImage.image_1x} 1x, ${currentBannerImage.image_2x} 2x`" alt="preview" :style="slotProps.style"
                  @click.stop="slotProps.previewCallback" />
              </template>
            </Image>
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
      color: #000;
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

        &:is(:hover, .active) {
          color: var(--Color-blue-300, #12A3FC);
          background: #D6ECFA;
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
    border-left: 1px solid #E0E0E0;

    .row {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      align-self: stretch;

      .title {
        color: #000;
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
      color: var(--Colors-Text-text-secondary, #575D61);
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: 20px;

      .ratio {
        color: var(--Color-yellow-300, #FC9D12);
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
      background: var(--Color-neutrals-100, #F0F3F5);

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
