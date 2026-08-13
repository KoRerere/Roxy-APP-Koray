<script setup lang="ts">
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
      <div class="flex items-center gap-4">
        <img class="block w-14 h-14 rounded-lg border-1 border-solid border-color-[var(--colors-border-border-action)]" :src="data.vendorIcon">
        <div class="flex flex-col gap-2">
          <div class="tt-primary text-6 font-600 leading-8">
            {{ data.vendorName }}
          </div>
          <div class="flex gap-1.5">
            <span v-for="item in data.proxyTypeList" :key="item" class="provider-tag">{{ item }}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-6">
        <div v-for="item in data.vendorAdv" :key="item" class="flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M11.4714 5.52892C11.7317 5.78927 11.7317 6.21138 11.4714 6.47173L7.47139 10.4717C7.21105 10.7321 6.78893 10.7321 6.52859 10.4717L4.52859 8.47173C4.26824 8.21138 4.26824 7.78927 4.52859 7.52892C4.78893 7.26857 5.21105 7.26857 5.47139 7.52892L6.99999 9.05752L10.5286 5.52892C10.7889 5.26857 11.211 5.26857 11.4714 5.52892Z"
              fill="url(#paint0_linear_51_5755)"
            />
            <path fill-rule="evenodd" clip-rule="evenodd"
                  d="M0.666656 8.00033C0.666656 3.95024 3.9499 0.666992 7.99999 0.666992C12.05 0.666992 15.3333 3.95023 15.3333 8.00033C15.3333 12.0504 12.05 15.3337 7.99999 15.3337C3.9499 15.3337 0.666656 12.0504 0.666656 8.00033ZM7.99999 2.00033C4.68628 2.00033 1.99999 4.68662 1.99999 8.00033C1.99999 11.314 4.68628 14.0003 7.99999 14.0003C11.3137 14.0003 14 11.314 14 8.00033C14 4.68662 11.3137 2.00033 7.99999 2.00033Z"
                  fill="url(#paint1_linear_51_5755)"
            />
            <defs>
              <linearGradient id="paint0_linear_51_5755" x1="15.3333" y1="8.00033" x2="0.666656" y2="8.00033" gradientUnits="userSpaceOnUse">
                <stop stop-color="#11CD69" />
                <stop offset="1" stop-color="#05B1D7" />
              </linearGradient>
              <linearGradient id="paint1_linear_51_5755" x1="15.3333" y1="8.00033" x2="0.666656" y2="8.00033" gradientUnits="userSpaceOnUse">
                <stop stop-color="#11CD69" />
                <stop offset="1" stop-color="#05B1D7" />
              </linearGradient>
            </defs>
          </svg>
          <div class="tt-primary text-3 font-500 leading-4.5">
            {{ item }}
          </div>
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
