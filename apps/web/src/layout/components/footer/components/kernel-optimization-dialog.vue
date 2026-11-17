<script setup lang="ts">
import AppUpgradeTips from '/@/components/business/app-upgrade-tips/index.vue'
import optimizationImage from '/@/assets/images/kernel/optimization.png'
import optimizationVideo from '/@/assets/videos/kernel-optimization.mp4'

const visible = defineModel<boolean>('visible', { default: false })
const page = ref(0)

const tips = computed(() => [
  { content: `<img src="${optimizationImage}" alt="${$t('专为 AI 账号深度优化')}" width="1200" height="768" style="display:block;aspect-ratio:1200/768;height:auto">` },
  { content: `<video><source src="${optimizationVideo}" type="video/mp4"></video>` },
])
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    :header="$t('内核重磅更新')"
    :close-button-props="{ 'severity': 'secondary', 'text': true, 'rounded': true, 'aria-label': $t('关闭') }"
    class="w-120 max-w-[calc(100vw-32px)] max-h-[90vh] !transform-none"
    :pt="{ root: '!will-change-auto', header: '!pb-4', content: '!pb-6', mask: 'z-1002' }"
  >
    <AppUpgradeTips v-if="visible" v-model:page="page" :new-feature-tips="tips" class="[&_.indicator-list]:!my-3">
      <template #before-content>
        <div class="mb-3">
          <p class="m-0 tt-secondary text-3.5 font-500 leading-5.5">
            {{ $t('专为 AI 账号优化，注册、养号成功率行业领先。') }}
          </p>
          <p class="m-0 tt-secondary text-3.5 font-500 leading-5.5">
            {{ $t('立即升级内核，Roxy 为您的 AI 账号保驾护航。') }}
          </p>
        </div>
      </template>
      <template #actions>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <div class="flex flex-wrap items-center gap-3">
            <RxButton variant="text" severity="secondary" size="xs" @click="page = page === 0 ? 1 : 0">
              {{ page === 0 ? $t('下一步') : $t('上一步') }}
            </RxButton>
            <RxButton size="xs" @click="page === 0 ? page = 1 : visible = false">
              {{ page === 0 ? $t('查看操作流程') : $t('完成') }}
            </RxButton>
          </div>
        </div>
      </template>
    </AppUpgradeTips>
  </Dialog>
</template>
