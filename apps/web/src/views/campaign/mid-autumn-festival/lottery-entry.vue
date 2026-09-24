<script setup lang="ts">
import { useCampaignStore } from '/@/stores/campaign'
import { useMidAutumnActivity } from './hook'
import { useRoleStore } from '/@/stores/role'
import { getImage } from '/@/utils/basic'

const emit = defineEmits(['openLuckyDraw'])

const { isOwner } = storeToRefs(useRoleStore())
const { seasonalActivity } = storeToRefs(useCampaignStore())
const { showLuckyDraw } = useMidAutumnActivity()

const imgSrc = `url('${getImage('campaing/mid-autumn-festival/pay_success_bg.jpg')}')`

function openLuckyDraw() {
  showLuckyDraw()
  emit('openLuckyDraw')
}
</script>

<template>
  <div v-if="seasonalActivity.midAutumnFestival && isOwner" class="flex items-center justify-between py-3.5 px-4 rounded-2 overflow-hidden banner">
    <div class="flex flex-col gap-1.5">
      <div class="flex items-start gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M9.25586 10.8789V18.5645H4.72168C3.80121 18.5645 3.05469 17.8179 3.05469 16.8975V10.8789H9.25586ZM16.9434 16.8975C16.9434 17.8179 16.1977 18.5643 15.2773 18.5645H10.6992V10.8789H16.9434V16.8975ZM17.1748 6.06445C17.4818 6.06445 17.7771 6.18626 17.9941 6.40332C18.2111 6.62032 18.333 6.91486 18.333 7.22168V9.76855H10.6992V6.06445H17.1748ZM9.25586 9.76855H1.66602V7.22168C1.66606 6.91478 1.78787 6.62033 2.00488 6.40332C2.2219 6.18631 2.51634 6.0645 2.82324 6.06445H9.25586V9.76855Z"
            fill="url(#paint0_linear_13128_125569)"
          />
          <path
            d="M13.1475 1.43506C14.4506 1.43521 15.5545 2.34377 15.5547 3.74951C15.5547 4.83976 14.8764 5.59944 13.9902 6.06494H6.00781C5.1218 5.59942 4.44336 4.83974 4.44336 3.74951C4.44355 2.3438 5.54743 1.43524 6.85059 1.43506C8.05902 1.43506 8.96108 2.21617 9.54492 3.08545C9.71684 3.34143 9.86697 3.61665 9.99902 3.8999C10.1309 3.61676 10.2804 3.34132 10.4521 3.08545C11.036 2.21622 11.9391 1.43514 13.1475 1.43506ZM6.85059 2.82373C6.20995 2.82389 5.8322 3.21142 5.83203 3.74951C5.83203 4.18279 6.09401 4.59116 6.81738 4.9165C7.38382 5.17115 8.15792 5.3285 9.06348 5.3667C8.91978 4.84245 8.69275 4.30581 8.39258 3.85889C7.93479 3.17741 7.40134 2.82373 6.85059 2.82373ZM13.1475 2.82373C12.5968 2.82381 12.0632 3.1775 11.6055 3.85889C11.3053 4.30588 11.0773 4.84238 10.9336 5.3667C11.8398 5.32861 12.6139 5.17131 13.1807 4.9165C13.9042 4.59114 14.166 4.18284 14.166 3.74951C14.1658 3.21141 13.7881 2.82386 13.1475 2.82373Z"
            fill="url(#paint1_linear_13128_125569)"
          />
          <defs>
            <linearGradient id="paint0_linear_13128_125569" x1="3.5179" y1="2.82371" x2="16.9438" y2="19.0277" gradientUnits="userSpaceOnUse">
              <stop stop-color="#FFF1B5" />
              <stop offset="0.48" stop-color="#F5C65C" />
              <stop offset="1" stop-color="#B87324" />
            </linearGradient>
            <linearGradient id="paint1_linear_13128_125569" x1="7.6843" y1="5.60187" x2="12.3143" y2="19.0281" gradientUnits="userSpaceOnUse">
              <stop stop-color="#FFF7CF" />
              <stop offset="1" stop-color="#D99B35" />
            </linearGradient>
          </defs>
        </svg>
        <div class="inline-flex flex-wrap gap-y-1 whitespace-nowrap">
          <i18n-t class="color-white text-4 font-600 leading-5" tag="span" scope="global" :keypath="$t('已获得 {count} 次抽奖机会', { count: '{count}' })">
            <template #count>
              <span class="bouns">1</span>
            </template>
          </i18n-t>
          <span class="rewards">
            {{ $t('100% 中奖') }}
          </span>
        </div>
      </div>
      <div class="color-white text-3.25 leading-4.5">
        {{ $t('最高可赢 MacBook Pro M5 Pro') }}
      </div>
    </div>
    <RxButton class="shrink-0 lottery" severity="warn" :label="$t('去抽奖')" @click="openLuckyDraw" />
  </div>
</template>

<style lang="scss" scoped>
.banner {
  background-image: v-bind(imgSrc);
  background-size: cover;
  background-position: top right;
  background-repeat: no-repeat;
}

.rewards {
  padding: 2px 8px;
  border-radius: 10000px;
  background: linear-gradient(90deg, #b5cefe 0%, #d0b4fc 100%);
  color: #272e3b;
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  line-height: 140%;
}

.bouns {
  background: linear-gradient(180deg, #fbd99b 30.17%, #fcc67e 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.lottery {
  color: #111213 !important;
  border: none !important;
  background: linear-gradient(180deg, #fbd99b -3.12%, #fcc67e 100%) !important;
  box-shadow:
    0 4px 4px -1px rgba(0, 0, 0, 0.02),
    0 1px 1px 0 rgba(0, 0, 0, 0.06);
}
</style>
