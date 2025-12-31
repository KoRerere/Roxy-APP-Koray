<script setup lang="ts">
;

const emit = defineEmits(['close'])

</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-6 popup">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('如何获取空间 ID') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-note)" @click="$emit('close')" />
    </div>
    <div class="description">{{ $t('RoxyBrowser 允许您向任意的工作空间投送窗口：') }}</div>
    <ol class="flex flex-col gap-1 ma-0 pa-0 pl-5">
      <li class="description">{{ $t('您可以直接将窗口投送到您拥有的其他工作空间') }}</li>
      <li class="description">{{ $t('要投送窗口至其他人的工作空间，您需得知相应的空间 ID') }}</li>
    </ol>
    <div class="description">{{ $t('您可以通过以下操作指引获取空间 ID') }}</div>
    <video class="block w-full rounded-md" autoplay muted loop playsinline>
      <source src="/video/copy_workspace_id.mp4" type="video/webm" />
    </video>
    <RxButton class="self-end" @click="$emit('close')" size="md" :label="$t('了解')" />
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 560px;
}

.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.description {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 22.4px;
}
</style>
