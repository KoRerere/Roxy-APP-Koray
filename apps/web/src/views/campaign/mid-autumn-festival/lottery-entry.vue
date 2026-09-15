<script setup lang="ts">
import { useCampaignStore } from '/@/stores/campaign'

const { seasonalActivity } = storeToRefs(useCampaignStore())
</script>

<template>
  <div v-if="seasonalActivity.midAutumnFestival">
    <div class="flex items-center gap-1.5">
      <div>🎁</div>
      <div class="flex flex-col gap-1">
        <div>{{ $t('中秋狂欢季 · 盲盒抽奖') }}</div>
        <div>{{ $t('续费成功！您已获得 1 次盲盒抽奖，最高可赢 MacBook Pro M5') }}</div>
      </div>
    </div>
    <RxButton severity="warn" :label="$t('去抽奖')" />
  </div>
</template>

<style scoped></style>
