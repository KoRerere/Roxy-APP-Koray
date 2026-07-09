<script setup lang="ts">
import { BuyEntryType } from '/@/enums/proxy'
import ProviderBuy from '/@/views/agent/shop/components/provider-buy/index.vue'

const currentProvider = {
  carouselList: [],
  createTime: '2025-08-14 20:48:42',
  iconList: [
    'https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/platform_icon/Facebook.png?version=2.1',
    'https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/platform_icon/reddit.png?version=2.1',
    'https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/platform_icon/tiktok.png?version=2.1',
    'https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/platform_icon/Amazon.png?version=2.1',
    'https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/platform_icon/claude.png?version=2.1',
    'https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/platform_icon/chatgpt.png?version=2.1',
    'https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/platform_icon/gemini.png?version=2.1',
    'https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/platform_icon/Gmail.png?version=2.1',
    'https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/platform_icon/instagram.png?version=2.1',
    'https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/platform_icon/tinder.png?version=2.1',
  ],
  id: 1,
  isJump: 0,
  isNew: 1,
  isOfficial: true,
  jumpInfo: {},
  proxyTypeList: [
    '标准代理 IP',
    '超高质量代理 IP',
  ],
  sort: 1,
  status: 1,
  updateTime: '2026-01-08 11:52:21',
  vendorAdv: [
    'IP质量行业第一',
    'Roxy独家IP资源',
    '成功率99.99%',
    '原生住宅IP',
  ],
  vendorDesc: 'RoxyBrowser 与全球知名电信运营商 Cogent/NTT/GTT 合作提供的一级网络服务，同时具有高速与稳定性。',
  vendorDiscount: null,
  vendorIcon: 'https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/proxy_icon/proxy_store_icon/proxyprovider-roxy.svg',
  vendorName: 'RoxyIP',
  vendorWebsite: 'https://roxybrowser.com',
}
</script>

<template>
  <div class="flex flex-col w-full h-full overflow-hidden">
    <ProviderBuy :data="currentProvider" :entry-type="BuyEntryType.Immediate" :to-rola="() => { }" />
  </div>
</template>

<style scoped></style>
