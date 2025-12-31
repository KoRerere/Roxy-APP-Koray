<script setup lang="tsx">
import type { UserGetProxyProviderListListData } from '@roxy/backend-api'
import SpecialSupportFor from './special-support-for.vue'
import { useUserStore } from '/@/stores/user'
import RxButton from '/@/components/rx-button'
import { $t, useI18n } from '/@/locales'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import currency from 'currency.js'
import RxCopyable from '/@/components/rx-copy/src/rx-copyable.vue'

const props = defineProps<{
  item: UserGetProxyProviderListListData['data'][number]
  updateApiKey: (id: number, apiKey: string) => void
}>()

const { userPayInfo } = storeToRefs(useUserStore())
const currentProvider = defineModel()
const [showToast, onlyErrorToast] = useResponseToast()
const { locale } = useI18n()

function onBuy(item: any) {
  currentProvider.value = item
}

async function onJump(item: any) {
  // 第三方的合作商（使用跳转的方式）
  if (item.jumpInfo.thirdUuid) {
    const url = new URL(item.jumpInfo?.jumpUrl)
    url.searchParams.set('token', item.jumpInfo.thirdUuid)
    window.open(url.toString(), '_blank')
  }
  // 内部品牌（当apiKey不存在时，需要先注册账号）
  else if (!item.jumpInfo?.apiKey) {
    const result = await API.proxy.userRegisterProxyProviderUserCreate({ proxyProviderId: item.id })

    if (result.code === 0) {
      const url = new URL(item.jumpInfo?.jumpUrl)
      url.searchParams.set('token', result.data)
      props.updateApiKey(item.id, result.data)
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
  // 内部品牌（apiKey 已存在，则直接跳转）
  else {
    const url = new URL(item.jumpInfo?.jumpUrl)
    url.searchParams.set('token', item.jumpInfo?.apiKey)
    window.open(url.toString(), '_blank')
  }
}

function getProviderHome(website: string) {
  const url = new URL(website)
  return (url.host).toLocaleLowerCase()
}

function calcDiscount(discount: number) {
  if (locale.value === 'zh-CN') {
    return discount * 10
  }
  else {
    return 100 - (discount * 100)
  }
}

const showPassword = ref(false)
</script>

<template>
  <div :key="item.proxyProviderName" class="pa-5 provider">
    <div class="h-full flex flex-col">
      <div class="flex items-center gap-2.5">
        <img class="block w-11 h-11 rounded-lg border-1 border-solid border-color-[var(--colors-border-border-action)]" :src="item.proxyProviderIcon">
        <div class="flex flex-col gap-1.5">
          <div class="provider-name">
            {{ item.proxyProviderName }}
          </div>
          <div class="flex gap-2.5">
            <div v-for="tag in item.proxyTypeList" :key="tag.id" class="provider-tag">
              {{ tag.typeName }}
            </div>
          </div>
        </div>
      </div>
      <div class="mt-2.5 provider-desc whitespace-pre-line" v-html="item.proxyProviderDesc" />

      <div v-if="item.isJump" class="py-1.5 px-2 rounded-1 bg-[var(--component-skeleton-bg-overlay)] flex gap-4 mt-4">
        <div class="font-[Inter] text-3 leading-18px">
          <span class="text-[var(--colors-text-text-inactive)]">{{ $t('账号：') }}</span>
          <RxCopyable>
            <span class=" text-[var(--colors-text-text-primary)]">{{ item.jumpInfo?.username }}</span>
          </RxCopyable>
        </div>
        <div class="font-[Inter] text-3 leading-18px flex items-center">
          <span class="text-[var(--colors-text-text-inactive)]">{{ $t('初始密码：') }}</span>
          <div class="flex items-center gap-2 text-[var(--colors-text-text-primary)]">
            <RxCopyable v-if="showPassword">
              <span class="cursor-pointer">{{ item.jumpInfo?.password }}</span>
            </RxCopyable>
            <span v-else>********</span>
            <SvgIcon class="cursor-pointer" :name="`${showPassword ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'}`" @click="showPassword = !showPassword" />
          </div>
        </div>
      </div>

      <RxDivider class="my-4" line-only line-color="var(--component-dropdown-divider)" />

      <template v-if="item.proxyProviderName === 'RoxyBrowser'">
        <SpecialSupportFor />
        <RxDivider class="my-4" line-only line-color="var(--component-dropdown-divider)" />
      </template>

      <div class="flex-1 flex flex-col gap-3">
        <div class="provider-subtitle">
          {{ $t('优势') }}
        </div>
        <div class="grid gap-2.5" :class="[item.proxyProviderAdv && item.proxyProviderAdv.length > 4 ? 'grid-cols-3' : 'grid-cols-2']">
          <div v-for="advantage in item.proxyProviderAdv" :key="advantage" class="flex items-center gap-1.5">
            <SvgIcon class="cursor-pointer" name="status/rx_ic_check_fill" size="14" />
            <span class="provider-desc">{{ advantage }}</span>
          </div>
        </div>
      </div>
      <div class="mt-5 flex" :class="[userPayInfo.proxyDiscount && !item.isJump ? 'flex-col gap-3' : 'justify-end items-center']">
        <div v-if="!item.isJump" class="flex-1 provider-price" :class="{ invisible: item.proxyProviderName === 'RoxyBrowser' || item.proxyPrice === 0 }">
          {{ $t('Roxy 独家特惠: 低至 {amount} / IP', { amount: currency(item.proxyPrice!).format() }) }}
        </div>
        <div v-else class="flex-1 provider-price" :class="{ invisible: item.proxyPrice === 0 }">
          {{ $t('Roxy 独家折扣: {discount} 折', { discount: calcDiscount(item.proxyPrice!) }) }}
        </div>
        <div class="relative">
          <div v-if="userPayInfo.proxyDiscount && !item.isJump" class="absolute top-0 right-3 -translate-y-1/2 px-3 py-1 rounded-full z-1 discount">
            {{ $t('额外 {discount}% Off', { discount: userPayInfo.proxyDiscount }) }}
          </div>
          <RxButton
            v-if="item.isJump"
            size="sm"
            icon="base/rx_ic_arrow_top_right"
            severity="secondary"
            outlined
            :label="$t('前往 {home}', { home: getProviderHome(item.proxyProviderWebsite) })"
            @click="onJump(item)"
          />
          <RxButton
            v-else
            class="w-full"
            :size="userPayInfo.proxyDiscount ? 'md' : 'sm'"
            icon="base/rx_ic_cart"
            :label="$t('购买代理 IP')"
            @click="onBuy(item)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.provider {
  border-radius: 8px;
  border: 1px solid var(--colors-border-border-inactive);
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);
  background-color: var(--colors-background-bg-overlay);

  &-name {
    color: var(--colors-text-text-primary);
    font-size: 16px;
    font-weight: 600;
    line-height: 20px;
  }

  &-tag {
    padding: 5px 6px;
    border-radius: 2px;
    border: 1px solid var(--component-tag-border);
    background: var(--component-tag-bg);
    color: var(--colors-text-text-secondary);
    font-family: 'JetBrains Mono';
    font-size: 10px;
    font-weight: 800;
    line-height: 8px;
  }

  &-website {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    line-height: 16px;
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-size: 13px;
    line-height: 18px;
  }

  &-subtitle {
    color: var(--colors-text-text-primary);
    font-size: 13px;
    font-weight: 500;
    line-height: normal;
  }

  &-price {
    font-family: 'DingTalk JinBuTi';
    font-size: 13px;
    line-height: 16px;
    background: linear-gradient(90deg, #12a3fc 0%, #db54f9 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.discount {
  background: #fc9d12;
  color: #fff;
  font-family: 'DingTalk JinBuTi', sans-serif;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
}

.connect {
  border-radius: 8px;
  background: var(--colors-background-bg-block);

  &-text {
    color: var(--colors-text-text-primary);
    text-align: center;
    font-size: 16px;
    font-weight: 600;
    line-height: 20px;
  }

  &-desc {
    color: var(--colors-text-text-inactive);
    text-align: center;
    font-size: 13px;
    line-height: 18px;
  }
}

.redeem {
  &-title {
    color: var(--colors-text-text-primary);
    font-size: 16px;
    font-weight: 600;
    line-height: 20px;
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-size: 14px;
    line-height: 20px;
  }
}
</style>
