<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import { debounce } from 'es-toolkit'

import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'

const { onConfirm } = defineProps<{
  onConfirm: (code: string) => void | Promise<void>
}>()

defineEmits(['close'])

const [_, onlyErrorToast] = useResponseToast()

const code = ref('')
const loading = ref(false)
const available = ref(false)
const redeemMessage = ref()

const checkCodeDebounce = debounce(checkCode, 500)

async function checkCode(value: string) {
  if (value.length !== 14) {
    available.value = false
    redeemMessage.value = undefined
    return
  }
  loading.value = true
  const { code, data, msg } = await API.pay.userQueryRedeemCodeList({ code: value })
  loading.value = false
  onlyErrorToast(code, msg)
  if (code !== 0)
    return
  available.value = true
  redeemMessage.value = data
}
</script>

<template>
  <div class="w-120 inline-flex flex-col pa-6 pt-4 gap-4">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('兑换码') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>

    <img class="block w-full rounded-md" src="/images/redeem-banner.png">
    <div class="flex flex-col gap-1 pt-2">
      <div class="title">
        {{ $t('请在下方输入礼品码') }}
      </div>
      <div class="desc">
        {{ $t('礼品码是用于兑换 RoxyBrowser 订阅和其他福利的代码。') }}
      </div>
    </div>
    <TsFormInputText v-model.trim="code" class="text-center" size="lg" :placeholder="$t('请输入兑换码')" @update:model-value="checkCodeDebounce" />
    <RxButton size="lg" :loading="loading" :disabled="!available" :label="loading ? $t('检测中...') : $t('兑换')" @click="onConfirm(code)" />
    <div v-if="redeemMessage" class="flex flex-col gap-1">
      <div v-if="redeemMessage.activityName" class="flex items-center gap-1.5">
        <SvgIcon name="other/gift" />
        <span class="name">
          {{ redeemMessage.activityName }}
        </span>
      </div>
      <div class="gift">
        <SvgIcon v-if="!redeemMessage.activityName" name="other/gift" />
        {{ redeemMessage.detail }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: normal;
}

.desc {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  line-height: normal;
}

.name {
  color: var(--colors-text-text-warning);
  font-size: 12px;
  font-weight: 700;
}

.gift {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  display: flex;
  gap: 3px;
}
</style>
