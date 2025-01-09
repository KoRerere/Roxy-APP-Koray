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
import { useWorkspaceStore } from '/@/stores/workspace'

const userStore = useUserStore()
const { fetchWorkspaceList } = useWorkspaceStore()
const { userInfo } = storeToRefs(userStore)
const toast = useToast()
const referralLink = ref('')
const premiumCode = ref('')
const inviteUserCount = ref(0)
const remainTime = ref('')
const refreshTime = ref('')
const inviteUserResult = ref()
const bannerList = ref<UserGetBannerPictureListListData['data'][number]['images']>([])
const selectBannerSize = ref('')
const steps = [
  { icon: 'referral-program/referral_1', text: $t('复制链接') },
  { icon: 'referral-program/referral_2', text: $t('邀请用户') },
  { icon: 'referral-program/referral_3', text: $t('获取激励'), desc: $t('即将推出') },
]

const columns = useColumns()

const isNewUser = computed(() => {
  return userInfo.value.identity === 'new' && userInfo.value.inviteLink === ''
})

const useTime = computed(() => {
  if (userStore.userInfo.identity === 'agent') {
    return $t('可被使用十次')
  } else {
    return $t('仅能被使用一次')
  }
})

const currentBannerImage = computed(() => {
  return bannerList.value.find(item => item.size === selectBannerSize.value) || {}
})

const bannerImagePreviewHtmlCode = computed(() => {
  const { image_1x, image_2x } = currentBannerImage.value
  const srcset = `${image_1x} 1x, ${image_2x} 2x`
  return `<a href="${referralLink.value}" target="_blank"> <img src="${image_1x}" alt="${referralLink.value}" srcset="${srcset}"> </a>`
})

async function onCopy(text: string) {
  copyText(text)
  toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('复制成功'), life: 2500 })
}

async function tableRequest() {
  inviteUserResult.value ||= await API.base.userGetInviteUserListList()
  if (inviteUserResult.value.code === 0) {
    inviteUserCount.value = inviteUserResult.value.data.total
  }
  return inviteUserResult.value
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
    remainTime.value = format(data.expire_time * 1000, 'yyyy/MM/dd HH:mm')
    refreshTime.value = format(data.expire_time * 1000, 'HH:mm')

    if (data.expire_time * 1000 < Date.now()) {
      getInviteCode()
    }
    setTimeout(getInviteCode, data.expire_time * 1000 - Date.now())
  }
}

async function getBannerPictureList() {
  const { code, data } = await API.base.userGetBannerPictureListList()
  if (code === 0) {
    bannerList.value = data
    selectBannerSize.value = bannerList.value[0].size
  }
}

async function showMyLink() {
  const { fetchUserInfo } = userStore
  await getInviteLink()
  getBannerPictureList()
  // 如果是第一次推广的话，重新获取用户信息更新推广状态
  if (isNewUser.value) {
    // 如果是新用户，弹出提示
    toast.add({ severity: 'success', summary: $t('感谢您参与推广计划'), detail: $t('您当前的窗口创建额度已提升至 20.'), life: 2500 })
    fetchUserInfo()
    fetchWorkspaceList()
  }
}

onBeforeMount(() => {
  // 尚未加入推广计划的用户
  if (!isNewUser.value) {
    showMyLink()
  }
  if (['old', 'agent'].includes(userInfo.value.identity)) {
    getInviteCode()
  }
  tableRequest()
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
          <div class="referral-program-illustrate-content">
            {{ $t('邀请新用户加入Roxy，您将于正式版发布后获得更多权益。具体方案将随付费计划推出，敬请期待。') }}
          </div>
        </div>
        <div class="row">
          <div class="steps">
            <template v-for="(step, index) in steps" :key="step.text">
              <div v-if="index > 0" class="divide"></div>
              <div class="step-item">
                <RxSvgIcon :name="step.icon" class="step-icon" />
                <div>
                  <div class="step-text">{{ step.text }}</div>
                  <div v-if="step.desc" class="step-desc">{{ step.desc }}</div>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div class="row overflow-hidden">
          <div class="title">
            <i18n-t tag="div" :keypath="$t('你邀请的用户：({inviteUserCount} 人)', { inviteUserCount: '{inviteUserCount}' })"
              scope="global">
              <template #inviteUserCount>
                <span>{{ inviteUserCount }}</span>
              </template>
            </i18n-t>
          </div>
          <template v-if="inviteUserCount">
            <RyTable v-model:columns="columns" scrollable :table-request="tableRequest" :showTableHeader="false"
              :paginator="false" :show-actions-menu="false" :show-actions="false" class="invite-user-table">
            </RyTable>
          </template>
          <template v-else>
            <div class="no-users-invited">
              <div class="empty">
                <RxSvgIcon name="empty/rc_ic_user_referral" size="24px" />
                <div class="empty-text">{{ $t('暂无已邀请的用户') }}</div>
              </div>
            </div>
          </template>
        </div>
      </div>
      <Divider layout="vertical" />
      <!-- 右侧 -->
      <div class="right-content">
        <div class="row">
          <div class="title">
            <div>
              {{ $t('推广链接') }}
              <RxSvgIcon v-if="userStore.userInfo.identity === 'agent'" name="base/rx_ic_info"
                class="align-middle cursor-pointer" size="12px"
                v-tooltip.left="$t(`{userIdentity}：\n1、【特邀】身份+徽章\n2、60个窗口用量\n3、2个额外工作空间用量`, { userIdentity: $t('通过链接注册的用户权益') })" />
            </div>
          </div>
          <div class="referral-link">
            <div v-if="isNewUser" class="mask">
              <div class="show-link" @click="showMyLink">
                <RxSvgIcon name="base/rx_ic_link"></RxSvgIcon> {{ $t('获取链接') }}
              </div>
            </div>
            <div class="referral-link-value">
              {{ referralLink }}
              <template v-if="isNewUser">
                https://roxybrowser.com/invite?code=13122341233
              </template>
            </div>
            <RxButton v-if="!isNewUser" class="flex-shrink-0 copy-btn" text size="xxs" icon="base/rx_ic_copy"
              :label="$t('复制')" @click="onCopy(referralLink)" />
          </div>
        </div>
        <div v-if="['old', 'agent'].includes(userInfo.identity)" class="row">
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
            <RxButton class="flex-shrink-0 copy-btn" text size="xxs" icon="base/rx_ic_copy" :label="$t('复制')"
              @click="onCopy(premiumCode)" />
          </div>
          <div class="description">
            <div>
              <i18n-t :keypath="$t('使用特权码的用户将成为【特邀用户】{tips}', { tips: '{tips}' })" scope="global">
                <template #tips>
                  <RxSvgIcon name="base/rx_ic_info" class="align-middle cursor-pointer" size="12px"
                    v-tooltip.left="$t(`{userIdentity}：\n1、【特邀】身份+徽章\n2、60个窗口用量\n3、2个额外工作空间用量`, { userIdentity: $t('特邀用户权益') })" />
                </template>
              </i18n-t>
            </div>
            <div>{{ $t('若使用者的账户无邀请人，则会成为您的名下用户。') }}</div>
            <div> {{ $t('每个特权码{useTime}，每日{time}自动更新。', { time: refreshTime, useTime }) }}</div>
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
          <div class="banner-preview">
            <Image :src="currentBannerImage.image_1x" alt="Image" preview
              :pt="{ toolbar: { class: '!hidden' }, previewMask: { class: 'rounded-[4px]' } }">
              <template #preview="slotProps">
                <img :src="currentBannerImage.image_1x"
                  :srcset="`${currentBannerImage.image_1x} 1x, ${currentBannerImage.image_2x} 2x`" alt="preview"
                  :style="slotProps.style" @click="slotProps.onClick" />
              </template>
            </Image>
          </div>
        </div>
        <div class="row">
          <div class="referral-link">
            <div v-if="isNewUser" class="mask">
              <div class="show-link" @click="showMyLink">
                <RxSvgIcon name="base/rx_ic_link"></RxSvgIcon> {{ $t('获取链接') }}
              </div>
            </div>
            <div class="referral-link-value">{{ bannerImagePreviewHtmlCode }}</div>
            <RxButton v-if="!isNewUser" class="flex-shrink-0 self-start copy-btn" text size="xxs" icon="base/rx_ic_copy"
              :label="$t('复制')" @click="onCopy(bannerImagePreviewHtmlCode)" />
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
    max-width: 1140px;
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

  .no-users-invited {
    display: flex;
    padding: 64px 0px;
    flex-direction: column;
    align-items: flex-start;
    align-self: stretch;
    border-radius: 8px;
    border: 0.5px solid var(--Colors-Border-border-container, #C7CDD1);
    background: var(--Colors-Background-bg-page, #FAFBFC);

    .empty {
      display: flex;
      padding: var(--spacing-xl, 12px) 12px;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-xl, 12px);
      align-self: stretch;

      .empty-text {
        color: var(--Colors-Text-text-tertiary, #7C8387);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: 16px;
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
    border: 1px solid var(--Color-neutrals-900, #171C1F);
    background: var(--Color-neutrals-800, #252A2E);
    min-height: 30px;

    &-value {
      color: #fff;
      font-family: 'JetBrains Mono';
      font-size: 14px;
      font-weight: 500;
      line-height: 16px;
      word-break: break-word;
    }

    &:hover {
      .copy-btn {
        display: flex;
      }
    }

    .copy-btn {
      display: none;
      position: absolute !important;
      right: 6px;
      top: 6px;
      background: #575D61;
      border-color: transparent;
      color: white;
    }

    .mask {
      position: absolute;
      inset: 0;
      color: #FFF;
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
  gap: var(--spacing-3xl, 32px);
  align-self: stretch;

  .steps {
    margin: 0 auto;
    width: 480px;
    display: flex;
    gap: 12px;
    align-items: center;

    .divide {
      flex: 1;
      border-bottom: 1px dashed var(--Colors-Border-border-container, #c7cdd1);
    }

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
    border-radius: 6px;
    border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
    overflow: hidden;
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
    width: 100%;
    display: grid;
    gap: var(--spacing-md, 6px);
    grid-template-columns: repeat(2, 1fr);

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
      color: var(--Component-Colors-TextInput-text-text, #171C1F);
      font-family: Inter;
      font-size: 13px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-xs, 16px);
      cursor: pointer;
    }
  }

  .banner-preview {
    width: 100%;
    height: 192px;
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

        &:not([src]) {
          visibility: hidden;
        }
      }
    }
  }
}
</style>
