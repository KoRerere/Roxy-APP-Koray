<script setup lang="ts">
import { $t } from '/@/locales';
import type { Plan } from '../type';

interface Props {
  plan?: Plan
}

const { plan } = defineProps<Props>()

const advanced = computed(() => [
  [
    $t('创建窗口模板'),
    $t('无限项目数量'),
    $t('窗口同步'),
  ],
  [
    $t('窗口投送（即将推出）'),
    $t('频道权限（即将推出）'),
    $t('API 请求次数（{value}次 / 分钟）', { value: plan?.apiRate }),
  ],
  [
    $t('日志保留时长（{value} 天）', { value: plan?.logDays }),
    $t('专属技术支持'),
  ]
])
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="advanced-title">{{ $t('额外高级功能') }}</div>
    <div class="flex justify-between">
      <div class="flex flex-col gap-4" v-for="(list, index) in advanced" :key="index">
        <div class="flex items-center gap-3" v-for="item in list" :key="item">
          <SvgIcon name="base/rx_ic_check" color="#1CC94D"></SvgIcon>
          <span class="advanced-value">{{ item }}</span>
        </div>
      </div>
    </div>
  </div>
</template>



<style scoped lang="scss">
.advanced {
  &-title {
    color: #000;
    font-family: Inter;
    font-size: 16px;
    font-weight: 600;
    line-height: 20px;
  }

  &-value {
    color: #000;
    font-family: Inter;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }
}
</style>
