<script setup lang="ts">
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'

const description = [
  {
    title: 'Introductions:',
    content: 'Users can read and write account configuration information, create, open, and manage environments via API, and also achieve browser automation by integrating with automation frameworks such as Selenium, Puppeteer, and Playwright.',
  },
  {
    title: 'Restriction:',
    content: 'API request rate limit: 100 requests per minute<br>Team API concurrent devices limit: 200',
  },
  {
    title: 'Resources:',
    content: 'For API installations and instructions, please visit: <a class="decoration-underline" href="">API Documentation.</a>',
  },
]
</script>

<template>
  <div class="flex flex-col w-full h-full api">
    <div class="api-header">
      <RxSvgIcon name="base/rx_ic_doc_code" />
      <span>API Keys</span>
    </div>
    <div class="flex-1 api-content">
      <div>123</div>
      <div class="api-description">
        <div v-for="item in description" :key="item.title">
          <div class="api-description-title">
            {{ item.title }}
          </div>
          <div class="api-description-content" v-html="item.content" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.api {
  &-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 16px;
    font-weight: 600;
    line-height: var(--Line-Height-text-xl, 24px);
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  }

  &-content {
    margin: 0 auto;
    width: 50%;
  }

  &-description {
    display: flex;
    flex-direction: column;
    padding: var(--spacing-4xl, 24px) var(--spacing-xl, 12px);
    gap: var(--spacing-4xl, 24px);

    &-title {
      color: var(--Colors-Text-text-primary, #171c1f);
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 600;
      line-height: 16px;
    }

    &-content {
      margin-top: var(--spacing-xl, 12px);
      color: var(--Colors-Text-text-secondary, #575d61);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 400;
      line-height: var(--Line-Height-text-lg, 20px);
    }
  }
}
</style>
