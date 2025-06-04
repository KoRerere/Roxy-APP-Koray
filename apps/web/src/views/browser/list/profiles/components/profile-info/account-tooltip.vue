<script setup lang="ts">
import PlatformIcon from '/@/views/account/list/platform-icon.vue';

defineProps({
  platformList: {
    type: Array as PropType<any[]>,
    required: true,
  },
})

</script>

<template>
  <div class="flex flex-col gap-8px">
    <div v-for="item in platformList" :key="item.platformUrl">
      <div class="flex items-center gap-6px">
        <PlatformIcon class="size-16px" v-if="item.platformIcon" :platform-icon="item.platformIconDark"
          :platform-icon-dark="item.platformIconDark" />
        <div class="text-12px color-[var(--component-tooltip-text-primary)] font-500">{{ item.platformUrl }}</div>
      </div>
      <div class="mt-4px text-12px color-[var(--component-tooltip-text-secondary)] font-400 pl-22px"
        v-if="platformList.length === 1 && item.platformUserName">
        {{ item.platformUserName }}
      </div>
    </div>
  </div>
</template>
