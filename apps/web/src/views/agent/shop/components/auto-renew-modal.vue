<script setup lang="ts">
import { RxAlert } from "/@/components/rx-alert";

defineOptions({
  inheritAttrs: false,
})

const { onConfirm } = defineProps<{
  onConfirm: () => Promise<void> | void
}>()

defineEmits(['close'])

const notShowAgain = ref(false)

async function _confirm() {
  await onConfirm()
  if (notShowAgain.value) {
    localStorage.setItem('autoRenewModalNotShowAgain', 'true')
  }
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-4 rounded-lg w-120">
    <div class="h-9 flex items-center justify-between">
      <span class="header">{{ $t('开启自动续费') }}</span>
      <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="20" name="base/rx_ic_delete" @click="$emit('close')" />
    </div>
    <div class="flex flex-col gap-2">
      <i18n-t class="desc" tag="div" scope="global" :keypath="$t('开启自动续费后，系统会在代理到期时自动尝试从 {bold} 扣费。', { bold: '{bold}' })">
        <template #bold>
          <span class="desc-bold">{{ $t('Roxy 钱包') }}</span>
        </template>
      </i18n-t>
      <RxAlert class="w-full whitespace-pre-wrap" type="info" :closable="false" :content="$t('距离到期时间不足 {hour} 小时的代理 IP，开启后将立即执行续费。\n到期前 {hour} 小时无法修改自动续费开关。', { hour: 1 })" />
    </div>
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <RxCheckbox v-model="notShowAgain" input-id="notShowAgain" binary />
        <label for="notShowAgain" class="select-none tip">{{ $t('不再提醒') }}</label>
      </div>
      <RxButton :label="$t('开启')" @click="_confirm" />
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

.desc {
  color: var(--colors-text-text-secondary);
  font-size: 14px;
  line-height: 21px;

  &-bold {
    color: var(--colors-text-text-primary);
    font-weight: 600;
  }
}

.tip {
  color: var(--colors-text-text-primary);
  font-size: 12px;
}
</style>
