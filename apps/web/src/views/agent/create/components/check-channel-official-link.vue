<script lang="ts" setup>
import { RxSvgIcon } from '/@/components/rx-icon'
import type { CheckChannelOption } from '../check-channel'

const { option } = defineProps<{
  /** 检测渠道字典项 */
  option?: CheckChannelOption
}>()

/** 非法查询地址不渲染入口，避免 new URL 抛错打断下拉 */
const officialOrigin = computed(() => {
  if (!option?.external || !option.value) {
    return ''
  }
  try {
    return new URL(option.value).origin
  }
  catch {
    return ''
  }
})
</script>

<template>
  <!-- 选项行是 button，拦住事件避免跳转被选中逻辑吃掉 -->
  <a
    v-if="officialOrigin"
    :href="officialOrigin"
    target="_blank"
    class="mx-auto mr-0 flex items-center gap-1"
    @mousedown.stop
    @click.stop
  >
    <span class="text-3 leading-none">{{ $t('官网') }}</span>
    <RxSvgIcon name="base/rx_ic_outlink" size="14" />
  </a>
</template>
