<script setup lang="ts">
import { RxAlert } from "/@/components/rx-alert";
</script>

<template>
  <RxAlert class="warn-message" type="warn" :title="$t('您的 IP 地址已变更')" :content="$t('请注意，您访问账户的操作可能存在风险')"></RxAlert>
</template>

<style lang="scss" scoped>
.warn-message {
  width: 100%;
}
</style>
