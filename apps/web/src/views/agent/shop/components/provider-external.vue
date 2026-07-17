<script setup lang="ts">
import { useI18n } from '/@/locales'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText } from '/@/utils/basic'
import { useProviderJump } from '/@/views/agent/shop/hooks/useProviderJump'
import type { UserGetProxyVendorListListData } from '@roxy/backend-api'

type ShopItem = UserGetProxyVendorListListData['data'][number]

const { data } = defineProps<{
  data: ShopItem
}>()

const autoJump = defineModel<boolean>('autoJump')

const [showToast] = useResponseToast()
const { locale } = useI18n()
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
        <div class="price" :class="{ invisible: !data.vendorDiscountTitle }">
          {{ data.vendorDiscountTitle }}
        </div>
        <template v-if="data.vendorDiscountDesc">
          <div class="tt-primary text-3.5 leading-4.5" v-html="data.vendorDiscountDesc" />
        </template>
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
        <RxButton class="shrink-0" size="md" icon="base/rx_ic_arrow_top_right" :label="$t('前往 {home}', { home: data.vendorName })" @click="jumpToProvider(data)" />
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
