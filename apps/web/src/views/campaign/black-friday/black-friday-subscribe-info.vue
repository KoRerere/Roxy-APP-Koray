<script setup lang="ts">
import { differenceInDays, format } from 'date-fns'

import { useUserStore } from '/@/stores/user'

const { userPayInfo } = storeToRefs(useUserStore())

const info = computed(() => ({
  due: userPayInfo.value.isAuto ? $t('自动续订') : $t('有效期至 {date}', { date: format(userPayInfo.value.subEndDate, 'yyyy/MM/dd') }),
  days: userPayInfo.value.isAuto ? '' : $t('(剩余 {day} 天)', { day: Math.max(differenceInDays(userPayInfo.value.subEndDate, userPayInfo.value.subCurrentDate), 1) }),
}))
</script>

<template>
  <div>
    <div class="title">
      {{ $t('订阅时长') }}
    </div>
    <div class="mt-6 flex flex-col gap-4 py-5 px-4 rounded-2xl text-white content">
      <div class="flex justify-between">
        <div class="flex items-center gap-4">
          <div class="due">
            {{ info.due }}
          </div>
          <div class="days">
            {{ info.days }}
          </div>
        </div>
        <div class="deal">
          {{ $t('黑色星期五钜惠') }}
        </div>
      </div>
      <div class="flex items-center gap-2.5">
        <SvgIcon name="base/rx_ic_check_fill" color="var(--colors-icon-icon-success)" />
        <div class="desc">
          {{ $t('黑色星期五优惠已生效，升级窗口数量仍可享受黑色星期五折扣。') }}
        </div>
      </div>
    </div>
    <div class="mt-2 tip">
      {{ $t('* 黑色星期五优惠: 每个账户仅限购买一次。活动最终解释权归 RoxyBrowser 团队所有。') }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.content {
  background-color: var(--campaign-BFCM-bg-card);
  background-image: url('/images/campaing/black-friday/card-bg.svg');
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
}

.due {
  font-size: 24px;
  font-weight: 600;
  line-height: normal;
}

.days {
  color: #a9b0b4;
  font-size: 16px;
  line-height: normal;
}

.deal {
  font-family: Archivo;
  font-size: 16px;
  font-weight: 700;
  line-height: normal;
}

.desc {
  font-size: 16px;
  line-height: normal;
}

.tip {
  color: var(--colors-text-text-inactive);
  text-align: right;
  font-size: 12px;
  line-height: normal;
}
</style>
