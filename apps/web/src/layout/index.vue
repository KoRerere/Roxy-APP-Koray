<script lang="ts" setup>
import AsideMenu from './components/aside-menu/index.vue'
import RxLayoutFooter from './components/footer/index.vue'
import RxLayoutHeader from './components/header/index.vue'
import { format } from 'date-fns'
import { API } from '/@/api'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useUserStore } from '../stores/user'
import { emitter } from '/@/utils/eventBus'
import { MENU_COLLAPSED } from '../constants/storage-key'
import { SubLevelEnum } from '/@/enums/pay'
import { WorkspaceType } from '/@/enums/base'
import { useRoleStore } from '/@/stores/role'
import { useThemeStore } from '../stores/theme'
import { RxAlert } from '/@/components/rx-alert/'
import { useProxy } from '/@/views/agent/hooks'
import type { UnwrapRowsType, UserGetAnntListListData } from '@roxy/backend-api'

type AnntData = UnwrapRowsType<UserGetAnntListListData>

const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const userStore = useUserStore()
const roleStore = useRoleStore()
const themeStore = useThemeStore()
const { userPayInfo } = storeToRefs(userStore)
const router = useRouter()
const { viewExpiresSoonProxy } = useProxy()

// 订阅到期时间，3 天前显示天
const remainTime = ref(0)
const isShowSubscriptionExpired = ref(true)
const isShowProxyExpired = ref(true)
const collapsed = ref<boolean>(Boolean(~~(localStorage.getItem(MENU_COLLAPSED) as string)))
const anntList = ref<AnntData>()

const indicatorColor = computed(() => {
  return themeStore.theme === 'dark' ? '#FFFFFF33' : 'rgba(0, 0, 0, 0.1)'
})

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

async function getAnntList() {
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

function handleCloseProxyExpired() {
  setTimeout(() => {
    isShowProxyExpired.value = false
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
    }
    else {
      if (remainTime.value > 0) {
        userStore.fetchUserInfo()
        userStore.getUserPayInfo()
      }
      remainTime.value = 0
    }
  }
  else {
    remainTime.value = 0
  }
}

// 每 30 秒计算一次订阅到期时间
let timer = setInterval(calcSubscriptionExpired, 10 * 1000)

watch(() => currentWorkspace.value?.id, () => {
  remainTime.value = 0
  clearInterval(timer)
  timer = setInterval(calcSubscriptionExpired, 10 * 1000)
  collapsed.value = currentWorkspace.value?.workspaceType === WorkspaceType.Public && !roleStore.isOwner
  getAnntList()
}, { immediate: true })// 下个版本从所有公告中根据 id 过滤 11.06

onBeforeUnmount(() => {
  clearInterval(timer)
})

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
</script>

<template>
  <div class="rx-layout">
    <div class="rx-side" :class="{ collapsed }">
      <div class="indicator" :title="collapsed ? $t('展开') : $t('收起')" @click="collapsed = !collapsed">
        <SvgIcon name="indicator/indicator_default" class="default" />
        <SvgIcon name="indicator/indicator_expand" class="expand" />
        <SvgIcon name="indicator/indicator_fold" class="fold" />
      </div>
      <div class="logo">
        <SvgIcon name="base/logo" size="36" />
        <template v-if="!collapsed">
          RoxyBrowser
        </template>
      </div>
      <AsideMenu :collapsed />
      <RxLayoutFooter v-model:collapsed="collapsed" />
    </div>
    <main class="flex-1 flex flex-col overflow-hidden">
      <RxLayoutHeader />

      <div class="mr-4 flex flex-col gap-2 rx-main-announcement">
        <Message v-for="annt in anntList" :key="annt.id" severity="success" class="w-full rx-main-announcement__content" :class="{ campaing: !!annt.announceType }" closable
                 @close="handleCloseAnnt(annt.id!)"
        >
          <template #default>
            <div class="ellipsis-1" v-html="annt.announcement" />
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
            <i18n-t scope="global" :keypath="$t('您的一些代理即将过期。为避免您使用受到任何干扰，请{link}。', { link: '{link}' })">
              <template #link>
                <span v-if="roleStore.isOwner" class="font-bold underline cursor-pointer" @click="viewExpiresSoonProxy">{{ $t('点击查看') }}</span>
                <span v-else>{{ $t('联系空间拥有者续费') }}</span>
              </template>
            </i18n-t>
          </template>
        </RxAlert>
      </div>

      <div class="flex-1 mr-4 mb-4 rounded overflow-hidden rx-main-content">
        <RouterView v-if="currentWorkspace?.id && userPayInfo?.subLevel" :key="currentWorkspace?.id" />
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
        .expand {
          display: block;
        }

        .fold {
          display: none;
        }
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
    color: v-bind(indicatorColor);

    svg {
      width: 11px;
      height: 38px;
    }

    .default {
      width: 6px;
    }

    .fold,
    .expand {
      display: none;
    }

    &:hover {
      .fold {
        display: block;
      }

      .default {
        display: none;
      }
    }
  }

  .logo {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 6px);
    flex-wrap: nowrap;
    color: var(--colors-text-text-primary, #fafafa);
    text-align: center;
    font-family: Archivo;
    font-size: 18px;
    font-style: normal;
    line-height: normal;
    user-select: none;
    overflow: hidden;
    font-weight: 700;

    .env {
      display: flex;
      padding: var(--spacing-xs, 2px) var(--spacing-md, 6px);
      justify-content: center;
      align-items: center;
      gap: 10px;
      color: var(--colors-text-text-brand, #12a3fc);
      text-align: center;
      font-family: Archivo;
      font-size: 10px;
      font-style: normal;
      font-weight: 600;
      line-height: normal;
      letter-spacing: 0.1px;
      border-radius: var(--radius-full, 9999px);
      background: var(--primitives-blue-100, #e8f5fc);
    }
  }
}

.rx-main-content {
  border: 0.5px solid var(--colors-border-border-inactive);
  background: var(--colors-background-bg-page);
}

.rx-main-announcement {
  &:not(:empty) {
    padding-bottom: 12px;
  }

  &__content {
    border-radius: 4px;
    background: #303256;
    outline-style: none;
    outline-width: 0;

    &.campaing {
      background: var(--campaign-netflix-bg-announcement);
    }

    &:first-of-type {
      margin-top: 0;
    }
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

.expired-alert {
  padding: 8px 12px;

  :deep(.rx-alert__title) {
    font-size: 13px;
    font-weight: normal;
  }
}
</style>
