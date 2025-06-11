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
    $t('专属技术支持'),
  ],
  [
    $t('窗口投送'),
    $t('频道权限（即将推出）'),
    $t('API 请求次数（{value}次 / 分钟）', { value: plan?.apiRate }),
  ],
  [
    $t('窗口同步'),
    $t('日志保留时长（{value} 天）', { value: plan?.logDays }),
  ]
])

const selfAdvancedFeat: Record<string, boolean> = {
  '0_0': true,
  '1_0': true,
  '2_0': true,
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="advanced-title">{{ $t('额外高级功能') }}</div>
    <div class="flex justify-between">
      <div class="flex flex-col gap-4" v-for="(list, index) in advanced" :key="index">
        <div class="flex items-center gap-3" v-for="(item, idx) in list" :key="item">
          <SvgIcon v-if="selfAdvancedFeat[`${index}_${idx}`]" name="base/rx_ic_portrait-spark-light"></SvgIcon>
          <SvgIcon v-else name="base/rx_ic_check" color="var(--colors-icon-icon-success)"></SvgIcon>
          <span class="advanced-value">{{ item }}</span>
        </div>
      </div>
    </div>
    <div class="flex items-center gap-3 advanced-tip">
      <SvgIcon name="base/rx_ic_portrait-spark" color="var(--colors-icon-icon-note)"></SvgIcon>
      <span>{{ $t('带有此图标的功能可以在任何空间中使用，其他功能仅限在自己创建的空间使用。') }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.advanced {
  &-title {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 16px;
    font-weight: 600;
    line-height: 20px;
  }

  &-value {
    min-width: 150px;
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
  }

  &-tip {
    color: var(--colors-text-text-inactive);
    font-size: 12px;
  }
}
</style>
