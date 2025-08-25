<script setup lang="ts">
import PlatformIcon from '/@/views/account/list/platform-icon.vue';
import { RxSvgIcon } from '/@/components/rx-icon'

defineProps({
  platformList: {
    type: Array as PropType<any[]>,
    required: true,
  },
})

</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex gap-1.5" v-for="item in platformList" :key="item.platformUrl">
      <PlatformIcon class="w-4 h-4" v-if="item.platformIcon" :platform-icon="item.platformIconDark" :platform-icon-dark="item.platformIconDark" />
      <RxSvgIcon v-else name="base/rx_ic_user_key" color="var(--component-tooltip-text-primary)" />
      <div class="flex flex-col gap-1">
        <div class="primary" v-if="platformList.length !== 1">{{ item.platformUserName || '--' }}</div>
        <template v-else>
          <div class="primary">{{ item.platformUrl }}</div>
          <div v-if="item.platformUserName" class="secondary">{{ item.platformUserName }}</div>
        </template>
      </div>
    </div>
  </div>
</template>


<style lang="scss" scoped>
.primary {
  color: var(--component-tooltip-text-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
}

.secondary {
  color: var(--component-tooltip-text-secondary);
  font-size: 12px;
  line-height: 16px;
}
</style>
