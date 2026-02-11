<script setup lang="ts">
import { useSimpleLocale } from '/@/stores/locale'

const emit = defineEmits(['close', 'confirm'])

const { currentLocale } = storeToRefs(useSimpleLocale())

const imageSrc = computed(() => {
  const suffix = ['en', 'ru'].includes(currentLocale.value!) ? 'en' : 'zh-CN'
  return `/images/campaing/spring-festival/cards_${suffix}.png`
})

function onSubscribe() {
  emit('confirm')
  onClose()
}

function onClose() {
  emit('close')
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <RxButton class="self-end" size="xxs" severity="secondary" icon="base/rx_ic_delete" :label="$t('关闭')" @click="onClose" />
    <div class="relative">
      <img class="block w-140 rounded-5" :src="imageSrc">

      <div class="absolute bottom-6 left-6 z-1 flex items-center justify-start gap-2.5">
        <div class="!min-w-40 px-6 h-10 flex items-center rounded-2 justify-center gap-2 cursor-pointer btn btn-sub" @click="onSubscribe">
          <span>{{ $t('即刻订阅') }}</span>
          <SvgIcon name="base/rx_ic_arrow_right" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.btn {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;

  &-sub {
    border: 1px solid #fbdba7;
    background: radial-gradient(93.49% 82.95% at 50% 100%, #ff9a4e 0%, rgba(255, 154, 78, 0) 100%), #ff0019;

    &:hover {
      border-color: #fbdba7;
      background:
        linear-gradient(0deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.1) 100%),
        radial-gradient(93.49% 82.95% at 50% 100%, #ff9a4e 0%, rgba(255, 154, 78, 0) 100%), #ff0019;
    }
  }

  &-detail {
    border: 1px solid #fbdba7;
    background: rgba(0, 0, 0, 0.2);
  }
}
</style>
