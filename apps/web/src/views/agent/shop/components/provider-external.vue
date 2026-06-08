<script setup lang="ts">
import { useI18n } from '/@/locales'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText, localDiscountValue } from '/@/utils/basic'
import type { UserGetProxyVendorListListData } from '@roxy/backend-api'

type ShopItem = UserGetProxyVendorListListData['data'][number]

const { data } = defineProps<{
  data: ShopItem
}>()

const autoJump = defineModel<boolean>('autoJump')

const [showToast, onlyErrorToast] = useResponseToast()
const { locale } = useI18n()

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
    onJump(data)
  }
})

function onCopy(value: string) {
  copyText(value)
  showToast(0, $t('复制成功'))
}

async function onJump(item: any) {
  // 第三方的合作商（使用跳转的方式）
  if (!item.jumpInfo.isToken) {
    window.open(item.jumpInfo?.jumpUrl, '_blank')
    return
  }

  if (item.jumpInfo.apiKey) {
    const url = new URL(item.jumpInfo?.jumpUrl)
    url.searchParams.set('token', item.jumpInfo?.apiKey)
    window.open(url.toString(), '_blank')
    return
  }

  const result = await API.proxy.userRegisterProxyProviderUserCreate({ proxyProviderId: item.id })

  if (result.code === 0) {
    const url = new URL(item.jumpInfo?.jumpUrl)
    url.searchParams.set('token', result.data)
    Reflect.set(item.jumpInfo, 'apiKey', result.data)
    window.open(url.toString(), '_blank')
  }
  else if (result.code === 466) {
    window.open(item.jumpInfo?.jumpUrl, '_blank')
    showToast(466, $t('账号已存在，请联系技术支持！'))
  }
  else {
    onlyErrorToast(result.code, result.msg)
  }
}
</script>

<template>
  <div class="relative flex flex-col gap-6 px-30 py-15 overflow-y-auto">
    <div class="flex flex-col gap-4">
      <img class="block w-14 h-14 rounded-lg border-1 border-solid border-color-[var(--colors-border-border-action)]" :src="data.vendorIcon">
      <div class="flex flex-col gap-2.5">
        <div class=" tt-primary text-5 font-600 leading-normal provider-name">
          {{ data.vendorName }}
        </div>
        <div class="flex gap-1.5">
          <span v-for="item in data.proxyTypeList" :key="item" class="provider-tag">{{ item }}</span>
        </div>
      </div>
      <div class="whitespace-pre-line tt-secondary text-3.25 leading-4.5" v-html="data.vendorDesc" />
    </div>
    <RxDivider line-only />

    <div class="flex flex-col gap-5">
      <div class="flex flex-col gap-2 items-start">
        <div class="price" :class="{ invisible: data.vendorDiscount === 0 }">
          {{ $t('Roxy 独家折扣: {discount} 折', { discount: localDiscountValue(locale, data.vendorDiscount!) }) }}
        </div>
        <i18n-t class="tt-primary text-3.5 leading-4.5" tag="div" scope="global" :keypath="$t('使用以下账户登录已享受 {discount}优惠', { discount: '{discount}' })">
          <template #discount>
            <span class="font-500 color-orange">{{ $t('{discount} 折', { discount: localDiscountValue(locale, data.vendorDiscount!) }) }}</span>
          </template>
        </i18n-t>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-6">
        <div class="shrink-0 flex items-center gap-6">
          <div v-for="item in account" :key="item.label" class="flex items-center gap-3 account">
            <div class="account-label">
              {{ item.label }}
            </div>
            <div class="flex items-center justify-between min-w-65 py-2.5 px-3 rounded-1.5 account-value">
              <span>{{ item.value }}</span>
              <SvgIcon class="cursor-pointer" name="base/rx_ic_copy" color="var(--colors-icon-icon-secondary)" @click="onCopy(item.value)" />
            </div>
          </div>
        </div>
        <RxButton class="shrink-0" size="md" icon="base/rx_ic_arrow_top_right" :label="$t('前往 {home}', { home: data.vendorName })" @click="onJump(data)" />
      </div>
    </div>
    <RxDivider line-only />
    <div>
      <RxCarousel>
        <template #default="{ itemClass }">
          <div v-for="item in data.carouselList" :key="item" :class="itemClass">
            <Image preview :src="item"
                   :pt="{ image: 'w-88 block rounded-2 cursor-pointer', closebutton: '!color-black', zoominbutton: '!color-black', zoomoutbutton: '!color-black', rotateleftbutton: '!color-black', rotaterightbutton: '!color-black' }"
            />
          </div>
        </template>
      </RxCarousel>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.provider {
  &-tag {
    display: flex;
    padding: 1px 4px;
    justify-content: center;
    align-items: center;
    border-radius: 2px;
    border: 1px solid var(--component-tag-border);
    background: var(--component-tag-bg);
    color: var(--component-tag-text);
    font-family: 'JetBrains Mono';
    font-size: 10px;
    font-weight: 800;
    line-height: normal;
  }
}

.price {
  font-family: 'DingTalk JinBuTi';
  font-size: 13px;
  line-height: 16px;
  background: linear-gradient(90deg, #12a3fc 0%, #db54f9 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.account {
  &-label {
    color: var(--colors-text-text-secondary);
    font-size: 13px;
    line-height: 18px;
  }

  &-value {
    color: var(--colors-text-text-primary);
    font-size: 13px;
    font-weight: 500;
    line-height: 20px;
    background: var(--component-skeleton-bg-overlay);
  }
}
</style>
