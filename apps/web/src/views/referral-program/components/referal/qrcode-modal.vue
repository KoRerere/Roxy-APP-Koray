<script setup lang="ts">
interface Props {
  list?: Record<string, any>[]
  defaultActive?: Record<string, any>
}

const { list = [], defaultActive } = defineProps<Props>()
defineEmits(['close'])

const active = ref(defaultActive || list[0])
</script>

<template>
  <div class="flex flex-col items-center justify-center pa-6 pt-4 gap-4 w-96">
    <div class="w-full h-9 flex items-center justify-between">
      <span class="header">{{ $t('加入用户社区') }}</span>
      <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="20" name="base/rx_ic_delete" @click="$emit('close')" />
    </div>
    <div class=" tt-secondary text-3.5">
      {{ $t('扫描商务经理二维码，专属商务经理将协助您沟通返现比例等事项。') }}
    </div>
    <div v-if="active" class="flex flex-col items-center w-full rounded-xl">
      <div class="pa-3 rounded-2 border-1 border-solid border-[var(--colors-border-border-base)] bg-white">
        <img draggable="false" class="mx-auto block size-46 object-cover" :src="active.value">
      </div>
    </div>

    <a v-if="active?.link" class="text-center" :href="active.link" target="_blank">{{ active.link.replace('https://', '') }}</a>
  </div>
</template>

  <style lang="scss" scoped>
  .header {
  color: var(--colors-text-text-primary);
  font-family: 'Microsoft YaHei UI';
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 700;
  line-height: 18px;
}

.gift {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  line-height: 18px;
  background: var(--colors-background-bg-block);
}
</style>
