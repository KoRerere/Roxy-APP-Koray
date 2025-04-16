<script lang="ts" setup>
import { format } from 'date-fns'
import { API } from '/@/api'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useUserStore } from '../stores/user'
import AsideMenu from './components/aside-menu/index.vue'
import RxLayoutFooter from './components/footer/index.vue'
import RxLayoutHeader from './components/header/index.vue'
import { emitter } from '/@/utils/eventBus';
import { MENU_COLLAPSED } from '../constants/storage-key'
import { SubLevelEnum } from '/@/enums/pay'
import type { UserGetAnntListListData, UnwrapRowsType } from '@roxy/backend-api'

type AnntData = UnwrapRowsType<UserGetAnntListListData>

const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const userStore = useUserStore()
const { userPayInfo } = storeToRefs(userStore)
const router = useRouter()

// 订阅到期时间，3 天前显示天
const remainTime = ref(0)
const isShowSubscriptionExpired = ref(true)
const collapsed = ref<boolean>(Boolean(~~(localStorage.getItem(MENU_COLLAPSED) as string)))
const anntList = ref<AnntData>()

/** 订阅到期时间 */
const subEndDate = computed(() => {
  if (userPayInfo.value?.subEndDate) {
    return format(new Date(userPayInfo.value?.subEndDate), 'yyyy/MM/dd')
  }
  return null
})

watchEffect(() => {
  localStorage.setItem(MENU_COLLAPSED, collapsed.value ? '1' : '0')
})


async function getAnnt() {
  const { data } = await API.base.userGetAnntListList()
  anntList.value = data?.rows || []
}

function handleCloseAnnt(id: number) {
  setTimeout(() => {
    anntList.value = anntList.value?.filter(annt => annt.id !== id)
  }, 400)
}

function handleCloseSubscriptionExpired() {
  setTimeout(() => {
    isShowSubscriptionExpired.value = false
  }, 400)
}

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
    } else {
      if (remainTime.value > 0) {
        userStore.fetchUserInfo()
        userStore.getUserPayInfo()
      }
      remainTime.value = 0
    }
  } else {
    remainTime.value = 0
  }
}

// 每 30 秒计算一次订阅到期时间
let timer = setInterval(calcSubscriptionExpired, 10 * 1000)

watch(() => currentWorkspace.value?.id, () => {
  remainTime.value = 0
  clearInterval(timer)
  timer = setInterval(calcSubscriptionExpired, 10 * 1000)
})

onBeforeMount(() => {
  getAnnt()
})

onBeforeUnmount(() => {
  clearInterval(timer)
})

function onRenewal() {
  // 如果是试用，则跳转到订阅页面
  if (userPayInfo.value.subLevel === SubLevelEnum.Trial) {
    router.push({ name: 'subscribe-plan' })
  } else {
    emitter.emit('showRenewalDialog', {
      paySuccess: () => {
        emitter.emit('updateBillList')
      }
    })
  }
}
</script>

<template>
  <div class="rx-layout">
    <div class="rx-side" :class="{ collapsed }">
      <img class="indicator" src="/images/indicator/indicator_default.svg" :title="collapsed ? $t('展开') : $t('收起')"
        @click="collapsed = !collapsed">
      <div class="logo">
        <SvgIcon name="base/logo" size="36" />
        <template v-if="!collapsed">
          RoxyBrowser
        </template>
      </div>
      <AsideMenu :collapsed />
      <RxLayoutFooter v-model:collapsed="collapsed" />
    </div>
    <main class="rx-main">
      <RxLayoutHeader />
      <div class="rx-main-announcement">
        <Message v-for="annt in anntList" :key="annt.id" severity="success" class="w-full rx-main-announcement__content"
          closable @close="handleCloseAnnt(annt.id!)">
          <template #default>
            <div class="ellipsis-1" v-html="annt.announcement" />
          </template>
          <template #closeicon>
            <SvgIcon name="base/rx_ic_delete" />
          </template>
        </Message>
        <Message v-if="!userPayInfo.isAuto && isShowSubscriptionExpired && remainTime && subEndDate" severity="success"
          class="w-full rx-main-announcement__content subscription-expired" closable
          @close="handleCloseSubscriptionExpired">
          <template #default>
            <i18n-t
              :keypath="$t('您的订阅将于 {remainTime} 天后（{subEndDate}）到期。为避免服务中断，请及时{link}。', { remainTime, subEndDate, link: '{link}' })"
              scope="global">
              <template #link>
                <span class="font-bold underline cursor-pointer" @click="onRenewal">
                  {{ userPayInfo.subLevel === SubLevelEnum.Trial ? $t('前往购买') : $t('前往续费') }}
                </span>
              </template>
            </i18n-t>
          </template>
          <template #closeicon>
            <SvgIcon name="base/rx_ic_delete" color="#575D61" />
          </template>
        </Message>
      </div>
      <div class="rx-main-content">
        <RouterView v-if="currentWorkspace?.id && Object.keys(userPayInfo).length" :key="currentWorkspace?.id" />
      </div>
    </main>
  </div>
</template>

<style lang="scss" scoped>
.rx-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #f7fbfd;
}

.rx-side {
  position: relative;
  display: flex;
  width: 220px;
  padding: var(--spacing-2xl, 16px);
  padding-top: 11px;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  flex-shrink: 0;
  transition: all 0.25s ease;
  will-change: width;
  // overflow: hidden;
  user-select: none;
  background-image: url('/images/bg_capella.svg');
  background-position: bottom -210px right -185px;
  background-repeat: no-repeat;

  &.collapsed {
    width: 66px;

    .indicator {
      right: 0;
      left: 100%;

      &:hover {
        content: url('/images/indicator/indicator_expand.svg');
      }
    }
  }

  .indicator {
    position: absolute;
    top: 50%;
    right: -5px;
    transform: translateY(-50%);
    cursor: pointer;
    z-index: 10;
    padding: 10px;

    &:hover {
      content: url('/images/indicator/indicator_fold.svg');
    }

    &:invalid {
      display: none;
    }
  }

  .logo {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 6px);
    flex-wrap: nowrap;
    color: var(--Color-neutrals-950, #0e1214);
    text-align: center;
    font-family: Archivo;
    font-size: 18px;
    font-style: normal;
    line-height: normal;
    user-select: none;
    overflow: hidden;

    .env {
      display: flex;
      padding: var(--spacing-xs, 2px) var(--spacing-md, 6px);
      justify-content: center;
      align-items: center;
      gap: 10px;
      color: var(--Colors-Text-text-brand, #12a3fc);
      text-align: center;
      font-family: Archivo;
      font-size: 10px;
      font-style: normal;
      font-weight: 600;
      line-height: normal;
      letter-spacing: 0.1px;
      border-radius: var(--radius-full, 9999px);
      background: var(--Color-blue-100, #e8f5fc);
    }
  }
}

.rx-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &-announcement {
    margin-right: var(--spacing-2xl, 16px);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs, 8px);

    &:not(:empty) {
      padding-bottom: 12px;
    }

    &__content {
      border-radius: 4px;
      background: #303256;
      outline-style: none;
      outline-width: 0;

      &:first-of-type {
        margin-top: 0;
      }

      &.subscription-expired {
        border: 1px solid var(--Color-yellow-200, #ffcb80);
        background: var(--Color-yellow-100, #fff5e6);

        :deep(.p-message-text) {
          color: var(--Color-yellow-400, #db8d1a);
          font-family: Inter;
          font-size: 14px;
          font-style: normal;
          font-weight: 400;
          line-height: 16px;
        }
      }
    }

    :deep(a) {
      color: #ffffff;
      text-decoration: underline;
    }

    :deep(.p-message-content) {
      padding: var(--spacing-lg, 10px) var(--spacing-xl, 12px);
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

  &-content {
    flex: 1;
    margin-right: var(--spacing-2xl, 16px);
    margin-bottom: var(--spacing-2xl, 16px);
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
    background-color: #ffffff;
    overflow: hidden;
  }
}
</style>
