<script setup lang="ts">
import { copyText } from '/@/utils';
import { RxSvgIcon } from '/@/components/rx-icon'

const copied = ref(false)
const modelValue = defineModel<string[]>({ default: () => [] })

const onCopySecret = () => {
  copied.value = true
  copyText(modelValue.value.join('\n'))
}
</script>

<template>
  <div class="flex flex-col gap-12px">
    <div class="text-[var(--colors-text-text-primary)] font-14px font-600 font-[Inter]">{{ $t('保存您的恢复码') }}</div>
    <div class="text-[var(--colors-text-text-secondary)] font-12px font-400 font-[Inter]">{{
      $t('您可以将恢复码用作双重身份验证，以防您无法访问设备。我们建议您使用安全的密码管理器（例如 1Password、Authy 或 Keeper）保存它们。') }}</div>
    <div class="flex justify-center px-16px py-12px rounded-8px bg-[var(--colors-background-bg-block)] ">
      <div
        class="grid grid-cols-2 gap-x-64px justify-center font-[DM_Mono] font-14px font-500 text-[var(--colors-text-text-primary)] leading-24px">
        <div v-for="i in modelValue">{{ i }}</div>
      </div>
    </div>
    <div class="flex justify-end w-full">
      <RxButton size="xxs" :label="$t('复制代码')" severity="secondary" outlined @click="onCopySecret">
        <template #icon>
          <RxSvgIcon :name="copied ? 'base/rx_ic_check' : 'base/rx_ic_copy'" size="16px"
            :color="copied ? 'var(--colors-icon-icon-success)' : 'var(--colors-icon-icon-secondary)'"
            class="cursor-pointer" @click="onCopySecret" />
        </template>
      </RxButton>
    </div>
  </div>
</template>