<script setup lang="ts">
import { copyText } from '/@/utils';

const copied = ref(false)
const codes = ref([
  '27256-40361',
  'da3e8-4670e',
  '30324-f99a1',
  '37e51-34dc3',
  '10cad-418b9',
  '58458-f0699',
  '4ac6d-452ec',
  '608f5-cac03',
  'b4578-10034',
  '7dcd0-ccde8',
  '21132-f318f',
  '5027a-8fa3b',
  '3b4e8-8b401',
  'aa866-123cb',
  '4fe62-9246b',
  '5738f-61437',
])

const onCopySecret = () => {
  copied.value = true
  copyText(codes.value.join('\n'))
}
</script>

<template>
  <div class="flex flex-col gap-12px">
    <div class="text-[var(--colors-text-text-primary)] font-14px font-600 font-[Inter]">{{ $t('保存您的恢复码') }}</div>
    <div class="text-[var(--colors-text-text-secondary)] font-12px font-400 font-[Inter]">{{
      $t('您可以将恢复码用作双重身份验证，以防您无法访问设备。我们建议您使用安全的密码管理器（例如 1Password、Authy 或 Keeper）保存它们。') }}</div>
    <div
      class="px-16px py-12px rounded-8px bg-[var(--colors-background-bg-block)] flex gap-64px justify-center font-[DM_Mono] font-14px font-500 text-[var(--colors-text-text-primary)] leading-24px">
      <div>
        <div v-for="i in 8">{{ codes[i - 1] }}</div>
      </div>
      <div>
        <div v-for="i in 8">{{ codes[i - 1 + 8] }}</div>
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