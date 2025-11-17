<script setup lang="ts">
interface Props {
  list?: Record<string, any>[]
}

const { list = [] } = defineProps<Props>()
defineEmits(['close'])

const active = ref(list[0])
</script>

<template>
  <div class="flex flex-col items-center justify-center pa-6 pt-4 gap-4 w-80">
    <div class="w-full h-9 flex items-center justify-between">
      <span class="header">{{ $t('加入用户社区') }}</span>
      <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="20" name="base/rx_ic_delete" @click="$emit('close')" />
    </div>
    <RxSelectButton v-model="active" :options="list" size="lg" option-label="name" data-key="name" />
    <div v-if="active" class="flex flex-col w-full pa-3 gap-3 rounded-xl bg-white">
      <img class="block w-full object-cover" :src="active.value">
      <a v-if="active.link" class="text-center" :href="active.link" target="_blank">{{ active.link.replace('https://', '') }}</a>
    </div>
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
</style>
