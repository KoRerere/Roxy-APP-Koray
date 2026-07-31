<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert'
import { format } from 'date-fns'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useProxy } from '/@/views/agent/hooks'
import { SubLevelEnum } from '/@/enums/pay'
import { emitter } from '/@/utils/eventBus'
import { useCommonStore } from '/@/stores/common'
import { usePermission } from '/@/hooks/usePermission'
import { useVisibilityAwareInterval } from '/@/hooks/useVisibilityAwareInterval'
import { useTutorialEntityLabels } from '/@/composables/useTutorialEntityLabels'
// import { executeSomethingByBackToSelfWorkspace } from '/@/hooks/useResponseToast/handleBusinessCode'
import { sleep } from '/@/utils'
import { handleRichHtmlLinkClick } from '/@/utils/rich-html-link'
// import { Role } from '/@/enums/role'

const router = useRouter()
const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const { userPayInfo } = storeToRefs(useUserStore())
const { fetchUserInfo, getUserPayInfo } = useUserStore()
const { check } = usePermission()
const { viewExpiresSoonProxy } = useProxy()
const tutorialLabels = useTutorialEntityLabels()

const remainTime = ref(0)
const isShowSubscriptionExpired = ref(true)
const isShowProxyExpired = ref(true)
const { unReadAnnts } = storeToRefs(useCommonStore())
const { setAnntRead } = useCommonStore()

const subEndDate = computed(() => {
  if (userPayInfo.value?.subEndDate) {
    return format(new Date(userPayInfo.value?.subEndDate), 'yyyy/MM/dd')
  }
  return null
})

// 每 10 秒计算一次订阅到期时间（页面 hidden 时暂停）
useVisibilityAwareInterval(calcSubscriptionExpired, 10 * 1000)

watch(() => currentWorkspace.value?.id, () => {
  remainTime.value = 0
}, { immediate: true })

/** 定时计算订阅到期时间，如果订阅到期时间小于 3 天，则显示订阅到期提醒  */
function calcSubscriptionExpired() {
  const subCurrentDate = userPayInfo.value?.subCurrentDate
  const subEndDate = userPayInfo.value?.subEndDate
  if (subEndDate && subEndDate > subCurrentDate) {
    const diffTime = subEndDate - subCurrentDate
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    // console.log('diffDays', diffDays)
    if (diffDays <= 3 && diffDays >= 0) {
      remainTime.value = Math.max(diffDays, 1)
    }
    else {
      if (remainTime.value > 0) {
        fetchUserInfo()
        getUserPayInfo()
      }
      remainTime.value = 0
    }
  }
  else {
    remainTime.value = 0
  }
}

function onRenewal() {
  // 如果是试用，则跳转到订阅页面
  if (userPayInfo.value.subLevel === SubLevelEnum.Trial) {
    router.push({ name: 'subscribe-plan' })
  }
  else {
    emitter.emit('showRenewalDialog', {
      paySuccess: () => {
        router.replace({ name: 'wallet', query: { name: 'manage' } })
        emitter.emit('updateBillList')
      },
    })
  }
}

function handleCloseAnnt(id: number) {
  sleep(400).then(() => setAnntRead(id))
}

function onHtmlClick(e: MouseEvent) {
  handleRichHtmlLinkClick(e, { router })
}

function handleCloseSubscriptionExpired() {
  setTimeout(() => {
    isShowSubscriptionExpired.value = false
  }, 400)
}

function handleCloseProxyExpired() {
  setTimeout(() => {
    isShowProxyExpired.value = false
  }, 400)
}
</script>

<template>
  <div class="mr-4 flex flex-col gap-2 announcement">
    <Message v-for="annt in unReadAnnts" :key="annt.id" severity="success" class="w-full rounded-1 announcement_content" closable @close="handleCloseAnnt(annt.id!)">
      <template #default>
        <div class="break-all" @click="onHtmlClick" v-html="annt.announcement" />
      </template>
      <template #closeicon>
        <SvgIcon name="base/rx_ic_delete" />
      </template>
    </Message>
    <RxAlert v-if="!userPayInfo.isAuto && isShowSubscriptionExpired && remainTime && subEndDate" class="w-full expired-alert" type="warn" announcement @close="handleCloseSubscriptionExpired">
      <template #title>
        <i18n-t v-if="check('Cost_Center_all')" :keypath="$t('您的订阅将于 {remainTime} 天后（{subEndDate}）到期。为避免服务中断，请及时{link}。', { remainTime, subEndDate, link: '{link}' })" scope="global">
          <template #link>
            <span class="font-bold underline cursor-pointer" @click="onRenewal">
              {{ userPayInfo.subLevel === SubLevelEnum.Trial ? $t('前往购买') : $t('前往续费') }}
            </span>
          </template>
        </i18n-t>
        <i18n-t v-else :keypath="$t('当前团队的订阅将于 {remainTime} 天后（{subEndDate}）到期。为避免服务中断，请及时联系团队拥有者续费。', { remainTime, subEndDate })" scope="global" />
      </template>
    </RxAlert>
    <RxAlert v-if="userPayInfo.proxyExpireCount > 0 && isShowProxyExpired" class="w-full expired-alert" type="warn" announcement @close="handleCloseProxyExpired">
      <template #title>
        <i18n-t scope="global" :keypath="tutorialLabels.proxyExpireAnnouncementKeypath">
          <template #link>
            <span v-if="check('Cost_Center_all')" class="font-bold underline cursor-pointer" @click="viewExpiresSoonProxy">{{ $t('点击查看') }}</span>
            <span v-else>{{ $t('联系团队拥有者续费') }}</span>
          </template>
        </i18n-t>
      </template>
    </RxAlert>
  </div>
</template>

<style lang="scss" scoped>
.announcement {
  &:not(:empty) {
    padding-bottom: 12px;
  }

  &_content {
    position: relative;
    background: #303256;
    // background:
    //   radial-gradient(194.08% 50% at 50% 32px, rgba(250, 83, 25, 0.4) 0%, rgba(250, 83, 25, 0) 100%),
    //   linear-gradient(0deg, #ac0f00 0%, #ac0f00 100%), #cc200f;

    outline-style: none;
    outline-width: 0;
    z-index: 0;
  }

  :deep(a) {
    color: #ffffff;
    text-decoration: underline;
  }

  :deep(.p-message-content) {
    padding: 10px 12px;
  }

  :deep(.p-message-text) {
    width: 95%;
    color: #ffffff;
    font-family: Inter;
    font-size: 13px;
    line-height: 16px;
  }

  :deep(.p-message-close-button) {
    color: #ffffff;
    width: auto;
    height: auto;

    &:hover {
      background-color: transparent;
    }
  }
}
</style>
