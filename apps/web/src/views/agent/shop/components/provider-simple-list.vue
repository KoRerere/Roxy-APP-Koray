<script setup lang="ts">
import { useSimpleLocale } from '/@/stores/locale'
import { useProxyStore } from '/@/stores/proxy'
import { useThemeStore } from '/@/stores/theme'
import type { UserGetProxyVendorListListData } from '@roxy/backend-api'
// import { formatDiscountOff } from '/@/utils/basic'
import { useResizeObserver } from '@vueuse/core'

type ShopItem = UserGetProxyVendorListListData['data'][number] & {
  props: Record<string, any>
  isMore?: boolean
  proxyProviderTypeStr?: string
}

const props = defineProps<{
  onBuyProxy: (props?: any) => Promise<void> | void
}>()

const route = useRoute()
const router = useRouter()
const simpleLocale = useSimpleLocale()
const { isDarkTheme } = storeToRefs(useThemeStore())
const { getProxyVendors } = useProxyStore()

const shopList = ref<ShopItem[]>([])
const roxybrowser = computed(() => shopList.value[0])
const rolaip = computed(() => shopList.value[1])

const imgSrc = computed(() => isDarkTheme.value ? 'url("/images/proxy/shop_card_bg_dark.svg")' : 'url("/images/proxy/shop_card_bg.svg")')
const checkIcon = computed(() => isDarkTheme.value ? 'status/rx_ic_check_fill_dark' : 'status/rx_ic_check_fill_light')

const iconTrackRef = useTemplateRef<HTMLElement>('iconTrackRef')
const iconListRef = useTemplateRef<HTMLElement>('iconListRef')
const iconListOverflow = ref(false)

function updateIconListOverflow() {
  const track = iconTrackRef.value
  const list = iconListRef.value
  if (!track || !list) {
    return
  }
  iconListOverflow.value = list.scrollWidth > track.clientWidth
}

useResizeObserver(iconTrackRef, updateIconListOverflow)
watch(() => roxybrowser.value?.iconList, () => nextTick(updateIconListOverflow))

watch(
  () => route.query._t,
  value => value && buyProxyFromAnnouncement(),
)

onBeforeMount(() => {
  getShopList()
})

async function getShopList() {
  const data = await getProxyVendors(true)
  if (!data) {
    return
  }
  shopList.value = data.map((item) => {
    return {
      ...item,
      props: {
        provider: item.isJump
          ? {
              proxyProviderId: item.id,
            }
          : {
              proxyProviderId: item.id,
              proxyProviderWebsite: item.vendorWebsite,
              proxyProviderIcon: item.vendorIcon,
              proxyProviderName: item.vendorName,
            },
      },
    }
  })

  buyProxyFromAnnouncement()
}

function buyProxyFromAnnouncement() {
  // 通过公告栏跳转购买
  if (route.query.vendorName) {
    const provider = shopList.value.find(item => item.vendorName === route.query.vendorName)
    provider && props.onBuyProxy(provider.props)
    router.replace({ name: 'agent-list' })
  }
  else if (route.query.action === 'buy') {
    props.onBuyProxy()
    router.replace({ name: 'agent-list' })
  }
}
</script>

<template>
  <div v-if="shopList.length" class="flex py-3 px-4 gap-3 content">
    <div class="flex-1 flex flex-col gap-3 min-h-38 pa-4 rounded-2 cursor-pointer roxy" @click.stop="onBuyProxy(roxybrowser.props)">
      <div class="flex-1 flex flex-col gap-2">
        <div class="flex items-center gap-3 col-span-2">
          <img draggable="false" class="block w-12 aspect-1 rounded-full roxy-image" :src="roxybrowser.vendorIcon" :alt="roxybrowser.vendorName">
          <div class="flex items-center gap-2">
            <div class="font-[Archivo] text-5 leading-7 font-700 color-[#ae7407]">
              {{ roxybrowser.vendorName }}
            </div>
            <div class="py-0.5 px-2 rounded-full roxy-tag">
              {{ $t('超高质量 IP') }}
            </div>
            <div class="py-0.5 px-2 rounded-full roxy-tag">
              {{ $t('无网包退') }}
            </div>
            <div v-if="simpleLocale.isZh" class="py-0.5 px-2 rounded-full roxy-tag">
              大陆直连电商
            </div>
            <div class="py-0.5 px-2 rounded-full roxy-tag">
              {{ $t('静态代理 IP') }}
            </div>
          </div>
        </div>
        <div class="pl-15 flex-1 overflow-hidden">
          <div class="flex flex-wrap items-start gap-col-8 gap-row-1.5">
            <div v-for="item in roxybrowser.vendorAdv" :key="item" class="flex items-center gap-1.5">
              <SvgIcon :name="checkIcon" />
              <div class="color-[#111213] text-3 font-500 leading-4.5">
                {{ item }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <RxDivider line-only line-color="var(--pattern-proxystore-mood-button-border)" />
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="color-[#111213] text-3 leading-4 shrink-0">
          {{ $t('社媒 / 电商 / AI专线 IP :') }}
        </div>
        <div ref="iconTrackRef" class="min-w-0 flex-1 overflow-hidden">
          <div ref="iconListRef" class="flex w-max items-center gap-2">
            <div v-for="data in roxybrowser.iconList" :key="data" class="shrink-0 w-5 h-5 pa-0.75 rounded-1 bg-white">
              <img class="shrink-0 block w-full h-full" :src="data">
            </div>
          </div>
        </div>
        <div v-if="iconListOverflow" class="shrink-0 color-black text-3 self-end">
          ...
        </div>
        <RxButton class="shrink-0 roxy-btn" severity="secondary" variant="outlined" size="md" icon="base/rx_ic_cart" :label="$t('立即购买')" />
      </div>
    </div>

    <div class="w-130 min-h-38">
      <div class="h-full relative flex flex-col pa-4 gap-3 rounded-2 cursor-pointer overflow-visible normal" @click.stop="onBuyProxy(rolaip)">
        <div class="flex gap-3 items-center">
          <img draggable="false" class="block w-10 aspect-1 rounded-2 normal-image shrink-0" :src="rolaip.vendorIcon" :alt="rolaip.vendorName">
          <div class="tt-primary font-[Archivo] text-5 font-600 leading-7">
            {{ rolaip.vendorName }}
          </div>
          <div class="-ml-1 h-5.5 px-2 flex items-center rounded-full dynamic">
            {{ $t('动态代理 IP') }}
          </div>
        </div>

        <div class="pl-13 flex-1 flex flex-wrap gap-col-8 gap-row-1.5">
          <div v-for="item in rolaip.vendorAdv" :key="item" class="flex items-center gap-1.5">
            <div class="w-1.5 h-1.5 bg-[var(--colors-icon-icon-success)] rounded-full shrink-0" />
            <div class="tt-primary text-3 font-500 leading-4.5">
              {{ item }}
            </div>
          </div>
        </div>

        <RxDivider line-only line-color="var(--colors-border-border-subtle)" />

        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-4 min-w-0">
            <div v-for="scene in rolaip.vendorSceneList" :key="scene.title" class="flex items-center gap-2 min-w-0">
              <RxImage class="block size-3.5 shrink-0" :src="scene.icon" :alt="scene.title" />
              <div class="tt-primary text-3 font-500 leading-4 truncate">
                {{ scene.title }}
              </div>
            </div>
          </div>
          <div class="relative shrink-0">
            <div v-if="rolaip.vendorDiscountTitle" class="absolute -top-2.5 -right-1 z-1 h-4.5 flex items-center px-2 rounded-full rola-discount">
              {{ $t('专享福利') }}
            </div>
            <RxButton class="rola-btn" severity="secondary" variant="outlined" size="md" icon="base/rx_ic_cart" :label="$t('立即购买')" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.content {
  border-bottom: 1px solid var(--component-table-border-cell);
  background: var(--colors-background-bg-page);
}

.roxy {
  border: 1px solid var(--pattern-dashboard-card-border-card-referral, #fdebd3);
  background-image: v-bind(imgSrc);
  background-size: cover;
  background-repeat: no-repeat;

  &-image {
    border: 1px solid var(--pattern-proxystore-mood-button-avatar-border);
  }

  &-tag {
    color: #ae7407;
    font-family: 'DingTalk JinBuTi';
    font-size: 12px;
    line-height: normal;
    border: 1px solid #efdfc1;
    background: #f7f0dd;
  }
}

.content .roxy .roxy-btn {
  color: var(--pattern-proxystore-mood-button-text, #97742f) !important;
  border-width: 1px;
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.6);
  background: linear-gradient(110deg, #ffd78c 4.54%, #ffe4b2 46.42%, #ffc96e 88.3%);
  background: linear-gradient(
    110deg,
    var(--pattern-proxystore-mood-button-bg-1, #f8ab57) 4.54%,
    var(--pattern-proxystore-mood-button-bg-2, #f1af5f) 46.42%,
    var(--pattern-proxystore-mood-button-bg-3, #fb8f02) 88.3%
  );

  /* shadow-sm */

  :deep(svg) {
    color: var(--pattern-proxystore-mood-button-icon) !important;
  }

  &:not(:disabled):hover {
    border-color: rgba(255, 255, 255, 0.6);
    background: linear-gradient(
      110deg,
      var(--pattern-proxystore-mood-button-bg-1-hover, #f79e3b) 4.54%,
      var(--pattern-proxystore-mood-button-bg-2-hover, #efa143) 46.42%,
      var(--pattern-proxystore-mood-button-bg-3-hover, #e28102) 88.3%
    );
    box-shadow:
      0 4px 4px -1px rgba(0, 0, 0, 0.02),
      0 1px 1px 0 rgba(0, 0, 0, 0.06);
  }
}

.normal {
  background: var(--colors-background-bg-block);

  &-image {
    border: 1px solid var(--colors-border-border-inactive);
  }
}

.content .normal .rola-btn {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--colors-background-bg-page), var(--colors-background-bg-page)) padding-box,
    linear-gradient(90deg, #12a3fc, #db54f9) border-box;
  box-shadow:
    0 4px 4px -1px rgba(0, 0, 0, 0.02),
    0 1px 1px 0 rgba(0, 0, 0, 0.06);

  &:not(:disabled):hover {
    border-color: transparent;
    background:
      linear-gradient(var(--colors-background-bg-page), var(--colors-background-bg-page)) padding-box,
      linear-gradient(90deg, #12a3fc, #db54f9) border-box;
    box-shadow:
      0 4px 4px -1px rgba(0, 0, 0, 0.02),
      0 1px 1px 0 rgba(0, 0, 0, 0.06);
  }
}

.dynamic {
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: linear-gradient(90deg, #1eed58 0%, #11a3fd 137.63%);
}

.rola-discount {
  color: #fff;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  background: linear-gradient(90deg, #12a3fc 0%, #db54f9 100%);
}
</style>
