<script setup lang="ts">
import RxTooltip from '/@/components/rx-tooltip'
import currency from 'currency.js'
import { API } from '/@/api'
import { useThemeStore } from '/@/stores/theme'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { ProxyDescType } from '/@/enums'
import type { UserGetProxyStoreListListData } from '@roxy/backend-api'

type ShopItem = UserGetProxyStoreListListData['data'][number] & {
  props: Record<string, any>
  focus: Record<string, any>
  isMore?: boolean
  proxyProviderTypeStr?: string
}

type MoreItem = Partial<ShopItem> & {
  icon: string
}

type ShopList = (ShopItem | MoreItem)[]

defineProps<{
  onBuyProxy: (props: any) => void
}>()

const themeStore = useThemeStore()
const [_, onlyErrorToast] = useResponseToast()

let ro: ResizeObserver | null = null
const contentRef = useTemplateRef<HTMLDivElement>('content')
const cols = ref(3)
const shopList = ref<ShopList>([])

const showList = computed(() => {
  const moreItem: MoreItem = {
    icon: 'base/rx_ic_more',
    isMore: true,
    proxyProviderName: $t('更多 IP 供应商'),
    proxyProviderDesc: $t('Roxy 集成的高质量代理 IP'),
  }
  return [...shopList.value.slice(0, cols.value), moreItem]
})

const bgSrc = computed(() => {
  return themeStore.realTheme === 'light' ? 'url("/images/proxy/store_bg.png")' : 'url("/images/proxy/store_bg_dark.png")'
})

onBeforeMount(() => {
  getShopList()
})

onMounted(() => {
  if (!contentRef.value)
    return
  ro = new ResizeObserver(([entry]) => {
    const width = entry!.contentRect.width
    cols.value = width >= 1440 ? 4 : 3
  })
  ro.observe(contentRef.value)
})

onBeforeUnmount(() => {
  ro?.disconnect()
})

async function getShopList() {
  const { code, data, msg } = await API.proxy.userGetProxyStoreListList()
  onlyErrorToast(code, msg)
  if (code !== 0)
    return
  shopList.value = data.map((item) => {
    return {
      ...item,
      proxyProviderTypeStr: item.proxyTypeList?.map(item => item.typeName).join(' / '),
      focus: {
        focusProviderName: item.proxyProviderName,
      },
      props: {
        provider: item.isJump
          ? undefined
          : {
            proxyProviderWebsite: item.proxyProviderWebsite,
            proxyTypeList: item.proxyTypeList,
            proxyProviderIcon: item.proxyProviderIcon,
            proxyProviderName: item.proxyProviderName,
          },
      },
    }
  })
}
</script>

<template>
  <div v-show="showList.length" ref="content" class="flex pa-3 gap-3 overflow-x-auto content">
    <component :is="!item.isMore ? RxTooltip : 'div'" v-for="item in showList" :key="item.proxyProviderName" style="background: var(--colors-background-bg-action);"
      class="shrink-0 relative flex items-center pa-3 gap-2.5 rounded-3 cursor-pointer" :class="{ 'min-w-70 flex-1': !item.isMore || showList.length < 4 }" placement="bottom" :delay="500"
      @click="onBuyProxy(item.focus)">
      <template #default>
        <div v-if="item.isNew" class="absolute top-0 -right-1 -translate-y-1/2 new">
          NEW
        </div>
        <SvgIcon v-if="item.isMore" name="other/proxy_cart" size="24" />
        <img v-else draggable="false" class="block w-10 aspect-1 rounded-2 img" :src="item.proxyProviderIcon" :alt="item.proxyProviderName">
        <div class="flex-1 flex flex-col justify-center self-stretch gap-0.5 select-none overflow-hidden">
          <div class="title">
            {{ item.proxyProviderName }}
          </div>
          <div v-if="item.storeType === ProxyDescType.Price" class="price">
            {{ $t('独家特惠: {price} / IP', { price: currency(item.proxyPrice!).format() }) }}
          </div>
          <div v-else-if="item.storeType === ProxyDescType.Icons" class="flex items-center gap-2">
            <span class="description">
              {{ $t('专为 AI 优化:') }}
            </span>
            <img v-for="data in item.newIconList?.slice(0, 3)" :key="data.url" class="block w-4 h-4" :src="data.url">
          </div>
          <i18n-t v-else-if="item.storeType === ProxyDescType.Discount" class="description" tag="div" :keypath="$t('Roxy 用户专享: {discount}', { discount: '{discount}' })" scope="global">
            <template #discount>
              <span class="discount">{{ $t('{value}% 折扣', { value: item.proxyProviderDiscount }) }}</span>
            </template>
          </i18n-t>
          <div v-else class="ellipsis-1 description">
            {{ item.proxyProviderDesc }}
          </div>
        </div>
        <RxButton v-if="item.isMore" severity="secondary" variant="text" size="xxs" icon="base/rx_ic_arrow_right_2" />
        <RxButton v-else-if="item.isJump" class="shrink-0" severity="secondary" variant="outlined" size="md" icon="base/rx_ic_arrow_top_right" />
        <RxButton v-else class="shrink-0" severity="secondary" variant="outlined" size="md" icon="base/rx_ic_cart" @click.stop="onBuyProxy(item.props)" />
      </template>
      <template #content>
        <div class="w-70 flex flex-col gap-1">
          <div class="tooltip_title">
            {{ item.proxyProviderTypeStr }}
          </div>
          <div class="tooltip_desc">
            {{ item.proxyProviderDesc }}
          </div>
        </div>
      </template>
    </component>
  </div>
</template>

<style lang="scss" scoped>
.content {
  background-image: v-bind(bgSrc);
  background-color: var(--pattern-proxystore-mood-bg-store);
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
}

.new {
  padding: 2px 6px;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: normal;
  background: #f53838;
  border-radius: 100px;
}

.img {
  border: 1px solid var(--colors-border-border-inactive);
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}

.price {
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  line-height: 16px;
  background: linear-gradient(90deg, #12a3fc 0%, #db54f9 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.description {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.discount {
  color: var(--colors-text-text-warning);
  font-family: 'DingTalk JinBuTi';
  font-size: 14px;
  line-height: 16px;
}

.tooltip_title {
  color: var(--component-tooltip-text-primary);
  font-size: 12px;
  font-weight: 600;
  line-height: 16px;
}

.tooltip_desc {
  color: var(--component-tooltip-text-secondary);
  font-size: 12px;
  line-height: 16px;
}
</style>
