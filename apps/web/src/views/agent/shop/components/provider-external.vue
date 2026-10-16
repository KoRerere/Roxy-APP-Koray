<script setup lang="ts">
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText, getImage } from '/@/utils/basic'
import { useProviderJump } from '/@/views/agent/shop/hooks/useProviderJump'
import type { UserGetProxyVendorListListData } from '@roxy/backend-api'

type ShopItem = UserGetProxyVendorListListData['data'][number]
/** 动态代理类型卡片，带独立购买页地址 */
type DynamicProxyTypeItem = NonNullable<ShopItem['dynamicProxyTypeList']>['list'][number]

const { data } = defineProps<{
  data: ShopItem
}>()

const autoJump = defineModel<boolean>('autoJump')

const [showToast] = useResponseToast()
const { jumpToProvider } = useProviderJump()

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
</script>

<template>
  <div class="relative flex flex-col gap-6 px-30 py-15 overflow-y-auto">
    <div class="flex flex-col gap-4">
      <div class="flex items-start gap-4">
        <img class="block w-14 h-14 rounded-lg border-1 border-solid border-color-[var(--colors-border-border-action)]" :src="data.vendorIcon">
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <div class="tt-primary text-6 font-600 leading-8">
              {{ data.vendorName }}
            </div>
            <div class="flex gap-1.5">
              <span v-for="item in data.proxyTypeList" :key="item" class="provider-tag">{{ item }}</span>
            </div>
          </div>
          <div class="whitespace-pre-line tt-secondary text-3.25 leading-4.5" v-html="data.introList?.content" />
        </div>
      </div>
    </div>

    <div v-if="data.introList" class="flex flex-col gap-3">
      <div class="grid grid-cols-2 gap-x-4 gap-y-3 pa-4 rounded-2 intro">
        <div v-for="item in data.introList.list" :key="item.title" class="flex flex-col gap-1.5">
          <div class="flex items-center gap-2">
            <RxImage class="size-4 shrink-0" :src="item.icon" :alt="item.title" />
            <div class="tt-primary text-3.5 font-500 leading-5">
              {{ item.title }}
            </div>
          </div>
          <div class="pl-6 tt-secondary text-3 leading-4">
            {{ item.content }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="data.dynamicProxyTypeList" class="flex flex-col gap-3">
      <div class="tt-secondary text-4 font-600 leading-normal">
        {{ data.dynamicProxyTypeList.title }}
      </div>
      <div class="grid grid-cols-4 gap-3">
        <div v-for="item in data.dynamicProxyTypeList.list" :key="item.title" class="flex flex-col pa-4 gap-3 rounded-2 type-item" :class="{ 'cursor-pointer': item.jumpUrl }"
             @click="onJumpProxyType(item)"
        >
          <div class="flex-1 flex items-center gap-2">
            <RxImage class="block w-5 shrink-0" :src="item.icon" :dark-src="item.iconDark" />
            <div class="tt-primary text-4 font-600 leading-normal">
              {{ item.title }}
            </div>
          </div>
          <div class="-mt-1.5 tt-secondary text-3.25 leading-4.5">
            {{ item.content }}
          </div>
          <div v-if="item.priceText" class="tt-warning text-4 font-600 leading-5.5">
            {{ item.priceText }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="data.useCaseList" class="flex items-center gap-4">
      <div class="tt-secondary text-4 font-600 leading-normal">
        {{ data.useCaseList.title }}
      </div>
      <div class="flex flex-wrap gap-2">
        <div v-for="item in data.useCaseList.list" :key="item.title" class="min-w-18 flex justify-center items-center py-1.5 px-2.5 gap-1.5 rounded-1.5 case-item">
          <RxImage class="block w-4 h-4 shrink-0" :src="item.icon" :dark-src="item.iconDark" />
          <div class="tt-primary text-3 font-500 leading-5">
            {{ item.title }}
          </div>
        </div>
      </div>
    </div>

    <div class="relative flex items-center pa-5 gap-5 rounded-2 shrink-0 overflow-hidden select-none gift">
      <img class="block size-15" draggable="false" :src="getImage('proxy/gift_icon.svg')">
      <img class="absolute bottom-0 left-0" draggable="false" :src="getImage('proxy/bg-left.svg')">
      <img class="absolute top-0 right-0" draggable="false" :src="getImage('proxy/bg-right.svg')">
      <div class="flex-1 flex flex-col items-start gap-2">
        <div class="gift-title">
          {{ $t('Roxy 用户专享福利｜流量包或折扣券') }}
        </div>
        <div class="tt-secondary text-3.5 leading-4.5">
          {{ $t('专属账户已创建，无需注册。前往 {home}，即可自动领取专享福利并使用。', { home: data.vendorName }) }}
        </div>
      </div>
      <RxButton class="shrink-0" size="md" icon="base/rx_ic_arrow_top_right" :label="$t('前往 {home}', { home: data.vendorName })" @click="jumpToProvider(data)" />
    </div>

    <div v-if="data.jumpInfo?.password" class="flex flex-wrap items-center justify-between gap-6">
      <div class="shrink-0 flex items-center gap-6">
        <div v-for="item in account" :key="item.label" class="flex items-center gap-3 account">
          <div class="account-label">
            {{ item.label }}
          </div>
          <div class="flex items-center justify-between min-w-65 py-2.5 px-3 rounded-1.5 account-value">
            <span>{{ item.value }}</span>
            <SvgIcon class="cursor-pointer" name="base/rx_ic_copy" color="var(--colors-icon-icon-secondary)" @click="onCopy(item.value!)" />
          </div>
        </div>
      </div>
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

.intro {
  background: var(--colors-background-bg-example);
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

.type-item {
  border: 1px solid var(--colors-border-border-subtle, #c7d1d6);
  background: var(--colors-background-bg-action, #fff);
  transition: all 0.3s;

  &:hover {
    background: var(--colors-background-bg-action-hover, #f1f5f8);
  }
}

.case-item {
  background: var(--colors-background-bg-block);
}

.gift {
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: var(--pattern-proxystore-mood-bg-banner);

  &-title {
    font-family: 'DingTalk JinBuTi';
    font-size: 18px;
    line-height: 24px;
    background: linear-gradient(90deg, #12a3fc 0%, #db54f9 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}
</style>
