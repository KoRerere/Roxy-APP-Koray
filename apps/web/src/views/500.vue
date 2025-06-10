<script setup lang="ts">
import CustomEmpty from '/@/components/custom-empty.vue'
import { $t } from '/@/locales/'

const router = useRouter()

const desc = computed(() => {
  return $t('RoxyBrowser 的响应时间过长。<br />请尝试以下方法：<br />1.检查网络连接状态<br />2.参考 <a href="https://faq.roxybrowser.org/zh/guide/1-1Quickly-Create-Profile" target="_blank">常见问题</a> 解决方案<br />3.联系技术支持')
})

const reload = () => {
  window.location.href = '/'
}
</script>

<template>
  <div class="error-page">
    <div class="w-[384px]">
      <CustomEmpty icon="rx_illustration_compass.svg" :title="$t('连接异常')" :desc="desc">
        <template #extra>
          <div class="flex">
            <RxButton severity="secondary" outlined class="w-full" @click="reload">
              {{ $t('刷新页面') }}
            </RxButton>
          </div>
        </template>
      </CustomEmpty>
    </div>
  </div>
</template>

<style scoped lang="scss">
.error-page {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10000;
  background: var(--colors-background-bg-app, #F5FBFF);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
