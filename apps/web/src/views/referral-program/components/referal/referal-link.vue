<script setup lang="tsx">
import { h } from 'vue'
import NewReferralModal from '/@/views/referral-program/components/new-referral-modal.vue'
import EditPromotionCodeModal from './edit-promotion-code-modal.vue'
import QrcodeModal from './qrcode-modal.vue'
import RankList from './rank-list.vue'
import { useReferralProgram } from '../../useContext'
import { RxCopyContent } from '/@/components/rx-copy'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'
import { useDialog } from '/@/hooks/useDialog'
import { API } from '/@/api'
import { copyText, genDriver, getLocalStorageDriverStatus, setLocalStorageDriverStatus } from '/@/utils'
import type { UserGetBannerPictureListV2ListData, UserGetPromotionInfoListData } from '@roxy/backend-api'

const { promotionInfo } = defineProps<{
  promotionInfo: UserGetPromotionInfoListData['data']
}>()

const { isZh } = storeToRefs(useSimpleLocale())
const { getVideoSource } = useSimpleLocale()
const { mixpanelTrack } = useUserStore()
const [showToast, onlyErrorToast] = useResponseToast()
const [showModal] = useDialog()
const { getPromotionInfo } = useReferralProgram()
const { onboardingTaskStatus, updateOnboardingTaskStatus } = useOnboardingTaskStatus()
const activeMenu = ref(promotionInfo.promotionLinkList[0]!)
const bannerList = ref<UserGetBannerPictureListV2ListData['data']>()
const selectBannerSize = ref('')
const dataPreformanceValue = ref()

const detailPopover = useTemplateRef('detail')

const referralLink = computed(() => {
  return activeMenu.value.promotionLink
})

const currentBannerImage = computed(() => {
  return bannerList.value?.find(item => item.size === selectBannerSize.value)
})

const bannerImagePreviewHtmlCode = computed(() => {
  const { image_1x, image_2x } = currentBannerImage.value || {}
  const srcset = `${image_1x} 1x, ${image_2x} 2x`
  return `<a href="${referralLink.value}" target="_blank" rel="noopener noreferrer"> <img src="${image_1x}" alt="${referralLink.value}" srcset="${srcset}"> </a>`
})

const bonusList = computed(() => {
  return [
    {
      id: 1,
      icon: 'referral-program/rx_illustration_coin2',
      title: $t('您将获得'),
      class: 'flex-3/4 get',
      isNew: true,
      items: [
        {
          title: `${activeMenu.value.promotionDiscount}%`,
          desc: $t('窗口/团队/成员消费返利'),
          class: '',
        },
        {
          title: '+',
          class: 'flex-none',
        },
        {
          title: `${activeMenu.value.proxyPromotionDiscount}%`,
          desc: $t('代理 IP 消费返利'),
          class: '',
        },
        {
          title: '+',
          class: 'flex-none',
        },
        {
          title: `${activeMenu.value.pointsPromotionDiscount}%`,
          desc: $t('AI Agent\n积分返利'),
          class: '',
        },
      ],
    },
    {
      id: 2,
      icon: 'referral-program/rx_illustration_discount',
      title: $t('他们得到'),
      class: 'flex-1/4 give',
      items: [
        {
          title: `${activeMenu.value.userDiscount}%`,
          desc: $t('消费优惠\n* Agent 积分除外'),
          class: '',
        },
      ],
    },
  ]
})

const communityQrcodeList = computed(() => {
  const channel = isZh.value ? 'Wechat' : 'Telegram'
  return [{ name: channel, value: promotionInfo.businessManagerQrCode[channel as keyof typeof promotionInfo.businessManagerQrCode] }]
})

watch(activeMenu, () => {
  getBannerPictureList()
  getPromotionInfoByTypeList()
}, { immediate: true })

watch(() => promotionInfo.promotionLinkList, (list) => {
  const matched = list?.find(item => item.linkType === activeMenu.value.linkType)
  if (matched)
    activeMenu.value = matched
}, { deep: true })

onMounted(() => {
  showNewInfo()
})

async function showNewInfo() {
  if (onboardingTaskStatus.value?.promotionLinkRevampReminderStatus !== false) {
    // focusReward()
    return
  }

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    handleCancel: () => updateOnboardingTaskStatus({ promotionLinkRevampReminderStatus: true } as any),
    slots: {
      container: ({ hideModal }) => h(NewReferralModal, {
        onClose: () => {
          // focusReward()
          hideModal()
        },
      }),
    },
  })
}

function _focusReward() {
  if (getLocalStorageDriverStatus('referralProgram'))
    return

  genDriver({
    steps: [
      { element: '.get', popover: { description: $t('您现在可以获得名下用户的代理 IP 消费返利了。'), side: 'right', align: 'center' } },
    ],
    onDestroyed: () => {
      setLocalStorageDriverStatus('referralProgram', true)
    },
  }).drive()
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
// =====================

const referral = computed(() => [
  {
    value: referralLink.value!,
    label: $t('邀请链接:'),
    tooltip: $t('通过此链接注册即可成为您名下用户'),
    trackName: 'promotion_link_copy',
    editable: true,
  },
  {
    value: activeMenu.value.promotionCode!,
    label: $t('邀请码:'),
    tooltip: $t('注册时填写此邀请码即可成为您名下用户'),
    trackName: 'promotion_link_copy',
    editable: true,
  },
])

function copyReferral(copyStr: string, trackName: string) {
  mixpanelTrack(trackName)
  copyText(copyStr)
  showToast(0, $t('复制成功'))
}

function openEditPromotionCodeModal() {
  mixpanelTrack('promotion_code_edit')
  showModal({
    header: $t('修改邀请码'),
    class: 'w-[486px]',
    slots: {
      default: ({ handleCancel }) => h(EditPromotionCodeModal, {
        promotionCode: activeMenu.value.promotionCode!,
        promotionLink: activeMenu.value.promotionLink!,
        nextModifyTime: activeMenu.value.nextModifyTime,
        hideFn: handleCancel,
        onSuccess: getPromotionInfo,
      }),
      footer: undefined,
    },
  })
}

/** 商务经理联系二维码（中文微信 / 非中文 Telegram），与全局帮助入口策略一致 */

function openCommunity() {
  const list = communityQrcodeList.value
  console.log('🚀 ~ openCommunity ~ list:', list)
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(QrcodeModal, {
        list,
        defaultActive: list[0],
        onClose: hideModal,
      }),
    },
  })
}
</script>

<template>
  <div class="flex items-start gap-6">
    <div class="flex-1 flex flex-col items-start gap-9 items-stretch overflow-hidden">
      <div class="flex flex-col items-start gap-3 self-stretch">
        <div class="w-full flex justify-between items-center">
          <div class="tt-primary text-4 font-600 leading-6">
            {{ $t('邀请链接 & 邀请码') }}
          </div>
          <div class="inline-flex items-center gap-2">
            <RxToggleSwitch v-model="activeMenu.isShow" :true-value="1" :false-value="0" :before-change="toggleInviteDetail" />
            <div class="detail-invite">
              {{ $t('显示邀请详情') }}
            </div>
            <span class="flex items-center justify-center cursor-pointer" @click="showDetail">
              <SvgIcon class="pointer-events-none" name="base/rx_ic_info" color="var(--colors-icon-icon-tertiary)" />
            </span>
          </div>
        </div>
        <RxDivider line-only line-color="var(--colors-border-border-inactive)" />
        <div class="w-full flex flex-col gap-4">
          <div v-for="item in referral" :key="item.value">
            <div class=" tt-primary text-3.5 font-500 leading-5 flex items-center gap-1">
              {{ item.label }}
              <span v-tooltip.top="item.tooltip" class="inline-flex ">
                <SvgIcon class="pointer-events-none" name="base/rx_ic_info" color="var(--colors-icon-icon-tertiary)" />
              </span>
            </div>
            <div class="mt-2 flex gap-3">
              <div class="flex-1 flex items-center pa-2.5 pl-4 color-white font-[JetBrains_Mono] text-3.5 font-500 rounded-1.5 bg-[var(--pattern-editor-bg)]">
                {{ item.value }}
              </div>
              <RxButton size="lg" :label="$t('复制')" icon="base/rx_ic_copy" @click="copyReferral(item.value, item.trackName)" />
              <RxButton
                v-if="item.editable"
                v-tooltip.top="$t('编辑')"
                size="md"
                severity="secondary"
                outlined
                icon="base/rx_ic_edit"
                @click="openEditPromotionCodeModal"
              />
            </div>
          </div>
        </div>
        <div class="w-full flex gap-2.5 bonus">
          <div v-for="item in bonusList" :key="item.id" class="w-full flex flex-col gap-2" :class="item.class">
            <div class="bonus-title">
              {{ item.title }}:
            </div>
            <div class="relative flex-1 h-22 flex gap-5 py-3 px-4 rounded-md bonus-content">
              <SvgIcon class="absolute right-0 top-0" :name="(item.icon as any)" size="88" />
              <div v-if="item.isNew" class="absolute -right-2 position-y-center top-0 py-0.5 px-2 rounded-full bonus-new">
                New
              </div>
              <div v-for="(it, idx) in item.items" :key="idx" class="relative flex-1 z-1" :class="it.class">
                <div class="bonus-ratio">
                  {{ it.title }}
                </div>
                <div v-if="it.desc" class="bonus-desc whitespace-pre-wrap">
                  {{ it.desc }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <i18n-t class="tt-secondary text-3.25 font-400 leading-5 whitespace-pre-line ml-auto" tag="div" scope="global" :keypath="$t('希望获取更高返利？请 {link} 最高获得30%返利。', { link: '{link}' })">
          <template #link>
            <span class="tt-brand cursor-pointer" role="button" tabindex="0" @click="openCommunity">{{ $t('添加商务经理') }}</span>
          </template>
        </i18n-t>
      </div>
      <div class="flex flex-col items-start gap-3 self-stretch">
        <div class="tt-primary font-600 text-3.5 leading-5 mb-1">
          {{ $t('推广宣传图（建站用户专用）') }}
        </div>
        <div class="banner-sizes">
          <div v-for="item in bannerList" :key="item.size" class="banner-size-item">
            <RadioButton v-model="selectBannerSize" :input-id="item.size" name="dynamic" :value="item.size" />
            <label :for="item.size" class="banner-size-label">{{ item.size }}</label>
          </div>
        </div>
        <div class="relative flex gap-3 h-50">
          <div class="flex-1 flex shrink-0 overflow-hidden pa-3 rounded-1 bg-[var(--colors-background-bg-block)]">
            <RxImage v-if="currentBannerImage" class="w-full h-full object-contain object-center [&:not([src])]:invisible" container-class="w-full" :src="currentBannerImage.image_1x"
                     :download-link="currentBannerImage.image_2x" preview
            >
              <template #original>
                <img :src="currentBannerImage.image_1x" :srcset="`${currentBannerImage.image_1x} 1x, ${currentBannerImage.image_2x} 2x`">
              </template>
            </RxImage>
          </div>
          <RxCopyContent :text="bannerImagePreviewHtmlCode" class="flex-1" />
        </div>
      </div>
    </div>
    <RxDivider vertical line-only line-color="var(--colors-border-border-inactive)" />
    <div class="w-100 overflow-hidden">
      <RankList />
    </div>

    <RyPopover ref="detail">
      <div class="w-120 h-334px flex flex-col gap-1 pa-3">
        <div class="detail-title">
          {{ $t('邀请详情') }}
        </div>
        <div class="detail-desc">
          {{ $t('在注册或登录页面上显示邀请者和适用的折扣。') }}
        </div>
        <video class="block w-full mt-1 rounded-md" autoplay muted loop playsinline>
          <source :src="getVideoSource('invite_tips_guide.mp4')" type="video/webm">
        </video>
      </div>
    </RyPopover>
  </div>
</template>

<style lang="scss" scoped>
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
    color: var(--colors-text-text-primary);
    font-size: 13px;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
    cursor: pointer;
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

.get .bonus-content {
  border: 1px solid var(--pattern-dashboard-card-border-card-referral);
  background: linear-gradient(
    90deg,
    var(--pattern-dashboard-card-bg-card-referral-1) 0%,
    var(--pattern-dashboard-card-bg-card-referral-2) 100%
  );
}

.give .bonus-content {
  border: 1px solid var(--pattern-dashboard-card-border-card-bonus);
  background: linear-gradient(
    90deg,
    var(--pattern-dashboard-card-bg-card-bonust-1) 0%,
    var(--pattern-dashboard-card-bg-card-bonus-2) 100%
  );

  .bonus-ratio {
    color: var(--colors-text-text-brand);
  }
}

.bonus {
  &-new {
    color: #fff;
    font-family: 'DingTalk JinBuTi';
    font-size: 12px;
    background: var(--colors-background-bg-error);
    line-height: normal;
  }

  &-title {
    color: var(--colors-text-text-primary);
    font-size: 13px;
    font-weight: 500;
    line-height: 18px;
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
