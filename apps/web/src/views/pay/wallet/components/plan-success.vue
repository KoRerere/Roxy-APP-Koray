<script setup lang="ts">

import { format } from 'date-fns'
import currency from 'currency.js'
import { useUserStore } from '/@/stores/user';
import { SubLevelEnum, SubLevelEnumStr } from '/@/enums/pay.ts'
import { getAdvancedFeature } from '/@/constants/advanced-feature';

const emit = defineEmits(['confirm'])
const { userPayInfo } = storeToRefs(useUserStore())
const dialogRef = inject<any>('dialogRef')

const features = getAdvancedFeature()
const featureTexts = [
  features.slice(0, 4),
  features.slice(4)
]

function close() {
  dialogRef.value.close()
  emit('confirm')
}
</script>

<template>
  <CardContainer>
    <CardBody class="flex flex-col pa-8 gap-12 popup">
      <div
        class="flex flex-col w-full justify-between pa-4 min-h-63 rounded-xl border-1 border-solid border-[var(--colors-border-border-overlay)] bg-white card">
        <div class="flex justify-between items-center">
          <div class="card-title">
            {{ $t('订阅') }}
          </div>
          <div class="card-expired" v-if="userPayInfo?.subEndDate">
            <span v-if="!!userPayInfo.isAuto">{{ $t('下次扣费: {value}', {
              value: format(userPayInfo.subEndDate, 'yyyy/MM/dd')
            }) }}</span>
            <span v-else>{{ $t('到期时间: {value}', { value: format(userPayInfo.subEndDate, 'yyyy/MM/dd') }) }}</span>
          </div>
        </div>
        <div class="card-plan">{{ SubLevelEnumStr[userPayInfo?.subLevel as SubLevelEnum] }}</div>
        <div class="flex justify-end card-desc">{{ $t('{count} 窗口', {
          count: currency(userPayInfo?.maxWindowCount, {
            symbol: '', precision: 0
          }).format()
        }) }}</div>
      </div>
      <CardItem as="div" :translate-z="1" class="flex flex-col gap-5 feat">
        <div class="flex items-center gap-2.5 feat-title">
          <SvgIcon name="base/rx_ic_check_fill" color="#1CC94D" size="24" />
          <span>{{ $t('您已解锁以下 Roxy 会员功能!') }}</span>
        </div>
        <div class="flex">
          <div class="flex flex-col flex-1 gap-2" v-for="(list, index) in featureTexts" :key="index">
            <div class="flex items-center gap-3 feat-item" v-for="item in list" :key="item">
              <SvgIcon name="base/rx_ic_check" color="#1CC94D" />
              <span>{{ item }}</span>
            </div>
          </div>
        </div>
      </CardItem>
      <CardItem class="w-full" as="div" :translate-z="1">
        <RxButton class="w-full" outlined severity="secondary" size="lg" :label="$t('确认')" @click="close" />
      </CardItem>
    </CardBody>
  </CardContainer>
</template>

<style lang="scss" scoped>
.popup {
  width: 480px;
  border-radius: 12px;
  background: var(--colors-background-bg-page) url('/images/payments/vega.svg') no-repeat -450px -920px/1600px 1430px;
}

.card {
  background: var(--colors-background-bg-action) url('/images/payments/ripple.svg') no-repeat 86px -174px/380px 380px;

  &-title {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Archivo;
    font-size: 20px;
    font-weight: 700;
    line-height: normal;
  }

  &-expired {
    color: var(--colors-text-text-secondary, #b2b6b8);
    font-family: 'JetBrains Mono';
    font-size: 12px;
    line-height: normal;
  }

  &-plan {
    font-family: 'DingTalk JinBuTi';
    font-size: 32px;
    line-height: normal;
    background: linear-gradient(90deg, #12a3fc 0%, #db54f9 50.16%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  &-renew {
    color: var(--colors-text-text-tertiary, #575D60);
    font-family: Inter;
    font-size: 12px;
    line-height: normal;
  }

  &-desc {
    color: var(--colors-text-text-secondary, #b2b6b8);
    font-family: 'JetBrains Mono';
    font-size: 14px;
    line-height: normal;
  }
}

.feat {
  &-title {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Archivo;
    font-size: 24px;
    font-weight: 600;
    line-height: normal;
  }

  &-desc {
    color: var(--colors-text-text-secondary, #b2b6b8);
    font-family: Inter;
    font-size: 14px;
    line-height: 20px;
  }

  &-item {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: 20px;
  }
}
</style>
