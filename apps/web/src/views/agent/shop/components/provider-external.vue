<script setup lang="ts">
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useSimpleLocale } from '/@/stores/locale'
import { copyText, getImage } from '/@/utils/basic'
import { useProviderJump } from '/@/views/agent/shop/hooks/useProviderJump'
import type { UserGetProxyVendorListListData } from '@roxy/backend-api'
import rolaGlobe from '/@/assets/images/proxy/rola-banner-globe.png'

type ShopItem = UserGetProxyVendorListListData['data'][number]
/** 动态代理类型卡片，带独立购买页地址 */
type DynamicProxyTypeItem = NonNullable<ShopItem['dynamicProxyTypeList']>['list'][number]

const { data } = defineProps<{
  data: ShopItem
}>()

const autoJump = defineModel<boolean>('autoJump')

const [showToast] = useResponseToast()
const simpleLocale = useSimpleLocale()
const { jumpToProvider } = useProviderJump()
const comparison = useTemplateRef('comparison')

const account = computed(() => [
  {
    label: $t('账号：'),
    value: data.jumpInfo?.username,
  },
  {
    label: $t('初始密码：'),
    value: data.jumpInfo?.password,
  },
])

onBeforeMount(() => {
  if (autoJump.value) {
    autoJump.value = false
    jumpToProvider(data)
  }
})

/**
 * 顶部横幅右侧的规模数字。接口暂无该字段，先只对 Rola IP 展示设计稿文案（设计稿 10263:72242）
 */
const isRolaProvider = computed(() => /rola/i.test(data.vendorName ?? ''))
const heroHighlight = computed(() => isRolaProvider.value ? '80M+ IP' : '')

/** Figma 原始 SVG 使用 currentColor，由设计稿的语义颜色变量着色。 */
const ROLA_FEATURE_ICONS = [
  { name: 'proxy-store/rola-lightning', color: 'var(--colors-icon-icon-success)' },
  { name: 'proxy-store/rola-internet-check', color: 'var(--colors-icon-icon-brand)' },
  { name: 'proxy-store/rola-internet-pin', color: 'var(--colors-icon-icon-warning)' },
  { name: 'proxy-store/rola-coins', color: 'var(--component-alert-announcement-icon-notif)' },
] as const

/** 场景图标统一使用 Figma 的品牌蓝色，浅色 / 深色共用。 */
const ROLA_USE_CASE_ICONS = [
  'proxy-store/rola-scraping',
  'proxy-store/rola-multiple-accounts',
  'proxy-store/rola-seo',
  'proxy-store/rola-ad-verification',
] as const

/** 特性图标底色，按顺序循环（设计稿 10263:75045） */
const FEATURE_ICON_BG = [
  'bg-[var(--colors-background-bg-success)]',
  'bg-[var(--component-alert-bg-info)]',
  'bg-[var(--component-alert-bg-warn)]',
  'bg-[var(--component-alert-bg-notif)]',
]

function onCopy(value: string) {
  copyText(value)
  showToast(0, $t('复制成功'))
}

/** 打开该类型自己的购买页，登录态沿用厂商跳转 */
function onJumpProxyType(item: DynamicProxyTypeItem) {
  if (!item.jumpUrl) {
    return
  }
  void jumpToProvider(data, item.jumpUrl)
}

function getProxyTypeTitle(title: string, index: number) {
  if (index > 2 || !simpleLocale.currentLocale.toLowerCase().startsWith('en')) {
    return title
  }
  return title.trim().replace(/\s*\bproxy\b\s*/gi, ' ').replace(/\s+/g, ' ').trim()
}
</script>

<template>
  <div class="relative flex flex-col items-center px-6 py-10 overflow-y-auto" :class="$style.external">
    <div class="w-full max-w-245 flex flex-col gap-8">
      <!-- 顶部厂商横幅 -->
      <button type="button" class="relative w-full flex items-center gap-4 px-6 py-5 rounded-3 overflow-hidden cursor-pointer border-0 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white" :class="$style.hero" @click="jumpToProvider(data)">
        <div class="pointer-events-none select-none absolute overflow-hidden" :class="$style.globe">
          <img class="absolute max-w-none" :class="$style.globeImage" draggable="false" :src="rolaGlobe" alt="">
        </div>
        <img class="relative block size-15 shrink-0 rounded-[11px] bg-white" :class="$style.heroLogo" :src="data.vendorIcon" alt="">
        <div class="relative flex-1 min-w-0 flex flex-col gap-1.5">
          <div class="flex items-center flex-wrap gap-3">
            <div class="color-white font-[Archivo] text-6 font-700 leading-8">
              {{ data.vendorName }}
            </div>
            <div v-if="data.proxyTypeList?.length" class="flex flex-wrap gap-1.5">
              <span v-for="item in data.proxyTypeList" :key="item" :class="$style.heroTag">{{ item }}</span>
            </div>
          </div>
          <div v-tooltip.top="data.introList?.content" class="truncate color-white text-3.5 leading-5" v-html="data.introList?.content" />
        </div>
        <div v-if="heroHighlight" class="relative shrink-0 color-white text-7 font-700 leading-9 whitespace-nowrap">
          {{ heroHighlight }}
        </div>
      </button>

      <div class="flex flex-col gap-6">
        <!-- 特性 -->
        <div v-if="data.introList?.list?.length" class="grid grid-cols-4 gap-5" :class="$style.features">
          <div v-for="(item, index) in data.introList.list" :key="item.title" class="min-w-0 flex items-start gap-3">
            <div class="shrink-0 flex p-2 rounded-full" :class="FEATURE_ICON_BG[index % FEATURE_ICON_BG.length]">
              <SvgIcon v-if="isRolaProvider && ROLA_FEATURE_ICONS[index]" :name="ROLA_FEATURE_ICONS[index].name" size="20" :color="ROLA_FEATURE_ICONS[index].color" aria-hidden="true" />
              <RxImage v-else container-class="size-5 shrink-0" class="block size-5" :src="item.icon" :alt="item.title" />
            </div>
            <div class="min-w-0 flex-1 flex flex-col gap-1">
              <div class="tt-primary text-4 font-500 leading-6">
                {{ item.title }}
              </div>
              <div class="tt-secondary text-3.25 leading-4.5">
                {{ item.content }}
              </div>
            </div>
          </div>
        </div>

        <div v-if="data.introList?.list?.length" :class="$style.divider" />

        <!-- 动态代理类型 -->
        <div v-if="data.dynamicProxyTypeList?.list?.length" class="flex flex-col gap-5">
          <div class="flex items-start justify-between gap-5">
            <div class="tt-primary text-4 font-600 leading-[19px]">
              {{ data.dynamicProxyTypeList.title }}
            </div>
            <button type="button" class="shrink-0 flex items-center gap-1 cursor-pointer border-0 bg-transparent p-0 text-[var(--colors-text-text-link)] text-3.25 leading-4.5 font-500" @click="comparison?.toggle($event)">
              {{ $t('代理 IP 对比') }}
              <SvgIcon name="base/rx_ic_arrow_top_right" size="16" />
            </button>
          </div>
          <div class="grid gap-3" :class="$style.types">
            <button v-for="(item, index) in data.dynamicProxyTypeList.list" :key="item.title" type="button" :disabled="!item.jumpUrl" class="min-w-0 flex flex-col gap-4 p-5 rounded-2 text-left" :class="[$style.typeItem, { 'cursor-pointer': item.jumpUrl }]"
                    @click="onJumpProxyType(item)"
            >
              <div class="shrink-0 flex flex-col gap-3" :class="$style.typeBody">
                <div class="w-full h-6 shrink-0 flex items-center gap-2 min-w-0">
                  <RxImage container-class="size-6 shrink-0" class="block size-6" :src="item.icon" :dark-src="item.iconDark" />
                  <div v-tooltip.top="getProxyTypeTitle(item.title, index)" class="min-w-0 truncate tt-primary text-4 font-600 leading-6">
                    {{ getProxyTypeTitle(item.title, index) }}
                  </div>
                </div>
                <div class="h-10 shrink-0 tt-secondary text-3.5 leading-5 line-clamp-2">
                  {{ item.content }}
                </div>
              </div>
              <div v-if="item.priceText" class="shrink-0 flex items-center whitespace-nowrap tt-warning text-4 font-600 leading-6" :class="$style.typePrice">
                {{ item.priceText }}
              </div>
            </button>
          </div>
          <Popover ref="comparison" :pt="{ content: 'max-w-[min(800px,calc(100vw-64px))] overflow-x-auto' }">
            <table class="w-full text-left text-3.5 border-collapse">
              <caption class="tt-primary text-left font-600 pb-3">
                {{ $t('代理 IP 对比') }}
              </caption>
              <thead class="tt-secondary">
                <tr>
                  <th class="p-3">
                    {{ $t('类型') }}
                  </th>
                  <th class="p-3">
                    {{ $t('详情') }}
                  </th>
                  <th class="p-3">
                    {{ $t('价格') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in data.dynamicProxyTypeList.list" :key="item.title" class="border-t border-solid border-[var(--colors-border-divider)]">
                  <th class="p-3 tt-primary font-500">
                    {{ getProxyTypeTitle(item.title, index) }}
                  </th>
                  <td class="p-3 tt-secondary">
                    {{ item.content }}
                  </td>
                  <td class="p-3 tt-warning whitespace-nowrap">
                    {{ item.priceText }}
                  </td>
                </tr>
              </tbody>
            </table>
          </Popover>
        </div>

        <!-- 适用场景 -->
        <div v-if="data.useCaseList?.list?.length" class="flex flex-wrap items-center gap-4">
          <div class="shrink-0 tt-primary text-4 font-600 leading-[19px]">
            {{ data.useCaseList.title }}
          </div>
          <div class="flex flex-wrap gap-2">
            <div v-for="(item, index) in data.useCaseList.list" :key="item.title" class="min-w-18 flex justify-center items-center px-3 py-2 bg-[var(--colors-background-bg-block)] gap-[var(--spacing-md)] rounded-[var(--radius-md)]">
              <SvgIcon v-if="isRolaProvider && ROLA_USE_CASE_ICONS[index]" :name="ROLA_USE_CASE_ICONS[index]" size="20" color="var(--colors-icon-icon-brand)" aria-hidden="true" />
              <RxImage v-else container-class="size-5 shrink-0" class="block size-5" :src="item.icon" :dark-src="item.iconDark" />
              <div class="tt-primary text-[length:var(--font-size-text-lg)] font-500 leading-[var(--line-height-text-lg)] whitespace-nowrap">
                {{ item.title }}
              </div>
            </div>
          </div>
        </div>

        <div :class="$style.divider" />

        <!-- 专享福利 + 账号信息 -->
        <div class="relative flex items-center gap-7 px-8 py-5 rounded-2 shrink-0 overflow-hidden select-none" :class="$style.gift">
          <img class="absolute bottom-0 left-0" draggable="false" :src="getImage('proxy/bg-left.svg')" alt="">
          <img class="absolute top-0 right-0" draggable="false" :src="getImage('proxy/bg-right.svg')" alt="">
          <img class="relative block size-15 shrink-0" draggable="false" :src="getImage('proxy/gift_icon.svg')" alt="">
          <div class="relative flex-1 min-w-0 flex flex-col gap-3">
            <div class="flex flex-col gap-1.5">
              <div :class="$style.giftTitle">
                {{ $t('Roxy 用户专享福利｜流量包或折扣券') }}
              </div>
              <div class="tt-secondary text-3.5 leading-4.5">
                {{ $t('专属账户已创建，无需注册。前往 {home}，即可自动领取专享福利并使用。', { home: data.vendorName }) }}
              </div>
            </div>
            <template v-if="data.jumpInfo?.password">
              <div :class="$style.dashed" />
              <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
                <div v-for="item in account" :key="item.label" class="flex items-center gap-2 select-text">
                  <span class="tt-secondary text-3.25 leading-4.5 break-all">{{ item.label }}{{ item.value }}</span>
                  <button type="button" class="shrink-0 flex items-center justify-center border-0 bg-transparent p-0 cursor-pointer" :aria-label="$t('复制') + item.label" @click="onCopy(item.value!)">
                    <SvgIcon name="base/rx_ic_copy" size="16" color="var(--colors-icon-icon-secondary)" />
                  </button>
                </div>
              </div>
            </template>
          </div>
          <RxButton class="relative shrink-0" size="lg" icon="base/rx_ic_arrow_top_right" :label="$t('前往 {home}', { home: data.vendorName })" @click="jumpToProvider(data)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
.external {
  container-type: inline-size;
  scrollbar-gutter: stable both-edges;
}

/* 顶部横幅：Rola 品牌渐变，浅色 / 深色模式一致（设计稿 10263:72242） */
.hero {
  background: var(--pattern-proxystore-rola-hero-bg);
}

.globe {
  top: -0.35px;
  right: 63.43px;
  width: 461.744px;
  height: 100.35px;
}

.globeImage {
  top: -68.32%;
  left: -15.91%;
  width: 134.05%;
  height: 621.96%;
}

.heroLogo {
  border: 1.364px solid var(--pattern-proxystore-rola-logo-border);
}

.heroTag {
  display: flex;
  align-items: center;
  padding: 5px 6px;
  border-radius: 4px;
  border: 0.5px solid var(--pattern-proxystore-rola-tag-border);
  background: var(--pattern-proxystore-rola-tag-bg);
  color: var(--pattern-proxystore-rola-tag-text);
  font-family: 'JetBrains Mono';
  font-size: 12px;
  font-weight: 700;
  line-height: 12px;
  white-space: nowrap;
}

.divider {
  position: relative;
  height: 0;
  flex-shrink: 0;

  &::before {
    content: '';
    position: absolute;
    inset-inline: 0;
    top: -0.25px;
    border-top: 0.5px solid var(--colors-border-divider);
  }
}

.types {
  grid-template-columns: minmax(0, var(--pattern-proxystore-type-card-first-width)) repeat(3, minmax(0, 1fr));
}

/* 设计稿文字区域为 202px，右侧比常规内边距多用 8px，避免英文标题被挤换行。 */
.typeBody {
  width: var(--pattern-proxystore-type-body-width);
  max-width: calc(100% + 8px);
  height: var(--pattern-proxystore-type-body-height);
}

.typePrice {
  height: var(--pattern-proxystore-type-price-height);
}

/* 代理类型卡片：hover 时 Rola 绿描边 + 12% 绿色叠加（设计稿 Proxy_type hover 态） */
.typeItem {
  border: 0;
  box-shadow: inset 0 0 0 1px var(--colors-border-border-subtle);
  background: var(--colors-background-bg-action);
  height: var(--pattern-proxystore-type-card-height);
  font: inherit;
  transition:
    background-color 0.2s,
    box-shadow 0.2s;

  &:not(:disabled):hover,
  &:focus-visible {
    box-shadow: inset 0 0 0 2px var(--pattern-proxystore-rola-brand);
    background:
      linear-gradient(var(--pattern-proxystore-rola-highlight), var(--pattern-proxystore-rola-highlight)),
      var(--colors-background-bg-action);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
}

.gift {
  border: 0;
  min-height: 130px;
  box-shadow: inset 0 0 0 1px var(--pattern-proxystore-banner-border);
  background: var(--pattern-proxystore-mood-bg-banner);
}

.giftTitle {
  font-family: 'DingTalk JinBuTi';
  font-size: 18px;
  line-height: 24px;
  background: var(--pattern-proxystore-reward-gradient);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.dashed {
  position: relative;
  height: 0;
  flex-shrink: 0;

  &::before {
    content: '';
    position: absolute;
    inset-inline: 0;
    top: -0.5px;
    border-top: 1px dashed var(--colors-border-border-base);
  }
}

/* 容器不足四张设计稿卡片的宽度时，切成两列，保持卡片内部尺寸。 */
@container (max-width: 972px) {
  .features,
  .types {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero {
    flex-wrap: wrap;
  }

  .gift {
    flex-wrap: wrap;
    padding: 20px;
    gap: 16px;
  }
}
</style>
