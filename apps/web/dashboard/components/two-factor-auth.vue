<script setup lang="ts">
import type { UnwrapRowType, UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import { useToast } from 'primevue/usetoast'
import { RxSvgIcon } from '/@/components/rx-icon'
import { copyText } from '/@/utils/'
import defaultPlatformIcon from '/@/assets/images/base/rx_ic_user_key.svg?url'

const winInfo = defineModel<UnwrapRowType<UserGetWindowInfoV2ListData>>('winInfo', { default: {} })

const toast = useToast()

function startCountdown(item, remainingTime = 0) {
  const worker = new Worker(new URL('./countdown-worker.ts', import.meta.url), {
    type: 'module',
  });
  const duration = 30
  const interval = 10

  worker.postMessage({ duration, remainingTime, interval });

  worker.onmessage = (event) => {
    const { progress, completed } = event.data;

    if (progress !== undefined) {
      item.progress = progress;
    }

    if (completed) {
      item.progress = 0;
      worker.terminate(); // 终止 Worker
      getTwoFactorCode(item);
    }
  };
}

function initTwoFactorCodeList() {
  winInfo.value.windowPlatformList?.forEach((item) => {
    getTwoFactorCode(item)
  })
}

async function getTwoFactorCode(item) {
  if (!item.platformEfa) {
    return
  }
  item.loading = true
  try {
    const response = await fetch(`/api/browser/two-factor-token?code=${item.platformEfa}`)
    const { data } = await response.json()
    console.log('data', data)
    item.efaToken = data.token
    startCountdown(item, data.remainingTime)
  }
  catch (error) {

  }
  finally {
    item.loading = false
  }
}

function handleCopyEfaToken(token) {
  copyText(token)
  toast.add({
    severity: 'success',
    summary: 'Copied successfully',
    // detail: token,
    life: 2000,
  })
}

initTwoFactorCodeList()
</script>

<template>
  <div class="two-factor-auth">
    <template v-for="item in winInfo.windowPlatformList" :key="item.id">
      <div class="box">
        <div class="platform-info">
          <img :src="item.platformIcon || defaultPlatformIcon" class="platform-icon">
          <div class="platform-account">
            <a :href="item.platformUrl" target="_blank" class="platform-url">
              {{ item.platformUrl }}
            </a>
            <div class="account-text">
              {{ item.platformUserName }}
            </div>
          </div>
          <a :href="item.platformUrl" target="_blank">
            <RxSvgIcon name="base/rx_ic_outlink" />
          </a>
        </div>
        <div v-if="item.platformEfa" class="two-factor">
          <RxSvgIcon name="base/rx_ic_2fa" />
          <Skeleton v-if="item.loading" shape="circle" size="3rem" class="mr-2" />
          <template v-else>
            <div class="code">
              <span v-tooltip.top="'Click to copy'" class="cursor-pointer" @click="handleCopyEfaToken(item.efaToken)">
                {{ item.efaToken }}
              </span>
            </div>
            <svg class="progress-circle" width="30" height="30" viewBox="0 0 36 36">
              <circle class="progress-bg" cx="18" cy="18" r="14" />
              <circle class="progress" cx="18" cy="18" r="14"
                :style="{ '--progress': -item.progress, '--stroke-color': item.progress > 0.66 ? '#F53838' : '#12a3fc' }" />
            </svg>
          </template>
        </div>
      </div>
    </template>

    <template v-for="url in winInfo.defaultOpenUrl?.filter(Boolean)" :key="url">
      <div class="link">
        <RxSvgIcon name="base/rx_ic_link" />
        <a :href="url" target="_blank">
          {{ url }}
        </a>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.progress-circle {
  transform: rotate(-90deg);
}

.progress-bg {
  fill: none;
  stroke: #e6e6e6;
  stroke-width: 4.5;
}

.progress {
  fill: none;
  stroke-width: 4.5;
  stroke-dasharray: calc(2 * 3.14159 * 14);
  /* 计算圆的周长 */
  stroke: var(--stroke-color, #12a3fc);
  stroke-linecap: round;
  stroke-dashoffset: calc(2 * 3.14159 * 14 * var(--progress));
  // transition: stroke-dashoffset calc(1 / 30 * 1s);
}

.two-factor-auth {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
}

.platform-icon {
  height: 20px;
}

.box {
  display: flex;
  padding: var(--spacing-xl, 12px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
  border-radius: var(--radius-lg, 8px);
  border: 0.5px solid var(--primitives-neutrals-100, #f0f3f5);
  background: var(--primitives-neutrals-50, #fafbfc);

  .platform-info {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-md, 6px);
    align-self: stretch;

    .platform-account {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-sm, 4px);
      flex: 1 0 0;

      .platform-url {
        flex: 1 0 0;
        color: var(--colors-text-text-primary, #fafafa);
        font-family: Inter;
        font-size: 14px;
        font-style: normal;
        font-weight: 500;
        line-height: var(--Line-Height-text-lg, 20px);
        /* 142.857% */
        text-decoration-line: underline;
      }

      .account-text {
        align-self: stretch;
        color: var(--colors-text-text-primary, #fafafa);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: 16px;
        /* 133.333% */
      }
    }
  }

  .two-factor {
    display: flex;
    align-items: center;
    gap: var(--spacing-md, 6px);
    align-self: stretch;

    .code {
      flex: 1 0 0;
      color: var(--colors-text-text-primary, #fafafa);
      font-family: Inter;
      font-size: 24px;
      font-style: normal;
      font-weight: 600;
      line-height: var(--Line-Height-text-3xl, 30px);
      /* 125% */
    }
  }
}

.link {
  display: flex;
  padding-left: var(--spacing-xs, 2px);
  align-items: center;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;

  color: var(--colors-text-text-brand, #12a3fc);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
  /* 133.333% */
}
</style>
