<script setup lang="ts">
import { useThemeStore } from '/@/stores/theme'
import { getImage } from '/@/utils'

type NextType = 'proxy' | 'normal'

defineProps<{
  onNext: (type: NextType) => void
  onClose: () => void
}>()

const { isDarkTheme } = storeToRefs(useThemeStore())

const list = [
  {
    id: 1,
    type: 'proxy',
    title: $t('跨境电商'),
    description: $t('确保每台设备均配备专用的独立直连网络'),
    icons: [
      'rx_accounts_amazon',
      'rx_accounts_shopify',
      'rx_accounts_temu',
      'rx_accounts_aliexpress',
      'rx_accounts_shopee',
      'rx_accounts_tiktok_shop',
      'rx_accounts_ebay',
    ],
  },
  {
    id: 2,
    type: 'normal',
    title: $t('社媒营销'),
    description: $t('多社交账号安全管理方案，账号环境相互隔离，配合稳定增长工作流，实现安全运营'),
    icons: [
      'rx_accounts_facebook',
      'rx_accounts_instagram',
      'rx_accounts_tiktok',
      'rx_accounts_youtube',
      'rx_accounts_twitter',
      'rx_accounts_tinder',
    ],
  },
  {
    id: 3,
    type: 'normal',
    title: $t('数据抓取'),
    description: $t('大规模自动化：数据抓取、网站监控、浏览器重复任务，一应俱全'),
    icons: [
      'tools-playwright',
      'tools-selenium',
      'tools-puppeteer',
      'tools-crawlee',
      'tools-scrapy',
    ],
  },
  {
    id: 4,
    type: 'normal',
    title: $t('其他业务'),
    description: $t('专业功能一应俱全，配置灵活随心定制，强大与易用兼得，满足您的每一个业务需求'),
    icons: [
      'rx_accounts_reddit',
      'rx_accounts_claude',
      'rx_accounts_chatgpt',
      'rx_accounts_netflix',
      'rx_accounts_binance',
    ],
  },
]

function parseValue(name: string) {
  return getImage(`ecommerce/guide/${name}_${isDarkTheme.value ? 'dark' : 'light'}.svg`)
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-9 select-none">
    <div class="tt-primary text-7 font-700 leading-normal">
      {{ $t('请选择您的业务，将为您匹配最佳模式') }}
    </div>
    <div class="grid grid-cols-2 gap-5">
      <div v-for="item in list" :key="item.id" class="w-90 flex flex-col gap-6 pa-7 rounded-3 cursor-pointer item" @click="onNext(item.type as NextType)">
        <div class="tt-primary text-5 font-700 leading-7 text-center">
          {{ item.title }}
        </div>
        <div class="flex items-center justify-center gap-1.5">
          <div v-for="name in item.icons" :key="name" class="w-7 aspect-square flex items-center justify-center pa-0.5 rounded-full icon">
            <img class="block w-6 aspect-square" :src="parseValue(name)">
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.item {
  border: 2px solid transparent;
  box-shadow: 0px 0px 0px 1px var(--colors-border-border-base);
  background: var(--colors-background-bg-action);
  transition: all 0.2s;

  &:hover {
    border-color: var(--colors-border-border-brand);
    box-shadow: none;
  }
}

.icon {
  border: 1px solid var(--colors-border-border-inactive);
  background: var(--colors-background-bg-action);
}
</style>
