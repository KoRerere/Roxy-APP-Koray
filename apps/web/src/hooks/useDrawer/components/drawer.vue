<script setup lang="ts">
import Drawer from 'primevue/drawer'

interface Props {
  title: string,
  position?: 'left' | 'right' | 'top' | 'bottom' | 'full'
  pt?: Record<string, any>
}

const { title, position = 'right', pt } = defineProps<Props>()

const cssModule = useCssModule()

const passThrough = {
  mask: 'pa-3',
  root: 'overflow-hidden rounded-2 border-0.5 !w-auto max-w-full',
  ...pt,
}
</script>

<template>
  <Drawer :position="position" :pt="passThrough" v-bind="$attrs">
    <template #container="{ closeCallback }">
      <slot name="header" :closeCallback="closeCallback">
        <div class="flex justify-between items-center self-stretch gap-3 py-2 pl-4 pr-3" :class="cssModule.header">
          <div class="tt-primary text-3.5 font-600 leading-4.5">{{ title }}</div>
          <RxButton text severity="secondary" size="xxs" icon="base/rx_ic_delete" @click="closeCallback" />
        </div>
      </slot>
      <div class="flex-1 overflow-hidden">
        <slot name="container"></slot>
      </div>
    </template>
  </Drawer>
</template>

<style lang="scss" module>
.header {
  border-bottom: 0.5px solid var(--colors-border-divider);
}
</style>
