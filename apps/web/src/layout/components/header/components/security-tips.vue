<script setup lang="ts">
const emit = defineEmits(['close'])

const remind = ref(false)


function onClose() {
  if (remind.value) {
    // localStorage.setItem('security-tips', 'true')
  }
  emit('close')
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-6 popup">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('安全提示') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="#575D60" @click="$emit('close')" />
    </div>
    <div class="description">
      {{ $t('注意：使用他人的窗口可能存在风险。请确保验证窗口的安全性以保护您的业务资产。') }}
    </div>
    <div class="flex justify-between gap-2">
      <div class="flex items-center gap-2 checkboxitem">
        <Checkbox v-model="remind" binary size="small" input-id="remind" />
        <label for="remind">{{ $t('不再提醒') }}</label>
      </div>
      <RxButton severity="primary" size="lg" :label="$t('我明白了')" @click="onClose" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.popup {
  width: 380px;
}

.header {
  color: var(--Colors-text-text-primary, #111213);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.checkboxitem {
  color: var(--Colors-text-text-primary, #111213);
  font-size: 12px;
  line-height: 16px;
}
</style>