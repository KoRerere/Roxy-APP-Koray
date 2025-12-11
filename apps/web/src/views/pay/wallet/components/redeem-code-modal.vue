<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import { $t } from '/@/locales'

const { onConfirm } = defineProps<{
  onConfirm: (code: string) => void | Promise<void>
}>()

defineEmits(['close'])

const code = ref('')
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
        {{ $t('请在下方输入兑换码') }}
      </div>
      <div class="desc">
        {{ $t('兑换码是用于兑换订阅和其他福利的代码。') }}
      </div>
    </div>
    <TsFormInputText v-model.trim="code" class="text-center" size="lg" :placeholder="$t('请输入兑换码')" />
    <RxButton size="lg" :disabled="!code" :label="$t('兑换')" @click="onConfirm(code)" />
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
</style>
