<script setup lang="ts">
import { $t } from '/@/locales'
import { RxSvgIcon } from '/@/components/rx-icon'

const emit = defineEmits(['click'])

const props = withDefaults(defineProps<{
  status?: 'normal' | 'abnormal'
}>(), {
  status: 'normal'
})

const handleViewCode = () => {
  emit('click')
}

const statusIcon = computed(() => {
  if (props.status === 'normal') {
    return 'status/rx_ic_check_fill'
  } else {
    return 'status/rx_ic_warn_fill'
  }
})

</script>

<template>
  <div class="w-full flex items-center justify-between">
    <div class="flex items-center gap-4px">
      <RxSvgIcon :name='statusIcon' size="16px" />
      {{$t("已配置")}}
    </div>
    <RxButton severity="secondary" outlined @click="handleViewCode">{{$t('编辑')}}</RxButton>
  </div>
</template>