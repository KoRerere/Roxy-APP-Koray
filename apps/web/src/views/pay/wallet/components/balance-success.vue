<script setup lang="tsx">
import NumberFlow from '@number-flow/vue'
import currency from 'currency.js'

import { useUserStore } from '/@/stores/user';
import { sleep } from '/@/utils'

const dialogRef = inject<any>('dialogRef')
const emit = defineEmits(['confirm'])
const { userInfo, userPayInfo } = storeToRefs(useUserStore())
const { getUserPayInfo } = useUserStore()

const oldAmount = ref(userPayInfo.value?.balance || 0)
const diffAmount = computed(() => currency(userPayInfo.value?.balance || 0).subtract(oldAmount.value).format())
const retryCount = ref(0)

onMounted(() => {
  getNewUserPayInfo()
})

async function getNewUserPayInfo() {
  await getUserPayInfo()
  if (oldAmount.value === userPayInfo.value?.balance && retryCount.value < 4) {
    // 兜底，后台极小概率存在延迟，如果余额没有变化，则重试
    await sleep(300)
    retryCount.value += 1
    getNewUserPayInfo()
  }
}

function close() {
  dialogRef.value.close()
  emit('confirm')
}
</script>

<template>
  <CardContainer>
    <CardBody class="flex flex-col pa-8 gap-12 popup">
      <div class="flex flex-col w-full justify-between pa-4 min-h-63 rounded-xl bg-white overflow-hidden card">
        <div class="flex justify-between items-center">
          <div class="card-title">
            {{ $t('总余额') }}
          </div>
        </div>
        <div>
          <span class="card-symbol">$</span>
          <NumberFlow class="card-balance" :format="{ minimumFractionDigits: 2 }" :value="userPayInfo?.balance || 0">
          </NumberFlow>
        </div>
        <div class="flex justify-end card-desc">{{ userInfo?.email }}</div>
      </div>
      <CardItem as="div" :translate-z="1" class="flex flex-col gap-3 feat">
        <div class="flex items-center gap-2.5 feat-title">
          <SvgIcon name="base/rx_ic_check_fill" color="#1CC94D" size="24" />
          <span>{{ $t('充值成功！') }}</span>
        </div>
        <i18n-t class="feat-desc" tag="div"
          :keypath="$t('您已成功充值 {amount}，当前钱包余额为 {balance}', { amount: '{amount}', balance: currency(userPayInfo?.balance).format() })"
          scope="global">
          <template #amount>
            <span class="feat-desc-link">{{ diffAmount }}</span>
          </template>
        </i18n-t>
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
  background: var(--colors-background-bg-page);
}

.card {
  position: relative;
  z-index: 1;
  border: 0.5px solid var(--colors-border-border-overlay);
  background: var(--colors-background-bg-action);

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url('/images/payments/ripple_light.svg') no-repeat 86px -174px/380px 380px;
    z-index: -1;
  }

  &:after {
    content: '';
    position: absolute;
    inset: 0;
    background: url('/images/payments/gradient_light.svg') no-repeat -300px -370px/960px 620px;
    z-index: -2;
  }

  &-title {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Archivo;
    font-size: 20px;
    font-weight: 700;
    line-height: normal;
  }

  &-symbol {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 32px;
    font-weight: 600;
    line-height: 42px;
  }

  &-balance {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 40px;
    font-weight: 600;
    line-height: normal;
  }

  &-new {
    color: var(--pattern-sidenav-text-active, #3FB6FD);
    font-family: Inter;
    font-size: 16px;
    font-weight: 600;
    line-height: 32px;
  }

  &-desc {
    color: var(--colors-text-text-secondary, #b2b6b8);
    font-family: 'JetBrains Mono';
    font-size: 14px;
    line-height: normal;
  }
}

[data-theme="dark"] {
  .card {
    &::before {
      background-image: url('/images/payments/ripple_dark.svg');
    }

    &:after {
      background-image: url('/images/payments/gradient_dark.svg');
    }
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
    color: var(--colors-text-text-secondary, #B2B6B8);
    font-family: Inter;
    font-size: 14px;
    line-height: 20px;

    &-link {
      color: var(--colors-text-text-brand, #12A3FC);
      font-weight: 600;
    }
  }
}
</style>
