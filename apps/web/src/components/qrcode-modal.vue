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
  <div class="flex flex-col items-center justify-center pa-6 pt-4 gap-6 w-96">
    <div class="w-full h-9 flex items-center justify-between">
      <span class="header">{{ $t('加入用户社区') }}</span>
      <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="20" name="base/rx_ic_delete" @click="$emit('close')" />
    </div>
    <RxSelectButton v-if="list.length > 1" v-model="active" :options="list" size="lg" option-label="name" data-key="name" />
    <div v-if="active" class="flex flex-col items-center w-full rounded-xl">
      <div class="pa-3 rounded-2 border-1 border-solid border-[var(--colors-border-border-base)] bg-white">
        <img class="mx-auto block w-46 object-cover" :src="active.value">
      </div>
    </div>

    <a v-if="active?.link" class="text-center" :href="active.link" target="_blank">{{ active.link.replace('https://', '') }}</a>

    <template v-if="active?.name === 'WeChat'">
      <div class="text-center title">
        {{ $t('RoxyBrowser 专属技术支持') }}
      </div>
      <div class="py-2 px-4 rounded-2 gift">
        <div class="relative indent-5">
          <SvgIcon class="absolute top-0 left-0" name="other/gift" />
          <span>{{ $t('只需添加 RoxyBrowser 专属技术支持微信，即可延长 {day} 天当前套餐。', { day: 5 }) }}</span>
        </div>
        <br>
        <div>{{ $t('同时邀请您加入官方交流群组。') }}</div>
      </div>
    </template>
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
