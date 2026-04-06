<script setup lang="ts">
import { RxAlert } from '/@/components/rx-alert'
import { format } from 'date-fns'
import { useUserStore } from '/@/stores/user'
import { useRoleStore } from '/@/stores/role'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useProxy } from '/@/views/agent/hooks'
import { SubLevelEnum } from '/@/enums/pay'
import { emitter } from '/@/utils/eventBus'
import { useCommonStore } from '/@/stores/common'
import { executeSomethingByBackToSelfWorkspace } from '/@/hooks/useResponseToast/handleBusinessCode'
import { sleep } from '/@/utils'
import { Role } from '/@/enums/role'

const router = useRouter()
const roleStore = useRoleStore()
const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const { userPayInfo } = storeToRefs(useUserStore())
const { fetchUserInfo, getUserPayInfo } = useUserStore()

const { viewExpiresSoonProxy } = useProxy()

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

// 每 30 秒计算一次订阅到期时间
let timer = setInterval(calcSubscriptionExpired, 10 * 1000)

watch(() => currentWorkspace.value?.id, () => {
  remainTime.value = 0
  clearInterval(timer)
  timer = setInterval(calcSubscriptionExpired, 10 * 1000)
}, { immediate: true })

onBeforeUnmount(() => {
  clearInterval(timer)
})

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
  const target = e.target as HTMLElement
  const link = target.closest('a')

  if (!link || link.target === '_blank')
    return

  const href = link.getAttribute('href')

  // 只拦截站内路由
  if (!href || href.startsWith('http'))
    return
  e.preventDefault()

  const url = new URL(href.slice(href.startsWith('#') ? 1 : 0), location.origin)
  const query = Object.fromEntries(url.searchParams)

  const replaceParams = {
    path: url.pathname,
    query: {
      ...query,
      _t: Date.now(),
    },
  }

  if (query.name === 'shop' || query.role === Role.OWNER.toString()) {
    executeSomethingByBackToSelfWorkspace(() => {
      router.replace(replaceParams)
    })()
  }
  else {
    router.replace(replaceParams)
  }
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
        <i18n-t v-if="roleStore.isOwner" :keypath="$t('您的订阅将于 {remainTime} 天后（{subEndDate}）到期。为避免服务中断，请及时{link}。', { remainTime, subEndDate, link: '{link}' })" scope="global">
          <template #link>
            <span class="font-bold underline cursor-pointer" @click="onRenewal">
              {{ userPayInfo.subLevel === SubLevelEnum.Trial ? $t('前往购买') : $t('前往续费') }}
            </span>
          </template>
        </i18n-t>
        <i18n-t v-else :keypath="$t('当前空间的订阅将于 {remainTime} 天后（{subEndDate}）到期。为避免服务中断，请及时联系空间拥有者续费。', { remainTime, subEndDate })" scope="global" />
      </template>
    </RxAlert>
    <RxAlert v-if="userPayInfo.proxyExpireCount > 0 && isShowProxyExpired" class="w-full expired-alert" type="warn" announcement @close="handleCloseProxyExpired">
      <template #title>
        <i18n-t scope="global" :keypath="$t('您的一些代理 IP 即将过期。为避免您使用受到任何干扰，请{link}。', { link: '{link}' })">
          <template #link>
            <span v-if="roleStore.isOwner" class="font-bold underline cursor-pointer" @click="viewExpiresSoonProxy">{{ $t('点击查看') }}</span>
            <span v-else>{{ $t('联系空间拥有者续费') }}</span>
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

    // &::before {
    //   content: '';
    //   position: absolute;
    //   inset: 0;
    //   background-image: url('/images/campaing/spring-festival/cloud_full.svg');
    //   background-repeat: no-repeat;
    //   background-position: -28px -10px;
    //   opacity: 0.3;
    //   z-index: -1;
    // }

    // &::after {
    //   content: '';
    //   position: absolute;
    //   inset: 0;
    //   background-image: url('/images/campaing/spring-festival/cloud_full.svg');
    //   background-repeat: no-repeat;
    //   background-position: -28px -10px;
    //   transform: scaleX(-1);
    //   opacity: 0.8;
    //   z-index: -2;
    // }
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
