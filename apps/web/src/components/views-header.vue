<script setup lang="ts">
import { useBackRoute } from '/@/router/utils';
import { RxSvgIcon } from '/@/components/rx-icon/'

defineProps<Props>()

const router = useRouter()
const { path, query } = useBackRoute()

interface Props {
  title?: string
  showBack?: boolean
}

function onBack() {
  console.log('onBack', path, query)
  router.back()
  router.replace({ path, query })
}
</script>

<template>
  <div class="flex views-header">
    <div class="flex items-center flex-1 gap-2.5">
      <RxSvgIcon v-if="showBack" class="cursor-pointer" name="base/rx_ic_chevron_left" :size="24" @click="onBack" />
      <slot name="title">
        <i18n-t :keypath="((title || $route.meta.title) as string)" scope="global" />
      </slot>
      <slot name="title-after" />
    </div>
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.views-header {
  padding: 9px var(--spacing-4xl, 24px);
  gap: 10px;
  color: #000;
  font-size: 14px;
  font-weight: 600;
  line-height: 26px;
}
</style>
