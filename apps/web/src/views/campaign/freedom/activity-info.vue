<script setup lang="ts">
import { getImage } from '/@/utils/basic'

defineProps<{
  count: number
  upshiftCount: number
}>()
</script>

<template>
  <div class="relative flex flex-col py-3 px-4 gap-4 rounded-2  overflow-hidden">
    <div class="relative z-1 flex items-center justify-between">
      <div class="text-[#111213] text-3.5 font-600 leading-5">
        {{ $t('活动期间窗口订阅免费升舱') }}
      </div>
      <div class="flex items-center gap-2.5">
        <div class="text-[#111213] text-4 font-[DingTalk_JinBuTi] leading-6">
          {{ $t('{count} 窗口', { count }) }}
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M12.6673 6.84512C13.5562 7.35832 13.5562 8.64132 12.6673 9.15452L5.66732 13.196C4.77843 13.7092 3.66732 13.0677 3.66732 12.0413L3.66732 3.95837C3.66732 2.93197 4.77843 2.29047 5.66732 2.80367L12.6673 6.84512Z"
            fill="url(#paint0_linear_10147_14016)"
          />
          <defs>
            <linearGradient id="paint0_linear_10147_14016" x1="13.334" y1="2.62305" x2="13.0232" y2="13.6405" gradientUnits="userSpaceOnUse">
              <stop stop-color="#4096FF" />
              <stop offset="1" stop-color="#01CAB3" />
            </linearGradient>
          </defs>
        </svg>
        <div class="freedom">
          {{ $t('{count} 窗口', { count: upshiftCount }) }}
        </div>
      </div>
    </div>
    <RxDivider class="relative z-1" line-only line-style="dashed" line-color="var(--colors-border-border-base)" />
    <div class="relative z-1">
      <div class="mb-1 title font-[DingTalk_JinBuTi]">
        {{ $t('五月自由季') }}
      </div>
      <div class="desc">
        {{ $t('1. 订阅即享自动升舱（购买套餐即升一档）') }}
      </div>
      <div class="desc">
        {{ $t('2. 5.1% 的机会赢取 1 年专业版使用权（1000 窗口）') }}
      </div>
      <div class="desc">
        {{ $t('3. 充值领取「五月自由季」限定勋章，解锁永久 5% 续费折扣权益') }}
      </div>
    </div>
    <img draggable="false" class="absolute inset-0 w-full h-full" :src="getImage('campaing/freedom/mid_bg.png')">
    <SvgIcon class="absolute w-16.5 h-16.5 -right-1.5 -bottom-1.5" name="other/palm_tree" size="34" />
  </div>
</template>

<style lang="scss" scoped>
.freedom {
  font-family: 'DingTalk JinBuTi';
  font-size: 18px;
  line-height: 28px;
  background: linear-gradient(91deg, #4096ff 0%, #01cab3 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.title {
  color: #111213;
  font-size: 16px;
  font-weight: 500;
  line-height: 18px;
}

.desc {
  color: #111213;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}

.link {
  color: var(--colors-text-text-link);
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: none;
  text-decoration-thickness: auto;
  text-underline-offset: 25%;
  text-underline-position: from-font;
}
</style>
