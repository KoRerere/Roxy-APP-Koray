<script setup lang="ts">
import { useUserStore } from '/@/stores/user'

const { identityInfo, userInfo } = storeToRefs(useUserStore())
</script>

<template>
  <div class="flex items-center gap-1 ">
    <SvgIcon v-tooltip.top="identityInfo.text" class="shrink-0" :name="(identityInfo.icon as any)" v-if="identityInfo.icon" />
    <img v-for="badge in userInfo.userBadgeList" :key="badge.des" v-tooltip.top="badge.des" class="block w-4 h-4 shrink-0" :src="badge.icon">
  </div>
</template>

<style scoped></style>
