<script setup lang="ts">
import { ref } from 'vue'
import dashboardBgSvg from '/@/assets/image/dashboard-bg.svg?raw'
import { fingerprintInfoList } from './constants'

const dirId = new URLSearchParams(window.location.search).get('id')

const testProxyLoading = ref(false)
const proxyInfo = ref<Record<string, any>>({})

function proxyDetection() {
  testProxyLoading.value = true
  fetch(`http://localhost:8888/api/proxy/detection?dirId=${dirId}`)
    .then(response => response.json())
    .then((data) => {
      console.log(data)
      proxyInfo.value = data
    })
    .catch(error => console.error(error)).finally(() => {
      setTimeout(() => {
        testProxyLoading.value = false
      }, 1500)
    })
}

proxyDetection()
</script>

<template>
  <div class="layout">
    <div class="card base-info">
      <div class="header">
        <Skeleton v-if="testProxyLoading" shape="circle" size="3rem" class="mr-2" />
        <div v-else class="city-logo" />
        <div class="operate">
          <div class="btn">
            Refresh URL
          </div>
          <div class="btn" @click="proxyDetection">
            Test proxy
          </div>
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
              {{ item.value }}
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
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

  .header {
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
        cursor: pointer;
        /* shadow-sm */
        box-shadow:
          0px 4px 4px -1px rgba(0, 0, 0, 0.02),
          0px 1px 1px 0px rgba(0, 0, 0, 0.06);
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

    :global(svg) {
      width: 473.777px;
      height: 488.667px;
      mask-image: linear-gradient(180deg, rgba(255, 255, 255, 0) 20.36%, rgba(255, 255, 255, 0.9) 92.52%);
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
