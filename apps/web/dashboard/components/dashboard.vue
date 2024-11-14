<script setup lang="ts">
import type { UnwrapRowType, UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import { useDateFormat, useMediaQuery, useNow } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import { onBeforeMount, ref, useTemplateRef } from 'vue'
import dashboardBgSvg from '/@/assets/images/dashboard-bg.svg?raw'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { fingerprintInfoList, profileInfoList } from '../constants'
import { getTimeOffset } from '../utils'
import IpChangeWarnMessage from './ip-change-warn-message.vue'
import TwoFactorAuth from './two-factor-auth.vue'

const dirId = new URLSearchParams(window.location.search).get('id')

const toast = useToast()

const coreVersion = ref('')
const windowInfo = ref<UnwrapRowType<UserGetWindowInfoV2ListData>>({})
/** 获取窗口详情 loading */
const fetchWindowInfoLoading = ref(false)
/** 是否测试成功 */
const isTestSuccess = ref(true)
const refreshUrlLoading = ref(false)
const testProxyLoading = ref(false)
const proxyInfo = ref<Record<string, any>>({})
const ipLocationEl = useTemplateRef('ipLocationEl')
const now = useDateFormat(useNow(), 'YYYY-MM-DD HH:mm:ss')
/** 当前时区偏移量 */
const offsetHours = getTimeOffset()
/** 时区标识符 */
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const isMobile = useMediaQuery('(max-width: 428px)')

const ipchecker = computed(() => {
  const channel = proxyInfo.value?.detectionChannel

  if (channel) {
    return {
      host: new URL(channel).host,
      fullUrl: channel,
    }
  }
  return {}
})

/** 获取当前窗口信息 */
function getWindowInfo() {
  fetchWindowInfoLoading.value = true
  fetch(`/api/browser/list?dirId=${dirId}`)
    .then(response => response.json())
    .then((result) => {
      console.log(result)
      const { code, data, msg } = result
      if (code === 0) {
        windowInfo.value = data.rows[0]
      }
      else {
        console.error('获取窗口信息失败')
        toast.add({ severity: 'error', summary: 'Errors occur', detail: msg, life: 3000 })
      }
    })
    .catch(error => console.error(error))
    .finally(() => {
      fetchWindowInfoLoading.value = false
    })
}

/** 代理检查 */
async function proxyDetection(event?: MouseEvent) {
  testProxyLoading.value = true
  try {
    const response = await fetch(`/api/proxy/detection?dirId=${dirId}`)
    const result = await response.json()
    console.log(result)
    if (result.code === 0) {
      isTestSuccess.value = true
      proxyInfo.value = result.data
      // 通过点击事件触发的检查，显示成功提示
      if (event) {
        toast.add({ severity: 'success', summary: $t('操作成功'), life: 3000 })
      }
    }
    else {
      console.error('代理检查失败')
      toast.add({ severity: 'error', summary: 'Errors occur', detail: result.message, life: 3000 })
      proxyInfo.value = {}
      isTestSuccess.value = false
    }
  }
  catch (error) {
    console.error(error)
    toast.add({ severity: 'error', summary: 'Errors occur', detail: '代理检查失败', life: 3000 })
  }
  finally {
    testProxyLoading.value = false
  }
}

/** 刷新 URL */
async function refreshURL() {
  refreshUrlLoading.value = true
  try {
    const response = await fetch(`/api/proxy/refresh-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshUrl: windowInfo.value.refreshUrl }),
    })
    const result = await response.json()
    console.log(result)
    // 刷新成功，重新检查代理
    if (result.data) {
      proxyDetection()
    }
    else {
      console.error('刷新 URL 失败')
      toast.add({ severity: 'error', summary: 'Errors occur', detail: result.message, life: 3000 })
    }
  }
  catch (error) {
    console.error(error)
    toast.add({ severity: 'error', summary: 'Errors occur', detail: '刷新 URL 失败', life: 3000 })
  }
  finally {
    refreshUrlLoading.value = false
  }
}

function getCoreInfo() {
  fetch(`/api/browser/core-info?dirId=${dirId}`)
    .then(response => response.json())
    .then((result) => {
      if (result.code === 0) {
        coreVersion.value = result.data.version
      }
    })
    .catch(error => console.error(error))
}

onBeforeMount(() => {
  getWindowInfo()
  proxyDetection()
  getCoreInfo()
})
</script>

<template>
  <div class="layout">
    <div class="header">
      <div class="left">
        <div class="sort-number">
          {{ windowInfo.workspaceName?.slice(0, 3).toLocaleUpperCase() }}-{{ windowInfo.windowSortNum }}
        </div>
        <div class="window-name">
          {{ windowInfo.windowName }}
        </div>
      </div>
      <div class="time">
        {{ timeZone }} (GMT{{ offsetHours }}) <span class="now">{{ now }}</span>
      </div>
    </div>

    <IpChangeWarnMessage v-if="!testProxyLoading && windowInfo.lastIp && proxyInfo.ip && proxyInfo.ip !== windowInfo.lastIp" />

    <div class="card base-info">
      <div class="card-header">
        <Skeleton v-if="testProxyLoading" shape="circle" size="3rem" class="mr-2" />
        <RxSvgIcon v-else class="city-logo" :class="{ fail: !isTestSuccess }" :name="isTestSuccess ? `country-code/${proxyInfo.country_code}` : 'base/rx_ic_internet_error'" />
        <Teleport defer :to="ipLocationEl" :disabled="!isMobile || !ipLocationEl">
          <div class="operate" :style="{ marginTop: isMobile ? 'var(--spacing-2xl, 16px)' : '' }">
            <rx-button v-if="windowInfo.refreshUrl" v-model:loading="refreshUrlLoading" icon="base/rx_ic_renew" class="btn" :label="$t('刷新 URL')" outlined
                       :disabled="refreshUrlLoading || testProxyLoading" @click="refreshURL"
            />
            <rx-button v-model:loading="testProxyLoading" class="btn" icon="base/rx_ic_speed_test" :label="$t('测试代理')" outlined :disabled="refreshUrlLoading || testProxyLoading"
                       @click="proxyDetection"
            />
          </div>
        </Teleport>
      </div>
      <div ref="ipLocationEl" class="min-w-xs">
        <div class="location">
          <Skeleton v-if="testProxyLoading" height="1.7rem" />
          <template v-else>
            {{ proxyInfo.country || '--' }} / {{ proxyInfo.region || '--' }} / {{ proxyInfo.city || '--' }}
          </template>
        </div>
        <div class="ip">
          <Skeleton v-if="testProxyLoading" class="mt-2" height="2rem" />
          <template v-else>
            <span :class="{ 'is-ip-changed': windowInfo.lastIp && proxyInfo.ip && proxyInfo.ip !== windowInfo.lastIp }">IP: {{ proxyInfo.ip || '--' }}</span>
          </template>
        </div>
      </div>

      <div class="dashboard-bg" v-html="dashboardBgSvg" />
    </div>

    <div class="card-horizontal">
      <div class="card more-info profile">
        <div class="list">
          <div class="title">
            {{ $t('窗口信息') }}
          </div>
          <template v-for="item in profileInfoList" :key="item.label">
            <div class="item">
              <div class="label">
                <component :is="item.label" />:
              </div>
              <div class="value">
                <component :is="item.customRender(windowInfo)" />
              </div>
            </div>
          </template>
        </div>

        <div class="list">
          <div class="title">
            {{ $t('指纹信息') }}
          </div>
          <template v-for="item in fingerprintInfoList" :key="item.label">
            <div class="item">
              <div class="label">
                <component :is="item.label" />:
              </div>
              <div class="value">
                <template v-if="fetchWindowInfoLoading">
                  <Skeleton :width="item.width" height="1.3rem" />
                </template>
                <template v-else>
                  {{ item.format(windowInfo) }}
                </template>
              </div>
            </div>
          </template>
        </div>
      </div>

      <div v-if="windowInfo?.windowPlatformList?.length || windowInfo.defaultOpenUrl?.length" class="card more-info account">
        <div class="list">
          <div class="title">
            {{ $t('平台账号') }}
          </div>
          <TwoFactorAuth v-model:win-info="windowInfo" />
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="info">
        <i18n-t :keypath="$t('IP 查询数据来源于 {link}', { link: '{link}' })" scope="global">
          <template #link>
            <a :href="ipchecker.fullUrl" target="_blank">{{ ipchecker.host }}</a>
          </template>
        </i18n-t>
      </div>
      <div class="version">
        version {{ coreVersion }}
      </div>
    </div>

    <div class="ellipse-bg">
      <div class="blue" />
      <div class="purple" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ellipse-bg {
  display: flex;
  position: fixed;
  top: 104%;
  left: -200px;
  right: -30px;
  height: 656.408px;
  flex-shrink: 0;
  opacity: 0.6;
  filter: blur(150px);
  transform: rotate(10deg);

  .blue {
    width: 866.302px;
    height: 648.468px;
    flex-shrink: 0;
    border-radius: var(--radius-none, 866.302px);
    background: var(--Color-blue-300, #12a3fc);
    animation: ripple 15s linear infinite;
  }

  .purple {
    width: 617.019px;
    height: 461.868px;
    flex-shrink: 0;
    border-radius: var(--radius-none, 617.019px);
    background: #ca59ff;
    animation: ripple 15s linear infinite;
  }
}

@keyframes ripple {
  0% {
    transform: rotate(0);
  }

  100% {
    transform: rotate(360deg);
  }
}

.layout {
  display: flex;
  max-width: 1000px;
  margin: 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-2xl, 16px);
  padding: 16px 15px 90px 15px;

  *:not(.ellipse-bg) {
    z-index: 1;
  }
}

.header {
  display: flex;
  padding-top: var(--spacing-2xl, 16px);
  justify-content: space-between;
  align-items: center;
  align-self: stretch;

  @media (max-width: 540px) {
    & {
      flex-direction: column;
      gap: var(--spacing-2xl, 16px);
      align-items: flex-start;
    }
  }

  .left {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg, 8px);

    .sort-number {
      display: flex;
      padding: var(--spacing-xs, 2px) var(--spacing-md, 6px);
      justify-content: center;
      align-items: center;
      gap: 10px;
      border-radius: var(--radius-2xl, 12px);
      background: var(--Colors-Background-bg-brand, #12a3fc);
      color: var(--Colors-Text-text-action-primary, #fff);
      font-family: 'JetBrains Mono';
      font-size: 12px;
      font-style: normal;
      font-weight: 700;
      line-height: normal;
    }

    .window-name {
      color: #000;
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 600;
      line-height: var(--Line-Height-text-xs, 16px);
      /* 114.286% */
    }
  }

  .time {
    color: var(--Colors-Text-text-tertiary, #7c8387);
    text-align: right;
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;

    .now {
      color: var(--Chrome-Light-Active, #36373a);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: normal;
    }
  }
}

.card {
  border-radius: var(--radius-2xl, 12px);
  border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  background: #fff;
  padding: var(--spacing-4xl, 24px);
  /* shadow-xs */
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

  &.profile {
    flex: 2;
  }

  &.account {
    flex: 1;
  }

  .list {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xl, 12px);
    align-self: stretch;

    .title {
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 600;
      line-height: var(--Line-Height-text-lg, 20px);
      /* 142.857% */
    }

    .item {
      display: flex;
      align-items: flex-start;
      gap: var(--spacing-2xl, 16px);
      align-self: stretch;

      .label {
        width: 92px;
        color: var(--Colors-Text-text-secondary, #575d61);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 500;
        line-height: var(--Line-Height-text-xs, 16px);
        /* 133.333% */
      }

      .value {
        flex: 1 0 0;
        color: var(--Colors-Text-text-tertiary, #7c8387);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: var(--Line-Height-text-xs, 16px);
        word-break: break-all;
        white-space: wrap;
        /* 133.333% */

        .tag-wrap {
          display: flex;
          align-items: center;
          gap: var(--spacing-md, 6px);
          flex-wrap: wrap;

          .tag {
            display: flex;
            min-width: 24px;
            padding: var(--spacing-sm, 4px) var(--spacing-lg, 8px) var(--spacing-sm, 4px) var(--spacing-sm, 4px);
            justify-content: center;
            align-items: center;
            gap: var(--spacing-none, 0px);
            border-radius: 40px;
            border: 0.5px solid var(--Component-Colors-Tag-border, #e4e8eb);
            background: var(--Component-Colors-Tag-bg, #f0f3f5);

            .dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              margin: 0 4px;
              background-color: var(--tag-color);
            }
          }
        }
      }
    }
  }
}

.base-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--oversize-spacing-4rem, 64px);
  align-self: stretch;
  overflow: hidden;
  position: relative;

  @media (max-width: 428px) {
    & {
      gap: var(--oversize-spacing-2rem, 32px);
    }
  }

  > * {
    z-index: 1;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    align-self: stretch;

    .city-logo {
      width: 48px;
      height: 48px;
      border-radius: 50%;

      &.fail {
        background-color: #f0f3f5;
      }
    }
  }

  .operate {
    display: flex;
    align-items: center;
    gap: var(--spacing-xl, 12px);

    .btn {
      display: flex;
      min-width: 24px;
      padding: var(--spacing-md, 6px) 10px;
      justify-content: center;
      align-items: center;
      gap: var(--spacing-md, 6px);
      border-radius: var(--radius-md, 6px);
      border: 1px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
      background: var(--Component-Colors-Buttons-Secondary-bg, #fff);
      /* shadow-sm */
      box-shadow:
        0px 4px 4px -1px rgba(0, 0, 0, 0.02),
        0px 1px 1px 0px rgba(0, 0, 0, 0.06);
      color: #000;
    }
  }

  .dashboard-bg {
    position: absolute;
    right: -75px;
    top: -186px;
    width: 549px;
    height: 528px;
    z-index: 0;

    :deep(svg) {
      width: 473.777px;
      height: 488.667px;
      mask-image: linear-gradient(180deg, rgba(255, 255, 255, 0) 20.36%, rgba(255, 255, 255, 0.9) 92.52%);
      -webkit-mask-image: linear-gradient(180deg, rgba(255, 255, 255, 0) 20.36%, rgba(255, 255, 255, 0.9) 92.52%);
      flex-shrink: 0;
    }
  }
}

.card-horizontal {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  align-self: stretch;

  @media (max-width: 800px) {
    & {
      flex-direction: column;
    }
  }
}

.more-info {
  display: flex;
  padding: var(--spacing-2xl, 16px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--oversize-spacing-3rem, 48px);
  flex: 1 0 0;
  align-self: stretch;
}

.location {
  color: var(--Colors-Text-text-primary, #171c1f);
  font-family: Inter;
  font-size: 20px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-3xl, 30px);
  /* 150% */
}

.ip {
  color: var(--Colors-Text-text-brand, #12a3fc);
  font-family: Inter;
  font-size: 32px;
  font-style: normal;
  font-weight: 600;
  line-height: var(--Line-Height-display-sm, 38px);
  /* 118.75% */

  .is-ip-changed {
    color: var(--Color-yellow-300, #fc9d12);
  }
}

.footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;

  .info {
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 133.333% */
  }

  .version {
    color: var(--Colors-Text-text-subtle, #c7cdd1);
    text-align: right;
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 133.333% */
  }
}
</style>
