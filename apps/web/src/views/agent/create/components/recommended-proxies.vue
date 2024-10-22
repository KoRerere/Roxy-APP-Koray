<script setup lang="ts">
import type { UnwrapRowsType, UserGetProxyRecommendInfoListData } from '@roxy/backend-api'
import { API } from '/@/api'

const proxiesList = ref<UnwrapRowsType<UserGetProxyRecommendInfoListData>>([])

function getProxiesList() {
  API.proxy.userGetProxyRecommendInfoList().then((res) => {
    proxiesList.value = res.data.rows
  })
}

function formatProxyJumpAddressText(item) {
  return new URL(item.proxyJumpAddress).hostname
}

getProxiesList()
</script>

<template>
  <div class="recommended-proxies">
    <template v-for="item in proxiesList" :key="item.id">
      <div class="row">
        <div class="header">
          <img :src="item.proxyIcon" class="w-[24px] h-[24px]">
          <span class="title">{{ item.proxyTitle }}</span>
        </div>
        <div class="description">
          {{ item.proxyDesc }}
        </div>
        <div class="footer">
          <a class="site-name" :href="item.proxyJumpAddress" target="_blank">
            {{ formatProxyJumpAddressText(item) }}
          </a>
          <RxButton as="a" label="Visit website" size="sm" icon="base/rx_ic_attachment" outlined class="visit-website" :href="item.proxyVisitAddress" target="_blank" />
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.recommended-proxies {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 20px 0 20px 0;
}

.row {
  display: flex;
  width: 534px;
  padding: var(--spacing-xl, 12px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  border-radius: var(--radius-md, 6px);
  border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  background: var(--Color-neutrals-50, #fafbfc);

  /* shadow-sm */
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;

  .title {
    overflow: hidden;
    color: var(--Colors-Text-text-primary, #171c1f);
    text-overflow: ellipsis;
    font-family: Inter;
    font-size: 13px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 123.077% */
  }
}

.description {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 6;
  align-self: stretch;
  overflow: hidden;
  color: var(--Colors-Text-text-secondary, #575d61);
  text-overflow: ellipsis;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 16px;
  /* 133.333% */
}

.footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;

  .site-name {
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 133.333% */
    text-decoration-line: underline;
  }

  .visit-website {
    color: var(--Component-Colors-Buttons-Secondary-text, #171c1f);
    color: var(--Component-Colors-Buttons-Secondary-text, #171c1f);
    text-align: center;
    font-family: Inter;
    font-size: var(--Font-Size-text-sm, 12px);
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
    /* 133.333% */
  }
}
</style>
