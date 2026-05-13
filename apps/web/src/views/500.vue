<script setup lang="ts">
import CustomEmpty from '/@/components/custom-empty.vue'
import { $t } from '/@/locales/'

const reload = () => {
  window.location.href = '/'
}
</script>

<template>
  <div class="error-page">
    <div class="w-[384px]">
      <CustomEmpty icon="rx_illustration_compass.svg" :title="$t('连接异常')">
        <template #desc>
          <div class="error-help">
            <div class="mb-2">{{ $t('Roxy 浏览器的响应时间过长。') }}</div>
            <div>{{ $t('请尝试以下方法：') }}</div>
            <div>{{ $t('1.检查网络连接状态') }}</div>
            <div>{{ $t('2.同步当前系统时间') }}</div>
            <div class="cursor-pointer error-link" @click="$showLiveChat">{{ $t('3.联系技术支持') }}</div>
          </div>
        </template>
        <template #extra>
          <div class="flex">
            <RxButton severity="secondary" outlined class="w-full" @click="reload" :label="$t('刷新页面')" icon="base/rx_ic_refresh" />
          </div>
        </template>
      </CustomEmpty>
    </div>
  </div>
</template>

<style scoped lang="scss">
.error-page {
  width: 100%;
  height: 100vh;
  background: var(--colors-background-bg-app, #F5FBFF);
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-help {
  color: var(--colors-text-text-tertiary);
  font-family: Inter;
  font-size: 12px;
  line-height: 20px;
}

.error-link {
  color: var(--colors-text-text-link, #11A3FD);
}
</style>
