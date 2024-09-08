<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import type { UnwrapRowType, UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import { fingerprintInfoList } from './constants'
import dashboardBgSvg from '/@/assets/image/dashboard-bg.svg?raw'

const dirId = new URLSearchParams(window.location.search).get('id')

const toast = useToast()

const windowInfo = ref<UnwrapRowType<UserGetWindowInfoV2ListData>>({})
/** 获取窗口详情 loading */
const fetchWindowInfoLoading = ref(false)
const refreshUrlLoading = ref(false)
const testProxyLoading = ref(false)
const proxyInfo = ref<Record<string, any>>({})

/** 获取当前窗口信息 */
function getWindowInfo() {
  fetchWindowInfoLoading.value = true
  fetch(`http://localhost:8888/api/browser/list?dirId=${dirId}`)
    .then(response => response.json())
    .then((result) => {
      console.log(result)
      const { code, data, msg } = result
      if (code === 0) {
        windowInfo.value = data.rows[0]
      }
      else {
        console.error('获取窗口信息失败')
        toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 3000 })
      }
    })
    .catch(error => console.error(error))
    .finally(() => {
      setTimeout(() => {
        fetchWindowInfoLoading.value = false
      }, 1500)
    })
}

getWindowInfo()

/** 代理检查 */
function proxyDetection() {
  testProxyLoading.value = true
  fetch(`http://localhost:8888/api/proxy/detection?dirId=${dirId}`)
    .then(response => response.json())
    .then((result) => {
      console.log(result)
      if (result.code === 0) {
        proxyInfo.value = result.data
      }
      else {
        console.error('代理检查失败')
        toast.add({ severity: 'error', summary: 'Error', detail: result.message, life: 3000 })
        proxyInfo.value = {}
      }
    })
    .catch(error => console.error(error))
    .finally(() => {
      setTimeout(() => {
        testProxyLoading.value = false
      }, 1500)
    })
}

/** 刷新 URL */
function refreshURL() {
  refreshUrlLoading.value = true
  fetch(`http://localhost:8888/api/proxy/refresh-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshUrl: windowInfo.value.refreshUrl }),
  })
    .then(response => response.json())
    .then((result) => {
      console.log(result)
      // 刷新成功，重新检查代理
      if (result.data) {
        proxyDetection()
      }
      else {
        console.error('刷新 URL 失败')
        toast.add({ severity: 'error', summary: 'Error', detail: result.message, life: 3000 })
      }
    })
    .catch(error => () => {
      console.error(error)
      toast.add({ severity: 'error', summary: 'Error', detail: '刷新 URL 失败', life: 3000 })
    })
    .finally(() => {
      refreshUrlLoading.value = false
    })
}

proxyDetection()
</script>

<template>
  <Toast />
  <div class="layout">
    <div class="header">
      <div class="left">
        <div class="sort-number">
          {{ windowInfo.windowSortNum }}
        </div>
        <div class="window-name">
          {{ windowInfo.windowName }}
        </div>
      </div>
      <div class="time">
        Europe/London (GMT+01:00) 2024-08-16 08:26
      </div>
    </div>

    <div class="card base-info">
      <div class="card-header">
        <Skeleton v-if="testProxyLoading" shape="circle" size="3rem" class="mr-2" />
        <div v-else class="city-logo" />
        <div class="operate">
          <Button
            v-if="windowInfo.refreshUrl"
            class="btn"
            label="Refresh URL" icon="pi pi-sync"
            :loading="refreshUrlLoading" outlined
            :disabled="refreshUrlLoading || testProxyLoading"
            @click="refreshURL"
          />
          <Button
            class="btn"
            label="Test proxy" icon="pi pi-wifi"
            :loading="testProxyLoading" outlined
            :disabled="refreshUrlLoading || testProxyLoading"
            @click="proxyDetection"
          />
        </div>
      </div>
      <div class="min-w-xs">
        <div class="location">
          <Skeleton v-if="testProxyLoading" height="1.7rem" />
          <template v-else>
            {{ proxyInfo.continent }} / {{ proxyInfo.region }} / {{ proxyInfo.city }}
          </template>
        </div>
        <div class="ip">
          <Skeleton v-if="testProxyLoading" class="mt-2" height="2rem" />
          <template v-else>
            IP: {{ proxyInfo.ip }}
          </template>
        </div>
      </div>

      <div class="dashboard-bg" v-html="dashboardBgSvg" />
    </div>

    <div class="card more-info">
      <div class="list">
        <div class="title">
          Profile Info
        </div>
        <div class="item">
          <div class="label">
            Notes:
          </div>
          <div class="value">
            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae
          </div>
        </div>
        <div class="item">
          <div class="label">
            Group:
          </div>
          <div class="value">
            --
          </div>
        </div>
        <div class="item">
          <div class="label">
            Tags:
          </div>
          <div class="value">
            <div class="tag-wrap">
              <div class="tag">
                <img src="/@/assets/image/tags/tag-red.svg">
                Blocked
              </div>
              <div class="tag">
                <img src="/@/assets/image/tags/tag-blue.svg">
                Health
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="list">
        <div class="title">
          Fingerprint Info
        </div>
        <template v-for="item in fingerprintInfoList" :key="item.label">
          <div class="item">
            <div class="label">
              {{ item.label }}:
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
  </div>
</template>

<style lang="scss" scoped>
.header {
  display: flex;
  padding-top: var(--spacing-2xl, 16px);
  justify-content: space-between;
  align-items: center;
  align-self: stretch;

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
      line-height: var(--Line-Height-text-xs, 16px); /* 114.286% */
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
  }
}

.layout {
  display: flex;
  max-width: 1000px;
  margin: 0 auto;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-2xl, 16px);
}

.card {
  border-radius: var(--radius-2xl, 12px);
  border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  background: #fff;
  padding: var(--spacing-4xl, 24px);
  /* shadow-xs */
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

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
      line-height: var(--Line-Height-text-lg, 20px); /* 142.857% */
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
        line-height: var(--Line-Height-text-xs, 16px); /* 133.333% */
      }

      .value {
        flex: 1 0 0;
        color: var(--Colors-Text-text-tertiary, #7c8387);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: var(--Line-Height-text-xs, 16px); /* 133.333% */

        .tag-wrap {
          display: flex;
          align-items: center;
          gap: var(--spacing-md, 6px);

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

            img {
              width: 16px;
              height: 16px;
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
      background-color: #171c1f;
      border-radius: 50%;
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
  line-height: var(--Line-Height-text-3xl, 30px); /* 150% */
}
.ip {
  color: var(--Colors-Text-text-brand, #12a3fc);
  font-family: Inter;
  font-size: 32px;
  font-style: normal;
  font-weight: 600;
  line-height: var(--Line-Height-display-sm, 38px); /* 118.75% */
}
</style>
