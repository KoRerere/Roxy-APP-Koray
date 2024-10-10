<script setup lang="ts">
import type { UnwrapRowType, UserGetWindowInfoV2ListData } from '@roxy/backend-api'
import { RxSvgIcon } from '/@/components/rx-icon'

const winInfo = defineModel<UnwrapRowType<UserGetWindowInfoV2ListData>>('winInfo', { default: {} })

const hostname = location.hostname

async function getTwoFactorCode() {
  winInfo.value.platformUrlList?.forEach(async (item) => {
    item.loading = true
    try {
      const response = await fetch(`http://${hostname}:8888/api/browser/two_factor_token?code=${item.platformEfa}`)
      const { data } = await response.json()
      console.log('data', data)
      item.efaToken = data
      item.countDown = 10
    }
    catch (error) {

    }
    finally {
      item.loading = false
    }
  })
}

getTwoFactorCode()
</script>

<template>
  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30" fill="none">
    <path d="M24.662 20.2252C25.5151 18.6621 25.9999 16.8692 25.9999 14.963C25.9999 9.23559 21.6228 4.53052 16.0312 4.0105" stroke="#E4E8EB" stroke-width="3.66675" stroke-linecap="round" />
    <path d="M11.9446 4.39282C7.35593 5.71694 3.99998 9.94811 3.99998 14.9631C3.99998 21.0384 8.92495 25.9633 15.0002 25.9633C17.6199 25.9633 20.0256 25.0476 21.9149 23.5189" stroke="#12A3FC" stroke-width="3.66675" stroke-linecap="round" />
  </svg>
  <div class="two-factor-auth">
    <template v-for="item in winInfo.platformUrlList" :key="item.id">
      <div class="box">
        <div class="platform-info">
          <RxSvgIcon name="websites/rx_site_facebook" class="platform-icon" />
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
        <div class="two-factor">
          <RxSvgIcon name="base/rx_ic_2fa" />
          <Skeleton v-if="item.loading" shape="circle" size="3rem" class="mr-2" />
          <template v-else>
            <div class="code">
              {{ item.efaToken }}
            </div>
          </template>

          <svg class="progress-circle" width="30" height="30" viewBox="0 0 36 36">
            <circle class="progress-bg" cx="18" cy="18" r="16" />
            <circle class="progress" cx="18" cy="18" r="16" />
          </svg>
        </div>
      </div>
    </template>

    <template v-for="url in winInfo.defaultOpenUrl" :key="url">
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
.two-factor-auth {
  /* 样式 */
}

.progress-circle {
  transform: rotate(-90deg);
}

.progress-bg {
  fill: none;
  stroke: #e6e6e6;
  stroke-width: 4;
}

.progress {
  fill: none;
  stroke-width: 4;
  stroke-dasharray: 100, 100;
  animation: countdown 30s linear infinite;
}

@keyframes countdown {
  0% {
    stroke: #12a3fc; /* 初始颜色 */
    stroke-dasharray: 100, 100;
  }
  65% {
    stroke: #12a3fc; /* 保持初始颜色 */
  }
  66% {
    stroke: #face08; /* 瞬时变为橙色 */
  }
  100% {
    stroke: #face08; /* 保持橙色 */
    stroke-dasharray: 0, 100;
  }
}

.two-factor-auth {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
}
.box {
  display: flex;
  padding: var(--spacing-xl, 12px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
  border-radius: var(--radius-lg, 8px);
  border: 0.5px solid var(--Color-neutrals-100, #f0f3f5);
  background: var(--Color-neutrals-50, #fafbfc);

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
        color: var(--Colors-Text-text-primary, #171c1f);
        font-family: Inter;
        font-size: 14px;
        font-style: normal;
        font-weight: 500;
        line-height: var(--Line-Height-text-lg, 20px); /* 142.857% */
        text-decoration-line: underline;
      }

      .account-text {
        align-self: stretch;
        color: var(--Colors-Text-text-primary, #171c1f);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 400;
        line-height: 16px; /* 133.333% */
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
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 24px;
      font-style: normal;
      font-weight: 600;
      line-height: var(--Line-Height-text-3xl, 30px); /* 125% */
    }
  }
}

.link {
  display: flex;
  padding-left: var(--spacing-xs, 2px);
  align-items: center;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;

  color: var(--Colors-Text-text-brand, #12a3fc);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px); /* 133.333% */
}
</style>
