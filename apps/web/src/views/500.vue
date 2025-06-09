<script setup lang="ts">
import CustomEmpty from '/@/components/custom-empty.vue'
import { $t } from '/@/locales/'

const router = useRouter()

const desc = computed(() => {
  return $t('当前页面已超时。请检查您的网络连接，或按 Ctrl+R（macOS 上为 Cmd+R）刷新页面。<br /><br />如果此问题仍然存在，请联系客服或访问以下页面获取自助解决方案：<a href="https://faq.roxybrowser.org/zh/guide/1-1Quickly-Create-Profile" target="_blank">文档</a>。')
})

const reload = () => {
  window.location.href = '/'
}
</script>

<template>
  <div class="error-page">
    <div class="w-[384px]">
      <CustomEmpty icon="rx_illustration_compass.svg" :title="$t('出现问题了')" :desc="desc">
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
