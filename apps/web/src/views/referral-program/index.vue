<script setup lang="tsx">
import { useToast } from 'primevue/usetoast'
import { $t } from '/@/locales'
import { useUserStore } from '/@/stores/user'
import { copyText } from '/@/utils/'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useColumns } from './columns'
import { API } from '/@/api'
import { format } from 'date-fns'
import type { UserGetBannerPictureListListData } from '@roxy/backend-api'
import { useSimpleLocale } from '/@/stores/locale'

const userStore = useUserStore()
const { userInfo } = storeToRefs(userStore)
const { currentLocale } = useSimpleLocale()
const toast = useToast()
const referralLink = ref('')
const premiumCode = ref('')
const inviteUserCount = ref(0)
const remainTime = ref('')
const bannerList = ref<UserGetBannerPictureListListData['data'][number]['images']>([])
const selectBannerSize = ref('')

const columns = useColumns()

const isFirstShare = computed(() => {
  return !userInfo.value.inviteLink
})

const bannerImagePreviewUrl = computed(() => {
  return bannerList.value.find(item => item.size === selectBannerSize.value)?.image
})

const bannerImagePreviewHtmlCode = computed(() => {
  return `<a href="https://iproyal.com/?r=584937" target="_blank"> <img src="https://dashboard.iproyal.com/img/b/728_1.jpg" alt="https://iproyal.com/"> </a>`
})

async function onCopy(text: string) {
  copyText(text)
  toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('复制成功'), life: 2500 })
}

async function tableRequest() {
  const result = await API.base.userGetInviteUserListList()
  if (result.code === 0) {
    inviteUserCount.value = result.data.total
  }
  return result
}

async function getInviteLink() {
  const { code, data } = await API.base.userGetInviteLinkList()
  if (code === 0) {
    referralLink.value = data.invite_link
  }
}

async function getInviteCode() {
  const { code, data } = await API.base.userGetInviteCodeList()
  if (code === 0) {
    premiumCode.value = data.invite_code
    remainTime.value = format(data.expire_time * 1000, 'yyyy-MM-dd HH:mm')

    if (data.expire_time * 1000 < Date.now()) {
      getInviteCode()
    }
    setTimeout(getInviteCode, data.expire_time * 1000 - Date.now())
  }
}

async function getBannerPictureList() {
  const { code, data } = await API.base.userGetBannerPictureListList()
  if (code === 0) {
    bannerList.value = data.find(item => item.language === currentLocale)?.images || data[0].images
    selectBannerSize.value = bannerList.value[0].size
  }
}

async function showMyLink() {
  const { getUserInfo } = userStore
  await getInviteLink()
  getBannerPictureList()
  // 如果是第一次推广的话，重新获取用户信息更新推广状态
  if (isFirstShare.value) {
    getUserInfo()
    toast.add({ severity: 'success', summary: $t('感谢您参与推广计划'), detail: $t('您当前的窗口创建额度已提升至 30.'), life: 2500 })
  }
}

onBeforeMount(() => {
  // 尚未加入推广计划的用户
  if (!isFirstShare.value) {
    showMyLink()
  }
  if (userInfo.value.identity === 'old') {
    getInviteCode()
  }
})
</script>

<template>
  <div class="flex flex-col w-full h-full referral-program">
    <ViewsHeader class="referral-program-header" :title="($route.meta.title as string)" />
    <div class="referral-program-body">
      <!-- 左侧 -->
      <div class="left-content">
        <div class="row">
          <div class="title">{{ $t('推广计划介绍：') }}</div>
          <div class="referral-program-illustrate-content">{{ $t('通过邀请用户注册我们产品，您将在产品内获得权益与激励。激励的详情将和付费计划一起推出，敬请期待。') }}
          </div>
        </div>
        <div class="row">
          <div class="steps">
            <div class="step-item">
              <RxSvgIcon name="referral-program/copy-link" class="step-icon" />
              <div class="step-text">{{ $t('复制链接') }}</div>
            </div>
            <div class="step-item">
              <RxSvgIcon name="referral-program/invite-user" class="step-icon" />
              <div class="step-text">{{ $t('邀请用户') }}</div>
            </div>
            <div class="step-item">
              <RxSvgIcon name="referral-program/invite-user" class="step-icon" />
              <div>
                <div class="step-text">{{ $t('获取激励') }}</div>
                <div class="step-desc">{{ $t('即将推出') }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="row overflow-hidden">
          <div class="title">
            <i18n-t :keypath="$t('你邀请的用户：({inviteUserCount} 人)', { inviteUserCount: '{inviteUserCount}' })"
              scope="global">
              <template #inviteUserCount>
                <span>{{ inviteUserCount }}</span>
              </template>
            </i18n-t>
          </div>
          <RyTable v-model:columns="columns" scrollable :table-request="tableRequest" :showTableHeader="false"
            :paginator="false" :show-actions-menu="false" :show-actions="false" class="invite-user-table">
            <template #table-empty>
              <CustomEmpty icon="rc_ic_user_referral.svg" :title="$t('暂无已邀请的用户')">
              </CustomEmpty>
            </template>
          </RyTable>
        </div>
      </div>
      <Divider layout="vertical" />
      <!-- 右侧 -->
      <div class="right-content">
        <div class="row">
          <div class="title">{{ $t('你的邀请链接：') }}</div>
          <div class="referral-link">
            <div v-if="isFirstShare" class="mask">
              <div class="show-link" @click="showMyLink">
                <RxSvgIcon name="base/rx_ic_link"></RxSvgIcon> {{ $t('获取链接') }}
              </div>
            </div>
            <div class="referral-link-value">
              {{ referralLink }}
              <template v-if="isFirstShare">
                https://roxybrowser.com/invite?code=13122341233
              </template>
            </div>
            <RxButton v-if="!isFirstShare" class="flex-shrink-0" severity="secondary" text size="xxs"
              icon="base/rx_ic_copy" :label="$t('复制')" @click="onCopy(referralLink)" />
          </div>
        </div>
        <div v-if="userInfo.identity === 'old'" class="row">
          <div class="title">
            <span>{{ $t('特权码：') }}</span>
            <span class="remain-time">
              <i18n-t :keypath="$t('下次更新时间：{remainTime}', { remainTime: '{remainTime}' })" scope="global">
                <template #remainTime>
                  <span>{{ remainTime }}</span>
                </template>
              </i18n-t>
            </span>
          </div>
          <div class="referral-link">
            <div class="referral-link-value">
              {{ premiumCode }}
            </div>
            <RxButton class="flex-shrink-0" severity="secondary" text size="xxs" icon="base/rx_ic_copy"
              :label="$t('复制')" @click="onCopy(premiumCode)" />
          </div>
          <div class="description">
            {{ $t('使用当前特权码的用户可以获得最多创建60个窗口的额度。特权码将会每24小时刷新一次。每个码只能使用一次。') }}
          </div>
        </div>
        <div class="row">
          <div class="title">
            {{ $t('推广宣传图（建站用户专用）') }}
          </div>
          <div class="banner-sizes">
            <div v-for="item in bannerList" :key="item.size" class="flex items-center gap-2">
              <RadioButton v-model="selectBannerSize" :inputId="item.size" name="dynamic" :value="item.size" />
              <label :for="item.size">{{ item.size }}</label>
            </div>
            <div class="banner-preview">
              <Image :src="bannerImagePreviewUrl" alt="Image" preview :pt="{ toolbar: { class: '!hidden' } }" />
            </div>
          </div>
        </div>
        <div class="row">
          <div class="referral-link">
            <div v-if="isFirstShare" class="mask">
              <div class="show-link" @click="showMyLink">
                <RxSvgIcon name="base/rx_ic_link"></RxSvgIcon> {{ $t('获取链接') }}
              </div>
            </div>
            <div class="referral-link-value">{{ bannerImagePreviewHtmlCode }}</div>
            <RxButton v-if="!isFirstShare" class="flex-shrink-0 self-start" severity="secondary" text size="xxs"
              icon="base/rx_ic_copy" :label="$t('复制')" @click="onCopy(bannerImagePreviewHtmlCode)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.referral-program {
  height: 100%;

  &-header {
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  }

  &-body {
    height: calc(100% - 52px);
    margin: 0 auto;
    display: flex;
    padding: 20px 20px 20px 30px;

    &::-webkit-scrollbar {
      display: none;
    }

    @media (max-width: 1090px) {
      flex-direction: column;
      padding: 20px;
      overflow: auto;
      gap: 20px;

      &::-webkit-scrollbar {
        display: block;
      }

      :deep(.p-divider) {
        display: none;
      }

      .right-content {
        overflow: visible;
      }
    }
  }


  .row {
    display: flex;
    padding: 0px var(--spacing-xl, 12px);
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xl, 12px);
    align-self: stretch;
  }

  .referral-link {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-xl, 12px);
    gap: var(--spacing-xl, 12px);
    border-radius: var(--radius-md, 6px);
    border: 1px solid var(--Color-neutrals-900, #171c1f);
    background: var(--Color-neutrals-800, #252a2e);
    min-height: 50px;

    &-value {
      color: #fff;
      font-family: 'JetBrains Mono';
      font-size: 14px;
      font-weight: 500;
      line-height: 16px;
      word-break: break-word;
    }

    .mask {
      position: absolute;
      inset: 0;
      color: #FFF;
      font-family: "JetBrains Mono";
      font-size: 14px;
      font-style: normal;
      font-weight: 500;
      line-height: 18px;
      backdrop-filter: blur(5px);
      z-index: 10;
      display: flex;
      justify-content: center;
      align-items: center;

      .show-link {
        display: flex;
        min-width: 56px;
        padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
        justify-content: center;
        align-items: center;
        gap: var(--spacing-sm, 4px);
        border-radius: var(--radius-sm, 4px);
        background: var(--Colors-Alpha-alpha-white-30, rgba(255, 255, 255, 0.30));
        box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);
        cursor: pointer;
      }
    }
  }

  .title {
    width: 100%;
    display: flex;
    justify-content: space-between;
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: 16px;

    .remain-time {
      color: var(--Colors-Text-text-tertiary, #7C8387);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      /* 200% */
    }
  }

  .description {
    color: var(--Colors-Text-text-tertiary, #7C8387);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 18px;
    /* 150% */
  }

  &-illustrate {
    display: flex;
    flex-direction: column;

    &-content {
      color: var(--Colors-Text-text-secondary, #575d61);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-lg, 20px);
    }
  }


}

.left-content {
  flex: 3;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-3xl, 20px);
  align-self: stretch;

  .steps {
    width: 100%;
    display: flex;
    justify-content: space-between;

    .step-item {
      display: flex;
      align-items: center;
      gap: 6px;

      .step-icon {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
      }

      .step-text {
        color: var(--Colors-Text-text-primary, #171C1F);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 500;
        line-height: normal;
      }

      .step-desc {
        color: var(--Colors-Text-text-inactive, #A3A9AD);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: normal;
      }
    }
  }

  .invite-user-table {
    height: calc(100% - 30px);
  }
}

.right-content {
  flex: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-3xl, 20px);
  align-self: stretch;
  overflow: hidden auto;

  .banner-sizes {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md, 6px);
    align-self: stretch;
  }

  .banner-preview {
    width: 369px;
    height: 162px;
    flex-shrink: 0;
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
      }
    }
  }
}
</style>
